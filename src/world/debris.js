// What a knock-over leaves behind: shards that scatter and settle, a stain on the floor, and whatever survived (a lid that
// rolls away, teeth that chatter across the tiles, feathers drifting down). Each is registered as a mess for the vac to clean
// later. Cleaning is cosmetic: progress was already made when the thing hit the floor.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { makePS1, clonePS1, pixelTexture } from '../render/ps1-material.js';

const K = TUNING.knock, D = TUNING.debris;
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color();
const _e = new THREE.Euler(), _up = new THREE.Vector3(0, 1, 0), _z = new THREE.Vector3(0, 0, 1), _d = new THREE.Vector3();
const rand = (a, b) => a + Math.random() * (b - a);

export class Debris {
  constructor(scene, world) {
    this.scene = scene; this.world = world;
    const shardMat = makePS1(new THREE.MeshLambertMaterial({ color: 0xffffff }));
    this.cubes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), shardMat, D.maxCubes);
    this.cubes.frustumCulled = false;
    this.cubes.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(D.maxCubes * 3).fill(1), 3);
    const hide = _m.makeScale(0, 0, 0);
    for (let i = 0; i < D.maxCubes; i++) this.cubes.setMatrixAt(i, hide);
    scene.add(this.cubes);
    // the stains: a pool of flat quads, one material per kind of mess
    this.decalGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.decalMats = new Map();
    this.decalPool = Array.from({ length: D.maxDecals }, () => { const m = new THREE.Mesh(this.decalGeo); m.visible = false; m.frustumCulled = false; scene.add(m); return m; });
    this.live = []; // shards still moving
    this.all = []; this.decalInfo = []; // every shard and decal laid down, by index (cleaning needs them)
    this.nextCube = 0; this.nextDecal = 0;
    this.messes = []; // what the vac will come to clean
    this.bits = []; // whole pieces: lids, teeth, feathers, buttons, ribbons
    this.tints = new Map();
    this._cur = null;
    this._clip = (nx, nz) => { const c = this._cur, vn = c.vx * nx + c.vz * nz; if (vn < 0) { c.vx -= nx * vn * 1.4; c.vz -= nz * vn * 1.4; } };
  }

  /** The shape shards are made from (from the knockables pack), scaled to a unit box. */
  setShardShape(geo) {
    const g = geo.clone(); g.computeBoundingBox();
    const b = g.boundingBox, s = 1 / Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);
    g.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -(b.min.z + b.max.z) / 2).scale(s, s, s);
    this.cubes.geometry = g;
  }

  /** A copy of a material in this colour (shared between everything of that colour). */
  tinted(mat, hex) {
    const key = mat.uuid + hex;
    if (!this.tints.has(key)) { const c = clonePS1(mat); c.color.set(hex); this.tints.set(key, c); }
    return this.tints.get(key);
  }

  /** Scatter shards from a point. Returns the instance indices (a mess remembers them). */
  burst(x, z, sizeRange, count, tint = 0xece6d8, y0 = D.startY) {
    const out = [];
    for (let k = 0; k < count && this.nextCube < D.maxCubes; k++) {
      const a = Math.random() * Math.PI * 2, sp = rand(D.speed[0], D.speed[1]);
      const c = {
        i: this.nextCube++, x, y: y0, z, px: x, py: y0, pz: z,
        vx: Math.cos(a) * sp, vy: rand(D.up[0], D.up[1]), vz: Math.sin(a) * sp,
        size: rand(sizeRange[0], sizeRange[1]), rx: rand(0, 6), ry: rand(0, 6), rz: rand(0, 6), wx: rand(-14, 14), wy: rand(-14, 14), wz: rand(-14, 14), bounces: 0,
      };
      this.cubes.setColorAt(c.i, _c.set(tint));
      this.live.push(c); this.all[c.i] = c;
      out.push(c.i);
    }
    this.cubes.instanceColor.needsUpdate = true;
    return out;
  }

  _decalMat(kind) {
    if (!this.decalMats.has(kind)) {
      const t = new THREE.TextureLoader().load(`game-assets/textures/mess/mess_${kind}.png`);
      t.colorSpace = THREE.SRGBColorSpace; pixelTexture(t);
      this.decalMats.set(kind, makePS1(new THREE.MeshLambertMaterial({ map: t, alphaTest: 0.3, transparent: false })));
    }
    return this.decalMats.get(kind);
  }

  /** A stain on the floor. Returns its index (-1: none). */
  decal(x, z, size, kind, yaw) {
    if (!kind || this.nextDecal >= D.maxDecals) return -1;
    const i = this.nextDecal++, m = this.decalPool[i], y = D.decalY + i * D.decalStep; // each a hair higher, so overlaps never z-fight
    m.material = this._decalMat(kind);
    m.position.set(x, y, z); m.rotation.y = yaw; m.scale.set(size, 1, size); m.visible = true;
    this.decalInfo[i] = { y, x, z, size, yaw };
    return i;
  }

  /**
   * A whole piece thrown clear. mode: 'tumble' (lands and settles), 'roll' (keeps rolling a while), 'hop' (chatters across
   * the floor), 'drift' (a feather), 'puff' (a cloud that grows and fades), 'lie' (just lying there). Returns it.
   */
  bit(mesh, x, y, z, mode = 'tumble', opts = {}) {
    const a = opts.dir ?? Math.random() * Math.PI * 2, sp = opts.speed ?? rand(0.5, 1.4);
    const b = { mesh, x, y, z, px: x, py: y, pz: z, vx: Math.cos(a) * sp, vy: opts.up ?? rand(1, 2.4), vz: Math.sin(a) * sp, mode, t: 0, life: opts.life ?? 3, r: opts.r ?? 0.03, q: new THREE.Quaternion(), w: opts.spin ?? rand(6, 16), ax: new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(), scale: mesh.scale.x, onFloor: false, settled: false, hopT: 0, sway: rand(0, 6), link: null };
    if (mode === 'lie') { b.settled = true; b.q.copy(mesh.quaternion); }
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.bits.push(b);
    return b;
  }

  /** Clears everything, for a new run. */
  reset() {
    const hide = _m.makeScale(0, 0, 0);
    for (let i = 0; i < D.maxCubes; i++) this.cubes.setMatrixAt(i, hide);
    for (const m of this.decalPool) m.visible = false;
    this.cubes.instanceMatrix.needsUpdate = true;
    for (const b of this.bits) this.scene.remove(b.mesh);
    this.bits.length = 0;
    this.live.length = 0; this.all.length = 0; this.decalInfo.length = 0; this.messes.length = 0;
    this.nextCube = 0; this.nextDecal = 0;
  }

  /** One moment of a mess being sucked up. u: 0..1. Everything flies to (hx, hy, hz) and shrinks; the stain shrinks away. */
  cleanStep(mess, u, hx, hy, hz) {
    const e = u * u;
    for (const i of mess.cubes) {
      const c = this.all[i], k = this.live.indexOf(c);
      if (k >= 0) { c.vx = c.vz = 0; this.live.splice(k, 1); }
      _p.set(c.x + (hx - c.x) * e, c.y + (hy - c.y) * e, c.z + (hz - c.z) * e);
      _q.setFromEuler(_e.set(c.rx + e * 8, c.ry + e * 8, c.rz));
      _s.setScalar(c.size * Math.max(0, 1 - e));
      this.cubes.setMatrixAt(i, _m.compose(_p, _q, _s));
    }
    this.cubes.instanceMatrix.needsUpdate = true;
    for (const b of mess.bits || []) {
      if (!b.from) { b.from = new THREE.Vector3(b.x, b.y, b.z); b.settled = true; b.link = null; }
      b.mesh.position.copy(b.from).lerp(_p.set(hx, hy, hz), e);
      b.mesh.scale.setScalar(b.scale * Math.max(0, 1 - e));
      if (u >= 1) b.mesh.visible = false;
    }
    if (mess.decal >= 0) {
      const d = this.decalInfo[mess.decal], m = this.decalPool[mess.decal];
      m.scale.set(d.size * (1 - u), 1, d.size * (1 - u));
      if (u >= 1) m.visible = false;
    }
  }

  _tickBit(b, dt) {
    b.t += dt; b.px = b.x; b.py = b.y; b.pz = b.z;
    if (b.mode === 'puff') { if (b.t >= b.life) b.settled = true; return; }
    if (b.mode === 'drift') { // falling like a feather
      b.vy = -0.28; b.x += Math.sin(b.t * 3 + b.sway) * 0.5 * dt + b.vx * dt * Math.exp(-b.t * 2); b.z += Math.cos(b.t * 2.4 + b.sway) * 0.5 * dt + b.vz * dt * Math.exp(-b.t * 2); b.y += b.vy * dt;
      this._turn(b, dt, 2.5);
      if (b.y <= 0.01) { b.y = 0.01; b.settled = true; }
      return;
    }
    const g = K.gravity;
    b.vy -= g * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    this._cur = b;
    this.world.resolve(b, b.r, b.y + 0.005, b.y + 0.08, this._clip, 2, b.y);
    if (b.y <= 0) {
      b.y = 0;
      if (b.mode === 'hop') { // teeth, chattering: little hops in a new direction each time, until they run out
        if (b.t < b.life) { const a = Math.random() * 6.28; b.vy = rand(0.9, 1.5); b.vx = Math.cos(a) * rand(0.3, 0.8); b.vz = Math.sin(a) * rand(0.3, 0.8); this._turn(b, dt, 30); return; }
        b.settled = true; return;
      }
      if (b.mode === 'roll' && b.t < b.life) { const s = Math.max(0.2, 1.2 * (1 - b.t / b.life)), l = Math.hypot(b.vx, b.vz) || 1; b.vy = 0; b.vx = (b.vx / l) * s; b.vz = (b.vz / l) * s; this._turn(b, dt, s * 22); return; }
      if (Math.abs(b.vy) > 0.9) { b.vy = -b.vy * 0.35; b.vx *= 0.55; b.vz *= 0.55; return; }
      b.settled = true; return;
    }
    this._turn(b, dt, b.w);
  }

  _turn(b, dt, w) { b.q.premultiply(_q.setFromAxisAngle(b.ax, w * dt)); }

  /** Per fixed tick. */
  tick(dt) {
    for (let n = this.live.length - 1; n >= 0; n--) {
      const c = this.live[n], r = c.size / 2;
      c.px = c.x; c.py = c.y; c.pz = c.z;
      c.vy -= K.gravity * dt;
      c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
      c.rx += c.wx * dt; c.ry += c.wy * dt; c.rz += c.wz * dt;
      this._cur = c;
      this.world.resolve(c, r, c.y + 0.001, c.y + c.size, this._clip, 2, c.y);
      if (c.y <= r) {
        c.y = r; c.bounces++;
        if (c.bounces >= D.bounces || Math.abs(c.vy) < 0.5) { c.vx = c.vz = c.vy = 0; c.wx = c.wy = c.wz = 0; this._draw(c, 1); this.live.splice(n, 1); continue; }
        c.vy = -c.vy * D.bounce; c.vx *= 0.55; c.vz *= 0.55; c.wx *= 0.5; c.wy *= 0.5; c.wz *= 0.5;
      }
    }
    for (const b of this.bits) if (!b.settled) this._tickBit(b, dt);
  }

  _draw(c, alpha) {
    _p.set(c.px + (c.x - c.px) * alpha, c.py + (c.y - c.py) * alpha, c.pz + (c.z - c.pz) * alpha);
    _q.setFromEuler(_e.set(c.rx, c.ry, c.rz));
    _s.setScalar(c.size);
    this.cubes.setMatrixAt(c.i, _m.compose(_p, _q, _s));
    this.cubes.instanceMatrix.needsUpdate = true;
  }

  /** Per rendered frame. */
  frame(alpha) {
    for (const c of this.live) this._draw(c, alpha);
    for (const b of this.bits) {
      if (b.from) continue;
      if (b.settled && b.mode !== 'puff' && !b.link && b.drawn) continue;
      b.drawn = true;
      if (b.mode === 'puff') {
        const u = Math.min(1, b.t / b.life);
        b.mesh.visible = u < 1; b.mesh.scale.setScalar(b.scale * (0.3 + 0.9 * u)); b.mesh.material.opacity = 0.75 * (1 - u); b.mesh.position.set(b.x, b.y, b.z);
        continue;
      }
      b.mesh.position.set(b.px + (b.x - b.px) * alpha, b.py + (b.y - b.py) * alpha, b.pz + (b.z - b.pz) * alpha);
      if (b.mode !== 'lie') b.mesh.quaternion.copy(b.q);
      if (b.link) { // the curly cord between the phone and its handset
        const m = b.link.mesh, a = b.link.from, p = b.mesh.position;
        m.position.set(a.x, a.y + 0.04, a.z);
        _d.set(p.x - a.x, p.y + 0.03 - (a.y + 0.04), p.z - a.z);
        const l = _d.length();
        if (l > 1e-4) { m.quaternion.setFromUnitVectors(_z, _d.divideScalar(l)); m.scale.set(1, 1, l / 0.26); }
      }
    }
  }
}
void _up;
