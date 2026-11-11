// The title screen, the pause screen and the settings, in one element (#pause), every word in the pixel font.
//   • Before play (title mode): no veil, no box: the live scene shows through; just the title, Begin and Settings.
//     Settings opens a narrow card listing the categories in a column, with Back.
//   • During play (it opens whenever pointer lock is lost or the tab hides): Paused, Resume, and the categories.
// Opening a category (Game · Display · Controls) widens the card to its options in two columns, with Back; nothing
// scrolls at 1280×720 (check with fitReport()). The game's name only shows on the title. Every option applies live:
// a change calls setSetting, which saves and notifies every listener (renderer, audio, this menu).
import { settings, setSetting, applyLookPreset, resetSettings, onSettingsChange } from '../data/settings.js';
import { write, measure, wrap, LINE } from './hand-font.js';
import { TUNING } from '../data/tuning.js';

// Grandma's house at night: cream ink, dusty rose for the quieter words, old gilt for the headings
const INK = '#f2e4c8', DIM = '#c39a92', GOLD = '#e6c27a';

const GAP = measure('II') - 2 * measure('I'); // the font's own space between letters
const adv = (ch) => (ch === ' ' ? 3 : measure(ch)) + GAP + 1;

/** Write a line letter by letter, each stroke doubled and one pixel more between letters, so it reads heavier. */
function writeBold(g, text, x, y, color) {
  let cx = x;
  for (const ch of text) { if (ch !== ' ') write(g, ch, cx, y, { hand: 'print', color, bold: true }); cx += adv(ch); }
}
const boldWidth = (t) => [...t].reduce((w, ch) => w + adv(ch), 0);

/**
 * A canvas of pixel text (CSS-scaled by --px on #pause). opts.bold: heavier strokes with a dark outline all round
 * (for words laid straight over the scene: the title and its buttons).
 */
export function pixText(text, color = INK, opts = {}) {
  const lines = String(text).split('\n'), bold = !!opts.bold, pad = bold ? 1 : 0;
  const w = Math.max(1, ...lines.map((l) => (bold ? boldWidth(l) : measure(l)))) + 1 + pad * 2, h = lines.length * LINE + 1 + pad * 2;
  const c = document.createElement('canvas');
  c.width = w; c.height = h; c.className = 'pix';
  c.style.setProperty('--w', w); c.style.setProperty('--h', h);
  const g = c.getContext('2d');
  lines.forEach((l, i) => {
    const y = i * LINE + pad;
    if (bold) {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1], [2, 1], [2, 2], [1, 2]]) writeBold(g, l, pad + dx, y + dy, '#140809');
      writeBold(g, l, pad, y, color);
    } else { write(g, l, 1, y + 1, { hand: 'print', color: '#000' }); write(g, l, 0, y, { hand: 'print', color }); }
  });
  return c;
}
const para = (text, maxW, color) => pixText(wrap(text, maxW).join('\n'), color);
const pct = (v) => `${Math.round(v * 100)}%`;

// [label, key, type, options]. type: 'check' | 'range' [min, max, step, format] | 'cycle' [[value, label], …].
// A label starting with spaces is a sub-option (dim, kept in the same column as the one above it).
export const TABS = {
  Game: [
    ['Mouse sensitivity', 'sensitivity', 'range', [0.2, 3, 0.05, (v) => v.toFixed(2)]],
    ['Invert Y', 'invertY', 'check'],
    ['Head-bob', 'headBob', 'check'],
    ['Volume', 'volume', 'range', [0, 1, 0.05, pct]],
    ['Subtitles', 'subtitles', 'check'],
    ['Tail peeks as you turn', 'tailPeek', 'check'],
  ],
  Display: [
    ['Brightness', 'brightness', 'range', [0.7, 1.6, 0.05, (v) => v.toFixed(2)]],
    ['Framing', 'framing', 'cycle', [['fill', 'Fill screen'], ['4:3', '4:3 (pillarboxed)']]],
    ['Dither', 'dither', 'check'], ['   amount', 'ditherAmount', 'range', [0.25, 2, 0.25, (v) => v.toFixed(2)]],
    ['Colour bits', 'colorBits', 'range', [4, 8, 1, (v) => String(v)]],
    ['Lines (resolution)', 'lines', 'range', [180, 360, 20, (v) => String(v)]],
  ],
};
// Controls: two columns of [group title, [[key, action], ...]]. (The debug keys still work; F9 and the README list them, not here.)
export const CONTROL_COLUMNS = [
  [['Moving', [['W A S D', 'Move'], ['Mouse', 'Look'], ['Shift', 'Run. In the air: dash'], ['C (hold)', 'Slink (silent)'], ['Space (hold)', 'Charge, release: jump'], ['Left click', 'Swipe'], ['Esc', 'Pause']]]],
  [['Parkour', [['Space', 'Hanging: pull up'], ['S or C', 'Hanging: let go'], ['W into stripes', 'Climb'], ['Space', 'Climbing: kick off'], ['C', 'Climbing: let go']]]],
];

