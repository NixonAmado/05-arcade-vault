// Valida el parámetro `next` para evitar open redirects: solo rutas relativas del mismo sitio.
export function safeNext(next: string | null | undefined, fallback = "/biblioteca"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
