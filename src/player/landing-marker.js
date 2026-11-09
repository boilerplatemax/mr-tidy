// The jump target (build prompt 0.4 / 4.2), shown while charging: a ring projected into the world. The ring isn't a mesh.
// The world's own shader (src/render/ps1-material.js) paints every surface within a band of 3D distance from the landing
// spot, so the circle folds over edges and down faces like a real projection. It glides rather than hops, and ignores
// brief retractions. Player._predict flies the arc against the real colliders.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { PS1 } from '../render/ps1-material.js';

const J = TUNING.jump, M = J.marker;

export class LandingMarker {
  constructor(camera) {
    this.camera = camera;
    this.on = false;
    this.goal = { x: 0, y: 0, z: 0, kind: 'land' }; // the spot being shown (lags aim by a retraction hold)
    this.pos = PS1.uniforms.uPs1RingPos.value; // written straight into the shader's uniform
    this.retract = 0;
    this._t = new THREE.Vector3();
  }

  _accept(aim) { const g = this.goal; g.x = aim.x; g.y = aim.y; g.z = aim.z; g.kind = aim.kind; }

  /** Per rendered frame. */
  update(aim, dt, player) {
    const U = PS1.uniforms;
    if (!aim.ok) { this.on = false; U.uPs1RingOn.value = 0; this.retract = 0; return; }
    const g = this.goal, first = !this.on;
    if (first) { this._accept(aim); this.retract = 0; }
    else {
      // a spot that moves back toward the cat has to stay back for a moment before it's believed
      const d = player._dir, back = -((aim.x - g.x) * d.x + (aim.z - g.z) * d.z);
      // (only for a cat holding still: if you're walking or steering, the spot moving is you, and it should follow at once)
      const moving = player.wlen > 0 || player.speed > 0.05;
      if (!moving && back > M.retractMin) { this.retract += dt; if (this.retract >= M.retractHold) { this._accept(aim); this.retract = 0; } }
      else { this.retract = 0; this._accept(aim); }
    }
    this._t.set(g.x, g.y, g.z);
    if (first) this.pos.copy(this._t); else this.pos.lerp(this._t, 1 - Math.exp(-J.markerEase * dt));
    this.on = true;
    // closer than ringFull the ring shrinks, so it doesn't fill the view on a short hop
    const s = Math.max(M.ringMin, Math.min(1, this.pos.distanceTo(this.camera.position) / M.ringFull));
    U.uPs1RingRad.value.set(M.ringInner * s, M.ringOuter * s);
    U.uPs1RingColor.value.setHex(J.markerColors[g.kind]);
    U.uPs1RingOn.value = 1;
  }
}
