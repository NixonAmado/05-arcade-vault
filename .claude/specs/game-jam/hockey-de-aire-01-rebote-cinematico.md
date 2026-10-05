# hockey-de-aire — HOCKEY DE AIRE (Enfoque A: rebote cinemático)

**Estado:** Borrador
**Depende de:** 05-leaderboard-y-tabla-juegos, 06-caida-tetris (registro `GAME_ENGINES` y `game_sessions.game_id` ya existentes)
**Fecha:** 2026-10-05
**Objetivo:** Agregar HOCKEY DE AIRE, un duelo 1 vs CPU de partidos a 5 goles con 5 rivales de dificultad creciente, como primer juego real de la categoría VERSUS, con un motor cinemático simple (rebotes por reflexión de ejes).

## Por qué existe esta spec

El catálogo tiene 4 juegos reales: `asteroids` (SHOOTER), `caida` (PUZZLE), `vibora` y `frogger` (ARCADE). **VERSUS no tiene ningún juego real** y no hay mocks pendientes (`references/implemented-games.md`). Un enfrentamiento contra la CPU cubre el hueco sin netcode ni multijugador real, que están fuera de alcance. Hockey de aire no figura en `references/game-suggestion-todo.md` ni en la memoria de `game-planner`, y no repite ningún tema de `.claude/specs/game-jam/` (snake, frogger). No hay fuente en `references/started-games/`, así que se escribe desde cero.

No requiere migraciones ni tocar `GamePlayer.tsx`: se agrega un módulo en `lib/` y una entrada en el registro.

Este enfoque prioriza llegar rápido a algo jugable y predecible: la pastilla es un punto con velocidad que rebota reflejando el eje, y el mazo del jugador se mueve a velocidad constante.

## Diferencia con la spec alternativa

Esta es la variante **A** de dos. La variante **B** está en `hockey-de-aire-02-fisica-impulsos.md`. Mismo juego, mismo scoring y mismo mapeo a `game_sessions`. Difieren en:

- **Arquitectura del motor:**
  - A: cinemática. La pastilla y los mazos son círculos, pero el choque mazo-pastilla solo **redirige** la pastilla (dirección según el punto de contacto, rapidez fija por nivel + golpe). Paredes = reflexión de eje. Sin masa ni fricción.
  - B: física de impulsos con masa, fricción, restitución y velocidad del mazo transferida a la pastilla.
- **Estrategia de input/estado:**
  - A: el mazo se mueve a velocidad constante mientras la tecla esté sostenida (velocidad = estado instantáneo, sin inercia).
  - B: las teclas aplican aceleración; el mazo tiene inercia.
- **CPU:** A sigue la `y` de la pastilla con velocidad máxima y zona muerta (reactiva). B predice la trayectoria con rebotes y error de reacción.

**Trade-off.** A es de bajo riesgo, determinista y fácil de afinar a mano; el juego se siente "tipo Pong". Pierde el feeling físico de golpear con fuerza. **Elegir esta si** querés el primer VERSUS rápido y robusto. **Elegir la otra si** querés que se sienta realmente como hockey de aire y aceptás más tuning y riesgo de bugs de colisión (tunneling).

## Alcance

**Incluye:**

- **Motor `lib/airhockey-game.ts`:** clase `AirHockeyGame` que implementa `GameEngine<AirHockeyState>`.
  - Canvas **800×480**, mesa horizontal. El jugador defiende la portería izquierda y la CPU la derecha. Portería = hueco de 140 px centrado en cada lado corto.
  - Mazos: radio 32. La pastilla: radio 14. Cada mazo queda confinado a su mitad de la mesa.
  - Pastilla: posición y velocidad en floats; rebote en paredes superior/inferior y en los laterales fuera del hueco de portería (reflexión de eje, sin pérdida). Cuando entra en un hueco es gol.
  - Choque mazo-pastilla: se separa la pastilla del mazo y su nueva dirección es el vector centro mazo → centro pastilla; la rapidez pasa a `puckSpeed(nivel) + 60` (tope `MAX_PUCK_SPEED`). Entre golpes la rapidez decae suavemente al valor base.
  - Subpasos: `update(dt)` subdivide `dt` en pasos de máx. 4 ms para evitar tunneling a alta rapidez (`GamePlayer` capa `dt` en 0.05 s).
