// Clip capture: plays a scripted scene (capture/scenarios/<name>.js) with the real game, frame by frame, for videos to
// post. Only loaded with ?capture=<name> (see main.js); nothing here runs in a normal game.
//
// The recorder (Tools/clips/record.mjs) drives it: __cap.step() advances exactly one video frame (the fixed ticks that
// frame owes, then the draw), and it screenshots the page after each. Sound is rendered by an OfflineAudioContext that
// is stepped along with the frames, so however slowly the frames are taken, the sound lines up exactly.
//
// URL: ?capture=<name>&fps=30&hud=0&wm=1&seed=7
//   hud=1 keeps the to-do list, Grandma's meter and the stamina moon (off by default); wm=0 drops the watermark.
// A scenario's script gets `c` (below): waits, walking, looking, jumping, swiping, Mr. Tidy's controls, film cameras and
// on-screen captions. Inputs go through the same Input the player uses: the cat really moves, collides and animates.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { LEVEL } from '../data/level.js';
import { audio } from '../audio/audio.js';
import { pixText } from '../ui/menu.js';

const STEP = TUNING.loop.step, J = TUNING.jump;
const SR = 48000, Q = 128; // offline audio: sample rate; the render quantum it can suspend on
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const yawTo = (fx, fz, tx, tz) => Math.atan2(-(tx - fx), -(tz - fz)); // (forward is (−sin yaw, −cos yaw))

function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export async function startCapture(kit, params) {
  const name = params.get('capture'), fps = Number(params.get('fps')) || 30;
  const until = (f, max = 60000) => new Promise((ok, no) => { const t0 = performance.now(), c = () => (f() ? ok() : performance.now() - t0 > max ? no(new Error('timed out waiting')) : setTimeout(c, 50)); c(); });
  const sc = (await import(`../../capture/scenarios/${name}.js?v=${Date.now()}`)).default;
  await until(() => window.__revealed);
  Math.random = mulberry32(Number(params.get('seed')) || sc.seed || 7); // (the same scene, the same way, every time)
  kit.loop.stop();
  if (params.get('hud') !== '1') { const st = document.createElement('style'); st.textContent = '.hud-todo,.hud-wake,.hud-stamina,.hud-room{visibility:hidden!important}'; document.head.append(st); }
  const overlay = makeOverlay(params.get('wm') !== '0');

  // the sound: an offline context as long as the scene (and a little over), stepped with the frames
  const seconds = sc.seconds + 1;
  const actx = new OfflineAudioContext(2, Math.ceil(seconds * SR), SR);
  audio.offline = true;
  await audio.start(kit.camera.position.constructor, actx);
  let rendering = null;
  const qt = (t) => (Math.ceil((t * SR) / Q) * Q) / SR;

  kit.resetRun();
  kit.input.keys.clear();
  const c = new Director(kit, overlay, fps);
  kit.capHook = (cam, dt) => c.film(cam, dt);
  const oldTick = kit.loop.tick;
  kit.loop.tick = (dt) => { c.preTick(dt); oldTick(dt); };
  await sc.setup?.(c);
  kit.player.render(1);
  let failed = null;
  const script = Promise.resolve().then(() => sc.script(c)).then(() => { c.over = true; }, (e) => { failed = e; c.over = true; });

  let frame = 0;
  window.__cap = {
    ready: true, fps, name, title: sc.title || name, seconds: sc.seconds, gif: sc.gif,
    get done() { return c.over || frame >= sc.seconds * fps; },
    get error() { return failed ? String(failed.stack || failed) : null; },
    get frame() { return frame; },
    log: c.log,
    /** One video frame: the game, then the sound up to the next frame. */
    async step() {
      c.time = frame / fps;
      kit.loop.advance(1000 / fps);
      overlay.frame(c.tickT);
      frame++;
      const p = actx.suspend(qt(frame / fps));
      if (!rendering) rendering = actx.startRendering(); else actx.resume();
      await p;
      await c.flush(); // (the script's waits that are due now run before the next frame)
      return frame;
    },
    /** The sound, as 16-bit WAV, base64, in pieces (it's sent back over the DevTools pipe). */
    async finish() {
      actx.resume();
      const buf = await rendering;
      const n = Math.min(buf.length, Math.round((frame / fps) * SR)), L = buf.getChannelData(0), R = buf.getChannelData(1);
      const out = new DataView(new ArrayBuffer(44 + n * 4));
      const str = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
      str(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true);
      out.setUint32(24, SR, true); out.setUint32(28, SR * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, n * 4, true);
      for (let i = 0; i < n; i++) { out.setInt16(44 + i * 4, clamp(L[i], -1, 1) * 32767, true); out.setInt16(46 + i * 4, clamp(R[i], -1, 1) * 32767, true); }
      const bytes = new Uint8Array(out.buffer), parts = [];
      for (let i = 0; i < bytes.length; i += 3 * 262144) { let s = ''; const sub = bytes.subarray(i, i + 3 * 262144); for (let k = 0; k < sub.length; k += 8192) s += String.fromCharCode.apply(null, sub.subarray(k, k + 8192)); parts.push(btoa(s)); }
      window.__capWav = parts;
      return parts.length;
    },
  };
  void script;
  document.title = 'CAPTURE_READY';
}

