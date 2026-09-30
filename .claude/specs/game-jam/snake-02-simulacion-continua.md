# snake — VÍBORA (Enfoque B: simulación continua con giro analógico)

**Estado:** Borrador
**Depende de:** 05-leaderboard-y-tabla-juegos, 06-caida-tetris
**Fecha:** 2026-09-30
**Objetivo:** Agregar VÍBORA como primer juego real de la categoría ARCADE, con una serpiente de movimiento continuo (posición float, rumbo angular) que gira mientras se mantiene presionada una tecla, estilo "Achtung/slither".

## Por qué existe esta spec

El catálogo tiene dos juegos jugables: `asteroids` (SHOOTER) y `caida` (PUZZLE). ARCADE y VERSUS no tienen ningún juego real. Snake ya estaba sugerido por `game-planner` (`references/game-suggestion-todo.md`, 2026-09-29, "sugerido") y el tema de esta jam lo pide. No hay fuente en `references/started-games/`, así que se escribe desde cero.

La spec 06 ya dejó la infraestructura genérica: `GameEngine`/`GameDefinition`, `GAME_ENGINES`, `game_sessions.game_id` y los selectores de leaderboard, que se arman con `PLAYABLE_GAMES`. No hace falta migrar ni tocar `GamePlayer.tsx`.

Este enfoque busca que VÍBORA no sea "otro snake de grilla". El movimiento continuo con giro sostenido se siente más cercano a Asteroids (rotación con teclas sostenidas y `dt` real), y da más profundidad: curvas cerradas, esquivar el propio cuerpo por centímetros.

## Diferencia con la spec alternativa

Esta es la variante **B** de dos. La variante **A** está en `snake-01-grilla-tick-fijo.md`. El objetivo, el scoring (`10 × nivel` por comida) y el mapeo de `score`/`wave_completed` son los mismos. Difieren en:

- **Arquitectura del motor:**
  - B: simulación continua. La cabeza tiene `x,y` float y un rumbo en radianes. El cuerpo es un rastro de puntos muestreados por distancia, con un presupuesto de longitud en px. La colisión se calcula por distancia entre círculos.
  - A: grilla de enteros, un paso por tick y colisión por igualdad de celdas.
- **Modelo de input:**
  - B: continuo. Mantiene un set de teclas sostenidas, y mientras ← o → está presionada el rumbo rota a `turnRate × dt`. `setKeyUp` **sí** importa: quita la tecla del set.
  - A: edge-triggered, con una cola de 2 direcciones y `setKeyUp` sin efecto.
- **`won`:**
  - B no tiene grilla que llenar, así que `won` es siempre `false` (endless puro).
  - En A, `won` es `true` solo si la serpiente llena la grilla, algo que en la práctica casi nunca pasa.
  - Para el leaderboard el efecto es el mismo.

**Trade-off.** B tiene más personalidad y un techo de habilidad más alto, y reutiliza el patrón de input sostenido de Asteroids. A cambio trae más riesgo:

- **Túnel:** con el `dt` capado a 50 ms, la cabeza puede saltarse la comida o un tramo fino del cuerpo si no hay substeps.
- **Cuello:** hay que excluir los puntos del rastro cercanos a la cabeza para que no cuente como autocolisión.
- **Tuning:** velocidad, giro y grosor.
- **Verificación:** es menos determinista y más difícil de probar a mano.

**Elegí esta si** querés que el juego se diferencie y aceptás 1,5 a 2 veces más trabajo y una iteración de tuning.

**Elegí la otra si** querés el tercer juego jugable rápido y con bajo riesgo.

## Alcance

**Incluye:**

- **Motor `lib/snake-game.ts`:** clase `SnakeGame` que implementa `GameEngine<SnakeState>`.
  - Canvas de **600×600**.
  - Paredes letales: la cabeza sale si `x ± r` o `y ± r` quedan fuera del área.
  - Arranque en el centro, mirando a la derecha.
- **Movimiento:**
  - `speed` arranca en 120 px/s, suma 15 px/s por nivel y tiene tope en 300 px/s.
  - `turnRate` es de 3,5 rad/s y escala levemente con la velocidad, para que el radio de giro no crezca demasiado.
  - Grosor: radio de 7 px.
- **Cuerpo como rastro:**
  - Se agrega un punto cada `SAMPLE = 4` px recorridos.
  - Se recorta desde la cola hasta que la longitud total sea menor o igual a `lengthBudget`.
  - `lengthBudget` arranca en 60 px y suma 20 px por comida.
- **Substeps:** `update(dt)` divide el desplazamiento en pasos de como máximo `r / 2` px, y en cada substep aplica el giro, avanza, muestrea el rastro y chequea las colisiones. Así se evita el túnel.
- **Colisiones:**
  - **Comida:** `dist(cabeza, comida) < r + FOOD_R` (con `FOOD_R` = 8).
  - **Autocolisión:** `dist(cabeza, punto) < r × 1,6` contra los puntos del rastro, **ignorando los primeros `NECK = ceil(3r / SAMPLE)` puntos** desde la cabeza.
  - **Pared:** bordes del canvas.
