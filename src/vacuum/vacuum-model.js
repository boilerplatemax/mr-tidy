// Mr. Tidy's body: the user's shop vac model, scaled to the build prompt's size. The face is painted on a skin that follows
// the shape of his body, and it gets worse as he does: a cartoon face at first, then two black holes and a black smile with
// the intake for a nose, then something much further gone. Anchors the game hangs things off: hoseSocket, cordSocket.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { makePS1, pixelTexture } from '../render/ps1-material.js';
import { loadGLB } from '../render/geometry.js';

const V = TUNING.vac, M = V.model, FA = M.face;
const W = 256, Hh = 128; // the face canvas
const X = (m) => W / 2 + m * FA.pxPerM; // metres along the drum from the middle → px
const Y = (y) => (1 - (y - FA.y0) / (FA.y1 - FA.y0)) * Hh; // metres off the floor → px
let seed = 11; const rr = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

const blob = (g, cx, cy, rx, ry, color, rough = 0) => {
  g.fillStyle = color;
  for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y++) for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
    const a = Math.atan2(y - cy, x - cx), w = 1 + rough * Math.sin(a * 5 + cx) * Math.sin(a * 9 + cy);
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= w * w) g.fillRect(x, y, 1, 1);
  }
};

/** Two black holes for eyes and a black smile. wild: the last stage, much further gone. screaming: the mouth wide open. */
function drawHoles(g, wild, screaming) {
  const eyeR = (wild ? 0.052 : 0.042) * FA.pxPerM, ey = wild ? [0.162, 0.15] : [0.155, 0.155], ex = wild ? 0.11 : 0.1;
  if (wild) { // the paint has gone: rust and grime spreading from the holes
    for (let i = 0; i < 130; i++) {
      const a = rr() * 6.28, d = 12 + rr() * 74, x = W / 2 + Math.cos(a) * d * 1.6, y = Y(0.13) + Math.sin(a) * d * 0.5;
      if (y < Y(0.2) || y > Y(0.03)) continue;
      g.fillStyle = rr() < 0.5 ? '#2a0806' : '#4a1a10'; g.fillRect(Math.round(x), Math.round(y), 1 + (rr() * 3 | 0), 1 + (rr() * 2 | 0));
    }
  }
  [-1, 1].forEach((side, i) => {
    const cx = X(side * ex), cy = Y(ey[i]), ry = eyeR * (screaming ? 1.5 : wild ? 1.12 : 1), rx = eyeR * (screaming ? 0.82 : 1);
    blob(g, cx, cy, rx + 2, ry + 2, wild ? '#1a0403' : '#4a0606', wild ? 0.1 : 0); // the recess
    blob(g, cx, cy, rx, ry, '#000000', wild ? 0.14 : 0);
    if (wild) for (let k = 0; k < 3; k++) { const x = Math.round(cx - rx * 0.8 + rr() * rx * 1.6), top = Math.round(cy + ry * 0.7), len = 8 + (rr() * 22 | 0); g.fillStyle = '#000000'; g.fillRect(x, top, 1 + (rr() * 2 | 0), len); } // running down from the eyes
  });
  // the smile: a crescent under the nose, far wider once he's gone
  const span = wild ? 0.225 : 0.165, top0 = wild ? 0.064 : 0.062, low0 = wild ? 0.018 : 0.032, rise = wild ? 0.09 : 0.05, riseLow = wild ? 0.135 : 0.08;
  g.fillStyle = '#000000';
  if (screaming) { blob(g, W / 2, Y(0.052), span * FA.pxPerM * 0.72, 24, '#000000', 0.08); return; }
  for (let px = X(-span); px <= X(span); px++) {
    const m = (px - W / 2) / FA.pxPerM, k = (m / span) ** 2;
    let yU = top0 + k * rise, yL = low0 + k * riseLow;
    if (wild) { yU += Math.abs(Math.sin(px * 1.3)) * 0.014 + (Math.sin(px * 0.31) * 0.006); yL -= Math.abs(Math.sin(px * 0.9)) * 0.008; }
    const a = Math.round(Y(yU)), b = Math.round(Y(yL));
    if (b > a) g.fillRect(Math.round(px), a, 1, b - a);
  }
  if (wild) for (const side of [-1, 1]) { // the corners split upward, past the eyes
    let px = X(side * span), py = Y(top0 + rise);
    for (let i = 0; i < 16; i++) { g.fillRect(Math.round(px), Math.round(py), 2, 2); px += side * (0.4 + rr() * 0.5); py -= 0.8 + rr() * 0.5; }
  }
}

function faceTexture(draw) {
  const c = document.createElement('canvas'); c.width = W; c.height = Hh;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return pixelTexture(t);
}

