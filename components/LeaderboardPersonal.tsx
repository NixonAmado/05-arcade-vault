"use client";

import { useEffect, useState } from "react";
import { fetchSessionsByNicknameAndGame } from "@/lib/gameSessions";
import { useUser } from "@/lib/useUser";
import { GAMES } from "@/lib/games";
import { GAME_ENGINES } from "@/lib/game-engines";
import type { GameSession } from "@/types";

const PLAYABLE_GAMES = GAMES.filter((g) => g.id in GAME_ENGINES);

export default function LeaderboardPersonal() {
  const user = useUser();
  const [gameId, setGameId] = useState(PLAYABLE_GAMES[0]?.id ?? "asteroids");
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    setLoading(true);

    fetchSessionsByNicknameAndGame(user.name, gameId)
      .then((data) => {
        if (cancelled) return;
        setSessions(data);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error al cargar tus partidas");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, gameId]);

  if (!user) {
    return <div className="state">INICIÁ SESIÓN PARA VER TU LEADERBOARD PERSONAL</div>;
  }

  return (
    <div className="data-table">
      <div className="hall-tabs" style={{ marginBottom: 16 }}>
        {PLAYABLE_GAMES.map((g) => (
          <button
            key={g.id}
            className={"chip" + (gameId === g.id ? " active" : "")}
            onClick={() => setGameId(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>
      <div className="th" style={{ gridTemplateColumns: "70px 1fr 100px 140px" }}>
        <div>SCORE</div>
        <div>NIVEL ALCANZADO</div>
        <div>ESTADO</div>
        <div>FECHA</div>
      </div>

      {loading && <div className="state">CARGANDO TUS PARTIDAS…</div>}
      {!loading && error && <div className="state error">ERROR: {error}</div>}
      {!loading && !error && sessions.length === 0 && (
        <div className="state">TODAVÍA NO JUGASTE NINGUNA PARTIDA</div>
      )}
      {!loading &&
        !error &&
        sessions.map((s, i) => (
          <div
            key={s.id}
            className="tr"
            style={{
              gridTemplateColumns: "70px 1fr 100px 140px",
              animationDelay: `${i * 40}ms`,
            }}
          >
            <div className="sc">{s.score.toLocaleString("es-ES")}</div>
            <div>{s.wave_completed}</div>
            <div className={s.won ? "won" : "lost"}>{s.won ? "GANADA" : "PERDIDA"}</div>
            <div className="dt">{new Date(s.played_at).toLocaleDateString("es-ES")}</div>
          </div>
        ))}
    </div>
  );
}
