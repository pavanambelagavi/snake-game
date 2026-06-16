/**
 * Snake Game Engine
 * =================
 * Pure JavaScript game loop using Canvas API.
 * Connects to backend via:
 *   - REST API   (leaderboard GET/POST)
 *   - WebSocket  (real-time leaderboard push)
 *
 * Architecture:
 *   GameEngine  → handles game logic, state machine
 *   Renderer    → draws to canvas every frame
 *   API         → communicates with backend
 *   UI          → updates DOM elements
 */

// ─── Config ────────────────────────────────────────────────────────────────────
const CONFIG = {
  BACKEND_URL: "http://localhost:3001",
  WS_URL:      "ws://localhost:3001",
  GRID:        20,          // number of cells horizontally & vertically
  CELL_SIZE:   24,          // px per cell → canvas = 480x480
  TICK_RATES: {             // ms between game ticks per difficulty
    easy:   200,
    medium: 130,
    hard:   80,
    insane: 50,
  },
  POINTS_PER_FOOD: 10,
  LEVEL_EVERY:     5,       // speed up every N food eaten
};

const CANVAS_SIZE = CONFIG.GRID * CONFIG.CELL_SIZE; // 480

// ─── Direction constants ────────────────────────────────────────────────────────
const DIR = {
  UP:    { x: 0, y: -1 },
  DOWN:  { x: 0, y:  1 },
  LEFT:  { x:-1, y:  0 },
  RIGHT: { x: 1, y:  0 },
};
const OPPOSITE = { UP:"DOWN", DOWN:"UP", LEFT:"RIGHT", RIGHT:"LEFT" };

// ─── Game State Machine ─────────────────────────────────────────────────────────
// States: IDLE → PLAYING → PAUSED → GAME_OVER → IDLE
let state = {
  phase:       "IDLE",    // IDLE | PLAYING | PAUSED | GAME_OVER
  snake:       [],        // [{x, y}, ...] head first
  direction:   DIR.RIGHT,
  nextDir:     DIR.RIGHT,
  food:        { x: 10, y: 10 },
  score:       0,
  highScore:   Number(localStorage.getItem("snake_hs") || 0),
  foodEaten:   0,
  level:       1,
  difficulty:  "medium",
  tickRate:    CONFIG.TICK_RATES.medium,
};

let tickInterval = null;
let animFrame    = null;

// ─── Canvas setup ───────────────────────────────────────────────────────────────
const canvas = document.getElementById("gameCanvas");
const ctx    = canvas.getContext("2d");
canvas.width  = CANVAS_SIZE;
canvas.height = CANVAS_SIZE;

// ─── DOM references ─────────────────────────────────────────────────────────────
const els = {
  score:       document.getElementById("score"),
  highScore:   document.getElementById("highScore"),
  level:       document.getElementById("level"),
  length:      document.getElementById("snakeLength"),
  difficulty:  document.getElementById("difficulty"),
  startBtn:    document.getElementById("startBtn"),
  pauseBtn:    document.getElementById("pauseBtn"),
  restartBtn:  document.getElementById("restartBtn"),
  overlay:     document.getElementById("overlay"),
  overlayEmoji:document.getElementById("overlayEmoji"),
  overlayTitle:document.getElementById("overlayTitle"),
  overlaySub:  document.getElementById("overlaySub"),
  overlayScore:document.getElementById("overlayScore"),
  nameRow:     document.getElementById("nameInputRow"),
  playerName:  document.getElementById("playerName"),
  saveBtn:     document.getElementById("saveScoreBtn"),
  progressFill:document.getElementById("progressFill"),
  progressLabel:document.getElementById("progressLabel"),
  leaderboard: document.getElementById("leaderboardList"),
  apiDot:      document.getElementById("apiDot"),
  apiLabel:    document.getElementById("apiLabel"),
  wsLabel:     document.getElementById("wsLabel"),
  toast:       document.getElementById("toast"),
};

