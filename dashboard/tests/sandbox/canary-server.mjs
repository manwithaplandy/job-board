// The canary for the variant 3 sandbox enforcement suite (plan Task 2.7). It listens on a
// second port (SANDBOX_CANARY_PORT, default 4599, the port the harness fixtures hard-code)
// and records everything that reaches it, by every way a frame can try:
//   - TCP connections (preconnect, TURN over TCP, any HTTP or WebSocket attempt);
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
import { createSocket } from "node:dgram";

const HOST = "127.0.0.1";
const PORT = Number(process.env.SANDBOX_CANARY_PORT ?? 4599);
const CONTROL_PORT = Number(process.env.SANDBOX_CANARY_CONTROL_PORT ?? 4598);
const KEEP = 200;

function emptyRecord() {
  return { tcpConnections: 0, requests: [], upgrades: [], udpDatagrams: [] };
}
let record = emptyRecord();
const streams = new Set();

function clip(s) {
  const text = String(s ?? "");
  return text.length > 300 ? `${text.slice(0, 300)}...` : text;
}

function remember(list, entry) {
  if (list.length < KEEP) list.push({ at: new Date().toISOString(), ...entry });
}

const canary = createServer((req, res) => {
  remember(record.requests, {
    method: req.method,
    url: clip(req.url),
    secFetchDest: clip(req.headers["sec-fetch-dest"]),
    secFetchMode: clip(req.headers["sec-fetch-mode"]),
    purpose: clip(req.headers["sec-purpose"] ?? req.headers.purpose),
    userAgent: clip(req.headers["user-agent"]).slice(0, 120),
  });
  req.resume();
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
canary.on("connection", () => {
  record.tcpConnections += 1;
});
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
    const total = record.tcpConnections + record.requests.length + record.upgrades.length + record.udpDatagrams.length;
    return send(200, { total, ...record });
  }
  if (req.method === "POST" && req.url === "/reset") {
    endStreams();
    record = emptyRecord();
    return send(200, { ok: true });
  }
  return send(404, { error: "not found" });
});

canary.listen(PORT, HOST, () => {
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
    canary.close();
    control.close();
    process.exit(0);
  });
}
