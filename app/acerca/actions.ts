"use server";

import { Resend } from "resend";
import { validateContact, type ContactResult } from "@/lib/contact";

const GENERIC_ERROR = "NO SE PUDO ENVIAR. INTÉNTALO DE NUEVO.";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

export async function sendContact(
  _prev: ContactResult | null,
  formData: FormData
): Promise<ContactResult> {
  // honeypot: bots rellenan el campo oculto
  if (str(formData.get("website"))) return { ok: true, name: "JUGADOR" };

  const input = {
    name: str(formData.get("name")).trim(),
    email: str(formData.get("email")).trim(),
    msg: str(formData.get("msg")).trim(),
  };
  const invalid = validateContact(input);
  if (invalid) return { ok: false, error: invalid };

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL;
  if (!apiKey || !to || !from) {
    console.error("[contact] faltan RESEND_API_KEY / CONTACT_TO_EMAIL / CONTACT_FROM_EMAIL");
    return { ok: false, error: GENERIC_ERROR };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to,
      replyTo: input.email,
      // sin saltos de línea: evita inyección de cabeceras
      subject: `[Arcade Vault] Mensaje de ${input.name.replace(/[\r\n]+/g, " ")}`,
      text: `Nombre: ${input.name}\nCorreo: ${input.email}\n\n${input.msg}`,
    });
    if (error) {
      console.error("[contact] Resend:", error);
      return { ok: false, error: GENERIC_ERROR };
    }
  } catch (err) {
    console.error("[contact] Resend:", err);
    return { ok: false, error: GENERIC_ERROR };
  }

  return { ok: true, name: input.name };
}
