import { describe, expect, it } from 'vitest';
import { cardToCode, parseCard, parseCards } from '../cards.ts';
import { applyMove, beats, createGame, legalMoves, playableCards, pointsInPlay, validateSetup, type Move, type Setup } from '../game.ts';
import { game } from './helpers.ts';

const play = (card: string): Move => ({ card: parseCard(card) });
const codes = (cards: number[]) => cards.map(cardToCode).sort();

describe('setup', () => {
  it('derives scores and tricks from inventories; stock cards are out of play', () => {
    const g = game({ p0: 'AS 10S KS QS JS', p1: 'AH 10H KH QH JH', up: 'AD', down: '10D', inv0: 'KD QD', inv1: 'JD AC 10C KC QC JC' });
    expect(g.trumpSuit).toBe('D');
    expect(g.scores).toEqual([7, 32]);
    expect(g.tricks).toEqual([1, 3]);
    expect(g.leader).toBe(0);
    expect(g.toMove).toBe(0);
    expect(pointsInPlay(g)).toBe(60);
    expect(g.scores[0] + g.scores[1] + pointsInPlay(g) + 11 + 10).toBe(120);
  });

  it('rejects incomplete or duplicated layouts', () => {
    const setup: Setup = {
      hands: [parseCards('AS 10S KS QS JS'), parseCards('AH 10H KH QH JH')],
      faceUp: parseCard('AD'),
      faceDown: parseCard('AD'),
      inventory: [[], parseCards('KD QD JD AC 10C KC QC JC')],
      leader: 0,
    };
    const errors = validateSetup(setup);
    expect(errors.some((e) => e.includes('more than once'))).toBe(true);
    expect(() => createGame(setup)).toThrow();
    setup.faceDown = parseCard('10D');
    expect(validateSetup(setup)).toEqual([]);
  });
});

describe('trick resolution', () => {
  it('beats() follows suit strength and trumps', () => {
    const p = parseCard;
    expect(beats(p('AS'), p('10S'), 'H')).toBe(true);
    expect(beats(p('JS'), p('10S'), 'H')).toBe(false);
    expect(beats(p('AC'), p('JS'), 'H')).toBe(false); // off-suit, not trump
    expect(beats(p('JH'), p('AS'), 'H')).toBe(true); // trump beats anything
    expect(beats(p('JH'), p('QH'), 'H')).toBe(false); // trump vs trump by strength
  });

  it('awards points to the winner, who leads next; nothing is drawn', () => {
    const g = game({ p0: 'AS 10S KS QS JS', p1: 'AH 10H KH QH JH', up: 'AD', down: '10D', inv0: 'KD QD JD AC', inv1: '10C KC QC JC' });
    let s = applyMove(g, play('JS'));
    expect(s.led).toBe(parseCard('JS'));
    expect(s.toMove).toBe(1);
    s = applyMove(s, play('JH')); // void in spades, no obligation to trump: leader wins
    expect(s.scores[0] - g.scores[0]).toBe(4);
    expect(s.tricks[0]).toBe(3);
    expect(s.leader).toBe(0);
    expect(s.faceUp).toBe(parseCard('AD'));
    expect(s.faceDown).toBe(parseCard('10D'));
    expect(codes(playableCards(s))).toEqual(codes(parseCards('AS 10S KS QS')));
    expect(s.history).toEqual([{ leader: 0, cards: [parseCard('JS'), parseCard('JH')], winner: 0, points: 4 }]);
  });

  it('lets the follower win with a trump and take the lead', () => {
    const g = game({ p0: 'AS 10S KS QS JS', p1: 'AH 10H KH QH JD', up: 'AD', down: '10D', inv0: 'KD QD AC 10C', inv1: 'KC QC JC JH' });
    const s = applyMove(applyMove(g, play('AS')), play('JD'));
    expect(s.leader).toBe(1);
    expect(s.toMove).toBe(1);
    expect(s.scores[1] - g.scores[1]).toBe(13);
  });
});

