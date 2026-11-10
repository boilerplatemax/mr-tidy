// Builds the house from src/data/level.js: rooms, walls, furniture and a collider for every solid. Walls, floors and anything
// that stays a plain box are textured here; the furniture proper is real models, placed by src/world/dress.js. Static
// geometry is batched per material, so the shell is a handful of draw calls.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { LEVEL } from '../data/level.js';
import { makePS1, pixelTexture } from '../render/ps1-material.js';

const H = TUNING.house;
const lambert = (color, extra = {}) => makePS1(new THREE.MeshLambertMaterial({ color, ...extra }));
const loader = new THREE.TextureLoader();

/** Quads collected per material, merged into one mesh each at the end. UVs are in metres, divided by the material's tile size. */
class Batches {
  constructor() { this.map = new Map(); }
  quad(mat, a, b, c, d, n, uvA, uvB) { // corners counter-clockwise from the normal's side
    let e = this.map.get(mat);
    if (!e) { e = { p: [], n: [], u: [], i: [], v: 0 }; this.map.set(mat, e); }
    e.p.push(...a, ...b, ...c, ...d);
    for (let k = 0; k < 4; k++) e.n.push(...n);
    const t = mat.userData.tile || 1;
    e.u.push(uvA[0] / t, uvA[1] / t, uvB[0] / t, uvA[1] / t, uvB[0] / t, uvB[1] / t, uvA[0] / t, uvB[1] / t);
    e.i.push(e.v, e.v + 1, e.v + 2, e.v, e.v + 2, e.v + 3);
    e.v += 4;
  }
  addTo(scene) {
    for (const [mat, e] of this.map) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(e.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(e.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(e.u, 2));
      g.setIndex(e.i);
      scene.add(new THREE.Mesh(g, mat));
    }
  }
}

