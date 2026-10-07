# hockey-de-aire — HOCKEY AÉREO (Enfoque B: torneo de 5 rivales, física con sub-pasos)

**Estado:** Borrador
**Depende de:** 06-caida-tetris (registro `GAME_ENGINES`, `game_id`), 08-autenticacion-supabase (guardado solo con sesión), 07-controles-tactiles-mobile
**Fecha:** 2026-10-07
**Objetivo:** Agregar HOCKEY AÉREO como primer juego VERSUS en forma de torneo contra 5 rivales de dificultad creciente, con física de sub-pasos y transferencia de momento del mazo al disco.

## Por qué existe esta spec

La categoría `VERSUS` de `lib/games.ts` está vacía y no hay forma de multijugador real sin netcode, así que se cubre con un duelo contra la CPU. Un único partido (enfoque A) se agota rápido y su score tiene poco rango; esta variante convierte el hockey en una escalera: cada partido ganado sube al siguiente rival y se pierde la racha al perder un partido, lo que le da rango a `score` y significado real a `wave_completed` y `won`, en línea con el resto de los arcades del catálogo (niveles de Frogger/Caída, waves de Asteroids).

## Diferencia con la spec alternativa

Esta es la variante **B** de dos. La variante **A** está en `hockey-de-aire-01-partido-simple-ia-reactiva.md`. Difieren en dos ejes: (1) **alcance** (B: torneo de 5 rivales con parámetros de IA propios; A: un partido) y (2) **arquitectura de la física** (B: integración con sub-pasos fijos de 1/240 s, mazo con velocidad real que transfiere momento al disco, IA predictiva con trayectoria; A: un paso por frame y mazo cinemático).

Trade-off: B ofrece mejor sensación de juego y rejugabilidad, pero tiene más superficie de bugs (acumulación de tiempo en sub-pasos, estabilidad numérica, balance de 5 IAs) y mayor tiempo de tuning.

Elegir esta si: se prioriza que el juego se sienta bien y tenga progresión; se acepta un riesgo medio.
Elegir la otra si: se prioriza velocidad de entrega y bajo riesgo.

## Alcance

**Incluye:**
- Motor `lib/hockey-game.ts`: `HockeyGame` (implementa `GameEngine<HockeyState>`) y `hockeyDefinition: GameDefinition<HockeyState>`, registrado como `hockey` en `lib/game-engines.ts`.
- Canvas vertical **360×600** con mesa, porterías y HUD interno (marcador, nombre del rival, número de partido 1/5).
- **Física con sub-pasos:** `update(dt)` acumula tiempo y avanza en pasos fijos de 1/240 s (máximo 12 sub-pasos por frame, el exceso se descarta). Evita tunneling y hace el resultado independiente de la tasa de frames.
- **Mazo con velocidad real:** el mazo del jugador se mueve con aceleración y amortiguación (teclas sostenidas); al colisionar con el disco, el impulso resultante usa la velocidad relativa mazo-disco (colisión circular elástica con coeficiente de restitución) en lugar de un valor fijo.
- Rebote en bandas con restitución < 1 y fricción de mesa baja; tope de velocidad del disco.
- **5 rivales** definidos en una tabla de datos (`OPPONENTS`): `{ nombre, velocidadMax, retardoReaccion, predice (bool), agresividad, errorAim }`. Rival 1 reactivo y lento; rival 5 predictivo (proyecta la trayectoria del disco con rebotes de banda) y rápido.
- Partido: a 5 goles. Ganar sube al siguiente rival (breve pantalla intermedia de 1,5 s con el nombre del próximo rival). Perder un partido termina la partida (`isGameOver`).
- Victoria final: vencer al rival 5 (`hasWon`).
- Pausa con `P` (genérico de `GamePlayer.tsx`).
- Catálogo (`id: "hockey"`, `cat: "VERSUS"`, `color: "yellow"`, `cover: "cover-hockey"`), `cover-hockey` en `app/globals.css`, y actualización de `references/implemented-games.md`.

**No incluye (para specs futuras):**
- Multijugador local o en línea.
- Efecto/spin del disco y power-ups.
- Selector de dificultad o de rival.
- Sonido; skins (`skin-designer`); el layout táctil se registra y revisa con `mobile-porter`.
- Cambios al esquema de `game_sessions`.

## Modelo de datos

```ts
// lib/hockey-game.ts (forma del estado)
interface Vec { x: number; y: number }

interface Mallet { pos: Vec; vel: Vec; r: number }

interface Opponent {
  name: string;
  maxSpeed: number;       // px/s
  reactionDelay: number;  // s
  predictive: boolean;
  aggression: number;     // 0..1, cuánto avanza a golpear
  aimError: number;       // px de error en el punto de golpe
}

export interface HockeyState {
  player: Mallet;
  cpu: Mallet;
  puck: { pos: Vec; vel: Vec; r: number };
  matchIndex: number;     // 0..4 (rival actual)
  playerGoals: number;    // del partido en curso (0..5)
  cpuGoals: number;       // del partido en curso (0..5)
  totalGoals: number;     // acumulado del torneo (goles propios)
  serveTimer: number;     // pausa de saque
  interludeTimer: number; // pantalla entre partidos (> 0 = en pausa de transición)
  accumulator: number;    // tiempo no consumido por sub-pasos
  elapsed: number;        // segundos jugados en total
  gameOver: boolean;
  won: boolean;           // venció al rival 5
}
```

