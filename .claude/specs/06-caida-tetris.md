# 06 — Caída (Tetris)

**Estado:** Aprobado
**Depende de:** 04-asteroids-game, 05-leaderboard-y-tabla-juegos
**Fecha:** 2026-09-25
**Objetivo:** Agregar CAÍDA (Tetris) como segundo juego jugable del catálogo, generalizando `GamePlayer.tsx` a un registro de motores y extendiendo `game_sessions`/leaderboard para soportar múltiples juegos.

## Por qué existe esta spec

Hoy solo Asteroids es un juego real; `GamePlayer.tsx` decide con `isAsteroids = game?.id === "asteroids"` y `game_sessions` no tiene columna de juego. CAÍDA es el segundo juego real del catálogo, así que este spec no solo porta Tetris: generaliza esos dos puntos (registro de motores, `game_id`) para que el tercer juego en adelante no vuelva a tocarlos.

## Alcance

**Incluye:**

- Motor `lib/tetris-game.ts`: clase `TetrisGame` (implementa `GameEngine<TetrisState>`) portada de `references/started-games/03-tetris/game.js` — tablero 10×20, las 7 piezas + pieza extra "N" (tuerca), rotación con wall kicks, ghost piece, soft/hard drop, `clearLines`, puntuación (`LINE_SCORES` × nivel), niveles (sube cada 10 líneas, `dropInterval` decrece).
- `drawTetris(ctx, state)` en el mismo módulo: tablero + ghost + pieza actual + panel lateral con vista previa de la siguiente pieza, todo en un único canvas **440×600** (300×600 tablero + 140px panel lateral).
- Interfaz genérica `lib/game-engine.ts` (`GameEngine<TState>`, `GameDefinition<TState>`) y registro `lib/game-engines.ts` (`GAME_ENGINES: Record<string, GameDefinition>`) mapeando `game.id → GameDefinition`. Incluye adaptar `lib/asteroids-game.ts` para exponer su propio `asteroidsDefinition`, moviendo `drawAsteroids` desde `GamePlayer.tsx` al módulo de Asteroids.
- Refactor de `components/GamePlayer.tsx`: reemplaza el branch `isAsteroids` por `const engineDef = GAME_ENGINES[game.id]`. Loop, HUD (Puntuación + Nivel/Progreso) y guardado de sesión quedan genéricos para cualquier `engineDef`. Los mocks sin motor registrado conservan el placeholder visual actual.
- Input de CAÍDA: `setKeyDown` dispara mover/rotar/hard-drop **una vez por pulsación** (edge-triggered, replica el original); `ArrowDown` activa soft-drop mientras la tecla esté sostenida; `P` reutiliza el `paused` genérico que ya maneja `GamePlayer.tsx` (no reimplementa su propio `togglePause`).
- `lib/games.ts`: reemplaza el mock `"caida"` (cat `PUZZLE`) por la entrada real, `best: 0`, `plays: "0"`.
- Migración Supabase: `game_sessions.game_id` (`default 'asteroids'` para backfill, luego `drop default`), índices `game_id` y `(game_id, score desc)`. Aplicada con MCP Supabase (`apply_migration`), tipos regenerados (`generate_typescript_types`).
- `lib/gameSessions.ts`: agrega `fetchSessionsByGame(gameId)` y `fetchSessionsByNicknameAndGame(nickname, gameId)`, sin romper `fetchAllSessions`/`fetchSessionsByNickname` existentes.
- `lib/useLeaderboard.ts`: agrega `computeLeaderboardForGame(sessions, gameId)` y una variante del hook que filtra por juego antes de agrupar.
- `components/LeaderboardGlobal.tsx`, `LeaderboardPersonal.tsx`, `components/GamesTable.tsx`: selector de juego (Asteroids / Caída) que filtra por `game_id`.
- Guardado de partida (`GamePlayer.tsx`): `insertGameSession` recibe `game_id: game.id`, `wave_completed: engineDef.getProgress(state)`, `won: engineDef.hasWon(state)` — el mismo bloque sirve para Asteroids y para CAÍDA.

**No incluye (para specs futuras):**

