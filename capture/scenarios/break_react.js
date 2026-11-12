// A teacup off the coffee table, and he comes hurrying to clean it up, all smiles.
export default {
  title: 'He cleans it up', seconds: 16, gif: [1.5, 6],
  setup(c) {
    c.placeOn('coffeeTable', Math.PI / 2 + 0.3, -0.35, 3.55, 2.42); // on the coffee table, the cup just ahead
    c.vacAt('Ld', 1, -2.0); c.calmVac(); c.K.count = 0; c.V.frozen = true;
  },
  async script(c) {
    await c.lookAtThing('cup1', 0.6, 0);
    await c.wait(0.6);
    await c.swipe();
    await c.track(() => { const o = c.K.byId.get('cup1'); return [o.x, Math.max(0.05, o.y), o.z]; }, 0.9, { rate: 8 });
    c.V.frozen = false;
    await c.watchVac(13, { rate: 3.5 });
  },
};
