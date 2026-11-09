// Look-at interaction. The looked-at object brightens a little and breathes (a multiplicative highlight in the PS1
// shader), and the prompt (src/ui/prompt.js) names the action: "E — Open", "Hold E — Turn on the lamp". If the thing
// can't be used right now the prompt says why, greyed ("Locked. Needs a key"); E on it is refused with a dull thud
// and the reason flashes. E is never silently ignored.
// Tap-E fires on press. Hold-E fills while E is held and you keep looking (a short grace lets you glance off); the bar
// under the prompt fills with it, alongside rising ticks (sound). Letting go or looking away cancels.
//
// An interactable: {
//   object,                       the Object3D you look at (its meshes get the highlight)
//   box?,                         a THREE.Box3 to pick against (default: the object's bounds + 3 cm)
//   kind: 'tap' | 'hold', hold?:  seconds (hold only)
//   label: string | (ctx) → string             the action's words ("Open")
//   canUse?(ctx) → bool                         false: not usable now...
//   why?(ctx) → string | null                   ...and this greyed reason shows (null: not shown at all)
//   canStart?(ctx), whyStart?(ctx)              hold only: refused at the press, with this reason
//   onUse(ctx), onHoldTick?(ctx, p), onDenied?(ctx), prePick?() (update a moving box)
//   hint?: string | (ctx) → string              a dim second line: what it's for
//   reach?: number | (ctx) → number             metres, instead of TUNING.interact.reach
//   tag?                                        colliders with the same tag don't block the look ray (its own proxy)
//   enabled?                                    false: skipped }
import * as THREE from 'three';
import { TUNING } from '../data/tuning.js';
import { audio } from '../audio/audio.js';

const T = TUNING.interact;
const val = (v, ctx) => (typeof v === 'function' ? v(ctx) : v);

/** The prompt line's shared state: anything can flash a refusal on it ("Hands full"). */
export const promptBus = { flash: null, flashT: 0, say(text) { this.flash = text; this.flashT = TUNING.prompt.flashSeconds; } };

export class Interaction {
  constructor(camera, world, input) {
    this.camera = camera; this.world = world; this.input = input;
    this.items = new Set();
    this.target = null;
    this.blocked = null; // { it, reason, d } the nearest thing in view you can't use right now
    this._targetD = Infinity;
    this.hold = null; // { it, t, p, grace, nextTick }
    this.time = 0;
    this.ctx = {}; // your game's context object, passed to every callback ({ player, inventory, ... })
    this._ray = new THREE.Ray();
    this._pt = new THREE.Vector3();
    this._o = { x: 0, y: 0, z: 0 }; this._d = { x: 0, y: 0, z: 0 };
    this._blk = { it: null, reason: '', d: 0 };
  }

  add(it) {
    it.kind = it.kind || 'tap';
    if (!it.box) { it.object.updateMatrixWorld(true); it.box = new THREE.Box3().setFromObject(it.object).expandByScalar(0.03); }
    if (!it.materials) { it.materials = []; it.object.traverse((o) => { if (o.isMesh) it.materials.push(...[].concat(o.material)); }); }
    this.items.add(it);
    return it;
  }

  remove(it) { if (this.target === it) this._setTarget(null); if (this.hold?.it === it) this.cancelHold(); this.items.delete(it); }
  refreshBox(it) { it.object.updateMatrixWorld(true); it.box.setFromObject(it.object).expandByScalar(0.03); }

  _setTarget(it) {
    if (this.target === it) return;
    if (this.target) for (const m of this.target.materials) if (m.userData.ps1Highlight) m.userData.ps1Highlight.value = 0;
    this.target = it;
  }

  _occluded(it, d) {
    const o = this._o, dd = this._d;
    o.x = this._ray.origin.x; o.y = this._ray.origin.y; o.z = this._ray.origin.z;
    dd.x = this._ray.direction.x; dd.y = this._ray.direction.y; dd.z = this._ray.direction.z;
    const hit = this.world.raycast(o, dd, d, (c) => c.solid && (!it.tag || c.tag !== it.tag), false);
    return !!hit && hit.t < d - 0.05;
  }

