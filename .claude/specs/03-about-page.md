# 03 — About page + envío de correo (Resend)

**Estado:** Implementado
**Depende de:** 02-home-page
**Fecha:** 2026-09-19

**Objetivo:** Implementar la página "Acerca de" (`/acerca`) fiel a `references/templates/home-about/about.jsx` + `styles.css` (bloque `ABOUT PAGE`), migrada a Next.js App Router con TypeScript, y hacer que el formulario de contacto envíe correos reales con **Resend** (el template solo simula el envío).

## Alcance

**Incluye:**

- Ruta `/acerca` (server component `app/acerca/page.tsx` + componente cliente `components/About.tsx`), con `metadata` en español.
- Secciones del template, en orden:
  1. **Hero**: kicker "▸ ACERCA DE", título "ACERCA DE ARCADE VAULT", texto de misión, 3 highlights (HEART magenta, BROWSER cyan, PLANT green) con iconos SVG pixel y `transition-delay` escalonado.
  2. **Divider** decorativo (`aria-hidden`, 24 píxeles animados).
  3. **Contacto**: intro (kicker "▸ CONTACTO", "CONTÁCTANOS", subtítulo, 3 tips con LED) + formulario (NOMBRE, CORREO ELECTRÓNICO, MENSAJE, botón "▶ ENVIAR MENSAJE").
- Estado post-envío: terminal `VAULT-OS // TERMINAL` con "MENSAJE RECIBIDO… GRACIAS, {NOMBRE}." y botón "ENVIAR OTRO MENSAJE" (reinicia el formulario). Textos idénticos al template.
- Validación: campos vacíos → animación `shake` (como el template); además validación server-side (ver abajo).
- **Envío de correo con Resend** vía Server Action (`app/acerca/actions.ts`, `"use server"`):
  - Recibe `name`, `email`, `msg`; valida (no vacíos tras `trim`, email con formato válido, límites de longitud: name ≤ 80, email ≤ 254, msg ≤ 2000).
  - Envía a `CONTACT_TO_EMAIL` desde `CONTACT_FROM_EMAIL`, con `replyTo` = email del visitante y asunto `[Arcade Vault] Mensaje de {name}`.
  - Cuerpo del correo en texto plano (o HTML con contenido **escapado**; nunca interpolar input sin escapar).
  - Devuelve `{ ok: true, name } | { ok: false, error }`; el cliente muestra la terminal solo con `ok: true`. En error, mensaje visible en el formulario ("NO SE PUDO ENVIAR. INTÉNTALO DE NUEVO" en estilo terminal/rojo) sin perder lo escrito.
  - Estado `pending` (botón deshabilitado, texto "ENVIANDO…") con `useTransition`/`useActionState`.
  - Anti-abuso mínimo: campo honeypot oculto (si viene relleno → responde ok sin enviar).
- Dependencia nueva: `resend` (npm).
- Variables de entorno (`.env.local`, no versionado; documentar en `.env.example`): `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL`. Si falta alguna, la action devuelve error genérico y loguea en servidor (sin exponer detalles al cliente).
- Nav: agregar link **"Acerca de"** (`/acerca`) en desktop y drawer móvil; ampliar `isActive` con `"acerca"` (`pathname === "/acerca"`).
- Estilos: portar a `app/globals.css` el bloque `ABOUT PAGE` (`.about*`, `.highlight*`, `.about-divider`/`.div-*`, `.about-contact`, `.contact-*`, `.tip*`, `.terminal-success`, `.term-*`) + las utilidades que falten (`.kicker`, `@keyframes shake`, `.contact-form.shake`), sin tocar estilos existentes. Reusa `.field`, `.btn`, `.reveal`, `blink` ya presentes.
- Hook `useReveal`: extraer de `components/Home.tsx` a `lib/useReveal.ts` y reutilizarlo en Home y About (evita duplicar).
- Responsive: breakpoints del template; `.contact-grid` a 1 columna en móvil, sin scroll horizontal a 360px.
- Accesibilidad: `label` asociado a cada `input` (`htmlFor`/`id`), `type="email"`, `required`/`aria-invalid` en error, mensaje de estado en `role="status"`/`aria-live="polite"`, `prefers-reduced-motion` desactiva shake/reveal/pixels del divider.

**No incluye:**

