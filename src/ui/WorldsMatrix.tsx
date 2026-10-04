import { fromPerspective, other, splitValue, suitOf, type Suit, type WorldsAnalysis } from '../engine/index.ts';
import { Card, MoveLabel } from './Card.tsx';
import { outcomeKind, outcomeShort, signed } from './format.ts';

interface Props {
  analysis: WorldsAnalysis;
  trumpSuit: Suit;
  /** Whether the real world may be marked (omniscient view only). */
  showActual: boolean;
}

/**
 * Legal moves (rows) × possible face-down cards (columns). Every number is
 * from the analysis' perspective player's point of view.
 */
export function WorldsMatrix({ analysis, trumpSuit, showActual }: Props) {
  const { worlds, moves, perspective } = analysis;
  const opp = other(perspective);
  const worldValues = worlds.map((w) => splitValue(fromPerspective(w.analysis.value, perspective)));
  const n = worlds.length;
  const meanOutcome = worldValues.reduce((a, v) => a + v.outcome, 0) / n;
  const meanDiff = worldValues.reduce((a, v) => a + v.pointDiff, 0) / n;
  const wins = worldValues.filter((v) => v.outcome > 0).length;
  const draws = worldValues.filter((v) => v.outcome === 0).length;
  const losses = worldValues.filter((v) => v.outcome < 0).length;
  const signClass = (v: number) => (v > 0 ? 'c-win' : v < 0 ? 'c-loss' : '');

  return (
    <div className="matrix-wrap">
      <table className="table matrix">
        <thead>
          <tr>
            <th className="col-move">{moves.length ? 'Move' : ''}</th>
            {worlds.map((w, i) => (
              <th key={i} className={`col-world${showActual && w.isActual ? ' is-actual' : ''}`}>
                <span className="world-head" title={`World: this card is face down and Player ${opp} holds the other unseen cards`}>
                  <Card card={w.faceDown} size="xs" trump={suitOf(w.faceDown) === trumpSuit} />
                  {showActual && w.isActual && <span className="actual-tag">actual</span>}
                </span>
              </th>
            ))}
            <th className="num" title="Mean outcome across worlds: +1 = win in every world, −1 = loss in every world">
              Mean
            </th>
            <th className="num" title="Mean final card-point margin across worlds">
              Margin
            </th>
            <th className="num" title="Worlds won / drawn / lost">
              W/D/L
            </th>
          </tr>
        </thead>
        <tbody>
          {moves.map((m, i) => (
            <tr key={m.key} className={i === 0 ? 'is-best' : ''}>
              <td className="col-move">
                <MoveLabel move={m.move} trumpSuit={trumpSuit} />
                {i === 0 && <span className="best-tag">best</span>}
              </td>
              {m.perWorld.map((pw, j) => {
                const s = outcomeShort(pw.outcome, pw.pointDiff);
                return (
                  <td key={j} className={`cell cell-${outcomeKind(pw.outcome)}${showActual && worlds[j].isActual ? ' is-actual' : ''}`}>
                    <span className="cell-head">{s.head}</span>
                    <span className="cell-tail">{s.tail}</span>
                  </td>
                );
              })}
              <td className={`num strong ${signClass(m.meanOutcome)}`}>{signed(m.meanOutcome, 2)}</td>
              <td className="num">{signed(m.meanPointDiff, 1)}</td>
              <td className="num">
                <span className="c-win">{m.wins}</span> / {m.draws} / <span className="c-loss">{m.losses}</span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="col-move muted">Position value</td>
            {worldValues.map((v, j) => {
              const s = outcomeShort(v.outcome, v.pointDiff);
              return (
                <td key={j} className={`cell cell-${outcomeKind(v.outcome)}${showActual && worlds[j].isActual ? ' is-actual' : ''}`}>
                  <span className="cell-head">{s.head}</span>
                  <span className="cell-tail">{s.tail}</span>
                </td>
              );
            })}
            <td className={`num strong ${signClass(meanOutcome)}`}>{signed(meanOutcome, 2)}</td>
            <td className="num">{signed(meanDiff, 1)}</td>
            <td className="num">
              <span className="c-win">{wins}</span> / {draws} / <span className="c-loss">{losses}</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
