import path from 'node:path';
import { Buffer } from 'node:buffer';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequestHandler } from 'react-router';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WEB_DIR = path.resolve(__dirname, '..');
const BUILD_SERVER_PATH = path.resolve(WEB_DIR, 'build/server/index.js');
const BUILD_CLIENT_DIR = path.resolve(WEB_DIR, 'build/client');

async function readJSON(file) {
  const fileObj = Bun.file(file);
  if (!(await fileObj.exists())) {
    throw new Error(`File not found: ${file}`);
  }
  return JSON.parse(await fileObj.text());
}

function resolvePath(baseDir, p) {
  if (!p) return '';
  return path.isAbsolute(p) ? p : path.resolve(baseDir, p);
}

async function loadConfig() {
  const env = Bun.env;
  const envPath = env.RT_SHARE_CONFIG || env.RTS_CONFIG;
  const candidates = [];
  if (envPath) candidates.push(envPath);
  const cwd = Bun.cwd();
  candidates.push(path.resolve(cwd, 'config.json'));
  candidates.push(path.resolve(cwd, '..', 'config.json'));
  candidates.push(path.resolve(__dirname, 'config.json'));
  candidates.push(path.resolve(__dirname, '..', 'config.json'));
  candidates.push(path.resolve(__dirname, '..', '..', 'config.json'));
  for (const candidate of candidates) {
    const fileObj = Bun.file(candidate);
    if (await fileObj.exists()) {
      const cfg = await readJSON(candidate);
      return { cfg, cfgPath: candidate };
    }
  }
  throw new Error(`config.json not found; checked: ${candidates.join(', ')}`);
}

function minVersionTag(s) {
  return s && String(s).includes('1.3') ? 'TLSv1.3' : 'TLSv1.2';
}