// ─── Renderer ──────────────────────────────────────────────────────────────────
const Renderer = {
  /** Main draw call — runs every animation frame */
  draw() {
    const g = CONFIG.GRID;
    const cs = CONFIG.CELL_SIZE;

    // Background
    ctx.fillStyle = "#0a0f14";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Grid lines
    ctx.strokeStyle = "rgba(48,54,61,0.4)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= g; i++) {
      ctx.beginPath(); ctx.moveTo(i * cs, 0); ctx.lineTo(i * cs, CANVAS_SIZE); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * cs); ctx.lineTo(CANVAS_SIZE, i * cs); ctx.stroke();
    }

    if (state.phase === "IDLE") return;

    // Food with glow
    const fx = state.food.x * cs + cs / 2;
    const fy = state.food.y * cs + cs / 2;
    const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 300); // pulsing glow

    ctx.save();
    ctx.shadowColor = "#f85149";
    ctx.shadowBlur  = 12 * pulse;
    ctx.fillStyle   = "#f85149";
    ctx.beginPath();
    ctx.arc(fx, fy, (cs / 2 - 3) * pulse * 0.95, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Apple stem detail
    ctx.strokeStyle = "#2ea043";
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(fx, fy - cs / 2 + 5);
    ctx.lineTo(fx + 3, fy - cs / 2 + 2);
    ctx.stroke();

    // Snake body
    state.snake.forEach((seg, i) => {
      const isHead = i === 0;
      const isTail = i === state.snake.length - 1;

      const t = i / (state.snake.length - 1 || 1); // 0=head, 1=tail
      const alpha = isHead ? 1 : Math.max(0.35, 1 - t * 0.6);

      // Gradient color head→tail
      if (isHead) {
        ctx.fillStyle = "#39d353";
      } else {
        const g_val = Math.floor(180 - t * 100);
        ctx.fillStyle = `rgb(20, ${g_val}, 50)`;
      }

      const padding = isHead ? 1 : isTail ? 3 : 2;
      const x = seg.x * cs + padding;
      const y = seg.y * cs + padding;
      const size = cs - padding * 2;
      const r = isHead ? 6 : 4;

      ctx.globalAlpha = alpha;
      Renderer.roundRect(x, y, size, size, r);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Head eyes
      if (isHead) {
        ctx.fillStyle = "#0a0f14";
        const dir = state.direction;
        const eyeOffset = cs / 4;
        const eyeSize   = 3;

        let eyes = [];
        if (dir === DIR.RIGHT)      eyes = [{x:x+size-6, y:y+5},{x:x+size-6, y:y+size-7}];
        else if (dir === DIR.LEFT)  eyes = [{x:x+4, y:y+5},{x:x+4, y:y+size-7}];
        else if (dir === DIR.UP)    eyes = [{x:x+5, y:y+4},{x:x+size-7, y:y+4}];
        else                        eyes = [{x:x+5, y:y+size-6},{x:x+size-7, y:y+size-6}];

        eyes.forEach(e => {
          ctx.beginPath();
          ctx.arc(e.x, e.y, eyeSize, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    });
  },

  /** Draw a rounded rectangle path */
  roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  },
};

// ─── Game Logic ───────────────────────────────────────────────────────────────
const Game = {
  /** Initialise / reset state */
  init() {
    const mid = Math.floor(CONFIG.GRID / 2);
    state.snake     = [
      { x: mid,     y: mid },
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
    ];
    state.direction = DIR.RIGHT;
    state.nextDir   = DIR.RIGHT;
    state.score     = 0;
    state.foodEaten = 0;
    state.level     = 1;
    state.food      = Game.randomFood();
    UI.updateStats();
  },

  /** Place food in a random empty cell */
  randomFood() {
    let pos;
    do {
      pos = {
        x: Math.floor(Math.random() * CONFIG.GRID),
        y: Math.floor(Math.random() * CONFIG.GRID),
      };
    } while (state.snake.some(s => s.x === pos.x && s.y === pos.y));
    return pos;
  },

  /** Called every tick — moves snake, checks collisions */
  tick() {
    state.direction = state.nextDir;
    const head = state.snake[0];
    const newHead = {
      x: head.x + state.direction.x,
      y: head.y + state.direction.y,
    };

    // Wall collision
    if (
      newHead.x < 0 || newHead.x >= CONFIG.GRID ||
      newHead.y < 0 || newHead.y >= CONFIG.GRID
    ) {
      Game.over();
      return;
    }

    // Self collision (skip last tail segment — it will move)
    if (state.snake.slice(0, -1).some(s => s.x === newHead.x && s.y === newHead.y)) {
      Game.over();
      return;
    }

    state.snake.unshift(newHead);

    // Food eaten?
    if (newHead.x === state.food.x && newHead.y === state.food.y) {
      state.score     += CONFIG.POINTS_PER_FOOD * state.level;
      state.foodEaten += 1;
      state.food       = Game.randomFood();

      // Level up every N food
      if (state.foodEaten % CONFIG.LEVEL_EVERY === 0) {
        state.level += 1;
        Game.speedUp();
        UI.showToast(`Level ${state.level}! Speed increased 🚀`, "success");
      }

      // Update high score
      if (state.score > state.highScore) {
        state.highScore = state.score;
        localStorage.setItem("snake_hs", state.highScore);
      }

      // Send game state to WS (for fun multiplayer broadcasting)
      WS.sendState();
    } else {
      // Remove tail if no food eaten
      state.snake.pop();
    }

    UI.updateStats();
  },

  /** Increase tick rate by 10% for current level */
  speedUp() {
    clearInterval(tickInterval);
    state.tickRate = Math.max(40, state.tickRate * 0.9);
    tickInterval = setInterval(Game.tick, state.tickRate);
  },

  /** Start new game */
  start() {
    const diff = els.difficulty.value;
    state.difficulty = diff;
    state.tickRate   = CONFIG.TICK_RATES[diff];

    Game.init();
    state.phase = "PLAYING";

    clearInterval(tickInterval);
    tickInterval = setInterval(Game.tick, state.tickRate);

    UI.setOverlay("hidden");
    UI.setCanvasClass("playing");
    els.pauseBtn.disabled   = false;
    els.startBtn.disabled   = true;
    els.difficulty.disabled = true;

    // Start render loop
    cancelAnimationFrame(animFrame);
    function loop() { Renderer.draw(); animFrame = requestAnimationFrame(loop); }
    loop();
  },

  /** Pause / resume */
  togglePause() {
    if (state.phase === "PLAYING") {
      state.phase = "PAUSED";
      clearInterval(tickInterval);
      UI.setOverlay("paused");
      els.pauseBtn.textContent = "Resume";
    } else if (state.phase === "PAUSED") {
      state.phase = "PLAYING";
      tickInterval = setInterval(Game.tick, state.tickRate);
      UI.setOverlay("hidden");
      els.pauseBtn.textContent = "Pause";
    }
  },

  /** Game over */
  over() {
    state.phase = "GAME_OVER";
    clearInterval(tickInterval);
    cancelAnimationFrame(animFrame);

    // Final draw (snake frozen)
    Renderer.draw();

    UI.setOverlay("gameover");
    UI.setCanvasClass("game-over");
    els.pauseBtn.disabled   = true;
    els.startBtn.disabled   = false;
    els.difficulty.disabled = false;
    els.pauseBtn.textContent = "Pause";
  },
};

// ─── UI helpers ───────────────────────────────────────────────────────────────
const UI = {
  updateStats() {
    els.score.textContent      = state.score;
    els.highScore.textContent  = state.highScore;
    els.level.textContent      = state.level;
    els.length.textContent     = state.snake.length;

    // Progress bar: food eaten toward next level
    const inLevel   = state.foodEaten % CONFIG.LEVEL_EVERY;
    const pct       = (inLevel / CONFIG.LEVEL_EVERY) * 100;
    els.progressFill.style.width = pct + "%";
    els.progressLabel.textContent = `Food: ${inLevel}/${CONFIG.LEVEL_EVERY} to next level`;
  },

  /** Show/hide overlay */
  setOverlay(type) {
    if (type === "hidden") {
      els.overlay.classList.add("hidden");
      return;
    }
    els.overlay.classList.remove("hidden");

    if (type === "start") {
      els.overlayEmoji.textContent = "🐍";
      els.overlayTitle.textContent = "Snake Game";
      els.overlaySub.textContent   = "Use arrow keys or WASD to move";
      els.overlayScore.style.display = "none";
      els.nameRow.style.display      = "none";
    } else if (type === "paused") {
      els.overlayEmoji.textContent = "⏸";
      els.overlayTitle.textContent = "Paused";
      els.overlaySub.textContent   = "Press P or Escape to resume";
      els.overlayScore.style.display = "none";
      els.nameRow.style.display      = "none";
    } else if (type === "gameover") {
      els.overlayEmoji.textContent   = "💀";
      els.overlayTitle.textContent   = "Game Over!";
      els.overlaySub.textContent     = "Final score";
      els.overlayScore.style.display = "block";
      els.overlayScore.textContent   = state.score;
      els.nameRow.style.display      = state.score > 0 ? "flex" : "none";
      els.playerName.value           = "";
      els.saveBtn.disabled           = false;
    }
  },

  setCanvasClass(cls) {
    const wrapper = canvas.parentElement;
    wrapper.className = "canvas-wrapper " + (cls || "");
  },

  updateLeaderboard(data) {
    if (!data || data.length === 0) {
      els.leaderboard.innerHTML = `<li class="lb-empty">No scores yet. Be the first!</li>`;
      return;
    }
    const medals = ["gold", "silver", "bronze"];
    els.leaderboard.innerHTML = data.map((entry, i) => `
      <li>
        <span class="lb-rank ${medals[i] || ''}">${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
        <span class="lb-name">${escapeHtml(entry.name)}</span>
        <span class="lb-score">${entry.score}</span>
      </li>
    `).join("");
  },

  showToast(msg, type = "") {
    els.toast.textContent   = msg;
    els.toast.className     = "show " + type;
    clearTimeout(UI._toastTimer);
    UI._toastTimer = setTimeout(() => { els.toast.className = ""; }, 3000);
  },

  setApiStatus(online) {
    els.apiDot.className  = "dot " + (online ? "online" : "offline");
    els.apiLabel.textContent = online ? "Backend connected" : "Backend offline (local mode)";
  },

  setWsStatus(label) {
    els.wsLabel.textContent = label;
  },
};

// ─── API service ───────────────────────────────────────────────────────────────
const API = {
  async getLeaderboard() {
    try {
      const res  = await fetch(`${CONFIG.BACKEND_URL}/api/leaderboard`);
      const json = await res.json();
      if (json.success) UI.updateLeaderboard(json.data);
      UI.setApiStatus(true);
    } catch {
      UI.setApiStatus(false);
    }
  },

  async saveScore(name, score) {
    try {
      const res  = await fetch(`${CONFIG.BACKEND_URL}/api/leaderboard`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name, score }),
      });
      const json = await res.json();
      if (json.success) {
        UI.showToast(`Score saved! 🎉 ${name}: ${score}`, "success");
        API.getLeaderboard();
      } else {
        UI.showToast(json.message || "Failed to save score.", "error");
      }
    } catch {
      UI.showToast("Backend offline — score not saved.", "error");
    }
  },
};

