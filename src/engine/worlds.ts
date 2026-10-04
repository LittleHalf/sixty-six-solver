/**
 * Hidden-information analysis.
 *
 * A player sees their own hand, the trump indicator, every card already won and
 * every card played so far. What they cannot see is the opponent's remaining
 * hand and the face-down card — and since the face-down card is never played,
 * the only real uncertainty is *which* of those unseen cards is the dead one.
 *
 * This module enumerates every possible world (one per candidate face-down
 * card), solves each one exhaustively, and aggregates the results per move.
 * This is the expectiminimax step: each world is weighted equally. The number
 * of worlds shrinks by one each time the opponent plays a card.
 */
import { cardsOf, maskOf, type CardId } from './cards.ts';
import { legalMoves, moveKey, other, type GameState, type Move, type Player } from './game.ts';
import { createCache, fromPerspective, solve, splitValue, type Analysis, type MoveEval, type SolverCache } from './solver.ts';

export interface World {
  /** The card assumed to be face down in this world. */
  faceDown: CardId;
  /** Opponent's hand in this world. */
  opponentHand: CardId[];
  state: GameState;
  /** True if this world matches the real (fully specified) state. */
  isActual: boolean;
}

export interface WorldAnalysis extends World {
  analysis: Analysis;
}

export interface MoveSummary {
  move: Move;
  key: string;
  /** Mean solver value, from the perspective player's point of view. */
  mean: number;
  min: number;
  max: number;
  /** Mean outcome (+1 win, 0 draw, -1 loss) from the perspective player's point of view. */
  meanOutcome: number;
  /** Mean final card-point margin from the perspective player's point of view. */
  meanPointDiff: number;
  wins: number;
  draws: number;
  losses: number;
  /** One entry per world (same order as `worlds`), perspective-adjusted. */
  perWorld: { faceDown: CardId; value: number; outcome: -1 | 0 | 1; pointDiff: number }[];
}

export interface WorldsAnalysis {
  perspective: Player;
  /** Cards the perspective player cannot see. */
  unknown: CardId[];
  worlds: WorldAnalysis[];
  /**
   * Legal moves of the perspective player, best mean value first. Empty when
   * the perspective player is not on move (the mover's hand then differs per world).
   */
  moves: MoveSummary[];
  /** Value of the actual world (perspective-adjusted). */
  actualValue: number;
  /** Expected value across worlds under per-world optimal play (perspective-adjusted). */
  expectedValue: number;
  totalNodes: number;
}

/** Cards the perspective player cannot see: opponent's remaining hand plus the face-down card. */
export function unknownCards(state: GameState, perspective: Player): CardId[] {
  return cardsOf(state.hands[other(perspective)] | (1 << state.faceDown));
}

/**
 * Every layout consistent with what the perspective player can see: one world
 * per unseen card, assuming that card is the face-down one and the opponent
 * holds the rest.
 */
export function enumerateWorlds(state: GameState, perspective: Player): World[] {
  const opp = other(perspective);
  const unknown = unknownCards(state, perspective);
  return unknown.map((fd) => {
    const oppHand = unknown.filter((c) => c !== fd);
    const hands: [number, number] = [state.hands[0], state.hands[1]];
    hands[opp] = maskOf(oppHand);
    const world: GameState = { ...state, hands, faceDown: fd };
    return { faceDown: fd, opponentHand: oppHand, state: world, isActual: fd === state.faceDown };
  });
}

export function analyzeWorlds(
  state: GameState,
  perspective: Player,
  cache: SolverCache = createCache(),
): WorldsAnalysis {
  const worlds = enumerateWorlds(state, perspective).map<WorldAnalysis>((w) => ({
    ...w,
    analysis: solve(w.state, cache),
  }));

  const sign = (v: number) => fromPerspective(v, perspective);
  // Per-move aggregation is only meaningful when the perspective player is on
  // move: in every world they hold the same hand, so the same moves are legal.
  const onMove = state.toMove === perspective;
  const moves: MoveSummary[] = (onMove ? legalMoves(state) : []).map((move) => {
    const key = moveKey(move);
    const perWorld = worlds.map((w) => {
      const ev: MoveEval | undefined = w.analysis.moves.find((m) => moveKey(m.move) === key);
      if (!ev) throw new Error(`Move ${key} not legal in some world`);
      const value = sign(ev.value);
      const { outcome, pointDiff } = splitValue(value);
      return { faceDown: w.faceDown, value, outcome, pointDiff };
    });
    const values = perWorld.map((p) => p.value);
    const n = values.length;
    return {
      move,
      key,
      mean: values.reduce((a, b) => a + b, 0) / n,
      min: Math.min(...values),
      max: Math.max(...values),
      meanOutcome: perWorld.reduce((a, p) => a + p.outcome, 0) / n,
      meanPointDiff: perWorld.reduce((a, p) => a + p.pointDiff, 0) / n,
      wins: perWorld.filter((p) => p.outcome > 0).length,
      draws: perWorld.filter((p) => p.outcome === 0).length,
      losses: perWorld.filter((p) => p.outcome < 0).length,
      perWorld,
    };
  });
  moves.sort((a, b) => b.mean - a.mean);

  const actual = worlds.find((w) => w.isActual)!;
  return {
    perspective,
    unknown: unknownCards(state, perspective),
    worlds,
    moves,
    actualValue: sign(actual.analysis.value),
    expectedValue: worlds.reduce((a, w) => a + sign(w.analysis.value), 0) / worlds.length,
    totalNodes: worlds.reduce((a, w) => a + w.analysis.nodes, 0),
  };
}
