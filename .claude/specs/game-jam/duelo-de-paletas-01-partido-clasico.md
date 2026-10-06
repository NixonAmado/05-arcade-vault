# duelo-de-paletas — RALLY (Enfoque A: partido clásico a 7, física simple)

**Estado:** Borrador
**Depende de:** 05-leaderboard-y-tabla-juegos, 06-caida-tetris
**Fecha:** 2026-10-06
**Objetivo:** Agregar RALLY, un duelo de paletas estilo Pong contra una CPU, como primer juego real de la categoría VERSUS, con un partido único a 7 puntos y física simple de rebote.

## Por qué existe esta spec

El catálogo tiene 4 juegos jugables: `asteroids` (SHOOTER), `caida` (PUZZLE), `vibora` y `frogger` (ARCADE). VERSUS es la única categoría de `CATS` sin ningún juego, y no hay fuente en `references/started-games/`, así que se escribe desde cero. Como no hay multijugador ni netcode, el "versus" es contra una CPU local. No figura en `references/game-suggestion-todo.md` ni en la memoria de `game-planner`, y no hay spec previa de Pong/paletas.

La infraestructura genérica ya existe (`GameEngine`/`GameDefinition`, `GAME_ENGINES`, `game_sessions.game_id`, selectores de leaderboard basados en `PLAYABLE_GAMES`). Agregar el juego es una entrada en el registro más la entrada en `lib/games.ts`; no hay migración ni cambios en `GamePlayer.tsx`.

## Diferencia con la spec alternativa

Esta es la variante **A** de dos. La variante **B** está en `duelo-de-paletas-02-torneo-con-efecto.md`. El objetivo, el id `rally`, la categoría y el mapeo a `game_sessions` son los mismos. Difieren en:

- **Alcance de la primera versión:** A es un único partido a 7 contra una CPU de dificultad fija. B es un torneo de 5 rivales de dificultad creciente con power-ups.
- **Arquitectura de la física:** A usa pasos discretos con colisión AABB y reflexión por zona de impacto (el ángulo sale de dónde pega la bola en la paleta). B usa simulación continua con colisión barrida (swept), efecto (spin) y substeps.
- **Estrategia de input:** A es continuo y simple (set de teclas sostenidas, paleta a velocidad constante). B suma un modelo de aceleración/inercia de la paleta y una tecla de acción para el power-up.
- **`won`:** en A es `true` si el jugador llega a 7 antes que la CPU. En B solo si vence a los 5 rivales.

**Trade-off.** A es rápido y de bajo riesgo, pero la CPU se vuelve predecible y el techo de habilidad es bajo. B tiene más profundidad y rejugabilidad, pero requiere tuning de la IA, del spin y de los power-ups, y es más difícil de verificar a mano.

**Elegir esta si** querés el primer VERSUS jugable rápido y con riesgo bajo.

**Elegir la otra si** querés que el juego tenga progresión y personalidad, y aceptás más trabajo y una iteración de tuning.

## Alcance

**Incluye:**

- Motor `lib/rally-game.ts`: clase `RallyGame` que implementa `GameEngine<RallyState>`, sin dependencias de React ni del DOM.
- Canvas de **640×400**. Jugador a la izquierda, CPU a la derecha, línea central punteada, marcador dibujado dentro del canvas.
- Paletas de 10×70 px. La del jugador se mueve con `ArrowUp`/`ArrowDown` o `KeyW`/`KeyS` a velocidad constante (360 px/s) y se limita a los bordes.
- Bola cuadrada de 10 px:
  - Saque desde el centro hacia quien perdió el punto (el primero va hacia la CPU), tras una cuenta regresiva de 0,8 s.
  - Rebota en techo y piso.
  - Al golpear una paleta, el ángulo de salida depende de la zona de impacto (tope de ±55° sobre la horizontal).
  - Cada golpe de paleta suma 4% a la velocidad de la bola (arranca en 300 px/s, tope en 640 px/s). La velocidad vuelve al valor inicial en cada saque.
- CPU reactiva: sigue la `y` de la bola con velocidad máxima limitada (300 px/s, menor que la del jugador) y una zona muerta. Solo reacciona cuando la bola va hacia su lado, y a media cancha recalcula con un error aleatorio fijo por punto, para que sea batible.
- Puntos: el partido termina cuando alguien llega a 7. Si gana la CPU, es game over. Si gana el jugador, `won = true` y también termina la partida.
- Puntaje (`score`): +100 por punto ganado, +10 por cada devolución del jugador y +500 de bonus por ganar el partido. Es monotónico.
- Dibujo `drawRally(ctx, state)` en el mismo módulo, con la paleta cian existente. Soporte de skins opcional (se ignora el parámetro `skin` en esta versión).
- Registro `rally: rallyDefinition` en `lib/game-engines.ts` y entrada en `lib/games.ts` (`cat: "VERSUS"`, `color: "yellow"`, `cover: "cover-rally"`, `best: 0`, `plays: "0"`), con el estilo `cover-rally` en `app/globals.css`.
- Layout táctil en `lib/touch-controls.ts`: un control vertical (arriba/abajo) según la spec 07, vía `mobile-porter`.
- Actualizar `references/implemented-games.md`.

**No incluye (para specs futuras):**

