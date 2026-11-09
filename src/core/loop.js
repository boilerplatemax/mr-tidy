// The fixed-timestep loop. Gameplay ticks at a fixed rate (TUNING.loop.step, 60 Hz); rendering runs at the
// display's rate and draws everything INTERPOLATED between the last two ticks (alpha 0..1).
//
// The rule that matters (it cost a milestone to find): anything the camera or a first-person viewmodel reads must be
// interpolated with alpha, not only the position. A view offset set once per tick (a landing dip, a hold dip, a
// recoil) but drawn raw holds for 2–3 frames at 144 Hz and then jumps: in a clean/smooth look that reads as a
// shake. Keep prev + current of each such value per tick (see Player.snapView) and lerp them in render(alpha).
import { TUNING } from '../data/tuning.js';

export class FixedLoop {
  /**
   * tick(dt): one fixed step of gameplay. frame(alpha, dt, frameMs): draw. live(): false while paused (alpha is
   * then 1: a paused camera must not rock between two ticks).
   */
  constructor({ tick, frame, live = () => true }) {
    Object.assign(this, { tick, frame, live });
    this.acc = 0; this.last = 0; this.running = false;
    this._raf = (now) => { if (!this.running) return; requestAnimationFrame(this._raf); this.advance(now - this.last); this.last = now; };
  }

  start() { if (this.running) return; this.running = true; this.last = performance.now(); requestAnimationFrame(this._raf); }
  stop() { this.running = false; }

  /** One displayed frame: the ticks the elapsed time owes, then the draw. Tests can call this with fake timing. */
  advance(frameMs) {
    const L = TUNING.loop;
    const dt = Math.min(L.maxFrame, Math.max(0, frameMs) / 1000);
    this.acc += dt;
    let n = 0;
    while (this.acc >= L.step && n < L.maxSteps) { this.tick(L.step); this.acc -= L.step; n++; }
    if (n === L.maxSteps) this.acc = 0; // fell far behind: drop the backlog, don't spiral
    this.frame(this.live() ? this.acc / L.step : 1, dt, frameMs);
  }
}
