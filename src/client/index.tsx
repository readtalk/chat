import { createRoot } from "react-dom/client";
import { usePartySocket } from "partysocket/react";
import React, { useState } from "react";
import {
	BrowserRouter,
	Routes,
	Route,
	Navigate,
	useParams,
} from "react-router";
import { nanoid } from "nanoid";

import { type ChatMessage, type Message } from "../shared";

function App() {
	const [name, setName] = useState("");
	const [showPopup, setShowPopup] = useState(true);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const { room } = useParams();

	const socket = usePartySocket({
		party: "chat",
		room,
		enabled: !showPopup,
		onMessage: (evt) => {
			const message = JSON.parse(evt.data as string) as Message;
			if (message.type === "add") {
				const foundIndex = messages.findIndex((m) => m.id === message.id);
				if (foundIndex === -1) {
					setMessages((messages) => [
						...messages,
						{
							id: message.id,
							content: message.content,
							user: message.user,
							role: message.role,
						},
					]);
				} else {
					setMessages((messages) => {
						return messages
							.slice(0, foundIndex)
							.concat({
								id: message.id,
								content: message.content,
								user: message.user,
								role: message.role,
							})
							.concat(messages.slice(foundIndex + 1));
					});
				}
			} else if (message.type === "update") {
				setMessages((messages) =>
					messages.map((m) =>
						m.id === message.id
							? {
									id: message.id,
									content: message.content,
									user: message.user,
									role: message.role,
								}
							: m,
					),
				);
			} else {
				setMessages(message.messages);
			}
		},
	});

	// ============================================================
	// FORM "YOUR NAME" — MUNCUL DULUAN
	// ============================================================
	if (showPopup) {
		return (
			<div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
				<div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg text-center max-w-sm w-full">
					<h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
						Your Name
					</h2>
					<input
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Enter your name..."
						className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
					/>
					<button
						onClick={() => {
							if (name.trim()) {
								setShowPopup(false);
								// Nanolink sudah dibuat di route, chat muncul
							}
						}}
						className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition duration-200"
					>
						Start Chat
					</button>
				</div>
			</div>
		);
	}

	// ============================================================
	// CHAT — MUNCUL SETELAH NAMA DIISI + NANOLINK AKTIF
	// ============================================================
	return (
		<div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
			<div className="flex justify-between items-center mb-4">
				<h1 className="text-xl font-bold">Chat Room: {room}</h1>
				<span className="text-sm text-gray-500 dark:text-gray-400">
					Hello, {name}!
				</span>
			</div>

			<div className="flex-1 overflow-y-auto space-y-2 mb-4 p-2 border border-gray-200 dark:border-gray-700 rounded-lg">
				{messages.map((message) => (
					<div key={message.id} className="flex justify-between items-start p-2 bg-gray-50 dark:bg-gray-800 rounded">
						<span className="font-bold text-blue-600 dark:text-blue-400">{message.user}</span>
						<span className="text-gray-800 dark:text-gray-200 flex-1 ml-4">{message.content}</span>
					</div>
				))}
			</div>

			<form
				className="flex gap-2"
				onSubmit={(e) => {
					e.preventDefault();
					const content = e.currentTarget.elements.namedItem("content") as HTMLInputElement;
					if (!content.value.trim()) return;
					const chatMessage: ChatMessage = {
						id: nanoid(8),
						content: content.value,
						user: name,
						role: "user",
					};
					setMessages((messages) => [...messages, chatMessage]);
					socket.send(JSON.stringify({ type: "add", ...chatMessage } satisfies Message));
					content.value = "";
				}}
			>
				<input
					type="text"
					name="content"
					placeholder={`Hello ${name}! Type a message...`}
					className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
					autoComplete="off"
				/>
				<button
					type="submit"
					className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition duration-200"
				>
					Send
				</button>
			</form>
		</div>
	);
}

// ============================================================
// ROUTING: NANOLINK DARI ROOT
// ============================================================
createRoot(document.getElementById("root")!).render(
	<BrowserRouter>
		<Routes>
			<Route path="/" element={<Navigate to={`/${nanoid()}`} />} />
			<Route path="/:room" element={<App />} />
			<Route path="*" element={<Navigate to="/" />} />
		</Routes>
	</BrowserRouter>,
);
