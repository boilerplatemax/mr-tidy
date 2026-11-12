// Records clips for posting: each scenario in capture/scenarios/ is played by the game frame by frame (?capture=<name>,
// src/debug/capture.js) in Chrome on the graphics card, every frame is screenshotted and piped into ffmpeg, and the
// sound (rendered offline in step with the frames) is muxed in. Then each clip is cut to the formats the sites want.
//
//   node Tools/clips/record.mjs all                 every scenario
//   node Tools/clips/record.mjs push_mug hose_grab   just these
//   options: --fps 30  --size 1920x1080  --no-formats (16:9 only)  --keep (keep the silent raw video)
//
// Out: clips/final/<name>_16x9.mp4, _1x1.mp4, _9x16.mp4, clips/gif/<name>.gif, clips/stills/<name>_*.png,
// clips/contact_sheet.png and clips/report.md. Needs ffmpeg (winget install Gyan.FFmpeg) and Chrome.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const flag = (k) => { const i = argv.indexOf('--' + k); if (i < 0) return false; argv.splice(i, 1); return true; };
const preview = Number(opt('preview', 0)); // --preview 0.5: no video, a still every 0.5 s (small) into clips/preview/<name>/, and the script's log
const FPS = Number(opt('fps', 30)), [W, H] = opt('size', preview ? '960x540' : '1920x1080').split('x').map(Number), formats = !flag('no-formats'), keep = flag('keep');
const PORT = 8080;

const clean = flag('clean'); // --clean: no added captions or watermark, into clips/clean/
const OUT = clean ? 'clips/clean' : 'clips';
const dirs = { raw: OUT + '/raw', final: OUT + '/final', gif: OUT + '/gif', stills: OUT + '/stills' };
for (const d of Object.values(dirs)) fs.mkdirSync(path.join(ROOT, d), { recursive: true });

function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  const w = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['ffmpeg'], { encoding: 'utf8' });
  if (w.status === 0) return w.stdout.split(/\r?\n/)[0].trim();
  const base = path.join(process.env.LOCALAPPDATA || '', 'Microsoft/WinGet/Packages');
  for (const p of fs.existsSync(base) ? fs.readdirSync(base).filter((n) => /ffmpeg/i.test(n)) : []) for (const sub of fs.readdirSync(path.join(base, p))) { const f = path.join(base, p, sub, 'bin', 'ffmpeg.exe'); if (fs.existsSync(f)) return f; }
  throw new Error('ffmpeg not found: winget install Gyan.FFmpeg, or set FFMPEG=path');
}
const FF = findFfmpeg(), FFPROBE = FF.replace(/ffmpeg(\.exe)?$/i, (m, e) => 'ffprobe' + (e || ''));
const ff = (args) => { const r = spawnSync(FF, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' }); if (r.status !== 0) throw new Error('ffmpeg: ' + r.stderr); return r; };

const scenarios = fs.readdirSync(path.join(ROOT, 'capture/scenarios')).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3)).sort();
const want = argv.length === 0 || argv.includes('all') ? scenarios : argv;
for (const n of want) if (!scenarios.includes(n)) { console.error(`no scenario ${n} (have: ${scenarios.join(', ')})`); process.exit(2); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const up = () => new Promise((ok) => { const q = http.get(`http://localhost:${PORT}/`, (r) => { r.resume(); ok(true); }); q.on('error', () => ok(false)); });
let server = null;
if (!(await up())) { server = spawn(process.execPath, [path.join(ROOT, 'Tools/serve.mjs'), String(PORT)], { cwd: ROOT, stdio: 'ignore' }); for (let i = 0; i < 40 && !(await up()); i++) await sleep(150); }

const CHROME = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const port = 9300 + Math.floor(Math.random() * 600), profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tidyclips-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
  `--window-size=${W},${H}`, '--force-device-scale-factor=1', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });

let targets; for (let i = 0; i < 80 && !targets; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { await sleep(250); } }
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
let id = 0; const pending = new Map(), logs = [];
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; } if (m.method === 'Runtime.exceptionThrown') logs.push('[exception] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text)); else if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) logs.push(`[${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description ?? '').join(' ')); };
const send = (method, params = {}) => new Promise((ok) => { const i = ++id; pending.set(i, ok); ws.send(JSON.stringify({ id: i, method, params })); });
const js = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result?.result?.value; };
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

