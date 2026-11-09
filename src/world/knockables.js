// Knockable objects (build prompt 0.5, 6.2): a small custom physics, no library. Objects rest on surfaces, slide with
// friction when batted, tip when their centre passes an edge, tumble as they fall, and land on whatever is below.
// Hitting the floor counts as a knock-over: it breaks into cubes or bounces, leaves a mess, and makes a noise event.
//
// DESIGN NOTE: objects are not colliders for the cat. They're small, and a cat stumbling on a mug would fight the jumps.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { LEVEL } from '../data/level.js';
import { makePS1 } from '../render/ps1-material.js';
import { audio } from '../audio/audio.js';

const K = TUNING.knock, TYPES = TUNING.knockTypes, S = TUNING.swipe;

const buildGeometry = (t) => (t.shape === 'cyl' ? new THREE.CylinderGeometry(t.r, t.r, t.h, 10)
  : t.shape === 'sphere' ? new THREE.IcosahedronGeometry(t.r, 1)
  : new THREE.BoxGeometry(t.w, t.h, t.d));
const roomAt = (x, z) => LEVEL.rooms.find((r) => x >= r.min[0] && x <= r.max[0] && z >= r.min[1] && z <= r.max[1])?.id || null;

const _axis = new THREE.Vector3(), _dq = new THREE.Quaternion(), _up = new THREE.Quaternion();
const _v = new THREE.Vector3();

export class Knockables {
  constructor({ scene, world, byId, noise, debris }) {
    this.world = world; this.noise = noise; this.debris = debris;
    this.count = 0; // knock-overs so far (the vac's anger and the win screen read this)
    this.list = [];
    this.byId = new Map();
    this._g = { y: 0, surface: '', collider: null };
    this._clip = (nx, nz) => { const o = this._cur, vn = o.vx * nx + o.vz * nz; if (vn < 0) { o.vx -= nx * vn * (1 + K.wallBounce); o.vz -= nz * vn * (1 + K.wallBounce); } };
    const mat = makePS1(new THREE.MeshLambertMaterial({ color: TUNING.house.colors.knockable }));
    const geos = new Map();
    for (const d of LEVEL.knockables) {
      const t = TYPES[d.type];
      if (!geos.has(d.type)) geos.set(d.type, buildGeometry(t));
      const mesh = new THREE.Mesh(geos.get(d.type), mat);
      const top = d.on === 'floor' ? 0 : byId.get(d.on).max[1];
      const o = {
        id: d.id, type: d.type, t, mesh, mass: t.mass, h: t.h, r: t.shape === 'box' ? Math.max(t.w, t.d) * 0.45 : t.r,
        x: d.x, y: top, z: d.z, vx: 0, vy: 0, vz: 0, q: new THREE.Quaternion(), wx: 0, wy: 0, wz: 0,
        px: d.x, py: top, pz: d.z, pq: new THREE.Quaternion(),
        state: 'rest', tipT: 0, bounces: 0, dirty: true, knocked: false, start: { x: d.x, y: top, z: d.z },
      };
      scene.add(mesh);
      this.list.push(o); this.byId.set(o.id, o);
    }
    this.frame(1);
  }

  /** The bat of a paw: everything in a short cone in front of the eye gets a shove. Returns how many it hit. */
  swipe(player, camera) {
    camera.getWorldDirection(_v);
    const eye = camera.position, right = { x: Math.cos(player.yaw), z: -Math.sin(player.yaw) };
    let dx = player.fx - right.x * S.sideBias, dz = player.fz - right.z * S.sideBias; // the paw sweeps right to left
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    let hits = 0;
    for (const o of this.list) {
      if (o.state === 'gone') continue;
      const cx = o.x - eye.x, cy = o.y + o.h / 2 - eye.y, cz = o.z - eye.z, d = Math.hypot(cx, cy, cz);
      if (d > S.reach || d < 1e-3 || (cx * _v.x + cy * _v.y + cz * _v.z) / d < S.cone) continue;
      this.shove(o, dx, dz, Math.min(S.maxSpeed, S.impulse / o.mass));
      hits++;
    }
    if (hits) audio.play('knock.clink', { pos: eye, rate: 0.9 + Math.random() * 0.3 });
    return hits;
  }

