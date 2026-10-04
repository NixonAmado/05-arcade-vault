"use client";

import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent } from "react";
import { vibrate } from "@/lib/haptics";
import {
  DEFAULT_REPEAT_MS,
  type TouchButton,
  type TouchLayout,
} from "@/lib/touch-controls";

const REPEAT_START_DELAY_MS = 300;

interface TouchControlsProps {
  layout: TouchLayout;
  onDown: (code: string) => void;
  onUp: (code: string) => void;
  disabled?: boolean;
}

export default function TouchControls({
  layout,
  onDown,
  onUp,
  disabled = false,
}: TouchControlsProps) {
  // id de botón → timer de auto-repetición (null si no repite)
  const activeRef = useRef<
    Map<string, { code: string; timer: ReturnType<typeof setInterval> | null }>
  >(new Map());
  const onDownRef = useRef(onDown);
  const onUpRef = useRef(onUp);
  useEffect(() => {
    onDownRef.current = onDown;
    onUpRef.current = onUp;
  });

  const release = useCallback((id: string) => {
    const entry = activeRef.current.get(id);
    if (!entry) return;
    if (entry.timer) {
      // clearTimeout y clearInterval comparten pool de ids
      clearTimeout(entry.timer);
      clearInterval(entry.timer);
    }
    activeRef.current.delete(id);
    onUpRef.current(entry.code);
  }, []);

  const releaseAll = useCallback(() => {
    for (const id of Array.from(activeRef.current.keys())) release(id);
  }, [release]);

  const press = useCallback(
    (btn: TouchButton) => {
      if (activeRef.current.has(btn.id)) return;
      vibrate(10);
      onDownRef.current(btn.code);
      const entry: {
        code: string;
        timer: ReturnType<typeof setInterval> | null;
      } = { code: btn.code, timer: null };
      activeRef.current.set(btn.id, entry);
      if (btn.repeat) {
        // Un toque simple = 1 acción: la repetición arranca solo tras mantener el dedo.
        const delay = setTimeout(() => {
          entry.timer = setInterval(
            () => onDownRef.current(btn.code),
            btn.repeatMs ?? DEFAULT_REPEAT_MS
          );
        }, REPEAT_START_DELAY_MS);
        entry.timer = delay as unknown as ReturnType<typeof setInterval>;
      }
    },
    []
  );

  // Liberar todo al pausar/terminar, perder foco/visibilidad y desmontar.
  useEffect(() => {
    if (disabled) releaseAll();
  }, [disabled, releaseAll]);

  useEffect(() => {
    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", releaseAll);
    return () => {
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", releaseAll);
      releaseAll();
    };
  }, [releaseAll]);

  const renderButton = (btn: TouchButton) => (
    <button
      key={btn.id}
      type="button"
      className="touch-btn"
      aria-label={btn.label}
      disabled={disabled}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e: PointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        press(btn);
      }}
      onPointerUp={() => release(btn.id)}
      onPointerCancel={() => release(btn.id)}
      onPointerLeave={() => release(btn.id)}
      onLostPointerCapture={() => release(btn.id)}
    >
      {btn.label}
    </button>
  );

  return (
    <div className="touch-controls">
      <div className="touch-group touch-group-left">
        {layout.left.map(renderButton)}
      </div>
      <div className="touch-group touch-group-right">
        {layout.right.map(renderButton)}
      </div>
    </div>
  );
}