- Persistencia de mensajes (base de datos), panel de administración ni bandeja.
- Correo de confirmación al visitante.
- Rate limiting robusto / CAPTCHA (solo honeypot).
- Dominio propio verificado en Resend: en desarrollo se usa `onboarding@resend.dev` como `FROM` y solo se puede enviar al correo dueño de la cuenta.
- Cambios en Home, Biblioteca, Detalle, Reproductor, Auth o Salón (salvo `Nav` y la extracción de `useReveal`).
- Tests automatizados (proyecto sin suite).

## Modelo de datos

Sin persistencia. Tipos en `lib/contact.ts` (compartidos cliente/servidor):

```ts
export interface ContactInput { name: string; email: string; msg: string; }
export type ContactResult = { ok: true; name: string } | { ok: false; error: string };
export const CONTACT_LIMITS = { name: 80, email: 254, msg: 2000 } as const;
export function validateContact(input: ContactInput): string | null; // null = válido
```

`.env.example`:

```
RESEND_API_KEY=
CONTACT_TO_EMAIL=
CONTACT_FROM_EMAIL=onboarding@resend.dev
```

## Plan de implementación

1. Leer `node_modules/next/dist/docs/01-app/02-guides/server-actions.md`, `forms.md` y `environment-variables.md` (Next 16.3.4, ver `AGENTS.md`); consultar docs actuales de Resend (`resend.emails.send`, `replyTo`).
2. `npm i resend`; crear `.env.example`; verificar que `.env*.local` esté en `.gitignore`.
3. Crear `lib/contact.ts` (tipos, límites, `validateContact`).
4. Crear `app/acerca/actions.ts` con la Server Action `sendContact` (validación, honeypot, envío Resend, manejo de errores).
5. Extraer `useReveal` a `lib/useReveal.ts` y actualizar `components/Home.tsx`.
6. Portar el bloque `ABOUT PAGE` (+ `.kicker`, `shake`) a `globals.css` (`styles.css` ~1071-1150) + `reduced-motion`.
7. Crear `components/about/HighlightIcon.tsx` (SVG portado, `strokeWidth` camelCase) y `components/About.tsx` (`"use client"`) con hero, divider, contacto y terminal de éxito conectada a la action.
8. Crear `app/acerca/page.tsx` con `metadata`.
9. Actualizar `Nav.tsx`: link "Acerca de" desktop + drawer, `isActive("acerca")`.
10. Verificar `npm run build`, envío real con clave de prueba y revisión visual desktop y <840px.

Cada paso deja el proyecto compilando (`npm run dev` sin errores).

## Criterios de aceptación

- [ ] `npm run build` sin errores de TypeScript ni ESLint.
- [ ] `/acerca` renderiza hero, divider y contacto en orden, con textos idénticos al template (español).
- [ ] Enviar el formulario válido entrega un correo real vía Resend a `CONTACT_TO_EMAIL`, con `replyTo` = email del visitante.
- [ ] Tras éxito se muestra la terminal con el nombre en mayúsculas; "ENVIAR OTRO MENSAJE" reinicia el formulario.
- [ ] Campos vacíos → shake y sin llamada a Resend; server-side rechaza input inválido o fuera de límites.
- [ ] Fallo de Resend o falta de env vars → mensaje de error visible, datos del formulario conservados, sin filtrar detalles ni la API key al cliente.
- [ ] `RESEND_API_KEY` nunca aparece en el bundle cliente ni en el repo.
- [ ] Contenido del usuario escapado en el correo (sin inyección HTML).
- [ ] Nav muestra "Acerca de", activo solo en `/acerca`.
- [ ] `useReveal` compartido; Home sigue funcionando igual.
- [ ] `reveal`/shake respetan `prefers-reduced-motion`.
- [ ] Sin warnings de hydration; sin scroll horizontal en 360px.
- [ ] Estética fiel al template (neon, pixel, terminal verde).

## Decisiones tomadas y descartadas

- **Ruta `/acerca`** (español, consistente con `/biblioteca`, `/salon`) en vez de `/about`.
- **Server Action** en vez de Route Handler: es un formulario propio de la app, sin consumidores externos; la API key queda solo en servidor.
- **Resend** por pedido explícito; envío directo desde la action, sin cola.
- **Solo correo al equipo** (sin confirmación al visitante): evita abuso como relay y necesita dominio verificado.
- **Honeypot en vez de CAPTCHA/rate limit**: alcance mínimo; se puede endurecer en spec futura.
- **Portar CSS casi tal cual** (mismo criterio que specs 01 y 02).
- **Extraer `useReveal`** en lugar de copiarlo: ya se usa en Home y ahora en About.
