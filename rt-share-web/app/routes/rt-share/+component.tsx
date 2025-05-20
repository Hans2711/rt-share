// src/routes/rt-share/+component.tsx
import { useEffect, useState, useRef } from "react";
import type { User, Message } from "./types";
import { Chat } from "./chat";
import { UserList } from "./UserList";
import { generateSessionId } from "./helpers";

import './styles.css';

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
    const [sendProgress, setSendProgress] = useState<number | null>(null);
    const [receiveProgress, setReceiveProgress] = useState<number | null>(null);

    const CHUNK_SIZE = 16 * 1024;

    const incomingFiles = useRef<Record<
    string,                              // sender-ID
    {
        [filename: string]: {            // one queue per file
            size: number;
            received: number;
            chunks: ArrayBuffer[];
        };
    }
>>({});

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
            //const socket = new WebSocket("ws://localhost:3000/");
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
                else if (jEvent.type === "offer" && jEvent.status === "forward") {
                    handleOffer(jEvent.sender, jEvent.data);
                }
                else if (jEvent.type === "answer" && jEvent.status === "forward") {
                    handleAnswer(jEvent.sender, jEvent.data);
                }
                else if (jEvent.type === "candidate" && jEvent.status === "forward") {
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
        channel.binaryType = "arraybuffer";          // important!
        dataChannels.current[userId] = channel;


        channel.onmessage = (e) => {
            // ───────────────────────────────────────────────────────────
            // 1.  TEXT MESSAGE?  (string)
            // ───────────────────────────────────────────────────────────
            if (typeof e.data === "string") {
                let msg: any;
                try {
                    msg = JSON.parse(e.data);
                } catch (err) {
                    console.warn("Discarding non-JSON text frame:", e.data);
                    return;
                }

                if (msg.type === "text") {
                    const newMessage: Message = {
                        id: Date.now().toString(),
                        text: msg.text,
                        sender: userId,
                        timestamp: new Date(),
                    };
                    setMessages((prev) => ({
                        ...prev,
                        [userId]: [...(prev[userId] || []), newMessage],
                    }));
                } else if (msg.type === "file-meta") {
                    incomingFiles.current[userId] ??= {};
                    incomingFiles.current[userId][msg.filename] = {
                        size: msg.size,
                        received: 0,
                        chunks: [],
                    };
                    setReceiveProgress(0);
                    console.debug(
                        `Started receiving '${msg.filename}' (${msg.size} B) from ${userId}`
                    );
                } else if (msg.type === "file-end") {
                    const fileEntry =
                        incomingFiles.current[userId]?.[msg.filename];
                    if (!fileEntry) return;

                    const blob = new Blob(fileEntry.chunks);
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = msg.filename;
                    a.style.display = "none";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);

                    console.debug(
                        `Finished receiving '${msg.filename}' from ${userId}`
                    );

                    const newMessage: Message = {
                        id: Date.now().toString(),
                        text: "",
                        sender: userId,
                        timestamp: new Date(),
                        isFile: true,
                        filename: msg.filename,
                    };
                    setMessages((prev) => ({
                        ...prev,
                        [userId]: [...(prev[userId] || []), newMessage],
                    }));

                    delete incomingFiles.current[userId][msg.filename];
                    setReceiveProgress(null);
                }
                return; // handled text frame
            }

            // ───────────────────────────────────────────────────────────
            // 2.  BINARY MESSAGE?  (ArrayBuffer or Blob)
            // ───────────────────────────────────────────────────────────
            if (e.data instanceof ArrayBuffer || e.data instanceof Blob) {
                const arrayBuf =
                    e.data instanceof Blob ? e.data.arrayBuffer() : e.data;

                const userFiles = incomingFiles.current[userId];
                if (!userFiles) {
                    console.warn("Binary chunk with no active file transfer");
                    return;
                }
                const current = Object.values(userFiles)[0];
                if (!current) return;

                current.chunks.push(arrayBuf);
                current.received += arrayBuf.byteLength;
                setReceiveProgress(Math.floor((current.received / current.size) * 100));
                return;
            }

            // ───────────────────────────────────────────────────────────
            // 3.  UNKNOWN TYPE  – just log it
            // ───────────────────────────────────────────────────────────
            console.warn("Unrecognised datachannel frame:", e.data);
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

        console.debug(`Preparing to send file '${file.name}' (${file.size} bytes)`);

        const reader = new FileReader();
        reader.onerror = err => {
            console.error("FileReader error:", err);
            alert("Failed to read file.");
        };

        reader.onload = () => {
            const buffer = reader.result as ArrayBuffer;
            // 1 — announce the file
            channel.send(JSON.stringify({
                type: "file-meta",
                filename: file.name,
                size: buffer.byteLength
            }));

            // 2 — stream the chunks
            let offset = 0;
            setSendProgress(0);
            while (offset < buffer.byteLength) {
                const slice = buffer.slice(offset, offset + CHUNK_SIZE);
                channel.send(slice);          // send raw binary
                offset += CHUNK_SIZE;
                setSendProgress(Math.floor((offset / buffer.byteLength) * 100));
            }

            // 3 — tell the receiver we’re done
            channel.send(JSON.stringify({
                type: "file-end",
                filename: file.name
            }));
            setSendProgress(null);

            // 4 — optimistically add a “sent” entry to the chat UI
            const newMessage: Message = {
                id: Date.now().toString(),
                text: "",
                sender: sessionId,
                timestamp: new Date(),
                isFile: true,
                filename: file.name,
            };
            setMessages(prev => ({
                ...prev,
                [targetUser]: [...(prev[targetUser] || []), newMessage],
            }));
        };

        reader.readAsArrayBuffer(file);
    };

    return (
        <div className="rt-share-container">
            <div className="rt-share-layout">
                <UserList
                    users={users}
                    currentUser={sessionId}
                    selectedUser={selectedUser}
                    isOnline={isOnline}
                    onSelect={selectUser}
                />
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
                                    sendProgress={sendProgress}
                                    receiveProgress={receiveProgress}
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
