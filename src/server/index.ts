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
    currentRoomHash: string | null = null;  // NEW: Store room hash

    broadcastMessage(message: Message, exclude?: string[]) {
        this.broadcast(JSON.stringify(message), exclude);
    }

    onStart() {
        // NEW: Extract room hash from request URL
        const requestUrl = this.internal.request.url;  // Changed from this.ctx.request.url
        const url = new URL(requestUrl);
        const pathSegments = url.pathname.split('/').filter(p => p);
        this.currentRoomHash = pathSegments[0] || null;
        
        // Original code for table creation
        this.internal.storage.sql.exec(
            `CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, user TEXT, role TEXT, content TEXT)`
        );

        // MODIFIED: Only load messages for current room hash
        if (this.currentRoomHash) {
            this.messages = this.internal.storage.sql
                .exec(`SELECT * FROM messages WHERE id LIKE '${this.currentRoomHash}%'`)
                .toArray() as ChatMessage[];
        } else {
            // Fallback: load all messages (original behavior)
            this.messages = this.internal.storage.sql
                .exec(`SELECT * FROM messages`)
                .toArray() as ChatMessage[];
        }
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
        // MODIFIED: Add room hash to message ID if we have one
        if (this.currentRoomHash && !message.id.includes(this.currentRoomHash)) {
            message.id = `${this.currentRoomHash}_${message.id}`;
        }
        
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

        // Original save logic
        this.internal.storage.sql.exec(
            `INSERT INTO messages (id, user, role, content) VALUES ('${
                message.id
            }', '${message.user}', '${message.role}', ${JSON.stringify(
                message.content,
            )}) ON CONFLICT (id) DO UPDATE SET content = ${JSON.stringify(
                message.content,
            )}`
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

// NEW: Helper functions for D1 query and room hash generation
async function queryD1ForUser(env: any): Promise<string | null> {
    try {
        // Access ROOM_DB from env (based on wrangler.json binding)
        const latestUser = await env.ROOM_DB.prepare(
            "SELECT user FROM messages ORDER BY ROWID DESC LIMIT 1"
        ).first();
        return latestUser?.user || null;
    } catch (error) {
        console.error('D1 query error:', error);
        return null;
    }
}

async function generateStableRoomHash(identifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(identifier);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).slice(0, 16).join('');
}

// NEW: Main request processor
async function handleChatRequest(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    const pathHash = url.pathname.split('/').filter(p => p)[0] || '';
    
    // Get user identifier
    let userIdentifier = url.searchParams.get('email') || 
                         url.searchParams.get('user') ||
                         getCookie(request, 'email') ||
                         getCookie(request, 'user');
    
    // Query D1 if no identifier from request
    if (!userIdentifier) {
        userIdentifier = await queryD1ForUser(env);
    }
    
    // Show form if still no identifier
    if (!userIdentifier) {
        return showIdentifierForm(url);
    }
    
    // Generate stable room hash
    const roomHash = await generateStableRoomHash(userIdentifier);
    
    // Validate or redirect
    if (pathHash && pathHash !== roomHash) {
        return Response.redirect(`${url.origin}/${roomHash}`);
    }
    
    if (!pathHash) {
        return Response.redirect(`${url.origin}/${roomHash}`);
    }
    
    // Original routing logic
    return (await routePartykitRequest(request, { ...env })) || env.ASSETS.fetch(request);
}

// Helper function
function getCookie(request: Request, name: string): string | null {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) return null;
    
    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
        const [key, value] = cookie.trim().split('=');
        if (key === name) return decodeURIComponent(value);
    }
    return null;
}

function showIdentifierForm(url: URL): Response {
    return new Response(`
        <form method="GET" action="${url.pathname}">
            <input type="text" name="email" placeholder="Your email" required>
            <button type="submit">Enter Chat</button>
        </form>
    `, { headers: { 'Content-Type': 'text/html' } });
}

// MODIFIED fetch handler
export default {
    async fetch(request: Request, env: any) {
        return await handleChatRequest(request, env);
    },
} satisfies ExportedHandler<Env>;
