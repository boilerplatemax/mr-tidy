// Stage 5: he has taken the house's power. The lights go, and what's left is what still gives any light: the television, a
// candle, the strip under Grandma's door, the fridge, a night-light, the moon. The lights exist from the start at no strength
// (changing how many there are would recompile every material), and the cat can just about see the floor in front of it.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { LEVEL } from '../data/level.js';
import { PS1 } from '../render/ps1-material.js';

const SG = TUNING.surge, COLOR = new THREE.Color(TUNING.fog.color), DIM = new THREE.Color(0x0a0a0d);

export class Blackout {
  constructor({ scene, env, house, knock }) {
    Object.assign(this, { env, house, knock });
    this.k = -1;
    this.lights = LEVEL.darkLights.map((d) => {
      const l = new THREE.PointLight(d.color, 0, d.dist, 1.1);
      l.position.set(d.x, d.y, d.z); scene.add(l);
      let flame = null;
      if (d.flame) { flame = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.045, 5), new THREE.MeshBasicMaterial({ color: 0xffc070, fog: false })); flame.position.fromArray(d.flame); flame.visible = false; scene.add(flame); }
      return { d, l, flame, seed: Math.random() * 10 };
    });
    this.eye = new THREE.PointLight(0xa0a8b8, 0, SG.eyeDist, 1.2); scene.add(this.eye);
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
      L.l.intensity = out ? 0 : L.d.power * w * dark;
      if (L.flame) L.flame.visible = dark > 0.5 && !out;
    }
    this.eye.intensity = SG.eyeLight * dark;
    this.eye.position.copy(camera.position);
  }
}
