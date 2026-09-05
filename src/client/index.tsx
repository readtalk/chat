import { createRoot } from "react-dom/client";
import { usePartySocket } from "partysocket/react";
import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from "react-router";
import { nanoid } from "nanoid";
import { type ChatMessage, type Message } from "../shared";

function App() {
    const [step, setStep] = useState<'room' | 'name' | 'chat'>('room');
    const [roomName, setRoomName] = useState("");
    const [name, setName] = useState("");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [participants, setParticipants] = useState<string[]>([]);
    const { room } = useParams();
    const navigate = useNavigate();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const socket = usePartySocket({
        party: "chat",
        room,
        enabled: step === 'chat' && !!room,
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

    const handleCreateRoom = async () => {
        try {
            const res = await fetch('/api/room', { method: 'POST' });
            const id = await res.text();
            navigate(`/${id}`);
            setStep('name');
        } catch (err) {
            alert('Failed to create room');
        }
    };

    const handleJoinRoom = () => {
        if (roomName.trim()) {
            navigate(`/${roomName.trim()}`);
            setStep('name');
        }
    };

    const handleNameSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem('nameInput') as HTMLInputElement;
        if (input.value.trim()) {
            setName(input.value.trim());
            setParticipants((prev) => [...prev, input.value.trim()]);
            setStep('chat');
        }
    };

    // ===== STEP 1: ROOM FORM (Center Screen) =====
    if (step === 'room') {
        return (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
                <div style={{ maxWidth: '400px', width: '100%', textAlign: 'center', padding: '20px' }}>
                    <h2>Welcome to READTalk</h2>
                    <input
                        type="text"
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        placeholder="Enter room name"
                        maxLength={32}
                        style={{ width: '100%', height: '48px', border: '2px solid #e0e0e0', borderRadius: '24px', padding: '0 20px', fontSize: '16px', marginBottom: '16px' }}
                    />
                    <button onClick={handleJoinRoom} style={{ height: '48px', border: 'none', borderRadius: '24px', padding: '0 32px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', background: '#0066cc', color: 'white', width: '100%' }}>
                        Join Public Room
                    </button>
                    <div style={{ margin: '24px 0', color: '#666', position: 'relative' }}>
                        <hr style={{ border: 'none', borderTop: '1px solid #e0e0e0' }} />
                        <span style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: '#fff', padding: '0 10px' }}>or</span>
                    </div>
                    <button onClick={handleCreateRoom} style={{ height: '48px', border: 'none', borderRadius: '24px', padding: '0 32px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', background: '#0066cc', color: 'white', width: '100%' }}>
                        Create Private Room
                    </button>
                </div>
            </div>
        );
    }

    // ===== STEP 2: NAME FORM (Center Screen, kaya Repo A) =====
    if (step === 'name') {
        return (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
                <div style={{ maxWidth: '400px', width: '100%', textAlign: 'center', padding: '20px' }}>
                    <h2>Choose your name</h2>
                    <form onSubmit={handleNameSubmit}>
                        <input
                            type="text"
                            name="nameInput"
                            placeholder="Your name"
                            maxLength={32}
                            style={{ width: '100%', height: '48px', border: '2px solid #e0e0e0', borderRadius: '24px', padding: '0 20px', fontSize: '16px', marginBottom: '16px' }}
                        />
                        <button type="submit" style={{ height: '48px', border: 'none', borderRadius: '24px', padding: '0 32px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', background: '#0066cc', color: 'white', width: '100%' }}>
                            Join Chat
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // ===== STEP 3: CHAT (kaya Repo A) =====
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
                const content = e.currentTarget.elements.namedItem('content') as HTMLInputElement;
                if (!content.value.trim()) return;
                const chatMessage: ChatMessage = { id: nanoid(8), content: content.value, user: name, role: "user" };
                setMessages((prev) => [...prev, chatMessage]);
                socket.send(JSON.stringify({ type: "add", ...chatMessage } satisfies Message));
                content.value = "";
            }}>
                <input type="text" name="content" className="chat-input" placeholder={`${name}! Type a message...`} autoComplete="off" />
                <button type="submit" className="send-button">➤</button>
            </form>
        </>
    );
}

createRoot(document.getElementById("root")!).render(
    <BrowserRouter>
        <Routes>
            <Route path="/" element={<App />} />
            <Route path="/:room" element={<App />} />
            <Route path="*" element={<Navigate to="/" />} />
        </Routes>
    </BrowserRouter>
);
