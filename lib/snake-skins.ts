import type { SkinId } from './game-engine';

export interface SnakeSkinPalette {
  background: string;
  grid: string;
  foodOuter: string;
  foodInner: string;
  /** Glow (shadowBlur) de la comida; 0 = sin glow. */
  foodGlow: number;
  body: string;
  head: string;
  /** Color del glow del cuerpo; 0 en bodyGlow = sin glow. */
  bodyGlowColor: string;
  bodyGlow: number;
  overlay: string;
  gameOverText: string;
  scoreText: string;
}

export const SNAKE_SKINS: Record<SkinId, SnakeSkinPalette> = {
  // Colores originales del juego (verde neón).
  clasica: {
    background: '#000',
    grid: 'rgba(255,255,255,0.06)',
    foodOuter: '#ff2bd6',
    foodInner: '#ffe600',
    foodGlow: 10,
    body: '#39ff14',
    head: '#b8ffa8',
    bodyGlowColor: '#39ff14',
    bodyGlow: 8,
    overlay: 'rgba(0,0,0,0.7)',
    gameOverText: '#39ff14',
    scoreText: '#fff',
  },
  neon: {
    background: '#05000f',
    grid: 'rgba(0,240,255,0.12)',
    foodOuter: '#ff2bd6',
    foodInner: '#ffffff',
    foodGlow: 18,
    body: '#00f0ff',
    head: '#39ff14',
    bodyGlowColor: '#00f0ff',
    bodyGlow: 16,
    overlay: 'rgba(5,0,15,0.75)',
    gameOverText: '#ff2bd6',
    scoreText: '#00f0ff',
  },
  // Verde fósforo monocromo, sin glow.
  retro: {
    background: '#0a1f0a',
    grid: 'rgba(51,255,51,0.08)',
    foodOuter: '#33ff33',
    foodInner: '#0a1f0a',
    foodGlow: 0,
    body: '#33ff33',
    head: '#9bff9b',
    bodyGlowColor: '#33ff33',
    bodyGlow: 0,
    overlay: 'rgba(10,31,10,0.8)',
    gameOverText: '#9bff9b',
    scoreText: '#33ff33',
  },
};
