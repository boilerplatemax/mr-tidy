// An experiment (Settings: "Tail peeks as you turn"): turning quickly, the cat's tail swings into the bottom corner of the
// view on the far side, swishing, and slips away again when you stop. On the viewmodel layer, like the paws.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { settings } from '../data/settings.js';
import { loadGLB } from '../render/geometry.js';
import { LAYER_VIEWMODEL } from '../render/ps1-renderer.js';

const TL = TUNING.tail;

export class Tail {
  constructor(camera) {
    this.camera = camera; this.amt = 0; this.side = 1; this.lastYaw = null; this.rate = 0; this.rig = null; this.mixer = null;
    loadGLB(TUNING.assets.tail).then((g) => {
      this.rig = new THREE.Group(); this.rig.add(g.scene);
      g.scene.rotation.set(TL.tilt, Math.PI, 0); g.scene.scale.setScalar(TL.scale);
      g.scene.traverse((o) => { if (o.isMesh) { o.material.emissive?.setHex(0x2a241e); o.material.fog = false; } o.layers.set(LAYER_VIEWMODEL); o.frustumCulled = false; });
      this.rig.visible = false; camera.add(this.rig);
      this.mixer = new THREE.AnimationMixer(g.scene);
      const swish = THREE.AnimationClip.findByName(g.animations, 'swish'); if (swish) this.mixer.clipAction(swish).play();
    }).catch((e) => console.warn('tail failed to load:', e?.message || e));
  }

  hide() { if (this.rig) this.rig.visible = false; }

  /** Per rendered frame. hidden: something else owns the view. */
  frame(player, dt, hidden) {
    if (!this.rig) return;
    if (this.lastYaw === null) this.lastYaw = player.yaw;
    let d = player.yaw - this.lastYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.lastYaw = player.yaw;
    this.rate += ((dt > 0 ? d / dt : 0) - this.rate) * (1 - Math.exp(-10 * dt));
    const want = settings.tailPeek && !hidden && player.mode === 'move' && player.grounded ? Math.min(1, Math.max(0, (Math.abs(this.rate) - TL.from) / (TL.full - TL.from))) : 0;
    if (want > 0.05) this.side = this.rate > 0 ? 1 : -1; // turning left, the tail swings out on the right
    this.amt += (want - this.amt) * (1 - Math.exp(-(want > this.amt ? TL.rise : TL.fall) * dt));
    this.rig.visible = this.amt > 0.02;
    if (!this.rig.visible) return;
    this.rig.position.set(this.side * TL.x, TL.hidden + (TL.shown - TL.hidden) * this.amt, TL.z);
    this.rig.rotation.set(0, 0, -this.side * TL.lean);
    this.mixer.update(dt);
  }
}
