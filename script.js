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
  food: { x: 10, y: 10 },
  obstacles: [],
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
  goalEl.textContent = `${state.foodsThisLevel} / ${getLevelGoal(state.level)}`;
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
  state.food = randomFreeCell();
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
  showOverlay("准备开始", "按开始按钮进入第 1 关", "每关目标会增加，速度和障碍也会同步提升。");
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

function eatFood(head) {
  if (!sameCell(head, state.food)) {
    state.snake.pop();
    return false;
  }

  state.score += 10;
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

  const hitSelf = state.snake.some((part) => sameCell(part, head));
  const hitObstacle = state.obstacles.some((block) => sameCell(block, head));
  if (hitSelf || hitObstacle) {
    loseGame(hitSelf ? "你撞到了自己。" : "你撞到了障碍物。");
    draw();
    return;
  }

  state.snake.unshift(head);
  const leveledUp = eatFood(head);
  updateHud();
  draw();

  if (!leveledUp && state.running && !state.paused && !state.gameOver && !state.finished) {
    scheduleNextTick();
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
  ctx.fillStyle = "#ff4f5e";
  ctx.beginPath();
  ctx.arc(x + gridSize / 2, y + gridSize / 2, gridSize * 0.32, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#7bd389";
  ctx.fillRect(x + gridSize * 0.48, y + gridSize * 0.12, gridSize * 0.08, gridSize * 0.18);
}

function drawObstacles() {
  state.obstacles.forEach((block) => {
    const x = block.x * gridSize;
    const y = block.y * gridSize;
    ctx.fillStyle = "#ff6b35";
    ctx.fillRect(x + 3, y + 3, gridSize - 6, gridSize - 6);
  });
}

function drawSnake() {
  state.snake.forEach((part, index) => {
    const x = part.x * gridSize;
    const y = part.y * gridSize;
    ctx.fillStyle = index === 0 ? "#00a878" : "#7bd389";
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