/** The words over the picture: a caption at the top (the hook), one at the bottom (the beat), and a small watermark. */
function makeOverlay(wm) {
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;inset:0;z-index:20;pointer-events:none;font-size:0';
  document.body.append(el);
  const top = document.createElement('div'); top.style.cssText = 'position:absolute;left:0;right:0;top:6%;display:flex;flex-direction:column;align-items:center;gap:6px;transition:opacity .25s';
  const low = document.createElement('div'); low.style.cssText = 'position:absolute;left:0;right:0;bottom:24%;display:flex;flex-direction:column;align-items:center;gap:6px';
  el.append(top, low);
  const px = () => Math.max(3, Math.round(window.innerHeight / 200));
  const put = (box, text, color, scale) => {
    box.replaceChildren();
    if (!text) return;
    for (const line of String(text).split('\n')) { const cv = pixText(line, color, { bold: true }); const s = px() * scale; cv.style.cssText = `width:${cv.width * s}px;height:${cv.height * s}px;image-rendering:pixelated;display:block`; box.append(cv); }
  };
  if (wm) { const w = pixText('MR. TIDY', '#e8d6a8', { bold: true }); const s = Math.max(2, px() - 1); w.style.cssText = `position:absolute;right:2.2%;bottom:3%;opacity:.8;width:${w.width * s}px;height:${w.height * s}px;image-rendering:pixelated`; el.append(w); }
  const o = { cues: [], top: null, low: null };
  o.cue = (where, text, at, dur, color, scale) => o.cues.push({ where, text, at, end: at + dur, color, scale });
  o.frame = (t) => {
    for (const where of ['top', 'low']) {
      const q = o.cues.filter((k) => k.where === where && t >= k.at && t < k.end).pop() || null;
      if (q !== o[where]) { o[where] = q; put(where === 'top' ? top : low, q?.text, q?.color, q?.scale); }
    }
  };
  return o;
}

/** What a scenario's script is handed. Every action that takes time returns a promise; await it. */
class Director {
  constructor(kit, overlay, fps) {
    Object.assign(this, { kit, overlay, fps });
    this.P = kit.player; this.I = kit.input; this.V = kit.vac; this.K = kit.knock; this.LEVEL = LEVEL; this.TUNING = TUNING; this.THREE = THREE;
    this.time = 0; this.tickT = 0; this.over = false; this.ctrls = []; this.waits = []; this.log = [];
    this.cam = null; this.camK = 0; this.camBlend = 0; this.camFrom = null; this.camT = 0;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._a = new THREE.Vector3(); this._b = new THREE.Vector3(); this._up = new THREE.Vector3(0, 1, 0);
    this.fpPos = new THREE.Vector3(); this.fpQuat = new THREE.Quaternion();
  }

