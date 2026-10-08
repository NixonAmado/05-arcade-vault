# hockey-de-aire — HOCKEY (Enfoque A: paletas en riel, torneo mínimo)

**Estado:** Borrador
**Depende de:** 06-caida-tetris (registro `GAME_ENGINES`, `game_id` en `game_sessions`), 08-autenticacion-supabase (guardado solo con sesión)
**Fecha:** 2026-10-08
**Objetivo:** Agregar HOCKEY, un hockey de aire contra la CPU (primer juego VERSUS del catálogo), con mazo del jugador restringido a un riel horizontal y torneo de 5 rivales de dificultad creciente.

## Por qué existe esta spec

El catálogo tiene ARCADE (Víbora, Frogger), PUZZLE (Caída) y SHOOTER (Asteroids), pero ninguna entrada VERSUS. No se puede hacer multijugador real ni netcode, así que "versus" se resuelve como duelo contra una IA. El hockey de aire es un duelo arcade clásico, legible en un solo canvas, jugable solo con teclado y con score numérico natural. No duplica ningún juego implementado ni sugerido (arkanoid, snake, match-3). Este enfoque minimiza riesgo: movimiento 1D del mazo y física del disco simple, para llegar rápido a un juego completo y estable.

## Diferencia con la spec alternativa

Esta es la variante **A** de dos. La variante **B** está en `hockey-de-aire-02-fisica-de-mazos.md`. Difieren en el eje de **arquitectura del motor y alcance**: A usa mazos en riel (solo se mueven en X dentro de su mitad, velocidad fija, input continuo por teclas sostenidas) y rebote de disco por reflexión + factor según el punto de impacto; B simula mazos circulares libres en 2D con impulso real, fricción y colisión círculo-círculo.

Elegir esta si: se quiere un juego terminado con poco riesgo de bugs de física (tunneling, jitter) y poco tiempo.
Elegir la otra si: se prioriza sensación de juego "real" de hockey de aire y se acepta más complejidad y afinado.

## Alcance

**Incluye:**

- Motor `lib/hockey-game.ts`: clase `HockeyGame` implementa `GameEngine<HockeyState>` y exporta `hockeyDefinition: GameDefinition<HockeyState>`. Sin React ni DOM.
- Mesa vertical en canvas único **480×640**: jugador abajo, CPU arriba, arcos centrados en los lados cortos (ancho 140 px), paredes laterales con rebote perfecto.
- Mazo del jugador en riel: se mueve solo en X (y fijo cerca de su arco), a velocidad constante mientras `ArrowLeft`/`ArrowRight` (o `KeyA`/`KeyD`) estén sostenidas. Input continuo (conjunto de teclas activas), no edge-triggered.
- Disco: círculo con velocidad vectorial; rebota en paredes y mazos por reflexión; el ángulo de salida depende de dónde golpea el mazo (zona central = recto, bordes = diagonal); aceleración leve por golpe de mazo con tope de velocidad; fricción cero.
- CPU en riel: sigue la X predicha del disco con velocidad máxima limitada y retraso de reacción; los parámetros (velocidad, retraso, error de predicción) vienen de una tabla de 5 rivales.
- Formato torneo: cada partido es a 5 goles. Ganar el partido pasa al siguiente rival (5 en total). Perder un partido termina la run.
- Saque tras gol: disco al centro, pausa de 1 s (cuenta regresiva dibujada), el saque va hacia quien recibió el gol.
- Anti-estancamiento: si el disco queda por debajo de una velocidad mínima o en la mitad de un jugador más de 7 s, recibe un impulso hacia el otro lado (en la práctica casi no ocurre con fricción cero, es una red de seguridad).
- Puntuación: +100 por gol anotado; +25 por cada golpe de mazo del jugador en un peloteo (máximo 10 por punto); +500 × número de rival al ganar un partido; +1000 extra al ganar el torneo. El score nunca baja (los goles recibidos no restan).
- Pausa con `P` reutilizando el `paused` genérico de `GamePlayer.tsx`.
- Entrada en `lib/games.ts` (`id: "hockey"`, cat `VERSUS`, color `cyan` o `magenta`, `cover: "cover-hockey"` con estilo en `app/globals.css`, `best: 0`, `plays: "0"`) y registro en `GAME_ENGINES`.
- Táctil: layout registrado en `lib/touch-controls.ts` (izquierda/derecha) según spec 07; el agente `mobile-porter` lo revisa tras implementar.

**No incluye (para specs futuras):**

- Mazo con movimiento libre 2D y física de impulso (es el enfoque B).
- Multijugador local de 2 personas o netcode.
- Power-ups, obstáculos en la mesa, modos extra.
- Skins (`lib/hockey-skins.ts`) y sonido: los cubre el agente `skin-designer` / una spec propia.
- Cambios al esquema de `game_sessions` (se usan las columnas existentes).

## Modelo de datos

