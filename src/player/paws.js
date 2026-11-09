// The first-person paws: grey-box blocks with toe bumps, on the viewmodel layer (drawn after the world with depth
// cleared, never vertex-snapped). While hanging they're planted on the real edge in WORLD space, forearms rising from
// below the lip, so they stay gripping it whichever way you look.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { makePS1 } from '../render/ps1-material.js';
import { LAYER_VIEWMODEL } from '../render/ps1-renderer.js';

const V = TUNING.paws;

function buildPaw(mat) {
  const g = new THREE.Group();
  // the forearm pivots at the wrist (the group's origin) and runs back toward the cat along +z
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.14).translate(0, 0, 0.08), mat);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.05), mat);
  g.add(leg, pad);
  for (const x of [-0.018, -0.006, 0.006, 0.018]) {
    const toe = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.014, 0.018), mat);
    toe.position.set(x, 0.002, -0.03);
    g.add(toe);
  }
  g.traverse((o) => o.layers.set(LAYER_VIEWMODEL));
  g.userData.leg = leg;
  return g;
}

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _cq = new THREE.Quaternion(), _m = new THREE.Matrix4();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0), _z = new THREE.Vector3();

export class Paws {
  constructor(camera) {
    const mat = makePS1(new THREE.MeshLambertMaterial({ color: V.color, emissive: V.glow, fog: false }));
    this.camera = camera;
    this.left = buildPaw(mat); this.right = buildPaw(mat);
    camera.add(this.left, this.right);
    this.left.visible = this.right.visible = false;
    this.grip = 0; // 0 hidden .. 1 gripping the edge
  }

  /** Lay one paw on the lip of the ledge, in world space. side: −1 left, +1 right. */
  _plant(paw, player, side) {
    const h = player.hang;
    _z.set(h.nx, 0, h.nz); // the paw's back runs out from the ledge; its toes point in over the top
    _x.crossVectors(_y, _z);
    const shake = Math.sin(player.time * V.trembleRate + side) * V.tremble * (1 - player.stamina);
    const y = h.top + V.hangLift - (1 - this.grip) * V.drop + shake;
    _p.set(h.ex + _x.x * side * V.hangSpread - h.nx * V.hangIn, y, h.ez + _x.z * side * V.hangSpread - h.nz * V.hangIn);
    this.camera.worldToLocal(_p);
    paw.position.copy(_p);
    _m.makeBasis(_x, _y, _z);
    _q.setFromRotationMatrix(_m);
    this.camera.getWorldQuaternion(_cq).invert();
    paw.quaternion.copy(_cq).multiply(_q);
    paw.userData.leg.rotation.x = V.hangLeg; // the forearm drops away below the lip
    paw.userData.leg.scale.z = V.hangLegLen; // ...and reaches down past the bottom of the view
  }

  /** Per rendered frame, after the camera is placed. hidden: third-person debug view. */
  frame(player, dt, hidden = false) {
    const gripping = player.mode === 'hang' || player.mode === 'mantle';
    this.grip += ((gripping ? 1 : 0) - this.grip) * (1 - Math.exp(-V.ease * dt));
    const show = this.grip > 0.02 && !hidden && !!player.hang.col;
    this.left.visible = this.right.visible = show;
    if (!show) return;
    this._plant(this.left, player, -1);
    this._plant(this.right, player, 1);
  }
}
