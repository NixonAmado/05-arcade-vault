# duelo-de-paletas — RALLY (Enfoque B: torneo de 5 rivales con efecto y power-ups)

**Estado:** Borrador
**Depende de:** 05-leaderboard-y-tabla-juegos, 06-caida-tetris
**Fecha:** 2026-10-06
**Objetivo:** Agregar RALLY como primer juego real de la categoría VERSUS, como un torneo contra 5 CPUs de dificultad creciente, con física continua, efecto (spin) y power-ups.

## Por qué existe esta spec

VERSUS es la única categoría de `CATS` sin juego real (hoy: `asteroids` SHOOTER, `caida` PUZZLE, `vibora` y `frogger` ARCADE). No hay fuente en `references/started-games/`, así que se escribe desde cero. Sin multijugador ni netcode, el rival es una CPU local. No hay spec previa de Pong/paletas ni sugerencia previa en `game-planner`.

Esta variante apuesta a que el juego no sea "otro Pong": progresión por rivales, bola con efecto y una mecánica extra que dé decisiones. La infraestructura ya existe (`GameDefinition`, `GAME_ENGINES`, `game_sessions.game_id`, leaderboards por juego), así que no hay migración ni cambios en `GamePlayer.tsx`.

## Diferencia con la spec alternativa

Esta es la variante **B** de dos. La variante **A** está en `duelo-de-paletas-01-partido-clasico.md`. El juego, el id `rally`, la categoría y el canvas base son los mismos. Difieren en:

- **Alcance:**
  - B: torneo de 5 rivales, cada uno con su propia IA, y power-ups.
  - A: un único partido a 7 contra una CPU fija, sin extras.
- **Arquitectura de la física:**
  - B: simulación continua con substeps y colisión barrida (swept) contra las paletas, y efecto (spin) que curva la trayectoria.
  - A: AABB discreta con reflexión por zona de impacto.
- **Input:**
  - B: la paleta tiene aceleración e inercia (velocidad que converge a la deseada), más la tecla `Space` para activar el power-up guardado. Hay un solo slot, edge-triggered para la acción y continuo para el movimiento.
  - A: movimiento continuo a velocidad constante, sin tecla de acción.
- **`won`:** en B solo es `true` si el jugador vence a los 5 rivales. En A, si gana un partido.

**Trade-off.** B da progresión, rejugabilidad y un techo de habilidad mucho más alto, y un score más rico. A cambio:

- **Tuning:** hay que ajustar cinco perfiles de IA, el spin y los power-ups.
- **Túnel y precisión:** la colisión barrida con spin es más delicada.
- **Verificación:** es menos determinista y más difícil de probar a mano.
- **Esfuerzo:** estimación de 2 a 2,5 veces el trabajo de A.

**Elegir esta si** querés que VERSUS tenga identidad propia y aceptás más trabajo y una iteración de tuning.

**Elegir la otra si** querés el juego jugable rápido y con bajo riesgo.

## Alcance

**Incluye:**

- Motor `lib/rally-game.ts`: clase `RallyGame` que implementa `GameEngine<RallyState>`, sin dependencias de React ni del DOM.
- Canvas de **640×400**. Jugador a la izquierda, rival a la derecha. Marcador, nombre del rival (`RIVAL 2/5`) y power-up en espera dibujados dentro del canvas.
- Partido contra cada rival a **5 puntos**. Si el jugador gana, pasa al siguiente rival (breve pausa de 1,5 s con el rótulo del rival). Si pierde un partido, game over.
- Cinco rivales, definidos como tabla de perfiles: velocidad máxima de la paleta, tiempo de reacción, error de puntería y probabilidad de usar power-ups. De más lento y errático (rival 1) a casi perfecto con efecto (rival 5).
- Física continua:
  - la paleta acelera hacia la velocidad objetivo (inercia);
  - la bola avanza en substeps de máximo 4 px;
  - colisión barrida bola-paleta (se resuelve el instante de contacto dentro del substep);
  - el ángulo depende de la zona de impacto, y la velocidad de la paleta en el golpe transfiere efecto (`spin`);
  - `spin` curva la trayectoria (`vy += spin × k × dt`) y decae con el tiempo y al rebotar en techo o piso.
