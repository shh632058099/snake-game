const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("best-score");
const levelEl = document.getElementById("level");
const goalEl = document.getElementById("goal");
const overlayEl = document.getElementById("overlay");
const overlayTagEl = document.getElementById("overlay-tag");
const overlayTitleEl = document.getElementById("overlay-title");
const overlayTextEl = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");
const pauseBtn = document.getElementById("pause-btn");
const restartBtn = document.getElementById("restart-btn");
const mobileButtons = document.querySelectorAll("[data-dir]");

const gridSize = 20;
const tileCount = canvas.width / gridSize;
const totalLevels = 6;
const baseSpeed = 170;
const minSpeed = 72;
const bestScoreKey = "snake-level-best-score";

const state = {
  snake: [],
  direction: { x: 1, y: 0 },
  inputQueue: [],
  food: { x: 10, y: 10, type: "normal" },
  obstacles: [],
  effects: {
    invincible: 0,
    scoreMultiplier: 1
  },
  combo: { type: null, count: 0 },
  pathHistory: [],
  ghostSnake: null,
  earthEffectTimer: 0,
  waterEffectTimer: 0,
  tickCount: 0,
  particles: [],
  warningCells: [],
  shakeAmount: 0,
  score: 0,
  bestScore: Number(localStorage.getItem(bestScoreKey) || 0),
  level: 1,
  foodsThisLevel: 0,
  running: false,
  paused: false,
  gameOver: false,
  finished: false,
  loopId: null
};

function getLevelGoal(level) {
  return 4 + level;
}

function getLevelSpeed(level) {
  const speed = Math.max(minSpeed, baseSpeed - (level - 1) * 16);
  return state.waterEffectTimer > 0 ? speed * 2 : speed;
}

function getObstacleCount(level) {
  // 无尽模式下，障碍物数量上限提高
  return Math.min(20, Math.max(0, level - 1));
}

function showOverlay(tag, title, text) {
  overlayTagEl.textContent = tag;
  overlayTitleEl.textContent = title;
  overlayTextEl.textContent = text;
  overlayEl.classList.remove("hidden");
}

function hideOverlay() {
  overlayEl.classList.add("hidden");
}

function updateHud() {
  scoreEl.textContent = state.score;
  bestScoreEl.textContent = state.bestScore;
  levelEl.textContent = `LEVEL: ${state.level}`;
  
  // 增加连击显示
  let goalText = `${state.foodsThisLevel} / ${getLevelGoal(state.level)}`;
  if (state.combo.count > 0) {
    const comboEmoji = { fire: "🔥", wind: "⚡", earth: "💎", water: "💧" };
    goalText += ` | ${comboEmoji[state.combo.type] || ""} x${state.combo.count}`;
  }
  goalEl.textContent = goalText;
  
  pauseBtn.textContent = state.paused ? "继续" : "暂停";
}

function setBestScore() {
  if (state.score > state.bestScore) {
    state.bestScore = state.score;
    localStorage.setItem(bestScoreKey, String(state.bestScore));
  }
}

function createSnake() {
  const mid = Math.floor(tileCount / 2);
  state.snake = [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid }
  ];
  state.direction = { x: 1, y: 0 };
  state.inputQueue = [];
  state.pathHistory = [];
  state.ghostSnake = null;
}

function sameCell(a, b) {
  return a.x === b.x && a.y === b.y;
}

function randomFreeCell() {
  const occupied = new Set(
    [
      ...state.snake.map((part) => `${part.x},${part.y}`),
      ...state.obstacles.map((block) => `${block.x},${block.y}`)
    ]
  );

  let cell = null;
  do {
    cell = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount)
    };
  } while (occupied.has(`${cell.x},${cell.y}`));

  return cell;
}

function placeFood() {
  const cell = randomFreeCell();
  const rand = Math.random();
  let type = "normal";
  
  if (rand > 0.88) type = "fire";
  else if (rand > 0.76) type = "wind";
  else if (rand > 0.64) type = "earth";
  else if (rand > 0.52) type = "water";

  state.food = { ...cell, type };
}

function placeObstacles() {
  state.obstacles = [];
  const total = getObstacleCount(state.level);

  while (state.obstacles.length < total) {
    const cell = randomFreeCell();
    const safeZone = cell.x > 6 && cell.x < 13 && cell.y > 6 && cell.y < 13;
    const duplicated = state.obstacles.some((block) => sameCell(block, cell));
    if (!safeZone && !duplicated) {
      state.obstacles.push(cell);
    }
  }
}

