import { issuer } from "@openauthjs/openauth";
import {
  CloudflareStorage,
  type CloudflareStorageOptions,
} from "@openauthjs/openauth/storage/cloudflare";
import { PasswordProvider } from "@openauthjs/openauth/provider/password";
import { PasswordUI } from "@openauthjs/openauth/ui/password";
import {
  type Connection,
  Server,
  type WSMessage,
  routePartykitRequest,
} from "partyserver";
import type { ChatMessage, Message } from "../shared";
import { subjects } from "../shared";

export class Chat extends Server<Env> {
  static options = { hibernate: true };
  messages = [] as ChatMessage[];

  onStart() {
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, user TEXT, role TEXT, content TEXT)`
    );
    this.messages = this.ctx.storage.sql
      .exec(`SELECT * FROM messages`)
      .toArray() as ChatMessage[];
  }

  onConnect(connection: Connection) {
    connection.send(
      JSON.stringify({
        type: "all",
        messages: this.messages,
      } satisfies Message)
    );
  }

  saveMessage(message: ChatMessage) {
    const existingMessage = this.messages.find((m) => m.id === message.id);
    if (existingMessage) {
      this.messages = this.messages.map((m) => {
        if (m.id === message.id) {
          return message;
        }
        return m;
      });
    } else {
      this.messages.push(message);
    }
    this.ctx.storage.sql.exec(
      `INSERT INTO messages (id, user, role, content) VALUES (?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET content = ?`,
      message.id,
      message.user,
      message.role,
      message.content,
      message.content
    );
  }

  onMessage(connection: Connection, message: WSMessage) {
    this.broadcast(message);
    const parsed = JSON.parse(message as string) as Message;
    if (parsed.type === "add" || parsed.type === "update") {
      this.saveMessage(parsed);
    }
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/authorize" || url.pathname === "/callback") {
      const authHandler = {
        fetch: (req: Request, env: Env, ctx: ExecutionContext) => {
          const url = new URL(req.url);
          if (url.pathname === "/") {
            url.searchParams.set("redirect_uri", url.origin + "/callback");
            url.searchParams.set("client_id", "your-client-id");
            url.searchParams.set("response_type", "code");
            url.pathname = "/authorize";
            return Response.redirect(url.toString());
          } else if (url.pathname === "/callback") {
            return Response.json({
              message: "OAuth flow complete!",
              params: Object.fromEntries(url.searchParams.entries()),
            });
          }
          return issuer({
            storage: CloudflareStorage({
              namespace: env.AUTH_STORAGE as CloudflareStorageOptions["namespace"],
            }),
            subjects,
            providers: {
              password: PasswordProvider(
                PasswordUI({
                  sendCode: async (email, code) => {
                    console.log(`Sending code ${code} to ${email}`);
                  },
                  copy: {
                    input_code: "Code (check Worker logs)",
                  },
                }),
              ),
            },
            theme: {
              title: "Authentication",
              primary: "#FF0000",
              favicon: "https://workers.cloudflare.com//favicon.ico",
              logo: {
                dark: "https://imagedelivery.net/wSMYJvS3Xw-n339CbDyDIA/db1e5c92-d3a6-4ea9-3e72-155844211f00/public",
                light:
                  "https://imagedelivery.net/wSMYJvS3Xw-n339CbDyDIA/fa5a3023-7da9-466b-98a7-4ce01ee6c700/public",
              },
            },
            success: async (ctx, value) => {
              return ctx.subject("user", {
                id: await getOrCreateUser(env, value.email),
              });
            },
          }).fetch(req, env, ctx);
        },
      };
      return authHandler.fetch(request, env, ctx);
    }

    return (
      (await routePartykitRequest(request, { ...env })) ||
      env.ASSETS.fetch(request)
    );
  },
} satisfies ExportedHandler<Env>;

async function getOrCreateUser(env: Env, email: string): Promise<string> {
  const result = await env.AUTH_DB.prepare(
    `INSERT INTO user (email) VALUES (?) ON CONFLICT (email) DO UPDATE SET email = email RETURNING id;`
  )
    .bind(email)
    .first<{ id: string }>();
  if (!result) throw new Error(`Unable to process user: ${email}`);
  return result.id;
}
