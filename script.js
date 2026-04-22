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
  queuedDirection: { x: 1, y: 0 },
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
  tickCount: 0,
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
  return Math.max(minSpeed, baseSpeed - (level - 1) * 16);
}

function getObstacleCount(level) {
  return Math.min(7, Math.max(0, level - 1));
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
  levelEl.textContent = `${state.level} / ${totalLevels}`;
  
  // 增加连击显示
  let goalText = `${state.foodsThisLevel} / ${getLevelGoal(state.level)}`;
  if (state.combo.count > 0) {
    const comboEmoji = { fire: "🔥", wind: "⚡", earth: "💎" };
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
  state.queuedDirection = { x: 1, y: 0 };
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
  
  if (rand > 0.85) type = "fire";
  else if (rand > 0.70) type = "wind";
  else if (rand > 0.55) type = "earth";

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
  state.tickCount = 0;
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
  showOverlay("准备开始", "按开始按钮进入第 1 关", "连续吃 3 个同色果实触发进化：火(碎石)、风(无敌)、土(双倍)");
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
  clearTimeout(state.loopId);
  setBestScore();
  updateHud();
  showOverlay("闯关失败", "本局结束", `${message} 点击开始游戏可重新挑战。`);
}

function finishGame() {
  state.running = false;
  state.finished = true;
  clearTimeout(state.loopId);
  setBestScore();
  updateHud();
  showOverlay("全部通关", "你完成了 6 个关卡", `最终得分 ${state.score} 分，可以点击重新开始再来一局。`);
}

function advanceLevel() {
  if (state.level >= totalLevels) {
    finishGame();
    return;
  }

  clearTimeout(state.loopId);
  setupLevel(state.level + 1);
  showOverlay("关卡完成", `进入第 ${state.level} 关`, `本关新增 ${getObstacleCount(state.level)} 个障碍，速度也会更快。`);
  state.paused = true;
  state.running = true;
  updateHud();
}

function updateDirection(next) {
  const invalidTurn = next.x === -state.direction.x && next.y === -state.direction.y;
  if (!invalidTurn) {
    state.queuedDirection = next;
  }
}

function applyEvolution(type) {
  if (type === "fire") {
    if (state.obstacles.length > 0) {
      state.obstacles.pop();
    }
  } else if (type === "wind") {
    state.effects.invincible = 15;
  } else if (type === "earth") {
    state.effects.scoreMultiplier = 2;
    // 土元素效果持续 20 个 tick
    state.earthEffectTimer = 20;
  }
}

function eatFood(head) {
  if (!sameCell(head, state.food)) {
    state.snake.pop();
    return false;
  }

  const foodType = state.food.type;
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

  state.tickCount++;

  if (state.level >= 4 && state.tickCount % 35 === 0) {
    collapseMap();
  }

  if (state.tickCount % 20 === 0 && state.pathHistory.length > 20) {
    const ghostLength = Math.min(state.snake.length, 10);
    state.ghostSnake = state.pathHistory.slice(-20, -20 + ghostLength).map((part) => ({ ...part }));
  }

  state.direction = { ...state.queuedDirection };
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
  if (state.pathHistory.length > 50) {
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

  const duplicated = state.obstacles.some((block) => sameCell(block, cell));
  const isOccupied =
    duplicated ||
    state.snake.some((part) => sameCell(part, cell)) ||
    sameCell(state.food, cell);

  if (!isOccupied) {
    state.obstacles.push(cell);
  }
}

function scheduleNextTick() {
  clearTimeout(state.loopId);
  state.loopId = setTimeout(tick, getLevelSpeed(state.level));
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
    earth: { body: "#c78b46", accent: "#f2d398" }
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
  drawBoard();
  drawObstacles();
  drawGhostSnake(); // 绘制残影
  drawFood();
  drawSnake();
  drawLevelBadge();
}

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
