"use client";

import { useState } from "react";
import LeaderboardGlobal from "@/components/LeaderboardGlobal";
import LeaderboardPersonal from "@/components/LeaderboardPersonal";

type Tab = "global" | "personal";

export default function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>("global");

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>LEADERBOARD</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          RANKING EN VIVO DESDE SUPABASE, POR JUEGO
        </p>
      </div>

      <div className="hall-tabs">
        <button
          className={"chip" + (tab === "global" ? " active" : "")}
          onClick={() => setTab("global")}
        >
          GLOBAL
        </button>
        <button
          className={"chip" + (tab === "personal" ? " active" : "")}
          onClick={() => setTab("personal")}
        >
          MIS PARTIDAS
        </button>
      </div>

      {tab === "global" ? <LeaderboardGlobal /> : <LeaderboardPersonal />}
    </div>
  );
}
