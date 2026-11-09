// Subtitles / captions: "[knocking, behind you]", "Voice: Did you hear that?" Direction words come from where the
// source is relative to the listener's view ("ahead", "to the left", "to the right", "behind you", "above you",
// "right beside you", "outside", "indoors"); a named place wins when the source is in one and you aren't
// ("from the shed"). Follows Settings › Subtitles (on by default); show(..., force) ignores it.
//
// The audio engine captions a sound automatically when its sound-bank slot has a `subtitle` (src/audio/audio.js
// onCaption, wired in main.js). Call sound() yourself for anything else.
import { TUNING } from '../data/tuning.js';
import { settings } from '../data/settings.js';

class Subtitles {
  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'subtitles';
    document.body.append(this.el);
    this.lines = []; // { el, t, key }
    this.places = []; // { name, minX, maxX, minZ, maxZ } (add your named areas: 'shed', 'cellar')
    this.isIndoor = () => false; // (p) → bool: set by your game (the audio engine's isIndoor works)
  }

  /** Words for where a sound is, from the listener's point of view. yaw: the listener's yaw (rad). */
  where(pos, listenerPos, yaw) {
    for (const p of this.places) if (pos.x >= p.minX && pos.x <= p.maxX && pos.z >= p.minZ && pos.z <= p.maxZ) {
      if (!(listenerPos.x >= p.minX && listenerPos.x <= p.maxX && listenerPos.z >= p.minZ && listenerPos.z <= p.maxZ)) return `from the ${p.name}`;
    }
    const dx = pos.x - listenerPos.x, dz = pos.z - listenerPos.z;
    const parts = [];
    const srcIn = this.isIndoor(pos), meIn = this.isIndoor(listenerPos);
    if (meIn && !srcIn) parts.push('outside');
    else if (!meIn && srcIn) parts.push('indoors');
    if (Math.hypot(dx, dz) < 1.2) parts.push(pos.y > listenerPos.y + 1 ? 'above you' : 'right beside you');
    else {
      // angle relative to the view: forward is (−sin yaw, −cos yaw)
      const a = Math.atan2(dx, dz) - Math.atan2(-Math.sin(yaw), -Math.cos(yaw));
      const deg = ((a * 180) / Math.PI + 540) % 360 - 180; // −180..180, + = to the left
      if (Math.abs(deg) < 35) parts.push('ahead');
      else if (Math.abs(deg) > 135) parts.push('behind you');
      else parts.push(deg > 0 ? 'to the left' : 'to the right');
    }
    return parts.join(', ');
  }

  /** "[label, where]" (no pos: "[label]"). Repeats of the same key refresh instead of stacking. */
  sound(label, pos, listenerPos, yaw, key = label) {
    if (!label) return;
    this.show(pos ? `[${label}, ${this.where(pos, listenerPos, yaw)}]` : `[${label}]`, key);
  }

  /** A spoken line: "Speaker: text". */
  line(speaker, text, seconds) { this.show(speaker ? `${speaker}: ${text}` : text, 'line:' + text, seconds, 'speech'); }

  /** force: show even with subtitles off (a prompt the player must see). */
  show(text, key = text, seconds = TUNING.subtitles.seconds, cls = '', force = false) {
    if (!settings.subtitles && !force) return;
    let l = this.lines.find((x) => x.key === key);
    if (!l) {
      l = { el: document.createElement('div'), key, t: 0 };
      if (cls) l.el.className = cls;
      this.el.append(l.el);
      this.lines.push(l);
      while (this.lines.length > TUNING.subtitles.maxLines) this.lines.shift().el.remove();
    }
    l.el.textContent = text;
    l.t = seconds;
    l.el.style.opacity = '1';
  }

  clear(key) {
    const i = this.lines.findIndex((x) => x.key === key);
    if (i >= 0) { this.lines[i].el.remove(); this.lines.splice(i, 1); }
  }

  /** Per frame: fade out and remove old lines. */
  update(dt) {
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const l = this.lines[i];
      l.t -= dt;
      if (l.t < 0.5) l.el.style.opacity = String(Math.max(0, l.t / 0.5));
      if (l.t <= 0) { l.el.remove(); this.lines.splice(i, 1); }
    }
  }
}

export const subtitles = new Subtitles();
