// Sound for a Motion piece: synthesized beat-locked music bed + sound effects, mixed under the video.
// No samples, no licence: everything is synthesized here, deterministic (seeded noise).
//
// usage: node sound.mjs <piece.html> <video.mp4> <out.mp4> [--stems dir] [--no-music] [--no-sfx] [--no-review]
//        writes review/manifest.json for <out.mp4> afterwards (review.mjs), unless --no-review
//        node sound.mjs --bank <dir>            write the sfx bank as WAVs (to listen to them)
//
// The piece declares its sound (see SKILL.md "Son"):
//   Motion.run({ ..., music: { intro: 1, breaks: [4], outro: true, vol: 0.55, prog: [1,2,3,0], lead: [[beat, midi, beats, vol?], ...] }
//                       | { file: 'assets/track.mp3', start: 0, vol: 0.8 } | false,
//   prog = chord order by bar (0 Am, 1 F, 2 C, 3 G, cycled); lead = melody notes in ABSOLUTE beats (the jingle hook / sonic logo).
//                scenes: [{ ..., sfx: [[beat, 'name', vol?, { align: 'end' }?], ...] }] })
// Cue times are in BEATS from the scene start, the same expressions as the animation, so sound never drifts.
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { resolve, join, dirname } from 'node:path';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { collectMeta, writeManifest } from './review.mjs';

const SR = 48000;
const TAU = Math.PI * 2;

// ---------- utils ----------
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 * 2 - 1; }; }
const buf = (sec) => new Float32Array(Math.ceil(sec * SR));
function normalize(b, peak = 0.5) { let m = 1e-9; for (const x of b) m = Math.max(m, Math.abs(x)); for (let i = 0; i < b.length; i++) b[i] = (b[i] / m) * peak; return b; }
function add(dst, src, at, gain = 1) { const o = Math.round(at * SR); for (let i = 0; i < src.length; i++) { const j = o + i; if (j >= 0 && j < dst.length) dst[j] += src[i] * gain; } }
function wav(path, b) {
  const data = Buffer.alloc(44 + b.length * 2);
  data.write('RIFF', 0); data.writeUInt32LE(36 + b.length * 2, 4); data.write('WAVEfmt ', 8); data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22); data.writeUInt32LE(SR, 24); data.writeUInt32LE(SR * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(b.length * 2, 40);
  for (let i = 0; i < b.length; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, b[i])) * 32767), 44 + i * 2);
  writeFileSync(path, data);
}
function wavStereo(path, l, r) {
  const n = Math.min(l.length, r.length), data = Buffer.alloc(44 + n * 4);
  data.write('RIFF', 0); data.writeUInt32LE(36 + n * 4, 4); data.write('WAVEfmt ', 8); data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22); data.writeUInt32LE(SR, 24); data.writeUInt32LE(SR * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, l[i])) * 32767), 44 + i * 4); data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, r[i])) * 32767), 46 + i * 4); }
  writeFileSync(path, data);
}
// one-pole low-pass with a cutoff (Hz) that may vary per sample
function lowpass(b, cutoff) { let y = 0; for (let i = 0; i < b.length; i++) { const fc = typeof cutoff === 'function' ? cutoff(i / SR) : cutoff; const a = 1 - Math.exp((-TAU * fc) / SR); y += a * (b[i] - y); b[i] = y; } return b; }
function highpass(b, cutoff) { const lp = lowpass(Float32Array.from(b), cutoff); for (let i = 0; i < b.length; i++) b[i] -= lp[i]; return b; }

