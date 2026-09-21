export interface ContactInput {
  name: string;
  email: string;
  msg: string;
}

export type ContactResult =
  | { ok: true; name: string }
  | { ok: false; error: string };

export const CONTACT_LIMITS = { name: 80, email: 254, msg: 2000 } as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContact({ name, email, msg }: ContactInput): string | null {
  const n = name.trim();
  const e = email.trim();
  const m = msg.trim();
  if (!n || !e || !m) return "COMPLETA TODOS LOS CAMPOS.";
  if (n.length > CONTACT_LIMITS.name) return "NOMBRE DEMASIADO LARGO.";
  if (e.length > CONTACT_LIMITS.email || !EMAIL_RE.test(e)) return "CORREO INVÁLIDO.";
  if (m.length > CONTACT_LIMITS.msg) return "MENSAJE DEMASIADO LARGO.";
  return null;
}
