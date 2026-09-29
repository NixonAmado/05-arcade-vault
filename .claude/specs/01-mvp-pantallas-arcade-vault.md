# 01 — MVP pantallas Arcade Vault

**Estado:** Implementado
**Depende de:** ninguno
**Fecha:** 2026-09-17

**Objetivo:** Implementar solo la parte visual (sin backend real ni juegos jugables) de las 5 pantallas del prototipo `references/templates/` — Biblioteca, Detalle de juego, Reproductor (mock), Auth y Salon de la Fama — migradas a Next.js App Router con TypeScript y datos mock.

## Alcance

**Incluye:**

- Migracion de las 5 pantallas del prototipo HTML/React (CDN) a componentes de Next.js App Router en TypeScript:
  - `Biblioteca` (home): hero, buscador, filtro por categoria (chips), grid de cards de juegos.
  - `Detalle de juego`: portada, tags, descripcion, stats (partidas / mejor global / dificultad), leaderboard del juego, boton "Jugar ahora".
  - `Reproductor` (mock visual): HUD (jugador, puntaje, vidas, nivel), pantalla CRT animada, controles Pausa/Fin/Salir, modal de fin de partida con input de iniciales y guardado de puntaje.
  - `Auth`: tabs Iniciar sesion / Crear cuenta, formulario mock, boton "Jugar como invitado", botones sociales decorativos (sin OAuth real).
  - `Salon de la Fama`: tabs por juego, podio (oro/plata/bronce), tabla de puntuaciones, fila destacada "tu mejor marca" si hay usuario logueado.
- `Nav` global (desktop + menu movil tipo drawer) con logo, links activos, contador de creditos decorativo, boton de sesion.
- Rutas reales de Next.js App Router (una carpeta/route por pantalla), reemplazando el router por hash del prototipo.
- Persistencia en `localStorage` para: usuario logueado (mock) y puntajes guardados al terminar una partida — igual que el prototipo.
- Datos mock tipados en TypeScript (`lib/games.ts` o similar): catalogo de 8 juegos, categorias, lista de jugadores ficticios y funcion generadora de leaderboard pseudo-aleatorio (`seededScores`), portados desde `data.jsx`.
- Estilos: migracion de `styles.css` (efectos neon, pixel, CRT, scanlines, grid retro, animaciones) a `globals.css` del proyecto, con ajustes minimos de sintaxis/organizacion, conviviendo con Tailwind v4 ya configurado.
- Tipografias retro (`Press Start 2P`, `Courier Prime`, `JetBrains Mono`) cargadas via `next/font/google`, reemplazando las fuentes Geist actuales del layout.
- Reproductor mock: el puntaje sube solo con un timer (igual que el template), HUD con vidas/nivel, pausa, fin de partida y guardado de score — todo decorativo, sin logica de juego real.
- Responsive: mantener los breakpoints y comportamiento movil del prototipo (menu hamburguesa, grid adaptable, tabla de salon compacta).

**No incluye (explicitamente fuera de este MVP):**

- Backend o API real: no hay servidor de autenticacion, no hay base de datos, no hay validacion real de credenciales. Todo el login/registro es mock en cliente.
- Logica de juego real: ninguno de los 8 juegos (Bloque Buster, Caida, Serpentina, Gloton, Invasores, Rocas, Ranaria, Duelo Pixel) es jugable de verdad. El "reproductor" es un mock visual animado, no un motor de juego.
- Multijugador o partidas en vivo: "Duelo Pixel" se muestra solo como card y pantalla de detalle/reproductor mock, no como juego 1v1 funcional ni con sockets/tiempo real.
- Autenticacion social real (Google/GitHub): los botones existen visualmente pero no disparan ningun flujo OAuth.
- Tests automatizados: no se agregan tests en esta spec (el proyecto no tiene suite configurada).
- Cualquier feature no presente en los 5 templates de referencia (perfiles extendidos, logros, tienda de creditos, configuracion de cuenta, etc.).

## Modelo de datos

Datos mock tipados, sin persistencia en servidor (solo TypeScript en el bundle + `localStorage` para estado de sesion/puntajes del usuario).

```ts
// lib/games.ts
export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string; // clase CSS de portada (cover-bricks, cover-tetro, ...)
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string;
}

export const CATS: readonly ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"];
export const GAMES: Game[]; // 8 juegos, portados 1:1 desde data.jsx
export const PLAYERS: string[]; // nombres ficticios para leaderboard

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;
}
export function seededScores(seed: number, count?: number): ScoreRow[];
```

```ts
// estado de sesion (localStorage, key "av_user")
interface StoredUser {
  name: string;
}

// puntajes guardados por el usuario (localStorage, key "av_scores")
interface SavedScoreEntry {
  game: string; // Game.id
  score: number;
  name: string;
  at: number; // timestamp
}
```

## Plan de implementacion

