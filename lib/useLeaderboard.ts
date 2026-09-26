"use client";

import { useEffect, useState } from "react";
import { fetchAllSessions } from "@/lib/gameSessions";
import type { GameSession, LeaderboardEntry } from "@/types";

export function computeLeaderboard(sessions: GameSession[]): LeaderboardEntry[] {
  const byNickname = new Map<string, LeaderboardEntry>();

  for (const s of sessions) {
    const entry = byNickname.get(s.nickname) ?? {
      nickname: s.nickname,
      totalScore: 0,
      gameCount: 0,
      victoriesCount: 0,
      victoryRate: 0,
      lastPlayedAt: s.played_at,
    };

    entry.totalScore += s.score;
    entry.gameCount += 1;
    if (s.won) entry.victoriesCount += 1;
    if (s.played_at > entry.lastPlayedAt) entry.lastPlayedAt = s.played_at;

    byNickname.set(s.nickname, entry);
  }

  return Array.from(byNickname.values())
    .map((e) => ({
      ...e,
      victoryRate: e.gameCount > 0 ? Math.round((e.victoriesCount / e.gameCount) * 100) : 0,
    }))
    .sort((a, b) => b.totalScore - a.totalScore);
}

interface UseLeaderboardResult {
  entries: LeaderboardEntry[];
  loading: boolean;
  error: string | null;
}

export function useLeaderboard(): UseLeaderboardResult {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchAllSessions()
      .then((sessions) => {
        if (cancelled) return;
        setEntries(computeLeaderboard(sessions));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Error al cargar el leaderboard");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { entries, loading, error };
}
