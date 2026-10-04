import { supabase } from "@/lib/supabase";
import type { GameSession } from "@/types";
import type { TablesInsert } from "@/types/supabase";

export type NewGameSession = TablesInsert<"game_sessions">;

export async function insertGameSession(
  entry: NewGameSession
): Promise<GameSession> {
  const { data, error } = await supabase
    .from("game_sessions")
    .insert(entry)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchAllSessions(): Promise<GameSession[]> {
  const { data, error } = await supabase
    .from("game_sessions")
    .select("*")
    .order("played_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function fetchSessionsByUserId(
  userId: string
): Promise<GameSession[]> {
  const { data, error } = await supabase
    .from("game_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("played_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function fetchSessionsByGame(
  gameId: string
): Promise<GameSession[]> {
  const { data, error } = await supabase
    .from("game_sessions")
    .select("*")
    .eq("game_id", gameId)
    .order("played_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function fetchSessionsByUserIdAndGame(
  userId: string,
  gameId: string
): Promise<GameSession[]> {
  const { data, error } = await supabase
    .from("game_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("game_id", gameId)
    .order("played_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
