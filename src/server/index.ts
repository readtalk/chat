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
	userName = ""; // ← Tambahkan ini untuk menyimpan nama

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
		// Kirim nama yang tersimpan
		if (this.userName) {
			connection.send(
				JSON.stringify({
					type: "user-name",
					name: this.userName,
				} satisfies Message),
			);
		}

		// Kirim semua pesan
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
			`INSERT INTO messages (id, user, role, content) VALUES (?, ?, ?, ?)
			 ON CONFLICT (id) DO UPDATE SET content = ?`,
			message.id,
			message.user,
			message.role,
			message.content,
			message.content,
		);
	}

	onMessage(connection: Connection, message: WSMessage) {
		const parsed = JSON.parse(message as string);

		// ============================================================
		// HANDLER UPDATE NAMA
		// ============================================================
		if (parsed.type === "update-name") {
			this.userName = parsed.name;
			this.broadcast(
				JSON.stringify({
					type: "user-name",
					name: this.userName,
				} satisfies Message),
			);
			return;
		}

		// ============================================================
		// HANDLER PESAN CHAT
		// ============================================================
		this.broadcast(message);
		if (parsed.type === "add" || parsed.type === "update") {
			this.saveMessage(parsed);
		}
	}
}

export default {
	async fetch(request, env) {
		return (
			(await routePartykitRequest(request, { ...env })) ||
			env.ASSETS.fetch(request)
		);
	},
} satisfies ExportedHandler<Env>;
