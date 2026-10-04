/**
 * Game state machine for the Sixty-six endgame.
 *
 * Position shape being modelled (5 / 5 / 1 / 1 / 8):
 *   - each player holds 5 hidden cards
 *   - one face-up card decides the trump suit; it is never played
 *   - one face-down card is unknown to both players and never played
 *   - the remaining 8 cards have already been won in tricks ("inventories") and
 *     count as card points for their owner
 *
 * The five tricks are played with strict rules from the start (follow suit,
 * head the trick if able — see `Rules`). The deal ends as soon as a player
 * reaches `winThreshold` points; if nobody does, the winner of the last trick
 * takes the deal (or it is a draw, depending on `noWinner`).
 */
import {
  ALL_CARDS,
  DECK_SIZE,
  FULL_MASK,
  bit,
  cardToString,
  cardsOf,
  hasCard,
  maskOf,
  pointsOf,
  popcount,
  strengthOf,
  suitMask,
  suitOf,
  type CardId,
  type Suit,
} from './cards.ts';
import { withRules, type Rules } from './rules.ts';

export type Player = 0 | 1;

export function other(p: Player): Player {
  return p === 0 ? 1 : 0;
}

/** A move is simply the card played. */
export interface Move {
  card: CardId;
}

export interface TrickRecord {
  leader: Player;
  /** [card led, card followed] */
  cards: [CardId, CardId];
  winner: Player;
  /** Card points in the trick. */
  points: number;
}

export type EndReason = 'threshold' | 'lastTrick' | 'draw';

export interface GameResult {
  winner: Player | null;
  reason: EndReason;
}

export interface GameState {
  rules: Rules;
  trumpSuit: Suit;
  /** Bitmask of each player's hand. */
  hands: readonly [number, number];
  /** Face-up trump indicator. Out of play. */
  faceUp: CardId;
  /** Face-down card unknown to both players. Out of play. */
  faceDown: CardId;
  /** Card points (inventories + tricks won). */
  scores: readonly [number, number];
  /** Tricks won so far (including before the endgame). */
  tricks: readonly [number, number];
  /** Who leads the current trick. */
  leader: Player;
  toMove: Player;
  /** Card currently on the table, if the leader has played. */
  led: CardId | null;
  history: readonly TrickRecord[];
  result: GameResult | null;
}

export interface Setup {
  /** 5 cards each (any equal size 1..5 is accepted). */
  hands: [CardId[], CardId[]];
  faceUp: CardId;
  faceDown: CardId;
  /** Cards already won by each player; they count as points. */
  inventory: [CardId[], CardId[]];
  leader: Player;
  rules?: Partial<Rules>;
}

// ---------------------------------------------------------------------------
// Setup & validation
// ---------------------------------------------------------------------------

export function validateSetup(setup: Setup): string[] {
  const errors: string[] = [];
  const all: CardId[] = [
    ...setup.hands[0],
    ...setup.hands[1],
    setup.faceUp,
    setup.faceDown,
    ...setup.inventory[0],
    ...setup.inventory[1],
  ];
  for (const c of all) {
    if (!Number.isInteger(c) || c < 0 || c >= DECK_SIZE) errors.push(`Invalid card id ${c}`);
  }
  const seen = new Set<CardId>();
  for (const c of all) {
    if (seen.has(c)) errors.push(`Card ${cardToString(c)} appears more than once`);
    seen.add(c);
  }
  if (all.length !== DECK_SIZE) errors.push(`Expected all ${DECK_SIZE} cards to be placed, got ${all.length}`);
  if (setup.hands[0].length !== setup.hands[1].length) errors.push('Both hands must have the same number of cards');
  if (setup.hands[0].length < 1 || setup.hands[0].length > 5) errors.push('Hands must hold 1 to 5 cards');
  if (setup.leader !== 0 && setup.leader !== 1) errors.push('Leader must be player 0 or 1');
  return errors;
}

export function createGame(setup: Setup): GameState {
  const errors = validateSetup(setup);
  if (errors.length) throw new Error(`Invalid setup: ${errors.join('; ')}`);
  return {
    rules: withRules(setup.rules),
    trumpSuit: suitOf(setup.faceUp),
    hands: [maskOf(setup.hands[0]), maskOf(setup.hands[1])],
    faceUp: setup.faceUp,
    faceDown: setup.faceDown,
    scores: [sumPoints(setup.inventory[0]), sumPoints(setup.inventory[1])],
    tricks: [Math.ceil(setup.inventory[0].length / 2), Math.ceil(setup.inventory[1].length / 2)],
    leader: setup.leader,
    toMove: setup.leader,
    led: null,
    history: [],
    result: null,
  };
}

