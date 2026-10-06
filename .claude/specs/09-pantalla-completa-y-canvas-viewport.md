# 09 — Pantalla completa y canvas ajustado al viewport

**Estado:** aprobada
**Depende de:** 07-controles-tactiles-mobile
**Fecha:** 2026-10-04
**Objetivo:** Que el juego quepa en la ventana sin scroll ni zoom out, y ofrecer un botón de pantalla completa (estilo YouTube) en todos los juegos con motor.

## Alcance

**Incluye:**

- **Tamaño base (desktop):** `.crt-screen` limitado por el alto disponible (`100dvh` menos nav/HUD/paddings), manteniendo la proporción nativa de cada juego (`engineDef.width / engineDef.height`; Caída vertical, resto 4:3). Centrado horizontalmente. Sin scroll vertical para ver el canvas completo.
- **Pantalla completa real:** botón `PANTALLA COMPLETA` en `.hud-actions` + tecla `F`. Usa `requestFullscreen()` sobre el contenedor `.crt` y `document.exitFullscreen()` para salir (ESC también). Estado sincronizado con el evento `fullscreenchange`.
- **Fallback CSS** (`position: fixed; inset: 0`) cuando `requestFullscreen` no existe (iPhone).
- **Dentro de pantalla completa:** sin marco CRT; canvas escalado con `object-fit: contain` (letterbox negro) al máximo de la pantalla; HUD mínimo superpuesto (puntuación, vidas, nivel, PAUSA, salir de FS); controles táctiles siguen visibles en mobile; el modal de fin de juego debe verse dentro del contenedor en FS.
- Hook `lib/useFullscreen.ts` (`{ isFullscreen, toggle, supported }`).
- Afecta a todos los juegos (`asteroids`, `caida`, `vibora`, `frogger`) sin tocar `lib/game-engine*.ts` ni los motores.

**No incluye:**

- Bloqueo de orientación, PWA.
- Cambiar resolución interna del canvas (solo escala visual; `devicePixelRatio` sigue igual).
- Cambios a controles táctiles más allá de seguir funcionando en FS.
- Tests automáticos.

## Archivos previstos

- `components/GamePlayer.tsx` (botón, ref al `.crt`, HUD mínimo en FS)
- `lib/useFullscreen.ts` (nuevo)
- `app/globals.css` (`.crt-screen` por viewport, estilos `:fullscreen` / `.is-fullscreen`)

## Pasos

1. Tamaño base por viewport en CSS (desktop y mobile); verificar los 4 juegos.
2. Hook `useFullscreen` + botón + tecla `F` (ignorar si el foco está en un input).
3. Estilos de pantalla completa + HUD mínimo superpuesto + fallback CSS.
4. Verificar modal de fin de juego, pausa y táctil en FS; actualizar CLAUDE.md (lista de specs).

## Criterios de aceptación

- A 100 % de zoom en un laptop típico (~768 px de alto), el canvas completo se ve sin scroll.
- El botón/tecla `F` entra y sale de pantalla completa; ESC sale y el estado del botón queda correcto.
- El juego no se deforma en ningún modo; se mantiene la partida al entrar/salir.
- En iPhone funciona el fallback CSS.