function parsePEMBlocks(pemData) {
  const text = String(pemData);
  const blocks = text.split(/-----END [^-]+-----/g);
  let certs = '';
  let key = null;
  let idx = 0;
  for (const chunk of blocks) {
    if (!chunk.trim()) continue;
    const endMarker = '-----END ';
    const endStart = text.indexOf(endMarker, idx);
    if (endStart === -1) break;
    const endClose = text.indexOf('-----', endStart + endMarker.length);
    const type = text.slice(endStart + endMarker.length, endClose).trim();
    const beginStart = text.lastIndexOf('-----BEGIN ', endStart);
    const beginClose = text.indexOf('-----', beginStart + '-----BEGIN '.length);
    const block = text.slice(beginStart, endClose + 5);
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
    const everything = await Bun.file(resolvePath(baseDir, t.everything_file)).text();
    const { certs, key } = parsePEMBlocks(everything);
    if (!key || !certs) throw new Error('everything_file missing key or certs');
    opts.key = key;
    opts.cert = certs;
    if (t.ca_file) {
      const ca = await Bun.file(resolvePath(baseDir, t.ca_file)).text();
      opts.cert = `${opts.cert}\n${ca}`;
      opts.ca = ca;
    }
  } else if ((t.combined_file && t.key_file) || (t.cert_file && t.key_file)) {
    const certSrc = t.combined_file || t.cert_file;
    opts.cert = await Bun.file(resolvePath(baseDir, certSrc)).text();
    opts.key = await Bun.file(resolvePath(baseDir, t.key_file)).text();
    if (t.ca_file) {
      const ca = await Bun.file(resolvePath(baseDir, t.ca_file)).text();
      opts.cert = `${opts.cert}\n${ca}`;
      opts.ca = ca;
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
  const lastColon = addr.lastIndexOf(':');
  if (lastColon > 0) {
    const host = addr.slice(0, lastColon);
    const port = Number(addr.slice(lastColon + 1)) || 3000;
    return { host, port };
  }
  const port = Number(addr) || 3000;
  return { host: '0.0.0.0', port };
}

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

async function tryServeStatic(req) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return null;
  const url = new URL(req.url);
  const pathname = decodeURIComponent(url.pathname);
  if (!pathname.startsWith('/assets/') && pathname !== '/favicon.ico') return null;
  const rel = pathname.replace(/^\/+/, '');
  const abs = path.join(BUILD_CLIENT_DIR, rel);
  if (!abs.startsWith(BUILD_CLIENT_DIR)) {
    return new Response('Forbidden', { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  try {
    const fileObj = Bun.file(abs);
    if (!(await fileObj.exists())) return null;
    const headers = new Headers();
    headers.set('Content-Type', contentTypeFor(abs));
    if (pathname.startsWith('/assets/')) {
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    }
    if (req.method === 'HEAD') {
      return new Response(null, { status: 200, headers });
    }
    return new Response(fileObj, { status: 200, headers });
  } catch {
    return null;
  }
}

function getUpgradeIP(server, req) {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd && fwd.length) return fwd.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real && real.length) return real.trim();
  const info = server.requestIP(req);
  return info?.address || '';
}

function normalizeMessage(message) {
  if (typeof message === 'string') return message;
  if (message instanceof ArrayBuffer) {
    return Buffer.from(message).toString('utf8');
  }
  if (ArrayBuffer.isView(message)) {
    return Buffer.from(message.buffer, message.byteOffset, message.byteLength).toString('utf8');
  }
  return '';
}

class SignalServer {
  constructor() {
    this.conns = new Set();
    this.users = new Map();
  }
  handleOpen(ws) {
    ws.data = { ...(ws.data || {}) };
    this.conns.add(ws);
  }
  handleClose(ws, force = false) {
    if (force) {
      try {
        ws.close();
      } catch {}
    }
    if (!this.conns.has(ws)) return;
    this.conns.delete(ws);
    const userID = ws.data?.userId;
    if (userID) {
      this.users.delete(userID);
      delete ws.data.userId;
      this.broadcast({ type: 'leave', status: 'userLeft', message: `User ${userID} left`, data: userID });
    }
  }
  getAllUserInfoJSON() {
    const list = [];
    for (const [id, socket] of this.users.entries()) {
      list.push({ id, ip: socket.data?.ip || '' });
    }
    return JSON.stringify(list);
  }
  broadcast(obj) {
    const payload = JSON.stringify(obj) + '\n';
    for (const ws of this.conns) {
      try {
        ws.send(payload);
      } catch {
        // Ignore send errors; connection cleanup happens in close handler
      }
    }
  }
  handleMessage(ws, raw) {
    const text = normalizeMessage(raw);
    if (!text) return;
    const parts = text.split('\n').filter(Boolean);
    for (const part of parts) {
      let msg;
      try {
        msg = JSON.parse(part);
      } catch {
        continue;
      }
      this._handle(ws, msg);
    }
  }
  _handle(ws, r) {
    const type = r?.type;
    if (!type) return;
    if (type === 'join') {
      const userID = r.payload;
      if (userID) {
        const existing = this.users.get(userID);
        if (existing && existing !== ws) {
          this.handleClose(existing, true);
        }
        ws.data = { ...(ws.data || {}), userId: userID };
        this.users.set(userID, ws);
        const ip = ws.data?.ip || '';
        this.broadcast({ type: 'join', status: 'userJoin', message: `User ${userID} joined`, data: userID, ip });
        this._send(ws, { type: 'join', status: 'ok', message: `User ${userID} joined`, data: this.getAllUserInfoJSON() });
      }
      return;
    }
    if (type === 'leave') {
      const userID = r.payload;
      const existing = this.users.get(userID);
      if (existing && existing === ws) {
        this.handleClose(ws);
      }
      this._send(ws, { type: 'leave', status: 'ok', message: 'Left', data: this.getAllUserInfoJSON() });
      return;
    }
    if (type === 'offer' || type === 'answer' || type === 'candidate') {
      const targetID = r.payload;
      const target = this.users.get(targetID);
      if (!target) {
        this._send(ws, { type, status: 'error', message: 'User not found' });
        return;
      }
      const senderID = ws.data?.userId || '';
      try {
        target.send(JSON.stringify({ type, status: 'forward', data: r.text, sender: senderID }) + '\n');
        this._send(ws, { type, status: 'ok', message: 'forwarded' });
      } catch {
        this.handleClose(target, true);
        this._send(ws, { type, status: 'error', message: 'forward failed' });
      }
      return;
    }
    this._send(ws, { type, status: 'error', message: `Unknown type: ${type}`, data: '' });
  }
  _send(ws, obj) {
    try {
      ws.send(JSON.stringify(obj) + '\n');
    } catch {
      // ignore send errors
    }
  }
  sendHeartbeat() {
    this.broadcast({ type: 'heartbeat', status: 'ping' });
  }
}

async function main() {
  const env = Bun.env;
  const nodeEnv = env.NODE_ENV || 'development';
  const isDevPlain = env.RT_PLAIN_WS === '1' || nodeEnv === 'development';

  let requestHandler = null;
  let tlsOptions = null;
  let host = '0.0.0.0';
  let port = 3000;

  if (!isDevPlain) {
    const { cfg, cfgPath } = await loadConfig();
    const cfgDir = path.dirname(cfgPath);
    tlsOptions = await buildTlsOptions(cfgDir, cfg.tls);
    ({ host, port } = parseAddress(cfg.tls?.address || ':3000'));

    try {
      const build = await import(pathToFileURL(BUILD_SERVER_PATH).href);
      requestHandler = createRequestHandler(build, nodeEnv || 'production');
    } catch (err) {
      console.error('Could not load SSR server build at', BUILD_SERVER_PATH);
      console.error('Did you run `bun run build` in rt-share-web?');
      throw err;
    }
  }

  const signals = new SignalServer();

  const server = Bun.serve({
    port,
    hostname: host,
    tls: tlsOptions
      ? {
          cert: tlsOptions.cert,
          key: tlsOptions.key,
          ca: tlsOptions.ca,
          minVersion: tlsOptions.minVersion,
        }
      : undefined,
    fetch: async (req, server) => {
      const url = new URL(req.url);
      if (url.pathname === '/ws') {
        const upgraded = server.upgrade(req, { data: { ip: getUpgradeIP(server, req) } });
        if (upgraded) return undefined;
        return new Response('WebSocket upgrade failed', { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }

      if (isDevPlain) {
        return new Response('Dev signaling server: use Vite dev server for the app.', {
          status: 404,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }

      try {
        const staticResponse = await tryServeStatic(req);
        if (staticResponse) return staticResponse;
        if (requestHandler) {
          return await requestHandler(req);
        }
        return new Response('SSR not available', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      } catch (err) {
        console.error('Request error:', err);
        return new Response('Internal Server Error', { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    },
    websocket: {
      open(ws) {
        signals.handleOpen(ws);
      },
      message(ws, message) {
        signals.handleMessage(ws, message);
      },
      close(ws) {
        signals.handleClose(ws);
      },
    },
  });

  setInterval(() => signals.sendHeartbeat(), 4 * 60 * 1000);

  if (isDevPlain) {
    console.log(`RT Share dev signaling server listening on ws://${server.hostname}:${server.port}`);
    console.log('Dev mode: ignoring TLS and config.json');
  } else {
    console.log(`RT Share Bun server listening on wss://${host}:${server.port}`);
  }
}

main().catch((err) => {
  console.error(err);
  Bun.exit(1);
});
