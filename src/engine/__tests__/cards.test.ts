import { describe, expect, it } from 'vitest';
import {
  ALL_CARDS,
  TOTAL_CARD_POINTS,
  cardId,
  cardToCode,
  cardToString,
  cardsOf,
  maskOf,
  parseCard,
  pointsOf,
  popcount,
  rankOf,
  sortCards,
  strengthOf,
  suitMask,
  suitOf,
} from '../cards.ts';

describe('cards', () => {
  it('has 20 cards worth 120 points', () => {
    expect(ALL_CARDS.length).toBe(20);
    expect(ALL_CARDS.reduce((s, c) => s + pointsOf(c), 0)).toBe(TOTAL_CARD_POINTS);
  });

  it('maps ids to suit/rank and back', () => {
    for (const c of ALL_CARDS) {
      expect(cardId(suitOf(c), rankOf(c))).toBe(c);
      expect(parseCard(cardToCode(c))).toBe(c);
      expect(parseCard(cardToString(c))).toBe(c);
    }
  });

  it('scores ranks correctly', () => {
    expect(pointsOf(parseCard('10H'))).toBe(10);
    expect(pointsOf(parseCard('JH'))).toBe(2);
    expect(pointsOf(parseCard('QH'))).toBe(3);
    expect(pointsOf(parseCard('KH'))).toBe(4);
    expect(pointsOf(parseCard('AH'))).toBe(11);
  });

  it('orders strength A > 10 > K > Q > J', () => {
    const s = (t: string) => strengthOf(parseCard(t));
    expect(s('AS')).toBeGreaterThan(s('10S'));
    expect(s('10S')).toBeGreaterThan(s('KS'));
    expect(s('KS')).toBeGreaterThan(s('QS'));
    expect(s('QS')).toBeGreaterThan(s('JS'));
  });

  it('parses aliases', () => {
    expect(parseCard('TH')).toBe(parseCard('10♥'));
    expect(parseCard(' a s ')).toBe(cardId('S', 'A'));
    expect(() => parseCard('9H')).toThrow();
  });

  it('bitmask helpers round-trip', () => {
    const cards = [parseCard('AS'), parseCard('JC'), parseCard('10D')];
    const m = maskOf(cards);
    expect(popcount(m)).toBe(3);
    expect(cardsOf(m).sort((a, b) => a - b)).toEqual([...cards].sort((a, b) => a - b));
    expect(popcount(suitMask('H'))).toBe(5);
    expect(cardsOf(suitMask('H')).every((c) => suitOf(c) === 'H')).toBe(true);
  });

  it('sorts by suit then descending strength', () => {
    const sorted = sortCards([parseCard('JC'), parseCard('AC'), parseCard('10S')]).map(cardToCode);
    expect(sorted).toEqual(['AC', 'JC', '10S']);
  });
});
