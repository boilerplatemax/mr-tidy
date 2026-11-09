# PSX horror starter kit (v1)

The day-one plumbing for a first-person, PS1-style horror game in the browser: plain JavaScript (ES modules), Three.js
vendored locally, no build step, no framework. It's not an engine. It has no opinions about your gameplay: no
monsters, no saves, no story. Just the parts every game like this needs before the first scare works.

## Run it

GLB models and ES modules don't load from `file://`, so run a local server (Node.js, nothing to install):

```
node Tools/serve.mjs
```

Open <http://localhost:8080>. Click **Begin**. In about 30 seconds you'll see every system working: walk on concrete,
gravel, mud and wood, step up onto the platform, hold **E** on the light switch by the doorway, try the locked
cabinet inside, listen for the knock (it gets a caption with a direction), press **Esc** for the settings, and press
**`** for the performance overlay.

Controls: **WASD** move · **mouse** look · **Shift** (hold) jog · **C** crouch · **E** use / hold E · **Esc** pause ·
**`** dev overlay · **F1** dev keys (**L** light preset, **1/2/3** jitter / warp / dither, **4** authored ⇄ clean).

## What's in it

| System | Files | Docs |
| --- | --- | --- |
| PS1 renderer: ~240 lines, fill / 4:3, vertex snap, optional affine warp, 15-bit dither, authored / clean presets, nearest upscale. PS1 material, light zones, indoor boxes, sky + fog | `src/render/` | [docs/renderer.md](docs/renderer.md) |
| Fixed-timestep loop with render interpolation | `src/core/loop.js` | [docs/controller.md](docs/controller.md) |
| First-person controller: pointer lock, mouselook, walk / jog / crouch, accel / decel, head-bob, footsteps by surface, box + cylinder colliders with sliding and step-up | `src/player/player.js`, `src/physics/collision.js`, `src/core/input.js` | [docs/controller.md](docs/controller.md) |
| Settings (localStorage, versioned, migrations, listeners) and the title / pause / settings menu | `src/data/settings.js`, `src/ui/menu.js` | [docs/settings.md](docs/settings.md) |
| Audio: AudioContext on first click, positional HRTF, occlusion, indoor / outdoor reverb, sound bank, synth placeholders | `src/audio/` | [docs/audio.md](docs/audio.md) |
| Interaction: look-at picker, "E — Use" / "Hold E — …" prompt with a bar, blocked-action reasons. Pixel font, HUD labels, captions with direction words | `src/player/interaction.js`, `src/ui/` | [docs/interaction.md](docs/interaction.md) |
| Dev tools: fps / draw-call / triangle overlay, static server, headless page check | `src/ui/dev-overlay.js`, `Tools/` | [docs/dev-tools.md](docs/dev-tools.md) |
| Every number in one file, each one commented | `src/data/tuning.js` | |
| An agent brief, a build-plan template and a milestone runner for working with Claude Code | `CLAUDE-template.md`, `build-prompts-template.md`, `run-milestones.ps1` | |

## Folder map

```
index.html              entry point (the import map points "three" at lib/)
lib/three/              Three.js 0.170.0, vendored (MIT, see its LICENSE). Never edit; re-vendor to upgrade
src/main.js             wires everything together around the demo: start here
src/data/tuning.js      every tunable number (the demo's too)
src/data/settings.js    player settings + look presets
src/core/               input, the fixed-timestep loop
src/render/             PS1 renderer, PS1 material, sky / fog, geometry + GLB helpers
src/physics/            the collision world (hand-authored proxies)
src/player/             the controller, look-at interaction
src/audio/              audio engine, sound bank, synth
src/ui/                 menu, pixel font, HUD labels, prompt, captions, dev overlay
src/demo/               the grey-box demo scene: delete it when you start
Tools/                  serve.mjs (static server), check-page.mjs (headless check + screenshot)
docs/                   one page per system
```

## Start a new game from it (about 10 minutes)

1. **Copy the folder** and rename it (`my-game/`). It's self-contained.
2. **Edit `src/data/tuning.js`:** set `game.title` and, importantly, `game.storagePrefix` (otherwise two games on one
   origin share their settings). Change the `<title>` in `index.html`.
3. **Run it** (`node Tools/serve.mjs`) and check it still loads.
4. **Replace the demo:** write your own `src/world/` builder that returns the same shape as `buildDemo()` (`zones`,
   `indoor`, `spawn`, `tick()`, `startSound()`), swap the import in `src/main.js`, then delete `src/demo/` and the
   `demo` section of `tuning.js`.
5. **Make it yours:** add your sounds to `src/audio/sound-bank.js`, your controls to `CONTROL_COLUMNS` in
   `src/ui/menu.js`, your surfaces to `TUNING.surfaces`.
6. **Working with Claude Code?** Copy `CLAUDE-template.md` to `CLAUDE.md` and fill in the blanks, write your build
   plan from `build-prompts-template.md`, and run milestones with `run-milestones.ps1`.

## Load a GLB with the PS1 material

```js
import { loadGLB } from './render/geometry.js';

const gltf = await loadGLB('game-assets/models/chair.glb');          // every material → PS1 Lambert, nearest texels
scene.add(gltf.scene);
world.addBox(x, 0.45, z, 0.5, 0.9, 0.5, yaw, { surface: 'wood' }); // collision is a hand-placed proxy, never the mesh
```

Big static pieces (floors, walls): `loadGLB(url, { subdivide: TUNING.render.subdivideMaxEdge })`. Skinned
characters: clone with `SkeletonUtils.clone()` (in `lib/three/addons/utils/`). Try any model in the demo with
`?glb=path/to/model.glb`. Rules every model should pass: 1 unit = 1 m, pivot at the base centre, nothing floating or
sinking, no inverted faces, textures 64–256 px.

**Never name a folder `assets/` next to a source library called `Assets/`:** Windows ignores case, so they're the same
folder. Use something like `game-assets/` (lowercase, no spaces) for the files the game loads.

## Not included (on purpose)

Monsters / AI, a day or night director, saves of a run, an inventory, any models or music. Those are per game. The
asset workbench (budgets, decimation, Mixamo preview, GLB export) lives in the project this kit came from
(`Tools/workbench.html` there): grab it from there if you need it.

## Licence

Three.js is MIT (`lib/three/LICENSE`). Everything else in this folder is yours: see [LICENSE.md](LICENSE.md).
