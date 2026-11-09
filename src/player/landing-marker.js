// The target dot: where a charged jump would end (build prompt 0.4 / 4.2). Always faces the camera and draws over
// everything, so it stays visible from under a shelf. It glides between spots rather than hopping. Player._predict flies
// the arc against the real colliders and fills player.aim.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';

const J = TUNING.jump;

export class LandingMarker {
  constructor(scene) {
    this.mat = new THREE.MeshBasicMaterial({ color: J.markerColors.land, fog: false, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false });
    this.mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 10), this.mat);
    this.mesh.renderOrder = 10;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this._t = new THREE.Vector3();
  }

  /** Per rendered frame. */
  update(aim, camera, dt) {
    const m = this.mesh;
    if (!aim.ok) { m.visible = false; return; }
    this._t.set(aim.x, aim.y, aim.z);
    if (!m.visible) m.position.copy(this._t); // just appeared: start there
    else m.position.lerp(this._t, 1 - Math.exp(-J.markerEase * dt));
    m.visible = true;
    m.quaternion.copy(camera.quaternion);
    m.scale.setScalar(m.position.distanceTo(camera.position) * J.markerDot); // the same size on screen at any distance
    this.mat.color.setHex(J.markerColors[aim.kind]);
  }
}
