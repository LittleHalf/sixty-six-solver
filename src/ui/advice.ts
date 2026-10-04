import { analyzeWorlds, applyMove, solve, type GameState, type Move } from '../engine/index.ts';

/**
 * Best move for the player on move. With `omniscient` the perfect-information
 * solve is used; otherwise the move with the best expected outcome given only
 * what the mover can legitimately see.
 */
export function bestMove(state: GameState, omniscient: boolean): Move | null {
  if (state.result) return null;
  if (omniscient) return solve(state).best;
  const wa = analyzeWorlds(state, state.toMove);
  return wa.moves[0]?.move ?? null;
}

/** Plays `bestMove` repeatedly until the deal ends. */
export function bestLine(state: GameState, omniscient: boolean): Move[] {
  const moves: Move[] = [];
  let s = state;
  while (!s.result && moves.length < 32) {
    const m = bestMove(s, omniscient);
    if (!m) break;
    moves.push(m);
    s = applyMove(s, m);
  }
  return moves;
}