/** The six faces of an axis-aligned box. pick(face, centre) returns a material, or null to skip the face. */
function boxFaces(B, min, max, pick) {
  const [x0, y0, z0] = min, [x1, y1, z1] = max;
  const face = (name, a, b, c, d, n, uvA, uvB) => {
    const cx = (a[0] + c[0]) / 2, cy = (a[1] + c[1]) / 2, cz = (a[2] + c[2]) / 2;
    const mat = pick(name, cx, cy, cz, n);
    if (mat) B.quad(mat, a, b, c, d, n, uvA, uvB);
  };
  face('top', [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [x0, z1], [x1, z0]);
  face('bottom', [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], [x0, z0], [x1, z1]);
  face('n', [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [x1, y0], [x0, y1]);
  face('s', [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [x0, y0], [x1, y1]);
  face('w', [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [z0, y0], [z1, y1]);
  face('e', [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [z1, y0], [z0, y1]);
}

const PLATES = ['An empty frame. Marmalade, 1997–', 'Biscuit, 1961–1974', 'Mr. Whiskers, 1975–1983', 'Duchess, 1984–1989', 'Pepper, 1990–1992', 'Tuna, 1993–1994', 'Marigold, 1995', 'Sapphire, 1996', 'Mittens, 1996'];
const roomAt = (x, z) => LEVEL.rooms.find((r) => x >= r.min[0] && x <= r.max[0] && z >= r.min[1] && z <= r.max[1]) || null;

export function buildHouse({ scene, world }) {
  const B = new Batches();
  const C = H.colors;
  const texMats = new Map();
  /** A PS1 material with a tiling picture from game-assets/textures/house. tile: metres per repeat. */
  const tex = (name, tile = H.tile[name] ?? 0.5) => {
    if (!texMats.has(name)) {
      const t = loader.load(`game-assets/textures/house/${name}.png`, undefined, undefined, () => console.warn(`house: no texture ${name}`));
      t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; pixelTexture(t);
      const m = makePS1(new THREE.MeshLambertMaterial({ map: t }));
      m.userData.tile = tile;
      texMats.set(name, m);
    }
    return texMats.get(name);
  };
  const mats = {
    wallTop: lambert(C.wallTop), outside: lambert(C.outside),
    ceiling: (() => { const m = tex('ceiling_popcorn'); m.emissive = new THREE.Color(0xffffff); m.emissiveMap = m.map; m.emissiveIntensity = C.ceilingGlow; return m; })(),
    plate: lambert(C.outlet),
    stripes: tex('fabric_sisal', 0.25),
    strip: makePS1(new THREE.MeshBasicMaterial({ color: C.doorStrip, fog: false })),
    floor: new Map(LEVEL.rooms.map((r) => [r.id, tex(r.floorTex)])),
    wall: new Map(LEVEL.rooms.map((r) => [r.id, tex(r.wallTex)])),
  };

  // ---- floors, ceilings and footstep surfaces
  world.defaultSurface = 'wood';
  for (const r of LEVEL.rooms) {
    const [x0, z0] = r.min, [x1, z1] = r.max;
    B.quad(mats.floor.get(r.id), [x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0], [0, 1, 0], [x0, z1], [x1, z0]);
    B.quad(mats.ceiling, [x0, LEVEL.ceiling, z0], [x1, LEVEL.ceiling, z0], [x1, LEVEL.ceiling, z1], [x0, LEVEL.ceiling, z1], [0, -1, 0], [x0, z0], [x1, z1]);
    world.addRegion(x0, x1, z0, z1, r.surface);
  }
  world.ceilingY = LEVEL.ceiling;

  // ---- walls: full-height pieces between openings, lintels above them
  const wallMat = (name, cx, cy, cz, n) => {
    if (name === 'top' || name === 'bottom') return mats.wallTop;
    const r = roomAt(cx + n[0] * 0.12, cz + n[2] * 0.12); // the room this face looks into
    return r ? mats.wall.get(r.id) : mats.outside;
  };
  const T = LEVEL.wallT;
  const wallBox = (axis, at, a, b, y0, y1) => {
    const min = axis === 'x' ? [a, y0, at - T / 2] : [at - T / 2, y0, a];
    const max = axis === 'x' ? [b, y1, at + T / 2] : [at + T / 2, y1, b];
    // one wall piece can run past several rooms: its faces are cut at the room edges, so each stretch gets its own room's paper
    const edges = [...new Set(LEVEL.rooms.flatMap((r) => (axis === 'x' ? [r.min[0], r.max[0]] : [r.min[1], r.max[1]])))].filter((v) => v > a + 1e-3 && v < b - 1e-3).sort((p, q) => p - q), cuts = [a, ...edges, b];
    for (let i = 1; i < cuts.length; i++) {
      const lo = [...min], hi = [...max], k = axis === 'x' ? 0 : 2;
      lo[k] = cuts[i - 1]; hi[k] = cuts[i];
      boxFaces(B, lo, hi, (name, cx, cy, cz, n) => ((name === (axis === 'x' ? 'w' : 'n') && i > 1) || (name === (axis === 'x' ? 'e' : 's') && i < cuts.length - 1) ? null : wallMat(name, cx, cy, cz, n)));
    }
    const c = world.addBox((min[0] + max[0]) / 2, (y0 + y1) / 2, (min[2] + max[2]) / 2, max[0] - min[0], y1 - y0, max[2] - min[2], 0, { surface: 'wood', occludes: true, tag: 'wall', noStep: true });
    c.land = false;
  };
  for (const w of LEVEL.walls) {
    let cursor = w.from;
    for (const o of [...(w.openings || [])].sort((p, q) => p.from - q.from)) {
      wallBox(w.axis, w.at, cursor, o.from, 0, LEVEL.ceiling);
      if (o.bottom) wallBox(w.axis, w.at, o.from, o.to, 0, o.bottom); // (a window: wall below it as well as above)
      if (!o.noLintel) wallBox(w.axis, w.at, o.from, o.to, o.top, LEVEL.ceiling);
      cursor = o.to;
    }
    wallBox(w.axis, w.at, cursor, w.to, 0, LEVEL.ceiling);
  }

  // ---- furniture: whatever isn't a model is drawn as a textured box. The models replace the solids named in their fit lists
  const byId = new Map();
  const dressed = new Set(LEVEL.dress.flatMap((e) => e.fit || []));
  for (const s of LEVEL.solids) {
    if (!dressed.has(s.id) && !s.noVisual) {
      const side = tex(s.tex || 'wood_walnut'), top = s.topTex ? tex(s.topTex) : side;
      boxFaces(B, s.min, s.max, (name) => {
        if (name === 'top') return top;
        if (name === 'bottom') return s.min[1] > 0.001 ? side : null;
        return s.stripes?.includes(name) && s.tex !== 'fabric_velvet_curtain' ? mats.stripes : side; // (a closed curtain is climbable and looks like a curtain)
      });
    }
    byId.set(s.id, s);
    if (s.collide === false) continue;
    const [x0, y0, z0] = s.min, [x1, y1, z1] = s.max;
    const c = world.addBox((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, 0, { surface: 'wood', occludes: s.occludes ?? y1 - y0 > 1.2, tag: s.id, noStep: !s.land });
    c.id = s.id; c.land = !!s.land; c.stripes = s.stripes || null;
    s.collider = c;
  }

  for (const s of LEVEL.solids) if (s.climbTo) s.collider.climbTo = byId.get(s.climbTo).collider; // a curtain hands over to its rod at the top

  // ---- the strip of light under Grandma's door (the door itself is a model)
  const D = LEVEL.grandmaDoor;
  boxFaces(B, [D.x - 0.04, 0, D.zMin], [D.x, D.strip, D.zMax], (name) => (name === 'e' ? null : mats.strip));

  // ---- the hallway runner
  { const m = tex('runner_oriental', 0.7); B.quad(m, [0.1, 0.006, -0.35], [17.9, 0.006, -0.35], [17.9, 0.006, -1.05], [0.1, 0.006, -1.05], [0, 1, 0], [0.1, -0.35], [17.9, -1.05]); }

  B.addTo(scene);

  // ---- wall outlets: models, without their own plug (the cord brings the real one)
  import('./dress.js').then(() => loadOutlets(scene));

  scene.add(bathtub(LEVEL.tub));

  // ---- Grandma's room, what you can see of it past the door: warm, and that's all
  { const warm = new THREE.MeshBasicMaterial({ color: 0x8a5a2a, fog: false }), dim = new THREE.MeshBasicMaterial({ color: 0x3a2412, fog: false });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), warm); back.position.set(19.6, 1.5, -0.7); back.rotation.y = -Math.PI / 2; scene.add(back);
    const flr = new THREE.Mesh(new THREE.PlaneGeometry(2, 3).rotateX(-Math.PI / 2), dim); flr.position.set(19, 0, -0.7); scene.add(flr);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1), dim); bed.position.set(19.1, 0.25, -0.4); scene.add(bed); }

  // ---- windows: real holes, with a frame in them and the night outside, seen in the gap between the curtains
  const nightMat = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72; const g = c.getContext('2d');
    for (let y = 0; y < 72; y++) { const k = y / 72; g.fillStyle = 'rgb(' + Math.round(10 + 34 * k) + ',' + Math.round(16 + 42 * k) + ',' + Math.round(40 + 64 * k) + ')'; g.fillRect(0, y, 128, 1); }
    g.fillStyle = '#c8d4e8'; for (let i = 0; i < 46; i++) g.fillRect((i * 37) % 128, (i * 23) % 40, 1, 1);
    g.fillStyle = '#e8ecd8'; g.beginPath(); g.arc(92, 18, 7, 0, 7); g.fill(); g.fillStyle = '#10182e'; g.beginPath(); g.arc(95, 16, 6, 0, 7); g.fill(); // the moon
    g.fillStyle = '#05070c'; for (let x = 0; x < 128; x += 1) { const h = 14 + Math.abs(Math.sin(x * 0.22)) * 10 + Math.abs(Math.sin(x * 0.57)) * 6; g.fillRect(x, 72 - h, 1, h); } // the trees at the end of the garden
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; pixelTexture(t);
    return new THREE.MeshBasicMaterial({ map: t, fog: false });
  })();
  const frameMat2 = lambert(0xc8c0ac), glass = new THREE.MeshBasicMaterial({ color: 0x9fb8e0, transparent: true, opacity: 0.1, depthWrite: false, fog: false });
  const clouds = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 32; const g = c.getContext('2d');
    g.fillStyle = 'rgba(120,132,160,0.55)'; for (let i = 0; i < 26; i++) g.fillRect((i * 53) % 128, (i * 11) % 28, 14 + (i * 7) % 26, 2 + (i * 3) % 3);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; pixelTexture(t);
    return t;
  })();
  const cloudMat = new THREE.MeshBasicMaterial({ map: clouds, transparent: true, depthWrite: false, fog: false });
  const addBar = (w, a, y0, y1, depth, along) => { const wide = w.axis === 'x'; const g = new THREE.BoxGeometry(wide ? along : depth, y1 - y0, wide ? depth : along), m = new THREE.Mesh(g, frameMat2); m.position.set(wide ? a : w.at, (y0 + y1) / 2, wide ? w.at : a); scene.add(m); };
  for (const w of LEVEL.windows) {
    const mid = (w.from + w.to) / 2, midY = (w.bottom + w.top) / 2, W0 = w.to - w.from, H0 = w.top - w.bottom, b = 0.03, d = T * 0.8;
    addBar(w, w.from + b / 2, w.bottom, w.top, d, b); addBar(w, w.to - b / 2, w.bottom, w.top, d, b); addBar(w, mid, w.bottom, w.top, d, b * 0.7);
    for (const y of [w.bottom + b / 2, w.top - b / 2, midY]) { const wide = w.axis === 'x', m = new THREE.Mesh(new THREE.BoxGeometry(wide ? W0 : d, y === midY ? b * 0.7 : b, wide ? d : W0), frameMat2); m.position.set(wide ? mid : w.at, y, wide ? w.at : mid); scene.add(m); }
    const pos = (out) => [w.axis === 'x' ? mid : w.at, midY, w.axis === 'x' ? w.at : mid].map((v, i) => v - (i === 0 ? w.n[0] : i === 2 ? w.n[1] : 0) * out), yaw = Math.atan2(w.n[0], w.n[1]);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(W0, H0), glass); pane.position.fromArray(pos(0)); pane.rotation.y = yaw; pane.renderOrder = 3; scene.add(pane);
    const night = new THREE.Mesh(new THREE.PlaneGeometry(7, 4), nightMat); night.position.fromArray(pos(3.2)); night.position.y = 1.7; night.rotation.y = yaw; scene.add(night);
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.5), cloudMat); sky.position.fromArray(pos(3.1)); sky.position.y = 2.6; sky.rotation.y = yaw; sky.renderOrder = 2; scene.add(sky);
  }

  // ---- the portraits down the hallway: the cats who came before
  const portraits = new THREE.Group(), frameMat = tex('wood_walnut');
  const pic = (file, w, h) => { const t = loader.load(`game-assets/textures/portraits/${file}.png`); t.colorSpace = THREE.SRGBColorSpace; pixelTexture(t); return new THREE.Mesh(new THREE.PlaneGeometry(w, h), makePS1(new THREE.MeshLambertMaterial({ map: t }))); };
  for (const [x, name, plate] of LEVEL.portraits) {
    const y = 1.25, z = -T / 2 - 0.012;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.48, 0.02), frameMat); frame.position.set(x, y, z + 0.002);
    const p = pic(`portrait_${name}`, 0.34, 0.42); p.position.set(x, y, z - 0.009); p.rotation.y = Math.PI;
    portraits.add(frame, p);
    if (plate) { const n = pic(`nameplate_0${plate}`, 0.22, 0.055); n.position.set(x, y - 0.3, z - 0.002); n.rotation.y = Math.PI; portraits.add(n); }
  }
  scene.add(portraits);

  const zones = LEVEL.rooms.map((r) => new THREE.Box3(new THREE.Vector3(r.min[0], -0.1, r.min[1]), new THREE.Vector3(r.max[0], LEVEL.ceiling + 0.1, r.max[1])));
  const XS = LEVEL.rooms.flatMap((r) => [r.min[0], r.max[0]]), ZS = LEVEL.rooms.flatMap((r) => [r.min[1], r.max[1]]);
  const shell = new THREE.Box3(new THREE.Vector3(Math.min(...XS) - 1, -1, Math.min(...ZS) - 1), new THREE.Vector3(Math.max(...XS) + 2.5, LEVEL.ceiling + 0.2, Math.max(...ZS) + 1));

  const ceiling0 = C.ceilingGlow, ceilingMat = mats.ceiling;
  return { zones, indoor: [shell], spawn: H.spawn, byId, doorStrip: mats.strip, portraits: LEVEL.portraits.map(([x, , plate]) => ({ x, y: 1.25, z: -T / 2, text: PLATES[plate] })), tick() {}, startSound() {}, frame(time) { clouds.offset.x = time * 0.006; }, setDark(k) { ceilingMat.emissiveIntensity = ceiling0 * (1 - k); } };
}