// ─── WebSocket service ─────────────────────────────────────────────────────────
const WS = {
  socket: null,

  connect() {
    try {
      WS.socket = new WebSocket(CONFIG.WS_URL);

      WS.socket.onopen = () => {
        UI.setWsStatus("WS: live");
      };

      WS.socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "LEADERBOARD_UPDATE") {
            UI.updateLeaderboard(msg.data);
          }
        } catch {}
      };

      WS.socket.onclose = () => {
        UI.setWsStatus("WS: disconnected");
        // Reconnect after 3s
        setTimeout(WS.connect, 3000);
      };

      WS.socket.onerror = () => {
        UI.setWsStatus("WS: offline");
      };
    } catch {
      UI.setWsStatus("WS: unavailable");
    }
  },

  /** Broadcast current game state */
  sendState() {
    if (WS.socket && WS.socket.readyState === WebSocket.OPEN) {
      WS.socket.send(JSON.stringify({
        type: "GAME_STATE",
        data: {
          score:  state.score,
          length: state.snake.length,
          level:  state.level,
        },
      }));
    }
  },
};

// ─── Input handling ────────────────────────────────────────────────────────────
document.addEventListener("keydown", (e) => {
  const keyMap = {
    ArrowUp:    "UP",   w: "UP",    W: "UP",
    ArrowDown:  "DOWN", s: "DOWN",  S: "DOWN",
    ArrowLeft:  "LEFT", a: "LEFT",  A: "LEFT",
    ArrowRight: "RIGHT",d: "RIGHT", D: "RIGHT",
  };

  const dirName = keyMap[e.key];
  if (dirName && state.phase === "PLAYING") {
    // Prevent reversing
    if (OPPOSITE[dirName] !== directionName(state.direction)) {
      state.nextDir = DIR[dirName];
    }
    e.preventDefault(); // stop page scrolling
  }

  if ((e.key === "p" || e.key === "P" || e.key === "Escape") && state.phase !== "IDLE") {
    if (state.phase === "PLAYING" || state.phase === "PAUSED") Game.togglePause();
  }
  if (e.key === " " && state.phase === "IDLE") {
    Game.start();
  }
  if (e.key === " " && state.phase === "GAME_OVER") {
    Game.start();
  }
});

