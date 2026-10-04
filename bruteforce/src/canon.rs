//! Suit canonicalisation. Trump is suit 0 and stays put; the three non-trump
//! suits are interchangeable, so a pair of hands is mapped to the representative
//! whose non-trump suits are ordered by a 10-bit signature (leader's cards in
//! the low 5 bits, follower's in the high 5 bits), descending.

#[inline]
fn sig(h0: u32, h1: u32, s: u32) -> u32 {
    ((h0 >> (5 * s)) & 31) | (((h1 >> (5 * s)) & 31) << 5)
}

/// Canonical representative of the (leader, follower) hand pair.
#[inline]
pub fn canonical(h0: u32, h1: u32) -> (u32, u32) {
    let mut sigs = [sig(h0, h1, 1), sig(h0, h1, 2), sig(h0, h1, 3)];
    // sort 3 values descending
    if sigs[0] < sigs[1] {
        sigs.swap(0, 1);
    }
    if sigs[1] < sigs[2] {
        sigs.swap(1, 2);
    }
    if sigs[0] < sigs[1] {
        sigs.swap(0, 1);
    }
    let mut n0 = h0 & 31;
    let mut n1 = h1 & 31;
    for (i, s) in sigs.iter().enumerate() {
        n0 |= (s & 31) << (5 * (i + 1));
        n1 |= (s >> 5) << (5 * (i + 1));
    }
    (n0, n1)
}

#[inline]
pub fn is_canonical(h0: u32, h1: u32) -> bool {
    canonical(h0, h1) == (h0, h1)
}

/// Applies a permutation of the non-trump suits (perm[i] = new suit index for old suit i+1).
#[cfg(test)]
pub fn permute_suits(mask: u32, perm: [u32; 3]) -> u32 {
    let mut out = mask & 31;
    for (i, &to) in perm.iter().enumerate() {
        out |= ((mask >> (5 * (i + 1))) & 31) << (5 * to);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canonical_is_idempotent_and_permutation_invariant() {
        let perms = [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]];
        let mut x: u64 = 0x9E3779B97F4A7C15;
        for _ in 0..10_000 {
            x ^= x << 13;
            x ^= x >> 7;
            x ^= x << 17;
            let h0 = (x as u32) & crate::cards::FULL;
            let h1 = ((x >> 20) as u32) & crate::cards::FULL & !h0;
            let c = canonical(h0, h1);
            assert_eq!(canonical(c.0, c.1), c);
            for p in perms {
                assert_eq!(canonical(permute_suits(h0, p), permute_suits(h1, p)), c);
            }
        }
    }
}
