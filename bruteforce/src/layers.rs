//! Layered bottom-up tables.
//!
//! Layer k holds every canonical ordered pair of k-card hands (leader, follower)
//! with trump = suit 0. For each pair there are CELLS = U_SLOTS × NEED_SLOTS
//! values indexed by
//!   U  = face-up points + face-down points (a constant of the deal), and
//!   n0 = points the leader still needs to reach 66 (1..=66).
//! The follower's need is implied: n0 + n1 = 12 + P + U where P is the points
//! still in the two hands. A cell stores, from the leader's perspective,
//!   outcome * 1000 + (leader's future gain - follower's future gain)
//! or NONE when the implied n1 is outside 1..=66.
use crate::canon::{canonical, is_canonical};
use crate::cards::{hand_points, pair_count, pair_rank, pts, subsets_of, u_index, FULL, NEED_SLOTS, U_SLOTS, U_VALUES};
use crate::rules::{follower_wins, legal_follows};
use rayon::prelude::*;
use std::io::Write;
use std::time::Instant;

pub const CELLS: usize = U_SLOTS * NEED_SLOTS;
pub const NONE: i16 = i16::MIN;

pub struct SlotMap {
    pub k: u32,
    /// pair rank -> canonical slot
    pub slot_of_pair: Vec<u32>,
    /// slot -> canonical (leader, follower) hands
    pub canon: Vec<(u32, u32)>,
    /// slot -> number of raw pairs that map to it
    pub mult: Vec<u32>,
}

impl SlotMap {
    pub fn build(k: u32) -> SlotMap {
        let total = pair_count(k);
        let mut slot_of_pair = vec![u32::MAX; total];
        let mut canon: Vec<(u32, u32)> = Vec::new();
        let mut mult: Vec<u32> = Vec::new();
        let mut pr = 0usize;
        for h0 in subsets_of(FULL, k) {
            for h1 in subsets_of(FULL & !h0, k) {
                if is_canonical(h0, h1) {
                    slot_of_pair[pr] = canon.len() as u32;
                    canon.push((h0, h1));
                    mult.push(0);
                }
                pr += 1;
            }
        }
        pr = 0;
        for h0 in subsets_of(FULL, k) {
            for h1 in subsets_of(FULL & !h0, k) {
                if slot_of_pair[pr] == u32::MAX {
                    let (a, b) = canonical(h0, h1);
                    slot_of_pair[pr] = slot_of_pair[pair_rank(a, b, k)];
                }
                mult[slot_of_pair[pr] as usize] += 1;
                pr += 1;
            }
        }
        SlotMap { k, slot_of_pair, canon, mult }
    }

    #[inline]
    pub fn slot(&self, h0: u32, h1: u32) -> u32 {
        self.slot_of_pair[pair_rank(h0, h1, self.k)]
    }
}

pub struct Layer {
    pub map: SlotMap,
    pub values: Vec<i16>,
}

impl Layer {
    #[inline]
    pub fn get(&self, slot: u32, ui: usize, need: i32) -> i16 {
        self.values[slot as usize * CELLS + ui * NEED_SLOTS + (need as usize - 1)]
    }
}

#[derive(Clone, Copy, Default)]
struct Child {
    tp: i32,
    leader_wins: bool,
    slot: u32,
}

/// All (lead, follow) continuations of a pair with their child slots in the lower layer.
struct Children {
    items: [Child; 25],
    lead_len: [u8; 5],
    leads: usize,
}