```ts
// lib/hockey-game.ts (forma del estado, no del motor completo)
export interface HockeyState {
  puck: { x: number; y: number; vx: number; vy: number; r: number };
  player: { x: number; y: number; w: number };   // riel: y fijo
  cpu: { x: number; y: number; w: number; targetX: number; reactT: number };
  matchGoals: { player: number; cpu: number };   // a 5
  rival: number;            // 1..5, índice en RIVALS[]
  phase: "serve" | "play" | "matchEnd" | "gameOver" | "champion";
  phaseT: number;           // temporizador de la fase (saque, pausa entre partidos)
  rally: number;            // golpes del jugador en el punto actual
  score: number;
  rivalsBeaten: number;
  elapsed: number;
}
```

Mapeo a `GameDefinition` / `game_sessions`:

| Campo | Valor |
|---|---|
| `width` x `height` | 480 x 640 |
| `getScore` | `state.score` (monotónico) |
| `getProgress` -> `wave_completed` | `rivalsBeaten` (0..5) |
| `hasWon` -> `won` | `phase === "champion"` (derrotó a los 5 rivales) |
| `isGameOver` | `phase === "gameOver" \|\| phase === "champion"` |
| `game_id` | `"hockey"` |

`RIVALS[]`: tabla constante de 5 entradas `{ nombre, speed, reactDelay, aimError }` (p. ej. de 180 px/s con 0.30 s de retraso hasta 380 px/s con 0.05 s). Los valores exactos se afinan en la implementación.

## Pasos de implementación

1. Crear `lib/hockey-game.ts` con constantes (mesa, arcos, radios, `RIVALS`), tipos y estado inicial puro.
2. Implementar `update(dt)` con `dt` capado a 50 ms y sub-pasos: mover mazo del jugador según teclas sostenidas, mover CPU, integrar disco, colisión disco-paredes, disco-mazos (reflexión + factor por punto de impacto, separación del disco para evitar quedar pegado) y detección de gol por línea de fondo dentro del arco.
3. Implementar máquina de fases (`serve` -> `play` -> `matchEnd` -> siguiente rival o `gameOver`/`champion`) y puntuación según el Alcance.
4. Implementar `setKeyDown`/`setKeyUp` con conjunto de teclas activas (`ArrowLeft`, `ArrowRight`, `KeyA`, `KeyD`) y `reset()`.
5. Implementar `drawHockey(ctx, state)` (mesa, línea central, arcos, disco, mazos, marcador del partido, nombre del rival, cuenta regresiva de saque) y exportar `hockeyDefinition`.
6. Registrar `hockey: hockeyDefinition` en `lib/game-engines.ts`.
7. Agregar la entrada en `lib/games.ts` y el estilo `cover-hockey` en `app/globals.css`.
8. Registrar el layout táctil en `lib/touch-controls.ts`.
9. Verificar con `/juego/hockey` y `/juego/hockey/jugar`; revisar que leaderboards/tabla incluyan el juego (filtran por `GAME_ENGINES`).
10. Actualizar `references/implemented-games.md` y la lista de motores de `CLAUDE.md`.

Cada paso deja el proyecto compilando.

## Decisiones

- **Sí: mazo en riel.** Elimina la clase de bugs más cara (empuje del disco por un mazo que se mueve en 2D) y hace la CPU trivial de implementar y de balancear con 3 parámetros.
- **Sí: input continuo por conjunto de teclas.** Movimiento de mazo necesita velocidad sostenida; es el patrón de Asteroids, no el edge-triggered de Caída.
- **Sí: score monotónico sin restas.** Requisito de `game_sessions`; perder goles solo acerca el fin de la run.
- **Sí: `won` = campeón del torneo, `wave_completed` = rivales derrotados.** Cumple la convención de la skill `add-arcade-game` (paso 6) sin renombrar columnas.
- **Sí: sub-pasos en `update`.** Con velocidad máxima de disco acotada y sub-pasos se evita el tunneling sin una colisión continua compleja.
- **No: modo 2 jugadores.** Fuera de alcance (no multiplayer real); el 2P local sería otra spec.
- **Sí: id `"hockey"`, cat `VERSUS`.** Primera entrada de la categoría.

## Verificación

1. `npm run build` y `npm run lint` sin errores.
2. `/juego/hockey`: aparece la ficha con categoría VERSUS; `/juego/hockey/jugar`: el canvas 480×640 se ve y el mazo responde a flechas y A/D.
3. Jugar un partido completo: el disco rebota en paredes y mazos, el gol suma +100, el saque tiene cuenta regresiva, el partido termina a 5.
4. Ganar un partido avanza al rival 2 (CPU visiblemente más rápida); perder muestra el modal de fin de juego.
5. Con sesión iniciada, al terminar se inserta una fila en `game_sessions` con `game_id = 'hockey'`, `score` > 0, `wave_completed` = rivales derrotados y `won = false` (verificable con `execute_sql` del MCP de Supabase). Como invitado, el modal ofrece iniciar sesión y no guarda.
6. `P` pausa y reanuda sin que el disco se mueva; cambiar de pestaña no produce un salto del disco (cap de `dt`).
7. El leaderboard y la tabla muestran Hockey como juego seleccionable; Asteroids, Caída, Víbora y Frogger no cambian.
8. `get_advisors` (seguridad) sin hallazgos nuevos.
