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

export const SOUNDS = {
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
  'vac.drone': { gen: drone, loop: true, gain: 0.75 },
  // Grandma: the snoring lightens through four stages; a cue marks each step toward waking
  'grandma.snore0': { gen: snore({ len: 3.4, f: 62, rasp: 1, air: 0.4, in: 0.5, out: 0.4, peak: 0.85 }), loop: true, gain: 0.9 },
  'grandma.snore1': { gen: snore({ len: 2.8, f: 72, rasp: 0.6, air: 0.5, in: 0.45, out: 0.4, peak: 0.6 }), loop: true, gain: 0.9 },
  'grandma.snore2': { gen: snore({ len: 3.2, f: 85, rasp: 0.25, air: 0.6, in: 0.3, out: 0.35, peak: 0.42 }), loop: true, gain: 0.9 },
  'grandma.snore3': { gen: snore({ len: 2.6, f: 100, rasp: 0.08, air: 0.7, in: 0.25, out: 0.3, peak: 0.26 }), loop: true, gain: 0.9 },
  'grandma.snort': { gen: v(snort, 2), gain: 1, subtitle: 'a loud snort' },
  'grandma.cough': { gen: v(cough, 2), gain: 1, subtitle: 'a cough' },
  'grandma.creak': { gen: v(creak, 2), gain: 1, subtitle: 'the bed creaks' },
  'grandma.wake': { gen: v(snort, 1), gain: 1.4, subtitle: 'a huge snort, then silence' },
  // the cat: never captioned
  'foot.carpet': { gen: v(pawCarpet, 4), gain: 0.3 },
  'foot.lino': { gen: v(pawLino, 4), gain: 0.26 },
  'foot.wood': { gen: v(pawWood, 4), gain: 0.3 },
  'foot.land': { gen: v((sr) => thud(sr, 120, 0.14), 2), gain: 0.4 }, // a soft landing
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
  'knock.thud': { gen: v((sr) => thud(sr, 95, 0.2, 0.3), 3), gain: 0.7 },
  'cat.dash': { gen: v((sr) => S.declick(S.normalise(S.env(S.biquad(S.noise(S.buffer(0.16, sr)), sr, 'bp', (t) => 1400 - 900 * t, 0.9), sr, 0.008, 0.05), 0.7), sr), 3), gain: 0.3 },
  'foot.thud': { gen: v((sr) => thud(sr, 62, 0.28), 2), gain: 0.75 }, // a big drop: the vac can hear this one
};
