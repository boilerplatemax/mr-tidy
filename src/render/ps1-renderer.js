// The PS1 frame. Scene → low-res float buffer → post pass (sRGB, 15-bit quantise, Bayer
// dither, brightness) → canvas at the SAME low resolution → CSS integer upscale with pixelated sampling.
// The canvas itself is tiny (≈320×240), so fill cost is trivial on integrated GPUs.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { settings, onSettingsChange } from '../data/settings.js';
import { PS1 } from './ps1-material.js';

export const LAYER_VIEWMODEL = 1; // first-person items (hands, a held torch): drawn after the world with depth cleared, so they never clip walls

const POST_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`;

const POST_FRAG = /* glsl */`
uniform sampler2D tScene;
uniform float uLevels;  // 2^bits − 1
uniform float uDither;  // amplitude in quantisation steps
uniform float uGamma;   // brightness setting (1 = authored)
uniform float uVignette; // 0–1: the edges darken and grain a little (POST_FX.vignette: a stare, a scare, low health)
uniform float uTime;
varying vec2 vUv;
float bayer2( vec2 a ) { a = floor( a ); return fract( dot( a, vec2( 0.5, a.y * 0.75 ) ) ); }
float bayer4( vec2 a ) { return bayer2( 0.5 * a ) * 0.25 + bayer2( a ); }
vec3 toSRGB( vec3 c ) {
  c = max( c, 0.0 );
  return mix( c * 12.92, 1.055 * pow( c, vec3( 0.41666 ) ) - 0.055, step( 0.0031308, c ) );
}
void main() {
  vec3 c = toSRGB( texture2D( tScene, vUv ).rgb );
  c = pow( clamp( c, 0.0, 1.0 ), vec3( 1.0 / uGamma ) );
  float ps1Edge = 0.0;
  if ( uVignette > 0.001 ) { // a subtle vignette, plus grain and extra dither at the edges
    vec2 q = vUv - 0.5;
    ps1Edge = smoothstep( 0.08, 0.42, dot( q, q ) * 1.6 ) * uVignette;
    float g = fract( sin( dot( floor( gl_FragCoord.xy ) + floor( uTime * 24.0 ) * vec2( 7.13, 3.71 ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ) - 0.5;
    c = c * ( 1.0 - 0.42 * ps1Edge ) + g * 0.05 * ps1Edge;
  }
  if ( uLevels < 254.5 ) {
    float t = bayer4( gl_FragCoord.xy ) - 0.46875; // centred 4×4 threshold
    c = floor( clamp( c + t * ( uDither + 1.6 * ps1Edge ) / uLevels, 0.0, 1.0 ) * uLevels + 0.5 ) / uLevels;
  }
  gl_FragColor = vec4( c, 1.0 );
}`;

/** Live post effects any system may set each frame. vignette: 0 = off, 1 = full. */
export const POST_FX = { vignette: 0 };

export class PS1Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.setPixelRatio(1);
    this.renderer.autoClear = false;
    this.renderer.info.autoReset = false;
    this.renderer.shadowMap.enabled = TUNING.render.shadows;
    this.renderer.shadowMap.type = THREE.BasicShadowMap; // hard-edged, cheap, very PS1-adjacent
    this.renderer.shadowMap.autoUpdate = false; // updated once per frame in render(), not once per pass
    this.width = 320; this.height = 240; this.scale = 1;
    const type = TUNING.render.sceneBuffer === 'half' ? THREE.HalfFloatType : THREE.UnsignedByteType;
    // Linear filtering here is deliberate: at 2× supersample the post pass samples the exact corner of each
    // 2×2 block, so the hardware returns their average (a box filter). At 1× it samples texel centres (exact).
    this.target = new THREE.WebGLRenderTarget(320, 240, { type, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true, generateMipmaps: false });
    this.post = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      vertexShader: POST_VERT, fragmentShader: POST_FRAG, depthTest: false, depthWrite: false,
      uniforms: { tScene: { value: this.target.texture }, uLevels: { value: 31 }, uDither: { value: 1 }, uGamma: { value: 1 }, uVignette: { value: 0 }, uTime: { value: 0 } },
    }));
    this.post.frustumCulled = false;
    this.postScene = new THREE.Scene();
    this.postScene.add(this.post);
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.stats = { calls: 0, triangles: 0 };
    this.shadowsActive = false;
    this.applySettings();
    onSettingsChange(() => { this.applySettings(); this.resize(); });
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  /** Push settings + tuning into the shared shader uniforms. */
  applySettings() {
    const R = TUNING.render, u = PS1.uniforms, p = this.post.material.uniforms;
    u.uPs1Snap.value = settings.jitter ? R.jitterPixels * settings.jitterAmount : 0;
    u.uPs1Warp.value = settings.warp ? Math.min(1, R.warp * settings.warpAmount) : 0;
    u.uPs1MaxLod.value = R.maxMipLevel;
    this.ss = settings.supersample === 2 ? 2 : 1;
    u.uPs1LodBias.value = R.mipBias + Math.log2(this.ss); // sub-samples pick the same texture detail as one game pixel
    p.uLevels.value = Math.pow(2, settings.colorBits) - 1;
    p.uDither.value = settings.dither ? R.dither * settings.ditherAmount : 0;
    p.uGamma.value = settings.brightness;
  }

  /** Integer-scaled internal resolution that fills the screen height (and its width, in 'fill' framing). */
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const physW = Math.round(window.innerWidth * dpr), physH = Math.round(window.innerHeight * dpr);
    const R = TUNING.render;
    const lines = settings.lines || R.targetLines;
    let k = Math.max(1, Math.round(physH / lines));
    while (k > 1 && physH / k < Math.min(R.minLines, lines)) k--;
    const h = Math.floor(physH / k);
    const aspect = settings.framing === 'fill' ? physW / physH : R.aspect;
    const w = Math.min(Math.floor(physW / k), Math.round(h * aspect));
    this.width = w; this.height = h; this.scale = k;
    this.renderer.setSize(w, h, false);
    this.target.setSize(w * this.ss, h * this.ss);
    this.canvas.style.width = `${(w * k) / dpr}px`;
    this.canvas.style.height = `${(h * k) / dpr}px`;
    PS1.uniforms.uPs1Res.value.set(w, h);
    this.onResize?.(w, h);
  }

  get aspect() { return this.width / this.height; }

  render(scene, camera) {
    const r = this.renderer;
    r.info.reset();
    // 1. world
    r.setRenderTarget(this.target); // (the target's own viewport covers the supersampled size)
    r.clear(true, true, false);
    camera.layers.set(0);
    r.shadowMap.needsUpdate = this.shadowsActive; // set true while your one shadow light (a flashlight) is on
    r.render(scene, camera);
    // 2. first-person items, depth cleared so they never poke through walls
    const bg = scene.background;
    scene.background = null;
    r.clearDepth();
    camera.layers.set(LAYER_VIEWMODEL);
    const snap = PS1.uniforms.uPs1Snap.value;
    PS1.uniforms.uPs1Snap.value = 0; // snapping makes held things twitch pixel to pixel as they sway: viewmodels don't snap
    r.render(scene, camera);
    PS1.uniforms.uPs1Snap.value = snap;
    camera.layers.set(0);
    scene.background = bg;
    this.stats.calls = r.info.render.calls;
    this.stats.triangles = r.info.render.triangles;
    // 3. post: quantise + dither into the low-res canvas
    r.setRenderTarget(null);
    const pu = this.post.material.uniforms; pu.uVignette.value = POST_FX.vignette; pu.uTime.value = (performance.now() / 1000) % 1000;
    r.render(this.postScene, this.postCamera);
  }
}
