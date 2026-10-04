import { useCallback, useMemo, useState } from 'react';
import { applyMove, createGame, type GameState, type Move, type Setup } from '../engine/index.ts';

interface Timeline {
  states: GameState[];
  index: number;
}

function applyAll(states: GameState[], index: number, moves: Move[]): Timeline {
  const kept = states.slice(0, index + 1);
  let cur = kept[kept.length - 1];
  for (const m of moves) {
    if (cur.result) break;
    try {
      cur = applyMove(cur, m);
    } catch {
      break;
    }
    kept.push(cur);
  }
  return { states: kept, index: kept.length - 1 };
}

/** Game timeline with undo / redo / restart. `state` is null while in setup. */
export function useGame() {
  const [tl, setTl] = useState<Timeline | null>(null);

  const start = useCallback((setup: Setup) => {
    setTl({ states: [createGame(setup)], index: 0 });
  }, []);
  const stop = useCallback(() => setTl(null), []);
  const play = useCallback((move: Move) => {
    setTl((t) => (t ? applyAll(t.states, t.index, [move]) : t));
  }, []);
  const playMany = useCallback((moves: Move[]) => {
    setTl((t) => (t ? applyAll(t.states, t.index, moves) : t));
  }, []);
  const undo = useCallback(() => setTl((t) => (t && t.index > 0 ? { ...t, index: t.index - 1 } : t)), []);
  const redo = useCallback(
    () => setTl((t) => (t && t.index < t.states.length - 1 ? { ...t, index: t.index + 1 } : t)),
    [],
  );
  const restart = useCallback(() => setTl((t) => (t ? { states: [t.states[0]], index: 0 } : t)), []);

  const state = tl ? tl.states[tl.index] : null;
  const canUndo = !!tl && tl.index > 0;
  const canRedo = !!tl && tl.index < tl.states.length - 1;

  return useMemo(
    () => ({ state, start, stop, play, playMany, undo, redo, restart, canUndo, canRedo }),
    [state, start, stop, play, playMany, undo, redo, restart, canUndo, canRedo],
  );
}
