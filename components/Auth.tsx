"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { safeNext } from "@/lib/auth-redirect";
import { useUsernameCheck } from "@/lib/useUsernameCheck";
import {
  normalizeUsername,
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
} from "@/lib/validation";
import AuthField from "@/components/AuthField";

type Tab = "in" | "up";
type Provider = "google" | "github";

interface Props {
  next?: string;
  error?: string;
}

function loginErrorMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (m.includes("email not confirmed")) return "Confirma tu correo antes de entrar.";
  return "No se pudo iniciar sesión. Intenta de nuevo.";
}

const SIGNUP_FALLBACK_ERROR = "No se pudo crear la cuenta. Intenta de nuevo.";

// El registro pasa por /api/signup (rate limit por IP); el servidor devuelve el mensaje en español.
async function signUpRequest(
  body: { username: string; email: string; password: string; next: string },
): Promise<string | null> {
  try {
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return null;
    const data = await res.json().catch(() => null);
    return typeof data?.error === "string" ? data.error : SIGNUP_FALLBACK_ERROR;
  } catch {
    return SIGNUP_FALLBACK_ERROR;
  }
}

export default function Auth({ next, error: initialError }: Props) {
  const router = useRouter();
  const nextPath = safeNext(next);
  const [tab, setTab] = useState<Tab>("in");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(
    initialError ? "No se pudo iniciar sesión. Intenta de nuevo." : null,
  );
  const [sentTo, setSentTo] = useState<string | null>(null);

  const register = tab === "up";
  const usernameCheck = useUsernameCheck(register ? username : "");
  const emailError = validateEmail(email);
  const passwordError = validatePassword(password, register ? "register" : "login");
  const confirmError = register ? validatePasswordConfirm(password, confirm) : null;

  const valid = register
    ? usernameCheck.status === "available" && !emailError && !passwordError && !confirmError
    : !emailError && !passwordError;

  const callbackUrl = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

  const switchTab = (t: Tab) => {
    setTab(t);
    setServerError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setServerError(null);

    if (register) {
      const error = await signUpRequest({
        username: normalizeUsername(username),
        email: email.trim(),
        password,
        next: nextPath,
      });
      setBusy(false);
      if (error) return setServerError(error);
      setSentTo(email.trim());
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setBusy(false);
      return setServerError(loginErrorMessage(error.message));
    }
    router.replace(nextPath);
    router.refresh();
  };

  const oauth = async (provider: Provider) => {
    setServerError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl() },
    });
    if (error) setServerError("No se pudo iniciar sesión con " + provider + ".");
  };

  if (sentTo) {
    return (
      <div className="av-auth-wrap fade-in">
        <div className="auth-card">
          <div className="auth-header">
            <div className="mark"></div>
            <h2 className="neon-cyan">REVISA TU CORREO</h2>
          </div>
          <div className="auth-notice ok">
            Te enviamos un enlace de confirmación a <b>{sentTo}</b>. Ábrelo para activar tu
            cuenta y entrar al Vault.
          </div>
          <button
            className="btn ghost"
            style={{ width: "100%" }}
            onClick={() => {
              setSentTo(null);
              switchTab("in");
            }}
          >
            VOLVER A INICIAR SESIÓN
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          <button type="button" className={tab === "in" ? "on" : ""} onClick={() => switchTab("in")}>
            INICIAR SESIÓN
          </button>
          <button type="button" className={tab === "up" ? "on" : ""} onClick={() => switchTab("up")}>
            CREAR CUENTA
          </button>
        </div>

        {serverError && (
          <div className="auth-notice" role="alert">
            {serverError}
          </div>
        )}

        <form onSubmit={submit} noValidate>
          {register && (
            <AuthField
              label="Usuario"
              value={username}
              onChange={(v) => setUsername(normalizeUsername(v))}
              error={usernameCheck.error}
              ok={usernameCheck.status === "available" ? "Usuario disponible." : null}
              hint={usernameCheck.status === "checking" ? "Comprobando…" : "3-10 caracteres: A-Z, 0-9, _"}
              placeholder="PX_KAI"
              autoComplete="username"
            />
          )}
          <AuthField
            label="Correo electrónico"
            type="email"
            value={email}
            onChange={setEmail}
            error={emailError}
            placeholder="jugador@vault.gg"
            autoComplete="email"
          />
          <AuthField
            label="Contraseña"
            type="password"
            value={password}
            onChange={setPassword}
            error={passwordError}
            hint={register ? "Mínimo 8 caracteres" : null}
            placeholder="••••••••"
            autoComplete={register ? "new-password" : "current-password"}
          />
          {register && (
            <AuthField
              label="Repetir contraseña"
              type="password"
              value={confirm}
              onChange={setConfirm}
              error={confirmError}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          )}

          <button
            className="btn lg"
            type="submit"
            disabled={!valid || busy}
            style={{ width: "100%", marginTop: 8 }}
          >
            {busy ? "…" : register ? "CREAR CUENTA" : "ENTRAR AL VAULT"}
          </button>
        </form>

        <button
          className="btn ghost"
          type="button"
          style={{ width: "100%", marginTop: 10 }}
          onClick={() => router.push("/biblioteca")}
        >
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button className="btn ghost" type="button" onClick={() => oauth("google")}>
            ◆ GOOGLE
          </button>
          <button className="btn ghost" type="button" onClick={() => oauth("github")}>
            ▣ GITHUB
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
