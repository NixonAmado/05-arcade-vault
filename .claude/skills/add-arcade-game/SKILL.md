---
name: add-arcade-game
description: Guía paso a paso para agregar un nuevo juego jugable a Arcade Vault (Next.js + Supabase), ya sea portando uno de los juegos vanilla JS de references/started-games/ o construyendo uno desde cero, y conectándolo al leaderboard/historial compartido en game_sessions. Usa esta skill siempre que pidan "agregar un juego", "portar tetris/arkanoid/[cualquier juego]", "integrar un juego con leaderboard", "sumar un juego nuevo al catálogo", o cuando la tarea toque lib/games.ts, GamePlayer.tsx, GameDetail.tsx o game_sessions para soportar más de un juego. También aplica si piden generalizar cómo GamePlayer.tsx soporta múltiples motores de juego en vez de un if hardcodeado por juego. Esta skill no reemplaza a /spec ni /spec-impl (el flujo spec-driven que ya usa este repo): reúne las decisiones técnicas propias de un juego arcade para alimentar /spec, y define qué debe llevar el plan de implementación que /spec-impl ejecutará después.
argument-hint: '<carpeta-de-referencia-en-references/started-games/ (ej. 03-tetris, 04-arkanoid) | "desde cero" | id de un juego ya en lib/games.ts a completar>'
---

# Agregar un juego arcade con leaderboard

## Por qué existe esta skill

Hoy solo "asteroids" es un juego real en `lib/games.ts`; las otras 8 entradas son mocks sin motor. El código real de Asteroids quedó cableado a mano en `components/GamePlayer.tsx` (`isAsteroids = game?.id === "asteroids"`) y la tabla `game_sessions` de Supabase no tiene columna que identifique el juego — asume que todo es Asteroids. Si el próximo juego se agrega copiando ese patrón, cada juego nuevo agrega un `if` más a `GamePlayer.tsx` y mezcla sus puntajes con los de Asteroids en el mismo leaderboard. Esta skill existe para que el segundo juego (y los siguientes) generalicen el patrón en vez de repetirlo, y para no perder de vista los pasos de Supabase (migración + tipos) que son fáciles de saltear.

Este proyecto es spec-driven: no se escribe código sin una spec en `.claude/specs/`. Esta skill no escribe esa spec ni implementa código directamente — reúne el contexto específico de "agregar un juego" (los pasos 0 a 7) para que `/spec` lo use en su fase de preguntas, y ese mismo contenido es lo que `/spec-impl` va a ejecutar paso a paso después. Ver la sección siguiente.

## Relación con `/spec` y `/spec-impl`

`/spec` y `/spec-impl` (skills de usuario con `disable-model-invocation: true`, es decir que no se disparan solas por descripción — hay que invocarlas explícitamente, con `/spec ...` o llamándolas por nombre) son las dueñas del ciclo de vida completo de una spec: numeración del archivo, plantilla, preguntas de aclaración, creación de la rama `spec-NN-slug`, ejecución paso a paso con pausas para revisar el diff, y nunca commitean solas. Esta skill **no duplica nada de eso**:

- No escribas vos mismo `.claude/specs/NN-slug.md` ni inventes el número — eso lo hace `/spec` (Fase 4: revisa `.claude/specs/`, toma el siguiente número libre, arranca en estado `Draft`/`Borrador`, y crea `.spec-config.yml` si no existe).
- No implementes código por tu cuenta siguiendo esta skill "por fuera" del flujo — el plan de implementación (pasos 2 a 7 de más abajo) debe quedar escrito dentro de la sección "Plan de implementación" de la spec, y es `/spec-impl` quien lo ejecuta paso por paso, pausando después de cada uno para que se revise el diff, sin commits automáticos.
- `/spec-impl` solo avanza si el estado de la spec dice "Aprobado" (o equivalente) — una spec en `Draft` generada a partir de esta skill sigue necesitando que alguien la revise y la apruebe a mano antes de implementar nada.

Lo que sí aporta esta skill: `/spec` en su Fase 2 pregunta por scope, datos, integración, riesgos, etc. de forma genérica — no conoce de antemano que `game_sessions` no tiene `game_id`, ni que `GamePlayer.tsx` tiene un `if isAsteroids` hardcodeado, ni la forma que debería tener un `GameEngine`. Los pasos 0 a 7 de esta skill son exactamente esas respuestas ya masticadas para el dominio "juego arcade nuevo". El flujo recomendado es:

