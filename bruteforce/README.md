# sixtysix-bruteforce

Exhaustive bottom-up solver for **every** Sixty-six endgame position, written in
Rust. The TypeScript engine in `../src/engine` is the reference implementation;
this crate reproduces its results for all 1.07 × 10¹² positions in minutes.

## Reductions used (all exact, margin preserved)

1. **Trump is always suit 0.** The face-up card only matters through its suit.
2. **Non-trump suits are canonicalised.** The three other suits are
   interchangeable, so each pair of hands is mapped to a canonical
   representative (`canon.rs`). Factor ~6.
3. **Player symmetry.** The leader is always "player 0"; positions where the
   other player leads are the mirror image with the sign flipped.
4. **Scores collapse to points needed.** The inventory split only matters
   through the score, and the score only through `n0 = 66 − leader score`.
   The follower's need is implied by `n0 + n1 = 12 + P + U`, where `P` is the
   points still in the hands and `U` the points of the two out-of-play cards.
   `U` is a constant of the deal with 12 possible values, so each hand pair has
   12 × 66 cells.
5. **Bottom-up layers.** Layer *k* holds every canonical pair of *k*-card hands.
   A cell at layer *k* is a max/min over at most 25 lookups into layer *k − 1*,
   so every sub-position is solved once instead of once per root.

| Layer | Raw pairs | Canonical slots | Cells | Size |
| --- | --- | --- | --- | --- |
| 1 v 1 | 380 | 115 | 91,080 | 0.2 MB |
| 2 v 2 | 29,070 | 5,720 | 4.5 M | 9 MB |
| 3 v 3 | 775,200 | 136,440 | 108 M | 216 MB |
| 4 v 4 | 8,817,900 | 1,503,190 | 1.19 G | 2.4 GB |
| 5 v 5 | 46,558,512 | ~7.8 M | ~6.1 G | ~12 GB |

Cell value (i16, from the leader's perspective):
`outcome × 1000 + (leader's future gain − follower's future gain)`, where
outcome is +1 / −1 / 0. Add `(leader score − follower score)` to get the final
margin. `i16::MIN` marks cells whose implied follower need is impossible.

## Commands

```sh
cargo build --release
./target/release/sixtysix build --out out/layer5.i16     # everything, streamed to disk + statistics
./target/release/sixtysix build --top 4                   # only up to 4 v 4, in memory
./target/release/sixtysix check positions.txt             # compare with the TypeScript solver
./target/release/sixtysix solve "AS 10S KS QS JS" "AH 10H KH QH JH" AD 10D 28 12
./target/release/sixtysix query out/layer5.i16 "AS 10S KS QS JS" "AH 10H KH QH JH" AD 10D 28 12
```

`solve` / `query` arguments: leader's hand, follower's hand, face-up card,
face-down card, leader's score, follower's score. Cards use the TypeScript
notation (`10H`, `AS`, suits C D H S). Scores + hand points + stock points must
add up to 120.

Generate a cross-check file with the TypeScript engine:

```sh
node ../scripts/export-positions.ts 20000 > positions.txt
```

## Rules

Identical to `DEFAULT_RULES` in the TypeScript engine: follow suit, beat the
led card if able, no obligation to trump when void, first to 66 wins, otherwise
the last trick wins. The draw variant is not built into the tables.

## Layout of the table file

`index = (slot × 792 + u_index × 66 + (leader_need − 1)) × 2` bytes, where
`slot` comes from `SlotMap::build(5)` (rebuilt in ~1 s by `query`) and
`u_index` is the position of `U` in `[4,5,6,7,8,12,13,14,15,20,21,22]`.