- **Partido:** primero en 5 goles. Tras cada gol, 1 s de pausa, la pastilla se saca desde el centro hacia quien recibió el gol.
- **Niveles = rivales:** 5 rivales. Cada victoria sube de nivel (reinicia marcador); la CPU es más rápida y la pastilla más veloz.
  - `cpuSpeed(n) = 220 + 60*(n-1)` px/s, zona muerta decreciente.
- **Fin de partida:** pierde el partido → `gameOver`. Gana el nivel 5 → `won = true` y `gameOver`.
- **Puntuación (monotónica):** gol a favor = `100 × nivel`; ganar un partido = `+500 × nivel`. Los goles en contra no restan.
- **Input:** `ArrowUp/ArrowDown/ArrowLeft/ArrowRight` y WASD sostenidos. `setKeyDown`/`setKeyUp` mantienen un `Set` de teclas; el mazo se mueve a 360 px/s en 8 direcciones (diagonal normalizada).
- **`drawAirHockey(ctx, state)`** en el mismo módulo: mesa, línea central, porterías con brillo, mazos (cyan jugador, magenta CPU), pastilla amarilla, marcador grande, overlays "GOL", "NIVEL N" y "GAME OVER"/"VICTORIA". Solo lee el estado.
- **Registro:** `hockey: airHockeyDefinition` en `lib/game-engines.ts`.
- **Catálogo `lib/games.ts`:** `id: "hockey"`, `title: "HOCKEY DE AIRE"`, `cat: "VERSUS"`, `cover: "cover-hockey"`, `color: "cyan"`, `best: 0`, `plays: "0"`. Agregar estilo `cover-hockey` en `app/globals.css` (copiar patrón de `cover-snake`/`cover-asteroids`).
- **Documentación:** actualizar `references/implemented-games.md` y el listado de CLAUDE.md al terminar.

**No incluye (para specs futuras):**

- Multijugador local de dos personas o en red (VERSUS real).
- Física con masa/fricción/spin (es la variante B).
- Power-ups, obstáculos en la mesa, modos de tiempo.
- Skins, controles táctiles y sonido (los cubren `skin-designer` y `mobile-porter` después).
- Mouse como control.
- HUD de vidas genérico: el HUD de `GamePlayer` muestra los corazones estáticos como en VÍBORA; limitación conocida.

## Modelo de datos

```ts
// lib/airhockey-game.ts (forma del estado, no del motor completo)
interface Vec { x: number; y: number }

export interface AirHockeyState {
  puck: Vec & { vx: number; vy: number };
  player: Vec;          // centro del mazo del jugador
  cpu: Vec;             // centro del mazo de la CPU
  playerGoals: number;  // marcador del partido actual (0..5)
  cpuGoals: number;
  level: number;        // 1..5, rival actual
  score: number;
  serveTimer: number;   // segundos restantes de pausa tras gol
  banner: "" | "GOL" | "NIVEL" | "RIVAL";
  gameOver: boolean;
  won: boolean;
}
// Interno: Set<string> de teclas, rapidez base de pastilla, objetivo de la CPU.
```

**Contrato de `getState()`:** devuelve un objeto nuevo en cada llamada (snapshot con `puck`, `player`, `cpu` copiados) para que el HUD de `GamePlayer` se re-renderice (mismo contrato que `snake-game.ts` y `tetris-game.ts`).

| Campo `GameDefinition` | Valor |
|---|---|
| `width` / `height` | 800 / 480 |
| `create` | `() => new AirHockeyGame()` |
| `draw` | `drawAirHockey` |
| `isGameOver` | `s => s.gameOver` |
| `getScore` | `s => s.score` |
| `getProgress` | `s => s.level` |
| `hasWon` | `s => s.won` |

**Mapeo a `game_sessions`** (sin migración):

| Columna | HOCKEY DE AIRE |
|---|---|
| `game_id` | `'hockey'` |
| `score` | puntaje acumulado (`100×nivel` por gol + `500×nivel` por partido ganado) |
| `wave_completed` | nivel (rival) alcanzado, 1..5 |
| `won` | `true` solo si venció a los 5 rivales |
| `duration_seconds` | lo calcula `GamePlayer` |

