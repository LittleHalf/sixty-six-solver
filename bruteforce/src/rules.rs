//! Trick rules: must follow suit, must beat the led card if able, no obligation
//! to trump when void. Trump is suit 0.
use crate::cards::{suit, suit_mask};

/// Bitmask of the follower's legal cards against the led card `c0`.
#[inline]
pub fn legal_follows(c0: u32, hand: u32) -> u32 {
    let same = hand & suit_mask(suit(c0));
    if same != 0 {
        // bits strictly above c0 within the suit = higher ranks
        let higher = same & !((2u32 << c0) - 1);
        if higher != 0 {
            higher
        } else {
            same
        }
    } else {
        hand
    }
}

#[inline]
pub fn follower_wins(c0: u32, c1: u32) -> bool {
    if suit(c1) == suit(c0) {
        c1 > c0
    } else {
        suit(c1) == 0
    }
}
