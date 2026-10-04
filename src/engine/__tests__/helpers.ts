import { ALL_CARDS, parseCards, type CardId } from '../cards.ts';
import { createGame, type GameState, type Setup } from '../game.ts';
import type { Rules } from '../rules.ts';

export interface Spec {
  p0: string;
  p1: string;
  up: string;
  down: string;
  inv0?: string;
  inv1?: string;
  leader?: 0 | 1;
  rules?: Partial<Rules>;
}

/**
 * Builds a game from card strings. Any cards not mentioned are dumped into
 * player 1's inventory, so small test positions always form a complete
 * 20-card partition.
 */
export function game(spec: Spec): GameState {
  const hands: [CardId[], CardId[]] = [parseCards(spec.p0), parseCards(spec.p1)];
  const faceUp = parseCards(spec.up)[0];
  const faceDown = parseCards(spec.down)[0];
  const inv0 = spec.inv0 ? parseCards(spec.inv0) : [];
  const inv1 = spec.inv1 ? parseCards(spec.inv1) : [];
  const used = new Set([...hands[0], ...hands[1], faceUp, faceDown, ...inv0, ...inv1]);
  const leftovers = ALL_CARDS.filter((c) => !used.has(c));
  const setup: Setup = {
    hands,
    faceUp,
    faceDown,
    inventory: [inv0, [...inv1, ...leftovers]],
    leader: spec.leader ?? 0,
    rules: spec.rules,
  };
  return createGame(setup);
}
