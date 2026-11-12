# Capture kit: clips for posting

Scripted scenes, played by the real game frame by frame and recorded with sound. Nothing here loads unless the URL has
`?capture=<scene>` (see `src/debug/capture.js`).

```
node Tools/clips/record.mjs all              # every scene: clips/final/<name>_16x9|1x1|9x16.mp4, clips/gif, clips/stills
node Tools/clips/record.mjs push_mug creep   # just these
node Tools/clips/record.mjs --preview 0.5 push_mug   # quick look: a still every 0.5 s, tiled into clips/preview/push_mug.png
node Tools/clips/montage.mjs                 # the trailer, cut from the recorded clips (edit CUTS in the file)
```

Needs Chrome and ffmpeg (`winget install Gyan.FFmpeg`). It starts the dev server itself if it isn't running. Chrome
runs headless on the graphics card; each frame is screenshotted (so the captions and HUD are in it) and piped to ffmpeg.
The sound comes from an OfflineAudioContext stepped with the frames, so it's in sync however slow the capture is. A
scene is seeded, so it plays the same way every time.

Options: `--fps 30` · `--size 1920x1080` · `--no-formats` (16:9 only) · `--keep` (keep the raw video and WAV).
`clips/report.md` lists each clip's length, size, loudness and any frozen stretches; `clips/contact_sheet.png` has a
frame of each.

## Writing a scene

`capture/scenarios/<name>.js` exports `{ title, seconds, gif: [from, for], setup(c), async script(c) }`. `c` is the
director (`src/debug/capture.js`):

- time: `await c.wait(s)`, `await c.until(() => cond, maxS)`, `await c.during(s, (dt, t) => ...)`
- the cat (real input, real physics): `c.place(x, y, z, yaw, pitch)`, `c.placeOn(solidId, yaw, pitch, x?, z?)` (set-up
  only), `c.walk([[x, z], ...], { run, slink, pitch })`, `await c.jump(solidId | {x, z}, charge, { aimX, aimZ, edge })`,
  `c.swipe()`, `c.lookAt(x, y, z, s)`, `c.lookAtThing(knockableId, s)`, `c.turn(yaw, pitch, s)`, `c.hold('KeyC')`
- him: `c.vacAt(node, anger, heading)`, `c.calmVac({ fog, creep, blast, lurk })` (seconds each trick is held off),
  `c.V.frozen`, `c.V.routeTo(c.V.nav.nodes.get(node))`, `c.V._startFog()`, `c.V._startCreep()`, `c.V.setAnger(5, true)`
- film cameras: `c.shot({ pos, look, fov }, blend)` (pos/look: `[x, y, z]`, a function of t, `'vac'` or `'cat'`);
  `c.shot(null, blend)` goes back to the cat's eyes
- words: `c.title(text, s)` (top), `c.caption(text, s)` (lower), `c.titles([[at, text, for], ...], 'top' | 'low')`

Charges that work for each jump are in the route-bot's report (`node Tools/check-page.mjs ... "__routeBot()"`); add
about 0.1 so it doesn't land on the lip. `c.note()` and his state changes go to the log the recorder prints.
