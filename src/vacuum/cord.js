// The power cord: a thin tube along the floor from the outlet by Grandma's door to the reel on the back of the vac. It's a
// fixed length, and it lies along the route he actually took, so it's the Vacuum that decides where it runs (see its
// tether). When he retraces his steps it reels back in. It doesn't block the cat. If the cat swipes the outlet, the cord
// whips back to him and then goes out to another one; setTrim draws that. It's here for the Phase 2 ending too.
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
    this.plug = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.03), makePS1(new THREE.MeshLambertMaterial({ color: C.plugColor })));
    scene.add(this.plug);
    this.via = [];
    this.trim = 0; // 0 = all the way to the outlet .. 1 = fully back at the vac
    this.setOutlet(this.outlet);
    this.pts = Array.from({ length: max }, () => ({ x: 0, y: 0, z: 0 }));
    // sparks off the plug (the blackout: the cat touches it and it bites)
    this.sparkPos = new Float32Array(10 * 5 * 6); const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3));
    this.sparkMesh = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xd8ecff, fog: false })); this.sparkMesh.frustumCulled = false; this.sparkMesh.visible = false; scene.add(this.sparkMesh);
    this.sparkT = 0; this.sparkAt = new THREE.Vector3();
  }

  /** A crackling burst of sparks off the plug at p, for a moment. */
  sparks(p) { this.sparkAt.set(p.x, p.y, p.z); this.sparkT = C.sparkTime; }

  _sparks(dt) {
    if (this.sparkT <= 0) { this.sparkMesh.visible = false; return; }
    this.sparkT -= dt;
    const a = this.sparkPos, o = this.sparkAt, [nx, , nz] = this.outlet.n; let w = 0;
    for (let k = 0; k < 10; k++) { // jagged little arcs, flying out from the plate
      let x = o.x + nx * 0.02, y = o.y, z = o.z + nz * 0.02;
      const dx = nx * 0.03 + (Math.random() - 0.5) * 0.05, dy = (Math.random() - 0.4) * 0.05, dz = nz * 0.03 + (Math.random() - 0.5) * 0.05;
      for (let i = 0; i < 5; i++) { const x1 = x + dx + (Math.random() - 0.5) * 0.02, y1 = y + dy + (Math.random() - 0.5) * 0.02, z1 = z + dz + (Math.random() - 0.5) * 0.02; a[w++] = x; a[w++] = y; a[w++] = z; a[w++] = x1; a[w++] = y1; a[w++] = z1; x = x1; y = y1; z = z1; }
    }
    this.sparkMesh.geometry.attributes.position.needsUpdate = true;
    this.sparkMesh.visible = Math.random() < 0.85;
  }

  setOutlet(o) {
    this.outlet = o;
    const [x, y, z] = o.pos, [nx, , nz] = o.n;
    this.plug.position.set(x + nx * 0.02, y, z + nz * 0.02);
    this.plug.rotation.y = Math.atan2(nx, nz);
    this.plugHome = this.plug.position.clone();
  }

  /** Where the plug is when it's in the wall: what the cat has to reach. */
  get plugPos() { return this.plugHome; }

  /** How much of the cord is drawn, from the far end: 0 = all of it, 1 = none (reeled back to the vac). */
  setTrim(t) { this.trim = Math.max(0, Math.min(1, t)); }

  /**
   * Per rendered frame. nodes[0..count): the waypoints the cord lies along, from the outlet end.
   * (vx, vz): the vac on the floor. (sx, sy, sz): where it leaves the reel.
   */
  frame(nodes, count, vx, vz, sx, sy, sz, dt = 1 / 60) {
    this._sparks(dt);
    const P = this.pts, [ox, oy, oz] = this.outlet.pos, [nx, , nz] = this.outlet.n;
    let n = 0, s = 0;
    const add = (x, y, z) => { if (n < P.length) { const p = P[n++]; p.x = x; p.y = y; p.z = z; } };
    const fx = ox + nx * 0.06, fz = oz + nz * 0.06;
    add(ox + nx * 0.04, oy, oz + nz * 0.04);
    add(fx, C.y, fz);
    let lx = fx, lz = fz;
    const run = (tx, tz) => { // a stretch of floor, drifting a little off straight (and back to it at both ends, so the curves join up)
      const len = Math.hypot(tx - lx, tz - lz), steps = Math.max(1, Math.ceil(len / C.spacing));
      const nx = len > 1e-5 ? -(tz - lz) / len : 0, nz = len > 1e-5 ? (tx - lx) / len : 0;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps, w = Math.sin(t * Math.PI) * (Math.sin((s + len * t) * C.wanderRate) + 0.5 * Math.sin((s + len * t) * C.wanderRate * 2.3 + 1)) * Math.min(C.wander, len * 0.08);
        add(lx + (tx - lx) * t + nx * w, C.y, lz + (tz - lz) * t + nz * w);
      }
      s += len; lx = tx; lz = tz;
    };
    // the points it passes, each corner taken as a curve (a tight one off the graph, where something solid is right there)
    const via = this.via; via.length = 0;
    via.push(fx, fz, 0);
    for (let i = 0; i < count; i++) via.push(nodes[i].x, nodes[i].z, nodes[i].virtual ? 1 : 0);
    via.push(sx, sz, 0);
    const N = via.length / 3;
    for (let i = 1; i < N - 1; i++) {
      const cx = via[i * 3], cz = via[i * 3 + 1], ax = via[i * 3 - 3], az = via[i * 3 - 2], bx = via[i * 3 + 3], bz = via[i * 3 + 4];
      const la = Math.hypot(cx - ax, cz - az), lb = Math.hypot(bx - cx, bz - cz);
      if (la < 1e-4 || lb < 1e-4) continue;
      const r = Math.min(via[i * 3 + 2] ? C.roundTight : C.round, la * 0.48, lb * 0.48);
      const ex = cx - ((cx - ax) / la) * r, ez = cz - ((cz - az) / la) * r, ox = cx + ((bx - cx) / lb) * r, oz = cz + ((bz - cz) / lb) * r;
      run(ex, ez);
      const bend = Math.acos(Math.max(-1, Math.min(1, ((cx - ax) * (bx - cx) + (cz - az) * (bz - cz)) / (la * lb)))), curve = Math.max(C.roundSteps, Math.ceil(bend / 0.09));
      for (let k = 1; k <= curve; k++) { // a quadratic curve with the waypoint as its control point
        const t = k / curve, u = 1 - t, x = u * u * ex + 2 * u * t * cx + t * t * ox, z = u * u * ez + 2 * u * t * cz + t * t * oz;
        add(x, C.y, z); lx = x; lz = z;
      }
    }
    run(sx, sz); // straight to the reel, not under his body
    add(sx, sy, sz);
    // trimming drops points from the outlet end: the free end whips along the floor toward the reel
    const start = Math.min(n - 1, Math.round(this.trim * (n - 1)));
    this.n = n; this.start = start; // (what is drawn: P[start..n), from the outlet end to the reel)
    if (!this.plugHeld) { // (the ending: Grandma has it in her hand)
      this.plug.visible = this.trim < 0.999;
      if (this.trim > 0.001) this.plug.position.set(P[start].x, Math.max(P[start].y, 0.03), P[start].z);
      else this.plug.position.copy(this.plugHome);
    }
    const r = C.radius, pos = this.pos, m = n - start;
    for (let i = start; i < n; i++) {
      const a = P[Math.max(start, i - 1)], b = P[Math.min(n - 1, i + 1)];
      let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const px = P[i].x, py = P[i].y, pz = P[i].z, k = (i - start) * SIDES * 3;
      pos[k] = px - tz * r; pos[k + 1] = py; pos[k + 2] = pz + tx * r;
      pos[k + 3] = px; pos[k + 4] = py + r; pos[k + 5] = pz;
      pos[k + 6] = px + tz * r; pos[k + 7] = py; pos[k + 8] = pz - tx * r;
      pos[k + 9] = px; pos[k + 10] = py - r; pos[k + 11] = pz;
    }
    this.mesh.visible = m >= 2;
    this.geo.setDrawRange(0, Math.max(0, m - 1) * SIDES * 6);
    this.geo.attributes.position.needsUpdate = true;
  }
}
