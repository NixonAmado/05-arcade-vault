---
name: spec-impl-game
description: Igual que /spec-impl (implementa una spec aprobada, paso a paso, con rama y pausas), pero para juegos nuevos. Al terminar la implementación lanza en secuencia (no en paralelo) los agentes skin-designer y luego mobile-porter.
disable-model-invocation: true
argument-hint: <NN-spec-name>
allowed-tools: Read, Glob, Grep, Edit, Write, Agent, AskUserQuestion, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(cat:*), Bash(ls:*)
---

# /spec-impl-game — /spec-impl + skin-designer + mobile-porter

## Contexto

Estado del repo:
!`git status --short`

Rama actual:
!`git branch --show-current`

Specs disponibles:
!`ls .claude/specs/ 2>/dev/null || echo "No existe .claude/specs/"`

Config de rama:
!`cat .claude/specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (default, sin archivo de config)"`

---

## Instrucciones

**Fases 1 a 4: sigue exactamente el mismo lineamiento que `/spec-impl`** (skill de usuario en `~/.claude/skills/spec-impl/SKILL.md`; léelo si hace falta). Resumen, sin desviarte de él:

1. **Identificar spec** — `$ARGUMENTS` (nombre completo, número o slug) → archivo en `.claude/specs/`. Vacío o no encontrado: listar y pedir nombre; parar.
2. **Validar estado** — solo continúa si significa "Aprobado" (cualquier idioma). Si no: mensaje estándar de error de `/spec-impl`, sin alternativas, sin tocar nada.
3. **Rama** — working tree sucio: avisar y esperar decisión (no stashear/commitear por el usuario). Rama `spec-NN-slug` según `AutoCreateBranch` (default true; si ya existe, retomar: revisar `git log` y confirmar punto de reanudación). Confirmar con el bloque ✅ y mostrar objetivo, alcance, plan y criterios de aceptación.
4. **Implementar paso a paso** — pedir confirmación antes del Paso 1; un paso a la vez, resumen de archivos tocados, pausa `Paso N completado. ¿Revisas el diff y sigo con el Paso N+1?`. **Nunca commitear automáticamente.** Implementar lo que dice la spec; ambigüedades → parar y dar 2-3 opciones; fuera de alcance → no implementar.

Reglas del proyecto: usar `/frontend-design` para UI; consultar `node_modules/next/dist/docs/` antes de escribir código Next.js.

---

### Fase 5 — Agentes post-implementación (secuencial)

Solo cuando **todos** los pasos del plan estén implementados y el usuario haya revisado el último diff.

1. Informar: `Implementación completa. Lanzo skin-designer y luego mobile-porter, uno tras otro.`
2. Identificar el juego implementado (id en `lib/games.ts` / motor en `lib/game-engines.ts`). Si no es claro, preguntar.
3. **Primero** lanzar el agente `skin-designer` (Agent tool, `subagent_type: "skin-designer"`) pasando el juego. **Esperar a que termine** y mostrar su resumen.
4. **Después** — nunca en la misma respuesta ni en paralelo — lanzar `mobile-porter` (`subagent_type: "mobile-porter"`) pasando el juego y la spec. Esperar y mostrar su reporte (cambios en `lib/touch-controls.ts` y brechas).
5. Si `skin-designer` falla o reporta que no puede continuar, mostrarlo y preguntar al usuario si lanzar igual `mobile-porter`.
6. Cerrar con:

```
✅ Implementación + skins + mobile completados.

Siguiente: verifica los criterios de aceptación de la spec uno por uno.
Si pasan, cambia el estado a "Implementado" y haz el commit final antes de mergear.
(No commiteo yo; es decisión tuya.)
```

Los hallazgos de `mobile-porter` que requieran cambios fuera de `lib/touch-controls.ts` se reportan al usuario para pasar por `/spec`; no los implementes aquí.
