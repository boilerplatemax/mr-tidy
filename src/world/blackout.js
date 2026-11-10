// Stage 5: he has taken the house's power. The lights go, and what's left is what still gives any light: the television, a
// candle, the strip under Grandma's door, the fridge, a night-light, the moon. The lights exist from the start at no strength
// (changing how many there are would recompile every material), and the cat can just about see the floor in front of it.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { LEVEL } from '../data/level.js';
import { PS1 } from '../render/ps1-material.js';

const SG = TUNING.surge, COLOR = new THREE.Color(TUNING.fog.color), DIM = new THREE.Color(0x0a0a0d);

export class Blackout {
  constructor({ scene, env, house, knock, vac }) {
    Object.assign(this, { env, house, knock, vac });
    this.k = -1;
    this.lights = LEVEL.darkLights.map((d) => {
      const l = new THREE.PointLight(d.color, 0, d.dist, 1.1);
      l.position.set(d.x, d.y, d.z); scene.add(l);
      let flame = null;
      if (d.flame) { flame = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.045, 5), new THREE.MeshBasicMaterial({ color: 0xffc070, fog: false })); flame.position.fromArray(d.flame); flame.visible = false; scene.add(flame); }
      return { d, l, flame, seed: Math.random() * 10, next: 2 + Math.random() * 6, stut: 0, dim: 1 };
    });
    this.eye = new THREE.PointLight(0xa0a8b8, 0, SG.eyeDist, 1.2); scene.add(this.eye);
    // a few ceiling bulbs that won't quite die: on, sputtering, out, sputtering back (made now, at no strength)
    const bulbMat = () => new THREE.MeshBasicMaterial({ color: SG.bulbColor, fog: false, transparent: true, opacity: 0 });
    this.bulbs = SG.bulbs.map(([x, y, z]) => {
      const l = new THREE.PointLight(SG.bulbColor, 0, SG.bulbDist, 1.3); l.position.set(x, y - 0.12, z); scene.add(l);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), bulbMat()); glow.position.set(x, y, z); scene.add(glow);
      return { l, glow, phase: 'on', t: 1 + Math.random() * 4, level: 1, tick: 0 };
    });
  }

  /** A failing bulb, the way they really go: a steady-ish glow with a faint shimmer, then a sputter (fast, uneven blinks), out for a bit, a sputter, back. */
  _bulb(B, dt) {
    B.t -= dt;
    if (B.t <= 0) {
      const next = B.phase === 'on' ? 'sputter' : B.phase === 'sputter' ? (B.wasOff || Math.random() < 0.55 ? 'on' : 'off') : 'sputter';
      B.wasOff = B.phase === 'off'; B.phase = next;
      B.t = next === 'on' ? 1.2 + Math.random() * 5 : next === 'off' ? 0.25 + Math.random() * 2.2 : 0.25 + Math.random() * 0.9;
    }
    if (B.phase === 'on') B.level = 0.82 + Math.random() * 0.08 + Math.sin(performance.now() * 0.006) * 0.04;
    else if (B.phase === 'off') B.level = Math.random() < 0.02 ? 0.25 : 0.02; // (the odd ghost of a glow)
    else if ((B.tick -= dt) <= 0) { B.tick = 0.025 + Math.random() * 0.07; B.level = Math.random() < 0.5 ? 0.05 + Math.random() * 0.2 : 0.6 + Math.random() * 0.45; }
  }

  reset() { this.set(0); }

  set(k) {
    if (k === this.k) return;
    this.k = k;
    this.env.blend(TUNING.house.preset, 'blackout', k);
    this.house.setDark(k);
    PS1.uniforms.uPs1CloudColor.value.copy(COLOR).lerp(DIM, k * 0.86);
  }

  /** Per rendered frame. dark: 0 lights on .. 1 power gone. */
  frame(dark, time, camera) {
    this.set(dark);
    for (const L of this.lights) {
      const out = L.d.needs && this.knock.byId.get(L.d.needs)?.knocked;
      const w = 1 + L.d.flicker * (Math.sin(time * 11 + L.seed) * 0.5 + Math.sin(time * 27 + L.seed * 2) * 0.5);
      // now and then a light stutters, dips and catches again, once or twice: never quite steady, never quite safe
      if (dark > 0.5 && L.d.follow !== 'vac') {
        const dt = Math.max(0, Math.min(0.1, time - (this.last ?? time)));
        if (L.stut > 0) { L.stut -= dt; L.dim = Math.sin(L.stut * 38) > 0.2 ? L.low : 1; if (L.stut <= 0) L.dim = 1; }
        else if ((L.next -= dt) <= 0) { L.next = SG.stutterEvery[0] + Math.random() * (SG.stutterEvery[1] - SG.stutterEvery[0]); L.stut = 0.12 + Math.random() * 0.3; L.low = 0.1 + Math.random() * 0.35; }
      } else L.dim = 1;
      L.l.intensity = out ? 0 : L.d.power * w * dark * L.dim;
      if (L.d.follow === 'vac' && this.vac) L.l.position.set(this.vac.model.root.position.x, 0.45, this.vac.model.root.position.z);
      if (L.flame) L.flame.visible = dark > 0.5 && !out;
    }
    { const dt = Math.max(0, Math.min(0.1, time - (this.last ?? time))); for (const B of this.bulbs) { this._bulb(B, dt); const k = dark > 0.5 ? B.level * dark : 0; B.l.intensity = SG.bulbPower * k; B.glow.material.opacity = Math.min(1, k * 1.2); } }
    this.last = time;
    this.eye.intensity = SG.eyeLight * dark;
    this.eye.position.copy(camera.position);
  }
}
