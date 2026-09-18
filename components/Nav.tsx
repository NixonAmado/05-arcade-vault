"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface StoredUser {
  name: string;
}

function readUser(): StoredUser | null {
  try {
    return JSON.parse(localStorage.getItem("av_user") || "null");
  } catch {
    return null;
  }
}

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    setUser(readUser());
    const onStorage = () => setUser(readUser());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [pathname]);

  const isActive = (name: "biblioteca" | "salon" | "login") => {
    if (name === "biblioteca") {
      return (
        pathname === "/" ||
        pathname.startsWith("/biblioteca") ||
        pathname.startsWith("/juego")
      );
    }
    if (name === "salon") return pathname.startsWith("/salon");
    return pathname.startsWith("/login");
  };

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const handleSignOut = () => {
    localStorage.removeItem("av_user");
    setUser(null);
    router.push("/biblioteca");
  };

  return (
    <>
      <nav className="av-nav">
        <div className="logo" onClick={() => go("/biblioteca")}>
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </div>
        <div className="links">
          <Link
            href="/biblioteca"
            className={isActive("biblioteca") ? "active" : ""}
          >
            Biblioteca
          </Link>
          <Link href="/salon" className={isActive("salon") ? "active" : ""}>
            Salón de la Fama
          </Link>
        </div>
        <div className="spacer"></div>
        <div className="coin-counter">
          <span className="coin"></span>
          <span>CRÉDITOS · 03</span>
        </div>
        {user ? (
          <button className="btn ghost auth-btn" onClick={handleSignOut}>
            {user.name} ▾
          </button>
        ) : (
          <button className="btn auth-btn" onClick={() => go("/login")}>
            Iniciar Sesión
          </button>
        )}
        <button
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menú"
        >
          ≡
        </button>
      </nav>

      <div
        className={"av-mobile-backdrop" + (open ? " open" : "")}
        onClick={() => setOpen(false)}
      ></div>
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div className="pixel neon-cyan" style={{ fontSize: 11, marginBottom: 16 }}>
          MENÚ
        </div>
        <Link
          href="/biblioteca"
          className={isActive("biblioteca") ? "active" : ""}
          onClick={() => setOpen(false)}
        >
          Biblioteca
        </Link>
        <Link
          href="/salon"
          className={isActive("salon") ? "active" : ""}
          onClick={() => setOpen(false)}
        >
          Salón de la Fama
        </Link>
        <Link
          href="/login"
          className={isActive("login") ? "active" : ""}
          onClick={() => setOpen(false)}
        >
          {user ? "Cuenta" : "Iniciar Sesión"}
        </Link>
        <div style={{ flex: 1 }}></div>
        <div
          className="pixel"
          style={{ fontSize: 9, color: "var(--ink-faint)", letterSpacing: "0.16em" }}
        >
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
