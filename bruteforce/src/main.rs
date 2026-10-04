mod canon;
mod cards;
mod layers;
mod naive;
mod rules;

use cards::{hand_points, pts, suit, u_index, NEED_SLOTS, U_VALUES};
use layers::{build_layer, build_top_layer, compute_cells, Layer, SlotMap, CELLS, NONE};
use std::fs::File;
use std::io::{BufRead, BufReader, BufWriter, Read, Seek, SeekFrom, Write};
use std::time::Instant;

fn usage() -> ! {
    eprintln!(
        "usage:\n  sixtysix build [--top K] [--out FILE] [--chunk SLOTS]\n      solve every position bottom-up; K defaults to 5; --out streams the top layer to FILE\n  sixtysix check FILE\n      compare against positions exported by scripts/export-positions.ts\n  sixtysix query TABLE \"<leader hand>\" \"<follower hand>\" UP DOWN LEADER_SCORE FOLLOWER_SCORE\n      e.g. query out/layer5.i16 \"AS 10S KS QS JS\" \"AH 10H KH QH JH\" AD 10D 28 12\n  sixtysix solve \"<leader hand>\" \"<follower hand>\" UP DOWN LEADER_SCORE FOLLOWER_SCORE\n      solve one position directly (no table needed)"
    );
    std::process::exit(2)
}

/// Relabels suits so that `t` becomes suit 0 and the others keep their order as 1..3.
fn relabel(mask: u32, t: u32) -> u32 {
    let mut out = 0;
    for s in 0..4u32 {
        let bits = (mask >> (5 * s)) & 31;
        let ns = if s == t {
            0
        } else if s < t {
            s + 1
        } else {
            s
        };
        out |= bits << (5 * ns);
    }
    out
}

/// Parses "AS", "10H", "th" ... in the TypeScript engine's encoding (C D H S = 0..3).
fn parse_card(s: &str) -> u32 {
    let s = s.trim().to_uppercase();
    let (rank, suit_ch) = s.split_at(s.len() - 1);
    let r = match rank {
        "J" => 0,
        "Q" => 1,
        "K" => 2,
        "10" | "T" => 3,
        "A" => 4,
        _ => panic!("bad rank in {s}"),
    };
    let su = match suit_ch {
        "C" => 0,
        "D" => 1,
        "H" => 2,
        "S" => 3,
        _ => panic!("bad suit in {s}"),
    };
    su * 5 + r
}

fn parse_hand(s: &str) -> u32 {
    s.split(|c: char| c == ' ' || c == ',').filter(|t| !t.is_empty()).fold(0, |m, t| m | (1 << parse_card(t)))
}

struct Position {
    h0: u32, // leader, trump already relabelled to suit 0
    h1: u32,
    ui: usize,
    n0: i32,
    n1: i32,
    s0: i32,
    s1: i32,
}

fn position_from_args(args: &[String]) -> Position {
    if args.len() < 6 {
        usage();
    }
    let up = parse_card(&args[2]);
    let down = parse_card(&args[3]);
    let t = suit(up);
    let h0 = relabel(parse_hand(&args[0]), t);
    let h1 = relabel(parse_hand(&args[1]), t);
    let s0: i32 = args[4].parse().expect("leader score");
    let s1: i32 = args[5].parse().expect("follower score");
    assert_eq!(h0 & h1, 0, "hands overlap");
    assert_eq!(h0.count_ones(), h1.count_ones(), "hands must be the same size");
    assert_eq!((h0 | h1) & (1 << relabel(1 << up, t).trailing_zeros()), 0, "face-up card is in a hand");
    let u = pts(up) + pts(down);
    let p = hand_points(h0 | h1);
    assert_eq!(s0 + s1 + p + u, 120, "scores + hands + stock must total 120 points; check the inventories");
    let n0 = 66 - s0;
    let n1 = 66 - s1;
    assert!((1..=66).contains(&n0) && (1..=66).contains(&n1), "a player already has 66");
    Position { h0, h1, ui: u_index(u).unwrap(), n0, n1, s0, s1 }
}

fn report(p: &Position, v: i32) {
    let outcome = if v > 0 { "leader wins" } else if v < 0 { "follower wins" } else { "draw" };
    // v = outcome * 1000 + (leader gain - follower gain); the gain part is |v| mod 1000 with v's sign.
    let gain = v - (v / 1000) * 1000;
    println!("value {v}: {outcome}; final margin (leader - follower) = {}", (p.s0 - p.s1) + gain);
}

