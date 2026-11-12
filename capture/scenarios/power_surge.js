// Stage 5: he drags the power out of the house. POWER SURGE, the lights die, and it's only his eyes, coming down the hall.
export default {
  title: 'Lights out', seconds: 17, gif: [2, 6],
  setup(c) {
    c.place(1.6, 0.001, -0.6, -Math.PI / 2, 0.05); // the west end of the hall, looking down it
    c.vacAt('H2', 4, Math.PI / 2 + 0.2); c.K.count = 24; c.calmVac(); c.V.frozen = true;
    c.TUNING.vac.sightRange = [0, 0, 0, 0, 0]; // (he comes, but slowly: no chase)
  },
  async script(c) {
    c.titles([[0, 'I BROKE ONE\nTHING TOO MANY', 2.8]]);
    await c.lookAt(c.V.x, 0.35, c.V.z, 0.5);
    await c.wait(2.4);
    c.V.frozen = false; c.V.setAnger(5, true);
    await c.until(() => c.V.state !== 'SURGE', 6);
    await c.lookAt(c.V.x, 0.32, c.V.z, 0.3);
    c.titles([[0.3, 'ONLY HIS EYES', 2.6]]);
    c.V.routeTo(c.V.nav.nodes.get('Hl'));
    await c.during(6, () => { c.P.yaw += 0; });
    await c.wait(1);
  },
};
