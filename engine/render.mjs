// cartoon-shorts renderer: render one episode frame by frame in headless Chrome (raw DevTools protocol, no npm packages) and encode with ffmpeg.
//   node engine/render.mjs episodes/<name> still 1.2 8.5 ...   -> episodes/<name>/stills/t1.2.png ...
//   node engine/render.mjs episodes/<name> sheet               -> one contact sheet, a frame every 2 s
//   node engine/render.mjs episodes/<name> full [fps]          -> episodes/<name>/out/<name>.mp4
// full mode captures with several Chrome processes at once (WORKERS=4 by default, WORKERS=1 is the old serial render);
// frames go to one ffmpeg in order, so the encode is the same as before. OUT=<file> writes the video somewhere else.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, basename, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

// Chrome or Chromium: CHROME_PATH wins, else the usual install paths on macOS, Linux and Windows
const CHROME = process.env.CHROME_PATH || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(p => existsSync(p));
if (!CHROME) { console.error('Chrome or Chromium not found: install one or set CHROME_PATH'); process.exit(1); }
if (typeof WebSocket === 'undefined') { console.error('Node 22 or newer is needed (built-in WebSocket)'); process.exit(1); }
const [dir, mode = 'sheet', ...rest] = process.argv.slice(2);
if (!dir) { console.error('usage: node engine/render.mjs episodes/<name> still|sheet|full ...'); process.exit(1); }
const SHORT = resolve(dir), NAME = basename(SHORT), W = 1080, H = 1920;
// DSF=2 renders stills at 2160 x 3840 (the size YouTube recommends for Shorts thumbnails); video frames stay 1080 x 1920
const DSF = mode === 'still' ? +(process.env.DSF || 1) : 1;
const PAGE = join(SHORT, process.env.PAGE || 'short.html'), AUDIO = join(SHORT, 'audio', 'mix.wav');
const OUT = process.env.OUT ? resolve(process.env.OUT) : join(SHORT, 'out', `${NAME}.mp4`), STILLS = join(SHORT, 'stills');
const WORKERS = mode === 'full' ? Math.max(1, Math.floor(+(process.env.WORKERS || 4))) : 1;

