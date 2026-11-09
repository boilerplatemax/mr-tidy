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
    boxFaces(B, min, max, wallMat);
    const c = world.addBox((min[0] + max[0]) / 2, (y0 + y1) / 2, (min[2] + max[2]) / 2, max[0] - min[0], y1 - y0, max[2] - min[2], 0, { surface: 'wood', occludes: true, tag: 'wall', noStep: true });
    c.land = false;
  };
  for (const w of LEVEL.walls) {
    let cursor = w.from;
    for (const o of [...(w.openings || [])].sort((p, q) => p.from - q.from)) {
      wallBox(w.axis, w.at, cursor, o.from, 0, LEVEL.ceiling);
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
        return s.stripes?.includes(name) ? mats.stripes : side;
      });
    }
    byId.set(s.id, s);
    if (s.collide === false) continue;
    const [x0, y0, z0] = s.min, [x1, y1, z1] = s.max;
    const c = world.addBox((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, 0, { surface: 'wood', occludes: y1 - y0 > 1.2, tag: s.id, noStep: !s.land });
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
  const shell = new THREE.Box3(new THREE.Vector3(Math.min(...XS) - 1, -1, Math.min(...ZS) - 1), new THREE.Vector3(Math.max(...XS) + 1, LEVEL.ceiling + 0.2, Math.max(...ZS) + 1));

  return { zones, indoor: [shell], spawn: H.spawn, byId, doorStrip: mats.strip, tick() {}, startSound() {} };
}

async function loadOutlets(scene) {
  const { loadGLB } = await import('../render/geometry.js');
  let g;
  try { g = await loadGLB('game-assets/models/house/wall_outlet.glb'); } catch { return; }
  for (const o of LEVEL.outlets) {
    const m = g.scene.clone(true), plug = m.getObjectByName('plug');
    if (plug) plug.visible = false;
    m.position.set(o.pos[0], o.pos[1], o.pos[2]);
    m.rotation.y = Math.atan2(o.n[0], o.n[2]);
    scene.add(m);
  }
}
