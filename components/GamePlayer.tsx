"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { notFound, useRouter } from "next/navigation";
import { GAMES } from "@/lib/games";
import { useUser } from "@/lib/useUser";
import type { GameState as AsteroidsState } from "@/lib/asteroids-game";
import type { FroggerState } from "@/lib/frogger-game";
import type { GameEngine, SkinId } from "@/lib/game-engine";
import { SKIN_IDS, SKIN_LABELS } from "@/lib/asteroids-skins";
import { GAME_ENGINES } from "@/lib/game-engines";
import { insertGameSession } from "@/lib/gameSessions";
import { useIsMobile } from "@/lib/useIsMobile";
import { TOUCH_CONTROLS } from "@/lib/touch-controls";
import { vibrate } from "@/lib/haptics";
import TouchControls from "@/components/TouchControls";

const skinListeners = new Set<() => void>();
function subscribeSkin(cb: () => void) {
  skinListeners.add(cb);
  return () => {
    skinListeners.delete(cb);
  };
}
function readSkin(key: string): SkinId {
  try {
    const v = localStorage.getItem(key);
    if (v && (SKIN_IDS as string[]).includes(v)) return v as SkinId;
  } catch {}
  return "clasica";
}

export default function GamePlayer({ id }: { id: string }) {
  const router = useRouter();
  const game = GAMES.find((g) => g.id === id);
  const isAsteroids = game?.id === "asteroids";
  const isFrogger = game?.id === "frogger";
  const hasSkins = game?.id === "asteroids" || game?.id === "vibora" || game?.id === "frogger";
  const engineDef = game ? GAME_ENGINES[game.id] : undefined;
  const isMobile = useIsMobile();
  const touchLayout = game ? TOUCH_CONTROLS[game.id] : undefined;
  const showTouch = isMobile && !!engineDef && !!touchLayout;
  const screenRef = useRef<HTMLDivElement>(null);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const user = useUser();
  const name = user?.name ?? "INVITADO";
  const level = 1 + Math.floor(score / 2500);

  const [engineState, setEngineState] = useState<unknown>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine<unknown> | null>(null);
  const rafRef = useRef<number | null>(null);
  const pausedRef = useRef(paused);
  const overRef = useRef(over);
  const startTimeRef = useRef<number>(null);
  const sessionSavedRef = useRef(false);
  const [sessionStatus, setSessionStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const skinKey = `skin-${id}`;
  const skin = useSyncExternalStore(
    subscribeSkin,
    () => readSkin(skinKey),
    () => "clasica" as SkinId
  );
  const skinRef = useRef<SkinId>(skin);
  useEffect(() => {
    skinRef.current = skin;
  }, [skin]);

  const chooseSkin = (s: SkinId) => {
    skinRef.current = s;
    try {
      localStorage.setItem(skinKey, s);
    } catch {}
    skinListeners.forEach((l) => l());
  };

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    overRef.current = over;
  }, [over]);

  // Pausa automática al perder visibilidad o rotar el dispositivo en plena partida.
  useEffect(() => {
    if (!engineDef) return;
    const autoPause = () => {
      if (!overRef.current) setPaused(true);
    };
    const onVisibility = () => {
      if (document.hidden) autoPause();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("orientationchange", autoPause);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("orientationchange", autoPause);
    };
  }, [engineDef]);

  // Evita scroll / pull-to-refresh al arrastrar sobre el área de juego.
  useEffect(() => {
    const el = screenRef.current;
    if (!el || !showTouch) return;
    const block = (e: TouchEvent) => e.preventDefault();
    el.addEventListener("touchmove", block, { passive: false });
    return () => el.removeEventListener("touchmove", block);
  }, [showTouch]);

  // Háptica al terminar la partida.
  useEffect(() => {
    if (over && engineDef) vibrate([80, 40, 80]);
  }, [over, engineDef]);

  useEffect(() => {
    if (engineDef || over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220
    );
    return () => clearInterval(t);
  }, [engineDef, over, paused]);

  useEffect(() => {
    if (!engineDef) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Nitidez en pantallas HiDPI (tope 2x para no encarecer el relleno).
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = engineDef.width * dpr;
    canvas.height = engineDef.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const engine = engineDef.create();
    engineRef.current = engine;
    startTimeRef.current = Date.now();
    setEngineState(engine.getState());

    const handleKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
      engineRef.current?.setKeyDown(e.code);
    };
    const handleKeyUp = (e: KeyboardEvent) => engineRef.current?.setKeyUp(e.code);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    let lastTime: number | null = null;
    let hudSig = "";
    let lastSkin = skinRef.current;
    let wasRunning = true;
    const loop = (ts: number) => {
      const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
      lastTime = ts;

      const running = !pausedRef.current && !overRef.current;
      if (running) {
        engineRef.current?.update(dt);
      }
      const state = engineRef.current?.getState();
      if (state !== undefined) {
        // Re-render de React solo si cambia el HUD (no 60 veces/seg).
        const lives = (state as { lives?: number }).lives;
        const sig = `${engineDef.getScore(state)}|${engineDef.getProgress(state)}|${lives}|${engineDef.isGameOver(state)}`;
        if (sig !== hudSig) {
          hudSig = sig;
          setEngineState(state);
        }
        // En pausa/fin sin cambios, no redibuja.
        if (running || wasRunning || lastSkin !== skinRef.current) {
          engineDef.draw(ctx, state, skinRef.current);
          lastSkin = skinRef.current;
        }
        wasRunning = running;
        if (engineDef.isGameOver(state) && !overRef.current) {
          overRef.current = true;
          setOver(true);
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
     
  }, [engineDef]);

  if (!game) notFound();

  const dScore = engineDef
    ? engineState !== null
      ? engineDef.getScore(engineState)
      : 0
    : score;
  const dLives = isAsteroids
    ? (engineState as AsteroidsState | null)?.lives ?? 3
    : isFrogger
      ? (engineState as FroggerState | null)?.lives ?? 3
      : lives;
  const dLevel = engineDef
    ? engineState !== null
      ? engineDef.getProgress(engineState)
      : 1
    : level;

  // Al terminar una partida con motor registrado, se guarda automáticamente en Supabase.
  // Solo usuarios logueados guardan; el invitado ve un CTA en el modal.
  useEffect(() => {
    if (!engineDef || !over || !user || sessionSavedRef.current || engineState === null) return;
    sessionSavedRef.current = true;
    setSessionStatus("saving");

    const durationSeconds = startTimeRef.current
      ? Math.max(0, Math.round((Date.now() - startTimeRef.current) / 1000))
      : 0;

    insertGameSession({
      game_id: game.id,
      nickname: user.name,
      score: engineDef.getScore(engineState),
      wave_completed: engineDef.getProgress(engineState),
      won: engineDef.hasWon(engineState),
      duration_seconds: durationSeconds,
    })
      .then(() => setSessionStatus("saved"))
      .catch(() => setSessionStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineDef, over]);

  const endGame = () => setOver(true);
  const restart = () => {
    setScore(0);
    setLives(3);
    setPaused(false);
    setOver(false);
    if (engineDef) {
      engineRef.current?.reset();
      startTimeRef.current = Date.now();
      overRef.current = false;
      sessionSavedRef.current = false;
      setSessionStatus("idle");
    }
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div className="hud-stats" style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{dScore.toLocaleString("es-ES")}</div>
          </div>
          {(isAsteroids || isFrogger) && (
            <div className="hud-stat lives">
              <div className="l">Vidas</div>
              <div className="v">{"♥ ".repeat(dLives).trim() || "—"}</div>
            </div>
          )}
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(dLevel).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={endGame}>
            FIN
          </button>
          <button
            className="btn ghost"
            onClick={() => router.push(`/juego/${game.id}`)}
          >
            SALIR
          </button>
        </div>
      </div>

      {hasSkins && isMobile && (
        <div className="skin-compact">
          <label
            className="mono"
            htmlFor="skin-select"
            style={{ fontSize: 11, color: "var(--ink-dim)", letterSpacing: "0.16em" }}
          >
            SKIN
          </label>
          <select
            id="skin-select"
            value={skin}
            onChange={(e) => chooseSkin(e.target.value as SkinId)}
          >
            {SKIN_IDS.map((s) => (
              <option key={s} value={s}>
                {SKIN_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      )}

      {hasSkins && !isMobile && (
        <div
          role="radiogroup"
          aria-label="Skin"
          style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}
        >
          <span
            className="mono"
            style={{ fontSize: 11, color: "var(--ink-dim)", letterSpacing: "0.16em" }}
          >
            SKIN
          </span>
          {SKIN_IDS.map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={skin === s}
              className={skin === s ? "btn yellow" : "btn ghost"}
              onClick={() => chooseSkin(s)}
              onKeyDown={(e) => {
                if (e.code === "Space") e.stopPropagation();
              }}
            >
              {SKIN_LABELS[s]}
            </button>
          ))}
        </div>
      )}

      <div className="crt">
        <div
          ref={screenRef}
          className="crt-screen"
          style={
            isMobile && engineDef
              ? { aspectRatio: `${engineDef.width} / ${engineDef.height}` }
              : undefined
          }
        >
          {engineDef ? (
            <div className="game-arena">
              <canvas
                ref={canvasRef}
                width={engineDef.width}
                height={engineDef.height}
                style={{ width: "100%", height: "100%", display: "block" }}
              />
            </div>
          ) : (
            <div className="game-arena">
              <div className="grid-floor"></div>
              <div className="enemy e1"></div>
              <div className="enemy e2"></div>
              <div className="enemy e3"></div>
              <div className="player-ship"></div>
            </div>
          )}
          {showTouch && touchLayout && (
            <TouchControls
              layout={touchLayout}
              disabled={paused || over}
              onDown={(code) => engineRef.current?.setKeyDown(code)}
              onUp={(code) => engineRef.current?.setKeyUp(code)}
            />
          )}
          {paused && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>
            {game.title} · CRT-83 · 60 HZ
          </span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd" onClick={() => {}}>
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{dScore.toLocaleString("es-ES")}</div>
            {engineDef && user && (
              <>
                <div className="final-label">JUGADOR · {user.name}</div>
                <div className="toast-saved" style={{ marginBottom: 12 }}>
                  {sessionStatus === "saving" && "▸ GUARDANDO PARTIDA EN SUPABASE…"}
                  {sessionStatus === "saved" && "▸ PARTIDA GUARDADA EN SUPABASE_"}
                  {sessionStatus === "error" &&
                    "▸ ERROR AL GUARDAR LA PARTIDA. INTENTA DE NUEVO MÁS TARDE."}
                </div>
              </>
            )}
            {engineDef && !user && (
              <div style={{ marginBottom: 12 }}>
                <div className="toast-saved" style={{ marginBottom: 10 }}>
                  ▸ JUEGAS COMO INVITADO: ESTA PARTIDA NO SE GUARDA
                </div>
                <button
                  className="btn yellow"
                  style={{ width: "100%" }}
                  onClick={() =>
                    router.push(`/login?next=${encodeURIComponent(`/juego/${id}/jugar`)}`)
                  }
                >
                  INICIA SESIÓN PARA GUARDAR
                </button>
              </div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <button
                className="btn magenta"
                onClick={() => router.push("/biblioteca")}
              >
                VOLVER AL VAULT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