function setupLevel(level) {
  state.level = level;
  state.foodsThisLevel = 0;
  state.combo = { type: null, count: 0 };
  state.effects.invincible = 0;
  state.effects.scoreMultiplier = 1;
  state.earthEffectTimer = 0;
  state.waterEffectTimer = 0;
  state.tickCount = 0;
  state.particles = [];
  state.warningCells = [];
  state.shakeAmount = 0;
  createSnake();
  placeObstacles();
  placeFood();
  updateHud();
  draw();
}

function resetGame() {
  clearTimeout(state.loopId);
  state.score = 0;
  state.running = false;
  state.paused = false;
  state.gameOver = false;
  state.finished = false;
  setupLevel(1);
  showOverlay("准备开始", "按开始按钮进入第 1 关", "连续吃 3 个同色果实触发进化：火(AOE爆炸)、风(无敌)、土(双倍)、水(慢速)");
}

function startGame() {
  if (state.finished) {
    resetGame();
  }

  if (state.running && !state.paused) {
    return;
  }

  state.running = true;
  state.paused = false;
  state.gameOver = false;
  hideOverlay();
  updateHud();
  scheduleNextTick();
}

function togglePause() {
  if (!state.running || state.gameOver || state.finished) {
    return;
  }

  state.paused = !state.paused;
  if (state.paused) {
    clearTimeout(state.loopId);
    showOverlay("游戏暂停", `当前第 ${state.level} 关`, "继续后会从当前局面恢复。");
  } else {
    hideOverlay();
    scheduleNextTick();
  }
  updateHud();
}

function loseGame(message) {
  state.running = false;
  state.gameOver = true;
  triggerShake(15);
  clearTimeout(state.loopId);
  setBestScore();
  updateHud();
  showOverlay("闯关失败", "本局结束", `${message} 点击开始游戏可重新挑战。`);
}



function advanceLevel() {
  clearTimeout(state.loopId);
  state.level++; // Advance level before setup
  setupLevel(state.level);

  let title = `进入第 ${state.level} 关`;
  let text = `本关新增 ${getObstacleCount(state.level)} 个障碍，速度也会更快。`;

  if (state.level > totalLevels) { // After completing initial 6 levels
    title = "无尽挑战开始！";
    text = "你已完成所有固定关卡，难度将持续提升，挑战你的极限！";
  } else if (state.level === totalLevels) { // Just completed the last fixed level
    title = "固定关卡全部完成！";
    text = "欢迎来到无尽的挑战，难度将持续提升！";
  }

  showOverlay("关卡完成", title, text);
  state.paused = true;
  state.running = true;
  updateHud();
}

function updateDirection(next) {
  if (state.inputQueue.length >= 2) return;

  const lastDir = state.inputQueue.length > 0 
    ? state.inputQueue[state.inputQueue.length - 1] 
    : state.direction;

  const invalidTurn = next.x === -lastDir.x && next.y === -lastDir.y;
  if (!invalidTurn) {
    state.inputQueue.push(next);
  }
}

function applyEvolution(type) {
  const head = state.snake[0];
  if (type === "fire") {
    // AOE 爆炸：移除 3x3 范围内的障碍物
    const beforeCount = state.obstacles.length;
    state.obstacles = state.obstacles.filter(block => {
      const dx = Math.abs(block.x - head.x);
      const dy = Math.abs(block.y - head.y);
      if (dx <= 1 && dy <= 1) {
        createParticles(block.x * gridSize, block.y * gridSize, "#ff6b35", 10);
        return false;
      }
      return true;
    });
    
    const destroyed = beforeCount - state.obstacles.length;
    triggerShake(destroyed > 0 ? 20 : 10);
    createParticles(head.x * gridSize, head.y * gridSize, "#ff7a1a", 25);
  } else if (type === "wind") {
    state.effects.invincible = 15;
  } else if (type === "earth") {
    state.effects.scoreMultiplier = 2;
    state.earthEffectTimer = 20;
  } else if (type === "water") {
    state.waterEffectTimer = 30;
  }
}

