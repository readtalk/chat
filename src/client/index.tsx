import { createRoot } from "react-dom/client";
import { usePartySocket } from "partysocket/react";
import React, { useState } from "react";
import {
	BrowserRouter,
	Routes,
	Route,
	Navigate,
	useParams,
	useNavigate,
} from "react-router";
import { nanoid } from "nanoid";

import { type ChatMessage, type Message } from "../shared";

function App() {
	const [name, setName] = useState("");
	const [isNameSet, setIsNameSet] = useState(false);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const { room } = useParams();
	const navigate = useNavigate();

	const socket = usePartySocket({
		party: "chat",
		room,
		enabled: isNameSet && !!room,
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

	// ===== YOUR NAME FORM (di kolom chat, bukan popup) =====
	if (!isNameSet) {
		return (
			<div className="chat container">
				{messages.map((message) => (
					<div key={message.id} className="row message">
						<div className="two columns user">{message.user}</div>
						<div className="ten columns">{message.content}</div>
					</div>
				))}
				<form
					className="row"
					onSubmit={(e) => {
						e.preventDefault();
						const input = e.currentTarget.elements.namedItem("nameInput") as HTMLInputElement;
						if (input.value.trim()) {
							setName(input.value.trim());
							setIsNameSet(true);
							const newRoom = nanoid();
							navigate(`/${newRoom}`);
						}
					}}
				>
					<input
						type="text"
						name="nameInput"
						className="ten columns my-input-text"
						placeholder="Your Name"
						autoComplete="off"
					/>
					<button type="submit" className="send-message two columns">
						Submit
					</button>
				</form>
			</div>
		);
	}

	// ===== CHAT =====
	return (
		<div className="chat container">
			{messages.map((message) => (
				<div key={message.id} className="row message">
					<div className="two columns user">{message.user}</div>
					<div className="ten columns">{message.content}</div>
				</div>
			))}
			<form
				className="row"
				onSubmit={(e) => {
					e.preventDefault();
					const content = e.currentTarget.elements.namedItem(
						"content",
					) as HTMLInputElement;
					if (!content.value.trim()) return;
					const chatMessage: ChatMessage = {
						id: nanoid(8),
						content: content.value,
						user: name,
						role: "user",
					};
					setMessages((messages) => [...messages, chatMessage]);
					socket.send(
						JSON.stringify({
							type: "add",
							...chatMessage,
						} satisfies Message),
					);
					content.value = "";
				}}
			>
				<input
					type="text"
					name="content"
					className="ten columns my-input-text"
					placeholder={`Hello ${name}! Type a message...`}
					autoComplete="off"
				/>
				<button type="submit" className="send-message two columns">
					Send
				</button>
			</form>
		</div>
	);
}

createRoot(document.getElementById("root")!).render(
	<BrowserRouter>
		<Routes>
			<Route path="/" element={<App />} />
			<Route path="/:room" element={<App />} />
			<Route path="*" element={<Navigate to="/" />} />
		</Routes>
	</BrowserRouter>,
);
