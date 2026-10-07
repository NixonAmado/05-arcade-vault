# hockey-de-aire — HOCKEY AÉREO (Enfoque A: partido único, IA reactiva)

**Estado:** Borrador
**Depende de:** 06-caida-tetris (registro `GAME_ENGINES`, `game_id`), 08-autenticacion-supabase (guardado solo con sesión), 07-controles-tactiles-mobile
**Fecha:** 2026-10-07
**Objetivo:** Agregar HOCKEY AÉREO como primer juego de la categoría VERSUS (jugador vs CPU): un único partido a 7 goles, con física simplificada y una IA reactiva fácil de implementar.

## Por qué existe esta spec

El catálogo tiene 4 juegos (ARCADE x2, PUZZLE, SHOOTER) y la categoría `VERSUS` no tiene ninguno, aunque aparece en `CATS` de `lib/games.ts`. Sin multijugador real ni netcode, la forma natural de cubrirla es un duelo contra la CPU. El hockey de aire es un tema original (no es Pong/Arkanoid ni está en `game-suggestion-todo.md`), se juega solo con teclado, y su física (disco, rebotes, mazo) es una mecánica distinta a las ya implementadas (grilla, caída de piezas, nave inercial, carriles).

Este enfoque apuesta por el mínimo viable: un partido, una dificultad, mazo cinemático (sin transferencia de momento realista) y una IA que solo reacciona.

## Diferencia con la spec alternativa

Esta es la variante **A** de dos. La variante **B** está en `hockey-de-aire-02-torneo-fisica-sustepeada.md`. Difieren en dos ejes: (1) **alcance** (A: un partido; B: torneo de 5 rivales con dificultad creciente) y (2) **arquitectura de la física** (A: un paso por `update(dt)` con mazo cinemático; B: sub-pasos fijos con transferencia de momento del mazo al disco y IA predictiva).

Elegir esta si: se quiere llegar rápido a algo jugable y se acepta una sensación de "arcade simple"; riesgo bajo.
Elegir la otra si: se quiere que el juego tenga rejugabilidad y progresión (wave_completed con significado real) y se tolera más tuning de física.

## Alcance

**Incluye:**
- Motor `lib/hockey-game.ts`: `HockeyGame` (implementa `GameEngine<HockeyState>`) y `hockeyDefinition: GameDefinition<HockeyState>`, registrado en `lib/game-engines.ts` como `hockey`.
- Canvas vertical **360×600**: mesa con bandas, línea central, dos porterías (arriba CPU, abajo jugador), HUD interno mínimo (marcador).
- Mazo del jugador controlado con flechas/WASD: velocidad máxima constante, limitado a su mitad de la mesa. Mazo de la CPU en la mitad superior.
- Disco: círculo con velocidad, rebote elástico contra bandas laterales (con pequeña pérdida), fricción ligera, tope de velocidad.
- Colisión disco-mazo circulo-circulo: el disco sale en la dirección del vector centro mazo -> centro disco con velocidad = max(velocidad actual, base) + factor fijo (el mazo es cinemático, no transfiere su velocidad real).
- Gol: el disco cruza la línea de fondo dentro del ancho de portería; pausa de 1 s de "saque" y el disco reaparece en el centro (sacando quien recibió el gol).
- IA reactiva: sigue la coordenada X del disco con velocidad máxima limitada y un retardo de reacción fijo; si el disco está en su mitad y se acerca, avanza a golpearlo; si no, vuelve a una posición defensiva.
- Fin de partida: primero a 7 goles. `isGameOver` es true cuando alguien llega a 7.
- Pausa con `P` reutilizando el `paused` genérico de `GamePlayer.tsx`.
- Entrada en `lib/games.ts` (`id: "hockey"`, `cat: "VERSUS"`, `color: "yellow"`, `cover: "cover-hockey"`, `best: 0`, `plays: "0"`) y estilo `cover-hockey` en `app/globals.css`.
- Actualizar `references/implemented-games.md`.

**No incluye (para specs futuras):**
- Torneo/progresión de rivales y dificultad selectable (ver enfoque B).
- Transferencia de momento realista del mazo, efecto/spin.
- Multijugador local de 2 teclados o en línea.
- Sonido y skins (los cubre luego `skin-designer`; el layout táctil lo revisa `mobile-porter`, ver Decisiones).
- Cambios al esquema de `game_sessions` o renombrar columnas.

## Modelo de datos

```ts
// lib/hockey-game.ts (forma del estado)
interface Vec { x: number; y: number }

interface Mallet { pos: Vec; vel: Vec; r: number }

export interface HockeyState {
  player: Mallet;           // mitad inferior
  cpu: Mallet;              // mitad superior
  puck: { pos: Vec; vel: Vec; r: number };
  playerGoals: number;      // 0..7
  cpuGoals: number;         // 0..7
  serveTimer: number;       // segundos restantes de pausa de saque (0 = en juego)
  elapsed: number;          // segundos de partido (excluye saques)
  gameOver: boolean;
}
```

