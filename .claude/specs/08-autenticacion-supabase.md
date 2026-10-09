# 08 — Autenticación con Supabase Auth

**Estado:** Implementado
**Depende de:** 04-supabase-integracion (cliente base, `@supabase/ssr` instalado), 05-leaderboard-y-tabla-juegos (`game_sessions`), 07-controles-tactiles-mobile (modal de fin de juego en `GamePlayer.tsx`)
**Fecha:** 2026-10-04
**Objetivo:** Reemplazar el login falso de `localStorage` (`av_user`) por autenticación real con Supabase Auth (registro/login por email con verificación, Google y GitHub, logout), con `username` único en una tabla `profiles` que identifica al jugador en `game_sessions`.

## Por qué existe esta spec

Hoy `components/Auth.tsx` acepta cualquier texto, guarda `{ name }` en `localStorage` y `game_sessions` es de inserción abierta: cualquiera escribe con cualquier `nickname`. Spec 04 instaló `@supabase/ssr` y dejó explícito que se usaría "en el spec de auth". Esta spec cierra esa deuda: identidad real, sesión por cookies, scores atados a un usuario autenticado.

> Nota de tamaño: la spec toca >3 áreas (auth, `profiles`, `game_sessions`/RLS, proxy, perfil). Se propuso dividirla en dos y el usuario decidió **mantenerla en una sola**. El plan está ordenado para que cada paso deje el proyecto funcional.

## Alcance

**Incluye:**

- **Registro por email + contraseña** con campos username, email, contraseña. **Verificación de email activada**: tras registrar se muestra "revisa tu correo"; no hay sesión hasta confirmar.
- **Login por email + contraseña**, **OAuth Google y GitHub** (los botones hoy decorativos de `Auth.tsx` pasan a funcionar), **logout** (`supabase.auth.signOut()`).
- **Ruta `app/auth/callback/route.ts`**: intercambia el `code` (PKCE) por sesión; sirve para confirmación de email y OAuth. Redirige a `next` (validado como ruta relativa) o `/biblioteca`; si el usuario no tiene `profiles.username`, a `/bienvenida`.
- **Tabla `profiles`** (`id` = `auth.users.id`, `username` único case-insensitive). Para registro por email el username viaja en `options.data.username` y un trigger `on auth.users insert` crea el profile. Para OAuth no hay profile hasta que el usuario elige username en **`/bienvenida`** (obligatoria; pantalla con un solo campo).
- **Reglas de username:** 3–10 caracteres, `A-Z 0-9 _`, único sin distinguir mayúsculas, guardado en mayúsculas (compatible con HUD y leaderboard actuales). Validación en cliente **y** `check` en BD. Chequeo de disponibilidad (consulta a `profiles`) antes de registrar/guardar.
- **Validación en el front (antes de llamar a Supabase):** módulo `lib/validation.ts` con validadores puros reutilizados por registro, login, `/bienvenida` y `/perfil`. Errores **inline por campo, en español, en vivo** (al escribir/`onBlur`) y el botón de envío se deshabilita mientras haya errores; ningún request sale con datos inválidos. Reglas:
  - **username:** 3–10, `A-Z 0-9 _` (se normaliza a mayúsculas mientras se escribe; caracteres inválidos se marcan con mensaje específico: "muy corto", "muy largo", "solo letras, números y _").
  - **email:** formato válido (regex razonable + `type="email"`).
  - **contraseña:** mínimo 8 caracteres (en registro; en login solo no vacía).
  - **confirmar contraseña** en registro: debe coincidir.
  - **disponibilidad de username:** consulta a `profiles` con debounce (~400 ms) una vez que el formato es válido; muestra "disponible" / "en uso" sin enviar el formulario. Solo esta regla necesita red.
  La BD (`check`, índice único, RLS) sigue siendo la defensa final, no la primera línea.
