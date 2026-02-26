import { useCallback, useRef } from "react";

export function useMessageHistory(limit: number) {
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const draftRef = useRef('');

  const push = useCallback(
    (message: string) => {
      const trimmed = message.trim();
      if (!trimmed) return;

      const history = historyRef.current;
      if (history[history.length - 1] !== trimmed) {
        history.push(trimmed);
        if (history.length > limit) history.shift();
      }
      historyIndexRef.current = -1;
      draftRef.current = '';
    },
    [limit]
  );

  const resetNavigation = useCallback(() => {
    historyIndexRef.current = -1;
  }, []);

  const navigate = useCallback((direction: 'up' | 'down', currentValue: string) => {
    const history = historyRef.current;
    if (history.length === 0) return null;

    const currentIndex = historyIndexRef.current;

    if (direction === 'up') {
      if (currentIndex === -1) {
        draftRef.current = currentValue;
        historyIndexRef.current = history.length - 1;
      } else if (currentIndex > 0) {
        historyIndexRef.current = currentIndex - 1;
      } else {
        return null;
      }
      return history[historyIndexRef.current];
    }

    if (currentIndex === -1) return null;

    if (currentIndex < history.length - 1) {
      historyIndexRef.current = currentIndex + 1;
      return history[historyIndexRef.current];
    }

    historyIndexRef.current = -1;
    return draftRef.current;
  }, []);

  return { push, navigate, resetNavigation };
}