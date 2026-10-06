import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import { safeNext } from "@/lib/auth-redirect";
import {
  normalizeUsername,
  validateEmail,
  validatePassword,
  validateUsername,
} from "@/lib/validation";

// Límite de registros por IP (best-effort: el límite real está en Auth > Rate Limits del dashboard).
const SIGNUP_LIMIT = 5;
const SIGNUP_WINDOW = "1 hour";
const RETRY_AFTER_SECONDS = 3600;

const fail = (error: string, status: number, headers?: HeadersInit) =>
  NextResponse.json({ error }, { status, headers });

// x-forwarded-for puede traer una cadena de IPs: la primera es el cliente.
function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

const hashIp = (ip: string, salt: string) =>
  createHash("sha256").update(`${salt}:${ip}`).digest("hex");

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const salt = process.env.SIGNUP_IP_SALT;
  if (!url || !serviceKey || !salt) {
    console.error("/api/signup: faltan SUPABASE_SERVICE_ROLE_KEY o SIGNUP_IP_SALT");
    return fail("No se pudo crear la cuenta. Intenta de nuevo.", 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail("Solicitud no válida.", 400);
  }

  const username = typeof body.username === "string" ? body.username : "";
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";

  // Revalidación server-side: los intentos inválidos no consumen cuota.
  const invalid =
    validateUsername(username) ??
    validateEmail(email) ??
    validatePassword(password, "register");
  if (invalid) return fail(invalid, 400);

  const admin = createAdminClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: allowed, error: rateError } = await admin.rpc("check_signup_rate", {
    p_ip_hash: hashIp(clientIp(request), salt),
    p_limit: SIGNUP_LIMIT,
    p_window: SIGNUP_WINDOW,
  });
  if (rateError) {
    console.error("/api/signup: check_signup_rate falló", rateError.message);
    return fail("No se pudo crear la cuenta. Intenta de nuevo.", 500);
  }
  if (!allowed) {
    return fail(
      "Demasiados registros desde tu red. Intenta de nuevo en una hora.",
      429,
      { "Retry-After": String(RETRY_AFTER_SECONDS) },
    );
  }

  const next = safeNext(typeof body.next === "string" ? body.next : null);
  const emailRedirectTo = `${request.nextUrl.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  // Cliente con cookies: guarda el code verifier de PKCE para el callback del email.
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { username: normalizeUsername(username) },
      emailRedirectTo,
    },
  });
  if (error) {
    const m = error.message.toLowerCase();
    // El trigger de profiles falla por el índice único de username.
    if (m.includes("database error")) return fail("Ese usuario ya está en uso.", 400);
    if (m.includes("rate limit")) return fail("Demasiados intentos. Espera un momento.", 429);
    if (m.includes("password")) return fail("La contraseña no cumple los requisitos.", 400);
    return fail("No se pudo crear la cuenta. Intenta de nuevo.", 400);
  }

  return NextResponse.json({ ok: true });
}
