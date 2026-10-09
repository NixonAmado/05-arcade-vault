# Runbook: desplegar Arcade Vault en Supabase Produccion

Lo ejecuta el usuario. Claude NO tiene acceso a Prod (el MCP de `.mcp.json` apunta solo a Dev). Spec: `.claude/specs/11-despliegue-produccion.md`.

Prod arranca limpio: no se migran datos ni usuarios de Dev.

## 1. Esquema (migraciones)

Orden en `supabase/migrations/`: `20260923000000_baseline_game_sessions` -> `20261004000000_auth_profiles` -> `20261005000000_signup_rate_limit`.

```bash
supabase login
supabase link --project-ref <PROD_REF>
supabase db push --dry-run   # revisar que lista las 3 migraciones
supabase db push
```

Alternativa sin CLI: pegar los 3 `.sql` en orden en SQL Editor del dashboard de Prod.

## 2. Auth (dashboard de Prod)

- Authentication > URL Configuration: Site URL `https://<dominio>`; Redirect URLs `https://<dominio>/auth/callback`.
- Providers > Email: confirmacion de email ON, largo minimo de password 8.
- SMTP propio (Resend, dominio verificado) y plantillas de email.
- Providers > Google y GitHub: crear OAuth apps NUEVAS para Prod con callback `https://<PROD_REF>.supabase.co/auth/v1/callback`; pegar Client ID/Secret.
- Rate Limits: configurar sign-ups/sign-ins por IP (limite real; `/api/signup` es best-effort).
- Evaluar plan Pro (leaked password protection, backups diarios).

## 3. Variables de entorno (hosting)

| Variable | Origen |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Settings > API > Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Settings > API > publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings > API > service_role (solo servidor) |
| `SIGNUP_IP_SALT` | nueva: `openssl rand -hex 32` (distinta a Dev) |
| `RESEND_API_KEY` | Resend |
| `CONTACT_TO_EMAIL` | tu correo |
| `CONTACT_FROM_EMAIL` | remitente de dominio verificado en Resend |

Nunca commitear ni pegar en el chat la `service_role` de Prod.

## 4. Verificacion en Prod

Advisors (dashboard > Advisors): esperado solo `auth_leaked_password_protection` si no hay Pro.

- Registro por email: llega correo -> `/auth/callback` -> `/bienvenida` -> profile creado.
- Login con Google y GitHub.
- Invitado juega sin guardar score; usuario logueado guarda score y sale en el leaderboard.
- Renombrar username actualiza `nickname`.
- 6.o signup en una hora desde la misma IP responde 429.
- Con la anon key: `POST /rest/v1/game_sessions` falla; `GET /rest/v1/signup_attempts` no devuelve filas.
- `rpc/check_signup_rate` con anon key responde 401/403.
