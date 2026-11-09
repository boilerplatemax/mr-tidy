// The title screen, the pause screen and the settings, in one element (#pause), every word in the pixel font.
//   • Before play (title mode): no veil, no box: the live scene shows through; just the title, Begin and Settings.
//     Settings opens the tabbed panel with a Back button.
//   • During play (it opens whenever pointer lock is lost or the tab hides): Paused, Resume, and the tabs.
// Tabs (Game · Display · Controls), two columns, nothing scrolls at 1280×720 (check with fitReport()). Every option
// applies live: a change calls setSetting, which saves and notifies every listener (renderer, audio, this menu).
import { settings, setSetting, applyLookPreset, resetSettings, onSettingsChange } from '../data/settings.js';
import { write, measure, wrap, LINE } from './hand-font.js';
import { TUNING } from '../data/tuning.js';

const INK = '#e8dfc6', DIM = '#8a826e', GOLD = '#cfc4a6';

/** A canvas of pixel text (CSS-scaled by --px on #pause). */
export function pixText(text, color = INK) {
  const lines = String(text).split('\n');
  const w = Math.max(1, ...lines.map((l) => measure(l))) + 1, h = lines.length * LINE + 1;
  const c = document.createElement('canvas');
  c.width = w; c.height = h; c.className = 'pix';
  c.style.setProperty('--w', w); c.style.setProperty('--h', h);
  const g = c.getContext('2d');
  lines.forEach((l, i) => { write(g, l, 1, i * LINE + 1, { hand: 'print', color: '#000' }); write(g, l, 0, i * LINE, { hand: 'print', color }); });
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
    ['Crouch toggles (C)', 'crouchToggle', 'check'],
    ['Volume', 'volume', 'range', [0, 1, 0.05, pct]],
    ['Subtitles', 'subtitles', 'check'],
  ],
  Display: [
    ['Look', 'look', 'cycle', [['authored', 'Authored (PS1)'], ['clean', 'Clean (comfort)'], ['custom', 'Custom']]],
    ['Brightness', 'brightness', 'range', [0.7, 1.6, 0.05, (v) => v.toFixed(2)]],
    ['Framing', 'framing', 'cycle', [['fill', 'Fill screen'], ['4:3', '4:3 (pillarboxed)']]],
    ['Vertex jitter', 'jitter', 'check'], ['   amount', 'jitterAmount', 'range', [0.25, 3, 0.25, (v) => v.toFixed(2)]],
    ['Texture warp', 'warp', 'check'], ['   amount', 'warpAmount', 'range', [0.1, 1.8, 0.1, (v) => v.toFixed(1)]],
    ['Dither', 'dither', 'check'], ['   amount', 'ditherAmount', 'range', [0.25, 2, 0.25, (v) => v.toFixed(2)]],
    ['Colour bits', 'colorBits', 'range', [4, 8, 1, (v) => String(v)]],
    ['Lines (resolution)', 'lines', 'range', [180, 720, 20, (v) => String(v)]],
    ['Stable thin details', 'supersample', 'cycle', [[2, 'On (2x supersample)'], [1, 'Off (raw pixels)']]],
  ],
};
// Controls: two columns of [group title, [[key, action], ...]]. Edit for your game.
export const CONTROL_COLUMNS = [
  [['Moving', [['W A S D', 'Move'], ['Mouse', 'Look'], ['Shift (hold)', 'Jog'], ['C', 'Crouch'], ['Esc', 'Pause']]]],
  [['Interacting', [['E', 'Use'], ['Hold E', 'Use (takes time)']]], ['Dev', [['`', 'Overlay (fps, calls)'], ['F1', 'Dev keys']]]],
];

