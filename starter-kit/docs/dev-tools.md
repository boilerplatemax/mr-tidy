# Dev tools

**Files:** `src/ui/dev-overlay.js`, `Tools/serve.mjs`, `Tools/check-page.mjs`, the dev keys in `src/main.js`

## What they do

- **Overlay** (**`** or `?dev`): fps, average and worst frame time, draw calls, triangles, internal resolution and
  scale, look and light preset, position, gait and surface, audio voices. Add lines with `overlay.lines`. Flash a
  message with `overlay.note('jitter off')`.
- **Dev keys** (**F1** lists them): **L** light preset, **1 / 2 / 3** jitter / warp / dither, **4** authored ⇄ clean.
- **Static server:** `node Tools/serve.mjs [port] [root]` serves the folder (default port 8080, root `.`), with the
  right MIME types and no caching. GLBs and ES modules need it: they don't load from `file://`.
- **Headless page check:** `node Tools/check-page.mjs <url> [out.png] [readyExpr] [timeoutMs] [reportExpr]` opens
  the page in headless Chrome or Edge, waits for `readyExpr`, prints every console message, saves a screenshot and
  exits 1 on any error or warning. `reportExpr` is evaluated after ready (it may return a promise) and its JSON is
  printed: use it for quick scripted checks.

```
node Tools/serve.mjs 8080
node Tools/check-page.mjs "http://localhost:8080/?play" shot.png "window.__kitReady"
node Tools/check-page.mjs "http://localhost:8080/?play" shot.png "window.__kitReady" 20000 "__menuFit()"
GPU=1 SIZE=1920,1080 node Tools/check-page.mjs "http://localhost:8080/?play&dev" gpu.png "window.__kitReady"
```

`?play` skips the title and runs without pointer lock (headless browsers can't lock). `window.__kit` holds every
system for console poking. `GPU=1` uses the real graphics card (for frame-time checks); the default is software
rendering (stable screenshots). `CHROME=path` picks the browser.

## Knobs

None in tuning; `SIZE`, `GPU` and `CHROME` are environment variables for the check.

## Gotchas we hit

- **Check the overlay after every milestone.** Target a locked 60 fps on integrated graphics. Draw calls are the
  usual cost: merge static geometry that shares a material and instance repeats (fence posts, grass).
- **No allocations in the loop.** Reuse vectors and objects; `new` in a per-frame path shows up as periodic
  garbage-collection stutter (the worst-frame number).
- **Headless isn't a playtest.** It proves the page loads, nothing throws and the numbers are sane. Feel, fear and
  clarity need a human with a mouse.
- **Stop the servers you start.** A dev server left running keeps a scripted session (or a batch runner) from
  exiting.
- **Never name a folder `assets/` next to `Assets/`** on Windows: it's the same folder, and generated files land in
  your source library.
- **Headless window sizes:** the inner size is smaller than `SIZE` (browser chrome), so the line count may differ a
  little from a real window.
