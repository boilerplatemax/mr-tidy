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

// ---------------------------------------------------------------- footsteps (foot.<surface>, see TUNING.surfaces)
function footWood(sr) { // a hollow board: a low knock, a little grit, sometimes a creak
  const x = S.buffer(0.22, sr);
  S.mix(x, S.env(S.sine(S.buffer(0.2, sr), sr, (t) => 95 - 30 * t), sr, 0.002, 0.045), 0.9);
  S.mix(x, S.env(S.biquad(S.noise(S.buffer(0.12, sr)), sr, 'bp', rand(500, 900), 1.6), sr, 0.001, 0.03), 0.7);
  if (Math.random() < 0.35) S.mix(x, S.env(S.biquad(S.saw(S.buffer(0.12, sr), sr, (t) => 380 + 120 * Math.sin(t * 9)), sr, 'bp', 900, 3), sr, 0.02, 0.05), 0.12, Math.round(0.03 * sr));
  return S.declick(S.normalise(x, 0.85), sr);
}
function footGravel(sr) { // many tiny grains
  const x = S.buffer(0.2, sr);
  S.grains(x, sr, 26, 0.006, 0.09, 0.005);
  S.biquad(x, sr, 'hp', 1200); S.biquad(x, sr, 'lp', 6500);
  S.mix(x, S.env(S.sine(S.buffer(0.1, sr), sr, 70), sr, 0.002, 0.03), 0.35);
  return S.declick(S.normalise(x, 0.8), sr);
}
function footGrass(sr) { // a brushed swish over a light thud
  const x = S.env(S.biquad(S.biquad(S.noise(S.buffer(0.24, sr)), sr, 'bp', rand(900, 1500), 0.6), sr, 'lp', 2600), sr, 0.035, 0.06);
  S.mix(x, S.env(S.sine(S.buffer(0.1, sr), sr, 60), sr, 0.004, 0.03), 0.35);
  return S.declick(S.normalise(x, 0.55), sr);
}
function footMud(sr) { // a squelch, then the suck of the boot coming out
  const x = S.buffer(0.34, sr);
  S.mix(x, S.env(S.biquad(S.noise(S.buffer(0.3, sr)), sr, 'bp', (t) => 420 - 300 * t, 6), sr, 0.01, 0.09), 1);
  S.mix(x, S.env(S.biquad(S.noise(S.buffer(0.12, sr)), sr, 'bp', (t) => 300 + 900 * t, 5), sr, 0.03, 0.03), 0.5, Math.round(0.16 * sr));
  S.mix(x, S.env(S.sine(S.buffer(0.12, sr), sr, 55), sr, 0.004, 0.04), 0.4);
  return S.declick(S.normalise(x, 0.9), sr);
}
function footConcrete(sr) { // a hard, short heel tap with a gritty scuff
  const x = S.buffer(0.16, sr);
  S.mix(x, S.env(S.biquad(S.noise(S.buffer(0.06, sr)), sr, 'bp', rand(1800, 2600), 1.2), sr, 0.0005, 0.012), 1);
  S.mix(x, S.env(S.sine(S.buffer(0.08, sr), sr, (t) => 140 - 50 * t), sr, 0.001, 0.02), 0.5);
  S.mix(x, S.env(S.biquad(S.noise(S.buffer(0.1, sr)), sr, 'hp', 3000), sr, 0.01, 0.025), 0.15, Math.round(0.02 * sr));
  return S.declick(S.normalise(x, 0.7), sr);
}

