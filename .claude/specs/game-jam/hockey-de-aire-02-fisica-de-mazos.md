# hockey-de-aire — HOCKEY (Enfoque B: física de mazos 2D, supervivencia por rondas)

**Estado:** Borrador
**Depende de:** 06-caida-tetris (registro `GAME_ENGINES`, `game_id` en `game_sessions`), 08-autenticacion-supabase (guardado solo con sesión)
**Fecha:** 2026-10-08
**Objetivo:** Agregar HOCKEY, un hockey de aire contra la CPU (primer juego VERSUS del catálogo), con mazos circulares libres en 2D, física de impulso y colisión círculo-círculo, en formato de rondas de supervivencia con dificultad creciente.

## Por qué existe esta spec

Misma motivación que la variante A: el catálogo no tiene ninguna entrada VERSUS y el multijugador real queda fuera de alcance, así que el "versus" es un duelo contra una IA. Esta variante apuesta por la sensación auténtica del hockey de aire (el mazo golpea el disco y le transfiere su velocidad, se puede atacar y retroceder en 2D) a costa de más complejidad de física y de IA. No duplica ningún juego implementado ni sugerido (arkanoid, snake, match-3).

## Diferencia con la spec alternativa

Esta es la variante **B** de dos. La variante **A** está en `hockey-de-aire-01-paletas-en-riel.md`. Difieren en el eje de **arquitectura del motor y alcance**: B simula mazos circulares con movimiento libre en 2D dentro de su mitad (posición dirigida por teclas con aceleración y amortiguación), colisión círculo-círculo con transferencia de impulso, fricción leve del disco y una CPU con máquina de estados (defender / atacar / despejar); A usa mazos en riel 1D y reflexión simple. Además B cambia el formato: en vez de torneo de 5 rivales, es supervivencia por rondas con vidas.

Elegir esta si: se quiere que el juego se sienta como hockey de aire de verdad y hay tiempo para afinar física e IA.
Elegir la otra si: se prioriza llegar rápido a un juego estable con poco riesgo.

## Alcance

**Incluye:**

- Motor `lib/hockey-game.ts`: `HockeyGame` implementa `GameEngine<HockeyState>`, exporta `hockeyDefinition`. Sin React ni DOM.
- Mesa vertical en canvas único **480×640**, jugador abajo, CPU arriba, arcos de 140 px, paredes con rebote con restitución 0.9.
- Mazo del jugador libre en 2D, confinado a su mitad: las 4 flechas (o WASD) aplican aceleración, con amortiguación y velocidad máxima; input continuo por conjunto de teclas sostenidas.
- Física del disco: velocidad vectorial, fricción leve (decae ~15% por segundo), tope de velocidad, colisión círculo-círculo con mazos con transferencia de impulso (la velocidad del mazo se suma a la reflexión), separación de penetración y sub-pasos de integración (4 por frame como mínimo) para evitar tunneling.
- CPU con máquina de estados: `defender` (se ubica entre el disco y su arco), `atacar` (cuando el disco está en su mitad y quieto/lento, se acerca por detrás y lo golpea hacia el arco rival) y `despejar` (si el disco está pegado a su arco). Parámetros por ronda: velocidad máxima, retraso de reacción, error de apuntado, agresividad.
- Formato supervivencia por rondas: cada ronda es a 3 goles contra un rival cada vez más fuerte (rondas ilimitadas; los parámetros se saturan a partir de la ronda 8). El jugador tiene 3 vidas: cada ronda perdida (la CPU llega a 3 goles) resta 1 vida y repite el nivel de rival con marcador a 0; con 0 vidas termina la run.
- Puntuación monotónica: +100 por gol; +50 por cada gol con "rebote" (disco que tocó pared antes de entrar); +10 por golpe de mazo en peloteo (tope 20 por punto); +300 × número de ronda al ganar la ronda; bonus +100 por cada 10 s de ventaja de tiempo (ronda ganada en menos de 60 s). Nunca resta.
- Cuenta regresiva de saque tras cada gol; red de seguridad anti-estancamiento (si el disco queda < 20 px/s más de 5 s, recibe un impulso hacia el campo de quien lo tuvo último).
- Pausa con `P` (usa el `paused` genérico).
- Entrada en `lib/games.ts` (`id: "hockey"`, cat `VERSUS`, `cover-hockey`, `best: 0`, `plays: "0"`) y registro en `GAME_ENGINES`.
- Táctil: layout de joystick/direcciones en `lib/touch-controls.ts` (spec 07); revisión posterior con `mobile-porter`.

**No incluye (para specs futuras):**

- 2 jugadores locales ni netcode.
- Power-ups, obstáculos, mesas alternativas.
- Skins y sonido (los cubre `skin-designer` / una spec propia).
- Determinismo reproducible / replays.
- Cambios al esquema de `game_sessions`.

## Modelo de datos

```ts
// lib/hockey-game.ts (forma del estado, no del motor completo)
interface Body { x: number; y: number; vx: number; vy: number; r: number }

export interface HockeyState {
  puck: Body & { lastTouch: "player" | "cpu" | null; touchedWall: boolean };
  player: Body;
  cpu: Body & { mode: "defender" | "atacar" | "despejar"; reactT: number };
  roundGoals: { player: number; cpu: number };   // a 3
  round: number;             // 1.. (dificultad)
  lives: number;             // 3 al inicio
  phase: "serve" | "play" | "roundEnd" | "gameOver";
  phaseT: number;
  rally: number;
  score: number;
  roundsWon: number;
  roundTime: number;
  elapsed: number;
}
```