  /** Give an object a push along (dx, dz) at this speed. */
  shove(o, dx, dz, speed) {
    if (o.t.topple && !o.knocked) { if (speed >= K.toppleSpeed) this._knockOver(o); return; } // knocked over where it stands
    o.vx += dx * speed; o.vz += dz * speed; o.dirty = true;
    if (o.state === 'rest') o.state = 'slide';
  }

  /** It hit the floor for the first time: that's a knock-over. Counts once, makes the noise and the mess, and breaks if it can. */
  _knockOver(o) {
    o.knocked = true; this.count++;
    const t = o.t, room = roomAt(o.x, o.z), D = this.debris;
    const cubes = t.breakable ? D.burst(o.x, o.z, TUNING.debris.cubeSize, t.cubes[0] + Math.floor(Math.random() * (t.cubes[1] - t.cubes[0] + 1))) : [];
    const decal = D.decal(o.x, o.z, t.decalSize, t.decal, Math.random() * Math.PI);
    D.messes.push({ id: o.id, x: o.x, z: o.z, room, decal, cubes, cleaned: false });
    if (t.breakable) {
      o.state = 'gone'; o.mesh.visible = false; o.vx = o.vy = o.vz = 0;
      audio.play('knock.break', { pos: o, rate: 0.9 + Math.random() * 0.25 });
    }
    this.noise.emit({ kind: 'crash', x: o.x, y: 0, z: o.z, loud: t.noise, room, objectId: o.id });
  }

  /** Per fixed tick. */
  tick(dt) {
    for (const o of this.list) {
      if (o.state === 'rest' || o.state === 'gone') continue;
      o.px = o.x; o.py = o.y; o.pz = o.z; o.pq.copy(o.q); o.dirty = true;
      this._cur = o;
      if (o.state === 'slide') this._slide(o, dt);
      else if (o.state === 'tip') this._tip(o, dt);
      else this._fall(o, dt);
    }
    this._separate();
  }

  _slide(o, dt) {
    const W = this.world;
    const speed = Math.hypot(o.vx, o.vz);
    if (speed > 1e-4) {
      const s = Math.max(0, speed - K.friction * dt) / speed;
      o.vx *= s; o.vz *= s;
    }
    o.x += o.vx * dt; o.z += o.vz * dt;
    W.resolve(o, o.r, o.y + 0.012, o.y + o.h, this._clip, 3, o.y);
    const g = W.ground(o.x, o.z, K.supportR, o.y + 0.04, this._g);
    if (g.y < o.y - 0.01) { this._startTip(o); return; } // the centre has passed the edge
    o.y = g.y;
    if (Math.abs(o.q.w) < 0.9999) o.q.slerp(_up.identity(), 0.3); // settle upright after a landing
    if (Math.hypot(o.vx, o.vz) < K.stopSpeed && Math.abs(o.q.w) >= 0.9999) { o.vx = o.vz = 0; o.q.identity(); o.state = 'rest'; }
  }

  _startTip(o) {
    let dx = o.vx, dz = o.vz, l = Math.hypot(dx, dz);
    if (l < 1e-3) { dx = 1; dz = 0; l = 1; }
    dx /= l; dz /= l;
    if (l < K.tipSpeed) { o.vx = dx * K.tipSpeed; o.vz = dz * K.tipSpeed; }
    // tips toward the edge: the rotation axis is up × direction
    o.wx = dz * K.tipRate; o.wy = 0; o.wz = -dx * K.tipRate;
    o.vy = 0; o.state = 'tip'; o.tipT = 0; o.bounces = 0;
  }

  _spin(o, dt) {
    const w = Math.hypot(o.wx, o.wy, o.wz);
    if (w < 1e-3) return;
    _axis.set(o.wx / w, o.wy / w, o.wz / w);
    o.q.premultiply(_dq.setFromAxisAngle(_axis, w * dt));
  }

