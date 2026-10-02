# 07 — Controles táctiles / mobile

**Estado:** Borrador
**Depende de:** 04-asteroids-game, 06-caida-tetris (y el motor VÍBORA en `lib/snake-game.ts`, spec de game-jam `snake-01-grilla-tick-fijo`)
**Fecha:** 2026-10-02
**Objetivo:** Hacer jugables en celular los tres juegos con motor (Asteroids, Caída, Víbora) mediante controles en pantalla que emulan teclas, visibles solo en viewport ≤ 768px, con el layout del player adaptado a mobile.

## Por qué existe esta spec

Hoy todo el input es `window keydown/keyup` en `GamePlayer.tsx`; en un celular no hay forma de jugar. Además `.crt-screen` fuerza `aspect-ratio: 4/3` con el canvas al 100 %×100 %, así que Caída (440×600) se deforma, y el HUD/skins/modal de fin de juego no están pensados para pantalla chica. Referencia visual del usuario: `Downloads/idea-canvas-controls.png` (HUD compacto arriba; grupo de controles izquierdo y grupo derecho de 4 botones **superpuestos sobre el canvas**).

## Alcance

**Incluye:**

- Componente `components/TouchControls.tsx`: overlay absoluto dentro de `.crt-screen` con dos grupos de botones — **izquierda = movimiento/giro, derecha = acciones** — configurados por juego. Cada botón usa Pointer Events (`pointerdown`/`pointerup`/`pointercancel`/`pointerleave` + `setPointerCapture`) → soporta multitouch (ej. mantener ← y disparar a la vez).
- Config declarativa `lib/touch-controls.ts`: `TOUCH_CONTROLS: Record<string, TouchLayout>` (`game.id` → botones, etiqueta/ícono, `code` de tecla emulada, `repeat` opcional). Los botones llaman `engine.setKeyDown(code)` / `setKeyUp(code)` con los mismos códigos que el teclado; **no se modifican los motores ni `GameEngine`**.
- Mapeo por juego (códigos verificados en motores; los de Asteroids se confirman en el paso 1):
  - **Asteroids:** izq `ArrowLeft`, `ArrowRight`, `ArrowUp` (empuje); der `Space` (disparo).
  - **Caída:** izq `ArrowLeft`, `ArrowRight`, `ArrowDown` (soft drop); der `ArrowUp` (rotar), `Space` (hard drop).
  - **Víbora:** izq/der D-pad completo `ArrowUp/Down/Left/Right`.
- Hook `lib/useIsMobile.ts` con `matchMedia("(max-width: 768px)")` (reactivo, `useSyncExternalStore`, `false` en SSR → sin hydration mismatch). `TouchControls` solo se renderiza si `true`.
- Auto-repetición **solo en la capa táctil** para Caída (← → ↓ mientras el dedo está sostenido): `setInterval` que re-llama `setKeyDown(code)`. El motor sigue siendo edge-triggered.
- Layout mobile del player (CSS en `app/globals.css`, `@media (max-width: 768px)`): `.crt-screen` usa la proporción nativa del canvas (`aspect-ratio: width/height` vía style inline, `object-fit: contain`) en lugar de 4/3 fijo; HUD compacto en 2 filas; selector de skin como `<select>` compacto; botones PAUSA/FIN/SALIR de ancho completo.
- Bloqueo de gestos del navegador durante la partida: `touch-action: none` + `user-select: none` en canvas/overlay; `overscroll-behavior: contain` en el player; `preventDefault` en `touchmove` dentro del arena; evitar zoom por doble tap.
- Pausa automática al perder visibilidad (`visibilitychange`) y al cambiar `orientationchange`/resize significativo, reutilizando el `paused` genérico de `GamePlayer.tsx`.
- Skins y modal de fin de juego usables en touch: targets ≥ 44px, input de iniciales visible sin que el teclado virtual lo tape (`scrollIntoView` al enfocar / modal con scroll interno).
- Vibración háptica opcional (`navigator.vibrate`, con feature-check) en pulsación de botones táctiles (10 ms) y en game over (patrón corto).

**No incluye (para specs futuras):**

