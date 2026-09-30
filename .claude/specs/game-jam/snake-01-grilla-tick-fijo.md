# snake — VÍBORA (Enfoque A: grilla discreta con tick fijo)

**Estado:** aprobado
**Depende de:** 05-leaderboard-y-tabla-juegos, 06-caida-tetris
**Fecha:** 2026-09-30
**Objetivo:** Agregar VÍBORA (snake clásico) como primer juego real de la categoría ARCADE, con un motor de grilla discreta que avanza a ticks fijos y velocidad creciente por nivel.

## Por qué existe esta spec

El catálogo tiene dos juegos jugables: `asteroids` (SHOOTER) y `caida` (PUZZLE). ARCADE y VERSUS no tienen ningún juego real. Snake ya estaba sugerido por `game-planner` (`references/game-suggestion-todo.md`, 2026-09-29, estado "sugerido", no rechazado) y el tema de esta jam lo pide explícitamente. No hay fuente en `references/started-games/`, así que se escribe desde cero.

La spec 06 ya dejó la infraestructura genérica: `GameEngine`/`GameDefinition`, el registro `GAME_ENGINES`, `game_sessions.game_id` y los selectores de juego de los leaderboards, que se arman con `PLAYABLE_GAMES = GAMES.filter(g => g.id in GAME_ENGINES)`. Este juego no necesita migraciones ni tocar `GamePlayer.tsx`: se implementa en un módulo nuevo y se registra con una entrada en el registro.

Este enfoque implementa el snake clásico con grilla discreta: celdas enteras, un paso por tick y un input que solo cambia de dirección.

## Diferencia con la spec alternativa

Esta es la variante **A** de dos. La variante **B** está en `snake-02-simulacion-continua.md`. El objetivo, el scoring y el mapeo a `game_sessions` son los mismos en las dos. Difieren en:

- **Arquitectura del motor:**
  - A: grilla de enteros, avance de una celda por tick y colisión por igualdad de celdas.
  - B: posición en floats, rumbo angular, cuerpo como rastro de puntos y colisión por distancia entre círculos.
- **Modelo de input:**
  - A: edge-triggered, con una cola de hasta 2 cambios de dirección. `setKeyUp` no hace nada.
  - B: continuo, un set de teclas sostenidas que rotan el rumbo mientras están presionadas. `setKeyUp` sí importa.

**Trade-off.** A es más simple, determinista y fácil de verificar a mano, con menos riesgo. Es el snake que la gente reconoce. A cambio, se siente más "retro" y su techo de profundidad mecánica es menor.

**Elegí esta si** querés el tercer juego jugable rápido, con bajo riesgo y reglas obvias.

**Elegí la otra si** querés que VÍBORA se diferencie del snake genérico y aceptás más complejidad en colisiones y tuning.

## Alcance

**Incluye:**

- **Motor `lib/snake-game.ts`:** clase `SnakeGame` que implementa `GameEngine<SnakeState>`.
  - Grilla de 30×30 celdas de 20 px, en un canvas de **600×600**.
  - Paredes letales, sin wrap.
  - La serpiente arranca con 3 segmentos en el centro, mirando a la derecha.
  - Comida simple: un ítem a la vez que aparece solo en celdas libres.
  - Crece 1 segmento por comida.
  - Muere al chocar una pared o su propio cuerpo.
- **Tick fijo con acumulador:**
  - `update(dt)` suma `dt` a un acumulador y ejecuta `while (acc >= tickInterval)`, así que puede haber varios ticks por frame. Esto es necesario porque `GamePlayer` capa `dt` a 0.05 s y en niveles altos el intervalo es menor.
  - `tickInterval` arranca en 150 ms, baja 10 ms por nivel y tiene un piso de 60 ms.
- **Niveles:** se sube 1 nivel cada 5 comidas, sin tope. El nivel solo acelera el tick; no cambia el mapa.
- **Puntuación:** cada comida suma `10 × nivel`. Es monotónica.
- **Input:**
  - Flechas y WASD.
  - `setKeyDown` encola un cambio de dirección en una cola de hasta 2 elementos.
  - Se descarta un giro de 180° o repetido. La comparación se hace contra la **última dirección encolada**, no contra la actual. Así, dos teclas rápidas (por ejemplo arriba y después izquierda yendo a la derecha) no permiten meterse en el propio cuello.
  - Cada tick consume como máximo un elemento de la cola.
  - `setKeyUp` es un no-op.