fn cmd_build(args: &[String]) {
    let mut top = 5u32;
    let mut out: Option<String> = None;
    let mut chunk = 1 << 16;
    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--top" => {
                top = args[i + 1].parse().unwrap();
                i += 2;
            }
            "--out" => {
                out = Some(args[i + 1].clone());
                i += 2;
            }
            "--chunk" => {
                chunk = args[i + 1].parse().unwrap();
                i += 2;
            }
            _ => usage(),
        }
    }
    let t0 = Instant::now();
    let mut lower: Option<Layer> = None;
    for k in 1..top {
        lower = Some(build_layer(k, lower.as_ref()));
    }
    let mut file = out.as_ref().map(|p| BufWriter::with_capacity(1 << 24, File::create(p).expect("create output")));
    let writer: Option<&mut dyn Write> = file.as_mut().map(|f| f as &mut dyn Write);
    let st = build_top_layer(top, lower.as_ref(), writer, chunk);
    if let Some(mut f) = file {
        f.flush().unwrap();
    }
    if let Some(p) = &out {
        let meta = format!(
            "layer={top}\ncells_per_slot={CELLS}\nu_values={:?}\nneed_slots={NEED_SLOTS}\nvalue=i16 little endian, outcome*1000 + (leader gain - follower gain), {NONE} = unused\nindex=(slot*{CELLS} + u_index*{NEED_SLOTS} + (leader_need-1))*2 bytes\n",
            U_VALUES
        );
        std::fs::write(format!("{p}.meta"), meta).unwrap();
    }
    eprintln!("total time {:.1}s", t0.elapsed().as_secs_f64());
    if top == 5 {
        let f = |n: u64| format!("{n} ({:.2}%)", 100.0 * n as f64 / st.positions.max(1) as f64);
        println!("positions represented (trump fixed, leader first): {}", st.positions);
        println!("  x8 for all trump suits and both leaders:      {}", st.positions * 8);
        println!("leader wins:    {}", f(st.leader_wins));
        println!("follower wins:  {}", f(st.follower_wins));
        println!("draws:          {}", f(st.draws));
        println!("leader can reach 66:   {}", f(st.leader_reachable));
        println!("follower can reach 66: {}", f(st.follower_reachable));
        println!("neither can reach 66:  {}", f(st.neither_reachable));
    }
}

fn build_lower_layers(top: u32) -> Option<Layer> {
    let mut lower: Option<Layer> = None;
    for k in 1..top {
        lower = Some(build_layer(k, lower.as_ref()));
    }
    lower
}

fn cmd_check(args: &[String]) {
    if args.is_empty() {
        usage();
    }
    let file = BufReader::new(File::open(&args[0]).expect("open positions file"));
    let lines: Vec<Vec<i64>> = file
        .lines()
        .map(|l| l.unwrap())
        .filter(|l| !l.trim().is_empty() && !l.starts_with('#'))
        .map(|l| l.split_whitespace().map(|t| t.parse::<i64>().unwrap()).collect())
        .collect();
    let k = (lines[0][0] as u32).count_ones();
    let lower = build_lower_layers(k);
    let mut cells = vec![NONE; CELLS];
    let mut bad = 0;
    let t = Instant::now();
    for (i, l) in lines.iter().enumerate() {
        // h0 h1 trump up down s0 s1 leader expected   (TypeScript encoding, P0 perspective)
        let (h0, h1, trump, up, down, s0, s1, leader, expected) =
            (l[0] as u32, l[1] as u32, l[2] as u32, l[3] as u32, l[4] as u32, l[5] as i32, l[6] as i32, l[7], l[8] as i32);
        let (lh, fh, ls) = if leader == 0 { (h0, h1, s0) } else { (h1, h0, s1) };
        let lh = relabel(lh, trump);
        let fh = relabel(fh, trump);
        let ui = u_index(pts(up) + pts(down)).unwrap();
        let n0 = 66 - ls;
        compute_cells(lh, fh, k, lower.as_ref(), &mut cells);
        let v = cells[ui * NEED_SLOTS + (n0 as usize - 1)] as i32;
        let ts = if leader == 0 { (s0 - s1) + v } else { (s0 - s1) - v };
        if ts != expected {
            bad += 1;
            if bad <= 10 {
                eprintln!("MISMATCH line {}: got {ts} (table value {v}), expected {expected}", i + 1);
            }
        }
    }
    println!("checked {} positions in {:.1}s: {} mismatches", lines.len(), t.elapsed().as_secs_f64(), bad);
    if bad > 0 {
        std::process::exit(1);
    }
}

fn cmd_solve(args: &[String]) {
    let p = position_from_args(args);
    let t = Instant::now();
    let v = naive::solve(p.h0, p.h1, p.n0, p.n1);
    report(&p, v);
    eprintln!("({:.2} ms)", t.elapsed().as_secs_f64() * 1000.0);
}

fn cmd_query(args: &[String]) {
    if args.len() < 7 {
        usage();
    }
    let p = position_from_args(&args[1..]);
    let k = p.h0.count_ones();
    let map = SlotMap::build(k);
    let slot = map.slot(p.h0, p.h1) as u64;
    let offset = (slot * CELLS as u64 + (p.ui * NEED_SLOTS) as u64 + (p.n0 as u64 - 1)) * 2;
    let mut f = File::open(&args[0]).expect("open table");
    f.seek(SeekFrom::Start(offset)).unwrap();
    let mut b = [0u8; 2];
    f.read_exact(&mut b).unwrap();
    let v = i16::from_le_bytes(b) as i32;
    assert!(v != NONE as i32, "unused cell");
    report(&p, v);
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.is_empty() {
        usage();
    }
    match args[0].as_str() {
        "build" => cmd_build(&args[1..]),
        "check" => cmd_check(&args[1..]),
        "query" => cmd_query(&args[1..]),
        "solve" => cmd_solve(&args[1..]),
        _ => usage(),
    }
}
