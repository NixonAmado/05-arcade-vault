"use client";

import { useMemo, useSyncExternalStore } from "react";

export interface StoredUser {
  name: string;
}

const KEY = "av_user";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener("av-user-change", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("av-user-change", cb);
  };
}

const getSnapshot = () => localStorage.getItem(KEY);
const getServerSnapshot = () => null;

export function useUser(): StoredUser | null {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => {
    try {
      return raw ? (JSON.parse(raw) as StoredUser) : null;
    } catch {
      return null;
    }
  }, [raw]);
}

export function setStoredUser(user: StoredUser | null) {
  if (user) localStorage.setItem(KEY, JSON.stringify(user));
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("av-user-change"));
}