  note(s) { this.log.push(`${this.tickT.toFixed(2)} ${s}`); }

  // ---- time
  /** Per fixed tick, before the game's: the controllers (walking, looking, jumps) press the keys. */
  preTick(dt) {
    this.tickT += dt;
    { const v = this.V, s = `${v.state}${v.reachPhase ? '/' + v.reachPhase : ''} a${v.anger}`; if (s !== this._vs) { this._vs = s; this.note('vac ' + s + ` @${v.x.toFixed(1)},${v.z.toFixed(1)}`); } } // (what he's doing, for tuning)
    if (this.K.count !== this._kc) { if (this._kc !== undefined) this.note(`knocked (${this.K.count}) ${this.K.broken.at(-1)}`); this._kc = this.K.count; }
    if (this.kit.catchSeq.active && !this._caught) { this._caught = true; this.note('CAUGHT'); }
    for (const k of [...this.ctrls]) if (k.fn(dt) === true) { this.ctrls.splice(this.ctrls.indexOf(k), 1); k.done(); }
    for (const w of [...this.waits]) if (this.tickT >= w.at) { this.waits.splice(this.waits.indexOf(w), 1); w.done(); }
  }
  /** Let resolved waits run their next lines (promise jobs) before the next frame. */
  async flush() { for (let i = 0; i < 4; i++) await Promise.resolve(); }
  wait(s) { return new Promise((done) => this.waits.push({ at: this.tickT + s, done })); }
  /** Until f() is true (checked each tick), or max s. Resolves with whether it came true. */
  until(f, max = 10) { const t0 = this.tickT; return this.ctrl(() => (f() ? true : this.tickT - t0 > max ? true : undefined)).then(() => !!f()); }
  ctrl(fn) { return new Promise((done) => this.ctrls.push({ fn, done })); }
  /** Run something each tick alongside everything else, for s seconds (or until it returns true). */
  during(s, fn) { const t0 = this.tickT; return this.ctrl((dt) => (fn(dt, this.tickT - t0) === true || this.tickT - t0 >= s ? true : undefined)); }

  // ---- the cat
  /** Put the cat somewhere (set-up only). */
  place(x, y, z, yaw = 0, pitch = 0) { const P = this.P; P.frozen = false; P.resetMotion(); P.teleport(x, y, z, yaw); P.yaw = yaw; P.pitch = pitch; P.render?.(1); }
  /** Put the cat on top of a solid, at (x, z) on it or its middle. */
  placeOn(id, yaw = 0, pitch = 0, x = null, z = null) { const b = this.solid(id); this.place(x ?? (b.min[0] + b.max[0]) / 2, b.max[1] + 0.001, z ?? (b.min[2] + b.max[2]) / 2, yaw, pitch); }
  solid(id) { const b = this.kit.house.byId.get(id); if (!b) throw new Error('no solid ' + id); return b; }
  hold(...codes) { for (const k of codes) { if (!this.I.keys.has(k)) this.I.edges.add(k); this.I.keys.add(k); } }
  release(...codes) { for (const k of codes) { if (this.I.keys.has(k)) this.I.releases.add(k); this.I.keys.delete(k); } }
  async tap(code, s = 0.05) { this.hold(code); await this.wait(s); this.release(code); }
  async swipe() { await this.tap('Mouse0'); await this.wait(TUNING.swipe?.time ?? 0.3); }

