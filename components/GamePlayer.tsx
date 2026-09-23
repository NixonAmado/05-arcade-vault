"use client";

import { useEffect, useRef, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import { GAMES } from "@/lib/games";
import { useUser } from "@/lib/useUser";
import { AsteroidsGame, GameState as AsteroidsState } from "@/lib/asteroids-game";

function saveScore(entry: { game: string; score: number; name: string }) {
  try {
    const all = JSON.parse(localStorage.getItem("av_scores") || "[]");
    all.push({ ...entry, at: Date.now() });
    localStorage.setItem("av_scores", JSON.stringify(all));
  } catch {}
}

function drawAsteroids(ctx: CanvasRenderingContext2D, state: AsteroidsState) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 800, 600);

  state.particles.forEach((p) => {
    const alpha = p.ttl / p.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05);
    ctx.stroke();
  });

  state.asteroids.forEach((a) => {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.rot);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(a.verts[0][0], a.verts[0][1]);
    for (let i = 1; i < a.verts.length; i++) ctx.lineTo(a.verts[i][0], a.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  });

  state.bullets.forEach((b) => {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  });

  if (!state.ship.dead) {
    if (state.ship.invincible <= 0 || Math.floor(state.ship.invincible * 8) % 2 === 0) {
      ctx.save();
      ctx.translate(state.ship.x, state.ship.y);
      ctx.rotate(state.ship.angle);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(-12, -9);
      ctx.lineTo(-7, 0);
      ctx.lineTo(-12, 9);
      ctx.closePath();
      ctx.stroke();

      if (state.ship.thrusting && Math.random() > 0.35) {
        ctx.beginPath();
        ctx.moveTo(-8, -4);
        ctx.lineTo(-8 - (Math.random() * 8 + 6), 0);
        ctx.lineTo(-8, 4);
        ctx.strokeStyle = "rgba(255, 130, 0, 0.85)";
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

export default function GamePlayer({ id }: { id: string }) {
  const router = useRouter();
  const game = GAMES.find((g) => g.id === id);
  const isAsteroids = game?.id === "asteroids";

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const user = useUser();
  const [nameInput, setNameInput] = useState<string | null>(null);
  const name = nameInput ?? user?.name ?? "INVITADO";
  const level = 1 + Math.floor(score / 2500);
  const [saved, setSaved] = useState(false);

  const [asteroidsState, setAsteroidsState] = useState<AsteroidsState | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AsteroidsGame | null>(null);
  const rafRef = useRef<number | null>(null);
  const pausedRef = useRef(paused);
  const overRef = useRef(over);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    overRef.current = over;
  }, [over]);

  useEffect(() => {
    if (isAsteroids || over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220
    );
    return () => clearInterval(t);
  }, [isAsteroids, over, paused]);

  useEffect(() => {
    if (!isAsteroids) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const engine = new AsteroidsGame(800, 600);
    engineRef.current = engine;
    setAsteroidsState(engine.getState());

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
      if (state) {
        setAsteroidsState({ ...state });
        drawAsteroids(ctx, state);
        if (state.state === "gameover" && !overRef.current) {
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
  }, [isAsteroids]);

  if (!game) notFound();

  const dScore = isAsteroids ? asteroidsState?.score ?? 0 : score;
  const dLives = isAsteroids ? asteroidsState?.lives ?? 3 : lives;
  const dLevel = isAsteroids ? asteroidsState?.level ?? 1 : level;

  const endGame = () => setOver(true);
  const restart = () => {
    setScore(0);
    setLives(3);
    setPaused(false);
    setOver(false);
    setSaved(false);
    if (isAsteroids) {
      engineRef.current?.reset();
      overRef.current = false;
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
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(dLives).trim() || "—"}</div>
          </div>
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
          {isAsteroids ? (
            <div className="game-arena">
              <canvas
                ref={canvasRef}
                width={800}
                height={600}
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
