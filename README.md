# RT Share

RT Share is a peer-to-peer file and text sharing application. It now uses a Bun-powered HTTPS server with built‑in WebSocket signaling and a React Router based front‑end that establishes direct WebRTC connections between browsers.

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
- Bun HTTPS server (ESM)
- WebSocket signaling implemented with `Bun.serve`
- Secure TLS support driven by Bun's native TLS options

### Web Client
- React Router with server‑side rendering enabled
- TypeScript and Vite
- WebRTC for peer connections
- Tailwind CSS for styling

---

See [`rt-share-web/README.md`](rt-share-web/README.md) for details on running the app.

## Server TLS configuration

- Place a `config.json` in the project root (same folder as this README). See `config.example.json` for all supported fields.
- Supported key layouts:
  - `everything_file`: single PEM containing private key + certificate + chain (e.g. `ssl.everything`).
  - `combined_file` + `key_file`: certificate + chain in one PEM and a separate private key (e.g. `ssl.combined` and `ssl.key`).
  - `cert_file` + `key_file`: standard separate certificate and private key; optionally add `ca_file` to append intermediates.
- Optional: `address` (default `:3000`) and `min_version` (`1.2` or `1.3`).

At runtime the server looks for the config at `./config.json`, `../config.json`, or a path specified via `RT_SHARE_CONFIG` or `RTS_CONFIG`.

## Running

- Development (2 terminals):
  - Terminal A: `cd rt-share-web && bun install && bun run dev` (Vite dev server)
  - Terminal B: `cd rt-share-web && bun run dev:server` (plain HTTP WS signaling on `ws://localhost:3000` — no TLS/config needed)
  - The dev server proxies WebSocket upgrades from `/ws` to the signaling server.
- Production:
  - `cd rt-share-web && bun install`
  - `cd rt-share-web && bun run build`
  - `cd rt-share-web && bun run start`
  - The HTTPS server serves SSR responses and handles WebSocket upgrades on `/ws`.