function eatFood(head) {
  if (!sameCell(head, state.food)) {
    state.snake.pop();
    return false;
  }

  const foodType = state.food.type;
  const palette = {
    normal: "#ff4f5e",
    fire: "#ff7a1a",
    wind: "#5ac8fa",
    earth: "#c78b46",
    water: "#4cc9f0"
  };
  createParticles(state.food.x * gridSize, state.food.y * gridSize, palette[foodType] || palette.normal, 12);
  
  if (foodType !== "normal") {
    if (state.combo.type === foodType) {
      state.combo.count++;
    } else {
      state.combo.type = foodType;
      state.combo.count = 1;
    }

    if (state.combo.count >= 3) {
      applyEvolution(foodType);
      state.combo.count = 0;
      state.combo.type = null;
    }
  } else {
    state.combo.count = 0;
    state.combo.type = null;
  }

  state.score += 10 * state.effects.scoreMultiplier;
  state.foodsThisLevel += 1;
  setBestScore();

  if (state.foodsThisLevel >= getLevelGoal(state.level)) {
    updateHud();
    advanceLevel();
    return true;
  }

  placeFood();
  return false;
}

function tick() {
  if (!state.running || state.paused || state.gameOver || state.finished) {
    return;
  }

  if (state.effects.invincible > 0) {
    state.effects.invincible--;
  }
  if (state.earthEffectTimer > 0) {
    state.earthEffectTimer--;
    if (state.earthEffectTimer === 0) {
      state.effects.scoreMultiplier = 1;
    }
  }
  if (state.waterEffectTimer > 0) {
    state.waterEffectTimer--;
  }

  // 处理地图坍缩预警
  for (let i = state.warningCells.length - 1; i >= 0; i--) {
    const w = state.warningCells[i];
    w.timer--;
    if (w.timer <= 0) {
      const isOccupied = state.snake.some((part) => sameCell(part, w)) || sameCell(state.food, w);
      if (!isOccupied) {
        state.obstacles.push({ x: w.x, y: w.y });
      }
      state.warningCells.splice(i, 1);
    }
  }

  state.tickCount++;

  if (state.level >= 4) {
    const baseCollapseInterval = 35; // 基础坍缩间隔
    // 关卡越高，坍缩越频繁，最小间隔 15 tick
    const collapseInterval = Math.max(15, baseCollapseInterval - (state.level - 4) * 2);
    if (state.tickCount % collapseInterval === 0) {
      collapseMap();
    }
  }

  if (state.tickCount % 20 === 0 && state.pathHistory.length > 20) {
    const ghostLength = state.level === 6 ? state.snake.length : Math.min(state.snake.length, 10);
    // 幽灵蛇选取 20 个 tick 之前的路径片段
    const start = Math.max(0, state.pathHistory.length - 20 - ghostLength);
    const end = state.pathHistory.length - 20;
    state.ghostSnake = state.pathHistory.slice(start, end).map((part) => ({ ...part }));
  }

  if (state.inputQueue.length > 0) {
    state.direction = state.inputQueue.shift();
  }
  
  const head = {
    x: state.snake[0].x + state.direction.x,
    y: state.snake[0].y + state.direction.y
  };

  if (
    head.x < 0 ||
    head.y < 0 ||
    head.x >= tileCount ||
    head.y >= tileCount
  ) {
    loseGame("你撞墙了。");
    draw();
    return;
  }

  const isInvincible = state.effects.invincible > 0;
  if (!isInvincible) {
    const hitSelf = state.snake.some((part) => sameCell(part, head));
    const hitObstacle = state.obstacles.some((block) => sameCell(block, head));
    const hitGhost = Boolean(state.ghostSnake && state.ghostSnake.some((part) => sameCell(part, head)));

    if (hitSelf || hitObstacle || hitGhost) {
      let msg = "你撞到了自己。";
      if (hitObstacle) msg = "你撞到了障碍物。";
      if (hitGhost) msg = "你撞到了时空残影！";
      loseGame(msg);
      draw();
      return;
    }
  }

  state.snake.unshift(head);

  state.pathHistory.push({ ...head });
  if (state.pathHistory.length > 150) {
    state.pathHistory.shift();
  }

  const leveledUp = eatFood(head);
  updateHud();
  draw();

  if (!leveledUp && state.running && !state.paused && !state.gameOver && !state.finished) {
    scheduleNextTick();
  }
}