- **Dibujo `drawSnake(ctx, state)`** en el mismo módulo:
  - fondo con grilla tenue;
  - serpiente en verde neón con la cabeza diferenciada;
  - comida en amarillo/magenta;
  - overlay "GAME OVER" al morir, coherente con el tema CRT de `GamePlayer`.
- **Definición exportada:** `snakeDefinition: GameDefinition<SnakeState>`, con `width` 600 y `height` 600.
- **Registro:** entrada `vibora: snakeDefinition` en `lib/game-engines.ts`.
- **Catálogo `lib/games.ts`:** entrada `id: "vibora"`, `title: "VÍBORA"`, `cat: "ARCADE"`, `cover: "cover-snake"`, `color: "green"`, `best: 0`, `plays: "0"`. La clase `cover-snake` ya existe en `app/globals.css`, así que no hace falta CSS nuevo.
- **Documentación:** actualizar `references/implemented-games.md` al terminar.

**No incluye (para specs futuras):**

- Power-ups, comida especial con timer, obstáculos o mapas por nivel.
- Wrap en los bordes y modos alternativos (sin paredes, "zen").
- Sonido y controles táctiles.
- Pausa con tecla `P`. `GamePlayer` hoy solo pausa con el botón, y agregarla es un cambio del componente genérico, no de este juego.
- HUD de vidas genérico. El stat "Vidas" de `GamePlayer` sigue atado a `isAsteroids`, así que VÍBORA muestra los 3 corazones estáticos del estado mock. Se acepta como limitación conocida y no se refactoriza el HUD en esta spec.
- Multijugador local (VERSUS).

## Modelo de datos

```ts
// lib/snake-game.ts (forma del estado, no del motor completo)
type Dir = "up" | "down" | "left" | "right";
interface Cell { x: number; y: number } // enteros, 0..COLS-1 / 0..ROWS-1

export interface SnakeState {
  body: Cell[];        // body[0] = cabeza
  dir: Dir;            // dirección aplicada en el último tick
  food: Cell;
  score: number;
  foodEaten: number;
  level: number;       // 1 + floor(foodEaten / 5)
  gameOver: boolean;
  won: boolean;        // true solo si la serpiente llena toda la grilla (900 celdas)
}
// Interno (no expuesto en el estado): dirQueue: Dir[] (máx 2), acc: number, tickInterval: number.
```

**Contrato de `getState()`:** devuelve un **objeto nuevo** en cada llamada (snapshot superficial `{ ...campos }`, igual que `lib/tetris-game.ts`). `GamePlayer` hace `setEngineState(state)` en cada frame y el HUD (score/nivel) lee de ahí. Si se devolviera la misma referencia mutable, React no re-renderizaría: el HUD quedaría congelado aunque el canvas se vea bien.

**`GameDefinition`:**

| Campo | Valor |
|---|---|
| `width` / `height` | 600 / 600 |
| `create` | `() => new SnakeGame()` |
| `draw` | `drawSnake` |
| `isGameOver` | `s => s.gameOver` |
| `getScore` | `s => s.score` |
| `getProgress` | `s => s.level` |
| `hasWon` | `s => s.won` |

**Mapeo a `game_sessions`** (sin migración; el `game_id` viene de la spec 06):

| Columna | VÍBORA |
|---|---|
| `game_id` | `'vibora'` |
| `score` | puntaje acumulado (`10 × nivel` por comida) |
| `wave_completed` | nivel alcanzado |
| `won` | `true` solo si llenó la grilla completa. En la práctica casi siempre `false` (endless) |
| `duration_seconds` | lo calcula `GamePlayer` como hoy |

## Pasos de implementación

1. Crear `lib/snake-game.ts` con los tipos `Dir`, `Cell` y `SnakeState` y las constantes de grilla (`COLS=30`, `ROWS=30`, `CELL=20`), velocidad (`BASE_TICK=0.15`, `TICK_STEP=0.01`, `MIN_TICK=0.06`) y progresión (`FOOD_PER_LEVEL=5`).
2. Implementar la clase `SnakeGame`:
   - **Constructor y `reset()`:** estado inicial, cola vacía y acumulador en 0.
   - **`setKeyDown`:** mapea flechas y WASD a `Dir`. Descarta la tecla si es igual u opuesta a la última dirección encolada (o a `dir` si la cola está vacía). Encola solo si la cola tiene menos de 2 elementos.
   - **`setKeyUp`:** no-op.
   - **`update(dt)`:** si hay `gameOver` retorna; si no, suma al acumulador y ejecuta `step()` mientras el acumulador sea mayor o igual al intervalo.
   - **`step()`:**
     1. Desencola la dirección.
     2. Calcula la nueva cabeza.
     3. Verifica colisión con pared.
     4. Verifica colisión con el cuerpo, excluyendo la cola si ese tick no come, porque la cola se mueve.
     5. Hace `unshift` de la cabeza.
     6. Si come: suma score, `foodEaten` y nivel, recalcula el intervalo y respawnea la comida. Si no come, hace `pop`.
   - **Respawn de comida:** elige al azar entre las celdas libres. Si no queda ninguna, `won = true` y `gameOver = true`.
   - **`getState()`:** devuelve un snapshot nuevo.
