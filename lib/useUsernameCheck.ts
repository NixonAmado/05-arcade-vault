"use client";

import { useEffect, useState } from "react";
import { checkUsernameAvailable } from "@/lib/profiles";
import { normalizeUsername, validateUsername } from "@/lib/validation";

export type UsernameStatus =
  | "empty"
  | "invalid"
  | "checking"
  | "available"
  | "taken"
  | "error";

const DEBOUNCE_MS = 400;

// Formato: se valida en el acto (sin red). Disponibilidad: consulta con debounce.
export function useUsernameCheck(
  value: string,
  excludeUserId?: string,
): { status: UsernameStatus; error: string | null } {
  const name = normalizeUsername(value);
  const formatError = name ? validateUsername(name) : null;
  const [result, setResult] = useState<{
    name: string;
    status: "available" | "taken" | "error";
  } | null>(null);

  useEffect(() => {
    if (!name || formatError) return;
    let cancelled = false;
    const t = setTimeout(() => {
      checkUsernameAvailable(name, excludeUserId)
        .then((ok) => !cancelled && setResult({ name, status: ok ? "available" : "taken" }))
        .catch(() => !cancelled && setResult({ name, status: "error" }));
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [name, formatError, excludeUserId]);

  if (!name) return { status: "empty", error: null };
  if (formatError) return { status: "invalid", error: formatError };
  if (!result || result.name !== name) return { status: "checking", error: null };
  if (result.status === "taken") return { status: "taken", error: "Ese usuario ya está en uso." };
  if (result.status === "error") {
    return { status: "error", error: "No se pudo comprobar la disponibilidad." };
  }
  return { status: "available", error: null };
}