/** A roll-top enamel bath on claw feet: rounded loops stacked up the outside, over the lip, and down into the hollow. */
function bathtub({ x0, x1, z0, z1, top }) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hx = (x1 - x0) / 2, hz = (z1 - z0) / 2, n = 28;
  const loop = (ax, az, r, y) => { // a rounded rectangle, n points round
    const out = [], X0 = hx - ax, Z0 = hz - az;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), l = Math.max(Math.abs(c), Math.abs(sn)), ex = c / l, ez = sn / l; // out to the square, then pull the corners in
      const rx = Math.min(r, X0), rz = Math.min(r, Z0), px = Math.sign(ex) * Math.max(0, Math.abs(ex) * X0 - rx), pz = Math.sign(ez) * Math.max(0, Math.abs(ez) * Z0 - rz);
      const dx = ex * X0 - px, dz = ez * Z0 - pz, dl = Math.hypot(dx, dz) || 1, k = Math.min(rx, rz);
      out.push(cx + px + (Math.abs(dx) > 1e-4 && Math.abs(dz) > 1e-4 ? (dx / dl) * k : dx), y, cz + pz + (Math.abs(dx) > 1e-4 && Math.abs(dz) > 1e-4 ? (dz / dl) * k : dz));
    }
    return out;
  };
  const rings = [[0.12, 0.12, 0.1, 0.1], [0.06, 0.06, 0.13, 0.17], [0.015, 0.015, 0.16, top - 0.07], [0, 0, 0.17, top - 0.025], [0.012, 0.012, 0.16, top], [0.082, 0.082, 0.11, top], [0.095, 0.095, 0.1, top - 0.03], [0.14, 0.14, 0.08, 0.18], [0.21, 0.14, 0.05, 0.025]].map(([ax, az, r, y]) => loop(ax, az, r, y));
  const p = rings.flat(), idx = [];
  for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < n; i++) { const a = r * n + i, b = r * n + ((i + 1) % n), c = a + n, d = b + n; idx.push(a, c, b, b, c, d); }
  const last = (rings.length - 1) * n, mid = p.length / 3; p.push(cx, 0.025, cz); for (let i = 0; i < n; i++) idx.push(last + i, mid, last + ((i + 1) % n)); // the bottom of the bath
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(idx); g.computeVertexNormals();
  const group = new THREE.Group(), enamel = makePS1(new THREE.MeshLambertMaterial({ color: 0xe9e5d8, side: THREE.DoubleSide })), brass = makePS1(new THREE.MeshLambertMaterial({ color: 0xb58a3c }));
  group.add(new THREE.Mesh(g, enamel));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const foot = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), brass); foot.position.set(cx + sx * (hx - 0.16), 0.05, cz + sz * (hz - 0.13)); foot.scale.set(1, 1.1, 1); group.add(foot); }
  return group;
}

