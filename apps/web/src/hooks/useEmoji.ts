import { SearchIndex } from "emoji-mart";
import { useCallback, useReducer } from "react";

import { useEffect } from "react";

interface EmojiData {
  id: string;
  name: string;
  native: string;
}

type EmojiMartSearchResult = {
  id: string;
  name: string;
  skins?: { native: string }[];
};

type ColonState = {
  query: string | null;
  matches: EmojiData[];
  selected: number;
};

type ColonAction =
  | { type: 'QUERY_CHANGED'; query: string | null }
  | { type: 'MATCHES_LOADED'; matches: EmojiData[] }
  | { type: 'MOVE_UP' }
  | { type: 'MOVE_DOWN' }
  | { type: 'CLOSE' }
  | { type: 'SET_SELECTED'; index: number };

const initialColonState: ColonState = { query: null, matches: [], selected: 0 };

function colonReducer(state: ColonState, action: ColonAction): ColonState {
  switch (action.type) {
    case 'QUERY_CHANGED': {
      if (action.query === null) return { query: null, matches: [], selected: 0 };
      return { ...state, query: action.query };
    }
    case 'MATCHES_LOADED': {
      const matches = action.matches;
      const selected = matches.length === 0 ? 0 : Math.min(state.selected, matches.length - 1);
      return { ...state, matches, selected };
    }
    case 'MOVE_DOWN': {
      if (state.matches.length === 0) return state;
      return { ...state, selected: (state.selected + 1) % state.matches.length };
    }
    case 'MOVE_UP': {
      if (state.matches.length === 0) return state;
      return { ...state, selected: (state.selected - 1 + state.matches.length) % state.matches.length };
    }
    case 'SET_SELECTED': {
      if (state.matches.length === 0) return state;
      const clamped = Math.max(0, Math.min(action.index, state.matches.length - 1));
      return { ...state, selected: clamped };
    }
    case 'CLOSE':
      return { query: null, matches: [], selected: 0 };
    default:
      return state;
  }
}

const COLON_MIN_QUERY_LENGTH = 2;
const COLON_MAX_RESULTS = 8;

function detectColonQuery(text: string, cursorPos: number): string | null {
  const before = text.slice(0, cursorPos);
  const match = before.match(/:([a-z0-9_+-]{1,})$/i);
  return match ? match[1] : null;
}

export function useEmoji() {
  const [state, dispatch] = useReducer(colonReducer, initialColonState);

  const close = useCallback(() => dispatch({ type: 'CLOSE' }), []);
  const moveUp = useCallback(() => dispatch({ type: 'MOVE_UP' }), []);
  const moveDown = useCallback(() => dispatch({ type: 'MOVE_DOWN' }), []);
  const setSelected = useCallback((index: number) => dispatch({ type: 'SET_SELECTED', index }), []);

  const updateFromText = useCallback((text: string, cursorPos: number) => {
    dispatch({ type: 'QUERY_CHANGED', query: detectColonQuery(text, cursorPos) });
  }, []);

  useEffect(() => {
    const q   = state.query;
    if (q === null || q.length < COLON_MIN_QUERY_LENGTH) {
      dispatch({ type: 'MATCHES_LOADED', matches: [] });
      return;
    }

    let cancelled = false;

    SearchIndex.search(q).then((results: unknown) => {
      if (cancelled) return;

      const list = Array.isArray(results) ? (results as EmojiMartSearchResult[]) : [];
      const mapped: EmojiData[] = list.slice(0, COLON_MAX_RESULTS).map((e) => ({
        id: e.id,
        name: e.name,
        native: e.skins?.[0]?.native ?? '',
      }));

      dispatch({ type: 'MATCHES_LOADED', matches: mapped });
    });

    return () => {
      cancelled = true;
    };
  }, [state.query]);

  const show = state.query !== null && state.matches.length > 0;

  return {
    query: state.query,
    matches: state.matches,
    selected: state.selected,
    show,
    updateFromText,
    close,
    moveUp,
    moveDown,
    setSelected,
  };
}