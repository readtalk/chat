import { createRoot } from "react-dom/client";
import { usePartySocket } from "partysocket/react";
import React, { useState, useRef, useEffect } from "react";
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
	const [isNameSet, setIsNameSet] = useState(false);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const { room } = useParams();
	const messagesEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	const socket = usePartySocket({
		party: "chat",
		room,
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

	return (
		<>
			<div className="chat-messages">
				{messages.map((message) => (
					<div
						key={message.id}
						className={`message ${message.user === name ? "self" : ""}`}
					>
						{message.user !== name && (
							<span className="sender">{message.user}</span>
						)}
						{message.content}
					</div>
				))}
				<div ref={messagesEndRef} />
			</div>
			<form
				className="chat-input"
				onSubmit={(e) => {
					e.preventDefault();
					const input = e.currentTarget.elements.namedItem(
						"input"
					) as HTMLInputElement;
					if (!input.value.trim()) return;

					if (!isNameSet) {
						setName(input.value.trim());
						setIsNameSet(true);
						input.value = "";
						return;
					}

					const chatMessage: ChatMessage = {
						id: nanoid(8),
						content: input.value,
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
					input.value = "";
				}}
			>
				<input
					type="text"
					name="input"
					placeholder={
						isNameSet
							? `Hello ${name}! Type a message...`
							: "Your Name"
					}
					autoComplete="off"
				/>
				<button type="submit">
					{isNameSet ? "Send" : "Submit"}
				</button>
			</form>
		</>
	);
}

createRoot(document.getElementById("root")!).render(
	<BrowserRouter>
		<Routes>
			<Route path="/" element={<Navigate to={`/${nanoid()}`} />} />
			<Route path="/:room" element={<App />} />
			<Route path="*" element={<Navigate to="/" />} />
		</Routes>
	</BrowserRouter>
);
