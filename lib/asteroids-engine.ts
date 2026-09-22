// ── Utils ─────────────────────────────────────────────────────────────────────
export const wrap = (v: number, max: number): number => ((v % max) + max) % max;
export const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
export const rand = (min: number, max: number): number => min + Math.random() * (max - min);
export const randInt = (min: number, max: number): number => Math.floor(rand(min, max + 1));

export interface Point {
  x: number;
  y: number;
}

// ── Bullet ────────────────────────────────────────────────────────────────────
export class Bullet implements Point {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  radius: number = 2;
  dead: boolean = false;

  constructor(x: number, y: number, angle: number) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl = 1.1;
  }

  update(dt: number, W: number, H: number): void {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
export const RADII = [0, 16, 30, 50]; // by size 1, 2, 3
export const SPEEDS = [0, 85, 55, 32]; // base speed by size
export const POINTS = [0, 100, 50, 20]; // points by size

export class Asteroid implements Point {
  x: number;
  y: number;
  size: number;
  radius: number;
  vx: number;
  vy: number;
  rotSpeed: number;
  rot: number;
  verts: [number, number][];
  dead: boolean = false;

  constructor(x: number, y: number, size: number = 3) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.radius = RADII[size];

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Irregular polygon
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt: number, W: number, H: number): void {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split(): Asteroid[] {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
export class Ship implements Point {
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  radius: number = 12;
  thrusting: boolean = false;
  invincible: number;
  shootCooldown: number = 0;
  dead: boolean = false;

  constructor(private W: number, private H: number) {
    this.x = W / 2;
    this.y = H / 2;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.invincible = 3;
  }

  reset(): void {
    this.x = this.W / 2;
    this.y = this.H / 2;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.invincible = 3;
    this.shootCooldown = 0;
    this.dead = false;
  }

  update(dt: number, keysPressed: Record<string, boolean>): void {
    if (this.dead) return;
    if (this.invincible > 0) this.invincible -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;

    const ROT = 3.5; // rad/s
    const THRUST = 260; // px/s²
    const DRAG = 0.987;

    if (keysPressed['ArrowLeft']) this.angle -= ROT * dt;
    if (keysPressed['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keysPressed['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, this.W);
    this.y = wrap(this.y + this.vy * dt, this.H);
  }

  tryShoot(): Bullet[] {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    return [new Bullet(ox, oy, this.angle)];
  }
}

// ── Particle (explosion) ──────────────────────────────────────────────────────
export class Particle implements Point {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  dead: boolean = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl = this.life;
  }

  update(dt: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }
}
