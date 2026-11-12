// Up on the sideboard, out of reach: so he lobs it. A slow arc of dust that comes down right on you.
export default {
  title: 'Lob shot', seconds: 8, gif: [1, 6],
  setup(c) {
    c.placeOn('dTable', Math.PI / 2 - 0.6, -0.3, 3.55, -4.3); // the east end of the dining table
    c.vacAt('D2', 4, 1.9); c.K.count = 20; c.calmVac(); c.V.frozen = true;
  },
  async script(c) {
    const V = c.V;
    await c.watchVac(1.2, { rate: 4 });
    V.frozen = false; V.seesCat = true; V._startBlast(); V.lob = true;
    await c.until(() => V.state !== 'BLAST' || V.blasts.some((q) => q.state === 'fly'), 3);
    c.until(() => V.state !== 'BLAST', 4).then(() => { V.frozen = true; });
    await c.track(() => { const b = V.blasts.find((q) => q.state === 'fly'); const p = b?.pos || b?.mesh?.position; return p ? [p.x, p.y, p.z] : c.vacPt(); }, 2.6, { rate: 7 });
    V.frozen = true;
    await c.watchVac(3, { rate: 3 });
  },
};
