// Review manifest for Clap, the local review app (command `clap`, formerly `aisance-video-editing`).
// Writes / updates <piece dir>/review/manifest.json (stage "final") from the piece itself:
// one segment per scene, one marker per bar, one cue per sfx, plus the audio waveform.
//
// usage: node review.mjs <piece.html> <video.mp4> [--round N]
// Called automatically at the end of a full render (render.mjs) and of the sound mix (sound.mjs);
// pass --no-review to either of them to skip it.
//
// Scene ids are the comment keys, so they must stay stable across rounds: they come from
// scene.id if set, else the draw function's name (draw: hook -> "hook"), else "bar-N".
// Optional per-scene fields read here (ignored by the engine): id, label, note.
//
// Round: kept as is, except when review/review.json holds comments on the current round
// (the user reviewed this version) — then the new render is round + 1. --round N forces it.
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, relative, basename, join } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Read what the manifest needs from a loaded piece (window.__motion ready). */
export const collectMeta = (page) => page.evaluate(() => {
  const e = window.__motion.env;
  return {
    w: e.w, h: e.h, fps: e.fps, bpm: e.bpm, bars: e.bars, bar: e.bar, beat: e.beat, duration: e.duration,
    title: Array.isArray(e.title) ? e.title.join(' ') : e.title,
    scenes: e.scenes.map((s) => ({
      bar: s.bar, bars: s.bars || 1, t0: s.t0, t1: s.t1, id: s.id, label: s.label, note: s.note,
      draw: s.draw && s.draw.name,
      sfx: (s.sfx || []).map(([beat, name]) => ({ t: s.t0 + beat * e.beat, name })),
    })),
  };
});

const r3 = (x) => Math.round(x * 1000) / 1000;
const rel = (from, to) => relative(from, to).replace(/\\/g, '/');
const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };

/** Write the manifest; returns its path. */
export function writeManifest({ piece, video, meta, round }) {
  const dir = dirname(resolve(piece)), reviewDir = join(dir, 'review'), file = join(reviewDir, 'manifest.json');
  mkdirSync(reviewDir, { recursive: true });
  const prev = readJson(file), review = readJson(join(reviewDir, 'review.json'));

  let r = prev?.round || 1;
  const reviewed = review && review.round === r && (review.comments || []).some((c) => (c.round ?? review.round) === r);
  if (prev && reviewed) r += 1;
  if (round) r = +round;

  // keep labels / texts written by hand in an earlier manifest when the piece does not set them
  const prevItems = new Map((prev?.tracks || []).flatMap((t) => (t.items || []).map((i) => [`${t.id}/${i.id}`, i])));
  const seen = new Set(), src = rel(reviewDir, resolve(piece));
  const scenes = meta.scenes.map((s) => {
    let id = s.id || (s.draw && s.draw !== 'draw' && s.draw !== 'anonymous' ? s.draw : `bar-${s.bar + 1}`);
    for (let k = 2; seen.has(id); k++) id = `${id.replace(/-\d+$/, '')}-${k}`;
    seen.add(id);
    const old = prevItems.get(`scenes/${id}`) || {};
    const bars = s.bars > 1 ? `mesures ${s.bar + 1}-${s.bar + s.bars}` : `mesure ${s.bar + 1}`;
    return {
      id, label: s.label || old.label || id, ...((s.note || old.text) && { text: s.note || old.text }),
      start: r3(s.t0), end: r3(s.t1), data: { draw: s.draw || null, bar: s.bar, bars: s.bars, where: bars }, source: { file: src },
    };
  });
  const cues = meta.scenes.flatMap((s, i) => s.sfx.map((c, k) => ({ id: `${scenes[i].id}-sfx-${k + 1}`, label: c.name, start: r3(c.t) })));

  const tracks = [
    { id: 'scenes', label: 'Scènes', kind: 'segment', items: scenes },
    { id: 'bars', label: 'Mesures', kind: 'marker', items: Array.from({ length: meta.bars }, (_, k) => ({ id: `m${String(k + 1).padStart(2, '0')}`, label: String(k + 1), start: r3(k * meta.bar) })) },
  ];
  if (cues.length) tracks.push({ id: 'sfx', label: 'Bruitages', kind: 'audio-cue', items: cues });
  const videoRel = rel(reviewDir, resolve(video));
  tracks.push({ id: 'audio', label: 'Son', kind: 'audio', src: videoRel });

  const manifest = {
    schema: 1,
    project: prev?.project || basename(dir),
    title: prev?.title || meta.title || basename(dir),
    round: r,
    stage: 'final',
    canvas: { w: meta.w, h: meta.h, fps: meta.fps },
    duration: r3(meta.duration),
    media: { video: videoRel },
    notes: `${meta.bars} mesures à ${meta.bpm} BPM (1 mesure = ${r3(meta.bar)} s). Chaque scène = une entrée de Motion.run({ scenes }) dans ${src}.`,
    tracks,
  };
  writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');

  // validate with the app when it is installed (npm link); silent otherwise
  const v = spawnSync(`clap validate "${dir}"`, { encoding: 'utf8', shell: true }); // shell: the npm shim is a .cmd on Windows
  const ok = v.error || v.status === null ? '' : v.status === 0 ? ' (valide)' : `\n${v.stdout}${v.stderr}`;
  console.log(`review: round ${r}${prev ? '' : ' (nouveau)'} -> ${file}${ok}`);
  return file;
}

// ---------- CLI ----------
if (import.meta.url === pathToFileURL(resolve(process.argv[1] || '')).href) {
  const [piece, video, ...rest] = process.argv.slice(2);
  if (!piece || !video) { console.error('usage: node review.mjs <piece.html> <video.mp4> [--round N]'); process.exit(1); }
  if (!existsSync(video)) { console.error(`video not found: ${video}`); process.exit(1); }
  const i = rest.indexOf('--round'), round = i >= 0 ? rest[i + 1] : null;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  await page.goto(pathToFileURL(resolve(piece)).href + '?paused', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__motionReady === true, null, { timeout: 180000 });
  const meta = await collectMeta(page);
  await browser.close();
  writeManifest({ piece, video, meta, round });
}
