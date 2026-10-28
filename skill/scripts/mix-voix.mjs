// Mixage avec voix off : la voix devant, la musique et les bruitages (sound.mjs) dessous, sans jamais la gêner.
//   - voix : soit une piste toute faite (--voix fichier), soit montée depuis voix/montage.js à côté de la pièce
//     (window.MONTAGE.segments = [[fichier, début, fin, instant dans la vidéo, texte], ...], chemins relatifs à la pièce) :
//     chaque segment est coupé dans son fichier, avec un peu de marge et des fondus de 15 ms, et posé à son instant ;
//   - lit (musique + bruitages) baissé sous la voix dès qu'elle parle (sidechain) ;
//   - gain automatique : la sonie court terme maximale (3 s) du lit est placée à MARGE LU sous la sonie intégrée de la voix
//     (5 par défaut : jamais plus fort que la voix, jamais enterré ; garder entre 4 et 6) ;
//   - normalisation à -14 LUFS en deux passes (linéaire), crête -1 dB ; écrit aussi le son seul (.m4a) et les pistes (stems/).
// usage : node mix-voix.mjs <piece.html> <video.silent.mp4> <out.mp4> [--voix voix.wav] [--marge 5]
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const [piece, video, out] = args.filter((a, i) => !a.startsWith('--') && !(i && args[i - 1].startsWith('--')));
if (!piece || !video || !out) { console.error('usage: node mix-voix.mjs <piece.html> <video.silent.mp4> <out.mp4> [--voix voix.wav] [--marge 5]'); process.exit(1); }
const HERE = path.dirname(fileURLToPath(import.meta.url)), PIECE_DIR = path.dirname(path.resolve(piece));
const MARGE = +opt('--marge', 5);
const stems = path.join(path.dirname(path.resolve(out)), 'stems');
fs.mkdirSync(stems, { recursive: true });
const ff = (a) => execFileSync('ffmpeg', ['-y', '-v', 'error', ...a], { stdio: 'inherit', timeout: 600000 });
const stderrOf = (a) => spawnSync('ffmpeg', a, { encoding: 'utf8', maxBuffer: 1 << 28 }).stderr;   // ffmpeg écrit ses mesures sur stderr
const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video]).toString().trim());
function loud(file) {
  const I = +stderrOf(['-nostats', '-i', file, '-af', 'ebur128', '-f', 'null', '-']).match(/I:\s+(-?[\d.]+) LUFS/g).pop().match(/-?[\d.]+/)[0];
  const S3 = [...stderrOf(['-nostats', '-i', file, '-af', 'ebur128=metadata=1,ametadata=print:key=lavfi.r128.S', '-f', 'null', '-'])
    .matchAll(/lavfi\.r128\.S=(-?[\d.]+)/g)].map((m) => +m[1]).filter((v) => v > -70);
  return { I, Smax: S3.length ? Math.max(...S3) : -70 };
}

// 1. voix
const voix = path.join(stems, 'voix.wav');
if (opt('--voix')) ff(['-i', path.resolve(opt('--voix')), '-af', `aformat=sample_rates=48000:channel_layouts=stereo,apad,atrim=0:${dur}`, voix]);
else {
  const mf = path.join(PIECE_DIR, 'voix/montage.js');
  if (!fs.existsSync(mf)) { console.error('pas de --voix et pas de voix/montage.js à côté de la pièce'); process.exit(1); }
  const window = {}; Function('window', fs.readFileSync(mf, 'utf8'))(window);
  const segs = window.MONTAGE.segments, PRE = 0.04, POST = 0.08, FADE = 0.015, ins = [], parts = [];
  segs.forEach(([f, a, b, at], i) => {
    const prev = segs[i - 1], next = segs[i + 1];
    const a2 = Math.max(prev && prev[0] === f ? (prev[2] + a) / 2 : 0, a - PRE), b2 = Math.min(next && next[0] === f ? (b + next[1]) / 2 : 1e9, b + POST);
    const d = b2 - a2, at2 = at - (a - a2);
    ins.push('-i', path.resolve(PIECE_DIR, f));
    parts.push(`[${i}:a]atrim=${a2.toFixed(3)}:${b2.toFixed(3)},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=mono,` +
      `afade=t=in:d=${FADE},afade=t=out:st=${(d - FADE).toFixed(3)}:d=${FADE},adelay=${Math.round(at2 * 1000)}[s${i}]`);
  });
  ff([...ins, '-filter_complex', parts.join(';') + ';' + segs.map((_, i) => `[s${i}]`).join('') +
    `amix=inputs=${segs.length}:normalize=0,apad,atrim=0:${dur},pan=stereo|c0=c0|c1=c0[o]`, '-map', '[o]', '-ar', '48000', voix]);
  console.log(`voix montée : ${segs.length} segments (voix/montage.js)`);
}

