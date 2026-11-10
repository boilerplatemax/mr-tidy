// How near Grandma is to waking: a little face of her in the corner (fast asleep with three Z's, stirring, nearly awake,
// awake) over a thin bar. It isn't always there: it fades in for a few seconds when a knock-over has woken her a little
// more, and while the cat is by her door, then fades away again. Redraws only when what it shows changes.
import { TUNING } from '../data/tuning.js';

const W = 30, H = 22, HU = TUNING.hud;

export class WakeIcon {
  constructor(layer) {
    this.label = layer.label('hud-wake');
    this.label.place('right', 6, 6);
    this.label.cv.style.transitionDuration = HU.wakeFade + 's';
    this.label.show(false);
    this.key = ''; this.hold = 0; this.shown = false; this.last = null;
  }

  /** Per rendered frame. stage 0..4, wake 0..100, near: the cat is by her door, hidden: something else owns the screen. */
  frame(stage, wake, near, hidden, dt) {
    if (this.last !== null && wake > this.last + 1e-3) this.hold = HU.wakeShow; // she stirred: show how close she is
    this.last = wake;
    if (near) this.hold = Math.max(this.hold, 0.4);
    this.hold = Math.max(0, this.hold - dt);
    const show = !hidden && this.hold > 0;
    if (show) this._draw(stage, wake);
    if (show !== this.shown) { this.shown = show; this.label.show(show); }
  }

  /** A new run: asleep, and nothing on screen. */
  reset() { this.last = null; this.hold = 0; }

  _draw(stage, wake) {
    const fill = Math.round((wake / 100) * (W - 6)), key = stage + ':' + fill;
    if (key === this.key) return;
    this.key = key;
    const { cv, g } = this.label;
    cv.width = W; cv.height = H;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(8, 7, 5, 0.6)'; g.fillRect(0, 0, W, H);
    const px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    // her: grey hair in a bun, a round face, glasses
    px(6, 1, 4, 2, '#b8b4ac'); px(3, 3, 10, 3, '#a8a49c'); px(2, 5, 2, 6, '#a8a49c'); px(12, 5, 2, 6, '#a8a49c');
    px(4, 5, 8, 9, '#e2c4a4'); px(3, 7, 10, 5, '#e2c4a4');
    const ink = '#2a2018';
    px(4, 7, 3, 3, '#6a5a48'); px(9, 7, 3, 3, '#6a5a48'); px(7, 8, 2, 1, '#6a5a48'); // the glasses' rims
    px(5, 8, 1, 1, '#e8dcc8'); px(10, 8, 1, 1, '#e8dcc8');
    if (stage <= 1) { px(5, 9, 1, 1, ink); px(10, 9, 1, 1, ink); } // shut
    else if (stage === 2) { px(5, 8, 1, 2, ink); px(10, 9, 1, 1, ink); } // one eye cracking open
    else if (stage === 3) { px(5, 8, 1, 2, ink); px(10, 8, 1, 2, ink); } // nearly open
    else { px(5, 8, 1, 1, ink); px(10, 8, 1, 1, ink); px(4, 7, 3, 3, '#3a2e22'); px(9, 7, 3, 3, '#3a2e22'); px(5, 8, 1, 1, '#f4ecd8'); px(10, 8, 1, 1, '#f4ecd8'); } // wide awake
    px(7, 12, 2, stage >= 4 ? 2 : 1, '#8a4a3a'); // the mouth (open: awake)
    // the Z's, fewer as she wakes; a ! when she's up
    g.fillStyle = '#e8dfc6';
    const zs = [3, 2, 1, 0, 0][stage] ?? 0;
    for (let i = 0; i < zs; i++) { const x = 15 + i * 4, y = 9 - i * 3; g.fillRect(x, y, 3, 1); g.fillRect(x + 1, y + 1, 1, 1); g.fillRect(x, y + 2, 3, 1); }
    if (stage >= 4) { px(18, 3, 2, 7, '#f0c060'); px(18, 11, 2, 2, '#f0c060'); }
    // the bar: how close she is
    px(3, H - 5, W - 6, 2, 'rgba(232, 223, 198, 0.18)');
    px(3, H - 5, fill, 2, stage >= 3 ? '#e8a050' : '#d8c890');
    this.label._size();
  }
}