// ---------- sound-effect bank ----------
// Five sounds follow the aisance-reel bank (click, pop, tick, whoosh, ding); the rest are motion-specific.
const BANK = {
  click() { const r = rng(1), b = buf(0.025); let p = 0; for (let i = 0; i < b.length; i++) { const t = i / SR, n = r(); b[i] = (0.6 * (n - p) + 0.4 * Math.sin(TAU * 3200 * t)) * Math.exp(-t / 0.004); p = n; } return normalize(b); },
  pop() { const b = buf(0.09); let ph = 0; for (let i = 0; i < b.length; i++) { const t = i / SR; ph += (TAU * (300 + 600 * Math.exp(-t / 0.02))) / SR; b[i] = Math.sin(ph) * Math.min(1, t / 0.002) * Math.exp(-t / 0.025); } return normalize(b); },
  tick() { const b = buf(0.035); for (let i = 0; i < b.length; i++) { const t = i / SR; b[i] = Math.sin(TAU * 2400 * t) * Math.exp(-t / 0.006); } return normalize(b); },
  whoosh() { const r = rng(7), b = buf(0.45); let lp = 0; for (let i = 0; i < b.length; i++) { const u = i / b.length, a = 0.02 + 0.25 * Math.sin(Math.PI * u); lp += a * (r() - lp); b[i] = lp * Math.sin(Math.PI * u) ** 1.5; } return normalize(b); },
  ding() { const b = buf(0.6); for (let i = 0; i < b.length; i++) { const t = i / SR; b[i] = (Math.sin(TAU * 1320 * t) + 0.45 * Math.sin(TAU * 1980 * t) + 0.2 * Math.sin(TAU * 2640 * t)) * Math.min(1, t / 0.003) * Math.exp(-t / 0.18); } return normalize(b); },
  // fast swish for slams and quick moves: brighter and shorter than the whoosh
  swish() { const r = rng(11), b = buf(0.2); for (let i = 0; i < b.length; i++) b[i] = r(); highpass(b, 900); lowpass(b, (t) => 1500 + 9000 * Math.sin(Math.PI * Math.min(1, t / 0.2))); for (let i = 0; i < b.length; i++) { const u = i / b.length; b[i] *= Math.sin(Math.PI * u) ** 2; } return normalize(b); },
  // impact: sub boom + noise transient, for big hits on a downbeat
  impact() { const r = rng(3), b = buf(1.1); let ph = 0; for (let i = 0; i < b.length; i++) { const t = i / SR; ph += (TAU * (42 + 90 * Math.exp(-t / 0.05))) / SR; b[i] = Math.sin(ph) * Math.exp(-t / 0.35) + r() * Math.exp(-t / 0.012) * 0.5; } lowpass(b, 2500); return normalize(b, 0.6); },
  // low thud: an object landing (squash)
  thud() { const b = buf(0.18); let ph = 0; for (let i = 0; i < b.length; i++) { const t = i / SR; ph += (TAU * (70 + 120 * Math.exp(-t / 0.015))) / SR; b[i] = Math.sin(ph) * Math.exp(-t / 0.05); } return normalize(b); },
  // riser: noise + rising tone over ~1 s; cue it with { align: 'end' } so it ENDS on the cut
  riser() { const r = rng(5), d = 1.0, b = buf(d); let ph = 0, lp = 0; for (let i = 0; i < b.length; i++) { const u = i / b.length; ph += (TAU * (200 + 1400 * u * u)) / SR; lp += (0.02 + 0.5 * u * u) * (r() - lp); b[i] = (0.5 * lp + 0.25 * Math.sin(ph)) * u ** 2.2; } return normalize(b); },
  // discreet UI set (product demos): softer than click / pop / whoosh, they sit under the music
  // tap: trackpad click, a short body + a soft tick
  tap() { const r = rng(21), b = buf(0.04); let lp = 0; for (let i = 0; i < b.length; i++) { const t = i / SR; lp += 0.35 * (r() - lp); b[i] = (lp * 0.6 * Math.exp(-t / 0.003) + Math.sin(TAU * 1900 * t) * 0.5 * Math.exp(-t / 0.012) + Math.sin(TAU * 420 * t) * 0.4 * Math.exp(-t / 0.01)); } return normalize(b); },
  // bloop: a UI element appearing, rising pitch, rounded
  bloop() { const b = buf(0.12); let ph = 0; for (let i = 0; i < b.length; i++) { const t = i / SR; ph += (TAU * (480 + 520 * (1 - Math.exp(-t / 0.03)))) / SR; b[i] = Math.sin(ph) * Math.min(1, t / 0.004) * Math.exp(-t / 0.035); } return normalize(b); },
  // airy: a gentle whoosh for camera moves and panels sliding
  airy() { const r = rng(31), b = buf(0.5); for (let i = 0; i < b.length; i++) b[i] = r(); highpass(b, 600); lowpass(b, (t) => 1200 + 5000 * Math.sin(Math.PI * Math.min(1, t / 0.5))); for (let i = 0; i < b.length; i++) { const u = i / b.length; b[i] *= Math.sin(Math.PI * u) ** 2.2; } return normalize(b); },
  // land: a word landing (scale-down typography) — soft low thump with a short breath of air, no click
  land() { const r = rng(41), b = buf(0.22); let ph = 0, lp = 0; for (let i = 0; i < b.length; i++) { const t = i / SR; ph += (TAU * (62 + 58 * Math.exp(-t / 0.035))) / SR; lp += 0.08 * (r() - lp); b[i] = Math.sin(ph) * Math.min(1, t / 0.006) * Math.exp(-t / 0.07) + lp * 0.9 * Math.exp(-t / 0.05); } lowpass(b, 1800); return normalize(b); },
  // key: typewriter / keyboard tick, slightly random pitch per hit is done at mix time with the cue index
  key() { const r = rng(9), b = buf(0.03); let p = 0; for (let i = 0; i < b.length; i++) { const t = i / SR, n = r(); b[i] = ((n - p) * 0.7 + Math.sin(TAU * 1800 * t) * 0.3) * Math.exp(-t / 0.005); p = n; } return normalize(b); },
};