  /** The nearest usable interactable along the view ray, within reach, not behind a collider. Also notes the nearest
   *  one you can't use right now (this.blocked: its greyed reason). */
  _pick() {
    this.camera.getWorldPosition(this._ray.origin);
    this.camera.getWorldDirection(this._ray.direction);
    let best = null, bestD = Infinity, blk = null, blkD = Infinity, blkWhy = null;
    for (const it of this.items) {
      if (it.enabled === false) continue;
      it.prePick?.();
      const p = this._ray.intersectBox(it.box, this._pt);
      if (!p) continue;
      const d = p.distanceTo(this._ray.origin);
      if (d > ((it.reach && val(it.reach, this.ctx)) || T.reach)) continue;
      if (d >= bestD && d >= blkD) continue;
      if (!it.canUse || it.canUse(this.ctx)) { if (d < bestD) { bestD = d; best = it; } }
      else if (d < blkD && it.why) { const w = it.why(this.ctx); if (w) { blk = it; blkD = d; blkWhy = w; } }
    }
    if (best && this._occluded(best, bestD)) best = null;
    if (blk && this._occluded(blk, blkD)) blk = null;
    this._targetD = best ? bestD : Infinity;
    if (blk) { this._blk.it = blk; this._blk.reason = blkWhy; this._blk.d = blkD; this.blocked = this._blk; } else this.blocked = null;
    return best;
  }

  labelOf(it) { return val(it.label, this.ctx) || 'Use'; }
  refused(it) { return it.kind === 'hold' && !!it.canStart && !it.canStart(this.ctx); }
  refusedWhy(it) { return val(it.whyStart, this.ctx) || "Can't do that yet"; }

  _deny(text, it) {
    audio.play('item.denied');
    promptBus.say(text);
    it?.onDenied?.(this.ctx);
    this.input.edges.delete('KeyE');
  }

  /** Per fixed tick. */
  tick(dt) {
    this.time += dt;
    const I = this.input;
    const picked = this._pick();
    if (this.hold) {
      const h = this.hold;
      if (picked === h.it) h.grace = T.holdGrace; else h.grace -= dt;
      if (!I.down('KeyE') || h.grace <= 0) this.cancelHold();
      else {
        h.t += dt;
        const p = Math.min(1, h.t / h.it.hold);
        h.p = p;
        h.nextTick -= dt; // rising ticks: the gap shrinks as you get closer to done
        if (h.nextTick <= 0 && p < 1) { h.nextTick = 0.34 - 0.2 * p; audio.play('hold.tick', { rate: 0.85 + p * 0.5, gain: 0.7 + p * 0.5 }); h.it.onHoldTick?.(this.ctx, p); }
        if (p >= 1) {
          const it = h.it;
          this.hold = null;
          audio.play('hold.done');
          it.onUse(this.ctx);
        }
      }
    }
    if (!this.hold) {
      this._setTarget(picked);
      if (picked && I.pressed('KeyE')) {
        if (picked.kind === 'hold') {
          if (this.refused(picked)) this._deny(this.refusedWhy(picked), picked);
          else this.hold = { it: picked, t: 0, p: 0, grace: T.holdGrace, nextTick: 0 };
        } else { picked.onUse(this.ctx); I.edges.delete('KeyE'); }
      } else if (!picked && this.blocked && I.pressed('KeyE')) this._deny(this.blocked.reason, this.blocked.it);
    }
    if (this.target) { // the highlight breathes gently while looked at
      const v = T.highlight * (0.75 + 0.25 * Math.sin(this.time * T.pulse * Math.PI));
      for (const m of this.target.materials) if (m.userData.ps1Highlight) m.userData.ps1Highlight.value = v;
    }
  }

  /** True while E belongs to an interactable (so another system doesn't also act on it). */
  get busy() { return !!this.target || !!this.hold; }

  /** The prompt for what you're looking at, or null: { text, dim, sub?, progress? } (read by src/ui/prompt.js). */
  promptFor() {
    const h = this.hold;
    if (h) return { text: `Hold E — ${this.labelOf(h.it)}`, dim: false, progress: h.p };
    const it = this.target;
    if (it) {
      if (this.refused(it)) return { text: this.refusedWhy(it), dim: true };
      const b = this.blocked;
      const sub = (b && b.it.object === it.object && Math.abs(b.d - this._targetD) < 0.4 ? b.reason : null) ?? (val(it.hint, this.ctx) || null);
      return { text: `${it.kind === 'hold' ? 'Hold E' : 'E'} — ${this.labelOf(it)}`, dim: false, sub };
    }
    if (this.blocked) return { text: this.blocked.reason, dim: true };
    return null;
  }

  cancelHold() { this.hold = null; }
}
