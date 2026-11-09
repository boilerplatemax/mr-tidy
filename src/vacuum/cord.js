// The power cord: a thin tube along the floor from the outlet by Grandma's door to the reel on the back of the vac. It's a
// fixed length, and it lies along the route he actually took, so it's the Vacuum that decides where it runs (see its
// tether). When he retraces his steps it reels back in. It doesn't block the cat. It's here for the Phase 2 ending too,
// when Grandma unplugs it.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { LEVEL } from '../data/level.js';
import { makePS1 } from '../render/ps1-material.js';

const C = TUNING.cord;
const SIDES = 4;

export class Cord {
  constructor(scene) {
    this.outlet = LEVEL.outlets[0];
    const max = C.capacity;
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
    const [x, y, z] = this.outlet.pos, [nx, , nz] = this.outlet.n;
    this.plug = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.03), makePS1(new THREE.MeshLambertMaterial({ color: C.plugColor })));
    this.plug.position.set(x + nx * 0.02, y, z + nz * 0.02);
    this.plug.rotation.y = Math.atan2(nx, nz);
    scene.add(this.plug);
    this.pts = Array.from({ length: max }, () => ({ x: 0, y: 0, z: 0 }));
  }

  /**
   * Per rendered frame. nodes[0..count): the waypoints the cord lies along, from the outlet end.
   * (vx, vz): the vac on the floor. (sx, sy, sz): where it leaves the reel.
   */
  frame(nodes, count, vx, vz, sx, sy, sz) {
    const P = this.pts, [ox, oy, oz] = this.outlet.pos, [nx, , nz] = this.outlet.n;
    let n = 0, s = 0;
    const add = (x, y, z) => { if (n < P.length) { const p = P[n++]; p.x = x; p.y = y; p.z = z; } };
    const fx = ox + nx * 0.06, fz = oz + nz * 0.06;
    add(ox + nx * 0.04, oy, oz + nz * 0.04);
    add(fx, C.y, fz);
    let lx = fx, lz = fz;
    const run = (tx, tz) => { // a stretch of floor, in short pieces with a slight wander, so it doesn't look ruled
      const len = Math.hypot(tx - lx, tz - lz), steps = Math.max(1, Math.ceil(len / C.spacing));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps, w = i === steps ? 0 : Math.sin((s + len * t) * 3.1) * C.slack;
        add(lx + (tx - lx) * t + w, C.y, lz + (tz - lz) * t - w);
      }
      s += len; lx = tx; lz = tz;
    };
    for (let i = 0; i < count; i++) run(nodes[i].x, nodes[i].z);
    run(sx, sz); // straight to the reel, not under his body
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
