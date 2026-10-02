export interface GameEngine<TState = unknown> {
  update(dt: number): void;
  getState(): TState;
  setKeyDown(code: string): void;
  setKeyUp(code: string): void;
  reset(): void;
}

export type SkinId = 'clasica' | 'neon' | 'retro';

export interface GameDefinition<TState = unknown> {
  width: number;
  height: number;
  create(): GameEngine<TState>;
  /** `skin` es opcional: los juegos sin soporte de skins lo ignoran. */
  draw(ctx: CanvasRenderingContext2D, state: TState, skin?: SkinId): void;
  isGameOver(state: TState): boolean;
  getScore(state: TState): number;
  getProgress(state: TState): number;
  hasWon(state: TState): boolean;
}
