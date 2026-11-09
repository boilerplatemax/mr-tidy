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
| Shift | Dash (once per jump in the air). Keep holding to run |
| C (hold) | Slink: slow, low, silent |
| Space (hold, release) | Charge and jump. Tap for a hop. A ring on the surfaces ahead marks where a charged jump will end |
| Space while hanging | Pull up |
| S or C while hanging | Let go |
| A / D or arrows while hanging | Move along the ledge and round corners |
| W into a grey-green striped surface, or jump at one | Climb: W up, S down, A / D sideways, stamina drains (holding still drains slowly) |
| Space while climbing | Kick off, the way you're looking or with A / D to the side |
| C while climbing | Let go |
| Left click | Swipe: bats whatever is in front of you. Hit the outlet Mr. Tidy is plugged into to knock him out for a few seconds |
| Esc | Pause and settings |

Debug: **F1** overlay · **F2** third-person camera · **F3** noclip (WASD, Space, C, Shift) · **F4** anger +1 · **F5** wake +20 · **F8** freeze the vac · **F9** key list.

## Tuning

Every number that affects feel is in `src/data/tuning.js` (`TUNING` is the build prompt's `CONFIG`). The house layout is
data, in `src/data/level.js`.

After changing the level or the jump numbers, run the route check. It jumps every link in both directions with the real
controller and tests ledge grabs and climbing (it proves a jump is possible, not that it feels good):

```
node Tools/serve.mjs 8123
node Tools/check-page.mjs "http://localhost:8123/?play" out.png "window.__kitReady" 60000 "__routeBot()"
```
