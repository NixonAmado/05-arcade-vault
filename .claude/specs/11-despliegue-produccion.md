# 11 — Migración de Supabase Dev a Producción

**Estado:** Aprobado
**Depende de:** 08-autenticacion-supabase, 10-medidas-de-seguridad, 05-leaderboard-y-tabla-juegos
**Fecha:** 2026-10-08
**Objetivo:** Dejar el repo con migraciones SQL completas y un runbook para que el usuario cree el esquema y la configuración de Supabase Producción (proyecto nuevo, vacío) sin que Claude tenga acceso a él.

## Por qué existe esta spec

Existen dos proyectos Supabase: Dev (`bcafdhulvleiegisroth`, el único conectado por MCP en `.mcp.json`) y Prod (nuevo). Claude no debe tocar Prod. Dev tiene 4 migraciones, pero `supabase/migrations/` versiona solo 2: faltan `create_game_sessions` y `add_game_id_to_game_sessions`. Aplicar el repo tal cual en Prod falla, porque `20261004000000_auth_profiles.sql` hace `alter table public.game_sessions` sobre una tabla inexistente. Plan de origen: `references/plan-migracion-produccion.md`.

## Alcance

**Incluye:**

- Migración baseline `supabase/migrations/20260923000000_baseline_game_sessions.sql` que crea `game_sessions` (columnas previas a spec 08), RLS, policy `game_sessions_select_all`, policy temporal `game_sessions_insert_all` (la elimina `auth_profiles`) y los índices `game_sessions_nickname_idx`, `game_sessions_score_idx`, `game_sessions_game_id_idx`, `game_sessions_game_id_score_idx`.
- Verificar que las 3 migraciones, aplicadas en orden sobre una BD vacía, reproducen el esquema actual de Dev (tablas, constraints, índices, policies, funciones, triggers, grants).
- `references/deploy-produccion.md`: runbook para el usuario (link/push del esquema, config de Auth en dashboard, variables de entorno del hosting, advisors, pruebas end-to-end).
- `.env.example`: comentarios con el checklist de variables de Prod; `CLAUDE.md`: regla "Claude no tiene acceso a Prod" y enlace al runbook.
- `supabase/config.toml` (vía `supabase init`) para que `supabase link` y `db push` funcionen.

**No incluye (para specs futuras):**

- Migrar datos de Dev (2 `game_sessions`, 1 `profiles`): son de prueba y dependen de `auth.users` de Dev. Prod arranca limpio.
- Migrar usuarios de `auth.users` (hashes, identities).
- Agregar un segundo servidor MCP para Prod o dar a Claude cualquier credencial de Prod.
- Elegir o configurar el hosting/dominio (el usuario lo hace; el runbook solo lista las variables).
- CI/CD de migraciones, entornos de staging, backups programados.
- Content-Security-Policy y otros endurecimientos pendientes de spec 10.

## Modelo de datos

Sin estructuras nuevas respecto a las specs 05, 08 y 10. La baseline solo versiona lo que ya existe en Dev:

```sql
create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  score integer not null check (score >= 0),
  wave_completed integer not null check (wave_completed >= 0),
  won boolean not null default false,
  duration_seconds integer not null check (duration_seconds >= 0),
  played_at timestamptz not null default now(),
  game_id text not null
);
```

Convenciones:

- Nulabilidad y defaults exactos de `nickname`, `game_id` y demás se copian de Dev (`information_schema.columns`) al implementar, no de esta spec.
- Orden de aplicación: baseline (`20260923…`) < `auth_profiles` (`20261004…`) < `signup_rate_limit` (`20261005…`).
- En Dev las versiones registradas difieren (`20261004155610`, `20261006004356`); no se renombran. Prod usará las del repo.

## Plan de implementación

1. **Leer el esquema real de Dev** con MCP (`execute_sql` sobre `information_schema.columns`, `pg_indexes`, `pg_policies`) para `game_sessions` previo a spec 08.
2. **Escribir la baseline** en `supabase/migrations/20260923000000_baseline_game_sessions.sql`.
3. **Probar el orden completo** en una BD vacía (proyecto local con `supabase start` + `supabase db reset`, o branch de Supabase en Dev) y comparar con Dev (`supabase db diff` o consultas equivalentes). Corregir la baseline hasta que no haya diferencias.
4. **`supabase init`** para generar `supabase/config.toml` (sin credenciales; no commitear nada de Prod).
5. **Escribir `references/deploy-produccion.md`** a partir de `references/plan-migracion-produccion.md` (sección "B. Usuario ejecuta en prod" y verificación end-to-end).
6. **Actualizar `.env.example` y `CLAUDE.md`** (regla de aislamiento de Prod, enlace al runbook, lista de migraciones).
7. **El usuario ejecuta el runbook en Prod** (fuera del alcance de Claude).

## Criterios de aceptación

- [ ] `supabase/migrations/` contiene 3 archivos con orden cronológico correcto.
- [ ] Aplicar las 3 migraciones sobre una BD vacía termina sin errores.
- [ ] El esquema resultante coincide con Dev en tablas, columnas, constraints, índices, policies, funciones y triggers del esquema `public`.
- [ ] `get_advisors` sobre Dev sigue reportando solo `auth_leaked_password_protection`.
- [ ] `references/deploy-produccion.md` existe y lista: comandos de link/push, config de Auth (Site URL, redirect URLs, SMTP, Google, GitHub, rate limits) y las 7 variables de entorno de Prod.
- [ ] `.mcp.json` sigue apuntando solo a `bcafdhulvleiegisroth`.
- [ ] Ningún archivo versionado contiene claves, URL ni project ref de Prod.
- [ ] Tras el runbook, el usuario confirma en Prod: registro por email, login Google/GitHub, guardado de score, 429 al 6.º signup por hora y rechazo de `insert` anónimo en `game_sessions`.

## Decisiones tomadas y descartadas

- **Sí:** baseline SQL en el repo, verificada contra Dev. Sin ella Prod no se puede reconstruir.
- **No:** volcar Dev con `pg_dump` y restaurarlo en Prod. Arrastra datos y objetos de Dev y no deja migraciones versionadas.
- **Sí:** Prod arranca sin datos. Las filas de Dev son de prueba y migrarlas exige migrar `auth.users`.
- **Sí:** Claude no recibe acceso a Prod; todo comando contra Prod lo corre el usuario con el runbook.
- **No:** segundo MCP apuntando a Prod. Contradice el requisito de aislamiento.
- **Sí:** `SIGNUP_IP_SALT` nueva y distinta en Prod. Evita correlacionar hashes de IP entre entornos.
- **Sí:** OAuth apps y redirect URIs nuevas para Prod. Las de Dev apuntan al proyecto de Dev.

## Riesgos identificados

| Riesgo                                                               | Mitigación                                                                                   |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Baseline difiere sutilmente de Dev (defaults, nulabilidad)           | Paso 3 compara contra Dev antes de dar el paso por válido                                    |
| Config de Auth (dashboard) queda distinta entre Dev y Prod           | El runbook enumera cada ajuste; verificación end-to-end al final                              |
| `leaked password protection` no disponible sin plan Pro              | WARN aceptado, igual que en Dev (spec 10); el runbook sugiere evaluar Pro                    |
| Filtración de la `service_role` de Prod                              | Solo en variables del hosting, nunca en el repo ni en el chat; rotar desde el dashboard si ocurre |

## Qué **no** está en esta spec

- Migración de datos o de usuarios de Dev.
- Acceso de Claude a Prod (MCP, claves, CLI).
- Elección y configuración del hosting o dominio.
- CI/CD, staging, backups programados, CSP.
