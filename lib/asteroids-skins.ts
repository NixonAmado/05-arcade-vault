import type { SkinId } from './game-engine';

export interface SkinPalette {
  background: string;
  ship: string;
  thrust: string;
  asteroid: string;
  bullet: string;
  /** Componente "r,g,b" de las partículas; el alpha lo aplica draw(). */
  particleRgb: string;
  /** 0 = sin glow. */
  glow: number;
}

export const SKIN_IDS: SkinId[] = ['clasica', 'neon', 'retro'];

export const SKIN_LABELS: Record<SkinId, string> = {
  clasica: 'CLÁSICA',
  neon: 'NEON',
  retro: 'RETRO',
};

export const ASTEROIDS_SKINS: Record<SkinId, SkinPalette> = {
  clasica: {
    background: '#000',
    ship: '#fff',
    thrust: 'rgba(255, 130, 0, 0.85)',
    asteroid: '#fff',
    bullet: '#fff',
    particleRgb: '255,255,255',
    glow: 0,
  },
  neon: {
    background: '#05000f',
    ship: '#39ff14',
    thrust: 'rgba(255, 230, 0, 0.9)',
    asteroid: '#00f0ff',
    bullet: '#ff2bd6',
    particleRgb: '255,43,214',
    glow: 12,
  },
  retro: {
    background: '#0a1f0a',
    ship: '#9bff9b',
    thrust: 'rgba(51, 255, 51, 0.85)',
    asteroid: '#33ff33',
    bullet: '#9bff9b',
    particleRgb: '51,255,51',
    glow: 0,
  },
};