describe('legal plays', () => {
  const base = { up: 'AD', down: '10D', inv0: 'AC 10C KC QC', inv1: 'JC JD KD QD' };

  it('leader may play anything', () => {
    const g = game({ ...base, p0: 'AS 10S KS QS JS', p1: 'AH 10H KH QH JH' });
    expect(codes(playableCards(g))).toEqual(codes(parseCards('AS 10S KS QS JS')));
  });

  it('must beat the led card with the led suit when able', () => {
    const g = game({ ...base, p0: 'KS QS JS 10H JH', p1: 'AS 10S KH QH AH' });
    const s = applyMove(g, play('KS'));
    expect(codes(playableCards(s))).toEqual(['10S', 'AS']);
  });

  it('must follow suit with a lower card when unable to beat', () => {
    const g = game({ ...base, p0: 'AS 10S KS QS JH', p1: 'JS AH 10H KH QH' });
    const s = applyMove(g, play('QS'));
    expect(codes(playableCards(s))).toEqual(['JS']);
  });

  it('may play anything when void, including a trump or a discard', () => {
    const g = game({ ...base, p0: 'AS 10S KS QS JS', p1: 'AH 10H KH QH JH' });
    const s = applyMove(g, play('AS'));
    expect(codes(playableCards(s))).toEqual(codes(parseCards('AH 10H KH QH JH')));
    const g2 = game({ p0: 'AS 10S KS QS JS', p1: 'AH 10H KD QD JH', up: 'AD', down: '10D', inv0: 'AC 10C KC QC', inv1: 'JC JD KH QH' });
    const s2 = applyMove(g2, play('AS'));
    expect(codes(playableCards(s2))).toEqual(codes(parseCards('AH 10H KD QD JH')));
  });

  it('trump led: must follow with a higher trump if able', () => {
    const g = game({ p0: 'KD QS JS 10H JH', p1: 'AS AD 10D KH QH', up: 'JD', down: 'QD', inv0: 'AC 10C KC QC', inv1: 'JC AH 10S KS' });
    expect(g.trumpSuit).toBe('D');
    const s = applyMove(g, play('KD'));
    expect(codes(playableCards(s))).toEqual(['10D', 'AD']);
  });

  it('honours the optional follow-suit switches', () => {
    const g = game({ ...base, p0: 'KS QS JS 10H JH', p1: 'AS 10S KH QH AH', rules: { mustHead: false } });
    expect(codes(playableCards(applyMove(g, play('KS'))))).toEqual(['10S', 'AS']); // KS beaten by 10S? no: must still follow suit
    const g2 = game({ ...base, p0: 'KS QS JS 10H JH', p1: 'AS 10S KH QH AH', rules: { mustHead: false, mustFollowSuit: false } });
    expect(playableCards(applyMove(g2, play('KS')))).toHaveLength(5);
    const g3 = game({ p0: 'AS 10S KS QS JS', p1: 'AH 10H KD QD JH', up: 'AD', down: '10D', inv0: 'AC 10C KC QC', inv1: 'JC JD KH QH', rules: { mustTrumpWhenVoid: true } });
    expect(codes(playableCards(applyMove(g3, play('AS'))))).toEqual(['KD', 'QD']);
  });

  it('rejects illegal moves and moves after the end', () => {
    const g = game({ ...base, p0: 'KS QS JS 10H JH', p1: 'AS 10S KH QH AH' });
    expect(() => applyMove(g, play('AS'))).toThrow(); // not in hand
    const s = applyMove(g, play('KS'));
    expect(() => applyMove(s, play('KH'))).toThrow(); // must follow suit
  });
});

describe('end of deal', () => {
  it('ends as soon as a player reaches 66', () => {
    // P0: 53 in inventory. Trick AS + KH = 15 -> 68.
    const g = game({ p0: 'AS 10S KS QS JS', p1: 'KH QH JH JC JD', up: 'AD', down: '10D', inv0: 'AH 10H AC 10C KC QC KD', inv1: 'QD' });
    expect(g.scores).toEqual([53, 3]);
    const s = applyMove(applyMove(g, play('AS')), play('KH'));
    expect(s.result).toEqual({ winner: 0, reason: 'threshold' });
    expect(legalMoves(s)).toEqual([]);
    expect(() => applyMove(s, play('10S'))).toThrow();
  });

  it('does not end at 65', () => {
    // inv0 = 51; AS + QH = 14 -> 65.
    const g = game({ p0: 'AS 10S KS QS JS', p1: 'KH QH JH JD QD', up: 'AD', down: '10D', inv0: 'AH 10H AC 10C KC QC JC', inv1: 'KD' });
    const s = applyMove(applyMove(g, play('AS')), play('QH'));
    expect(g.scores[0]).toBe(51);
    expect(s.scores[0]).toBe(65);
    expect(s.result).toBeNull();
  });

  it('last trick decides when nobody reaches 66; no bonus points', () => {
    // Stock cards are out of play; 1 card each. P0 56, P1 56 -> no one can reach 66.
    const g = game({ p0: 'JS', p1: 'JD', up: 'JH', down: 'JC', inv0: 'AS 10S KS QS AH 10H KH QH', inv1: 'AC 10C KC QC AD 10D KD QD' });
    expect(g.trumpSuit).toBe('H');
    expect(g.scores).toEqual([56, 56]);
    const s = applyMove(applyMove(g, play('JS')), play('JD')); // JD is not a trump -> P0 wins the last trick
    expect(s.scores).toEqual([60, 56]);
    expect(s.result).toEqual({ winner: 0, reason: 'lastTrick' });
  });

  it('can be a draw instead', () => {
    const g = game({ p0: 'JS', p1: 'JD', up: 'JH', down: 'JC', inv0: 'AS 10S KS QS AH 10H KH QH', inv1: 'AC 10C KC QC AD 10D KD QD', rules: { noWinner: 'draw' } });
    const s = applyMove(applyMove(g, play('JS')), play('JD'));
    expect(s.result).toEqual({ winner: null, reason: 'draw' });
  });

  it('reaching 66 on the last trick counts as threshold', () => {
    const g = game({ p0: 'AS', p1: 'JD', up: 'JH', down: 'JC', inv0: 'KS QS AH 10H KH QH 10C JS', inv1: 'AC 10S KC QC AD 10D KD QD' });
    expect(g.scores[0]).toBe(4 + 3 + 11 + 10 + 4 + 3 + 10 + 2);
    const s = applyMove(applyMove(g, play('AS')), play('JD'));
    expect(s.scores[0]).toBe(60);
    expect(s.result?.reason).toBe('lastTrick');
    const g2 = game({ p0: 'AS', p1: 'JD', up: 'JH', down: 'JC', inv0: 'KS QS AH 10H KH QH 10C 10S', inv1: 'AC JS KC QC AD 10D KD QD' });
    const s2 = applyMove(applyMove(g2, play('AS')), play('JD'));
    expect(s2.scores[0]).toBe(68);
    expect(s2.result).toEqual({ winner: 0, reason: 'threshold' });
  });
});
