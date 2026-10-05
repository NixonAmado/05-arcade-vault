# hockey-de-aire — HOCKEY DE AIRE (Enfoque B: física de impulsos con inercia)

**Estado:** Borrador
**Depende de:** 05-leaderboard-y-tabla-juegos, 06-caida-tetris (registro `GAME_ENGINES` y `game_sessions.game_id` ya existentes)
**Fecha:** 2026-10-05
**Objetivo:** Agregar HOCKEY DE AIRE, un duelo 1 vs CPU de partidos a 5 goles con 5 rivales de dificultad creciente, como primer juego real de la categoría VERSUS, con una simulación continua de círculos con masa, fricción e impulsos.

## Por qué existe esta spec

**VERSUS no tiene ningún juego real** en el catálogo (`asteroids` SHOOTER, `caida` PUZZLE, `vibora` y `frogger` ARCADE; `references/implemented-games.md`). Un duelo contra CPU cubre el hueco sin netcode. El tema no está en `references/game-suggestion-todo.md`, en la memoria de `game-planner` ni en `.claude/specs/game-jam/`. Se escribe desde cero (no hay fuente en `references/started-games/`).

Este enfoque apuesta a la sensación del hockey de aire real: el mazo tiene inercia y la fuerza del golpe depende de qué tan rápido lo movés.

## Diferencia con la spec alternativa

Esta es la variante **B** de dos. La variante **A** está en `hockey-de-aire-01-rebote-cinematico.md`. Mismo juego, mismo scoring y mismo mapeo a `game_sessions`. Difieren en:

- **Arquitectura del motor:**
  - A: cinemática, la pastilla solo se redirige con rapidez fija.
  - B: simulación continua con masas (mazo 4, pastilla 1), fricción de la mesa, restitución en paredes (0.92) y colisión círculo-círculo elástica en la que se transfiere la velocidad del mazo.
- **Input/estado:**
  - A: velocidad del mazo constante mientras la tecla esté pulsada.
  - B: las teclas aplican **aceleración**; el mazo tiene velocidad con amortiguación (inercia). Estado mutable de velocidades en el motor.
- **Alcance:** B añade el **tiro cargado**: mantener `Space` acumula carga (hasta 0.8 s) que multiplica el impulso del siguiente golpe (hasta x1.5) a costa de reducir la velocidad máxima del mazo mientras carga.
- **CPU:** A reactiva; B predictiva (simula rebotes para estimar dónde cruzará el eje de defensa) con retardo de reacción y error aleatorio que disminuyen con el nivel.

**Trade-off.** B da mucha más profundidad y feeling, y diferencia al juego de un Pong. Cuesta más: tuning de constantes físicas, riesgo de tunneling/atascos, IA predictiva y más estados para verificar. **Elegir esta si** priorizás la experiencia y aceptás más tiempo y riesgo. **Elegir la otra si** querés lo más simple y seguro.

## Alcance

**Incluye:**

- **Motor `lib/airhockey-game.ts`:** clase `AirHockeyGame` que implementa `GameEngine<AirHockeyState>`.
  - Canvas **800×480**, mesa horizontal, jugador a la izquierda, CPU a la derecha. Hueco de portería de 140 px.
  - Mazos radio 32 (masa 4) confinados a su mitad; pastilla radio 14 (masa 1).
  - Integración de pasos fijos de **1/240 s** con acumulador dentro de `update(dt)` (varios pasos por frame; `GamePlayer` capa `dt` en 0.05 s). Determinista.
  - Fricción: la pastilla aplica `v *= exp(-0.35*h)` por paso (h = 1/240); el mazo `v *= exp(-6*h)` más aceleración de input `ACC = 2600 px/s²`, `MAX_PADDLE_SPEED = 520 px/s`.
  - Colisión círculo-círculo: resolución por impulso a lo largo de la normal con restitución 0.9; corrección de penetración; se trata el mazo como cuerpo de masa 4 limitado a su mitad (si choca con el límite su velocidad normal se anula). Rapidez máxima de pastilla `MAX_PUCK_SPEED = 1400`.
  - Paredes con restitución 0.92. Gol cuando el centro cruza la línea de fondo dentro del hueco.
  - **Colisión continua:** antes de mover la pastilla en cada paso se limita el desplazamiento a `< radio` (los 1/240 s y el tope de rapidez lo garantizan: 1400/240 ≈ 5.8 px < 14).
- **Tiro cargado:** mantener `Space` carga hasta 0.8 s; al soltarlo se abre una ventana de 0.25 s en que el siguiente contacto mazo-pastilla multiplica el impulso por `1 + 0.5*carga/0.8`. Mientras se carga, `MAX_PADDLE_SPEED` baja 40 %.
- **Partido y niveles:** igual que A (primero a 5, 5 rivales, marcador se reinicia, 1 s de pausa tras gol).
  - Dificultad de la CPU por nivel: aceleración `1500 + 250*(n-1)`, retardo de reacción `0.28 - 0.04*(n-1)` s, error de predicción `±(60 - 10*(n-1))` px.
- **Puntuación (monotónica), idéntica a A:** gol a favor `100 × nivel`; ganar partido `+500 × nivel`. Extra de B: golpe cargado que termina en gol suma `+50`.
- **Input:** flechas/WASD sostenidos (aceleración) y `Space` (carga). Set de teclas; `setKeyUp` es relevante.
- **`drawAirHockey(ctx, state)`:** igual que A más indicador de carga (anillo alrededor del mazo) y estela breve de la pastilla cuando supera 800 px/s (guardada como historial de las últimas 6 posiciones en el estado).
- **Registro y catálogo:** igual que A (`hockey`, VERSUS, `cover-hockey`, `color: "cyan"`, `best: 0`, `plays: "0"`; estilo `cover-hockey` en `app/globals.css`).
- **Documentación:** actualizar `references/implemented-games.md` y CLAUDE.md.

