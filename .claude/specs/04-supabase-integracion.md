# 04 — Integración base de Supabase

**Estado:** Aprobado
**Depende de:** 03-about-page
**Fecha:** 2026-09-20

**Objetivo:** Conectar el proyecto Next.js con el proyecto Supabase existente (`bcafdhulvleiegisroth`) mediante `@supabase/supabase-js`, variables de entorno y un cliente mínimo, sin tablas ni autenticación todavía.

## Alcance

**Incluye:**

- Dependencias nuevas: `@supabase/supabase-js` y `@supabase/ssr` (npm).
- Variables de entorno (`.env.local`, no versionado; documentadas en `.env.example`):
  - `NEXT_PUBLIC_SUPABASE_URL` — URL del proyecto (obtenida vía MCP `get_project_url`).
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — clave publicable (obtenida vía MCP `get_publishable_keys`).
- Cliente único `lib/supabase.ts` que exporta `supabase`, creado con `createClient` y las dos variables. Si falta alguna, lanza un error claro al importar.
- `.env.example` actualizado con las dos variables nuevas (valores vacíos), conservando las de Resend.
- Corrección de seguridad en `.env.example`: vaciar el valor de `RESEND_API_KEY` (hoy contiene lo que parece una clave real y `.gitignore` permite versionar ese archivo con `!.env.example`).
- Verificación manual de que la URL configurada coincide con la del proyecto enlazado en `.mcp.json`.

**No incluye:**

- Tablas, políticas RLS, migraciones ni carpeta `supabase/` (nace con la primera tabla, en un spec futuro).
- Autenticación: `components/Auth.tsx`, `lib/useUser.ts` y `localStorage` (`av_user`, `av_scores`) quedan intactos.
- Uso de `@supabase/ssr` (clientes browser/server con cookies) y `proxy.ts` de refresco de sesión: el paquete se instala ahora, pero se usa en el spec de auth.
- Perfiles/username, puntuaciones y Salón de la Fama reales.
- Tipos generados (`generate_typescript_types`): sin tablas no hay nada que tipar.
- Ruta de health check o código de prueba permanente.
- Clave `service_role` y cualquier uso privilegiado desde servidor.
- Tests automatizados (proyecto sin suite).

## Modelo de datos

Sin estructuras de datos nuevas. Solo configuración:

`.env.example`:

```dotenv
RESEND_API_KEY=
CONTACT_TO_EMAIL=
CONTACT_FROM_EMAIL=onboarding@resend.dev
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Forma de `lib/supabase.ts` (solo ilustrativa):

```ts
import { createClient } from "@supabase/supabase-js";
export const supabase = createClient(url, publishableKey);
```

## Plan de implementación

1. Leer `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md` (Next 16.3.4, ver `AGENTS.md`) y la guía actual de Supabase para Next.js (`search_docs` por MCP).
2. `npm i @supabase/supabase-js @supabase/ssr`.
3. Obtener URL y clave publicable con MCP (`get_project_url`, `get_publishable_keys`) y crear `.env.local` con ellas; confirmar que `.env*` sigue ignorado en `.gitignore`.
4. Actualizar `.env.example`: añadir las dos variables de Supabase y vaciar `RESEND_API_KEY`.
5. Crear `lib/supabase.ts` con el cliente y el error explícito si faltan variables.
6. Verificar: `npm run build` y `npm run lint`; importar el cliente de forma temporal desde una página, comprobar que arranca con `npm run dev` y revertir el import (no queda código de prueba).

Cada paso deja el proyecto compilando (`npm run dev` sin errores).

## Criterios de aceptación

- [ ] `@supabase/supabase-js` y `@supabase/ssr` aparecen en `dependencies` de `package.json`.
- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] `.env.local` existe con ambas variables y no está en `git status` (ignorado).
- [ ] `.env.example` lista `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` con valores vacíos.
- [ ] `.env.example` no contiene ninguna clave real (`RESEND_API_KEY` vacía).
- [ ] `NEXT_PUBLIC_SUPABASE_URL` coincide con la URL que devuelve MCP `get_project_url` para `bcafdhulvleiegisroth`.
- [ ] `lib/supabase.ts` exporta `supabase`; sin las variables, importarlo lanza un error con el nombre de la variable que falta.
- [ ] Ninguna clave `service_role` aparece en el repo ni en `.env.example`.
- [ ] Login, Nav, HUD y Salón siguen funcionando igual (siguen usando `localStorage`).
- [ ] No existe carpeta `supabase/` ni ruta de prueba en el repo.

## Decisiones tomadas y descartadas

- **Sí:** solo integración base (paquete + env + cliente). El pedido fue "solo la integración, todavía nada de tablas".
- **Sí:** un único `lib/supabase.ts` con `@supabase/supabase-js`. Sin auth no hay sesión ni cookies que gestionar.
- **Sí:** instalar `@supabase/ssr` ahora (pedido explícito), junto a `supabase-js`. **No:** usarlo ni crear `proxy.ts` todavía; solo aporta con sesiones y se cablea en el spec de auth.
- **Sí:** clave publicable (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), pensada para exponerse al cliente; la seguridad real vendrá de RLS cuando existan tablas.
- **No:** `service_role`. Riesgo alto y sin caso de uso todavía.
- **Sí:** proyecto existente `bcafdhulvleiegisroth` (ya enlazado en `.mcp.json`).
- **Sí (pendiente de uso):** migraciones versionadas en `supabase/migrations/` cuando llegue la primera tabla; se decidió no crear la carpeta vacía ahora.
- **No:** ruta `/api/health/supabase` ni script permanente de verificación. Se verifica con build, arranque y comparación de URL vía MCP.
- **Sí:** vaciar `RESEND_API_KEY` de `.env.example` en este spec (mismo archivo que se toca). Se recomienda además rotar esa clave en Resend, porque ya estuvo escrita en disco.
- **Nota:** el nombre del cliente único (`lib/supabase.ts`) se infiere de "solo la integración"; se puede dividir en browser/server en el spec de auth.

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| Clave real de Resend en `.env.example` termina commiteada | Se vacía en el paso 4; rotar la clave en Resend. |
| Variables ausentes en despliegue (Vercel u otro) | Error explícito en `lib/supabase.ts`; documentadas en `.env.example`. |
| Confundir clave publicable con `service_role` | Solo se documenta y usa la publicable; criterio de aceptación lo verifica. |
| Cliente sin uso genera dead code | Aceptado: es la base del spec de auth; ESLint no lo marca al ser un export. |

## Qué **no** está en este spec

- Autenticación (email, Google, GitHub, invitado) y perfiles.
- Tablas, RLS, migraciones y tipos generados.
- Puntuaciones y Salón de la Fama con datos reales.
- Uso de `@supabase/ssr`, `proxy.ts` y clientes browser/server separados (el paquete solo se instala).
- Health check o pruebas automatizadas.

Cada uno, si se aborda, va en su propio spec.
