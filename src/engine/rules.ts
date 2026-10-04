/**
 * Configurable rule set. The defaults are the user's table rules (see README).
 * The few switches that exist cover the ways the follow-suit rule commonly
 * varies between tables; nothing else is configurable.
 */
export interface Rules {
  /** Card points needed to win the deal. Only one player can ever reach it. */
  winThreshold: number;
  /** The follower must play a card of the led suit if they hold one. */
  mustFollowSuit: boolean;
  /** When following suit, the follower must beat the led card if able. */
  mustHead: boolean;
  /** When void in the led suit, the follower must play a trump if they hold one. */
  mustTrumpWhenVoid: boolean;
  /** Outcome when nobody reaches the threshold after the last trick. */
  noWinner: 'lastTrick' | 'draw';
}

export const DEFAULT_RULES: Rules = {
  winThreshold: 66,
  mustFollowSuit: true,
  mustHead: true,
  mustTrumpWhenVoid: false,
  noWinner: 'lastTrick',
};

export interface RuleDescription {
  key: keyof Rules;
  label: string;
  help: string;
  kind: 'boolean' | 'number' | 'choice';
  choices?: { value: string; label: string }[];
}

/** Metadata for building a rules panel in a UI. */
export const RULE_DESCRIPTIONS: RuleDescription[] = [
  { key: 'winThreshold', label: 'Points to win', help: 'Card points needed to win the deal.', kind: 'number' },
  { key: 'mustFollowSuit', label: 'Must follow suit', help: 'The follower must play the led suit if able.', kind: 'boolean' },
  { key: 'mustHead', label: 'Must head the trick', help: 'When following suit, the follower must beat the led card if able.', kind: 'boolean' },
  { key: 'mustTrumpWhenVoid', label: 'Must trump when void', help: 'A follower with no card of the led suit must play a trump if able.', kind: 'boolean' },
  {
    key: 'noWinner', label: 'Nobody reaches 66', help: 'What decides the deal when neither player reaches the threshold.', kind: 'choice',
    choices: [{ value: 'lastTrick', label: 'Last trick wins' }, { value: 'draw', label: 'Draw' }],
  },
];

export function withRules(overrides?: Partial<Rules>): Rules {
  return { ...DEFAULT_RULES, ...(overrides ?? {}) };
}
