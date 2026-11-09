// The dust cloud: when he's furious enough he blows his bag out and it rolls through the whole house from where he stands.
// It's a true volume, worked out per pixel in the PS1 material (a ray through a growing sphere, inside the house), so it
// thickens with distance like real smog. Motes around you and a few big puffs give it something to see moving.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { LEVEL } from '../data/level.js';
import { PS1 } from '../render/ps1-material.js';

const F = TUNING.fog;
const rnd = (a) => (Math.random() * 2 - 1) * a;
const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

function puffTexture() {
  const n = 48, c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d'), img = g.createImageData(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const d = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2), w = 0.72 + 0.28 * Math.sin(x * 0.7 + Math.sin(y * 0.5) * 2) * Math.sin(y * 0.6);
    const i = (x + y * n) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.max(0, (1 - d / w)) * 210;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class DustCloud {
  constructor(scene) {
    this.phase = 'idle'; // 'idle' | 'grow' | 'hold' | 'thin'
    this.t = 0; this.clock = 0; this.radius = 0; this.thick = 0;
    this.pos = new THREE.Vector3(); this.min = new THREE.Vector3(); this.max = new THREE.Vector3();
    const u = PS1.uniforms;
    this.u = u; u.uPs1CloudColor.value.setHex(F.color); u.uPs1CloudDensity.value = F.density;
    const n = F.motes, p = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.motes = new THREE.Points(geo, new THREE.PointsMaterial({ color: F.moteColor, size: F.moteSize, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.motes.frustumCulled = false; this.motes.visible = false; scene.add(this.motes);
    this.moteV = Array.from({ length: n }, () => ({ x: rnd(0.12), y: rnd(0.07), z: rnd(0.12), p: Math.random() * 6 }));
    const tex = puffTexture();
    this.puffs = Array.from({ length: F.puffs }, () => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: F.color, transparent: true, opacity: 0, depthWrite: false, fog: false }));
      s.visible = false; scene.add(s);
      return { s, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 1, life: 0, born: 0 };
    });
  }

  get active() { return this.phase !== 'idle'; }

  release(x, y, z) {
    const U = this.u, XS = LEVEL.rooms.flatMap((r) => [r.min[0], r.max[0]]), ZS = LEVEL.rooms.flatMap((r) => [r.min[1], r.max[1]]);
    this.phase = 'grow'; this.t = 0; this.pos.set(x, y, z);
    this.min.set(Math.min(...XS), 0, Math.min(...ZS)); this.max.set(Math.max(...XS), LEVEL.ceiling, Math.max(...ZS));
    U.uPs1CloudPos.value.copy(this.pos); U.uPs1CloudMin.value.copy(this.min); U.uPs1CloudMax.value.copy(this.max);
    const pos = this.motes.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setXYZ(i, this.min.x + Math.random() * (this.max.x - this.min.x), Math.random() * 2.6, this.min.z + Math.random() * (this.max.z - this.min.z));
    pos.needsUpdate = true;
    this.motes.visible = true;
  }

  /** One puff of dust out of the nozzle, flying along (dx, dy, dz). */
  emit(x, y, z, dx, dy, dz, speed) {
    let b = this.puffs[0];
    for (const p of this.puffs) if (p.life < b.life) b = p;
    const j = () => (Math.random() - 0.5) * 0.5;
    b.x = x; b.y = y; b.z = z; b.vx = (dx + j()) * speed; b.vy = (dy + j()) * speed; b.vz = (dz + j()) * speed; b.size = 0.12; b.life = F.puffLife; b.s.visible = true;
  }

  /** Fade away quickly (he was unplugged, the run ended). */
  thin() { if (this.phase === 'idle' || this.phase === 'thin') return; this.phase = 'thin'; this.t = 0; }

  reset() {
    this.phase = 'idle'; this.t = 0; this.radius = 0; this.thick = 0; this.u.uPs1CloudAmt.value = 0; this.motes.visible = false;
    for (const b of this.puffs) { b.s.visible = false; b.s.material.opacity = 0; b.life = 0; }
  }

  /** How thick it is at a point: 0 ahead of the front as it spreads, up to 1 behind it. */
  amountAt(x, y, z) {
    if (!this.active || x < this.min.x || x > this.max.x || z < this.min.z || z > this.max.z) return 0;
    const d = Math.hypot(x - this.pos.x, y - this.pos.y, z - this.pos.z);
    return d >= this.radius ? 0 : this.thick * smooth((this.radius - d) / 0.8);
  }

  tick(dt) {
    this.clock += dt;
    for (const b of this.puffs) {
      if (b.life <= 0) continue;
      b.life -= dt; if (b.life <= 0) { b.s.visible = false; continue; }
      const drag = Math.exp(-2.2 * dt);
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.vx *= drag; b.vy = b.vy * drag - 0.05 * dt; b.vz *= drag; b.size = Math.min(F.puffSize, b.size + 1.5 * dt); b.y = Math.max(0.15, Math.min(LEVEL.ceiling - 0.15, b.y));
    }
    if (this.phase === 'idle') return;
    this.t += dt;
    if (this.phase === 'grow') {
      const k = smooth(this.t / F.grow);
      this.radius = F.radius * (0.15 + 0.85 * k); this.thick = k;
      if (this.t >= F.grow) { this.phase = 'hold'; this.t = 0; }
    } else if (this.phase === 'hold') {
      this.radius = F.radius; this.thick = 1;
      if (this.t >= F.hold) { this.phase = 'thin'; this.t = 0; }
    } else {
      this.thick = 1 - smooth(this.t / F.fade);
      if (this.t >= F.fade) { this.reset(); return; }
    }
  }

  /** Per rendered frame. */
  frame(dt, cam) {
    const U = this.u;
    U.uPs1CloudAmt.value = this.thick; U.uPs1CloudR.value = this.radius; U.uPs1CloudTime.value = this.clock;
    for (const b of this.puffs) { if (b.life <= 0) continue; b.s.position.set(b.x, b.y, b.z); b.s.scale.setScalar(b.size); b.s.material.opacity = F.puffAlpha * Math.min(1, b.life / 1.2); }
    if (this.phase === 'idle') return;
    const pos = this.motes.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const v = this.moteV[i], W = Math.sin(this.clock * 0.7 + v.p) * 0.05;
      let x = pos.getX(i) + (v.x + W) * dt, y = pos.getY(i) + v.y * dt, z = pos.getZ(i) + (v.z - W) * dt;
      const wrap = (v, c, half) => c - half + ((((v - c + half) % (2 * half)) + 2 * half) % (2 * half)); // the motes stay around you, wherever you go
      x = wrap(x, cam.x, F.moteBox); z = wrap(z, cam.z, F.moteBox);
      if (y < 0.02) y = 2.6; if (y > 2.7) y = 0.05;
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
    this.motes.material.opacity = this.thick * F.moteAlpha;
  }
}
