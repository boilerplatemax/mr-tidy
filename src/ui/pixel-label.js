// Small pixel-font HUD labels. Text is drawn 1:1 with the hand-drawn bitmap font (src/ui/hand-font.js, 'print') into
// a tiny canvas, then scaled up by a whole number with nearest-neighbour, on
// the HUD's own ~240-line grid (TUNING.hud.lines), so it reads like the game's pixels whatever the render resolution.
// A label only redraws when its content changes.
import { TUNING } from '../data/tuning.js';
import { write, measure, LINE } from './hand-font.js';

/** The HUD layer: a box laid exactly over the game canvas (inside the frame, whatever the framing). */
export class HudLayer {
  constructor(gameCanvas) {
    this.game = gameCanvas;
    this.el = document.createElement('div');
    this.el.id = 'hud';
    document.body.append(this.el);
    this.k = 1; // CSS px per HUD pixel
    this._w = ''; this._h = '';
    this.labels = [];
    this.sync();
  }

  /** Follow the game canvas's size (cheap: only acts when it changed). */
  sync() {
    const w = this.game.style.width, h = this.game.style.height;
    if (w === this._w && h === this._h) return;
    this._w = w; this._h = h;
    this.el.style.width = w; this.el.style.height = h;
    const dpr = window.devicePixelRatio || 1, cssH = parseFloat(h) || window.innerHeight;
    this.k = Math.max(1, Math.floor((cssH * dpr) / TUNING.hud.lines)) / dpr; // whole device pixels per HUD pixel
    for (const l of this.labels) l._size();
  }

  label(cls) { const l = new PixelLabel(this, cls); this.labels.push(l); return l; }
}

const PAD = 3;
export class PixelLabel {
  constructor(layer, cls) {
    this.layer = layer;
    this.cv = document.createElement('canvas');
    this.cv.className = 'hud-label ' + (cls || '');
    layer.el.append(this.cv);
    this.g = this.cv.getContext('2d');
    this.key = null;
  }

  /** Pin to the HUD layer, in HUD pixels: side 'left' | 'right' (x in from that side) | 'center' (x ignored), y down from the top (or, below 1, a fraction of the height). */
  place(side, x, y) { this.pos = { side, x, y }; this._size(); return this; }
  /** A centred label stepped right by px CSS pixels (0: centred again). Only touches the style on a change. */
  nudge(px) { px = Math.round(px); if (px === (this._nudge || 0)) return; this._nudge = px; this._size(); }
  /** Centred, its bottom edge `y` HUD px up from the bottom of the view (a dialogue box). */
  placeBottom(y) { this.pos = { side: 'center', x: 0, bottom: y }; this._size(); return this; }

  _size() {
    const P = this.pos, k = this.layer.k;
    if (P) {
      if (P.side === 'center') { this.cv.style.left = '50%'; this.cv.style.transform = this._nudge ? `translateX(calc(-50% + ${this._nudge}px))` : 'translateX(-50%)'; }
      else this.cv.style[P.side] = `${P.x * k}px`;
      if (P.bottom != null) { this.cv.style.top = 'auto'; this.cv.style.bottom = `${P.bottom * k}px`; }
      else this.cv.style.top = P.y < 1 ? `${P.y * 100}%` : `${P.y * k}px`; // (y < 1: a fraction of the height)
    }
    this.cv.style.width = `${this.cv.width * this.layer.k}px`; this.cv.style.height = `${this.cv.height * this.layer.k}px`;
  }

