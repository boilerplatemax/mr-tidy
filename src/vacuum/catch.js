// The catch (build prompt 0.7): control locks and the nozzle has you. He swings round to face you and reels you in across
// the room, along a route of its own that keeps the camera clear of everything (the hose's path hugs surfaces far too
// closely for a camera to ride). It stops in front of him with the face filling the screen while the motor screams; hard
// cut to black, a beat of silence.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { audio } from '../audio/audio.js';
import { Voxels } from './voxels.js';

const C = TUNING.catch, V = TUNING.vac;
const _p = new THREE.Vector3(), _look = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _dir = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const rnd = () => Math.random() * 2 - 1;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (t) => t * t * (3 - 2 * t);

export class CatchSequence {
  /** onEnd(): the screen is black and the beat of silence is over. */
  constructor({ camera, vac, onEnd }) {
    Object.assign(this, { camera, vac, onEnd });
    this.active = false; this.phase = 'none'; this.t = 0;
    this.cut = document.createElement('div');
    this.cut.id = 'cut'; this.cut.hidden = true;
    document.body.append(this.cut);
    this.from = new THREE.Quaternion(); this.to = new THREE.Quaternion();
    this.faceBase = new THREE.Vector3();
    this.vox = new Voxels(vac.world, { margin: C.clearance, minY: C.minY });
    this.ride = []; this.along = []; this.len = 0; this.time = 0;
    this.end = new THREE.Vector3(); this.faceAt = new THREE.Vector3();
    this.heading0 = 0; this.heading1 = 0;
  }