Mapeo a `game_sessions` (`game_id = 'hockey'`):

| Campo | Valor |
|---|---|
| `getScore` | `totalGoals * 100 + partidosGanados * 500 + (won ? 2000 : 0)`. Monotónico no decreciente. |
| `getProgress` -> `wave_completed` | partidos ganados (0-5), es decir, rival alcanzado menos 1. |
| `hasWon` -> `won` | venció al rival 5. |
| `duration_seconds` | lo calcula `GamePlayer.tsx`. |

`width = 360`, `height = 600`. Sin cambios de esquema (`game_id` ya existe).

## Pasos de implementación

1. Crear `lib/hockey-game.ts` con constantes de mesa, tipos y la tabla `OPPONENTS` (5 entradas).
2. Implementar el input continuo: `setKeyDown`/`setKeyUp` mantienen teclas sostenidas (flechas y WASD) y definen la aceleración del mazo.
3. Implementar `update(dt)`: capar `dt`, acumular y ejecutar sub-pasos fijos de 1/240 s (tope de 12). Cada sub-paso integra mazos (con amortiguación y límites de mitad), disco, rebotes y colisiones.
4. Implementar la colisión disco-mazo con velocidad relativa y restitución; separar los cuerpos tras el choque para evitar solapamiento persistente.
5. Implementar la IA parametrizada por `OPPONENTS[matchIndex]`: modo reactivo y modo predictivo (proyección de trayectoria con rebotes de banda), con retardo de reacción y error de puntería.
6. Implementar la máquina de estados del torneo: gol -> saque; fin de partido -> interludio -> siguiente rival o game over/victoria.
7. Implementar `drawHockey(ctx, state)` (solo lectura): mesa, mazos, disco, marcador, nombre del rival, pantalla de interludio.
8. Exportar `hockeyDefinition` y registrarlo en `lib/game-engines.ts`.
9. Agregar la entrada en `lib/games.ts` y `cover-hockey` en `app/globals.css`.
10. Registrar el layout táctil en `lib/touch-controls.ts` o dejar la brecha reportada por `mobile-porter`.
11. Actualizar `references/implemented-games.md` y la lista de motores en `CLAUDE.md`.
12. Tuning: jugar cada rival al menos 3 veces; ajustar `OPPONENTS` hasta que el rival 1 sea ganable por un principiante y el 5 exija jugar bien.

Cada paso deja el proyecto compilando.

## Decisiones

- **Sí: sub-pasos fijos con acumulador.** Resultado determinista y sin tunneling; costo: más código y un límite de sub-pasos para evitar el "spiral of death" (se descarta el exceso, como el cap de 50 ms de Asteroids).
- **Sí: transferencia de momento.** Da la sensación esperada de hockey de aire; riesgo de inestabilidad, mitigado con tope de velocidad del disco y separación post-colisión.
- **Sí: IA como datos (`OPPONENTS`).** Balancear es editar una tabla, sin tocar la lógica.
- **Sí: perder un partido termina la run.** Estilo arcade (monedas); da tensión y mantiene el `won` significativo.
- **Sí: `wave_completed` = partidos ganados, `won` = venció al rival 5.** Documentado según la skill `add-arcade-game` (paso 6); no se renombran columnas.
- **Sí: score sumando goles, partidos y bonus de victoria.** Rango amplio y comparable entre partidas del mismo juego; el leaderboard sigue separado por juego.
- **No: partidos a 7 goles.** Se usa 5 para que la run de 5 rivales dure unos 10-15 minutos.
- **Sí: input continuo** (distinto del edge-triggered de Caída) porque el mazo acelera mientras se sostiene la tecla.
- **Invitado:** puede jugar pero no guarda sesión (spec 08).

## Verificación

1. `npm run build` y `npm run lint` sin errores.
2. `npm run dev`: abrir `/juego/hockey` (categoría VERSUS) y `/juego/hockey/jugar`.
3. Confirmar que el movimiento del mazo acelera/frena suavemente y respeta su mitad de la mesa.
4. Probar a distintas tasas de frames (ej. throttling de CPU en DevTools): el disco no atraviesa los mazos ni las bandas y la velocidad del juego no cambia.
5. Golpear con el mazo en movimiento vs. quieto: el disco sale con distinta velocidad.
6. Ganar un partido: aparece el interludio con el nombre del siguiente rival y el marcador se reinicia; el rival se nota más rápido/predictivo.
7. Perder un partido: game over con modal. Ganar los 5: victoria con `won = true`.
8. Con sesión, confirmar con `execute_sql` una fila `game_id = 'hockey'` con `wave_completed` = partidos ganados y `won` correcto. Como invitado, el modal ofrece iniciar sesión.
9. `P` pausa también durante interludio y saque sin desincronizar el acumulador (al reanudar no hay salto de física).
10. El leaderboard por juego muestra HOCKEY AÉREO sin mezclarse con otros juegos; los demás juegos siguen funcionando.
