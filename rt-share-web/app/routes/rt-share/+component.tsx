import { useEffect, useState, useRef } from "react";
import type { User, Message } from "./types";
import { Chat } from "./chat";
import { UserList } from "./UserList";
import { FileHistoryModal } from "./FileHistoryModal";
import { generateSessionId, blobToBase64, base64ToBlob, base64SizeInBytes, sanitizeText } from "./helpers";


type PeerStatus = "connected" | "connecting" | "reconnecting" | "disconnected";

export function RtShare() {
    const [sessionId, setSessionId] = useState("");
    const wsRef = useRef<WebSocket | null>(null);
    const peerConns = useRef<Record<string, RTCPeerConnection>>({});
    const dataChannels = useRef<Record<string, RTCDataChannel>>({});
    const p2pFailCount = useRef<Record<string, number>>({}); // Per-peer fail count instead of global
    const reconnectAttempts = useRef<number>(0);
    const reconnectTimer = useRef<number | null>(null);
    const pendingIceCandidates = useRef<Record<string, RTCIceCandidateInit[]>>({}); // Queue candidates
    const connectionTimeouts = useRef<Record<string, number>>({}); // Track connection timeouts
    const fileReceiveTimeouts = useRef<Record<string, number>>({}); // Track file receive timeouts (2 min)
    const fileSendTimeouts = useRef<Record<string, number>>({}); // Track file send timeouts (2 min)

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

    const [receivedFiles, setReceivedFiles] = useState<Record<string, { filename: string; blob: Blob }[]>>({});
    // Track intentional shutdowns to prevent auto-reconnect during unload/freeze
    const isShuttingDownRef = useRef(false);
    useEffect(() => {
        try {
            const raw = localStorage.getItem("receivedFileHistory");
            if (raw) {
                const arr: Array<{ sender: string; filename: string; data: string }> = JSON.parse(raw);
                const map: Record<string, { filename: string; blob: Blob }[]> = {};
                arr.forEach(e => {
                    map[e.sender] ??= [];
                    map[e.sender].push({ filename: e.filename, blob: base64ToBlob(e.data) });
                });
                setReceivedFiles(map);
            }
        } catch (err) {
            console.error("Failed to load file history", err);
        }
    }, []);
    const [showHistory, setShowHistory] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Auto-open sidebar on mobile on initial load
    useEffect(() => {
        const isMobile = window.innerWidth < 768; // md breakpoint
        if (isMobile && !selectedUser) {
            setSidebarOpen(true);
        }
    }, [selectedUser]);

    const [peerStatuses, setPeerStatuses] = useState<Record<string, PeerStatus>>({});

    const allowedRecipients = useRef<Record<string, boolean>>({});
    const allowedSenders = useRef<Record<string, boolean>>({});
    const pendingFiles = useRef<Record<string, File | null>>({});

    const usersRef = useRef<User[]>([]);
    const isOnlineRef = useRef(false);

    const saveFileEntry = async (sender: string, filename: string, blob: Blob) => {
        const base64 = await blobToBase64(blob);
        let entries: Array<{ sender: string; filename: string; data: string }> = [];
        try {
            entries = JSON.parse(localStorage.getItem("receivedFileHistory") || "[]");
        } catch {}
        entries.push({ sender, filename, data: base64 });
        let total = entries.reduce((s, e) => s + base64SizeInBytes(e.data), 0);
        const LIMIT = 1.5 * 1024 * 1024 * 1024; // 1.5 GB
        while (total > LIMIT && entries.length > 0) {
            const removed = entries.shift();
            total = entries.reduce((s, e) => s + base64SizeInBytes(e.data), 0);
        }
        localStorage.setItem("receivedFileHistory", JSON.stringify(entries));
    };

    const updatePeerStatus = (id: string, status: PeerStatus) => {
        setPeerStatuses(prev => ({ ...prev, [id]: status }));
    };

    useEffect(() => {
        selectedUserRef.current = selectedUser;
    }, [selectedUser]);

    useEffect(() => {
        usersRef.current = users;
    }, [users]);

    useEffect(() => {
        isOnlineRef.current = isOnline;
    }, [isOnline]);

    // 16 KiB payloads balance throughput and memory
    const CHUNK_SIZE = 16 * 1024;

    // Periodically check each peer connection's state
    useEffect(() => {
        const interval = setInterval(() => {
            Object.entries(peerConns.current).forEach(([uid, pc]) => {
                let status: PeerStatus = "connecting";
                switch (pc.connectionState) {
                    case "connected":
                        status = "connected";
                        break;
                    case "disconnected":
                    case "failed":
                        status = "reconnecting";
                        break;
                    case "new":
                    case "connecting":
                        status = "connecting";
                        break;
                    case "closed":
                        status = "disconnected";
                        break;
                }
                updatePeerStatus(uid, status);
            });
        }, 500);
        return () => clearInterval(interval);
    }, []);

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
        Object.values(connectionTimeouts.current).forEach(timeoutId => {
            clearTimeout(timeoutId);
        });
        Object.values(fileReceiveTimeouts.current).forEach(timeoutId => {
            clearTimeout(timeoutId);
        });
        Object.values(fileSendTimeouts.current).forEach(timeoutId => {
            clearTimeout(timeoutId);
        });
        peerConns.current = {};
        dataChannels.current = {};
        pendingIceCandidates.current = {};
        connectionTimeouts.current = {};
        fileReceiveTimeouts.current = {};
        fileSendTimeouts.current = {};
        setPeerStatuses({});
    };

    const selectUser = (uid: string) => {
        setSelectedUser(uid);
        const userOnline = usersRef.current.some(u => u.id === uid && u.isOnline);
        if (!isOnlineRef.current || !userOnline) {
            updatePeerStatus(uid, "disconnected");
            return;
        }
        
        // Only create a new connection if one doesn't already exist
        if (!peerConns.current[uid]) {
            updatePeerStatus(uid, "connecting");
            // Determine the initiator deterministically to avoid offer glare
            const shouldInitiate = sessionId > uid;
            createPeerConnection(uid, shouldInitiate);
        }
    };

    useEffect(() => {
        // Initialise session ID
        let storedSessionId = localStorage.getItem("sessionId");
        const isOldNumeric = !!storedSessionId && /^[0-9]{5}$/.test(storedSessionId);
        if (!storedSessionId || isOldNumeric) {
            storedSessionId = generateSessionId();
            localStorage.setItem("sessionId", storedSessionId);
        }
        setSessionId(storedSessionId);

        // Derive WS URL from current location; server handles upgrades at /ws
        const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
        const wsUrl = `${wsProtocol}://${window.location.host}/ws`;

        const clearReconnectTimer = () => {
            if (reconnectTimer.current !== null) {
                clearTimeout(reconnectTimer.current);
                reconnectTimer.current = null;
            }
        };

        const scheduleReconnect = () => {
            // Exponential backoff with jitter, capped at 15s
            const attempt = reconnectAttempts.current;
            const base = 500; // ms
            const delay = Math.min(15000, base * Math.pow(2, attempt)) + Math.floor(Math.random() * 400);
            reconnectAttempts.current = Math.min(attempt + 1, 10);
            clearReconnectTimer();
            reconnectTimer.current = window.setTimeout(connect, delay);
        };

        // One-shot guard to avoid sending multiple leave messages
        const didNotifyLeave = { value: false };

        const connect = () => {
            if (wsRef.current &&
                (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
                return;
            }
            const socket = new WebSocket(wsUrl);
            wsRef.current = socket;
            setIsConnecting(true);

            socket.onopen = () => {
                console.log("WebSocket connection established");
                clearReconnectTimer();
                reconnectAttempts.current = 0;
                setError("");
                setIsConnecting(false);
                setIsOnline(true);
                // Reset shutdown + allow subsequent leave notifications
                isShuttingDownRef.current = false;
                didNotifyLeave.value = false;
                socket.send(JSON.stringify({ type: "join", payload: storedSessionId }) + "\n");
            };

            socket.addEventListener("error", (event) => {
                setError("WebSocket connection error " + event);
                setIsOnline(false);
            });

            socket.onclose = () => {
                setIsOnline(false);
                cleanupPeerConnections();
                if (!isShuttingDownRef.current) {
                    scheduleReconnect();
                }
            };

            socket.onmessage = (event) => {
                const jEvent = JSON.parse(event.data);
                if (jEvent.type === "heartbeat") {
                    // no-op: server liveness ping
                    return;
                }
                console.log("Received event:", jEvent);

                if (jEvent.type === "join" && jEvent.status === "ok") {
                    const userList: Array<{ id: string; ip: string }> = JSON.parse(jEvent.data);
                    setUsers(userList.map(u => ({ ...u, isOnline: true })));
                    userList.forEach(u => {
                        if (u.id !== storedSessionId) {
                            const shouldInitiate = storedSessionId > u.id;
                            createPeerConnection(u.id, shouldInitiate);
                        }
                    });
                } else if (jEvent.type === "join" && jEvent.status === "userJoin") {
                    const userID = jEvent.data;
                    const ip = jEvent.ip;
                    setUsers(prev =>
                        prev.some(u => u.id === userID)
                            ? prev.map(u => u.id === userID ? { ...u, isOnline: true, ip } : u)
                            : [...prev, { id: userID, ip, isOnline: true }]
                    );
                    if (userID !== storedSessionId) {
                        const shouldInitiate = storedSessionId > userID;
                        createPeerConnection(userID, shouldInitiate);
                    }
                } else if (jEvent.type === "leave" && jEvent.status === "userLeft") {
                    const userID = jEvent.data;
                    setUsers(prev => prev.map(u => u.id === userID ? { ...u, isOnline: false } : u));
                    updatePeerStatus(userID, "disconnected");
                    try { dataChannels.current[userID]?.close(); } catch {}
                    try { peerConns.current[userID]?.close(); } catch {}
                    delete dataChannels.current[userID];
                    delete peerConns.current[userID];
                    delete pendingIceCandidates.current[userID];
                    delete p2pFailCount.current[userID];
                    if (connectionTimeouts.current[userID]) {
                        clearTimeout(connectionTimeouts.current[userID]);
                        delete connectionTimeouts.current[userID];
                    }
                    if (fileReceiveTimeouts.current[userID]) {
                        clearTimeout(fileReceiveTimeouts.current[userID]);
                        delete fileReceiveTimeouts.current[userID];
                    }
                    if (fileSendTimeouts.current[userID]) {
                        clearTimeout(fileSendTimeouts.current[userID]);
                        delete fileSendTimeouts.current[userID];
                    }
                } else if (jEvent.type === "offer" && jEvent.status === "forward") {
                    handleOffer(jEvent.sender, jEvent.data);
                } else if (jEvent.type === "answer" && jEvent.status === "forward") {
                    handleAnswer(jEvent.sender, jEvent.data);
                } else if (jEvent.type === "candidate" && jEvent.status === "forward") {
                    handleCandidate(jEvent.sender, jEvent.data);
                }
            };
        };

        connect();

        // Proactively announce leave on tab close/freeze/unload
        const notifyLeave = () => {
            if (didNotifyLeave.value) return;
            didNotifyLeave.value = true;
            isShuttingDownRef.current = true;
            // Ensure any pending reconnect is cancelled
            try { clearReconnectTimer(); } catch {}
            try {
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    try { wsRef.current.send(JSON.stringify({ type: "leave", payload: storedSessionId }) + "\n"); } catch {}
                    try { wsRef.current.close(); } catch {}
                } else if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING)) {
                    // If still connecting, just close to ensure server-side cleanup
                    try { wsRef.current.close(); } catch {}
                }
            } catch {}
            // Also ensure local peer connections are torn down
            try { cleanupPeerConnections(); } catch {}
        };

        // Use pagehide for navigation/unload and BFCache cases, plus beforeunload as a fallback.
        const onPageHide = () => notifyLeave();
        const onBeforeUnload = () => notifyLeave();
        // Page Lifecycle freeze event where supported
        const onFreeze = () => notifyLeave();

        window.addEventListener("pagehide", onPageHide);
        window.addEventListener("beforeunload", onBeforeUnload);
        // `freeze` is not universally supported but harmless if no-op
        document.addEventListener("freeze", onFreeze as any);
        // Rejoin after BFCache restore or when page is shown again
        const onPageShow = () => {
            // Allow rejoin after intentional leave
            isShuttingDownRef.current = false;
            if (!wsRef.current || (wsRef.current.readyState !== WebSocket.OPEN && wsRef.current.readyState !== WebSocket.CONNECTING)) {
                connect();
            }
        };
        window.addEventListener("pageshow", onPageShow);

        // Rejoin when tab becomes visible again (covers freeze → resume in many browsers)
        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                isShuttingDownRef.current = false;
                if (!wsRef.current || (wsRef.current.readyState !== WebSocket.OPEN && wsRef.current.readyState !== WebSocket.CONNECTING)) {
                    connect();
                }
            }
        };
        document.addEventListener("visibilitychange", onVisibilityChange);

        // Cleanup on unmount
        return () => {
            try {
                window.removeEventListener("pagehide", onPageHide);
                window.removeEventListener("beforeunload", onBeforeUnload);
                document.removeEventListener("freeze", onFreeze as any);
                window.removeEventListener("pageshow", onPageShow);
                document.removeEventListener("visibilitychange", onVisibilityChange);
            } catch {}
            clearReconnectTimer();
            // Mark shutdown to avoid spurious reconnect on unmount
            isShuttingDownRef.current = true;
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                try {
                    wsRef.current.send(JSON.stringify({ type: "leave", payload: storedSessionId }) + "\n");
                } catch {}
                wsRef.current.close();
            }
            wsRef.current = null;
            cleanupPeerConnections();
        };
    }, []);

    const setupDataChannel = (userId: string, channel: RTCDataChannel) => {
        channel.binaryType = "arraybuffer";
        dataChannels.current[userId] = channel;

        channel.onopen = () => updatePeerStatus(userId, "connected");
        channel.onclose = () => {
            delete dataChannels.current[userId];
            try {
                const pc = peerConns.current[userId];
                if (pc) pc.close();
            } catch {}
            delete peerConns.current[userId];
            delete pendingIceCandidates.current[userId];
            if (connectionTimeouts.current[userId]) {
                clearTimeout(connectionTimeouts.current[userId]);
                delete connectionTimeouts.current[userId];
            }
            const userOnline = usersRef.current.some(u => u.id === userId && u.isOnline);
            if (isOnlineRef.current && userOnline) {
                updatePeerStatus(userId, "reconnecting");
                const delay = 500 + Math.floor(Math.random() * 500);
                setTimeout(() => {
                    if (!peerConns.current[userId]) {
                        createPeerConnection(userId);
                    }
                }, delay);
            } else {
                updatePeerStatus(userId, "disconnected");
            }
        };

        channel.onmessage = (e) => {
            if (selectedUserRef.current !== userId) {
                setSelectedUser(userId);
            }
            // ─────────── TEXT FRAME ───────────
            if (typeof e.data === "string") {
                let msg: any;
                try { msg = JSON.parse(e.data); } catch { return; }

                if (msg.type === "text") {
                    const sanitized = sanitizeText(msg.text);
                    const newMessage: Message = {
                        id: Date.now().toString(),
                        text: sanitized,
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
                    
                    // Start 2-minute timeout for file receive
                    if (fileReceiveTimeouts.current[userId]) {
                        clearTimeout(fileReceiveTimeouts.current[userId]);
                    }
                    fileReceiveTimeouts.current[userId] = window.setTimeout(() => {
                        console.error(`File receive timeout for ${userId} - no chunks received in 2 minutes`);
                        // Clean up the stalled transfer
                        delete incomingFiles.current[userId]?.[msg.filename];
                        setReceiveProgress(null);
                        setReceiveFileInfo(null);
                        delete fileReceiveTimeouts.current[userId];
                        alert(`File transfer from ${userId} failed: Connection timeout (no data received for 2 minutes)`);
                    }, 120000); // 2 minutes = 120000ms
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

                    // Clear the receive timeout since transfer completed
                    if (fileReceiveTimeouts.current[userId]) {
                        clearTimeout(fileReceiveTimeouts.current[userId]);
                        delete fileReceiveTimeouts.current[userId];
                    }

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

                    setReceivedFiles(prev => ({
                        ...prev,
                        [userId]: [...(prev[userId] || []), { filename: msg.filename, blob }],
                    }));
                    saveFileEntry(userId, msg.filename, blob);

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
                    
                    // Reset the 2-minute timeout since we received a chunk
                    if (fileReceiveTimeouts.current[userId]) {
                        clearTimeout(fileReceiveTimeouts.current[userId]);
                        const filename = Object.keys(files)[0];
                        fileReceiveTimeouts.current[userId] = window.setTimeout(() => {
                            console.error(`File receive timeout for ${userId} - no chunks received in 2 minutes`);
                            delete incomingFiles.current[userId]?.[filename];
                            setReceiveProgress(null);
                            setReceiveFileInfo(null);
                            delete fileReceiveTimeouts.current[userId];
                            alert(`File transfer from ${userId} failed: Connection timeout (no data received for 2 minutes)`);
                        }, 120000); // 2 minutes
                    }
                });
                return;
            }

            console.warn("Unrecognised datachannel frame:", e.data);
        };
    };

    const createPeerConnection = (userId: string, initiate: boolean = sessionId > userId) => {
        if (peerConns.current[userId]) return;
        if (!isOnlineRef.current || !usersRef.current.some(u => u.id === userId && u.isOnline)) {
            updatePeerStatus(userId, "disconnected");
            return;
        }
        setPeerStatuses(prev => ({
            ...prev,
            [userId]: prev[userId] === "reconnecting" ? "reconnecting" : "connecting",
        }));
        const pc = new RTCPeerConnection({
            iceServers: [
                // Public STUN servers for NAT traversal
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" },
                { urls: "stun:stun2.l.google.com:19302" },
                // Free public TURN servers for restrictive NATs/firewalls
                // These allow relay connections when direct P2P fails
                { 
                    urls: "turn:openrelay.metered.ca:80",
                    username: "openrelayproject",
                    credential: "openrelayproject"
                },
                { 
                    urls: "turn:openrelay.metered.ca:443",
                    username: "openrelayproject",
                    credential: "openrelayproject"
                },
                { 
                    urls: "turn:openrelay.metered.ca:443?transport=tcp",
                    username: "openrelayproject",
                    credential: "openrelayproject"
                }
            ],
            // Improve connectivity in restrictive networks
            iceCandidatePoolSize: 10,
            iceTransportPolicy: "all" // Try all connection types
        });
        peerConns.current[userId] = pc;

        // Set connection timeout (30 seconds)
        connectionTimeouts.current[userId] = window.setTimeout(() => {
            if (pc.connectionState !== "connected") {
                console.warn(`Connection timeout for ${userId}, attempting ICE restart`);
                // Try ICE restart
                if (pc.connectionState !== "closed") {
                    createPeerConnection(userId, true); // Force reinitiation
                }
            }
        }, 30000);

        // Initialize pending ICE candidates queue
        pendingIceCandidates.current[userId] = [];

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === "connected") {
                updatePeerStatus(userId, "connected");
                p2pFailCount.current[userId] = 0; // Reset fail count on successful connection
                // Clear connection timeout
                if (connectionTimeouts.current[userId]) {
                    clearTimeout(connectionTimeouts.current[userId]);
                    delete connectionTimeouts.current[userId];
                }
            } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
                p2pFailCount.current[userId] = (p2pFailCount.current[userId] || 0) + 1;
                if (p2pFailCount.current[userId] >= 5) {
                    console.error(`Peer ${userId} failed ${p2pFailCount.current[userId]} times. Giving up.`);
                    updatePeerStatus(userId, "disconnected");
                    return;
                }
                console.warn("Peer connection dropped", userId);
                try { pc.close(); } catch {}
                delete peerConns.current[userId];
                delete dataChannels.current[userId];
                delete pendingIceCandidates.current[userId];
                if (connectionTimeouts.current[userId]) {
                    clearTimeout(connectionTimeouts.current[userId]);
                    delete connectionTimeouts.current[userId];
                }
                const userOnline = usersRef.current.some(u => u.id === userId && u.isOnline);
                if (isOnlineRef.current && userOnline) {
                    updatePeerStatus(userId, "reconnecting");
                    // Add jitter so both peers don't reconnect simultaneously
                    const delay = 1000 + Math.floor(Math.random() * 1000);
                    setTimeout(() => {
                        if (!peerConns.current[userId]) {
                            createPeerConnection(userId);
                        }
                    }, delay);
                } else {
                    updatePeerStatus(userId, "disconnected");
                }
            }
        };

        pc.onicecandidate = (e) => {
            if (e.candidate && wsRef.current) {
                wsRef.current.send(JSON.stringify({
                    type: "candidate",
                    payload: userId,
                    text: JSON.stringify(e.candidate),
                }) + "\n");
            } else if (!e.candidate) {
                console.log(`ICE gathering complete for ${userId}`);
            }
        };

        // Monitor ICE connection state for better diagnostics
        pc.oniceconnectionstatechange = () => {
            console.log(`ICE connection state for ${userId}: ${pc.iceConnectionState}`);
            if (pc.iceConnectionState === "failed") {
                console.warn(`ICE connection failed for ${userId}, attempting restart`);
                // Attempt ICE restart
                if (pc.connectionState !== "closed" && sessionId > userId) {
                    setTimeout(() => {
                        if (pc.connectionState !== "connected") {
                            console.log(`Initiating ICE restart for ${userId}`);
                            pc.restartIce();
                        }
                    }, 1000);
                }
            }
        };

        // Monitor ICE gathering state
        pc.onicegatheringstatechange = () => {
            console.log(`ICE gathering state for ${userId}: ${pc.iceGatheringState}`);
        };

        pc.ondatachannel = e => setupDataChannel(userId, e.channel);

        if (initiate) {
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
        const existingPc = peerConns.current[userId];
        
        // Handle offer glare: if we're already in a non-stable state, decide who backs off
        if (existingPc && existingPc.signalingState !== "stable") {
            console.warn(`Offer glare detected with ${userId}. Our state: ${existingPc.signalingState}`);
            // Use deterministic tiebreaker: lower ID backs off
            if (sessionId < userId) {
                console.log(`Backing off from offer glare (our ID is lower)`);
                return;
            } else {
                console.log(`Proceeding with offer (their ID is lower), closing existing connection`);
                try { existingPc.close(); } catch {}
                delete peerConns.current[userId];
                delete dataChannels.current[userId];
            }
        }
        
        createPeerConnection(userId, false);
        const pc = peerConns.current[userId];
        if (!pc) return;
        
        pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(data)))
          .then(() => {
              // Process any queued ICE candidates after remote description is set
              processPendingCandidates(userId);
              return pc.createAnswer();
          })
          .then(a => pc.setLocalDescription(a))
          .then(() => {
              if (wsRef.current && pc.localDescription) {
                  wsRef.current.send(JSON.stringify({
                      type: "answer",
                      payload: userId,
                      text: JSON.stringify(pc.localDescription),
                  }) + "\n");
              }
          })
          .catch(err => {
              console.error(`Failed to handle offer from ${userId}:`, err);
              updatePeerStatus(userId, "disconnected");
          });
    };

    const handleAnswer = (userId: string, data: string) => {
        const pc = peerConns.current[userId];
        if (pc && pc.signalingState === "have-local-offer") {
            pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(data)))
              .then(() => {
                  // Process any queued ICE candidates after remote description is set
                  processPendingCandidates(userId);
              })
              .catch(err => {
                  console.error(`Failed to set remote description for ${userId}:`, err);
              });
        }
    };

    const handleCandidate = (userId: string, data: string) => {
        const pc = peerConns.current[userId];
        if (!pc) return;
        
        const candidate = JSON.parse(data);
        
        // Queue candidates if remote description not set yet
        if (!pc.remoteDescription) {
            console.log(`Queueing ICE candidate for ${userId} (remote description not set)`);
            pendingIceCandidates.current[userId] = pendingIceCandidates.current[userId] || [];
            pendingIceCandidates.current[userId].push(candidate);
            return;
        }
        
        // Add candidate immediately if remote description is set
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => {
            console.error(`Failed to add ICE candidate for ${userId}:`, err);
        });
    };

    const processPendingCandidates = (userId: string) => {
        const pc = peerConns.current[userId];
        const pending = pendingIceCandidates.current[userId];
        
        if (!pc || !pending || pending.length === 0) return;
        
        console.log(`Processing ${pending.length} queued ICE candidates for ${userId}`);
        pending.forEach(candidate => {
            pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => {
                console.error(`Failed to add queued ICE candidate for ${userId}:`, err);
            });
        });
        
        pendingIceCandidates.current[userId] = [];
    };

    const ensureConnection = (userId: string) => {
        const channel = dataChannels.current[userId];
        if (!channel || channel.readyState !== "open") {
            if (isOnlineRef.current && usersRef.current.some(u => u.id === userId && u.isOnline)) {
                createPeerConnection(userId);
            } else {
                updatePeerStatus(userId, "disconnected");
            }
            return false;
        }
        return true;
    };

    // Periodically attempt to (re)establish missing peer connections
    useEffect(() => {
        const interval = setInterval(() => {
            if (!isOnlineRef.current) return;
            usersRef.current.forEach(u => {
                if (u.id === sessionId || !u.isOnline) return;
                const pc = peerConns.current[u.id];
                const state = pc?.connectionState;
                if (!pc || state === "closed" || state === "failed" || state === "disconnected") {
                    const shouldInitiate = sessionId > u.id;
                    createPeerConnection(u.id, shouldInitiate);
                }
            });
        }, 2000);
        return () => clearInterval(interval);
    }, [sessionId]);

    const handleSendMessage = (targetUser: string, text: string) => {
        if (!ensureConnection(targetUser)) {
            alert("Peer connection not established yet. Reconnecting...");
            return;
        }
        const channel = dataChannels.current[targetUser]!;
        const sanitized = sanitizeText(text);
        channel.send(JSON.stringify({ type: "text", text: sanitized }));

        const newMessage: Message = {
            id: Date.now().toString(),
            text: sanitized,
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
        if (!ensureConnection(targetUser)) {
            alert("Peer connection not established yet. Reconnecting...");
            return;
        }
        const channel = dataChannels.current[targetUser]!;

        console.debug(`Preparing to send '${file.name}' (${file.size} B)`);

        const MAX_BUFFERED = 16 * 1024 * 1024; // 16 MiB
        channel.bufferedAmountLowThreshold = 4 * 1024 * 1024; // 4 MiB

        // Setup send timeout monitoring
        let sendTimeoutId: number | null = null;
        const resetSendTimeout = () => {
            if (sendTimeoutId) clearTimeout(sendTimeoutId);
            sendTimeoutId = window.setTimeout(() => {
                console.error(`File send timeout for ${targetUser} - no chunks sent in 2 minutes`);
                setSendProgress(null);
                setSendFileInfo(null);
                alert(`File transfer to ${targetUser} failed: Connection timeout (no data sent for 2 minutes)`);
            }, 120000); // 2 minutes
        };

        const clearSendTimeout = () => {
            if (sendTimeoutId) {
                clearTimeout(sendTimeoutId);
                sendTimeoutId = null;
            }
        };

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
        resetSendTimeout(); // Start timeout monitoring

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
                    resetSendTimeout(); // Reset timeout on successful chunk send
                } catch (err) {
                    console.error("Failed to send chunk:", err);
                    clearSendTimeout();
                    alert("File transfer aborted.");
                    setSendProgress(null);
                    setSendFileInfo(null);
                    return;
                }

                offset = end;
                sent += chunk.byteLength;
                setSendProgress(Math.floor((sent / file.size) * 100));
            }
        }

        // 3 — finish
        clearSendTimeout(); // Clear timeout on completion
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
        if (!ensureConnection(targetUser)) {
            alert("Peer connection not established yet. Reconnecting...");
            return;
        }
        const channel = dataChannels.current[targetUser]!;
        pendingFiles.current[targetUser] = file;
        channel.send(JSON.stringify({ type: "file-offer", filename: file.name, size: file.size }));
    };

    useEffect(() => {
        const onOnline = () => {
            // Try to re-establish the WS soon after network returns
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
                // Small jitter to avoid thundering herd
                const delay = 200 + Math.floor(Math.random() * 400);
                setTimeout(() => {
                    try {
                        // Trigger reconnect by closing any stale socket; main effect will reconnect
                        wsRef.current?.close();
                    } catch {}
                }, delay);
            }
        };
        const onOffline = () => {
            setIsOnline(false);
            cleanupPeerConnections();
        };
        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);
        return () => {
            window.removeEventListener("online", onOnline);
            window.removeEventListener("offline", onOffline);
        };
    }, []);

    return (
        <div className="min-h-screen bg-rt-dark p-2 md:p-4">
            <div className="max-w-screen-xl mx-auto h-[calc(100vh-1rem)] md:h-[calc(100vh-2rem)] rounded-xl md:rounded-2xl overflow-hidden bg-rt-dark">
                <div className="flex h-full relative">
                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="md:hidden absolute top-3 left-4 z-50 w-8 h-8 bg-rt-card rounded-lg flex items-center justify-center text-white shadow-lg border border-rt-text-gray/30"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>

                    {/* Sidebar */}
                    <div className={`${
                        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    } md:translate-x-0 fixed md:relative z-30 md:z-auto w-[280px] bg-rt-sidebar flex flex-col h-full transition-transform duration-300 ease-in-out`}>
                        {/* Sidebar Header */}
                        <div className="pr-4 pt-16 pb-4 md:p-6 border-b border-rt-card">
                            <div className="flex items-center gap-3 pl-4 md:pl-0">
                                <a 
                                    href="https://github.com/Hans2711/rt-share" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-xl md:text-2xl font-bold text-white hover:text-rt-green transition-colors flex items-center gap-2"
                                >
                                    RT-Share
                                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </a>
                            </div>
                            <p className="text-rt-text-gray text-sm pl-4 md:pl-0 mt-2">Your ID: {sessionId}</p>
                        </div>

                        {/* Users Section */}
                        <div className="p-4 md:p-6 flex-1">
                            <h2 className="text-lg font-semibold text-white mb-4">Users</h2>
                            <div className="space-y-3">
                                {users
                                    .filter(u => u.id !== sessionId)
                                    .map(u => {
                                        const connectionStatus = peerStatuses[u.id] || "disconnected";
                                        return (
                                            <div
                                                key={u.id}
                                                onClick={() => {
                                                    selectUser(u.id);
                                                    setSidebarOpen(false); // Close sidebar on mobile after selection
                                                }}
                                                className={`p-3 md:p-4 rounded-2xl cursor-pointer transition-colors ${
                                                    selectedUser === u.id
                                                        ? 'bg-rt-card border border-rt-green'
                                                        : 'bg-rt-card hover:bg-rt-card/80'
                                                } ${!u.isOnline ? 'opacity-50' : ''}`}
                                            >
                                                <div className="text-white font-medium text-sm md:text-base">{u.id}</div>
                                                <div className="flex items-center gap-3 mt-2">
                                                    {/* Online Status */}
                                                    <div className="flex items-center">
                                                        <div className={`w-2 h-2 rounded-full mr-2 ${
                                                            u.isOnline ? 'bg-rt-green' : 'bg-rt-text-dark'
                                                        }`}></div>
                                                        <span className="text-rt-text-gray text-xs">
                                                            {u.isOnline ? 'Online' : 'Offline'}
                                                        </span>
                                                    </div>
                                                    {/* Connected Status */}
                                                    {u.isOnline && (
                                                        <div className="flex items-center">
                                                            <div className={`w-2 h-2 rounded-full mr-2 ${
                                                                connectionStatus === 'connected' ? 'bg-blue-500' :
                                                                connectionStatus === 'connecting' ? 'bg-yellow-500' :
                                                                connectionStatus === 'reconnecting' ? 'bg-orange-500' :
                                                                'bg-rt-text-dark'
                                                            }`}></div>
                                                            <span className="text-rt-text-gray text-xs capitalize">
                                                                {connectionStatus === 'connected' ? 'Connected' :
                                                                 connectionStatus === 'connecting' ? 'Connecting' :
                                                                 connectionStatus === 'reconnecting' ? 'Reconnecting' :
                                                                 'Disconnected'}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>

                            {/* Local Only Checkbox - Hidden on mobile for space */}
                            <div className="hidden md:block mt-6">
                                <label htmlFor="localOnly" className="flex items-center p-3 rounded-lg cursor-pointer hover:bg-rt-card/50 transition-colors">
                                    <input
                                        type="checkbox"
                                        id="localOnly"
                                        className="w-4 h-4 rounded border-rt-text-gray bg-transparent checked:bg-rt-green focus:ring-rt-green mr-3"
                                    />
                                    <span className="text-rt-text-light text-sm">Local only</span>
                                </label>
                            </div>
                        </div>

                        {/* Files History Button */}
                        <div className="px-4 py-4 md:px-6 md:py-5 border-t border-rt-card">
                            <button
                                onClick={() => {
                                    setShowHistory(true);
                                    setSidebarOpen(false); // Close sidebar on mobile
                                }}
                                className="w-full bg-rt-card hover:bg-rt-card/80 text-white py-3 px-4 rounded-2xl font-semibold transition-colors flex items-center justify-center"
                            >
                                📁 Files
                            </button>
                        </div>
                    </div>

                    {/* Mobile Overlay */}
                    {sidebarOpen && (
                        <div
                            className="md:hidden fixed inset-0 bg-black/50 z-20"
                            onClick={() => setSidebarOpen(false)}
                        />
                    )}

                    {/* Chat Area */}
                    <div className="flex-1 bg-rt-dark flex flex-col ml-0 md:ml-0">
                        {isConnecting ? (
                            <div className="flex items-center justify-center h-full text-rt-text-light">Connecting...</div>
                        ) : error ? (
                            <div className="flex items-center justify-center h-full text-red-400"><p>Error: {error}</p></div>
                        ) : (
                            <Chat
                                currentUser={sessionId}
                                targetUser={selectedUser}
                                messages={selectedUser ? messages[selectedUser] || [] : []}
                                sendInfo={{ progress: sendProgress, filename: sendFileInfo?.name, size: sendFileInfo?.size }}
                                receiveInfo={{ progress: receiveProgress, filename: receiveFileInfo?.name, size: receiveFileInfo?.size }}
                                connectionStatus={selectedUser ? peerStatuses[selectedUser] || "disconnected" : "disconnected"}
                                onSendMessage={selectedUser ? (text => handleSendMessage(selectedUser, text)) : () => {}}
                                onSendFile={selectedUser ? (file => handleSendFile(selectedUser, file)) : () => {}}
                                onShowHistory={() => setShowHistory(true)}
                            />
                        )}
                    </div>
                </div>
            </div>
            {showHistory && (
                <FileHistoryModal
                    files={Object.entries(receivedFiles).flatMap(([sender, fs]) =>
                        fs.map(f => ({ ...f, sender }))
                    )}
                    onClose={() => setShowHistory(false)}
                />
            )}
        </div>
    );
}