fn children(h0: u32, h1: u32, k: u32, lower: Option<&SlotMap>) -> Children {
    let mut ch = Children { items: [Child::default(); 25], lead_len: [0; 5], leads: 0 };
    let mut n = 0usize;
    let mut leads = h0;
    while leads != 0 {
        let c0 = leads.trailing_zeros();
        leads &= leads - 1;
        let mut cnt = 0u8;
        let mut follows = legal_follows(c0, h1);
        while follows != 0 {
            let c1 = follows.trailing_zeros();
            follows &= follows - 1;
            let fw = follower_wins(c0, c1);
            let a = h0 & !(1 << c0);
            let b = h1 & !(1 << c1);
            let slot = match lower {
                Some(m) if k > 1 => {
                    if fw {
                        m.slot(b, a)
                    } else {
                        m.slot(a, b)
                    }
                }
                _ => 0,
            };
            ch.items[n] = Child { tp: pts(c0) + pts(c1), leader_wins: !fw, slot };
            n += 1;
            cnt += 1;
        }
        ch.lead_len[ch.leads] = cnt;
        ch.leads += 1;
    }
    ch
}

/// Fills the CELLS values of one hand pair at layer k from the lower layer.
pub fn compute_cells(h0: u32, h1: u32, k: u32, lower: Option<&Layer>, out: &mut [i16]) {
    debug_assert_eq!(out.len(), CELLS);
    let p = hand_points(h0 | h1);
    let ch = children(h0, h1, k, lower.map(|l| &l.map));
    let last = k == 1;
    for (ui, &u) in U_VALUES.iter().enumerate() {
        for n0 in 1..=NEED_SLOTS as i32 {
            let n1 = 12 + p + u - n0;
            let cell = &mut out[ui * NEED_SLOTS + (n0 as usize - 1)];
            if n1 < 1 || n1 > NEED_SLOTS as i32 {
                *cell = NONE;
                continue;
            }
            let mut best = i32::MIN;
            let mut idx = 0usize;
            for li in 0..ch.leads {
                let mut worst = i32::MAX;
                for _ in 0..ch.lead_len[li] {
                    let c = ch.items[idx];
                    idx += 1;
                    let v = if c.leader_wins {
                        if c.tp >= n0 || last {
                            1000 + c.tp
                        } else {
                            let l = lower.unwrap().get(c.slot, ui, n0 - c.tp);
                            debug_assert!(l != NONE);
                            l as i32 + c.tp
                        }
                    } else if c.tp >= n1 || last {
                        -1000 - c.tp
                    } else {
                        let l = lower.unwrap().get(c.slot, ui, n1 - c.tp);
                        debug_assert!(l != NONE);
                        -(l as i32) - c.tp
                    };
                    if v < worst {
                        worst = v;
                    }
                }
                if worst > best {
                    best = worst;
                }
            }
            *cell = best as i16;
        }
    }
}

/// Builds a full layer in memory.
pub fn build_layer(k: u32, lower: Option<&Layer>) -> Layer {
    let t = Instant::now();
    let map = SlotMap::build(k);
    eprintln!(
        "layer {k}: {} raw pairs -> {} canonical slots ({:.1}s index)",
        pair_count(k),
        map.canon.len(),
        t.elapsed().as_secs_f64()
    );
    let t = Instant::now();
    let mut values = vec![NONE; map.canon.len() * CELLS];
    values.par_chunks_mut(CELLS).enumerate().for_each(|(i, out)| {
        let (h0, h1) = map.canon[i];
        compute_cells(h0, h1, k, lower, out);
    });
    eprintln!(
        "layer {k}: solved {} cells in {:.1}s ({} MB)",
        values.len(),
        t.elapsed().as_secs_f64(),
        values.len() * 2 / 1_000_000
    );
    Layer { map, values }
}

#[derive(Default, Clone, Copy)]
pub struct Stats {
    /// Real endgame positions represented (trump fixed, leader = player 0).
    pub positions: u64,
    pub leader_wins: u64,
    pub follower_wins: u64,
    pub draws: u64,
    /// Positions where the leader can still reach 66 / the follower can / neither.
    pub leader_reachable: u64,
    pub follower_reachable: u64,
    pub neither_reachable: u64,
}

