// The catch (build prompt 0.7): control locks; a loud suction burst and a screen shake; the camera is dragged along the
// hose's actual path, faster and faster; it stops in front of the hole and turns to face him, the
// furious face and the black hole filling the screen while the motor screams; hard cut to black, a beat of silence.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { audio } from '../audio/audio.js';

const C = TUNING.catch;
const _p = new THREE.Vector3(), _look = new THREE.Vector3(), _face = new THREE.Vector3(), _end = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const rnd = () => Math.random() * 2 - 1;

export class CatchSequence {
  /** onEnd(): the screen is black and the beat of silence is over. */
  constructor({ camera, vac, onEnd }) {
    Object.assign(this, { camera, vac, onEnd });
    this.active = false; this.phase = 'none'; this.t = 0;
    this.cut = document.createElement('div');
    this.cut.id = 'cut'; this.cut.hidden = true;
    document.body.append(this.cut);
    this.from = new THREE.Quaternion(); this.to = new THREE.Quaternion();
    this.faceBase = new THREE.Vector3();
  }

  /** The camera rides the hose back, from the nozzle that has the cat to the hole. */
  start() {
    const v = this.vac, cam = this.camera, m = v.model;
    this.active = true; this.phase = 'drag'; this.t = 0;
    m.root.updateMatrixWorld(true);
    m.catchCamTarget.getWorldPosition(_end);
    const pts = [cam.position.clone()];
    // the hose as it was at the moment of capture, from the nozzle back to the hole
    for (let i = v.hose.n; i >= 1; i -= 2) pts.push(v.hose.pts[i].clone());
    pts.push(_end.clone());
    this.curve = new THREE.CatmullRomCurve3(pts);
    this.end = _end.clone();
    m.setFace(4); m.face.visible = true; // furious, whatever he was before
    this.faceBase.copy(m.face.position);
    audio.play('vac.fwoomp');
    v.scream();
  }

  /** Per rendered frame while active. */
  update(dt) {
    const cam = this.camera, f = this.vac.model.face;
    this.t += dt;
    if (this.phase === 'drag') {
      const u = Math.min(1, this.t / C.drag), s = u * u; // speeding up as it goes
      this.curve.getPoint(s, _p);
      this.curve.getPoint(Math.min(1, s + 0.03), _look);
      const shake = C.shake * (1 - u);
      cam.position.set(_p.x + rnd() * shake, _p.y + rnd() * shake, _p.z + rnd() * shake);
      if (_p.distanceToSquared(_look) > 1e-8) cam.lookAt(_look);
      cam.updateMatrixWorld();
      if (u >= 1) this._toHold();
      return;
    }
    if (this.phase === 'hold') {
      const k = Math.min(1, this.t / C.turn);
      cam.quaternion.slerpQuaternions(this.from, this.to, k * k * (3 - 2 * k));
      cam.position.copy(this.end);
      cam.updateMatrixWorld();
      f.position.set(this.faceBase.x + rnd() * C.faceJitter, this.faceBase.y + rnd() * C.faceJitter, this.faceBase.z); // trembling with rage
      if (this.t >= C.hold) this._toCut();
      return;
    }
    if (this.phase === 'black' && this.t >= C.beat) { this.phase = 'done'; this.active = false; this.onEnd?.(); }
  }

  _toHold() {
    const cam = this.camera, m = this.vac.model;
    this.phase = 'hold'; this.t = 0;
    cam.position.copy(this.end);
    this.from.copy(cam.quaternion);
    // straight at the middle of him: the face above, the hole below
    _face.setFromMatrixPosition(m.root.matrixWorld); _face.y = (TUNING.vac.model.faceY + TUNING.vac.model.holeY) / 2;
    _m.lookAt(this.end, _face, cam.up);
    this.to.setFromRotationMatrix(_m);
    void _q;
  }

  _toCut() {
    this.phase = 'black'; this.t = 0;
    this.cut.hidden = false;
    this.vac.model.face.position.copy(this.faceBase);
    this.vac.silence();
    audio.suspend();
  }

  /** Clears everything for a new run. */
  reset() { this.active = false; this.phase = 'none'; this.t = 0; this.cut.hidden = true; }
}