1. Recorré los pasos 0, 2, 3, 6 y 7 de abajo para esta skill **antes** de invocar `/spec`, y llegá a decisiones concretas (fuente del juego, si toca el refactor del registro de motores, qué significan `wave_completed`/`won` para este juego, si el leaderboard queda separado por juego).
2. Invocá `/spec` (explícitamente, no esperes a que se dispare sola) pasándole esas decisiones como parte de la descripción inicial, para que su Fase 2 tenga menos que preguntar y pueda ir directo a redactar (su propio "fast path" cuando ya no falta información).
3. Cuando la spec resultante quede en `Draft`, pedí que la revisen y la pasen a `Aprobado`.
4. Recién ahí corré `/spec-impl NN-slug`, que va a implementar el plan (pasos 2 a 7 de esta skill) deteniéndose después de cada paso.

## Paso 0 — Elegir la fuente del juego

**No adivines esto — si quien te invoca no te dio ya la referencia explícita (carpeta de `references/started-games/`, o "desde cero", o el `id` de un juego mock existente en `lib/games.ts`), preguntalo antes de seguir.** Hay tres carpetas hoy (`02-asteroids` ya portado, `03-tetris` y `04-arkanoid` sin portar) y ninguna es un default razonable — portar Tetris y portar Arkanoid son trabajos distintos, y "desde cero" ni siquiera necesita `references/`.

Dos caminos, misma integración final:

- **Portar desde `references/started-games/<carpeta>`**: usá `02-asteroids` (ya portado) solo como referencia de "cómo se ve un port terminado", no como fuente a portar de nuevo. Cada carpeta trae su propio `game.js`/`index.html` y a veces `CLAUDE.md`/`README.md` describiendo su arquitectura interna — léelos enteros antes de tocar código, no asumas que todos tienen la forma de Asteroids (Arkanoid además trae `assets/` con spritesheet y sonidos que hay que copiar a `public/games/<slug>/` y cargar con rutas absolutas `/games/<slug>/...`, no las rutas relativas del HTML original).
- **Crear desde cero**: define mecánica, estado y loop directamente en TypeScript siguiendo la misma interfaz del paso 2. No hace falta un `game.js` de origen, pero sí hace falta que el pedido original describa la mecánica — si no la describe, preguntala.

En ambos casos, identifica antes de programar:
- Dimensiones del canvas (o si el juego no usa canvas, ver "Juegos sin canvas" más abajo).
- Qué significa "score", "nivel/progreso" y "victoria" en ese juego — lo vas a necesitar para el paso 6 (`game_sessions` asume esos tres conceptos).
- Assets externos (sprites, sonidos, fuentes).

## Paso 1 — Qué le llevás a `/spec`

Con las decisiones del paso 0 ya tomadas, seguí a los pasos 2, 3, 6 y 7 para terminar de definir lo técnico, y después invocá `/spec` con un resumen que incluya:

- Juego elegido y fuente (portado desde `references/started-games/<carpeta>` o desde cero).
- Si este juego es el que dispara el refactor de `GamePlayer.tsx` a un registro de motores (paso 3), o si ya existe el registro y solo agrega una entrada.
- Qué representan `wave_completed` y `won` para este juego en `game_sessions` (paso 6) — es el dato que más se olvida y `/spec` no lo va a preguntar si no se lo das.
- Si el leaderboard/historial queda filtrado por juego, unificado, o ambos.

`/spec` se encarga del resto: número de archivo, slug, estado inicial `Draft`/`Borrador`, y de crear `.claude/specs/.spec-config.yml` si hiciera falta (ya existe en este repo con `AutoCreateBranch: true`, así que `/spec-impl` va a crear `spec-NN-<slug>` sola). No te adelantes a escribir el `.md` de la spec vos mismo.

## Paso 2 — Motor del juego en `lib/`

Independiente de si portás o creás desde cero, el motor va en `lib/`, sin dependencias de React ni del DOM (debe poder testearse o correrse fuera del navegador). Sigue la forma que ya usa `lib/asteroids-game.ts`, pero exprésala con esta interfaz común para que el registro del paso 3 funcione para cualquier juego:

```ts
// lib/game-engine.ts
export interface GameEngine<TState = unknown> {
  update(dt: number): void;
  getState(): TState;
  setKeyDown(code: string): void;
  setKeyUp(code: string): void;
  reset(): void;
}

export interface GameDefinition<TState = unknown> {
  width: number;
  height: number;
  create(): GameEngine<TState>;
  draw(ctx: CanvasRenderingContext2D, state: TState): void;
  isGameOver(state: TState): boolean;
  getScore(state: TState): number;
  getProgress(state: TState): number; // nivel, wave, líneas, lo que aplique
  hasWon(state: TState): boolean;
}
```