- **Clientes Supabase SSR:** `lib/supabase.ts` pasa a crear el cliente browser con `createBrowserClient` (mismo export `supabase`, los imports existentes no cambian); nuevo `lib/supabase-server.ts` con `createServerClient` + cookies para route handlers/Server Components.
- **`proxy.ts`** (convención de Next 16; confirmar en `node_modules/next/dist/docs/`): refresca la sesión en cada request, protege **`/salon` y `/perfil`** (redirige a `/login?next=<ruta>`) y redirige a `/bienvenida` a cualquier usuario logueado sin profile (excepto `/bienvenida`, `/auth/*` y assets).
- **`lib/useUser.ts` reescrito** sobre la sesión de Supabase (`onAuthStateChange`): devuelve `{ id, name } | null` donde `name` = `profiles.username`; estado `loading` expuesto para no parpadear. Elimina `av_user` y `setStoredUser`.
- **`/perfil`** (protegida): muestra email, proveedor y username; permite **editar username** (mismas reglas) y cerrar sesión.
- **`game_sessions` ligada a usuario:**
  - Se **borran todas las filas existentes** (1 fila de prueba) — decisión del usuario.
  - Nueva columna `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade`.
  - RLS: select público (sin cambios); **insert solo `authenticated`** con `user_id = auth.uid()` y `nickname = (select username from profiles where id = auth.uid())`. Se elimina la policy de insert abierta.
  - Trigger en `profiles` (security definer): al cambiar `username`, actualiza `game_sessions.nickname` del usuario.
  - Queries "mis partidas" (`GamesTable`, `LeaderboardPersonal`) pasan de `nickname` a `user_id`.
- **Invitado:** se mantiene "JUGAR COMO INVITADO" (sin sesión). Puede jugar toda la biblioteca pero **no guarda score**. Modal de fin de juego para invitado: muestra puntaje, **sin input de iniciales**, con CTA "INICIA SESIÓN PARA GUARDAR" → `/login?next=...`.
- **Modal de fin de juego (logueado):** se quita el input de iniciales y el guardado en `localStorage` (`av_scores`); muestra el username en solo lectura y el estado del guardado automático existente (`insertGameSession`).
- **`Nav.tsx`:** botón de usuario enlaza a `/perfil` con opción "Cerrar sesión" real; el panel móvil también.
- **`.env.example`:** sin variables nuevas (se usan las dos de Supabase). Documentar `NEXT_PUBLIC_SITE_URL` solo si el paso 1 demuestra que hace falta.
- **Migración versionada** en `supabase/migrations/` aplicada vía MCP, y regenerar `types/supabase.ts`.
- **Configuración manual en dashboards (la hace el usuario; la spec solo lista los pasos):**
  1. Supabase → Auth → Providers: habilitar Email con "Confirm email" activado.
  2. Supabase → Auth → URL Configuration: Site URL y Redirect URLs (`http://localhost:3000/auth/callback` + URL de producción).
  3. Google Cloud Console: credencial OAuth web con redirect `https://bcafdhulvleiegisroth.supabase.co/auth/v1/callback`; pegar Client ID/Secret en Supabase.
  4. GitHub → Developer settings → OAuth App con el mismo callback; pegar Client ID/Secret en Supabase.
  Los secretos **no** pasan por el repo.

**No incluye (para specs futuras):**

- Recuperar / cambiar contraseña, cambiar email, eliminar cuenta.
- Login por username (se entra solo con email).
- Avatar, bio u otros campos de perfil.
- Magic link, OTP, 2FA, otros proveedores OAuth.
- SMTP propio (Resend) para los correos de Auth; se usa el SMTP por defecto de Supabase.
- Vincular manualmente identidades (mismo email con Google y GitHub) más allá del comportamiento por defecto de Supabase.
- Migrar los `localStorage` viejos (`av_user`, `av_scores`): se ignoran.
- Rate limiting propio, captcha, roles/admin.
- Protección de `/games`, `/leaderboard`, `/biblioteca`, `/juego/*` (siguen públicas; `/games` muestra el estado "inicia sesión" que ya implementan sus componentes).
- Tests automáticos (proyecto sin suite).

