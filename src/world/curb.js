// The secret ending: the next morning... no, that night. Out at the kerb, under the streetlamp, with a cardboard sign that
// says FREE. The camera creeps in. Nothing. Then his eyes come on, just for a moment. Cut to black. (F10 plays it any time.)
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { makePS1, pixelTexture } from '../render/ps1-material.js';
import { audio } from '../audio/audio.js';

const C = TUNING.curb;
const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

function tex(name, rx, ry) {
  const t = new THREE.TextureLoader().load(`game-assets/textures/outside/${name}.png`);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); pixelTexture(t);
  return makePS1(new THREE.MeshLambertMaterial({ map: t }));
}
function sign() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 44; const g = c.getContext('2d');
  g.fillStyle = '#b08a5a'; g.fillRect(0, 0, 64, 44); g.fillStyle = '#9a7648'; for (let x = 0; x < 64; x += 4) g.fillRect(x, 0, 1, 44);
  g.fillStyle = '#1a1414'; g.font = 'bold 20px sans-serif'; g.textAlign = 'center'; g.fillText('FREE', 32, 27);
  g.font = '7px sans-serif'; g.fillText('works fine', 32, 38);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; pixelTexture(t);
  return makePS1(new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide }));
}

export class Curb {
  constructor({ scene, camera, vac, env, knock }) {
    Object.assign(this, { camera, vac, env, knock });
    this.active = false; this.t = 0; this.onDone = null;
    const g = this.group = new THREE.Group(), X = C.x, Z = C.z;
    const plane = (w, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), mat); m.position.set(x, y, z); g.add(m); return m; };
    plane(14, 6, tex('asphalt', 7, 3), X, -0.14, Z + 4); // the road, down off the kerb
    plane(14, 2.2, tex('concrete', 7, 1.1), X, 0.002, Z - 0.1); // the pavement: he's sitting on it
    const kerb = new THREE.Mesh(new THREE.BoxGeometry(14, 0.14, 0.18), tex('concrete', 7, 0.1)); kerb.position.set(X, -0.07, Z + 1.0); g.add(kerb);
    plane(14, 3, tex('grass', 7, 1.5), X, 0.004, Z - 2.7); // the front garden
    const wall = new THREE.Mesh(new THREE.BoxGeometry(9, 3.2, 0.3), tex('brick_red', 4.5, 1.6)); wall.position.set(X, 1.6, Z - 4.3); g.add(wall); // the front of the house
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.1), new THREE.MeshBasicMaterial({ color: 0xffc27a, fog: false })); glow.position.set(X - 2, 1.6, Z - 4.14); g.add(glow); // her window: she's back in bed
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.6, 6), makePS1(new THREE.MeshLambertMaterial({ color: 0x2a2c30 }))); pole.position.set(X + 1.6, 1.8, Z + 0.6); g.add(pole);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.25), new THREE.MeshBasicMaterial({ color: 0xffe0a0, fog: false })); lamp.position.set(X + 1.35, 3.55, Z + 0.6); g.add(lamp);
    this.light = new THREE.PointLight(0xffd59a, 0, 12, 0.9); this.light.position.set(X + 1.3, 3.3, Z + 0.6); g.add(this.light);
    this.sign = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.24), sign()); g.add(this.sign);
    g.visible = false; scene.add(g);
  }

  /** onDone: the cut to black is over. */
  play(onDone) {
    const v = this.vac, X = C.x, Z = C.z;
    this.active = true; this.t = 0; this.onDone = onDone; this.fired = {};
    this.group.visible = true; this.light.intensity = C.lamp;
    this.env.apply('night');
    v.frozen = true; v.dormant = false; v.powerDown(); v.setHidden(false); v.hose.mesh.visible = v.hose.nozzle.visible = false; v.cord.mesh.visible = v.cord.plug.visible = false;
    v.noCord = true; v.x = v.px = X; v.z = v.pz = Z + 0.2; v.heading = v.prevHeading = 0; v.model.dead = false; v.model.calm = true; v.model.slumped = false; v.model.face.visible = false;
    this.sign.position.set(X + 0.3, 0.13, Z + 0.32); this.sign.rotation.set(-0.3, -0.35, 0.08); // (propped against him)
    if (!this.stuffies && this.knock?._stuffy) { // and his collection, lined up beside him: they're going too
      this.stuffies = new THREE.Group();
      ['bear', 'bunny', 'frog', 'pig', 'elephant'].forEach((k, i) => { const m = this.knock._stuffy(k); m.position.set(X - 0.4 - i * 0.165, 0.002, Z + 0.28 + (i % 2) * 0.06); m.rotation.y = 0.25 - i * 0.12; m.scale.setScalar(1.1); this.stuffies.add(m); });
      this.group.add(this.stuffies);
    }
  }

  /** Per rendered frame while active. */
  update(dt) {
    this.t += dt;
    const t = this.t, cam = this.camera, X = C.x, Z = C.z, v = this.vac, m = v.model;
    const u = smooth(t / C.push), dist = C.from + (C.to - C.from) * u;
    cam.position.set(X + 0.15 * (1 - u), C.camY, Z + 0.2 + dist); cam.lookAt(X, 0.22, Z + 0.2); cam.updateMatrixWorld();
    // his eyes: nothing, nothing... there. And gone.
    const on = C.eyes.some(([a, b]) => t >= a && t < b);
    m.face.visible = on; if (on) { m.dead = false; m.setFace(4); }
    if (!this.fired.blip && t >= C.eyes[0][0]) { this.fired.blip = true; audio.play('vac.power', { gain: 0.5, rate: 0.6 }); }
    this.light.intensity = C.lamp * (t > C.eyes[1][0] && t < C.eyes[1][1] + 0.1 ? 0.3 : 1); // the streetlamp dips when he wakes
    if (t >= C.length) { this.stop(); this.onDone?.(); }
  }

  stop() {
    this.active = false; this.group.visible = false; this.light.intensity = 0;
    this.env.apply(TUNING.house.preset);
    this.vac.model.calm = false; this.vac.model.slumped = false; this.vac.noCord = false;
  }
}
