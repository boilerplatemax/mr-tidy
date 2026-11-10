// The sound bank: every sound has a NAMED SLOT. Gameplay only ever plays slot names (audio.play('foot.wood')).
// Each slot: gen (a placeholder generator → one or more variants, picked at random per play), optional files to
// replace it, gain (linear), loop, bus ('sfx' | 'ambience' | 'voice' | 'bed'), and subtitle (a caption label for
// sounds the player must notice; null/absent = never captioned).
//
// To swap in a real recording: files: ['game-assets/audio/foot/wood_1.ogg', ...]. The generator stays as the
// fallback if a file fails to load. Keep recordings mono; the engine positions them in 3D.
import * as S from './synth.js';

const { rand } = S;
const v = (fn, n = 4) => (sr) => Array.from({ length: n }, () => fn(sr)); // n random variants

// ---------------------------------------------------------------- cat footsteps (foot.<surface>, see TUNING.surfaces)
function pawCarpet(sr) { // a soft low pat
  const x = S.buffer(0.09, sr);
  S.mix(x, S.env(S.sine(S.buffer(0.08, sr), sr, (t) => 130 - 50 * t), sr, 0.002, 0.02), 0.9);
  S.mix(x, S.env(S.biquad(S.noise(S.buffer(0.05, sr)), sr, 'lp', 900), sr, 0.001, 0.012), 0.4);
  return S.declick(S.normalise(x, 0.7), sr);
}
function pawLino(sr) { // a light tap with a tick of claw
  const x = S.buffer(0.07, sr);
  S.mix(x, S.env(S.biquad(S.noise(S.buffer(0.04, sr)), sr, 'bp', rand(2400, 3400), 2), sr, 0.0005, 0.006), 0.9);
  S.mix(x, S.env(S.sine(S.buffer(0.05, sr), sr, 190), sr, 0.001, 0.012), 0.5);
  return S.declick(S.normalise(x, 0.65), sr);
}
function pawWood(sr) { // a small hollow knock
  const x = S.buffer(0.09, sr);
  S.mix(x, S.env(S.sine(S.buffer(0.08, sr), sr, (t) => 210 - 70 * t), sr, 0.001, 0.018), 0.9);
  S.mix(x, S.env(S.biquad(S.noise(S.buffer(0.05, sr)), sr, 'bp', rand(700, 1200), 2), sr, 0.001, 0.01), 0.45);
  return S.declick(S.normalise(x, 0.7), sr);
}

// ---------------------------------------------------------------- small helpers
const thud = (sr, f = 80, len = 0.25, rattle = 0) => {
  const x = S.env(S.sine(S.buffer(len, sr), sr, (t) => f * (1 - 0.4 * t)), sr, 0.002, len / 4);
  S.mix(x, S.env(S.biquad(S.noise(S.buffer(len, sr)), sr, 'lp', 1800), sr, 0.001, 0.03), 0.6);
  if (rattle) S.grains(x, sr, 18 * rattle, 0.01, 0.15, 0.02);
  return S.declick(S.normalise(x, 0.9), sr);
};

