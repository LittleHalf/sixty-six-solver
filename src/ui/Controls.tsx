import { other, type Player } from '../engine/index.ts';
import { Switch } from './Widgets.tsx';

interface Props {
  perspective: Player;
  showAll: boolean;
  gameOver: boolean;
  canUndo: boolean;
  canRedo: boolean;
  autoOpponent: boolean;
  onAutoOpponent: (v: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  onRestart: () => void;
  onBack: () => void;
  onPlayBest: () => void;
  onPlayLine: () => void;
}

export function Controls(p: Props) {
  const opp = other(p.perspective);
  return (
    <div className="panel controls">
      <div className="controls-row">
        <div className="controls-group">
          <button type="button" className="btn btn-sm" onClick={p.onUndo} disabled={!p.canUndo}>
            Undo
          </button>
          <button type="button" className="btn btn-sm" onClick={p.onRedo} disabled={!p.canRedo}>
            Redo
          </button>
          <button type="button" className="btn btn-sm" onClick={p.onRestart} disabled={!p.canUndo}>
            Restart
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={p.onBack}>
            Back to setup
          </button>
        </div>
        <div className="controls-group">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={p.onPlayBest}
            disabled={p.gameOver}
            title={p.showAll ? 'Play the perfect-information best move' : "Play the move with the best expected outcome given the mover's knowledge"}
          >
            Play best move
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={p.onPlayLine}
            disabled={p.gameOver}
            title="Play best moves for both sides until the deal ends (step back with Undo)"
          >
            Play out best line
          </button>
          <Switch
            checked={p.autoOpponent}
            onChange={p.onAutoOpponent}
            label={`Auto-play Player ${opp}`}
            title="The opponent answers automatically with the move that has the best expected outcome given only what it can see"
          />
        </div>
      </div>
      <p className="mode-note">
        {p.showAll ? (
          <>
            <b>Omniscient view.</b> Both hands and the face-down card are visible; perfect-information analysis is shown.
          </>
        ) : (
          <>
            <b>Player {p.perspective}&rsquo;s view.</b> Player {opp}&rsquo;s hand and the face-down card are hidden; only analysis
            based on Player {p.perspective}&rsquo;s legal knowledge is shown.
          </>
        )}
      </p>
    </div>
  );
}
