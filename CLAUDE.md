# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Comandos

- `npm run dev` — servidor de desarrollo (http://localhost:3000)
- `npm run build` — build de producción
- `npm run start` — servir el build de producción
- `npm run lint` — ESLint (flat config en `eslint.config.mjs`, extiende `eslint-config-next/core-web-vitals` y `eslint-config-next/typescript`)

No hay suite de tests configurada todavía.

## Arquitectura

Proyecto Next.js (App Router) recién creado con `create-next-app`, sin lógica de negocio propia aún:

- `app/layout.tsx` — layout raíz, fuentes Geist vía `next/font`
- `app/page.tsx` — página principal
- `app/globals.css` — estilos globales (Tailwind v4 vía `@tailwindcss/postcss`)
- Alias de import `@/*` apunta a la raíz del repo (ver `tsconfig.json`)
- TypeScript en modo `strict`

**Importante:** este repo usa una versión de Next.js (16.3.4) con cambios que pueden diferir del conocimiento de entrenamiento. Antes de escribir código, consultar `node_modules/next/dist/docs/` (ver `AGENTS.md`) para las convenciones y APIs correctas de esta versión.