/** A plug pushed into a socket: a little black block out from the plate, the flex coming out of its bottom. */
function plugAt(o) {
  const g = new THREE.Group(), mat = new THREE.MeshLambertMaterial({ color: 0x18181a }), b = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.04, 0.032), mat);
  b.position.set(o.pos[0] + o.n[0] * 0.026, o.pos[1] - 0.014, o.pos[2] + o.n[2] * 0.026); g.add(b);
  return g;
}

/** The television's flex: plugged in, or pulled out and lying on the floor. */
export const tvParts = { plug: null, plugged: null, loose: null };
function tvFlex(scene) {
  const mat = new THREE.MeshLambertMaterial({ color: 0x2a2a2c }), O = LEVEL.tvOutlet, seg = (grp, pts) => { for (let i = 1; i < pts.length; i++) { const a = new THREE.Vector3(...pts[i - 1]), b = new THREE.Vector3(...pts[i]), l = a.distanceTo(b), c = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, l, 4), mat); c.position.copy(a).lerp(b, 0.5); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); grp.add(c); } };
  tvParts.plugged = new THREE.Group(); seg(tvParts.plugged, [[5.82, 0.12, 1.66], [5.86, 0.006, 1.6], [O.pos[0] - 0.026, 0.006, O.pos[2]], [O.pos[0] - 0.026, O.pos[1] - 0.034, O.pos[2]]]); scene.add(tvParts.plugged);
  tvParts.loose = new THREE.Group(); seg(tvParts.loose, [[5.82, 0.12, 1.66], [5.8, 0.006, 1.58], [5.66, 0.006, 1.38]]);
  const p = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.05), new THREE.MeshLambertMaterial({ color: 0x141414 })); p.position.set(5.64, 0.015, 1.36); tvParts.loose.add(p); tvParts.loose.visible = false; scene.add(tvParts.loose);
}