  /** Turn the view to face a point (smoothly, over s). */
  lookAt(x, y, z, s = 0.6) {
    const P = this.P, y0 = P.yaw, p0 = P.pitch, t0 = this.tickT;
    return this.ctrl(() => {
      const eyeY = this.cam ? P.feetY + 0.25 : this.kit.camera.position.y; // (the eye, where it is)
      const wy = yawTo(P.pos.x, P.pos.z, x, z), wp = clamp(Math.atan2(y - eyeY, Math.hypot(x - P.pos.x, z - P.pos.z)), -1.2, 1.2);
      const k = s <= 0 ? 1 : ease((this.tickT - t0) / s);
      P.yaw = y0 + wrap(wy - y0) * k; P.pitch = p0 + (wp - p0) * k;
      return k >= 1 ? true : undefined;
    });
  }
  /** Turn to a yaw/pitch (rad) over s. */
  turn(yaw, pitch = this.P.pitch, s = 0.6) {
    const P = this.P, y0 = P.yaw, p0 = P.pitch, t0 = this.tickT;
    return this.ctrl(() => { const k = s <= 0 ? 1 : ease((this.tickT - t0) / s); P.yaw = y0 + wrap(yaw - y0) * k; P.pitch = p0 + (pitch - p0) * k; return k >= 1 ? true : undefined; });
  }
  /** Look at a knockable (its middle). */
  lookAtThing(id, s = 0.6, dy = 0.06) { const o = this.K.byId.get(id); return this.lookAt(o.x, o.y + dy, o.z, s); }

  /** Walk (or run, or slink) through points [[x, z], ...] on whatever it's standing on. pitch: where the view looks meanwhile. */
  walk(points, { run = false, slink = false, tol = 0.12, pitch = null, turnRate = 5, max = 20 } = {}) {
    const P = this.P, pts = points.map((p) => [...p]); let i = 0; const t0 = this.tickT; let still = 0, lx = P.pos.x, lz = P.pos.z;
    const keys = ['KeyW', ...(run ? ['ShiftLeft'] : []), ...(slink ? ['KeyC'] : [])];
    return this.ctrl((dt) => {
      if (this.tickT - t0 > max) { this.release(...keys); this.note('walk timed out'); return true; }
      while (i < pts.length && Math.hypot(pts[i][0] - P.pos.x, pts[i][1] - P.pos.z) < (i === pts.length - 1 ? tol : tol * 2.5)) i++;
      if (i >= pts.length) { this.release(...keys); return true; }
      if (Math.hypot(P.pos.x - lx, P.pos.z - lz) < dt * 0.05) still += dt; else still = 0; lx = P.pos.x; lz = P.pos.z;
      if (still > 0.35 && this.I.keys.has('KeyW')) { if (i < pts.length - 1) { i++; still = 0; } else { this.release(...keys); return true; } } // (up against something: as near as it gets)
      const want = yawTo(P.pos.x, P.pos.z, pts[i][0], pts[i][1]), d = wrap(want - P.yaw);
      P.yaw += clamp(d, -turnRate * dt, turnRate * dt);
      if (pitch !== null) P.pitch += (pitch - P.pitch) * Math.min(1, dt * 4);
      if (Math.abs(d) < 0.7) this.hold(...keys); else this.release('KeyW');
      return undefined;
    });
  }

