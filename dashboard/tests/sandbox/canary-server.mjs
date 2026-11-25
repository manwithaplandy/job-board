// The canary for the variant 3 sandbox enforcement suite (plan Task 2.7). It listens on a
// second port (SANDBOX_CANARY_PORT, default 4599, the port the harness fixtures hard-code)
// and records everything that reaches it, by every way a frame can try:
//   - TCP connections (preconnect, TURN over TCP, any HTTP or WebSocket attempt), each with
//     the bytes it carried, its first bytes as text and how many HTTP requests it held, so a
//     bare connect (no bytes) is told apart from one that carried data;
//   - HTTP requests of any method (fetch, XHR, img, script, style, font, media, beacon,
//     EventSource, prefetch, preload, navigation, form submission), with method and path;
//   - WebSocket upgrades;
//   - UDP datagrams on the same port number (STUN, TURN over UDP).
// A path ending in /stream answers a page that never finishes loading.
//
// The control API is on its own port (SANDBOX_CANARY_CONTROL_PORT, default 4598), which no
// fixture names: GET /health, GET /hits (the record as JSON), POST /reset (clears it and
// ends any open streams). The spec resets before each case and reads after it; the cases
// run one at a time, so a hit belongs to the case that was running.
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { createSocket } from "node:dgram";

const HOST = "127.0.0.1";
const PORT = Number(process.env.SANDBOX_CANARY_PORT ?? 4599);
const CONTROL_PORT = Number(process.env.SANDBOX_CANARY_CONTROL_PORT ?? 4598);
const KEEP = 200;

function emptyRecord() {
  return { tcpConnections: 0, connections: [], requests: [], upgrades: [], udpDatagrams: [] };
}
let record = emptyRecord();
const streams = new Set();

function clip(s) {
  const text = String(s ?? "");
  return text.length > 300 ? `${text.slice(0, 300)}...` : text;
}

function remember(list, entry) {
  const item = { at: new Date().toISOString(), ...entry };
  if (list.length < KEEP) list.push(item);
  return item;
}

/** The case a canary path names (/c/<case>/<vector>), or null. */
function caseOf(url) {
  const m = /^\/c\/([a-z0-9-]+)\//.exec(String(url ?? ""));
  return m ? m[1] : null;
}

const canary = createServer((req, res) => {
  // What one request carries is gate A18's input: the path and query, the body, and the
  // headers a page could use to smuggle data or that say where it came from.
  const entry = remember(record.requests, {
    method: req.method,
    url: clip(req.url),
    case: caseOf(req.url),
    secFetchDest: clip(req.headers["sec-fetch-dest"]),
    secFetchMode: clip(req.headers["sec-fetch-mode"]),
    secFetchSite: clip(req.headers["sec-fetch-site"]),
    purpose: clip(req.headers["sec-purpose"] ?? req.headers.purpose),
    origin: clip(req.headers.origin),
    referer: clip(req.headers.referer),
    cookie: req.headers.cookie !== undefined,
    contentType: clip(req.headers["content-type"]),
    userAgent: clip(req.headers["user-agent"]).slice(0, 120),
    bodyBytes: 0,
    bodySample: "",
    connection: liveSockets.get(req.socket)?.id ?? null,
  });
  const conn = liveSockets.get(req.socket);
  if (conn) conn.httpRequests += 1;
  req.on("data", (chunk) => {
    entry.bodyBytes += chunk.length;
    if (entry.bodySample.length < 300) entry.bodySample = clip(entry.bodySample + chunk.toString("utf8"));
  });
  if ((req.url ?? "").endsWith("/stream")) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.write("<!doctype html><p>This page never finishes loading.</p>");
    const timer = setInterval(() => res.write(" "), 500);
    const stream = { res, timer };
    streams.add(stream);
    res.on("close", () => {
      clearInterval(timer);
      streams.delete(stream);
    });
    return;
  }
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
  res.end("canary");
});
// The TCP listener in front of the HTTP server: it counts every connection and records what
// it carried (CI run 1: WebKit opened connections that carried no request). A connection's
// first bytes are kept as printable text, then the socket is handed to the HTTP server.
const liveSockets = new Map();
let connectionSeq = 0;

function printable(buf) {
  return buf.toString("latin1").replace(/[^\x20-\x7e]/g, ".");
}

const tcp = createNetServer({ pauseOnConnect: true }, (socket) => {
  record.tcpConnections += 1;
  const conn = remember(record.connections, { id: ++connectionSeq, remote: `${socket.remoteAddress}:${socket.remotePort}`, bytesRead: 0, firstBytes: "", httpRequests: 0, closed: false });
  liveSockets.set(socket, conn);
  socket.on("error", () => {});
  socket.on("close", () => {
    conn.bytesRead = socket.bytesRead;
    conn.closed = true;
    liveSockets.delete(socket);
  });
  socket.once("data", (chunk) => {
    conn.firstBytes = printable(chunk.subarray(0, 64));
    socket.pause();
    socket.unshift(chunk);
    canary.emit("connection", socket);
    process.nextTick(() => socket.resume());
  });
  socket.resume();
});

/** The live connections' byte counts, so /hits is current for connections still open. */
function refreshConnections() {
  for (const [socket, conn] of liveSockets) conn.bytesRead = socket.bytesRead;
}

canary.on("upgrade", (req, socket) => {
  remember(record.upgrades, { url: clip(req.url), upgrade: clip(req.headers.upgrade) });
  socket.destroy();
});
canary.on("clientError", (_err, socket) => socket.destroy());

const udp = createSocket("udp4");
udp.on("message", (msg, rinfo) => {
  remember(record.udpDatagrams, { from: `${rinfo.address}:${rinfo.port}`, bytes: msg.length });
});

function endStreams() {
  for (const { res, timer } of streams) {
    clearInterval(timer);
    res.destroy();
  }
  streams.clear();
}

const control = createServer((req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (req.method === "GET" && req.url === "/health") return send(200, { ok: true });
  if (req.method === "GET" && req.url === "/hits") {
    refreshConnections();
    const total = record.tcpConnections + record.requests.length + record.upgrades.length + record.udpDatagrams.length;
    return send(200, { total, ...record });
  }
  if (req.method === "POST" && req.url === "/reset") {
    endStreams();
    // A kept-alive connection from the last case must not carry this case's requests unseen.
    for (const socket of liveSockets.keys()) socket.destroy();
    record = emptyRecord();
    return send(200, { ok: true });
  }
  return send(404, { error: "not found" });
});

tcp.listen(PORT, HOST, () => {
  udp.bind(PORT, HOST, () => {
    control.listen(CONTROL_PORT, HOST, () => {
      console.log(`sandbox canary on ${HOST}:${PORT} (tcp, http, ws, udp); control on ${HOST}:${CONTROL_PORT}`);
    });
  });
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    endStreams();
    udp.close();
    tcp.close();
    control.close();
    process.exit(0);
  });
}
