// Dust in the cat's eyes: grimy blotches over the view after a dust blast, fading as it clears. Painted once, faded with
// opacity, so it costs nothing while the cat is clean.
import { TUNING } from '../data/tuning.js';

const D = TUNING.dust;

export class DustOverlay {
  constructor(layer) {
    const c = this.el = document.createElement('canvas');
    c.id = 'dust'; c.width = 160; c.height = 120;
    const g = c.getContext('2d');
    let seed = 7; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 90; i++) { // heavier toward the edges, so you can still just about see ahead
      const a = r() * Math.PI * 2, d = 0.3 + r() * 0.8, x = 80 + Math.cos(a) * d * 90, y = 60 + Math.sin(a) * d * 70, s = 4 + r() * 16, k = Math.floor(70 + r() * 50);
      g.fillStyle = `rgba(${k + 14},${k + 6},${k - 6},${0.35 + r() * 0.55})`;
      for (let n = 0; n < 6; n++) g.fillRect(Math.round(x + (r() - 0.5) * s), Math.round(y + (r() - 0.5) * s), Math.ceil(s * 0.5), Math.ceil(s * 0.4));
    }
    c.style.opacity = '0';
    layer.el.append(c);
    this.last = -1;
  }

  /** Per rendered frame. */
  frame(player) {
    const v = Math.round(Math.min(1, player.dust / D.fadeFrom) * D.opacity * 40) / 40;
    if (v !== this.last) { this.last = v; this.el.style.opacity = String(v); }
  }
}
