// The end-of-run screen ("Good Kitty" or "Try again"), in the pixel font. The button starts a new run straight away.
import { pixText } from './menu.js';

export class EndScreen {
  /** onAgain(): the button was clicked (a user gesture: it can take the mouse back). */
  constructor(onAgain) {
    this.onAgain = onAgain;
    const el = this.el = document.createElement('div');
    el.id = 'end';
    el.hidden = true;
    document.body.append(el);
  }

  hide() { this.el.hidden = true; }

  /** title: big line. lines: smaller lines under it. */
  show(title, lines, button = 'Play again', opts = {}) {
    const px = Math.max(2, Math.min(4, Math.floor(Math.min(window.innerHeight / 300, window.innerWidth / 470))));
    this.el.style.setProperty('--px', px);
    const big = pixText(title, '#cfc4a6'); if (!opts.small) big.classList.add('big');
    const pics = (opts.images || []).map(([src, w]) => { const i = new Image(); i.src = src; i.style.width = `calc(${w}px * var(--px))`; i.style.imageRendering = 'pixelated'; return i; });
    const box = document.createElement('div'); box.className = 'box';
    box.append(...pics, big, ...lines.map((l) => pixText(l, '#8a826e')));
    const again = document.createElement('button'); again.type = 'button';
    again.append(pixText(button));
    again.onclick = () => this.onAgain?.();
    box.append(again);
    this.el.replaceChildren(box);
    this.el.hidden = false;
    document.exitPointerLock?.(); // hand the mouse back so the button can be clicked
  }
}
