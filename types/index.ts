import type { Tables } from "@/types/supabase";

export type GameSession = Tables<"game_sessions">;

export interface LeaderboardEntry {
  nickname: string;
  totalScore: number; // Suma de todos los scores
  gameCount: number; // Total de partidas jugadas
  victoriesCount: number; // Partidas ganadas (won = true)
  victoryRate: number; // Porcentaje (0-100)
  lastPlayedAt: string; // ISO8601
}
