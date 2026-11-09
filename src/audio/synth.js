// Tiny offline DSP for PLACEHOLDER sounds. Everything renders to mono Float32Arrays at the tuning sample rate
// (22.05 kHz: the lo-fi feel). Real recordings replace these via the slot's `files` (src/audio/sound-bank.js).
// Building blocks: buffer, noise, brown, sine, saw (sources); biquad, env, declick, normalise (shaping);
// mix, grains, loopable (assembly). A frequency argument may be a function of t (0..1) for sweeps.

export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);

export function buffer(seconds, sr) { return new Float32Array(Math.max(1, Math.round(seconds * sr))); }

export function noise(out) { for (let i = 0; i < out.length; i++) out[i] = Math.random() * 2 - 1; return out; }

export function brown(out) { let v = 0; for (let i = 0; i < out.length; i++) { v = (v + (Math.random() * 2 - 1) * 0.06) * 0.996; out[i] = v * 3; } return out; }

/** RBJ biquad, in place. type: 'lp' | 'hp' | 'bp'. f may be a function of t (0..1) for sweeps. */
export function biquad(x, sr, type, f, q = 0.707) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const n = x.length;
  let b0, b1, b2, a1, a2;
  const coef = (fr) => {
    const w = 2 * Math.PI * Math.min(fr, sr * 0.45) / sr, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q);
    let B0, B1, B2;
    if (type === 'lp') { B0 = (1 - c) / 2; B1 = 1 - c; B2 = (1 - c) / 2; }
    else if (type === 'hp') { B0 = (1 + c) / 2; B1 = -(1 + c); B2 = (1 + c) / 2; }
    else { B0 = al; B1 = 0; B2 = -al; }
    const A0 = 1 + al;
    b0 = B0 / A0; b1 = B1 / A0; b2 = B2 / A0; a1 = (-2 * c) / A0; a2 = (1 - al) / A0;
  };
  const sweep = typeof f === 'function';
  coef(sweep ? f(0) : f);
  for (let i = 0; i < n; i++) {
    if (sweep && (i & 31) === 0) coef(f(i / n));
    const y = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y;
    x[i] = y;
  }
  return x;
}

/** Multiply by an attack/exponential-decay envelope. */
export function env(x, sr, attack, decay, start = 0) {
  const s0 = Math.round(start * sr), a = Math.max(1, attack * sr);
  for (let i = 0; i < x.length; i++) {
    const t = i - s0;
    if (t < 0) { x[i] = 0; continue; }
    const e = t < a ? t / a : Math.exp(-(t - a) / (decay * sr));
    x[i] *= e;
  }
  return x;
}

export function sine(out, sr, freq, phase = 0) {
  let p = phase;
  for (let i = 0; i < out.length; i++) {
    const f = typeof freq === 'function' ? freq(i / out.length) : freq;
    p += (2 * Math.PI * f) / sr;
    out[i] = Math.sin(p);
  }
  return out;
}

export function saw(out, sr, freq) {
  let p = 0;
  for (let i = 0; i < out.length; i++) {
    const f = typeof freq === 'function' ? freq(i / out.length) : freq;
    p = (p + f / sr) % 1;
    out[i] = p * 2 - 1;
  }
  return out;
}

export function mix(into, src, gain = 1, offset = 0) {
  for (let i = 0; i < src.length && i + offset < into.length; i++) into[i + offset] += src[i] * gain;
  return into;
}

export function normalise(x, peak = 0.9) {
  let m = 0;
  for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]));
  if (m > 0) for (let i = 0; i < x.length; i++) x[i] *= peak / m;
  return x;
}

/** Short random grains (crunch, crackle). */
export function grains(x, sr, count, grainSec, spreadSec, offsetSec = 0) {
  const g = new Float32Array(Math.round(grainSec * sr));
  for (let k = 0; k < count; k++) {
    noise(g);
    env(g, sr, 0.0005, grainSec / 4);
    mix(x, g, rand(0.3, 1), Math.round((offsetSec + Math.random() * spreadSec) * sr));
  }
  return x;
}

/** Make a buffer loop seamlessly by crossfading its tail into its head. */
export function loopable(x, sr, fadeSec = 0.25) {
  const f = Math.min(Math.round(fadeSec * sr), Math.floor(x.length / 3));
  const out = x.slice(0, x.length - f);
  for (let i = 0; i < f; i++) { // equal-power crossfade: no level dip at the loop point
    const t = i / f;
    out[i] = out[i] * Math.sqrt(t) + x[x.length - f + i] * Math.sqrt(1 - t);
  }
  return out;
}

/** Fade the ends to avoid clicks. */
export function declick(x, sr, sec = 0.004) {
  const n = Math.min(Math.round(sec * sr), x.length >> 1);
  for (let i = 0; i < n; i++) { const g = i / n; x[i] *= g; x[x.length - 1 - i] *= g; }
  return x;
}
