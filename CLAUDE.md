# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

No hay suite de tests configurada todavía.

## Skills

Usa siempre la skill /frontend-design para diseñar interfaces de usuario.

- `spec-impl-game` (`.claude/skills/spec-impl-game/`): como `/spec-impl` pero para juegos nuevos; al terminar la implementación lanza en secuencia `skin-designer` y luego `mobile-porter`. Invocación explícita (`disable-model-invocation`).
- `add-arcade-game` (`.claude/skills/add-arcade-game/`): guía para agregar un nuevo juego jugable al catálogo (portado de `references/started-games/` o desde cero) y conectarlo al leaderboard compartido (`game_sessions`). No reemplaza el flujo `/spec` + `/spec-impl`: reúne el contexto técnico específico del dominio para alimentar la fase de preguntas de `/spec`, y ese contenido es lo que `/spec-impl` ejecuta después. Se dispara con "agregar un juego", "portar tetris/arkanoid/...", o al tocar `lib/games.ts`, `GamePlayer.tsx`, `GameDetail.tsx` o `game_sessions`.

## Agentes

- `game-planner` (`.claude/agents/game-planner.md`): subagente que decide y propone qué juego agregar al catálogo (recomendación + 2 alternativas), sin escribir código ni specs. Mantiene memoria propia en `.claude/agent-memory/game-planner/MEMORY.md` y registra cada sugerencia en `references/game-suggestion-todo.md`. Invocar antes de correr `/spec` para un juego nuevo.
- `game-jam` (`.claude/agents/game-jam.md`): subagente que, dado un tema, diseña un juego y escribe 2 specs alternativas (enfoques distintos al mismo problema) en estado "Borrador" dentro de `.claude/specs/game-jam/`. No escribe código ni marca specs como "Aprobado"; el usuario elige un enfoque y luego sigue el flujo `/spec` + `/spec-impl` normal.
- `skin-designer` (`.claude/agents/skin-designer.md`): subagente que diseña **e implementa directamente** un sistema de skins de color (neon, retro, clásica por defecto) para un juego ya implementado del catálogo — paletas concretas, `SkinPalette` inyectado en `draw()`, selector de cara al usuario y persistencia en `localStorage`. Verifica primero que el juego no tenga ya esta integración. **Excepción explícita** (decisión del usuario) al flujo spec-driven: modifica código sin pasar por `/spec` ni `/spec-impl`; no toca `lib/game-engines.ts` ni otros juegos.

- `mobile-porter` (`.claude/agents/mobile-porter.md`): subagente que revisa la parte mobile de un juego (controles táctiles, layout, pausa, háptica, modal) según la spec `07-controles-tactiles-mobile`; registra el layout en `lib/touch-controls.ts` y reporta brechas. Usar al agregar un juego nuevo.

## Juegos con motor

Registrados en `lib/game-engines.ts` (`GAME_ENGINES`): `asteroids`, `caida` (Tetris), `vibora` (Snake), `frogger`. Lista detallada en `references/implemented-games.md` (actualizarla al agregar uno). Skins por juego en `lib/*-skins.ts`; táctil en `lib/touch-controls.ts`, `components/TouchControls.tsx`, `lib/haptics.ts`, `lib/useIsMobile.ts`.

## Flujo spec-driven

Este proyecto no escribe código sin una spec en `.claude/specs/NN-slug.md`. Las skills de usuario `/spec` y `/spec-impl` (invocación explícita, no se disparan solas) manejan todo el ciclo: numeración, plantilla, preguntas de aclaración, creación de rama `spec-NN-slug`, y ejecución paso a paso con pausas para revisar el diff (sin commits automáticos). `/spec-impl` solo avanza si la spec está en estado "Aprobado".

Specs existentes: 01-mvp-pantallas, 02-home-page, 03-about-page, 04-asteroids-game, 04-supabase-integracion, 05-leaderboard-y-tabla-juegos, 06-caida-tetris, 07-controles-tactiles-mobile. Specs de game-jam en `.claude/specs/game-jam/`: `snake-01-grilla-tick-fijo` (implementada como VÍBORA), `snake-02-simulacion-continua`, `frogger` (implementada).

## Hooks

Hook `PostToolUse` (`Edit|Write`) con `.claude/hooks/eslint-fix.mjs` existe en el repo, pero hoy `.claude/settings.json` está vacío (`{}`) y `settings.local.json` tiene `hooks: []`; no hay hooks activos.

## MCP

- **supabase** (`.mcp.json`, tipo `http`, remoto): acceso a la base de datos del proyecto Supabase (`bcafdhulvleiegisroth`) con features `docs, account, database, debugging, development, functions, branching`. Inspeccionar tablas existentes antes de migrar; revisar logs y advisories antes de debuggear.

## Proveedores / integraciones externas

- **Supabase** (`@supabase/ssr`, `@supabase/supabase-js`): base de datos, auth y backend del leaderboard/game_sessions.
- **Resend** (`resend`): envío de emails.

## Arquitectura

Proyecto Next.js (App Router):

- Rutas en `app/`: `/` (home), `acerca`, `biblioteca`, `games`, `juego/[id]`, `leaderboard`, `login`, `salon`
- `components/` — UI (`GamePlayer`, `GameDetail`, `TouchControls`, leaderboards, `Library`, `Auth`, etc.)
- `lib/` — motores (`*-game.ts`, `game-engine.ts`, `game-engines.ts`), catálogo (`games.ts`), Supabase (`supabase.ts`, `gameSessions.ts`, `useLeaderboard.ts`, `useUser.ts`)
- `app/globals.css` — estilos globales (Tailwind v4 vía `@tailwindcss/postcss`)
- Alias de import `@/*` apunta a la raíz del repo (ver `tsconfig.json`)
- TypeScript en modo `strict`

**Importante:** este repo usa una versión de Next.js (16.3.4) con cambios que pueden diferir del conocimiento de entrenamiento. Antes de escribir código, consultar `node_modules/next/dist/docs/` (ver `AGENTS.md`) para las convenciones y APIs correctas de esta versión.
