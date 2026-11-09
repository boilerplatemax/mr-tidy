// What a knock-over leaves behind (build prompt 0.5, 6.3): 3–6 small cubes that scatter and settle, and a flat coloured
// square on the floor. Each pair is registered as a mess for the vac to clean later. Cleaning is cosmetic: progress was
// already made when the thing hit the floor.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { makePS1 } from '../render/ps1-material.js';

const K = TUNING.knock, D = TUNING.debris;
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color();
const _e = new THREE.Euler(), _up = new THREE.Vector3(0, 1, 0);
const rand = (a, b) => a + Math.random() * (b - a);

export class Debris {
  constructor(scene, world) {
    this.world = world;
    const cubeMat = makePS1(new THREE.MeshLambertMaterial({ color: TUNING.house.colors.knockable }));
    this.cubes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), cubeMat, D.maxCubes);
    this.cubes.frustumCulled = false;
    const hide = _m.makeScale(0, 0, 0);
    for (let i = 0; i < D.maxCubes; i++) this.cubes.setMatrixAt(i, hide);
    scene.add(this.cubes);
    const decalMat = makePS1(new THREE.MeshLambertMaterial({ color: 0xffffff }));
    this.decals = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), decalMat, D.maxDecals);
    this.decals.frustumCulled = false;
    this.decals.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(D.maxDecals * 3), 3);
    for (let i = 0; i < D.maxDecals; i++) this.decals.setMatrixAt(i, hide);
    scene.add(this.decals);
    this.live = []; // cubes still moving
    this.nextCube = 0; this.nextDecal = 0;
    this.messes = []; // what the vac will come to clean
    this._cur = null;
    this._clip = (nx, nz) => { const c = this._cur, vn = c.vx * nx + c.vz * nz; if (vn < 0) { c.vx -= nx * vn * 1.4; c.vz -= nz * vn * 1.4; } };
  }

  /** Scatter cubes from a point. Returns the instance indices (a mess remembers them). */
  burst(x, z, sizeRange, count) {
    const out = [];
    for (let k = 0; k < count && this.nextCube < D.maxCubes; k++) {
      const a = Math.random() * Math.PI * 2, sp = rand(D.speed[0], D.speed[1]);
      const c = {
        i: this.nextCube++, x, y: D.startY, z, px: x, py: D.startY, pz: z,
        vx: Math.cos(a) * sp, vy: rand(D.up[0], D.up[1]), vz: Math.sin(a) * sp,
        size: rand(sizeRange[0], sizeRange[1]), rx: rand(0, 6), ry: rand(0, 6), rz: rand(0, 6), wx: rand(-14, 14), wy: rand(-14, 14), wz: rand(-14, 14), bounces: 0,
      };
      this.live.push(c);
      out.push(c.i);
    }
    return out;
  }

  /** The flat coloured square. Returns its instance index. */
  decal(x, z, size, color, yaw) {
    if (this.nextDecal >= D.maxDecals) return -1;
    const i = this.nextDecal++;
    _p.set(x, D.decalY + i * D.decalStep, z); // each a hair higher, so overlapping squares never z-fight
    _q.setFromAxisAngle(_up, yaw);
    _s.set(size, 1, size);
    this.decals.setMatrixAt(i, _m.compose(_p, _q, _s));
    this.decals.setColorAt(i, _c.setHex(color));
    this.decals.instanceMatrix.needsUpdate = true;
    this.decals.instanceColor.needsUpdate = true;
    return i;
  }

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
  }

  _draw(c, alpha) {
    _p.set(c.px + (c.x - c.px) * alpha, c.py + (c.y - c.py) * alpha, c.pz + (c.z - c.pz) * alpha);
    _q.setFromEuler(_e.set(c.rx, c.ry, c.rz));
    _s.setScalar(c.size);
    this.cubes.setMatrixAt(c.i, _m.compose(_p, _q, _s));
    this.cubes.instanceMatrix.needsUpdate = true;
  }

  /** Per rendered frame. */
  frame(alpha) { for (const c of this.live) this._draw(c, alpha); }
}
