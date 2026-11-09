// The PS1 surface model. Every world material is a MeshLambertMaterial (or Basic) patched with:
//   • vertex snapping to the internal pixel grid (polygon jitter)
//   • affine texture warping (screen-linear UVs blended with perspective-correct ones)
//   • nearest texels with a clamped, biased mip level (crisp up close, no sparkle at distance)
//   • indoor light volumes: inside an indoor box (a building's shell), sun/sky light is scaled down and a flat indoor fill
//     is added, because nothing casts shadows (only the flashlight may) and sunlight would otherwise
//     light the inside of a roofed room.
//   • light zones: nothing casts shadows, so a point light would shine straight through walls.
//     Each point light only lights fragments in the same zone it sits in (a room, a shed, or "outdoors" =
//     no zone). Room lights never leak outside; a porch light never lights the room behind the wall.
//     Spot lights (the flashlight) are not zoned: they have a real shadow map.
//   • a per-material highlight (the interaction cue) that MULTIPLIES lit colour, so dark stays dark.
// The uniforms are shared objects: changing PS1.uniforms.x.value updates every material at once.
import * as THREE from 'three';

const MAX_BOXES = 4;
const MAX_ZONES = 8;

export const PS1 = {
  uniforms: {
    uPs1Res: { value: new THREE.Vector2(320, 240) },
    uPs1Snap: { value: 1 }, // grid step in internal pixels; 0 = off
    uPs1Warp: { value: 0.5 },
    uPs1MaxLod: { value: 3 },
    uPs1LodBias: { value: 0.5 },
    uPs1BoxMin: { value: Array.from({ length: MAX_BOXES }, () => new THREE.Vector3()) },
    uPs1BoxMax: { value: Array.from({ length: MAX_BOXES }, () => new THREE.Vector3()) },
    uPs1BoxCount: { value: 0 },
    uPs1IndoorFade: { value: 0.12 },
    uPs1IndoorSun: { value: 0 },
    uPs1IndoorSky: { value: 0.25 },
    uPs1IndoorFill: { value: new THREE.Color(0) },
    uPs1ZoneMin: { value: Array.from({ length: MAX_ZONES }, () => new THREE.Vector3()) },
    uPs1ZoneMax: { value: Array.from({ length: MAX_ZONES }, () => new THREE.Vector3()) },
    uPs1ZoneCount: { value: 0 },
  },
  /** Light zones (array of THREE.Box3, world space). A point light lights only its own zone. */
  setLightZones(boxes) {
    const u = this.uniforms;
    if (boxes.length > MAX_ZONES) console.warn(`PS1: ${boxes.length} light zones, max ${MAX_ZONES}`);
    u.uPs1ZoneCount.value = Math.min(boxes.length, MAX_ZONES);
    boxes.slice(0, MAX_ZONES).forEach((b, i) => { u.uPs1ZoneMin.value[i].copy(b.min); u.uPs1ZoneMax.value[i].copy(b.max); });
  },
  /** Zone index of a world point (−1 = outdoors). Same rule as the shader. */
  zoneOf(p) {
    const u = this.uniforms;
    for (let i = 0; i < u.uPs1ZoneCount.value; i++) {
      const a = u.uPs1ZoneMin.value[i], b = u.uPs1ZoneMax.value[i];
      if (p.x >= a.x && p.y >= a.y && p.z >= a.z && p.x <= b.x && p.y <= b.y && p.z <= b.z) return i;
    }
    return -1;
  },
  /** Set the indoor volumes (array of THREE.Box3, world space). */
  setIndoorBoxes(boxes) {
    const u = this.uniforms;
    u.uPs1BoxCount.value = Math.min(boxes.length, MAX_BOXES);
    boxes.slice(0, MAX_BOXES).forEach((b, i) => { u.uPs1BoxMin.value[i].copy(b.min); u.uPs1BoxMax.value[i].copy(b.max); });
  },
};

