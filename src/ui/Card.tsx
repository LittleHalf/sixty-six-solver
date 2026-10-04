import { SUIT_SYMBOL, cardToString, pointsOf, rankOf, suitOf, type CardId, type Move, type Suit } from '../engine/index.ts';

export type CardSize = 'xs' | 'sm' | 'md';

interface CardProps {
  card?: CardId | null;
  /** Render as a card back (hidden). */
  back?: boolean;
  size?: CardSize;
  trump?: boolean;
  dim?: boolean;
  selected?: boolean;
  onClick?: () => void;
  title?: string;
  className?: string;
}

export function Card({ card, back, size = 'md', trump, dim, selected, onClick, title, className }: CardProps) {
  const isBack = back || card === null || card === undefined;
  const suit = isBack ? null : suitOf(card as CardId);
  const classes = [
    'card',
    `card-${size}`,
    isBack ? 'card-back' : suit === 'H' || suit === 'D' ? 'card-red' : 'card-black',
    trump && !isBack ? 'card-trump' : '',
    dim ? 'card-dim' : '',
    selected ? 'card-selected' : '',
    onClick ? 'card-clickable' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const label = isBack
    ? 'Hidden card'
    : `${cardToString(card as CardId)} (${pointsOf(card as CardId)} points${trump ? ', trump' : ''})`;

  const content = isBack ? null : (
    <>
      <span className="card-corner">
        <span className="card-rank">{rankOf(card as CardId)}</span>
        <span className="card-suit-sm">{SUIT_SYMBOL[suit as Suit]}</span>
      </span>
      <span className="card-pip" aria-hidden="true">
        {SUIT_SYMBOL[suit as Suit]}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick} title={title ?? label} aria-label={label}>
        {content}
      </button>
    );
  }
  return (
    <span className={classes} title={title ?? label} role="img" aria-label={label}>
      {content}
    </span>
  );
}

interface MoveLabelProps {
  move: Move;
  trumpSuit: Suit;
  size?: CardSize;
}

/** A move rendered as a mini card. */
export function MoveLabel({ move, trumpSuit, size = 'xs' }: MoveLabelProps) {
  return <Card card={move.card} size={size} trump={suitOf(move.card) === trumpSuit} />;
}
