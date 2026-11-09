// The cat controller, adapted from the kit's first-person controller. Fixed-timestep movement with render interpolation,
// mouselook every rendered frame, circle-vs-proxy collision with step-up and wall sliding, walk / run / slink, surface
// footsteps and a subtle head-bob locked to the footsteps. Every number is in TUNING.player.
import { TUNING } from '../data/tuning.js';
import { settings } from '../data/settings.js';
import { audio } from '../audio/audio.js';

const P = TUNING.player, J = TUNING.jump, L = TUNING.ledge;
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
    this.slink = 0; this.prevSlink = 0; // 0 = standing, 1 = fully down
    this.gait = 'walk'; this.speed = 0;
    this.surface = Object.keys(TUNING.surfaces)[0];
    this.stepDist = 0; this.stepParity = 0;
    // The bob's own phase, 0..2 (one footstep = 1; two = the full sway left and right), weight and gait depth. Per-tick
    // values the camera draws INTERPOLATED (bobPh / bobW / bobA are this frame's: a viewmodel can read them too).
    this.bobPhase = 0; this.prevBobPhase = 0; this.bobWeight = 0; this.prevBobWeight = 0; this.bobGait = P.bob.walk; this.prevBobGait = P.bob.walk;
    this.bobPh = 0; this.bobW = 0; this.bobA = P.bob.walk;
    // View offsets anything may set per tick (rad / m). snapView() keeps last tick's copy so render() can lerp them.
    this.viewDip = 0; this.landDip = 0; this.chargeDip = 0; this.wiggle = 0;
    this._pv = { viewDip: 0, landDip: 0, chargeDip: 0, wiggle: 0 };
    // the jump
    this.charging = false; this.chargeT = 0; this.coyoteT = 0; this.bufferT = 0; this.time = 0;
    this.launched = false; this.launchSpeed = 0; this.launchX = 0; this.launchZ = 0;
    this.aim = { ok: false, x: 0, y: 0, z: 0 }; // where a jump released now would land (the landing-spot marker reads this)
    this.groundCollider = null; // what the cat is standing on (null: the floor)
    // ledge grab: 'move' | 'hang' | 'mantle'
    this.mode = 'move';
    this.grabLock = 0;
    this.hang = { col: null, nx: 0, nz: 0, top: 0, tx: 0, tz: 0, x: 0, z: 0 };
    this.mantleT = 0; this._mx = 0; this._mz = 0; this._my = 0;
    this._n = { x: 0, z: 0 };
    this.frozen = false; // look, but don't move (a cutscene)
    this.noclip = false; // debug fly (F3)
    this.onStep = null; // (gait, surface) after every audible footstep: the vac's ears hook in here
    this.onLand = null; // (impact m/s, heavy bool) on landing
    this._g = { y: 0, surface: '', collider: null };
    // velocity clipping against contact normals (made once: no per-tick closures)
    this._clip = (nx, nz) => { const vn = this.vel.x * nx + this.vel.z * nz; if (vn < 0) { this.vel.x -= nx * vn; this.vel.z -= nz * vn; } };
  }

  /** Back to plain movement, whatever the cat was doing. */
  resetMotion() { this.mode = 'move'; this.charging = false; this.chargeT = 0; this.bufferT = 0; this.grabLock = 0; this.launched = false; this.viewDip = 0; this.aim.ok = false; }

  /** Put the feet at (x, y, z) facing yaw (rad, 0 = toward −z), with no interpolation from the old spot. */
  teleport(x, y, z, yaw = this.yaw) {
    this.pos.x = this.prev.x = x; this.pos.z = this.prev.z = z;
    this.feetY = this.eyeFeet = this.prevEyeFeet = y;
    this.vel.x = this.vel.z = this.vy = 0;
    this.yaw = yaw; this.grounded = false;
  }

  get height() { return P.height + (P.slinkHeight - P.height) * this.slink; }

  /** Mouselook: every rendered frame, not per tick (no input lag). */
  look() {
    const m = this.input.takeMouse();
    const k = P.lookRadPerPx * settings.sensitivity;
    this.yaw -= m.x * k;
    this.pitch -= m.y * k * (settings.invertY ? -1 : 1);
    this.pitch = Math.max(-P.pitchLimit, Math.min(P.pitchLimit, this.pitch));
  }

  /** Call at the start of every fixed tick, before anything sets a view offset (see src/core/loop.js). */
  snapView() { const V = this._pv; V.viewDip = this.viewDip; V.landDip = this.landDip; V.chargeDip = this.chargeDip; V.wiggle = this.wiggle; }

  tick(dt) {
    this.prev.x = this.pos.x; this.prev.z = this.pos.z; this.prevEyeFeet = this.eyeFeet;
    this.prevSlink = this.slink; this.prevBobWeight = this.bobWeight; this.prevBobPhase = this.bobPhase; this.prevBobGait = this.bobGait;
    if (this.noclip) { this._fly(dt); return; }
    this._wish();
    if (this.grabLock > 0) this.grabLock -= dt;
    if (this.mode === 'hang') this._tickHang(dt);
    else if (this.mode === 'mantle') this._tickMantle(dt);
    else {
      this._slinkUpdate(dt);
      this._jump(dt);
      this._groundAndAir(dt);
      if (!this.grounded) this._tryGrab();
    }
    this._eyeAndSteps(dt);
  }

  /** The keys, as a move direction relative to the view (wfwd, wside) and a world-space unit wish (wx, wz). */
  _wish() {
    const I = this.input;
    let fwd = 0, side = 0;
    if (!this.frozen) {
      if (I.down('KeyW') || I.down('ArrowUp')) fwd += 1;
      if (I.down('KeyS') || I.down('ArrowDown')) fwd -= 1;
      if (I.down('KeyD') || I.down('ArrowRight')) side += 1;
      if (I.down('KeyA') || I.down('ArrowLeft')) side -= 1;
    }
    const len = Math.hypot(fwd, side);
    if (len > 1) { fwd /= len; side /= len; }
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    this.wfwd = fwd; this.wside = side; this.wlen = Math.min(1, len);
    // forward = (−sin, −cos), right = (cos, −sin)
    this.wx = -s * fwd + c * side; this.wz = -c * fwd - s * side;
    this.fx = -s; this.fz = -c; // the view's flat forward
  }

  // Slink: hold C. Slow, low, silent. Held down while something low is overhead. Never Ctrl: Ctrl+W closes the tab.
  _slinkUpdate(dt) {
    let want = this.input.down('KeyC') && !this.frozen;
    if (!want && this.slink > 0 && this.world.penetration(this.pos.x, this.pos.z, P.radius * 0.95, this.feetY + P.slinkHeight - 0.02, this.feetY + P.height) > 0) want = true;
    const step = dt / P.slinkTime;
    this.slink = want ? Math.min(1, this.slink + step) : Math.max(0, this.slink - step);
  }

  get charge() { return this.charging ? Math.min(1, this.chargeT / J.chargeTime) : 0; }

  // Hold Space to charge, release to leap. Coyote time and a press buffer make it forgiving.
  _jump(dt) {
    const I = this.input, space = I.down('Space') && !this.frozen;
    this.time += dt;
    this.coyoteT = this.grounded ? J.coyote : Math.max(0, this.coyoteT - dt);
    this.bufferT = I.pressed('Space') && !this.frozen ? J.buffer : Math.max(0, this.bufferT - dt);
    if (!this.charging && this.bufferT > 0 && this.coyoteT > 0) {
      this.bufferT = 0;
      if (this.grounded) { this.charging = true; this.chargeT = 0; }
      else this._launch(J.coyoteCharge); // a fresh press just after leaving an edge
    }
    if (this.charging) {
      if (this.coyoteT <= 0) this.charging = false; // walked off and held it too long
      else if (!space) this._launch(this.charge);
      else this.chargeT += dt;
    }
    const c = this.charge;
    this.chargeDip += (c * J.dip - this.chargeDip) * expK(16, dt);
    this.viewDip += (c * J.dipPitch - this.viewDip) * expK(16, dt);
    this.wiggle = Math.sin(this.time * J.wiggleRate) * J.wiggle * c;
    if (this.charging) this._predict(c); else this.aim.ok = false;
  }

  /** The way a jump would go right now: x, z and whether it goes anywhere. Writes this._dir. */
  _jumpDir(c) {
    const d = this._dir || (this._dir = { x: 0, z: 0 });
    if (this.wlen > 0) { const l = Math.hypot(this.wx, this.wz) || 1; d.x = this.wx / l; d.z = this.wz / l; }
    else if (c >= J.pounceMin) { d.x = this.fx; d.z = this.fz; }
    else { d.x = 0; d.z = 0; }
    return d;
  }

  _jumpSpeed(c) {
    const moving = Math.min(Math.hypot(this.vel.x, this.vel.z), J.runCarry);
    return Math.max(J.minSpeed + (J.maxSpeed - J.minSpeed) * c, moving);
  }

  _launch(c) {
    const d = this._jumpDir(c), speed = this._jumpSpeed(c);
    this.vy = J.minVy + (J.maxVy - J.minVy) * c;
    this.vel.x = d.x * speed; this.vel.z = d.z * speed;
    this.launched = !this.wlen && !!(d.x || d.z); this.launchSpeed = speed; // launched: a no-keys pounce, which carries on by itself
    this.launchX = d.x; this.launchZ = d.z;
    this.grounded = false; this.coyoteT = 0; this.charging = false; this.chargeT = 0; this.bufferT = 0; this.aim.ok = false;
  }

  /** Fly the arc a release would take, against the real colliders, and note where it lands (this.aim). */
  _predict(c) {
    const a = this.aim, W = this.world, r = P.radius;
    a.ok = false;
    const d = this._jumpDir(c);
    if (!d.x && !d.z) return;
    const speed = this._jumpSpeed(c), step = J.predictDt;
    let x = this.pos.x, z = this.pos.z, y = this.feetY, vy = J.minVy + (J.maxVy - J.minVy) * c;
    for (let t = 0; t < J.predictT; t += step) {
      x += d.x * speed * step; z += d.z * speed * step; vy -= P.gravity * step; y += vy * step;
      if (W.penetration(x, z, r, y + P.stepHeight, y + P.height, null, y) > 0.02) return; // into a face: no clean landing
      const g = W.ground(x, z, r * P.edgeSupport, y + P.stepHeight, this._g);
      if (vy <= 0 && y <= g.y) { // lands here. The bare floor is not a "valid surface": no marker
        if (g.collider) { a.ok = true; a.x = x; a.y = g.y; a.z = z; }
        return;
      }
    }
  }

  _groundAndAir(dt) {
    const I = this.input;
    const running = (I.down('ShiftLeft') || I.down('ShiftRight')) && this.slink < 0.5 && this.wfwd >= 0 && this.wlen > 0;
    this.gait = this.slink > 0.5 ? 'slink' : running ? 'run' : 'walk';
    const surf = TUNING.surfaces[this.surface] || {};
    let speed = (this.gait === 'run' ? P.runSpeed : this.gait === 'slink' ? P.slinkSpeed : P.walkSpeed) * (surf.speed ?? 1);
    if (this.wfwd < 0) speed *= P.backwardMul;
    if (this.charging) speed *= J.moveMul;
    let tx = this.wx * speed, tz = this.wz * speed;
    let rate = this.wlen > 0 ? P.accel : P.decel;
    if (!this.grounded) {
      // In the air the keys steer, but the leap's own speed is the limit: distance comes from the charge.
      const cap = Math.max(J.airSteerMin, this.launchSpeed);
      if (this.wlen > 0) { tx = this.wx * cap; tz = this.wz * cap; rate = P.airAccel; }
      else if (this.launched) { tx = this.launchX * this.launchSpeed; tz = this.launchZ * this.launchSpeed; rate = P.airAccel; } // a pounce carries on by itself, even after brushing a face
      else rate = P.airDecel;
    }
    this.vel.x += (tx - this.vel.x) * expK(rate, dt);
    this.vel.z += (tz - this.vel.z) * expK(rate, dt);
    if (Math.abs(this.vel.x) < 1e-3 && !this.wlen) this.vel.x = 0;
    if (Math.abs(this.vel.z) < 1e-3 && !this.wlen) this.vel.z = 0;

    // ---- vertical first when rising: a shelf overhead stops the head (the kit had no ceiling check; without one a jump
    // under a shelf would shove the cat sideways out of it)
    if (!this.grounded && this.vy > 0) {
      const top = this.feetY + this.height;
      const ceil = this.world.ceiling(this.pos.x, this.pos.z, P.radius * 0.8, top - 0.02);
      if (top + this.vy * dt > ceil) { this.feetY = Math.max(this.feetY, ceil - this.height - 1e-3); this.vy = 0; }
    }

    this._moveXZ(dt);

    // ---- vertical: step up / down, gravity, landing
    const g = this.world.ground(this.pos.x, this.pos.z, P.radius * P.edgeSupport, this.feetY + P.stepHeight, this._g);
    if (this.grounded && g.y >= this.feetY - P.stepHeight && g.y <= this.feetY + P.stepHeight) {
      this.feetY = g.y; this.vy = 0;
    } else {
      if (this.grounded) { this.launched = false; this.launchSpeed = Math.hypot(this.vel.x, this.vel.z); this.grabLock = L.dropLock; } // walked off an edge
      this.grounded = false;
      this.vy -= P.gravity * dt;
      this.feetY += this.vy * dt;
      if (this.feetY <= g.y && this.vy <= 0) {
        const impact = -this.vy;
        this.feetY = g.y; this.vy = 0; this.grounded = true; this.launched = false;
        this._land(impact);
      }
    }
    this.surface = g.surface;
    this.groundCollider = this.grounded ? g.collider : null;
  }

  // ---- ledge grab: a jump that comes up short catches the edge by itself
  _tryGrab() {
    if (this.vy > L.maxVy || this.grabLock > 0 || this.frozen) return;
    const W = this.world, r = P.radius, n = this._n, x = this.pos.x, z = this.pos.z, feet = this.feetY;
    for (const b of W.boxes) {
      if (!b.land || !b.enabled) continue;
      const rel = b.maxY - feet;
      if (rel < L.minAbove || rel > L.paw + L.reach) continue;
      if (Math.abs(x - b.cx) > b.reach + r + L.gap || Math.abs(z - b.cz) > b.reach + r + L.gap) continue;
      const d = W._boxDist(b, x, z, n);
      if (d < r - 0.03 || d > r + L.gap) continue; // (closer than r means it's overhead, not in front)
      const view = -(this.fx * n.x + this.fz * n.z), keys = this.wlen > 0 ? -(this.wx * n.x + this.wz * n.z) : -1;
      if (view < L.facing && keys < 0.5) continue;
      if (this._grabSpot(b, n, x - n.x * d, z - n.z * d)) return;
    }
  }

  /** Is there somewhere to pull up to past this edge? If so, start hanging. (ex, ez): the point on the edge. */
  _grabSpot(b, n, ex, ez) {
    const W = this.world, r = P.radius, top = b.maxY;
    for (const inward of L.inward) {
      const tx = ex - n.x * inward, tz = ez - n.z * inward;
      if (W._boxDist(b, tx, tz, null) >= 0) continue; // past the far side of a narrow perch
      if (W.penetration(tx, tz, r * 0.9, top + P.stepHeight, top + P.height, null, top) > 0) continue; // no room up there
      const h = this.hang;
      h.col = b; h.nx = n.x; h.nz = n.z; h.top = top; h.tx = tx; h.tz = tz;
      h.x = ex + n.x * (r + 0.005); h.z = ez + n.z * (r + 0.005);
      this.mode = 'hang'; this.vy = 0; this.vel.x = this.vel.z = 0; this.grounded = false; this.launched = false;
      this.charging = false; this.chargeDip = 0; this.wiggle = 0; this.aim.ok = false; this.bufferT = 0;
      audio.play('cat.grab');
      return true;
    }
    return false;
  }

  _tickHang(dt) {
    const I = this.input, h = this.hang, k = expK(L.settle, dt);
    this.pos.x += (h.x - this.pos.x) * k; this.pos.z += (h.z - this.pos.z) * k;
    this.feetY += (h.top - L.hangDrop - this.feetY) * k;
    this.viewDip += (L.hangDip - this.viewDip) * expK(14, dt);
    if (I.pressed('Space') && !this.frozen) { this._startMantle(); return; }
    if (I.down('KeyS') || I.down('ArrowDown') || I.down('KeyC')) this._letGo();
  }

  _letGo() { this.mode = 'move'; this.grabLock = L.letGoLock; this.vy = 0; this.launched = false; this.launchSpeed = 0; }

  _startMantle() {
    this.mode = 'mantle'; this.mantleT = 0;
    this._mx = this.pos.x; this._mz = this.pos.z; this._my = this.feetY;
  }

  _tickMantle(dt) {
    const h = this.hang;
    this.mantleT = Math.min(1, this.mantleT + dt / L.mantleTime);
    const t = this.mantleT;
    // up first, then forward over the lip
    const up = easeInOut(Math.min(1, t / 0.62)), fwd = easeInOut(Math.max(0, (t - 0.32) / 0.68));
    this.feetY = lerp(this._my, h.top, up);
    this.pos.x = lerp(this._mx, h.tx, fwd); this.pos.z = lerp(this._mz, h.tz, fwd);
    this.viewDip += (0 - this.viewDip) * expK(10, dt);
    if (t >= 1) {
      this.mode = 'move'; this.feetY = h.top; this.vy = 0; this.grounded = true; this.grabLock = L.letGoLock;
      this.groundCollider = h.col; this.surface = h.col.surface;
      audio.play('foot.land', { gain: 0.5 });
    }
  }

  /** Horizontal move with collision (substeps so nothing tunnels). */
  _moveXZ(dt) {
    const r = P.radius, lowY = this.feetY + P.stepHeight, highY = this.feetY + this.height;
    const dx = this.vel.x * dt, dz = this.vel.z * dt;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.04));
    const startX = this.pos.x, startZ = this.pos.z;
    for (let i = 0; i < steps; i++) {
      this.pos.x += dx / steps; this.pos.z += dz / steps;
      this.world.resolve(this.pos, r, lowY, highY, this._clip, 5, this.feetY);
    }
    // never accept an overlapping position (corner wedges): fall back to where we were
    if (this.world.penetration(this.pos.x, this.pos.z, r, lowY, highY, null, this.feetY) > 0.02) {
      this.pos.x = startX; this.pos.z = startZ; this.vel.x = this.vel.z = 0;
    }
  }

  _eyeAndSteps(dt) {
    // the eye follows the feet smoothly on steps, directly when falling
    const diff = this.feetY - this.eyeFeet;
    if (!this.grounded || Math.abs(diff) > 0.3) this.eyeFeet = this.feetY;
    else this.eyeFeet += diff * expK(P.stepSmooth, dt);
    this.landDip *= 1 - expK(9, dt);

    // ---- footsteps + bob phase (driven by distance actually travelled, so walking into a wall makes no steps)
    const moved = Math.hypot(this.pos.x - this.prev.x, this.pos.z - this.prev.z);
    this.speed = moved / dt;
    const stride = P.stride[this.gait];
    const moving = this.grounded && this.speed > 0.15;
    this.bobWeight += ((this.grounded ? Math.min(1, this.speed / (P.walkSpeed * 0.8)) : 0) - this.bobWeight) * expK(8, dt);
    if (moving) {
      this.stepDist += moved;
      if (this.stepDist >= stride) { this.stepDist -= stride; this.stepParity ^= 1; this._footstep(); }
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

  _footstep() {
    if (this.gait === 'slink') return; // slink is silent: no sound, nothing for the vac to hear
    const surf = TUNING.surfaces[this.surface] || {};
    audio.play('foot.' + (surf.sound || this.surface), { gain: (this.gait === 'run' ? P.stepGain.run : P.stepGain.walk) * (surf.gain ?? 1), rate: 0.93 + Math.random() * 0.14, fallback: 'foot.wood' });
    this.onStep?.(this.gait, this.surface);
  }

  _land(impact) {
    if (impact < P.landSoft) return;
    const heavy = impact >= P.landHeavy;
    this.landDip = Math.min(P.landDip * 2, P.landDip * impact / 4);
    audio.play(heavy ? 'foot.thud' : 'foot.land', { gain: Math.min(1.2, impact / 6) });
    this.onLand?.(impact, heavy);
  }

  _fly(dt) { // debug noclip: WASD along the view, Space up, C down, Shift fast
    const I = this.input, N = TUNING.debug.noclipSpeed, sp = (I.down('ShiftLeft') ? N * 3 : N) * dt;
    this._wish();
    const cp = Math.cos(this.pitch), sy = Math.sin(this.pitch);
    this.pos.x += (this.fx * this.wfwd * cp + (this.wx - this.fx * this.wfwd)) * sp;
    this.pos.z += (this.fz * this.wfwd * cp + (this.wz - this.fz * this.wfwd)) * sp;
    this.feetY += (this.wfwd * sy + (I.down('Space') ? 1 : 0) - (I.down('KeyC') ? 1 : 0)) * sp;
    this.eyeFeet = this.feetY; this.vy = 0; this.vel.x = this.vel.z = 0; this.grounded = false;
  }

  /** Place the camera, interpolated between fixed ticks (alpha 0..1), with head-bob. Every rendered frame. */
  render(alpha) {
    const cam = this.camera;
    const x = this.prev.x + (this.pos.x - this.prev.x) * alpha;
    const z = this.prev.z + (this.pos.z - this.prev.z) * alpha;
    const feet = lerp(this.prevEyeFeet, this.eyeFeet, alpha);
    const slink = lerp(this.prevSlink, this.slink, alpha);
    const eye = P.eyeHeight + (P.slinkEyeHeight - P.eyeHeight) * easeInOut(slink);
    let dph = this.bobPhase - this.prevBobPhase; dph -= 2 * Math.round(dph / 2); // (across the 2 → 0 wrap)
    this.bobPh = this.prevBobPhase + dph * alpha;
    this.bobW = lerp(this.prevBobWeight, this.bobWeight, alpha);
    this.bobA = lerp(this.prevBobGait, this.bobGait, alpha);
    const V = this._pv;
    const landDip = lerp(V.landDip, this.landDip, alpha) + lerp(V.chargeDip, this.chargeDip, alpha), viewDip = lerp(V.viewDip, this.viewDip, alpha);
    let bobY = 0, bobX = 0, roll = 0;
    if (settings.headBob) {
      const amp = this.bobA * this.bobW;
      bobY = -amp * (0.5 + 0.5 * Math.cos(this.bobPh * Math.PI * 2));
      bobX = Math.sin(this.bobPh * Math.PI) * amp * P.bob.sway;
      roll = bobX * P.bob.roll / Math.max(1e-4, P.bob.walk);
    }
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    cam.position.set(x + c * bobX, feet + eye + bobY - landDip, z - s * bobX);
    cam.rotation.set(this.pitch - viewDip, this.yaw, roll + lerp(V.wiggle, this.wiggle, alpha), 'YXZ');
    cam.updateMatrixWorld();
  }
}

const easeInOut = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
/** Wrap any angle to −π…π (JS % keeps the sign of negative numbers, so never use it for this). */
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
