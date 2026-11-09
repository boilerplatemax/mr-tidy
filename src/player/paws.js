// The first-person paws: grey-box rounded blocks with toe bumps, on the viewmodel layer (drawn after the world with
// depth cleared, never vertex-snapped). In this step they appear while hanging and pulling up; the swipe joins later.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { makePS1 } from '../render/ps1-material.js';
import { LAYER_VIEWMODEL } from '../render/ps1-renderer.js';

const V = TUNING.paws;

function buildPaw(mat) {
  const g = new THREE.Group();
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.12), mat);
  leg.position.set(0, 0, 0.07);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.05), mat);
  pad.position.set(0, 0, 0);
  g.add(leg, pad);
  for (const x of [-0.018, -0.006, 0.006, 0.018]) {
    const toe = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.014, 0.018), mat);
    toe.position.set(x, 0.002, -0.03);
    g.add(toe);
  }
  g.traverse((o) => o.layers.set(LAYER_VIEWMODEL));
  return g;
}

export class Paws {
  constructor(camera) {
    const mat = makePS1(new THREE.MeshLambertMaterial({ color: V.color, fog: false }));
    this.left = buildPaw(mat); this.right = buildPaw(mat);
    camera.add(this.left, this.right);
    this.left.visible = this.right.visible = false;
    this.grip = 0; // 0 hidden .. 1 gripping the edge
  }

  /** Per rendered frame. */
  frame(player, dt) {
    const gripping = player.mode === 'hang' || player.mode === 'mantle'; // (climbing paws join with the swipe, step 7)
    this.grip += ((gripping ? 1 : 0) - this.grip) * (1 - Math.exp(-V.ease * dt));
    const show = this.grip > 0.02;
    this.left.visible = this.right.visible = show;
    if (!show) return;
    const pull = player.mode === 'mantle' ? player.mantleT : 0;
    const y = V.gripY - (1 - this.grip) * V.drop - pull * V.pullDown;
    this.left.position.set(-V.gripX, y, V.gripZ);
    this.right.position.set(V.gripX, y, V.gripZ);
    this.left.rotation.x = this.right.rotation.x = V.gripTilt;
  }
}
