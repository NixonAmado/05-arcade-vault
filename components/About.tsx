"use client";

import { useActionState, useState } from "react";
import { sendContact } from "@/app/acerca/actions";
import { CONTACT_LIMITS, validateContact, type ContactResult } from "@/lib/contact";
import { useReveal } from "@/lib/useReveal";
import HighlightIcon from "@/components/about/HighlightIcon";

const HIGHLIGHTS = [
  { i: "HEART", t: "HECHO CON ❤️ PARA JUGADORES", c: "magenta" },
  { i: "BROWSER", t: "JUEGOS EN HTML — CORREN EN CUALQUIER NAVEGADOR", c: "cyan" },
  { i: "PLANT", t: "PROYECTO EN CONSTANTE CRECIMIENTO", c: "green" },
] as const;

const EMPTY = { name: "", email: "", msg: "" };

export default function About() {
  useReveal();
  const [form, setForm] = useState(EMPTY);
  const [shake, setShake] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<ContactResult | null>(null);
  const [state, formAction, pending] = useActionState<ContactResult | null, FormData>(
    sendContact,
    null
  );

  const sent = state?.ok && state !== dismissed ? state.name : null;
  const error = localError ?? (state && !state.ok ? state.error : null);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const invalid = validateContact(form);
    if (invalid) {
      e.preventDefault();
      setLocalError(invalid);
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    setLocalError(null);
  };

  const set = (k: keyof typeof EMPTY) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm({ ...form, [k]: e.target.value });

  const reset = () => {
    setDismissed(state);
    setForm(EMPTY);
    setLocalError(null);
  };

  return (
    <div className="about fade-in">
      <section className="about-hero">
        <div className="kicker pixel neon-yellow">▸ ACERCA DE</div>
        <h1 className="about-title">ACERCA DE ARCADE VAULT</h1>
        <p className="about-mission">
          ARCADE VAULT nació del amor por los videojuegos clásicos. Nuestra misión es preservar y celebrar
          los arcades que definieron una generación, haciéndolos accesibles para todos, en cualquier lugar
          y sin costo.
        </p>

        <div className="highlight-row">
          {HIGHLIGHTS.map((h, i) => (
            <div key={h.i} className={"highlight reveal " + h.c} style={{ transitionDelay: i * 80 + "ms" }}>
              <HighlightIcon kind={h.i} />
              <div className="hl-text pixel">{h.t}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="about-divider reveal" aria-hidden="true">
        <div className="div-bar"></div>
        <div className="div-pixels">
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} style={{ animationDelay: i * 80 + "ms" }}></span>
          ))}
        </div>
        <div className="div-bar"></div>
      </div>

      <section className="about-contact reveal">
        <div className="contact-grid">
          <div className="contact-intro">
            <div className="kicker pixel neon-cyan">▸ CONTACTO</div>
            <h2 className="contact-title">CONTÁCTANOS</h2>
            <p className="contact-sub">
              ¿Tienes alguna sugerencia, quieres proponer un juego, o simplemente quieres saludar?
              Escríbenos.
            </p>
            <div className="contact-tips">
              <div className="tip"><span className="tip-led"></span>RESPUESTA EN 24-48H</div>
              <div className="tip"><span className="tip-led y"></span>SUGERENCIAS BIENVENIDAS</div>
              <div className="tip"><span className="tip-led m"></span>SIN SPAM, JAMÁS</div>
            </div>
          </div>

          <form
            className={"contact-form" + (shake ? " shake" : "")}
            action={formAction}
            onSubmit={onSubmit}
            noValidate
          >
            {!sent ? (
              <>
                <div className="field">
                  <label htmlFor="c-name">NOMBRE</label>
                  <input
                    id="c-name"
                    name="name"
                    value={form.name}
                    onChange={set("name")}
                    placeholder="px_kai"
                    maxLength={CONTACT_LIMITS.name}
                    autoComplete="name"
                    aria-required="true"
                    aria-invalid={!!error && !form.name.trim()}
                  />
                </div>
                <div className="field">
                  <label htmlFor="c-email">CORREO ELECTRÓNICO</label>
                  <input
                    id="c-email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={set("email")}
                    placeholder="jugador@vault.gg"
                    maxLength={CONTACT_LIMITS.email}
                    autoComplete="email"
                    aria-required="true"
                    aria-invalid={!!error && !form.email.trim()}
                  />
                </div>
                <div className="field">
                  <label htmlFor="c-msg">MENSAJE</label>
                  <textarea
                    id="c-msg"
                    name="msg"
                    rows={5}
                    value={form.msg}
                    onChange={set("msg")}
                    placeholder="Cuéntanos qué tienes en mente…"
                    maxLength={CONTACT_LIMITS.msg}
                    aria-required="true"
                    aria-invalid={!!error && !form.msg.trim()}
                  ></textarea>
                </div>
                <input
                  className="hp"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  defaultValue=""
                />
                <div role="status" aria-live="polite">
                  {error && <p className="contact-error">&gt; {error}</p>}
                </div>
                <button className="btn xl press" type="submit" style={{ width: "100%" }} disabled={pending}>
                  {pending ? "ENVIANDO…" : "▶  ENVIAR MENSAJE"}
                </button>
              </>
            ) : (
              <div className="terminal-success" role="status">
                <div className="term-bar">
                  <span className="dot r"></span><span className="dot y"></span><span className="dot g"></span>
                  <span className="term-title">VAULT-OS // TERMINAL</span>
                </div>
                <div className="term-body">
                  <div className="line"><span className="prompt">vault@arcade:~$</span> ./send_message --to=team</div>
                  <div className="line dim">[OK] Conectando con servidor…</div>
                  <div className="line dim">[OK] Validando contenido…</div>
                  <div className="line dim">[OK] Transmitiendo paquete…</div>
                  <div className="line success">
                    &gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {sent.toUpperCase()}.
                    <span className="caret">_</span>
                  </div>
                  <div style={{ marginTop: 18 }}>
                    <button className="btn ghost" type="button" onClick={reset}>
                      ENVIAR OTRO MENSAJE
                    </button>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>
      </section>
    </div>
  );
}
