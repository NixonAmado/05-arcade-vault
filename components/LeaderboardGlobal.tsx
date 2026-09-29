"use client";

import { useState } from "react";
import { useLeaderboard } from "@/lib/useLeaderboard";
import { GAMES } from "@/lib/games";
import { GAME_ENGINES } from "@/lib/game-engines";

const PLAYABLE_GAMES = GAMES.filter((g) => g.id in GAME_ENGINES);

export default function LeaderboardGlobal() {
  const [gameId, setGameId] = useState(PLAYABLE_GAMES[0]?.id ?? "asteroids");
  const { entries, loading, error } = useLeaderboard(gameId);

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
      <div className="th" style={{ gridTemplateColumns: "60px 1fr 130px 90px 100px 140px" }}>
        <div>RANGO</div>
        <div>JUGADOR</div>
        <div>SCORE TOTAL</div>
        <div>PARTIDAS</div>
        <div>% VICTORIA</div>
        <div>ÚLTIMO JUEGO</div>
      </div>

      {loading && <div className="state">CARGANDO LEADERBOARD…</div>}
      {!loading && error && <div className="state error">ERROR: {error}</div>}
      {!loading && !error && entries.length === 0 && (
        <div className="state">TODAVÍA NO HAY PARTIDAS REGISTRADAS</div>
      )}
      {!loading &&
        !error &&
        entries.map((e, i) => (
          <div
            key={e.nickname}
            className="tr"
            style={{
              gridTemplateColumns: "60px 1fr 130px 90px 100px 140px",
              animationDelay: `${i * 40}ms`,
            }}
          >
            <div className="rk">#{String(i + 1).padStart(2, "0")}</div>
            <div className="pl">{e.nickname}</div>
            <div className="sc">{e.totalScore.toLocaleString("es-ES")}</div>
            <div>{e.gameCount}</div>
            <div>{e.victoryRate}%</div>
            <div className="dt">
              {new Date(e.lastPlayedAt).toLocaleDateString("es-ES")}
            </div>
          </div>
        ))}
    </div>
  );
}
