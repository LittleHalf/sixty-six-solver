import { useMemo } from 'react';
import {
  OUTCOME_WEIGHT,
  analyzeWorlds,
  applyMove,
  createCache,
  fromPerspective,
  other,
  principalVariation,
  solve,
  splitValue,
  type GameState,
  type Move,
  type MoveEval,
  type Player,
} from '../engine/index.ts';
import { MoveLabel } from './Card.tsx';
import { fmtNodes, outcomeKind, outcomeText, playerName } from './format.ts';
import { WorldsMatrix } from './WorldsMatrix.tsx';

interface Props {
  state: GameState;
  perspective: Player;
  showAll: boolean;
}

interface Line {
  ev: MoveEval;
  /** Principal variation from this move on, annotated with the player and trick boundaries. */
  pv: { move: Move; player: Player; newTrick: boolean }[];
}

function annotate(state: GameState, moves: Move[]): Line['pv'] {
  const out: Line['pv'] = [];
  let s = state;
  for (const move of moves) {
    out.push({ move, player: s.toMove, newTrick: s.led === null });
    s = applyMove(s, move);
  }
  return out;
}

/** Renders a solver value; `value` is P0-relative unless `adjusted` (already from the perspective). */
function Outcome({ value, perspective, adjusted }: { value: number; perspective: Player; adjusted?: boolean }) {
  const v = adjusted ? value : fromPerspective(value, perspective);
  const { outcome, pointDiff } = splitValue(v);
  return <span className={`outcome c-${outcomeKind(outcome)}`}>{outcomeText(outcome, pointDiff)}</span>;
}

export function AnalysisPanel({ state, perspective, showAll }: Props) {
  const terminal = state.result !== null;
  const mover = state.toMove;

  const perfect = useMemo(() => {
    if (!showAll || terminal) return null;
    const cache = createCache();
    const analysis = solve(state, cache);
    const counter = { nodes: 0 };
    const lines: Line[] = analysis.moves.map((ev) => ({
      ev,
      pv: annotate(state, [ev.move, ...principalVariation(applyMove(state, ev.move), cache, counter)]),
    }));
    return { analysis, lines };
  }, [state, showAll, terminal]);

  const worlds = useMemo(() => (terminal ? null : analyzeWorlds(state, perspective)), [state, perspective, terminal]);

  const finalValue = state.result
    ? (state.result.winner === null ? 0 : state.result.winner === 0 ? 1 : -1) * OUTCOME_WEIGHT + (state.scores[0] - state.scores[1])
    : 0;

  return (
    <section className="panel analysis">
      <div className="panel-head">
        <div>
          <h2>Analysis</h2>
          <p className="muted">
            Outcomes shown from <b>{playerName(perspective)}&rsquo;s</b> point of view
            {!terminal && <> · {playerName(mover)} to move</>}
          </p>
        </div>
      </div>

      {terminal && (
        <div className="panel-body">
          <p className="verdict">
            Final result: <Outcome value={finalValue} perspective={perspective} />
          </p>
          <p className="muted">The deal is over. Use Undo to step back and analyse earlier positions.</p>
        </div>
      )}

      {perfect && (
        <div className="analysis-section">
          <div className="section-head">
            <h3>Perfect information</h3>
            <span className="muted">all cards known · {fmtNodes(perfect.analysis.nodes)} nodes</span>
          </div>
          <p className="verdict">
            Best play: <Outcome value={perfect.analysis.value} perspective={perspective} />
          </p>
          <div className="table-wrap">
            <table className="table pi-table">
              <thead>
                <tr>
                  <th>Move</th>
                  <th>Outcome</th>
                  <th>Principal variation</th>
                </tr>
              </thead>
              <tbody>
                {perfect.lines.map(({ ev, pv }, i) => (
                  <tr key={i} className={i === 0 ? 'is-best' : ''}>
                    <td className="col-move">
                      <MoveLabel move={ev.move} trumpSuit={state.trumpSuit} />
                      {i === 0 && <span className="best-tag">best</span>}
                    </td>
                    <td>
                      <Outcome value={ev.value} perspective={perspective} />
                    </td>
                    <td className="pv">
                      {pv.map((step, j) => (
                        <span key={j} className={`pv-step${step.newTrick && j > 0 ? ' pv-trick' : ''}`}>
                          <span className="pv-player">P{step.player}</span>
                          <MoveLabel move={step.move} trumpSuit={state.trumpSuit} />
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="caption">Moves sorted best-first for {playerName(mover)} (the player to move).</p>
        </div>
      )}

      {worlds && (
        <div className="analysis-section">
          <div className="section-head">
            <h3>Hidden information</h3>
            <span className="muted">
              {worlds.worlds.length} world{worlds.worlds.length === 1 ? '' : 's'} · {fmtNodes(worlds.totalNodes)} nodes
            </span>
          </div>
          <p className="caption">
            Each column is one possible world: that card is the face-down card and {playerName(other(perspective))} holds the
            other {worlds.unknown.length - 1} unseen card{worlds.unknown.length - 1 === 1 ? '' : 's'}. Uses only what{' '}
            {playerName(perspective)} can see; worlds are weighted equally.
          </p>
          {worlds.moves.length === 0 && (
            <p className="note">
              Waiting for {playerName(mover)} — their options depend on which card is face down, so there is no per-move
              table from {playerName(perspective)}&rsquo;s point of view. The position value in each world is shown below.
            </p>
          )}
          <WorldsMatrix analysis={worlds} trumpSuit={state.trumpSuit} showActual={showAll} />
          {showAll && worlds.worlds.length > 1 && (
            <p className="caption">
              Actual world: <Outcome value={worlds.actualValue} perspective={perspective} adjusted /> — the column marked
              “actual” is the real face-down card.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