- Gestos sobre el canvas (swipe/tap) como esquema alternativo de control.
- Remapeo configurable de botones o ajuste de tamaño/opacidad de los controles por el usuario.
- Joystick analógico.
- Sonido.
- Modificar `lib/game-engine.ts` o los motores (`asteroids-game.ts`, `tetris-game.ts`, `snake-game.ts`).
- Detección por User-Agent o por `(pointer: coarse)` (se usa solo el ancho ≤ 768px, decisión del usuario).
- Rediseño de páginas fuera del player (Home, Biblioteca, Leaderboard).
- PWA / modo fullscreen / bloqueo de orientación.
- Tests automáticos (Playwright, etc.).

## Modelo de datos

Sin cambios en base de datos ni en `game_sessions`. Solo tipos de UI:

```ts
// lib/touch-controls.ts
export interface TouchButton {
  id: string;
  label: string;          // texto o símbolo: "←", "→", "↑", "FUEGO", "ROTAR"…
  code: string;           // KeyboardEvent.code emulado (ej. "ArrowLeft", "Space")
  repeat?: boolean;       // auto-repetición mientras se mantiene (solo Caída ← → ↓)
  repeatMs?: number;      // default 110
}

export interface TouchLayout {
  left: TouchButton[];    // movimiento/giro
  right: TouchButton[];   // acciones
}

export const TOUCH_CONTROLS: Record<string, TouchLayout>; // key = game.id
```

```ts
// lib/useIsMobile.ts
export function useIsMobile(): boolean; // matchMedia("(max-width: 768px)")
```

## Plan de implementación

1. Verificar en `lib/asteroids-game.ts` los códigos de tecla reales (rotar, empuje, disparo) y fijar el mapeo definitivo en este spec si difiere.
2. Crear `lib/useIsMobile.ts` (`useSyncExternalStore` sobre `matchMedia`, snapshot de servidor `false`).
3. Crear `lib/touch-controls.ts` con tipos y `TOUCH_CONTROLS` para `asteroids`, `caida`, `vibora`.
4. Crear `components/TouchControls.tsx`: recibe `layout` y callbacks `onDown(code)`/`onUp(code)`; Pointer Events con `setPointerCapture`; auto-repetición para botones `repeat`; liberar todas las teclas en `pointercancel`/`blur`/desmontaje (evita teclas "pegadas"); `aria-label` por botón.
5. Integrar en `GamePlayer.tsx`: dentro de `.crt-screen`, si `isMobile && engineDef && TOUCH_CONTROLS[game.id]`, renderizar `<TouchControls>` conectado a `engineRef.current?.setKeyDown/Up`. Sin botón activo cuando `paused`/`over`.
6. CSS en `app/globals.css`: estilos del overlay (grupos izq/der, botones redondeados translúcidos con estética neon, `pointer-events` solo en botones), `touch-action: none`, `user-select: none`, `overscroll-behavior`, y reglas `@media (max-width: 768px)` para `.crt-screen` (proporción del canvas), `.player-hud` compacto y targets ≥ 44px.
7. `GamePlayer.tsx`: pasar `aspectRatio: width / height` al `.crt-screen` en mobile; reemplazar la fila de skins por `<select>` compacto en mobile (misma `chooseSkin`).
8. Pausa automática: listeners `visibilitychange` y `orientationchange` en `GamePlayer.tsx` que ejecutan `setPaused(true)` si hay partida en curso.
9. Modal de fin de juego: targets ≥ 44px, `scrollIntoView` del input al enfocar, `max-height` + scroll interno bajo `100dvh`.
10. Háptica: helper `vibrate(ms | pattern)` con feature-check; llamado en pulsación de botón táctil y al pasar a `over`.
11. Verificación manual (ver criterios): DevTools con emulación táctil (≤ 768px) y celular real por LAN (`http://<ip-local>:3000`), los tres juegos.

