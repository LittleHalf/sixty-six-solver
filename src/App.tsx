import { useEffect, useState } from 'react';
import type { Player } from './engine/index.ts';
import { AnalysisPanel } from './ui/AnalysisPanel.tsx';
import { Controls } from './ui/Controls.tsx';
import { GameBoard } from './ui/GameBoard.tsx';
import { SetupPanel } from './ui/SetupPanel.tsx';
import { Segmented, Switch } from './ui/Widgets.tsx';
import { bestLine, bestMove } from './ui/advice.ts';
import { draftFromHash, emptyDraft, hashForDraft, randomDeal, type SetupDraft } from './ui/setupModel.ts';
import { useGame } from './ui/useGame.ts';

function initialDraft(): SetupDraft {
  return draftFromHash(window.location.hash) ?? randomDeal(emptyDraft());
}

export default function App() {
  const [draft, setDraft] = useState<SetupDraft>(initialDraft);
  const game = useGame();
  const [perspective, setPerspective] = useState<Player>(0);
  const [showAll, setShowAll] = useState(true);
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [autoOpponent, setAutoOpponent] = useState(false);

  const { state, play } = game;

  // Keep the shareable position in the URL.
  useEffect(() => {
    const hash = hashForDraft(draft);
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
  }, [draft]);

  // Auto-play the opponent (the player not being viewed) with legitimate knowledge only.
  useEffect(() => {
    if (!autoOpponent || !state || state.result || state.toMove === perspective) return;
    const id = window.setTimeout(() => {
      const move = bestMove(state, false);
      if (move) play(move);
    }, 650);
    return () => window.clearTimeout(id);
  }, [autoOpponent, state, perspective, play]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>
            Sixty-six <span>Endgame Solver</span>
          </h1>
          <p className="muted">Exhaustive search of the last five tricks, with and without hidden information.</p>
        </div>
        <div className="topbar-controls">
          <Switch
            prominent
            checked={showAll}
            onChange={setShowAll}
            label="Show all info"
            title="On: both hands and the face-down card visible, perfect-information analysis shown. Off: only what the perspective player may see."
          />
          <div className="ctl">
            <span className="ctl-label">Perspective</span>
            <Segmented
              value={perspective}
              options={[
                { value: 0, label: 'Player 0' },
                { value: 1, label: 'Player 1' },
              ]}
              onChange={setPerspective}
              ariaLabel="Perspective"
            />
          </div>
          <Switch checked={showAnalysis} onChange={setShowAnalysis} label="Analysis" title="Hide the analysis to play it yourself" />
        </div>
      </header>

      <main className="content">
        {state ? (
          <div className={`play-grid${showAnalysis ? '' : ' single'}`}>
            <div className="stack">
              <Controls
                perspective={perspective}
                showAll={showAll}
                gameOver={state.result !== null}
                canUndo={game.canUndo}
                canRedo={game.canRedo}
                autoOpponent={autoOpponent}
                onAutoOpponent={setAutoOpponent}
                onUndo={game.undo}
                onRedo={game.redo}
                onRestart={game.restart}
                onBack={game.stop}
                onPlayBest={() => {
                  const m = bestMove(state, showAll);
                  if (m) play(m);
                }}
                onPlayLine={() => game.playMany(bestLine(state, showAll))}
              />
              <GameBoard state={state} perspective={perspective} showAll={showAll} onMove={play} />
            </div>
            {showAnalysis && <AnalysisPanel state={state} perspective={perspective} showAll={showAll} />}
          </div>
        ) : (
          <SetupPanel draft={draft} onChange={setDraft} onStart={game.start} />
        )}
      </main>
    </div>
  );
}
