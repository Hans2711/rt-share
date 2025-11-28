# RT Share

RT Share is a peer-to-peer file and text sharing application that pairs a WebSocket signaling hub with WebRTC data channels. Browsers discover each other through the lobby, negotiate their own connections, and then stream text or files directly without routing payloads through the server.

## Real-time Signaling (WebSocket)

- Live lobby presence broadcasts announce when participants join, leave, or change status in real time.
- Heartbeat pings keep signaling sessions warm and enable rapid detection of stalled or dropped sockets.
- Automatic reconnection logic resubscribes users to the lobby so short network blips do not interrupt negotiations.

## Peer-to-Peer Data Channels (WebRTC)

- Built-in signaling exchanges SDP and ICE candidates so browsers can promote the connection to a WebRTC data channel without external services.
- Low-latency text messaging rides the data channel once the handshake finishes, bypassing the server entirely.
- Chunked file streaming applies back-pressure and progress tracking to move large assets reliably between peers.

## Collaboration Safeguards

- Local history keeps an offline catalog of received files so they can be downloaded again later.
- A network filter can limit the lobby view to peers on the same subnet for controlled sharing sessions.
- Connection health indicators surface presence, offline states, and recovery attempts to keep participants informed.

## Architecture Snapshot

- The `rt-share-web` server terminates HTTPS, serves the React Router interface (including SSR responses), and hosts the `/ws` signaling endpoint.
- WebSocket messages carry lobby state, room invitations, and WebRTC negotiation payloads.
- Once peers connect, WebRTC data channels take over for payload transfer while the WebSocket remains available for control signals.

## Server TLS Configuration

- Place a `config.json` in the project root (same folder as this README). See `config.example.json` for all supported fields.
- Supported key layouts:
  - `everything_file`: single PEM containing private key + certificate + chain (e.g. `ssl.everything`).
  - `combined_file` + `key_file`: certificate + chain in one PEM and a separate private key (e.g. `ssl.combined` and `ssl.key`).
  - `cert_file` + `key_file`: standard separate certificate and private key; optionally add `ca_file` to append intermediates.
- Optional: `address` (default `:3000`) and `min_version` (`1.2` or `1.3`).
- At runtime the server looks for the config at `./config.json`, `../config.json`, or a path specified via `RT_SHARE_CONFIG` or `RTS_CONFIG`.

## Running the App

- **Development (two terminals):**
  - Terminal A: `cd rt-share-web && npm run dev` — Vite serves the React UI and proxies WebSocket upgrades to the signaling backend.
  - Terminal B: `cd rt-share-web && npm run dev:server` — starts the HTTP WebSocket signaling server on `ws://localhost:3000` (no TLS/config required for local development).
- **Production:**
  - `cd rt-share-web && npm run build`
  - `cd rt-share-web && npm start`
  - The HTTPS server serves SSR responses, static assets, and upgrades `/ws` requests to the signaling channel.

## Further Reading

See `rt-share-web/README.md` for template-specific commands and deployment guidance.