Mapeo a `GameDefinition` / `game_sessions`:

| Campo | Valor |
|---|---|
| `width` x `height` | 480 x 640 |
| `getScore` | `state.score` (monotónico) |
| `getProgress` -> `wave_completed` | `roundsWon` |
| `hasWon` -> `won` | siempre `false` (modo endless sin victoria final) |
| `isGameOver` | `phase === "gameOver"` |
| `game_id` | `"hockey"` |

`difficultyForRound(round)`: función pura que devuelve `{ maxSpeed, reactDelay, aimError, aggression }` interpolando y saturando en la ronda 8.

## Pasos de implementación

1. Crear `lib/hockey-game.ts` con constantes físicas (masas, restitución, fricción, límites de velocidad), tipos y estado inicial.
2. Implementar integración con sub-pasos fijos dentro de `update(dt)` (dt capado a 50 ms): aceleración y amortiguación del mazo, confinamiento a su mitad, integración del disco con fricción y tope.
3. Implementar colisiones disco-paredes (con las aberturas de los arcos) y círculo-círculo disco-mazo con transferencia de impulso y corrección de penetración; probar que el disco no atraviesa un mazo a velocidad máxima.
4. Implementar detección de gol, fases (`serve`, `play`, `roundEnd`, `gameOver`), vidas y puntuación del Alcance.
5. Implementar `difficultyForRound` y la CPU con máquina de estados (`defender`/`atacar`/`despejar`), con retraso de reacción y error de apuntado.
6. Implementar `setKeyDown`/`setKeyUp` (conjunto de teclas activas) y `reset()`.
7. Implementar `drawHockey(ctx, state)` (mesa, arcos, disco con estela corta, mazos, marcador de ronda, vidas, número de ronda, cuenta regresiva) y exportar `hockeyDefinition`.
8. Registrar en `lib/game-engines.ts`, agregar entrada en `lib/games.ts` y estilo `cover-hockey` en `app/globals.css`.
9. Registrar layout táctil en `lib/touch-controls.ts`.
10. Afinar a mano (constantes de fricción, impulso, IA) jugando varias rondas hasta que la ronda 1 sea ganable y la 6+ exigente.
11. Actualizar `references/implemented-games.md` y la lista de motores de `CLAUDE.md`.

Cada paso deja el proyecto compilando.

## Decisiones

- **Sí: mazos libres en 2D con impulso.** Es lo que distingue al hockey de aire de un Pong; justifica el esfuerzo extra de esta variante.
- **Sí: sub-pasos fijos de integración.** Evita tunneling y mantiene el comportamiento independiente del framerate sin implementar colisión continua (CCD).
- **Sí: CPU con máquina de estados de 3 modos.** Con mazos 2D una CPU que solo "sigue la X" sería trivial de explotar o inútil; los modos mantienen el código acotado y testeable.
- **Sí: supervivencia con vidas y rondas infinitas.** Da score abierto y sin techo, a diferencia del torneo finito de A; `won` queda en `false` como en Caída.
- **Sí: score sin restas; bonus de rebote.** Premia jugadas vistosas sin romper la monotonía exigida por `game_sessions`.
- **No: determinismo/replays.** Costo alto, sin valor para el leaderboard.
- **No: skins/sonido en esta spec.** Se delegan al flujo existente.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Disco atraviesa mazo o queda "pegado" | Sub-pasos + corrección de penetración + velocidad máxima acotada (paso 3) |
| CPU injusta o trivial | Paso 10 de afinado manual; parámetros concentrados en `difficultyForRound` |
| Sensación de control mala en táctil | Revisar con `mobile-porter`; si falla, reducir aceleración o usar objetivo por arrastre en una spec aparte |

## Verificación

1. `npm run build` y `npm run lint` sin errores.
2. `/juego/hockey` y `/juego/hockey/jugar`: el mazo se mueve en 2D con inercia, sin salir de su mitad; el disco rebota en paredes y arcos.
3. Golpear el disco con el mazo en movimiento le transfiere velocidad (un golpe en carrera sale más rápido que uno quieto); el disco no atraviesa el mazo a velocidad alta.
4. La CPU alterna defender/atacar/despejar de forma visible; en la ronda 5+ es claramente más rápida que en la 1.
5. Perder una ronda resta una vida y repite el nivel; con 0 vidas aparece el modal de fin de juego.
6. Con sesión iniciada se inserta una fila en `game_sessions` con `game_id = 'hockey'`, `wave_completed` = rondas ganadas, `won = false` (verificable con `execute_sql`). Como invitado no guarda y ofrece iniciar sesión.
7. `P` pausa y reanuda; volver a la pestaña tras estar en segundo plano no teletransporta el disco.
8. El score nunca disminuye durante la partida (observar el HUD).
9. Leaderboard y tabla incluyen Hockey sin alterar los demás juegos; `get_advisors` sin hallazgos nuevos.
