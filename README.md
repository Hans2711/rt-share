# RT Share

RT Share is a peer-to-peer file and text sharing application. It consists of a Go WebSocket server used for signalling and a React Router based front‑end that establishes direct WebRTC connections between browsers.

## Features

- **Real‑time user presence** – users join and leave the lobby via WebSocket and can see who is online.
- **Peer‑to‑peer messaging** – after the initial handshake users communicate directly over WebRTC data channels.
- **File transfer with streaming** – large files are sent in chunks with back‑pressure handling and progress indicators.
- **Heartbeat pings** – periodic messages keep WebSocket sessions alive.
- **Local history** – received files are stored in the browser so they can be downloaded again later.
- **Network filter** – users can limit the list to peers on the same local network.
- **Offline/online detection** – the UI reacts to connection loss and automatically attempts reconnection.

## Technologies Used

### Server
- Go 1.24
- `golang.org/x/net/websocket` for WebSocket handling
- Secure TLS support for production (`ListenAndServeTLS`)

### Web Client
- React Router with server‑side rendering disabled
- TypeScript and Vite
- WebRTC for peer connections
- Tailwind CSS for styling

---

See [`rt-share-web/README.md`](rt-share-web/README.md) for details on running the front‑end.