// ---------- stereo music bed with an arrangement ----------
// Opt-in with `energy` (one value 0..1 per bar). It drives what plays in each bar, so the level is never flat:
//   energy < 0.25 : pad + soft hats, the whole bus low-passed (intro / breath)
//   ≥ 0.25        : + bass ; ≥ 0.45 : + kick ; ≥ 0.6 : + clap, 16th-note arpeggio ; ≥ 0.8 : + 16th hats, open filter
// The master low-pass follows the energy bar by bar (filter sweeps on builds). Also:
//   drops: [bar...]     impact + crash on beat 1, full arrangement from there
//   cuts: { bar: beat } everything stops from that beat to the end of the bar (the silence before a drop)
//   risers: [bar...]    a wide noise riser that ENDS on that bar's beat 1
// Returns [L, R]. Stereo: detuned supersaw pad spread L/R, ping-pong hats and arpeggio, centred kick/bass/clap body.
function musicStereo(bpm, bars, opt) {
  const beat = 60 / bpm, bar = beat * 4, dur = bars * bar + 3;
  const L = buf(dur), R = buf(dur), r = rng(42);
  const roots = [110, 87.31, 130.81, 98], chords = [[220, 261.63, 329.63], [174.61, 220, 261.63], [261.63, 329.63, 392], [196, 246.94, 293.66]];
  const prog = opt.prog || [0, 1, 2, 3], energy = opt.energy, outro = opt.outro ?? true;
  const drops = new Set(opt.drops || []), cuts = opt.cuts || {}, risers = opt.risers || [];
  const E = (k) => energy[Math.min(k, energy.length - 1)] ?? 0.5;
  const put = (b, at, g, pan = 0) => { add(L, b, at, g * Math.cos((pan + 1) * Math.PI / 4) * 1.414); add(R, b, at, g * Math.sin((pan + 1) * Math.PI / 4) * 1.414); };
  const kick = (() => { const b = buf(0.45); let ph = 0; for (let i = 0; i < b.length; i++) { const t = i / SR; ph += (TAU * (48 + 120 * Math.exp(-t / 0.028))) / SR; b[i] = Math.tanh(1.6 * Math.sin(ph)) * Math.exp(-t / 0.24) + r() * Math.exp(-t / 0.0018) * 0.18; } return b; })();
  const clap = (() => { const b = buf(0.3); for (let i = 0; i < b.length; i++) { const t = i / SR, env = [0, 0.010, 0.021].reduce((s, o) => s + (t >= o ? Math.exp(-(t - o) / (o === 0.021 ? 0.11 : 0.006)) : 0), 0); b[i] = r() * env; } highpass(b, 900); lowpass(b, 7000); return b; })();
  const hat = (open = false) => { const b = buf(open ? 0.22 : 0.05); for (let i = 0; i < b.length; i++) b[i] = r() * Math.exp(-(i / SR) / (open ? 0.08 : 0.011)); return highpass(highpass(b, 7500), 7500); };
  const hatC = hat(), hatO = hat(true);
  const crash = (() => { const b = buf(2.2); for (let i = 0; i < b.length; i++) b[i] = r() * Math.exp(-(i / SR) / 0.7); return highpass(b, 4000); })();
  const sub = (() => { const b = buf(1.4); let ph = 0; for (let i = 0; i < b.length; i++) { const t = i / SR; ph += (TAU * (38 + 70 * Math.exp(-t / 0.08))) / SR; b[i] = Math.sin(ph) * Math.exp(-t / 0.5); } return b; })();
  const pluck = (f, len) => { const b = buf(len); for (let i = 0; i < b.length; i++) { const t = i / SR, saw = 2 * ((f * t) % 1) - 1; b[i] = (saw * 0.5 + Math.sin(TAU * f * t) * 0.6) * Math.min(1, t / 0.002) * Math.exp(-t / 0.09); } return lowpass(b, 3200); };
  const stopAt = (k) => (cuts[k] !== undefined ? k * bar + cuts[k] * beat : Infinity);
  for (let k = 0; k < bars; k++) {
    const t0 = k * bar, e = E(k), ci = prog[k % prog.length], last = outro && k === Math.ceil(bars) - 1, stop = stopAt(k);   // ceil : durée en demi-mesures
    const ok = (t) => t < stop - 0.005;
    // pad: 3 detuned saws per note, wider and brighter with the energy; rings out on the last bar
    for (const f of chords[ci]) for (const [det, pan] of [[-0.006, -0.85], [0.0, 0], [0.006, 0.85]]) {
      const len = last ? bar + 2.6 : Math.min(bar, stop - t0) + 0.06, b = buf(Math.max(0.01, len));
      for (let i = 0; i < b.length; i++) { const t = i / SR, saw = 2 * ((f * (1 + det) * t) % 1) - 1, env = Math.min(1, t / 0.18) * (last ? Math.exp(-t / 1.3) : Math.min(1, (len - t) / 0.06)); b[i] = (saw * 0.35 + Math.sin(TAU * f * (1 + det) * t) * 0.65) * env; }
      lowpass(b, 900 + 2600 * e);
      put(b, t0, 0.022 * (0.7 + 0.5 * e), pan);
    }
    if (drops.has(k)) { put(crash, t0, 0.32, -0.3); put(crash, t0 + 0.012, 0.32, 0.3); put(sub, t0, 0.9, 0); }
    if (last) { put(kick, t0, 0.9); put(crash, t0, 0.25, 0); continue; }
    for (let q = 0; q < 4; q++) {
      const tb = t0 + q * beat;
      if (!ok(tb)) break;
      // half-time kick (beats 1 and 3) below 0.65, four on the floor above: the groove itself builds
      if (e >= 0.45 && (e >= 0.65 || q % 2 === 0)) put(kick, tb, 0.5 + 0.4 * e);
      if (e >= 0.6 && (q === 1 || q === 3)) { put(clap, tb, 0.26, -0.15); put(clap, tb + 0.009, 0.26, 0.15); }
      for (let s = 0; s < (e >= 0.8 ? 4 : 2); s++) {                 // hats: 8ths, 16ths when full, ping-pong
        const th = tb + s * (beat / (e >= 0.8 ? 4 : 2)); if (!ok(th)) break;
        const offbeat = e >= 0.8 ? s === 2 : s === 1;
        put(offbeat && e >= 0.6 ? hatO : hatC, th, (offbeat ? 0.16 : 0.09) * (0.6 + 0.6 * e), s % 2 ? 0.45 : -0.45);
      }
      if (e >= 0.25) for (let h = 0; h < 2; h++) {                    // bass: 8ths, ducked after the kick
        const tt = tb + h * beat / 2; if (!ok(tt)) break;
        const len = beat / 2, b = buf(len), f = roots[ci];
        for (let i = 0; i < b.length; i++) { const t = i / SR, saw = 2 * ((f * t) % 1) - 1; b[i] = (saw * 0.6 + Math.sin(TAU * f * t) * 0.7) * Math.min(1, t / 0.004) * Math.exp(-t / 0.17); }
        lowpass(b, 260 + 420 * e);
        put(b, tt, (e >= 0.45 && h === 0 ? 0.5 : 0.85) * 0.32);
      }
      if (e >= 0.6) for (let s = 0; s < 4; s++) {                     // arpeggio: chord tones an octave up, ping-pong
        const ta = tb + s * beat / 4; if (!ok(ta)) break;
        const n = chords[ci][(q * 4 + s) % 3] * 2;
        put(pluck(n, beat / 4 + 0.08), ta, 0.05 * e, (q * 4 + s) % 2 ? 0.6 : -0.6);
      }
    }
  }
  for (const k of risers) {                                           // wide noise riser ending on beat 1 of bar k
    const d = bar, b = buf(d), b2 = buf(d), r2 = rng(77 + k); let lp = 0, lp2 = 0;
    for (let i = 0; i < b.length; i++) { const u = i / b.length; lp += (0.01 + 0.45 * u * u) * (r() - lp); lp2 += (0.01 + 0.45 * u * u) * (r2() - lp2); b[i] = lp * u ** 2; b2[i] = lp2 * u ** 2; }
    add(L, normalize(b, 1), k * bar - d, 0.14); add(R, normalize(b2, 1), k * bar - d, 0.14);
  }
  for (const [nb, midi, len = 1, v = 1] of opt.lead || []) {          // bell hook, echo panned right
    const f = 440 * 2 ** ((midi - 69) / 12), d = len * beat + 0.6, b = buf(d);
    for (let i = 0; i < b.length; i++) { const t = i / SR, env = Math.min(1, t / 0.003) * Math.exp(-t / (0.12 + 0.18 * len)); b[i] = (Math.sin(TAU * f * t) + 0.5 * Math.sin(TAU * 2 * f * t) * Math.exp(-t / 0.08) + 0.18 * Math.sin(TAU * 3 * f * t) * Math.exp(-t / 0.04) + 0.3 * Math.sin(TAU * f * 0.5 * t)) * env; }
    put(b, nb * beat, 0.15 * v, -0.1); put(b, nb * beat + beat * 0.75, 0.05 * v, 0.6);
  }
  // master low-pass that follows the energy (exponential between 700 Hz and 18 kHz), smoothed across bar lines
  const cutoff = (t) => { const k = t / bar, k0 = Math.floor(k), f = k - k0, a = E(k0), z = E(k0 + 1), x = f > 0.75 ? a + (z - a) * ((f - 0.75) / 0.25) : a; return 700 * Math.pow(18000 / 700, Math.min(1, x / 0.8)); };
  for (const ch of [L, R]) { lowpass(ch, cutoff); }
  // master gain follows the energy too: a crescendo the ear (and a waveform) can see, louder on drops
  for (const ch of [L, R]) for (let i = 0; i < ch.length; i++) { const t = i / SR, k = t / bar, k0 = Math.floor(k), f = k - k0, a = E(k0), z = E(k0 + 1), x = f > 0.85 ? a + (z - a) * ((f - 0.85) / 0.15) : a; ch[i] *= 0.35 + 0.65 * x; }
  const peak = Math.max(...[L, R].map((ch) => ch.reduce((m, x) => Math.max(m, Math.abs(x)), 1e-9)));
  for (const ch of [L, R]) for (let i = 0; i < ch.length; i++) ch[i] = (ch[i] / peak) * 0.7;
  return [L, R];
}

