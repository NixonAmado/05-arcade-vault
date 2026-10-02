export interface TouchButton {
  id: string;
  label: string; // texto o símbolo: "←", "→", "↑", "FUEGO", "ROTAR"…
  code: string; // KeyboardEvent.code emulado (ej. "ArrowLeft", "Space")
  repeat?: boolean; // auto-repetición mientras se mantiene (solo Caída ← → ↓)
  repeatMs?: number; // default 110
}

export interface TouchLayout {
  left: TouchButton[]; // movimiento/giro
  right: TouchButton[]; // acciones
}

export const DEFAULT_REPEAT_MS = 110;

export const TOUCH_CONTROLS: Record<string, TouchLayout> = {
  asteroids: {
    left: [
      { id: "left", label: "←", code: "ArrowLeft" },
      { id: "right", label: "→", code: "ArrowRight" },
      { id: "thrust", label: "↑", code: "ArrowUp" },
    ],
    right: [{ id: "fire", label: "FUEGO", code: "Space" }],
  },
  caida: {
    left: [
      { id: "left", label: "←", code: "ArrowLeft", repeat: true },
      { id: "right", label: "→", code: "ArrowRight", repeat: true },
      { id: "down", label: "↓", code: "ArrowDown", repeat: true },
    ],
    right: [
      { id: "rotate", label: "ROTAR", code: "ArrowUp" },
      { id: "drop", label: "DROP", code: "Space" },
    ],
  },
  vibora: {
    left: [
      { id: "left", label: "←", code: "ArrowLeft" },
      { id: "right", label: "→", code: "ArrowRight" },
    ],
    right: [
      { id: "up", label: "↑", code: "ArrowUp" },
      { id: "down", label: "↓", code: "ArrowDown" },
    ],
  },
};
