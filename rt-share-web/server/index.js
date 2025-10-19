// Node HTTPS server with SSR + minimal WebSocket signaling
// ESM file (package.json has type: module)

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequestListener } from '@react-router/node';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve project layout
const WEB_DIR = path.resolve(__dirname, '..');
const BUILD_SERVER_PATH = path.resolve(WEB_DIR, 'build/server/index.js');
const BUILD_CLIENT_DIR = path.resolve(WEB_DIR, 'build/client');

// TLS/Config helpers (ported semantics from Go)
async function readJSON(file) {
  const buf = await fsp.readFile(file);
  return JSON.parse(String(buf));
}

function resolvePath(baseDir, p) {
  if (!p) return '';
  return path.isAbsolute(p) ? p : path.resolve(baseDir, p);
}

async function loadConfig() {
  const envPath = process.env.RT_SHARE_CONFIG || process.env.RTS_CONFIG;
  const candidates = [];
  if (envPath) candidates.push(envPath);
  // CWD + parent + alongside this file
  const cwd = process.cwd();
  candidates.push(path.resolve(cwd, 'config.json'));
  candidates.push(path.resolve(cwd, '..', 'config.json'));
  candidates.push(path.resolve(__dirname, 'config.json'));
  candidates.push(path.resolve(__dirname, '..', 'config.json'));
  candidates.push(path.resolve(__dirname, '..', '..', 'config.json'));
  for (const p of candidates) {
    try {
      await fsp.access(p, fs.constants.R_OK);
      const cfg = await readJSON(p);
      return { cfg, cfgPath: p };
    } catch {}
  }
  throw new Error(`config.json not found; checked: ${candidates.join(', ')}`);
}

function minVersionTag(s) {
  return s && String(s).includes('1.3') ? 'TLSv1.3' : 'TLSv1.2';
}

function parsePEMBlocks(pemData) {
  // Return { certs: string, key: string|null }
  const text = String(pemData);
  const blocks = text.split(/-----END [^-]+-----/g);
  let certs = '';
  let key = null;
  let idx = 0;
  for (const chunk of blocks) {
    if (!chunk.trim()) continue;
    const endMarker = '-----END ';
    // Re-attach the END marker we split on
    const endStart = text.indexOf(endMarker, idx);
    if (endStart === -1) break;
    const endClose = text.indexOf('-----', endStart + endMarker.length);
    const type = text.slice(endStart + endMarker.length, endClose).trim();
    const beginStart = text.lastIndexOf('-----BEGIN ', endStart);
    const beginClose = text.indexOf('-----', beginStart + '-----BEGIN '.length);
    const block = text.slice(beginStart, endClose + 5); // include trailing -----
    idx = endClose + 5;
    if (/PRIVATE KEY/.test(type) && key == null) {
      key = block + '\n';
    } else if (/CERTIFICATE/.test(type)) {
      certs += block + '\n';
    }
  }
  return { certs, key };
}

async function buildTlsOptions(baseDir, t) {
  if (!t) throw new Error('Missing tls config');
  const opts = {
    minVersion: minVersionTag(t.min_version),
  };
  if (t.everything_file) {
    const everything = await fsp.readFile(resolvePath(baseDir, t.everything_file));
    const { certs, key } = parsePEMBlocks(everything);
    if (!key || !certs) throw new Error('everything_file missing key or certs');
    opts.key = key;
    if (t.ca_file) {
      const ca = await fsp.readFile(resolvePath(baseDir, t.ca_file), 'utf8');
      opts.cert = certs + '\n' + ca;
    } else {
      opts.cert = certs;
    }
  } else if ((t.combined_file && t.key_file) || (t.cert_file && t.key_file)) {
    const certSrc = t.combined_file || t.cert_file;
    opts.cert = await fsp.readFile(resolvePath(baseDir, certSrc), 'utf8');
    opts.key = await fsp.readFile(resolvePath(baseDir, t.key_file), 'utf8');
    if (t.ca_file) {
      const ca = await fsp.readFile(resolvePath(baseDir, t.ca_file), 'utf8');
      opts.cert += '\n' + ca;
    }
  } else {
    throw new Error('invalid TLS configuration: set either everything_file, or combined_file+key_file, or cert_file+key_file');
  }
  return opts;
}

