// Dev overlay (` to toggle, or ?dev): fps, frame time (and the worst frame), draw calls, triangles, plus any lines your
// game adds (overlay.lines = () => [...]). F1 shows the dev key list. Check it after every milestone: the target is a
// locked 60 fps on a mid-range laptop with integrated graphics.

export class DevOverlay {
  constructor() {
    this.el = document.createElement('pre');
    this.el.id = 'dev-overlay';
    document.body.append(this.el);
    this.help = document.createElement('pre');
    this.help.id = 'dev-help';
    document.body.append(this.help);
    this.visible = new URLSearchParams(location.search).has('dev');
    this.el.hidden = !this.visible;
    this.help.hidden = true;
    this.frames = 0; this.acc = 0; this.worst = 0; this.fps = 0; this.ms = 0; this.worstShown = 0;
    this.lines = () => [];
    this.flash = ''; this.flashT = 0;
  }

  toggle() { this.visible = !this.visible; this.el.hidden = !this.visible; }
  toggleHelp(text) { this.help.hidden = !this.help.hidden; this.help.textContent = text; }
  /** A short message on the overlay's last line ("jitter off"). */
  note(text, seconds = 3) { this.flash = text; this.flashT = seconds; }

  /** Per rendered frame. frameMs: wall time since the last frame. Text refreshes twice a second. */
  frame(frameMs, dt) {
    this.frames++; this.acc += frameMs; this.worst = Math.max(this.worst, frameMs);
    if (this.flashT > 0) this.flashT -= dt;
    if (this.acc >= 500) {
      this.fps = (this.frames * 1000) / this.acc; this.ms = this.acc / this.frames; this.worstShown = this.worst;
      this.frames = 0; this.acc = 0; this.worst = 0;
      if (this.visible) this.el.textContent = [`${this.fps.toFixed(0)} fps · ${this.ms.toFixed(1)} ms (worst ${this.worstShown.toFixed(1)})`, ...this.lines(), this.flashT > 0 ? '» ' + this.flash : ''].join('\n');
    }
  }
}
