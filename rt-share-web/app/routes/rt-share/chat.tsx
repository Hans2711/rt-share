// src/routes/rt-share/chat.tsx
import { useState } from "react";
import type { Message } from "./types";

interface ProgressInfo {
    progress: number | null;
    filename?: string;
    size?: number;
}

interface ChatProps {
    currentUser: string;
    targetUser: string;
    messages: Message[];
    onSendMessage: (text: string) => void;
    onSendFile: (file: File) => void;
    sendInfo?: ProgressInfo;
    receiveInfo?: ProgressInfo;
    connectionStatus: "connected" | "connecting" | "reconnecting" | "disconnected";
}

import { formatBytes } from "./helpers";

export function Chat({
    currentUser,
    targetUser,
    messages,
    onSendMessage,
    onSendFile,
    sendInfo = { progress: null },
    receiveInfo = { progress: null },
    connectionStatus,
}: ChatProps) {
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
            console.log("Sending File", file);
            onSendFile(file);
            e.target.value = ""; // Reset file input
        }
    };

    return (
        <div className="chat-container">
            <h2>
                Chat with {targetUser}
                <span className={`connection-indicator ${connectionStatus}`}>
                    {connectionStatus === "connected"
                        ? "Connected"
                        : connectionStatus === "reconnecting"
                        ? "Reconnecting..."
                        : connectionStatus === "connecting"
                        ? "Connecting..."
                        : "Disconnected"}
                </span>
            </h2>
            <hr />
            {sendInfo.progress !== null && (
                <div className="progress-container">
                    <div>
                        Sending {sendInfo.filename} ({sendInfo.size ? formatBytes(sendInfo.size) : ""})… {sendInfo.progress}%
                    </div>
                    <progress value={sendInfo.progress ?? 0} max={100}></progress>
                </div>
            )}
            {receiveInfo.progress !== null && (
                <div className="progress-container">
                    <div>
                        Receiving {receiveInfo.filename} ({receiveInfo.size ? formatBytes(receiveInfo.size) : ""})… {receiveInfo.progress}%
                    </div>
                    <progress value={receiveInfo.progress ?? 0} max={100}></progress>
                </div>
            )}
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
