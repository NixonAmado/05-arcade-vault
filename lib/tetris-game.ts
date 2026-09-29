import type { GameDefinition, GameEngine } from './game-engine';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const PANEL_WIDTH = 140;

const BOARD_WIDTH = COLS * BLOCK; // 300
const BOARD_HEIGHT = ROWS * BLOCK; // 600
const CANVAS_WIDTH = BOARD_WIDTH + PANEL_WIDTH; // 440
const CANVAS_HEIGHT = BOARD_HEIGHT; // 600

const LINE_SCORES = [0, 100, 300, 500, 800];

const COLORS: (string | null)[] = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#9e9e9e', // N - tuerca (gris metálico)
];

const PIECES: number[][][] = [
  [],
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N (tuerca)
];

export interface TetrisPiece {
  type: number;
  shape: number[][];
  x: number;
  y: number;
}

export interface TetrisState {
  board: number[][];
  current: TetrisPiece;
  next: TetrisPiece;
  score: number;
  lines: number;
  level: number;
  gameOver: boolean;
}

function createBoard(): number[][] {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece(): TetrisPiece {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

function collide(board: number[][], shape: number[][], ox: number, oy: number): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape: number[][]): number[][] {
  const rows = shape.length;
  const cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      result[c][rows - 1 - r] = shape[r][c];
    }
  }
  return result;
}

function pieceGhostY(board: number[][], piece: TetrisPiece): number {
  let gy = piece.y;
  while (!collide(board, piece.shape, piece.x, gy + 1)) gy++;
  return gy;
}

export class TetrisGame implements GameEngine<TetrisState> {
  private board!: number[][];
  private current!: TetrisPiece;
  private next!: TetrisPiece;
  private score = 0;
  private lines = 0;
  private level = 1;
  private gameOver = false;
  private dropInterval = 1000;
  private dropAccum = 0;

  constructor() {
    this.resetState();
  }

  private resetState(): void {
    this.board = createBoard();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.gameOver = false;
    this.dropInterval = 1000;
    this.dropAccum = 0;
    this.next = randomPiece();
    this.spawn();
  }

  private spawn(): void {
    this.current = this.next;
    this.next = randomPiece();
    if (collide(this.board, this.current.shape, this.current.x, this.current.y)) {
      this.gameOver = true;
    }
  }

  private merge(): void {
    for (let r = 0; r < this.current.shape.length; r++) {
      for (let c = 0; c < this.current.shape[r].length; c++) {
        if (this.current.shape[r][c]) {
          this.board[this.current.y + r][this.current.x + c] = this.current.shape[r][c];
        }
      }
    }
  }

  private clearLines(): void {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.board[r].every((v) => v !== 0)) {
        this.board.splice(r, 1);
        this.board.unshift(new Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      this.lines += cleared;
      this.score += (LINE_SCORES[cleared] || 0) * this.level;
      this.level = Math.floor(this.lines / 10) + 1;
      this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 90);
    }
  }

  private lockPiece(): void {
    this.merge();
    this.clearLines();
    this.spawn();
  }

  private tryRotate(): void {
    const rotated = rotateCW(this.current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collide(this.board, rotated, this.current.x + kick, this.current.y)) {
        this.current.shape = rotated;
        this.current.x += kick;
        return;
      }
    }
  }

  private hardDrop(): void {
    const gy = pieceGhostY(this.board, this.current);
    this.score += (gy - this.current.y) * 2;
    this.current.y = gy;
    this.lockPiece();
  }

  private softDrop(): void {
    if (!collide(this.board, this.current.shape, this.current.x, this.current.y + 1)) {
      this.current.y++;
      this.score += 1;
    } else {
      this.lockPiece();
    }
  }

  update(dt: number): void {
    if (this.gameOver) return;
    this.dropAccum += dt * 1000;
    if (this.dropAccum >= this.dropInterval) {
      this.dropAccum = 0;
      if (!collide(this.board, this.current.shape, this.current.x, this.current.y + 1)) {
        this.current.y++;
      } else {
        this.lockPiece();
      }
    }
  }

  getState(): TetrisState {
    return {
      board: this.board,
      current: this.current,
      next: this.next,
      score: this.score,
      lines: this.lines,
      level: this.level,
      gameOver: this.gameOver,
    };
  }

  setKeyDown(code: string): void {
    if (this.gameOver) return;
    switch (code) {
      case 'ArrowLeft':
        if (!collide(this.board, this.current.shape, this.current.x - 1, this.current.y)) {
          this.current.x--;
        }
        break;
      case 'ArrowRight':
        if (!collide(this.board, this.current.shape, this.current.x + 1, this.current.y)) {
          this.current.x++;
        }
        break;
      case 'ArrowDown':
        this.softDrop();
        break;
      case 'ArrowUp':
      case 'KeyX':
        this.tryRotate();
        break;
      case 'Space':
        this.hardDrop();
        break;
    }
  }

  setKeyUp(): void {
    // Todas las acciones de Caída son discretas por pulsación (ver setKeyDown);
    // no hay tecla "sostenida" que soltar.
  }

  reset(): void {
    this.resetState();
  }
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  colorIndex: number,
  size: number,
  alpha = 1
): void {
  if (!colorIndex) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = COLORS[colorIndex] as string;
  ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  ctx.globalAlpha = 1;
}

export function drawTetris(ctx: CanvasRenderingContext2D, state: TetrisState): void {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, BOARD_HEIGHT);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(BOARD_WIDTH, r * BLOCK);
    ctx.stroke();
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      drawBlock(ctx, c, r, state.board[r][c], BLOCK);
    }
  }

  const gy = pieceGhostY(state.board, state.current);
  for (let r = 0; r < state.current.shape.length; r++) {
    for (let c = 0; c < state.current.shape[r].length; c++) {
      if (state.current.shape[r][c]) {
        drawBlock(ctx, state.current.x + c, gy + r, state.current.shape[r][c], BLOCK, 0.2);
      }
    }
  }

  for (let r = 0; r < state.current.shape.length; r++) {
    for (let c = 0; c < state.current.shape[r].length; c++) {
      drawBlock(ctx, state.current.x + c, state.current.y + r, state.current.shape[r][c], BLOCK);
    }
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(BOARD_WIDTH, 0);
  ctx.lineTo(BOARD_WIDTH, CANVAS_HEIGHT);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('SIGUIENTE', BOARD_WIDTH + 16, 24);

  const NB = 28;
  const previewX = BOARD_WIDTH + 20;
  const previewY = 40;
  const offX = Math.floor((4 - state.next.shape[0].length) / 2);
  const offY = Math.floor((4 - state.next.shape.length) / 2);
  for (let r = 0; r < state.next.shape.length; r++) {
    for (let c = 0; c < state.next.shape[r].length; c++) {
      const val = state.next.shape[r][c];
      if (!val) continue;
      ctx.fillStyle = COLORS[val] as string;
      ctx.fillRect(
        previewX + (offX + c) * NB + 1,
        previewY + (offY + r) * NB + 1,
        NB - 2,
        NB - 2
      );
    }
  }
}

export const tetrisDefinition: GameDefinition<TetrisState> = {
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  create: () => new TetrisGame(),
  draw: drawTetris,
  isGameOver: (state) => state.gameOver,
  getScore: (state) => state.score,
  getProgress: (state) => state.level,
  hasWon: () => false,
};