// ---------------------------------------------------------------- small helpers
const thud = (sr, f = 80, len = 0.25, rattle = 0) => {
  const x = S.env(S.sine(S.buffer(len, sr), sr, (t) => f * (1 - 0.4 * t)), sr, 0.002, len / 4);
  S.mix(x, S.env(S.biquad(S.noise(S.buffer(len, sr)), sr, 'lp', 1800), sr, 0.001, 0.03), 0.6);
  if (rattle) S.grains(x, sr, 18 * rattle, 0.01, 0.15, 0.02);
  return S.declick(S.normalise(x, 0.9), sr);
};
const click = (sr, f = 2500, len = 0.05) => S.declick(S.normalise(S.env(S.biquad(S.noise(S.buffer(len, sr)), sr, 'bp', f, 2), sr, 0.0005, 0.008), 0.8), sr);
function switchClick(sr) { // a bakelite toggle: a click with a little body
  const x = S.buffer(0.12, sr);
  S.mix(x, click(sr, rand(1500, 1900), 0.04), 1);
  S.mix(x, S.env(S.sine(S.buffer(0.05, sr), sr, 220), sr, 0.001, 0.012), 0.3);
  return S.declick(S.normalise(x, 0.75), sr);
}
function knock(sr) { // three knocks on a wooden door, a little uneven
  const x = S.buffer(1.3, sr);
  for (let k = 0; k < 3; k++) {
    const at = Math.round((0.02 + k * rand(0.3, 0.36)) * sr);
    S.mix(x, S.env(S.sine(S.buffer(0.3, sr), sr, rand(150, 190)), sr, 0.001, 0.06), 0.9, at);
    S.mix(x, S.env(S.biquad(S.noise(S.buffer(0.12, sr)), sr, 'bp', rand(700, 1000), 3), sr, 0.001, 0.035), 0.7, at);
  }
  return S.declick(S.normalise(x, 0.85), sr);
}
function bulbHum(sr) { // mains hum with a faint filament buzz: a 2 s seamless loop
  const buzz = S.loopable(S.biquad(S.noise(S.buffer(2.25, sr)), sr, 'bp', 2400, 8), sr, 0.25); // 2.25 s − 0.25 s fade = 2 s
  const x = S.mix(S.sine(S.buffer(2, sr), sr, 100), buzz, 0.06);
  S.mix(x, S.sine(S.buffer(2, sr), sr, 200), 0.25);
  return S.normalise(x, 0.5); // (100 and 200 Hz both fit a whole number of cycles in 2 s: no click at the loop)
}
function wind(sr) { // airy band-limited noise with slow random gusts (a swept filter reads as "phasing": avoid)
  const x = S.noise(S.buffer(12, sr));
  S.biquad(x, sr, 'hp', 300, 0.5); S.biquad(x, sr, 'lp', 2200, 0.5);
  let g = 0.5, target = 0.5;
  const hold = Math.round(sr * 0.9);
  for (let i = 0; i < x.length; i++) {
    if (i % hold === 0) target = 0.3 + Math.random() * 0.7;
    g += (target - g) * (1.5 / sr);
    x[i] *= g;
  }
  return S.normalise(S.loopable(x, sr, 1.5), 0.6);
}

export const SOUNDS = {
  // footsteps: the player's own, never captioned
  'foot.concrete': { gen: v(footConcrete, 5), gain: 0.5 },
  'foot.wood': { gen: v(footWood, 5), gain: 0.55 },
  'foot.gravel': { gen: v(footGravel), gain: 0.5 },
  'foot.grass': { gen: v(footGrass), gain: 0.42 },
  'foot.mud': { gen: v(footMud), gain: 0.62 },
  'foot.land': { gen: v((sr) => thud(sr, 70, 0.25), 2), gain: 0.6 },
  // interaction feedback
  'item.denied': { gen: v((sr) => thud(sr, 60, 0.1), 1), gain: 0.25 }, // E refused (the prompt flashes why)
  'hold.tick': { gen: v((sr) => click(sr, 1800, 0.04), 3), gain: 0.25 }, // a hold filling: rising ticks
  'hold.done': { gen: v((sr) => thud(sr, 150, 0.2, 0.4), 1), gain: 0.5 },
  'switch.click': { gen: v(switchClick, 3), gain: 0.45 },
  // the demo's world sounds
  'lamp.hum': { gen: bulbHum, loop: true, gain: 0.12 }, // positional: play with { pos } or { follow }
  'demo.knock': { gen: v(knock, 3), gain: 0.8, subtitle: 'knocking' }, // a caption with a direction word
  'amb.wind': { gen: wind, loop: true, gain: 0.2, bus: 'bed' }, // the bed: muffled automatically indoors
};