## Pasos de implementación

1. Crear `lib/airhockey-game.ts` con tipos, constantes de mesa, tamaños, `BASE_PUCK_SPEED`, `MAX_PUCK_SPEED`, `GOALS_TO_WIN=5`, `MAX_LEVEL=5`.
2. Implementar `AirHockeyGame`: constructor/`reset()`, `setKeyDown`/`setKeyUp` (Set de teclas, `preventDefault` lo hace el componente como en los otros juegos), `getState()` con snapshot.
3. `update(dt)`: manejar `serveTimer`; mover mazo del jugador con clamp a su mitad; subpasos de 4 ms para pastilla (mover, rebotar en paredes, detectar goles, colisionar con mazos).
4. IA de la CPU: objetivo = `y` de la pastilla si está en su mitad y se acerca; si no, volver a posición de defensa; mover a `cpuSpeed(nivel)` con zona muerta; clamp a su mitad.
5. Lógica de marcador/niveles: sumar score, comprobar fin de partido, subir de nivel, reiniciar marcador y mostrar banner; `won`/`gameOver` al terminar.
6. Implementar `drawAirHockey` y exportar `airHockeyDefinition`.
7. Registrar `hockey` en `lib/game-engines.ts`; agregar la entrada a `lib/games.ts` y `cover-hockey` en `app/globals.css`.
8. `npm run lint` y `npm run build`.
9. Verificación manual (abajo) y actualizar `references/implemented-games.md`.

## Decisiones

- **Sí: id `hockey`, título "HOCKEY DE AIRE".** UI en español, id corto, sin colisión.
- **Sí: VERSUS contra CPU.** Cubre la categoría sin netcode; el score se mantiene monotónico y comparable.
- **Sí: mesa horizontal 800×480.** Teclado cómodo (izquierda/derecha avanza hacia la CPU) y tamaño ya soportado por el layout (Asteroids usa 800×600).
- **Sí: subpasos de 4 ms.** Evita tunneling con la pastilla rápida y el `dt` de hasta 50 ms.
- **Sí: `won` = vencer a los 5 rivales; la derrota termina la sesión.** Modo "torneo", un resultado claro para el leaderboard.
- **Sí: goles en contra no restan score.** Mantiene el score monotónico.
- **No: física realista.** Se deja a la variante B.
- **No: tocar `GamePlayer.tsx`.** El registro de la spec 06 basta.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Pastilla atascada entre mazo y pared | Tras colisionar se reposiciona fuera del mazo y se re-aplica el clamp a la mesa |
| CPU imbatible o trivial | Constantes `cpuSpeed`/zona muerta aisladas, afinar en verificación manual |
| Sesiones eternas por pastilla sin goles | Si la rapidez base garantiza cruce de mesa y la CPU falla por velocidad limitada, no hay punto muerto; añadir saque forzado tras 20 s sin gol si ocurriera |
| HUD con vidas estáticas | Limitación documentada |

## Verificación

1. `npm run lint` y `npm run build` sin errores.
2. `/juego/hockey` muestra la ficha con categoría VERSUS; `/juego/hockey/jugar` monta un canvas 800×480.
3. **Mecánica:** flechas/WASD mueven el mazo en 8 direcciones sin salir de su mitad; la pastilla rebota en paredes; golpearla con el mazo la redirige según el punto de contacto; un gol muestra "GOL", suma `100×nivel` y reinicia el saque tras 1 s.
4. **CPU:** defiende, falla a veces; en el nivel 5 es notablemente más rápida que en el 1.
5. **Niveles:** al llegar a 5 goles pasa al nivel siguiente, marcador a 0, HUD con nivel +1 y `+500×nivel`.
6. **Fin:** perder (CPU a 5) da game over; ganar el nivel 5 da `won`.
7. **Guardado:** en game over `execute_sql`:
   `select game_id, score, wave_completed, won from game_sessions where game_id = 'hockey' order by played_at desc limit 1;`
   Debe coincidir con el HUD.
8. **Leaderboards:** HOCKEY DE AIRE aparece vía `PLAYABLE_GAMES` sin mezclar puntajes.
9. **Regresión:** los otros 4 juegos siguen igual.