const VERT_HEAD = /* glsl */`
uniform vec2 uPs1Res;
uniform float uPs1Snap;
varying vec3 vPs1Affine;
varying vec3 vPs1World;
`;
const VERT_BODY = /* glsl */`
#ifdef USE_INSTANCING
  vPs1World = ( modelMatrix * instanceMatrix * vec4( transformed, 1.0 ) ).xyz;
#else
  vPs1World = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
#endif
if ( uPs1Snap > 0.0 && gl_Position.w > 0.0 ) {
  vec2 ps1Grid = uPs1Res * 0.5 / uPs1Snap;
  vec2 ps1Ndc = gl_Position.xy / gl_Position.w;
  gl_Position.xy = ( floor( ps1Ndc * ps1Grid + 0.5 ) / ps1Grid ) * gl_Position.w;
}
#ifdef USE_MAP
  vPs1Affine = vec3( vMapUv * gl_Position.w, gl_Position.w );
#else
  vPs1Affine = vec3( 0.0, 0.0, 1.0 );
#endif
`;

const FRAG_HEAD = /* glsl */`
uniform float uPs1Warp;
uniform float uPs1MaxLod;
uniform float uPs1LodBias;
uniform vec3 uPs1BoxMin[ ${MAX_BOXES} ];
uniform vec3 uPs1BoxMax[ ${MAX_BOXES} ];
uniform int uPs1BoxCount;
uniform float uPs1IndoorFade;
uniform float uPs1IndoorSun;
uniform float uPs1IndoorSky;
uniform vec3 uPs1IndoorFill;
uniform vec3 uPs1ZoneMin[ ${MAX_ZONES} ];
uniform vec3 uPs1ZoneMax[ ${MAX_ZONES} ];
uniform int uPs1ZoneCount;
uniform float uPs1Highlight;
uniform float uPs1WarpMul;
uniform float uPs1DiscardDark;
varying vec3 vPs1Affine;
varying vec3 vPs1World;
float ps1Indoor() {
  float f = 0.0;
  for ( int i = 0; i < ${MAX_BOXES}; i ++ ) {
    if ( i >= uPs1BoxCount ) break;
    vec3 a = vPs1World - uPs1BoxMin[ i ];
    vec3 b = uPs1BoxMax[ i ] - vPs1World;
    float d = min( min( min( a.x, b.x ), min( a.y, b.y ) ), min( a.z, b.z ) );
    f = max( f, smoothstep( 0.0, uPs1IndoorFade, d ) );
  }
  return f;
}
int ps1Zone( vec3 p ) {
  for ( int i = 0; i < ${MAX_ZONES}; i ++ ) {
    if ( i >= uPs1ZoneCount ) break;
    if ( all( greaterThanEqual( p, uPs1ZoneMin[ i ] ) ) && all( lessThanEqual( p, uPs1ZoneMax[ i ] ) ) ) return i;
  }
  return -1;
}
// view-space light position → world (the view matrix is rigid: inverse = transposed rotation)
float ps1SameZone( vec3 lightView, int fragZone ) {
  vec3 w = transpose( mat3( viewMatrix ) ) * ( lightView - viewMatrix[ 3 ].xyz );
  return ps1Zone( w ) == fragZone ? 1.0 : 0.0;
}
`;

const FRAG_MAP = /* glsl */`
#ifdef USE_MAP
  vec2 ps1Uv = mix( vMapUv, vPs1Affine.xy / vPs1Affine.z, uPs1Warp * uPs1WarpMul );
  vec2 ps1Ts = vec2( textureSize( map, 0 ) );
  vec2 ps1Dx = dFdx( vMapUv * ps1Ts ), ps1Dy = dFdy( vMapUv * ps1Ts );
  float ps1Lod = clamp( 0.5 * log2( max( dot( ps1Dx, ps1Dx ), dot( ps1Dy, ps1Dy ) ) ) + uPs1LodBias, 0.0, uPs1MaxLod );
  vec4 sampledDiffuseColor = textureLod( map, ps1Uv, ps1Lod );
  if ( dot( sampledDiffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) ) < uPs1DiscardDark ) discard; // cut-outs painted dark (per material: ps1DiscardDark)
  diffuseColor *= sampledDiffuseColor;
#endif
`;