impl Stats {
    fn add(&mut self, o: &Stats) {
        self.positions += o.positions;
        self.leader_wins += o.leader_wins;
        self.follower_wins += o.follower_wins;
        self.draws += o.draws;
        self.leader_reachable += o.leader_reachable;
        self.follower_reachable += o.follower_reachable;
        self.neither_reachable += o.neither_reachable;
    }
}

/// For a 5-card pair: how many real deals (face-up, face-down, inventory split)
/// land on each cell. Only meaningful for the top (5 v 5) layer.
fn cell_weights(h0: u32, h1: u32, w: &mut [u32; CELLS]) {
    w.fill(0);
    let used = h0 | h1;
    for up in 0..5u32 {
        if used & (1 << up) != 0 {
            continue;
        }
        for down in 0..20u32 {
            if down == up || used & (1 << down) != 0 {
                continue;
            }
            let ui = u_index(pts(up) + pts(down)).expect("U value");
            let out = FULL & !(used | (1 << up) | (1 << down));
            let mut cards = [0i32; 8];
            let mut m = out;
            let mut n = 0;
            while m != 0 {
                cards[n] = pts(m.trailing_zeros());
                n += 1;
                m &= m - 1;
            }
            debug_assert_eq!(n, 8);
            let total: i32 = cards.iter().sum();
            for s in 0u32..256 {
                if s.count_ones() % 2 != 0 {
                    continue;
                }
                let mut s0 = 0;
                for (i, c) in cards.iter().enumerate() {
                    if s & (1 << i) != 0 {
                        s0 += c;
                    }
                }
                let s1 = total - s0;
                if s0 >= 66 || s1 >= 66 {
                    continue;
                }
                w[ui * NEED_SLOTS + (66 - s0 - 1) as usize] += 1;
            }
        }
    }
}

fn slot_stats(h0: u32, h1: u32, mult: u64, cells: &[i16], w: &mut [u32; CELLS]) -> Stats {
    cell_weights(h0, h1, w);
    let p = hand_points(h0 | h1);
    let mut st = Stats::default();
    for ui in 0..U_SLOTS {
        for n0 in 1..=NEED_SLOTS as i32 {
            let i = ui * NEED_SLOTS + (n0 as usize - 1);
            let weight = w[i] as u64 * mult;
            if weight == 0 {
                continue;
            }
            let v = cells[i];
            debug_assert!(v != NONE);
            st.positions += weight;
            if v > 0 {
                st.leader_wins += weight;
            } else if v < 0 {
                st.follower_wins += weight;
            } else {
                st.draws += weight;
            }
            let n1 = 12 + p + U_VALUES[ui] - n0;
            let lr = n0 <= p;
            let fr = n1 <= p;
            if lr {
                st.leader_reachable += weight;
            }
            if fr {
                st.follower_reachable += weight;
            }
            if !lr && !fr {
                st.neither_reachable += weight;
            }
        }
    }
    st
}

