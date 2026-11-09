// Headless page check. Opens a page in headless Chrome (DevTools protocol), collects
// console messages, uncaught exceptions and failed requests, waits for a "ready" expression,
// then saves a screenshot. Exit code 1 if any error or warning was logged, or it never got ready.
//
// Usage: node Tools/check-page.mjs <url> [screenshot.png] [readyExpression] [timeoutMs]
//   e.g. node Tools/check-page.mjs "http://localhost:8080/?play" shot.png "window.__kitReady"
// Needs the dev server running (node Tools/serve.mjs). Set CHROME=path to override the browser.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [, , url, out = 'page-check.png', readyExpr = 'document.readyState === "complete"', timeoutMs = '30000', reportExpr] = process.argv;
// optional 5th argument: a JS expression evaluated after "ready"; its JSON value is printed (for debugging)
if (!url) { console.error('usage: node Tools/check-page.mjs <url> [out.png] [readyExpr] [timeoutMs]'); process.exit(2); }

const CHROME = process.env.CHROME || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p));
if (!CHROME) { console.error('No Chrome/Edge found; set CHROME=path'); process.exit(2); }

const port = 9300 + Math.floor(Math.random() * 600);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'psxkit-chrome-'));
const proc = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  // GPU=1 uses the real graphics card (for frame-time checks); default is software rendering (stable screenshots)
  ...(process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']),
  `--window-size=${process.env.SIZE || '1280,720'}`, '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required',
  '--no-first-run', '--no-default-browser-check', 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cleanup() {
  proc.kill();
  await sleep(300);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold files */ }
}

try {
  let targets;
  for (let i = 0; i < 60 && !targets; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { await sleep(250); }
  }
  if (!targets) throw new Error('Chrome did not start');
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });

  let nextId = 0;
  const pending = new Map();
  const logs = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.consoleAPICalled') {
      const text = m.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
      logs.push({ level: m.params.type, text: `[console.${m.params.type}] ${text}` });
    } else if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      logs.push({ level: 'error', text: `[exception] ${d.exception?.description || d.text}` });
    } else if (m.method === 'Log.entryAdded') {
      const e = m.params.entry;
      logs.push({ level: e.level, text: `[${e.source}.${e.level}] ${e.text} ${e.url || ''}` });
    }
  };
  const send = (method, params = {}) => new Promise((ok) => { const id = ++nextId; pending.set(id, ok); ws.send(JSON.stringify({ id, method, params })); });

  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Page.navigate', { url });

  const start = Date.now();
  let ready = false;
  while (Date.now() - start < Number(timeoutMs)) {
    const r = await send('Runtime.evaluate', { expression: readyExpr, returnByValue: true });
    if (r.result?.result?.value) { ready = true; break; }
    await sleep(250);
  }
  await sleep(800); // let a few frames render
  if (reportExpr) {
    const r = await send('Runtime.evaluate', { expression: `Promise.resolve(${reportExpr}).then((v) => JSON.stringify(v))`, returnByValue: true, awaitPromise: true });
    console.log('report:', r.result?.result?.value ?? r.result?.exceptionDetails?.text);
  }
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
  ws.close();

  const bad = logs.filter((l) => ['error', 'warning', 'warn', 'assert'].includes(l.level));
  console.log(`${ready ? 'READY' : 'NOT READY (timed out)'} in ${Date.now() - start} ms · ${logs.length} messages · ${bad.length} errors/warnings · screenshot: ${out}`);
  for (const l of logs) console.log('  ' + l.text.slice(0, 300));
  process.exitCode = ready && !bad.length ? 0 : 1;
} catch (e) {
  console.error('check failed:', e.message);
  process.exitCode = 1;
} finally {
  await cleanup();
}