1. Configurar fuentes retro (`Press Start 2P`, `Courier Prime`, `JetBrains Mono`) via `next/font/google` en `app/layout.tsx`, reemplazando Geist, exponiendolas como variables CSS.
2. Portar `styles.css` del template a `app/globals.css`, ajustando selectores si hace falta para convivir con el reset de Tailwind v4 (verificar que `.card`, `.btn`, `.av-*`, `.crt*`, animaciones y media queries se vean igual).
3. Crear `lib/games.ts` con las interfaces `Game`/`ScoreRow`, el arreglo `GAMES`, `CATS`, `PLAYERS` y la funcion `seededScores`, portados desde `data.jsx`.
4. Crear `components/Nav.tsx` (desktop + panel movil), consumiendo estado de sesion via un hook/cliente que lea `localStorage` (`av_user`).
5. Implementar ruta `/` o `/biblioteca` con el componente `Library`: hero, buscador, chips de categoria y grid de `GameCard`, navegando a `/juego/[id]` al seleccionar.
6. Implementar ruta `/juego/[id]` con el componente `GameDetail`: portada, tags, descripcion, stats, leaderboard (via `seededScores`) y boton hacia `/juego/[id]/jugar`.
7. Implementar ruta `/juego/[id]/jugar` con el componente `GamePlayer` (mock): HUD, CRT animado, pausa, boton fin, modal de fin de partida con input de iniciales que guarda el score en `localStorage` (`av_scores`).
8. Implementar ruta `/login` con el componente `Auth`: tabs iniciar sesion / crear cuenta, formulario mock que guarda `{ name }` en `localStorage` (`av_user`) y redirige a `/biblioteca`, mas boton "jugar como invitado".
9. Implementar ruta `/salon` con el componente `HallOfFame`: tabs por juego, podio, tabla de puntuaciones y fila "tu mejor marca" si hay usuario en `localStorage`.
10. Integrar `Nav` en `app/layout.tsx` para que aparezca en todas las rutas, con estados activos segun la ruta actual (`usePathname`).
11. Revisar responsive en los 5 breakpoints que trae el template (nav movil, grid, tabla de salon, detalle en columna) y ajustar si algo se rompe con Tailwind base.

Cada paso deja el proyecto en un estado que compila y renderiza (`npm run dev` sin errores).

## Criterios de aceptacion

- [ ] `npm run build` compila sin errores de TypeScript ni de ESLint.
- [ ] Existen las rutas `/biblioteca` (o `/`), `/juego/[id]`, `/juego/[id]/jugar`, `/login`, `/salon`, todas navegables desde el `Nav` y desde los botones de cada pantalla.
- [ ] La Biblioteca muestra los 8 juegos de `GAMES`, filtra por texto y por categoria, y muestra un estado "sin resultados" cuando el filtro no matchea nada.
- [ ] El Detalle de un juego muestra su informacion (tags, descripcion, stats) y una tabla de leaderboard generada con `seededScores`.
- [ ] El Reproductor mock anima el puntaje automaticamente, permite pausar/reanudar, mostrar un modal de fin de partida, capturar iniciales y guardar el resultado en `localStorage` bajo `av_scores`.
- [ ] Auth permite loguearse con cualquier nombre (mock), guarda el usuario en `localStorage` bajo `av_user`, y permite entrar como invitado sin loguearse.
- [ ] El Salon de la Fama muestra podio y tabla por juego seleccionado, y una fila adicional "tu mejor marca" solo si hay un usuario logueado en `localStorage`.
- [ ] El `Nav` refleja si hay sesion iniciada (muestra el nombre) o no (muestra "Iniciar Sesion"), y permite cerrar sesion.
- [ ] El menu movil (hamburguesa) funciona en viewport angosto (<840px) igual que en el template.
- [ ] Ningun juego es realmente jugable: no hay logica de colisiones, input de teclado para jugar, ni motor de juego — solo el mock visual descrito arriba.
- [ ] La app visualmente respeta la estetica del template (colores neon, tipografias pixel/mono, efectos CRT/scanlines) en light/unico tema (el template es dark-only).

## Decisiones tomadas y descartadas

- **Rutas reales de Next.js App Router** en vez de router por hash de una sola pagina: se descarta el patron `location.hash` del prototipo porque el proyecto ya es Next.js App Router y aprovechar rutas reales da mejor SEO, back/forward nativo y separacion de componentes por carpeta.
- **Persistencia en `localStorage`** para usuario y puntajes: se mantiene igual que el prototipo porque da sensacion de app funcional sin requerir backend, que esta explicitamente fuera de alcance.
- **Reproductor como mock animado** (puntaje sube solo, sin logica real de juego): se descarta implementar cualquier motor de juego real porque el pedido explicito es "solo la parte visual, no hay que implementar ningun juego".
- **Portar `styles.css` casi tal cual** a `globals.css` en vez de reescribir todo a utilidades Tailwind: se prioriza fidelidad visual al prototipo (efectos CRT, neon, pixel muy especificos) sobre "pureza" de convenciones Tailwind; se descarta la reescritura completa por riesgo de perder detalle visual y por costo de tiempo no justificado en un MVP visual.
- **Datos mock en un archivo TypeScript tipado** (`lib/games.ts`) en vez de JSON plano: se prioriza tipado estricto (el proyecto usa `strict: true`) y reutilizar la funcion `seededScores` tal cual, sin reescribirla a un formato de datos estatico.
- **Fuentes via `next/font/google`** en vez de `<link>` a Google Fonts: se prioriza consistencia con el patron ya usado en el proyecto para Geist y evitar layout shift.
- **Sin autenticacion social real, sin backend, sin multijugador, sin tests**: quedan fuera de este MVP por decision explicita del usuario; se documentan como posibles specs futuras si se necesitan.
