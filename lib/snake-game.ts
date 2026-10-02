import type { GameDefinition, GameEngine, SkinId } from '@/lib/game-engine';
import { SNAKE_SKINS } from '@/lib/snake-skins';

type Dir = 'up' | 'down' | 'left' | 'right';
interface Cell {
  x: number;
  y: number;
}

export interface SnakeState {
  body: Cell[]; // body[0] = cabeza
  dir: Dir; // dirección aplicada en el último tick
  food: Cell;
  score: number;
  foodEaten: number;
  level: number; // 1 + floor(foodEaten / FOOD_PER_LEVEL)
  gameOver: boolean;
  won: boolean; // true solo si llena toda la grilla
}

const COLS = 30;
const ROWS = 30;
const CELL = 20;
const CANVAS_WIDTH = COLS * CELL;
const CANVAS_HEIGHT = ROWS * CELL;

const BASE_TICK = 0.15;
const TICK_STEP = 0.01;
const MIN_TICK = 0.06;
const FOOD_PER_LEVEL = 5;
const MAX_QUEUE = 2;

const DELTAS: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Dir, Dir> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};

class SnakeGame implements GameEngine<SnakeState> {
  private body: Cell[] = [];
  private dir: Dir = 'right';
  private dirQueue: Dir[] = [];
  private food: Cell = { x: 0, y: 0 };
  private score = 0;
  private foodEaten = 0;
  private level = 1;
  private gameOver = false;
  private won = false;
  private acc = 0;
  private tickInterval = BASE_TICK;

  constructor() {
    this.reset();
  }

  reset(): void {
    const cx = Math.floor(COLS / 2);
    const cy = Math.floor(ROWS / 2);
    this.body = [
      { x: cx, y: cy },
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy },
    ];
    this.dir = 'right';
    this.dirQueue = [];
    this.score = 0;
    this.foodEaten = 0;
    this.level = 1;
    this.gameOver = false;
    this.won = false;
    this.acc = 0;
    this.tickInterval = BASE_TICK;
    this.spawnFood();
  }

  setKeyDown(code: string): void {
    const next = KEY_DIRS[code];
    if (!next || this.gameOver) return;
    const last = this.dirQueue.length > 0 ? this.dirQueue[this.dirQueue.length - 1] : this.dir;
    if (next === last || next === OPPOSITE[last]) return;
    if (this.dirQueue.length < MAX_QUEUE) this.dirQueue.push(next);
  }

  setKeyUp(): void {}

  update(dt: number): void {
    if (this.gameOver) return;
    this.acc += dt;
    while (this.acc >= this.tickInterval && !this.gameOver) {
      this.acc -= this.tickInterval;
      this.step();
    }
  }

  private step(): void {
    const queued = this.dirQueue.shift();
    if (queued) this.dir = queued;

    const d = DELTAS[this.dir];
    const head = { x: this.body[0].x + d.x, y: this.body[0].y + d.y };

    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
      this.gameOver = true;
      return;
    }

    const eats = head.x === this.food.x && head.y === this.food.y;
    // Si no come, la cola se mueve en este tick y su celda queda libre.
    const limit = eats ? this.body.length : this.body.length - 1;
    for (let i = 0; i < limit; i++) {
      if (this.body[i].x === head.x && this.body[i].y === head.y) {
        this.gameOver = true;
        return;
      }
    }

    this.body.unshift(head);
    if (!eats) {
      this.body.pop();
      return;
    }

    this.foodEaten += 1;
    this.score += 10 * this.level;
    this.level = 1 + Math.floor(this.foodEaten / FOOD_PER_LEVEL);
    this.tickInterval = Math.max(MIN_TICK, BASE_TICK - (this.level - 1) * TICK_STEP);
    this.spawnFood();
  }

  private spawnFood(): void {
    const occupied = new Set(this.body.map((c) => c.y * COLS + c.x));
    const free: Cell[] = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!occupied.has(y * COLS + x)) free.push({ x, y });
      }
    }
    if (free.length === 0) {
      this.won = true;
      this.gameOver = true;
      return;
    }
    this.food = free[Math.floor(Math.random() * free.length)];
  }

  getState(): SnakeState {
    return {
      body: this.body,
      dir: this.dir,
      food: this.food,
      score: this.score,
      foodEaten: this.foodEaten,
      level: this.level,
      gameOver: this.gameOver,
      won: this.won,
    };
  }
}

export function drawSnake(
  ctx: CanvasRenderingContext2D,
  state: SnakeState,
  skin: SkinId = 'clasica',
): void {
  const p = SNAKE_SKINS[skin];
  ctx.fillStyle = p.background;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.strokeStyle = p.grid;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * CELL, 0);
    ctx.lineTo(c * CELL, CANVAS_HEIGHT);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL);
    ctx.lineTo(CANVAS_WIDTH, r * CELL);
    ctx.stroke();
  }

  // Comida
  ctx.shadowColor = p.foodOuter;
  ctx.shadowBlur = p.foodGlow;
  ctx.fillStyle = p.foodOuter;
  ctx.fillRect(state.food.x * CELL + 4, state.food.y * CELL + 4, CELL - 8, CELL - 8);
  ctx.fillStyle = p.foodInner;
  ctx.fillRect(state.food.x * CELL + 7, state.food.y * CELL + 7, CELL - 14, CELL - 14);

  // Cuerpo y cabeza
  ctx.shadowColor = p.bodyGlowColor;
  ctx.shadowBlur = p.bodyGlow;
  state.body.forEach((c, i) => {
    ctx.fillStyle = i === 0 ? p.head : p.body;
    ctx.fillRect(c.x * CELL + 1, c.y * CELL + 1, CELL - 2, CELL - 2);
  });
  ctx.shadowBlur = 0;

  if (state.gameOver) {
    ctx.fillStyle = p.overlay;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.textAlign = 'center';
    ctx.fillStyle = p.gameOverText;
    ctx.font = 'bold 40px monospace';
    ctx.fillText(state.won ? 'YOU WIN' : 'GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 10);
    ctx.fillStyle = p.scoreText;
    ctx.font = '18px monospace';
    ctx.fillText(`PUNTOS ${state.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 28);
    ctx.textAlign = 'left';
  }
}

export const snakeDefinition: GameDefinition<SnakeState> = {
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  create: () => new SnakeGame(),
  draw: drawSnake,
  isGameOver: (state) => state.gameOver,
  getScore: (state) => state.score,
  getProgress: (state) => state.level,
  hasWon: (state) => state.won,
};
