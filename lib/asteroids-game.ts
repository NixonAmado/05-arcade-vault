import {
  Bullet,
  Asteroid,
  Ship,
  Particle,
  POINTS,
  dist,
  rand,
  wrap,
} from './asteroids-engine';

export type GameStateType = 'playing' | 'dead' | 'gameover';

export interface GameState {
  ship: Ship;
  bullets: Bullet[];
  asteroids: Asteroid[];
  particles: Particle[];
  score: number;
  lives: number;
  level: number;
  state: GameStateType;
  deadTimer: number;
}

export class AsteroidsGame {
  private W: number;
  private H: number;
  private gameState: GameState;
  private keys: Record<string, boolean> = {};
  private justPressed: Record<string, boolean> = {};

  constructor(width: number = 800, height: number = 600) {
    this.W = width;
    this.H = height;
    this.gameState = this.createInitialState();
  }

  private createInitialState(): GameState {
    return {
      ship: new Ship(this.W, this.H),
      bullets: [],
      asteroids: [],
      particles: [],
      score: 0,
      lives: 3,
      level: 1,
      state: 'playing',
      deadTimer: 0,
    };
  }

  private spawnAsteroids(count: number): void {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x, y;
      do {
        x = rand(0, this.W);
        y = rand(0, this.H);
      } while (Math.hypot(x - this.W / 2, y - this.H / 2) < SAFE_DIST);
      this.gameState.asteroids.push(new Asteroid(x, y, 3));
    }
  }

  private nextLevel(): void {
    this.gameState.level++;
    this.gameState.bullets = [];
    this.gameState.particles = [];
    this.gameState.ship.reset();
    this.spawnAsteroids(3 + this.gameState.level);
  }

  private explode(x: number, y: number, count: number = 8): void {
    for (let i = 0; i < count; i++) {
      this.gameState.particles.push(new Particle(x, y));
    }
  }

  private killShip(): void {
    this.explode(this.gameState.ship.x, this.gameState.ship.y, 14);
    this.gameState.ship.dead = true;
    this.gameState.lives--;
    if (this.gameState.lives <= 0) {
      this.gameState.state = 'gameover';
    } else {
      this.gameState.state = 'dead';
      this.gameState.deadTimer = 2;
    }
  }

  private pressed(code: string): boolean {
    const val = this.justPressed[code];
    this.justPressed[code] = false;
    return !!val;
  }

  setKeyDown(code: string): void {
    if (!this.keys[code]) this.justPressed[code] = true;
    this.keys[code] = true;
  }

  setKeyUp(code: string): void {
    this.keys[code] = false;
  }

  reset(): void {
    this.gameState = this.createInitialState();
    this.keys = {};
    this.justPressed = {};
    this.spawnAsteroids(4);
  }

  update(dt: number): void {
    if (this.gameState.state === 'gameover') {
      this.gameState.particles.forEach((p) => p.update(dt));
      this.gameState.particles = this.gameState.particles.filter(
        (p) => !p.dead
      );
      return;
    }

    if (this.gameState.state === 'dead') {
      this.gameState.deadTimer -= dt;
      this.gameState.particles.forEach((p) => p.update(dt));
      this.gameState.particles = this.gameState.particles.filter(
        (p) => !p.dead
      );
      this.gameState.asteroids.forEach((a) => a.update(dt, this.W, this.H));
      if (this.gameState.deadTimer <= 0) {
        this.gameState.state = 'playing';
        this.gameState.ship.reset();
      }
      return;
    }

    // Shoot
    if (this.pressed('Space')) {
      this.gameState.bullets.push(...this.gameState.ship.tryShoot());
    }

    this.gameState.ship.update(dt, this.keys);
    this.gameState.bullets.forEach((b) => b.update(dt, this.W, this.H));
    this.gameState.asteroids.forEach((a) => a.update(dt, this.W, this.H));
    this.gameState.particles.forEach((p) => p.update(dt));

    this.gameState.bullets = this.gameState.bullets.filter((b) => !b.dead);
    this.gameState.particles = this.gameState.particles.filter((p) => !p.dead);

    // Bullet vs asteroid
    const newAsteroids: Asteroid[] = [];
    for (const b of this.gameState.bullets) {
      for (const a of this.gameState.asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          this.gameState.score += POINTS[a.size];
          this.explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
        }
      }
    }
    this.gameState.asteroids = this.gameState.asteroids
      .filter((a) => !a.dead)
      .concat(newAsteroids);
    this.gameState.bullets = this.gameState.bullets.filter((b) => !b.dead);

    // Ship vs asteroid
    if (this.gameState.ship.invincible <= 0) {
      for (const a of this.gameState.asteroids) {
        if (
          dist(this.gameState.ship, a) <
          this.gameState.ship.radius + a.radius * 0.82
        ) {
          this.killShip();
          break;
        }
      }
    }

    // Level complete
    if (this.gameState.asteroids.length === 0) {
      this.nextLevel();
    }
  }

  getState(): GameState {
    return this.gameState;
  }
}