## Modelo de datos

```sql
-- Nueva
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Z0-9_]{3,10}$'),
  created_at timestamptz not null default now()
);
create unique index profiles_username_key on public.profiles (upper(username));

alter table public.profiles enable row level security;
-- select público (necesario para disponibilidad y leaderboard)
create policy "profiles_select_all" on public.profiles for select using (true);
-- insert/update solo del propio usuario
create policy "profiles_insert_own" on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Trigger 1: auth.users insert -> crea profile si raw_user_meta_data->>'username' existe y es válido
-- Trigger 2: profiles.username update -> actualiza game_sessions.nickname del usuario (security definer)

-- Cambios en game_sessions
delete from public.game_sessions;
alter table public.game_sessions
  add column user_id uuid not null default auth.uid() references auth.users(id) on delete cascade;
create index game_sessions_user_id_idx on public.game_sessions (user_id);
drop policy <policy de insert abierta existente>;  -- nombre real: inspeccionar con list_tables/execute_sql
create policy "game_sessions_insert_own" on public.game_sessions for insert to authenticated
  with check (
    user_id = auth.uid()
    and nickname = (select username from public.profiles where id = auth.uid())
  );
```

Tipos de UI:

```ts
// lib/useUser.ts
export interface AppUser {
  id: string;     // auth.users.id
  name: string;   // profiles.username
}
export function useUser(): AppUser | null;               // compat con consumidores actuales
export function useAuthState(): { user: AppUser | null; loading: boolean };
```

## Plan de implementación

1. **Investigación (sin código):** leer `node_modules/next/dist/docs/` sobre `proxy.ts` y cookies (Next 16.3.4, ver `AGENTS.md`); `search_docs` de Supabase (SSR Next.js, PKCE, OAuth, `signUp` con `options.data`); `list_tables`/`execute_sql` para obtener el nombre real de la policy de insert de `game_sessions`; grep de consumidores de `av_scores`/`av_user`. Confirmar si hace falta `NEXT_PUBLIC_SITE_URL`.
2. **Migración de BD** (`supabase/migrations/NNNN_auth_profiles.sql`, aplicada con `apply_migration`): `profiles`, índices, RLS, triggers, `delete` de `game_sessions`, `user_id`, nuevas policies. Correr `get_advisors` (security) y regenerar `types/supabase.ts`. *El sitio sigue compilando; guardar score queda bloqueado por RLS hasta el paso 7 (aceptado en la rama).*
3. **Clientes SSR:** convertir `lib/supabase.ts` a `createBrowserClient` y crear `lib/supabase-server.ts`. `npm run build` verde.
4. **`app/auth/callback/route.ts`** (exchange del `code`, `next` validado, redirección a `/bienvenida` si no hay profile) y **`proxy.ts`** (refresh de sesión, rutas protegidas, redirección a `/bienvenida`).
5. **`lib/useUser.ts` reescrito** sobre `onAuthStateChange` + consulta a `profiles`; módulo de validación compartido `lib/validation.ts` (validadores puros de username/email/contraseña/confirmación, normalización a mayúsculas) y `checkUsernameAvailable` (consulta a `profiles`, usada con debounce).
6. **UI de auth:** reescribir `components/Auth.tsx` (tabs login/registro con username y confirmar contraseña en registro, validación inline por campo con los validadores del paso 5, botón deshabilitado con errores, estados de error del servidor y "revisa tu correo", botones Google/GitHub con `signInWithOAuth`, invitado intacto); crear `app/bienvenida/page.tsx` (+ componente) y `app/perfil/page.tsx` (+ componente, edición de username y logout); actualizar `components/Nav.tsx` (menú de usuario, logout real, enlace a `/perfil`).
7. **Scores:** `components/GamePlayer.tsx` (modal invitado vs logueado, `nickname` desde `useUser`, quitar input de iniciales y `saveScore` de `localStorage`); `lib/gameSessions.ts` (`fetchSessionsByUserId*` reemplazan a las de nickname); `GamesTable.tsx` y `LeaderboardPersonal.tsx` usan `user.id`; revisar `HallOfFame.tsx` (usa `useUser` solo para mostrar la fila "tú").
8. **Documentación:** actualizar `CLAUDE.md` del proyecto (arquitectura/auth/proxy) y `.env.example` si aplica; marcar en spec 05 la nota "sin autenticación" como superada por 08.
9. **Verificación completa** (criterios de aceptación) + `npm run build` y `npm run lint`.

