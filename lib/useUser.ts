"use client";

import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { fetchProfileUsername } from "@/lib/profiles";

export interface AppUser {
  id: string; // auth.users.id
  name: string; // profiles.username
}

interface AuthState {
  user: AppUser | null;
  loading: boolean;
}

// Store de módulo: una sola suscripción a Supabase Auth compartida por todos los consumidores.
const SERVER_STATE: AuthState = { user: null, loading: true };
let state: AuthState = SERVER_STATE;
let started = false;
const listeners = new Set<() => void>();

function setState(next: AuthState) {
  state = next;
  listeners.forEach((l) => l());
}

// Usuario sin profile (OAuth que aún no eligió username) se trata como sin sesión.
async function load(userId: string | null) {
  if (!userId) return setState({ user: null, loading: false });
  try {
    const name = await fetchProfileUsername(userId);
    setState({ user: name ? { id: userId, name } : null, loading: false });
  } catch {
    setState({ user: null, loading: false });
  }
}

function start() {
  if (started) return;
  started = true;
  supabase.auth.onAuthStateChange((_event, session) => {
    // No hacer await de llamadas a supabase dentro del callback (puede bloquear auth).
    setTimeout(() => void load(session?.user.id ?? null), 0);
  });
}

function subscribe(cb: () => void) {
  start();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const getSnapshot = () => state;
const getServerSnapshot = () => SERVER_STATE;

export function useAuthState(): AuthState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useUser(): AppUser | null {
  return useAuthState().user;
}

// Vuelve a leer el profile (tras crear o renombrar el username).
export async function refreshUser() {
  const { data } = await supabase.auth.getSession();
  await load(data.session?.user.id ?? null);
}