/** The calm faces, drawn at pixel size on a plate on the dome. level: 1 neutral, 2 annoyed. */
function drawFace(level) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 48;
  const g = c.getContext('2d');
  const disc = (cx, cy, r, color) => { g.fillStyle = color; for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + 1) g.fillRect(cx + x, cy + y, 1, 1); };
  const brow = (x0, x1, y0, y1, thick) => { g.fillStyle = '#e8e4d8'; const n = Math.abs(x1 - x0); for (let i = 0; i <= n; i++) g.fillRect(x0 + Math.sign(x1 - x0) * i, Math.round(y0 + ((y1 - y0) * i) / n), 1, thick); };
  for (const x of [20, 44]) { disc(x, 20, 8, '#e8e4d8'); disc(x, 21, 3, '#000000'); }
  if (level === 2) { // annoyed: flat brows sitting low on the eyes
    g.globalCompositeOperation = 'destination-out'; g.fillRect(11, 8, 42, 7); g.globalCompositeOperation = 'source-over';
    brow(11, 29, 12, 12, 2); brow(53, 35, 12, 12, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return pixelTexture(t);
}

/** A skin that follows his outline, so the face wraps round him instead of floating in front. */
function faceSkin() {
  const pts = FA.profile.map(([y, r]) => new THREE.Vector2(r + FA.lift, y));
  const geo = new THREE.LatheGeometry(pts, 26, -FA.arc / 2, FA.arc);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) { // canvas u along the drum, v by height
    const a = Math.atan2(pos.getX(i), pos.getZ(i));
    uv.setXY(i, 0.5 + (a * 0.21 * FA.pxPerM) / W, 1 - Y(pos.getY(i)) / Hh);
  }
  return geo;
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
  const out = {
    root, body, ready: false, stage: 1, k: 1, shriekT: 0, flick: 0, alert: 0, twitchT: 0, tiltZ: 0, tiltX: 0, bodyMats: [],
    still: false,
    faces: { 1: drawFace(1), 2: drawFace(2), 3: faceTexture((g) => drawHoles(g, false, false)), 4: faceTexture((g) => drawHoles(g, true, false)), 5: faceTexture((g) => drawHoles(g, true, true)) },
  };

  // the intake: a black disc, smaller once it has become a nose
  const hole = new THREE.Mesh(new THREE.CircleGeometry(M.holeR, 16), makePS1(new THREE.MeshBasicMaterial({ color: 0x000000, fog: false })));
  hole.position.set(0, M.holeY, M.holeZ);
  root.add(hole);

  const faceMat = makePS1(new THREE.MeshBasicMaterial({ map: out.faces[1], alphaTest: 0.5, fog: false, side: THREE.DoubleSide })); // (no fog: in his own dust cloud, the face is the last thing you can see)
  const skin = faceSkin(), plate2 = new THREE.PlaneGeometry(M.faceW, M.faceH).translate(0, M.faceY, M.faceZ);
  const face = new THREE.Mesh(plate2, faceMat);
  root.add(face);
  out.face = face;
  const show = (level) => { faceMat.map = out.faces[level]; face.geometry = level <= 2 ? plate2 : skin; }; // calm: the plate on the dome. After that: painted round his body
  out.setFace = (level) => { out.stage = level; show(level); };

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
  out.holeY = () => M.holeY * out.k;
  out.faceCenterY = () => FA.centerY * out.k;

  /** The moment of a scream: the mouth drops open. */
  out.shriek = (seconds) => { out.shriekT = seconds; };
  /** The face flickers between the old and the new for a moment: he's changing. */
  out.flicker = () => { out.flick = M.flickTime; };

  /** Per rendered frame: his size and colour for his stage, the twitching, the listening tilt. */
  out.animate = (dt, listening) => {
    const s = out.stage - 1, ease = 1 - Math.exp(-3 * dt);
    out.k += (M.stretch[s] - out.k) * ease;
    body.scale.y = M.scaleY * out.k; face.scale.y = out.k;
    const cur = hole.scale.x + (M.holeRs[s] / M.holeR - hole.scale.x) * ease;
    hole.scale.set(cur, cur, 1); hole.position.y = M.holeY * out.k; out.hoseSocket.position.y = M.holeY * out.k;
    for (const m of out.bodyMats) { const c = m.color.r + (M.tone[s] - m.color.r) * ease; m.color.setRGB(c, c * (1 - (1 - M.tone[s]) * 0.2), c * (1 - (1 - M.tone[s]) * 0.2)); }
    out.alert += ((listening ? 1 : 0) - out.alert) * (1 - Math.exp(-14 * dt));
    let tz = 0, tx = -M.listenTilt * out.alert;
    if (out.stage >= 4 && !out.still) { // he can't hold still any more
      out.twitchT -= dt;
      if (out.twitchT <= 0) { out.twitchT = 0.12 + Math.random() * 0.9; out.tiltZ = (Math.random() - 0.5) * M.twitch; out.tiltX = (Math.random() - 0.5) * M.twitch * 0.5; }
      tz = out.tiltZ; tx += out.tiltX;
    }
    if (out.shriekT > 0) {
      out.shriekT -= dt; show(out.shriekT > 0 ? 5 : out.stage);
      if (!out.still) { tz += (Math.random() - 0.5) * M.twitch * 1.2; tx -= 0.08; }
    } else if (out.flick > 0) {
      out.flick -= dt; show(out.flick > 0 && Math.floor(out.flick * 22) % 2 ? Math.max(1, out.stage - 1) : out.stage);
    }
    root.rotation.z += (tz - root.rotation.z) * Math.min(1, 26 * dt); root.rotation.x += (tx - root.rotation.x) * Math.min(1, 26 * dt);
  };

  loadGLB(TUNING.assets.vacuum).then((gltf) => { gltf.scene.traverse((o) => { if (o.isMesh) out.bodyMats.push(o.material); }); body.add(gltf.scene); }).catch((e) => {
    console.warn('vacuum model failed, using the stand-in:', e?.message || e);
    body.add(standIn());
  }).finally(() => { out.ready = true; });
  return out;
}
