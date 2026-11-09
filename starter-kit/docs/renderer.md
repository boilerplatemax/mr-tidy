# Renderer and look presets

**Files:** `src/render/ps1-renderer.js`, `src/render/ps1-material.js`, `src/render/environment.js`, `src/render/geometry.js`

## What it does

The scene renders into a small float buffer (about 240 lines tall), then a post pass converts to sRGB, applies
brightness, quantises to 15-bit colour with a 4×4 Bayer dither, and draws into a canvas at that same small size. CSS
scales the canvas up by a **whole number** with nearest-neighbour, so every game pixel is exactly k×k screen pixels.

- **Framing:** `fill` (default) uses the screen's own aspect at the same line count; `4:3` pillarboxes.
- **Vertex snapping:** every vertex is snapped to the internal pixel grid (the PS1 polygon jitter). First-person
  items on `LAYER_VIEWMODEL` are drawn after the world with depth cleared and are *not* snapped.
- **Affine warp:** screen-linear UVs blended with perspective-correct ones. Off in both presets.
- **Textures:** nearest texels with a clamped, biased mip level (crisp close up, no sparkle far away).
- **Look presets:** *authored* (jitter, dither, 5-bit colour, 240 lines, no supersample) and *clean* (no jitter, no
  dither, 8-bit colour, 480 lines, 2× supersample, which the post pass box-filters for stable thin details). Changing
  any single option makes the look *custom*.
- **Light zones:** nothing casts shadows, so a point light would shine through walls. Give each room a `Box3` zone:
  a point light only lights fragments in the zone it sits in (outdoors = no zone). Max 8.
- **Indoor boxes:** inside these the sun and sky are scaled down and a flat fill added (per light preset), so a
  roofed room isn't lit by the sun. Max 4.
- **Environment:** fog + sky gradient (the horizon is the fog colour: silhouettes fade with no seam) + hemisphere,
  sun and ambient lights, from presets in `TUNING.lighting`. `blend(a, b, t)` mixes two presets (a day cycle).
- **Post effects:** `POST_FX.vignette` (0–1) darkens and grains the edges: set it each frame for a stare or a scare.

## API

```js
const ps1 = new PS1Renderer(canvas);          // listens to settings + window resize itself
ps1.onResize = () => { camera.aspect = ps1.aspect; camera.updateProjectionMatrix(); };
ps1.render(scene, camera);                     // per frame; ps1.stats = { calls, triangles }
ps1.shadowsActive = true;                      // while your one shadow light is on (TUNING.render.shadows)

makePS1(material)                // patch a Lambert/Basic material in place (safe twice)
toPS1Material(gltfMaterial)      // any loaded material → a PS1 Lambert
uniqueMaterials(object)          // own material copies (so only this object highlights)
material.userData.ps1WarpMul.value = 0.4   // per material: less warp on a big unsubdivided surface
PS1.setLightZones([box3, ...]);  PS1.setIndoorBoxes([box3, ...]);  PS1.zoneOf(point)

env.apply('night');  env.blend('dusk', 'night', 0.3);  env.update(camera) // per frame

subdivide(geometry, maxEdge)     // split long triangles (once, at load)
boxUV(geometry, metresPerTile)   // box-projected UVs: the same texel density on every face
canvasTexture(64, (ctx, n) => {...}) // a pixel texture painted in code (a clean placeholder)
await loadGLB(url, { subdivide }) // a GLB with PS1 materials
```

## Knobs (`TUNING.render`, `TUNING.lighting`)

`targetLines`, `minLines`, `aspect`, `fov`, `near` / `far`, `sceneBuffer` ('half' keeps dark scenes clean),
`jitterPixels`, `warp`, `subdivideMaxEdge`, `colorBits`, `dither`, `maxMipLevel`, `mipBias`, `shadows`. Each lighting
preset: fog colour / near / far, sky top, hemisphere, sun colour / intensity / direction, ambient, indoor sun / sky /
fill, the sun or moon disc. Player-side overrides live in settings (see settings.md).

## Gotchas we hit

- **Warp needs subdivided geometry.** Affine warp swims on big triangles (floors, long walls, doors). Run
  `subdivide()` on large static pieces at load, or lower `ps1WarpMul` on that material. We turned warp off by default
  because doors looked wrong even so; keep it as an option.
- **Integer scale only.** A fractional upscale gives uneven pixel rows that shimmer when you pan. The renderer picks
  k = round(height / lines) and accepts a few lines more or fewer.
- **Don't snap the viewmodel.** Snapped hands twitch pixel to pixel as they sway.
- **Fog is your draw distance.** Keep `far` tight and let the fog end the world; it's also the main mood tool (close
  and heavy at night).
- **A black figure in black fog is invisible.** Give dark shapes something to stand against: a slightly lighter fog
  or sky, or a rim of light.
- **Light zones are boxes.** A bulb doesn't spill out of a doorway: it's the PS1 look, and it never leaks through a
  wall. If you need a spill, add a second, weaker light in the next zone.
- **No full-mesh shadows.** At most one shadow-casting light (a flashlight), `BasicShadowMap`, updated only while on.