let warned = false;
function patchLights(src) {
  let out = src;
  const dir = 'getDirectionalLightInfo( directionalLight, directLight );';
  const amb = 'vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );';
  const point = 'getPointLightInfo( pointLight, geometryPosition, directLight );';
  const hemi = /irradiance \+= getHemisphereLightIrradiance\( hemisphereLights\[ i \], geometryNormal \);/;
  if (!out.includes(dir) || !out.includes(amb) || !out.includes(point) || !hemi.test(out)) {
    if (!warned) console.warn('PS1 material: lights chunk changed; indoor lighting disabled');
    warned = true;
    return src;
  }
  out = 'float ps1In = ps1Indoor();\nint ps1FragZone = ps1Zone( vPs1World );\n' + out;
  out = out.replace(point, point + '\n    directLight.color *= ps1SameZone( pointLight.position, ps1FragZone );');
  out = out.replace(dir, dir + '\n  directLight.color *= mix( 1.0, uPs1IndoorSun, ps1In );');
  out = out.replace(amb, 'vec3 irradiance = getAmbientLightIrradiance( ambientLightColor ) + uPs1IndoorFill * ps1In;');
  out = out.replace(hemi, 'irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal ) * mix( 1.0, uPs1IndoorSky, ps1In );');
  return out;
}

function onBeforeCompile(shader, renderer) {
  Object.assign(shader.uniforms, PS1.uniforms);
  shader.uniforms.uPs1Highlight = this.userData.ps1Highlight;
  shader.uniforms.uPs1WarpMul = this.userData.ps1WarpMul;
  shader.uniforms.uPs1DiscardDark = this.userData.ps1DiscardDark;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\n' + VERT_HEAD)
    .replace('#include <project_vertex>', '#include <project_vertex>\n' + VERT_BODY);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\n' + FRAG_HEAD)
    .replace('#include <map_fragment>', FRAG_MAP)
    .replace('#include <lights_fragment_begin>', patchLights(THREE.ShaderChunk.lights_fragment_begin))
    .replace('#include <opaque_fragment>', '#include <opaque_fragment>\n  gl_FragColor.rgb = gl_FragColor.rgb * ( 1.0 + uPs1Highlight ) + uPs1Highlight * 0.012;');
}

/** Patch a Lambert/Basic material in place. Safe to call twice. */
export function makePS1(material) {
  if (material.userData.ps1) return material;
  material.userData.ps1 = true;
  material.userData.ps1Highlight = { value: 0 };
  material.userData.ps1WarpMul = { value: 1 }; // per material: big unsubdivided surfaces (terrain, far trees) warp less
  material.userData.ps1DiscardDark = { value: -1 }; // per material: discard texels darker than this (−1 = never)
  material.onBeforeCompile = onBeforeCompile;
  material.customProgramCacheKey = () => 'ps1';
  for (const key of ['map', 'emissiveMap', 'alphaMap']) if (material[key]) pixelTexture(material[key]);
  material.dithering = false;
  return material;
}

/** Nearest texels, nearest mip levels (the shader clamps how far down it goes). */
export function pixelTexture(t) {
  if (t.userData.ps1) return t;
  t.userData.ps1 = true;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapNearestFilter;
  t.generateMipmaps = true;
  t.anisotropy = 1;
  t.needsUpdate = true;
  return t;
}

/** A private copy of a PS1 material (own highlight uniform), for objects that highlight on their own. */
export function clonePS1(m) {
  const c = m.clone();
  c.userData = {};
  return makePS1(c);
}

/** Give every mesh under root its own material copies. Returns the list (for highlight control). */
export function uniqueMaterials(root) {
  const out = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map(clonePS1) : clonePS1(o.material);
    out.push(...(Array.isArray(o.material) ? o.material : [o.material]));
  });
  return out;
}

/** Convert any loaded material (GLTF gives MeshStandardMaterial) to a PS1 Lambert. Textures become nearest-filtered. */
export function toPS1Material(src) {
  const m = new THREE.MeshLambertMaterial({
    name: src.name,
    color: src.color ? src.color.clone() : new THREE.Color(1, 1, 1),
    map: src.map || null,
    vertexColors: !!src.vertexColors,
    transparent: !!src.transparent,
    opacity: src.opacity ?? 1,
    alphaTest: src.alphaTest || 0,
    side: src.side ?? THREE.FrontSide,
    emissive: src.emissive ? src.emissive.clone() : new THREE.Color(0),
    emissiveMap: src.emissiveMap || null,
    depthWrite: src.depthWrite ?? true,
  });
  return makePS1(m);
}
