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
				setMessages((prev) => [...prev, message]);
			} else if (message.type === "all") {
				setMessages(message.messages);
			}
		},
	});

	if (showPopup) {
		return (
			<div style={{ textAlign: "center", marginTop: "50px" }}>
				<h2>Your Name</h2>
				<input
					type="text"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Enter your name..."
				/>
				<button
					onClick={() => {
						if (name.trim()) setShowPopup(false);
					}}
				>
					Start Chat
				</button>
			</div>
		);
	}

	return (
		<div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
			<p>
				Room: {room} | User: {name}
			</p>
			<div style={{ border: "1px solid #ccc", height: "300px", overflowY: "auto", padding: "10px" }}>
				{messages.map((m) => (
					<div key={m.id}>
						<strong>{m.user}:</strong> {m.content}
					</div>
				))}
			</div>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					const input = e.currentTarget.elements.namedItem("content") as HTMLInputElement;
					if (!input.value.trim()) return;
					const msg: ChatMessage = {
						id: nanoid(8),
						content: input.value,
						user: name,
						role: "user",
					};
					setMessages((prev) => [...prev, msg]);
					socket.send(JSON.stringify({ type: "add", ...msg }));
					input.value = "";
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
