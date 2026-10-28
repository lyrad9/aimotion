// Render a Motion piece to MP4, frame by frame (deterministic, no dropped frames).
// usage: node render.mjs <piece.html> <out.mp4> [--from N] [--to N] [--stills dir --every N] [--mute] [--stems dir]
//        sound is mixed automatically when the piece declares music/sfx (sound.mjs)
//        node render.mjs <piece.html> - --frames 50,120,300 --stills dir   (check frames only, one browser launch)
//        a FULL render (no --from/--to) also writes review/manifest.json for Clap (review.mjs); --no-review skips it
// needs: playwright (npm i in this folder) + ffmpeg on PATH.
import { chromium } from 'playwright';
import { collectMeta, writeManifest } from './review.mjs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

const [, , input, output, ...rest] = process.argv;
if (!input || !output) { console.error('usage: node render.mjs piece.html out.mp4 [--from N] [--to N] [--stills dir --every N]'); process.exit(1); }
const arg = (k, d) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : d; };

// file:// images must not taint the canvas: an engine that reads its own pixels (adaptive motion blur) needs it
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
// stopped (Ctrl+C, task killed): close the headless browser too, otherwise it keeps eating the machine
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { browser.close().finally(() => process.exit(130)); });
const page = await browser.newPage();
// surface page errors immediately (otherwise a syntax error only shows up as a 30 s timeout)
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror:', e.message); });
page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
await page.goto(pathToFileURL(resolve(input)).href + '?paused', { waitUntil: 'domcontentloaded', timeout: 120000 }); // fonts/images are awaited by the engine (__motionReady), not by the load event
try { await page.waitForFunction(() => window.__motionReady === true, null, { timeout: 180000 }); }
catch { console.error('page never became ready' + (errors.length ? ': ' + errors[0] : ' (fonts blocked? Motion.run not called?)')); await browser.close(); process.exit(1); }
const env = await page.evaluate(() => { const e = window.__motion.env; return { w: e.w, h: e.h, fps: e.fps, frames: e.frames }; });
await page.setViewportSize({ width: env.w, height: env.h });
await page.addStyleTag({ content: 'html,body{margin:0;background:#000;overflow:hidden} canvas{position:fixed;inset:0;width:100vw!important;height:100vh!important}' });

const from = +arg('--from', 0), to = +arg('--to', env.frames);
const stills = arg('--stills'), every = +arg('--every', env.fps / 2);
if (stills) mkdirSync(stills, { recursive: true });

// with sound (default when the piece declares music or sfx): render silent video, then sound.mjs mixes it in
const hasSound = !rest.includes('--mute') && output !== '-' && await page.evaluate(() => { const s = window.__motion.sound(); return !!(s.music || s.cues.length); });
const videoOut = hasSound ? output.replace(/\.mp4$/, '') + '.silent.mp4' : output;
const ff = output === '-' ? null : spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(env.fps), '-i', '-',
  // -tune grain + images clés fixes (sans scenecut) : sur les fonds presque fixes avec grain animé, l'encodage par défaut
  // alternait images I et P de qualité différente et faisait scintiller le fond (mesuré : écarts de 8,7 contre 0,3)
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'slow', '-tune', 'grain', '-x264-params', `keyint=${2 * env.fps}:min-keyint=${2 * env.fps}:scenecut=0`, videoOut], { stdio: ['pipe', 'inherit', 'inherit'] });

// heavy frames (first draw of many large images) can exceed the 30 s default: allow 3 min
const canvas = await page.$('canvas');
if (arg('--frames')) {
  for (const f of arg('--frames').split(',').map(Number)) {
    await page.evaluate((n) => window.__motion.seek(n), f);
    writeFileSync(`${stills}/f${String(f).padStart(4, '0')}.png`, await canvas.screenshot({ type: 'png', timeout: 180000 }));
  }
  await browser.close(); console.log('frames ->', stills); process.exit(0);
}
for (let f = from; f < to; f++) {
  await page.evaluate((n) => window.__motion.seek(n), f);
  const png = await canvas.screenshot({ type: 'png', timeout: 180000 });
  if (ff && !ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
  if (stills && (f - from) % every === 0) writeFileSync(`${stills}/f${String(f).padStart(4, '0')}.png`, png);
  if (f % 60 === 0) process.stdout.write(`\rframe ${f}/${to}`);
}
// a partial render (chunk) is not a reviewable video; the final assembly goes through sound.mjs or review.mjs
const review = ff && from === 0 && to === env.frames && !rest.includes('--no-review') ? await collectMeta(page) : null;
await browser.close();
if (ff) { ff.stdin.end(); await new Promise((r) => ff.on('close', r)); }
if (hasSound) {
  const { spawnSync } = await import('node:child_process');
  const soundScript = fileURLToPath(new URL('sound.mjs', import.meta.url));
  const extra = rest.includes('--stems') ? ['--stems', rest[rest.indexOf('--stems') + 1]] : [];
  if (!review) extra.push('--no-review');                       // sound.mjs writes the manifest only for a full render
  const r = spawnSync('node', [soundScript, input, videoOut, output, ...extra], { stdio: 'inherit' });
  if (r.status) process.exit(r.status);
} else if (review) writeManifest({ piece: input, video: output, meta: review });
console.log(`\ndone -> ${output}`);