// 2. musique et bruitages en pistes séparées (sound.mjs)
const tmp = path.join(stems, '_sfx-music.mp4');
execFileSync('node', [path.join(HERE, 'sound.mjs'), piece, video, tmp, '--stems', stems, '--no-review'], { stdio: 'inherit' });
fs.rmSync(tmp, { force: true });
const music = path.join(stems, 'music.wav'), sfx = path.join(stems, 'sfx.wav'), bed = path.join(stems, 'lit.wav');
const has = (f) => fs.existsSync(f);
const bedGraph = (g) => {
  const parts = [], mix = [];
  let k = 1;
  if (has(music)) { parts.push(`[${k}:a]aformat=sample_rates=48000:channel_layouts=stereo[m];[m][vk]sidechaincompress=threshold=0.02:ratio=8:attack=40:release=420:makeup=1[md]`); mix.push('[md]'); k++; }
  if (has(sfx)) { parts.push(`[${k}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.8[s]`); mix.push('[s]'); k++; }
  return `[0:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=2[v][vk];${parts.join(';')};` +
    `${mix.join('')}amix=inputs=${mix.length}:normalize=0,volume=${g}dB,atrim=0:${dur}[bed];[v]anullsink` + (has(music) ? '' : ';[vk]anullsink');
};
const bedIns = ['-i', voix, ...(has(music) ? ['-i', music] : []), ...(has(sfx) ? ['-i', sfx] : [])];
if (!has(music) && !has(sfx)) { console.error('ni musique ni bruitages déclarés dans la pièce'); process.exit(1); }

// 3. gain du lit : passage le plus fort à MARGE LU sous la voix
ff([...bedIns, '-filter_complex', bedGraph(0), '-map', '[bed]', bed]);
const V = loud(voix), B0 = loud(bed), gain = V.I - MARGE - B0.Smax;
ff([...bedIns, '-filter_complex', bedGraph(gain.toFixed(2)), '-map', '[bed]', bed]);
const B = loud(bed), marge = V.I - B.Smax;
console.log(`voix ${V.I.toFixed(1)} LUFS · lit au plus fort ${B.Smax.toFixed(1)} LUFS (gain ${gain.toFixed(1)} dB) · marge ${marge.toFixed(1)} LU ${marge >= 4 && marge <= 6.5 ? '(ok)' : '(HORS 4–6 LU : à vérifier)'}`);

// 4. voix + lit, -14 LUFS, muxé sur la vidéo ; son seul en .m4a
const mixWav = path.join(stems, 'mix.wav');
ff(['-i', voix, '-i', bed, '-filter_complex', '[0:a][1:a]amix=inputs=2:normalize=0[a]', '-map', '[a]', mixWav]);
const meas = stderrOf(['-nostats', '-i', mixWav, '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json', '-f', 'null', '-']);
const j = JSON.parse(meas.slice(meas.lastIndexOf('{'), meas.lastIndexOf('}') + 1));
const ln = `loudnorm=I=-14:TP=-1:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
ff(['-i', video, '-i', mixWav, '-filter_complex', `[1:a]${ln},aresample=48000[a]`, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', out]);
ff(['-i', out, '-vn', '-c:a', 'copy', out.replace(/\.mp4$/, '.m4a')]);
console.log(`final ${loud(out).I.toFixed(1)} LUFS → ${out}`);
