// The first-person controller. Fixed-timestep movement with render interpolation, mouselook applied every rendered
// frame (no input lag), circle-vs-proxy collision with step-up and wall sliding, crouch (toggle or hold), jog, short
// accel/decel, surface footsteps and a subtle head-bob locked to the footsteps.
import { TUNING } from '../data/tuning.js';
import { settings } from '../data/settings.js';
import { audio } from '../audio/audio.js';

const P = TUNING.player;
const expK = (rate, dt) => 1 - Math.exp(-rate * dt);

export class Player {
  /** camera: THREE.PerspectiveCamera; world: CollisionWorld; input: Input */
  constructor(camera, world, input) {
    this.camera = camera; this.world = world; this.input = input;
    this.pos = { x: 0, z: 0 }; this.prev = { x: 0, z: 0 };
    this.feetY = 0; this.eyeFeet = 0; this.prevEyeFeet = 0;
    this.vel = { x: 0, z: 0 }; this.vy = 0;
    this.yaw = 0; this.pitch = 0;
    this.grounded = true;
    this.crouching = false; this.crouch = 0; this.prevCrouch = 0;
    this.gait = 'walk'; this.speed = 0;
    this.surface = TUNING.surfaces.concrete ? 'concrete' : Object.keys(TUNING.surfaces)[0];
    this.stepDist = 0; this.stepParity = 0;
    // The bob's own phase, 0..2 (one footstep = 1; two = the full sway left and right), weight and gait depth. Per-tick
    // values the camera draws INTERPOLATED (bobPh / bobW / bobA are this frame's: a viewmodel can read them too).
    this.bobPhase = 0; this.prevBobPhase = 0; this.bobWeight = 0; this.prevBobWeight = 0; this.bobGait = P.bob.walk; this.prevBobGait = P.bob.walk;
    this.bobPh = 0; this.bobW = 0; this.bobA = P.bob.walk;
    // View offsets anything may set per tick (rad / m). snapView() keeps last tick's copy so render() can lerp them.
    this.viewDip = 0; this.landDip = 0;
    this._pv = { viewDip: 0, landDip: 0 };
    this.speedMul = 1; // set by other systems (carrying something heavy, a slow surface event)
    this.frozen = false; // look, but don't walk (a cutscene, a hold that roots you)
    this.onStep = null; // (gait, surface) after every footstep: hook noise / AI hearing here
    this._g = { y: 0, surface: '', collider: null };
    // velocity clipping against contact normals (made once: no per-tick closures)
    this._clip = (nx, nz) => { const vn = this.vel.x * nx + this.vel.z * nz; if (vn < 0) { this.vel.x -= nx * vn; this.vel.z -= nz * vn; } };
  }

  /** Put the feet at (x, y, z) facing yaw (rad, 0 = toward −z), with no interpolation from the old spot. */
  teleport(x, y, z, yaw = this.yaw) {
    this.pos.x = this.prev.x = x; this.pos.z = this.prev.z = z;
    this.feetY = this.eyeFeet = this.prevEyeFeet = y;
    this.vel.x = this.vel.z = this.vy = 0;
    this.yaw = yaw;
  }

  get height() { return P.height + (P.crouchHeight - P.height) * this.crouch; }
  get eyeHeight() { return P.eyeHeight + (P.crouchEyeHeight - P.eyeHeight) * this.crouch; }

  /** Mouselook: every rendered frame, not per tick (no input lag). */
  look() {
    const m = this.input.takeMouse();
    const k = P.lookRadPerPx * settings.sensitivity;
    this.yaw -= m.x * k;
    this.pitch -= m.y * k * (settings.invertY ? -1 : 1);
    this.pitch = Math.max(-P.pitchLimit, Math.min(P.pitchLimit, this.pitch));
  }

  /** Call at the start of every fixed tick, before anything sets a view offset (see src/core/loop.js). */
  snapView() { this._pv.viewDip = this.viewDip; this._pv.landDip = this.landDip; }