/// Solves the top layer in chunks, optionally streaming the raw i16 table to
/// `out`, and gathers population statistics (only meaningful when k == 5).
pub fn build_top_layer(k: u32, lower: Option<&Layer>, mut out: Option<&mut dyn Write>, chunk_slots: usize) -> Stats {
    let t = Instant::now();
    let map = SlotMap::build(k);
    eprintln!(
        "layer {k}: {} raw pairs -> {} canonical slots ({:.1}s index)",
        pair_count(k),
        map.canon.len(),
        t.elapsed().as_secs_f64()
    );
    let t = Instant::now();
    let slots = map.canon.len();
    let mut buf = vec![NONE; chunk_slots * CELLS];
    let mut stats = Stats::default();
    let mut done = 0usize;
    while done < slots {
        let n = chunk_slots.min(slots - done);
        let chunk = &mut buf[..n * CELLS];
        chunk.par_chunks_mut(CELLS).enumerate().for_each(|(i, cells)| {
            let (h0, h1) = map.canon[done + i];
            compute_cells(h0, h1, k, lower, cells);
        });
        if k == 5 {
            let partial = chunk
                .par_chunks(CELLS)
                .enumerate()
                .map_init(
                    || Box::new([0u32; CELLS]),
                    |w, (i, cells)| {
                        let (h0, h1) = map.canon[done + i];
                        slot_stats(h0, h1, map.mult[done + i] as u64, cells, w)
                    },
                )
                .reduce(Stats::default, |mut a, b| {
                    a.add(&b);
                    a
                });
            stats.add(&partial);
        }
        if let Some(w) = out.as_mut() {
            let bytes: &[u8] = unsafe { std::slice::from_raw_parts(chunk.as_ptr() as *const u8, chunk.len() * 2) };
            w.write_all(bytes).expect("write table");
        }
        done += n;
        let el = t.elapsed().as_secs_f64();
        eprintln!(
            "layer {k}: {done}/{slots} slots ({:.1}%) {:.0}s elapsed, ETA {:.0}s",
            100.0 * done as f64 / slots as f64,
            el,
            el / done as f64 * (slots - done) as f64
        );
    }
    stats
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::naive;

    fn rng(x: &mut u64) -> u64 {
        *x ^= *x << 13;
        *x ^= *x >> 7;
        *x ^= *x << 17;
        *x
    }

    fn random_pair(x: &mut u64, k: u32) -> (u32, u32) {
        loop {
            let a = (rng(x) as u32) & FULL;
            let b = (rng(x) as u32) & FULL & !a;
            if a.count_ones() >= k && b.count_ones() >= k {
                let mut h0 = 0;
                let mut m = a;
                for _ in 0..k {
                    h0 |= 1 << m.trailing_zeros();
                    m &= m - 1;
                }
                let mut h1 = 0;
                let mut m = b;
                for _ in 0..k {
                    h1 |= 1 << m.trailing_zeros();
                    m &= m - 1;
                }
                return (h0, h1);
            }
        }
    }

    #[test]
    fn layers_match_naive_up_to_three_cards() {
        let l1 = build_layer(1, None);
        let l2 = build_layer(2, Some(&l1));
        let l3 = build_layer(3, Some(&l2));
        let mut x = 0x1234_5678_9abc_def1u64;
        for (k, layer) in [(1u32, &l1), (2, &l2), (3, &l3)] {
            for _ in 0..3000 {
                let (h0, h1) = random_pair(&mut x, k);
                let p = hand_points(h0 | h1);
                let ui = (rng(&mut x) % U_SLOTS as u64) as usize;
                let n0 = 1 + (rng(&mut x) % 66) as i32;
                let n1 = 12 + p + U_VALUES[ui] - n0;
                if !(1..=66).contains(&n1) {
                    continue;
                }
                let dp = layer.get(layer.map.slot(h0, h1), ui, n0) as i32;
                assert_eq!(dp, naive::solve(h0, h1, n0, n1), "k={k} h0={h0:#x} h1={h1:#x} n0={n0} n1={n1}");
            }
        }
        // 4-card cells computed on the fly from layer 3
        let mut cells = vec![NONE; CELLS];
        for _ in 0..300 {
            let (h0, h1) = random_pair(&mut x, 4);
            compute_cells(h0, h1, 4, Some(&l3), &mut cells);
            let p = hand_points(h0 | h1);
            for ui in 0..U_SLOTS {
                for n0 in 1..=66 {
                    let n1 = 12 + p + U_VALUES[ui] - n0;
                    let v = cells[ui * NEED_SLOTS + (n0 as usize - 1)];
                    if !(1..=66).contains(&n1) {
                        assert_eq!(v, NONE);
                    } else if rng(&mut x) % 40 == 0 {
                        assert_eq!(v as i32, naive::solve(h0, h1, n0, n1));
                    }
                }
            }
        }
    }
}
