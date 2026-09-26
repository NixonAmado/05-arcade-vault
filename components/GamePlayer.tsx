"use client";

import { useEffect, useRef, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import { GAMES } from "@/lib/games";
import { useUser } from "@/lib/useUser";
import type { GameState as AsteroidsState } from "@/lib/asteroids-game";
import type { GameEngine } from "@/lib/game-engine";
import { GAME_ENGINES } from "@/lib/game-engines";
import { insertGameSession } from "@/lib/gameSessions";

function saveScore(entry: { game: string; score: number; name: string }) {
  try {
    const all = JSON.parse(localStorage.getItem("av_scores") || "[]");
    all.push({ ...entry, at: Date.now() });
    localStorage.setItem("av_scores", JSON.stringify(all));
  } catch {}
}

export default function GamePlayer({ id }: { id: string }) {
  const router = useRouter();
  const game = GAMES.find((g) => g.id === id);
  const isAsteroids = game?.id === "asteroids";
  const engineDef = game ? GAME_ENGINES[game.id] : undefined;

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const user = useUser();
  const [nameInput, setNameInput] = useState<string | null>(null);
  const name = nameInput ?? user?.name ?? "INVITADO";
  const level = 1 + Math.floor(score / 2500);
  const [saved, setSaved] = useState(false);

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

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    overRef.current = over;
  }, [over]);

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
    const loop = (ts: number) => {
      const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
      lastTime = ts;

      if (!pausedRef.current && !overRef.current) {
        engineRef.current?.update(dt);
      }
      const state = engineRef.current?.getState();
      if (state !== undefined) {
        setEngineState(state);
        engineDef.draw(ctx, state);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineDef]);

  if (!game) notFound();

  const dScore = engineDef
    ? engineState !== null
      ? engineDef.getScore(engineState)
      : 0
    : score;
  const dLives = isAsteroids
    ? (engineState as AsteroidsState | null)?.lives ?? 3
    : lives;
  const dLevel = engineDef
    ? engineState !== null
      ? engineDef.getProgress(engineState)
      : 1
    : level;

  // Al terminar una partida con motor registrado, se guarda automáticamente en Supabase.
  useEffect(() => {
    if (!engineDef || !over || sessionSavedRef.current || engineState === null) return;
    sessionSavedRef.current = true;
    setSessionStatus("saving");

    const durationSeconds = startTimeRef.current
      ? Math.max(0, Math.round((Date.now() - startTimeRef.current) / 1000))
      : 0;

    insertGameSession({
      nickname: name,
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
    setSaved(false);
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
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
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
          {isAsteroids && (
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

      <div className="crt">
        <div className="crt-screen">
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
            {engineDef && (
              <div className="toast-saved" style={{ marginBottom: 12 }}>
                {sessionStatus === "saving" && "▸ GUARDANDO PARTIDA EN SUPABASE…"}
                {sessionStatus === "saved" && "▸ PARTIDA GUARDADA EN SUPABASE_"}
                {sessionStatus === "error" &&
                  "▸ ERROR AL GUARDAR LA PARTIDA. INTENTÁ DE NUEVO MÁS TARDE."}
              </div>
            )}
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) =>
                    setNameInput(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                />
                <button
                  className="btn yellow"
                  onClick={() => {
                    saveScore({ game: game.id, score: dScore, name });
                    setSaved(true);
                  }}
                >
                  GUARDAR PUNTUACIÓN
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
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