- Multijugador local de dos personas o en red (sin netcode).
- Power-ups, efecto/spin y múltiples rivales (esto es la variante B).
- Selector de dificultad.
- Sonido.
- Skins de color propias (las puede agregar el agente `skin-designer` después).
- Migración de Supabase: no hace falta, `game_id` ya existe.

## Modelo de datos

```ts
// lib/rally-game.ts (forma del estado, no del motor completo)
export interface RallyState {
  ball: { x: number; y: number; vx: number; vy: number };
  playerY: number;          // centro de la paleta del jugador
  cpuY: number;             // centro de la paleta de la CPU
  playerPoints: number;     // 0..7
  cpuPoints: number;        // 0..7
  rallyHits: number;        // devoluciones del jugador en el punto en curso
  serveTimer: number;       // segundos restantes de cuenta regresiva (0 = en juego)
  score: number;            // monotónico, ver reglas
  gameOver: boolean;
  won: boolean;
}
```

```ts
// RallyGame implements GameEngine<RallyState>
// setKeyDown/setKeyUp mantienen un Set<string> de teclas sostenidas (continuo)

export const rallyDefinition: GameDefinition<RallyState> = {
  width: 640,
  height: 400,
  create: () => new RallyGame(),
  draw: drawRally,
  isGameOver: (s) => s.gameOver,
  getScore: (s) => s.score,
  getProgress: (s) => s.playerPoints,   // puntos del jugador (0..7)
  hasWon: (s) => s.won,
};
```

Mapeo a `game_sessions`:

| Columna | Valor |
|---|---|
| `game_id` | `'rally'` |
| `score` | `RallyState.score` |
| `wave_completed` | puntos ganados por el jugador (0 a 7) |
| `won` | `true` si el jugador ganó el partido |

## Pasos de implementación

1. Crear `lib/rally-game.ts` con constantes (tamaños, velocidades, tope de puntos) y el tipo `RallyState`.
2. Implementar `RallyGame`: constructor, `reset()`, `getState()` y manejo del `Set` de teclas en `setKeyDown`/`setKeyUp`.
3. Implementar `update(dt)`:
   - cuenta regresiva de saque;
   - movimiento de la paleta del jugador;
   - IA de la CPU;
   - avance de la bola;
   - rebote en techo y piso;
   - colisión AABB con las paletas y reflexión por zona de impacto;
   - detección de punto, sumas al `score`, fin de partido.
   Capar `dt` a 50 ms (mismo criterio que Asteroids).
4. Implementar `drawRally(ctx, state)` y exportar `rallyDefinition`.
5. Registrar `rally` en `lib/game-engines.ts`.
6. Agregar la entrada a `lib/games.ts` y el estilo `cover-rally` en `app/globals.css`.
7. Registrar el layout táctil en `lib/touch-controls.ts` (agente `mobile-porter`).
8. Actualizar `references/implemented-games.md`.
9. Verificar según la sección siguiente. Cada paso deja el proyecto compilando.

## Decisiones

- **Sí: VERSUS contra CPU.** Es la única categoría vacía y evita netcode. El nombre de la categoría se respeta sin prometer multijugador real.
- **Sí: ángulo por zona de impacto, no reflexión especular pura.** Sin spin ni física compleja, es lo que le da control al jugador y evita rallies infinitos y predecibles.
- **Sí: CPU más lenta que el jugador, con error por punto.** Garantiza que sea batible sin necesidad de selector de dificultad.
- **Sí: `wave_completed` = puntos del jugador.** Es un valor 0 a 7 que representa progreso dentro del partido. Se documenta en la spec porque el nombre de la columna está pensado para Asteroids.
- **Sí: el partido termina siempre en game over (aunque se gane), con `won = true`.** El HUD y el guardado de sesión genéricos de `GamePlayer.tsx` no necesitan un estado "victoria" distinto.
- **No: AABB con substeps en esta variante.** A 640 px/s máx y `dt` capado a 50 ms la bola recorre unos 32 px por frame, más que el grosor de la paleta (10 px). Hay riesgo de túnel; mitigación: limitar el desplazamiento por paso a 8 px dividiendo `update` en iteraciones fijas (substeps simples, sin colisión barrida).
- **No: leaderboard con ranking mezclado.** Se mantiene el selector por juego ya existente.

## Verificación

1. `npm run build` y `npm run lint` sin errores.
2. `npm run dev`: abrir `/juego/rally` (aparece en la categoría VERSUS) y `/juego/rally/jugar`.
3. Jugar un partido: moverse con flechas y con W/S; confirmar que la paleta no sale del campo, que el ángulo cambia según la zona de golpe, que la bola acelera hasta el tope y que vuelve a la velocidad inicial en cada saque.
4. Probar que la bola no atraviesa la paleta a velocidad máxima (golpear de canto en el borde de la paleta).
5. Perder 0-7 (dejar pasar la bola): aparece el modal de fin de juego con `score` igual a la cantidad de devoluciones por 10.
6. Ganar 7-n: `score` incluye +100 por punto y +500 de bonus, y `won = true`.
7. Con sesión iniciada, confirmar la fila en `game_sessions` con `game_id = 'rally'`, `wave_completed` = puntos del jugador y `won` correcto (`execute_sql` del MCP de Supabase). Como invitado, el modal ofrece iniciar sesión y no guarda.
8. Confirmar que `rally` aparece en el selector de los leaderboards y que los demás juegos no cambiaron.
9. Probar pausa (P) y controles táctiles en un viewport móvil.