- Repetición de teclas estilo Tetris moderno (DAS/ARR) — se mantiene fiel al original portado (una acción por pulsación).
- Sonido y controles táctiles/mobile para CAÍDA.
- El toggle de tema claro/oscuro del HTML original de Tetris (`GamePlayer.tsx` ya tiene su propio tema CRT neon).
- Eliminar la ruta standalone `/games/asteroids/play` — solo se señala como candidato a limpieza (ver Decisiones).
- Renombrar `wave_completed`/`won` a nombres neutrales (ej. `progress_value`/`completed`) — se documenta su significado por juego en su lugar.
- Autenticación o rate limiting de inserciones en `game_sessions` (ya fuera de alcance desde SPEC 05).
- Portar el resto del catálogo mock (`bloque-buster`/Arkanoid, etc.) — quedan como placeholder sin motor.

## Modelo de datos

```ts
// lib/game-engine.ts
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
  getProgress(state: TState): number; // nivel para Caída, wave para Asteroids
  hasWon(state: TState): boolean;
}
```

```ts
// lib/tetris-game.ts (forma del estado, no del motor completo)
type Cell = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

interface TetrisPiece {
  type: number;
  shape: Cell[][];
  x: number;
  y: number;
}

export interface TetrisState {
  board: Cell[][];       // ROWS(20) x COLS(10)
  current: TetrisPiece;
  next: TetrisPiece;
  score: number;
  lines: number;
  level: number;
  gameOver: boolean;
}
```

```sql
alter table public.game_sessions
  add column game_id text not null default 'asteroids';

alter table public.game_sessions
  alter column game_id drop default;

create index game_sessions_game_id_idx on public.game_sessions (game_id);
create index game_sessions_game_id_score_idx on public.game_sessions (game_id, score desc);
```

```ts
// types/index.ts — GameSession ahora incluye game_id (vía types/supabase.ts regenerado)
interface GameSession {
  id: string;
  game_id: string;       // 'asteroids' | 'caida'
  nickname: string;
  score: number;
  wave_completed: number; // Asteroids: wave (5 = victoria). Caída: nivel alcanzado.
  won: boolean;            // Asteroids: wave_completed >= 5. Caída: siempre false (endless).
  duration_seconds: number;
  played_at: string;
}
```

## Plan de implementación

1. Crear `lib/game-engine.ts` con las interfaces `GameEngine<TState>` y `GameDefinition<TState>`.
2. Adaptar `lib/asteroids-game.ts`: mover `drawAsteroids` (hoy en `GamePlayer.tsx`) al módulo y exportar `asteroidsDefinition: GameDefinition<AsteroidsState>`.
3. Portar el motor de Tetris a `lib/tetris-game.ts`: clase `TetrisGame` (constructor, `update(dt)`, `getState()`, `setKeyDown`/`setKeyUp` edge-triggered, `reset()`), separando estado puro de canvas/DOM. Incluye `drawTetris(ctx, state)` (tablero + ghost + panel con next piece) y exporta `tetrisDefinition: GameDefinition<TetrisState>` (width 440, height 600).
4. Crear `lib/game-engines.ts` con `GAME_ENGINES = { asteroids: asteroidsDefinition, caida: tetrisDefinition }`.
5. Refactor `components/GamePlayer.tsx`: reemplazar `isAsteroids` por `GAME_ENGINES[game.id]`; loop/HUD/guardado genéricos; placeholder visual solo cuando no hay `engineDef` registrado.
6. Reemplazar el mock `"caida"` en `lib/games.ts` por la entrada real (`best: 0`, `plays: "0"`); agregar estilo `cover-caida` en `app/globals.css` si se necesita distinto de `cover-tetro`.
7. Migración Supabase (MCP `apply_migration`): agregar `game_id` a `game_sessions` (default `'asteroids'` backfill, luego `drop default`), índices `game_id` y `(game_id, score desc)`. Regenerar `types/supabase.ts` (MCP `generate_typescript_types`).
8. `lib/gameSessions.ts`: agregar `fetchSessionsByGame(gameId)` y `fetchSessionsByNicknameAndGame(nickname, gameId)`.
9. `lib/useLeaderboard.ts`: agregar `computeLeaderboardForGame(sessions, gameId)` y variante del hook que filtra por juego.
10. `components/LeaderboardGlobal.tsx`, `LeaderboardPersonal.tsx`, `GamesTable.tsx`: agregar selector de juego (Asteroids / Caída).
11. Conectar el guardado de partida en `GamePlayer.tsx`: `insertGameSession` con `game_id: game.id`, `wave_completed: engineDef.getProgress(state)`, `won: engineDef.hasWon(state)`.
12. Verificar en `/juego/caida` y `/juego/caida/jugar`: partida completa (mover, rotar, soft/hard drop, limpiar líneas, subir de nivel) hasta game over; confirmar inserción en `game_sessions` con `game_id = 'caida'`; confirmar que Asteroids sigue funcionando igual (`game_id = 'asteroids'` vía backfill).
13. `get_advisors` (MCP Supabase, seguridad) sobre `game_sessions` tras la migración.

