# Juegos implementados

Este archivo lista los juegos de `lib/games.ts` que tienen un motor real registrado en `lib/game-engines.ts` (`GAME_ENGINES`) y son jugables — no simples mocks de catálogo. Se determina con `Object.keys(GAME_ENGINES)`, verificado contra la base de Supabase (tabla `game_sessions`, columna `game_id`).

| id (`game.id`) | Título | Categoría | Motor / definición | Spec |
|---|---|---|---|---|
| `asteroids` | ASTEROIDS | SHOOTER | `lib/asteroids-game.ts` (`asteroidsDefinition`) | `.claude/specs/04-asteroids-game.md` |
| `caida` | CAÍDA (Tetris) | PUZZLE | `lib/tetris-game.ts` (`tetrisDefinition`) | `.claude/specs/06-caida-tetris.md` |

## Cómo se determinan

- `components/GamePlayer.tsx` resuelve `engineDef = GAME_ENGINES[game.id]`; si no hay entrada, muestra el placeholder visual (juego mock, no jugable).
- `components/LeaderboardGlobal.tsx`, `components/LeaderboardPersonal.tsx` y `components/GamesTable.tsx` filtran `PLAYABLE_GAMES = GAMES.filter((g) => g.id in GAME_ENGINES)` — solo estos dos juegos aparecen en leaderboards/tablas.
- La tabla `game_sessions` (Supabase, proyecto `bcafdhulvleiegisroth`) tiene columna `game_id` para distinguir sesiones por juego; a la fecha (2026-09-29) no tiene filas registradas.

## Resto del catálogo (`lib/games.ts`)

Todas las demás entradas (id ≠ `asteroids`/`caida`) son mocks de catálogo sin motor: datos de portada/categoría para completar la grilla, pero sin `GameDefinition` registrada ni posibilidad real de jugar.

Para agregar un nuevo juego a esta lista, usar la skill `add-arcade-game` (`.claude/skills/add-arcade-game/SKILL.md`) y actualizar este archivo al terminar.
