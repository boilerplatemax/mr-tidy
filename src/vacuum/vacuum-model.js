// Mr. Tidy's body: the user's shop vac model (red and black, kept as it is), scaled to the build prompt's size, with a
// black gaping intake hole and the face on the dome above it. If the model can't load, a primitive stand-in takes its
// place. Anchors the rest of the game hangs things off: hoseSocket, cordSocket, catchCamTarget.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { makePS1, pixelTexture } from '../render/ps1-material.js';
import { loadGLB } from '../render/geometry.js';

const V = TUNING.vac, M = V.model;

/** One of the faces, drawn at pixel size. level: 1 neutral, 2 angry, 3 furious. */
function drawFace(level) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 48;
  const g = c.getContext('2d');
  const disc = (cx, cy, r, color) => { g.fillStyle = color; for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + 1) g.fillRect(cx + x, cy + y, 1, 1); };
  const brow = (x0, x1, y0, y1, thick) => { g.fillStyle = '#e8e4d8'; const n = Math.abs(x1 - x0); for (let i = 0; i <= n; i++) g.fillRect(x0 + Math.sign(x1 - x0) * i, Math.round(y0 + ((y1 - y0) * i) / n), 1, thick); };
  const eyeR = level === 3 ? 7 : 8, pupilR = level === 3 ? 1 : 3, pupil = level === 3 ? '#a01010' : '#000000';
  for (const x of [20, 44]) { disc(x, 20, eyeR, '#e8e4d8'); disc(x, 21, pupilR, pupil); }
  if (level >= 2) { // the lids come down at a slant, and the brows with them
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 18; i++) { g.fillRect(11 + i, 8, 1, 5 + (i * (level === 3 ? 7 : 5)) / 18); g.fillRect(53 - i, 8, 1, 5 + (i * (level === 3 ? 7 : 5)) / 18); }
    g.globalCompositeOperation = 'source-over';
    const t = level === 3 ? 3 : 2;
    brow(9, 29, 7, 15 + level, t); brow(55, 35, 7, 15 + level, t);
  }
  if (level === 3) { // bared teeth along the top of the hole
    g.fillStyle = '#e8e4d8';
    for (let x = 14; x < 50; x += 6) for (let i = 0; i < 6; i++) g.fillRect(x + i, 38 + (i < 3 ? i * 2 : (5 - i) * 2), 1, 10 - (i < 3 ? i * 2 : (5 - i) * 2));
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return pixelTexture(t);
}

function standIn() { // only if the model fails to load
  const g = new THREE.Group(), red = makePS1(new THREE.MeshLambertMaterial({ color: 0x8a1010 })), black = makePS1(new THREE.MeshLambertMaterial({ color: 0x151515 }));
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.45, 14), red); drum.position.y = 0.27;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 8), black); dome.position.y = 0.55; dome.scale.y = 1.1;
  g.add(drum, dome);
  return g;
}

export function buildVacuum() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.scale.set(M.scaleXZ, M.scaleY, M.scaleXZ);
  root.add(body);
  const out = { root, body, ready: false, faces: { 1: drawFace(1), 2: drawFace(2), 3: drawFace(3) } };

  // the hole: a real gaping black mouth, much wider than the model's own opening so it reads from cat height
  const hole = new THREE.Mesh(new THREE.CircleGeometry(M.holeR, 16), makePS1(new THREE.MeshBasicMaterial({ color: 0x000000, fog: false })));
  hole.position.set(0, M.holeY, M.holeZ);
  root.add(hole);

  const faceMat = makePS1(new THREE.MeshBasicMaterial({ map: out.faces[1], alphaTest: 0.5, fog: false }));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(M.faceW, M.faceH), faceMat);
  face.position.set(0, M.faceY, M.faceZ);
  root.add(face);
  out.face = face;
  out.setFace = (level) => { faceMat.map = out.faces[level]; };

  // the cord reel on his back: a plate, a hub and a coil of cable that shrinks as the cord pays out
  const dark = makePS1(new THREE.MeshLambertMaterial({ color: 0x141416 })), wire = makePS1(new THREE.MeshLambertMaterial({ color: 0x55565c }));
  const reel = new THREE.Group();
  reel.position.set(0, M.reelY, -M.reelZ);
  root.add(reel);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(M.reelFlange, M.reelFlange, 0.008, 14).rotateX(Math.PI / 2), dark);
  plate.position.z = 0.03;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8).rotateX(Math.PI / 2), dark);
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.09), dark);
  bracket.position.z = 0.075;
  reel.add(plate, hub, bracket);
  const coil = new THREE.Group();
  for (let i = 0; i < 4; i++) { // four turns of cable side by side
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.17, 6, 14), wire);
    ring.position.z = 0.018 - i * 0.02;
    coil.add(ring);
  }
  reel.add(coil);
  out.reelSpin = coil;

  const socket = (x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); root.add(o); return o; };
  out.hoseSocket = socket(0, M.holeY, M.holeZ - 0.02);
  out.cordSocket = socket(0, M.reelY - M.reelMax, -M.reelZ);
  /** paid: 0 = all reeled in .. 1 = all paid out. angle: how far the reel has turned (rad). */
  out.setReel = (paid, angle) => {
    const r = M.reelMax + (M.reelMin - M.reelMax) * paid;
    coil.scale.set(r, r, 0.09);
    coil.rotation.z = angle;
    out.cordSocket.position.y = M.reelY - r;
  };
  out.setReel(0, 0);
  out.catchCamTarget = socket(0, M.holeY + 0.04, M.holeZ + 0.28);

  loadGLB(TUNING.assets.vacuum).then((gltf) => { body.add(gltf.scene); }).catch((e) => {
    console.warn('vacuum model failed, using the stand-in:', e?.message || e);
    body.add(standIn());
  }).finally(() => { out.ready = true; });
  return out;
}
