# 04 — Asteroids game

**Estado:** aprobado
**Depende de:** 01-mvp-pantallas-arcade-vault
**Fecha:** 2026-09-21

**Objetivo:** Portar el juego Asteroids vanilla JS existente a Next.js App Router como componente React funcional, integrarlo en la ruta `/games/asteroids/play` y guardar puntuaciones en localStorage.

## Alcance

**Incluye:**

- Ruta dinámica `/games/[id]/play/page.tsx` con el componente `AsteroidsGame` (server component que renderiza el client component).
- Cliente React `components/AsteroidsGame.tsx` (`"use client"`) que:
  - Monta un `<canvas>` de 800×600 centrado en pantalla.
  - Importa la lógica del juego portada (clases `Bullet`, `Asteroid`, `Ship`, `Particle`).
  - Ejecuta el game loop con `requestAnimationFrame`.
  - Maneja input vía `keydown`/`keyup` (arrows, space, R para reiniciar).
  - Muestra pantalla de "Game Over" con botón "Reiniciar" cuando `lives = 0`.
  - Guarda score final + level alcanzado en localStorage (`asteroids_scores` array).
  - Recupera y muestra el último score guardado (best score del usuario).
- Agregar "asteroids" al catálogo `GAMES` en `lib/games.ts` con metadata (título, descripción, imagen).
- Lógica del juego (clases, loop, colisiones, wrapping) portada de `game.js` a un módulo TS reutilizable.
- Estilos mínimos: canvas centrado, fondo negro, sin scroll, responsive a ancho mínimo 320px (canvas se recorta si es necesario, sin distorsión).
- Keyboard hints en la pantalla de game over (↑↓← →, SPACE para disparar, R para reiniciar).
- Sin Nav, footer, ni tema neon alrededor (stand-alone).
- Metadata de página (`title`, `description` en español).

**No incluye:**

- Powerups (no funcionales aún, TODO para spec futura).
- Autenticación / sincronización con backend.
- Leaderboard global o múltiples usuarios.
- Sonido.
- Animaciones suaves de transición (game loop único con dt).
- Mobile touch controls (solo teclado).
- Tests automatizados (proyecto sin suite).

## Modelo de datos

**Persistencia local (localStorage):**

```ts
// lib/asteroids.ts
export interface AsteroidsScore {
  score: number;
  level: number;
  timestamp: number;
}

export function saveScore(score: number, level: number): void {
  const scores: AsteroidsScore[] = JSON.parse(
    localStorage.getItem('asteroids_scores') || '[]'
  );
  scores.push({ score, level, timestamp: Date.now() });
  localStorage.setItem('asteroids_scores', JSON.stringify(scores));
}

export function getLastScore(): AsteroidsScore | null {
  const scores: AsteroidsScore[] = JSON.parse(
    localStorage.getItem('asteroids_scores') || '[]'
  );
  return scores.length > 0 ? scores[scores.length - 1] : null;
}

export function getBestScore(): AsteroidsScore | null {
  const scores: AsteroidsScore[] = JSON.parse(
    localStorage.getItem('asteroids_scores') || '[]'
  );
  return scores.length > 0
    ? scores.reduce((best, s) => (s.score > best.score ? s : best))
    : null;
}
```

**Game state (en memoria):**

```ts
// Globales en AsteroidsGame o en módulo separado
interface GameState {
  ship: Ship;
  bullets: Bullet[];
  asteroids: Asteroid[];
  particles: Particle[];
  score: number;
  lives: number;
  level: number;
  state: 'playing' | 'dead' | 'gameover';
  deadTimer: number;
}
```

**Catálogo (agregar a `lib/games.ts`):**

```ts
{
  id: 'asteroids',
  title: 'Asteroids',
  description: 'Clásico arcade de destrucción de asteroides.',
  image: '/games/asteroids.png', // o usar un placeholder
  year: 1979,
}
```

## Plan de implementación

1. Extraer y portar a TypeScript la lógica de `game.js`:
   - Crear `lib/asteroids-engine.ts` con clases `Bullet`, `Asteroid`, `Ship`, `Particle`.
   - Crear `lib/asteroids-game.ts` con la máquina de estados (init, update, draw, collision detection).
   - Exportar funciones para iniciar partida, actualizar frame, obtener estado, manejar input.
   - Mantener el mismo canvas 800×600, wrapping toroidal, física y puntuación.

2. Crear `components/AsteroidsGame.tsx` (client component):
   - Hook `useEffect` para montar canvas y game loop.
   - State para game over y scores.
   - Detectar `lives === 0` para activar game over screen.
   - Botón "Reiniciar" que resetea game state.
   - Input listener para arrows + space + R.

3. Crear `app/games/asteroids/page.tsx` (server component):
   - Renderizar `<AsteroidsGame>`.
   - Metadata con title "Asteroids" y description.

4. Agregar "asteroids" a `lib/games.ts` en el array `GAMES`.

5. Leer `node_modules/next/dist/docs/` (Next 16.3.4) sobre server/client components y dynamic routes si es necesario.

6. Verificar `npm run dev` sin errores, jugar una partida completa, game over + reinicio, localStorage con score guardado.

Cada paso deja el proyecto compilando.

## Criterios de aceptación

- [ ] `npm run build` sin errores de TypeScript ni ESLint.
- [ ] Ruta `/games/asteroids/play` renderiza el juego.
- [ ] Canvas 800×600 centrado en pantalla negra.
- [ ] Controles funcionan: ↑ acelera, ↓ frena, ← gira izq, → gira der, SPACE dispara.
- [ ] Asteroides se crean al inicio, el jugador destruye con disparos.
- [ ] Colisiones: asteroides grandes se dividen, medianos y pequeños desaparecen. Asteroide golpea nave → pierde 1 life.
- [ ] Puntuación: +20 pts asteroide grande, +50 pts mediano, +100 pts pequeño (verificar números del original).
- [ ] Al llegar a 0 lives, pantalla "GAME OVER" con score final, level y botón "REINICIAR".
- [ ] Botón "REINICIAR" limpia estado y vuelve a juego activo.
- [ ] Score final + level se guardan en localStorage al game over.
- [ ] Pantalla muestra "Mejor puntuación: X" (best score de localStorage).
- [ ] Sin warnings de hydration; sin scroll horizontal a 320px.
- [ ] Metadata de página correcta.
- [ ] "asteroids" aparece en catálogo `GAMES` con URL `/games/asteroids/play`.

## Decisiones tomadas y descartadas

- **Canvas 800×600 fijo, centrado:** Mantiene fidelidad al original; alcance stand-alone.
- **localStorage, no Supabase:** Simplifica scope y evita dependencias de backend por ahora; se puede migrar en spec futura.
- **Sin powerups:** Código original tiene constantes pero no está implementado; funcionalidad para spec futura.
- **Solo teclado:** Alcance mínimo; mobile/touch puede venir después.
- **Game over simple:** Sin formulario de nombre/email; solo reinicio.
- **Portar a TS/React:** Integración con Next.js y type safety; lógica reutilizable.
- **Sin pruebas automáticas:** Proyecto sin suite de tests.

## Riesgos identificados

- **Hydration mismatch:** Canvas no se serializa. Solución: component con `"use client"` y `useEffect` para montar.
- **Performance:** Game loop con `dt` acotado a 50ms (del original) evita spiral-of-death en pausa de tab.
- **Mobile viewport:** Canvas recortado en ancho < 800px; no es escalable, pero es stand-alone (aceptable).
- **Persistencia:** localStorage es per-navegador y se borra con cookies. Documenta que es temporal (explicar en página si es necesario).
