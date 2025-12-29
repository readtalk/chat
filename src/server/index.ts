import {
    type Connection,
    Server,
    type WSMessage,
    routePartykitRequest,
} from "partyserver";

import type { ChatMessage, Message } from "../shared";

export class Chat extends Server<Env> {
    static options = { hibernate: true };

    messages = [] as ChatMessage[];

    broadcastMessage(message: Message, exclude?: string[]) {
        this.broadcast(JSON.stringify(message), exclude);
    }

    onStart() {
        // this is where you can initialize things that need to be done before the server starts
        // for example, load previous messages from a database or a service

        // create the messages table if it doesn't exist
        this.ctx.storage.sql.exec(
            `CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, user TEXT, role TEXT, content TEXT)`,
        );

        // load the messages from the database
        this.messages = this.ctx.storage.sql
            .exec(`SELECT * FROM messages`)
            .toArray() as ChatMessage[];
    }

    onConnect(connection: Connection) {
        connection.send(
            JSON.stringify({
                type: "all",
                messages: this.messages,
            } satisfies Message),
        );
    }

    saveMessage(message: ChatMessage) {
        // check if the message already exists
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
            `INSERT INTO messages (id, user, role, content) VALUES ('${
                message.id
            }', '${message.user}', '${message.role}', ${JSON.stringify(
                message.content,
            )}) ON CONFLICT (id) DO UPDATE SET content = ${JSON.stringify(
                message.content,
            )}`,
        );
    }

    onMessage(connection: Connection, message: WSMessage) {
        // let's broadcast the raw message to everyone else
        this.broadcast(message);

        // let's update our local messages store
        const parsed = JSON.parse(message as string) as Message;
        if (parsed.type === "add" || parsed.type === "update") {
            this.saveMessage(parsed);
        }
    }
}

// ====== HANYA 1 FUNGSI TAMBAHAN INI ======
async function getExistingUserFromD1(request: Request, env: any): Promise<string | null> {
    try {
        // 1. Coba dari query parameter
        const url = new URL(request.url);
        const emailFromParam = url.searchParams.get('email') || 
                               url.searchParams.get('user');
        if (emailFromParam) return emailFromParam;
        
        // 2. Coba dari cookie
        const cookieHeader = request.headers.get('Cookie');
        if (cookieHeader) {
            const cookies = cookieHeader.split(';');
            for (const cookie of cookies) {
                const [key, value] = cookie.trim().split('=');
                if (key === 'email' || key === 'user') {
                    return decodeURIComponent(value);
                }
            }
        }
        
        // 3. Coba query D1 untuk user yang sudah ada
        // PASTIKAN: env.ROOM_DB ada (binding dari wrangler.json)
        if (env.ROOM_DB) {
            const result = await env.ROOM_DB.prepare(
                "SELECT user FROM messages ORDER BY rowid DESC LIMIT 1"
            ).first();
            
            if (result?.user) {
                console.log(`Found existing user in D1: ${result.user}`);
                return result.user;
            }
        }
        
        return null;
    } catch (error) {
        console.log("Error getting user from D1:", error);
        return null;
    }
}
// ====== END OF ADDED FUNCTION ======

export default {
    async fetch(request, env) {
        // ====== LOGIC BARU: Cek D1 sebelum routing ======
        const existingUser = await getExistingUserFromD1(request, env);
        
        if (existingUser) {
            // Generate stable hash dari user email
            const encoder = new TextEncoder();
            const data = encoder.encode(existingUser);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const stableHash = hashArray.map(b => b.toString(16).padStart(2, '0')).slice(0, 16).join('');
            
            // Cek apakah URL sudah punya hash
            const url = new URL(request.url);
            const pathHash = url.pathname.split('/').filter(p => p)[0] || '';
            
            // Jika URL tidak punya hash atau hash salah, redirect
            if (!pathHash || pathHash !== stableHash) {
                const newUrl = `${url.origin}/${stableHash}`;
                console.log(`Redirecting user ${existingUser} to ${newUrl}`);
                return Response.redirect(newUrl);
            }
        }
        // ====== END OF NEW LOGIC ======
        
        // ORIGINAL ROUTING LOGIC (TIDAK DIUBAH)
        return (
            (await routePartykitRequest(request, { ...env })) ||
            env.ASSETS.fetch(request)
        );
    },
} satisfies ExportedHandler<Env>;
