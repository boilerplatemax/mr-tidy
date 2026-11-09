// The power cord (visual only, for now): a thin tube along the floor from the back of the vac to the outlet it's plugged
// into, loosely following where it has been. Video-game magic: whenever the outlet and the cord are out of the player's
// sight, the plug quietly moves to the outlet nearest the vac. It never switches while any of it can be seen, and it
// never blocks or limits anything. It's here for the Phase 2 ending, when Grandma unplugs it.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { LEVEL } from '../data/level.js';
import { makePS1 } from '../render/ps1-material.js';

const C = TUNING.cord;
const SIDES = 4;
const _v = new THREE.Vector3();

export class Cord {
  constructor(scene, world, camera, socketWorld) {
    Object.assign(this, { world, camera, socketWorld });
    this.outlets = LEVEL.outlets;
    this.outlet = this.outlets[0];
    this.trail = []; // { x, z } from the outlet toward the vac
    this.timer = 0;
    const max = C.capacity + 3;
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * SIDES * 3);
    const nor = new Float32Array(max * SIDES * 3); for (let i = 1; i < nor.length; i += 3) nor[i] = 1;
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    const idx = [];
    for (let r = 0; r < max - 1; r++) for (let s = 0; s < SIDES; s++) {
      const a = r * SIDES + s, b = r * SIDES + ((s + 1) % SIDES), c = a + SIDES, d = b + SIDES;
      idx.push(a, c, b, b, c, d);
    }
    this.geo.setIndex(idx);
    this.mesh = new THREE.Mesh(this.geo, makePS1(new THREE.MeshLambertMaterial({ color: C.color, side: THREE.DoubleSide })));
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.plug = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.03), makePS1(new THREE.MeshLambertMaterial({ color: C.plugColor })));
    scene.add(this.plug);
    this._placePlug();
    this.pts = Array.from({ length: max }, () => ({ x: 0, y: 0, z: 0 }));
  }

  _placePlug() {
    const [x, y, z] = this.outlet.pos, [nx, , nz] = this.outlet.n;
    this.plug.position.set(x + nx * 0.02, y, z + nz * 0.02);
    this.plug.rotation.y = Math.atan2(nx, nz);
  }

  /** Lay a fresh cord straight from an outlet to the vac. */
  plugInto(outlet, vx, vz) {
    this.outlet = outlet;
    this._placePlug();
    const [ox, , oz] = outlet.pos, len = Math.hypot(vx - ox, vz - oz), n = Math.max(1, Math.ceil(len / C.spacing));
    this.trail.length = 0;
    for (let i = 0; i < n; i++) this.trail.push({ x: ox + ((vx - ox) * i) / n, z: oz + ((vz - oz) * i) / n });
  }

  _seen(x, y, z) {
    const cam = this.camera;
    _v.set(x, y, z).applyMatrix4(cam.matrixWorldInverse);
    if (_v.z >= 0) return false; // behind the camera
    _v.set(x, y, z).project(cam);
    if (Math.abs(_v.x) > C.seenMargin || Math.abs(_v.y) > C.seenMargin) return false;
    const a = this._a || (this._a = { x: 0, y: 0, z: 0 }), b = this._b || (this._b = { x: 0, y: 0, z: 0 });
    a.x = cam.position.x; a.y = cam.position.y; a.z = cam.position.z; b.x = x; b.y = y; b.z = z;
    return this.world.countOccluders(a, b, 1, true) === 0;
  }

  /** Tested from just off the wall: a point exactly on the wall counts as blocked by it. */
  _outletSeen(o) { return this._seen(o.pos[0] + o.n[0] * 0.05, o.pos[1], o.pos[2] + o.n[2] * 0.05); }

  /** Can the player see this outlet, or any of the cord? */
  anySeen() {
    if (this._outletSeen(this.outlet)) return true;
    for (let i = 0; i < this.trail.length; i += 2) if (this._seen(this.trail[i].x, C.y, this.trail[i].z)) return true;
    return false;
  }

  /** Per fixed tick: lay more trail, and move the plug if nobody's looking. */
  tick(dt, vx, vz) {
    const T = this.trail, last = T[T.length - 1];
    if (!last || Math.hypot(vx - last.x, vz - last.z) >= C.spacing) T.push({ x: vx, z: vz });
    if (T.length >= C.capacity) { for (let i = T.length - 2; i > 0; i -= 2) T.splice(i, 1); } // too long: thin it out
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = C.checkEvery;
    let near = this.outlet, bd = Infinity;
    for (const o of this.outlets) { const d = (o.pos[0] - vx) ** 2 + (o.pos[2] - vz) ** 2; if (d < bd) { bd = d; near = o; } }
    if (near === this.outlet || this.anySeen() || this._outletSeen(near)) return;
    this.plugInto(near, vx, vz);
  }

  /** Per rendered frame: (vx, vz, vy) is the rendered position of the socket on the back of the vac. */
  frame(sx, sy, sz) {
    const P = this.pts, T = this.trail, [ox, oy, oz] = this.outlet.pos, [nx, , nz] = this.outlet.n;
    let n = 0;
    const add = (x, y, z) => { const p = P[n++]; p.x = x; p.y = y; p.z = z; };
    add(ox + nx * 0.04, oy, oz + nz * 0.04);
    add(ox + nx * 0.06, C.y, oz + nz * 0.06);
    for (let i = 0; i < T.length && n < P.length - 2; i++) { // a slight wander, so it doesn't look ruled
      const w = Math.sin(i * 1.7) * C.slack;
      add(T[i].x + w, C.y, T[i].z - w);
    }
    add(sx, C.y, sz);
    add(sx, sy, sz);
    const r = C.radius, pos = this.pos;
    for (let i = 0; i < n; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
      let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const px = P[i].x, py = P[i].y, pz = P[i].z, k = i * SIDES * 3;
      pos[k] = px - tz * r; pos[k + 1] = py; pos[k + 2] = pz + tx * r;
      pos[k + 3] = px; pos[k + 4] = py + r; pos[k + 5] = pz;
      pos[k + 6] = px + tz * r; pos[k + 7] = py; pos[k + 8] = pz - tx * r;
      pos[k + 9] = px; pos[k + 10] = py - r; pos[k + 11] = pz;
    }
    this.geo.setDrawRange(0, (n - 1) * SIDES * 6);
    this.geo.attributes.position.needsUpdate = true;
  }
}