Cada paso deja el proyecto compilando (`npm run dev` sin errores).

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` sin errores.
- [ ] `npm run dev`: se puede abrir `/juego/caida` y `/juego/caida/jugar`, jugar una partida completa y llegar a game over.
- [ ] `GamePlayer.tsx` ya no tiene el branch `isAsteroids`; usa `GAME_ENGINES[game.id]` para Asteroids y Caída, y mantiene el placeholder visual para el resto de los mocks.
- [ ] Al terminar una partida de Caída se inserta una fila en `game_sessions` con `game_id = 'caida'`, `wave_completed` = nivel alcanzado, `won = false` (verificable con `execute_sql`, MCP Supabase).
- [ ] El leaderboard global/personal y la tabla de historial permiten filtrar por juego (Asteroids / Caída) sin mezclar sus puntajes en el mismo ranking.
- [ ] Las partidas viejas de Asteroids (sin tocar) siguen apareciendo igual que antes de la migración (`game_id = 'asteroids'` por backfill).
- [ ] `"caida"` aparece en `lib/games.ts` con motor real (ya no es mock), `best`/`plays` en `0`.
- [ ] `get_advisors` (seguridad, MCP Supabase) no reporta hallazgos nuevos sobre `game_sessions`.

## Decisiones tomadas y descartadas

- **Sí: canvas único ampliado (440×600)** para tablero + next piece. Mantiene `GameDefinition` con un solo `draw()`/`ctx`, sin romper el contrato por un detalle visual de un juego.
- **No: canvas secundario específico para Tetris en `GamePlayer.tsx`.** Rompería la genericidad que busca el registro de motores — el objetivo explícito de este spec.
- **Sí: `setKeyDown` edge-triggered para mover/rotar/hard-drop.** Replica el comportamiento del original 1:1; no se inventa una feature nueva.
- **No: repetición tipo DAS/ARR (Tetris moderno).** El original portado no la tiene; agregarla es una feature nueva fuera de alcance.
- **Sí: leaderboard separado por juego con selector.** El score de Caída (potencialmente cientos de miles) no es comparable al de Asteroids (decenas de miles); mezclarlos en un solo ranking sería engañoso.
- **No: ranking único mezclando juegos.** Ver punto anterior.
- **Sí: `wave_completed` = nivel alcanzado, `won` = siempre `false` para Caída.** Tetris portado es modo endless sin condición de victoria clara; se sigue el criterio de la skill `add-arcade-game` para este caso.
- **No: renombrar `wave_completed`/`won` a nombres neutrales.** Es una migración más grande que rompería el spec 05 ya aceptado; se documenta el significado por juego en su lugar.
- **No: eliminar `/games/asteroids/play` en este spec.** Solo se señala como candidato a limpieza; su borrado requiere confirmar antes que no esté enlazada desde ningún lado (criterio de la skill `add-arcade-game`, paso 5).
- **Sí: id de catálogo `"caida"` (no `"tetris"`).** Reutiliza el mock ya existente en `lib/games.ts` y mantiene la UI en español.
- **No: HUD genérico con "Vidas" para Caída.** Tetris no tiene vidas; ese stat del HUD sigue siendo específico de Asteroids hasta que otro juego lo necesite.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| El MCP de Supabase no está autenticado en esta sesión de trabajo | Completar el flujo OAuth (`mcp__supabase__authenticate`) antes de que `/spec-impl` llegue al paso 7 (migración) |
| `game_id` con default temporal durante el backfill | El `default 'asteroids'` se quita explícitamente después de aplicar la migración (paso 7 del plan); no debe quedar permanente |
| El selector de juego cambia la UX actual del leaderboard | Definir en el paso 10 un valor por defecto sensato (ej. el juego desde el que se navegó); no se agrega un tercer modo "general" en este spec |

## Lo que **no** está en este spec

- DAS/ARR ni configuración de dificultad de Tetris.
- Sonido ni controles táctiles.
- Eliminación de `/games/asteroids/play`.
- Generalización de las columnas `wave_completed`/`won` a nombres neutrales.
- Portar el resto del catálogo mock (`bloque-buster`/Arkanoid y los demás).

Cada uno de estos, si se hace, va en su propio spec.
