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
        <div className="flex flex-col h-full">
            {/* Chat Header */}
            <div className="bg-rt-sidebar pr-4 md:px-8 py-4 md:py-5 border-b border-rt-card">
                <div className="flex items-center justify-between pl-14 md:pl-0">
                    <h2 className="text-lg md:text-xl font-semibold text-white">
                        {targetUser ? `Chat with ${targetUser}` : "Chat"}
                    </h2>
                    {targetUser && (
                        <div className={`rounded-full px-3 py-1.5 flex items-center gap-2 ${
                            connectionStatus === "connected"
                                ? "bg-green-800/30"
                                : connectionStatus === "connecting"
                                ? "bg-amber-800/30"
                                : connectionStatus === "reconnecting"
                                ? "bg-amber-800/30"
                                : "bg-red-800/30"
                        }`}>
                            <div className={`w-2 h-2 rounded-full ${
                                connectionStatus === "connected"
                                    ? "bg-rt-green"
                                    : connectionStatus === "connecting"
                                    ? "bg-amber-500"
                                    : connectionStatus === "reconnecting"
                                    ? "bg-amber-500 animate-pulse"
                                    : "bg-red-500"
                            }`}></div>
                            <span className={`text-sm font-medium ${
                                connectionStatus === "connected"
                                    ? "text-rt-green"
                                    : connectionStatus === "connecting"
                                    ? "text-amber-500"
                                    : connectionStatus === "reconnecting"
                                    ? "text-amber-500"
                                    : "text-red-500"
                            }`}>
                                {connectionStatus === "connected"
                                    ? "Connected"
                                    : connectionStatus === "reconnecting"
                                    ? "Reconnecting..."
                                    : connectionStatus === "connecting"
                                    ? "Connecting..."
                                    : "Disconnected"}
                            </span>
                        </div>
                    )}
                </div>
            </div>
                        {/* Progress Bars */}
            {sendInfo.progress !== null && (
                <div className="px-4 md:px-8 py-3 bg-rt-sidebar border-b border-rt-card">
                    <div className="text-rt-text-light text-sm mb-2">
                        Sending {sendInfo.filename} ({sendInfo.size ? formatBytes(sendInfo.size) : ""})… {sendInfo.progress}%
                    </div>
                    <progress
                        value={sendInfo.progress ?? 0}
                        max={100}
                        className="w-full h-2 bg-rt-card rounded-full overflow-hidden"
                    />
                </div>
            )}
            {receiveInfo.progress !== null && (
                <div className="px-4 md:px-8 py-3 bg-rt-sidebar border-b border-rt-card">
                    <div className="text-rt-text-light text-sm mb-2">
                        Receiving {receiveInfo.filename} ({receiveInfo.size ? formatBytes(receiveInfo.size) : ""})… {receiveInfo.progress}%
                    </div>
                    <progress
                        value={receiveInfo.progress ?? 0}
                        max={100}
                        className="w-full h-2 bg-rt-card rounded-full overflow-hidden"
                    />
                </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 md:py-6 space-y-3 md:space-y-4">
                {targetUser ? (
                    messages.map((message) => (
                        <div
                            key={message.id}
                            className={`flex ${message.sender === currentUser ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[85%] md:max-w-[70%] p-3 md:p-4 rounded-2xl ${
                                    message.sender === currentUser
                                        ? 'bg-rt-message-out text-white'
                                        : 'bg-rt-message-in text-white'
                                }`}
                            >
                                <div className="text-xs text-rt-text-light mb-2">
                                    {message.sender === currentUser ? currentUser : message.sender}
                                </div>
                                {message.isFile ? (
                                    <div className="text-sm">{message.filename}</div>
                                ) : (
                                    <div className="text-sm leading-relaxed">{message.text}</div>
                                )}
                                <div className={`text-xs mt-2 ${
                                    message.sender === currentUser ? 'text-white/70' : 'text-rt-text-dark'
                                }`}>
                                    {new Date(message.timestamp).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex items-center justify-center h-full text-rt-text-light">
                        <p>Select a user to start chatting</p>
                    </div>
                )}
            </div>
            {/* Message Input Area */}
            <div className="bg-rt-sidebar px-4 md:px-8 py-4 md:py-5 border-t border-rt-card">
                <div className="flex flex-col md:flex-row gap-3">
                    <input
                        type="text"
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                        placeholder="Type a message..."
                        className="flex-1 bg-rt-card text-white placeholder-rt-text-gray rounded-2xl px-4 py-3 text-sm border-none focus:outline-none focus:ring-2 focus:ring-rt-green"
                        disabled={!targetUser}
                    />
                    <div className="flex gap-3">
                        <button
                            onClick={handleSendMessage}
                            disabled={!targetUser}
                            className="flex-1 md:flex-none bg-rt-green-dark hover:bg-rt-green text-white px-4 md:px-6 py-3 rounded-2xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
                        >
                            Send
                        </button>
                        <label
                            htmlFor="file"
                            className={`flex-1 md:flex-none bg-rt-green-dark hover:bg-rt-green text-white px-4 md:px-6 py-3 rounded-2xl font-semibold cursor-pointer transition-colors flex items-center justify-center text-sm md:text-base ${
                                !targetUser ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                        >
                            Send File
                        </label>
                        <input
                            type="file"
                            name="file"
                            id="file"
                            onChange={handleFileChange}
                            className="hidden"
                            disabled={!targetUser}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
