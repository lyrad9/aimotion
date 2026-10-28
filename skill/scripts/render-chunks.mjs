// Rendu long en morceaux, avec reprise : un plantage ou une session coupée ne fait perdre qu'un morceau, et une
// retouche ne fait refaire que les morceaux qu'elle touche. Puis assemblage sans réencodage, son et manifeste.
// usage : node render-chunks.mjs <piece.html> <out.mp4> [--size 600] [--bars 33-39] [--chunks 6,7] [--all] [--round N] [--dry]
//   sans option     : refait les morceaux absents ou incomplets (ex. après une coupure), puis réassemble
//   --bars a-b      : refait aussi les morceaux qui couvrent les mesures a à b (incluse) : la scène retouchée
//   --chunks i,j    : refait aussi ces morceaux (index) ; --all : tout refaire ; --dry : afficher le plan sans rien rendre
//   --round N       : force le numéro de tour du manifeste de relecture
// Le découpage est recalculé tout seul : si la durée de la pièce (nombre d'images) ou --size change, tout est refait.
// Les morceaux sont écrits dans <dossier de out>/parts/ ; un morceau n'y apparaît qu'une fois complet (écriture puis renommage).
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { resolve, dirname, join, basename } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

const [, , input, output, ...rest] = process.argv;
if (!input || !output) { console.error('usage: node render-chunks.mjs piece.html out.mp4 [--size 600] [--bars a-b] [--chunks i,j] [--all] [--round N] [--dry]'); process.exit(1); }
const arg = (k, d) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : d; };
const here = (f) => fileURLToPath(new URL(f, import.meta.url));
const size = +arg('--size', 600);

// 1. la pièce : nombre d'images, cadence, tempo
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(resolve(input)).href + '?paused', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => window.__motion && window.__motion.env, null, { timeout: 180000 });
const env = await page.evaluate(() => { const e = window.__motion.env, snd = window.__motion.sound(); return { frames: e.frames, fps: e.fps, bpm: e.bpm, sound: !!(snd.music || snd.cues.length) }; });
await browser.close();
const framesPerBar = (4 * 60 / env.bpm) * env.fps;

// 2. le découpage, et ce qui doit être refait
const parts = join(dirname(resolve(output)), 'parts');
mkdirSync(parts, { recursive: true });
const bounds = []; for (let f = 0; f < env.frames; f += size) bounds.push([f, Math.min(env.frames, f + size)]);
const planFile = join(parts, 'plan.json');
const old = existsSync(planFile) ? JSON.parse(readFileSync(planFile, 'utf8')) : null;
const layoutChanged = !old || old.frames !== env.frames || old.size !== size;
const partPath = (i) => join(parts, `part${i}.mp4`);
const frameCount = (f) => { const r = spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', f], { encoding: 'utf8' }); return +(r.stdout || '').trim() || 0; };
const todo = new Set();
bounds.forEach(([a, z], i) => {
  if (layoutChanged || rest.includes('--all') || !existsSync(partPath(i)) || frameCount(partPath(i)) !== z - a) todo.add(i);
});
for (const i of (arg('--chunks', '') || '').split(',').filter(Boolean).map(Number)) todo.add(i);
const bars = arg('--bars');
if (bars) {
  const [b0, b1] = bars.split('-').map(Number), f0 = Math.floor(b0 * framesPerBar), f1 = Math.ceil(((b1 ?? b0) + 1) * framesPerBar);
  bounds.forEach(([a, z], i) => { if (z > f0 && a < f1) todo.add(i); });
}
const list = [...todo].filter((i) => i < bounds.length).sort((a, b) => a - b);
console.log(`${env.frames} images, ${bounds.length} morceaux de ${size}${layoutChanged && old ? ' (découpage changé : tout est refait)' : ''}`);
console.log(list.length ? `à rendre : ${list.map((i) => `${i} (${bounds[i][0]}-${bounds[i][1]})`).join(', ')}` : 'rien à rendre : réassemblage seul');
if (rest.includes('--dry')) process.exit(0);
if (layoutChanged) for (let i = 0; existsSync(partPath(i)); i++) rmSync(partPath(i));   // anciens morceaux, découpage différent : régénérables
writeFileSync(planFile, JSON.stringify({ frames: env.frames, size, bpm: env.bpm, fps: env.fps }, null, 1));

// 3. rendu des morceaux, un à la fois (machines modestes : jamais deux rendus en parallèle)
let child = null;
const stop = () => {   // arrêt propre : tuer aussi le navigateur headless lancé par render.mjs
  if (child?.pid) { if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']); else child.kill('SIGTERM'); }
  process.exit(130);
};
process.on('SIGINT', stop); process.on('SIGTERM', stop);
const durations = [];
for (const [n, i] of list.entries()) {
  const [a, z] = bounds[i], tmp = join(parts, `part${i}.tmp.mp4`), t0 = Date.now();
  child = spawn('node', [here('render.mjs'), input, tmp, '--from', String(a), '--to', String(z), '--mute', '--no-review'], { stdio: 'inherit' });
  const code = await new Promise((r) => child.on('close', r)); child = null;
  if (code) { console.error(`\nmorceau ${i} : échec (code ${code})`); process.exit(code); }
  renameSync(tmp, partPath(i));
  const d = Object.assign(new Number((Date.now() - t0) / 1000), { frames: z - a }); durations.push(d);
  const perFrame = durations.reduce((s, x) => s + +x, 0) / durations.reduce((s, x) => s + x.frames, 0);
  const remain = list.slice(n + 1).reduce((s, j) => s + bounds[j][1] - bounds[j][0], 0) * perFrame;
  console.log(`\nmorceau ${i} (${a}-${z}) : ${Math.round(+d)} s · reste ≈ ${Math.round(remain / 60)} min (fin vers ${new Date(Date.now() + remain * 1000).toTimeString().slice(0, 5)})`);
}

// 4. assemblage sans réencodage (chaque morceau commence par une image clé), son, manifeste
const listFile = join(parts, 'list.txt');
writeFileSync(listFile, bounds.map((_, i) => `file '${basename(partPath(i))}'`).join('\n') + '\n');
const silent = output.replace(/\.mp4$/, '') + '.silent.mp4';
const cat = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', silent], { stdio: 'inherit' });
if (cat.status) process.exit(cat.status);
const total = frameCount(silent);
if (total !== env.frames) console.warn(`attention : ${total} images assemblées pour ${env.frames} attendues`);
if (env.sound) { const snd = spawnSync('node', [here('sound.mjs'), input, silent, output], { stdio: 'inherit' }); if (snd.status) process.exit(snd.status); }
else { renameSync(silent, output); spawnSync('node', [here('review.mjs'), input, output], { stdio: 'inherit' }); }
if (arg('--round')) spawnSync('node', [here('review.mjs'), input, output, '--round', arg('--round')], { stdio: 'inherit' });
console.log(`terminé -> ${output} (${total} images) [${new Date().toTimeString().slice(0, 5)}]`);