function collapseMap() {
  const side = Math.floor(Math.random() * 4);
  let cell;

  if (side === 0) {
    cell = { x: 0, y: Math.floor(Math.random() * tileCount) };
  } else if (side === 1) {
    cell = { x: tileCount - 1, y: Math.floor(Math.random() * tileCount) };
  } else if (side === 2) {
    cell = { x: Math.floor(Math.random() * tileCount), y: 0 };
  } else {
    cell = { x: Math.floor(Math.random() * tileCount), y: tileCount - 1 };
  }

  const isWarning = state.warningCells.some((w) => sameCell(w, cell));
  const isObstacle = state.obstacles.some((block) => sameCell(block, cell));
  const isOccupied =
    isWarning ||
    isObstacle ||
    state.snake.some((part) => sameCell(part, cell)) ||
    sameCell(state.food, cell);

  if (!isOccupied) {
    state.warningCells.push({ ...cell, timer: 15 });
  }
}

function scheduleNextTick() {
  clearTimeout(state.loopId);
  state.loopId = setTimeout(tick, getLevelSpeed(state.level));
}

function triggerShake(amount) {
  state.shakeAmount = amount;
}

function createParticles(x, y, color, count = 8) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3 + 1;
    state.particles.push({
      x: x + gridSize / 2,
      y: y + gridSize / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      decay: Math.random() * 0.05 + 0.02,
      color: color
    });
  }
}

function updateAndDrawParticles() {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= p.decay;

    if (p.life <= 0) {
      state.particles.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawEffectsTimer() {
  if (state.effects.invincible <= 0 && state.earthEffectTimer <= 0 && state.waterEffectTimer <= 0) return;

  const head = state.snake[0];
  const centerX = head.x * gridSize + gridSize / 2;
  const centerY = head.y * gridSize + gridSize / 2;
  const radius = gridSize * 0.8;

  const drawArc = (ratio, color) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
    ctx.stroke();
  };

  if (state.effects.invincible > 0) {
    drawArc(state.effects.invincible / 15, "#5ac8fa");
  }
  if (state.earthEffectTimer > 0) {
    drawArc(state.earthEffectTimer / 20, "#ffd166");
  }
  if (state.waterEffectTimer > 0) {
    drawArc(state.waterEffectTimer / 30, "#4cc9f0");
  }
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0b1318";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(247, 242, 225, 0.08)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= tileCount; i += 1) {
    const offset = i * gridSize;
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, offset);
    ctx.lineTo(canvas.width, offset);
    ctx.stroke();
  }
}

function drawFood() {
  const x = state.food.x * gridSize;
  const y = state.food.y * gridSize;
  const palette = {
    normal: { body: "#ff4f5e", accent: "#7bd389" },
    fire: { body: "#ff7a1a", accent: "#ffd166" },
    wind: { body: "#5ac8fa", accent: "#d7f5ff" },
    earth: { body: "#c78b46", accent: "#f2d398" },
    water: { body: "#4cc9f0", accent: "#ffffff" }
  };
  const colors = palette[state.food.type] || palette.normal;

  ctx.fillStyle = colors.body;
  ctx.beginPath();
  ctx.arc(x + gridSize / 2, y + gridSize / 2, gridSize * 0.32, 0, Math.PI * 2);
  ctx.fill();

  if (state.food.type === "wind") {
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + gridSize / 2, y + gridSize / 2, gridSize * 0.18, 0, Math.PI * 2);
    ctx.stroke();
  } else if (state.food.type === "earth") {
    ctx.fillStyle = colors.accent;
    ctx.fillRect(x + gridSize * 0.38, y + gridSize * 0.38, gridSize * 0.24, gridSize * 0.24);
  } else if (state.food.type === "water") {
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(x + gridSize * 0.45, y + gridSize * 0.45, gridSize * 0.08, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = colors.accent;
    ctx.fillRect(x + gridSize * 0.48, y + gridSize * 0.12, gridSize * 0.08, gridSize * 0.18);
  }
}

function drawObstacles() {
  state.obstacles.forEach((block) => {
    const x = block.x * gridSize;
    const y = block.y * gridSize;
    ctx.fillStyle = "#ff6b35";
    ctx.fillRect(x + 3, y + 3, gridSize - 6, gridSize - 6);
  });
}

function drawWarnings() {
  state.warningCells.forEach((w) => {
    const x = w.x * gridSize;
    const y = w.y * gridSize;
    // 闪烁效果：基于时间或 timer
    const alpha = 0.3 + Math.sin(Date.now() / 100) * 0.2;
    ctx.fillStyle = `rgba(255, 79, 94, ${alpha})`;
    ctx.fillRect(x + 1, y + 1, gridSize - 2, gridSize - 2);
    
    ctx.strokeStyle = "#ff4f5e";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 2, y + 2, gridSize - 4, gridSize - 4);
  });
}

