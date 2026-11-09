// A wave of warm colour over the thing a charged jump will land on, for when the outline itself is out of sight (from
// below a shelf you can't see its top). One box, sized to the target's collider and laid just over it.
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { PS1 } from '../render/ps1-material.js';

const S = TUNING.jump.shimmer;

const VERT = /* glsl */`
uniform vec2 uPs1Res;
uniform float uPs1Snap;
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4( position, 1.0 );
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
  if ( uPs1Snap > 0.0 && gl_Position.w > 0.0 ) { // the same polygon snapping as the world, so it stays on its box
    vec2 grid = uPs1Res * 0.5 / uPs1Snap;
    gl_Position.xy = ( floor( gl_Position.xy / gl_Position.w * grid + 0.5 ) / grid ) * gl_Position.w;
  }
}`;

const FRAG = /* glsl */`
uniform float uTime, uBase, uAmp, uFreq, uSpeed, uFade;
uniform vec3 uColor;
varying vec3 vW;
void main() {
  float w = 0.5 + 0.5 * sin( ( vW.x + vW.z * 0.7 + vW.y * 1.6 ) * uFreq - uTime * uSpeed );
  gl_FragColor = vec4( uColor * ( uBase + uAmp * w ) * uFade, 1.0 );
}`;

export class LandingShimmer {
  constructor(scene) {
    this.uniforms = {
      uPs1Res: PS1.uniforms.uPs1Res, uPs1Snap: PS1.uniforms.uPs1Snap, // shared: follows the look settings
      uTime: { value: 0 }, uBase: { value: S.base }, uAmp: { value: S.amp }, uFreq: { value: S.freq }, uSpeed: { value: S.speed },
      uColor: { value: new THREE.Color(S.color) }, uFade: { value: 0 },
    };
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.mesh.visible = false;
    this.col = null; this.fade = 0;
    scene.add(this.mesh);
  }

  /** Per rendered frame. Shimmers perches you'd land on or catch, never the floor or a bare wall. */
  update(aim, time, dt) {
    const c = aim.ok && (aim.kind === 'land' || aim.kind === 'grab') ? aim.col : null;
    this.mesh.visible = !!c;
    if (c !== this.col) { this.col = c; this.fade = 0; } // a new target fades in rather than snapping on
    if (!c) return;
    this.fade += (1 - this.fade) * (1 - Math.exp(-S.fade * dt));
    this.uniforms.uTime.value = time;
    this.uniforms.uFade.value = this.fade;
    const p = S.pad * 2;
    this.mesh.position.set(c.cx, (c.minY + c.maxY) / 2, c.cz);
    this.mesh.scale.set(c.hx * 2 + p, c.maxY - c.minY + p, c.hz * 2 + p);
  }
}
