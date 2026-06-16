/**
 * Snake Game Backend
 * ==================
 * - Express REST API  → leaderboard (GET scores, POST score)
 * - WebSocket server  → real-time game-state broadcast (multiplayer-ready)
 * - In-memory store   → top 10 scores (no DB needed to run locally)
 *
 * Run:  node server.js   (or:  npm run dev  with nodemon)
 * Port: 3001
 */

const express = require("express");
const cors    = require("cors");
const http    = require("http");
const { WebSocketServer, WebSocket } = require("ws");

// ─── App setup ────────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// ─── In-memory leaderboard (top 10) ──────────────────────────────────────────
let leaderboard = [
  { name: "Alice",   score: 320, date: new Date().toISOString() },
  { name: "Bob",     score: 210, date: new Date().toISOString() },
  { name: "Charlie", score: 180, date: new Date().toISOString() },
];

// ─── REST Routes ──────────────────────────────────────────────────────────────

/**
 * GET /api/leaderboard
 * Returns the top 10 scores sorted by score descending.
 */
app.get("/api/leaderboard", (req, res) => {
  const sorted = [...leaderboard]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  res.json({ success: true, data: sorted });
});

/**
 * POST /api/leaderboard
 * Body: { name: string, score: number }
 * Saves a new score and returns updated leaderboard.
 */
app.post("/api/leaderboard", (req, res) => {
  const { name, score } = req.body;

  // Validation
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ success: false, message: "Name is required." });
  }
  if (typeof score !== "number" || score < 0) {
    return res.status(400).json({ success: false, message: "Score must be a positive number." });
  }

  const entry = {
    name:  name.trim().slice(0, 20), // max 20 chars
    score: Math.floor(score),
    date:  new Date().toISOString(),
  };

  leaderboard.push(entry);

  // Keep only top 10
  leaderboard = leaderboard
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  // Broadcast updated leaderboard to all WebSocket clients
  broadcastLeaderboard();

  res.status(201).json({ success: true, data: entry });
});

/**
 * GET /api/health
 * Simple health-check endpoint.
 */
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Snake Game API is running!", timestamp: new Date() });
});

// ─── WebSocket Server ─────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server });

// Track connected clients
const clients = new Set();

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log(`✅ Client connected  | Total clients: ${clients.size}`);

  // Send current leaderboard immediately on connect
  ws.send(JSON.stringify({
    type: "LEADERBOARD_UPDATE",
    data: [...leaderboard].sort((a, b) => b.score - a.score).slice(0, 10),
  }));

  // Handle messages from client
  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      // Client can broadcast its game state (score, snake length) to others
      if (msg.type === "GAME_STATE") {
        broadcast({ type: "PLAYER_UPDATE", data: msg.data }, ws);
      }
    } catch (err) {
      // Ignore malformed messages
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log(`❌ Client disconnected | Total clients: ${clients.size}`);
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err.message);
    clients.delete(ws);
  });
});

/** Send a message to all connected clients */
function broadcast(payload, excludeWs = null) {
  const msg = JSON.stringify(payload);
  clients.forEach((client) => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

/** Broadcast the updated leaderboard to all clients */
function broadcastLeaderboard() {
  broadcast({
    type: "LEADERBOARD_UPDATE",
    data: [...leaderboard].sort((a, b) => b.score - a.score).slice(0, 10),
  });
}

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log("");
  console.log("🐍 Snake Game Backend running!");
  console.log(`   REST API  → http://localhost:${PORT}/api`);
  console.log(`   WebSocket → ws://localhost:${PORT}`);
  console.log(`   Health    → http://localhost:${PORT}/api/health`);
  console.log("");
});