**No incluye (para specs futuras):**

- Multijugador local o en red, mouse/táctil, sonido, skins (flujos de `skin-designer`/`mobile-porter`).
- Spin/rotación de la pastilla, power-ups, obstáculos.
- Modo infinito o de tiempo.
- HUD de vidas genérico (limitación conocida).

## Modelo de datos

```ts
interface Body { x: number; y: number; vx: number; vy: number }

export interface AirHockeyState {
  puck: Body;
  player: Body;
  cpu: Body;
  trail: { x: number; y: number }[]; // máx. 6, solo cosmético
  charge: number;          // 0..0.8 s del jugador
  playerGoals: number;
  cpuGoals: number;
  level: number;           // 1..5
  score: number;
  serveTimer: number;
  banner: "" | "GOL" | "NIVEL" | "RIVAL";
  gameOver: boolean;
  won: boolean;
}
// Interno: Set<string> de teclas, acumulador de pasos, ventana de tiro cargado, estado de IA (objetivo, retardo).
```

`getState()` devuelve un snapshot nuevo (copiando cuerpos y `trail`) en cada llamada, para el re-render del HUD.

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
| `score` | `100×nivel` por gol + `500×nivel` por partido + `50` por gol de tiro cargado |
| `wave_completed` | nivel (rival) alcanzado, 1..5 |
| `won` | `true` solo si venció a los 5 rivales |
| `duration_seconds` | lo calcula `GamePlayer` |

## Pasos de implementación

1. Crear `lib/airhockey-game.ts` con tipos y constantes físicas agrupadas en un único objeto `PHYSICS` (para tuning rápido).
2. `AirHockeyGame`: constructor/`reset()`, teclas, `getState()` con snapshot.
3. Bucle de pasos fijos 1/240 s en `update(dt)`: aceleración e integración del mazo del jugador con amortiguación y clamp a su mitad.
4. Integración de la pastilla con fricción, paredes con restitución, detección de gol.
5. Colisión círculo-círculo con impulso y corrección de penetración; mazo limitado a su mitad.
6. Tiro cargado: carga, ventana de multiplicador, penalización de velocidad y bonus de score.
7. IA predictiva: cada `reactionDelay` recalcular el punto de cruce del eje de defensa simulando rebotes en paredes; añadir error; moverse con aceleración hacia el objetivo; si la pastilla está en la mitad de la CPU y casi quieta, atacar.
8. Marcador/niveles/banners, `won`/`gameOver` (igual que A).
9. `drawAirHockey` y `airHockeyDefinition`.
10. Registrar en `lib/game-engines.ts`, `lib/games.ts`, `cover-hockey` en `app/globals.css`.
11. `npm run lint` y `npm run build`.
12. Verificación manual y afinado de constantes; actualizar `references/implemented-games.md`.

## Decisiones

- **Sí: pasos fijos de 1/240 s.** Determinismo, sin tunneling y comportamiento independiente del framerate.
- **Sí: masa del mazo 4x la pastilla.** El mazo apenas se ve afectado y la velocidad del mazo se transfiere a la pastilla, que es lo que da el "feeling" buscado.
- **Sí: tiro cargado.** Da una decisión táctica (riesgo/recompensa) sin salir del teclado; es la mecánica extra de este enfoque.
- **Sí: IA predictiva con error.** La dificultad escala con parámetros (retardo y error), no con "trampas" de velocidad.
- **Sí: mismo scoring base que A** (más bonus de 50) para que los dos enfoques sean intercambiables a nivel de leaderboard.
- **No: spin ni fricción de pared.** Se mantiene la simulación manejable.
- **No: tocar `GamePlayer.tsx`.**

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Pastilla atrapada contra pared por el mazo | Corrección de penetración y, si queda aplastada, impulso de expulsión hacia el centro |
| Tuning físico largo | Constantes en `PHYSICS`; criterios de verificación objetivos (rapidez al golpear, tiempo de cruce) |
| IA demasiado perfecta | Retardo de reacción y error por nivel |
| Pastilla quieta en un lado sin que nadie la alcance | Saque forzado tras 15 s sin contacto |
| Coste de CPU por pasos fijos | 240 pasos/s con 3 cuerpos es trivial; el cap de `dt` limita a 12 pasos/frame |
| HUD con vidas estáticas | Limitación documentada |

## Verificación

1. `npm run lint` y `npm run build` sin errores.
2. `/juego/hockey` (VERSUS) y `/juego/hockey/jugar` con canvas 800×480.
3. **Inercia:** soltar las teclas hace que el mazo se deslice y frene en ~0.2 s; no sale de su mitad.
4. **Transferencia de impulso:** golpear con el mazo en movimiento envía la pastilla más rápido que con el mazo quieto; con el mazo quieto la pastilla rebota con la velocidad que traía (x0.9).
5. **Tiro cargado:** el anillo crece al mantener `Space`; el golpe tras soltar es claramente más fuerte; un gol así suma `+50`.
6. **Paredes y porterías:** rebotes con ligera pérdida; la pastilla nunca atraviesa un mazo ni una pared a rapidez máxima.
7. **CPU:** el nivel 1 falla visiblemente; el nivel 5 intercepta casi todo, pero es batible.
8. **Niveles y fin:** igual que en A (nivel +1 con `+500×nivel`; derrota = game over; ganar el nivel 5 = `won`).
9. **Guardado:** `select game_id, score, wave_completed, won from game_sessions where game_id = 'hockey' order by played_at desc limit 1;` coincide con el HUD.
10. **Leaderboards y regresión:** igual que A (selector vía `PLAYABLE_GAMES`; los otros 4 juegos intactos).
