import { ALL_CARDS, cardToString, createGame, describeState, solve, analyzeWorlds, moveToString, type Setup } from '../src/engine/index.ts';

function shuffle<T>(a: T[], seed: number): T[] {
  const arr = [...a];
  let s = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

let totalNodes = 0;
const t0 = performance.now();
for (let seed = 1; seed <= 20; seed++) {
  const d = shuffle([...ALL_CARDS], seed);
  const setup: Setup = {
    hands: [d.slice(0, 5), d.slice(5, 10)],
    faceUp: d[10],
    faceDown: d[11],
    inventory: [d.slice(12, 16), d.slice(16, 20)],
    leader: 0,
  };
  const g = createGame(setup);
  const a = solve(g);
  totalNodes += a.nodes;
  if (seed <= 2) {
    console.log(describeState(g));
    console.log('value', a.value, 'outcome', a.outcome, 'diff', a.pointDiff, 'nodes', a.nodes);
    console.log('moves', a.moves.map((m) => `${moveToString(m.move)}=${m.value}`).join('  '));
    console.log('pv', a.pv.map(moveToString).join(' > '));
    const w = analyzeWorlds(g, 0);
    console.log('worlds', w.worlds.map((x) => `${cardToString(x.faceDown)}:${x.analysis.value}`).join(' '), 'expected', w.expectedValue.toFixed(1), 'nodes', w.totalNodes);
    console.log(w.moves.map((m) => `${moveToString(m.move)} mean=${m.mean.toFixed(0)} W/D/L=${m.wins}/${m.draws}/${m.losses}`).join('\n'));
    console.log('---');
  }
}
console.log('20 solves:', (performance.now() - t0).toFixed(0), 'ms, nodes', totalNodes);
