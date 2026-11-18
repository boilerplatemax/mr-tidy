// Marmalade's to-do list: a little note in the corner after the tutorial, so there's a reason to start knocking things
// over (just that: five of them, nothing about Grandma yet). It ticks off as you go, then goes away. When he turns nasty
// it comes back once with the new jobs on it, marked NEW (wake Grandma, louder near her room; and hide from him, C to
// crouch), and then leaves you to it.
import { TUNING } from '../data/tuning.js';

const T = TUNING.todo;

export class TodoList {
  constructor(layer) {
    this.label = layer.label('hud-todo').place('left', T.x, T.y);
    this.phase = null; this.shownFor = 0; this.last = ''; this.on = false; this.wait = 0;
  }

  reset() { this.phase = null; this.shownFor = 0; this.wait = 0; this._show(false); this.last = ''; }

  /** The run's begun (after the tutorial, or straight away on a retry). delay: s before it pops up. */
  start(delay = 0.8) { this.phase = 'knock'; this.wait = delay; this.shownFor = T.show; }

  _rows(knocks, evil) {
    const n = Math.min(knocks, T.knocks), done = n >= T.knocks;
    const rows = [{ text: 'TO-DO LIST', color: '#e8c878' }, { check: true, text: 'Nap', dim: true }, { check: done, text: `Knock over ${T.knocks} things (${n}/${T.knocks})`, dim: done }, { check: true, text: 'Look innocent', dim: true }];
    if (evil) rows.push({ check: false, text: 'NEW: Wake Grandma!', color: '#f0a090' }, { text: '   (louder near her room)', dim: true }, { check: false, text: 'NEW: Hide (hold C to crouch)', color: '#f0a090' });
    return rows;
  }

  _show(on) { if (on !== this.on) { this.on = on; this.label.show(on); } }

  /** Per rendered frame. knocks: things knocked over so far; anger: his stage; hidden: something else has the screen. */
  frame(dt, knocks, anger, hidden) {
    if (!this.phase || hidden) { this._show(false); return; }
    if (this.wait > 0) { this.wait -= dt; return; }
    if (this.phase === 'knock' && anger >= 3) { this.phase = 'grandma'; this.shownFor = T.showEvil; this.wait = T.evilDelay; return; } // he's turned: one new job
    const key = this.phase + knocks;
    if (key !== this.last) { // something changed: up it comes for a moment
      if (this.last && this.phase === 'knock' && knocks <= T.knocks) this.shownFor = Math.max(this.shownFor, T.bump);
      this.last = key; this.label.set(this._rows(knocks, this.phase === 'grandma'));
    }
    this.shownFor -= dt;
    this._show(this.shownFor > 0);
    if (this.shownFor <= 0 && this.phase === 'grandma') this.phase = 'gone';
  }
}
