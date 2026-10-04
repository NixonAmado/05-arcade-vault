// ===== lib/frogger-game.ts — motor de Frogger (GameDefinition) =====

import type { GameDefinition, GameEngine, SkinId } from '@/lib/game-engine';
import { FROGGER_SKINS, type FroggerSkinPalette } from '@/lib/frogger-skins';

type Dir = 'up' | 'down' | 'left' | 'right';

export type EntityType = 'car' | 'truck' | 'log' | 'turtle';

interface Entity {
  col: number; // posición horizontal en celdas (puede ser fraccionaria)
  width: number; // ancho en celdas
  type: EntityType;
  submerged?: boolean; // solo tortugas
  phase?: number; // solo tortugas: segundos dentro del ciclo de inmersión
}

interface Lane {
  row: number;
  speed: number; // celdas por segundo
  dir: 1 | -1;
  period: number; // longitud del loop en celdas (>= COLS + ancho máximo)
  entities: Entity[];
}

interface Frog {
  col: number;
  row: number;
  animating: boolean;
  animT: number; // segundos transcurridos del salto
  targetCol: number;
  targetRow: number;
}

export interface FroggerState {
  frog: Frog;
  lanes: Lane[];
  goals: boolean[]; // GOAL_COUNT bocas; true = ocupada
  score: number;
  lives: number;
  level: number;
  timeLeft: number; // segundos
  bestRow: number; // fila más alta alcanzada en la ronda (puntos por avance)
  gameOver: boolean;
}

const COLS = 16;
const ROWS = 14;
const CELL = 40;
const CANVAS_WIDTH = COLS * CELL; // 640
const CANVAS_HEIGHT = ROWS * CELL; // 560

// Zonas (índice de fila, 0 = arriba)
const ROW_GOALS = 0;
const ROW_RIVER_TOP = 1;
const ROW_RIVER_BOT = 6;
const ROW_SAFE_MID = 7;
const ROW_ROAD_TOP = 8;
const ROW_ROAD_BOT = 12;
const ROW_START = 13;

// Bocas destino: 5 bocas de 2 columnas, separadas por 1 columna de muro (cols 1-2, 4-5, 7-8, 10-11, 13-14)
const GOAL_COUNT = 5;
const GOAL_WIDTH = 2;
const GOAL_FIRST_COL = 1;
const GOAL_STRIDE = 3;

const START_COL = COLS / 2 - 1;
const START_LIVES = 3;
const HOP_TIME = 0.12; // s
const BASE_ROUND_TIME = 15; // s
const MIN_ROUND_TIME = 8; // s
const ROUND_TIME_STEP = 1; // s menos por nivel
const SPEED_PER_LEVEL = 1.15; // +15 % por nivel

const TURTLE_VISIBLE = 3; // s
const TURTLE_SUBMERGED = 1.5; // s

const POINTS_PER_ROW = 10;
const POINTS_GOAL = 50;
const POINTS_ROUND = 200;
const POINTS_TIME_FACTOR = 10;