- **Comida:** un ítem a la vez. Aparece en una posición al azar con un margen de las paredes y a una distancia mínima de cualquier punto del rastro (hasta 30 intentos; si fallan, se acepta el mejor candidato).
- **Niveles:** +1 cada 5 comidas, sin tope, solo afecta velocidad y giro. **Puntuación:** `10 × nivel` por comida, monotónica.
- **Input:**
  - `setKeyDown` y `setKeyUp` mantienen un `Set<string>` de teclas sostenidas.
  - ← y `A` giran antihorario, → y `D` giran horario.
  - Si están las dos presionadas, se anulan.
  - ↑ y ↓ se ignoran; no hay freno ni turbo en esta versión.
- **Dibujo `drawSnake(ctx, state)`** en el mismo módulo:
  - cuerpo como polilínea gruesa (`lineCap/lineJoin = "round"`) en verde neón con glow;
  - cabeza con "ojos" orientados según el rumbo;
  - comida pulsante;
  - overlay de game over.
- **Definición exportada:** `snakeDefinition: GameDefinition<SnakeState>` (600×600).
- **Registro:** entrada `vibora: snakeDefinition` en `lib/game-engines.ts`.
- **Catálogo `lib/games.ts`:** `id: "vibora"`, `title: "VÍBORA"`, `cat: "ARCADE"`, `cover: "cover-snake"` (ya existe en `app/globals.css`), `color: "green"`, `best: 0`, `plays: "0"`.
- **Documentación:** actualizar `references/implemented-games.md` al terminar.

**No incluye (para specs futuras):**

- Turbo o freno con ↑/↓ (mecánica tipo slither que cambia la velocidad a cambio de longitud).
- Obstáculos, power-ups, huecos en el rastro (estilo Achtung) o multijugador local (VERSUS).
- Sonido y controles táctiles (un joystick analógico encajaría bien con este modelo, pero va aparte).
- Pausa con tecla `P` (`GamePlayer` pausa solo con el botón; es un cambio del componente genérico).
- HUD de vidas genérico. VÍBORA muestra los 3 corazones estáticos del estado mock de `GamePlayer`, cuyo stat de vidas sigue atado a `isAsteroids`. Es una limitación conocida.

## Modelo de datos

```ts
// lib/snake-game.ts (forma del estado, no del motor completo)
interface Vec { x: number; y: number }

export interface SnakeState {
  head: Vec;            // px, float
  heading: number;      // radianes
  trail: Vec[];         // trail[0] = más reciente (junto a la cabeza)
  radius: number;       // 7
  food: Vec;
  score: number;
  foodEaten: number;
  level: number;        // 1 + floor(foodEaten / 5)
  speed: number;        // px/s del nivel actual
  gameOver: boolean;
}
// Interno: keys: Set<string>, lengthBudget: number, distSinceSample: number.
```

**Contrato de `getState()`:** devuelve un **objeto nuevo** en cada llamada, como `lib/tetris-game.ts`. Si `trail` se muta en el lugar, basta con un snapshot superficial, porque `draw` y el HUD solo leen. Con la misma referencia, el `setEngineState` de `GamePlayer` no re-renderiza el HUD.

**`GameDefinition`:**

| Campo | Valor |
|---|---|
| `width` / `height` | 600 / 600 |
| `create` | `() => new SnakeGame()` |
| `draw` | `drawSnake` |
| `isGameOver` | `s => s.gameOver` |
| `getScore` | `s => s.score` |
| `getProgress` | `s => s.level` |
| `hasWon` | `() => false` |

**Mapeo a `game_sessions`** (sin migración):

| Columna | VÍBORA |
|---|---|
| `game_id` | `'vibora'` |
| `score` | puntaje acumulado (`10 × nivel` por comida) |
| `wave_completed` | nivel alcanzado |
| `won` | siempre `false` (endless) |
| `duration_seconds` | lo calcula `GamePlayer` |

## Pasos de implementación

1. Crear `lib/snake-game.ts` con los tipos `Vec` y `SnakeState` y estas constantes:
   - tamaño y forma: `W=600`, `H=600`, `RADIUS=7`, `FOOD_R=8`, `SAMPLE=4`, `NECK`;
   - velocidad y giro: `BASE_SPEED=120`, `SPEED_STEP=15`, `MAX_SPEED=300`, `TURN_RATE=3.5`;
   - longitud y progresión: `BASE_LEN=60`, `LEN_PER_FOOD=20`, `FOOD_PER_LEVEL=5`.
2. Implementar la clase `SnakeGame`:
   - **Constructor y `reset()`:** estado inicial, set de teclas vacío y rastro inicial pre-poblado hacia atrás hasta `BASE_LEN`.
   - **`setKeyDown` y `setKeyUp`:** agregan y quitan la tecla del set.
   - **`update(dt)`:**
     1. Si hay `gameOver`, retorna.
     2. Calcula la distancia total (`speed × dt`) y la cantidad de substeps (`ceil(dist / (r / 2))`).
     3. En cada substep: aplica el giro según las teclas, avanza la cabeza, acumula la distancia de muestreo e inserta un punto cuando corresponde.
     4. Recorta el rastro según `lengthBudget`.
     5. Chequea pared, autocolisión (salteando `NECK`) y comida.
     6. Si muere, corta el loop.
   - **Al comer:** suma score, `foodEaten`, `lengthBudget` y nivel si corresponde, recalcula `speed` y respawnea la comida.
   - **`getState()`:** devuelve un snapshot nuevo.