function directionName(dir) {
  return Object.keys(DIR).find(k => DIR[k] === dir) || "RIGHT";
}

// Mobile buttons
document.getElementById("mbUp").onclick    = () => changeDir("UP");
document.getElementById("mbDown").onclick  = () => changeDir("DOWN");
document.getElementById("mbLeft").onclick  = () => changeDir("LEFT");
document.getElementById("mbRight").onclick = () => changeDir("RIGHT");

function changeDir(dirName) {
  if (state.phase !== "PLAYING") return;
  if (OPPOSITE[dirName] !== directionName(state.direction)) {
    state.nextDir = DIR[dirName];
  }
}

// ─── Button wiring ─────────────────────────────────────────────────────────────
els.startBtn.onclick   = () => Game.start();
els.pauseBtn.onclick   = () => Game.togglePause();
els.restartBtn.onclick = () => Game.start();

els.saveBtn.onclick = () => {
  const name = els.playerName.value.trim();
  if (!name) { UI.showToast("Please enter your name!", "error"); return; }
  els.saveBtn.disabled = true;
  API.saveScore(name, state.score);
};

els.playerName.addEventListener("keydown", (e) => {
  if (e.key === "Enter") els.saveBtn.click();
});

// ─── Utility ───────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

// ─── Boot ──────────────────────────────────────────────────────────────────────
(function boot() {
  // Initial render (idle screen with grid)
  Renderer.draw();
  UI.setOverlay("start");
  UI.updateStats();
  els.highScore.textContent = state.highScore;
  els.pauseBtn.disabled     = true;

  // Connect to backend
  API.getLeaderboard();
  WS.connect();
})();
