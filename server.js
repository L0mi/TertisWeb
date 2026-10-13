"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer, WebSocket } = require("ws");

const PORT = Number(process.env.PORT || 4173);
const PUBLIC = path.join(__dirname, "public");
const VERSION = "1.12";
const PROTOCOL = 3;
const rooms = new Map();
const mime = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".mp3": "audio/mpeg", ".svg": "image/svg+xml"
};

const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const file = path.normalize(path.join(PUBLIC, requested));
  if (!file.startsWith(PUBLIC)) return end(res, 403, "Forbidden");
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) return serve(path.join(PUBLIC, "index.html"), res);
    serve(file, res);
  });
});

function serve(file, res) {
  fs.readFile(file, (error, data) => {
    if (error) return end(res, 404, "Not found");
    res.writeHead(200, {
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
      "Cache-Control": file.endsWith("index.html") ? "no-cache" : "public, max-age=3600"
    });
    res.end(data);
  });
}
function end(res, status, body) { res.writeHead(status); res.end(body); }
function send(ws, type, payload = {}) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type, ...payload }));
}
function broadcast(room, type, payload = {}, except = null) {
  for (const player of room.players.values()) if (player.ws !== except) send(player.ws, type, payload);
}
function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  do {
    let code = "";
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    if (!rooms.has(code)) return code;
  } while (true);
}
function publicPlayers(room) {
  return [...room.players.values()].map(({ id, name, ready }) => ({ id, name, ready }));
}
function lobby(room) {
  broadcast(room, "lobby", { code: room.code, hostId: room.hostId, rules: room.rules, players: publicPlayers(room) });
}
function postChat(room, message) {
  room.messages.push(message);
  if (room.messages.length > 50) room.messages.shift();
  broadcast(room, "chat", { message });
}
function removeClient(ws) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  const player = room.players.get(ws.playerId);
  room.players.delete(ws.playerId);
  room.pending.delete(ws.playerId);
  if (!room.players.size || ws.playerId === room.hostId) {
    broadcast(room, "room_closed", { reason: "The host left the room." });
    rooms.delete(room.code);
  } else {
    if (player) postChat(room, { system: true, text: `${player.name} left the room.`, sentAt: Date.now() });
    lobby(room);
  }
}

const wss = new WebSocketServer({ server, path: "/multiplayer" });
wss.on("connection", ws => {
  ws.id = crypto.randomUUID();
  ws.on("message", raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return send(ws, "error", { message: "Invalid message." }); }
    if (msg.version !== VERSION || msg.protocol !== PROTOCOL) {
      return send(ws, "version_mismatch", { requiredVersion: VERSION, requiredProtocol: PROTOCOL });
    }
    if (msg.type === "create") {
      const code = makeCode();
      const player = { id: ws.id, name: cleanName(msg.name), ready: true, ws };
      const room = { code, hostId: ws.id, rules: "NORMAL", players: new Map([[ws.id, player]]), pending: new Map(), messages: [], started: false };
      rooms.set(code, room); ws.roomCode = code; ws.playerId = ws.id;
      send(ws, "created", { id: ws.id, code }); lobby(room); return;
    }
    if (msg.type === "join") {
      const room = rooms.get(String(msg.code || "").toUpperCase());
      if (!room) return send(ws, "join_denied", { reason: "Room not found." });
      if (room.started) return send(ws, "join_denied", { reason: "Match already started." });
      if (room.players.size + room.pending.size >= 4) return send(ws, "join_denied", { reason: "Room is full." });
      const pending = { id: ws.id, name: cleanName(msg.name), ready: true, ws };
      room.pending.set(ws.id, pending); ws.roomCode = room.code; ws.playerId = ws.id;
      const host = room.players.get(room.hostId);
      send(host.ws, "join_request", { id: ws.id, name: pending.name });
      send(ws, "join_waiting", { code: room.code }); return;
    }
    const room = rooms.get(ws.roomCode);
    if (!room || !room.players.has(ws.playerId)) return;
    const isHost = room.hostId === ws.playerId;
    if (msg.type === "join_decision" && isHost) {
      const pending = room.pending.get(msg.id);
      if (!pending) return;
      room.pending.delete(msg.id);
      if (msg.accept && room.players.size < 4) {
        room.players.set(pending.id, pending);
        send(pending.ws, "joined", { id: pending.id, code: room.code });
        send(pending.ws, "chat_history", { messages: room.messages });
        postChat(room, { system: true, text: `${pending.name} joined the room.`, sentAt: Date.now() });
        lobby(room);
      } else send(pending.ws, "join_denied", { reason: "The host declined your request." });
      return;
    }
    if (msg.type === "rules" && isHost && ["NORMAL", "DEADLOCK", "CHAOS"].includes(msg.rules)) {
      room.rules = msg.rules; lobby(room); return;
    }
    if (msg.type === "start" && isHost && room.players.size >= 2) {
      room.started = true; broadcast(room, "start", { rules: room.rules, seed: Math.floor(Math.random() * 2147483647) }); return;
    }
    if (msg.type === "state") broadcast(room, "state", { id: ws.playerId, name: cleanName(msg.name), state: msg.state }, ws);
    if (msg.type === "garbage") broadcast(room, "garbage", { from: ws.playerId, lines: Math.max(0, Math.min(4, Number(msg.lines) || 0)) }, ws);
    if (msg.type === "chat") {
      const now = Date.now();
      if (now - (ws.lastChatAt || 0) < 500) return;
      const text = cleanChat(msg.text);
      if (!text) return;
      ws.lastChatAt = now;
      const player = room.players.get(ws.playerId);
      postChat(room, { id: ws.playerId, name: player.name, text, sentAt: now });
      return;
    }
    if (msg.type === "rematch" && isHost) {
      room.started = true; broadcast(room, "start", { rules: room.rules, seed: Math.floor(Math.random() * 2147483647) });
    }
    if (msg.type === "leave") { removeClient(ws); ws.roomCode = null; }
  });
  ws.on("close", () => removeClient(ws));
});

function cleanName(value) {
  return String(value || "PLAYER").replace(/[^\p{L}\p{N}_ -]/gu, "").trim().slice(0, 16) || "PLAYER";
}
function cleanChat(value) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Tertis Web v${VERSION} running on http://localhost:${PORT}`);
});
