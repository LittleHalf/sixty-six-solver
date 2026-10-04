/**
 * Exhaustive perfect-information solver.
 *
 * Every line of play from the given position is searched (full minimax with a
 * transposition table). Values are always from Player 0's point of view:
 * Player 0 maximises, Player 1 minimises.
 *
 *   value = outcome * 1000 + (score0 - score1)
 *
 * where outcome is +1 (P0 wins the deal), -1 (P1 wins) or 0 (draw). The solver
 * therefore optimises the deal result first and, as a tie-break, the final
 * card-point margin.
 */
import { applyMove, isTerminal, legalMoves, moveKey, sameMove, stateKey, type GameState, type Move, type Player } from './game.ts';

export const OUTCOME_WEIGHT = 1000;

export interface MoveEval {
  move: Move;
  /** Solver value from Player 0's perspective. */
  value: number;
  /** Deal outcome from Player 0's perspective: +1 win, -1 loss, 0 draw. */
  outcome: -1 | 0 | 1;
  /** Final card-point margin score0 - score1 under best play. */
  pointDiff: number;
}

export interface Analysis {
  /** Player to move in the analysed position. */
  toMove: Player;
  /** Value of the position (P0 perspective) under optimal play. */
  value: number;
  outcome: -1 | 0 | 1;
  pointDiff: number;
  /** All legal moves, best for the mover first. */
  moves: MoveEval[];
  best: Move | null;
  /** Principal variation: the sequence of best moves from this position. */
  pv: Move[];
  /** Nodes visited by this call (excluding cache hits). */
  nodes: number;
}

interface Entry {
  value: number;
  best: Move | null;
}

export type SolverCache = Map<string, Entry>;

export function createCache(): SolverCache {
  return new Map();
}

export function terminalValue(state: GameState): number {
  const r = state.result;
  if (!r) throw new Error('Not terminal');
  const outcome = r.winner === null ? 0 : r.winner === 0 ? 1 : -1;
  return outcome * OUTCOME_WEIGHT + (state.scores[0] - state.scores[1]);
}

export function splitValue(value: number): { outcome: -1 | 0 | 1; pointDiff: number } {
  // |pointDiff| is bounded well inside 500, so rounding recovers the outcome.
  const outcome = Math.round(value / OUTCOME_WEIGHT) as -1 | 0 | 1;
  return { outcome, pointDiff: value - outcome * OUTCOME_WEIGHT };
}

/** Converts a P0-perspective value into the given player's perspective. */
export function fromPerspective(value: number, player: Player): number {
  return player === 0 ? value : -value;
}

function better(a: number, b: number, player: Player): boolean {
  return player === 0 ? a > b : a < b;
}

export function solveValue(state: GameState, cache: SolverCache, counter: { nodes: number }): Entry {
  if (isTerminal(state)) return { value: terminalValue(state), best: null };
  const key = stateKey(state);
  const hit = cache.get(key);
  if (hit) return hit;
  counter.nodes++;

  const player = state.toMove;
  let best: Entry = { value: player === 0 ? -Infinity : Infinity, best: null };
  for (const move of legalMoves(state)) {
    const child = solveValue(applyMove(state, move), cache, counter);
    if (best.best === null || better(child.value, best.value, player)) {
      best = { value: child.value, best: move };
    }
  }
  cache.set(key, best);
  return best;
}

export function principalVariation(state: GameState, cache: SolverCache, counter: { nodes: number }): Move[] {
  const pv: Move[] = [];
  let s = state;
  while (!isTerminal(s)) {
    const e = solveValue(s, cache, counter);
    if (!e.best) break;
    pv.push(e.best);
    s = applyMove(s, e.best);
  }
  return pv;
}

/**
 * Fully analyses a position: value, every legal move's value, and the
 * principal variation.
 */
export function solve(state: GameState, cache: SolverCache = createCache()): Analysis {
  const counter = { nodes: 0 };
  const player = state.toMove;

  if (isTerminal(state)) {
    const value = terminalValue(state);
    return { toMove: player, value, ...splitValue(value), moves: [], best: null, pv: [], nodes: 0 };
  }

  const moves: MoveEval[] = legalMoves(state).map((move) => {
    const child = solveValue(applyMove(state, move), cache, counter);
    return { move, value: child.value, ...splitValue(child.value) };
  });
  moves.sort((a, b) => (player === 0 ? b.value - a.value : a.value - b.value));

  const root = solveValue(state, cache, counter);
  const pv = principalVariation(state, cache, counter);

  return {
    toMove: player,
    value: root.value,
    ...splitValue(root.value),
    moves,
    best: root.best,
    pv,
    nodes: counter.nodes,
  };
}

/** Finds the evaluation of a particular move inside an analysis. */
export function evalOf(analysis: Analysis, move: Move): MoveEval | undefined {
  return analysis.moves.find((m) => sameMove(m.move, move));
}

export { moveKey };
