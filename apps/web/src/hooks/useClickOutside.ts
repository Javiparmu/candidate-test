import { RefObject, useEffect } from "react";

export function useClickOutside<T extends HTMLElement>(
  containerRef: RefObject<T>,
  active: boolean,
  onOutside: () => void
) {
  useEffect(() => {
    if (!active) return;

    const handle = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) onOutside();
    };

    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [active, containerRef, onOutside]);
}