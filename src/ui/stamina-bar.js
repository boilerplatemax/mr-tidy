// The stamina bar: a thin pixel bar at the bottom of the screen, shown only while stamina is being used or refilling.
import { TUNING } from '../data/tuning.js';

const S = TUNING.stamina;

export class StaminaBar {
  constructor(layer) {
    this.label = layer.label('hud-stamina').placeBottom(S.barBottom);
    this.shown = false; this.hold = 0; this.last = -1;
  }

  /** Per rendered frame. */
  frame(player, dt) {
    const inUse = player.mode === 'climb' || player.mode === 'slide' || player.mode === 'hang' || player.stamina < 0.999;
    this.hold = inUse ? S.barHold : Math.max(0, this.hold - dt);
    const show = this.hold > 0;
    if (show) {
      const v = Math.round(player.stamina * (S.barWidth - 2));
      if (v !== this.last) { this.last = v; this.label.set([{ bar: v / (S.barWidth - 2), width: S.barWidth }], 'center'); }
    }
    if (show !== this.shown) { this.shown = show; this.label.show(show); }
  }
}
