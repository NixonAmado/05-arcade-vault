# 10 — Medidas de seguridad básicas

**Estado:** Aprobado
**Depende de:** 08-autenticacion-supabase (Auth, `profiles`, `game_sessions`, RLS), 05-leaderboard-y-tabla-juegos
**Fecha:** 2026-10-04
**Objetivo:** Aplicar el checklist `references/security/security-checklist.md`: auditar RLS, headers de seguridad en Next.js, rate limit de signups por IP y endurecer la política de contraseñas de Supabase Auth.

## Por qué existe esta spec

El checklist habla de tablas `games` y `scores`, pero en la BD real solo existen `public.game_sessions` y `public.profiles` (ambas con RLS activo). El ítem RLS se reinterpreta sobre esas tablas. El advisor de Supabase hoy solo reporta `auth_leaked_password_protection`. El signup actual va del navegador directo a Supabase (`supabase.auth.signUp`), por lo que `proxy.ts` no puede limitarlo: hace falta un endpoint propio.

## Alcance

**Incluye:**

- **Auditoría de RLS** sobre `game_sessions` y `profiles`: confirmar RLS activo y revisar cada policy (insert solo `authenticated` con `user_id = auth.uid()`; sin `update`/`delete` anónimos ni de otros usuarios; select público solo donde corresponde). Si se halla una brecha, se corrige con una migración versionada en `supabase/migrations/`. Resultado documentado en la spec al implementar.
- **Headers de seguridad** en `next.config.ts` (`headers()` con `source: '/(.*)'`):
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` restrictiva (cámara, micrófono, geolocalización desactivados; `fullscreen=(self)` permitido por spec 09)
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains`
- **Rate limit de signups por IP: 5 por hora**, con endpoint propio:
  - Nuevo route handler `app/api/signup/route.ts` (POST): lee la IP (`x-forwarded-for`), consulta/incrementa el contador y, si pasa, llama a `supabase.auth.signUp` del lado servidor (`lib/supabase-server.ts`) con `username`, `email`, `password`, `emailRedirectTo`. Si excede: `429` con `{ error }` en español.
  - Contadores en tabla Supabase `signup_attempts`, accedida solo por una función RPC `security definer`; la IP se guarda hasheada (SHA-256 con sal del servidor), nunca en claro.
  - Revalidación server-side de los campos con `lib/validation.ts`.
  - `components/Auth.tsx`: el registro por email llama a `/api/signup` en vez de a `supabase.auth.signUp`; muestra el 429 como error inline.
- **Contraseñas (dashboard de Supabase, pasos manuales del usuario):** subir el largo mínimo a **8** en Auth > Providers > Email (hoy solo se valida en el front).
- **Límite en dashboard como defensa real:** configurar Auth > Rate Limits (sign-ups/sign-ins por IP). El endpoint propio es best-effort porque un atacante puede llamar a Supabase Auth directo con la anon key.
- Actualizar `CLAUDE.md` con una sección de seguridad corta.

**No incluye (para specs futuras):**

- **Leaked password protection** (HaveIBeenPwned): decisión del usuario de dejarlo fuera; el advisor `auth_leaked_password_protection` seguirá en WARN. Depende del plan Pro de Supabase.
- `Content-Security-Policy` (riesgo de romper canvas, Supabase y OAuth; spec propia).
- Captcha (Turnstile/hCaptcha).
- Rate limit de login, OAuth o de inserts en `game_sessions`.
- Redis/Upstash u otros servicios externos.
- Crear tablas `games` o `scores` del checklist.
- Validación server-side de scores (anti-cheat).

## Modelo de datos

```sql
-- Nueva tabla, RLS activo, SIN policies (solo accesible vía RPC security definer)
create table public.signup_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index signup_attempts_ip_hash_created_at_idx
  on public.signup_attempts (ip_hash, created_at desc);
alter table public.signup_attempts enable row level security;
```

Función `public.check_signup_rate(p_ip_hash text, p_limit int, p_window interval) returns boolean`: `security definer`, `set search_path = ''`, borra intentos de más de 24 h, cuenta los de la ventana, inserta el intento si está bajo el límite y devuelve `true`/`false`. `execute` revocado a `anon` y `authenticated`; solo invocable con la service role (o desde el servidor).

Convenciones:

- Constantes del límite (`5`, `1 hour`) en `app/api/signup/route.ts`.
- Si la service role key es necesaria, variable de entorno `SUPABASE_SERVICE_ROLE_KEY` (solo servidor, sin prefijo `NEXT_PUBLIC_`, documentada en `.env.example`).
- Sal del hash: `SIGNUP_IP_SALT` (solo servidor).

## Plan de implementación

