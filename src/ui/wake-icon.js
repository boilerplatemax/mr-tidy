// The small sleeping-face icon in the corner (build prompt 0.8): five stages, from deep sleep with three Z's to wide awake.
// A simple pixel shape for Phase 1. It redraws only when the stage changes.
const W = 26, H = 16;

export class WakeIcon {
  constructor(layer) {
    this.label = layer.label('hud-wake');
    this.stage = -1;
    this.label.place('right', 6, 6);
    this.label.show(true);
  }

  set(stage) {
    if (stage === this.stage) return;
    this.stage = stage;
    const { cv, g } = this.label;
    cv.width = W; cv.height = H;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(8, 7, 5, 0.55)'; g.fillRect(0, 0, W, H);
    // the face: a rough 12-pixel disc
    g.fillStyle = '#c9b48a';
    g.fillRect(4, 3, 8, 10); g.fillRect(3, 4, 10, 8); g.fillRect(2, 6, 12, 4);
    g.fillStyle = '#2a2018';
    if (stage <= 1) { g.fillRect(5, 7, 2, 1); g.fillRect(9, 7, 2, 1); } // shut
    else if (stage === 2) { g.fillRect(5, 6, 2, 1); g.fillRect(9, 6, 2, 1); g.fillRect(5, 7, 1, 1); g.fillRect(10, 7, 1, 1); } // stirring
    else if (stage === 3) { g.fillRect(5, 6, 2, 2); g.fillRect(9, 6, 2, 2); } // nearly open
    else { g.fillRect(5, 5, 2, 3); g.fillRect(9, 5, 2, 3); g.fillRect(7, 10, 2, 2); } // awake, mouth open
    if (stage <= 3) g.fillRect(7, 10, 2, 1);
    // the Z's get fewer as she wakes
    g.fillStyle = '#e8dfc6';
    const zs = [3, 2, 1, 0, 0][stage];
    for (let i = 0; i < zs; i++) { const x = 16 + i * 3, y = 9 - i * 3; g.fillRect(x, y, 3, 1); g.fillRect(x + 1, y + 1, 1, 1); g.fillRect(x, y + 2, 3, 1); }
    this.label._size();
  }
}