export class Menu {
  /** onBegin: the click that starts / resumes play (call input.requestLock() in it: it's a user gesture). */
  constructor(onBegin) {
    this.tab = 'Game';
    this.view = 'home'; // 'home' (the title, or Paused) · 'cats' (the title's column of categories) · 'cat' (one category open)
    this.started = false;
    const el = this.el = document.createElement('div');
    el.id = 'pause';
    el.innerHTML = `<div class="panel"><div class="title"></div><div class="sub"></div>
      <div class="main"><button id="resume" type="button"></button><button id="settings" type="button"></button></div>
      <div class="note"></div><div class="tabs"></div><div class="body"></div>
      <div class="foot"><button id="back" type="button" class="small"></button><button id="reset" type="button" class="small"></button></div></div>
      <div class="hint"></div>`;
    document.body.append(el);
    const $ = this.$ = (s) => el.querySelector(s);
    $('.title').append(Object.assign(pixText(TUNING.game.title, GOLD, { bold: true }), { className: 'pix big' }));
    this._btn($('#reset'), 'Reset settings', DIM);
    this._btn($('#back'), '< Back');
    $('#resume').onclick = (e) => { e.stopPropagation(); onBegin(); };
    $('#reset').onclick = (e) => { e.stopPropagation(); resetSettings(); };
    $('#settings').onclick = (e) => { e.stopPropagation(); this._go('cats'); };
    $('#back').onclick = (e) => { e.stopPropagation(); this._go(this.view === 'cat' && !this.started ? 'cats' : 'home'); };
    el.addEventListener('click', (e) => { if (e.target === el && this.started) onBegin(); }); // paused: a click outside the panel resumes (on the title it does nothing)
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    // Esc: in the settings, back a page; paused, close the menu and play on. (A browser won't hand the mouse back for a
    // key press, Esc least of all, so if it says no the menu stays shut with just "Click to play": one click and you're in.
    // Esc again opens it back up.)
    $('.hint').append(pixText('Click to play', INK, { bold: true }));
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Escape' || el.hidden || performance.now() - this.shownAt < 300) return; // (the Esc that let the mouse go isn't also this one)
      if (this.closed) { this.show(this.started); return; }
      if (this.view !== 'home') { $('#back').click(); return; }
      if (this.started) { this.closed = true; el.classList.add('closed'); onBegin(); }
    });
    for (const name of [...Object.keys(TABS), 'Controls']) {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.tab = name;
      b.onclick = (e) => { e.stopPropagation(); this.tab = name; this._go('cat'); };
      $('.tabs').append(b);
    }
    onSettingsChange(() => { if (!el.hidden) this.render(); });
    window.addEventListener('resize', () => this._scale());
    this._scale();
    this.render();
  }

  _btn(b, text, color = INK, opts) { b.replaceChildren(pixText(text, color, opts)); }

  _go(view) { this.view = view; this.render(); }

  /** Whole-number pixel scale for the menu's font: about the game's own pixels on this screen. */
  _scale() {
    const px = Math.max(2, Math.min(4, Math.floor(Math.min(window.innerHeight / 300, window.innerWidth / 470))));
    this.el.style.setProperty('--px', px);
  }

  /** Which parts show: the title's name and buttons, the column of categories, or one category's options. */
  _layout() {
    const $ = this.$, v = this.view, title = !this.started;
    this.el.classList.toggle('title', title);
    this.el.classList.toggle('settings', v !== 'home'); // (on the title: the veil and the card come up)
    this.el.classList.toggle('cat', v === 'cat'); // (the card widens to the options)
    $('.title').hidden = !(title && v === 'home');
    $('.main').hidden = v !== 'home';
    $('#settings').hidden = !title;
    $('.note').hidden = !(title && v === 'home');
    $('.tabs').hidden = !(v === 'cats' || (v === 'home' && !title));
    $('.body').hidden = v !== 'cat';
    $('.foot').hidden = v === 'home';
    $('#reset').hidden = v !== 'cat' || this.tab === 'Controls';
    const sub = v === 'cat' ? this.tab : v === 'cats' ? 'Settings' : title ? '' : 'Paused';
    $('.sub').replaceChildren(...(sub ? [Object.assign(pixText(sub, GOLD), { className: 'pix mid' })] : []));
  }

  render() {
    const $ = this.$;
    this._layout();
    for (const b of this.el.querySelectorAll('.tabs button')) this._btn(b, b.dataset.tab);
    const body = $('.body');
    body.replaceChildren();
    body.className = 'body cols';
    if (this.view !== 'cat') return;
    if (TABS[this.tab]) {
      const rows = TABS[this.tab];
      let cut = Math.ceil(rows.length / 2);
      while (cut < rows.length && rows[cut][0].startsWith(' ')) cut++; // (keep "amount" with its toggle)
      for (const part of [rows.slice(0, cut), rows.slice(cut)]) {
        const col = document.createElement('div'); col.className = 'col';
        for (const row of part) col.append(this._row(...row));
        body.append(col);
      }
    } else {
      for (const groups of CONTROL_COLUMNS) {
        const col = document.createElement('div'); col.className = 'col';
        for (const [title, keys] of groups) {
          const grid = document.createElement('div'); grid.className = 'controls';
          const h = pixText(title, GOLD); h.classList.add('head'); grid.append(h);
          for (const [k, a] of keys) grid.append(pixText(k, INK), pixText(a, DIM));
          col.append(grid);
        }
        body.append(col);
      }
    }
  }

  _row(label, key, type, opt) {
    const row = document.createElement('div'); row.className = 'row';
    row.append(pixText(label, label.startsWith(' ') ? DIM : INK));
    const ctl = document.createElement('div'); ctl.className = 'ctl';
    if (type === 'check') {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'pick';
      this._btn(b, settings[key] ? '[x] On' : '[ ] Off', settings[key] ? INK : DIM);
      b.onclick = (e) => { e.stopPropagation(); setSetting(key, !settings[key]); };
      ctl.append(b);
    } else if (type === 'range') {
      const [min, max, step, fmt] = opt;
      const r = Object.assign(document.createElement('input'), { type: 'range', min, max, step, value: settings[key] });
      const v = document.createElement('span'); v.className = 'val'; v.append(pixText(fmt(Number(settings[key]))));
      r.oninput = () => { v.replaceChildren(pixText(fmt(Number(r.value)))); };
      r.onchange = () => setSetting(key, Number(r.value)); // on release: the whole menu re-renders on a change
      r.onclick = (e) => e.stopPropagation();
      ctl.append(r, v);
    } else {
      ctl.append(this._cycle(opt, settings[key], (val) => {
        if (key === 'look') { if (val !== 'custom') applyLookPreset(val); } else setSetting(key, val);
      }));
    }
    row.append(ctl);
    return row;
  }

  /** "< Label >": left click → next, right click → previous. */
  _cycle(opts, cur, set) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pick';
    const i = Math.max(0, opts.findIndex(([v]) => String(v) === String(cur)));
    this._btn(b, `< ${opts[i][1]} >`);
    b.onclick = (e) => { e.stopPropagation(); set(opts[(i + 1) % opts.length][0]); };
    b.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); set(opts[(i + opts.length - 1) % opts.length][0]); };
    return b;
  }

  /** started: false = the title screen, true = the pause screen. note: a small line under the buttons (title only). */
  show(started, note = '') {
    this.el.hidden = false; this.shownAt = performance.now();
    this.closed = false; this.el.classList.remove('closed');
    this._scale();
    const $ = this.$;
    this.started = started; this.view = 'home';
    document.body.classList.toggle('on-title', !started);
    const bold = started ? undefined : { bold: true }; // (on the title the words sit right on the scene: heavier, outlined)
    this._btn($('#resume'), started ? 'Resume' : 'Begin', INK, bold);
    this._btn($('#settings'), 'Settings', '#e3c6b4', bold);
    $('.note').replaceChildren(...(!started && note ? [para(note, 400, DIM)] : []));
    this.render();
  }
  hide() { this.el.hidden = true; this.closed = false; this.el.classList.remove('closed'); document.body.classList.remove('on-title'); }

  /** Dev: every category at this window size: does the panel scroll, does anything stick out? */
  fitReport() {
    const was = { hidden: this.el.hidden, tab: this.tab, view: this.view }, p = this.$('.panel'), out = {};
    this.el.hidden = false; this.view = 'cat';
    for (const tab of [...Object.keys(TABS), 'Controls']) {
      this.tab = tab; this.render();
      const over = [...p.querySelectorAll('.col > *, .row, .controls > *')].filter((e) => e.getBoundingClientRect().right > (e.closest('.col') || p).getBoundingClientRect().right + 1).length;
      out[tab] = { scrolls: p.scrollHeight > p.clientHeight + 1 || p.scrollWidth > p.clientWidth + 1, over };
    }
    this.tab = was.tab; this.view = was.view; this.render(); this.el.hidden = was.hidden;
    return { size: [innerWidth, innerHeight], ok: Object.values(out).every((t) => !t.scrolls && !t.over), tabs: out };
  }
}
