"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { safeNext } from "@/lib/auth-redirect";
import { refreshUser } from "@/lib/useUser";
import { useUsernameCheck } from "@/lib/useUsernameCheck";
import { normalizeUsername } from "@/lib/validation";
import AuthField from "@/components/AuthField";

// Primer ingreso por OAuth: el usuario debe elegir su username antes de continuar.
export default function Welcome({ next }: { next?: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const check = useUsernameCheck(username);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (check.status !== "available" || busy) return;
    setBusy(true);
    setServerError(null);

    const { data } = await supabase.auth.getUser();
    if (!data.user) return router.replace("/login");

    const { error } = await supabase
      .from("profiles")
      .insert({ id: data.user.id, username: normalizeUsername(username) });
    if (error) {
      setBusy(false);
      // 23505: unique_violation (otro usuario tomó el nombre entre el chequeo y el envío).
      return setServerError(
        error.code === "23505"
          ? "Ese usuario ya está en uso."
          : "No se pudo guardar tu usuario. Intenta de nuevo.",
      );
    }

    await refreshUser();
    router.replace(safeNext(next));
    router.refresh();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">BIENVENIDO</h2>
          <div
            className="mono"
            style={{ fontSize: 11, color: "var(--ink-faint)", letterSpacing: "0.16em", marginTop: 6 }}
          >
            ELIGE TU NOMBRE DE JUGADOR
          </div>
        </div>

        {serverError && (
          <div className="auth-notice" role="alert">
            {serverError}
          </div>
        )}

        <form onSubmit={submit} noValidate>
          <AuthField
            label="Usuario"
            value={username}
            onChange={(v) => setUsername(normalizeUsername(v))}
            error={check.error}
            ok={check.status === "available" ? "Usuario disponible." : null}
            hint={check.status === "checking" ? "Comprobando…" : "3-10 caracteres: A-Z, 0-9, _"}
            placeholder="PX_KAI"
            autoComplete="username"
            autoFocus
          />
          <button
            className="btn lg"
            type="submit"
            disabled={check.status !== "available" || busy}
            style={{ width: "100%", marginTop: 8 }}
          >
            {busy ? "…" : "CONFIRMAR USUARIO"}
          </button>
        </form>

        <button
          className="btn ghost"
          type="button"
          style={{ width: "100%", marginTop: 10 }}
          onClick={signOut}
        >
          CERRAR SESIÓN
        </button>
      </div>
    </div>
  );
}
