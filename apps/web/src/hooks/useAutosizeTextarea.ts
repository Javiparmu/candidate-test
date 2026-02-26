import { RefObject, useEffect } from "react";

export function useAutosizeTextarea(
  ref: RefObject<HTMLTextAreaElement>,
  value: string,
  minHeight: number,
  maxHeight: number
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.style.height = 'auto';
    const newHeight = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight);
    el.style.height = `${newHeight}px`;
    el.style.overflowY = newHeight >= maxHeight ? 'auto' : 'hidden';
  }, [ref, value, minHeight, maxHeight]);
}
