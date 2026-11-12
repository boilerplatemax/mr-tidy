// Cuts a short trailer out of the recorded clips (clips/final/*_16x9.mp4): the best second or three of each, back to
// back, then a title card. Run after record.mjs.   node Tools/clips/montage.mjs [out name]
// Out: clips/final/<name>_16x9.mp4 (and _1x1, _9x16).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', '..');
const name = process.argv[2] || 'trailer';
// [clip, from s, for s]: the moments, in order (a cold open, the fun, the horror, the payoff)
const CUTS = [
  ['push_mug', 1.0, 2.2], ['push_mug', 7.4, 2.4],
  ['parkour', 4.6, 2.4], ['china_speedrun', 1.8, 2.6],
  ['grandpa', 2.6, 3.2],
  ['hide_table', 6.0, 2.6],
  ['creep', 15.6, 3.2],
  ['dust_cloud', 2.8, 3.0],
  ['power_surge', 3.0, 3.6],
  ['hose_grab', 3.2, 2.6],
  ['tidy_hour', 15.4, 3.2],
  ['good_kitty', 5.6, 4.2],
];
const FF = process.env.FFMPEG || (() => {
  const w = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['ffmpeg'], { encoding: 'utf8' });
  if (w.status === 0) return w.stdout.split(/\r?\n/)[0].trim();
  const base = path.join(process.env.LOCALAPPDATA || '', 'Microsoft/WinGet/Packages');
  for (const p of fs.readdirSync(base).filter((n) => /ffmpeg/i.test(n))) for (const sub of fs.readdirSync(path.join(base, p))) { const f = path.join(base, p, sub, 'bin', 'ffmpeg.exe'); if (fs.existsSync(f)) return f; }
  throw new Error('no ffmpeg');
})();
const ff = (args) => { const r = spawnSync(FF, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' }); if (r.status !== 0) throw new Error(r.stderr); };

const cuts = CUTS.filter(([c]) => fs.existsSync(path.join(ROOT, 'clips/final', `${c}_16x9.mp4`)));
const ins = cuts.flatMap(([c, ss, t]) => ['-ss', String(ss), '-t', String(t), '-i', path.join(ROOT, 'clips/final', `${c}_16x9.mp4`)]);
// each cut: a quick fade in and out of black (6 frames), so the hard cuts don't jar
const parts = cuts.map(([, , t], i) => `[${i}:v]fps=30,format=yuv420p,setpts=PTS-STARTPTS,fade=in:st=0:d=0.12,fade=out:st=${(t - 0.12).toFixed(2)}:d=0.12[v${i}];[${i}:a]asetpts=PTS-STARTPTS,afade=in:st=0:d=0.05,afade=out:st=${(t - 0.08).toFixed(2)}:d=0.08[a${i}]`).join(';');
const cat = cuts.map((_, i) => `[v${i}][a${i}]`).join('') + `concat=n=${cuts.length}:v=1:a=1[v][a]`;
const out = path.join(ROOT, 'clips/final', `${name}_16x9.mp4`);
ff([...ins, '-filter_complex', parts + ';' + cat, '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out]);
ff(['-i', out, '-vf', 'crop=ih:ih,scale=1080:1080:flags=neighbor', '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', path.join(ROOT, 'clips/final', `${name}_1x1.mp4`)]);
ff(['-i', out, '-vf', 'crop=trunc(ih*9/16/2)*2:ih,scale=1080:1920:flags=neighbor', '-c:v', 'libx264', '-crf', '21', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', path.join(ROOT, 'clips/final', `${name}_9x16.mp4`)]);
console.log(`${out}: ${cuts.length} cuts, ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`);
