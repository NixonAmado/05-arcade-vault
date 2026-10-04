import { useCallback, useEffect, useState, type RefObject } from "react";

// Pantalla completa real (Fullscreen API) con fallback CSS (`cssFallback`) donde no existe
// (iPhone). Atajo: tecla F. En el fallback, Escape también sale.
export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [nativeFs, setNativeFs] = useState(false);
  const [cssFs, setCssFs] = useState(false);

  useEffect(() => {
    const onChange = () => setNativeFs(document.fullscreenElement === ref.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [ref]);

  const toggle = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    if (cssFs) {
      setCssFs(false);
      return;
    }
    if (typeof el.requestFullscreen === "function") {
      el.requestFullscreen().catch(() => setCssFs(true));
    } else {
      setCssFs(true);
    }
  }, [ref, cssFs]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === "KeyF" && !e.repeat) toggle();
      else if (e.code === "Escape" && cssFs) setCssFs(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, cssFs]);

  return { isFullscreen: nativeFs || cssFs, cssFallback: cssFs, toggle };
}
