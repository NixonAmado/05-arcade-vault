"use client";

import { useEffect, useState } from "react";
import { fetchSessionsByNicknameAndGame } from "@/lib/gameSessions";
import { useUser } from "@/lib/useUser";
import { GAMES } from "@/lib/games";
import { GAME_ENGINES } from "@/lib/game-engines";
import type { GameSession } from "@/types";

const PLAYABLE_GAMES = GAMES.filter((g) => g.id in GAME_ENGINES);

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function GamesTable() {
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
          setError(err instanceof Error ? err.message : "Error al cargar el historial");
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
    return <div className="state">INICIÁ SESIÓN PARA VER TU HISTORIAL DE PARTIDAS</div>;
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
      <div className="th" style={{ gridTemplateColumns: "140px 90px 130px 90px 100px" }}>
        <div>FECHA</div>
        <div>SCORE</div>
        <div>NIVEL ALCANZADO</div>
        <div>DURACIÓN</div>
        <div>ESTADO</div>
      </div>

      {loading && <div className="state">CARGANDO HISTORIAL…</div>}
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
              gridTemplateColumns: "140px 90px 130px 90px 100px",
              animationDelay: `${i * 40}ms`,
            }}
          >
            <div className="dt">
              {new Date(s.played_at).toLocaleString("es-ES")}
            </div>
            <div className="sc">{s.score.toLocaleString("es-ES")}</div>
            <div>{s.wave_completed}</div>
            <div>{formatDuration(s.duration_seconds)}</div>
            <div className={s.won ? "won" : "lost"}>{s.won ? "GANADA" : "PERDIDA"}</div>
          </div>
        ))}
    </div>
  );
}