- Power-ups: aparece un ítem en la mitad de la cancha cada 10 a 14 s, y lo recoge quien lo toque con la bola por última vez. Se guarda en un slot y se activa con `Space`. Tipos:
  - **PALETA GRANDE** (+40% de largo durante 8 s);
  - **BOLA LENTA** (-30% de velocidad de la bola durante 4 s);
  - **SMASH** (el próximo golpe sale a +25% de velocidad).
  La CPU los usa según su perfil.
- Puntaje (`score`, monotónico):
  - +100 × número de rival por punto ganado;
  - +10 por devolución, con multiplicador `1 + floor(rallyHits / 5) × 0,5`;
  - +500 × número de rival por ganar el partido.
- Dibujo `drawRally(ctx, state)` con estela de la bola y cola de spin visible. Los skins se ignoran en esta versión.
- Registro `rally: rallyDefinition` en `lib/game-engines.ts` y entrada en `lib/games.ts` (`cat: "VERSUS"`, `color: "yellow"`, `cover: "cover-rally"`, `best: 0`, `plays: "0"`), con el estilo `cover-rally` en `app/globals.css`.
- Layout táctil en `lib/touch-controls.ts`: joystick/botones arriba-abajo más un botón de acción mapeado a `Space` (agente `mobile-porter`).
- Actualizar `references/implemented-games.md`.

**No incluye (para specs futuras):**

- Multijugador de dos personas (local o en red).
- Selector de dificultad o modo práctica.
- Sonido.
- Skins de color propias.
- Más de un power-up en slot, o power-ups apilables.
- Migración de Supabase: no hace falta, `game_id` ya existe.

## Modelo de datos

```ts
// lib/rally-game.ts (forma del estado, no del motor completo)
type PowerUp = 'big' | 'slow' | 'smash';

export interface RallyState {
  ball: { x: number; y: number; vx: number; vy: number; spin: number };
  player: { y: number; vy: number; heldPowerUp: PowerUp | null; sizeTimer: number };
  rival: { y: number; vy: number; heldPowerUp: PowerUp | null; sizeTimer: number };
  rivalIndex: number;       // 0..4 (rival 1 a 5)
  playerPoints: number;     // en el partido actual, 0..5
  rivalPoints: number;      // en el partido actual, 0..5
  rallyHits: number;        // devoluciones consecutivas del jugador en el punto
  pickup: { x: number; y: number; type: PowerUp } | null;
  phase: 'serve' | 'play' | 'interlude';
  phaseTimer: number;
  score: number;            // monotónico
  gameOver: boolean;
  won: boolean;
}
```

```ts
// RallyGame implements GameEngine<RallyState>
// setKeyDown: agrega a un Set (movimiento continuo); "Space" dispara el power-up (edge-triggered)
// setKeyUp: quita del Set

export const rallyDefinition: GameDefinition<RallyState> = {
  width: 640,
  height: 400,
  create: () => new RallyGame(),
  draw: drawRally,
  isGameOver: (s) => s.gameOver,
  getScore: (s) => s.score,
  getProgress: (s) => s.rivalIndex + 1,   // rival alcanzado (1..5)
  hasWon: (s) => s.won,
};
```

Mapeo a `game_sessions`:

| Columna | Valor |
|---|---|
| `game_id` | `'rally'` |
| `score` | `RallyState.score` |
| `wave_completed` | número de rival alcanzado (1 a 5) |
| `won` | `true` solo si venció a los 5 rivales |

## Pasos de implementación