Si estás portando un `game.js` vainilla:
1. Separa el estado puro (posiciones, velocidades, vidas, score) de las llamadas a `canvas`/`document`/`addEventListener`.
2. El `update(dt)` debe ser la única función con lógica de física/colisiones — nada de leer `Date.now()` disperso, usa el `dt` que le pasa el loop (mismo patrón que Asteroids, que capa `dt` a 50ms para evitar el "spiral of death" si la pestaña estuvo en pausa).
3. El dibujo (`draw`) es una función separada que solo lee el estado y pinta en un `ctx` — no debe mutar estado. En Asteroids esta función (`drawAsteroids`) quedó definida dentro de `GamePlayer.tsx`; para el juego nuevo ponla en el propio módulo de `lib/` junto al motor, así el componente no crece con cada juego.
4. Mapea el input (teclado, y si aplica táctil) a `setKeyDown`/`setKeyUp` con los mismos códigos que ya usa el navegador (`"ArrowUp"`, `"Space"`, etc.), igual que Asteroids.

**Juegos sin canvas** (por ejemplo algo basado en grilla/DOM): el `GameDefinition` de arriba puede no encajar 1:1 — está bien, adapta la forma pero conserva el contrato de `getScore`/`getProgress`/`hasWon`/`isGameOver`, que es lo que necesitan el HUD y el guardado de sesión.

## Paso 3 — Registro de motores (reemplaza el `if` hardcodeado)

`GamePlayer.tsx` hoy decide con `isAsteroids = game?.id === "asteroids"`. Al agregar el segundo juego real, migra ese patrón a un registro en vez de sumar un segundo `if`:

```ts
// lib/game-engines.ts
import type { GameDefinition } from "@/lib/game-engine";
import { asteroidsDefinition } from "@/lib/asteroids-game";
// import { tetrisDefinition } from "@/lib/tetris-game";

export const GAME_ENGINES: Record<string, GameDefinition> = {
  asteroids: asteroidsDefinition,
  // tetris: tetrisDefinition,
};
```

Y en `GamePlayer.tsx`, sustituye el branch `isAsteroids` por `const engineDef = GAME_ENGINES[game.id]`:
- Si `engineDef` existe → montar canvas de `engineDef.width`×`engineDef.height`, loop genérico (`engineDef.create()`, `update`, `draw`, `isGameOver`), HUD leyendo `getScore`/`getProgress`.
- Si no existe (los 8 juegos mock que siguen sin motor real) → mantener el placeholder visual actual, sin romperlo.

Este refactor es el costo de agregar el segundo juego; los siguientes juegos ya no tocan `GamePlayer.tsx` en absoluto, solo agregan una entrada al registro. Documenta este refactor como paso propio en el plan de implementación de la spec (no lo mezcles silenciosamente con el juego nuevo).

`components/GameDetail.tsx` hoy muestra un leaderboard con `seededScores` (datos falsos, no Supabase). No es parte obligatoria de agregar un juego, pero si tu spec decide reemplazarlo por datos reales, hazlo usando el mismo `useLeaderboard`/`fetchSessionsByGame` del paso 6, filtrado por `game.id`.

## Paso 4 — Catálogo `lib/games.ts`

Agrega (o reemplaza si ya existía como mock) la entrada real en el array `GAMES`, respetando la interfaz `Game` existente (`id`, `title`, `short`, `long`, `cat`, `cover`, `color`, `best`, `plays`). `best`/`plays` arrancan en `0`/`"0"` como hizo Asteroids — se recalculan solos una vez haya partidas reales en `game_sessions`, no los inventes. Si usas una clase `cover-<slug>` nueva, agrégale su estilo en `app/globals.css` (revisa cómo están definidas `cover-asteroids`/`cover-bricks`, etc.).

## Paso 5 — Verifica código muerto antes de duplicar rutas

Existe una ruta vieja independiente `/games/asteroids/play` (`app/games/asteroids/page.tsx` + `components/AsteroidsGame.tsx`) que parece ser un remanente del plan original de la spec 04, ya superado por la ruta genérica `/juego/[id]/jugar` (`components/GamePlayer.tsx`). No repliques ese patrón standalone para el juego nuevo — usa siempre `/juego/[id]` + `/juego/[id]/jugar`. Si confirmas que esa ruta vieja ya no se usa (revisa que no esté enlazada desde `lib/games.ts` ni el menú), señálalo en la spec como candidato a limpieza; no lo borres sin que la spec lo autorice explícitamente.

