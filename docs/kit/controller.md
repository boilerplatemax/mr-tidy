# Controller, colliders, input and the loop

**Files:** `src/player/player.js`, `src/physics/collision.js`, `src/core/input.js`, `src/core/loop.js`

## What it does

- **Input:** keyboard state, per-tick edges (`pressed` / `released`), mouse deltas, pointer lock. Losing pointer lock
  (Esc) or hiding the tab fires `pause`; regaining the lock fires `resume`. The first `requestLock()` fires
  `firstClick` (start audio there).
- **Loop:** gameplay ticks at a fixed 60 Hz; the frame draws interpolated between the last two ticks.
- **Player:** walk, jog (hold Shift), crouch (C, toggle or hold, held down under low ceilings), short exponential
  accel / decel (no ice), backwards slower, gravity, step-up onto anything up to `stepHeight`, a smoothed eye on
  stairs, a landing dip, footsteps by the surface under you (sound family + speed + loudness), and a head-bob whose
  phase is locked to the footsteps. Mouselook runs every rendered frame, not per tick (no lag).
- **Collision world:** hand-authored proxies only: yaw-rotated boxes and vertical cylinders, plus flat or
  heightfield ground with surface regions. The player is a circle pushed out of every overlapping proxy, with
  velocity clipped along the contact normal, so you slide along walls. Moves are substepped (no tunnelling) and an
  overlapping result is rejected (no corner wedges). Zero allocations per query.

## API

```js
const world = new CollisionWorld();
world.addBox(cx, cy, cz, sx, sy, sz, yaw, { surface: 'wood', occludes: true, tag: 'door' }); // centre + full size
world.addBoxMinMax(min, max, opts);  world.addCylinder(x, z, r, minY, maxY, opts);
world.addRegion(minX, maxX, minZ, maxZ, 'gravel');   // ground surface (the last added wins)
world.defaultSurface = 'concrete';   world.heightAt = (x, z) => h;  // optional terrain
collider.enabled = false;            // a door swung open
world.raycast(origin, dir, maxDist, filter);  world.countOccluders(a, b);  world.penetration(...)

const input = new Input(canvas);  input.on('pause' | 'resume' | 'firstClick', fn);
input.down('KeyW'); input.pressed('KeyE'); input.live; input.consumeEdges() // once per tick, after gameplay

const player = new Player(camera, world, input);
player.teleport(x, y, z, yaw);  player.onStep = (gait, surface) => {...};  // hook AI hearing here
player.speedMul = 0.8;  player.frozen = true;  player.viewDip = 0.05;

const loop = new FixedLoop({ tick, frame, live: () => input.live });  loop.start();
// tick(dt): player.snapView() first, then gameplay, then input.consumeEdges()
// frame(alpha, dt, ms): player.look(); player.render(alpha); ...; ps1.render(scene, camera)
```

## Knobs (`TUNING.player`, `TUNING.surfaces`, `TUNING.loop`)

Radius, heights, eye heights, crouch time, step height and smoothing, gravity, walk / jog / crouch speeds,
backward multiplier, accel / decel, air control, look sensitivity and pitch limit, bob amplitude per gait plus sway
and roll, stride per gait (footstep spacing), bob lock and gait ease, landing dip. Surfaces: `speed`, `gain`, and
`sound` (the footstep family when it differs from the name). Loop: `step`, `maxSteps`, `maxFrame`.

## Gotchas we hit

- **Interpolate everything the camera uses, not just the position.** A view offset set per tick (a dip, a recoil, a
  landing) but drawn raw holds for 2–3 frames at 144 Hz and then jumps. In the clean look that reads as a hand
  shake. Keep last tick's copy (`snapView()` at the start of each tick) and lerp with alpha in `render()`. The same
  goes for a viewmodel: its sway and bob must use the interpolated values (`player.bobPh`, `bobW`, `bobA`).
- **Paused means alpha = 1.** Interpolating while paused rocks the camera between two ticks.
- **Never use `%` to wrap an angle** (it keeps the sign). Use `wrapAngle()`.
- **Crouch is C, not Ctrl.** Ctrl+W closes the tab.
- **Step height vs. thresholds.** Anything you want walked over (a porch step, a door sill) must be under
  `stepHeight`; anything that should block must be taller, or set `noStep: true`.
- **Footsteps come from distance travelled**, not from keys held, so walking into a wall is silent.
- **Mouse spikes.** Browsers sometimes report a huge movement right after locking; the input ignores jumps over
  400 px.
- **Collision is proxies only.** Never collide against a detailed mesh: place a box or cylinder per prop by hand.
  Check every doorway with the player crouched and standing.