1. Crear `lib/rally-game.ts` con constantes, la tabla de `RIVALS` (perfiles de IA) y el tipo `RallyState`.
2. Implementar `RallyGame`: constructor, `reset()`, `getState()`, y el `Set` de teclas con `Space` edge-triggered.
3. Implementar el movimiento de paletas con inercia y límites de cancha.
4. Implementar el avance de la bola por substeps con colisión barrida contra paletas y rebote en techo y piso, incluyendo transferencia y decaimiento de `spin`.
5. Implementar la IA del rival según su perfil: predicción de la `y` de llegada con rebotes, tiempo de reacción, error de puntería y uso de power-ups.
6. Implementar power-ups: aparición, recogida, slot, activación y temporizadores de efecto.
7. Implementar las fases (`serve`, `play`, `interlude`), el avance entre rivales, el puntaje con multiplicador y las condiciones de `gameOver` y `won`. Capar `dt` a 50 ms.
8. Implementar `drawRally` (estela, indicador de spin, slot de power-up, rótulo de rival) y exportar `rallyDefinition`.
9. Registrar en `lib/game-engines.ts`, agregar la entrada a `lib/games.ts` y el estilo `cover-rally`.
10. Registrar el layout táctil (agente `mobile-porter`) y actualizar `references/implemented-games.md`.
11. Verificar según la sección siguiente. Cada paso deja el proyecto compilando.

## Decisiones

- **Sí: torneo de 5 rivales como estructura de progresión.** Da sentido a `wave_completed` (rival alcanzado) y a `won` (vencer a todos), igual que las oleadas de Asteroids.
- **Sí: colisión barrida más substeps de 4 px.** Con la bola a más de 600 px/s y `dt` de hasta 50 ms, el túnel es el principal riesgo de la simulación continua. Se mitiga con ambas técnicas.
- **Sí: spin con decaimiento.** Sin decaimiento, un golpe con efecto curvaría la bola indefinidamente y haría los puntos injugables.
- **Sí: un solo slot de power-up.** Mantiene la decisión simple ("usarlo ahora o esperar") y limita el estado.
- **Sí: perfiles de IA como datos (tabla `RIVALS`).** Permite retocar la dificultad sin tocar la lógica, y el tuning es la parte de mayor riesgo.
- **No: aleatoriedad no reproducible.** Usar un PRNG con semilla por partida en el motor para poder reproducir bugs a mano.
- **No: power-ups apilables.** Complicaría el estado y los temporizadores sin aportar mucho a una primera versión.
- **No: ranking mezclado.** Se mantiene el selector por juego de los leaderboards.
- **Riesgo principal:** el tuning de IA y spin. Mitigación: tabla de constantes al inicio del módulo y verificación manual por rival, empezando por el rival 5.

## Verificación

1. `npm run build` y `npm run lint` sin errores.
2. `npm run dev`: abrir `/juego/rally` (categoría VERSUS) y `/juego/rally/jugar`.
3. Movimiento: la paleta acelera y frena con inercia, no sale del campo y responde a flechas y W/S.
4. Física: golpear la bola con la paleta en movimiento genera curva visible que decae. A velocidad máxima la bola no atraviesa la paleta ni el techo y el piso.
5. Power-ups: aparece el ítem, se recoge con el golpe, `Space` lo activa y su efecto expira. `Space` sin power-up no hace nada. La pausa (P) congela temporizadores.
6. Progresión: ganar el partido a 5 puntos muestra el interludio y pasa al rival siguiente (el rival 3 es notablemente más rápido que el 1). `getProgress` sube.
7. Perder en el rival 2: aparece el modal de fin con `wave_completed = 2`, `won = false` y el `score` acumulado. Vencer a los 5 rivales: `won = true`.
8. Con sesión iniciada, confirmar la fila en `game_sessions` con `game_id = 'rally'` (`execute_sql` del MCP de Supabase). Como invitado, el modal ofrece iniciar sesión y no guarda.
9. Confirmar que `rally` aparece en los selectores de leaderboard y que los otros juegos no cambiaron.
10. Probar el botón de acción táctil y el layout en un viewport móvil.
