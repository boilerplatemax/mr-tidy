// The win screen's backdrop: the very things you knocked over, as their own little models, tumbling slowly down behind the
// card. A small renderer of its own at a low resolution (scaled up pixelated, like the game), lit plainly, started when the
// screen shows and torn down when it goes.
import * as THREE from 'three';

const MAX = 40;

export class Fallen3D {
  /** knock: the Knockables (it makes the models, the same way it makes them in the house). */
  constructor(knock) { this.knock = knock; this.r = null; this.raf = 0; this.items = []; this.mats = []; }

  /** ids: the kinds of thing knocked over, one per knock-over (TUNING props ids). */
  start(container, ids) {
    this.stop();
    if (!ids?.length) return;
    const canvas = document.createElement('canvas'); canvas.className = 'fall3d'; container.prepend(canvas); this.canvas = canvas;
    const W = Math.max(160, Math.round(window.innerWidth / 3)), H = Math.max(90, Math.round(window.innerHeight / 3));
    try { this.r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false }); } catch { canvas.remove(); return; } // (no second context to be had: just the card)
    this.r.setPixelRatio(1); this.r.setSize(W, H, false); this.r.outputColorSpace = THREE.SRGBColorSpace;
    const scene = this.scene = new THREE.Scene(), cam = this.cam = new THREE.PerspectiveCamera(40, W / H, 0.1, 50);
    cam.position.set(0, 0, 7);
    scene.add(new THREE.HemisphereLight(0xfff0dc, 0x3a2420, 1.6));
    const sun = new THREE.DirectionalLight(0xffe0b8, 1.2); sun.position.set(2, 3, 4); scene.add(sun);
    const byType = new Map(this.knock.list.map((o) => [o.t.id, o.t]));
    const span = Math.tan((cam.fov * Math.PI) / 360) * cam.position.z, wide = span * cam.aspect;
    ids.slice(0, MAX).forEach((id, i) => {
      const t = byType.get(id); if (!t) return;
      const g = new THREE.Group();
      try { g.add(this.knock._clone(t.nodes.intact)); for (const part of t.nodes.parts || []) g.add(this.knock._clone(part)); } catch { return; }
      g.traverse((o) => { // plain lit copies of its materials (the house's own ones are set up for the game's view)
        if (!o.isMesh) return;
        const swap = (m) => { const n = new THREE.MeshLambertMaterial({ map: m.map || null, color: m.color ? m.color.clone() : 0xffffff, vertexColors: !!m.vertexColors, transparent: !!m.transparent, opacity: m.opacity ?? 1, side: THREE.DoubleSide }); this.mats.push(n); return n; };
        o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
      });
      const box = new THREE.Box3().setFromObject(g), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      const k = 0.75 / Math.max(1e-3, size.x, size.y, size.z); // (all about the same size, so a thimble and a lamp both read)
      const holder = new THREE.Group(); g.position.sub(c); holder.add(g); holder.scale.setScalar(k);
      holder.position.set((Math.random() * 2 - 1) * (wide - 0.4), -span + ((i * 0.618) % 1) * (span * 2 + 1.2), (Math.random() - 0.5) * 1.5); // (spread over the screen from the start, not all waiting above it)
      holder.rotation.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
      scene.add(holder);
      this.items.push({ o: holder, v: 0.35 + Math.random() * 0.35, spin: new THREE.Vector3((Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 1.4), top: span + 0.6, bottom: -span - 0.8, wide });
    });
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      for (const it of this.items) {
        it.o.position.y -= it.v * dt;
        it.o.rotation.x += it.spin.x * dt; it.o.rotation.y += it.spin.y * dt; it.o.rotation.z += it.spin.z * dt;
        if (it.o.position.y < it.bottom) { it.o.position.y = it.top; it.o.position.x = (Math.random() * 2 - 1) * (it.wide - 0.4); } // (and round again)
      }
      this.r.render(scene, cam);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf); this.raf = 0;
    for (const m of this.mats) m.dispose(); this.mats.length = 0; this.items.length = 0;
    if (this.r) { this.r.dispose(); this.r.forceContextLoss?.(); this.r = null; }
    this.canvas?.remove(); this.canvas = null; this.scene = null;
  }
}