1. **Auditoría RLS:** listar policies de `game_sessions` y `profiles` con MCP (`execute_sql` sobre `pg_policies`) y correr `get_advisors`. Si hay brecha, migración correctiva. Dejar el resultado anotado en la spec.
2. **Headers:** agregar `headers()` a `next.config.ts` (conservando `allowedDevOrigins`). Verificar con `curl -I` en `npm run dev`.
3. **Migración `signup_attempts` + `check_signup_rate`:** archivo en `supabase/migrations/`, aplicado por MCP; revocar `execute` a `anon`/`authenticated`; regenerar `types/supabase.ts`.
4. **Variables de entorno:** `.env.example` con `SUPABASE_SERVICE_ROLE_KEY` y `SIGNUP_IP_SALT` (sin valores). El usuario las carga en `.env.local` y en producción.
5. **Route handler `app/api/signup/route.ts`:** validación, hash de IP, llamada al RPC, `signUp` server-side, respuestas `200`/`400`/`429`.
6. **`components/Auth.tsx`:** registro por email vía `fetch('/api/signup')`; manejo de 429 y errores; el resto del flujo (verificación de email, callback) no cambia.
7. **Dashboard (manual, usuario):** largo mínimo de contraseña 8; Auth > Rate Limits.
8. **Documentación:** sección de seguridad en `CLAUDE.md`; correr `get_advisors` de nuevo.

## Criterios de aceptación

- [ ] `game_sessions`, `profiles` y `signup_attempts` tienen `rls_enabled = true`.
- [ ] Un `insert` en `game_sessions` con el rol `anon` falla; un `update`/`delete` sobre filas ajenas falla.
- [ ] `curl -I http://localhost:3000/` devuelve los 5 headers definidos.
- [ ] La app sigue cargando, el canvas funciona y la pantalla completa (spec 09) sigue operando con los headers activos.
- [ ] Los login con Google y GitHub siguen funcionando con los headers activos.
- [ ] Registrar 5 cuentas desde la misma IP en una hora funciona; el 6º intento devuelve `429` y `Auth.tsx` muestra el mensaje en español.
- [ ] La tabla `signup_attempts` no contiene IPs en claro.
- [ ] `anon` y `authenticated` no pueden ejecutar `check_signup_rate` ni leer `signup_attempts`.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` no aparece en el bundle del cliente ni en el repo.
- [ ] Una contraseña de 7 caracteres es rechazada por Supabase Auth (verificado llamando directo a la API).
- [ ] `get_advisors(security)` solo reporta `auth_leaked_password_protection`.
- [ ] `npm run build` y `npm run lint` pasan.

## Decisiones tomadas y descartadas

- **Sí:** auditar RLS sobre `game_sessions`/`profiles`. **No:** crear `games`/`scores`; el checklist se escribió pensando en otro esquema.
- **Sí:** headers básicos + `Permissions-Policy` + HSTS. **No:** CSP ahora; riesgo alto de romper canvas, Supabase y OAuth sin pruebas extensas.
- **Sí:** route handler `/api/signup`. **No:** limitar en `proxy.ts`; el signup directo a Supabase nunca pasa por Next.
- **Sí:** contadores en tabla Supabase vía RPC. **No:** `Map` en memoria (no sirve en serverless), **No:** Upstash (servicio y credenciales nuevos).
- **Sí:** 5 signups/hora por IP. Razón: cubre bots sin bloquear redes compartidas.
- **Sí:** IP hasheada con sal. Razón: no almacenar datos personales innecesarios.
- **Sí:** aceptar el bypass (anon key directo) y cubrirlo con Auth > Rate Limits del dashboard.
- **No:** leaked password protection (decisión del usuario; requiere plan Pro).

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| `x-forwarded-for` falsificable o ausente | Tomar la IP confiable del proveedor de hosting; si falta, usar un bucket `unknown` con el mismo límite. |
| Bloqueo de usuarios legítimos tras NAT compartida | Umbral de 5/h; mensaje claro con tiempo de espera. |
| Headers rompen OAuth o fullscreen | `Permissions-Policy` incluye `fullscreen=(self)`; verificado en criterios. `X-Frame-Options` no afecta redirects OAuth. |
| HSTS en localhost/previews | Solo aplica por HTTPS; navegadores ignoran HSTS en HTTP. |
| Fuga de la service role key | Solo servidor, sin prefijo público, fuera del repo. |
| Atacante salta `/api/signup` | Límite del dashboard como defensa real. |

## Qué **no** está en esta spec

- Leaked password protection.
- Content-Security-Policy.
- Captcha, rate limit de login/OAuth o de scores.
- Redis/Upstash.
- Tablas `games`/`scores`.
- Anti-cheat de puntajes.

Cada uno, si se hace, va en su propia spec.