Cada paso deja el proyecto compilando (`npm run dev` sin errores) y el comportamiento en desktop (> 768px) idéntico al actual.

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` sin errores.
- [ ] En viewport > 768px no aparece ningún control táctil y teclado funciona igual que antes en los tres juegos.
- [ ] En viewport ≤ 768px aparece el overlay de controles sobre el canvas, con grupo izquierdo y derecho según el mapeo por juego.
- [ ] Asteroids en celular: se puede rotar, empujar y disparar; mantener ← y tocar FUEGO a la vez funciona (multitouch).
- [ ] Caída en celular: mover, rotar, soft drop y hard drop funcionan; ← → ↓ se repiten mientras se mantiene el dedo; el canvas no se deforma (proporción 440:600 respetada).
- [ ] Víbora en celular: las 4 direcciones controlan la serpiente y se puede jugar hasta game over.
- [ ] Ningún botón queda "pegado" tras soltar el dedo, arrastrarlo fuera del botón, cambiar de pestaña o pausar.
- [ ] Durante la partida no hay scroll de página, pull-to-refresh ni zoom por doble tap sobre el canvas/controles.
- [ ] Al cambiar de pestaña/app o rotar el dispositivo en plena partida, el juego queda en pausa.
- [ ] El selector de skin es operable con el dedo (target ≥ 44px) y persiste en `localStorage` como hoy.
- [ ] El modal de fin de juego permite escribir las iniciales y pulsar GUARDAR sin que el teclado virtual tape el input/botón; la sesión se inserta en `game_sessions` como antes.
- [ ] `navigator.vibrate` no lanza error en navegadores sin soporte (iOS Safari).
- [ ] Sin hydration mismatch en consola al cargar `/juego/<id>/jugar` en mobile y desktop.

## Decisiones tomadas y descartadas

- **Sí: emular teclas desde la capa táctil.** No se toca `GameEngine` ni los tres motores; el riesgo de regresión en desktop es mínimo.
- **No: nueva API `onSwipe/onTap` en `GameEngine`.** Modifica los tres motores sin necesidad.
- **Sí: botones en pantalla superpuestos al canvas** (esquema de `idea-canvas-controls.png`, decisión del usuario). **No** controles debajo del canvas ni solo gestos.
- **Sí: izquierda = movimiento/giro, derecha = acciones**, configurado por juego en `lib/touch-controls.ts`.
- **Sí: detección por ancho ≤ 768px** (decisión del usuario). **No** `(pointer: coarse)` ni User-Agent: se acepta que una ventana de escritorio angosta muestre los controles y que una tablet grande no.
- **Sí: Pointer Events + `setPointerCapture`** para multitouch fiable. **No** `touchstart/touchend` (más frágiles con captura y mouse).
- **Sí: auto-repetición solo en la capa táctil** para Caída. Spec 06 deja fuera DAS/ARR del motor (fiel al original); en táctil, sin repetición habría que tocar N veces para cruzar el tablero. Si se quiere paridad con teclado, se elimina `repeat` en la config.
- **Sí: pausa automática y háptica** dentro de alcance por pedido explícito del usuario.
- **Sí: verificación manual** (DevTools + celular por LAN); no hay suite de tests configurada y agregarla amplía el alcance.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| Overlay sobre canvas portrait (Caída 440×600) tapa parte del tablero | Botones translúcidos, `pointer-events` solo en botones, tamaño contenido; si tapa jugabilidad, revisar posición/escala en un spec de ajuste |
| Teclas "pegadas" si el dedo sale del botón o se pierde el foco | `setPointerCapture`, liberar en `pointercancel`/`blur`/`visibilitychange`/desmontaje y test manual explícito |
| Umbral 768px muestra controles en escritorio angosto y oculta en tablets | Decisión aceptada por el usuario; documentada |
| Teclado virtual tapa el input de iniciales | `scrollIntoView` + modal con scroll y `100dvh` |
| `navigator.vibrate` no existe en iOS Safari | Feature-check; la háptica es opcional |
| Mockup solo muestra Asteroids; el mapeo de Caída/Víbora es propuesto | Revisar el mapeo del paso 3 en la revisión del spec antes de aprobar |

## Lo que **no** está en este spec

- Gestos swipe/tap sobre el canvas, joystick analógico, remapeo/escala configurable de controles.
- Cambios a motores o a `GameEngine`.
- PWA, fullscreen o bloqueo de orientación.
- Tests automáticos.

Cada uno de estos, si se hace, va en su propio spec.