// ---------- music bed (beat-locked) ----------
// Am – F – C – G, kick on every beat, clap on 2 and 4, off-beat hats, 8th-note bass ducked by the kick, soft pad.
function music(bpm, bars, opt = {}) {
  const beat = 60 / bpm, bar = beat * 4, dur = bars * bar + 2.5;
  const out = buf(dur), r = rng(42);
  const roots = [110, 87.31, 130.81, 98], chords = [[220, 261.63, 329.63], [174.61, 220, 261.63], [261.63, 329.63, 392], [196, 246.94, 293.66]];
  const intro = opt.intro ?? 1, breaks = new Set(opt.breaks || []), outro = opt.outro ?? true, prog = opt.prog || [0, 1, 2, 3];
  const kick = (() => { const b = buf(0.4); let ph = 0; for (let i = 0; i < b.length; i++) { const t = i / SR; ph += (TAU * (45 + 110 * Math.exp(-t / 0.03))) / SR; b[i] = Math.sin(ph) * Math.exp(-t / 0.22) + r() * Math.exp(-t / 0.002) * 0.15; } return b; })();
  const clap = (() => { const b = buf(0.25); for (let i = 0; i < b.length; i++) { const t = i / SR, env = [0, 0.011, 0.022].reduce((s, o) => s + (t >= o ? Math.exp(-(t - o) / (o === 0.022 ? 0.09 : 0.006)) : 0), 0); b[i] = r() * env; } highpass(b, 800); lowpass(b, 6000); return b; })();
  const hat = (() => { const b = buf(0.05); for (let i = 0; i < b.length; i++) b[i] = r() * Math.exp(-(i / SR) / 0.012); return highpass(b, 7000); })();
  for (let k = 0; k < bars; k++) {
    const t0 = k * bar, ci = prog[k % prog.length], last = outro && k === Math.ceil(bars) - 1;   // ceil : durée en demi-mesures (ex. 44,5)
    const full = k >= intro && !breaks.has(k) && !last;
    // pad: whole bar, slow attack; on the last bar it rings out
    for (const f of chords[ci]) for (const det of [-0.003, 0.003]) {
      const len = last ? bar + 2.4 : bar + 0.05, b = buf(len);
      for (let i = 0; i < b.length; i++) { const t = i / SR, env = Math.min(1, t / 0.25) * (last ? Math.exp(-t / 1.2) : Math.min(1, (len - t) / 0.08)); b[i] = (Math.sin(TAU * f * (1 + det) * t) + 0.25 * Math.sin(TAU * 2 * f * (1 + det) * t)) * env; }
      add(out, b, t0, 0.035);
    }
    if (last) { add(out, kick, t0, 0.9); continue; }                 // final hit, then only the pad tail
    for (let q = 0; q < 4; q++) {
      const tb = t0 + q * beat;
      if (full) add(out, kick, tb, 0.9);
      if (full && (q === 1 || q === 3)) add(out, clap, tb, 0.32);
      add(out, hat, tb + beat / 2, k < intro ? 0.12 : 0.18);
      // bass: two 8ths per beat, ducked right after each kick (sidechain feel)
      for (let e = 0; e < 2; e++) {
        const len = beat / 2, b = buf(len), f = roots[ci];
        for (let i = 0; i < b.length; i++) { const t = i / SR, saw = 2 * ((f * t) % 1) - 1; b[i] = (saw * 0.6 + Math.sin(TAU * f * t) * 0.6) * Math.min(1, t / 0.004) * Math.exp(-t / 0.16); }
        lowpass(b, full ? 520 : 300);
        add(out, b, tb + e * len, (full && e === 0 ? 0.55 : 0.85) * (k < intro ? 0.6 : 1) * 0.3);
      }
    }
  }
  // lead: bell-pluck melody (sine + harmonics, fast decay) with a dotted-8th echo — the memorable hook of a jingle
  for (const [nb, midi, len = 1, v = 1] of opt.lead || []) {
    const f = 440 * 2 ** ((midi - 69) / 12), d = len * beat + 0.6, b = buf(d);
    for (let i = 0; i < b.length; i++) { const t = i / SR, env = Math.min(1, t / 0.003) * Math.exp(-t / (0.12 + 0.18 * len)); b[i] = (Math.sin(TAU * f * t) + 0.5 * Math.sin(TAU * 2 * f * t) * Math.exp(-t / 0.08) + 0.18 * Math.sin(TAU * 3 * f * t) * Math.exp(-t / 0.04) + 0.3 * Math.sin(TAU * f * 0.5 * t)) * env; }
    add(out, b, nb * beat, 0.16 * v);
    add(out, b, nb * beat + beat * 0.75, 0.05 * v);
  }
  return normalize(out, 0.7);
}

