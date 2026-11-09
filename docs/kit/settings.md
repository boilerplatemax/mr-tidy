# Settings and the menu

**Files:** `src/data/settings.js`, `src/ui/menu.js`, `src/style.css` (the `#pause` rules)

## What it does

- **Settings** are one plain object, loaded from `localStorage` at start (`<storagePrefix>.settings`), saved on every
  change with a version number, and broadcast to listeners. They are *not* a save game: keep run saves in their own
  key and slot.
- **Look presets:** `authored` and `clean` set the seven look options at once; touching any one makes it `custom`.
- **The menu** is one element with three faces:
  - **Title** (before the first Begin): no veil, no box, the live scene behind it; the title, **Begin**, **Settings**.
  - **Settings** (from the title): the tabbed panel with **Back** and **Reset settings**.
  - **Pause** (Esc or tab hidden during play): *Paused*, **Resume**, and the tabs. A click outside the panel resumes.
- **Tabs:** Game (sensitivity, invert Y, head-bob, crouch toggle, volume, subtitles), Display (look, brightness,
  framing, jitter, warp, dither and their amounts, colour bits, lines, supersample), Controls (a key list). Two
  columns, every word in the pixel font, scaled by whole numbers. Nothing scrolls at 1280×720.
- **Everything applies live:** the renderer, the audio master volume and the menu itself listen for changes.

## API

```js
import { settings, setSetting, applyLookPreset, resetSettings, onSettingsChange } from './data/settings.js';
settings.sensitivity;                    // read anywhere
setSetting('headBob', false);            // saves + notifies
applyLookPreset('clean');
const off = onSettingsChange((s) => {...}); // returns an unsubscribe

const menu = new Menu(() => input.requestLock()); // the button click is the user gesture for lock + audio
menu.show(false);   // the title     menu.show(true)  // paused     menu.hide()
menu.fitReport();   // { ok, tabs: { Game: { scrolls, over } ... } } at this window size (window.__menuFit())
```

**Add a setting:** add its default to `DEFAULTS` in `settings.js`, a row to `TABS` in `menu.js`
(`[label, key, 'check' | 'range' | 'cycle', options]`), and read `settings.yourKey` where it matters (listen with
`onSettingsChange` if it must react live). **Add a control:** edit `CONTROL_COLUMNS`.

## Knobs

`TUNING.game.storagePrefix` (the localStorage key), `TUNING.game.title`. The defaults themselves are in
`settings.js` (`DEFAULTS`, `LOOK_PRESETS`).

## Gotchas we hit

- **Version the key and migrate, don't break.** When a default changes for everyone (we turned warp off and made
  widescreen the default mid-project), bump `VERSION` and add a `MIGRATIONS[n]` step. A plain new setting doesn't
  need one: missing keys get their default.
- **Change the storage prefix per game.** Two games served from the same origin (localhost:8080) otherwise share
  settings.
- **localStorage can throw** (private windows, blocked storage). Every access is wrapped; settings then last the
  session.
- **Range sliders save on release** (`onchange`), not on every move (`oninput` only updates the number), because a
  change re-renders the whole menu.
- **Keep the panel from scrolling.** Two columns and a fixed body height (tabs never jump). Run `__menuFit()` at a
  few window sizes after adding rows.
- **The title click is precious.** Only the Begin button starts the game: a stray click on the backdrop does nothing
  on the title (during play it resumes).
