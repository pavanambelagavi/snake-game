# 🐍 Snake Game — Full Stack App

A complete Snake game with a **vanilla JS frontend** and a **Node.js backend** featuring REST API + WebSocket real-time leaderboard.

---

## 📁 Folder Structure

```
snake-game/
├── README.md
├── frontend/
│   ├── index.html      ← Game UI (open directly OR via live-server)
│   ├── styles.css      ← Full dark-theme CSS
│   ├── game.js         ← Game engine + Canvas renderer + API calls
│   └── package.json    ← Optional: live-server dev dependency
│
└── backend/
    ├── server.js       ← Express REST API + WebSocket server
    └── package.json    ← Node dependencies
```

---

## 🚀 Quick Start (VS Code)

### Step 1 — Start the Backend

Open a terminal in VS Code (`Ctrl + ` ` `):

```bash
cd backend
npm install
node server.js
```

You should see:
```
🐍 Snake Game Backend running!
   REST API  → http://localhost:3001/api
   WebSocket → ws://localhost:3001
   Health    → http://localhost:3001/api/health
```

### Step 2 — Open the Frontend

**Option A — Just open the file (simplest):**
```
Right-click frontend/index.html → Open with Live Server
```
(Requires the "Live Server" VS Code extension — install it from the Extensions panel)

**Option B — Via terminal:**
```bash
cd frontend
npm install
npm start
```

**Option C — No tools needed:**
- Simply double-click `frontend/index.html` to open in your browser.
- Note: WebSocket features won't work without a server, but the game itself will.

---

## 🎮 How to Play

| Key | Action |
|-----|--------|
| Arrow Keys / WASD | Move snake |
| P / Escape | Pause / Resume |
| Space | Start / Restart |

- Eat the red 🔴 food to grow and score points
- Every 5 food = Level Up (speed increases!)
- Avoid walls and yourself
- Submit your name to save your score to the leaderboard

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/leaderboard` | Get top 10 scores |
| POST | `/api/leaderboard` | Submit a score |

**POST body example:**
```json
{
  "name": "Alice",
  "score": 320
}
```

---

## ⚡ Features

- ✅ Classic snake gameplay with canvas rendering
- ✅ Levels (speed increases every 5 food)
- ✅ Local high score (persisted in localStorage)
- ✅ Global leaderboard via REST API
- ✅ Real-time leaderboard updates via WebSocket
- ✅ 4 difficulty modes: Easy / Medium / Hard / Insane
- ✅ Pause / Resume
- ✅ Score saving with player name
- ✅ Mobile D-pad controls
- ✅ Animated pulsing food & smooth snake rendering

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS, HTML5 Canvas, CSS3 |
| Backend | Node.js, Express.js |
| Real-time | WebSocket (ws library) |
| API | REST JSON API |
| Storage | In-memory (top 10 scores) |

---

## 📝 VS Code Extensions Recommended

- **Live Server** — right-click HTML to launch
- **REST Client** — test API endpoints in `.http` files
- **Prettier** — code formatting
