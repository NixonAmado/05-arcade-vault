# Plan: migrar Supabase Dev -> Produccion (sin acceso de Claude a prod)

## Context
Hay 2 proyectos Supabase: Dev (`bcafdhulvleiegisroth`, el unico conectado por MCP en `.mcp.json`) y Prod (nuevo, vacio). Claude NO debe tocar prod: todo lo que toque prod lo ejecuta el usuario (CLI/dashboard). Claude solo prepara artefactos en el repo y un runbook.

## Hallazgos (dev, solo lectura)
- Tablas public: `game_sessions` (2 filas), `profiles` (1), `signup_attempts` (0). RLS activo en las 3. Extensiones usadas: solo `pgcrypto`, `uuid-ossp` (default de Supabase). Sin edge functions ni cron.
- Dev tiene 4 migraciones; el repo solo versiona 2 (`supabase/migrations/20261004000000_auth_profiles.sql`, `20261005000000_signup_rate_limit.sql`). **Faltan en el repo `create_game_sessions` y `add_game_id_to_game_sessions`** -> aplicar el repo tal cual a prod FALLARIA (auth_profiles hace `alter table game_sessions`).
- Los 2 scripts del repo ya cubren: policies, triggers, RPC `check_signup_rate` + grants a `service_role`, indices de profiles/signup_attempts.
- Los datos de dev (2 sesiones, 1 profile) son de prueba y estan atados a `auth.users` de dev (FK `user_id`). Migrarlos exigiria migrar usuarios de auth (hashes, identities). **Recomendacion: NO migrar datos**, prod arranca limpio.
- Auth/OAuth/SMTP/redirect URLs/rate limits viven en dashboards, no en SQL: se reconfiguran a mano en prod.

## Pasos

### A. Claude prepara en el repo (rama nueva, via /spec `11-despliegue-produccion` por el flujo spec-driven)
1. Crear baseline `supabase/migrations/20260923000000_baseline_game_sessions.sql` con: `create table game_sessions` (id uuid pk default gen_random_uuid, nickname text, score int check>=0, wave_completed int check>=0, won bool default false, duration_seconds int check>=0, played_at timestamptz default now(), game_id text), RLS on, policy `game_sessions_select_all` (select a anon,authenticated using true), indices `game_sessions_nickname_idx`, `game_sessions_score_idx`, `game_sessions_game_id_idx`, `game_sessions_game_id_score_idx`; y policy temporal `game_sessions_insert_all` (la elimina auth_profiles). Verificar contra dev con `execute_sql` (`pg_get_viewdef`/`pg_indexes`) y validar el orden: baseline < 20261004 < 20261005.
   - Nota: dev tiene timestamps distintos (`20261004155610`, `20261006004356`) a los archivos del repo; en prod se usaran los del repo, es aceptable.
2. Verificar en dev que ejecutar los 3 scripts desde cero reproduce el esquema actual (idealmente en un branch de Supabase o proyecto local `supabase start` + `supabase db reset`), comparando con `supabase db diff`.
3. Agregar `supabase/config.toml` (via `supabase init`) y `references/deploy-produccion.md` (runbook abajo) + checklist de env vars en `.env.example`.
4. Parametrizar entorno: `.env.production` NO se commitea; en el hosting (Vercel u otro) definir vars de prod. Nunca poner la service role key de prod en el repo ni en este chat.
5. Aislar MCP: dejar `.mcp.json` apuntando solo a dev (ya es asi). No agregar un 2do servidor MCP de prod. Agregar a `CLAUDE.md` la regla "Claude no tiene acceso a prod".

### B. Usuario ejecuta en prod (runbook)
1. Aplicar esquema: `supabase login` -> `supabase link --project-ref <PROD_REF>` -> `supabase db push` (aplica las 3 migraciones). Alternativa: pegar los SQL en orden en el SQL Editor de prod.
2. Auth en dashboard prod (replicar dev): Site URL + Redirect URLs (`https://<dominio>/auth/callback`), Email confirmations ON, plantillas de email, SMTP propio (Resend) para no depender del limite del SMTP default, Rate Limits (limite real del signup), password policy; proveedores Google y GitHub con **nuevas** OAuth apps/redirect URI de prod (`https://<PROD_REF>.supabase.co/auth/v1/callback`).
3. Plan: considerar Pro (activa `leaked password protection`, backups diarios).
4. Claves de prod: Settings > API -> `URL`, publishable key, `service_role`. Cargarlas en el hosting: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SIGNUP_IP_SALT` (nueva, `openssl rand -hex 32`, distinta a dev), `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` (dominio verificado en Resend).
5. Dominio/hosting: deploy, HTTPS (HSTS ya en `next.config.ts`).
6. Seguridad: en prod correr Security/Performance Advisors desde el dashboard (Claude no puede). Esperado: solo WARN `auth_leaked_password_protection` si no es Pro. Verificar manualmente: `signup_attempts` sin policies, `check_signup_rate` solo `service_role`, anon no puede insertar en `game_sessions`.
7. Datos (opcional): si se quisiera conservar algo, exportar `game_sessions`/`profiles` con `pg_dump --data-only` solo si tambien se migran `auth.users`; no recomendado.

## Verificacion end-to-end (post deploy, hecha por el usuario)
- Registro por email -> llega correo -> `/auth/callback` -> `/bienvenida`/profile creado por trigger.
- Login Google y GitHub OK; invitado juega sin guardar score; usuario logueado guarda score y aparece en leaderboard.
- Renombrar username actualiza `nickname` (trigger).
- 6to signup/hora desde misma IP responde 429.
- `curl` con anon key: `POST /rest/v1/game_sessions` falla (401/403); `select` en `signup_attempts` devuelve vacio/denegado.
- Advisors de prod limpios.

## Archivos a tocar (cuando se apruebe)
- Nuevos: `supabase/migrations/20260923000000_baseline_game_sessions.sql`, `supabase/config.toml`, `references/deploy-produccion.md`, `.claude/specs/11-despliegue-produccion.md`
- Editar: `.env.example`, `CLAUDE.md` (regla sin acceso a prod, enlace al runbook)
