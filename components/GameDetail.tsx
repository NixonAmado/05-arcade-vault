"use client";

import { useEffect, useMemo, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import { GAMES } from "@/lib/games";
import { fetchSessionsByGame } from "@/lib/gameSessions";
import type { GameSession } from "@/types";

export default function GameDetail({ id }: { id: string }) {
  const router = useRouter();
  const game = useMemo(() => GAMES.find((g) => g.id === id), [id]);
  const [sessions, setSessions] = useState<GameSession[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchSessionsByGame(id)
      .then((s) => !cancelled && setSessions(s))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  const scores = useMemo(
    () =>
      [...sessions]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map((s, i) => ({
          id: s.id,
          rank: i + 1,
          name: s.nickname,
          score: s.score,
          date: new Date(s.played_at).toLocaleDateString("es-ES"),
        })),
    [sessions]
  );
  const plays = sessions.length;
  const best = scores[0]?.score ?? 0;

  if (!game) notFound();

  return (
    <div className="av-detail fade-in">
      <div>
        <div className="detail-cover">
          <div className={"cover-bg " + game.cover}></div>
        </div>
        <div style={{ marginTop: 20 }} className="detail-info">
          <div className="detail-tags">
            <span>{game.cat}</span>
            <span>1 JUGADOR</span>
            <span>TECLADO / TÁCTIL</span>
            <span>RETRO 1985</span>
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>
          <div className="stat-strip">
            <div>
              <div className="l">Partidas</div>
              <div className="v">{plays.toLocaleString("es-ES")}</div>
            </div>
            <div>
              <div className="l">Mejor global</div>
              <div
                className="v"
                style={{
                  color: "var(--magenta)",
                  textShadow: "0 0 6px rgba(255,0,110,0.5)",
                }}
              >
                {best.toLocaleString("es-ES")}
              </div>
            </div>
            <div>
              <div className="l">Dificultad</div>
              <div
                className="v"
                style={{
                  color: "var(--yellow)",
                  textShadow: "0 0 6px rgba(245,255,0,0.5)",
                }}
              >
                ★ ★ ★ ☆ ☆
              </div>
            </div>
          </div>
          <div className="detail-actions">
            <button
              className="btn xl pulse"
              onClick={() => router.push(`/juego/${game.id}/jugar`)}
            >
              ▶ JUGAR AHORA
            </button>
            <button className="btn ghost lg" onClick={() => router.push("/biblioteca")}>
              VOLVER AL VAULT
            </button>
          </div>
        </div>
      </div>

      <aside>
        <div className="leaderboard">
          <h3>MEJORES PUNTUACIONES</h3>
          {scores.length === 0 && (
            <div
              style={{
                padding: "28px 16px",
                textAlign: "center",
                fontFamily: "var(--pixel)",
                fontSize: 10,
                lineHeight: 1.8,
                letterSpacing: "0.1em",
                color: "var(--ink-faint)",
              }}
            >
              AÚN NO HAY PARTIDAS
              <br />
              <span style={{ color: "var(--cyan)" }}>▸ SÉ EL PRIMERO_</span>
            </div>
          )}
          {scores.map((r, i) => (
            <div
              key={r.id}
              className={
                "lb-row" +
                (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")
              }
            >
              <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
              <div className="pl">
                {r.name}
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--ink-faint)",
                    letterSpacing: "0.1em",
                  }}
                >
                  {r.date}
                </div>
              </div>
              <div className="sc">{r.score.toLocaleString("es-ES")}</div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