const DELTAS: Record<Dir, { c: number; r: number }> = {
  up: { c: 0, r: -1 },
  down: { c: 0, r: 1 },
  left: { c: -1, r: 0 },
  right: { c: 1, r: 0 },
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

type EntitySpec = [type: EntityType, width: number];

interface LaneSpec {
  row: number;
  speed: number; // celdas/s en nivel 1
  dir: 1 | -1;
  entities: EntitySpec[];
  minGap: number; // hueco mínimo entre entidades (celdas)
  offset: number; // desfase inicial (celdas)
}

const ROAD_LANES: LaneSpec[] = [
  { row: 12, speed: 1.8, dir: 1, entities: [['car', 1], ['car', 1], ['car', 1]], minGap: 4, offset: 0 },
  { row: 11, speed: 2.4, dir: -1, entities: [['truck', 3], ['car', 1]], minGap: 5, offset: 3 },
  { row: 10, speed: 3.0, dir: 1, entities: [['car', 1], ['car', 2], ['car', 1]], minGap: 3, offset: 1 },
  { row: 9, speed: 2.0, dir: -1, entities: [['truck', 2], ['truck', 3]], minGap: 5, offset: 6 },
  { row: 8, speed: 3.8, dir: 1, entities: [['car', 1], ['car', 1]], minGap: 6, offset: 2 },
];

const RIVER_LANES: LaneSpec[] = [
  { row: 6, speed: 1.3, dir: -1, entities: [['turtle', 3], ['turtle', 3]], minGap: 3, offset: 0 },
  { row: 5, speed: 1.7, dir: 1, entities: [['log', 3], ['log', 3], ['log', 3]], minGap: 2, offset: 2 },
  { row: 4, speed: 2.4, dir: -1, entities: [['log', 4], ['log', 4]], minGap: 3, offset: 5 },
  { row: 3, speed: 1.5, dir: 1, entities: [['turtle', 2], ['turtle', 2], ['turtle', 2]], minGap: 3, offset: 1 },
  { row: 2, speed: 2.0, dir: -1, entities: [['log', 2], ['log', 3]], minGap: 3, offset: 4 },
  { row: 1, speed: 1.1, dir: 1, entities: [['log', 3], ['log', 4]], minGap: 3, offset: 0 },
];

function buildLane(spec: LaneSpec, level: number): Lane {
  const widths = spec.entities.map(([, w]) => w);
  const totalW = widths.reduce((a, b) => a + b, 0);
  const maxW = Math.max(...widths);
  const n = spec.entities.length;
  const period = Math.max(COLS + maxW, totalW + n * spec.minGap);
  const gap = (period - totalW) / n; // reparto uniforme del espacio libre

  let cursor = spec.offset;
  const entities = spec.entities.map(([type, width], i) => {
    let col = cursor;
    cursor += width + gap;
    while (col >= COLS) col -= period;
    const e: Entity = { col, width, type };
    if (type === 'turtle') {
      e.phase = (i * (TURTLE_VISIBLE + TURTLE_SUBMERGED)) / n;
      e.submerged = e.phase >= TURTLE_VISIBLE;
    }
    return e;
  });

  return {
    row: spec.row,
    speed: spec.speed * Math.pow(SPEED_PER_LEVEL, level - 1),
    dir: spec.dir,
    period,
    entities,
  };
}

function buildLanes(level: number): Lane[] {
  return [...RIVER_LANES, ...ROAD_LANES].map((spec) => buildLane(spec, level));
}

function roundTime(level: number): number {
  return Math.max(MIN_ROUND_TIME, BASE_ROUND_TIME - (level - 1) * ROUND_TIME_STEP);
}

function newFrog(): Frog {
  return {
    col: START_COL,
    row: ROW_START,
    animating: false,
    animT: 0,
    targetCol: START_COL,
    targetRow: ROW_START,
  };
}

const HIT_MARGIN = 0.2; // celdas de tolerancia a cada lado de la rana en colisiones

function isRoadRow(row: number): boolean {
  return row >= ROW_ROAD_TOP && row <= ROW_ROAD_BOT;
}

function isRiverRow(row: number): boolean {
  return row >= ROW_RIVER_TOP && row <= ROW_RIVER_BOT;
}

function checkRoadCollision(frog: Frog, lanes: Lane[]): boolean {
  if (!isRoadRow(frog.row)) return false;
  const lane = lanes.find((l) => l.row === frog.row);
  if (!lane) return false;
  const left = frog.col + HIT_MARGIN;
  const right = frog.col + 1 - HIT_MARGIN;
  return lane.entities.some((e) => left < e.col + e.width && right > e.col);
}

/** Entidad (y su carril) que sostiene a la rana en el río; null si no hay apoyo. */
function getSupport(frog: Frog, lanes: Lane[]): { lane: Lane; entity: Entity } | null {
  if (!isRiverRow(frog.row)) return null;
  const lane = lanes.find((l) => l.row === frog.row);
  if (!lane) return null;
  const center = frog.col + 0.5;
  const entity = lane.entities.find(
    (e) => center >= e.col && center < e.col + e.width && !(e.type === 'turtle' && e.submerged),
  );
  return entity ? { lane, entity } : null;
}

/** Índice de la boca libre bajo la rana, o -1 si no es una boca o ya está ocupada. */
function checkGoal(frog: Frog, goals: boolean[]): number {
  const col = Math.round(frog.col);
  for (let i = 0; i < GOAL_COUNT; i++) {
    const first = GOAL_FIRST_COL + i * GOAL_STRIDE;
    if (col >= first && col < first + GOAL_WIDTH) return goals[i] ? -1 : i;
  }
  return -1;
}

class FroggerGame implements GameEngine<FroggerState> {
  private frog: Frog = newFrog();
  private lanes: Lane[] = [];
  private goals: boolean[] = [];
  private score = 0;
  private lives = START_LIVES;
  private level = 1;
  private timeLeft = BASE_ROUND_TIME;
  private bestRow = ROW_START;
  private gameOver = false;
  private pendingDir: Dir | null = null;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.frog = newFrog();
    this.lanes = buildLanes(1);
    this.goals = Array.from({ length: GOAL_COUNT }, () => false);
    this.score = 0;
    this.lives = START_LIVES;
    this.level = 1;
    this.timeLeft = roundTime(1);
    this.bestRow = ROW_START;
    this.gameOver = false;
    this.pendingDir = null;
  }

  setKeyDown(code: string): void {
    const dir = KEY_DIRS[code];
    if (dir && !this.gameOver) this.pendingDir = dir;
  }

  setKeyUp(): void {}

  update(dt: number): void {
    if (this.gameOver) return;
    this.moveLanes(dt);

    const frog = this.frog;
    if (!frog.animating && this.pendingDir) {
      this.startHop(this.pendingDir);
      this.pendingDir = null;
    }

    let landed = false;
    if (frog.animating) {
      frog.animT += dt;
      if (frog.animT >= HOP_TIME) {
        frog.col = frog.targetCol;
        frog.row = frog.targetRow;
        frog.animating = false;
        frog.animT = 0;
        landed = true;
      }
    }

    this.resolveFrog(dt, landed);
    if (this.gameOver) return;

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) this.killFrog();
  }

  private moveLanes(dt: number): void {
    for (const lane of this.lanes) {
      for (const e of lane.entities) {
        e.col += lane.speed * lane.dir * dt;
        if (lane.dir > 0 && e.col >= COLS) e.col -= lane.period;
        else if (lane.dir < 0 && e.col + e.width <= 0) e.col += lane.period;
        if (e.type === 'turtle') {
          e.phase = ((e.phase ?? 0) + dt) % (TURTLE_VISIBLE + TURTLE_SUBMERGED);
          e.submerged = e.phase >= TURTLE_VISIBLE;
        }
      }
    }
  }

  private startHop(dir: Dir): void {
    const frog = this.frog;
    const col = Math.round(frog.col);
    const targetCol = col + DELTAS[dir].c;
    const targetRow = frog.row + DELTAS[dir].r;
    if (targetCol < 0 || targetCol >= COLS || targetRow < 0 || targetRow >= ROWS) return;
    frog.col = col;
    frog.animating = true;
    frog.animT = 0;
    frog.targetCol = targetCol;
    frog.targetRow = targetRow;
  }

  /** Colisiones, soporte en el río, metas y puntos por avance. */
  private resolveFrog(dt: number, landed: boolean): void {
    const frog = this.frog;

    if (landed) {
      if (frog.row < this.bestRow) {
        this.score += (this.bestRow - frog.row) * POINTS_PER_ROW;
        this.bestRow = frog.row;
      }
      if (frog.row === ROW_GOALS) {
        const goal = checkGoal(frog, this.goals);
        if (goal < 0) {
          this.killFrog();
        } else {
          this.occupyGoal(goal);
        }
        return;
      }
    }

    if (isRoadRow(frog.row)) {
      if (checkRoadCollision(frog, this.lanes)) this.killFrog();
      return;
    }

    if (isRiverRow(frog.row)) {
      const support = getSupport(frog, this.lanes);
      if (!support) {
        this.killFrog();
        return;
      }
      // Durante el salto la rana no se arrastra: el destino ya está fijado.
      if (!frog.animating) {
        frog.col += support.lane.speed * support.lane.dir * dt;
        if (frog.col < -0.5 || frog.col > COLS - 0.5) this.killFrog();
      }
    }
  }

  private occupyGoal(index: number): void {
    this.goals[index] = true;
    this.score += POINTS_GOAL + Math.floor(this.timeLeft) * POINTS_TIME_FACTOR;
    if (this.goals.every(Boolean)) {
      this.completeRound();
    } else {
      this.respawn();
    }
  }

  private completeRound(): void {
    this.score += POINTS_ROUND;
    this.level += 1;
    this.goals = Array.from({ length: GOAL_COUNT }, () => false);
    this.lanes = buildLanes(this.level);
    this.bestRow = ROW_START;
    this.respawn();
  }

  private respawn(): void {
    this.frog = newFrog();
    this.timeLeft = roundTime(this.level);
    this.pendingDir = null;
  }

  private killFrog(): void {
    this.lives -= 1;
    if (this.lives <= 0) {
      this.lives = 0;
      this.gameOver = true;
      return;
    }
    this.respawn();
  }

  getState(): FroggerState {
    return {
      frog: this.frog,
      lanes: this.lanes,
      goals: this.goals,
      score: this.score,
      lives: this.lives,
      level: this.level,
      timeLeft: this.timeLeft,
      bestRow: this.bestRow,
      gameOver: this.gameOver,
    };
  }
}