// ---------------------------------------------------------------- Grandma (placeholders)
// One slow breath: a raspy inhale and an airy exhale, silent at both ends so it loops cleanly.
const snore = (o) => (sr) => {
  const n = Math.round(o.len * sr), x = new Float32Array(n);
  const rasp = S.biquad(S.saw(S.buffer(o.len, sr), sr, (t) => o.f * (0.85 + 0.3 * Math.sin(t * Math.PI))), sr, 'bp', o.f * 3, 1.6);
  const air = S.biquad(S.noise(S.buffer(o.len, sr)), sr, 'lp', 700);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const inhale = t < o.in ? Math.pow(Math.sin((Math.PI * t) / o.in), 1.5) : 0;
    const exhale = t >= o.in && t < o.in + o.out ? Math.sin((Math.PI * (t - o.in)) / o.out) : 0;
    x[i] = rasp[i] * inhale * o.rasp + air[i] * (exhale + inhale * 0.3) * o.air;
  }
  return S.normalise(x, o.peak);
};
const snort = (sr) => {
  const x = S.buffer(0.5, sr);
  S.mix(x, S.env(S.biquad(S.saw(S.buffer(0.32, sr), sr, (t) => 95 + 60 * t), sr, 'bp', 320, 1.2), sr, 0.01, 0.1), 1);
  S.mix(x, S.env(S.biquad(S.noise(S.buffer(0.3, sr)), sr, 'lp', 900), sr, 0.005, 0.08), 0.6);
  return S.declick(S.normalise(x, 0.9), sr);
};
const cough = (sr) => {
  const x = S.buffer(0.7, sr);
  for (const at of [0, 0.26]) S.mix(x, S.env(S.biquad(S.noise(S.buffer(0.2, sr)), sr, 'bp', rand(480, 620), 1.5), sr, 0.003, 0.05), 1, Math.round(at * sr));
  return S.declick(S.normalise(x, 0.85), sr);
};
const creak = (sr) => S.declick(S.normalise(S.env(S.biquad(S.saw(S.buffer(0.7, sr), sr, (t) => 70 + 45 * Math.sin(t * 11)), sr, 'bp', 780, 5), sr, 0.03, 0.25), 0.7), sr);

// ---------------------------------------------------------------- Mr. Tidy's motor (a placeholder)
function drone(sr) { // a 2 s seamless loop: built 0.25 s long, then the tail is crossfaded into the head. Every tone fits a whole number of cycles in 2 s, so they line up
  const n = S.buffer(2.25, sr);
  S.mix(n, S.saw(S.buffer(2.25, sr), sr, 74), 0.4);
  S.mix(n, S.saw(S.buffer(2.25, sr), sr, 111), 0.22);
  S.mix(n, S.sine(S.buffer(2.25, sr), sr, 37), 0.55);
  S.biquad(n, sr, 'lp', 900, 0.9);
  S.mix(n, S.biquad(S.biquad(S.noise(S.buffer(2.25, sr)), sr, 'hp', 500), sr, 'lp', 3400), 0.32);
  return S.normalise(S.loopable(n, sr, 0.25), 0.8);
}

