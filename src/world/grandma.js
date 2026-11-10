// Grandma and the win condition (build prompt 0.8, 7.1). grandmaWake runs 0–100, fills from knock-overs scaled by how
// close they are to her door, and never goes down. Snoring from behind the door lightens in stages, with a one-shot cue at
// each threshold. At 100: the strip of light snaps brighter, and the run ends in "Good Kitty."
import { TUNING } from '../data/tuning.js';
import { LEVEL } from '../data/level.js';
import { audio } from '../audio/audio.js';

const G = TUNING.grandma;
const CUES = ['grandma.snort', 'grandma.cough', 'grandma.creak'];

export class Grandma {
  /** noise: the Noise bus; house: for the door strip. onWin(): the moment she wakes. onScreen(): after the beat. */
  constructor({ noise, house }) {
    const D = LEVEL.grandmaDoor;
    this.house = house;
    this.door = { x: D.x, z: (D.zMin + D.zMax) / 2 };
    this.soundPos = { x: D.x + G.soundBehind, y: 0.5, z: this.door.z }; // behind the door, so the wall muffles it
    this.wake = 0; this.stage = 0; this.awake = false; this.t = 0; this.shown = false;
    this.voice = null; this.level = 0; this.levelT = 0;
    this.onWin = null; this.onScreen = null;
    this.free = G.freeKnocks; this.pianoLeft = G.pianoMax; this.pianoCd = 0;
    noise.on((ev) => { if (ev.kind !== 'crash') return; if (this.free > 0) { this.free--; return; } this.add(this.valueOf(ev.x, ev.z, ev.loud)); }); // (the first few she sleeps right through)
  }

  /** How many points a crash of this loudness is worth at this spot: closer to her door counts for more. */
  valueOf(x, z, loud) {
    const d = Math.hypot(x - this.door.x, z - this.door.z), near = 1 - Math.min(1, d / G.range);
    return loud * G.gain * (G.farScale + (G.nearScale - G.farScale) * near);
  }

  /** The stage for a wake value: 0 deep sleep .. 3 very light, 4 awake (the HUD icon reads this too). */
  stageOf(w) { return w >= 100 ? 4 : w >= G.thresholds[2] ? 3 : w >= G.thresholds[1] ? 2 : w >= G.thresholds[0] ? 1 : 0; }

  /** A cat on the piano: it's loud, and it stirs her a little (only a few times a night: you can't play her awake). Returns whether it counted. */
  piano() {
    if (this.pianoCd > 0 || this.pianoLeft <= 0) return false;
    this.pianoCd = G.pianoEvery; this.pianoLeft--; this.add(G.piano); return true;
  }

  /** Only ever adds: the meter never decreases. */
  add(points) {
    if (this.awake || points <= 0) return;
    this.wake = Math.min(100, this.wake + points);
    const s = this.stageOf(this.wake);
    if (s === this.stage) return;
    this.stage = s;
    if (s === 4) { this._wakeUp(); return; }
    audio.play(CUES[s - 1], { pos: this.soundPos, refDistance: G.refDistance, rolloff: G.rolloff });
    this._playSnore(G.crossfade);
  }

  _playSnore(fade) {
    this.voice?.stop(fade);
    this.voice = audio.play('grandma.snore' + this.stage, { pos: this.soundPos, fadeIn: fade, refDistance: G.refDistance, rolloff: G.rolloff });
    this.voice?.fadeTo(this.level, fade);
  }

  /** Back to sleep, for a new run. */
  reset() {
    this.wake = 0; this.stage = 0; this.awake = false; this.t = 0; this.shown = false; this.levelT = 0; this.free = G.freeKnocks; this.pianoLeft = G.pianoMax; this.pianoCd = 0;
    this.house.doorStrip.color.setHex(TUNING.house.colors.doorStrip);
    this.voice?.stop(0.05); this.voice = null;
    this.startSound();
  }

  /** Once audio exists (the first click). */
  startSound() { if (!this.awake) this._playSnore(1.5); }

  _wakeUp() {
    this.awake = true; this.t = 0;
    this.voice?.stop(0.15); this.voice = null;
    audio.play('grandma.wake', { pos: this.soundPos, refDistance: G.refDistance * 2, rolloff: G.rolloff });
    this.house.doorStrip.color.setHex(TUNING.house.colors.doorStripWake); // the light under the door snaps brighter
    this.onWin?.();
  }

  /** Is the cat near enough to the door? (px, pz: the cat.) */
  distanceTo(px, pz) { return Math.hypot(px - this.door.x, pz - this.door.z); }

  /** Per fixed tick. (px, pz): where the cat is. */
  tick(dt, px, pz) {
    if (this.pianoCd > 0) this.pianoCd -= dt;
    if (!this.awake && this.stage >= 2) { // she's coming up: at the last the lamp in there flickers
      if (this.stage === 3) this.house.doorStrip.color.setHex(Math.random() < 0.09 ? 0x5a4326 : TUNING.house.colors.doorStrip);
    }
    // DESIGN NOTE: the snoring is only heard near her door, so it marks the room rather than droning through the house.
    this.levelT -= dt;
    if (this.levelT <= 0 && !this.awake) {
      this.levelT = 0.2;
      this.level = 1 - Math.max(0, Math.min(1, (this.distanceTo(px, pz) - G.snoreNear) / (G.snoreFar - G.snoreNear)));
      this.voice?.fadeTo(this.level, 0.25);
    }
    if (!this.awake || this.shown || this.holdScreen) return;
    this.t += dt;
    if (this.t >= G.winBeat) { this.shown = true; this.onScreen?.(); }
  }
}
