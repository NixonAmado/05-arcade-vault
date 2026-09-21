# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

No hay suite de tests configurada todavía.

## Skills

Usa siempre la skill /frontend-design para diseñar interfaces de usuario.

## Arquitectura

Proyecto Next.js (App Router) recién creado con `create-next-app`, sin lógica de negocio propia aún:

- `app/layout.tsx` — layout raíz, fuentes Geist vía `next/font`
- `app/page.tsx` — página principal
- `app/globals.css` — estilos globales (Tailwind v4 vía `@tailwindcss/postcss`)
- Alias de import `@/*` apunta a la raíz del repo (ver `tsconfig.json`)
- TypeScript en modo `strict`

**Importante:** este repo usa una versión de Next.js (16.3.4) con cambios que pueden diferir del conocimiento de entrenamiento. Antes de escribir código, consultar `node_modules/next/dist/docs/` (ver `AGENTS.md`) para las convenciones y APIs correctas de esta versión.
