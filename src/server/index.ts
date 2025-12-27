import {
	type Connection,
	Server,
	type WSMessage,
	routePartykitRequest,
} from "partyserver";

import type { ChatMessage, Message } from "../shared";

// --- TAMBAHAN: Helper untuk decode token dari log.readtalk ---
function decodeUserToken(token: string): { email: string; userId: string; username: string } | null {
	try {
		// Decode base64 (kebalikan dari btoa)
		const jsonStr = decodeURIComponent(escape(atob(token)));
		const payload = JSON.parse(jsonStr);
		// Validasi struktur dasar
		if (payload && typeof payload === 'object' && payload.email && payload.userId && payload.username) {
			return {
				email: payload.email,
				userId: payload.userId,
				username: payload.username
			};
		}
	} catch (error) {
		console.error("Token decode error:", error);
	}
	return null;
}

// --- KELAS Chat (TIDAK ADA PERUBAHAN) ---
export class Chat extends Server<Env> {
	static options = { hibernate: true };

	messages = [] as ChatMessage[];

	broadcastMessage(message: Message, exclude?: string[]) {
		this.broadcast(JSON.stringify(message), exclude);
	}

	onStart() {
		this.ctx.storage.sql.exec(
			`CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, user TEXT, role TEXT, content TEXT)`,
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
			} satisfies Message),
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
		this.broadcast(message);

		const parsed = JSON.parse(message as string) as Message;
		if (parsed.type === "add" || parsed.type === "update") {
			this.saveMessage(parsed);
		}
	}
}

// --- FUNGSI UTAMA fetch DENGAN ENDPOINT BARU ---
export default {
	async fetch(request, env) {
		const url = new URL(request.url);

		// ====== ENDPOINT BARU: Validasi Token ======
		// Ditambahkan SEBELUM routing PartyKit/Assets, TANPA mengubah struktur lainnya.
		if (url.pathname === "/api/validate-token") {
			// Hanya terima metode GET
			if (request.method !== "GET") {
				return new Response("Method Not Allowed", { status: 405 });
			}

			const token = url.searchParams.get("token");
			if (!token) {
				return new Response("Missing token parameter", { status: 400 });
			}

			// Decode token sederhana (base64 JSON)
			const userData = decodeUserToken(token);
			if (!userData) {
				return new Response("Invalid or expired token", { status: 401 });
			}

			// Berhasil: kembalikan data user (username penting untuk client)
			return Response.json({
				valid: true,
				user: {
					email: userData.email,
					userId: userData.userId,
					username: userData.username // <-- Ini yang akan digunakan di UI chat
				}
			});
		}

		// ====== KODE YANG SUDAH ADA (TIDAK DIUBAH) ======
		// Biarkan PartyKit dan Assets handling request lainnya
		return (
			(await routePartykitRequest(request, { ...env })) ||
			env.ASSETS.fetch(request)
		);
	},
} satisfies ExportedHandler<Env>;
