// src/routes/rt-share/chat.tsx
import { useState } from "react";
import type { User, Message } from "./types";

interface ChatProps {
    currentUser: string;
    targetUser: string;
    ws: WebSocket | null;
    messages: Message[];
    onSendMessage: (text: string) => void;
    onSendFile: (file: File) => void;
    online: boolean;
}

export function Chat({ currentUser, targetUser, ws, messages, onSendMessage, onSendFile }: ChatProps) {
    const [messageInput, setMessageInput] = useState("");

    const handleSendMessage = () => {
        const text = messageInput.trim();
        if (text) {
            console.log(text);
            onSendMessage(text);
            setMessageInput("");
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onSendFile(file);
            e.target.value = ""; // Reset file input
        }
    };

    return (
        <div className="chat-container">
            <h2>Chat with {targetUser}</h2>
            <hr />
            <div className="messages">
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`message ${message.sender === currentUser ? "sent" : "received"}`}
                    >
                        <div className="message-sender">
                            {message.sender === currentUser ? "You" : message.sender}
                        </div>
                        {message.isFile ? (
                            <div className="file-message">
                                <a 
                                    href="#" 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        // Handle file download
                                        if (ws) {
                                            const msg = {
                                                type: "acceptFile",
                                                payload: message.sender,
                                            };
                                            ws.send(JSON.stringify(msg) + "\n");
                                        }
                                    }}
                                >
                                    {message.filename}
                                </a>
                            </div>
                        ) : (
                                <div className="text-message">{message.text}</div>
                            )}
                    </div>
                ))}
            </div>
            <div className="chat-input">
                <div className="input-container">
                <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder="Type a message..."
                />
                <button onClick={handleSendMessage}>Send</button>
                <label for="file" className="send-file" >Send File</label>
                <input type="file" name="file" id="file" onChange={handleFileChange} />
                </div>
            </div>
        </div>
    );
}
