/**
 * Card model for the 20-card Sixty-six deck (10, J, Q, K, A in four suits).
 *
 * Cards are plain integers 0..19 so that hands can be stored as 20-bit masks:
 *   id = suitIndex * 5 + rankIndex
 */

export const SUITS = ['C', 'D', 'H', 'S'] as const;
export type Suit = (typeof SUITS)[number];

export const SUIT_SYMBOL: Record<Suit, string> = { C: '♣', D: '♦', H: '♥', S: '♠' };
export const SUIT_NAME: Record<Suit, string> = { C: 'Clubs', D: 'Diamonds', H: 'Hearts', S: 'Spades' };

/** Ranks in ascending trick-taking strength: J < Q < K < 10 < A. */
export const RANKS = ['J', 'Q', 'K', '10', 'A'] as const;
export type Rank = (typeof RANKS)[number];

/** Card points: 10 = 10, J = 2, Q = 3, K = 4, A = 11. */
export const RANK_POINTS: Record<Rank, number> = { J: 2, Q: 3, K: 4, '10': 10, A: 11 };

export type CardId = number;

export const DECK_SIZE = 20;
export const ALL_CARDS: readonly CardId[] = Array.from({ length: DECK_SIZE }, (_, i) => i);
export const FULL_MASK = (1 << DECK_SIZE) - 1;
/** Sum of all card points in the deck (4 suits × 30). */
export const TOTAL_CARD_POINTS = 120;

export function cardId(suit: Suit, rank: Rank): CardId {
  return SUITS.indexOf(suit) * 5 + RANKS.indexOf(rank);
}

export function suitIndexOf(id: CardId): number {
  return (id / 5) | 0;
}

export function suitOf(id: CardId): Suit {
  return SUITS[suitIndexOf(id)];
}

export function rankOf(id: CardId): Rank {
  return RANKS[id % 5];
}

/** Trick-taking strength within a suit, 0 (Jack) .. 4 (Ace). */
export function strengthOf(id: CardId): number {
  return id % 5;
}

export function pointsOf(id: CardId): number {
  return RANK_POINTS[rankOf(id)];
}

export function isValidCard(id: unknown): id is CardId {
  return typeof id === 'number' && Number.isInteger(id) && id >= 0 && id < DECK_SIZE;
}

/** Human readable, e.g. "A♠" or "10♥". */
export function cardToString(id: CardId): string {
  return `${rankOf(id)}${SUIT_SYMBOL[suitOf(id)]}`;
}

/** ASCII code, e.g. "AS" or "10H". */
export function cardToCode(id: CardId): string {
  return `${rankOf(id)}${suitOf(id)}`;
}

/**
 * Parses "AS", "10H", "TH", "A♠", "a s", etc. Throws on malformed input.
 */
export function parseCard(text: string): CardId {
  const s = text.replace(/\s+/g, '').toUpperCase();
  const m = /^(10|T|J|Q|K|A)([CDHS♣♦♥♠])$/.exec(s);
  if (!m) throw new Error(`Cannot parse card "${text}"`);
  const rank: Rank = m[1] === 'T' ? '10' : (m[1] as Rank);
  const suitChar = m[2];
  const suit =
    (Object.keys(SUIT_SYMBOL) as Suit[]).find((k) => SUIT_SYMBOL[k] === suitChar) ?? (suitChar as Suit);
  return cardId(suit, rank);
}

export function parseCards(text: string): CardId[] {
  return text
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(parseCard);
}

// ---------------------------------------------------------------------------
// Bitmask helpers
// ---------------------------------------------------------------------------

export function bit(id: CardId): number {
  return 1 << id;
}

export function hasCard(mask: number, id: CardId): boolean {
  return (mask & (1 << id)) !== 0;
}

export function maskOf(cards: Iterable<CardId>): number {
  let m = 0;
  for (const c of cards) m |= 1 << c;
  return m;
}

export function cardsOf(mask: number): CardId[] {
  const out: CardId[] = [];
  for (let i = 0; i < DECK_SIZE; i++) if (mask & (1 << i)) out.push(i);
  return out;
}

export function popcount(mask: number): number {
  let n = 0;
  while (mask) {
    mask &= mask - 1;
    n++;
  }
  return n;
}

/** Mask of all five cards of a suit. */
export function suitMask(suit: Suit): number {
  return 0b11111 << (SUITS.indexOf(suit) * 5);
}

export function pointsOfMask(mask: number): number {
  let total = 0;
  for (const c of cardsOf(mask)) total += pointsOf(c);
  return total;
}

/** Sorts cards by suit then descending strength — handy for display. */
export function sortCards(cards: readonly CardId[]): CardId[] {
  return [...cards].sort((a, b) => suitIndexOf(a) - suitIndexOf(b) || strengthOf(b) - strengthOf(a));
}
