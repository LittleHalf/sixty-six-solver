import { describe, expect, it } from 'vitest';
import { ALL_CARDS, cardToCode, parseCard } from '../cards.ts';
import { applyMove, createGame, isTerminal, legalMoves, type GameState, type Move, type Setup } from '../game.ts';
import { solve, terminalValue } from '../solver.ts';
import { analyzeWorlds, enumerateWorlds, unknownCards } from '../worlds.ts';
import { game } from './helpers.ts';

function shuffle<T>(a: readonly T[], seed: number): T[] {
  const arr = [...a];
  let s = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function randomSetup(seed: number): Setup {
  const d = shuffle(ALL_CARDS, seed);
  const split = (seed % 5) * 2; // even inventory split 0..8
  return {
    hands: [d.slice(0, 5), d.slice(5, 10)],
    faceUp: d[10],
    faceDown: d[11],
    inventory: [d.slice(12, 12 + split), d.slice(12 + split, 20)],
    leader: (seed % 2) as 0 | 1,
  };
}

function playOut(state: GameState, line: readonly Move[]): GameState {
  let s = state;
  for (const m of line) s = applyMove(s, m);
  return s;
}

describe('solver', () => {
  it('finds a forced win', () => {
    // P0 holds all five trumps and leads; P1 cannot win a trick.
    const g = game({ p0: 'AD 10D KD QD JD', p1: 'JS JC QS QC KS', up: 'AH', down: '10H', inv0: 'AS 10S AC 10C KC KH QH JH' });
    const a = solve(g);
    expect(a.outcome).toBe(1);
    expect(a.best).not.toBeNull();
    expect(a.moves[0].value).toBe(a.value);
    expect(a.moves.every((m) => m.value <= a.value)).toBe(true);
    expect(a.moves.every((m) => m.outcome === 1)).toBe(true);
  });

  it('principal variation reaches a terminal state with the predicted value', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const g = createGame(randomSetup(seed));
      const a = solve(g);
      const end = playOut(g, a.pv);
      expect(isTerminal(end)).toBe(true);
      expect(terminalValue(end)).toBe(a.value);
      expect(end.scores[0] - end.scores[1]).toBe(a.pointDiff);
      expect(end.result!.winner).toBe(a.outcome === 0 ? null : a.outcome === 1 ? 0 : 1);
    }
  });

  it('root value equals the best child value for the mover', () => {
    for (let seed = 30; seed <= 45; seed++) {
      const g = createGame(randomSetup(seed));
      const a = solve(g);
      const vals = a.moves.map((m) => m.value);
      expect(a.value).toBe(g.toMove === 0 ? Math.max(...vals) : Math.min(...vals));
      expect(a.moves).toHaveLength(legalMoves(g).length);
    }
  });

  it('is antisymmetric under swapping the players', () => {
    for (let seed = 50; seed <= 60; seed++) {
      const s = randomSetup(seed);
      const swapped: Setup = {
        ...s,
        hands: [s.hands[1], s.hands[0]],
        inventory: [s.inventory[1], s.inventory[0]],
        leader: s.leader === 0 ? 1 : 0,
      };
      expect(solve(createGame(swapped)).value).toBe(-solve(createGame(s)).value);
    }
  });

  it('child analysis after the best move agrees with the root', () => {
    const g = createGame(randomSetup(7));
    const a = solve(g);
    const next = applyMove(g, a.best!);
    expect(solve(next).value).toBe(a.value);
  });

  it('scores a draw as zero when the rules allow one', () => {
    const g = game({
      p0: 'JS', p1: 'JD', up: 'JH', down: 'JC',
      inv0: 'AS 10S KS QS AH 10H KH QH', inv1: 'AC 10C KC QC AD 10D KD QD',
      rules: { noWinner: 'draw' },
    });
    const a = solve(g);
    expect(a.outcome).toBe(0);
    expect(a.pointDiff).toBe(4);
  });
});

describe('worlds', () => {
  it('enumerates one world per unseen card, exactly one actual', () => {
    const g = createGame(randomSetup(3));
    const unknown = unknownCards(g, 0);
    expect(unknown).toHaveLength(6);
    const worlds = enumerateWorlds(g, 0);
    expect(worlds).toHaveLength(6);
    expect(worlds.filter((w) => w.isActual)).toHaveLength(1);
    for (const w of worlds) {
      expect(w.opponentHand).toHaveLength(5);
      expect([...w.opponentHand, w.faceDown].sort((a, b) => a - b)).toEqual([...unknown].sort((a, b) => a - b));
      expect(w.state.hands[0]).toBe(g.hands[0]);
      expect(w.state.faceUp).toBe(g.faceUp);
    }
    const actual = worlds.find((w) => w.isActual)!;
    expect(actual.state.hands[1]).toBe(g.hands[1]);
    expect(actual.faceDown).toBe(g.faceDown);
  });

  it('shrinks by one each time the opponent plays a card', () => {
    const g = createGame({ ...randomSetup(4), leader: 1 });
    expect(enumerateWorlds(g, 0)).toHaveLength(6);
    const s = applyMove(g, legalMoves(g)[0]); // P1 led
    expect(enumerateWorlds(s, 0)).toHaveLength(5);
    expect(enumerateWorlds(s, 1)).toHaveLength(6); // P1 still sees 5 P0 cards + face-down
    const a = solve(g);
    const end = playOut(g, a.pv);
    // At the end only the face-down card is unseen: one world, the actual one.
    expect(enumerateWorlds(end, 0)).toHaveLength(1);
    expect(enumerateWorlds(end, 0)[0].isActual).toBe(true);
  });

  it('aggregates per-move statistics from the perspective player', () => {
    const g = createGame({ ...randomSetup(8), leader: 1 });
    const w = analyzeWorlds(g, 1);
    expect(w.perspective).toBe(1);
    expect(w.moves).toHaveLength(legalMoves(g).length);
    for (const m of w.moves) {
      expect(m.perWorld).toHaveLength(6);
      expect(m.wins + m.draws + m.losses).toBe(6);
      expect(m.min).toBeLessThanOrEqual(m.mean);
      expect(m.mean).toBeLessThanOrEqual(m.max);
      expect(m.meanOutcome).toBeCloseTo((m.wins - m.losses) / 6);
    }
    for (let i = 1; i < w.moves.length; i++) expect(w.moves[i - 1].mean).toBeGreaterThanOrEqual(w.moves[i].mean);
    // actual world value matches the perfect-information solve (sign flipped for P1)
    expect(w.actualValue).toBe(-solve(g).value);
    expect(w.worlds.find((x) => x.isActual)!.analysis.value).toBe(solve(g).value);
  });

  it('reports world values but no move summaries when the perspective player is not on move', () => {
    const g = createGame({ ...randomSetup(9), leader: 0 });
    const w = analyzeWorlds(g, 1);
    const direct = solve(g);
    expect(w.actualValue).toBe(-direct.value);
    expect(w.worlds).toHaveLength(6);
    expect(w.moves).toEqual([]);
    expect(w.expectedValue).toBe(w.worlds.reduce((a, x) => a - x.analysis.value, 0) / 6);
  });

  it('the shared cache does not leak between worlds', () => {
    // Solving each world alone must agree with solving them through the shared cache.
    const g = createGame(randomSetup(11));
    const w = analyzeWorlds(g, 0);
    for (const world of w.worlds) {
      expect(solve(world.state).value).toBe(world.analysis.value);
    }
  });

  it('string formatting sanity', () => {
    expect(cardToCode(parseCard('10H'))).toBe('10H');
  });
});
