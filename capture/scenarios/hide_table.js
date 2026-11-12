// Hiding under the dining table, between the chair legs, while he hunts the room.
export default {
  title: 'Under the table', seconds: 19, gif: [4, 6],
  setup(c) {
    c.place(3.0, 0.001, -4.0, -Math.PI / 2 - 0.25, 0.06); c.hold('KeyC'); // under the table, looking out past the east chair
    c.vacAt('Dd', 3, Math.PI); c.calmVac(); c.K.count = 15;
    c.TUNING.vac.sightRange = [0, 0, 0, 0, 0]; c.TUNING.vac.hearSteps = 0; // (staged: he mustn't find it this time)
    c.V.frozen = true;
  },
  async script(c) {
    const V = c.V, go = (n) => { V.frozen = false; V.routeTo(V.nav.nodes.get(n)); }, follow = (s) => c.during(s, () => { c.P.yaw += Math.atan2(Math.sin(Math.atan2(-(V.x - c.P.pos.x), -(V.z - c.P.pos.z)) - c.P.yaw), Math.cos(Math.atan2(-(V.x - c.P.pos.x), -(V.z - c.P.pos.z)) - c.P.yaw)) * 0.05; });
    c.hold('KeyC');
    c.titles([[0, 'HE HEARD SOMETHING\nIN HERE', 3]]);
    go('D5');
    await follow(3.2);
    go('D4');
    c.titles([[0.2, "DON'T. BREATHE.", 3]]);
    await follow(3.5);
    V.frozen = true; // he stops and listens
    await follow(3);
    go('D3');
    await follow(3);
    go('Dd');
    c.titles([[0.5, 'HE WILL BE BACK', 3]], 'low');
    await follow(4);
  },
};
