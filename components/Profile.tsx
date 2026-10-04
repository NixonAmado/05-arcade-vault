"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { refreshUser, useAuthState } from "@/lib/useUser";
import { useUsernameCheck } from "@/lib/useUsernameCheck";
import { normalizeUsername } from "@/lib/validation";
import AuthField from "@/components/AuthField";

export default function Profile() {
  const router = useRouter();
  const { user, loading } = useAuthState();
  const [account, setAccount] = useState<{ email: string; provider: string } | null>(null);
  const [edited, setEdited] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setAccount({
        email: data.user.email ?? "—",
        provider: String(data.user.app_metadata?.provider ?? "email"),
      });
    });
  }, []);

  const username = edited ?? user?.name ?? "";
  const unchanged = normalizeUsername(username) === user?.name;
  const check = useUsernameCheck(unchanged ? "" : username, user?.id);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || unchanged || check.status !== "available" || busy) return;
    setBusy(true);
    setMsg(null);
    const { error } = await supabase
      .from("profiles")
      .update({ username: normalizeUsername(username) })
      .eq("id", user.id);
    setBusy(false);
    if (error) {
      return setMsg({
        kind: "err",
        text:
          error.code === "23505"
            ? "Ese usuario ya está en uso."
            : "No se pudo guardar el cambio. Intenta de nuevo.",
      });
    }
    await refreshUser();
    setEdited(null);
    setMsg({ kind: "ok", text: "Usuario actualizado." });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/biblioteca");
    router.refresh();
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">MI PERFIL</h2>
        </div>

        {loading || !user ? (
          <div className="mono" style={{ textAlign: "center", color: "var(--ink-faint)" }}>
            CARGANDO…
          </div>
        ) : (
          <>
            <div className="profile-row">
              <span>CORREO</span>
              <b>{account?.email ?? "…"}</b>
            </div>
            <div className="profile-row">
              <span>ACCESO</span>
              <b>{(account?.provider ?? "…").toUpperCase()}</b>
            </div>

            {msg && (
              <div className={"auth-notice" + (msg.kind === "ok" ? " ok" : "")} role="alert">
                {msg.text}
              </div>
            )}

            <form onSubmit={save} noValidate>
              <AuthField
                label="Usuario"
                value={username}
                onChange={(v) => {
                  setEdited(normalizeUsername(v));
                  setMsg(null);
                }}
                error={check.error}
                ok={check.status === "available" ? "Usuario disponible." : null}
                hint={check.status === "checking" ? "Comprobando…" : "3-10 caracteres: A-Z, 0-9, _"}
                autoComplete="username"
              />
              <button
                className="btn lg"
                type="submit"
                disabled={unchanged || check.status !== "available" || busy}
                style={{ width: "100%", marginTop: 8 }}
              >
                {busy ? "…" : "GUARDAR USUARIO"}
              </button>
            </form>

            <button
              className="btn magenta"
              type="button"
              style={{ width: "100%", marginTop: 10 }}
              onClick={signOut}
            >
              CERRAR SESIÓN
            </button>
          </>
        )}
      </div>
    </div>
  );
}