3. Implementar `drawSnake(ctx, state)`: fondo, borde de la arena, comida, rastro como polilínea gruesa, cabeza con ojos y overlay de game over. Solo lee el estado.
4. Exportar `snakeDefinition`.
5. Registrar `vibora: snakeDefinition` en `lib/game-engines.ts`.
6. Agregar la entrada `vibora` en `lib/games.ts` (ARCADE, `cover-snake`, `green`, `best: 0`, `plays: "0"`).
7. Correr `npm run lint` y `npm run build`.
8. Hacer un pase de tuning manual de `speed`, `TURN_RATE`, `RADIUS` y `NECK` jugando varias partidas, y dejar los valores finales documentados en la spec.
9. Verificación manual (ver abajo) y actualizar `references/implemented-games.md`.

## Decisiones

- **Sí: id `vibora` y título "VÍBORA".** Mismo criterio que la variante A.
- **Sí: substeps de como máximo `r / 2`.** `GamePlayer` capa `dt` a 50 ms; a 300 px/s eso son 15 px por frame, el doble del radio. Sin substeps la cabeza puede atravesar la comida o el cuerpo.
- **Sí: ignorar el cuello (`NECK` puntos).** Los primeros puntos del rastro siempre están a menos de `r` de la cabeza; sin excluirlos, la serpiente muere al instante.
- **Sí: rastro muestreado por distancia, no por frame.** La densidad de puntos queda independiente del framerate y del nivel, y la colisión es consistente.
- **Sí: giro con teclas sostenidas (←/→), sin direcciones absolutas.** Es el modelo "tanque" de Asteroids y encaja natural con un rumbo continuo. ↑/↓ quedan libres para un turbo futuro.
- **Sí: `won` siempre `false`.** Sin grilla no hay una condición de "llenado" natural. Sigue el criterio de la skill para juegos endless (como Caída).
- **No: una librería de física.** La colisión círculo-punto es trivial y una dependencia no se justifica.
- **No: tocar `GamePlayer.tsx`.** Las limitaciones del HUD de vidas y de la pausa con `P` se documentan, no se arreglan acá.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Túnel de la cabeza a través de la comida o el cuerpo | Substeps de como máximo `r / 2` px |
| Autocolisión falsa con el cuello o giros cerrados | `NECK` configurable. `turnRate` limitado para que el radio de giro (`speed / turnRate`) sea mayor a `2r`, así no puede morderse girando en el lugar |
| Rendimiento con rastros largos (O(n) por substep) | Con `SAMPLE=4` y longitudes realistas (menos de 3000 px) son menos de 750 puntos. Si hiciera falta, se agrega un bounding box o una grilla espacial en una spec futura |
| Tuning subjetivo: se siente lento o incontrolable | Paso 8 dedicado al tuning, con valores documentados |
| HUD congelado si `getState()` devuelve la misma referencia | Snapshot nuevo por llamada |

## Verificación

1. `npm run lint` y `npm run build` sin errores.
2. En `npm run dev`:
   - `/juego/vibora` muestra la ficha (ARCADE, `cover-snake`).
   - `/juego/vibora/jugar` monta un canvas de 600×600.
3. **Movimiento:**
   - La serpiente avanza sola.
   - Mantener ← o → gira de forma continua, y soltar la tecla deja de girar (confirma que `setKeyUp` funciona).
   - ← y → juntas no giran.
   - ↑ y ↓ no hacen nada.
4. **Comida:**
   - Comer suma `10 × nivel` y alarga la serpiente de forma visible.
   - Cada 5 comidas el nivel sube en el HUD y la velocidad aumenta.
   - En niveles altos (300 px/s) la cabeza no atraviesa la comida sin comerla.
5. **Muerte:**
   - Tocar una pared produce game over.
   - Cruzarse con el propio cuerpo produce game over.
   - Con la longitud inicial (60 px, menor que la circunferencia de giro de unos 215 px), girar al máximo en círculo **no** mata por el cuello. Con una serpiente más larga que esa circunferencia, morderse la cola girando sí es una muerte legítima.
   - En niveles altos no se puede atravesar el cuerpo.
6. **HUD:** la puntuación y el nivel se actualizan en vivo.
7. **Guardado:** en game over, la sesión queda "guardada". `execute_sql` (MCP de Supabase) devuelve la fila correcta:
   `select game_id, score, wave_completed, won from game_sessions where game_id = 'vibora' order by played_at desc limit 1;`
   Se espera `game_id = 'vibora'`, el score y el nivel coincidentes y `won = false`.
8. **Leaderboards:** los selectores de `LeaderboardGlobal`, `LeaderboardPersonal` y `GamesTable` muestran VÍBORA automáticamente, sin mezclar puntajes.
9. **Regresión:** Asteroids y Caída siguen jugándose y guardando igual que antes.
