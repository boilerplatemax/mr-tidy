// The pixel font: a hand-drawn bitmap alphabet. Every glyph is pixels drawn by hand, so text reads the same on every
// OS and stays legible at 240 lines: draw it 1:1 into a small canvas (HUD labels, the menu, or a canvas texture on a
// note in the world, nearest filtering) and scale up by whole numbers only, never down. Three hands share the glyphs:
//   'print'  type: dark, upright, no wobble (the HUD and menu use it with their own colour)
//   'pencil' handwriting: grey-blue, upright, a little uneven on the line
//   'ink'    a steady hand: oxblood, slanted (one pixel of lean every three rows)
// Unknown characters draw as '?'. Add glyphs to G: rows separated by |, # = a pixel.
// Cell height 9: rows 0–6 are capitals and digits, lowercase x-height is rows 2–6, descenders reach 7–8.

const G = {
  // ---- capitals (rows 0–6)
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#', B: '####.|#...#|#...#|####.|#...#|#...#|####.',
  C: '.###.|#...#|#....|#....|#....|#...#|.###.', D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
  E: '#####|#....|#....|####.|#....|#....|#####', F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.###.|#...#|#....|#.###|#...#|#...#|.###.', H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
  I: '###|.#.|.#.|.#.|.#.|.#.|###', J: '..###|...#.|...#.|...#.|...#.|#..#.|.##..',
  K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#', L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#', N: '#...#|##..#|#.#.#|#..##|#...#|#...#|#...#',
  O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.', P: '####.|#...#|#...#|####.|#....|#....|#....',
  Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#', R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.####|#....|#....|.###.|....#|....#|####.', T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
  U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.', V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
  W: '#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.', X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..', Z: '#####|....#|...#.|..#..|.#...|#....|#####',
  // ---- lowercase (a full 9-row cell: ascenders from row 0, x-height rows 2–6, descenders rows 7–8)
  a: '....|....|.##.|...#|.###|#..#|.###', b: '#...|#...|###.|#..#|#..#|#..#|###.',
  c: '....|....|.###|#...|#...|#...|.###', d: '...#|...#|.###|#..#|#..#|#..#|.###',
  e: '....|....|.##.|#..#|####|#...|.###', f: '..##|.#..|###.|.#..|.#..|.#..|.#..',
  g: '....|....|.###|#..#|#..#|#..#|.###|...#|.##.', h: '#...|#...|###.|#..#|#..#|#..#|#..#',
  i: '#|.|#|#|#|#|#', j: '..#|...|..#|..#|..#|..#|..#|#.#|.#.',
  k: '#...|#...|#..#|#.#.|##..|#.#.|#..#', l: '#.|#.|#.|#.|#.|#.|.#',
  m: '.....|.....|##.#.|#.#.#|#.#.#|#.#.#|#.#.#', n: '....|....|###.|#..#|#..#|#..#|#..#',
  o: '....|....|.##.|#..#|#..#|#..#|.##.', p: '....|....|###.|#..#|#..#|#..#|###.|#...|#...',
  q: '....|....|.###|#..#|#..#|#..#|.###|...#|...#', r: '....|....|#.##|##..|#...|#...|#...',
  s: '....|....|.###|#...|.##.|...#|###.', t: '.#.|.#.|###|.#.|.#.|.#.|..#',
  u: '....|....|#..#|#..#|#..#|#..#|.###', v: '.....|.....|#...#|#...#|.#.#.|.#.#.|..#..',
  w: '.....|.....|#...#|#...#|#.#.#|#.#.#|.#.#.', x: '....|....|#..#|#..#|.##.|#..#|#..#',
  y: '....|....|#..#|#..#|#..#|#..#|.###|...#|.##.', z: '....|....|####|...#|.##.|#...|####',
  // ---- digits and money
  0: '.##.|#..#|#..#|#..#|#..#|#..#|.##.', 1: '.#.|##.|.#.|.#.|.#.|.#.|###',
  2: '.##.|#..#|...#|..#.|.#..|#...|####', 3: '###.|...#|...#|.##.|...#|...#|###.',
  4: '..#.|.##.|#.#.|#.#.|####|..#.|..#.', 5: '####|#...|###.|...#|...#|#..#|.##.',
  6: '.##.|#...|#...|###.|#..#|#..#|.##.', 7: '####|...#|...#|..#.|.#..|.#..|.#..',
  8: '.##.|#..#|#..#|.##.|#..#|#..#|.##.', 9: '.##.|#..#|#..#|.###|...#|...#|.##.',
  $: '..#..|.####|#.#..|.###.|..#.#|####.|..#..',
  // ---- punctuation
  '.': '.|.|.|.|.|.|#', ',': '.|.|.|.|.|.|#|#', ':': '.|.|.|#|.|.|#', ';': '.|.|.|#|.|.|#|#',
  "'": '#|#', '`': '#.|.#', '"': '#.#|#.#', '-': '...|...|...|...|###', '–': '....|....|....|....|####', '—': '.....|.....|.....|.....|#####',
  '+': '...|...|.#.|###|.#.', '=': '...|...|...|###|...|###', '/': '..#|..#|.#.|.#.|.#.|#..|#..',
  '(': '.#|#.|#.|#.|#.|#.|.#', ')': '#.|.#|.#|.#|.#|.#|#.', '!': '#|#|#|#|#|.|#',
  '?': '.##.|#..#|...#|..#.|.#..|....|.#..', '#': '.#.#.|#####|.#.#.|.#.#.|#####|.#.#.', '%': '#...#|...#.|..#..|.#...|#...#',
  '×': '...|...|#.#|.#.|#.#', '·': '.|.|.|.|#', '&': '.##..|#..#.|.##..|#.#.#|#..#.|.##.#', '▸': '....|.#..|.##.|.###|.##.|.#..', // a "next" mark
  // arrows (direction hints, the settings' pickers)
  '<': '...|..#|.#.|#..|.#.|..#', '>': '...|#..|.#.|..#|.#.|#..', '[': '##|#.|#.|#.|#.|#.|##', ']': '##|.#|.#|.#|.#|.#|##',
  '←': '.......|..#....|.##....|#######|.##....|..#....', '→': '.......|....#..|....##.|#######|....##.|....#..',
  '↑': '..#..|.###.|#.#.#|..#..|..#..|..#..|..#..', '↓': '..#..|..#..|..#..|..#..|#.#.#|.###.|..#..',
  '↖': '####.|##...|#.#..|#..#.|....#', '↗': '.####|...##|..#.#|.#..#|#....', '↙': '....#|#..#.|#.#..|##...|####.', '↘': '#....|.#..#|..#.#|...##|.####',
};
const GLYPH = {};
for (const [ch, s] of Object.entries(G)) {
  const rows = s.split('|');
  GLYPH[ch] = { w: rows[0].length, rows };
}
const SPACE = 3, GAP = 1;
export const LINE = 11; // px between baselines (9-row cell + 2 leading)