function sumPoints(cards: readonly CardId[]): number {
  let t = 0;
  for (const c of cards) t += pointsOf(c);
  return t;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function isTerminal(state: GameState): boolean {
  return state.result !== null;
}

/** Does `challenger` beat `led` when `led` was played first? */
export function beats(challenger: CardId, led: CardId, trumpSuit: Suit): boolean {
  const cs = suitOf(challenger);
  const ls = suitOf(led);
  if (cs === ls) return strengthOf(challenger) > strengthOf(led);
  return cs === trumpSuit;
}

/** Cards the player to move may legally play. */
export function playableCards(state: GameState): CardId[] {
  if (state.result) return [];
  const hand = state.hands[state.toMove];
  if (state.led === null) return cardsOf(hand);

  const rules = state.rules;
  const ledSuit = suitOf(state.led);
  const sameSuit = hand & suitMask(ledSuit);
  if (sameSuit && rules.mustFollowSuit) {
    if (rules.mustHead) {
      const ledStrength = strengthOf(state.led);
      const higher = cardsOf(sameSuit).filter((c) => strengthOf(c) > ledStrength);
      if (higher.length) return higher;
    }
    return cardsOf(sameSuit);
  }
  if (!sameSuit && rules.mustTrumpWhenVoid) {
    const trumps = hand & suitMask(state.trumpSuit);
    if (trumps) return cardsOf(trumps);
  }
  return cardsOf(hand);
}

export function legalMoves(state: GameState): Move[] {
  return playableCards(state).map((card) => ({ card }));
}

export function isLegal(state: GameState, move: Move): boolean {
  return hasCard(state.hands[state.toMove], move.card) && playableCards(state).includes(move.card);
}

export function sameMove(a: Move, b: Move): boolean {
  return a.card === b.card;
}

export function moveToString(move: Move): string {
  return cardToString(move.card);
}

export function moveKey(move: Move): string {
  return String(move.card);
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

export function applyMove(state: GameState, move: Move): GameState {
  if (state.result) throw new Error('Game is over');
  if (!isLegal(state, move)) throw new Error(`Illegal move ${moveToString(move)}`);
  return state.led === null ? lead(state, move) : follow(state, move);
}

function lead(state: GameState, move: Move): GameState {
  const p = state.toMove;
  const hands: [number, number] = [state.hands[0], state.hands[1]];
  hands[p] &= ~bit(move.card);
  return { ...state, hands, led: move.card, toMove: other(p) };
}

function follow(state: GameState, move: Move): GameState {
  const led = state.led as CardId;
  const leader = state.leader;
  const follower = other(leader);
  const rules = state.rules;

  const hands: [number, number] = [state.hands[0], state.hands[1]];
  hands[follower] &= ~bit(move.card);

  const winner: Player = beats(move.card, led, state.trumpSuit) ? follower : leader;
  const trickPoints = pointsOf(led) + pointsOf(move.card);

  const scores: [number, number] = [state.scores[0], state.scores[1]];
  const tricks: [number, number] = [state.tricks[0], state.tricks[1]];
  scores[winner] += trickPoints;
  tricks[winner] += 1;

  const history: TrickRecord[] = [...state.history, { leader, cards: [led, move.card], winner, points: trickPoints }];

  const lastTrick = hands[0] === 0 && hands[1] === 0;
  let result: GameResult | null = null;
  if (scores[winner] >= rules.winThreshold) {
    result = { winner, reason: 'threshold' };
  } else if (lastTrick) {
    result = rules.noWinner === 'lastTrick' ? { winner, reason: 'lastTrick' } : { winner: null, reason: 'draw' };
  }

  return {
    ...state,
    hands,
    scores,
    tricks,
    leader: winner,
    toMove: winner,
    led: null,
    history,
    result,
  };
}

// ---------------------------------------------------------------------------
// Convenience
// ---------------------------------------------------------------------------

export function handCards(state: GameState, player: Player): CardId[] {
  return cardsOf(state.hands[player]);
}

/** Cards already played or in inventories (not in a hand, not on the table, not the two stock cards). */
export function goneCards(state: GameState): CardId[] {
  const inPlay =
    state.hands[0] | state.hands[1] | bit(state.faceUp) | bit(state.faceDown) | (state.led !== null ? bit(state.led) : 0);
  return cardsOf(FULL_MASK & ~inPlay);
}

export function cardsRemaining(state: GameState): number {
  return popcount(state.hands[0]) + popcount(state.hands[1]);
}

/** Total card points still to be won from the hands (and the table). */
export function pointsInPlay(state: GameState): number {
  let t = 0;
  for (const c of cardsOf(state.hands[0] | state.hands[1])) t += pointsOf(c);
  if (state.led !== null) t += pointsOf(state.led);
  return t;
}

/**
 * Compact, deterministic string identifying the position (used as a cache key).
 * The two out-of-play cards are omitted on purpose: the future of the deal
 * depends only on the hands, the scores, the trump suit and whose turn it is,
 * so worlds that differ only in the face-down card can share cache entries.
 */
export function stateKey(state: GameState): string {
  return [
    state.hands[0],
    state.hands[1],
    state.scores[0],
    state.scores[1],
    state.trumpSuit,
    state.leader,
    state.toMove,
    state.led ?? -1,
  ].join(',');
}

export function describeState(state: GameState): string {
  const lines = [
    `Trump: ${state.trumpSuit} (${cardToString(state.faceUp)} face up, ${cardToString(state.faceDown)} face down)`,
    `P0 (${state.scores[0]} pts, ${state.tricks[0]} tricks): ${handCards(state, 0).map(cardToString).join(' ')}`,
    `P1 (${state.scores[1]} pts, ${state.tricks[1]} tricks): ${handCards(state, 1).map(cardToString).join(' ')}`,
    `Leader: P${state.leader}, to move: P${state.toMove}${state.led !== null ? `, on table: ${cardToString(state.led)}` : ''}`,
  ];
  if (state.result) {
    lines.push(`Result: ${state.result.winner === null ? 'draw' : `P${state.result.winner} wins`} (${state.result.reason})`);
  }
  return lines.join('\n');
}

export { ALL_CARDS };