  _tip(o, dt) {
    o.tipT += dt;
    this._spin(o, dt);
    o.x += o.vx * dt; o.z += o.vz * dt;
    o.vy -= K.gravity * K.tipGravity * dt; o.y += o.vy * dt;
    this._landing(o, dt);
    if (o.state === 'tip' && o.tipT >= K.tipTime) {
      o.wx += (Math.random() - 0.5) * K.spin; o.wy += (Math.random() - 0.5) * K.spin; o.wz += (Math.random() - 0.5) * K.spin;
      o.state = 'fall';
    }
  }

  _fall(o, dt) {
    this._spin(o, dt);
    o.x += o.vx * dt; o.z += o.vz * dt;
    o.vy -= K.gravity * dt; o.y += o.vy * dt;
    // landing first: on the tick it passes a surface's top, that surface is under it, not a wall to be pushed out of
    this._landing(o, dt);
    if (o.state === 'fall') this.world.resolve(o, o.r, o.y + 0.012, o.y + o.h, this._clip, 3, o.y);
  }

  /** Coming down onto the floor or any surface below (it lands on a chair or a lower shelf, it doesn't clip through). */
  _landing(o) {
    if (o.vy >= 0) return;
    const g = this.world.ground(o.x, o.z, K.supportR, o.py + 0.012, this._g);
    if (o.y > g.y) return;
    const impact = -o.vy, floor = !g.collider;
    o.y = g.y;
    if (floor && !o.knocked) { this._knockOver(o); if (o.state === 'gone') return; }
    if (impact > K.bounceMin && o.bounces < 1) { // one bounce, then it settles
      o.bounces++;
      o.vy = impact * K.bounce;
      o.vx *= K.bounceKeep; o.vz *= K.bounceKeep; o.wx *= 0.5; o.wy *= 0.5; o.wz *= 0.5;
      o.state = 'fall';
      audio.play(floor ? 'knock.thud' : 'knock.clink', { pos: o, gain: Math.min(1, impact / 5) });
      return;
    }
    o.vy = 0; o.wx = o.wy = o.wz = 0; o.bounces = 0;
    o.vx *= K.bounceKeep; o.vz *= K.bounceKeep;
    o.state = 'slide';
  }

  /** Two objects on the same level push each other apart, and pass some of their speed on. */
  _separate() {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j];
        if (a.state === 'gone' || b.state === 'gone' || (a.state === 'rest' && b.state === 'rest') || Math.abs(a.y - b.y) > 0.05) continue;
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = a.r + b.r;
        if (d >= min || d < 1e-4) continue;
        const nx = dx / d, nz = dz / d, push = min - d, ma = a.mass, mb = b.mass, tot = ma + mb;
        a.x -= nx * push * (mb / tot); a.z -= nz * push * (mb / tot);
        b.x += nx * push * (ma / tot); b.z += nz * push * (ma / tot);
        const rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
        if (rel <= 0) continue;
        const imp = (rel * (1 + K.objBounce)) / tot;
        a.vx -= imp * mb * nx; a.vz -= imp * mb * nz;
        b.vx += imp * ma * nx; b.vz += imp * ma * nz;
        if (a.state === 'rest') a.state = 'slide';
        if (b.state === 'rest') b.state = 'slide';
      }
    }
  }

  /** Per rendered frame: draw what moved, interpolated between ticks. */
  frame(alpha) {
    for (const o of this.list) {
      if (!o.dirty || o.state === 'gone') continue;
      o.mesh.position.set(o.px + (o.x - o.px) * alpha, o.py + (o.y - o.py) * alpha + o.h / 2, o.pz + (o.z - o.pz) * alpha);
      o.mesh.quaternion.slerpQuaternions(o.pq, o.q, alpha);
      if (o.state === 'rest') { o.px = o.x; o.py = o.y; o.pz = o.z; o.pq.copy(o.q); o.dirty = alpha < 1; }
    }
  }
}
