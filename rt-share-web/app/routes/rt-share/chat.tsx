// src/routes/rt-share/chat.tsx
import { useState } from "react";
import type { Message } from "./types";

interface ChatProps {
    currentUser: string;
    targetUser: string;
    messages: Message[];
    onSendMessage: (text: string) => void;
    onSendFile: (file: File) => void;
}

const MAX_FILE_SIZE_MB = 10;

export function Chat({ currentUser, targetUser, messages, onSendMessage, onSendFile }: ChatProps) {
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
            if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
                alert(`File too large. Max allowed is ${MAX_FILE_SIZE_MB}MB.`);
                return;
            }
            console.log("Sending File", file);
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
                            <div className="file-message">{message.filename}</div>
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
                    <label htmlFor="file" className="send-file" >Send File</label>
                    <input type="file" name="file" id="file" onChange={handleFileChange} />
                </div>
            </div>
        </div>
    );
}
