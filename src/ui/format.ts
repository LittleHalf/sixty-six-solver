import type { EndReason, Player } from '../engine/index.ts';

export const MINUS = '−';

/** "+23", "−14", "0"; with digits, e.g. signed(1.333, 2) → "+1.33". */
export function signed(n: number, digits = 0): string {
  const abs = Math.abs(n);
  const body = digits ? abs.toFixed(digits) : String(Math.round(abs));
  if (Number(body) === 0) return digits ? (0).toFixed(digits) : '0';
  return n > 0 ? `+${body}` : `${MINUS}${body}`;
}

export type OutcomeKind = 'win' | 'loss' | 'draw';

/** `outcome` is +1 win, 0 draw, -1 loss (already from the viewer's point of view). */
export function outcomeKind(outcome: number): OutcomeKind {
  if (outcome > 0) return 'win';
  if (outcome < 0) return 'loss';
  return 'draw';
}

const OUTCOME_WORD: Record<OutcomeKind, string> = { win: 'Win', loss: 'Loss', draw: 'Draw' };

/** Long form: "Win, +23 card pts". */
export function outcomeText(outcome: number, pointDiff: number): string {
  return `${OUTCOME_WORD[outcomeKind(outcome)]}, ${signed(pointDiff)} card pts`;
}

/** Short form for matrix cells: { head: "Win", tail: "+23" }. */
export function outcomeShort(outcome: number, pointDiff: number): { head: string; tail: string } {
  return { head: OUTCOME_WORD[outcomeKind(outcome)], tail: signed(pointDiff) };
}

export function playerName(p: Player): string {
  return `Player ${p}`;
}

export function reasonText(reason: EndReason): string {
  switch (reason) {
    case 'threshold':
      return 'reached the point threshold';
    case 'lastTrick':
      return 'took the last trick';
    case 'draw':
      return 'nobody reached the threshold';
  }
}

export function fmtNodes(n: number): string {
  return n.toLocaleString('en-US');
}
