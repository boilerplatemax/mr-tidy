// Player settings (comfort + controls). Persisted in localStorage under a versioned key, NOT in a save slot.
// Defaults are the AUTHORED look; "clean" is the comfort preset.
//
// Adding a setting: add it to DEFAULTS (old saved settings simply get the default). Changing what an existing
// setting means, or changing a default you want everyone to get: bump VERSION and add a migration below.
import { TUNING } from './tuning.js';

const VERSION = 3;
const KEY = `${TUNING.game.storagePrefix}.settings`;
const R = TUNING.render;

/** MIGRATIONS[n] turns a version-n settings object into version n + 1. Example for a future v2:
 *  1: (s) => ({ ...s, warp: false }), // v1 → v2: warp became off by default for everyone */
const MIGRATIONS = {
  2: (s) => ({ ...s, ...LOOK_PRESETS.authored, look: 'authored' }), // v2 → v3: the comfort look is gone: everyone is back on the PS1 look
  1: (s) => ({ ...s, jitter: false }), // v1 → v2: vertex wobble off by default (it made floor edges hop as the cat walked)
};

export const LOOK_PRESETS = {
  // the authored look: warp is OFF (it made doors and big walls swim); still available as a custom option
  // DESIGN NOTE: vertex wobble is off for Phase 1 (build prompt 0.2 makes it optional). Measured on a scripted walk, it
  // was the main source of floor edges hopping. It's one checkbox in Settings › Display; revisit with the final look.
  authored: { jitter: false, jitterAmount: 1, warp: false, warpAmount: 1, dither: true, ditherAmount: 1, colorBits: R.colorBits, lines: R.targetLines, supersample: 1 },
  // clean (comfort): no wobble, no dither, full colour, twice the lines, 2× supersample (stable thin details).
  // Still low-res and foggy: still the same game.
  clean: { jitter: false, jitterAmount: 1, warp: false, warpAmount: 1, dither: false, ditherAmount: 1, colorBits: 8, lines: R.targetLines * 2, supersample: 2 },
};

const DEFAULTS = {
  look: 'authored', // 'authored' | 'clean' | 'custom' (any single look option changed)
  ...LOOK_PRESETS.authored,
  framing: '4:3', // '4:3' (the design: pillarboxed) | 'fill' (widescreen, same line count)
  brightness: 1.0, // display gamma lift, 0.7–1.6
  sensitivity: 1.0,
  invertY: false,
  headBob: true,
  pawMode: 'natural',
  tailPeek: true, // the tail shows at the edge of the view as you turn (an experiment) // always-visible paws while walking (an experiment: P cycles)
  subtitles: true, // captions for speech and important sounds
  volume: 1.0,
};

function load() {
  try {
    let raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object') {
      for (let v = Number(raw._v) || 1; v < VERSION; v++) raw = MIGRATIONS[v] ? MIGRATIONS[v](raw) : raw;
      delete raw._v;
      return { ...DEFAULTS, ...raw };
    }
  } catch { /* private window or broken JSON: use defaults */ }
  return { ...DEFAULTS };
}

export const settings = load();
const listeners = new Set();

/** fn(settings) after every change. Returns an unsubscribe function. */
export function onSettingsChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function setSetting(key, value) {
  settings[key] = value;
  if (key in LOOK_PRESETS.authored) settings.look = 'custom';
  save();
}

export function applyLookPreset(name) {
  Object.assign(settings, LOOK_PRESETS[name], { look: name });
  save();
}

export function resetSettings() { Object.assign(settings, DEFAULTS); save(); }

function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ ...settings, _v: VERSION })); } catch { /* storage blocked: settings last this session */ }
  for (const fn of listeners) fn(settings);
}
