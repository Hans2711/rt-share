import { useEffect, useState, useRef } from "react";
import type { User, Message } from "./types";
import { Chat } from "./chat";
import { UserList } from "./UserList";
import { generateSessionId } from "./helpers";

import "./styles.css";

type PeerStatus = "connected" | "connecting" | "reconnecting" | "disconnected";

export function RtShare() {
    const [sessionId, setSessionId] = useState("");
    const wsRef = useRef<WebSocket | null>(null);
    const peerConns = useRef<Record<string, RTCPeerConnection>>({});
    const dataChannels = useRef<Record<string, RTCDataChannel>>({});

    const [users, setUsers] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const selectedUserRef = useRef<string | null>(null);
    const [messages, setMessages] = useState<Record<string, Message[]>>({});
    const [isOnline, setIsOnline] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState("");
    const [sendProgress, setSendProgress] = useState<number | null>(null);
    const [receiveProgress, setReceiveProgress] = useState<number | null>(null);
    const [sendFileInfo, setSendFileInfo] = useState<{ name: string; size: number } | null>(null);
    const [receiveFileInfo, setReceiveFileInfo] = useState<{ name: string; size: number } | null>(null);

    const [peerStatuses, setPeerStatuses] = useState<Record<string, PeerStatus>>({});

    const allowedRecipients = useRef<Record<string, boolean>>({});
    const allowedSenders = useRef<Record<string, boolean>>({});
    const pendingFiles = useRef<Record<string, File | null>>({});

    const updatePeerStatus = (id: string, status: PeerStatus) => {
        setPeerStatuses(prev => ({ ...prev, [id]: status }));
    };

    useEffect(() => {
        selectedUserRef.current = selectedUser;
    }, [selectedUser]);

    // 16 KiB payloads balance throughput and memory
    const CHUNK_SIZE = 16 * 1024;

    // ────────────────────────────────────────────────────────────────────────────
    //  Incoming-file bookkeeping
    // ────────────────────────────────────────────────────────────────────────────
    const incomingFiles = useRef<Record<
        string,
        {
            [filename: string]: {
                size: number;
                received: number;
                chunks: ArrayBuffer[];
            };
        }
    >>({});

    const cleanupPeerConnections = () => {
        Object.values(dataChannels.current).forEach(ch => {
            try { ch.close(); } catch { /* ignore */ }
        });
        Object.values(peerConns.current).forEach(pc => {
            try { pc.close(); } catch { /* ignore */ }
        });
        peerConns.current = {};
        dataChannels.current = {};
        setPeerStatuses({});
    };

    const selectUser = (uid: string) => {
        setSelectedUser(uid);
        updatePeerStatus(uid, "connecting");
        // Determine the initiator deterministically to avoid offer glare
        const shouldInitiate = sessionId > uid;
        createPeerConnection(uid, shouldInitiate);
    };

    useEffect(() => {
        // Initialise session ID
        let storedSessionId = localStorage.getItem("sessionId");
        if (!storedSessionId) {
            storedSessionId = generateSessionId();
            localStorage.setItem("sessionId", storedSessionId);
        }
        setSessionId(storedSessionId);

        // Initialise WebSocket
        if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
            //const socket = new WebSocket("ws://localhost:3000/");
            const socket = new WebSocket("wss://rt-share.diesing.pro:3000/");
            wsRef.current = socket;

            setIsConnecting(true);

            const connectionTimeout = setTimeout(() => {
                if (socket.readyState !== WebSocket.OPEN) {
                    setError("Connection timed out.");
                    setIsConnecting(false);
                    setTimeout(() => window.location.reload(), 3000);
                }
            }, 8000);

            socket.onopen = () => {
                console.log("WebSocket connection established");
                setIsConnecting(false);
                setIsOnline(true);
                socket.send(JSON.stringify({ type: "join", payload: storedSessionId }) + "\n");
            };

            socket.addEventListener("error", (event) => {
                setError("WebSocket connection error " + event);
                setIsOnline(false);
                setTimeout(() => window.location.reload(), 3000);
            });

            socket.onmessage = (event) => {
                const jEvent = JSON.parse(event.data);
                console.log("Received event:", jEvent);

                if (jEvent.type === "join" && jEvent.status === "ok") {
                    const userList: string[] = JSON.parse(jEvent.data);
                    setUsers(userList.map(id => ({ id, isOnline: true })));
                } else if (jEvent.type === "join" && jEvent.status === "userJoin") {
                    const userID = jEvent.data;
                    setUsers(prev =>
                        prev.some(u => u.id === userID)
                            ? prev.map(u => u.id === userID ? { ...u, isOnline: true } : u)
                            : [...prev, { id: userID, isOnline: true }]
                    );
                } else if (jEvent.type === "leave" && jEvent.status === "userLeft") {
                    const userID = jEvent.data;
                    setUsers(prev => prev.map(u => u.id === userID ? { ...u, isOnline: false } : u));
                } else if (jEvent.type === "offer" && jEvent.status === "forward") {
                    handleOffer(jEvent.sender, jEvent.data);
                } else if (jEvent.type === "answer" && jEvent.status === "forward") {
                    handleAnswer(jEvent.sender, jEvent.data);
                } else if (jEvent.type === "candidate" && jEvent.status === "forward") {
                    handleCandidate(jEvent.sender, jEvent.data);
                }
            };

            return () => {
                cleanupPeerConnections();
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: "leave", payload: storedSessionId }) + "\n");
                    wsRef.current.close();
                }
                wsRef.current = null;
            };
        }
    }, []);

    const setupDataChannel = (userId: string, channel: RTCDataChannel) => {
        channel.binaryType = "arraybuffer";
        dataChannels.current[userId] = channel;

        channel.onopen = () => updatePeerStatus(userId, "connected");
        channel.onclose = () => updatePeerStatus(userId, "reconnecting");

        channel.onmessage = (e) => {
            if (selectedUserRef.current !== userId) {
                setSelectedUser(userId);
            }
            // ─────────── TEXT FRAME ───────────
            if (typeof e.data === "string") {
                let msg: any;
                try { msg = JSON.parse(e.data); } catch { return; }

                if (msg.type === "text") {
                    const newMessage: Message = {
                        id: Date.now().toString(),
                        text: msg.text,
                        sender: userId,
                        timestamp: new Date(),
                    };
                    setMessages(prev => ({
                        ...prev,
                        [userId]: [...(prev[userId] || []), newMessage],
                    }));
                } else if (msg.type === "file-offer") {
                    if (allowedSenders.current[userId]) {
                        channel.send(JSON.stringify({ type: "file-accept" }));
                    } else {
                        const ok = window.confirm(`Accept '${msg.filename}' (${msg.size} B) from ${userId}?`);
                        if (ok) {
                            allowedSenders.current[userId] = true;
                            channel.send(JSON.stringify({ type: "file-accept" }));
                        } else {
                            channel.send(JSON.stringify({ type: "file-deny" }));
                            return;
                        }
                    }
                } else if (msg.type === "file-meta") {
                    incomingFiles.current[userId] ??= {};
                    incomingFiles.current[userId][msg.filename] = {
                        size: msg.size,
                        received: 0,
                        chunks: [],
                    };
                    setReceiveFileInfo({ name: msg.filename, size: msg.size });
                    setReceiveProgress(0);
                } else if (msg.type === "file-accept") {
                    allowedRecipients.current[userId] = true;
                    const pending = pendingFiles.current[userId];
                    if (pending) {
                        pendingFiles.current[userId] = null;
                        sendFileNow(userId, pending);
                    }
                } else if (msg.type === "file-deny") {
                    pendingFiles.current[userId] = null;
                    alert(`${userId} rejected the file transfer.`);
                } else if (msg.type === "file-end") {
                    const entry = incomingFiles.current[userId]?.[msg.filename];
                    if (!entry) return;

                    const blob = new Blob(entry.chunks);
                    const url = URL.createObjectURL(blob);
                    const a = Object.assign(document.createElement("a"), {
                        href: url,
                        download: msg.filename,
                        style: "display:none",
                    });
                    document.body.appendChild(a).click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);

                    const newMessage: Message = {
                        id: Date.now().toString(),
                        text: "",
                        sender: userId,
                        timestamp: new Date(),
                        isFile: true,
                        filename: msg.filename,
                    };
                    setMessages(prev => ({
                        ...prev,
                        [userId]: [...(prev[userId] || []), newMessage],
                    }));

                    delete incomingFiles.current[userId][msg.filename];
                    setReceiveProgress(null);
                    setReceiveFileInfo(null);
                }
                return;
            }

            // ─────────── BINARY FRAME ───────────
            if (e.data instanceof ArrayBuffer || e.data instanceof Blob) {
                const arrayBufPromise = e.data instanceof Blob ? e.data.arrayBuffer() : Promise.resolve(e.data);
                arrayBufPromise.then(ab => {
                    const files = incomingFiles.current[userId];
                    const current = files && Object.values(files)[0];
                    if (!current) return;
                    current.chunks.push(ab);
                    current.received += ab.byteLength;
                    setReceiveProgress(Math.floor((current.received / current.size) * 100));
                });
                return;
            }

            console.warn("Unrecognised datachannel frame:", e.data);
        };
    };

    const createPeerConnection = (userId: string, initiator: boolean = sessionId > userId) => {
        if (peerConns.current[userId]) return;
        setPeerStatuses(prev => ({
            ...prev,
            [userId]: prev[userId] === "reconnecting" ? "reconnecting" : "connecting",
        }));
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        peerConns.current[userId] = pc;

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === "connected") {
                updatePeerStatus(userId, "connected");
            } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
                console.warn("Peer connection dropped", userId);
                try { pc.close(); } catch {}
                delete peerConns.current[userId];
                delete dataChannels.current[userId];
                updatePeerStatus(userId, "reconnecting");
                // Add jitter so both peers don't reconnect simultaneously
                const delay = 1000 + Math.floor(Math.random() * 1000);
                setTimeout(() => {
                    if (!peerConns.current[userId]) {
                        createPeerConnection(userId, initiator);
                    }
                }, delay);
            }
        };

        pc.onicecandidate = (e) => {
            if (e.candidate && wsRef.current) {
                wsRef.current.send(JSON.stringify({
                    type: "candidate",
                    payload: userId,
                    text: JSON.stringify(e.candidate),
                }) + "\n");
            }
        };

        pc.ondatachannel = e => setupDataChannel(userId, e.channel);

        if (initiator) {
            const channel = pc.createDataChannel("chat");
            setupDataChannel(userId, channel);
            pc.createOffer()
                .then(o => pc.setLocalDescription(o))
                .then(() => {
                    if (wsRef.current && pc.localDescription) {
                        wsRef.current.send(JSON.stringify({
                            type: "offer",
                            payload: userId,
                            text: JSON.stringify(pc.localDescription),
                        }) + "\n");
                    }
                });
        }
    };

    const handleOffer = (userId: string, data: string) => {
        createPeerConnection(userId, false);
        const pc = peerConns.current[userId];
        pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(data)))
          .then(() => pc.createAnswer())
          .then(a => pc.setLocalDescription(a))
          .then(() => {
              if (wsRef.current && pc.localDescription) {
                  wsRef.current.send(JSON.stringify({
                      type: "answer",
                      payload: userId,
                      text: JSON.stringify(pc.localDescription),
                  }) + "\n");
              }
          });
    };

    const handleAnswer = (userId: string, data: string) => {
        const pc = peerConns.current[userId];
        if (pc) pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(data)));
    };

    const handleCandidate = (userId: string, data: string) => {
        const pc = peerConns.current[userId];
        if (pc) pc.addIceCandidate(new RTCIceCandidate(JSON.parse(data)));
    };

    const handleSendMessage = (targetUser: string, text: string) => {
        const channel = dataChannels.current[targetUser];
        if (!channel || channel.readyState !== "open") {
            alert("Peer connection not established yet.");
            return;
        }
        channel.send(JSON.stringify({ type: "text", text }));

        const newMessage: Message = {
            id: Date.now().toString(),
            text,
            sender: sessionId,
            timestamp: new Date(),
        };
        setMessages(prev => ({
            ...prev,
            [targetUser]: [...(prev[targetUser] || []), newMessage],
        }));
    };

    // ────────────────────────────────────────────────────────────────────────────
    //  📤  FILE TRANSFER WITH STREAMING + ROBUST BACK-PRESSURE
    // ────────────────────────────────────────────────────────────────────────────
    const sendFileNow = async (targetUser: string, file: File) => {
        const channel = dataChannels.current[targetUser];
        if (!channel || channel.readyState !== "open") {
            alert("Peer connection not established yet.");
            return;
        }

        console.debug(`Preparing to send '${file.name}' (${file.size} B)`);

        const MAX_BUFFERED = 16 * 1024 * 1024; // 16 MiB
        channel.bufferedAmountLowThreshold = 4 * 1024 * 1024; // 4 MiB

        const waitForDrain = () =>
            new Promise<void>(resolve => {
                if (channel.bufferedAmount <= channel.bufferedAmountLowThreshold) {
                    resolve();
                    return;
                }
                const handler = () => {
                    channel.removeEventListener("bufferedamountlow", handler);
                    resolve();
                };
                channel.addEventListener("bufferedamountlow", handler);
            });

        // 1 — announce the file
        channel.send(JSON.stringify({ type: "file-meta", filename: file.name, size: file.size }));
        setSendFileInfo({ name: file.name, size: file.size });

        // 2 — stream and throttle
        let sent = 0;
        setSendProgress(0);

        const reader = file.stream().getReader();
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            let offset = 0;
            while (offset < value.length) {
                const end = Math.min(offset + CHUNK_SIZE, value.length);
                const chunk = value.subarray(offset, end); // Uint8Array view

                while (channel.bufferedAmount + chunk.byteLength > MAX_BUFFERED) {
                    await waitForDrain();
                }

                try {
                    channel.send(chunk);
                } catch (err) {
                    console.error("Failed to send chunk:", err);
                    alert("File transfer aborted.");
                    setSendProgress(null);
                    return;
                }

                offset = end;
                sent += chunk.byteLength;
                setSendProgress(Math.floor((sent / file.size) * 100));
            }
        }

        // 3 — finish
        channel.send(JSON.stringify({ type: "file-end", filename: file.name }));
        setSendProgress(null);
        setSendFileInfo(null);

        // 4 — optimistic chat entry
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

    const handleSendFile = (targetUser: string, file: File) => {
        if (allowedRecipients.current[targetUser]) {
            sendFileNow(targetUser, file);
            return;
        }
        const channel = dataChannels.current[targetUser];
        if (!channel || channel.readyState !== "open") {
            alert("Peer connection not established yet.");
            return;
        }
        pendingFiles.current[targetUser] = file;
        channel.send(JSON.stringify({ type: "file-offer", filename: file.name, size: file.size }));
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
                        <div className="error no-chat-selected"><p>Error: {error}</p></div>
                    ) : selectedUser ? (
                        <Chat
                            currentUser={sessionId}
                            targetUser={selectedUser}
                            messages={messages[selectedUser] || []}
                            sendInfo={{ progress: sendProgress, filename: sendFileInfo?.name, size: sendFileInfo?.size }}
                            receiveInfo={{ progress: receiveProgress, filename: receiveFileInfo?.name, size: receiveFileInfo?.size }}
                            connectionStatus={peerStatuses[selectedUser] || "disconnected"}
                            onSendMessage={text => handleSendMessage(selectedUser, text)}
                            onSendFile={file => handleSendFile(selectedUser, file)}
                        />
                    ) : (
                        <div className="no-chat-selected"><p>Select a user to start chatting</p></div>
                    )}
                </div>
            </div>
        </div>
    );
}