  /**
   * rows: [{ text, color?, check?: true|false (a small box, ticked or not), dim? } | { bar: 0..1, width }]
   * (a progress bar row). align: 'left' | 'right' | 'center'; a row with right: true sits at the right edge.
   * minWidth: at least this many HUD px of text width (a box that doesn't change size line to line).
   * Redraws only when the rows changed.
   */
  set(rows, align = 'left', minWidth = 0) {
    const key = align + minWidth + JSON.stringify(rows);
    if (key === this.key) return;
    this.key = key;
    const BOX = 8;
    const BAR = 5; // a bar row's height
    const PAW = ['.#.#.#.', '.#.#.#.', '.......', '..###..', '.#####.', '.#####.', '..#.#..'];
    if (rows[0]?.paws != null) { // the stamina bar: a row of paw prints, each filling from the heel up
      const n = rows[0].count, w2 = n * 9 + 1, h2 = 9, v = Math.max(0, Math.min(1, rows[0].paws)) * n, low = rows[0].paws < 0.25;
      this.cv.width = w2; this.cv.height = h2;
      const g2 = this.g; g2.clearRect(0, 0, w2, h2);
      for (let i = 0; i < n; i++) {
        const f = Math.max(0, Math.min(1, v - i)), lit = Math.ceil(f * 7);
        PAW.forEach((row, y) => { for (let x = 0; x < 7; x++) if (row[x] === '#') { g2.fillStyle = '#000'; g2.fillRect(1 + i * 9 + x + 1, y + 2, 1, 1); g2.fillStyle = 7 - y <= lit ? (low ? '#c8582c' : '#e8a858') : '#4a3a2a'; g2.fillRect(1 + i * 9 + x, y + 1, 1, 1); } });
      }
      this._size();
      return;
    }
    const rw = (r) => (r.bar != null ? r.width : measure(r.text) + (r.check != null ? BOX : 0));
    const w = Math.max(1, minWidth, ...rows.map(rw)) + PAD * 2;
    const h = rows.reduce((n, r) => n + (r.bar != null ? BAR : LINE), 0) + PAD * 2 - 2;
    this.cv.width = w; this.cv.height = h;
    const g = this.g;
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(8, 7, 5, 0.55)'; g.fillRect(0, 0, w, h);
    let y = PAD;
    rows.forEach((r) => {
      let x = align === 'right' || r.right ? w - PAD - rw(r) : align === 'center' ? Math.floor((w - rw(r)) / 2) : PAD;
      if (r.bar != null) { // a thin frame, filled from the left
        const bw = r.width, f = Math.round(Math.max(0, Math.min(1, r.bar)) * (bw - 2));
        g.fillStyle = '#000'; g.fillRect(x + 1, y + 1, bw, 3);
        g.fillStyle = '#8a826e'; g.fillRect(x, y, bw, 1); g.fillRect(x, y + 2, bw, 1); g.fillRect(x, y, 1, 3); g.fillRect(x + bw - 1, y, 1, 3);
        g.fillStyle = '#e8dfc6'; g.fillRect(x + 1, y + 1, f, 1);
        y += BAR; return;
      }
      const col = r.color || (r.dim ? '#8a826e' : '#e8dfc6');
      if (r.check != null) { // a 5×5 box at x-height, ticked when done
        g.fillStyle = '#000'; g.fillRect(x + 1, y + 2, 5, 5);
        g.fillStyle = col; g.fillRect(x, y + 1, 5, 1); g.fillRect(x, y + 5, 5, 1); g.fillRect(x, y + 1, 1, 5); g.fillRect(x + 4, y + 1, 1, 5);
        if (r.check) { g.fillRect(x + 1, y + 3, 1, 1); g.fillRect(x + 2, y + 4, 1, 1); g.fillRect(x + 3, y + 2, 1, 2); g.fillRect(x + 4, y + 0, 1, 2); g.fillRect(x + 5, y - 1, 1, 1); }
        x += BOX;
      }
      write(g, r.text, x + 1, y + 1, { hand: 'print', color: '#000' }); // a 1 px shadow so it reads on fog and a bright sky
      write(g, r.text, x, y, { hand: 'print', color: col });
      y += LINE;
    });
    this._size();
  }

  show(on) { this.cv.style.opacity = on ? '1' : '0'; }
}