// ---------- main ----------
const argv = process.argv.slice(2);
if (argv[0] === '--bank') {
  mkdirSync(argv[1], { recursive: true });
  for (const [k, f] of Object.entries(BANK)) wav(join(argv[1], `${k}.wav`), f());
  console.log('bank ->', argv[1], Object.keys(BANK).join(', ')); process.exit(0);
}
const [piece, video, out, ...rest] = argv;
if (!piece || !video || !out) { console.error('usage: node sound.mjs <piece.html> <video.mp4> <out.mp4> [--stems dir] [--no-music] [--no-sfx]'); process.exit(1); }
const flag = (k) => rest.includes(k), opt = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : null; };

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('pageerror:', e.message));
await page.goto(pathToFileURL(resolve(piece)).href + '?paused', { waitUntil: 'domcontentloaded', timeout: 120000 }); // fonts/images are awaited by the engine (__motionReady), not by the load event
await page.waitForFunction(() => window.__motionReady === true, null, { timeout: 180000 });
const spec = await page.evaluate(() => window.__motion.sound());
const reviewMeta = flag('--no-review') ? null : await collectMeta(page);
await browser.close();

// stereo bus: every source is placed with an equal-power pan (-1 left … +1 right)
const totalL = buf(spec.duration), totalR = buf(spec.duration);
const pan = (dstL, dstR, src, at, g, p = 0) => { add(dstL, src, at, g * Math.cos((p + 1) * Math.PI / 4) * 1.414); add(dstR, src, at, g * Math.sin((p + 1) * Math.PI / 4) * 1.414); };
const stems = opt('--stems');
if (stems) mkdirSync(stems, { recursive: true });