## Paso 6 — `game_sessions` para múltiples juegos

La tabla actual (`.claude/specs/05-leaderboard-y-tabla-juegos.md`) es: `id, nickname, score, wave_completed, won, duration_seconds, played_at`, con RLS abierta (select/insert públicos). No tiene columna de juego. Antes de insertar sesiones del juego nuevo, migra:

```sql
alter table public.game_sessions
  add column game_id text not null default 'asteroids';

alter table public.game_sessions
  alter column game_id drop default;

create index game_sessions_game_id_idx on public.game_sessions (game_id);
create index game_sessions_game_id_score_idx on public.game_sessions (game_id, score desc);
```

El `default 'asteroids'` es solo para backfillear las filas existentes sin romperlas; se quita después de aplicar la migración con datos ya poblados. Usa la herramienta MCP de Supabase para aplicar la migración (no edites la tabla a mano) y luego regenera `types/supabase.ts` con la herramienta de generación de tipos — si no lo regeneras, `types/index.ts` (`GameSession = Tables<"game_sessions">`) queda desactualizado y no vas a poder pasar `game_id` sin un error de tipos.

Después de la migración:
- `lib/gameSessions.ts`: `insertGameSession` ya acepta cualquier campo de `TablesInsert<"game_sessions">`, así que solo necesitas pasar `game_id` al llamarlo (paso 7). Agrega `fetchSessionsByGame(gameId)` y una variante con nickname (`fetchSessionsByNicknameAndGame`) — no rompas las funciones existentes, los llamados actuales de Asteroids deben seguir funcionando.
- `lib/useLeaderboard.ts`: `computeLeaderboard` agrupa hoy solo por `nickname`. Agrega un parámetro `gameId` (o una variante `computeLeaderboardForGame`) que filtre las sesiones por juego antes de agrupar — si no lo haces, el leaderboard global mezcla los puntajes de dos juegos distintos como si fueran comparables.
- `components/LeaderboardGlobal.tsx`, `LeaderboardPersonal.tsx`, `components/GamesTable.tsx`: hoy no reciben `gameId`. Decide en la spec si el leaderboard es por-juego (con un selector) o si mantiene un ranking "general" además del de cada juego — cualquiera de las dos es válida, pero documéntalo como decisión explícita.

**Sobre `wave_completed` y `won`**: son nombres pensados para Asteroids. No los renombres a la ligera (es una migración más grande y rompe el spec 05 tal cual está aceptado); en su lugar, documenta en la spec del juego nuevo qué representan para ese juego. Ejemplos: en un juego de bloques, `wave_completed` puede ser el nivel alcanzado y `won` si limpió todos los niveles; en un juego sin condición de victoria clara (por ejemplo un endless), `won` puede quedar siempre en `false` y usarse solo `score`. Si en el futuro varios juegos se sienten forzados con estos nombres, ahí sí vale la pena una spec dedicada a generalizar la tabla (ej. `progress_value`/`completed`) — no lo hagas de paso dentro de la spec de un juego.

## Paso 7 — Conectar el fin de partida

En el lugar donde `GamePlayer.tsx` hoy llama `insertGameSession` al terminar Asteroids, agrega `game_id: game.id` al payload y usa `engineDef.getScore/getProgress/hasWon(state)` (paso 3) en vez de leer campos específicos de Asteroids, así el mismo bloque de guardado sirve para cualquier juego del registro.

## Paso 8 — Qué va en "Criterios de aceptación"

Esta lista es la base para la sección "Criterios de aceptación" que `/spec` redacte, y lo que `/spec-impl` verifica al terminar el último paso del plan (antes de que alguien pase el estado a `Implementado` y decida mergear):

- [ ] `npm run build` y `npm run lint` sin errores.
- [ ] `npm run dev`: se puede abrir `/juego/<slug>` y `/juego/<slug>/jugar`, jugar una partida completa y llegar a game over.
- [ ] Al terminar la partida se inserta una fila en `game_sessions` con el `game_id` correcto (verificable con `execute_sql` del MCP de Supabase).
- [ ] El leaderboard global/personal y la tabla de historial reflejan el juego nuevo sin mezclar puntajes con Asteroids de forma indebida (según lo decidido en el paso 6).
- [ ] Las partidas viejas de Asteroids (sin tocar) siguen apareciendo igual que antes — la migración no debe perder datos.
- [ ] `get_advisors` (seguridad, MCP de Supabase) no reporta hallazgos nuevos sobre `game_sessions`.