async function loadOutlets(scene) {
  tvFlex(scene);
  const { loadGLB } = await import('../render/geometry.js');
  let g;
  try { g = await loadGLB('game-assets/models/house/wall_outlet.glb'); } catch { return; }
  for (const o of [...LEVEL.outlets, { ...LEVEL.lampOutlet, lamp: true }, { ...LEVEL.tvOutlet, tv: true }]) {
    const m = g.scene.clone(true), plug = m.getObjectByName('plug');
    if (plug) plug.visible = false; // (the model's own plug sits wrong: the lamp's and the TV's are made below)
    if (o.lamp || o.tv) { const p = plugAt(o); scene.add(p); if (o.tv) tvParts.plug = p; } // (the lamp's is plugged in; the vacuum's plug comes with his cord)
    m.position.set(o.pos[0], o.pos[1], o.pos[2]);
    m.rotation.y = Math.atan2(o.n[0], o.n[2]);
    scene.add(m);
  }
  { const L = LEVEL.lampOutlet, mat = new THREE.MeshLambertMaterial({ color: 0x2a2a2c }), a = new THREE.Vector3(...L.from), b = new THREE.Vector3(L.pos[0] + 0.026, L.pos[1] - 0.034, L.pos[2]); // the lamp's flex, along the floor and up to the socket
    for (const [p, q] of [[a, new THREE.Vector3(b.x, 0.006, b.z)], [new THREE.Vector3(b.x, 0.006, b.z), b]]) { const l = p.distanceTo(q), c = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, l, 4), mat); c.position.copy(p).lerp(q, 0.5); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), q.clone().sub(p).normalize()); scene.add(c); } }
}
