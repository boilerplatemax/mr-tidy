// Input: pointer lock + keyboard + mouse. Losing pointer lock or hiding the tab pauses the game.
// Gameplay reads `input.down(code)` (held), `input.pressed(code)` / `input.released(code)` (edges since the last
// fixed tick; call consumeEdges() once per tick) and takeMouse() (deltas since the last frame).
// Codes are KeyboardEvent.code ('KeyW', 'ShiftLeft', 'Space') plus 'Mouse0' / 'Mouse1' / 'Mouse2'.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.edges = new Set(); // pressed since last consume
    this.releases = new Set();
    this.mouseDX = 0; this.mouseDY = 0;
    this.wheel = 0;
    this.locked = false;
    this.paused = true;
    this.started = false; // the first click has happened (audio may start)
    this.allowUnlocked = false; // headless / tests: run without pointer lock (?play)
    this.listeners = { pause: [], resume: [], firstClick: [], lockFailed: [] };

    window.addEventListener('keydown', (e) => {
      // F1–F9 are debug keys: without this F5 reloads the page and F3 / F6 / F7 trigger browser actions.
      if (e.code === 'Tab' || /^F[1-9]$/.test(e.code) || e.code === 'Backquote' || (this.locked && e.code === 'Space')) e.preventDefault();
      if (!this.keys.has(e.code)) this.edges.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); this.releases.add(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      // some browsers report a huge spike right after locking: ignore absurd jumps
      if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
      this.mouseDX += e.movementX; this.mouseDY += e.movementY;
    });
    document.addEventListener('mousedown', (e) => { if (this.locked) { this.edges.add('Mouse' + e.button); this.keys.add('Mouse' + e.button); } });
    document.addEventListener('mouseup', (e) => { this.keys.delete('Mouse' + e.button); this.releases.add('Mouse' + e.button); });
    document.addEventListener('contextmenu', (e) => { if (this.locked) e.preventDefault(); });
    document.addEventListener('wheel', (e) => { if (this.locked) this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (this.locked) this.setPaused(false); else { this.keys.clear(); this.setPaused(true); }
    });
    document.addEventListener('pointerlockerror', () => this.listeners.lockFailed.forEach((f) => f()));
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.setPaused(true); });
  }

  /** Call from a click handler (a user gesture): grabs the mouse and, the first time, fires 'firstClick' (start audio). */
  requestLock() {
    if (!this.started) { this.started = true; this.listeners.firstClick.forEach((f) => f()); }
    const p = this.canvas.requestPointerLock?.({ unadjustedMovement: true });
    if (p?.catch) p.catch(() => { const q = this.canvas.requestPointerLock(); q?.catch?.(() => this.listeners.lockFailed.forEach((f) => f())); }); // unadjustedMovement unsupported → plain lock
  }

  setPaused(v) {
    if (v === this.paused) return;
    if (!v && !this.locked && !this.allowUnlocked) return;
    this.paused = v;
    this.listeners[v ? 'pause' : 'resume'].forEach((f) => f());
  }

  /** event: 'pause' | 'resume' | 'firstClick' */
  on(event, fn) { this.listeners[event].push(fn); }
  down(code) { return this.keys.has(code); }
  pressed(code) { return this.edges.has(code); }
  released(code) { return this.releases.has(code); }
  /** Is the game running (not paused, or running unlocked for tests)? */
  get live() { return !this.paused || this.allowUnlocked; }
  /** Call once per fixed tick after gameplay has read edges. */
  consumeEdges() { this.edges.clear(); this.releases.clear(); this.wheel = 0; }
  /** Mouse movement since the last call (one reused object: no per-frame garbage). */
  takeMouse() { const d = this._m || (this._m = { x: 0, y: 0 }); d.x = this.mouseDX; d.y = this.mouseDY; this.mouseDX = 0; this.mouseDY = 0; return d; }
}
