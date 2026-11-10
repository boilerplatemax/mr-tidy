// Short cut-ins to him, with the cat held still:
//  'turn'  "...that's enough.": the view goes in close on his face as it changes (a glide if you could see him, otherwise a
//          cut), holds while he says it, and goes back to you.
//  'surge' stage 5: a shot of the outlet as the power pours out of it and runs along his cord in sparks, then him, wreathed
//          in electricity as the lights die, then back to you. After that it's only his eyes in the dark.
// Numbers are in TUNING.closeup and TUNING.surge.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';

const K = TUNING.closeup, SG = TUNING.surge, R = TUNING.render;
const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), UP = new THREE.Vector3(0, 1, 0);

export class Closeup {
  constructor({ scene, camera, vac, player, world }) {
    Object.assign(this, { camera, vac, player, world });
    this.active = false; this.kind = null; this.t = 0; this.shots = []; this.i = 0;
    this.fromPos = new THREE.Vector3(); this.fromQuat = new THREE.Quaternion(); this.glide = false; this.out = 0; this.outT = 0;
    this.pos = new THREE.Vector3(); this.look = new THREE.Vector3(); this.quat = new THREE.Quaternion(); this.fov = R.fov;
    // the sparks that run along his cord
    this.sparkGroup = new THREE.Group(); this.sparkGroup.visible = false; scene.add(this.sparkGroup);
    const geo = new THREE.BoxGeometry(0.035, 0.035, 0.035), mat = new THREE.MeshBasicMaterial({ color: SG.sparkColor, fog: false });
    this.sparks = Array.from({ length: SG.sparks }, () => { const m = new THREE.Mesh(geo, mat); this.sparkGroup.add(m); return m; });
    this.sparkT = -1;
  }

  /** Stop at once (a catch, a new run). */
  reset() { if (this.active) this._release(); this.active = false; this.sparkGroup.visible = false; this.sparkT = -1; }

  play(kind) {
    if (this.active) this.reset();
    const cam = this.camera, v = this.vac;
    this.kind = kind; this.t = 0; this.i = 0; this.out = 0;
    this.fromPos.copy(cam.position); this.fromQuat.copy(cam.quaternion);
    this.player.frozen = true; this.player.resetMotion();
    if (kind === 'turn') {
      const face = this._faceShot(K.dist);
      const near = cam.position.distanceTo(_a.set(v.x, 0.3, v.z)) < K.near && this.world.countOccluders(cam.position, _a, 1, true) === 0;
      this.glide = near;
      this.shots = [{ ...face, dur: TUNING.voice.turn - 0.2, fov: K.fov, push: K.push }];
    } else {
      this.glide = false;
      this.shots = [{ ...this._outletShot(), dur: SG.cutOutlet, fov: 62, push: 0.05 }, { ...this._faceShot([0.95, 0.8, 0.65]), dur: SG.cutVac, fov: 60, push: 0.1 }];
      this.sparkT = 0;
    }
    this.active = true;
  }

  /** In front of his face, with a clear line to it (the first distance that fits, a little off to one side first). */
  _faceShot(dists) {
    const v = this.vac, y = v.model.faceCenterY(), look = new THREE.Vector3(v.x, y, v.z), vox = v.vox;
    for (const d of dists) for (const off of [0.25, -0.25, 0.5, -0.5, 0, 0.8, -0.8]) {
      const a = v.heading + off, p = new THREE.Vector3(v.x + Math.sin(a) * d, y + K.up, v.z + Math.cos(a) * d);
      if (!vox || (!vox.blocked(p.x, p.y, p.z) && vox.lineFree(p, _b.set(v.x + Math.sin(a) * 0.3, y, v.z + Math.cos(a) * 0.3)))) return { pos: p, look };
    }
    return { pos: new THREE.Vector3(v.x + Math.sin(v.heading) * 0.7, y + K.up, v.z + Math.cos(v.heading) * 0.7), look };
  }

