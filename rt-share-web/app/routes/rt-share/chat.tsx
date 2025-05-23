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
    targetUser: string | null;
    messages: Message[];
    onSendMessage: (text: string) => void;
    onSendFile: (file: File) => void;
    onShowHistory: () => void;
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
    onShowHistory,
    sendInfo = { progress: null },
    receiveInfo = { progress: null },
    connectionStatus,
}: ChatProps) {
    const [messageInput, setMessageInput] = useState("");
    const [menuOpen, setMenuOpen] = useState(false);

    const handleSendMessage = () => {
        const text = messageInput.trim();
        if (!targetUser || !text) return;
        console.log(text);
        onSendMessage(text);
        setMessageInput("");
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!targetUser || !file) return;
        console.log("Sending File", file);
        onSendFile(file);
        e.target.value = ""; // Reset file input
    };

    const indicatorColor =
        connectionStatus === "connected"
            ? "text-green-500 dark:text-green-600"
            : connectionStatus === "connecting" || connectionStatus === "reconnecting"
            ? "text-amber-500 dark:text-amber-600"
            : "text-red-700 dark:text-red-800";

    return (
        <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-800">
            <h2 className="p-3 m-0 bg-gray-100 border-b border-gray-300 dark:bg-gray-700 dark:border-gray-800">
                {targetUser ? `Chat with ${targetUser}` : "Chat"}
                {targetUser && (
                    <span className={`ml-2 text-sm ${indicatorColor}`}>
                        {connectionStatus === "connected"
                            ? "Connected"
                            : connectionStatus === "reconnecting"
                            ? "Reconnecting..."
                            : connectionStatus === "connecting"
                            ? "Connecting..."
                            : "Disconnected"}
                    </span>
                )}
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
            <div className="flex-1 p-4 overflow-y-auto dark:bg-gray-800">
                {targetUser ? (
                    messages.map((message) => (
                        <div
                            key={message.id}
                            className={`mb-2 p-2 rounded-lg max-w-[70%] break-words ${
                                message.sender === currentUser
                                    ? "bg-green-500/20 ml-auto dark:bg-green-600 dark:text-white"
                                    : "bg-white mr-auto dark:bg-gray-700 dark:text-gray-300"
                            }`}
                        >
                            <div className="text-xs text-gray-500 mb-1 dark:text-gray-300">
                                {message.sender === currentUser ? "You" : message.sender}
                            </div>
                            {message.isFile ? (
                                <div className="file-message">{message.filename}</div>
                            ) : (
                                <div className="text-message">{message.text}</div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-300">
                        <p>Select a user to start chatting</p>
                    </div>
                )}
            </div>
            <div className="p-2 flex flex-col gap-2 bg-gray-100 dark:bg-gray-700 md:p-4 md:gap-3">
                <div className="flex gap-2 md:gap-3">
                    <input
                        type="text"
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                        placeholder="Type a message..."
                        className="flex-1 p-2 text-sm border border-gray-300 rounded dark:bg-gray-700 dark:text-gray-300 dark:border-gray-800"
                        disabled={!targetUser}
                    />
                    <button onClick={handleSendMessage} disabled={!targetUser} className="px-3 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600 dark:bg-green-600 disabled:opacity-50">Send</button>
                    <div className="relative">
                        <div className="flex h-full">
                            <label
                                htmlFor="file"
                                className={`px-3 py-2 text-sm bg-green-500 text-white rounded-l cursor-pointer hover:bg-green-600 dark:bg-green-600 ${!targetUser ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                                Send File
                            </label>
                            <button
                                type="button"
                                onClick={() => setMenuOpen(v => !v)}
                                className="px-2 py-2 text-sm bg-green-500 text-white rounded-r hover:bg-green-600 dark:bg-green-600"
                            >
                                &#9650;
                            </button>
                        </div>
                        {menuOpen && (
                            <div className="absolute bottom-full mb-2 right-0 bg-white border border-gray-300 rounded shadow-md dark:bg-gray-700 dark:border-gray-600">
                                <button
                                    onClick={() => { setMenuOpen(false); onShowHistory(); }}
                                    className="block px-4 py-2 text-sm w-full text-left hover:bg-gray-100 dark:hover:bg-gray-600"
                                >
                                    File History
                                </button>
                            </div>
                        )}
                    </div>
                    <input type="file" name="file" id="file" onChange={handleFileChange} className="hidden" />
                </div>
            </div>
        </div>
    );
}