// music: a provided track (licensed, from the user) wins over the synthesized bed
let musicTrack = null;
if (spec.music && !flag('--no-music')) {
  if (spec.music.file) musicTrack = { file: resolve(dirname(resolve(piece)), spec.music.file), start: spec.music.start || 0, vol: spec.music.vol ?? 0.8 };
  else if (spec.music.energy) {                                       // arranged stereo bed (energy per bar, drops, cuts)
    const [mL, mR] = musicStereo(spec.bpm, spec.bars, spec.music), g = spec.music.vol ?? 0.55;
    add(totalL, mL.subarray(0, totalL.length), 0, g); add(totalR, mR.subarray(0, totalR.length), 0, g);
    if (stems) wavStereo(join(stems, 'music.wav'), mL, mR);
  } else { const m = music(spec.bpm, spec.bars, spec.music), g = spec.music.vol ?? 0.55; add(totalL, m.subarray(0, totalL.length), 0, g); add(totalR, m.subarray(0, totalR.length), 0, g); if (stems) wav(join(stems, 'music.wav'), m); }
}
// sfx: { pan } in the cue options places a sound where its action is on screen
const sfxL = buf(spec.duration), sfxR = buf(spec.duration), cache = {};
if (!flag('--no-sfx')) for (const [n, c] of spec.cues.entries()) {
  if (!BANK[c.name]) { console.error(`unknown sfx "${c.name}" (bank: ${Object.keys(BANK).join(', ')})`); continue; }
  const s = (cache[c.name] ||= BANK[c.name]());
  const at = c.align === 'end' ? c.t - s.length / SR : c.t;
  pan(sfxL, sfxR, s, at, c.vol ?? 0.5, c.pan ?? 0);
}
add(totalL, sfxL, 0, 1); add(totalR, sfxR, 0, 1);
// short fade on the very end: no click when the video stops mid-ring
for (const ch of [totalL, totalR]) for (let i = 0, n = Math.round(0.12 * SR); i < n; i++) ch[ch.length - 1 - i] *= i / n;
if (stems) wavStereo(join(stems, 'sfx.wav'), sfxL, sfxR);
const tmp = mkdtempSync(join(tmpdir(), 'motion-sound-'));
wavStereo(join(tmp, 'mix.wav'), totalL, totalR);