  /**
   * Jump from where it stands to the top of solid `to` with this much charge (0..1), as a person does: face it, hold
   * Space, let go, steer in, brake over it. Resolves with the id it landed on.
   */
  async jump(to, charge = 0.5, opts = {}) {
    // first, to the edge of what it's on nearest the target, the way the route checker starts each link
    const P = this.P, fromId = P.grounded ? P.groundCollider?.id : null, from = fromId && this.kit.house.byId.get(fromId);
    if (from && opts.edge !== false && typeof to === 'string') {
      const b = this.solid(to), I = 0.06, near = (a, x, z) => [clamp(x, a.min[0] + I, a.max[0] - I), clamp(z, a.min[2] + I, a.max[2] - I)];
      const fc = near(from, (b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2), tc = near(b, fc[0], fc[1]), st = near(from, tc[0], tc[1]);
      if (Math.hypot(st[0] - P.pos.x, st[1] - P.pos.z) > 0.08) { await this.walk([st], { tol: 0.05, turnRate: 7 }); await this.wait(0.12); }
    }
    return this._jump(to, charge, opts);
  }

  _jump(to, charge, { aimX = null, aimZ = null, face = 0.35, dash = false, look = true } = {}) {
    const P = this.P, b = typeof to === 'string' ? this.solid(to) : { min: [to.x - 0.05, 0, to.z - 0.05], max: [to.x + 0.05, to.y ?? 0, to.z + 0.05] };
    if (typeof to !== 'string') to = 'point';
    const inX = Math.min(0.15, (b.max[0] - b.min[0]) / 2 - 0.01), inZ = Math.min(0.15, (b.max[2] - b.min[2]) / 2 - 0.01);
    const ax = aimX ?? clamp(P.pos.x, b.min[0] + inX, b.max[0] - inX), az = aimZ ?? clamp(P.pos.z, b.min[2] + inZ, b.max[2] - inZ);
    const wy = yawTo(P.pos.x, P.pos.z, ax, az), wp = clamp(Math.atan2(b.max[1] - (P.feetY + 0.25), Math.hypot(ax - P.pos.x, az - P.pos.z)) * 0.6, -0.6, 0.7);
    let phase = 'face', t = 0; const y0 = P.yaw, p0 = P.pitch, hold = Math.round((charge * J.chargeTime) / STEP);
    return this.ctrl((dt) => {
      t += dt;
      if (phase === 'face') { const k = ease(t / face); P.yaw = y0 + wrap(wy - y0) * k; if (look) P.pitch = p0 + (wp - p0) * k; if (k >= 1) { phase = 'charge'; t = 0; this.hold('Space'); } return undefined; }
      if (phase === 'charge') { if (t >= hold * STEP) { this.release('Space'); this.hold('KeyW'); phase = 'air'; t = 0; } return undefined; }
      if (dash && t > 0.12 && t < 0.15) this.hold('ShiftLeft'); else this.release('ShiftLeft');
      const over = P.pos.x >= b.min[0] && P.pos.x <= b.max[0] && P.pos.z >= b.min[2] && P.pos.z <= b.max[2];
      if (over) { this.release('KeyW'); if (Math.hypot(P.vel.x, P.vel.z) > 0.4) this.hold('KeyS'); else this.release('KeyS'); }
      if ((P.grounded && t > 0.1) || t > 3) { this.release('KeyW', 'KeyS', 'ShiftLeft'); this.note(`jump -> ${to}: on ${P.groundCollider?.id || 'floor'}`); return true; }
      if (P.mode === 'hang' || P.mode === 'mantle' || P.mode === 'climb') { this.hold('KeyW'); } // (caught the edge: pull up)
      return undefined;
    }).then(() => P.groundCollider?.id || 'floor');
  }

  // ---- him
  /** Set Mr. Tidy down at a nav node, at this anger, fresh (nothing pending). */
  vacAt(node, anger = 1, heading = 0) {
    const v = this.V, n = v.nav.nodes.get(node);
    if (!n) throw new Error('no nav node ' + node);
    for (const m of this.kit.debris.messes) m.cleaned = true;
    if (v.slurp) { v.slurp.stop(0); v.slurp = null; }
    v.dormant = false; v.model.root.visible = true;
    v.mess = null; v.pending = null; v.frozen = false; v.state = 'PATROL'; v.setAnger(anger);
    v._endReach(); v._endBlast(); v._endSuck(); v._endCreep(); v._endFog(); v.cloud.reset(); v.foundT = 0; v.stunT = 0; v.freezeT = 0; v.caught = false; v.seeT = 0; v.direct = false; v.rushed = true; v.rush = false;
    v.x = v.px = n.x; v.z = v.pz = n.z; v.heading = v.prevHeading = heading;
    v.tether = v.nav.path(v.root, n); v.path = [n]; v.pathI = 0;
    return v;
  }
  /** Hold off his tricks (s each) so a scene isn't interrupted: { fog, creep, blast, lurk, sting, reach }. */
  calmVac({ fog = 999, creep = 999, blast = 999, lurk = 999, sting = 999, burst = 999, think = null } = {}) {
    const v = this.V; v.fogCd = fog; v.creepCd = creep; v.blastCd = blast; v.lurkCd = lurk; v.ambushCd = lurk; v.stingCd = sting; v.burstCd = burst; v.peekCd = 999; if (think !== null) v.thinkT = think;
  }

  // ---- cameras
  /**
   * Film from somewhere other than the cat's eyes. shot: { pos: [x,y,z] | fn(t), look: [x,y,z] | fn(t) | 'vac', fov } or
   * null (back to the cat). blend: s to glide there. t in fn is s since the shot began.
   */
  shot(shot, blend = 0) { this.camFrom = this.cam ? { pos: this._lastPos?.clone(), quat: this._lastQuat?.clone(), fov: this._lastFov } : null; this.cam = shot; this.camBlend = blend; this.camT = 0; }
  /** Called by main.js just before the scene is drawn. */
  film(cam, dt) {
    this.fpPos.copy(cam.position); this.fpQuat.copy(cam.quaternion); const fpFov = cam.fov;
    this.camT += dt;
    const s = this.cam;
    if (!s) {
      if (this.camFrom && this.camBlend > 0 && this.camT < this.camBlend) { const k = ease(this.camT / this.camBlend); cam.position.lerpVectors(this.camFrom.pos, this.fpPos, k); cam.quaternion.slerpQuaternions(this.camFrom.quat, this.fpQuat, k); cam.fov = this.camFrom.fov + (fpFov - this.camFrom.fov) * k; cam.updateProjectionMatrix(); cam.updateMatrixWorld(); }
      this._lastPos = cam.position.clone(); this._lastQuat = cam.quaternion.clone(); this._lastFov = cam.fov;
      return;
    }
    const v = this.V, t = this.camT;
    const val = (x, d) => (typeof x === 'function' ? x(t, this) : x === 'vac' ? [v.model.root.position.x, v.model.faceCenterY?.() ?? 0.35, v.model.root.position.z] : x === 'cat' ? [this.P.pos.x, this.P.feetY + 0.15, this.P.pos.z] : x ?? d);
    const p = val(s.pos), l = val(s.look, [0, 0, 0]);
    this._a.set(p[0], p[1], p[2]); this._b.set(l[0], l[1], l[2]);
    this._m.lookAt(this._a, this._b, this._up); this._q.setFromRotationMatrix(this._m);
    const fov = s.fov ?? fpFov;
    const from = this.camFrom || { pos: this.fpPos, quat: this.fpQuat, fov: fpFov };
    const k = this.camBlend > 0 ? ease(t / this.camBlend) : 1;
    cam.position.lerpVectors(from.pos, this._a, k); cam.quaternion.slerpQuaternions(from.quat, this._q, k); cam.fov = from.fov + (fov - from.fov) * k;
    if (s.shake) { cam.position.x += (Math.random() - 0.5) * s.shake; cam.position.y += (Math.random() - 0.5) * s.shake; }
    cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    this.kit.paws.hide(); this.kit.tail.hide(); // (they hang off the camera: not on a film camera)
    this._lastPos = cam.position.clone(); this._lastQuat = cam.quaternion.clone(); this._lastFov = cam.fov;
  }

  // ---- words on the picture
  /** A caption at the top (the hook) from now, for s. */
  title(text, s = 3, color = '#f4e6c0') { this.overlay.cue('top', text, this.tickT, s, color, 1); }
  /** A caption lower down, from now, for s. */
  caption(text, s = 2, color = '#ffffff') { this.overlay.cue('low', text, this.tickT, s, color, 0.8); }
  /** Captions on a timeline from now: [[at s, text, for s], ...]. */
  titles(list, where = 'top') { for (const [at, text, s] of list) this.overlay.cue(where, text, this.tickT + at, s, where === 'top' ? '#f4e6c0' : '#ffffff', where === 'top' ? 1 : 0.8); }
}
