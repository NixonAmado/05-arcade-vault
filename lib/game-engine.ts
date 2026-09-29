export interface GameEngine<TState = unknown> {
  update(dt: number): void;
  getState(): TState;
  setKeyDown(code: string): void;
  setKeyUp(code: string): void;
  reset(): void;
}

export interface GameDefinition<TState = unknown> {
  width: number;
  height: number;
  create(): GameEngine<TState>;
  draw(ctx: CanvasRenderingContext2D, state: TState): void;
  isGameOver(state: TState): boolean;
  getScore(state: TState): number;
  getProgress(state: TState): number;
  hasWon(state: TState): boolean;
}
