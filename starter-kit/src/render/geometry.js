// Geometry and asset helpers for the PS1 look: subdivision (so affine warp never swims), pixel textures drawn in code
// (clean placeholders), and loading a GLB with every material turned into a PS1 Lambert.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { toPS1Material, pixelTexture } from './ps1-material.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

/**
 * Longest-edge bisection until every edge ≤ maxEdge (metres, in the geometry's own units). Returns a new non-indexed
 * geometry. Shared edges split identically on both sides, so no T-junction cracks appear. Run it on big floors and
 * walls (and on anything the warp option would make swim). Done once at load: never per frame.
 */
export function subdivide(geom, maxEdge = TUNING.render.subdivideMaxEdge) {
  if (geom.index) geom = geom.toNonIndexed();
  const names = Object.keys(geom.attributes);
  const src = names.map((n) => geom.attributes[n]);
  const out = names.map(() => []);
  const pi = names.indexOf('position');
  const max2 = maxEdge * maxEdge;
  const vert = (i) => src.map((a) => Array.from(a.array.slice(i * a.itemSize, (i + 1) * a.itemSize)));
  const mid = (p, q) => p.map((arr, k) => arr.map((v, j) => (v + q[k][j]) / 2));
  const posOf = (v, t) => t.set(v[pi][0], v[pi][1], v[pi][2]);
  const emit = (v) => v.forEach((attr, k) => out[k].push(...attr));
  const split = (A, B, C, depth) => {
    posOf(A, _a); posOf(B, _b); posOf(C, _c);
    const ab = _a.distanceToSquared(_b), bc = _b.distanceToSquared(_c), ca = _c.distanceToSquared(_a);
    const m = Math.max(ab, bc, ca);
    if (m <= max2 || depth > 8) { emit(A); emit(B); emit(C); return; }
    if (m === ab) { const M = mid(A, B); split(A, M, C, depth + 1); split(M, B, C, depth + 1); }
    else if (m === bc) { const M = mid(B, C); split(A, B, M, depth + 1); split(A, M, C, depth + 1); }
    else { const M = mid(C, A); split(A, B, M, depth + 1); split(M, B, C, depth + 1); }
  };
  for (let i = 0; i < geom.attributes.position.count; i += 3) split(vert(i), vert(i + 1), vert(i + 2), 0);
  const g = new THREE.BufferGeometry();
  names.forEach((n, k) => g.setAttribute(n, new THREE.BufferAttribute(new Float32Array(out[k]), src[k].itemSize)));
  g.computeBoundingSphere();
  return g;
}

/**
 * A small pixel texture painted in code: draw(ctx, size) paints a size×size canvas. Nearest filtering, repeat
 * wrapping. The PS1 way to make a clean placeholder that already follows the art rules (64–256 px, no smoothing).
 */
export function canvasTexture(size, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  return pixelTexture(t);
}

/** A deterministic 0..1 hash (stable noise for painted textures: nothing shimmers between loads). */
export function hash(x, y, seed = 1) { const h = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453; return h - Math.floor(h); }

let loader = null;
/**
 * Load a GLB and make it PS1: every material becomes a PS1 Lambert (nearest texels, snapping, zoned lights).
 * opts.subdivide: metres (split long triangles: big static pieces); opts.shadow: cast/receive shadows.
 * Returns the gltf ({ scene, animations, ... }). GLBs cannot load from file://: run the static server.
 * Clone a loaded skinned model with SkeletonUtils.clone (three/addons/utils/SkeletonUtils.js), not .clone().
 */
export async function loadGLB(url, opts = {}) {
  if (!loader) { const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'); loader = new GLTFLoader(); }
  const gltf = await loader.loadAsync(url);
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map(toPS1Material) : toPS1Material(o.material);
    if (opts.subdivide && !o.isSkinnedMesh && !Array.isArray(o.material)) o.geometry = subdivide(o.geometry, opts.subdivide);
    o.castShadow = o.receiveShadow = !!opts.shadow;
  });
  return gltf;
}

/**
 * Box-projected UVs in metres: every face gets UVs from its own two axes, divided by `tile` (metres per texture
 * repeat). Gives the same texel density on every surface whatever its size (no stretched planks on a long wall).
 * Run it on a geometry in its own space before placing (and before subdivide). Textures need RepeatWrapping.
 */
export function boxUV(geom, tile = 1) {
  const pos = geom.attributes.position, nor = geom.attributes.normal, uv = geom.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (ay >= ax && ay >= az) uv.setXY(i, x / tile, -z / tile);
    else if (ax >= az) uv.setXY(i, z * -Math.sign(nor.getX(i)) / tile, y / tile);
    else uv.setXY(i, x * Math.sign(nor.getZ(i)) / tile, y / tile);
  }
  uv.needsUpdate = true;
  return geom;
}