Cada paso deja el proyecto compilando (`npm run dev` sin errores).

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] Registro con email+contraseña+username válidos muestra "revisa tu correo", **no** crea sesión, y el link del correo lleva a `/biblioteca` con sesión iniciada y `profiles` con el username en mayúsculas.
- [ ] Login con email+contraseña de un usuario confirmado entra; con contraseña errada o email sin confirmar muestra un mensaje de error en español y no crea sesión.
- [ ] Username inválido (corto, largo, caracteres no permitidos) muestra error inline en el formulario **sin disparar ningún request** a Supabase (verificable en la pestaña Network) y el botón de envío queda deshabilitado; lo mismo para email mal formado, contraseña < 8 y confirmación que no coincide.
- [ ] Con formato válido, el formulario indica "disponible"/"en uso" del username (debounce, un request por pausa de tipeo) antes de enviar; las mismas validaciones aplican en `/bienvenida` y `/perfil`.
- [ ] Registrar un username ya usado (incluso con distinta capitalización, ej. `kai` vs `KAI`) se rechaza con mensaje claro; usernames fuera de `^[A-Z0-9_]{3,10}$` también se rechazan en BD (insert directo por SQL falla por `check`).
- [ ] Login con Google y con GitHub crea sesión; en el primer ingreso redirige a `/bienvenida` y no se puede navegar a otras páginas hasta elegir username.
- [ ] Logout desde `Nav` y desde `/perfil` termina la sesión (cookies de Supabase borradas), deja `useUser()` en `null` y redirige a `/biblioteca`.
- [ ] La sesión persiste tras recargar la página y tras cerrar/abrir el navegador.
- [ ] Sin sesión, `/salon` y `/perfil` redirigen a `/login?next=…`; tras loguear vuelve a la ruta pedida. `next` externo (ej. `https://evil.com`) se ignora.
- [ ] `/biblioteca`, `/juego/*`, `/leaderboard`, `/games` y home son accesibles sin sesión.
- [ ] Invitado: puede jugar, al terminar ve puntaje y el CTA "INICIA SESIÓN PARA GUARDAR", **no** se inserta fila en `game_sessions` y no hay input de iniciales.
- [ ] Logueado: al terminar se inserta en `game_sessions` con `user_id = auth.uid()` y `nickname = username`; el modal no tiene input de iniciales.
- [ ] RLS: un `insert` en `game_sessions` con `anon` falla; con `authenticated` y `user_id` ajeno o `nickname` distinto al username falla (probado con `execute_sql`/SDK).
- [ ] Editar username en `/perfil` valida las mismas reglas y actualiza `game_sessions.nickname` de sus partidas previas.
- [ ] "Mis partidas" (`GamesTable`) y `LeaderboardPersonal` muestran solo las partidas de `user.id`.
- [ ] `game_sessions` tiene 0 filas previas a las pruebas (borrado hecho) y `get_advisors` (security) no reporta tablas sin RLS ni funciones security definer sin `search_path` fijo.
- [ ] No quedan referencias a `av_user`, `setStoredUser` ni `av_scores` en el código.
- [ ] Ningún secreto OAuth ni `service_role` aparece en el repo.
- [ ] Los 4 pasos de configuración manual en dashboards están hechos y documentados como completados antes de verificar OAuth.

## Decisiones tomadas y descartadas