export const HANDS = {
  print: { color: '#1b1714', slant: 0, wobble: 0 },
  pencil: { color: '#3b4252', slant: 0, wobble: 1 },
  ink: { color: '#6e1a12', slant: 3, wobble: 0 }, // leans right one px every 3 rows
};

/** Pixel width of a string in the hand (slant adds a pixel or two of lean, not counted). */
export function measure(text) {
  let w = 0;
  for (const ch of text) w += ch === ' ' ? SPACE : (GLYPH[ch] || GLYPH['?']).w + GAP;
  return Math.max(0, w - GAP);
}

// a stable per-character wobble (pencil handwriting rides the line a little): no Math.random, so pages never shimmer
const wob = (i, seed) => { const h = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453; const f = h - Math.floor(h); return f < 0.18 ? -1 : f > 0.86 ? 1 : 0; };

/**
 * Draw text into a 2D context at (x, y) = the top-left of the cell, in whole pixels. Returns the end x.
 * opts: hand ('print' | 'pencil' | 'ink'), color (override), seed (wobble), bold (doubled 1 px right).
 */
export function write(ctx, text, x, y, opts = {}) {
  const H = HANDS[opts.hand || 'print'];
  ctx.fillStyle = opts.color || H.color;
  let cx = Math.round(x), i = 0;
  const y0 = Math.round(y), seed = opts.seed ?? 1;
  for (const ch of text) {
    if (ch === ' ') { cx += SPACE; i++; continue; }
    const g = GLYPH[ch] || GLYPH['?'];
    const dy = H.wobble ? wob(i, seed) : 0;
    for (let r = 0; r < g.rows.length; r++) {
      const lean = H.slant ? Math.floor((6 - r) / H.slant) : 0; // the top leans right; the baseline (row 6) stays put
      const row = g.rows[r];
      for (let c = 0; c < row.length; c++) {
        if (row[c] !== '#') continue;
        ctx.fillRect(cx + c + lean, y0 + r + dy, opts.bold ? 2 : 1, 1);
      }
    }
    cx += g.w + GAP; i++;
  }
  return cx - GAP;
}

/** Break text into lines no wider than maxW px (words; a word longer than the line is left whole). */
export function wrap(text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const t = line ? `${line} ${word}` : word;
      if (line && measure(t) > maxW) { out.push(line); line = word; } else line = t;
    }
    out.push(line);
  }
  return out;
}

/** Right-align a string so it ends at x. */
export function writeRight(ctx, text, xRight, y, opts) { return write(ctx, text, xRight - measure(text), y, opts); }
