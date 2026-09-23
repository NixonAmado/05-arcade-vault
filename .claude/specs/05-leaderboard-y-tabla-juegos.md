# SPEC 05: Leaderboard y Tabla de Juegos

**State:** Draft  
**Depends on:** SPEC 04 (Asteroids Game)  
**Date:** 2026-09-21   
**Objective:** Implementar leaderboard (global y personal) y tabla de historial de partidas de Asteroids, con persistencia en localStorage e integración futura con Supabase.

## Scope

**In:**
- Página de leaderboard (global, con ranking de todos los jugadores)
- Leaderboard personal (mis partidas)
- Página de tabla de juegos (historial de partidas de Asteroids del usuario)
- Persistencia de datos en localStorage
- Captura automática de partidas al terminar Asteroids
- Infraestructura Supabase (schema, clientes, hooks) lista pero sin conectar
- Links en menú principal a leaderboard y games

**Not in:**
- Optimización mobile (responsive básico, refinamiento es trabajo futuro)
- Paginación avanzada o filtros complejos
- Autenticación de usuarios
- Sincronización en tiempo real con Supabase (será spec futuro)
- Catálogo de otros juegos (solo Asteroids de momento)

## Data Model

```typescript
interface GameSession {
  id: string                    // UUID
  nickname: string
  score: number
  waveCompleted: number         // Hasta 5 = victoria
  playedAt: string              // ISO8601
  durationSeconds: number
  won: boolean                  // waveCompleted >= 5
}

interface LeaderboardEntry {
  nickname: string
  totalScore: number            // Suma de todos los scores
  gameCount: number             // Total de partidas jugadas
  victoriesCount: number        // Partidas ganadas (won = true)
  victoryRate: number           // Porcentaje (0-100)
  lastPlayedAt: string          // ISO8601
}
```

## Implementation Plan

1. Crear interfaces TypeScript para `GameSession` y `LeaderboardEntry` en `types/index.ts`
2. Crear hook `useGameStorage` para gestionar GameSessions en localStorage (read, write, list, clear)
3. Crear hook `useLeaderboard` que compute entradas del leaderboard a partir de GameSessions
4. Crear página `app/leaderboard/page.tsx` con dos pestañas (global y personal)
5. Crear componentes `LeaderboardGlobal` y `LeaderboardPersonal` con tabla de datos
6. Crear página `app/games/page.tsx` con tabla de historial de Asteroids
7. Crear componente `GamesTable` que liste todas las partidas del usuario
8. Integrar con Asteroids: al terminar partida, disparar evento que guarde en localStorage
9. Agregar links a Leaderboard y Games en menú principal (`app/layout.tsx`)
10. Crear estructura/schema Supabase comentados con TODOs para fase futura

## Acceptance Criteria

- [ ] Leaderboard global muestra ranking con: posición, nickname, score total, cantidad de juegos, tasa de victoria, último juego
- [ ] Leaderboard personal filtra solo mis partidas, ordenadas por fecha descendente
- [ ] Tabla de Games muestra historial completo: fecha, score, waves completadas, duración, estado (ganada/perdida)
- [ ] Al terminar una partida de Asteroids, se guarda automáticamente en localStorage
- [ ] Los datos persisten correctamente entre recargas de página
- [ ] El nickname se configura una sola vez y se reutiliza (almacenado en localStorage)
- [ ] Páginas accesibles desde menú principal
- [ ] Código Supabase está comentado y marcado con TODOs (`// TODO: Supabase integration`)

## Decisions Taken and Discarded

- **localStorage primero, Supabase después:** Permite desarrollo sin dependencias externas, testing offline, y reduce acoplamiento. La sincronización será un spec futuro.
- **Leaderboard global + personal:** Proporciona contexto competitivo (global) y personal. Una sola vista sería menos informativa.
- **Tabla de Games como historial del usuario:** Más útil que un catálogo estático. El catálogo de juegos disponibles es trabajo futuro.
- **"Victoria" = completar 5 waves:** Definición clásica del juego Asteroids, consistente con SPEC 04.
- **localStorage como cache de Supabase:** Mejora UX (acceso offline) y simplifica transición futura.

## Identified Risks

- **Límite de almacenamiento en localStorage (~5-10MB):** Con muchas partidas podría agotarse. Mitigación: Supabase en spec futuro, o implementar limpieza de datos antiguos después.
- **Conflictos de sincronización con Supabase:** Sin autenticación por ahora, pero al agregar Supabase necesitaremos estrategia de merge. Marcar como decisión en ese spec.
- **Sin autenticación:** Cualquiera puede usar cualquier nickname. Aceptable por ahora, autenticación es trabajo futuro.
