// The end-of-run screen ("Good Kitty"), in the pixel font. Playing again reloads the page for now; a seamless restart
// that keeps you out of the title screen arrives with the restart work in step 16.
import { pixText } from './menu.js';

export class EndScreen {
  constructor() {
    const el = this.el = document.createElement('div');
    el.id = 'end';
    el.hidden = true;
    document.body.append(el);
  }

  /** title: big line. lines: smaller lines under it. */
  show(title, lines) {
    const px = Math.max(2, Math.min(4, Math.floor(Math.min(window.innerHeight / 300, window.innerWidth / 470))));
    this.el.style.setProperty('--px', px);
    const big = pixText(title, '#cfc4a6'); big.classList.add('big');
    const box = document.createElement('div'); box.className = 'box';
    box.append(big, ...lines.map((l) => pixText(l, '#8a826e')));
    const again = document.createElement('button'); again.type = 'button';
    again.append(pixText('Play again'));
    again.onclick = () => location.reload();
    box.append(again);
    this.el.replaceChildren(box);
    this.el.hidden = false;
    document.exitPointerLock?.(); // hand the mouse back so the button can be clicked
  }
}
