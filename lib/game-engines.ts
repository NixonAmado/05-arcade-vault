import type { GameDefinition } from "@/lib/game-engine";
import { asteroidsDefinition } from "@/lib/asteroids-game";
import { tetrisDefinition } from "@/lib/tetris-game";
import { snakeDefinition } from "@/lib/snake-game";

export const GAME_ENGINES: Record<string, GameDefinition> = {
  asteroids: asteroidsDefinition,
  caida: tetrisDefinition,
  vibora: snakeDefinition,
};
