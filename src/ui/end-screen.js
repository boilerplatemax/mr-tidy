// The end-of-run screen ("Good Kitty", or caught), in the pixel font. Marmalade's portrait hangs on the left in a gilt frame
// with her nameplate, like the cats in the hallway: bright for a win, faded with a black ribbon when he got her. The button
// starts a new run straight away.
import { pixText } from './menu.js';
import { marmaladePortrait } from './marmalade.js';

const PLATES = 'game-assets/textures/portraits/';

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

  /**
   * title: the big line. lines: smaller lines under it. opts.mood: 'alive' (a win) or 'gone' (caught); opts.small: a
   * smaller title (a long one).
   */
  show(title, lines, button = 'Play again', opts = {}) {
    const px = Math.max(2, Math.min(4, Math.floor(Math.min(window.innerHeight / 300, window.innerWidth / 470))));
    const mood = opts.mood || 'alive';
    this.el.style.setProperty('--px', px);
    this.el.className = mood;
    // left: the portrait and its plate
    const hang = document.createElement('div'); hang.className = 'hang';
    const plate = new Image(); plate.className = 'plate'; plate.src = PLATES + (mood === 'gone' ? 'nameplate_player_dead.png' : 'nameplate_player_alive.png');
    hang.append(marmaladePortrait(58, mood), plate);
    // right: the words
    const words = document.createElement('div'); words.className = 'words';
    const big = pixText(title, mood === 'gone' ? '#d9c7a8' : '#f0dca8'); big.classList.add(opts.small ? 'mid' : 'big');
    const rule = document.createElement('div'); rule.className = 'rule';
    const stats = document.createElement('div'); stats.className = 'stats';
    stats.append(...lines.map((l) => pixText(l, '#a89c80')));
    const again = document.createElement('button'); again.type = 'button';
    again.append(pixText(button, '#f0e6cc'));
    again.onclick = () => this.onAgain?.();
    words.append(big, rule, stats, again);
    const card = document.createElement('div'); card.className = 'card';
    card.append(hang, words);
    this.el.replaceChildren(card);
    this.el.hidden = false;
    document.exitPointerLock?.(); // hand the mouse back so the button can be clicked
  }
}
