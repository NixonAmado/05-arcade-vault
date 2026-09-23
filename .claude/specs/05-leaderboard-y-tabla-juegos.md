# SPEC 05: Leaderboard y Tabla de Juegos

**State:** Aprobado
**Depends on:** SPEC 04 (Asteroids Game), 04-supabase-integracion (cliente base)
**Date:** 2026-09-22
**Objective:** Implementar leaderboard (global y personal) y tabla de historial de partidas de Asteroids, persistiendo directamente en Supabase (tabla `game_sessions` con RLS).

## Scope

**In:**
- Tabla `game_sessions` en Supabase (migración versionada en `supabase/migrations/`)
- RLS: lectura pública (leaderboard global es público), inserción abierta desde el cliente (sin autenticación todavía)
- Página de leaderboard (global, con ranking de todos los jugadores) leyendo de Supabase
- Leaderboard personal (mis partidas, filtradas por `nickname` guardado en localStorage)
- Página de tabla de juegos (historial de partidas de Asteroids del usuario) leyendo de Supabase
- Captura automática de partidas al terminar Asteroids → `insert` en `game_sessions`
- Tipos generados con `generate_typescript_types` (`types/supabase.ts`)
- Nickname configurado una vez y reutilizado (sigue en localStorage, `av_user` existente — no se crea sistema de auth)
- Links en menú principal a leaderboard y games

**Not in:**
- Optimización mobile (responsive básico, refinamiento es trabajo futuro)
- Paginación avanzada o filtros complejos
- Autenticación de usuarios (RLS sigue sin `auth.uid()`; cualquiera puede escribir con cualquier nickname)
- Sincronización en tiempo real (Supabase Realtime) — spec futuro
- Catálogo de otros juegos (solo Asteroids de momento)
- Caché offline en localStorage de las partidas (se lee siempre de Supabase; si falla la red, se muestra error, no datos obsoletos)

## Data Model

```sql
create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  score integer not null check (score >= 0),
  wave_completed integer not null check (wave_completed >= 0),
  won boolean not null default false,
  duration_seconds integer not null check (duration_seconds >= 0),
  played_at timestamptz not null default now()
);

create index game_sessions_nickname_idx on public.game_sessions (nickname);
create index game_sessions_score_idx on public.game_sessions (score desc);

alter table public.game_sessions enable row level security;

create policy "game_sessions_select_all"
  on public.game_sessions for select
  using (true);

create policy "game_sessions_insert_all"
  on public.game_sessions for insert
  with check (true);
```

```typescript
// derivado de types/supabase.ts (Tables<'game_sessions'>)
interface GameSession {
  id: string
  nickname: string
  score: number
  wave_completed: number      // Hasta 5 = victoria
  won: boolean
  duration_seconds: number
  played_at: string           // ISO8601
}

interface LeaderboardEntry {
  nickname: string
  totalScore: number          // Suma de todos los scores
  gameCount: number           // Total de partidas jugadas
  victoriesCount: number      // Partidas ganadas (won = true)
  victoryRate: number         // Porcentaje (0-100)
  lastPlayedAt: string        // ISO8601
}
```

## Implementation Plan

1. Consultar `search_docs` (MCP Supabase) sobre RLS y buenas prácticas de escritura sin autenticación antes de escribir la migración.
2. Crear migración con `apply_migration` (MCP): tabla `game_sessions`, índices y políticas RLS de arriba.
3. Generar tipos con `generate_typescript_types` → `types/supabase.ts`.
4. Crear interfaces `GameSession` y `LeaderboardEntry` en `types/index.ts` (basadas en los tipos generados).
5. Crear `lib/gameSessions.ts` con funciones `insertGameSession`, `fetchAllSessions`, `fetchSessionsByNickname` usando el cliente `lib/supabase.ts`.
6. Crear hook `useLeaderboard` que compute entradas del leaderboard a partir de `fetchAllSessions`.
7. Crear página `app/leaderboard/page.tsx` con dos pestañas (global y personal), con estados de loading/error explícitos.
8. Crear componentes `LeaderboardGlobal` y `LeaderboardPersonal` con tabla de datos.
9. Crear página `app/games/page.tsx` con tabla de historial de Asteroids (usa `fetchSessionsByNickname`).
10. Crear componente `GamesTable` que liste todas las partidas del usuario.
11. Integrar con Asteroids: al terminar partida, llamar `insertGameSession` (nickname desde localStorage `av_user`).
12. Agregar links a Leaderboard y Games en menú principal (`app/layout.tsx`).
13. Verificar con `get_advisors` (seguridad) que las políticas RLS no exponen nada más allá de lo previsto.

Cada paso deja el proyecto compilando (`npm run dev` sin errores).

## Acceptance Criteria

- \[ ] Tabla `game_sessions` existe en Supabase con RLS habilitado y las políticas de select/insert públicas
- \[ ] `types/supabase.ts` generado y usado por `lib/gameSessions.ts`
- \[ ] Leaderboard global muestra ranking con: posición, nickname, score total, cantidad de juegos, tasa de victoria, último juego — leído de Supabase
- \[ ] Leaderboard personal filtra solo mis partidas (por nickname), ordenadas por fecha descendente
- \[ ] Tabla de Games muestra historial completo: fecha, score, waves completadas, duración, estado (ganada/perdida)
- \[ ] Al terminar una partida de Asteroids, se inserta un registro en `game_sessions` vía Supabase
- \[ ] Los datos persisten en Supabase (verificable con `execute_sql` o recargando desde otro navegador/dispositivo)
- \[ ] El nickname se configura una sola vez y se reutiliza (localStorage `av_user`, sin cambios respecto al flujo actual)
- \[ ] Páginas accesibles desde menú principal
- \[ ] Estados de carga y error visibles en leaderboard/games (sin quedar en blanco si Supabase no responde)
- \[ ] `get_advisors` (security) no reporta hallazgos nuevos críticos sobre `game_sessions`

## Decisions Taken and Discarded

- **Supabase directo, sin fase intermedia de localStorage:** La integración base (spec 04-supabase-integracion) ya deja `lib/supabase.ts` listo; evita reescribir la persistencia dos veces.
- **RLS abierta (select/insert sin `auth.uid()`):** No hay autenticación en el proyecto todavía. Se documenta como riesgo aceptado, igual que en la versión anterior de este spec.
- **Leaderboard global + personal:** Proporciona contexto competitivo (global) y personal. Una sola vista sería menos informativa.
- **Tabla de Games como historial del usuario:** Más útil que un catálogo estático. El catálogo de juegos disponibles es trabajo futuro.
- **"Victoria" = completar 5 waves:** Definición clásica del juego Asteroids, consistente con SPEC 04.
- **Sin caché local de sesiones:** Al no haber autenticación ni sincronización, cachear en localStorage añadiría complejidad de invalidación sin beneficio claro todavía.

## Identified Risks

- **Sin autenticación:** Cualquiera puede insertar partidas con cualquier nickname o score (sin validación server-side más allá de los `check` de la tabla). Mitigación futura: autenticación + RLS por `auth.uid()`.
- **Cliente puede abusar del insert (spam de partidas falsas):** Sin rate limiting. Aceptado por ahora; revisar si se detectan abusos.
- **Dependencia de red:** Sin caché local, si Supabase no responde el leaderboard/games muestra error en vez de datos. Mitigación: estados de error claros (criterio de aceptación).
- **Migraciones y tipos desincronizados:** Si se edita la tabla a mano, `types/supabase.ts` queda desactualizado. Mitigación: regenerar tipos tras cada migración.