function parseAddress(addr) {
  if (!addr || addr === ':' || addr === '') return { host: '0.0.0.0', port: 3000 };
  if (addr.startsWith(':')) {
    const port = Number(addr.slice(1)) || 3000;
    return { host: '0.0.0.0', port };
  }
  // basic host:port (non-IPv6) parser
  const lastColon = addr.lastIndexOf(':');
  if (lastColon > 0) {
    const host = addr.slice(0, lastColon);
    const port = Number(addr.slice(lastColon + 1)) || 3000;
    return { host, port };
  }
  const port = Number(addr) || 3000;
  return { host: '0.0.0.0', port };
}

// Static file serve from build/client
function contentTypeFor(file) {
  const ext = path.extname(file).toLowerCase();
  switch (ext) {
    case '.js': return 'application/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.svg': return 'image/svg+xml';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.webp': return 'image/webp';
    case '.ico': return 'image/x-icon';
    case '.json': return 'application/json; charset=utf-8';
    default: return 'application/octet-stream';
  }
}

async function tryServeStatic(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  const url = new URL(req.url, `https://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);
  if (!pathname.startsWith('/assets/') && pathname !== '/favicon.ico') return false;
  const rel = pathname.replace(/^\/+/, '');
  const abs = path.join(BUILD_CLIENT_DIR, rel);
  if (!abs.startsWith(BUILD_CLIENT_DIR)) {
    res.statusCode = 403; res.end('Forbidden'); return true;
  }
  try {
    const st = await fsp.stat(abs);
    if (!st.isFile()) return false;
    res.setHeader('Content-Type', contentTypeFor(abs));
    if (pathname.startsWith('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    if (req.method === 'HEAD') { res.statusCode = 200; res.end(); return true; }
    fs.createReadStream(abs).pipe(res);
    return true;
  } catch {
    return false;
  }
}

// Minimal WebSocket implementation (server side)
class WSConn {
  constructor(socket) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.alive = true;
    socket.on('data', (chunk) => this._onData(chunk));
    socket.on('close', () => { this.alive = false; this.onclose?.(); });
    socket.on('error', () => { this.alive = false; this.onclose?.(); });
  }
  sendText(text) {
    if (!this.alive) return;
    const payload = Buffer.from(text);
    const len = payload.length;
    let header;
    if (len < 126) {
      header = Buffer.alloc(2);
      header[0] = 0x81; // FIN + text
      header[1] = len;  // no mask from server
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 127;
      // write 64-bit length (only high 32 and low 32)
      header.writeUInt32BE(Math.floor(len / 2 ** 32), 2);
      header.writeUInt32BE(len >>> 0, 6);
    }
    this.socket.write(header);
    this.socket.write(payload);
  }
  sendJSON(obj) {
    this.sendText(JSON.stringify(obj) + '\n');
  }
  close() {
    try { this.socket.end(); } catch {}
    this.alive = false;
  }
  _onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      if (this.buffer.length < 2) return;
      const b0 = this.buffer[0];
      const b1 = this.buffer[1];
      const fin = (b0 & 0x80) !== 0;
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let off = 2;
      if (len === 126) {
        if (this.buffer.length < 4) return;
        len = this.buffer.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (this.buffer.length < 10) return;
        const high = this.buffer.readUInt32BE(2);
        const low = this.buffer.readUInt32BE(6);
        len = high * 2 ** 32 + low;
        off = 10;
      }
      const need = off + (masked ? 4 : 0) + len;
      if (this.buffer.length < need) return;
      let mask;
      if (masked) {
        mask = this.buffer.slice(off, off + 4);
        off += 4;
      }
      let payload = this.buffer.slice(off, off + len);
      this.buffer = this.buffer.slice(need);
      if (masked && len > 0) {
        // unmask
        for (let i = 0; i < payload.length; i++) {
          payload[i] ^= mask[i % 4];
        }
      }
      if (!fin) continue; // ignore fragmented for simplicity
      if (opcode === 0x8) { // close
        this.close();
        return;
      } else if (opcode === 0x9) { // ping -> pong
        // respond pong with same payload
        const pongHdr = Buffer.from([0x8a, payload.length]);
        this.socket.write(pongHdr);
        if (payload.length) this.socket.write(payload);
      } else if (opcode === 0x1) { // text
        const text = payload.toString('utf8');
        this.onmessage?.(text);
      }
    }
  }
}

function getClientIP(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) {
    return fwd.split(',')[0].trim();
  }
  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real.length) return real.trim();
  return req.socket.remoteAddress || '';
}

class SignalServer {
  constructor() {
    this.conns = new Set();
    this.users = new Map(); // userId -> WSConn
    this.connIPs = new WeakMap(); // WSConn -> IP
  }
  addConn(req, conn) {
    this.conns.add(conn);
    this.connIPs.set(conn, getClientIP(req));
    conn.onclose = () => this.removeConn(conn);
    conn.onmessage = (text) => this._onText(conn, text);
  }
  removeConn(conn) {
    if (!this.conns.has(conn)) return;
    this.conns.delete(conn);
    // remove user mapping if any
    let leftUser = null;
    for (const [id, c] of this.users.entries()) {
      if (c === conn) { this.users.delete(id); leftUser = id; break; }
    }
    conn.close();
    if (leftUser) {
      this.broadcast({ type: 'leave', status: 'userLeft', message: `User ${leftUser} left`, data: leftUser });
    }
  }
  getUserConn(userId) { return this.users.get(userId) || null; }
  getSenderUID(conn) {
    for (const [id, c] of this.users.entries()) if (c === conn) return id; return '';
  }
  getAllUserInfoJSON() {
    const list = [];
    for (const [id, c] of this.users.entries()) {
      list.push({ id, ip: this.connIPs.get(c) || '' });
    }
    return JSON.stringify(list);
  }
  broadcast(obj) {
    const json = JSON.stringify(obj) + '\n';
    for (const c of this.conns) {
      try { c.sendText(json); } catch {}
    }
  }
  _onText(conn, text) {
    // Allow newline-delimited JSON payloads
    const parts = text.split('\n').filter(Boolean);
    for (const part of parts) {
      let msg;
      try { msg = JSON.parse(part); } catch { continue; }
      this._handleMessage(conn, msg);
    }
  }
  _handleMessage(conn, r) {
    const type = r?.type;
    if (!type) return;
    if (type === 'join') {
      const userID = r.payload;
      this.users.set(userID, conn);
      const ip = this.connIPs.get(conn) || '';
      this.broadcast({ type: 'join', status: 'userJoin', message: `User ${userID} joined`, data: userID, ip });
      conn.sendJSON({ type: 'join', status: 'ok', message: `User ${userID} joined`, data: this.getAllUserInfoJSON() });
      return;
    }
    if (type === 'leave') {
      const userID = r.payload;
      const c = this.getUserConn(userID);
      if (c && c === conn) {
        this.removeConn(c);
      }
      conn.sendJSON({ type: 'leave', status: 'ok', message: 'Left', data: this.getAllUserInfoJSON() });
      return;
    }
    if (type === 'offer' || type === 'answer' || type === 'candidate') {
      const targetID = r.payload;
      const c = this.getUserConn(targetID);
      if (!c) {
        conn.sendJSON({ type, status: 'error', message: 'User not found' });
        return;
      }
      const senderID = this.getSenderUID(conn);
      try {
        c.sendJSON({ type, status: 'forward', data: r.text, sender: senderID });
        conn.sendJSON({ type, status: 'ok', message: 'forwarded' });
      } catch {
        this.removeConn(c);
        conn.sendJSON({ type, status: 'error', message: 'forward failed' });
      }
      return;
    }
    // unknown
    conn.sendJSON({ type, status: 'error', message: `Unknown type: ${type}`, data: '' });
  }
  sendHeartbeat() {
    this.broadcast({ type: 'heartbeat', status: 'ping' });
  }
}

function performWebSocketHandshake(req, socket) {
  const key = req.headers['sec-websocket-key'];
  const upgrade = (req.headers['upgrade'] || '').toString().toLowerCase();
  const connection = (req.headers['connection'] || '').toString().toLowerCase();
  if (!key || !upgrade.includes('websocket') || !connection.includes('upgrade')) {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    socket.destroy();
    return null;
  }
  const accept = crypto.createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');
  const headers = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`,
    '\r\n',
  ].join('\r\n');
  socket.write(headers);
  return new WSConn(socket);
}

