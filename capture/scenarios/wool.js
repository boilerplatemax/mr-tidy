// His ball of best wool, up on the curtain rod. He HATES wool.
export default {
  title: 'Not the wool', seconds: 12, gif: [1.5, 6],
  setup(c) { c.placeOn('rodE', -Math.PI / 2, -0.4, 4.66, 5.2); c.vacAt('L5', 2, Math.PI); c.calmVac(); c.V.frozen = true; c.K.count = 8; },
  async script(c) {
    c.titles([[0, 'HE HAS ONE\nWEAKNESS', 2.6]]);
    await c.lookAtThing('woolGold', 0.6, 0);
    await c.wait(0.6);
    await c.swipe();
    c.V.frozen = false;
    await c.lookAt(4.9, 0, 4.4, 0.6);
    await c.wait(1.2);
    await c.lookAt(c.V.x, 0.35, c.V.z, 0.6);
    await c.wait(6);
  },
};