  /** Low by the outlet he's plugged into, looking out along the cord the way the power goes. */
  _outletShot() {
    const o = this.vac.cord.outlet, [x, y, z] = o.pos, [nx, , nz] = o.n, P = this.vac.cord.pts, n = this.vac.cord.n || 2;
    let k = 2, run = 0; // a point a metre or so along the cord
    while (k < n - 1 && run < 1.2) { run += Math.hypot(P[k + 1].x - P[k].x, P[k + 1].z - P[k].z); k++; }
    const along = P[Math.min(k, n - 1)], vox = this.vac.vox;
    for (const [out, side] of [[0.75, 0.35], [0.75, -0.35], [0.55, 0.5], [0.55, -0.5], [0.45, 0]]) {
      const p = new THREE.Vector3(x + nx * out - nz * side, 0.42, z + nz * out + nx * side);
      if (!vox || !vox.blocked(p.x, p.y, p.z)) return { pos: p, look: new THREE.Vector3((x + along.x) / 2, 0.12, (z + along.z) / 2) };
    }
    return { pos: new THREE.Vector3(x + nx * 0.5, 0.4, z + nz * 0.5), look: new THREE.Vector3(along.x, 0.1, along.z) };
  }

  _release() { this.player.frozen = false; this.camera.fov = R.fov; this.camera.updateProjectionMatrix(); }

  /** Per rendered frame while active (instead of the player's own view). */
  update(dt) {
    const cam = this.camera;
    this.t += dt;
    this._sparks(dt);
    if (this.out > 0) { // gliding back to the cat
      this.outT += dt;
      this.player.render(1); // where the view belongs
      const k = smooth(this.outT / K.glideOut);
      cam.position.lerpVectors(this.pos, cam.position.clone(), k);
      cam.quaternion.slerpQuaternions(this.quat, cam.quaternion.clone(), k);
      cam.fov = this.fov + (R.fov - this.fov) * k; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      if (this.outT >= K.glideOut) { this.active = false; this._release(); }
      return;
    }
    const s = this.shots[this.i];
    if (this.t >= s.dur) {
      this.i++; this.t = 0;
      if (this.i >= this.shots.length) {
        if (this.glide) { this.out = 1; this.outT = 0; return; }
        this.active = false; this._release(); this.player.render(1); return;
      }
      return this.update(0);
    }
    const u = smooth(this.t / s.dur);
    this.pos.copy(s.pos).addScaledVector(_a.copy(s.look).sub(s.pos).normalize(), s.push * u);
    _m.lookAt(this.pos, s.look, UP); this.quat.setFromRotationMatrix(_m);
    this.fov = s.fov;
    if (this.i === 0 && this.glide) { // in from where you were
      const k = smooth(this.t / K.glideIn);
      cam.position.lerpVectors(this.fromPos, this.pos, k); cam.quaternion.slerpQuaternions(this.fromQuat, this.quat, k);
      cam.fov = R.fov + (s.fov - R.fov) * k;
    } else { cam.position.copy(this.pos); cam.quaternion.copy(this.quat); cam.fov = s.fov; }
    cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  }

  /** The power running out of the outlet and along the cord to him, in bright little sparks. */
  _sparks(dt) {
    if (this.sparkT < 0) { this.sparkGroup.visible = false; return; }
    this.sparkT += dt;
    const c = this.vac.cord, P = c.pts, n = c.n || 0, st = c.start || 0;
    if (n - st < 3 || this.sparkT > SG.cutOutlet + SG.cutVac) { this.sparkGroup.visible = false; if (this.sparkT > SG.cutOutlet + SG.cutVac) this.sparkT = -1; return; }
    let L = 0; for (let i = st + 1; i < n; i++) L += Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y, P[i].z - P[i - 1].z);
    this.sparkGroup.visible = true;
    const N = this.sparks.length, gap = Math.min(0.5, L / N);
    this.sparks.forEach((m, j) => {
      const d = this.sparkT * SG.sparkSpeed - j * gap; // a train of them, out of the wall and away
      m.visible = d >= 0 && Math.random() < 0.85; // (and round again: a steady stream)
      if (!m.visible) return;
      let rem = ((d % L) + L) % L, i = st + 1;
      for (; i < n; i++) { const l = Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y, P[i].z - P[i - 1].z); if (rem <= l) { const f = l > 1e-6 ? rem / l : 0; m.position.set(P[i - 1].x + (P[i].x - P[i - 1].x) * f, P[i - 1].y + (P[i].y - P[i - 1].y) * f + 0.015, P[i - 1].z + (P[i].z - P[i - 1].z) * f); break; } rem -= l; }
      m.scale.setScalar(0.6 + Math.random() * 0.9);
    });
  }
}
