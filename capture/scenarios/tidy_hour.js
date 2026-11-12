// "The Mister Tidy Hour" on Grandma's TV... and the real one.
export default {
  title: 'Mr Tidy Hour', seconds: 20, gif: [0.5, 6],
  setup(c) {
    c.place(4.2, 0.001, 2.104, -Math.PI / 2, 0.1);
    c.vacAt('L3', 4, 0); c.K.count = 20; c.calmVac(); c.V.frozen = true;
  },
  async script(c) {
    c.shot({ pos: [4.25, 0.62, 2.104], look: [5.25, 0.6, 2.104], fov: 42 });
    c.kit.tv.set('show');
    c.titles([[0.3, 'THE SHOW', 3]]);
    await c.wait(15.6);
    c.titles([[0, 'THE REAL ONE', 4]]);
    c.vacAt('L2', 4, 0.4); c.V.frozen = true; c.calmVac();
    await c.wait(0.05);
    const f = c.kit.closeup._faceShot([1.0, 0.85, 0.7]); // (square in front of his face, with a clear view of it)
    c.shot({ pos: [f.pos.x, f.pos.y - 0.05, f.pos.z], look: [f.look.x, f.look.y, f.look.z], fov: 50 });
    c.V._shriek?.(true);
    await c.wait(4.2);
  },
};
