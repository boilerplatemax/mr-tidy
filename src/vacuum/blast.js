// The dust blast: he runs his motor backwards and spits a glob of dirt from the nozzle. It doesn't home and it doesn't
// catch you: it hinders. It bursts on the first thing it meets, and anything it hits gets knocked (which can help you).
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { makePS1 } from '../render/ps1-material.js';
import { audio } from '../audio/audio.js';

const B = TUNING.blast;
const rnd = (a) => (Math.random() * 2 - 1) * a;

export class Blast {
  constructor(scene, vox, knock) {
    this.vox = vox; this.knock = knock;
    this.onHit = null; // the cat was hit
    this.state = 'idle'; // 'idle' | 'fly' | 'puff'
    this.pos = new THREE.Vector3(); this.prev = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.t = 0;
    const mat = makePS1(new THREE.MeshLambertMaterial({ color: B.color }));
    const geo = new THREE.BoxGeometry(1, 1, 1);
    this.cubes = Array.from({ length: B.cubes }, () => {
      const m = new THREE.Mesh(geo, mat); m.visible = false; scene.add(m);
      return { m, off: new THREE.Vector3(), out: new THREE.Vector3(), size: 0, spin: 0 };
    });
    this.lastHit = 'none'; // what the last one burst on (for tests and the debug overlay)
  }

  get active() { return this.state !== 'idle'; }

  reset() { this.state = 'idle'; for (const c of this.cubes) c.m.visible = false; }

  fire(origin, dir) {
    this.state = 'fly'; this.t = 0; this.lastHit = 'none';
    this.pos.copy(origin); this.prev.copy(origin);
    this.vel.copy(dir).multiplyScalar(B.speed);
    for (const c of this.cubes) {
      c.off.set(rnd(B.spread), rnd(B.spread), rnd(B.spread)); c.out.set(rnd(1), Math.random() * 0.8 - 0.1, rnd(1)).normalize();
      c.size = B.cubeSize * (0.6 + Math.random() * 0.8); c.spin = Math.random() * 6;
      c.m.visible = true;
    }
    audio.play('vac.spit', { pos: origin });
  }

  _burst(what) {
    this.state = 'puff'; this.t = 0; this.lastHit = what;
    audio.play('dust.hit', { pos: this.pos, gain: what === 'cat' ? 1 : 0.6 });
  }

  /** Per fixed tick. player: to see whether it hit the cat. */
  tick(dt, player) {
    this.prev.copy(this.pos);
    if (this.state === 'idle') return;
    this.t += dt;
    if (this.state === 'puff') { if (this.t >= B.puffTime) this.reset(); return; }
    this.vel.y -= B.gravity * dt;
    this.pos.addScaledVector(this.vel, dt);
    if (Math.hypot(this.pos.x - player.pos.x, this.pos.y - (player.feetY + 0.12), this.pos.z - player.pos.z) <= B.hit && !player.noclip) { this._burst('cat'); this.onHit?.(); return; }
    for (const o of this.knock.list) {
      if (o.state === 'gone' || o.knocked) continue;
      const dx = o.x - this.pos.x, dy = o.y + o.h / 2 - this.pos.y, dz = o.z - this.pos.z;
      if (Math.hypot(dx, dy, dz) > B.knockRadius) continue;
      const l = Math.hypot(this.vel.x, this.vel.z) || 1;
      this.knock.shove(o, this.vel.x / l, this.vel.z / l, B.knockSpeed);
      this._burst('object');
      return;
    }
    if (this.vox.blocked(this.pos.x, this.pos.y, this.pos.z) || this.pos.y <= 0.03) { this._burst('surface'); return; }
    if (this.t >= B.life) this._burst('air');
  }

  /** Per rendered frame. */
  frame(alpha) {
    if (this.state === 'idle') return;
    const x = this.prev.x + (this.pos.x - this.prev.x) * alpha, y = this.prev.y + (this.pos.y - this.prev.y) * alpha, z = this.prev.z + (this.pos.z - this.prev.z) * alpha;
    const puff = this.state === 'puff' ? Math.min(1, this.t / B.puffTime) : 0;
    for (const c of this.cubes) {
      c.m.position.set(x + c.off.x + c.out.x * puff * B.puffSize, y + c.off.y + c.out.y * puff * B.puffSize, z + c.off.z + c.out.z * puff * B.puffSize);
      c.m.rotation.set(c.spin + this.t * 9, c.spin * 2 + this.t * 7, 0);
      c.m.scale.setScalar(c.size * (1 - puff * puff));
    }
  }
}
