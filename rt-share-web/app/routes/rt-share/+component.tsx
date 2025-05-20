// src/routes/rt-share/+component.tsx
import { useEffect, useState, useRef } from "react";
import type { User, Message } from "./types";
import { Chat } from "./chat";

import './styles.css';


function generateSessionId() {
    return Math.floor(10000 + Math.random() * 90000).toString();
}

export function RtShare() {
    const [sessionId, setSessionId] = useState("");
    const wsRef = useRef<WebSocket | null>(null); // Change from useState to useRef
    const peerConns = useRef<Record<string, RTCPeerConnection>>({});
    const dataChannels = useRef<Record<string, RTCDataChannel>>({});

    const [users, setUsers] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [messages, setMessages] = useState<Record<string, Message[]>>({});
    const [isOnline, setIsOnline] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState('');

    const selectUser = (uid: string) => {
        setSelectedUser(uid);
        createPeerConnection(uid, true);
    };

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
                else if (jEvent.type === "offer") {
                    handleOffer(jEvent.sender, jEvent.data);
                }
                else if (jEvent.type === "answer") {
                    handleAnswer(jEvent.sender, jEvent.data);
                }
                else if (jEvent.type === "candidate") {
                    handleCandidate(jEvent.sender, jEvent.data);
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

    const setupDataChannel = (userId: string, channel: RTCDataChannel) => {
        dataChannels.current[userId] = channel;
        channel.onmessage = (e) => {
            const data = JSON.parse(e.data);
            if (data.type === "text") {
                const newMessage: Message = {
                    id: Date.now().toString(),
                    text: data.text,
                    sender: userId,
                    timestamp: new Date(),
                };
                setMessages(prev => ({
                    ...prev,
                    [userId]: [...(prev[userId] || []), newMessage],
                }));
            } else if (data.type === "file") {
                handleFileDownload({ filename: data.filename, bytes: data.bytes, sender: userId });
            }
        };
    };

    const createPeerConnection = (userId: string, initiator: boolean) => {
        if (peerConns.current[userId]) return;
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        peerConns.current[userId] = pc;

        pc.onicecandidate = (e) => {
            if (e.candidate && wsRef.current) {
                wsRef.current.send(
                    JSON.stringify({
                        type: "candidate",
                        payload: userId,
                        text: JSON.stringify(e.candidate),
                    }) + "\n"
                );
            }
        };

        pc.ondatachannel = (e) => {
            setupDataChannel(userId, e.channel);
        };

        if (initiator) {
            const channel = pc.createDataChannel("chat");
            setupDataChannel(userId, channel);
            pc.createOffer()
                .then((offer) => pc.setLocalDescription(offer))
                .then(() => {
                    if (wsRef.current && pc.localDescription) {
                        wsRef.current.send(
                            JSON.stringify({
                                type: "offer",
                                payload: userId,
                                text: JSON.stringify(pc.localDescription),
                            }) + "\n"
                        );
                    }
                });
        }
    };

    const handleOffer = (userId: string, data: string) => {
        createPeerConnection(userId, false);
        const pc = peerConns.current[userId];
        const offer = JSON.parse(data);
        pc.setRemoteDescription(new RTCSessionDescription(offer)).then(() => {
            return pc.createAnswer();
        }).then(answer => {
            return pc.setLocalDescription(answer);
        }).then(() => {
            if (wsRef.current && pc.localDescription) {
                wsRef.current.send(
                    JSON.stringify({
                        type: "answer",
                        payload: userId,
                        text: JSON.stringify(pc.localDescription),
                    }) + "\n"
                );
            }
        });
    };

    const handleAnswer = (userId: string, data: string) => {
        const pc = peerConns.current[userId];
        if (!pc) return;
        const answer = JSON.parse(data);
        pc.setRemoteDescription(new RTCSessionDescription(answer));
    };

    const handleCandidate = (userId: string, data: string) => {
        const pc = peerConns.current[userId];
        if (!pc) return;
        const candidate = JSON.parse(data);
        pc.addIceCandidate(new RTCIceCandidate(candidate));
    };

    const handleSendMessage = (targetUser: string, text: string) => {
        const channel = dataChannels.current[targetUser];
        if (!channel || channel.readyState !== "open") {
            alert("Peer connection not established yet.");
            return;
        }

        channel.send(JSON.stringify({ type: "text", text }));

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
        const channel = dataChannels.current[targetUser];
        if (!channel || channel.readyState !== "open") {
            alert("Peer connection not established yet.");
            return;
        }

        const reader = new FileReader();
        reader.onload = function () {
            const arrayBuffer = reader.result;
            if (!arrayBuffer) return;

            const bytes = Array.from(new Uint8Array(arrayBuffer as ArrayBuffer));
            const binary = bytes.map((b) => String.fromCharCode(b)).join("");
            const base64 = btoa(binary);

            channel.send(
                JSON.stringify({
                    type: "file",
                    filename: file.name,
                    bytes: base64,
                })
            );

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
            <div className="rt-share-layout">
                <div className="user-list">
                    <h2>
                        {!isOnline
                            ? "Waiting for Connection"
                            : users.filter(user => user.id !== sessionId).length === 0
                                ? "No Users"
                                : "Users (You are " + sessionId + ")"}
                    </h2>
                    <ul>
                        {users
                            .filter(user => user.id !== sessionId)
                            .map(user => (
                                <li
                                    key={user.id}
                                    className={`${selectedUser === user.id ? "selected" : ""} ${!user.isOnline ? "offline" : ""}`}
                                    onClick={() => selectUser(user.id)}
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
                                    messages={messages[selectedUser] || []}
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