function drawGhostSnake() {
  if (!state.ghostSnake) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = 0.3;
  state.ghostSnake.forEach((part) => {
    const x = part.x * gridSize;
    const y = part.y * gridSize;
    ctx.fillStyle = "#4cc9f0";
    ctx.fillRect(x + 4, y + 4, gridSize - 8, gridSize - 8);
  });
  ctx.restore();
}

function drawSnake() {
  state.snake.forEach((part, index) => {
    const x = part.x * gridSize;
    const y = part.y * gridSize;
    const headColor = state.effects.invincible > 0 ? "#8be9fd" : "#00a878";
    const bodyColor = state.effects.invincible > 0 ? "#56cfe1" : "#7bd389";
    ctx.fillStyle = index === 0 ? headColor : bodyColor;
    ctx.fillRect(x + 2, y + 2, gridSize - 4, gridSize - 4);

    if (index === 0) {
      ctx.fillStyle = "#101820";
      const eyeY = y + gridSize * 0.35;
      ctx.fillRect(x + gridSize * 0.28, eyeY, 3, 3);
      ctx.fillRect(x + gridSize * 0.62, eyeY, 3, 3);
    }
  });
}

function drawLevelBadge() {
  ctx.fillStyle = "rgba(255, 177, 0, 0.15)";
  ctx.fillRect(12, 12, 116, 34);
  ctx.fillStyle = "#ffb100";
  ctx.font = '700 18px "Chakra Petch"';
  ctx.fillText(`LEVEL ${state.level}`, 24, 35);
}

function draw() {
  ctx.save();
  if (state.shakeAmount > 0) {
    const dx = (Math.random() - 0.5) * state.shakeAmount;
    const dy = (Math.random() - 0.5) * state.shakeAmount;
    ctx.translate(dx, dy);
    state.shakeAmount *= 0.8;
    if (state.shakeAmount < 0.5) state.shakeAmount = 0;
  }

  drawBoard();
  drawWarnings();
  drawObstacles();
  drawGhostSnake();
  drawFood();
  drawSnake();
  drawEffectsTimer();
  updateAndDrawParticles();
  drawLevelBadge();

  ctx.restore();

  // 为粒子动画、震动和预警闪烁增加平滑渲染支持
  if (state.particles.length > 0 || state.shakeAmount > 0 || state.warningCells.length > 0) {
    requestAnimationFrame(draw);
  }
}

// 移动端手势支持
let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener("touchstart", (e) => {
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
}, { passive: true });

canvas.addEventListener("touchend", (e) => {
  const touchEndX = e.changedTouches[0].screenX;
  const touchEndY = e.changedTouches[0].screenY;
  
  const dx = touchEndX - touchStartX;
  const dy = touchEndY - touchStartY;
  const threshold = 30;

  if (Math.abs(dx) > Math.abs(dy)) {
    if (Math.abs(dx) > threshold) {
      updateDirection(dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 });
    }
  } else {
    if (Math.abs(dy) > threshold) {
      updateDirection(dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 });
    }
  }
}, { passive: true });

// 拦截画布上的默认滚动
canvas.addEventListener("touchmove", (e) => {
  if (state.running && !state.paused) {
    e.preventDefault();
  }
}, { passive: false });

window.addEventListener("keydown", (event) => {
  const keyMap = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    w: { x: 0, y: -1 },
    s: { x: 0, y: 1 },
    a: { x: -1, y: 0 },
    d: { x: 1, y: 0 },
    W: { x: 0, y: -1 },
    S: { x: 0, y: 1 },
    A: { x: -1, y: 0 },
    D: { x: 1, y: 0 }
  };

  const nextDirection = keyMap[event.key];
  if (nextDirection) {
    event.preventDefault();
    updateDirection(nextDirection);
  }

  if (event.key === " ") {
    event.preventDefault();
    if (!state.running || state.gameOver || state.finished) {
      startGame();
    } else {
      togglePause();
    }
  }
});

mobileButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const dir = button.dataset.dir;
    const dirMap = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 }
    };
    updateDirection(dirMap[dir]);
  });
});

startBtn.addEventListener("click", () => {
  if (state.paused && state.running) {
    togglePause();
    return;
  }
  startGame();
});

pauseBtn.addEventListener("click", togglePause);
restartBtn.addEventListener("click", resetGame);

resetGame();
