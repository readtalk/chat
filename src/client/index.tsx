import { createRoot } from "react-dom/client";
import { usePartySocket } from "partysocket/react";
import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router";
import { nanoid } from "nanoid";
import { type ChatMessage, type Message } from "../shared";

function App() {
    const [name, setName] = useState("");
    const [isNameSet, setIsNameSet] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [participants, setParticipants] = useState<string[]>([]);
    const { room } = useParams();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const socket = usePartySocket({
        party: "chat",
        room,
        onMessage: (evt) => {
            const message = JSON.parse(evt.data as string) as Message;
            if (message.type === "add") {
                const foundIndex = messages.findIndex((m) => m.id === message.id);
                if (foundIndex === -1) {
                    setMessages((prev) => [...prev, { id: message.id, content: message.content, user: message.user, role: message.role }]);
                } else {
                    setMessages((prev) => {
                        const newMessages = [...prev];
                        newMessages[foundIndex] = { id: message.id, content: message.content, user: message.user, role: message.role };
                        return newMessages;
                    });
                }
            } else if (message.type === "update") {
                setMessages((prev) => prev.map((m) => m.id === message.id ? { id: message.id, content: message.content, user: message.user, role: message.role } : m));
            } else {
                setMessages(message.messages);
            }
        },
    });

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    return (
        <>
            <header className="app-header">
                <span className="header-title">READTalk</span>
                <button className="menu-button">⋮</button>
            </header>
            <div className="main-container">
                <div className="roster">
                    <div className="roster-header">Participants • {participants.length} online</div>
                    {participants.map((p) => (
                        <div key={p} className="roster-item">
                            <span className="status-indicator status-online"></span>
                            <span className="roster-name">{p}</span>
                        </div>
                    ))}
                </div>
                <div className="chatlog" id="chatlog">
                    {messages.map((msg) => (
                        <div key={msg.id} className="chat-message">
                            <span className="username">{msg.user}</span>
                            <span className="timestamp">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <div className="message-content">{msg.content}</div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            </div>
            <form className="input-container" onSubmit={(e) => {
                e.preventDefault();
                if (!isNameSet) {
                    const nameInput = e.currentTarget.elements.namedItem("nameInput") as HTMLInputElement;
                    if (nameInput.value.trim()) {
                        setName(nameInput.value.trim());
                        setIsNameSet(true);
                        setParticipants((prev) => [...prev, nameInput.value.trim()]);
                        nameInput.value = "";
                    }
                    return;
                }
                const content = e.currentTarget.elements.namedItem("content") as HTMLInputElement;
                if (!content.value.trim()) return;
                const chatMessage: ChatMessage = { id: nanoid(8), content: content.value, user: name, role: "user" };
                setMessages((prev) => [...prev, chatMessage]);
                socket.send(JSON.stringify({ type: "add", ...chatMessage } satisfies Message));
                content.value = "";
            }}>
                {!isNameSet ? (
                    <>
                        <input type="text" name="nameInput" className="chat-input" placeholder="Your Name" autoComplete="off" />
                        <button type="submit" className="send-button">➤</button>
                    </>
                ) : (
                    <>
                        <input type="text" name="content" className="chat-input" placeholder={`${name}! Type a message...`} autoComplete="off" />
                        <button type="submit" className="send-button">➤</button>
                    </>
                )}
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