// ---------------------------------------------------------------- horror: the shriek and the stingers (all generated)
/** One scream. len: s. pitch(u): Hz at u seconds. amp(u): 0..1. voices: [detune, level] pairs. wobble: [Hz, depth]. rasp: how much growl. */
function scream(sr, { len, pitch, amp = () => 1, voices = [[1, 1], [1.016, 0.7], [0.985, 0.7], [1.49, 0.35], [0.5, 0.5]], wobble = [rand(11, 16), 0.045], rasp = 0.45, bright = 0 }) {
  const out = S.buffer(len, sr);
  for (const [det, g] of voices) S.mix(out, S.saw(S.buffer(len, sr), sr, (t) => { const u = t * len; return Math.max(30, pitch(u) * det * (1 + wobble[1] * Math.sin(u * wobble[0] * 6.283) + 0.03 * Math.sin(u * 37 + det * 9))); }), g);
  const growl = S.sine(S.buffer(len, sr), sr, rand(68, 92));
  for (let i = 0; i < out.length; i++) out[i] *= 1 - rasp + rasp * growl[i]; // a ring of low growl through it
  const a = S.biquad(out.slice(), sr, 'bp', (t) => 1100 + 500 * Math.sin(t * 9) + bright, 3.5), b = S.biquad(out.slice(), sr, 'bp', (t) => 2500 + 700 * t + bright, 4), c = S.biquad(out.slice(), sr, 'bp', 3700 + bright, 5);
  const x = new Float32Array(out.length);
  S.mix(x, a, 1); S.mix(x, b, 0.8); S.mix(x, c, 0.5);
  S.mix(x, S.biquad(S.noise(S.buffer(len, sr)), sr, 'bp', (t) => 1800 + 1800 * t, 0.9), 0.55); // breath
  for (let i = 0; i < x.length; i++) { const u = i / sr, e = amp(u) * (0.86 + 0.14 * Math.sin(u * 53)); x[i] = Math.tanh(x[i] * 2.4 * e); }
  return S.declick(S.normalise(x, 0.98), sr);
}
const edges = (len, on = 0.05, off = 0.55) => (u) => Math.min(1, u / on) * (u > len - off ? Math.pow(Math.max(0, len - u) / off, 1.5) : 1);
/** Eight different throats: he never screams quite the same way twice in a row. */
const SCREAMS = [
  (sr) => { const len = 1.9, T = rand(0.2, 0.3), top = rand(1050, 1300), end = rand(560, 760); return scream(sr, { len, amp: edges(len), pitch: (u) => (u < T ? 320 + (top - 320) * Math.pow(u / T, 0.6) : top + (end - top) * Math.pow((u - T) / (len - T), 1.4)) }); }, // tears open and sags
  (sr) => { const len = 2.7, top = rand(950, 1150); return scream(sr, { len, amp: edges(len, 0.25, 0.7), wobble: [rand(6, 8), 0.06], pitch: (u) => (u < 1.8 ? 280 + (top - 280) * Math.pow(u / 1.8, 1.5) : top * (1 - 0.3 * (u - 1.8) / 0.9)) }); }, // a long climbing wail
  (sr) => { const len = 1.8, base = rand(880, 1150), e = edges(len, 0.02, 0.2); return scream(sr, { len, pitch: (u) => base * (1 + 0.28 * ((u * 4.4) % 1)), amp: (u) => e(u) * (((u * 4.4) % 1) < 0.7 ? 1 : 0.04) }); }, // gasping, in short stabs
  (sr) => { const len = 2.2, jump = rand(0.6, 0.8), top = rand(1100, 1350); return scream(sr, { len, rasp: 0.75, amp: edges(len), pitch: (u) => (u < jump ? rand(130, 150) * (1 + 0.1 * Math.sin(u * 9)) : top * (1 - 0.35 * (u - jump) / (len - jump))) }); }, // a growl that breaks upward
  (sr) => { const len = 1.9, base = rand(620, 800); return scream(sr, { len, rasp: 0.7, wobble: [rand(24, 30), 0.13], amp: edges(len), pitch: (u) => base * (1 + 0.25 * Math.sin(u * 2.7)) }); }, // choking, wet, bubbling
  (sr) => { const len = 2.1, drawn = 0.75, top = rand(1200, 1450); return scream(sr, { len, bright: 400, wobble: [13, 0.03], pitch: (u) => (u < drawn ? 900 * (0.5 + 0.6 * u) : top * (1 - 0.22 * (u - drawn) / (len - drawn))), amp: (u) => (u < drawn ? 0.05 + 0.3 * (u / drawn) : Math.min(1, (u - drawn) / 0.03)) * (u > len - 0.06 ? 0 : 1) }); }, // draws breath, then screams and stops dead
  (sr) => { const len = 1.1, top = rand(1400, 1700); return scream(sr, { len, bright: 700, wobble: [17, 0.05], amp: edges(len, 0.02, 0.22), pitch: (u) => top * (1 - 0.2 * u) }); }, // short, right at the top of his range
  (sr) => { const len = 2.3, a = rand(900, 1100); return scream(sr, { len, voices: [[1, 1], [0.97, 0.6]], amp: edges(len, 0.08, 0.6), pitch: (u) => a * (1 + 0.42 * Math.sin(u * 2.2)) * (1 + 0.06 * Math.sin(u * 41)) }); }, // two notes sliding through each other, off-key
];
/** Talking in her sleep: a few soft syllables, mostly vowel. */
function mumble(sr) {
  const n = 1.3, x = S.buffer(n, sr);
  S.mix(x, S.saw(S.buffer(n, sr), sr, (t) => 150 + 30 * Math.sin(t * 8)), 1);
  S.biquad(x, sr, 'bp', (t) => 500 + 350 * Math.sin(t * 19), 3);
  for (let i = 0; i < x.length; i++) { const t = i / x.length; x[i] *= Math.abs(Math.sin(t * 14)) * Math.sin(Math.PI * t); }
  return S.declick(S.normalise(x, 0.7), sr);
}
/** A soft padded landing: a low pat, nothing jarring. */
function catLand(sr) {
  const x = S.buffer(0.16, sr);
  S.mix(x, S.env(S.sine(S.buffer(0.14, sr), sr, (t) => 92 - 34 * t), sr, 0.006, 0.04), 1);
  S.mix(x, S.env(S.biquad(S.noise(S.buffer(0.08, sr)), sr, 'lp', 520), sr, 0.004, 0.018), 0.4);
  return S.declick(S.normalise(x, 0.7), sr);
}
/** The laugh when he has you: slow, wet, far too deep, with something high screaming underneath. */
function evilLaugh(sr) {
  const hits = Math.floor(rand(5, 7.99)), gap = rand(0.27, 0.34), len = hits * gap + 1.0, x = S.buffer(len, sr), base = rand(86, 104);
  for (let h = 0; h < hits; h++) {
    const f0 = base * (1 - 0.055 * h) * (h === hits - 1 ? 0.8 : 1), dur = h === hits - 1 ? 0.95 : gap * 0.82;
    const v = S.buffer(dur, sr);
    S.mix(v, S.saw(S.buffer(dur, sr), sr, (t) => f0 * (1.22 - 0.3 * t)), 1);
    S.mix(v, S.saw(S.buffer(dur, sr), sr, (t) => f0 * 0.5 * (1.22 - 0.3 * t)), 0.8);
    S.mix(v, S.saw(S.buffer(dur, sr), sr, (t) => f0 * 1.51 * (1.2 - 0.3 * t)), 0.3);
    const a = S.biquad(v.slice(), sr, 'bp', (t) => 700 - 260 * t, 3), b = S.biquad(v.slice(), sr, 'bp', (t) => 1250 - 300 * t, 4);
    const m = new Float32Array(v.length); S.mix(m, a, 1); S.mix(m, b, 0.7);
    for (let i = 0; i < m.length; i++) { const t = i / m.length; m[i] = Math.tanh(m[i] * 5 * Math.min(1, t * 14) * Math.pow(1 - t, 0.7)); }
    S.mix(x, m, 1, Math.round(h * gap * sr));
  }
  const top = S.saw(S.buffer(len, sr), sr, (t) => 1500 + 500 * t + 90 * Math.sin(t * 90));
  S.biquad(top, sr, 'bp', 3000, 3);
  for (let i = 0; i < top.length; i++) { const t = i / top.length; top[i] *= t * t * 0.3; }
  S.mix(x, top, 1);
  return S.declick(S.normalise(x, 0.98), sr);
}
/** The house's power being dragged out through the walls: a hum climbing to a scream, crackling. */
function surgeBuzz(sr) {
  const n = 2.4, x = S.buffer(n, sr);
  for (const [r, g] of [[1, 1], [2, 0.7], [3.02, 0.45]]) S.mix(x, S.saw(S.buffer(n, sr), sr, (t) => 60 * r * (1 + 3.2 * t * t)), g);
  S.biquad(x, sr, 'bp', (t) => 400 + 2400 * t, 0.9);
  S.grains(x, sr, 90, 0.008, n - 0.1, 0);
  for (let i = 0; i < x.length; i++) { const t = i / x.length; x[i] = Math.tanh(x[i] * (0.8 + 2 * t)) * (t > 0.97 ? (1 - t) / 0.03 : 1); }
  return S.declick(S.normalise(x, 0.95), sr);
}

