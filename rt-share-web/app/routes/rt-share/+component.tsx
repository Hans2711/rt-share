// src/routes/rt-share/+component.tsx
import { useEffect, useState, useRef } from "react";
import type { User, Message } from "./types";
import { Chat } from "./chat";
import type { Message } from "./chat";

import './styles.css';


function generateSessionId() {
    return Math.floor(10000 + Math.random() * 90000).toString();
}

export function RtShare() {
    const [sessionId, setSessionId] = useState("");
    const wsRef = useRef<WebSocket | null>(null); // Change from useState to useRef

    const [users, setUsers] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [messages, setMessages] = useState<Record<string, Message[]>>({});
    const [isOnline, setIsOnline] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // Initialize session ID
        let storedSessionId = localStorage.getItem("sessionId");
        if (!storedSessionId) {
            storedSessionId = generateSessionId();
            localStorage.setItem("sessionId", storedSessionId);
        }
        setSessionId(storedSessionId);

        // Initialize WebSocket
        if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
            const socket = new WebSocket("wss://rt-share.diesing.pro:3000/");
            wsRef.current = socket;

            setIsConnecting(true);

            const connectionTimeout = setTimeout(() => {
                if (socket.readyState !== WebSocket.OPEN) {
                    setError("Connection timed out.");
                    setIsConnecting(false);

                    setTimeout(() => {
                        window.location.reload();
                    }, 3000);
                }
            }, 8000);

            socket.onopen = () => {
                console.log("WebSocket connection established");
                setIsConnecting(false);
                setIsOnline(true);
                const msg = {
                    type: "join",
                    payload: storedSessionId,
                };
                socket.send(JSON.stringify(msg) + "\n");
            };

            socket.addEventListener("error", (event) => {
                setError("WebSocket connection error " + event);
                setIsOnline(false);

                setTimeout(() => {
                    window.location.reload();
                }, 3000);
            });

            socket.onmessage = (event) => {
                const jEvent = JSON.parse(event.data);
                console.log("Received event:", jEvent);

                if (jEvent.type === "join" && jEvent.status === "ok") {
                    // Convert string array to User array
                    const userList: string[] = JSON.parse(jEvent.data);
                    setUsers(userList.map(id => ({ id, isOnline: true })));
                } 
                else if (jEvent.type === "join" && jEvent.status === "userJoin") {
                    const userID = jEvent.data;
                    setUsers(prevUsers => {
                        const existingUser = prevUsers.find(user => user.id === userID);
                        if (existingUser) {
                            return prevUsers.map(user => 
                                user.id === userID ? { ...user, isOnline: true } : user
                            );
                        }
                        return [...prevUsers, { id: userID, isOnline: true }];
                    });
                } 
                else if (jEvent.type === "leave" && jEvent.status === "userLeft") {
                    const userID = jEvent.data;
                    setUsers(prevUsers => 
                        prevUsers.map(user => 
                            user.id === userID ? { ...user, isOnline: false } : user
                        )
                    );
                } 
                else if (jEvent.type === "sendText" && jEvent.status === "dataSend") {
                    const newMessage: Message = {
                        id: Date.now().toString(),
                        text: jEvent.data,
                        sender: jEvent.sender,
                        timestamp: new Date(),
                    };
                    setMessages(prev => ({
                        ...prev,
                        [jEvent.sender]: [...(prev[jEvent.sender] || []), newMessage],
                    }));
                } 
                else if (jEvent.type === "sendFile" && jEvent.status === "requestSendFile") {
                    if (confirm(`Accept File ${jEvent.filename} from ${jEvent.data}`)) {
                        socket.send(JSON.stringify({
                            type: "acceptFile",
                            payload: jEvent.data,
                        }) + "\n");
                    } else {
                        socket.send(JSON.stringify({
                            type: "denyFile",
                            payload: jEvent.data,
                        }) + "\n");
                    }
                } 
                else if (jEvent.type === "sendFile" && jEvent.status === "dataSend") {
                    handleFileDownload(jEvent);
                }
            };

            return () => {
                // Cleanup WebSocket connection
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    const msg = {
                        type: "leave",
                        payload: storedSessionId,
                    };
                    wsRef.current.send(JSON.stringify(msg) + "\n");
                    wsRef.current.close();
                    wsRef.current = null;
                }
            };
        }

    }, []);

    const handleFileDownload = (jEvent: any) => {
        const filename = jEvent.filename;
        const base64 = jEvent.bytes;

        // Convert base64 to binary
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        // Create a Blob and download link
        const blob = new Blob([bytes]);
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Add file message to chat
        if (jEvent.sender) {
            const newMessage: Message = {
                id: Date.now().toString(),
                text: "",
                sender: jEvent.sender,
                timestamp: new Date(),
                isFile: true,
                filename: filename,
            };
            setMessages((prev) => ({
                ...prev,
                [jEvent.sender]: [...(prev[jEvent.sender] || []), newMessage],
            }));
        }
    };

    const handleSendMessage = (targetUser: string, text: string) => {
        if (!wsRef.current) return;

        console.log(text);
        console.log(targetUser);

        const msg = {
            type: "sendText",
            payload: targetUser,
            text: text,
        };
        wsRef.current.send(JSON.stringify(msg) + "\n");

        // Add message to local state
        const newMessage: Message = {
            id: Date.now().toString(),
            text: text,
            sender: sessionId,
            timestamp: new Date(),
        };
        setMessages((prev) => ({
            ...prev,
            [targetUser]: [...(prev[targetUser] || []), newMessage],
        }));
    };

    const handleSendFile = (targetUser: string, file: File) => {
        if (!wsRef.current) return;

        const reader = new FileReader();
        reader.onload = function () {
            const arrayBuffer = reader.result;
            if (!arrayBuffer) return;

            const bytes = Array.from(new Uint8Array(arrayBuffer as ArrayBuffer));

            const msg = {
                type: "sendFile",
                payload: targetUser,
                filename: file.name,
                bytes: bytes,
            };
            wsRef.current.send(JSON.stringify(msg) + "\n");

            // Add file message to local state
            const newMessage: Message = {
                id: Date.now().toString(),
                text: "",
                sender: sessionId,
                timestamp: new Date(),
                isFile: true,
                filename: file.name,
            };
            setMessages((prev) => ({
                ...prev,
                [targetUser]: [...(prev[targetUser] || []), newMessage],
            }));
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <div className="rt-share-container">
            <h2 className="mb-3 text-center">{sessionId}</h2>
            <div className="rt-share-layout">
                <div className="user-list">
                    <h2>
                        {!isOnline
                            ? "Waiting for Connection"
                            : users.filter(user => user.id !== sessionId).length === 0
                                ? "No Users"
                                : "Users"}
                    </h2>
                    <ul>
                        {users
                            .filter(user => user.id !== sessionId)
                            .map(user => (
                                <li
                                    key={user.id}
                                    className={`${selectedUser === user.id ? "selected" : ""} ${!user.isOnline ? "offline" : ""}`}
                                    onClick={() => setSelectedUser(user.id)}
                                >
                                    {user.id} {!user.isOnline && "(Offline)"}
                                </li>
                            ))}
                    </ul>
                </div>
                <div className="chat-area">
                    {isConnecting ? (
                        <div className="loading no-chat-selected">Connecting...</div>
                    ) : error ? (
                            <div className="error no-chat-selected">
                            <p>Error: {error}</p>
                            </div>

                        ) : selectedUser ? (
                                <Chat
                                    currentUser={sessionId}
                                    targetUser={selectedUser}
                                    ws={wsRef.current}
                                    messages={messages[selectedUser] || []}
                                    online={users.some(user => user.id === selectedUser && user.isOnline)}
                                    onSendMessage={(text) => handleSendMessage(selectedUser, text)}
                                    onSendFile={(file) => handleSendFile(selectedUser, file)}
                                />
                            ) : (
                                    <div className="no-chat-selected">
                                        <p>Select a user to start chatting</p>
                                    </div>
                                )}
                </div>
            </div>
        </div>
    );
}