async function main() {
  const isDevPlain = process.env.RT_PLAIN_WS === '1' || (process.env.NODE_ENV || 'development') === 'development';

  let server;
  let proto;
  let host = '0.0.0.0';
  let port = 3000;
  let requestHandler = null;

  if (isDevPlain) {
    // Dev: plain HTTP, WS only; ignore TLS/config.
    server = http.createServer((req, res) => {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Dev signaling server: use Vite dev server for the app.');
    });
    proto = 'http';
  } else {
    // Prod: HTTPS server with TLS + SSR + static assets
    const { cfg, cfgPath } = await loadConfig();
    const cfgDir = path.dirname(cfgPath);
    const tlsOpts = await buildTlsOptions(cfgDir, cfg.tls);
    ({ host, port } = parseAddress(cfg.tls?.address || ':3000'));

    try {
      const build = await import(pathToFileURL(BUILD_SERVER_PATH).href);
      requestHandler = createRequestListener({ build, mode: process.env.NODE_ENV || 'production' });
    } catch (err) {
      console.error('Could not load SSR server build at', BUILD_SERVER_PATH);
      console.error('Did you run `npm run build` in rt-share-web?');
      throw err;
    }

    server = https.createServer(tlsOpts);
    proto = 'https';

    server.on('request', async (req, res) => {
      try {
        if (await tryServeStatic(req, res)) return;
        if (requestHandler) return requestHandler(req, res);
        res.statusCode = 503; res.setHeader('Content-Type', 'text/plain'); res.end('SSR not available');
      } catch (err) {
        console.error('Request error:', err);
        if (!res.headersSent) {
          res.statusCode = 500; res.setHeader('Content-Type', 'text/plain'); res.end('Internal Server Error');
        } else {
          try { res.end(); } catch {}
        }
      }
    });
  }

  // WebSocket signaling (common)
  const signals = new SignalServer();
  server.on('upgrade', (req, socket, head) => {
    try {
      const url = new URL(req.url, `${proto}://${req.headers.host}`);
      if (url.pathname !== '/ws') { socket.destroy(); return; }
      const conn = performWebSocketHandshake(req, socket);
      if (!conn) return;
      if (head && head.length) {
        conn._onData(head);
      }
      signals.addConn(req, conn);
    } catch (err) {
      console.error('Upgrade error:', err);
      try { socket.destroy(); } catch {}
    }
  });

  setInterval(() => signals.sendHeartbeat(), 4 * 60 * 1000);

  server.listen(port, host, () => {
    if (isDevPlain) {
      console.log(`RT Share dev signaling server listening on ws://${host}:${port}`);
      console.log('Dev mode: ignoring TLS and config.json');
    } else {
      console.log(`RT Share Node server listening on wss://${host}:${port}`);
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