- **Sí:** email+contraseña **y** Google/GitHub (pedido del usuario). **No:** magic link/OTP.
- **Sí:** `profiles` con `username` único case-insensitive guardado en mayúsculas. **No:** username solo en `user_metadata` (no garantiza unicidad) ni derivado del email.
- **Sí:** verificación de email activada (decisión del usuario, aunque agrega fricción y la pantalla "revisa tu correo"). Implica depender del SMTP por defecto de Supabase.
- **Sí:** solo usuarios logueados guardan score; invitado juega sin guardar (decisión del usuario). **No:** guardar con nickname libre.
- **Sí:** borrar las filas existentes de `game_sessions` y hacer `user_id not null` (decisión del usuario; solo había 1 fila). **No:** conservar filas huérfanas con `user_id` nulo.
- **Sí:** `/bienvenida` obligatoria para OAuth. **No:** autogenerar username (colisiones, nombres inesperados).
- **Sí:** crear el profile por trigger en registro por email, porque con verificación activada no hay sesión tras `signUp` y RLS impediría el insert desde el cliente.
- **Sí:** `nickname` se mantiene denormalizado en `game_sessions` (el leaderboard actual lo lee sin joins) y se sincroniza por trigger al renombrar; RLS impide falsificarlo.
- **Sí:** validación en el front con módulo compartido, errores inline y chequeo de disponibilidad con debounce (pedido del usuario); BD queda como segunda línea. **No:** librería de formularios (zod/react-hook-form) — validadores puros alcanzan para 4 campos.
- **Sí:** proteger solo `/salon` y `/perfil` (decisión del usuario). **No:** proteger todo ni eliminar el modo invitado.
- **Sí:** mantener en una sola spec pese al tamaño (decisión del usuario, contra la recomendación de dividir).
- **Sí:** mantener el export `supabase` de `lib/supabase.ts` para no tocar todos los imports. **No:** cliente nuevo con otro nombre.
- **Sí:** secretos OAuth solo en dashboards de Supabase/Google/GitHub.
- **Fuera:** recuperar contraseña (no elegida). Consecuencia aceptada: un usuario de email que olvide su contraseña no puede recuperarla hasta una spec futura.

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| SMTP por defecto de Supabase tiene límite bajo de correos/hora y puede ir a spam | Documentado; migrar a Resend como SMTP en spec futura. Probar con pocos registros. |
| Colisión de username entre el chequeo previo y el trigger (condición de carrera) | Índice único en BD; el trigger/insert falla y el cliente mapea el error a "username en uso". |
| Trigger de `auth.users` que lance excepción bloquea el registro con error genérico | Trigger valida y, si el username es inválido o falta, **no** crea profile (el usuario pasa por `/bienvenida`); solo la colisión falla. |
| `proxy.ts` consulta `profiles` en cada navegación de usuario logueado (latencia) | Solo si hay sesión; si resulta lento, cachear flag en cookie. Verificar en paso 4. |
| Usuario OAuth abandona `/bienvenida` y queda con sesión sin profile | `proxy.ts` lo redirige siempre a `/bienvenida`; `GamePlayer` lo trata como invitado. |
| Misma persona con Google y GitHub y mismo email → cuentas duplicadas o vinculadas según config de Supabase | Fuera de alcance; documentar comportamiento observado. |
| Open redirect vía `next` | Validar que sea ruta relativa que empiece con `/` y no con `//`. |
| Rotura de la visibilidad de `game_sessions` al cambiar RLS | Select público no se toca; criterio de aceptación verifica leaderboard sin sesión. |
| Cambios de `proxy.ts` en Next 16 respecto al conocimiento previo | Paso 1 lee las docs locales antes de escribir código. |

## Qué **no** está en este spec

- Recuperación/cambio de contraseña, cambio de email, borrado de cuenta.
- Login por username, avatar/bio, 2FA, magic link.
- SMTP propio, rate limiting, captcha, roles.
- Protección de rutas distintas de `/salon` y `/perfil`.
- Migración de datos de `localStorage`.
- Tests automáticos.

Cada uno, si se aborda, va en su propio spec.
