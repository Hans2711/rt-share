import { jsx, jsxs } from "react/jsx-runtime";
import { PassThrough } from "node:stream";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter, useMatches, useActionData, useLoaderData, useParams, useRouteError, useNavigation, Meta, Links, ScrollRestoration, Scripts, Outlet, isRouteErrorResponse } from "react-router";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import { createElement, useState, useEffect, useRef } from "react";
const streamTimeout = 5e3;
function handleRequest(request, responseStatusCode, responseHeaders, routerContext, loadContext) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    let userAgent = request.headers.get("user-agent");
    let readyOption = userAgent && isbot(userAgent) || routerContext.isSpaMode ? "onAllReady" : "onShellReady";
    const { pipe, abort } = renderToPipeableStream(
      /* @__PURE__ */ jsx(ServerRouter, { context: routerContext, url: request.url }),
      {
        [readyOption]() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode
            })
          );
          pipe(body);
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
    setTimeout(abort, streamTimeout + 1e3);
  });
}
const entryServer = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: handleRequest,
  streamTimeout
}, Symbol.toStringTag, { value: "Module" }));
function withComponentProps(Component) {
  return function Wrapped() {
    const props = {
      params: useParams(),
      loaderData: useLoaderData(),
      actionData: useActionData(),
      matches: useMatches()
    };
    return createElement(Component, props);
  };
}
function withErrorBoundaryProps(ErrorBoundary3) {
  return function Wrapped() {
    const props = {
      params: useParams(),
      loaderData: useLoaderData(),
      actionData: useActionData(),
      error: useRouteError()
    };
    return createElement(ErrorBoundary3, props);
  };
}
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
const root = withComponentProps(function App() {
  return /* @__PURE__ */ jsx(Outlet, {});
});
const ErrorBoundary = withErrorBoundaryProps(function ErrorBoundary2({
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
function generateSessionId() {
  return Math.floor(1e4 + Math.random() * 9e4).toString();
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
  const handleSendMessage = () => {
    const text = messageInput.trim();
    if (!targetUser || !text) return;
    console.log(text);
    onSendMessage(text);
    setMessageInput("");
  };
  const handleFileChange = (e) => {
    var _a;
    const file = (_a = e.target.files) == null ? void 0 : _a[0];
    if (!targetUser || !file) return;
    console.log("Sending File", file);
    onSendFile(file);
    e.target.value = "";
  };
  const indicatorColor = connectionStatus === "connected" ? "text-green-500 dark:text-green-600" : connectionStatus === "connecting" || connectionStatus === "reconnecting" ? "text-amber-500 dark:text-amber-600" : "text-red-700 dark:text-red-800";
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col h-full bg-gray-100 dark:bg-gray-800", children: [
    /* @__PURE__ */ jsxs("h2", { className: "p-3 m-0 bg-gray-100 border-b border-gray-300 dark:bg-gray-700 dark:border-gray-800", children: [
      targetUser ? `Chat with ${targetUser}` : "Chat",
      targetUser && /* @__PURE__ */ jsx("span", { className: `ml-2 text-sm ${indicatorColor}`, children: connectionStatus === "connected" ? "Connected" : connectionStatus === "reconnecting" ? "Reconnecting..." : connectionStatus === "connecting" ? "Connecting..." : "Disconnected" })
    ] }),
    /* @__PURE__ */ jsx("hr", {}),
    sendInfo.progress !== null && /* @__PURE__ */ jsxs("div", { className: "p-2", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        "Sending ",
        sendInfo.filename,
        " (",
        sendInfo.size ? formatBytes(sendInfo.size) : "",
        ")… ",
        sendInfo.progress,
        "%"
      ] }),
      /* @__PURE__ */ jsx("progress", { value: sendInfo.progress ?? 0, max: 100, className: "w-full" })
    ] }),
    receiveInfo.progress !== null && /* @__PURE__ */ jsxs("div", { className: "p-2", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        "Receiving ",
        receiveInfo.filename,
        " (",
        receiveInfo.size ? formatBytes(receiveInfo.size) : "",
        ")… ",
        receiveInfo.progress,
        "%"
      ] }),
      /* @__PURE__ */ jsx("progress", { value: receiveInfo.progress ?? 0, max: 100, className: "w-full" })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "flex-1 p-4 overflow-y-auto dark:bg-gray-800", children: targetUser ? messages.map((message) => /* @__PURE__ */ jsxs(
      "div",
      {
        className: `mb-2 p-2 rounded-lg max-w-[70%] break-words ${message.sender === currentUser ? "bg-green-500/20 ml-auto dark:bg-green-600 dark:text-white" : "bg-white mr-auto dark:bg-gray-700 dark:text-gray-300"}`,
        children: [
          /* @__PURE__ */ jsx("div", { className: "text-xs text-gray-500 mb-1 dark:text-gray-300", children: message.sender === currentUser ? "You" : message.sender }),
          message.isFile ? /* @__PURE__ */ jsx("div", { className: "file-message", children: message.filename }) : /* @__PURE__ */ jsx("div", { className: "text-message", children: message.text })
        ]
      },
      message.id
    )) : /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center h-full text-gray-500 dark:text-gray-300", children: /* @__PURE__ */ jsx("p", { children: "Select a user to start chatting" }) }) }),
    /* @__PURE__ */ jsx("div", { className: "p-2 flex flex-col gap-2 bg-gray-100 dark:bg-gray-700 md:p-4 md:gap-3", children: /* @__PURE__ */ jsxs("div", { className: "flex gap-2 md:gap-3", children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "text",
          value: messageInput,
          onChange: (e) => setMessageInput(e.target.value),
          onKeyPress: (e) => e.key === "Enter" && handleSendMessage(),
          placeholder: "Type a message...",
          className: "flex-1 p-2 text-sm border border-gray-300 rounded dark:bg-gray-700 dark:text-gray-300 dark:border-gray-800",
          disabled: !targetUser
        }
      ),
      /* @__PURE__ */ jsx("button", { onClick: handleSendMessage, disabled: !targetUser, className: "px-3 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600 dark:bg-green-600 disabled:opacity-50", children: "Send" }),
      /* @__PURE__ */ jsxs("div", { className: "relative", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex h-full", children: [
          /* @__PURE__ */ jsx(
            "label",
            {
              htmlFor: "file",
              className: `px-3 py-2 text-sm bg-green-500 text-white rounded-l cursor-pointer hover:bg-green-600 dark:bg-green-600 ${!targetUser ? "opacity-50 pointer-events-none" : ""}`,
              children: "Send File"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => setMenuOpen((v) => !v),
              className: "px-2 py-2 text-sm bg-green-500 text-white rounded-r hover:bg-green-600 dark:bg-green-600",
              children: "▲"
            }
          )
        ] }),
        menuOpen && /* @__PURE__ */ jsx("div", { className: "absolute bottom-full mb-2 right-0 bg-white border border-gray-300 rounded shadow-md dark:bg-gray-700 dark:border-gray-600", children: /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => {
              setMenuOpen(false);
              onShowHistory();
            },
            className: "block px-4 py-2 text-sm w-full text-left hover:bg-gray-100 dark:hover:bg-gray-600",
            children: "File History"
          }
        ) })
      ] }),
      /* @__PURE__ */ jsx("input", { type: "file", name: "file", id: "file", onChange: handleFileChange, className: "hidden" })
    ] }) })
  ] });
}
function getNetworkPrefix(ip) {
  if (ip == "localhost") return ip;
  const parts = ip.split(".");
  return parts.length === 4 ? parts.slice(0, 3).join(".") : null;
}
function UserList({ users, currentUser, selectedUser, isOnline, onSelect }) {
  var _a;
  const [localOnly, setLocalOnly] = useState(false);
  const myIp = (_a = users.find((u) => u.id === currentUser)) == null ? void 0 : _a.ip;
  const myNetwork = myIp ? getNetworkPrefix(myIp) : null;
  const heading = !isOnline ? "Waiting for Connection" : users.filter((u) => u.id !== currentUser).length === 0 ? "No Users" : `Users (You are ${currentUser})`;
  return /* @__PURE__ */ jsxs("div", { className: "relative w-full bg-gray-100 border-b border-gray-300 overflow-y-auto md:w-[250px] md:border-b-0 md:border-r dark:bg-gray-800 dark:border-gray-800 ", children: [
    /* @__PURE__ */ jsx("h2", { className: "p-3 m-0 bg-gray-100 border-b border-gray-300 dark:bg-gray-700 dark:border-gray-100", children: heading }),
    /* @__PURE__ */ jsxs("label", { className: "border-b border-gray-300 w-full p-3 dark:border-gray-100 flex items-center justify-between gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700", children: [
      /* @__PURE__ */ jsx("span", { children: "Local Only" }),
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "checkbox",
          checked: localOnly,
          onChange: () => setLocalOnly((v) => !v),
          className: "form-checkbox h-5 w-5 text-blue-600"
        }
      )
    ] }),
    /* @__PURE__ */ jsx("ul", { className: "list-none p-0 m-0", children: users.filter((u) => u.id !== currentUser).filter((u) => {
      if (!localOnly) return true;
      const otherNetwork = getNetworkPrefix(u.ip);
      return myNetwork !== null && otherNetwork === myNetwork;
    }).map((u) => /* @__PURE__ */ jsxs(
      "li",
      {
        className: `p-3 cursor-pointer border-b border-gray-300 hover:bg-gray-100 dark:border-gray-100 dark:hover:bg-gray-700 ${selectedUser === u.id ? "bg-gray-300 font-bold dark:bg-gray-700 dark:text-gray-100" : ""} ${!u.isOnline ? "opacity-50" : ""}`,
        onClick: () => onSelect(u.id),
        children: [
          u.id,
          " ",
          !u.isOnline && "(Offline)"
        ]
      },
      u.id
    )) })
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
  return /* @__PURE__ */ jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: /* @__PURE__ */ jsxs("div", { className: "bg-white dark:bg-gray-800 rounded shadow w-full max-w-sm max-h-full overflow-y-auto p-4", children: [
    /* @__PURE__ */ jsx("h2", { className: "text-lg font-bold mb-2", children: "Received Files" }),
    files.length === 0 ? /* @__PURE__ */ jsx("p", { className: "text-sm", children: "No files yet." }) : /* @__PURE__ */ jsx("ul", { className: "divide-y divide-gray-300 dark:divide-gray-700", children: files.map((f, i) => /* @__PURE__ */ jsxs("li", { className: "py-2 flex items-center justify-between gap-2", children: [
      /* @__PURE__ */ jsxs("span", { className: "text-sm break-all flex-1", children: [
        f.sender ? `${f.sender}: ` : "",
        f.filename
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => handleDownload(f),
          className: "px-2 py-1 text-xs bg-green-500 text-white rounded",
          children: "Download"
        }
      )
    ] }, i)) }),
    /* @__PURE__ */ jsx(
      "button",
      {
        onClick: onClose,
        className: "mt-4 w-full px-3 py-2 text-sm bg-gray-200 rounded dark:bg-gray-700 dark:text-gray-200",
        children: "Close"
      }
    )
  ] }) });
}
function RtShare() {
  const [sessionId, setSessionId] = useState("");
  const wsRef = useRef(null);
  const peerConns = useRef({});
  const dataChannels = useRef({});
  const p2pFailCount = useRef(0);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef(null);
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
    peerConns.current = {};
    dataChannels.current = {};
    setPeerStatuses({});
  };
  const selectUser = (uid) => {
    setSelectedUser(uid);
    const userOnline = usersRef.current.some((u) => u.id === uid && u.isOnline);
    if (!isOnlineRef.current || !userOnline) {
      updatePeerStatus(uid, "disconnected");
      return;
    }
    updatePeerStatus(uid, "connecting");
    const shouldInitiate = sessionId > uid;
    createPeerConnection(uid, shouldInitiate);
  };
  useEffect(() => {
    let storedSessionId = localStorage.getItem("sessionId");
    if (!storedSessionId) {
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
        socket.send(JSON.stringify({ type: "join", payload: storedSessionId }) + "\n");
      };
      socket.addEventListener("error", (event) => {
        setError("WebSocket connection error " + event);
        setIsOnline(false);
      });
      socket.onclose = () => {
        setIsOnline(false);
        cleanupPeerConnections();
        scheduleReconnect();
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
    return () => {
      clearReconnectTimer();
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
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" }
      ]
    });
    peerConns.current[userId] = pc;
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        updatePeerStatus(userId, "connected");
      } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        p2pFailCount.current += 1;
        if (p2pFailCount.current >= 10) {
          window.location.reload();
          return;
        }
        console.warn("Peer connection dropped", userId);
        try {
          pc.close();
        } catch {
        }
        delete peerConns.current[userId];
        delete dataChannels.current[userId];
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
      }
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
    createPeerConnection(userId, false);
    const pc = peerConns.current[userId];
    if (!pc || pc.signalingState !== "stable") {
      console.warn("Ignoring unexpected offer in state", pc == null ? void 0 : pc.signalingState);
      return;
    }
    pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(data))).then(() => pc.createAnswer()).then((a) => pc.setLocalDescription(a)).then(() => {
      if (wsRef.current && pc.localDescription) {
        wsRef.current.send(JSON.stringify({
          type: "answer",
          payload: userId,
          text: JSON.stringify(pc.localDescription)
        }) + "\n");
      }
    });
  };
  const handleAnswer = (userId, data) => {
    const pc = peerConns.current[userId];
    if (pc && pc.signalingState === "have-local-offer") {
      pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(data)));
    }
  };
  const handleCandidate = (userId, data) => {
    const pc = peerConns.current[userId];
    if (pc) pc.addIceCandidate(new RTCIceCandidate(JSON.parse(data)));
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
        } catch (err) {
          console.error("Failed to send chunk:", err);
          alert("File transfer aborted.");
          setSendProgress(null);
          return;
        }
        offset = end;
        sent += chunk.byteLength;
        setSendProgress(Math.floor(sent / file.size * 100));
      }
    }
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
  return /* @__PURE__ */ jsxs("div", { className: "p-2 md:p-5 max-w-screen-xl mx-auto h-screen overflow-hidden", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-col h-full border border-gray-300 rounded-lg overflow-hidden md:flex-row md:h-[80vh] dark:border-gray-800", children: [
      /* @__PURE__ */ jsx(
        UserList,
        {
          users,
          currentUser: sessionId,
          selectedUser,
          isOnline,
          onSelect: selectUser
        }
      ),
      /* @__PURE__ */ jsx("div", { className: "flex flex-col flex-1 min-h-[60vh] overflow-y-auto", children: isConnecting ? /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center h-full text-gray-500 dark:text-gray-300", children: "Connecting..." }) : error ? /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center h-full text-red-700 dark:text-red-800", children: /* @__PURE__ */ jsxs("p", { children: [
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
    ] }),
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
const home = withComponentProps(function Home() {
  return /* @__PURE__ */ jsx(RtShare, {});
});
const route1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: home,
  meta
}, Symbol.toStringTag, { value: "Module" }));
const serverManifest = { "entry": { "module": "/assets/entry.client-CQuZlVIP.js", "imports": ["/assets/chunk-D4RADZKF-l-Tz34VA.js"], "css": [] }, "routes": { "root": { "id": "root", "parentId": void 0, "path": "", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": true, "module": "/assets/root-BLXRHPAJ.js", "imports": ["/assets/chunk-D4RADZKF-l-Tz34VA.js", "/assets/with-props-DB8Vr4zk.js"], "css": ["/assets/root-M3cUTNjT.css"], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/home": { "id": "routes/home", "parentId": "root", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/home-KbfvnE9q.js", "imports": ["/assets/with-props-DB8Vr4zk.js", "/assets/chunk-D4RADZKF-l-Tz34VA.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 } }, "url": "/assets/manifest-487feedd.js", "version": "487feedd", "sri": void 0 };
const assetsBuildDirectory = "build/client";
const basename = "/";
const future = { "unstable_middleware": false, "unstable_optimizeDeps": false, "unstable_splitRouteModules": false, "unstable_subResourceIntegrity": false, "unstable_viteEnvironmentApi": false };
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