/** He's seen you: a cluster of strings stabbing in, sliding up against itself, over a thump. */
function stingSpot(sr) {
  const x = S.buffer(1.5, sr);
  for (const f of [233, 247, 349, 370, 466, 494, 698]) {
    const v = S.saw(S.buffer(1.5, sr), sr, (t) => f * (1 + 0.035 * t * t + 0.004 * Math.sin(t * 90)));
    S.env(v, sr, 0.012, 0.42);
    S.mix(x, v, 0.38);
  }
  S.biquad(x, sr, 'bp', (t) => 2100 - 1300 * t, 0.7);
  S.mix(x, S.env(S.sine(S.buffer(0.5, sr), sr, (t) => 62 - 26 * t), sr, 0.004, 0.16), 2.0);
  return S.declick(S.normalise(x, 0.95), sr);
}
/** A high scrape, sliding down: two strings sawing against each other. */
function stingScrape(sr) {
  const x = S.buffer(1.3, sr), f0 = rand(1500, 1900);
  for (const d of [1, 1.03]) { const v = S.saw(S.buffer(1.3, sr), sr, (t) => f0 * d * (1 - 0.32 * t) * (1 + 0.012 * Math.sin(t * 150))); S.env(v, sr, 0.02, 0.4); S.mix(x, v, 1); }
  S.biquad(x, sr, 'hp', 900);
  return S.declick(S.normalise(x, 0.8), sr);
}
/** Low horns, a fifth apart and a semitone wrong, swelling and cut off. */
function stingBrass(sr) {
  const x = S.buffer(1.4, sr), base = rand(82, 98);
  for (const r of [1, 1.5, 1.06, 2.12]) S.mix(x, S.saw(S.buffer(1.4, sr), sr, (t) => base * r * (1 + 0.05 * t)), 0.6);
  S.biquad(x, sr, 'lp', (t) => 500 + 1900 * Math.min(1, t * 2.5), 1.4);
  for (let i = 0; i < x.length; i++) { const t = i / x.length; x[i] *= Math.min(1, t * 8) * Math.pow(1 - t, 1.6); }
  return S.declick(S.normalise(x, 0.9), sr);
}
/** A piano struck with both forearms, right down at the bottom. */
function stingPiano(sr) {
  const x = S.buffer(1.6, sr), base = rand(52, 62);
  for (const r of [1, 1.06, 1.41, 1.5, 2.83, 3.0]) { const f = base * r; for (const h of [1, 2, 3.01, 4.03]) { const v = S.sine(S.buffer(1.6, sr), sr, f * h); S.env(v, sr, 0.003, 0.5 / h); S.mix(x, v, 0.5 / h); } }
  return S.declick(S.normalise(x, 0.92), sr);
}
/** Struck metal: partials that don't add up to a note. */
function stingMetal(sr) {
  const x = S.buffer(1.2, sr), base = rand(320, 420);
  for (const r of [1, 1.59, 2.14, 2.83, 3.74, 5.2]) { const v = S.sine(S.buffer(1.2, sr), sr, base * r * rand(0.99, 1.01)); S.env(v, sr, 0.002, 0.36 / Math.sqrt(r)); S.mix(x, v, 1 / Math.sqrt(r)); }
  S.mix(x, S.env(S.sine(S.buffer(0.3, sr), sr, 55), sr, 0.003, 0.1), 1.1);
  return S.declick(S.normalise(x, 0.85), sr);
}
/** He heard something: low and close, two notes rubbing together, swelling and gone. */
function stingHeard(sr) {
  const n = 1.1, x = S.buffer(n, sr);
  for (const [f, g] of [[58, 1], [61.5, 0.9], [116, 0.4], [174, 0.18]]) S.mix(x, S.sine(S.buffer(n, sr), sr, f), g);
  S.mix(x, S.biquad(S.noise(S.buffer(n, sr)), sr, 'lp', 300), 0.5);
  for (let i = 0; i < x.length; i++) { const t = i / x.length; x[i] *= Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15)), 1.6); }
  return S.declick(S.normalise(x, 0.85), sr);
}

