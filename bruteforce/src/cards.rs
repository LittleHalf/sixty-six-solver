//! Card encoding shared with the TypeScript engine: `card = suit * 5 + rank`,
//! ranks in ascending strength J Q K 10 A (0..4). In this crate the TRUMP SUIT IS
//! ALWAYS SUIT 0 (bits 0..4); the other three suits are interchangeable.

pub const N: u32 = 20;
pub const FULL: u32 = (1 << N) - 1;
pub const PTS: [i32; 5] = [2, 3, 4, 10, 11];

/// "Points still needed" by a player ranges 1..=66 (0 inventory => needs 66).
pub const NEED_SLOTS: usize = 66;
/// Possible values of (face-up points + face-down points): sums of two card values.
pub const U_VALUES: [i32; 12] = [4, 5, 6, 7, 8, 12, 13, 14, 15, 20, 21, 22];
pub const U_SLOTS: usize = U_VALUES.len();

pub fn u_index(u: i32) -> Option<usize> {
    U_VALUES.iter().position(|&v| v == u)
}

#[inline]
pub fn pts(card: u32) -> i32 {
    PTS[(card % 5) as usize]
}

#[inline]
pub fn suit(card: u32) -> u32 {
    card / 5
}

#[inline]
pub fn suit_mask(s: u32) -> u32 {
    0x1F << (5 * s)
}

#[inline]
pub fn hand_points(mut mask: u32) -> i32 {
    let mut t = 0;
    while mask != 0 {
        let c = mask.trailing_zeros();
        t += pts(c);
        mask &= mask - 1;
    }
    t
}

// ---------------------------------------------------------------------------
// Binomials and subset ranking (colex / combinatorial number system)
// ---------------------------------------------------------------------------

const fn build_binom() -> [[u64; 21]; 21] {
    let mut b = [[0u64; 21]; 21];
    let mut n = 0;
    while n <= 20 {
        b[n][0] = 1;
        let mut k = 1;
        while k <= n {
            b[n][k] = b[n - 1][k - 1] + if k <= n - 1 { b[n - 1][k] } else { 0 };
            k += 1;
        }
        n += 1;
    }
    b
}

pub static BINOM: [[u64; 21]; 21] = build_binom();

#[inline]
pub fn binom(n: u32, k: u32) -> u64 {
    if k > n {
        0
    } else {
        BINOM[n as usize][k as usize]
    }
}

/// Colex rank of a subset given as a bitmask: sum over sorted positions p_i (i = 1..k) of C(p_i, i).
#[inline]
pub fn rank_subset(mut mask: u32) -> u32 {
    let mut r = 0u64;
    let mut i = 1;
    while mask != 0 {
        let p = mask.trailing_zeros();
        r += binom(p, i);
        i += 1;
        mask &= mask - 1;
    }
    r as u32
}

/// Colex rank of `sub` among subsets of `universe` (both bitmasks, sub ⊆ universe).
#[inline]
pub fn rank_in(mut sub: u32, universe: u32) -> u32 {
    let mut r = 0u64;
    let mut i = 1;
    while sub != 0 {
        let c = sub.trailing_zeros();
        let p = (universe & ((1u32 << c) - 1)).count_ones();
        r += binom(p, i);
        i += 1;
        sub &= sub - 1;
    }
    r as u32
}

/// Number of ordered (leader hand, follower hand) pairs of k-card hands.
pub fn pair_count(k: u32) -> usize {
    (binom(N, k) * binom(N - k, k)) as usize
}

/// Rank of an ordered pair of disjoint k-card hands in 0..pair_count(k).
#[inline]
pub fn pair_rank(h0: u32, h1: u32, k: u32) -> usize {
    rank_subset(h0) as usize * binom(N - k, k) as usize + rank_in(h1, FULL & !h0) as usize
}

/// Next subset with the same popcount in increasing numeric (= colex) order (Gosper's hack).
#[inline]
pub fn next_subset(x: u32) -> u32 {
    let c = x & x.wrapping_neg();
    let r = x + c;
    (((r ^ x) >> 2) / c) | r
}

/// Iterates all k-subsets of `universe` (a bitmask) in colex order of their rank within it.
pub fn subsets_of(universe: u32, k: u32) -> impl Iterator<Item = u32> {
    let positions: Vec<u32> = (0..N).filter(|&i| universe & (1 << i) != 0).collect();
    let n = positions.len() as u32;
    let mut idx = if k == 0 { 0 } else { (1u32 << k) - 1 };
    let limit = 1u32 << n;
    let mut done = k > n;
    std::iter::from_fn(move || {
        if done {
            return None;
        }
        let mut m = 0u32;
        let mut t = idx;
        while t != 0 {
            let i = t.trailing_zeros();
            m |= 1 << positions[i as usize];
            t &= t - 1;
        }
        if k == 0 {
            done = true;
        } else {
            idx = next_subset(idx);
            if idx >= limit {
                done = true;
            }
        }
        Some(m)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ranks_are_bijective() {
        for k in 1..=5 {
            let mut seen = vec![false; binom(N, k) as usize];
            for m in subsets_of(FULL, k) {
                let r = rank_subset(m) as usize;
                assert!(!seen[r]);
                seen[r] = true;
            }
            assert!(seen.iter().all(|&s| s));
        }
    }

    #[test]
    fn pair_ranks_follow_enumeration_order() {
        for k in 1..=4 {
            let mut counter = 0usize;
            for h0 in subsets_of(FULL, k) {
                for h1 in subsets_of(FULL & !h0, k) {
                    assert_eq!(pair_rank(h0, h1, k), counter);
                    counter += 1;
                }
            }
            assert_eq!(counter, pair_count(k));
        }
    }
}