// mux: optional user track + our mix -> loudness to -14 LUFS (social), true peak -1.5 dB, limiter at -1 dB
const inputs = ['-i', video, '-i', join(tmp, 'mix.wav')];
let fc = '[1:a]anull[m]';
if (musicTrack) {
  inputs.push('-ss', String(musicTrack.start), '-i', musicTrack.file);
  fc = `[2:a]volume=${musicTrack.vol},afade=t=in:d=0.03,afade=t=out:st=${Math.max(0, spec.duration - 0.6)}:d=0.6[t];[1:a][t]amix=inputs=2:normalize=0:duration=first[m]`;
}
// two-pass loudnorm in LINEAR mode: one gain for the whole piece (dynamic mode pumps quiet tails up)
const pass1 = spawnSync('ffmpeg', ['-v', 'info', ...inputs, '-filter_complex', fc + ';[m]loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json[a]', '-map', '[a]', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
const m = JSON.parse(pass1.slice(pass1.lastIndexOf('{'), pass1.lastIndexOf('}') + 1));
fc += `;[m]loudnorm=I=-14:TP=-1.5:LRA=11:linear=true:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset},alimiter=limit=0.891:level=false[a]`;
const r = spawnSync('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', fc, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
if (r.status) process.exit(r.status);
const vd = spawnSync('ffmpeg', ['-i', out, '-af', 'volumedetect', '-vn', '-f', 'null', '-'], { encoding: 'utf8' }).stderr.match(/max_volume: (-?[\d.]+) dB/);
console.log(`sound: ${spec.cues.length} cues, music ${musicTrack ? 'track' : spec.music ? 'synth' : 'off'}, max ${vd ? vd[1] : '?'} dB -> ${out}`);
if (reviewMeta) writeManifest({ piece, video: out, meta: reviewMeta });
