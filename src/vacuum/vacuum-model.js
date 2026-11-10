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

const EYE_X = 0.1, EYE_Y = 0.155; // every face has its eyes here, on the drum either side of the intake

/** Two black holes for eyes and a black smile. wild: the last stage, wider and uneven. screaming: the mouth wide open. */
function drawHoles(g, wild, screaming) {
  const eyeR = (wild ? 0.05 : 0.042) * FA.pxPerM;
  [-1, 1].forEach((side) => {
    const cx = X(side * EYE_X), cy = Y(EYE_Y + (wild ? side * 0.005 : 0)), ry = eyeR * (screaming ? 1.28 : 1), rx = eyeR * (screaming ? 0.85 : 1);
    blob(g, cx, cy, rx + 2, ry + 2, wild ? '#1a0403' : '#4a0606'); // the recess
    blob(g, cx, cy, rx, ry, '#000000');
  });
  g.fillStyle = '#000000';
  if (screaming) { blob(g, W / 2, Y(0.05), 0.15 * FA.pxPerM, 17, '#000000'); return; }
  // the smile: a crescent under the nose, clear of the eyes and the intake
  const span = wild ? 0.225 : 0.165, top0 = wild ? 0.046 : 0.061, low0 = wild ? 0.018 : 0.043, /* (stage 3's smile sits a little higher) */ rise = wild ? 0.06 : 0.05, riseLow = wild ? 0.098 : 0.078;
  for (let px = X(-span); px <= X(span); px++) {
    const k = ((px - W / 2) / FA.pxPerM / span) ** 2;
    const yU = top0 + k * rise + (wild ? Math.abs(Math.sin(px * 0.95)) * 0.005 : 0), yL = low0 + k * riseLow;
    const a = Math.round(Y(yU)), b = Math.round(Y(yL));
    if (b > a) g.fillRect(Math.round(px), a, 1, b - a);
  }
}

/** Unplugged for good: crosses for eyes and a flat, slack mouth. */
function drawDead(g) {
  g.fillStyle = '#000000';
  for (const side of [-1, 1]) { const cx = X(side * EYE_X), cy = Y(EYE_Y), r = 0.036 * FA.pxPerM; for (let i = -r; i <= r; i++) { g.fillRect(Math.round(cx + i) - 1, Math.round(cy + i) - 1, 3, 3); g.fillRect(Math.round(cx + i) - 1, Math.round(cy - i) - 1, 3, 3); } }
  for (let px = X(-0.13); px <= X(0.13); px++) { const k = ((px - W / 2) / FA.pxPerM / 0.13) ** 2; g.fillRect(Math.round(px), Math.round(Y(0.05 + k * 0.025)), 1, 3); }
}

/**
 * Stage 5, about to eat you: the holes for eyes, the nose hole raised up between them (the hose comes out of it there), and
 * under it a mouth like a carved pumpkin's, right round him, with teeth. Nothing touches.
 */
function drawMaw(g) {
  const P = FA.pxPerM;
  for (const side of [-1, 1]) { blob(g, X(side * 0.11), Y(0.2), 0.05 * P, 0.04 * P, '#000000', 0.1); blob(g, X(side * 0.11), Y(0.2), 2.5, 2.5, '#d8e4ff'); } // the holes, a glint deep in each
  g.fillStyle = '#000000';
  const span = 0.3, top = 0.088, low = 0.02;
  const yU = (k) => top - k * 0.012, yL = (k) => low + k * 0.05;
  for (let px = X(-span); px <= X(span); px++) { const k = ((px - W / 2) / P / span) ** 2; g.fillRect(Math.round(px), Math.round(Y(yU(k))), 1, Math.round(Y(yL(k)) - Y(yU(k)))); }
  g.fillStyle = '#7a1010'; // the teeth: jagged, top and bottom
  for (let m = -span + 0.04; m < span - 0.03; m += 0.06) {
    const k0 = (m / span) ** 2, k1 = ((m + 0.03) / span) ** 2;
    for (let i = 0; i < 8; i++) { const w = (8 - i) * 0.7; g.fillRect(Math.round(X(m) - w / 2), Math.round(Y(yU(k0))) + i, Math.round(w), 1); g.fillRect(Math.round(X(m + 0.03) - w / 2), Math.round(Y(yL(k1))) - i, Math.round(w), 1); }
  }
}

