import type { SkinId } from './game-engine';

export interface FroggerSkinPalette {
  grass: string;
  goalBg: string;
  goalMouth: string;
  goalBorder: string;
  river: string;
  riverWave: string;
  road: string;
  roadLine: string;
  frog: string;
  frogDark: string;
  frogEye: string;
  frogPupil: string;
  log: string;
  logLine: string;
  turtle: string;
  turtleShell: string;
  turtleSubmerged: string;
  truck: string;
  truckCargo: string;
  truckWindow: string;
  cars: string[];
  carWindow: string;
  wheel: string;
  hudBg: string;
  overlay: string;
  text: string;
  timeHigh: string;
  timeMid: string;
  timeLow: string;
  /** Glow (shadowBlur) de la rana; 0 = sin glow. */
  frogGlow: number;
  /** Glow de vehículos/troncos/tortugas; 0 = sin glow. */
  objectGlow: number;
}

export const FROGGER_SKINS: Record<SkinId, FroggerSkinPalette> = {
  // Colores originales del juego.
  clasica: {
    grass: '#0a3a1a',
    goalBg: '#032412',
    goalMouth: '#0f7a3a',
    goalBorder: '#f5c400',
    river: '#001a4a',
    riverWave: 'rgba(0,160,255,0.18)',
    road: '#111118',
    roadLine: 'rgba(255,255,255,0.25)',
    frog: '#2dff7a',
    frogDark: '#12a64a',
    frogEye: '#ffffff',
    frogPupil: '#000000',
    log: '#7a4a1a',
    logLine: '#4a2a0a',
    turtle: '#1fae5a',
    turtleShell: '#0d6b34',
    turtleSubmerged: 'rgba(31,174,90,0.35)',
    truck: '#8a8a99',
    truckCargo: '#5c5c6b',
    truckWindow: '#9fd8ff',
    cars: ['#ff3b3b', '#f5d800', '#2b7bff'],
    carWindow: 'rgba(0,0,0,0.35)',
    wheel: '#000000',
    hudBg: 'rgba(0,0,0,0.7)',
    overlay: 'rgba(0,0,0,0.65)',
    text: '#ffffff',
    timeHigh: '#2dff7a',
    timeMid: '#f5d800',
    timeLow: '#ff3b3b',
    frogGlow: 0,
    objectGlow: 0,
  },
  // Alto contraste, cian/magenta/verde fosforescente, con glow.
  neon: {
    grass: '#12002e',
    goalBg: '#05000f',
    goalMouth: '#2a0a5e',
    goalBorder: '#ff2bd6',
    river: '#020024',
    riverWave: 'rgba(0,240,255,0.3)',
    road: '#05000f',
    roadLine: 'rgba(0,240,255,0.45)',
    frog: '#39ff14',
    frogDark: '#00c853',
    frogEye: '#ffffff',
    frogPupil: '#05000f',
    log: '#ff2bd6',
    logLine: '#7a0f66',
    turtle: '#00f0ff',
    turtleShell: '#005f73',
    turtleSubmerged: 'rgba(0,240,255,0.4)',
    truck: '#b14dff',
    truckCargo: '#5a1fa8',
    truckWindow: '#00f0ff',
    cars: ['#ff2bd6', '#ffe600', '#00f0ff'],
    carWindow: 'rgba(5,0,15,0.55)',
    wheel: '#05000f',
    hudBg: 'rgba(5,0,15,0.8)',
    overlay: 'rgba(5,0,15,0.75)',
    text: '#00f0ff',
    timeHigh: '#39ff14',
    timeMid: '#ffe600',
    timeLow: '#ff2bd6',
    frogGlow: 14,
    objectGlow: 8,
  },
  // Verde fósforo monocromo (4 tonos), sin glow.
  retro: {
    grass: '#143514',
    goalBg: '#0a1f0a',
    goalMouth: '#1f5a1f',
    goalBorder: '#9bff9b',
    river: '#0a1f0a',
    riverWave: 'rgba(51,255,51,0.2)',
    road: '#0a1f0a',
    roadLine: 'rgba(51,255,51,0.3)',
    frog: '#9bff9b',
    frogDark: '#33ff33',
    frogEye: '#0a1f0a',
    frogPupil: '#9bff9b',
    log: '#2a8a2a',
    logLine: '#0a1f0a',
    turtle: '#33ff33',
    turtleShell: '#0a1f0a',
    turtleSubmerged: 'rgba(51,255,51,0.3)',
    truck: '#33ff33',
    truckCargo: '#1f8a1f',
    truckWindow: '#0a1f0a',
    cars: ['#33ff33', '#9bff9b', '#1f8a1f'],
    carWindow: 'rgba(10,31,10,0.6)',
    wheel: '#0a1f0a',
    hudBg: 'rgba(10,31,10,0.85)',
    overlay: 'rgba(10,31,10,0.8)',
    text: '#33ff33',
    timeHigh: '#33ff33',
    timeMid: '#9bff9b',
    timeLow: '#1f8a1f',
    frogGlow: 0,
    objectGlow: 0,
  },
};
