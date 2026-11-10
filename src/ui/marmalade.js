// Marmalade, the player's cat, as a portrait to hang with the cats who came before (the end screens). Drawn in code, at the
// portraits' shape (4:5), small and pixelated. Set TUNING.assets.marmalade to a picture of her to use that instead.
import { TUNING } from '../data/tuning.js';

const FILE = TUNING.assets.marmalade;
const W = 64, H = 80;
let fileImage; // undefined: not tried yet; null: there isn't one; an Image: there is

/** Try the file once; resolves to the Image or null. */
function tryFile() {
  if (!FILE) fileImage = null;
  if (fileImage !== undefined) return Promise.resolve(fileImage);
  return new Promise((ok) => { const i = new Image(); i.onload = () => { fileImage = i; ok(i); }; i.onerror = () => { fileImage = null; ok(null); }; i.src = FILE; });
}
tryFile();

/** A ginger tabby, chest and muzzle white, green eyes, on the dark brown the other portraits are painted on. */
function draw() {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true }); // (it's read back once, to dither)
  const ell = (x, y, rx, ry, col, a0 = 0, a1 = Math.PI * 2) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, a0, a1); g.fill(); };
  const poly = (col, ...p) => { g.fillStyle = col; g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.closePath(); g.fill(); };
  // the ground: dark, a little warmer in the middle, with brush speckle
  const bg = g.createRadialGradient(32, 34, 4, 32, 40, 52); bg.addColorStop(0, '#3a2a1c'); bg.addColorStop(1, '#0d0a07');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) { const x = (i * 37) % W, y = (i * 53 + (i >> 3)) % H; g.fillStyle = i % 3 ? 'rgba(255,230,190,0.035)' : 'rgba(0,0,0,0.12)'; g.fillRect(x, y, 2, 1); }
  const O = '#d9802f', OD = '#a9561b', OL = '#eba45a', WH = '#f3e8d2', WS = '#d8c8ac';
  // shoulders and chest
  ell(32, 86, 30, 26, O);
  ell(32, 84, 13, 22, WH); ell(29, 84, 4, 18, WS);
  for (const x of [8, 14, 50, 56]) poly(OD, x, 66, x + 4, 64, x + 2, 76, x - 1, 76); // stripes down the shoulders
  // ears, then the head over them
  poly(O, 13, 30, 16, 9, 29, 20); poly(O, 51, 30, 48, 9, 35, 20);
  poly('#e7a092', 16, 26, 17, 14, 25, 21); poly('#e7a092', 48, 26, 47, 14, 39, 21);
  ell(32, 36, 19, 17, O);
  ell(32, 30, 15, 9, OL); // the light on the brow
  // tabby markings: the M on the forehead, bars on the cheeks
  g.fillStyle = OD;
  for (const [x, y, w, h] of [[30, 21, 1, 7], [33, 21, 1, 7], [26, 23, 1, 5], [37, 23, 1, 5], [31, 20, 2, 2], [22, 26, 2, 1], [40, 26, 2, 1]]) g.fillRect(x, y, w, h);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) g.fillRect(32 + s * (15 + i) - (s < 0 ? 5 : 0), 33 + i * 3, 5, 1);
  // the muzzle and chin
  ell(28, 42, 6, 5, WH); ell(36, 42, 6, 5, WH); ell(32, 47, 6, 4, WH);
  // eyes: green, with slit pupils and a catchlight
  for (const x of [24, 40]) {
    ell(x, 33, 5, 3.6, '#20160c');
    ell(x, 33, 4.2, 3, '#8ec24a'); ell(x, 32.4, 3.4, 1.6, '#b6dc6c');
    g.fillStyle = '#0b0805'; g.fillRect(x - 0.5, 30.2, 1.4, 5.6);
    g.fillStyle = '#fbf6e4'; g.fillRect(x + 1, 31, 1, 1);
  }
  // nose and mouth
  poly('#d9707a', 29.5, 38.5, 34.5, 38.5, 32, 41.5);
  g.fillStyle = '#5a2e22'; g.fillRect(31.5, 41.5, 1, 2); g.fillRect(29, 43.5, 3, 1); g.fillRect(33, 43.5, 3, 1);
  // whiskers
  g.fillStyle = 'rgba(250,244,226,0.75)';
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) for (let k = 0; k < 13; k++) g.fillRect(Math.round(32 + s * (8 + k)), Math.round(41 + i * 2 + (k * (i - 1)) / 6), 1, 1);
  return c;
}

/** The game's own ordered dither (a 4×4 Bayer pattern, down to 15-bit colour), so she looks like the rest of it. */
function dither(g, w, h) {
  const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], d = g.getImageData(0, 0, w, h), px = d.data, step = 255 / 31;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = (y * w + x) * 4, o = (B[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * step; for (let c = 0; c < 3; c++) px[k + c] = Math.max(0, Math.min(255, Math.round((px[k + c] + o) / step) * step)); }
  g.putImageData(d, 0, 0);
}

/**
 * The portrait as a canvas element, w CSS px wide (times --px). mood: 'alive' or 'gone' (faded).
 */
export function marmaladePortrait(w, mood = 'alive') {
  const wrap = document.createElement('div'); wrap.className = 'portrait ' + mood;
  wrap.style.width = `calc(${w}px * var(--px))`;
  const art = draw(); art.className = 'art'; dither(art.getContext('2d'), W, H);
  wrap.append(art);
  tryFile().then((img) => { if (img) { art.width = img.naturalWidth; art.height = img.naturalHeight; const g = art.getContext('2d'); g.drawImage(img, 0, 0); dither(g, art.width, art.height); } }); // (her own picture, at its own resolution, dithered like the game)
  return wrap;
}
