// The action prompt, bottom-centre, small, in the HUD's pixel font: "E — Open", "Hold E — Turn on the lamp" (with a
// progress bar), or a greyed reason ("Locked. Needs a key"). A refused E flashes the reason. Tasks only: the HUD says
// what you can do, never what's out there.
import { TUNING } from '../data/tuning.js';
import { promptBus } from '../player/interaction.js';

const P = TUNING.prompt;
const FLASH = '#d6a184'; // a refusal: warm, not alarming

export class Prompt {
  /** layer: HudLayer; interaction: Interaction; input: Input. extraRows?(): more rows from your game (a held item). */
  constructor({ layer, interaction, input, extraRows = null }) {
    Object.assign(this, { layer, interaction, input, extraRows });
    this.label = layer.label('hud-prompt').place('center', 0, P.y);
    this.rows = [];
    this.text = ''; // the first line as shown (tests read it)
    this.visible = false;
    this._t = 0;
  }

  /** What the prompt says right now: [{ text, dim?, color? } | { bar, width }]. */
  compose() {
    const out = [], I = this.interaction;
    if (promptBus.flashT > 0 && promptBus.flash) out.push({ text: promptBus.flash, color: FLASH });
    const p = I.promptFor();
    if (p) {
      if (!(p.dim && out.length && out[0].text === p.text)) out.push({ text: p.text, dim: p.dim }); // (the flash already says it)
      if (p.sub) out.push({ text: p.sub, dim: true });
      if (p.progress != null) out.push({ bar: p.progress, width: P.barWidth });
    }
    if (this.extraRows) out.push(...this.extraRows());
    return out;
  }

  /** Per fixed tick: the flash timer. */
  tick(dt) { if (promptBus.flashT > 0) promptBus.flashT -= dt; }

  /** Per rendered frame; rebuilt every P.refresh s (no per-frame garbage). The label redraws only when it changed. */
  frame(dt) {
    if (dt !== undefined) { this._t += dt; if (this._t < P.refresh) return; this._t = 0; }
    const rows = this.input.live ? this.compose() : [];
    for (const r of rows) if (r.bar != null) r.bar = Math.round(r.bar * (P.barWidth - 2)) / (P.barWidth - 2); // quantised to its pixels
    this.rows = rows;
    this.text = rows.find((r) => r.text)?.text || '';
    if (rows.length) this.label.set(rows, 'center');
    const vis = rows.length > 0;
    if (vis !== this.visible) { this.visible = vis; this.label.show(vis); }
  }
}
