import { jsx, jsxs } from "react/jsx-runtime";
import { PassThrough } from "node:stream";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter, UNSAFE_withComponentProps, Outlet, UNSAFE_withErrorBoundaryProps, isRouteErrorResponse, useNavigation, Meta, Links, ScrollRestoration, Scripts } from "react-router";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import { useState, useEffect, useRef } from "react";
const streamTimeout = 5e3;
function handleRequest(request, responseStatusCode, responseHeaders, routerContext, loadContext) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    let userAgent = request.headers.get("user-agent");
    let readyOption = userAgent && isbot(userAgent) || routerContext.isSpaMode ? "onAllReady" : "onShellReady";
    let timeoutId = setTimeout(
      () => abort(),
      streamTimeout + 1e3
    );
    const { pipe, abort } = renderToPipeableStream(
      /* @__PURE__ */ jsx(ServerRouter, { context: routerContext, url: request.url }),
      {
        [readyOption]() {
          shellRendered = true;
          const body = new PassThrough({
            final(callback) {
              clearTimeout(timeoutId);
              timeoutId = void 0;
              callback();
            }
          });
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          pipe(body);
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode
            })
          );
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          if (shellRendered) {
            console.error(error);
          }
        }
      }
    );
  });
}
const entryServer = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: handleRequest,
  streamTimeout
}, Symbol.toStringTag, { value: "Module" }));
const links = () => [{
  rel: "preconnect",
  href: "https://fonts.googleapis.com"
}, {
  rel: "preconnect",
  href: "https://fonts.gstatic.com",
  crossOrigin: "anonymous"
}, {
  rel: "stylesheet",
  href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
}];
function Layout({
  children
}) {
  const navigation = useNavigation();
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const isLoading = isInitialLoad || navigation.state !== "idle";
  useEffect(() => {
    if (navigation.state === "idle") {
      setIsInitialLoad(false);
    }
  }, [navigation.state]);
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => {
    setIsHydrated(true);
  }, []);
  return /* @__PURE__ */ jsxs("html", {
    lang: "en",
    children: [/* @__PURE__ */ jsxs("head", {
      children: [/* @__PURE__ */ jsx("meta", {
        charSet: "utf-8"
      }), /* @__PURE__ */ jsx("meta", {
        name: "viewport",
        content: "width=device-width, initial-scale=1"
      }), /* @__PURE__ */ jsx(Meta, {}), /* @__PURE__ */ jsx(Links, {})]
    }), /* @__PURE__ */ jsxs("body", {
      suppressHydrationWarning: true,
      children: [isLoading && /* @__PURE__ */ jsx("div", {
        className: "fixed inset-0 bg-gray-100/80 dark:bg-gray-900/70 flex justify-center items-center z-50",
        children: /* @__PURE__ */ jsx("div", {
          className: "w-10 h-10 border-4 border-gray-300 border-t-red-600 rounded-full animate-spin dark:border-gray-500 dark:border-t-red-400"
        })
      }), /* @__PURE__ */ jsxs("div", {
        style: {
          display: isLoading ? "none" : "block"
        },
        children: [children, /* @__PURE__ */ jsx(ScrollRestoration, {}), /* @__PURE__ */ jsx(Scripts, {})]
      })]
    })]
  });
}
const root = UNSAFE_withComponentProps(function App() {
  return /* @__PURE__ */ jsx(Outlet, {});
});
const ErrorBoundary = UNSAFE_withErrorBoundaryProps(function ErrorBoundary2({
  error
}) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack;
  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details = error.status === 404 ? "The requested page could not be found." : error.statusText || details;
  }
  return /* @__PURE__ */ jsxs("main", {
    className: "pt-16 p-4 container mx-auto",
    children: [/* @__PURE__ */ jsx("h1", {
      children: message
    }), /* @__PURE__ */ jsx("p", {
      children: details
    }), stack]
  });
});
const route0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ErrorBoundary,
  Layout,
  default: root,
  links
}, Symbol.toStringTag, { value: "Module" }));
function detectDeviceLabel() {
  var _a;
  try {
    const nav = typeof navigator !== "undefined" ? navigator : {};
    const ua = String(nav.userAgent || "");
    const platform = String(((_a = nav.userAgentData) == null ? void 0 : _a.platform) || nav.platform || "");
    const isIpadLike = /iPad/i.test(ua) || /Macintosh/i.test(ua) && typeof nav.maxTouchPoints === "number" && nav.maxTouchPoints > 1;
    if (/iPhone/i.test(ua)) return "iPhone";
    if (isIpadLike) return "iPad";
    if (/Android/i.test(ua)) return "Android";
    if (/Windows/i.test(ua) || /Win/i.test(platform)) return "Windows";
    if (/CrOS/i.test(ua) || /Chrome\s?OS/i.test(platform)) return "ChromeOS";
    if (/Mac OS X|Macintosh|MacIntel/i.test(ua) || /Mac/i.test(platform)) return "Mac";
    if (/Linux/i.test(ua) || /Linux/i.test(platform)) return "Linux";
    return "Device";
  } catch {
    return "Device";
  }
}
function randomLetters(count) {
  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint8Array(count);
    crypto.getRandomValues(buf);
    return Array.from(buf, (b) => alpha[b % 26]).join("");
  }
  let s = "";
  for (let i = 0; i < count; i++) {
    s += alpha[Math.floor(Math.random() * 26)];
  }
  return s;
}
function generateSessionId() {
  const label = detectDeviceLabel();
  const suffix = randomLetters(2);
  return `${label}-${suffix}`;
}
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let i = -1;
  let size = bytes;
  do {
    size /= 1024;
    i++;
  } while (size >= 1024 && i < units.length - 1);
  return `${size.toFixed(1)} ${units[i]}`;
}
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(",", 2)[1] ?? "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
function base64ToBlob(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes]);
}
function base64SizeInBytes(base64) {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return base64.length * 3 / 4 - padding;
}
function sanitizeText(text) {
  const doc = new DOMParser().parseFromString(text, "text/html");
  return doc.body.textContent || "";
}
function Chat({
  currentUser,
  targetUser,
  messages,
  onSendMessage,
  onSendFile,
  onShowHistory,
  sendInfo = { progress: null },
  receiveInfo = { progress: null },
  connectionStatus
}) {
  const [messageInput, setMessageInput] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const canInteract = Boolean(targetUser && connectionStatus === "connected");
  const handleSendMessage = () => {
    const text = messageInput.trim();
    if (!targetUser || connectionStatus !== "connected" || !text) return;
    console.log(text);
    onSendMessage(text);
    setMessageInput("");
  };
  const handleFileChange = (e) => {
    var _a;
    const file = (_a = e.target.files) == null ? void 0 : _a[0];
    if (!targetUser || connectionStatus !== "connected" || !file) return;
    console.log("Sending File", file);
    onSendFile(file);
    e.target.value = "";
  };
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col h-full", children: [
    /* @__PURE__ */ jsx("div", { className: "bg-rt-sidebar pr-4 md:px-8 py-4 md:py-5 border-b border-rt-card", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between pl-14 md:pl-0", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-lg md:text-xl font-semibold text-white", children: targetUser ? `Chat with ${targetUser}` : "Chat" }),
      targetUser && /* @__PURE__ */ jsxs("div", { className: `rounded-full px-3 py-1.5 flex items-center gap-2 ${connectionStatus === "connected" ? "bg-green-800/30" : connectionStatus === "connecting" ? "bg-amber-800/30" : connectionStatus === "reconnecting" ? "bg-amber-800/30" : "bg-red-800/30"}`, children: [
        /* @__PURE__ */ jsx("div", { className: `w-2 h-2 rounded-full ${connectionStatus === "connected" ? "bg-rt-green" : connectionStatus === "connecting" ? "bg-amber-500" : connectionStatus === "reconnecting" ? "bg-amber-500 animate-pulse" : "bg-red-500"}` }),
        /* @__PURE__ */ jsx("span", { className: `text-sm font-medium ${connectionStatus === "connected" ? "text-rt-green" : connectionStatus === "connecting" ? "text-amber-500" : connectionStatus === "reconnecting" ? "text-amber-500" : "text-red-500"}`, children: connectionStatus === "connected" ? "Connected" : connectionStatus === "reconnecting" ? "Reconnecting..." : connectionStatus === "connecting" ? "Connecting..." : "Disconnected" })
      ] })
    ] }) }),
    sendInfo.progress !== null && /* @__PURE__ */ jsxs("div", { className: "px-4 md:px-8 py-3 bg-rt-sidebar border-b border-rt-card", children: [
      /* @__PURE__ */ jsxs("div", { className: "text-rt-text-light text-sm mb-2", children: [
        "Sending ",
        sendInfo.filename,
        " (",
        sendInfo.size ? formatBytes(sendInfo.size) : "",
        ")… ",
        sendInfo.progress,
        "%"
      ] }),
      /* @__PURE__ */ jsx(
        "progress",
        {
          value: sendInfo.progress ?? 0,
          max: 100,
          className: "w-full h-2 bg-rt-card rounded-full overflow-hidden"
        }
      )
    ] }),
    receiveInfo.progress !== null && /* @__PURE__ */ jsxs("div", { className: "px-4 md:px-8 py-3 bg-rt-sidebar border-b border-rt-card", children: [
      /* @__PURE__ */ jsxs("div", { className: "text-rt-text-light text-sm mb-2", children: [
        "Receiving ",
        receiveInfo.filename,
        " (",
        receiveInfo.size ? formatBytes(receiveInfo.size) : "",
        ")… ",
        receiveInfo.progress,
        "%"
      ] }),
      /* @__PURE__ */ jsx(
        "progress",
        {
          value: receiveInfo.progress ?? 0,
          max: 100,
          className: "w-full h-2 bg-rt-card rounded-full overflow-hidden"
        }
      )
    ] }),
    /* @__PURE__ */ jsx("div", { className: "flex-1 overflow-y-auto px-4 md:px-8 py-4 md:py-6 space-y-3 md:space-y-4", children: targetUser ? messages.map((message) => /* @__PURE__ */ jsx(
      "div",
      {
        className: `flex ${message.sender === currentUser ? "justify-end" : "justify-start"}`,
        children: /* @__PURE__ */ jsxs(
          "div",
          {
            className: `max-w-[85%] md:max-w-[70%] p-3 md:p-4 rounded-2xl ${message.sender === currentUser ? "bg-rt-message-out text-white" : "bg-rt-message-in text-white"}`,
            children: [
              /* @__PURE__ */ jsx("div", { className: "text-xs text-rt-text-light mb-2", children: message.sender === currentUser ? currentUser : message.sender }),
              message.isFile ? /* @__PURE__ */ jsx("div", { className: "text-sm", children: message.filename }) : /* @__PURE__ */ jsx("div", { className: "text-sm leading-relaxed", children: message.text }),
              /* @__PURE__ */ jsx("div", { className: `text-xs mt-2 ${message.sender === currentUser ? "text-white/70" : "text-rt-text-dark"}`, children: new Date(message.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
              }) })
            ]
          }
        )
      },
      message.id
    )) : /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center h-full text-rt-text-light", children: /* @__PURE__ */ jsx("p", { children: "Select a user to start chatting" }) }) }),
    /* @__PURE__ */ jsx("div", { className: "bg-rt-sidebar px-4 md:px-8 py-4 md:py-5 border-t border-rt-card", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col md:flex-row gap-3", children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "text",
          value: messageInput,
          onChange: (e) => setMessageInput(e.target.value),
          onKeyPress: (e) => e.key === "Enter" && handleSendMessage(),
          placeholder: "Type a message...",
          className: "flex-1 bg-rt-card text-white placeholder-rt-text-gray rounded-2xl px-4 py-3 text-sm border-none focus:outline-none focus:ring-2 focus:ring-rt-green",
          disabled: !canInteract
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: handleSendMessage,
            disabled: !canInteract,
            className: "flex-1 md:flex-none bg-rt-green-dark hover:bg-rt-green text-white px-4 md:px-6 py-3 rounded-2xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base",
            children: "Send"
          }
        ),
        /* @__PURE__ */ jsx(
          "label",
          {
            htmlFor: "file",
            className: `flex-1 md:flex-none bg-rt-green-dark hover:bg-rt-green text-white px-4 md:px-6 py-3 rounded-2xl font-semibold cursor-pointer transition-colors flex items-center justify-center text-sm md:text-base ${!canInteract ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`,
            children: "Send File"
          }
        ),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "file",
            name: "file",
            id: "file",
            onChange: handleFileChange,
            className: "hidden",
            disabled: !canInteract
          }
        )
      ] })
    ] }) })
  ] });
}
function FileHistoryModal({ files, onClose }) {
  const handleDownload = (f) => {
    const url = URL.createObjectURL(f.blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: f.filename,
      style: "display:none"
    });
    document.body.appendChild(a).click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  return /* @__PURE__ */ jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: /* @__PURE__ */ jsxs("div", { className: "bg-rt-sidebar rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden", children: [
    /* @__PURE__ */ jsxs("div", { className: "px-6 py-5 border-b border-rt-card flex items-center justify-between", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-xl font-bold text-white", children: "Files History" }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: onClose,
          className: "w-8 h-8 rounded-xl bg-rt-card hover:bg-rt-card/80 flex items-center justify-center text-white text-xl transition-colors",
          children: "×"
        }
      )
    ] }),
    /* @__PURE__ */ jsx("div", { className: "p-6 max-h-96 overflow-y-auto", children: files.length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-rt-text-light text-center py-8", children: "No files yet." }) : /* @__PURE__ */ jsx("div", { className: "space-y-3", children: files.map((f, i) => /* @__PURE__ */ jsx("div", { className: "bg-rt-card rounded-xl p-4", children: /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
        /* @__PURE__ */ jsx("div", { className: "text-white text-sm font-medium mb-1 break-all", children: f.filename }),
        /* @__PURE__ */ jsxs("div", { className: "text-rt-text-gray text-xs", children: [
          f.sender ? `From ${f.sender}` : "",
          f.sender && " • ",
          (f.blob.size / 1024 / 1024).toFixed(1),
          " MB"
        ] })
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => handleDownload(f),
          className: "bg-rt-green-dark hover:bg-rt-green text-white px-3 py-2 rounded-lg font-medium text-sm transition-colors ml-3 flex-shrink-0",
          children: "↓"
        }
      )
    ] }) }, i)) }) })
  ] }) });
}
function RtShare() {
  const [sessionId, setSessionId] = useState("");
  const wsRef = useRef(null);
  const peerConns = useRef({});
  const dataChannels = useRef({});
  const p2pFailCount = useRef({});
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef(null);
  const pendingIceCandidates = useRef({});
  const connectionTimeouts = useRef({});
  const fileReceiveTimeouts = useRef({});
  const fileSendTimeouts = useRef({});
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const selectedUserRef = useRef(null);
  const [messages, setMessages] = useState({});
  const [isOnline, setIsOnline] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");
  const [sendProgress, setSendProgress] = useState(null);
  const [receiveProgress, setReceiveProgress] = useState(null);
  const [sendFileInfo, setSendFileInfo] = useState(null);
  const [receiveFileInfo, setReceiveFileInfo] = useState(null);
  const [receivedFiles, setReceivedFiles] = useState({});
  const isShuttingDownRef = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("receivedFileHistory");
      if (raw) {
        const arr = JSON.parse(raw);
        const map = {};
        arr.forEach((e) => {
          var _a;
          map[_a = e.sender] ?? (map[_a] = []);
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
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (isMobile && !selectedUser) {
      setSidebarOpen(true);
    }
  }, [selectedUser]);
  const [peerStatuses, setPeerStatuses] = useState({});
  const allowedRecipients = useRef({});
  const allowedSenders = useRef({});
  const pendingFiles = useRef({});
  const usersRef = useRef([]);
  const isOnlineRef = useRef(false);
  const saveFileEntry = async (sender, filename, blob) => {
    const base64 = await blobToBase64(blob);
    let entries = [];
    try {
      entries = JSON.parse(localStorage.getItem("receivedFileHistory") || "[]");
    } catch {
    }
    entries.push({ sender, filename, data: base64 });
    let total = entries.reduce((s, e) => s + base64SizeInBytes(e.data), 0);
    const LIMIT = 1.5 * 1024 * 1024 * 1024;
    while (total > LIMIT && entries.length > 0) {
      entries.shift();
      total = entries.reduce((s, e) => s + base64SizeInBytes(e.data), 0);
    }
    localStorage.setItem("receivedFileHistory", JSON.stringify(entries));
  };
  const updatePeerStatus = (id, status) => {
    setPeerStatuses((prev) => ({ ...prev, [id]: status }));
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
  const CHUNK_SIZE = 16 * 1024;
  useEffect(() => {
    const interval = setInterval(() => {
      Object.entries(peerConns.current).forEach(([uid, pc]) => {
        let status = "connecting";
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
  const incomingFiles = useRef({});
  const cleanupPeerConnections = () => {
    Object.values(dataChannels.current).forEach((ch) => {
      try {
        ch.close();
      } catch {
      }
    });
    Object.values(peerConns.current).forEach((pc) => {
      try {
        pc.close();
      } catch {
      }
    });
    Object.values(connectionTimeouts.current).forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    Object.values(fileReceiveTimeouts.current).forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    Object.values(fileSendTimeouts.current).forEach((timeoutId) => {
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
  const selectUser = (uid) => {
    setSelectedUser(uid);
    const userOnline = usersRef.current.some((u) => u.id === uid && u.isOnline);
    if (!isOnlineRef.current || !userOnline) {
      updatePeerStatus(uid, "disconnected");
      return;
    }
    if (!peerConns.current[uid]) {
      updatePeerStatus(uid, "connecting");
      const shouldInitiate = sessionId > uid;
      createPeerConnection(uid, shouldInitiate);
    }
  };
  useEffect(() => {
    let storedSessionId = localStorage.getItem("sessionId");
    const needsMigration = !storedSessionId || /^\d{5}$/.test(storedSessionId);
    if (needsMigration) {
      storedSessionId = generateSessionId();
      localStorage.setItem("sessionId", storedSessionId);
    }
    setSessionId(storedSessionId);
    const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${wsProtocol}://${window.location.host}/ws`;
    const clearReconnectTimer = () => {
      if (reconnectTimer.current !== null) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };
    const scheduleReconnect = () => {
      const attempt = reconnectAttempts.current;
      const base = 500;
      const delay = Math.min(15e3, base * Math.pow(2, attempt)) + Math.floor(Math.random() * 400);
      reconnectAttempts.current = Math.min(attempt + 1, 10);
      clearReconnectTimer();
      reconnectTimer.current = window.setTimeout(connect, delay);
    };
    const didNotifyLeave = { value: false };
    const connect = () => {
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
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
        var _a, _b;
        const jEvent = JSON.parse(event.data);
        if (jEvent.type === "heartbeat") {
          return;
        }
        console.log("Received event:", jEvent);
        if (jEvent.type === "join" && jEvent.status === "ok") {
          const userList = JSON.parse(jEvent.data);
          setUsers(userList.map((u) => ({ ...u, isOnline: true })));
          userList.forEach((u) => {
            if (u.id !== storedSessionId) {
              const shouldInitiate = storedSessionId > u.id;
              createPeerConnection(u.id, shouldInitiate);
            }
          });
        } else if (jEvent.type === "join" && jEvent.status === "userJoin") {
          const userID = jEvent.data;
          const ip = jEvent.ip;
          setUsers(
            (prev) => prev.some((u) => u.id === userID) ? prev.map((u) => u.id === userID ? { ...u, isOnline: true, ip } : u) : [...prev, { id: userID, ip, isOnline: true }]
          );
          if (userID !== storedSessionId) {
            const shouldInitiate = storedSessionId > userID;
            createPeerConnection(userID, shouldInitiate);
          }
        } else if (jEvent.type === "leave" && jEvent.status === "userLeft") {
          const userID = jEvent.data;
          setUsers((prev) => prev.map((u) => u.id === userID ? { ...u, isOnline: false } : u));
          updatePeerStatus(userID, "disconnected");
          try {
            (_a = dataChannels.current[userID]) == null ? void 0 : _a.close();
          } catch {
          }
          try {
            (_b = peerConns.current[userID]) == null ? void 0 : _b.close();
          } catch {
          }
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
    const notifyLeave = () => {
      if (didNotifyLeave.value) return;
      didNotifyLeave.value = true;
      isShuttingDownRef.current = true;
      try {
        clearReconnectTimer();
      } catch {
      }
      try {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.send(JSON.stringify({ type: "leave", payload: storedSessionId }) + "\n");
          } catch {
          }
          try {
            wsRef.current.close();
          } catch {
          }
        } else if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
          try {
            wsRef.current.close();
          } catch {
          }
        }
      } catch {
      }
      try {
        cleanupPeerConnections();
      } catch {
      }
    };
    const onPageHide = () => notifyLeave();
    const onBeforeUnload = () => notifyLeave();
    const onFreeze = () => notifyLeave();
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("freeze", onFreeze);
    const onPageShow = () => {
      isShuttingDownRef.current = false;
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN && wsRef.current.readyState !== WebSocket.CONNECTING) {
        connect();
      }
    };
    window.addEventListener("pageshow", onPageShow);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        isShuttingDownRef.current = false;
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN && wsRef.current.readyState !== WebSocket.CONNECTING) {
          connect();
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      try {
        window.removeEventListener("pagehide", onPageHide);
        window.removeEventListener("beforeunload", onBeforeUnload);
        document.removeEventListener("freeze", onFreeze);
        window.removeEventListener("pageshow", onPageShow);
        document.removeEventListener("visibilitychange", onVisibilityChange);
      } catch {
      }
      clearReconnectTimer();
      isShuttingDownRef.current = true;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: "leave", payload: storedSessionId }) + "\n");
        } catch {
        }
        wsRef.current.close();
      }
      wsRef.current = null;
      cleanupPeerConnections();
    };
  }, []);
  const setupDataChannel = (userId, channel) => {
    channel.binaryType = "arraybuffer";
    dataChannels.current[userId] = channel;
    channel.onopen = () => updatePeerStatus(userId, "connected");
    channel.onclose = () => {
      delete dataChannels.current[userId];
      try {
        const pc = peerConns.current[userId];
        if (pc) pc.close();
      } catch {
      }
      delete peerConns.current[userId];
      delete pendingIceCandidates.current[userId];
      if (connectionTimeouts.current[userId]) {
        clearTimeout(connectionTimeouts.current[userId]);
        delete connectionTimeouts.current[userId];
      }
      const userOnline = usersRef.current.some((u) => u.id === userId && u.isOnline);
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
      var _a, _b;
      if (selectedUserRef.current !== userId) {
        setSelectedUser(userId);
      }
      if (typeof e.data === "string") {
        let msg;
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }
        if (msg.type === "text") {
          const sanitized = sanitizeText(msg.text);
          const newMessage = {
            id: Date.now().toString(),
            text: sanitized,
            sender: userId,
            timestamp: /* @__PURE__ */ new Date()
          };
          setMessages((prev) => ({
            ...prev,
            [userId]: [...prev[userId] || [], newMessage]
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
          (_a = incomingFiles.current)[userId] ?? (_a[userId] = {});
          incomingFiles.current[userId][msg.filename] = {
            size: msg.size,
            received: 0,
            chunks: []
          };
          setReceiveFileInfo({ name: msg.filename, size: msg.size });
          setReceiveProgress(0);
          if (fileReceiveTimeouts.current[userId]) {
            clearTimeout(fileReceiveTimeouts.current[userId]);
          }
          fileReceiveTimeouts.current[userId] = window.setTimeout(() => {
            var _a2;
            console.error(`File receive timeout for ${userId} - no chunks received in 2 minutes`);
            (_a2 = incomingFiles.current[userId]) == null ? true : delete _a2[msg.filename];
            setReceiveProgress(null);
            setReceiveFileInfo(null);
            delete fileReceiveTimeouts.current[userId];
            alert(`File transfer from ${userId} failed: Connection timeout (no data received for 2 minutes)`);
          }, 12e4);
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
          const entry2 = (_b = incomingFiles.current[userId]) == null ? void 0 : _b[msg.filename];
          if (!entry2) return;
          if (fileReceiveTimeouts.current[userId]) {
            clearTimeout(fileReceiveTimeouts.current[userId]);
            delete fileReceiveTimeouts.current[userId];
          }
          const blob = new Blob(entry2.chunks);
          const url = URL.createObjectURL(blob);
          const a = Object.assign(document.createElement("a"), {
            href: url,
            download: msg.filename,
            style: "display:none"
          });
          document.body.appendChild(a).click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          setReceivedFiles((prev) => ({
            ...prev,
            [userId]: [...prev[userId] || [], { filename: msg.filename, blob }]
          }));
          saveFileEntry(userId, msg.filename, blob);
          const newMessage = {
            id: Date.now().toString(),
            text: "",
            sender: userId,
            timestamp: /* @__PURE__ */ new Date(),
            isFile: true,
            filename: msg.filename
          };
          setMessages((prev) => ({
            ...prev,
            [userId]: [...prev[userId] || [], newMessage]
          }));
          delete incomingFiles.current[userId][msg.filename];
          setReceiveProgress(null);
          setReceiveFileInfo(null);
        }
        return;
      }
      if (e.data instanceof ArrayBuffer || e.data instanceof Blob) {
        const arrayBufPromise = e.data instanceof Blob ? e.data.arrayBuffer() : Promise.resolve(e.data);
        arrayBufPromise.then((ab) => {
          const files = incomingFiles.current[userId];
          const current = files && Object.values(files)[0];
          if (!current) return;
          current.chunks.push(ab);
          current.received += ab.byteLength;
          setReceiveProgress(Math.floor(current.received / current.size * 100));
          if (fileReceiveTimeouts.current[userId]) {
            clearTimeout(fileReceiveTimeouts.current[userId]);
            const filename = Object.keys(files)[0];
            fileReceiveTimeouts.current[userId] = window.setTimeout(() => {
              var _a2;
              console.error(`File receive timeout for ${userId} - no chunks received in 2 minutes`);
              (_a2 = incomingFiles.current[userId]) == null ? true : delete _a2[filename];
              setReceiveProgress(null);
              setReceiveFileInfo(null);
              delete fileReceiveTimeouts.current[userId];
              alert(`File transfer from ${userId} failed: Connection timeout (no data received for 2 minutes)`);
            }, 12e4);
          }
        });
        return;
      }
      console.warn("Unrecognised datachannel frame:", e.data);
    };
  };
  const createPeerConnection = (userId, initiate = sessionId > userId) => {
    if (peerConns.current[userId]) return;
    if (!isOnlineRef.current || !usersRef.current.some((u) => u.id === userId && u.isOnline)) {
      updatePeerStatus(userId, "disconnected");
      return;
    }
    setPeerStatuses((prev) => ({
      ...prev,
      [userId]: prev[userId] === "reconnecting" ? "reconnecting" : "connecting"
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
      iceTransportPolicy: "all"
      // Try all connection types
    });
    peerConns.current[userId] = pc;
    connectionTimeouts.current[userId] = window.setTimeout(() => {
      if (pc.connectionState !== "connected") {
        console.warn(`Connection timeout for ${userId}, attempting ICE restart`);
        if (pc.connectionState !== "closed") {
          createPeerConnection(userId, true);
        }
      }
    }, 3e4);
    pendingIceCandidates.current[userId] = [];
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        updatePeerStatus(userId, "connected");
        p2pFailCount.current[userId] = 0;
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
        try {
          pc.close();
        } catch {
        }
        delete peerConns.current[userId];
        delete dataChannels.current[userId];
        delete pendingIceCandidates.current[userId];
        if (connectionTimeouts.current[userId]) {
          clearTimeout(connectionTimeouts.current[userId]);
          delete connectionTimeouts.current[userId];
        }
        const userOnline = usersRef.current.some((u) => u.id === userId && u.isOnline);
        if (isOnlineRef.current && userOnline) {
          updatePeerStatus(userId, "reconnecting");
          const delay = 1e3 + Math.floor(Math.random() * 1e3);
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
          text: JSON.stringify(e.candidate)
        }) + "\n");
      } else if (!e.candidate) {
        console.log(`ICE gathering complete for ${userId}`);
      }
    };
    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state for ${userId}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === "failed") {
        console.warn(`ICE connection failed for ${userId}, attempting restart`);
        if (pc.connectionState !== "closed" && sessionId > userId) {
          setTimeout(() => {
            if (pc.connectionState !== "connected") {
              console.log(`Initiating ICE restart for ${userId}`);
              pc.restartIce();
            }
          }, 1e3);
        }
      }
    };
    pc.onicegatheringstatechange = () => {
      console.log(`ICE gathering state for ${userId}: ${pc.iceGatheringState}`);
    };
    pc.ondatachannel = (e) => setupDataChannel(userId, e.channel);
    if (initiate) {
      const channel = pc.createDataChannel("chat");
      setupDataChannel(userId, channel);
      pc.createOffer().then((o) => pc.setLocalDescription(o)).then(() => {
        if (wsRef.current && pc.localDescription) {
          wsRef.current.send(JSON.stringify({
            type: "offer",
            payload: userId,
            text: JSON.stringify(pc.localDescription)
          }) + "\n");
        }
      });
    }
  };
  const handleOffer = (userId, data) => {
    const existingPc = peerConns.current[userId];
    if (existingPc && existingPc.signalingState !== "stable") {
      console.warn(`Offer glare detected with ${userId}. Our state: ${existingPc.signalingState}`);
      if (sessionId < userId) {
        console.log(`Backing off from offer glare (our ID is lower)`);
        return;
      } else {
        console.log(`Proceeding with offer (their ID is lower), closing existing connection`);
        try {
          existingPc.close();
        } catch {
        }
        delete peerConns.current[userId];
        delete dataChannels.current[userId];
      }
    }
    createPeerConnection(userId, false);
    const pc = peerConns.current[userId];
    if (!pc) return;
    pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(data))).then(() => {
      processPendingCandidates(userId);
      return pc.createAnswer();
    }).then((a) => pc.setLocalDescription(a)).then(() => {
      if (wsRef.current && pc.localDescription) {
        wsRef.current.send(JSON.stringify({
          type: "answer",
          payload: userId,
          text: JSON.stringify(pc.localDescription)
        }) + "\n");
      }
    }).catch((err) => {
      console.error(`Failed to handle offer from ${userId}:`, err);
      updatePeerStatus(userId, "disconnected");
    });
  };
  const handleAnswer = (userId, data) => {
    const pc = peerConns.current[userId];
    if (pc && pc.signalingState === "have-local-offer") {
      pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(data))).then(() => {
        processPendingCandidates(userId);
      }).catch((err) => {
        console.error(`Failed to set remote description for ${userId}:`, err);
      });
    }
  };
  const handleCandidate = (userId, data) => {
    const pc = peerConns.current[userId];
    if (!pc) return;
    const candidate = JSON.parse(data);
    if (!pc.remoteDescription) {
      console.log(`Queueing ICE candidate for ${userId} (remote description not set)`);
      pendingIceCandidates.current[userId] = pendingIceCandidates.current[userId] || [];
      pendingIceCandidates.current[userId].push(candidate);
      return;
    }
    pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((err) => {
      console.error(`Failed to add ICE candidate for ${userId}:`, err);
    });
  };
  const processPendingCandidates = (userId) => {
    const pc = peerConns.current[userId];
    const pending = pendingIceCandidates.current[userId];
    if (!pc || !pending || pending.length === 0) return;
    console.log(`Processing ${pending.length} queued ICE candidates for ${userId}`);
    pending.forEach((candidate) => {
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((err) => {
        console.error(`Failed to add queued ICE candidate for ${userId}:`, err);
      });
    });
    pendingIceCandidates.current[userId] = [];
  };
  const ensureConnection = (userId) => {
    const channel = dataChannels.current[userId];
    if (!channel || channel.readyState !== "open") {
      if (isOnlineRef.current && usersRef.current.some((u) => u.id === userId && u.isOnline)) {
        createPeerConnection(userId);
      } else {
        updatePeerStatus(userId, "disconnected");
      }
      return false;
    }
    return true;
  };
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isOnlineRef.current) return;
      usersRef.current.forEach((u) => {
        if (u.id === sessionId || !u.isOnline) return;
        const pc = peerConns.current[u.id];
        const state = pc == null ? void 0 : pc.connectionState;
        if (!pc || state === "closed" || state === "failed" || state === "disconnected") {
          const shouldInitiate = sessionId > u.id;
          createPeerConnection(u.id, shouldInitiate);
        }
      });
    }, 2e3);
    return () => clearInterval(interval);
  }, [sessionId]);
  const handleSendMessage = (targetUser, text) => {
    if (!ensureConnection(targetUser)) {
      alert("Peer connection not established yet. Reconnecting...");
      return;
    }
    const channel = dataChannels.current[targetUser];
    const sanitized = sanitizeText(text);
    channel.send(JSON.stringify({ type: "text", text: sanitized }));
    const newMessage = {
      id: Date.now().toString(),
      text: sanitized,
      sender: sessionId,
      timestamp: /* @__PURE__ */ new Date()
    };
    setMessages((prev) => ({
      ...prev,
      [targetUser]: [...prev[targetUser] || [], newMessage]
    }));
  };
  const sendFileNow = async (targetUser, file) => {
    if (!ensureConnection(targetUser)) {
      alert("Peer connection not established yet. Reconnecting...");
      return;
    }
    const channel = dataChannels.current[targetUser];
    console.debug(`Preparing to send '${file.name}' (${file.size} B)`);
    const MAX_BUFFERED = 16 * 1024 * 1024;
    channel.bufferedAmountLowThreshold = 4 * 1024 * 1024;
    let sendTimeoutId = null;
    const resetSendTimeout = () => {
      if (sendTimeoutId) clearTimeout(sendTimeoutId);
      sendTimeoutId = window.setTimeout(() => {
        console.error(`File send timeout for ${targetUser} - no chunks sent in 2 minutes`);
        setSendProgress(null);
        setSendFileInfo(null);
        alert(`File transfer to ${targetUser} failed: Connection timeout (no data sent for 2 minutes)`);
      }, 12e4);
    };
    const clearSendTimeout = () => {
      if (sendTimeoutId) {
        clearTimeout(sendTimeoutId);
        sendTimeoutId = null;
      }
    };
    const waitForDrain = () => new Promise((resolve) => {
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
    channel.send(JSON.stringify({ type: "file-meta", filename: file.name, size: file.size }));
    setSendFileInfo({ name: file.name, size: file.size });
    let sent = 0;
    setSendProgress(0);
    resetSendTimeout();
    const reader = file.stream().getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      let offset = 0;
      while (offset < value.length) {
        const end = Math.min(offset + CHUNK_SIZE, value.length);
        const chunk = value.subarray(offset, end);
        while (channel.bufferedAmount + chunk.byteLength > MAX_BUFFERED) {
          await waitForDrain();
        }
        try {
          channel.send(chunk);
          resetSendTimeout();
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
        setSendProgress(Math.floor(sent / file.size * 100));
      }
    }
    clearSendTimeout();
    channel.send(JSON.stringify({ type: "file-end", filename: file.name }));
    setSendProgress(null);
    setSendFileInfo(null);
    const newMessage = {
      id: Date.now().toString(),
      text: "",
      sender: sessionId,
      timestamp: /* @__PURE__ */ new Date(),
      isFile: true,
      filename: file.name
    };
    setMessages((prev) => ({
      ...prev,
      [targetUser]: [...prev[targetUser] || [], newMessage]
    }));
  };
  const handleSendFile = (targetUser, file) => {
    if (allowedRecipients.current[targetUser]) {
      sendFileNow(targetUser, file);
      return;
    }
    if (!ensureConnection(targetUser)) {
      alert("Peer connection not established yet. Reconnecting...");
      return;
    }
    const channel = dataChannels.current[targetUser];
    pendingFiles.current[targetUser] = file;
    channel.send(JSON.stringify({ type: "file-offer", filename: file.name, size: file.size }));
  };
  useEffect(() => {
    const onOnline = () => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        const delay = 200 + Math.floor(Math.random() * 400);
        setTimeout(() => {
          var _a;
          try {
            (_a = wsRef.current) == null ? void 0 : _a.close();
          } catch {
          }
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
  return /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-rt-dark p-2 md:p-4", children: [
    /* @__PURE__ */ jsx("div", { className: "max-w-screen-xl mx-auto h-[calc(100vh-1rem)] md:h-[calc(100vh-2rem)] rounded-xl md:rounded-2xl overflow-hidden bg-rt-dark", children: /* @__PURE__ */ jsxs("div", { className: "flex h-full relative", children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => setSidebarOpen(!sidebarOpen),
          className: "md:hidden absolute top-3 left-4 z-50 w-8 h-8 bg-rt-card rounded-lg flex items-center justify-center text-white shadow-lg border border-rt-text-gray/30",
          children: /* @__PURE__ */ jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 6h16M4 12h16M4 18h16" }) })
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: `${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 fixed md:relative z-30 md:z-auto w-[280px] bg-rt-sidebar flex flex-col h-full transition-transform duration-300 ease-in-out`, children: [
        /* @__PURE__ */ jsxs("div", { className: "pr-4 pt-16 pb-4 md:p-6 border-b border-rt-card", children: [
          /* @__PURE__ */ jsx("div", { className: "flex items-center gap-3 pl-4 md:pl-0", children: /* @__PURE__ */ jsxs(
            "a",
            {
              href: "https://github.com/Hans2711/rt-share",
              target: "_blank",
              rel: "noopener noreferrer",
              className: "text-xl md:text-2xl font-bold text-white hover:text-rt-green transition-colors flex items-center gap-2",
              children: [
                "RT-Share",
                /* @__PURE__ */ jsx("svg", { className: "w-4 h-4 md:w-5 md:h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", children: /* @__PURE__ */ jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" }) })
              ]
            }
          ) }),
          /* @__PURE__ */ jsxs("p", { className: "text-rt-text-gray text-sm pl-4 md:pl-0 mt-2", children: [
            "Your ID: ",
            sessionId
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "p-4 md:p-6 flex-1", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-lg font-semibold text-white mb-4", children: "Users" }),
          /* @__PURE__ */ jsx("div", { className: "space-y-3", children: users.filter((u) => u.id !== sessionId).map((u) => {
            const connectionStatus = peerStatuses[u.id] || "disconnected";
            return /* @__PURE__ */ jsxs(
              "div",
              {
                onClick: () => {
                  selectUser(u.id);
                  setSidebarOpen(false);
                },
                className: `p-3 md:p-4 rounded-2xl cursor-pointer transition-colors ${selectedUser === u.id ? "bg-rt-card border border-rt-green" : "bg-rt-card hover:bg-rt-card/80"} ${!u.isOnline ? "opacity-50" : ""}`,
                children: [
                  /* @__PURE__ */ jsx("div", { className: "text-white font-medium text-sm md:text-base", children: u.id }),
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 mt-2", children: [
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center", children: [
                      /* @__PURE__ */ jsx("div", { className: `w-2 h-2 rounded-full mr-2 ${u.isOnline ? "bg-rt-green" : "bg-rt-text-dark"}` }),
                      /* @__PURE__ */ jsx("span", { className: "text-rt-text-gray text-xs", children: u.isOnline ? "Online" : "Offline" })
                    ] }),
                    u.isOnline && /* @__PURE__ */ jsxs("div", { className: "flex items-center", children: [
                      /* @__PURE__ */ jsx("div", { className: `w-2 h-2 rounded-full mr-2 ${connectionStatus === "connected" ? "bg-blue-500" : connectionStatus === "connecting" ? "bg-yellow-500" : connectionStatus === "reconnecting" ? "bg-orange-500" : "bg-rt-text-dark"}` }),
                      /* @__PURE__ */ jsx("span", { className: "text-rt-text-gray text-xs capitalize", children: connectionStatus === "connected" ? "Connected" : connectionStatus === "connecting" ? "Connecting" : connectionStatus === "reconnecting" ? "Reconnecting" : "Disconnected" })
                    ] })
                  ] })
                ]
              },
              u.id
            );
          }) }),
          /* @__PURE__ */ jsx("div", { className: "hidden md:block mt-6", children: /* @__PURE__ */ jsxs("label", { htmlFor: "localOnly", className: "flex items-center p-3 rounded-lg cursor-pointer hover:bg-rt-card/50 transition-colors", children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "checkbox",
                id: "localOnly",
                className: "w-4 h-4 rounded border-rt-text-gray bg-transparent checked:bg-rt-green focus:ring-rt-green mr-3"
              }
            ),
            /* @__PURE__ */ jsx("span", { className: "text-rt-text-light text-sm", children: "Local only" })
          ] }) })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "px-4 py-4 md:px-6 md:py-5 border-t border-rt-card", children: /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => {
              setShowHistory(true);
              setSidebarOpen(false);
            },
            className: "w-full bg-rt-card hover:bg-rt-card/80 text-white py-3 px-4 rounded-2xl font-semibold transition-colors flex items-center justify-center",
            children: "📁 Files"
          }
        ) })
      ] }),
      sidebarOpen && /* @__PURE__ */ jsx(
        "div",
        {
          className: "md:hidden fixed inset-0 bg-black/50 z-20",
          onClick: () => setSidebarOpen(false)
        }
      ),
      /* @__PURE__ */ jsx("div", { className: "flex-1 bg-rt-dark flex flex-col ml-0 md:ml-0", children: isConnecting ? /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center h-full text-rt-text-light", children: "Connecting..." }) : error ? /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center h-full text-red-400", children: /* @__PURE__ */ jsxs("p", { children: [
        "Error: ",
        error
      ] }) }) : /* @__PURE__ */ jsx(
        Chat,
        {
          currentUser: sessionId,
          targetUser: selectedUser,
          messages: selectedUser ? messages[selectedUser] || [] : [],
          sendInfo: { progress: sendProgress, filename: sendFileInfo == null ? void 0 : sendFileInfo.name, size: sendFileInfo == null ? void 0 : sendFileInfo.size },
          receiveInfo: { progress: receiveProgress, filename: receiveFileInfo == null ? void 0 : receiveFileInfo.name, size: receiveFileInfo == null ? void 0 : receiveFileInfo.size },
          connectionStatus: selectedUser ? peerStatuses[selectedUser] || "disconnected" : "disconnected",
          onSendMessage: selectedUser ? (text) => handleSendMessage(selectedUser, text) : () => {
          },
          onSendFile: selectedUser ? (file) => handleSendFile(selectedUser, file) : () => {
          },
          onShowHistory: () => setShowHistory(true)
        }
      ) })
    ] }) }),
    showHistory && /* @__PURE__ */ jsx(
      FileHistoryModal,
      {
        files: Object.entries(receivedFiles).flatMap(
          ([sender, fs]) => fs.map((f) => ({ ...f, sender }))
        ),
        onClose: () => setShowHistory(false)
      }
    )
  ] });
}
function meta({}) {
  return [{
    title: "Real-time Share"
  }, {
    name: "description",
    content: "Real-time file and text sharing"
  }];
}
const home = UNSAFE_withComponentProps(function Home() {
  return /* @__PURE__ */ jsx(RtShare, {});
});
const route1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: home,
  meta
}, Symbol.toStringTag, { value: "Module" }));
const serverManifest = { "entry": { "module": "/assets/entry.client-ClWNrGOZ.js", "imports": ["/assets/chunk-OIYGIGL5-DNcqb-aR.js"], "css": [] }, "routes": { "root": { "id": "root", "parentId": void 0, "path": "", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": true, "module": "/assets/root-DhyBHqtX.js", "imports": ["/assets/chunk-OIYGIGL5-DNcqb-aR.js"], "css": ["/assets/root-DTgKIvAR.css"], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/home": { "id": "routes/home", "parentId": "root", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/home-26tPzgVc.js", "imports": ["/assets/chunk-OIYGIGL5-DNcqb-aR.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 } }, "url": "/assets/manifest-60cc8311.js", "version": "60cc8311", "sri": void 0 };
const assetsBuildDirectory = "build/client";
const basename = "/";
const future = { "v8_middleware": false, "unstable_optimizeDeps": false, "unstable_splitRouteModules": false, "unstable_subResourceIntegrity": false, "unstable_viteEnvironmentApi": false };
const ssr = true;
const isSpaMode = false;
const prerender = [];
const routeDiscovery = { "mode": "lazy", "manifestPath": "/__manifest" };
const publicPath = "/";
const entry = { module: entryServer };
const routes = {
  "root": {
    id: "root",
    parentId: void 0,
    path: "",
    index: void 0,
    caseSensitive: void 0,
    module: route0
  },
  "routes/home": {
    id: "routes/home",
    parentId: "root",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route1
  }
};
export {
  serverManifest as assets,
  assetsBuildDirectory,
  basename,
  entry,
  future,
  isSpaMode,
  prerender,
  publicPath,
  routeDiscovery,
  routes,
  ssr
};