export const SOUNDS = {
  'vac.shriek': { gen: (sr) => SCREAMS.map((f) => f(sr)), gain: 1.15, subtitle: 'a tearing shriek', bus: 'voice' },
  'sting.spot': { gen: (sr) => [stingSpot(sr), stingSpot(sr), stingScrape(sr), stingScrape(sr), stingBrass(sr), stingBrass(sr), stingPiano(sr), stingPiano(sr), stingMetal(sr), stingMetal(sr)], gain: 0.9, subtitle: 'a sudden stab of music', bus: 'voice' },
  'sting.heard': { gen: v(stingHeard, 3), gain: 0.5, bus: 'voice' },
  'vac.listen': { gen: (sr) => { const x = S.buffer(0.45, sr); S.grains(x, sr, 5, 0.006, 0.06, 0); S.biquad(x, sr, 'bp', 2100, 2); S.mix(x, S.env(S.saw(S.buffer(0.42, sr), sr, (t) => 150 - 95 * t), sr, 0.005, 0.14), 0.5); return S.declick(S.normalise(x, 0.7), sr); }, gain: 0.55, subtitle: 'the motor drops, listening' },
  'vac.stun': { gen: v((sr) => { const x = thud(sr, 110, 0.3, 0.6); S.mix(x, S.env(S.saw(S.buffer(0.3, sr), sr, (t) => 220 - 170 * t), sr, 0.005, 0.12), 0.35); return S.normalise(x, 0.9); }, 2), gain: 0.9, subtitle: 'a clang, and the motor stutters' },
  'vac.laugh': { gen: v(evilLaugh, 4), gain: 1.5, subtitle: 'a slow, wet laugh', bus: 'voice' },
  'vac.surgeBuzz': { gen: surgeBuzz, gain: 1.1, subtitle: 'the house hums, louder and louder', bus: 'voice' },
  'power.out': { gen: (sr) => { const x = thud(sr, 48, 0.7, 0.8); S.mix(x, S.env(S.saw(S.buffer(0.9, sr), sr, (t) => 120 - 100 * t), sr, 0.004, 0.3), 0.5); return S.normalise(x, 0.95); }, gain: 1.2, subtitle: 'the power goes out' },
  'vac.arc': { gen: (sr) => { const x = S.buffer(1.3, sr); S.grains(x, sr, 44, 0.006, 1.25, 0); S.biquad(x, sr, 'hp', 1800); S.mix(x, S.saw(S.buffer(1.3, sr), sr, 100), 0.05); return S.normalise(S.loopable(x, sr, 0.2), 0.6); }, loop: true, gain: 0.3 },
  'tv.show': { gen: (sr) => { const x = S.buffer(3.2, sr), notes = [523, 659, 784, 659, 880, 784, 659, 523]; notes.forEach((f, i) => { const v = S.env(S.saw(S.buffer(0.34, sr), sr, f), sr, 0.005, 0.12); S.mix(x, S.biquad(v, sr, 'lp', 1400), 0.8, Math.round(i * 0.38 * sr)); }); return S.declick(S.normalise(x, 0.5), sr); }, gain: 0.5, subtitle: 'a cheerful little jingle' },
  'grandma.mumble1': { gen: (sr) => mumble(sr), gain: 0.5, subtitle: '"...Biscuit?..."' },
  'grandma.mumble2': { gen: (sr) => mumble(sr), gain: 0.5, subtitle: '"...who\'s there..."' },
  'amb.clock': { gen: (sr) => { const x = S.buffer(2, sr); for (const [at, f] of [[0.02, 2600], [1.02, 2100]]) S.mix(x, S.env(S.biquad(S.noise(S.buffer(0.04, sr)), sr, 'bp', f, 7), sr, 0.0005, 0.008), 1, Math.round(at * sr)); return S.normalise(x, 0.6); }, loop: true, gain: 0.32 },
  'amb.static': { gen: (sr) => S.normalise(S.loopable(S.biquad(S.noise(S.buffer(1.5, sr)), sr, 'hp', 2200), sr, 0.25), 0.5), loop: true, gain: 0.16 },
  'vac.creep': { gen: (sr) => { const x = S.buffer(1.6, sr); S.grains(x, sr, 30, 0.02, 1.5, 0); S.biquad(x, sr, 'bp', 900, 1.2); S.mix(x, S.biquad(S.noise(S.buffer(1.6, sr)), sr, 'bp', 420, 3), 0.3); return S.normalise(S.loopable(x, sr, 0.25), 0.5); }, loop: true, gain: 0.5, subtitle: 'something sliding, slowly' },
  'vac.exhale': { gen: (sr) => S.declick(S.normalise(S.env(S.biquad(S.noise(S.buffer(1.8, sr)), sr, 'bp', (t) => 300 + 1500 * (1 - t), 0.7), sr, 0.04, 0.8), 0.95), sr), gain: 1.1, subtitle: 'a great gust of dust' },
  'vac.unplug': { gen: v((sr) => { // a crackling pop as the plug comes out
    const x = S.buffer(0.3, sr);
    S.grains(x, sr, 20, 0.008, 0.14, 0);
    S.biquad(x, sr, 'hp', 1800);
    S.mix(x, S.env(S.sine(S.buffer(0.14, sr), sr, (t) => 240 - 180 * t), sr, 0.001, 0.05), 0.9);
    return S.declick(S.normalise(x, 0.9), sr);
  }, 2), gain: 0.9, subtitle: 'a spark' },
  'vac.power': { gen: (sr) => S.declick(S.normalise(S.env(S.saw(S.buffer(0.7, sr), sr, (t) => 40 + 90 * t), sr, 0.2, 0.3), 0.7), sr), gain: 0.55, subtitle: 'a motor starting' },
  'vac.slurp': { gen: (sr) => S.normalise(S.loopable(S.biquad(S.biquad(S.noise(S.buffer(1.25, sr)), sr, 'bp', (t) => 700 + 500 * Math.sin(t * 19), 2.5), sr, 'lp', 2600), sr, 0.25), 0.7), loop: true, gain: 0.55 },
  'vac.surge': { gen: (sr) => S.declick(S.normalise(S.env(S.biquad(S.saw(S.buffer(0.5, sr), sr, (t) => 70 + 130 * t), sr, 'lp', 1200), sr, 0.03, 0.18), 0.85), sr), gain: 0.7, subtitle: 'the motor surges' },
  'vac.rattle': { gen: (sr) => { const x = S.buffer(1.2, sr); S.grains(x, sr, 64, 0.012, 1.15, 0); S.biquad(x, sr, 'bp', 1500, 1.4); return S.normalise(S.loopable(x, sr, 0.2), 0.8); }, loop: true, gain: 0.85, subtitle: 'the hose rattles' },
  'vac.slap': { gen: v((sr) => thud(sr, 150, 0.16, 0.5), 2), gain: 0.85, subtitle: 'the hose slaps down' },
  'vac.fwoomp': { gen: (sr) => { // a huge suction burst
    const x = S.buffer(0.75, sr);
    S.mix(x, S.env(S.biquad(S.noise(S.buffer(0.7, sr)), sr, 'bp', (t) => 300 + 2400 * t * t, 0.8), sr, 0.02, 0.28), 1);
    S.mix(x, S.env(S.sine(S.buffer(0.5, sr), sr, (t) => 50 + 180 * t), sr, 0.005, 0.2), 0.9);
    return S.declick(S.normalise(x, 0.98), sr);
  }, gain: 1.5 },
  'vac.cough': { gen: (sr) => S.declick(S.normalise(S.env(S.biquad(S.saw(S.buffer(0.65, sr), sr, (t) => 60 + 70 * t), sr, 'bp', (t) => 400 + 900 * t, 2), sr, 0.15, 0.5), 0.8), sr), gain: 0.85, subtitle: 'a wheezing cough' },
  'vac.spit': { gen: v((sr) => S.declick(S.normalise(S.env(S.biquad(S.noise(S.buffer(0.25, sr)), sr, 'bp', (t) => 1400 - 900 * t, 1), sr, 0.005, 0.08), 0.95), sr), 2), gain: 1 },
  'dust.hit': { gen: v((sr) => S.declick(S.normalise(S.env(S.biquad(S.noise(S.buffer(0.3, sr)), sr, 'lp', 1600), sr, 0.002, 0.1), 0.8), sr), 2), gain: 0.65 },
  'cat.sneeze': { gen: v((sr) => { const x = S.buffer(0.32, sr); S.mix(x, S.env(S.biquad(S.noise(S.buffer(0.1, sr)), sr, 'bp', 1200, 2), sr, 0.03, 0.04), 0.5); S.mix(x, S.env(S.biquad(S.noise(S.buffer(0.2, sr)), sr, 'bp', 3200, 1.2), sr, 0.002, 0.05), 1, Math.round(0.1 * sr)); return S.declick(S.normalise(x, 0.9), sr); }, 2), gain: 0.9 },
  'vac.drone': { gen: drone, loop: true, gain: 0.75 },
  // Grandma: the snoring lightens through four stages; a cue marks each step toward waking
  'grandma.snore0': { gen: snore({ len: 3.4, f: 62, rasp: 1, air: 0.4, in: 0.5, out: 0.4, peak: 0.85 }), loop: true, gain: 0.3 },
  'grandma.snore1': { gen: snore({ len: 2.8, f: 72, rasp: 0.6, air: 0.5, in: 0.45, out: 0.4, peak: 0.6 }), loop: true, gain: 0.3 },
  'grandma.snore2': { gen: snore({ len: 3.2, f: 85, rasp: 0.25, air: 0.6, in: 0.3, out: 0.35, peak: 0.42 }), loop: true, gain: 0.3 },
  'grandma.snore3': { gen: snore({ len: 2.6, f: 100, rasp: 0.08, air: 0.7, in: 0.25, out: 0.3, peak: 0.26 }), loop: true, gain: 0.3 },
  'grandma.snort': { gen: v(snort, 2), gain: 1, subtitle: 'a loud snort' },
  'grandma.cough': { gen: v(cough, 2), gain: 1, subtitle: 'a cough' },
  'grandma.creak': { gen: v(creak, 2), gain: 1, subtitle: 'the bed creaks' },
  'grandma.wake': { gen: v(snort, 1), gain: 1.4, subtitle: 'a huge snort, then silence' },
  // the cat: never captioned
  'foot.carpet': { gen: v(pawCarpet, 4), gain: 0.3 },
  'foot.lino': { gen: v(pawLino, 4), gain: 0.26 },
  'foot.wood': { gen: v(pawWood, 4), gain: 0.3 },
  'foot.land': { gen: v(catLand, 3), gain: 0.11 }, // a soft landing
  'cat.grab': { gen: v((sr) => thud(sr, 240, 0.08), 2), gain: 0.3 }, // claws catch the edge
  'cat.huff': { gen: v((sr) => thud(sr, 180, 0.1), 1), gain: 0.2 }, // a held jump given up
  'paw.swipe': { gen: v((sr) => S.declick(S.normalise(S.env(S.biquad(S.noise(S.buffer(0.12, sr)), sr, 'bp', (t) => 900 + 1800 * t, 1.2), sr, 0.02, 0.03), 0.6), sr), 3), gain: 0.22 },
  'knock.clink': { gen: v((sr) => S.declick(S.normalise(S.env(S.biquad(S.noise(S.buffer(0.07, sr)), sr, 'bp', rand(1800, 3000), 5), sr, 0.0005, 0.016), 0.8), sr), 4), gain: 0.4 },
  'knock.break': { gen: v((sr) => {
    const x = S.buffer(0.32, sr);
    S.grains(x, sr, 34, 0.012, 0.16, 0.0);
    S.biquad(x, sr, 'hp', 1400);
    S.mix(x, S.env(S.sine(S.buffer(0.14, sr), sr, 150), sr, 0.001, 0.03), 0.5);
    return S.declick(S.normalise(x, 0.9), sr);
  }, 4), gain: 0.85 },
  'knock.squeak': { gen: v((sr) => S.declick(S.normalise(S.env(S.sine(S.buffer(0.2, sr), sr, (t) => 1500 + 900 * Math.sin(t * 3.1)), sr, 0.01, 0.07), 0.7), sr), 2), gain: 0.5 },
  'knock.thud': { gen: v((sr) => thud(sr, 95, 0.2, 0.3), 3), gain: 0.7 },
  'cat.dash': { gen: v((sr) => S.declick(S.normalise(S.env(S.biquad(S.noise(S.buffer(0.16, sr)), sr, 'bp', (t) => 1400 - 900 * t, 0.9), sr, 0.008, 0.05), 0.7), sr), 3), gain: 0.3 },
  'foot.thud': { gen: v(catLand, 3), gain: 0.34 }, // a big drop: the vac can hear this one
};
