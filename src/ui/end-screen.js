// The end-of-run screen ("Good Kitty", or caught), in the pixel font. Marmalade's portrait hangs on the left in a gilt frame
// with no name on it: bright for a win; grey, with a stone R.I.P. plaque under it, when he got her. The button
// starts a new run straight away.
import { pixText } from './menu.js';
import { marmaladePortrait } from './marmalade.js';


/** A thing's name, the way you'd say it: 'cat_figurine' is 'cat figurine', one of his wools is 'red wool'. */
const say = (id) => id.startsWith('wool_') ? id.slice(5) + ' wool' : id.replace(/_/g, ' ').replace(/ pot$/, '');

/** Every broken thing's name, falling slowly through the background at its own pace. */
function fallen(list) {
  const box = document.createElement('div'); box.className = 'fall';
  list.slice(0, 60).forEach((id, i) => {
    const t = pixText(say(id), i % 3 ? '#b89a78' : '#e0c49a'); t.classList.add('fallen');
    t.style.left = ((i * 37) % 92 + Math.random() * 4) + '%'; t.style.animationDuration = (9 + Math.random() * 7) + 's'; t.style.animationDelay = -(Math.random() * 16) + 's';
    box.append(t);
  });
  return box;
}

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
    hang.append(marmaladePortrait(58, mood)); // (no name on the frame: she's just the cat)
    if (mood === 'gone') { const rip = document.createElement('div'); rip.className = 'rip'; rip.append(pixText('R.I.P.', '#e8e4dc')); hang.append(rip); } // a little stone plaque
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
    if (opts.broken?.length) this.el.prepend(fallen(opts.broken)); // (behind the card: everything you knocked over, drifting down)
    this.el.hidden = false;
    document.exitPointerLock?.(); // hand the mouse back so the button can be clicked
  }
}
