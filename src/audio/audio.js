// The audio engine. Web Audio graph:
//
//   voice: source → gain → occlusion low-pass → [HRTF panner] ─┬─ dry ──────────────→ bus (sfx | ambience | voice)
//                                                              ├─ send → indoor reverb ┐
//                                                              └─ send → outdoor reverb ┴→ sfx bus
//   ambience bus → duck gain → master;  bed (wind) → indoor low-pass crossfade → ambience bus
//   sfx + ambience + voice → master → compressor → speakers
//
// The AudioContext can only start inside a user gesture: call audio.start() from the first click (Input's
// 'firstClick'), which is also the click that grabs pointer lock. play() before that returns null (silently).
// Positional voices are re-checked for occlusion (colliders between listener and source) ~10×/s. A voice's reverb is
// chosen by where the SOURCE is: inside an indoor box → the room, outside → the open air.
import { TUNING } from '../data/tuning.js';
import { settings, onSettingsChange } from '../data/settings.js';
import { SOUNDS } from './sound-bank.js';

const A = TUNING.audio;

class Voice {
  constructor(engine, slotName, opts) {
    this.engine = engine; this.slot = slotName; this.opts = opts;
    const ctx = engine.ctx, def = SOUNDS[slotName];
    const bufs = engine.buffers.get(slotName);
    this.src = ctx.createBufferSource();
    this.src.buffer = bufs[Math.floor(Math.random() * bufs.length)];
    this.src.loop = opts.loop ?? !!def.loop;
    this.src.playbackRate.value = opts.rate ?? 1;
    this.gain = ctx.createGain();
    this.baseGain = (def.gain ?? 1) * (opts.gain ?? 1);
    this.gain.gain.value = opts.fadeIn ? 0 : this.baseGain;
    if (opts.fadeIn) this.gain.gain.setTargetAtTime(this.baseGain, ctx.currentTime, opts.fadeIn / 3);
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 20000;
    this.occl = ctx.createGain();
    this.src.connect(this.gain).connect(this.filter).connect(this.occl);
    let tail = this.occl;
    this.pos = opts.pos ? { x: opts.pos.x, y: opts.pos.y, z: opts.pos.z } : null;
    this.follow = opts.follow || null; // an Object3D to track
    if (this.pos || this.follow) {
      this.panner = ctx.createPanner();
      Object.assign(this.panner, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: opts.refDistance ?? A.refDistance, rolloffFactor: opts.rolloff ?? A.rolloff, maxDistance: A.maxDistance });
      tail.connect(this.panner);
      tail = this.panner;
      this.updatePosition();
    }
    tail.connect(engine.buses[opts.bus || def.bus || 'sfx']);
    this.sendIn = ctx.createGain(); this.sendOut = ctx.createGain();
    this.wet = opts.wet ?? 1; // × the zone's reverb send
    tail.connect(this.sendIn).connect(engine.reverbIndoor);
    tail.connect(this.sendOut).connect(engine.reverbOutdoor);
    this.setZone(this.pos ? engine.isIndoor(this.pos) : engine.listenerIndoor);
    this.occlTimer = Math.random() * A.occlusion.update;
    this.walls = -1;
    if (this.pos || this.follow) this.updateOcclusion(true);
    this.src.start(ctx.currentTime + (opts.delay || 0));
    this.ended = false;
    this.src.onended = () => { this.ended = true; this.dispose(); };
  }

  setZone(indoor) {
    const w = indoor ? 1 : 0;
    this.sendIn.gain.value = A.reverb.indoor.wet * w * this.wet;
    this.sendOut.gain.value = A.reverb.outdoor.wet * (1 - w) * this.wet;
  }

  updatePosition() {
    if (this.follow) { this.follow.getWorldPosition(this.engine._v); this.pos = this.pos || {}; this.pos.x = this.engine._v.x; this.pos.y = this.engine._v.y; this.pos.z = this.engine._v.z; }
    if (!this.panner || !this.pos) return;
    const p = this.panner;
    if (p.positionX) { p.positionX.value = this.pos.x; p.positionY.value = this.pos.y; p.positionZ.value = this.pos.z; }
    else p.setPosition(this.pos.x, this.pos.y, this.pos.z);
  }

  setPosition(x, y, z) { if (!this.pos) return; this.pos.x = x; this.pos.y = y; this.pos.z = z; this.updatePosition(); }

  updateOcclusion(immediate = false) {
    const e = this.engine;
    const walls = e.world ? e.world.countOccluders(e.listenerPos, this.pos, 2) : 0;
    if (walls === this.walls && !immediate) return;
    this.walls = walls;
    const t = e.ctx.currentTime, k = A.occlusion.smooth;
    const hz = A.occlusion.hz[walls], g = A.occlusion.gain[walls];
    if (immediate) { this.filter.frequency.value = hz; this.occl.gain.value = g; }
    else { this.filter.frequency.setTargetAtTime(hz, t, k); this.occl.gain.setTargetAtTime(g, t, k); }
    this.setZone(e.isIndoor(this.pos));
  }

  fadeTo(gainMul, seconds) {
    const t = this.engine.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setValueAtTime(this.gain.gain.value, t);
    this.gain.gain.linearRampToValueAtTime(this.baseGain * gainMul, t + Math.max(0.01, seconds));
  }

  /** Glide to a new playback rate (pitch) over this many seconds. */
  setRate(rate, seconds = 0.1) {
    const t = this.engine.ctx.currentTime;
    this.src.playbackRate.cancelScheduledValues(t);
    this.src.playbackRate.setTargetAtTime(rate, t, Math.max(0.005, seconds / 3));
  }

  stop(fade = 0.05) {
    if (this.ended) return;
    this.fadeTo(0, fade);
    try { this.src.stop(this.engine.ctx.currentTime + fade + 0.02); } catch { /* already stopped */ }
  }

  dispose() {
    try { this.src.disconnect(); this.gain.disconnect(); this.filter.disconnect(); this.occl.disconnect(); this.panner?.disconnect(); this.sendIn.disconnect(); this.sendOut.disconnect(); } catch { /* fine */ }
    this.engine.voices.delete(this);
  }
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.buffers = new Map();
    this.voices = new Set();
    this.world = null; // a CollisionWorld: colliders with occludes: true muffle sounds behind them
    this.indoorBoxes = []; // THREE.Box3[]: inside these, the indoor reverb and the muffled bed
    this.listenerPos = { x: 0, y: 1.6, z: 0 };
    this.listenerIndoor = false;
    this._v = null;
    this.duckers = 0;
    this.onStart = []; // fns run once the context exists (start your ambience loops here)
    this.onCaption = null; // (label, pos | null) for slots with a subtitle: wire to subtitles.sound
  }

  /** Must be called from a user gesture (the first click). Vector3: THREE.Vector3 (keeps this file free of three). */
  async start(Vector3) {
    if (this.ctx) return;
    this._v = new Vector3();
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    this.master = ctx.createGain();
    this.master.gain.value = A.master * settings.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.25;
    this.master.connect(comp).connect(ctx.destination);
    this.duck = ctx.createGain();
    this.duck.connect(this.master);
    this.buses = { sfx: ctx.createGain(), ambience: ctx.createGain(), voice: ctx.createGain(), bed: ctx.createGain() };
    this.buses.sfx.gain.value = A.buses.sfx;
    this.buses.voice.gain.value = A.buses.voice;
    this.buses.ambience.gain.value = A.buses.ambience;
    this.buses.sfx.connect(this.master);
    this.buses.voice.connect(this.master);
    this.buses.ambience.connect(this.duck);
    // Indoors the bed (wind) is heard through the walls. CROSSFADE to a fixed, pre-muffled copy rather than sweeping a
    // filter: a sweep sounds phased as you cross a doorway.
    this.bedDry = ctx.createGain();
    this.bedWet = ctx.createGain(); this.bedWet.gain.value = 0;
    this.bedFilter = ctx.createBiquadFilter();
    this.bedFilter.type = 'lowpass'; this.bedFilter.frequency.value = A.indoorBedHz; this.bedFilter.Q.value = 0.5;
    this.buses.bed.connect(this.bedDry).connect(this.buses.ambience);
    this.buses.bed.connect(this.bedFilter).connect(this.bedWet).connect(this.buses.ambience);
    this.reverbIndoor = this.makeReverb(A.reverb.indoor);
    this.reverbOutdoor = this.makeReverb(A.reverb.outdoor);
    this.reverbIndoor.connect(this.buses.sfx);
    this.reverbOutdoor.connect(this.buses.sfx);
    for (const [name, def] of Object.entries(SOUNDS)) this.buffers.set(name, this.render(def));
    onSettingsChange(() => { this.master.gain.setTargetAtTime(A.master * settings.volume, ctx.currentTime, 0.05); });
    this.ready = true;
    this.onStart.forEach((f) => f());
    this.loadFiles();
  }

  render(def) {
    const sr = A.sampleRate;
    let out = def.gen(sr);
    if (!Array.isArray(out)) out = [out];
    return out.map((data) => { const b = this.ctx.createBuffer(1, data.length, sr); b.copyToChannel(data, 0); return b; });
  }

  /** Swap generated placeholders for real files where a slot names them (files: [...]). */
  async loadFiles() {
    for (const [name, def] of Object.entries(SOUNDS)) {
      if (!def.files?.length) continue;
      try {
        const bufs = await Promise.all(def.files.map(async (f) => this.ctx.decodeAudioData(await (await fetch(f)).arrayBuffer())));
        this.buffers.set(name, bufs);
      } catch (e) { console.warn(`audio: ${name} file failed, keeping placeholder`, e); }
    }
  }

  makeReverb({ seconds, decay, tone }) {
    const ctx = this.ctx, sr = ctx.sampleRate, n = Math.round(seconds * sr);
    const ir = ctx.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let lp = 0;
      const a = Math.exp(-2 * Math.PI * tone / sr);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        lp = lp * a + (Math.random() * 2 - 1) * (1 - a);
        d[i] = lp * Math.pow(1 - t, decay) * (i < sr * 0.004 ? 0 : 1);
      }
      // a few discrete early reflections: the "close room" character
      for (let k = 0; k < 6; k++) { const i = Math.round(sr * (0.006 + k * 0.009 + Math.random() * 0.004)); if (i < n) d[i] += (Math.random() < 0.5 ? -1 : 1) * 0.5 / (k + 1); }
    }
    const conv = ctx.createConvolver();
    conv.normalize = true;
    conv.buffer = ir;
    return conv;
  }

  isIndoor(p) {
    for (const b of this.indoorBoxes) if (p.x > b.min.x && p.x < b.max.x && p.y > b.min.y && p.y < b.max.y && p.z > b.min.z && p.z < b.max.z) return true;
    return false;
  }

  /**
   * Play a slot. opts: pos {x,y,z} | follow Object3D (positional), gain, rate, loop, delay, fadeIn (s), bus,
   * wet (× reverb send), fallback (a slot to use if this one doesn't exist), caption (false: no auto subtitle).
   * Returns the Voice (stop(), fadeTo(), setPosition()), or null before audio has started.
   */
  play(slot, opts = {}) {
    if (!this.ready) return null;
    if (!SOUNDS[slot]) {
      if (opts.fallback && SOUNDS[opts.fallback]) slot = opts.fallback;
      else { console.warn(`audio: unknown slot ${slot}`); return null; }
    }
    const v = new Voice(this, slot, opts);
    this.voices.add(v);
    const cap = SOUNDS[slot].subtitle;
    if (cap && opts.caption !== false) this.onCaption?.(cap, v.pos);
    return v;
  }

  /** Ambience ducking under voices (refcounted: push when a line starts, pop when it ends). */
  pushDuck() { this.duckers++; this._duck(); }
  popDuck() { this.duckers = Math.max(0, this.duckers - 1); this._duck(); }
  _duck() {
    if (!this.ready) return;
    const t = this.ctx.currentTime, d = A.duck;
    this.duck.gain.setTargetAtTime(this.duckers ? d.gain : 1, t, (this.duckers ? d.attack : d.release) / 3);
  }

  /** Per frame: listener pose, occlusion, the indoor muffling of the bed. */
  update(dt, camera) {
    if (!this.ready) return;
    const ctx = this.ctx, L = ctx.listener;
    camera.getWorldPosition(this._v);
    const p = this.listenerPos;
    p.x = this._v.x; p.y = this._v.y; p.z = this._v.z;
    const e = camera.matrixWorld.elements; // forward = −Z column, up = Y column
    if (L.positionX) {
      L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z;
      L.forwardX.value = -e[8]; L.forwardY.value = -e[9]; L.forwardZ.value = -e[10];
      L.upX.value = e[4]; L.upY.value = e[5]; L.upZ.value = e[6];
    } else { L.setPosition(p.x, p.y, p.z); L.setOrientation(-e[8], -e[9], -e[10], e[4], e[5], e[6]); }
    const indoor = this.isIndoor(p);
    if (indoor !== this.listenerIndoor) {
      this.listenerIndoor = indoor;
      const t = ctx.currentTime, k = A.indoorFade / 3;
      this.bedDry.gain.setTargetAtTime(indoor ? 0 : 1, t, k);
      this.bedWet.gain.setTargetAtTime(indoor ? A.indoorBedLevel : 0, t, k);
    }
    for (const v of this.voices) {
      if (v.follow) v.updatePosition();
      if (!v.panner) continue;
      v.occlTimer -= dt;
      if (v.occlTimer <= 0) { v.occlTimer = A.occlusion.update; v.updateOcclusion(); }
    }
  }

  suspend() { this.ctx?.suspend(); }
  resume() { this.ctx?.resume(); }
}

export const audio = new AudioEngine();