  tick(dt) {
    const I = this.input;
    this.prev.x = this.pos.x; this.prev.z = this.pos.z; this.prevEyeFeet = this.eyeFeet;
    this.prevCrouch = this.crouch; this.prevBobWeight = this.bobWeight; this.prevBobPhase = this.bobPhase; this.prevBobGait = this.bobGait;

    // ---- crouch (toggle or hold), held down while something low is overhead. C only: Ctrl+W would close the tab
    if (settings.crouchToggle) { if (I.pressed('KeyC')) this.crouching = !this.crouching; }
    else this.crouching = I.down('KeyC');
    let wantCrouch = this.crouching;
    if (!wantCrouch && this.crouch > 0 && this.world.penetration(this.pos.x, this.pos.z, P.radius * 0.95, this.feetY + P.crouchHeight - 0.05, this.feetY + P.height) > 0) wantCrouch = true;
    const cTarget = wantCrouch ? 1 : 0, cStep = dt / P.crouchTime;
    if (cTarget > this.crouch) this.crouch = Math.min(1, this.crouch + cStep);
    else if (cTarget < this.crouch) this.crouch = Math.max(0, this.crouch - cStep);

    // ---- wish direction
    let fwd = 0, side = 0;
    if (!this.frozen) {
      if (I.down('KeyW') || I.down('ArrowUp')) fwd += 1;
      if (I.down('KeyS') || I.down('ArrowDown')) fwd -= 1;
      if (I.down('KeyD') || I.down('ArrowRight')) side += 1;
      if (I.down('KeyA') || I.down('ArrowLeft')) side -= 1;
    }
    const len = Math.hypot(fwd, side);
    if (len > 1) { fwd /= len; side /= len; }

    // ---- gait and speed
    const jogging = (I.down('ShiftLeft') || I.down('ShiftRight')) && this.crouch < 0.5 && fwd > 0;
    this.gait = this.crouch > 0.5 ? 'crouch' : jogging ? 'jog' : 'walk';
    const surf = TUNING.surfaces[this.surface] || {};
    let speed = (this.gait === 'jog' ? P.jogSpeed : this.gait === 'crouch' ? P.crouchSpeed : P.walkSpeed) * (surf.speed ?? 1) * this.speedMul;
    if (fwd < 0) speed *= P.backwardMul;
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    // forward = (−sin, −cos), right = (cos, −sin)
    const tx = (-s * fwd + c * side) * speed, tz = (-c * fwd - s * side) * speed;
    const rate = (len > 0 ? P.accel : P.decel) * (this.grounded ? 1 : P.airControl);
    this.vel.x += (tx - this.vel.x) * expK(rate, dt);
    this.vel.z += (tz - this.vel.z) * expK(rate, dt);
    if (Math.abs(this.vel.x) < 1e-3 && !len) this.vel.x = 0;
    if (Math.abs(this.vel.z) < 1e-3 && !len) this.vel.z = 0;

    // ---- horizontal move with collision (substeps so nothing tunnels)
    const r = P.radius, lowY = this.feetY + P.stepHeight, highY = this.feetY + this.height;
    const dx = this.vel.x * dt, dz = this.vel.z * dt;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.08));
    const startX = this.pos.x, startZ = this.pos.z;
    for (let i = 0; i < steps; i++) {
      this.pos.x += dx / steps; this.pos.z += dz / steps;
      this.world.resolve(this.pos, r, lowY, highY, this._clip, 5, this.feetY);
    }
    // never accept an overlapping position (corner wedges): fall back to where we were
    if (this.world.penetration(this.pos.x, this.pos.z, r, lowY, highY, null, this.feetY) > 0.02) {
      this.pos.x = startX; this.pos.z = startZ; this.vel.x = this.vel.z = 0;
    }

    // ---- vertical: step up / down, gravity, landing
    const g = this.world.ground(this.pos.x, this.pos.z, r * 0.6, this.feetY + P.stepHeight, this._g);
    if (this.grounded && g.y >= this.feetY - P.stepHeight && g.y <= this.feetY + P.stepHeight) {
      this.feetY = g.y; this.vy = 0;
    } else {
      this.grounded = false;
      this.vy -= P.gravity * dt;
      this.feetY += this.vy * dt;
      if (this.feetY <= g.y) {
        const impact = -this.vy;
        this.feetY = g.y; this.vy = 0; this.grounded = true;
        if (impact > 2.5) this._land(impact);
      }
    }
    this.surface = g.surface;
    // the eye follows the feet smoothly on steps, directly when falling
    const diff = this.feetY - this.eyeFeet;
    if (!this.grounded || Math.abs(diff) > 0.6) this.eyeFeet = this.feetY;
    else this.eyeFeet += diff * expK(P.stepSmooth, dt);
    this.landDip *= 1 - expK(9, dt);

    // ---- footsteps + bob phase (driven by distance actually travelled, so walking into a wall makes no steps)
    const moved = Math.hypot(this.pos.x - this.prev.x, this.pos.z - this.prev.z);
    this.speed = moved / dt;
    const stride = P.stride[this.gait];
    const moving = this.grounded && this.speed > 0.25;
    this.bobWeight += ((this.grounded ? Math.min(1, this.speed / (P.walkSpeed * 0.8)) : 0) - this.bobWeight) * expK(8, dt);
    if (moving) {
      this.stepDist += moved;
      if (this.stepDist >= stride) { this.stepDist -= stride; this.stepParity ^= 1; this._footstep(); }
    } else if (this.stepDist > stride * 0.35 && this.speed < 0.05) {
      this.stepDist = 0; this._footstep(0.6); // the foot that settles when you stop
    }
    // The bob's phase advances with distance like the footsteps and is pulled gently onto their phase, so the dip lands
    // on the step. A gait change moves the footsteps' phase at once; the bob follows smoothly. It never jumps.
    const foot = this.stepParity + this.stepDist / stride;
    if (this.grounded) this.bobPhase += moved / stride;
    if (moving) {
      let err = foot - this.bobPhase; err -= 2 * Math.round(err / 2);
      this.bobPhase += err * expK(P.bobLock, dt);
    } else if (this.bobWeight < 0.002) this.bobPhase = foot;
    this.bobPhase -= 2 * Math.floor(this.bobPhase / 2);
    this.bobGait += (P.bob[this.gait] - this.bobGait) * expK(P.bobGaitEase, dt);
  }

  _footstep(scale = 1) {
    const surf = TUNING.surfaces[this.surface] || {};
    const gaitGain = this.gait === 'jog' ? 1.35 : this.gait === 'crouch' ? 0.4 : 0.8;
    audio.play('foot.' + (surf.sound || this.surface), { gain: gaitGain * scale * (surf.gain ?? 1), rate: 0.93 + Math.random() * 0.12, fallback: 'foot.concrete' });
    this.onStep?.(this.gait, this.surface);
  }

  _land(impact) {
    this.landDip = Math.min(P.landDip * 2, P.landDip * impact / 4);
    audio.play('foot.land', { gain: Math.min(1.2, impact / 5) });
  }

  /** Place the camera, interpolated between fixed ticks (alpha 0..1), with head-bob. Every rendered frame. */
  render(alpha) {
    const cam = this.camera;
    const x = this.prev.x + (this.pos.x - this.prev.x) * alpha;
    const z = this.prev.z + (this.pos.z - this.prev.z) * alpha;
    const feet = lerp(this.prevEyeFeet, this.eyeFeet, alpha);
    const crouch = lerp(this.prevCrouch, this.crouch, alpha);
    const eye = P.eyeHeight + (P.crouchEyeHeight - P.eyeHeight) * easeInOut(crouch);
    let dph = this.bobPhase - this.prevBobPhase; dph -= 2 * Math.round(dph / 2); // (across the 2 → 0 wrap)
    this.bobPh = this.prevBobPhase + dph * alpha;
    this.bobW = lerp(this.prevBobWeight, this.bobWeight, alpha);
    this.bobA = lerp(this.prevBobGait, this.bobGait, alpha);
    const V = this._pv;
    const landDip = lerp(V.landDip, this.landDip, alpha), viewDip = lerp(V.viewDip, this.viewDip, alpha);
    let bobY = 0, bobX = 0, roll = 0;
    if (settings.headBob) {
      const amp = this.bobA * this.bobW;
      bobY = -amp * (0.5 + 0.5 * Math.cos(this.bobPh * Math.PI * 2));
      bobX = Math.sin(this.bobPh * Math.PI) * amp * P.bob.sway;
      roll = bobX * P.bob.roll / Math.max(1e-4, P.bob.walk);
    }
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    cam.position.set(x + c * bobX, feet + eye + bobY - landDip, z - s * bobX);
    cam.rotation.set(this.pitch - viewDip, this.yaw, roll, 'YXZ');
    cam.updateMatrixWorld();
  }
}

const easeInOut = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
/** Wrap any angle to −π…π (JS % keeps the sign of negative numbers, so never use it for this). */
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
