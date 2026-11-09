// Builds the grey-box house from src/data/level.js: rooms, walls, furniture, the colour code (build prompt 0.2), and
// a collider for every solid. Static geometry is batched per material, so the house is a handful of draw calls.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { LEVEL } from '../data/level.js';
import { makePS1 } from '../render/ps1-material.js';
import { canvasTexture } from '../render/geometry.js';

const H = TUNING.house;
const lambert = (color, extra = {}) => makePS1(new THREE.MeshLambertMaterial({ color, ...extra }));

/** Quads collected per material, merged into one mesh each at the end. UVs are box-projected in metres. */
class Batches {
  constructor() { this.map = new Map(); }
  quad(mat, a, b, c, d, n, uvA, uvB) { // corners counter-clockwise from the normal's side
    let e = this.map.get(mat);
    if (!e) { e = { p: [], n: [], u: [], i: [], v: 0 }; this.map.set(mat, e); }
    e.p.push(...a, ...b, ...c, ...d);
    for (let k = 0; k < 4; k++) e.n.push(...n);
    e.u.push(uvA[0], uvA[1], uvB[0], uvA[1], uvB[0], uvB[1], uvA[0], uvB[1]);
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
function boxFaces(B, min, max, pick, tile = 1) {
  const [x0, y0, z0] = min, [x1, y1, z1] = max;
  const face = (name, a, b, c, d, n, uvA, uvB) => {
    const cx = (a[0] + c[0]) / 2, cy = (a[1] + c[1]) / 2, cz = (a[2] + c[2]) / 2;
    const mat = pick(name, cx, cy, cz, n);
    if (mat) B.quad(mat, a, b, c, d, n, [uvA[0] / tile, uvA[1] / tile], [uvB[0] / tile, uvB[1] / tile]);
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
  const mats = {
    tan: lambert(C.landTop), side: lambert(C.furniture), wallTop: lambert(C.wallTop), outside: lambert(C.outside),
    ceiling: (() => {
      const tiles = canvasTexture(32, (g, n) => {
        g.fillStyle = '#' + C.ceiling.toString(16).padStart(6, '0'); g.fillRect(0, 0, n, n);
        g.fillStyle = '#' + C.ceilingLine.toString(16).padStart(6, '0'); g.fillRect(0, 0, n, 3); g.fillRect(0, 0, 3, n); // tile lines: a plane the eye can read, not a void
      });
      return makePS1(new THREE.MeshLambertMaterial({ map: tiles, emissive: 0xffffff, emissiveMap: tiles, emissiveIntensity: C.ceilingGlow }));
    })(),
    door: lambert(C.grandmaDoor), plate: lambert(C.outlet),
    stripes: makePS1(new THREE.MeshLambertMaterial({ map: canvasTexture(32, (g, n) => {
      g.fillStyle = C.climbDark; g.fillRect(0, 0, n, n);
      g.fillStyle = C.climb; for (let x = 0; x < n; x += 16) g.fillRect(x, 0, 3, n); // wide enough to survive the mip levels at a distance
    }) })),
    strip: makePS1(new THREE.MeshBasicMaterial({ color: C.doorStrip, fog: false })),
    floor: new Map(LEVEL.rooms.map((r) => [r.id, lambert(r.floor)])),
    wall: new Map(LEVEL.rooms.map((r) => [r.id, lambert(r.wall)])),
  };

  // ---- floors, ceilings and footstep surfaces
  world.defaultSurface = 'wood';
  for (const r of LEVEL.rooms) {
    const [x0, z0] = r.min, [x1, z1] = r.max;
    B.quad(mats.floor.get(r.id), [x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0], [0, 1, 0], [x0, z1], [x1, z0]);
    B.quad(mats.ceiling, [x0, LEVEL.ceiling, z0], [x1, LEVEL.ceiling, z0], [x1, LEVEL.ceiling, z1], [x0, LEVEL.ceiling, z1], [0, -1, 0], [x0 / 0.6, z0 / 0.6], [x1 / 0.6, z1 / 0.6]);
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

  // ---- furniture: warm tops on perches, stripes on climbable faces (see the colour code in build prompt 0.2)
  const byId = new Map();
  for (const s of LEVEL.solids) {
    boxFaces(B, s.min, s.max, (name) => {
      if (name === 'top') return s.land ? mats.tan : mats.side;
      if (name === 'bottom') return s.min[1] > 0.001 ? mats.side : null;
      return s.stripes?.includes(name) ? mats.stripes : mats.side;
    }, 0.25);
    byId.set(s.id, s);
    if (s.collide === false) continue;
    const [x0, y0, z0] = s.min, [x1, y1, z1] = s.max;
    const c = world.addBox((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, 0, { surface: 'wood', occludes: y1 - y0 > 1.2, tag: s.id, noStep: !s.land });
    c.id = s.id; c.land = !!s.land; c.stripes = s.stripes || null;
    s.collider = c;
  }

  for (const s of LEVEL.solids) if (s.climbTo) s.collider.climbTo = byId.get(s.climbTo).collider; // a curtain hands over to its rod at the top

  // ---- Grandma's door: deep red, a strip of light under it
  const D = LEVEL.grandmaDoor;
  boxFaces(B, [D.x - 0.04, D.strip, D.zMin], [D.x, D.top, D.zMax], (name) => (name === 'e' || name === 'bottom' ? null : mats.door));
  boxFaces(B, [D.x - 0.04, 0, D.zMin], [D.x, D.strip, D.zMax], (name) => (name === 'e' ? null : mats.strip));

  // ---- wall outlets: a small plate on the wall, visual only
  for (const o of LEVEL.outlets) {
    const [x, y, z] = o.pos, [nx, , nz] = o.n, w = 0.05, h = 0.06, d = 0.012;
    const min = [nx ? (nx > 0 ? x : x - d) : x - w, y - h, nz ? (nz > 0 ? z : z - d) : z - w];
    const max = [nx ? (nx > 0 ? x + d : x) : x + w, y + h, nz ? (nz > 0 ? z + d : z) : z + w];
    boxFaces(B, min, max, () => mats.plate);
  }

  B.addTo(scene);

  const zones = LEVEL.rooms.map((r) => new THREE.Box3(new THREE.Vector3(r.min[0], -0.1, r.min[1]), new THREE.Vector3(r.max[0], LEVEL.ceiling + 0.1, r.max[1])));
  const shell = new THREE.Box3(new THREE.Vector3(-1, -1, -3), new THREE.Vector3(19, LEVEL.ceiling + 0.2, 6.5));

  return { zones, indoor: [shell], spawn: H.spawn, byId, doorStrip: mats.strip, tick() {}, startSound() {} };
}
