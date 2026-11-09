# Mr. Tidy

A PS1-style horror game: you're a house cat knocking things over at night, hunted by a shop vac. Phase 1 (the grey-box
MVP) is in progress. The design is in `cat-vacuum-horror-build-prompt.md`; `starter-kit/` is the untouched reference copy
of the kit this was built from (`docs/kit/` has a page per kit system).

## Run it

ES modules need a local server (Node.js, nothing to install):

```
node Tools/serve.mjs
```

Open <http://localhost:8080> and click **Begin**.

## Controls

| Key | Action |
|---|---|
| W A S D, mouse | Move, look |
| Shift (hold) | Run |
| C (hold) | Slink: slow, low, silent |
| Space (hold, release) | Charge and jump. Tap for a hop. An outline marks where a charged jump will land |
| Space while hanging | Pull up |
| S or C while hanging | Let go |
| W into a striped surface | Claw climb (uses stamina) |
| Space while climbing | Kick off, the way you're looking or with A / D to the side |
| Esc | Pause and settings |

Debug: **F1** overlay · **F2** third-person camera · **F3** noclip (WASD, Space, C, Shift) · **F9** key list.

## Tuning

Every number that affects feel is in `src/data/tuning.js` (`TUNING` is the build prompt's `CONFIG`). The house layout is
data, in `src/data/level.js`.

After changing the level or the jump numbers, run the route check. It jumps every link in both directions with the real
controller and tests ledge grabs and climbing (it proves a jump is possible, not that it feels good):

```
node Tools/serve.mjs 8123
node Tools/check-page.mjs "http://localhost:8123/?play" out.png "window.__kitReady" 60000 "__routeBot()"
```
