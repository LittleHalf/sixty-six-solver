/**
 * Setup draft model for the position editor: where each of the 20 cards is
 * placed, plus leader and rules. Also handles the URL-hash encoding used to
 * share positions.
 */
import {
  ALL_CARDS,
  DECK_SIZE,
  DEFAULT_RULES,
  sortCards,
  validateSetup,
  type CardId,
  type Player,
  type Rules,
  type Setup,
} from '../engine/index.ts';

export type Zone = 'h0' | 'h1' | 'up' | 'down' | 'i0' | 'i1';

export const ZONES: readonly Zone[] = ['h0', 'h1', 'up', 'down', 'i0', 'i1'];

export const ZONE_INFO: Record<Zone, { label: string; short: string; capacity: number; hint: string }> = {
  h0: { label: 'Player 0 hand', short: 'P0', capacity: 5, hint: '5 hidden cards' },
  h1: { label: 'Player 1 hand', short: 'P1', capacity: 5, hint: '5 hidden cards' },
  up: { label: 'Face-up trump', short: 'Up', capacity: 1, hint: 'sets the trump suit, out of play' },
  down: { label: 'Face-down card', short: 'Down', capacity: 1, hint: 'unknown to both, out of play' },
  i0: { label: 'Player 0 won cards', short: 'W0', capacity: 8, hint: 'already scored' },
  i1: { label: 'Player 1 won cards', short: 'W1', capacity: 8, hint: 'already scored' },
};

export interface SetupDraft {
  /** Zone of each card id, or null when still in the deck. */
  placement: (Zone | null)[];
  leader: Player;
  rules: Partial<Rules>;
}

export function emptyDraft(): SetupDraft {
  return {
    placement: Array.from({ length: DECK_SIZE }, () => null),
    leader: 0,
    rules: {},
  };
}

export function cardsIn(draft: SetupDraft, zone: Zone): CardId[] {
  return sortCards(ALL_CARDS.filter((c) => draft.placement[c] === zone));
}

export function zoneCount(draft: SetupDraft, zone: Zone): number {
  let n = 0;
  for (const z of draft.placement) if (z === zone) n++;
  return n;
}

/** Inventories share a pool of 8 cards, so each one's capacity depends on the other. */
export function zoneCapacity(draft: SetupDraft, zone: Zone): number {
  if (zone === 'i0') return 8 - zoneCount(draft, 'i1');
  if (zone === 'i1') return 8 - zoneCount(draft, 'i0');
  return ZONE_INFO[zone].capacity;
}

export function isZoneFull(draft: SetupDraft, zone: Zone): boolean {
  return zoneCount(draft, zone) >= zoneCapacity(draft, zone);
}

export function unplacedCards(draft: SetupDraft): CardId[] {
  return ALL_CARDS.filter((c) => draft.placement[c] === null);
}

export function placeCard(draft: SetupDraft, card: CardId, zone: Zone): SetupDraft {
  if (isZoneFull(draft, zone)) return draft;
  const placement = [...draft.placement];
  placement[card] = zone;
  return { ...draft, placement };
}

export function removeCard(draft: SetupDraft, card: CardId): SetupDraft {
  if (draft.placement[card] === null) return draft;
  const placement = [...draft.placement];
  placement[card] = null;
  return { ...draft, placement };
}

/** Next zone (in display order) that still has room; falls back to the given zone. */
export function nextZone(draft: SetupDraft, zone: Zone): Zone {
  const i = ZONES.indexOf(zone);
  for (let k = 1; k <= ZONES.length; k++) {
    const z = ZONES[(i + k) % ZONES.length];
    if (!isZoneFull(draft, z)) return z;
  }
  return zone;
}

export function clearCards(draft: SetupDraft): SetupDraft {
  return { ...draft, placement: emptyDraft().placement };
}

function shuffle<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Deals 5 / 5 / 1 / 1 and splits the remaining 8 cards between the inventories. */
export function randomDeal(draft: SetupDraft): SetupDraft {
  const deck = shuffle(ALL_CARDS);
  const placement: (Zone | null)[] = Array.from({ length: DECK_SIZE }, () => null);
  const split = 2 * Math.floor(Math.random() * 5); // 0, 2, 4, 6 or 8 cards for player 0 (tricks come in pairs)
  deck.forEach((card, i) => {
    if (i < 5) placement[card] = 'h0';
    else if (i < 10) placement[card] = 'h1';
    else if (i === 10) placement[card] = 'up';
    else if (i === 11) placement[card] = 'down';
    else if (i < 12 + split) placement[card] = 'i0';
    else placement[card] = 'i1';
  });
  return { ...draft, placement };
}

export function toSetup(draft: SetupDraft): Setup {
  const up = cardsIn(draft, 'up');
  const down = cardsIn(draft, 'down');
  return {
    hands: [cardsIn(draft, 'h0'), cardsIn(draft, 'h1')],
    faceUp: up[0] ?? -1,
    faceDown: down[0] ?? -1,
    inventory: [cardsIn(draft, 'i0'), cardsIn(draft, 'i1')],
    leader: draft.leader,
    rules: draft.rules,
  };
}

/** Validation messages for the current draft (engine errors plus friendlier hints). */
export function draftErrors(draft: SetupDraft): string[] {
  const errors: string[] = [];
  if (zoneCount(draft, 'up') === 0) errors.push('Place the face-up trump card.');
  if (zoneCount(draft, 'down') === 0) errors.push('Place the face-down card.');
  if (errors.length === 0) {
    errors.push(...validateSetup(toSetup(draft)));
  } else {
    const missing = unplacedCards(draft).length;
    if (missing) errors.push(`${missing} card${missing === 1 ? '' : 's'} still in the deck.`);
  }
  return errors;
}

// ---------------------------------------------------------------------------
// URL hash encoding
// ---------------------------------------------------------------------------

const ZONE_CODE = 'ABCDEF';

interface Encoded {
  p: string;
  l: number;
  r: Partial<Rules>;
}

export function encodeDraft(draft: SetupDraft): string {
  const obj: Encoded = {
    p: draft.placement.map((z) => (z === null ? '-' : ZONE_CODE[ZONES.indexOf(z)])).join(''),
    l: draft.leader,
    r: draft.rules,
  };
  return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeDraft(text: string): SetupDraft | null {
  try {
    const json = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    const obj = JSON.parse(json) as Partial<Encoded>;
    if (typeof obj.p !== 'string' || obj.p.length !== DECK_SIZE) return null;
    const placement: (Zone | null)[] = [];
    for (const ch of obj.p) {
      const idx = ZONE_CODE.indexOf(ch);
      placement.push(idx >= 0 ? ZONES[idx] : null);
    }
    const rules: Partial<Rules> = {};
    if (obj.r && typeof obj.r === 'object') {
      for (const [k, v] of Object.entries(obj.r)) {
        if (k in DEFAULT_RULES && typeof v === typeof DEFAULT_RULES[k as keyof Rules]) {
          (rules as Record<string, unknown>)[k] = v;
        }
      }
    }
    return { placement, leader: obj.l === 1 ? 1 : 0, rules };
  } catch {
    return null;
  }
}

export function draftFromHash(hash: string): SetupDraft | null {
  const m = /^#?p=(.+)$/.exec(hash);
  return m ? decodeDraft(m[1]) : null;
}

export function hashForDraft(draft: SetupDraft): string {
  return `#p=${encodeDraft(draft)}`;
}
