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

    const indicatorColor =
        connectionStatus === "connected"
            ? "text-fetch dark:text-fetch-dark"
            : connectionStatus === "connecting" || connectionStatus === "reconnecting"
            ? "text-edit dark:text-edit-dark"
            : "text-danger dark:text-danger-dark";

    return (
        <div className="flex flex-col h-full bg-tertiary-light dark:bg-secondary">
            <h2 className="p-4 m-0 bg-tertiary border-b border-tertiary-dark dark:bg-secondary-light dark:border-secondary">
                Chat with {targetUser}
                <span className={`ml-2 text-sm ${indicatorColor}`}>
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
                <div className="p-2">
                    <div>
                        Sending {sendInfo.filename} ({sendInfo.size ? formatBytes(sendInfo.size) : ""})… {sendInfo.progress}%
                    </div>
                    <progress value={sendInfo.progress ?? 0} max={100} className="w-full"></progress>
                </div>
            )}
            {receiveInfo.progress !== null && (
                <div className="p-2">
                    <div>
                        Receiving {receiveInfo.filename} ({receiveInfo.size ? formatBytes(receiveInfo.size) : ""})… {receiveInfo.progress}%
                    </div>
                    <progress value={receiveInfo.progress ?? 0} max={100} className="w-full"></progress>
                </div>
            )}
            <div className="flex-1 p-4 overflow-y-auto dark:bg-secondary">
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`mb-2 p-2 rounded-lg max-w-[70%] break-words ${
                            message.sender === currentUser
                                ? "bg-fetch/20 ml-auto dark:bg-fetch-dark dark:text-white"
                                : "bg-tertiary mr-auto dark:bg-secondary-light dark:text-tertiary-dark"
                        }`}
                    >
                        <div className="text-xs text-secondary-light mb-1 dark:text-tertiary-dark">
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
            <div className="p-2 flex flex-col gap-2 bg-tertiary dark:bg-secondary-light md:p-4 md:gap-3">
                <div className="flex gap-2 md:gap-3">
                    <input
                        type="text"
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                        placeholder="Type a message..."
                        className="flex-1 p-2 text-sm border border-tertiary-dark rounded dark:bg-secondary-light dark:text-tertiary-dark dark:border-secondary"
                    />
                    <button onClick={handleSendMessage} className="px-3 py-2 text-sm bg-fetch text-white rounded hover:bg-fetch-dark dark:bg-fetch-dark">Send</button>
                    <label htmlFor="file" className="px-3 py-2 text-sm bg-fetch text-white rounded cursor-pointer hover:bg-fetch-dark dark:bg-fetch-dark">Send File</label>
                    <input type="file" name="file" id="file" onChange={handleFileChange} className="hidden" />
                </div>
            </div>
        </div>
    );
}
