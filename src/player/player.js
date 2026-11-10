// The cat controller, adapted from the kit's first-person controller. Fixed-timestep movement with render interpolation,
// mouselook every rendered frame, circle-vs-proxy collision with step-up and wall sliding, walk / run / slink, surface
// footsteps and a subtle head-bob locked to the footsteps. Every number is in TUNING.player.
import { TUNING } from '../data/tuning.js';
import { settings } from '../data/settings.js';
import { audio } from '../audio/audio.js';

const DUST = TUNING.dust;
const P = TUNING.player, J = TUNING.jump, L = TUNING.ledge, C = TUNING.climb, ST = TUNING.stamina, SW = TUNING.swipe, D = TUNING.dash;
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
    this.viewDip = 0; this.landDip = 0; this.chargeDip = 0;
    this._pv = { viewDip: 0, landDip: 0, chargeDip: 0 };
    // the jump
    this.charging = false; this.chargeT = 0; this.heldT = 0; this.chargeCarry = 0; this.coyoteT = 0; this.bufferT = 0; this.time = 0;
    this.launched = false; this.launchSpeed = 0; this.launchX = 0; this.launchZ = 0;
    this.stick = null; this.assist = false;
    this.aim = { stuck: false, ok: false, kind: 'land', x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, col: null }; // where a jump released now would end (the target marker and shimmer read this)
    this._o = { x: 0, y: 0, z: 0 }; this._rd = { x: 0, y: 0, z: 0 }; this._solid = (c) => c.solid;
    this.groundCollider = null; // what the cat is standing on (null: the floor)
    this.dashT = 0; this.dashCd = 0; this.dashX = 0; this.dashZ = 0; this.airDashUsed = false; this.fovKick = 0; this.prevFovKick = 0;
    this.cornerT = 0; this.dust = 0; this.tumbleT = 0; this.hitAge = 99; this.hitSide = 1; this.sneezeT = 0; this.onSneeze = null; // dusted: bowled over, then slow, with a sneeze on the way
    this.pullX = 0; this.pullZ = 0; // m/s of suction dragging the cat along the ground, set by the vac each tick
    this.wedgedT = 0;
    this.swipeT = -1; this.prevSwipeT = -1; this.swipeCd = 0; this.swipeHit = false;
    this.onSwipe = null; // () when the paw connects: the knockables hook in here
    this.stamina = 1; this.clawLock = 0;
    this.climb = { col: null, x: 0, z: 0 };
    // 'move' | 'hang' | 'mantle' | 'climb' | 'slide'
    this.mode = 'move';
    this.grabLock = 0;
    this.hang = { col: null, nx: 0, nz: 0, top: 0, tx: 0, tz: 0, x: 0, z: 0 };
    this.shimmyDist = 0; this.prevShimmyDist = 0; this.climbDist = 0; this.prevClimbDist = 0; this._ts = { x: 0, z: 0 }; this._nh = { x: 0, z: 0 };
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
  /** Hit by a dust blast: bowled over along the line of the shot (off whatever it was on or holding), then dazed. */
  dustHit(dx = 0, dz = 0) {
    this.dust = DUST.time; this.sneezeT = DUST.sneezeDelay;
    if (this.mode === 'hang') this._letGo();
    else if (this.mode === 'climb' || this.mode === 'slide') this._offWall();
    if (this.mode === 'mantle') this.mode = 'move';
    const l = Math.hypot(dx, dz);
    if (l < 1e-4) { dx = -this.fx; dz = -this.fz; } else { dx /= l; dz /= l; }
    this.tumbleT = DUST.tumble; this.hitAge = 0; this.hitSide = Math.random() < 0.5 ? -1 : 1;
    this.charging = false; this.chargeT = 0; this.dashT = 0; this.swipeT = -1;
    const high = this.feetY >= DUST.highAt, knock = high ? DUST.highKnock : DUST.knock; // up on something: it sends you skidding off it
    this.vel.x = dx * knock; this.vel.z = dz * knock; this.vy = high ? DUST.highUp : DUST.knockUp; this.grounded = false;
    this.launched = true; this.launchX = dx; this.launchZ = dz; this.launchSpeed = knock; this.tumbleSlide = high;
  }

  /** The outlet in the blackout: a shock that throws the cat back off it (a tumble, but no dust, no sneeze). */
  shock(dx = 0, dz = 0) {
    const l = Math.hypot(dx, dz); if (l < 1e-4) { dx = -this.fx; dz = -this.fz; } else { dx /= l; dz /= l; }
    if (this.mode === 'hang') this._letGo(); else if (this.mode === 'climb' || this.mode === 'slide') this._offWall();
    if (this.mode === 'mantle') this.mode = 'move';
    this.tumbleT = DUST.tumble * 0.8; this.hitAge = 0; this.hitSide = Math.random() < 0.5 ? -1 : 1; this.tumbleSlide = false;
    this.charging = false; this.chargeT = 0; this.dashT = 0; this.swipeT = -1;
    this.vel.x = dx * DUST.shockKnock; this.vel.z = dz * DUST.shockKnock; this.vy = DUST.shockUp; this.grounded = false;
    this.launched = true; this.launchX = dx; this.launchZ = dz; this.launchSpeed = DUST.shockKnock;
    this.landDip = 0.05;
  }

  resetMotion() { this.tumbleT = 0; this.hitAge = 99; this.pullX = this.pullZ = 0; this.dust = 0; this.sneezeT = 0; this.mode = 'move'; this.stamina = 1; this.clawLock = 0; this.dashT = 0; this.dashCd = 0; this.airDashUsed = false; this.swipeT = -1; this.charging = false; this.chargeT = 0; this.bufferT = 0; this.grabLock = 0; this.launched = false; this.viewDip = 0; this.aim.ok = false; }

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
    const k = P.lookRadPerPx * settings.sensitivity, py = this.yaw, pp = this.pitch;
    this.yaw -= m.x * k;
    this.pitch -= m.y * k * (settings.invertY ? -1 : 1);
    this.pitch = Math.max(-P.pitchLimit, Math.min(P.pitchLimit, this.pitch));
    if (this.mode === 'hang' || this.mode === 'mantle') { // clinging on: the mouse can't push the head past the limits
      const c = this._hangYaw();
      if (Math.abs(wrapAngle(this.yaw - c)) > L.yawLimit && Math.abs(wrapAngle(this.yaw - c)) > Math.abs(wrapAngle(py - c))) this.yaw = py;
      if ((this.pitch > L.pitchMax && this.pitch > pp) || (this.pitch < L.pitchMin && this.pitch < pp)) this.pitch = pp;
    }
  }

  /** The yaw that faces the ledge being held. */
  _hangYaw() { return Math.atan2(this.hang.nx, this.hang.nz); }

  /** Call at the start of every fixed tick, before anything sets a view offset (see src/core/loop.js). */
  snapView() { const V = this._pv; V.viewDip = this.viewDip; V.landDip = this.landDip; V.chargeDip = this.chargeDip; }

  tick(dt) {
    this.prev.x = this.pos.x; this.prev.z = this.pos.z; this.prevEyeFeet = this.eyeFeet;
    this.prevSwipeT = this.swipeT; this.prevFovKick = this.fovKick; this.prevShimmyDist = this.shimmyDist; this.prevClimbDist = this.climbDist;
    this.prevSlink = this.slink; this.prevBobWeight = this.bobWeight; this.prevBobPhase = this.bobPhase; this.prevBobGait = this.bobGait;
    if (this.noclip) { this._fly(dt); return; }
    if (this.dust > 0) this.dust = Math.max(0, this.dust - dt);
    this.hitAge += dt;
    const held = this.frozen, tumbling = this.tumbleT > 0;
    if (tumbling) { this.tumbleT -= dt; this.frozen = true; } // bowled over: no control until it's over
    if (this.sneezeT > 0) {
      this.sneezeT -= dt;
      if (this.sneezeT <= 0) { this.landDip = DUST.sneezeDip; audio.play('cat.sneeze', { rate: 0.95 + Math.random() * 0.15 }); this.onSneeze?.(); }
    }
    this._wish();
    if (this.grabLock > 0) this.grabLock -= dt;
    if (this.clawLock > 0) this.clawLock -= dt;
    if (this.mode === 'hang') this._tickHang(dt);
    else if (this.mode === 'mantle') this._tickMantle(dt);
    else if (this.mode === 'climb') this._tickClimb(dt);
    else if (this.mode === 'slide') this._tickSlide(dt);
    else {
      this._slinkUpdate(dt);
      this._jump(dt);
      this._dash(dt);
      this._groundAndAir(dt);
      if (this.mode === 'move' && (this.wfwd > 0 || !this.grounded) && this.clawLock <= 0) this._tryClimb();
      if (this.mode === 'move' && !this.grounded) this._tryGrab();
      if (this.mode === 'move' && this.grounded) this.stamina = Math.min(1, this.stamina + ST.regen * dt);
    }
    this._swipe(dt);
    if (tumbling) this.frozen = held; // (only undo our own: something during this tick, like the TV remote, may have frozen the cat itself)
    this.fovKick += ((this.dashT > 0 ? 1 : 0) - this.fovKick) * expK(D.fovEase, dt);
    this._eyeAndSteps(dt);
  }

  // Left click: the paw swipes across the view and bats whatever is in front of it.
  _swipe(dt) {
    if (this.swipeCd > 0) this.swipeCd -= dt;
    if (this.swipeT >= 0) {
      this.swipeT += dt;
      if (!this.swipeHit && this.swipeT >= SW.impactAt) { this.swipeHit = true; this.onSwipe?.(); }
      if (this.swipeT >= SW.time) this.swipeT = -1;
    } else if (this.input.pressed('Mouse0') && this.swipeCd <= 0 && this.mode === 'move' && !this.frozen) {
      this.swipeT = 0; this.swipeHit = false; this.swipeCd = SW.cooldown;
      audio.play('paw.swipe', { rate: 0.95 + Math.random() * 0.15 });
    }
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
      if (this.grounded) { this.charging = true; this.chargeT = 0; this.stick = null; this.chargeCarry = Math.min(Math.hypot(this.vel.x, this.vel.z), J.runCarry); }
      else this._launch(J.coyoteCharge); // a fresh press just after leaving an edge
    }
    if (this.charging) {
      if (this.coyoteT <= 0) this.charging = false; // walked off and held it too long
      else if (!space) this._launch(this.charge);
      else {
        this.chargeT += dt;
        if (this._chargeExpired(dt)) { this.charging = false; this.chargeT = 0; audio.play('cat.huff'); }
      }
    }
    const c = this.charge;
    this.chargeDip += (c * J.dip - this.chargeDip) * expK(16, dt);
    this.viewDip += (c * J.dipPitch - this.viewDip) * expK(16, dt);
    if (this.charging) { this._predict(c); this._stickTarget(c); } else this.aim.ok = false;
  }

  // Shift in the air: a burst along the keys (or the view), once only until the cat touches something. Horizontal, with
  // gravity off for its short length. On the ground Shift is just run.
  _dash(dt) {
    const I = this.input;
    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.grounded) { this.airDashUsed = false; return; }
    const wanted = (I.pressed('ShiftLeft') || I.pressed('ShiftRight')) && !this.frozen && !this.charging && this.slink < 0.5;
    if (!wanted || this.dashCd > 0 || this.airDashUsed) return;
    let dx = this.wx, dz = this.wz;
    if (this.wlen <= 0) { dx = this.fx; dz = this.fz; }
    const l = Math.hypot(dx, dz) || 1;
    this.dashX = dx / l; this.dashZ = dz / l; this.dashT = D.time; this.dashCd = D.cooldown;
    this.airDashUsed = true;
    this.launched = false;
    audio.play('cat.dash', { rate: 0.95 + Math.random() * 0.15 });
  }

  /** A full charge held with nothing else going on is called off. Walking or steering keeps it alive indefinitely. */
  _chargeExpired(dt) {
    if (this.wlen > 0 || this.chargeT < J.chargeTime) { this.heldT = 0; return false; }
    this.heldT += dt;
    return this.heldT >= J.holdAtMax;
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
    // fixed when the charge starts: the cat slows while charging, and the predicted landing must not creep back with it
    const moving = this.charging ? this.chargeCarry : Math.min(Math.hypot(this.vel.x, this.vel.z), J.runCarry);
    return Math.max(J.minSpeed + (J.maxSpeed - J.minSpeed) * c, moving);
  }

  _launch(c) {
    const d = this._jumpDir(c);
    let speed = this._jumpSpeed(c);
    this.vy = J.minVy + (J.maxVy - J.minVy) * c;
    const a = this.aim;
    this.assist = this.charging && a.ok && a.stuck;
    if (this.assist) { // land on the target it was showing: aim straight at it, at exactly the speed that gets there
      const dx = a.x - this.pos.x, dz = a.z - this.pos.z, l = Math.hypot(dx, dz) || 1;
      const t = (this.vy + Math.sqrt(Math.max(0, this.vy * this.vy + 2 * P.gravity * (this.feetY - a.y)))) / P.gravity;
      d.x = dx / l; d.z = dz / l; speed = l / t;
    }
    this.vel.x = d.x * speed; this.vel.z = d.z * speed;
    this.launched = (this.assist || !this.wlen) && !!(d.x || d.z); this.launchSpeed = speed; // launched: carries on by itself
    this.launchX = d.x; this.launchZ = d.z;
    this.grounded = false; this.coyoteT = 0; this.charging = false; this.chargeT = 0; this.bufferT = 0; this.aim.ok = false;
  }

  /** Fly the arc a release would take, against the real colliders, and note where it ends (this.aim). */
  _predict(c, spring = false) {
    const a = this.aim, W = this.world, r = P.radius;
    a.ok = false;
    const d = spring ? this._kickDir() : this._jumpDir(c);
    if (!d.x && !d.z) { // straight up: it comes down where it left. Not a target to light up, but the ring doesn't blink off and on
      a.ok = true; a.kind = 'land'; a.x = this.pos.x; a.y = this.feetY; a.z = this.pos.z; a.nx = 0; a.ny = 1; a.nz = 0; a.col = null;
      return;
    }
    const speed = spring ? lerp(C.kickSpeed, C.springSpeed, c) : this._jumpSpeed(c), step = J.predictDt;
    let x = this.pos.x, z = this.pos.z, y = this.feetY, vy = spring ? lerp(C.kickVy, C.springVy, c) : J.minVy + (J.maxVy - J.minVy) * c;
    for (let t = 0; t < J.predictT; t += step) {
      const px = x, py = y, pz = z;
      x += d.x * speed * step; z += d.z * speed * step; vy -= P.gravity * step; y += vy * step;
      if (vy > 0) { const ceil = W.ceiling(x, z, r * 0.8, y + P.height - 0.02); if (y + P.height > ceil) { y = ceil - P.height; vy = 0; } } // a bonked head
      if (W.penetration(x, z, r, y + P.stepHeight, y + P.height, null, y) > 0.02) { this._predictFace(px, py, pz, d); return; }
      const g = W.ground(x, z, r * P.edgeSupport, y + P.stepHeight, this._g);
      if (vy <= 0 && y <= g.y) { const f = Math.max(0, Math.min(1, (py - g.y) / Math.max(1e-5, py - y))); a.ok = true; a.kind = 'land'; a.x = px + (x - px) * f; a.y = g.y; a.z = pz + (z - pz) * f; a.nx = 0; a.ny = 1; a.nz = 0; a.col = g.collider; return; }
    }
  }

  /**
   * Keeps the target on a perch once it's found one, rather than letting it sweep straight off the far side as the charge
   * builds. The jump is then steered to land where the target says (see _launch), so the target is always the truth.
   */
  _stickTarget(c) {
    const a = this.aim;
    a.stuck = false;
    if (!a.ok) { this.stick = null; return; }
    const raw = a.kind === 'land' && a.col && a.col !== this.groundCollider ? a.col : null;
    if (raw && raw !== this.stick) this.stick = raw;
    const b = this.stick;
    if (!b || raw === b) return;
    const ix = Math.min(J.stickInset, b.hx - 0.02), iz = Math.min(J.stickInset, b.hz - 0.02);
    const cx = Math.max(b.cx - b.hx + ix, Math.min(b.cx + b.hx - ix, a.x)), cz = Math.max(b.cz - b.hz + iz, Math.min(b.cz + b.hz - iz, a.z));
    const vy = J.minVy + (J.maxVy - J.minVy) * c, reach = this.feetY + (vy * vy) / (2 * P.gravity);
    if (Math.hypot(a.x - cx, a.z - cz) > J.stickDist || reach < b.maxY + 0.02) { this.stick = null; return; }
    a.x = cx; a.y = b.maxY; a.z = cz; a.nx = 0; a.ny = 1; a.nz = 0; a.kind = 'land'; a.col = b; a.stuck = true;
  }

  /** The arc runs into something upright: put the target on that face. If it's a ledge the cat would catch, say so. */
  _predictFace(px, py, pz, d) {
    const a = this.aim, W = this.world, o = this._o, rd = this._rd;
    rd.x = d.x; rd.y = 0; rd.z = d.z;
    for (const h of [0.5, 0.2, 0.85]) { // the middle of the body, then low, then high
      o.x = px; o.y = py + P.height * h; o.z = pz;
      const hit = W.raycast(o, rd, 0.6, this._solid, false);
      if (!hit || !hit.collider) continue;
      const b = hit.collider, rel = b.maxY - py;
      a.ok = true; a.nx = hit.nx; a.ny = hit.ny; a.nz = hit.nz; a.col = b;
      a.x = o.x + rd.x * hit.t; a.y = o.y; a.z = o.z + rd.z * hit.t;
      if (b.land && rel >= L.minAbove && rel <= L.paw + L.reach) { a.kind = 'grab'; a.y = b.maxY - J.dotBelowLip; } // right under the lip
      else if (b.stripes?.includes(Math.abs(hit.nx) > Math.abs(hit.nz) ? (hit.nx > 0 ? 'e' : 'w') : (hit.nz > 0 ? 's' : 'n'))) a.kind = 'grab'; // you'd cling to it
      else a.kind = 'wall';
      return;
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
    if (this.dust > 0) { // dazed: slow, and it can't quite walk straight
      speed *= DUST.speedMul;
      const w = Math.sin(this.time * DUST.weaveRate) * DUST.weave * Math.min(1, this.dust), c = Math.cos(w), s = Math.sin(w), wx = this.wx;
      this.wx = wx * c - this.wz * s; this.wz = wx * s + this.wz * c;
    }
    const dashing = this.dashT > 0;
    if (dashing) { // the dash owns the cat's speed until it ends
      this.dashT -= dt;
      this.vel.x = this.dashX * D.speed; this.vel.z = this.dashZ * D.speed;
      if (this.dashT <= 0 && !this.grounded) { this.vel.x = this.dashX * D.exitSpeed; this.vel.z = this.dashZ * D.exitSpeed; this.launchSpeed = D.exitSpeed; }
    }
    let tx = this.wx * speed, tz = this.wz * speed;
    let rate = this.wlen > 0 ? P.accel : P.decel;
    if (this.tumbleT > 0 && this.tumbleSlide && this.grounded && this.groundCollider) { tx = this.vel.x; tz = this.vel.z; rate = 0; this.vel.x *= Math.exp(-DUST.slideDrag * dt); this.vel.z *= Math.exp(-DUST.slideDrag * dt); } // (bowled over up there: it skids, it doesn't stop)
    if (this.tumbleT <= 0) this.tumbleSlide = false;
    if (this.grounded) { tx += this.pullX; tz += this.pullZ; }
    this.pullX = this.pullZ = 0;
    if (!this.grounded) {
      // In the air the keys steer, but the leap's own speed is the limit: distance comes from the charge.
      const cap = Math.max(J.airSteerMin, this.launchSpeed);
      const onRails = this.assist && this.launched && this.wfwd >= 0 && !this.wside; // holding W doesn't knock a jump off its target
      if (this.wlen > 0 && !onRails) { tx = this.wx * cap; tz = this.wz * cap; rate = P.airAccel; }
      else if (this.launched) { tx = this.launchX * this.launchSpeed; tz = this.launchZ * this.launchSpeed; rate = P.airAccel; } // a pounce carries on by itself, even after brushing a face
      else rate = P.airDecel;
    }
    if (!dashing) {
      this.vel.x += (tx - this.vel.x) * expK(rate, dt);
      this.vel.z += (tz - this.vel.z) * expK(rate, dt);
    }
    if (Math.abs(this.vel.x) < 1e-3 && !this.wlen) this.vel.x = 0;
    if (Math.abs(this.vel.z) < 1e-3 && !this.wlen) this.vel.z = 0;

    // ---- vertical first when rising: a shelf overhead stops the head (the kit had no ceiling check; without one a jump
    // under a shelf would shove the cat sideways out of it)
    if (!this.grounded && this.vy > 0) {
      const top = this.feetY + this.height;
      const ceil = this.world.ceiling(this.pos.x, this.pos.z, P.radius * 0.8, top - 0.02);
      if (top + this.vy * dt > ceil) { this.feetY = Math.max(this.feetY, ceil - this.height - 1e-3); this.vy = 0; }
    }

    const startX = this.pos.x, startZ = this.pos.z;
    this._moveXZ(dt);
    if (this.charging && this.grounded) this._keepOnEdge(startX, startZ);

    // ---- vertical: step up / down, gravity, landing
    const g = this.world.ground(this.pos.x, this.pos.z, P.radius * P.edgeSupport, this.feetY + P.stepHeight, this._g);
    if (this.grounded && g.y >= this.feetY - P.stepHeight && g.y <= this.feetY + P.stepHeight) {
      this.feetY = g.y; this.vy = 0;
    } else {
      if (this.grounded) { this.launched = false; this.launchSpeed = Math.hypot(this.vel.x, this.vel.z); this.grabLock = L.dropLock; } // walked off an edge
      this.grounded = false;
      if (dashing) this.vy = 0; else this.vy -= P.gravity * dt;
      this.feetY += this.vy * dt;
      if (this.feetY <= g.y && this.vy <= 0) {
        const impact = -this.vy;
        this.feetY = g.y; this.vy = 0; this.grounded = true; this.launched = false; this.airDashUsed = false;
        if (this.assist) { this.vel.x = this.vel.z = 0; this.assist = false; } // landed on the target: stays on it
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
    if (!this._topSpot(b, n, ex, ez)) return false;
    const r = P.radius, h = this.hang;
    h.col = b; h.nx = n.x; h.nz = n.z; h.top = b.maxY; h.tx = this._ts.x; h.tz = this._ts.z; h.ex = ex; h.ez = ez;
    h.x = ex + n.x * (r + 0.005); h.z = ez + n.z * (r + 0.005);
    this.mode = 'hang'; this.vy = 0; this.vel.x = this.vel.z = 0; this.grounded = false; this.launched = false;
    this.charging = false; this.chargeDip = 0; this.aim.ok = false; this.bufferT = 0;
    this.swipeT = -1; this.dashT = 0; this.airDashUsed = false;
    audio.play('cat.grab');
    return true;
  }

  /** Is there room on top of this ledge, past this point on its edge? Writes the spot to this._ts. */
  _topSpot(b, n, ex, ez) {
    const W = this.world, r = P.radius, top = b.maxY;
    for (const inward of L.inward) {
      const tx = ex - n.x * inward, tz = ez - n.z * inward;
      if (W._boxDist(b, tx, tz, null) >= 0) continue; // past the far side of a narrow perch
      if (W.penetration(tx, tz, r * 0.9, top + P.stepHeight, top + P.height, null, top) > 0) continue; // no room up there
      this._ts.x = tx; this._ts.z = tz;
      return true;
    }
    return false;
  }

  /** Would the cat's hanging body fit, at this point on the edge? */
  _hangClear(b, nx, nz, ex, ez) {
    const r = P.radius;
    return this.world.penetration(ex + nx * (r + 0.005), ez + nz * (r + 0.005), r * 0.9, this.feetY + P.stepHeight, this.feetY + P.height, b, this.feetY) === 0;
  }

  /** A / D along the ledge, relative to facing it. At the end of an edge the cat goes round the corner if it can. */
  _shimmy(dt) {
    if (!this.wside || this.frozen) return;
    const h = this.hang, b = h.col, n = this._nh, r = P.radius;
    const tx = h.nz, tz = -h.nx, s = Math.sign(this.wside), step = s * L.shimmySpeed * dt; // (tx, tz): to the right, facing the ledge
    n.x = h.nx; n.z = h.nz;
    const ex = h.ex + tx * step, ez = h.ez + tz * step, c0 = b.cx * tx + b.cz * tz, half = Math.abs(tx) * b.hx + Math.abs(tz) * b.hz, t = ex * tx + ez * tz;
    if (Math.abs(t - c0) > half - L.shimmyEnd) { // the end of this edge
      const toEnd = c0 + s * half - t;
      n.x = tx * s; n.z = tz * s; // the next face round
      const cx = ex + tx * toEnd - h.nx * L.shimmyEnd * 1.5, cz = ez + tz * toEnd - h.nz * L.shimmyEnd * 1.5;
      if (!this._topSpot(b, n, cx, cz) || !this._hangClear(b, n.x, n.z, cx, cz)) return; // a wall or nothing to stand on: stop here
      this.cornerT = L.cornerTime; // the body and the paws ease round it
      h.nx = n.x; h.nz = n.z; h.ex = cx; h.ez = cz; h.tx = this._ts.x; h.tz = this._ts.z;
      h.x = cx + n.x * (r + 0.005); h.z = cz + n.z * (r + 0.005);
      audio.play('cat.grab', { gain: 0.5 });
      return;
    }
    if (!this._hangClear(b, n.x, n.z, ex, ez) || !this._topSpot(b, n, ex, ez)) return;
    h.ex = ex; h.ez = ez; h.tx = this._ts.x; h.tz = this._ts.z;
    h.x = ex + n.x * (r + 0.005); h.z = ez + n.z * (r + 0.005);
    this.shimmyDist += Math.abs(step);
    this.stamina = Math.max(0, this.stamina - ST.shimmyDrain * dt);
  }

  _tickHang(dt) {
    if (this.cornerT > 0) this.cornerT -= dt;
    const I = this.input, h = this.hang, k = expK(this.cornerT > 0 ? L.cornerSettle : L.settle, dt);
    this.pos.x += (h.x - this.pos.x) * k; this.pos.z += (h.z - this.pos.z) * k;
    this.feetY += (h.top - L.hangDrop - this.feetY) * k;
    this.viewDip += (L.hangDip - this.viewDip) * expK(14, dt);
    { // ease the view inside the limits (you may have caught the edge looking somewhere else)
      const c = this._hangYaw(), d = wrapAngle(this.yaw - c), t = Math.max(-L.yawLimit, Math.min(L.yawLimit, d)), s = expK(L.lookSettle, dt);
      this.yaw = c + d + (t - d) * s;
      this.pitch += (Math.max(L.pitchMin, Math.min(L.pitchMax, this.pitch)) - this.pitch) * s;
    }
    this.stamina = Math.max(0, this.stamina - ST.hangDrain * dt);
    if (this.stamina <= 0) { this._letGo(); return; }
    if (I.pressed('Space') && !this.frozen) { this._startMantle(); return; }
    if (I.down('KeyS') || I.down('ArrowDown') || I.down('KeyC')) { this._letGo(); return; }
    this._shimmy(dt);
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

  // ---- claw climbing: push W into a striped face
  _stripeFace(b, n) { // which side of the box this normal comes from
    return Math.abs(n.x) > Math.abs(n.z) ? (n.x > 0 ? 'e' : 'w') : (n.z > 0 ? 's' : 'n');
  }

  _tryClimb() {
    if (this.stamina <= 0 || this.frozen) return;
    const W = this.world, r = P.radius, n = this._n, x = this.pos.x, z = this.pos.z;
    for (const b of W.boxes) {
      if (!b.stripes || !b.enabled) continue;
      if (this.feetY >= b.maxY - C.topOff || this.feetY + this.height <= b.minY) continue;
      if (Math.abs(x - b.cx) > b.reach + r + C.contact || Math.abs(z - b.cz) > b.reach + r + C.contact) continue;
      const d = W._boxDist(b, x, z, n);
      if (d < r - 0.04 || d > r + C.contact) continue;
      if (!b.stripes.includes(this._stripeFace(b, n))) continue;
      const keys = -(this.wx * n.x + this.wz * n.z);
      if (this.wlen > 0 && this.wfwd <= 0 && keys < C.facing) continue; // backing or side-stepping away: not trying to hold on
      if (keys < C.facing && (this.grounded || this.input.down('KeyC') || -(this.fx * n.x + this.fz * n.z) < C.airFacing)) continue;
      this.climb.col = b; this.climb.x = n.x; this.climb.z = n.z;
      this.mode = 'climb'; this.grounded = false; this.vy = 0; this.vel.x = this.vel.z = 0;
      this.charging = false; this.chargeDip = 0; this.aim.ok = false; this.launched = false;
      this.swipeT = -1; this.dashT = 0; this.airDashUsed = false;
      audio.play('cat.grab');
      return;
    }
  }

  /** Still on the face? Keeps the cat pressed against it. False: the claws have come off. */
  _hugFace() {
    const W = this.world, b = this.climb.col, n = this._n, r = P.radius;
    const d = W._boxDist(b, this.pos.x, this.pos.z, n);
    if (d > r + C.contact || this._stripeFace(b, n) !== this._stripeFace(b, this.climb)) return false;
    this.pos.x -= n.x * (d - r - 0.002); this.pos.z -= n.z * (d - r - 0.002);
    return true;
  }

  _offWall() { this.charging = false; this.chargeT = 0; this.aim.ok = false; this.mode = 'move'; this.grounded = false; this.vy = 0; this.launched = false; this.launchSpeed = 0; this.clawLock = C.kickLock; }

  /** Which way a jump off the wall goes (writes this._dir): to the side with A / D, the way you're looking, or straight back. */
  _kickDir() {
    const c = this.climb, d = this._dir || (this._dir = { x: 0, z: 0 });
    const toRight = -(this.wx * c.z) + this.wz * c.x; // the keys along the wall
    let dx, dz;
    if (Math.abs(this.wside) > 0.1 && Math.abs(toRight) > 0.1) { // sideways: along the wall, a little out
      const s = Math.sign(toRight);
      dx = -c.z * s + c.x * C.outKick; dz = c.x * s + c.z * C.outKick;
    } else if (this.fx * c.x + this.fz * c.z > 0.15) { dx = this.fx; dz = this.fz; } // the way you're looking, if that's away from the wall
    else { dx = c.x; dz = c.z; } // straight back
    const l = Math.hypot(dx, dz) || 1;
    d.x = dx / l; d.z = dz / l;
    return d;
  }

  /** Leave the wall. c: 0 = a tapped kick-off .. 1 = a fully charged spring. */
  _kick(c = 0) {
    const d = this._kickDir(), speed = lerp(C.kickSpeed, C.springSpeed, c);
    this.vel.x = d.x * speed; this.vel.z = d.z * speed; this.vy = lerp(C.kickVy, C.springVy, c);
    this.launched = true; this.launchX = d.x; this.launchZ = d.z; this.launchSpeed = speed;
    this.mode = 'move'; this.grounded = false; this.clawLock = C.kickLock; this.grabLock = 0.12;
    this.stamina = Math.max(0, this.stamina - ST.kickCost - ST.springCost * c);
    this.charging = false; this.chargeT = 0; this.aim.ok = false;
    audio.play('cat.grab');
  }

  // On a climbable face (Peak-style): W up, S down, A / D sideways, all on stamina. Hold still and you cling, draining
  // slowly. Space kicks off; C lets go. When stamina runs out the cat slides down.
  _tickClimb(dt) {
    const I = this.input, c = this.climb, b = c.col, W = this.world;
    if (I.down('KeyC')) { this._offWall(); return; }
    // Space: tap for a quick kick-off, hold to charge a spring, as on the ground. The ring shows where it will land.
    if (I.pressed('Space') && !this.frozen) { this.charging = true; this.chargeT = 0; }
    if (this.charging) {
      if (!I.down('Space') || this.frozen) { this._kick(this.charge); return; }
      this.chargeT += dt;
      this.stamina = Math.max(0, this.stamina - ST.clingDrain * dt);
      if (this.stamina <= 0 || this._chargeExpired(dt)) { // out of grip, or held too long: called off
        this.charging = false; this.chargeT = 0; this.aim.ok = false;
        audio.play('cat.huff');
        if (this.stamina <= 0) this.mode = 'slide';
        return;
      }
      this.chargeDip += (this.charge * J.dip - this.chargeDip) * expK(16, dt);
      this._predict(this.charge, true);
      if (!this._hugFace()) this._offWall();
      return;
    }
    this.chargeDip += (0 - this.chargeDip) * expK(16, dt);
    this.viewDip += (0 - this.viewDip) * expK(10, dt);
    const moving = this.wfwd !== 0 || this.wside !== 0;
    this.stamina = Math.max(0, this.stamina - (moving ? ST.climbDrain : ST.clingDrain) * dt);
    if (this.stamina <= 0) { this.mode = 'slide'; return; }
    if (this.wfwd > 0) {
      const top = this.feetY + this.height, ceil = W.ceiling(this.pos.x, this.pos.z, P.radius * 0.8, top - 0.02);
      if (top + C.speed * dt < ceil) { this.feetY += C.speed * dt; this.climbDist += C.speed * dt; }
    } else if (this.wfwd < 0) {
      this.feetY -= C.speed * dt; this.climbDist += C.speed * dt;
      const g = W.ground(this.pos.x, this.pos.z, P.radius * P.edgeSupport, this.feetY + P.stepHeight, this._g);
      if (this.feetY <= g.y) { this.feetY = g.y; this.mode = 'move'; this.grounded = true; this.groundCollider = g.collider; this.surface = g.surface; return; }
    }
    if (this.wside) { // sideways along the wall. A / D stay screen left and right even when looking away from it
      const facing = -(this.fx * c.x + this.fz * c.z) >= 0 ? 1 : -1, s = this.wside * facing * C.strafe * dt, rx = c.z, rz = -c.x;
      const x = this.pos.x + rx * s, z = this.pos.z + rz * s, c0 = b.cx * rx + b.cz * rz, half = Math.abs(rx) * b.hx + Math.abs(rz) * b.hz, t = x * rx + z * rz;
      if (Math.abs(t - c0) <= half && W.penetration(x, z, P.radius * 0.95, this.feetY + P.stepHeight, this.feetY + P.height, b, this.feetY) === 0) { // stops at the end of the face, doesn't fall off it
        this.pos.x = x; this.pos.z = z; this.climbDist += Math.abs(s);
      }
    }
    if (!this._hugFace()) { this._offWall(); return; }
    if (this.wfwd > 0 && this.feetY >= b.maxY - C.topOff) { // over the top (a curtain hands over to its rod)
      const target = b.climbTo || b;
      if (target.land && this._grabSpot(target, c, this.pos.x - c.x * P.radius, this.pos.z - c.z * P.radius)) this._startMantle();
      else this._offWall();
    }
  }

  _tickSlide(dt) {
    const I = this.input;
    this.viewDip += (0 - this.viewDip) * expK(10, dt);
    if (this.stamina > 0) {
      if (I.pressed('Space') && !this.frozen) { this._kick(); return; }
      if (this.wfwd > 0) { this.mode = 'climb'; return; }
    }
    this.feetY -= C.slideSpeed * dt;
    const g = this.world.ground(this.pos.x, this.pos.z, P.radius * P.edgeSupport, this.feetY + P.stepHeight, this._g);
    if (this.feetY <= g.y) {
      this.feetY = g.y; this.vy = 0; this.mode = 'move'; this.grounded = true; this.groundCollider = g.collider; this.surface = g.surface;
      audio.play('foot.land', { gain: 0.5 });
      return;
    }
    if (!this._hugFace()) this._offWall();
  }

  /** The failsafe: wedged somewhere the cat doesn't fit. Move to the nearest place it does. */
  _unstick(lowY, highY) {
    const W = this.world, r = P.radius, x0 = this.pos.x, z0 = this.pos.z;
    for (let d = 0.05; d <= 1.2; d += 0.05) for (let a = 0; a < 16; a++) {
      const x = x0 + Math.cos((a / 16) * Math.PI * 2) * d, z = z0 + Math.sin((a / 16) * Math.PI * 2) * d;
      if (W.penetration(x, z, r * 1.05, lowY, highY, null, this.feetY) === 0) { this.pos.x = x; this.pos.z = z; this.prev.x = x; this.prev.z = z; this.vel.x = this.vel.z = 0; this.wedgedT = 0; return; }
    }
    this.wedgedT = 0;
  }

  _supported(x, z) { return this.world.ground(x, z, P.radius * P.edgeSupport, this.feetY + P.stepHeight, this._g).y >= this.feetY - P.stepHeight; }

  /** While charging the cat won't walk off an edge (that used to throw the charge away). It slides along it instead. */
  _keepOnEdge(x0, z0) {
    if (this._supported(this.pos.x, this.pos.z)) return;
    if (this._supported(this.pos.x, z0)) { this.pos.z = z0; this.vel.z = 0; return; }
    if (this._supported(x0, this.pos.z)) { this.pos.x = x0; this.vel.x = 0; return; }
    this.pos.x = x0; this.pos.z = z0; this.vel.x = this.vel.z = 0;
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
    // never accept an overlapping position (corner wedges) unless it's a way out of an overlap the cat is already in
    const after = this.world.penetration(this.pos.x, this.pos.z, r, lowY, highY, null, this.feetY);
    if (after > 0.02) {
      const before = this.world.penetration(startX, startZ, r, lowY, highY, null, this.feetY);
      if (after >= before - 1e-4) { this.pos.x = startX; this.pos.z = startZ; this.vel.x = this.vel.z = 0; }
      this.wedgedT = before > 0.02 ? this.wedgedT + dt : 0;
      if (this.wedgedT >= P.unstickAfter) this._unstick(lowY, highY);
    } else this.wedgedT = 0;
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
    const heavy = impact >= P.landHeavy, quiet = this.input.down('KeyC'); // landing with C held is much softer
    this.landDip = Math.min(P.landDip * 2, P.landDip * impact / 4);
    audio.play(heavy ? 'foot.thud' : 'foot.land', { gain: Math.min(1.2, impact / 6) * (quiet ? 0.35 : 1) });
    this.onLand?.(impact, heavy, quiet);
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
    let bobY = 0, bobX = 0, roll = 0, tipped = 0, fallen = 0;
    if (this.hitAge < 3) { // the view goes over with the cat, and rights itself
      const u = this.hitAge + alpha * (1 / 60), rise = Math.min(1, u / 0.14);
      roll = this.hitSide * DUST.roll * rise * Math.exp(-u * 2.1) * Math.cos(u * 4.2);
      tipped = -DUST.pitch * rise * Math.exp(-u * 2.8) * Math.sin(u * 5.5 + 0.8);
      fallen = DUST.drop * rise * Math.exp(-Math.max(0, u - 0.5) * 2.6);
    }
    if (this.dust > 0) roll += Math.sin(this.time * DUST.weaveRate * 0.7) * DUST.lean * Math.min(1, this.dust);
    if (settings.headBob) {
      const amp = this.bobA * this.bobW;
      // DESIGN NOTE: one dip per TWO footsteps. A cat's stride is short, so a dip per step shook the camera 6–9 times a second.
      bobY = -amp * (0.5 + 0.5 * Math.cos(this.bobPh * Math.PI));
      bobX = Math.sin(this.bobPh * Math.PI) * amp * P.bob.sway;
      roll += bobX * P.bob.roll / Math.max(1e-4, P.bob.walk);
    }
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    cam.position.set(x + c * bobX, feet + Math.max(0.07, eye - fallen) + bobY - landDip, z - s * bobX);
    cam.rotation.set(this.pitch - viewDip + tipped, this.yaw, roll, 'YXZ');
    const fov = TUNING.render.fov + lerp(this.prevFovKick, this.fovKick, alpha) * D.fovKick;
    if (Math.abs(cam.fov - fov) > 1e-3) { cam.fov = fov; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
  }
}

const easeInOut = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
/** Wrap any angle to −π…π (JS % keeps the sign of negative numbers, so never use it for this). */
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
