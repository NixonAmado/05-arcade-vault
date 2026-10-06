import { supabase } from "@/lib/supabase";
import { normalizeUsername } from "@/lib/validation";

export async function fetchProfileUsername(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.username ?? null;
}

// `excludeUserId`: el propio usuario (en /perfil) no cuenta como "en uso".
export async function checkUsernameAvailable(
  username: string,
  excludeUserId?: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", normalizeUsername(username))
    .maybeSingle();
  if (error) throw error;
  return !data || data.id === excludeUserId;
}