  /** A route from the eye to the spot in front of him, resampled and rounded. Everything on it is clear of every surface. */
  _plan(eye) {
    const v = this.vac, W = v.world, vox = this.vox, d = V.model.holeZ + V.model.catchDist;
    const y = v.model.faceCenterY();
    const undo = vox.blockCylinder(v.x, v.z, V.radius + C.clearance * 0.5, V.height + 0.2); // his body is in the way too
    const want = Math.atan2(eye.x - v.x, eye.z - v.z);
    let end = null, theta = want;
    for (let k = 0; k < 18 && !end; k++) { // he turns to whichever side has room, starting with the one you're on
      const a = want + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.35;
      const q = _p.set(v.x + Math.sin(a) * d, y, v.z + Math.cos(a) * d);
      if (!vox.blocked(q.x, q.y, q.z)) { end = q.clone(); theta = a; }
    }
    if (!end) end = new THREE.Vector3(v.x + Math.sin(want) * d, y, v.z + Math.cos(want) * d);
    const clear = (q) => { const l = eye.distanceTo(q); _dir.copy(q).sub(eye).divideScalar(l || 1); return !W.raycast(eye, _dir, l, (c) => c.solid, false); };
    const start = vox.nearestOpen(eye, clear) || eye.clone();
    const route = vox.path(start, end);
    undo();
    const pts = [eye.clone()];
    if (route) pts.push(...route); else pts.push(start, end.clone());
    pts.push(end.clone());
    // even samples, then a moving average to take the corners off (always less than the clearance)
    const out = [];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(a.distanceTo(b) / C.step));
      for (let k = 0; k < n; k++) out.push(a.clone().lerp(b, k / n));
    }
    out.push(end.clone());
    const avg = out.map((p, i) => {
      if (i === 0 || i === out.length - 1) return p.clone();
      const w = Math.min(C.smooth, i, out.length - 1 - i), s = new THREE.Vector3();
      for (let k = -w; k <= w; k++) s.add(out[i + k]);
      return s.divideScalar(2 * w + 1);
    });
    this.ride = avg; this.along = [0];
    for (let i = 1; i < avg.length; i++) this.along.push(this.along[i - 1] + avg[i].distanceTo(avg[i - 1]));
    this.len = this.along[this.along.length - 1];
    this.time = Math.max(C.rideMin, Math.min(C.rideMax, this.len / C.rideSpeed));
    this.end.copy(end);
    this.heading0 = v.heading; this.heading1 = v.heading + wrap(theta - v.heading);
    this.faceAt.set(v.x, y, v.z);
  }

  /** The point s metres along the ride. Returns the index of the sample before it. */
  _at(s, out) {
    const A = this.along; let lo = 0, hi = A.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (A[m] <= s) lo = m; else hi = m; }
    const d = A[hi] - A[lo];
    out.copy(this.ride[lo]).lerp(this.ride[hi], d > 0 ? Math.min(1, (s - A[lo]) / d) : 0);
    return lo;
  }

  start() {
    const v = this.vac, cam = this.camera, m = v.model;
    this.active = true; this.phase = 'drag'; this.t = 0;
    this._plan(cam.position.clone());
    this.eat = v.anger >= 5; // the last stage doesn't scream at you: it opens up and eats you
    m.setFace(4); m.face.visible = true; m.still = true; m.maw = this.eat; // furious, whatever he was before, and for once perfectly still
    this.faceBase.copy(m.face.position);
    audio.play('vac.fwoomp', { gain: 0.7 });
    audio.play('sting.spot', { gain: 1.1 });
    v.scream();
  }

  /** The hose reeling in ahead of you: every point slides along the same smooth route, so its shape never shifts. */
  _reel(s) {
    const v = this.vac, H = v.hose, n = H.n, h = v._hole(), from = Math.min(this.len, s + C.hoseGap);
    H.active = true;
    H.pts[0].set(h.x, h.y, h.z);
    for (let i = 1; i <= n; i++) { // (the first stretch is the short hop from the hole to the end of the route)
      this._at(this.len + (from - this.len) * ((i - 1) / (n - 1)), H.pts[i]);
      H.pts[i].y = Math.max(TUNING.hose.floorY, H.pts[i].y - 0.05);
    }
    for (let i = 0; i <= n; i++) { H.prev[i].copy(H.pts[i]); H.old[i].copy(H.pts[i]); }
    H.tipPos.copy(H.pts[n]);
  }

  /** Per rendered frame while active. */
  update(dt) {
    const cam = this.camera, v = this.vac, f = v.model.face;
    this.t += dt;
    if (this.phase === 'drag') {
      const u = Math.min(1, this.t / this.time), s = smooth(u) * this.len;
      this._at(s, _p);
      cam.position.copy(_p);
      _look.copy(this.faceAt);
      if (cam.position.distanceToSquared(_look) > 1e-6) {
        _m.lookAt(cam.position, _look, _up);
        _q.setFromRotationMatrix(_m);
        cam.quaternion.slerp(_q, 1 - Math.exp(-C.lookEase * dt));
      }
      cam.updateMatrixWorld();
      v.heading = v.prevHeading = this.heading0 + (this.heading1 - this.heading0) * smooth(Math.min(1, u * 1.4)); // he swings round to meet you
      this._reel(s);
      if (u >= 1) this._toHold();
      return;
    }
    if (this.phase === 'hold') {
      const k = Math.min(1, this.t / C.turn);
      cam.quaternion.slerpQuaternions(this.from, this.to, smooth(k));
      cam.position.copy(this.end);
      if (this.eat) { const u = Math.max(0, (this.t - C.hold * 0.4) / (C.hold * 0.6)); _p.copy(this.faceAt).sub(this.end).setY(0).normalize(); cam.position.addScaledVector(_p, TUNING.eat.into * u * u); cam.position.y -= 0.06 * u; } // in, between the teeth
      cam.updateMatrixWorld();
      f.position.set(this.faceBase.x + rnd() * C.faceJitter, this.faceBase.y + rnd() * C.faceJitter, this.faceBase.z); // trembling with rage
      if (this.t >= C.hold) this._toCut();
      return;
    }
    if (this.phase === 'black' && this.t >= C.beat) { this.phase = 'done'; this.active = false; this.onEnd?.(); }
  }

  _toHold() {
    const cam = this.camera;
    this.phase = 'hold'; this.t = 0;
    if (this.eat) { TUNING.eat.chomps.forEach((at) => audio.play('vac.chomp', { delay: at })); audio.play('vac.surge', { rate: 0.5 }); }
    else { this.vac.model.shriek(C.hold); if (Math.random() < 0.5) audio.play('vac.laugh'); else audio.play('vac.shriek', { gain: 1.3 }); } // one or the other, never both
    cam.position.copy(this.end);
    this.from.copy(cam.quaternion);
    _m.lookAt(this.end, this.faceAt, _up);
    this.to.setFromRotationMatrix(_m);
    const h = this.vac._hole(), a = new THREE.Vector3(h.x, h.y, h.z), b = a.clone().lerp(this.end, 0.35); b.y = TUNING.hose.floorY; this.vac.hose.lay([a, b]); // (the slack, on the floor between you)
  }

  _toCut() {
    this.phase = 'black'; this.t = 0;
    this.cut.hidden = false;
    this.vac.model.face.position.copy(this.faceBase);
    this.vac.silence();
    audio.suspend();
  }

  /** Clears everything for a new run. */
  reset() { this.active = false; this.phase = 'none'; this.t = 0; this.cut.hidden = true; this.vac.model.still = false; this.vac.model.maw = false; }
}
