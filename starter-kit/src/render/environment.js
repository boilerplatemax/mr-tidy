// Sky, fog and the outdoor light rig, driven by the presets in TUNING.lighting. Fog is the world's edge and the main
// mood tool: far by day, close and heavy at night. It also hides the draw distance.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { PS1 } from './ps1-material.js';

const SKY_VERT = /* glsl */`
varying float vH;
varying vec3 vDir;
void main() {
  vDir = normalize( position );
  vH = vDir.y;
  vec4 p = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  gl_Position = vec4( p.xy, p.w * 0.99999, p.w ); // pinned just inside the far plane
}`;
const SKY_FRAG = /* glsl */`
uniform vec3 uTop; uniform vec3 uHorizon;
uniform vec3 uDiscDir; uniform vec3 uDiscColor; uniform float uDiscSize; uniform float uDiscGlow;
varying float vH;
varying vec3 vDir;
void main() {
  vec3 c = mix( uHorizon, uTop, smoothstep( 0.02, 0.55, vH ) );
  // sun / moon: a hard-edged disc (PS1: no bloom) and a wide soft halo, sinking into the horizon haze
  float d = dot( normalize( vDir ), uDiscDir );
  float haze = smoothstep( -0.02, 0.12, vH );
  float disc = step( cos( uDiscSize ), d ) * haze;
  float halo = pow( max( d, 0.0 ), 24.0 ) * uDiscGlow * haze;
  c = mix( c, uDiscColor, clamp( disc * 0.92 + halo, 0.0, 1.0 ) );
  gl_FragColor = vec4( c, 1.0 );
}`;

const NO_DISC = { color: 0, size: 0, glow: 0 };
const lerpN = (x, y, t) => x + (y - x) * t;
const lerpC = (out, x, y, t, tmp) => out.setHex(x).lerp(tmp.setHex(y), t);

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.fog = new THREE.Fog(0x000000, 5, 20);
    scene.fog = this.fog;
    scene.background = new THREE.Color(0);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.ambient = new THREE.AmbientLight(0x000000, 1);
    for (const l of [this.hemi, this.sun, this.ambient]) { l.layers.enableAll(); scene.add(l); } // (they light the viewmodel layer too)
    scene.add(this.sun.target);
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 8),
      new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false,
        uniforms: { uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uDiscDir: { value: new THREE.Vector3(0, 1, 0) }, uDiscColor: { value: new THREE.Color() }, uDiscSize: { value: 0 }, uDiscGlow: { value: 0 } } }),
    );
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1000;
    this.sky.scale.setScalar(50);
    scene.add(this.sky);
    this.preset = null;
    this._tmp = new THREE.Color(); this._a = null; this._b = null; this._t = -1;
  }

  /** Light the world with one preset (a key of TUNING.lighting). */
  apply(name) { this.blend(name, name, 0); }

  /**
   * Light the world part-way between two presets (a day cycle can call this every tick). t 0 = all `a`, 1 = all `b`.
   * Colours blend in linear space; no allocations.
   */
  blend(a, b, t) {
    const A = TUNING.lighting[a], B = TUNING.lighting[b];
    if (!A || !B) { console.warn(`environment: unknown preset ${A ? b : a}`); return; }
    t = Math.max(0, Math.min(1, t));
    if (a === this._a && b === this._b && Math.abs(t - this._t) < 1e-4) return; // nothing changed
    this._a = a; this._b = b; this._t = t;
    this.preset = t < 0.5 ? a : b;
    const tmp = this._tmp;
    lerpC(this.fog.color, A.fog, B.fog, t, tmp);
    this.fog.near = lerpN(A.fogNear, B.fogNear, t); this.fog.far = lerpN(A.fogFar, B.fogFar, t);
    this.scene.background.copy(this.fog.color);
    const su = this.sky.material.uniforms;
    su.uHorizon.value.copy(this.fog.color);
    lerpC(su.uTop.value, A.skyTop, B.skyTop, t, tmp);
    lerpC(this.hemi.color, A.hemiSky, B.hemiSky, t, tmp); lerpC(this.hemi.groundColor, A.hemiGround, B.hemiGround, t, tmp); this.hemi.intensity = lerpN(A.hemi, B.hemi, t);
    lerpC(this.sun.color, A.sun, B.sun, t, tmp); this.sun.intensity = lerpN(A.sunIntensity, B.sunIntensity, t);
    const d = su.uDiscDir.value.set(lerpN(A.sunDir[0], B.sunDir[0], t), lerpN(A.sunDir[1], B.sunDir[1], t), lerpN(A.sunDir[2], B.sunDir[2], t)).normalize();
    this.sun.position.copy(d).multiplyScalar(20);
    const DA = A.disc || NO_DISC, DB = B.disc || NO_DISC;
    lerpC(su.uDiscColor.value, DA.color, DB.color, t, tmp); su.uDiscSize.value = lerpN(DA.size, DB.size, t); su.uDiscGlow.value = lerpN(DA.glow, DB.glow, t);
    lerpC(this.ambient.color, A.ambient, B.ambient, t, tmp);
    const u = PS1.uniforms;
    u.uPs1IndoorSun.value = lerpN(A.indoorSun, B.indoorSun, t);
    u.uPs1IndoorSky.value = lerpN(A.indoorSky, B.indoorSky, t);
    lerpC(u.uPs1IndoorFill.value, A.indoorFill, B.indoorFill, t, tmp);
    u.uPs1IndoorFade.value = TUNING.lighting.indoorFade;
  }

  /** Per frame: keep the sky centred on the camera. */
  update(camera) { this.sky.position.copy(camera.position); }
}
