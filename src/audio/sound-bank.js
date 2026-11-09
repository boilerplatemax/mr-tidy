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

export const SOUNDS = {
  // the cat: never captioned
  'foot.carpet': { gen: v(pawCarpet, 4), gain: 0.3 },
  'foot.lino': { gen: v(pawLino, 4), gain: 0.26 },
  'foot.wood': { gen: v(pawWood, 4), gain: 0.3 },
  'foot.land': { gen: v((sr) => thud(sr, 120, 0.14), 2), gain: 0.4 }, // a soft landing
  'cat.grab': { gen: v((sr) => thud(sr, 240, 0.08), 2), gain: 0.3 }, // claws catch the edge
  'foot.thud': { gen: v((sr) => thud(sr, 62, 0.28), 2), gain: 0.75 }, // a big drop: the vac can hear this one
};