Mapeo a `GameDefinition` y `game_sessions` (`game_id = 'hockey'`):

| Campo | Valor |
|---|---|
| `getScore` | `playerGoals * 100 + (gana ? 500 + max(0, 180 - floor(elapsed)) * 2 : 0)`. Monotónico no decreciente durante la partida. |
| `getProgress` -> `wave_completed` | goles del jugador (0-7). |
| `hasWon` -> `won` | `playerGoals >= 7`. |
| `duration_seconds` | lo calcula `GamePlayer.tsx` como hoy. |

`width = 360`, `height = 600`.

Sin cambios de esquema: `game_id` ya existe tras spec 06.

## Pasos de implementación

1. Crear `lib/hockey-game.ts` con constantes (mesa, radios, velocidades, gol a 7), tipos y `HockeyGame` con `reset()`.
2. Implementar el input: `setKeyDown`/`setKeyUp` mantienen un set de teclas sostenidas (flechas y WASD); el mazo se mueve de forma continua en `update(dt)`. `P` no se maneja en el motor.
3. Implementar `update(dt)`: cap de `dt` a 50 ms, movimiento del mazo con límites de su mitad, movimiento del disco, rebote contra bandas, colisión disco-mazo (ambos mazos), detección de gol y temporizador de saque.
4. Implementar la IA reactiva dentro de `update` (seguir X del disco con velocidad máxima, retardo fijo, posición defensiva).
5. Implementar `drawHockey(ctx, state)` (solo lectura del estado): mesa, bandas, líneas, porterías, mazos, disco, marcador y cuenta del saque.
6. Exportar `hockeyDefinition` con `isGameOver`, `getScore`, `getProgress`, `hasWon`.
7. Registrar `hockey: hockeyDefinition` en `lib/game-engines.ts`.
8. Agregar la entrada al catálogo en `lib/games.ts` y `cover-hockey` en `app/globals.css`.
9. Registrar el layout táctil en `lib/touch-controls.ts` (joystick/cruceta para mover el mazo) o dejar la brecha reportada por `mobile-porter`.
10. Actualizar `references/implemented-games.md` y la lista de motores de `CLAUDE.md`.
11. Verificación manual (sección siguiente).

Cada paso debe dejar el proyecto compilando.

## Decisiones

- **Sí: mazo cinemático.** Reduce el tuning; el disco recibe un impulso fijo en vez de integrar el momento del mazo. Trade-off: menos "feeling" físico.
- **Sí: un `update` por frame con `dt` capado a 50 ms.** Mismo patrón que Asteroids. Riesgo conocido: a velocidades altas el disco puede atravesar un mazo (tunneling); se mitiga con tope de velocidad del disco menor al diámetro del mazo por frame a 20 fps.
- **Sí: score basado en goles + bonus por victoria y rapidez.** Es numérico y monotónico, y premia ganar por sobre solo marcar.
- **Sí: `wave_completed` = goles propios, `won` = ganó el partido.** Se documenta el significado según la skill `add-arcade-game` (paso 6); no se renombran columnas.
- **No: dificultad variable.** La IA tiene una sola configuración; el torneo queda para el enfoque B.
- **Sí: id `hockey` y categoría `VERSUS`, color `yellow`** (el único color del tipo `Game.color` sin juego).
- **Sí: input continuo (teclas sostenidas)**, a diferencia de Caída (edge-triggered), porque el mazo se mueve de forma analógica en el tiempo.
- **Invitado:** puede jugar pero no guarda sesión (comportamiento general de spec 08).

## Verificación

1. `npm run build` y `npm run lint` sin errores.
2. `npm run dev`: abrir `/juego/hockey` (aparece en la categoría VERSUS) y `/juego/hockey/jugar`.
3. Mover el mazo con flechas y WASD; confirmar que no cruza la línea central ni las bandas.
4. Golpear el disco: sale en la dirección esperada; rebota en las bandas; no se queda atascado en una esquina.
5. Marcar un gol y recibir uno: el marcador se actualiza, hay saque de 1 s y el disco reaparece en el centro.
6. `P` pausa y reanuda.
7. Jugar hasta 7 goles (ganar) y hasta perder: aparece el modal de fin de partida con el score.
8. Con sesión iniciada, confirmar con `execute_sql` (MCP Supabase) una fila en `game_sessions` con `game_id = 'hockey'`, `wave_completed` = goles propios y `won` correcto. Como invitado, el modal ofrece iniciar sesión.
9. Leaderboard: el selector por juego muestra HOCKEY AÉREO sin mezclar puntajes con otros juegos.
10. Los demás juegos siguen funcionando igual.
