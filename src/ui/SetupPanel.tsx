import { useMemo, useState } from 'react';
import {
  ALL_CARDS,
  SUITS,
  SUIT_NAME,
  SUIT_SYMBOL,
  pointsOf,
  sortCards,
  suitOf,
  type CardId,
  type Setup,
} from '../engine/index.ts';
import { Card } from './Card.tsx';
import { RulesPanel } from './RulesPanel.tsx';
import { Segmented } from './Widgets.tsx';
import {
  ZONES,
  ZONE_INFO,
  cardsIn,
  clearCards,
  draftErrors,
  isZoneFull,
  nextZone,
  placeCard,
  randomDeal,
  removeCard,
  toSetup,
  unplacedCards,
  zoneCapacity,
  zoneCount,
  type SetupDraft,
  type Zone,
} from './setupModel.ts';

interface Props {
  draft: SetupDraft;
  onChange: (draft: SetupDraft) => void;
  onStart: (setup: Setup) => void;
}

const AUTO_ADVANCE: readonly Zone[] = ['h0', 'h1', 'up', 'down'];

export function SetupPanel({ draft, onChange, onStart }: Props) {
  const [active, setActive] = useState<Zone>('h0');
  const [copied, setCopied] = useState(false);
  const errors = useMemo(() => draftErrors(draft), [draft]);
  const pool = unplacedCards(draft);
  const faceUp = cardsIn(draft, 'up')[0];
  const trumpSuit = faceUp !== undefined ? suitOf(faceUp) : null;
  const activeFull = isZoneFull(draft, active);

  function place(card: CardId) {
    if (activeFull) return;
    const next = placeCard(draft, card, active);
    onChange(next);
    if (AUTO_ADVANCE.includes(active) && isZoneFull(next, active)) setActive(nextZone(next, active));
  }

  function copyLink() {
    navigator.clipboard
      ?.writeText(window.location.href)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => undefined);
  }

  const inventoryPoints = (zone: 'i0' | 'i1') => cardsIn(draft, zone).reduce((a, c) => a + pointsOf(c), 0);

  return (
    <div className="setup-grid">
      <div className="stack">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Deck</h2>
              <p className="muted">
                {pool.length === 0 ? (
                  'All cards placed.'
                ) : (
                  <>
                    {pool.length} unplaced · click a card to put it in <b>{ZONE_INFO[active].label}</b>
                    {activeFull && <span className="warn"> (full — pick another zone)</span>}
                  </>
                )}
              </p>
            </div>
            <div className="row">
              <button type="button" className="btn" onClick={() => onChange(randomDeal(draft))}>
                Random deal
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => onChange(clearCards(draft))}>
                Clear
              </button>
            </div>
          </div>
          <div className="panel-body deck-strip">
            {SUITS.map((suit) => (
              <div key={suit} className="deck-row">
                <span className={`deck-suit ${suit === 'H' || suit === 'D' ? 'red' : ''}`} title={SUIT_NAME[suit]}>
                  {SUIT_SYMBOL[suit]}
                </span>
                {sortCards(ALL_CARDS.filter((c) => suitOf(c) === suit)).map((card) => {
                  const zone = draft.placement[card];
                  return (
                    <span key={card} className="deck-card">
                      <Card
                        card={card}
                        size="sm"
                        trump={trumpSuit === suit}
                        dim={zone !== null}
                        onClick={zone === null ? (activeFull ? undefined : () => place(card)) : () => onChange(removeCard(draft, card))}
                        title={zone === null ? `Place in ${ZONE_INFO[active].label}` : `In ${ZONE_INFO[zone].label} — click to return to the deck`}
                      />
                      {zone !== null && <span className="zone-tag">{ZONE_INFO[zone].short}</span>}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Zones</h2>
            <p className="muted">Click a zone to target it; click a placed card to return it to the deck.</p>
          </div>
          <div className="panel-body zone-grid">
            {ZONES.map((zone) => {
              const cards = cardsIn(draft, zone);
              const count = zoneCount(draft, zone);
              const cap = zoneCapacity(draft, zone);
              const full = count >= cap;
              const isActive = zone === active;
              const ok = zone === 'i0' || zone === 'i1' ? zoneCount(draft, 'i0') + zoneCount(draft, 'i1') === 8 : full;
              return (
                <div
                  key={zone}
                  className={`zone zone-${zone}${isActive ? ' is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActive(zone)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActive(zone);
                    }
                  }}
                >
                  <div className="zone-head">
                    <span className="zone-title">
                      {ZONE_INFO[zone].label}
                      <span className="zone-hint">{ZONE_INFO[zone].hint}</span>
                    </span>
                    <span className={`zone-count${ok ? ' ok' : ''}`}>
                      {count}
                      {zone === 'i0' || zone === 'i1' ? ` / ${cap}` : ` / ${ZONE_INFO[zone].capacity}`}
                      {(zone === 'i0' || zone === 'i1') && count > 0 && <span className="zone-pts"> · {inventoryPoints(zone)} pts</span>}
                    </span>
                  </div>
                  <div className="zone-cards">
                    {cards.length === 0 && <span className="zone-empty">{isActive ? 'Click cards in the deck' : 'Empty'}</span>}
                    {cards.map((card) => (
                      <Card
                        key={card}
                        card={card}
                        size="sm"
                        trump={trumpSuit === suitOf(card)}
                        onClick={() => onChange(removeCard(draft, card))}
                        title="Return to the deck"
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <aside className="stack">
        <section className="panel">
          <div className="panel-head">
            <h2>Deal</h2>
          </div>
          <div className="panel-body stack-sm">
            <div className="field">
              <span className="field-label">Leads the first trick</span>
              <Segmented
                value={draft.leader}
                options={[
                  { value: 0, label: 'Player 0' },
                  { value: 1, label: 'Player 1' },
                ]}
                onChange={(leader) => onChange({ ...draft, leader })}
                ariaLabel="Leader"
              />
            </div>
            <p className="muted">
              The face-up card sets the trump suit; it and the face-down card stay out of play. Won cards count as points
              (tricks so far are derived from them).
            </p>
          </div>
        </section>

        <RulesPanel rules={draft.rules} onChange={(rules) => onChange({ ...draft, rules })} />

        <section className="panel">
          <div className="panel-body stack-sm">
            {errors.length > 0 ? (
              <ul className="errors">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : (
              <p className="ready">Position is valid.{trumpSuit && <> Trump: {SUIT_SYMBOL[trumpSuit]} {SUIT_NAME[trumpSuit]}.</>}</p>
            )}
            <div className="row">
              <button
                type="button"
                className="btn btn-primary btn-lg"
                disabled={errors.length > 0}
                onClick={() => onStart(toSetup(draft))}
              >
                Start
              </button>
              <button type="button" className="btn" onClick={copyLink} title="The position is encoded in the page URL">
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
}