/** The calm faces, drawn the old way: pale discs and pupils, at the same place the holes will be. level: 1 neutral, 2 annoyed. */
function drawCalm(g, level) {
  const r = 0.042 * FA.pxPerM;
  for (const side of [-1, 1]) {
    const cx = X(side * EYE_X), cy = Y(EYE_Y);
    blob(g, cx, cy, r, r, '#e8e4d8');
    blob(g, cx, cy + 2, r * 0.38, r * 0.38, '#000000');
  }
  if (level === 2) { // annoyed: flat brows sitting low on the eyes
    for (const side of [-1, 1]) {
      const cx = X(side * EYE_X), top = Y(EYE_Y) - r - 2;
      g.clearRect(cx - r - 2, top, 2 * r + 4, r * 0.85);
      g.fillStyle = '#e8e4d8'; g.fillRect(cx - r - 3, top + r * 0.85 - 3, 2 * r + 6, 3);
    }
  }
}

function faceTexture(draw) {
  const c = document.createElement('canvas'); c.width = W; c.height = Hh;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  pixelTexture(t);
  t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; // (no mipmaps on his face: from across the room they blurred the eyes and ran the pupils down into the whites)
  return t;
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
    still: false, kick: 0,
    faces: { 1: faceTexture((g) => drawCalm(g, 1)), 2: faceTexture((g) => drawCalm(g, 2)), 3: faceTexture((g) => drawHoles(g, false, false)), 4: faceTexture((g) => drawHoles(g, true, false)), 5: faceTexture((g) => { drawHoles(g, true, false); for (const side of [-1, 1]) { blob(g, X(side * EYE_X), Y(EYE_Y), 3, 3, '#d8e4ff'); } }), s: faceTexture((g) => drawHoles(g, true, true)), dead: faceTexture(drawDead), maw: faceTexture(drawMaw) },
  };

  // the intake: a black disc, smaller once it has become a nose
  const hole = new THREE.Mesh(new THREE.CircleGeometry(M.holeR, 16), makePS1(new THREE.MeshBasicMaterial({ color: 0x000000 })));
  hole.position.set(0, M.holeY, M.holeZ);
  root.add(hole);

  const faceMat = makePS1(new THREE.MeshBasicMaterial({ map: out.faces[1], alphaTest: 0.5, side: THREE.DoubleSide }));
  const face = new THREE.Mesh(faceSkin(), faceMat);
  root.add(face);
  out.face = face;
  const show = (level) => { faceMat.map = out.faces[out.dead ? 'dead' : out.maw ? 'maw' : level]; };
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
  out.noseLift = 0; // m the nose hole is raised (the maw)
  out.holeY = () => (M.holeY + out.noseLift) * out.k;
  out.holeZ = () => M.holeZ * (out.w ?? 1);
  out.faceCenterY = () => FA.centerY * out.k;

  /** The moment of a scream: the mouth drops open. */
  out.shriek = (seconds) => { out.shriekT = seconds; };
  /** A cough: he jolts back. */
  out.cough = () => { out.kick = 0.26; };
  /** A happy little wiggle (batted while he's still friendly; saying hello). */
  out.giggle = (seconds) => { out.giggleT = seconds; };
  out.giggleT = 0;
  // electricity crawling over him, once he's taken the house's power
  const ARC = TUNING.surge.arcs, arcPos = new Float32Array(ARC * 8 * 6), arcGeo = new THREE.BufferGeometry();
  arcGeo.setAttribute('position', new THREE.BufferAttribute(arcPos, 3));
  const arcs = new THREE.LineSegments(arcGeo, new THREE.LineBasicMaterial({ color: 0xbfd6ff, fog: false })); arcs.visible = false; arcs.frustumCulled = false; root.add(arcs);
  out.arcsOn = (t) => {
    arcs.visible = t > 0 && !out.calm && Math.random() < 0.7;
    if (!arcs.visible) return;
    let w = 0;
    for (let a = 0; a < ARC; a++) {
      let ang = Math.random() * 6.28, y = 0.05 + Math.random() * 0.4, x0 = Math.sin(ang) * 0.24, z0 = Math.cos(ang) * 0.24;
      for (let i = 0; i < 8; i++) { ang += (Math.random() - 0.5) * 0.7; y += (Math.random() - 0.5) * 0.09; const R = 0.23 + Math.random() * 0.05, x1 = Math.sin(ang) * R, z1 = Math.cos(ang) * R; arcPos[w++] = x0; arcPos[w++] = y; arcPos[w++] = z0; arcPos[w++] = x1; arcPos[w++] = y; arcPos[w++] = z1; x0 = x1; z0 = z1; }
    }
    arcGeo.attributes.position.needsUpdate = true;
  };

  /** The face flickers between the old and the new for a moment: he's changing. */
  out.flicker = () => { out.flick = M.flickTime; };

  /** Per rendered frame: his size and colour for his stage, the twitching, the listening tilt. */
  out.animate = (dt, listening) => {
    const s = out.stage - 1, ease = 1 - Math.exp(-3 * dt);
    const EA = TUNING.eat, wide = out.maw ? EA.wide : 1;
    out.k += ((out.maw ? EA.inflate : M.stretch[s]) - out.k) * (out.maw ? 1 - Math.exp(-14 * dt) : ease);
    out.w = (out.w ?? 1) + (wide - (out.w ?? 1)) * (1 - Math.exp(-14 * dt)); // (the mouth opens fast: it's already there as he pulls you in)
    body.scale.set(M.scaleXZ * out.w, M.scaleY * out.k, M.scaleXZ * out.w); face.scale.set(out.w, out.k, out.w);
    if (out.maw || out.dead) show(out.stage);
    const MN = M.mawNose, mq = 1 - Math.exp(-MN.ease * dt); // the maw raises the nose hole between the eyes, and the hose with it
    const high = out.maw || out.stage >= 5; // the final stage: the nose hole sits up between the eyes
    out.noseLift += ((high ? MN.lift : 0) - out.noseLift) * mq;
    const cur = hole.scale.x + ((high ? MN.r : M.holeRs[s]) / M.holeR - hole.scale.x) * (out.maw ? mq : ease);
    hole.scale.set(cur, cur, 1); hole.position.y = out.holeY(); out.hoseSocket.position.y = out.holeY();
    hole.position.z = M.holeZ * out.w; out.hoseSocket.position.z = M.holeZ * out.w - 0.02; // (out in front of him as he swells)
    for (const m of out.bodyMats) { const c = m.color.r + (M.tone[s] - m.color.r) * ease; m.color.setRGB(c, c * (1 - (1 - M.tone[s]) * 0.2), c * (1 - (1 - M.tone[s]) * 0.2)); }
    out.alert += ((listening ? 1 : 0) - out.alert) * (1 - Math.exp(-14 * dt));
    out.kick *= Math.exp(-7 * dt);
    let tz = 0, tx = (out.slumped ? 0.26 : 0) - M.listenTilt * out.alert - out.kick;
    if (out.stage >= 4 && !out.still) { // he can't hold still any more
      out.twitchT -= dt;
      if (out.twitchT <= 0) { out.twitchT = 0.12 + Math.random() * 0.9; out.tiltZ = (Math.random() - 0.5) * M.twitch; out.tiltX = (Math.random() - 0.5) * M.twitch * 0.5; }
      tz = out.tiltZ; tx += out.tiltX;
    }
    if (out.shriekT > 0) {
      out.shriekT -= dt; show(out.shriekT > 0 ? 's' : out.stage);
      if (!out.still) { tz += (Math.random() - 0.5) * M.twitch * 1.2; tx -= 0.08; }
    } else if (out.flick > 0 && false) { // (no flickering between faces: it read badly)
      out.flick -= dt; show(out.flick > 0 && Math.floor(out.flick * 22) % 2 ? Math.max(1, out.stage - 1) : out.stage);
    }
    if (out.giggleT > 0) { out.giggleT -= dt; tz += Math.sin(out.giggleT * 34) * 0.1 * Math.min(1, out.giggleT * 3); tx -= 0.03; }
    root.rotation.z += (tz - root.rotation.z) * Math.min(1, 26 * dt); root.rotation.x += (tx - root.rotation.x) * Math.min(1, 26 * dt);
  };

  loadGLB(TUNING.assets.vacuum).then((gltf) => { gltf.scene.traverse((o) => { if (o.isMesh) out.bodyMats.push(o.material); }); body.add(gltf.scene); }).catch((e) => {
    console.warn('vacuum model failed, using the stand-in:', e?.message || e);
    body.add(standIn());
  }).finally(() => { out.ready = true; });
  return out;
}
