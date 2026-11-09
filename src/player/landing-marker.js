// The faint outline on the spot a charged jump would land (build prompt 0.4 / 4.2). Shown only while charging, and only
// on valid surfaces: Player._predict flies the arc against the real colliders and fills player.aim.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { makePS1 } from '../render/ps1-material.js';

const J = TUNING.jump;

export class LandingMarker {
  constructor(scene) {
    const s = J.markerSize, t = 0.02, h = s / 2;
    const mat = makePS1(new THREE.MeshBasicMaterial({ color: J.markerColor, fog: false, transparent: true, opacity: 0.8, depthWrite: false }));
    const edges = [
      new THREE.PlaneGeometry(s, t).rotateX(-Math.PI / 2).translate(0, 0, -h),
      new THREE.PlaneGeometry(s, t).rotateX(-Math.PI / 2).translate(0, 0, h),
      new THREE.PlaneGeometry(t, s).rotateX(-Math.PI / 2).translate(-h, 0, 0),
      new THREE.PlaneGeometry(t, s).rotateX(-Math.PI / 2).translate(h, 0, 0),
    ];
    this.mesh = new THREE.Group();
    for (const g of edges) this.mesh.add(new THREE.Mesh(g, mat));
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  update(aim) {
    this.mesh.visible = aim.ok;
    if (aim.ok) this.mesh.position.set(aim.x, aim.y + 0.012, aim.z); // just above the surface: no z-fighting
  }
}