// never leave a headless Chrome behind: whatever ends this process (an error in the page, Ctrl-C) kills them all
const CHROMES = new Set(), PROFILES = new Set();
process.on('exit', () => {
  for (const c of CHROMES) if (c.exitCode === null && !c.signalCode) c.kill('SIGKILL');
  for (const p of PROFILES) try { rmSync(p, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch { /* best effort */ }
});
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => process.exit(130));
const fail = e => { console.error('render failed:', e?.message || e); process.exit(1); };
process.on('uncaughtException', fail);
process.on('unhandledRejection', fail);

// one headless Chrome with the episode page loaded and ready: { info, ev, shot, logs, close }
async function openPage() {
  const prof = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'short-chrome-'));
  const chrome = spawn(CHROME, ['--headless=new', '--use-mock-keychain', '--password-store=basic', '--remote-debugging-port=0', `--user-data-dir=${prof}`, '--no-first-run',
    '--no-default-browser-check', '--hide-scrollbars', `--force-device-scale-factor=${DSF}`, `--window-size=${W},${H}`,
    'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  CHROMES.add(chrome); PROFILES.add(prof);
  chrome.once('exit', () => { CHROMES.delete(chrome); try { rmSync(prof, { recursive: true, force: true }); PROFILES.delete(prof); } catch { /* still flushing */ } });
  const wsUrl = await new Promise((res, rej) => {
    let buf = '';
    chrome.stderr.on('data', d => { buf += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf); if (m) res(m[1]); });
    chrome.on('exit', c => rej(new Error('chrome exited ' + c)));
    setTimeout(() => rej(new Error('chrome timeout')), 20000);
  });

  const ws = new WebSocket(wsUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let id = 0; const pending = new Map(), waiters = [];
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
    else if (m.method) waiters.filter(w => w.method === m.method).forEach(w => w.res(m.params));
  });
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, sessionId }));
  });
  const once = method => new Promise(res => waiters.push({ method, res }));

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: sid } = await send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p) => send(m, p, sid);
  await S('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DSF, mobile: false });
  await S('Page.enable'); await S('Runtime.enable');
  const logs = [];
  waiters.push({ method: 'Runtime.exceptionThrown', res: p => logs.push(p) });
  const loaded = once('Page.loadEventFired');
  await S('Page.navigate', { url: pathToFileURL(PAGE).href });
  await loaded;
  const ev = async expr => {
    const r = await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const info = await ev('window.ready');
  // HIDE='#cap,#tag' hides elements, e.g. the captions on a thumbnail
  if (process.env.HIDE) await ev(`document.querySelectorAll(${JSON.stringify(process.env.HIDE)}).forEach(e => e.style.setProperty('display', 'none', 'important'))`);

  const shot = async (t, format = 'png') => {
    await ev(`seek(${t})`);
    const { data } = await S('Page.captureScreenshot', { format, quality: format === 'jpeg' ? 92 : undefined });
    return Buffer.from(data, 'base64');
  };
  const close = async () => {
    ws.close();
    // wait for Chrome to quit, but never hang on it (it may already be gone)
    const gone = new Promise(r => { if (chrome.exitCode !== null || chrome.signalCode) r(); else chrome.once('exit', r); });
    chrome.kill(); await Promise.race([gone, new Promise(r => setTimeout(r, 3000))]);
    try { rmSync(prof, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* Chrome may still be flushing its temp profile */ }
  };
  return { info, ev, shot, logs, close };
}

const pages = [await openPage()];
const { info, shot } = pages[0];
console.log('ready', JSON.stringify(info));
if (info.fonts.includes(false)) console.warn('WARNING: a web font did not load');
if (info.overflow?.length) console.warn('WARNING: text overflows its box:', info.overflow.join(', '));

const closeAll = () => Promise.all(pages.map(p => p.close()));

if (mode === 'still') {
  mkdirSync(STILLS, { recursive: true });
  for (const t of rest) { writeFileSync(join(STILLS, `t${t}.png`), await shot(+t)); console.log('still', t); }
} else if (mode === 'sheet') {
  // a frame every `step` seconds, tiled 6 across at 1/4 size
  const step = +(rest[0] || 2), ts = [];
  for (let t = 0.5; t < info.total; t += step) ts.push(+t.toFixed(2));
  const tmp = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'sheet-'));
  PROFILES.add(tmp);                      // removed by the exit handler too (fail(), Ctrl-C)
  for (const [k, t] of ts.entries()) writeFileSync(join(tmp, `f${String(k).padStart(3, '0')}.png`), await shot(t));
  mkdirSync(STILLS, { recursive: true });
  const rows = Math.ceil(ts.length / 6);
  // frame numbers need ffmpeg's drawtext (missing in some builds, e.g. Homebrew's): without it, tile unnumbered
  const tile = label => spawnSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '1', '-i', join(tmp, 'f%03d.png'), '-vf',
    `scale=270:480,${label ? "drawtext=text='%{n}':x=8:y=8:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6," : ''}tile=6x${rows}:padding=6:color=white`,
    '-frames:v', '1', join(STILLS, 'sheet.png')], { stdio: ['ignore', 'ignore', 'pipe'] });
  let r = tile(true);
  if (r.status !== 0) {
    console.warn('ffmpeg has no drawtext filter: contact sheet without frame numbers (count left to right, top to bottom from 0)');
    r = tile(false);
  }
  if (r.status !== 0) fail('contact sheet: ' + String(r.stderr || '').trim());
  rmSync(tmp, { recursive: true, force: true });
  console.log('sheet', ts.map((t, k) => `${k}=${t}s`).join(' '));
} else if (mode === 'full') {
  const fps = +(rest[0] || 30), n = Math.ceil(info.total * fps);
  const t0 = Date.now();
  // the other Chromes load the page while nothing else runs; every seek is a function of t alone, so any page can draw any frame
  if (WORKERS > 1) pages.push(...await Promise.all(Array.from({ length: WORKERS - 1 }, openPage)));
  console.log(`${pages.length} Chrome worker(s), ${n} frames`);
  mkdirSync(dirname(OUT), { recursive: true });
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    '-i', AUDIO, // master quality: lossless PNG frames, x264 CRF 10, BT.709 tags, AAC 320k (platforms re-encode, a rich source loses less)
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv',
    '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', '10', '-maxrate', '20M', '-bufsize', '40M', '-profile:v', 'high',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-c:a', 'aac', '-b:a', '320k', '-shortest', '-movflags', '+faststart', OUT], { stdio: ['pipe', 'inherit', 'inherit'] });

  // workers take the next free frame; the writer hands frames to ffmpeg strictly in order
  const ready = new Map(), AHEAD = pages.length * 4;
  let next = 0, written = 0, wakeWriter = null, wakeWorkers = [];
  const ping = () => { const w = wakeWriter; wakeWriter = null; w?.(); };
  const worker = async p => {
    for (;;) {
      while (next - written >= AHEAD) await new Promise(r => wakeWorkers.push(r)); // keep memory bounded
      const f = next++;
      if (f >= n) return;
      ready.set(f, await p.shot(f / fps, 'png'));
      ping();
    }
  };
  const writer = async () => {
    while (written < n) {
      if (!ready.has(written)) { await new Promise(r => { wakeWriter = r; }); continue; }
      const buf = ready.get(written); ready.delete(written);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (written % 150 === 0) console.log(`frame ${written}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
      written++;
      const ws = wakeWorkers; wakeWorkers = []; ws.forEach(r => r());
    }
  };
  try {
    await Promise.all([writer(), ...pages.map(worker)]);
  } catch (e) {
    console.error('render failed:', e.message);
    ff.kill(); await closeAll(); process.exit(1);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('exit', r));
  console.log('done', OUT, `${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
const logs = pages.flatMap(p => p.logs);
if (logs.length) console.warn('page errors:', JSON.stringify(logs.map(l => l.exceptionDetails?.exception?.description)));
await closeAll();
// Chrome's helper processes can keep a pipe open and hold node alive for minutes after the work is done
process.exit(0);
