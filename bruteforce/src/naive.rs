//! Straightforward recursive minimax, independent of the layered tables. Used to
//! validate the table builder. Value is from the LEADER's perspective:
//! outcome * 1000 + (leader's gain - follower's gain) over the remaining play.
use crate::cards::pts;
use crate::rules::{follower_wins, legal_follows};

pub fn solve(h0: u32, h1: u32, n0: i32, n1: i32) -> i32 {
    debug_assert!(n0 >= 1 && n1 >= 1);
    let last = h0.count_ones() == 1;
    let mut best = i32::MIN;
    let mut leads = h0;
    while leads != 0 {
        let c0 = leads.trailing_zeros();
        leads &= leads - 1;
        let mut worst = i32::MAX;
        let mut follows = legal_follows(c0, h1);
        while follows != 0 {
            let c1 = follows.trailing_zeros();
            follows &= follows - 1;
            let tp = pts(c0) + pts(c1);
            let v = if follower_wins(c0, c1) {
                if tp >= n1 || last {
                    -1000 - tp
                } else {
                    -solve(h1 & !(1 << c1), h0 & !(1 << c0), n1 - tp, n0) - tp
                }
            } else if tp >= n0 || last {
                1000 + tp
            } else {
                solve(h0 & !(1 << c0), h1 & !(1 << c1), n0 - tp, n1) + tp
            };
            worst = worst.min(v);
        }
        best = best.max(worst);
    }
    best
}
