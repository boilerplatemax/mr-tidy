// "I'm gonna DUST it up!": he empties his bag, and the whole house fills with dust.
export default {
  title: 'Dust it up', seconds: 13, gif: [1, 6],
  setup(c) {
    c.placeOn('couchBack', Math.PI / 2 + 0.6, -0.35, 0.33, 2.6);
    c.vacAt('L2', 3, 0.6); c.K.count = 15; c.calmVac(); c.V.frozen = true;
  },
  async script(c) {
    await c.lookAt(c.V.x, 0.35, c.V.z, 0.4);
    c.titles([[0, "HE CAN'T REACH ME\nUP HERE", 2.4]]);
    await c.wait(2.2);
    c.V.frozen = false; c.V._startFog();
    c.titles([[2.4, 'WHAT IS HE DOING', 2.2], [5.5, 'OH NO', 3]]);
    await c.wait(13);
  },
};
