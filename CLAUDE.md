# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a single-file Snake game ("贪吃蛇闯关") with a level-based progression system. No build tools or frameworks are used — just vanilla HTML, CSS, and JavaScript.

## Running the Game

Open `index.html` directly in a browser, or serve it locally:
```bash
npx serve .
```

## Architecture

- **index.html** — Game structure, canvas (600x600), HUD elements, and mobile controls
- **style.css** — Dark arcade aesthetic with CSS variables, glassmorphism panels, and responsive breakpoints (920px, 640px)
- **script.js** — All game logic

### Game State (script.js:24-39)

Central `state` object manages all game data:
- `snake[]` — Array of `{x, y}` segments
- `direction` / `inputQueue[]` — Current direction and command queue for input buffering
- `obstacles[]` — Level-based obstacle blocks
- `food` — Current food position with `type` (normal, fire, wind, earth, water)
- `score`, `level`, `foodsThisLevel` — Progression tracking
- `effects` — Active power-ups (invincible, scoreMultiplier, timers)
- `particles[]` / `shakeAmount` — Visual feedback systems
- `running`, `paused`, `gameOver`, `finished` — Game phase flags

### Level System

- 6 levels total; each level goal = `4 + level` foods
- Speed: starts at 170ms tick, decreases by 16ms per level (minimum 72ms)
- Power-ups: Eating 3 identical elemental foods in a row triggers evolution effects (Explosion, Invincibility, 2x Score, Bullet Time)
- Obstacles: `Math.min(7, Math.max(0, level - 1))` per level, plus dynamic hazards in later levels

### Rendering

Canvas-based at 600x600 with 20px grid (30x30 tiles). Uses `setTimeout`-based tick loop for game logic, and `requestAnimationFrame` for smooth visual effects (particles, screen shake).

### Controls

- Keyboard: Arrow keys or WASD (both cases)
- Mobile: Direction buttons with `data-dir` attributes
- Spacebar: Start/Pause toggle
