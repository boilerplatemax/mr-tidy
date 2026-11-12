// Along the dining table: everything on it goes, one swipe each.
export default {
  title: 'Good china speedrun', seconds: 14, gif: [2, 6],
  setup(c) { c.placeOn('dChairW', -Math.PI / 2, -0.2); c.vacAt('D1', 1, 0); c.calmVac(); c.V.frozen = true; },
  async script(c) {
    c.titles([[0, "GRANDMA'S GOOD CHINA\nSPEEDRUN (ANY%)", 3]]);
    await c.jump('dTable', 0.2, { edge: false, aimX: 2.45, aimZ: -4.0 });
    const n = (k) => c.titles([[0, `${k}/4`, 1.2]], 'low');
    let k = 0;
    for (const [id, x, z] of [['candle1', 2.45, -3.95], ['wine2', 2.45, -4.05], ['cake', 2.9, -3.9], ['cup2', 3.25, -4.0]]) {
      const o = c.K.byId.get(id); if (o.knocked) { n(++k); continue; }
      await c.walk([[x, z]], { tol: 0.07 });
      await c.lookAtThing(id, 0.25, 0);
      for (let i = 0; i < 3 && !o.knocked; i++) await c.swipe();
      if (o.knocked) n(++k);
    }
    c.V.frozen = false;
    c.titles([[0.3, 'NEW RECORD', 3]]);
    await c.lookAt(1.2, 0.3, -2.4, 0.8);
    await c.wait(4);
  },
};
