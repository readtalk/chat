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

	if (showPopup) {
		return (
			<div className="popup">
				<h2>Your Name</h2>
				<input
					type="text"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Enter your name..."
				/>
				<button
					onClick={() => {
						if (name.trim()) {
							setShowPopup(false);
						}
					}}
				>
					Start Chat
				</button>
			</div>
		);
	}

	return (
		<div className="chat">
			<div>
				Room: {room} | Hello, {name}!
			</div>
			<div>
				{messages.map((message) => (
					<div key={message.id}>
						<strong>{message.user}:</strong> {message.content}
					</div>
				))}
			</div>
			<form
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
					socket.send(JSON.stringify({ type: "add", ...chatMessage }));
					content.value = "";
				}}
			>
				<input type="text" name="content" placeholder="Type a message..." />
				<button type="submit">Send</button>
			</form>
		</div>
	);
}

createRoot(document.getElementById("root")!).render(
	<BrowserRouter>
		<Routes>
			<Route path="/" element={<Navigate to={`/${nanoid()}`} />} />
			<Route path="/:room" element={<App />} />
		</Routes>
	</BrowserRouter>,
);
