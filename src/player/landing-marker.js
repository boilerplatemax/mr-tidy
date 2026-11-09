// The outline on the spot a charged jump would end (build prompt 0.4 / 4.2). Shown while charging, on whatever the arc
// meets: a surface or the floor (land), the edge of a ledge the cat would catch (grab), or a wall (wall). Player._predict
// flies the arc against the real colliders and fills player.aim.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { makePS1 } from '../render/ps1-material.js';

const J = TUNING.jump;
const UP = new THREE.Vector3(0, 1, 0);

export class LandingMarker {
  constructor(scene) {
    const s = J.markerSize, t = J.markerThick, h = s / 2;
    this.mat = makePS1(new THREE.MeshBasicMaterial({ color: J.markerColors.land, fog: false, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
    const edges = [
      new THREE.PlaneGeometry(s, t).rotateX(-Math.PI / 2).translate(0, 0, -h),
      new THREE.PlaneGeometry(s, t).rotateX(-Math.PI / 2).translate(0, 0, h),
      new THREE.PlaneGeometry(t, s).rotateX(-Math.PI / 2).translate(-h, 0, 0),
      new THREE.PlaneGeometry(t, s).rotateX(-Math.PI / 2).translate(h, 0, 0),
    ];
    this.mesh = new THREE.Group();
    for (const g of edges) this.mesh.add(new THREE.Mesh(g, this.mat));
    this.mesh.visible = false;
    scene.add(this.mesh);
    this._n = new THREE.Vector3();
  }

  update(aim) {
    this.mesh.visible = aim.ok;
    if (!aim.ok) return;
    this._n.set(aim.nx, aim.ny, aim.nz);
    this.mesh.quaternion.setFromUnitVectors(UP, this._n); // lies flat on the floor or a top, stands up on a wall
    this.mesh.position.set(aim.x + aim.nx * 0.012, aim.y + aim.ny * 0.012, aim.z + aim.nz * 0.012); // just off the surface: no z-fighting
    this.mat.color.setHex(J.markerColors[aim.kind]);
  }
}