const report = [];
for (const name of want) {
  const t0 = Date.now(); logs.length = 0;
  console.log(`\n== ${name}`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/?capture=${name}&fps=${FPS}${clean ? '&clean=1' : ''}` });
  let st = null;
  for (let i = 0; i < 400; i++) { await sleep(250); st = await js(`document.title.startsWith('CAPTURE_') ? document.title : null`).catch(() => null); if (st) break; }
  if (st !== 'CAPTURE_READY') { console.log(`  failed to start: ${st} ${logs.join(' | ')}`); report.push({ name, error: st || 'never ready' }); continue; }
  const info = await js(`({ title: __cap.title, seconds: __cap.seconds, gif: __cap.gif })`);
  const raw = path.join(ROOT, dirs.raw, `${name}.mp4`), wav = path.join(ROOT, dirs.raw, `${name}.wav`);
  if (preview) {
    const pd = path.join(ROOT, 'clips/preview', name); fs.rmSync(pd, { recursive: true, force: true }); fs.mkdirSync(pd, { recursive: true });
    const every = Math.max(1, Math.round(preview * FPS)); let f = 0, d = false, e = null, k = 0;
    while (!d) { const r = await js(`__cap.step().then((f) => ({ f, done: __cap.done, error: __cap.error }))`).catch((x) => ({ error: x.message })); if (r.error) { e = r.error; break; } f = r.f; d = r.done; if (f % every === 0 || d) { const s = await send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }); fs.writeFileSync(path.join(pd, `${String(++k).padStart(3, '0')}.jpg`), Buffer.from(s.result.data, 'base64')); } }
    try { ff(['-i', path.join(pd, '%03d.jpg'), '-vf', `scale=320:180,tile=6x${Math.ceil(k / 6)}:padding=2`, '-frames:v', '1', path.join(ROOT, 'clips/preview', `${name}.png`)]); } catch (x) { console.log('  (no sheet: ' + x.message.slice(0, 120) + ')'); }
    const log = await js('__cap.log').catch(() => []);
    console.log(`  preview ${(f / FPS).toFixed(1)} s${e ? ' ERROR ' + e : ''} ${logs.join(' | ')}`); for (const l of log) console.log('   · ' + l);
    continue;
  }
  const enc = spawn(FF, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), raw], { stdio: ['pipe', 'ignore', 'inherit'] });
  let frames = 0, done = false, err = null;
  while (!done) {
    const r = await js(`__cap.step().then((f) => ({ f, done: __cap.done, error: __cap.error }))`).catch((e) => ({ error: e.message }));
    if (r.error) { err = r.error; break; }
    const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 93, optimizeForSpeed: true });
    const buf = Buffer.from(shot.result.data, 'base64');
    if (!enc.stdin.write(buf)) await new Promise((ok) => enc.stdin.once('drain', ok));
    frames = r.f; done = r.done;
    if (frames % (FPS * 2) === 0) process.stdout.write(`  ${(frames / FPS).toFixed(0)}s`);
  }
  enc.stdin.end(); await new Promise((ok) => enc.on('close', ok));
  const parts = await js('__cap.finish()');
  const b64 = []; for (let i = 0; i < parts; i++) b64.push(await js(`__capWav[${i}]`));
  fs.writeFileSync(wav, Buffer.concat(b64.map((s) => Buffer.from(s, 'base64'))));
  const log = await js('__cap.log').catch(() => []);
  const out = path.join(ROOT, dirs.final, `${name}_16x9.mp4`);
  ff(['-i', raw, '-i', wav, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]);
  if (formats) {
    const sq = path.join(ROOT, dirs.final, `${name}_1x1.mp4`), vt = path.join(ROOT, dirs.final, `${name}_9x16.mp4`);
    ff(['-i', out, '-vf', 'crop=ih:ih,scale=1080:1080:flags=neighbor', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', sq]);
    ff(['-i', out, '-vf', 'crop=trunc(ih*9/16/2)*2:ih,scale=1080:1920:flags=neighbor', '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', vt]);
  }
  const secs = frames / FPS, g = info.gif || [Math.max(0, secs / 2 - 3), 6];
  ff(['-ss', String(g[0]), '-t', String(g[1]), '-i', out, '-vf', 'fps=15,scale=480:-1:flags=neighbor,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', path.join(ROOT, dirs.gif, `${name}.gif`)]);
  for (const [k, t] of [0.2, 0.5, 0.8].entries()) ff(['-ss', String(secs * t), '-i', out, '-frames:v', '1', path.join(ROOT, dirs.stills, `${name}_${k + 1}.png`)]);
  // checks: loudness, and frozen stretches
  const vol = spawnSync(FF, ['-hide_banner', '-i', wav, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr.match(/mean_volume: (-?[\d.]+) dB/)?.[1];
  const frz = (spawnSync(FF, ['-hide_banner', '-i', raw, '-vf', 'freezedetect=n=0.001:d=2.5', '-map', '0:v', '-f', 'null', '-'], { encoding: 'utf8' }).stderr.match(/freeze_start/g) || []).length;
  if (!keep) { fs.rmSync(raw, { force: true }); fs.rmSync(wav, { force: true }); }
  const size = fs.statSync(out).size;
  report.push({ name, title: info.title, secs, frames, size, vol, frz, err, log, warnings: logs.slice(0, 5), took: (Date.now() - t0) / 1000 });
  console.log(`\n  ${secs.toFixed(1)} s, ${(size / 1e6).toFixed(1)} MB, mean ${vol} dB, ${frz} frozen stretches, ${((Date.now() - t0) / 1000).toFixed(0)} s to make${err ? ', SCRIPT ERROR ' + err : ''}`);
  for (const l of log) console.log('   · ' + l);
}

if (preview) { ws.close(); chrome.kill(); server?.kill(); process.exit(0); }
// the contact sheet (a frame from the middle of each) and the report
const mids = report.filter((r) => !r.error).map((r) => path.join(ROOT, dirs.stills, `${r.name}_2.png`)).filter((f) => fs.existsSync(f));
const all = fs.readdirSync(path.join(ROOT, dirs.stills)).filter((f) => f.endsWith('_2.png')).map((f) => path.join(ROOT, dirs.stills, f));
const sheet = all.length ? all : mids;
if (sheet.length) {
  const cols = Math.min(4, sheet.length), rows = Math.ceil(sheet.length / cols);
  const ins = sheet.flatMap((f) => ['-i', f]);
  const lay = sheet.map((_, i) => `${(i % cols) * 480}_${Math.floor(i / cols) * 270}`).join('|');
  const scale = sheet.map((_, i) => `[${i}:v]scale=480:270[s${i}]`).join(';') + ';' + sheet.map((_, i) => `[s${i}]`).join('') + `xstack=inputs=${sheet.length}:layout=${lay}:fill=black`;
  if (sheet.length > 1) ff([...ins, '-filter_complex', scale, '-frames:v', '1', path.join(ROOT, OUT + '/contact_sheet.png')]);
  else fs.copyFileSync(sheet[0], path.join(ROOT, OUT + '/contact_sheet.png'));
  void rows;
}
const md = ['# Clip report', '', `${new Date().toISOString()} · ${W}x${H} @ ${FPS} fps`, '', '| clip | length | 16:9 size | mean volume | frozen | notes |', '|---|---|---|---|---|---|',
  ...report.map((r) => r.error ? `| ${r.name} | - | - | - | - | FAILED: ${r.error} |` : `| ${r.name} | ${r.secs.toFixed(1)} s | ${(r.size / 1e6).toFixed(1)} MB | ${r.vol} dB | ${r.frz} | ${[r.err && 'script error: ' + r.err, ...r.warnings].filter(Boolean).join('; ') || 'ok'} |`)];
const prev = fs.existsSync(path.join(ROOT, OUT + '/report.md')) ? fs.readFileSync(path.join(ROOT, OUT + '/report.md'), 'utf8') : '';
fs.writeFileSync(path.join(ROOT, OUT + '/report.md'), md.join('\n') + '\n\n' + prev.split('\n').filter((l) => !l.startsWith('# Clip report')).join('\n').slice(0, 20000));

ws.close(); chrome.kill(); server?.kill();
await sleep(400); try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold it */ }
console.log('\ndone');