// ===== Dibujo =====

const HUD_H = 16;

function setGlow(ctx: CanvasRenderingContext2D, color: string, blur: number): void {
  ctx.shadowColor = color;
  ctx.shadowBlur = Math.min(blur, 6); // blur alto es muy caro en canvas
}

function drawFrogShape(
  ctx: CanvasRenderingContext2D,
  COLORS: FroggerSkinPalette,
  cx: number,
  cy: number,
  scale: number,
  hopping: boolean,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  if (COLORS.frogGlow > 0) setGlow(ctx, COLORS.frog, COLORS.frogGlow);
  ctx.fillStyle = COLORS.frogDark;
  // patas (extendidas durante el salto)
  const reach = hopping ? 16 : 11;
  for (const sx of [-1, 1]) {
    ctx.fillRect(sx * reach - 4, -9, 8, 6);
    ctx.fillRect(sx * reach - 4, 5, 8, 6);
  }
  ctx.fillStyle = COLORS.frog;
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  for (const sx of [-1, 1]) {
    ctx.fillStyle = COLORS.frogEye;
    ctx.beginPath();
    ctx.arc(sx * 6, -8, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.frogPupil;
    ctx.beginPath();
    ctx.arc(sx * 6, -9, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawVehicle(
  ctx: CanvasRenderingContext2D,
  COLORS: FroggerSkinPalette,
  e: Entity,
  y: number,
  dir: 1 | -1,
  colorIdx: number,
): void {
  const x = e.col * CELL;
  const w = e.width * CELL;
  const front = dir > 0 ? x + w : x; // lado hacia donde avanza
  if (e.type === 'truck') {
    const cabW = CELL - 4;
    const cargoX = dir > 0 ? x + 2 : x + cabW + 2;
    if (COLORS.objectGlow > 0) setGlow(ctx, COLORS.truck, COLORS.objectGlow);
    ctx.fillStyle = COLORS.truckCargo;
    ctx.fillRect(cargoX, y + 8, w - cabW - 4, 24);
    ctx.fillStyle = COLORS.truck;
    const cabX = dir > 0 ? front - cabW - 2 : front + 2;
    ctx.fillRect(cabX, y + 10, cabW, 20);
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.truckWindow;
    ctx.fillRect(dir > 0 ? cabX + cabW - 10 : cabX + 2, y + 13, 8, 8);
  } else {
    const carColor = COLORS.cars[colorIdx % COLORS.cars.length];
    if (COLORS.objectGlow > 0) setGlow(ctx, carColor, COLORS.objectGlow);
    ctx.fillStyle = carColor;
    ctx.fillRect(x + 3, y + 11, w - 6, 18);
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.carWindow;
    ctx.fillRect(x + w / 2 - (dir > 0 ? 2 : 8), y + 13, 10, 8);
  }
  ctx.fillStyle = COLORS.wheel;
  for (const wx of [x + 9, x + w - 9]) {
    ctx.beginPath();
    ctx.arc(wx, y + 31, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLog(
  ctx: CanvasRenderingContext2D,
  COLORS: FroggerSkinPalette,
  e: Entity,
  y: number,
): void {
  const x = e.col * CELL;
  const w = e.width * CELL;
  if (COLORS.objectGlow > 0) setGlow(ctx, COLORS.log, COLORS.objectGlow);
  ctx.fillStyle = COLORS.log;
  ctx.fillRect(x + 1, y + 8, w - 2, 24);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = COLORS.logLine;
  ctx.lineWidth = 2;
  for (let i = 8; i < w - 4; i += 14) {
    ctx.beginPath();
    ctx.moveTo(x + i, y + 10);
    ctx.lineTo(x + i, y + 30);
    ctx.stroke();
  }
}

function drawTurtles(
  ctx: CanvasRenderingContext2D,
  COLORS: FroggerSkinPalette,
  e: Entity,
  y: number,
): void {
  for (let i = 0; i < e.width; i++) {
    const cx = (e.col + i) * CELL + CELL / 2;
    const cy = y + CELL / 2;
    if (e.submerged) {
      ctx.strokeStyle = COLORS.turtleSubmerged;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }
    if (COLORS.objectGlow > 0) setGlow(ctx, COLORS.turtle, COLORS.objectGlow);
    ctx.fillStyle = COLORS.turtle;
    ctx.beginPath();
    ctx.arc(cx, cy, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = COLORS.turtleShell;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.moveTo(cx - 9, cy);
    ctx.lineTo(cx + 9, cy);
    ctx.moveTo(cx, cy - 9);
    ctx.lineTo(cx, cy + 9);
    ctx.stroke();
  }
}

export function drawFrogger(
  ctx: CanvasRenderingContext2D,
  state: FroggerState,
  skin: SkinId = 'clasica',
): void {
  const COLORS = FROGGER_SKINS[skin];
  ctx.shadowBlur = 0;

  // Fondo por zonas
  ctx.fillStyle = COLORS.goalBg;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CELL);
  ctx.fillStyle = COLORS.river;
  ctx.fillRect(0, ROW_RIVER_TOP * CELL, CANVAS_WIDTH, (ROW_RIVER_BOT - ROW_RIVER_TOP + 1) * CELL);
  ctx.strokeStyle = COLORS.riverWave;
  ctx.lineWidth = 1;
  for (let r = ROW_RIVER_TOP; r <= ROW_RIVER_BOT; r++) {
    for (let x = (r % 2) * 20; x < CANVAS_WIDTH; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, r * CELL + 20);
      ctx.quadraticCurveTo(x + 10, r * CELL + 14, x + 20, r * CELL + 20);
      ctx.stroke();
    }
  }
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(0, ROW_SAFE_MID * CELL, CANVAS_WIDTH, CELL);
  ctx.fillRect(0, ROW_START * CELL, CANVAS_WIDTH, CELL);
  ctx.fillStyle = COLORS.road;
  ctx.fillRect(0, ROW_ROAD_TOP * CELL, CANVAS_WIDTH, (ROW_ROAD_BOT - ROW_ROAD_TOP + 1) * CELL);
  ctx.strokeStyle = COLORS.roadLine;
  ctx.setLineDash([14, 14]);
  for (let r = ROW_ROAD_TOP + 1; r <= ROW_ROAD_BOT; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL);
    ctx.lineTo(CANVAS_WIDTH, r * CELL);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Bocas destino (bajo la franja de HUD)
  for (let i = 0; i < GOAL_COUNT; i++) {
    const x = (GOAL_FIRST_COL + i * GOAL_STRIDE) * CELL;
    const y = HUD_H + 4;
    const w = GOAL_WIDTH * CELL;
    const h = CELL - HUD_H - 4;
    ctx.fillStyle = COLORS.goalMouth;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = COLORS.goalBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    if (state.goals[i]) drawFrogShape(ctx, COLORS, x + w / 2, y + h / 2, 0.5, false);
  }

  // Entidades de cada carril
  for (const lane of state.lanes) {
    const y = lane.row * CELL;
    lane.entities.forEach((e, i) => {
      if (e.type === 'log') drawLog(ctx, COLORS, e, y);
      else if (e.type === 'turtle') drawTurtles(ctx, COLORS, e, y);
      else drawVehicle(ctx, COLORS, e, y, lane.dir, lane.row + i);
    });
  }

  // Rana (interpolada durante el salto)
  const f = state.frog;
  const t = f.animating ? Math.min(1, f.animT / HOP_TIME) : 0;
  const fx = (f.col + (f.targetCol - f.col) * t) * CELL + CELL / 2;
  const fy = (f.row + (f.targetRow - f.row) * t) * CELL + CELL / 2;
  const squash = f.animating ? 1 + 0.2 * Math.sin(t * Math.PI) : 1;
  if (!state.gameOver) drawFrogShape(ctx, COLORS, fx, fy, squash, f.animating);

  // HUD interno
  ctx.fillStyle = COLORS.hudBg;
  ctx.fillRect(0, 0, CANVAS_WIDTH, HUD_H);
  ctx.font = 'bold 12px monospace';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = 'left';
  ctx.fillText(`PUNTOS ${state.score}`, 8, HUD_H / 2);
  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${state.level}`, CANVAS_WIDTH / 2, HUD_H / 2);
  ctx.fillStyle = COLORS.frog;
  for (let i = 0; i < state.lives; i++) {
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH - 14 - i * 18, HUD_H / 2, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  const frac = Math.max(0, Math.min(1, state.timeLeft / roundTime(state.level)));
  ctx.fillStyle = frac > 0.5 ? COLORS.timeHigh : frac > 0.25 ? COLORS.timeMid : COLORS.timeLow;
  ctx.fillRect(0, HUD_H, CANVAS_WIDTH * frac, 3);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  if (state.gameOver) {
    ctx.fillStyle = COLORS.overlay;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.frog;
    ctx.font = 'bold 40px monospace';
    ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 10);
    ctx.fillStyle = COLORS.text;
    ctx.font = '18px monospace';
    ctx.fillText(`PUNTOS ${state.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 28);
    ctx.textAlign = 'left';
  }
}

export const froggerDefinition: GameDefinition<FroggerState> = {
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  create: () => new FroggerGame(),
  draw: drawFrogger,
  isGameOver: (state) => state.gameOver,
  getScore: (state) => state.score,
  getProgress: (state) => state.level,
  hasWon: () => false,
};
