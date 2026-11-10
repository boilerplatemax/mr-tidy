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
    // the electricity along his cord: the same jagged crackle that wreathes him, running out of the wall and along to him
    this.arcPos = new Float32Array(SG.cordArcs * 6 * 6); const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.BufferAttribute(this.arcPos, 3));
    this.sparkGroup = new THREE.LineSegments(ag, new THREE.LineBasicMaterial({ color: SG.sparkColor, fog: false })); this.sparkGroup.frustumCulled = false; this.sparkGroup.visible = false; scene.add(this.sparkGroup);
    this.sparkT = -1;
    // and the words, so it's plain what's happening: POWER SURGE, wavering
    this.title = document.createElement('div'); this.title.id = 'surge'; this.title.hidden = true;
    import('../ui/menu.js').then(({ pixText }) => { for (const ch of 'POWER SURGE') { const c = pixText(ch === ' ' ? ' ' : ch, '#d8ecff', { bold: true }); c.style.animationDelay = (-Math.random() * 0.3 + this.title.childElementCount * 0.09) + 's'; this.title.append(c); } });
    document.body.append(this.title);
  }

  /** Stop at once (a catch, a new run). */
  reset() { if (this.active) this._release(); this.active = false; this.sparkGroup.visible = false; this.sparkT = -1; this.title.hidden = true; }

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
      this.sparkT = 0; this.title.hidden = false;
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

  _release() { this.title.hidden = true; this.player.frozen = false; this.camera.fov = R.fov; this.camera.updateProjectionMatrix(); }

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

  /** The power running out of the outlet and along the cord to him: crackling arcs that start at the wall and spread toward him. */
  _sparks(dt) {
    if (this.sparkT < 0) { this.sparkGroup.visible = false; return; }
    this.sparkT += dt;
    const c = this.vac.cord, P = c.pts, n = c.n || 0, st = c.start || 0, end = SG.cutOutlet + SG.cutVac;
    if (n - st < 3 || this.sparkT > end) { this.sparkGroup.visible = false; this.title.hidden = this.sparkT > end || this.title.hidden; if (this.sparkT > end) this.sparkT = -1; return; }
    const front = this.sparkT * SG.sparkSpeed, arr = this.arcPos; // how far along it the power has got (m)
    let w = 0, along = 0;
    const N = SG.cordArcs;
    for (let i = st + 1; i < n && w < N * 36; i++) {
      const a = P[i - 1], b = P[i], l = Math.hypot(b.x - a.x, b.z - a.z);
      along += l;
      if (along > front || Math.random() > SG.cordDensity) continue;
      // a little jagged arc off the cord here: six zig-zag steps round it
      let x = a.x, y = a.y + 0.01, z = a.z;
      for (let k = 0; k < 6 && w < N * 36; k++) {
        const nx = x + (b.x - a.x) * 0.2 + (Math.random() - 0.5) * 0.06, ny = Math.max(0.005, y + (Math.random() - 0.3) * 0.05), nz = z + (b.z - a.z) * 0.2 + (Math.random() - 0.5) * 0.06;
        arr[w++] = x; arr[w++] = y; arr[w++] = z; arr[w++] = nx; arr[w++] = ny; arr[w++] = nz; x = nx; y = ny; z = nz;
      }
    }
    this.sparkGroup.geometry.setDrawRange(0, w / 3);
    this.sparkGroup.geometry.attributes.position.needsUpdate = true;
    this.sparkGroup.visible = w > 0 && Math.random() < 0.9; // (it flickers)
  }
}