export class Menu {
  /** onBegin: the click that starts / resumes play (call input.requestLock() in it: it's a user gesture). */
  constructor(onBegin) {
    this.tab = 'Game';
    this.started = false;
    const el = this.el = document.createElement('div');
    el.id = 'pause';
    el.innerHTML = `<div class="panel"><div class="title"></div><div class="sub"></div>
      <div class="main"><button id="resume" type="button"></button><button id="settings" type="button" class="small" hidden></button></div>
      <div class="note"></div><div class="tabs"></div><div class="body"></div>
      <div class="foot"><button id="back" type="button" class="small" hidden></button><button id="reset" type="button" class="small"></button></div></div>`;
    document.body.append(el);
    const $ = this.$ = (s) => el.querySelector(s);
    $('.title').append(Object.assign(pixText(TUNING.game.title, GOLD), { className: 'pix big' }));
    this._btn($('#reset'), 'Reset settings', DIM);
    this._btn($('#settings'), 'Settings', DIM); this._btn($('#back'), 'Back');
    $('#resume').onclick = (e) => { e.stopPropagation(); onBegin(); };
    $('#reset').onclick = (e) => { e.stopPropagation(); resetSettings(); };
    $('#settings').onclick = (e) => { e.stopPropagation(); el.classList.add('settings'); this.render(); };
    $('#back').onclick = (e) => { e.stopPropagation(); el.classList.remove('settings'); };
    el.addEventListener('click', (e) => { if (e.target === el && this.started) onBegin(); }); // paused: a click outside the panel resumes (on the title it does nothing)
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    for (const name of [...Object.keys(TABS), 'Controls']) {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.tab = name;
      b.onclick = (e) => { e.stopPropagation(); this.tab = name; this.render(); };
      $('.tabs').append(b);
    }
    onSettingsChange(() => { if (!el.hidden) this.render(); });
    window.addEventListener('resize', () => this._scale());
    this._scale();
    this.render();
  }

  _btn(b, text, color = INK) { b.replaceChildren(pixText(text, color)); }

  /** Whole-number pixel scale for the menu's font: about the game's own pixels on this screen. */
  _scale() {
    const px = Math.max(2, Math.min(4, Math.floor(Math.min(window.innerHeight / 300, window.innerWidth / 470))));
    this.el.style.setProperty('--px', px);
  }

  render() {
    const $ = this.$;
    for (const b of this.el.querySelectorAll('.tabs button')) { const on = b.dataset.tab === this.tab; b.classList.toggle('on', on); this._btn(b, b.dataset.tab, on ? INK : DIM); }
    const body = $('.body');
    body.replaceChildren();
    body.className = 'body cols';
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
    this.el.hidden = false;
    this._scale();
    const $ = this.$;
    this.started = started;
    this.el.classList.toggle('title', !started); this.el.classList.remove('settings');
    document.body.classList.toggle('on-title', !started);
    $('#settings').hidden = started; $('#back').hidden = started;
    $('.sub').replaceChildren(...(started ? [pixText('Paused', DIM)] : []));
    this._btn($('#resume'), started ? 'Resume' : 'Begin');
    $('.note').replaceChildren(...(!started && note ? [para(note, 400, DIM)] : []));
    this.render();
  }
  hide() { this.el.hidden = true; document.body.classList.remove('on-title'); }

  /** Dev: every tab at this window size: does the panel scroll, does anything stick out? */
  fitReport() {
    const was = { hidden: this.el.hidden, tab: this.tab, settings: this.el.classList.contains('settings') }, p = this.$('.panel'), out = {};
    this.el.hidden = false; this.el.classList.add('settings');
    for (const tab of [...Object.keys(TABS), 'Controls']) {
      this.tab = tab; this.render();
      const over = [...p.querySelectorAll('.col > *, .row, .controls > *')].filter((e) => e.getBoundingClientRect().right > (e.closest('.col') || p).getBoundingClientRect().right + 1).length;
      out[tab] = { scrolls: p.scrollHeight > p.clientHeight + 1 || p.scrollWidth > p.clientWidth + 1, over };
    }
    this.tab = was.tab; this.render(); this.el.hidden = was.hidden; this.el.classList.toggle('settings', was.settings);
    return { size: [innerWidth, innerHeight], ok: Object.values(out).every((t) => !t.scrolls && !t.over), tabs: out };
  }
}
