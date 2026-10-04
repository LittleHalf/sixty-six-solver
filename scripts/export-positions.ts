/**
 * Exports random endgame positions with their TypeScript-solver values so the
 * Rust table can be cross-checked:  node scripts/export-positions.ts 20000 > positions.txt
 * Line format (TS card ids, value from Player 0's perspective):
 *   h0mask h1mask trumpSuitIndex upCard downCard score0 score1 leader expectedValue
 */
import { ALL_CARDS, SUITS, createGame, maskOf, pointsOf, solve, suitOf, type Setup } from '../src/engine/index.ts';

const count = Number(process.argv[2] ?? 1000);
let seed = Number(process.argv[3] ?? 42);
function rnd(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x80000000;
}
function shuffle<T>(a: readonly T[]): T[] {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

let written = 0;
while (written < count) {
  const d = shuffle(ALL_CARDS);
  const split = 2 * Math.floor(rnd() * 5);
  const setup: Setup = {
    hands: [d.slice(0, 5), d.slice(5, 10)],
    faceUp: d[10],
    faceDown: d[11],
    inventory: [d.slice(12, 12 + split), d.slice(12 + split, 20)],
    leader: rnd() < 0.5 ? 0 : 1,
  };
  const g = createGame(setup);
  if (g.scores[0] >= 66 || g.scores[1] >= 66) continue;
  const a = solve(g);
  const line = [
    maskOf(setup.hands[0]),
    maskOf(setup.hands[1]),
    SUITS.indexOf(suitOf(setup.faceUp)),
    setup.faceUp,
    setup.faceDown,
    g.scores[0],
    g.scores[1],
    setup.leader,
    a.value,
  ];
  process.stdout.write(line.join(' ') + '\n');
  written++;
}
void pointsOf;