3. Implementar `drawSnake(ctx, state)` en el mismo módulo: fondo, grilla, comida, cuerpo, cabeza y overlay de game over. Solo lee el estado.
4. Exportar `snakeDefinition` con el mapeo de la tabla de arriba.
5. Registrar `vibora: snakeDefinition` en `lib/game-engines.ts`.
6. Agregar la entrada `vibora` a `GAMES` en `lib/games.ts` (ARCADE, `cover-snake`, `green`, `best: 0`, `plays: "0"`).
7. Correr `npm run lint` y `npm run build`.
8. Verificación manual (ver abajo) y actualizar `references/implemented-games.md`.

## Decisiones

- **Sí: id `vibora` y título "VÍBORA".** Mantiene la UI en español, igual que `caida`, y no pisa ningún id existente.
- **Sí: grilla de 30×30 en un canvas de 600×600.** Cabe en el layout, que ya aloja 800×600 (Asteroids) y 440×600 (Caída). Un cuadrado es natural para snake.
- **Sí: acumulador con varios ticks por frame.** Sin esto, cualquier intervalo menor a 50 ms (o frames lentos) haría que el juego vaya más lento de lo diseñado.
- **Sí: cola de dirección de 2, validada contra el último encolado.** Evita el bug clásico de "giro doble" que mata a la serpiente contra su cuello, y no pierde inputs rápidos.
- **Sí: paredes letales.** Es el clásico. El wrap queda para una variante futura.
- **Sí: `won` = llenar la grilla.** Es una condición real y verificable, aunque rarísima. Es mejor que `false` hardcodeado porque `hasWon` refleja algo concreto.
- **No: power-ups ni obstáculos.** Se mantiene el mínimo viable. Si se agregan, van en otra spec.
- **No: tocar `GamePlayer.tsx`.** El registro de la spec 06 alcanza. La limitación del HUD de vidas y de la pausa con `P` se documenta, no se arregla acá.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El HUD muestra "♥ ♥ ♥" estáticos para un juego sin vidas | Limitación documentada; una spec aparte puede hacer el HUD de vidas opcional por `GameDefinition` |
| El HUD no se actualiza si `getState()` devuelve la misma referencia | Snapshot nuevo por llamada (contrato explícito en el Modelo de datos) |
| La comida aparece sobre la serpiente | Se muestrea solo entre las celdas libres |

## Verificación

1. `npm run lint` y `npm run build` sin errores.
2. En `npm run dev`:
   - `/juego/vibora` muestra la ficha con la categoría ARCADE y la portada `cover-snake`.
   - `/juego/vibora/jugar` monta un canvas de 600×600.
3. **Mecánica:**
   - La serpiente avanza sola.
   - Las flechas y WASD giran.
   - La reversa de 180° se ignora.
   - Tocar dos teclas rápido (por ejemplo arriba y después izquierda yendo a la derecha) no mata a la serpiente.
   - Comer suma `10 × nivel` y alarga la serpiente en 1.
   - Cada 5 comidas el HUD muestra el nivel +1 y la velocidad sube de forma perceptible.
4. **Muerte:** chocar una pared produce game over, y chocar el propio cuerpo también. Moverse hacia la celda que ocupaba la cola en ese mismo tick **no** mata.
5. **HUD:** la puntuación y el nivel se actualizan en vivo.
6. **Guardado:** en game over, el estado de sesión pasa a "guardado". `execute_sql` (MCP de Supabase) devuelve la fila correcta:
   `select game_id, score, wave_completed, won from game_sessions where game_id = 'vibora' order by played_at desc limit 1;`
   Se espera `game_id = 'vibora'`, el score y el nivel coincidentes y `won = false`.
7. **Leaderboards:** los selectores de `LeaderboardGlobal`, `LeaderboardPersonal` y `GamesTable` muestran VÍBORA automáticamente (vía `PLAYABLE_GAMES`) sin mezclar puntajes con Asteroids ni con Caída.
8. **Regresión:** Asteroids y Caída siguen jugándose y guardando igual que antes.
