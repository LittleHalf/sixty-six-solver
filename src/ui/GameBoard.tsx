import { useMemo } from 'react';
import {
  SUIT_NAME,
  SUIT_SYMBOL,
  cardToString,
  handCards,
  other,
  playableCards,
  sortCards,
  suitOf,
  type GameState,
  type Move,
  type Player,
} from '../engine/index.ts';
import { Card } from './Card.tsx';
import { playerName, reasonText } from './format.ts';

interface Props {
  state: GameState;
  perspective: Player;
  showAll: boolean;
  onMove: (move: Move) => void;
}

export function GameBoard({ state, perspective, showAll, onMove }: Props) {
  const legal = useMemo(() => new Set(playableCards(state)), [state]);
  const top = other(perspective);
  const bottom = perspective;
  const trump = state.trumpSuit;
  const trumpRed = trump === 'H' || trump === 'D';
  const r = state.rules;
  const followRules = [
    r.mustFollowSuit ? 'follow suit' : 'no need to follow suit',
    r.mustFollowSuit && r.mustHead ? 'head if able' : null,
    r.mustTrumpWhenVoid ? 'trump when void' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const renderSeat = (player: Player) => {
    const cards = sortCards(handCards(state, player));
    const visible = showAll || player === perspective;
    const isMover = state.toMove === player && !state.result;
    const clickable = isMover && visible;
    return (
      <div className={`seat${isMover ? ' is-mover' : ''}`} key={player}>
        <div className="seat-head">
          <span className="seat-name">{playerName(player)}</span>
          {isMover && <span className="badge badge-accent">To move</span>}
          {!state.result && state.leader === player && <span className="badge">Leads</span>}
          {!visible && <span className="badge badge-hidden">Hidden</span>}
          <span className="seat-stats">
            <span className="stat">
              Card points <b>{state.scores[player]}</b>
            </span>
            <span className="stat">
              Tricks <b>{state.tricks[player]}</b>
            </span>
          </span>
        </div>
        <div className="hand">
          {cards.length === 0 && <span className="muted">No cards left</span>}
          {cards.map((card) => {
            if (!visible) return <Card key={card} back size="md" />;
            const playable = clickable && legal.has(card);
            return (
              <Card
                key={card}
                card={card}
                size="md"
                trump={suitOf(card) === trump}
                dim={clickable && !playable}
                onClick={playable ? () => onMove({ card }) : undefined}
                title={playable ? `Play ${cardToString(card)}` : clickable ? `${cardToString(card)} — not a legal play now` : undefined}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <section className="panel board">
      {renderSeat(top)}

      <div className="table-area">
        <div className="stock">
          <span className="area-label">Stock (out of play)</span>
          <div className="stock-cards">
            <Card card={state.faceUp} size="md" trump title={`Face-up trump indicator ${cardToString(state.faceUp)} — never played`} />
            {showAll ? (
              <span className="revealed">
                <Card
                  card={state.faceDown}
                  size="md"
                  trump={suitOf(state.faceDown) === trump}
                  className="card-revealed"
                  title={`Face-down card (revealed): ${cardToString(state.faceDown)} — never played`}
                />
                <span className="revealed-tag">face down</span>
              </span>
            ) : (
              <Card back size="md" title="Face-down card — unknown to both players" />
            )}
          </div>
        </div>

        <div className="trick">
          <span className="area-label">Table</span>
          {state.led !== null ? (
            <div className="trick-led">
              <Card card={state.led} size="md" trump={suitOf(state.led) === trump} />
              <div className="trick-info">
                <span>
                  {playerName(state.leader)} led {cardToString(state.led)}
                </span>
                {!state.result && <span className="muted">{playerName(state.toMove)} to follow</span>}
              </div>
            </div>
          ) : (
            <div className="trick-empty">{state.result ? 'Deal over' : `${playerName(state.toMove)} to lead`}</div>
          )}
        </div>

        <div className="trump-box">
          <span className="area-label">Trump</span>
          <span className={`trump-suit${trumpRed ? ' red' : ''}`}>
            {SUIT_SYMBOL[trump]} {SUIT_NAME[trump]}
          </span>
          <span className="muted">
            First to {r.winThreshold} · {followRules}
          </span>
        </div>
      </div>

      {renderSeat(bottom)}

      {state.result && (
        <div className={`result${state.result.winner === null ? ' result-draw' : ''}`}>
          {state.result.winner === null ? <b>Draw</b> : <b>{playerName(state.result.winner)} wins the deal</b>}
          <span>
            {' '}
            — {reasonText(state.result.reason)}. Final card points {state.scores[0]} : {state.scores[1]}.
          </span>
        </div>
      )}

      <div className="history">
        <h3>Tricks</h3>
        {state.history.length === 0 ? (
          <p className="muted">No tricks played yet.</p>
        ) : (
          <ol>
            {state.history.map((t, i) => (
              <li key={i} className="hist-row">
                <span className="hist-no">{i + 1}</span>
                <span className="hist-play">
                  <span className="hist-player">P{t.leader}</span>
                  <Card card={t.cards[0]} size="xs" trump={suitOf(t.cards[0]) === trump} />
                </span>
                <span className="hist-play">
                  <span className="hist-player">P{other(t.leader)}</span>
                  <Card card={t.cards[1]} size="xs" trump={suitOf(t.cards[1]) === trump} />
                </span>
                <span className="hist-res">
                  P{t.winner} wins, +{t.points}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
