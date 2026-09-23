import { createClient } from "@supabase/supabase-js";

// Acceso literal a process.env.NEXT_PUBLIC_*: Next solo las inyecta en el bundle así.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url) {
  throw new Error("Falta la variable de entorno NEXT_PUBLIC_SUPABASE_URL");
}
if (!publishableKey) {
  throw new Error(
    "Falta la variable de entorno NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  );
}

export const supabase = createClient(url, publishableKey);
