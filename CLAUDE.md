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

- `security-auditor` (`.claude/agents/security-auditor.md`): subagente de solo lectura que audita seguridad (RLS/policies/grants/advisors vía MCP supabase, fugas de datos, headers, `proxy.ts`, `/api/signup`, secretos, open redirect) contra las specs 08 y 10 y `references/security/security-checklist.md`. Reporta hallazgos por severidad; no modifica código ni BD (los arreglos van por `/spec`). Usar tras migraciones o cambios en auth/proxy/api y antes de deploy.

## Juegos con motor

Registrados en `lib/game-engines.ts` (`GAME_ENGINES`): `asteroids`, `caida` (Tetris), `vibora` (Snake), `frogger`. Lista detallada en `references/implemented-games.md` (actualizarla al agregar uno). Skins por juego en `lib/*-skins.ts`; táctil en `lib/touch-controls.ts`, `components/TouchControls.tsx`, `lib/haptics.ts`, `lib/useIsMobile.ts`.

## Flujo spec-driven

Este proyecto no escribe código sin una spec en `.claude/specs/NN-slug.md`. Las skills de usuario `/spec` y `/spec-impl` (invocación explícita, no se disparan solas) manejan todo el ciclo: numeración, plantilla, preguntas de aclaración, creación de rama `spec-NN-slug`, y ejecución paso a paso con pausas para revisar el diff (sin commits automáticos). `/spec-impl` solo avanza si la spec está en estado "Aprobado".

Specs existentes: 01-mvp-pantallas, 02-home-page, 03-about-page, 04-asteroids-game, 04-supabase-integracion, 05-leaderboard-y-tabla-juegos, 06-caida-tetris, 07-controles-tactiles-mobile, 08-autenticacion-supabase, 09-pantalla-completa-y-canvas-viewport (canvas ajustado al alto del viewport; botón/tecla F de pantalla completa vía `lib/useFullscreen.ts`, fallback CSS en iPhone). Specs de game-jam en `.claude/specs/game-jam/`: `snake-01-grilla-tick-fijo` (implementada como VÍBORA), `snake-02-simulacion-continua`, `frogger` (implementada).

## Hooks

Hook `PostToolUse` (`Edit|Write`) con `.claude/hooks/eslint-fix.mjs` existe en el repo, pero hoy `.claude/settings.json` está vacío (`{}`) y `settings.local.json` tiene `hooks: []`; no hay hooks activos.

## MCP

- **supabase** (`.mcp.json`, tipo `http`, remoto): acceso a la base de datos del proyecto Supabase (`bcafdhulvleiegisroth`) con features `docs, account, database, debugging, development, functions, branching`. Inspeccionar tablas existentes antes de migrar; revisar logs y advisories antes de debuggear.

## Proveedores / integraciones externas

- **Supabase** (`@supabase/ssr`, `@supabase/supabase-js`): base de datos, auth y backend del leaderboard/game_sessions.
- **Resend** (`resend`): envío de emails.

## Autenticación (spec 08)

Supabase Auth con sesión en cookies (`@supabase/ssr`): email+contraseña con verificación de email, Google y GitHub (configurados en los dashboards de Supabase/Google/GitHub, no en el repo).

- `profiles` (`id` = `auth.users.id`, `username` único case-insensitive, `^[A-Z0-9_]{3,10}$`, en mayúsculas). Registro por email: un trigger en `auth.users` crea el profile desde `user_metadata.username`. OAuth: sin profile hasta elegir username en `/bienvenida`.
- `game_sessions.user_id` (`not null`, default `auth.uid()`). Insert solo `authenticated` con `user_id = auth.uid()` y `nickname = profiles.username` (RLS). Renombrar el username actualiza `nickname` por trigger. Select público.
- **Invitado:** puede jugar pero no guarda score (el modal de fin de juego ofrece iniciar sesión).
- Clientes: `lib/supabase.ts` (browser, export `supabase`) y `lib/supabase-server.ts` (`createClient()` para route handlers/Server Components). `proxy.ts` refresca la sesión (`getClaims`), protege `/salon`, `/perfil` y `/bienvenida` (redirige a `/login?next=`) y manda a `/bienvenida` a quien tenga sesión sin profile. `app/auth/callback/route.ts` canjea el `code` (email/OAuth).
- Cliente: `lib/useUser.ts` (`useUser()` → `{ id, name } | null`, `useAuthState()`, `refreshUser()`); `lib/validation.ts` (validadores puros, la validación va en el front antes de llamar a Supabase); `lib/profiles.ts` + `lib/useUsernameCheck.ts` (disponibilidad con debounce); `lib/auth-redirect.ts` (`safeNext`, anti open redirect).
- Migraciones versionadas en `supabase/migrations/` (también aplicadas por MCP).

## Seguridad (spec 10)

- **Headers** en `next.config.ts` (`headers()`): nosniff, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (`fullscreen=(self)`), HSTS. Sin CSP (spec futura).
- **Signup con rate limit:** el registro por email va por `app/api/signup/route.ts` (5/hora por IP). La IP se hashea (SHA-256 + `SIGNUP_IP_SALT`) y el contador vive en `signup_attempts`, accesible solo vía el RPC `check_signup_rate` (`security definer`, solo `service_role`). Es best-effort: el límite real es Auth > Rate Limits del dashboard de Supabase.
- **Env solo servidor:** `SUPABASE_SERVICE_ROLE_KEY` y `SIGNUP_IP_SALT` (sin prefijo `NEXT_PUBLIC_`, ver `.env.example`). Nunca importarlas desde código cliente.
- **RLS:** `game_sessions`, `profiles` y `signup_attempts` con RLS activo. Tabla nueva = RLS activo (`signup_attempts` no tiene policies a propósito: solo vía RPC); correr `get_advisors` tras cada migración. Único WARN aceptado: `auth_leaked_password_protection` (requiere plan Pro).

## Arquitectura

Proyecto Next.js (App Router):

- Rutas en `app/`: `/` (home), `acerca`, `biblioteca`, `games`, `juego/[id]`, `leaderboard`, `login`, `salon`, `perfil`, `bienvenida`, `auth/callback` (route handler); `proxy.ts` en la raíz
- `components/` — UI (`GamePlayer`, `GameDetail`, `TouchControls`, leaderboards, `Library`, `Auth`, `Welcome`, `Profile`, `AuthField`, etc.)
- `lib/` — motores (`*-game.ts`, `game-engine.ts`, `game-engines.ts`), catálogo (`games.ts`), Supabase (`supabase.ts`, `supabase-server.ts`, `gameSessions.ts`, `useLeaderboard.ts`, `useUser.ts`, `profiles.ts`, `validation.ts`)
- `app/globals.css` — estilos globales (Tailwind v4 vía `@tailwindcss/postcss`)
- Alias de import `@/*` apunta a la raíz del repo (ver `tsconfig.json`)
- TypeScript en modo `strict`

**Importante:** este repo usa una versión de Next.js (16.3.4) con cambios que pueden diferir del conocimiento de entrenamiento. Antes de escribir código, consultar `node_modules/next/dist/docs/` (ver `AGENTS.md`) para las convenciones y APIs correctas de esta versión.
