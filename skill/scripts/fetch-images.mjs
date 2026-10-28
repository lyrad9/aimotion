// Récupère les images d'ORIGINE d'une page (format natif, pleine résolution), et non des recadrages de capture :
// derrière /_next/image?url=… (Next.js) ou un srcset, on télécharge le fichier source. Rien n'est modifié sur le site.
// usage : node fetch-images.mjs <url> <dossier> [--selector "main img"] [--limit 16] [--min 200] [--storage state.json] [--scroll 8] [--prefix img]
//   --selector : les <img> à prendre, dans l'ordre de la page (ex. "section button.group img" pour une galerie)
//   --min      : largeur naturelle minimale (écarte icônes et avatars)
//   --storage  : session connectée (voir login.mjs) ; elle est réenregistrée après chargement (jetons qui tournent)
//   --scroll   : nombre de défilements pour charger les listes paresseuses
// Écrit <prefix>_<n>.<ext> et images.json (fichier, largeur, hauteur, texte alternatif, URL d'origine).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [, , url, out, ...rest] = process.argv;
if (!url || !out) { console.error('usage: node fetch-images.mjs <url> <dossier> [--selector "main img"] [--limit 16] [--min 200] [--storage state.json] [--scroll 8]'); process.exit(1); }
const arg = (k, d) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : d; };
const selector = arg('--selector', 'main img'), limit = +arg('--limit', 16), min = +arg('--min', 200), storage = arg('--storage'), prefix = arg('--prefix', 'img');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...(storage ? { storageState: storage } : {}) });
const save = () => (storage ? ctx.storageState({ path: storage }).catch(() => {}) : null);
const fail = async (e) => { console.error(e); await save(); await browser.close(); process.exit(1); };
process.on('unhandledRejection', fail);
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });   // pas networkidle : les sites temps réel ne s'arrêtent jamais
await page.waitForTimeout(4000); await save();
for (let k = 0; k < +arg('--scroll', 0); k++) { await page.mouse.wheel(0, 2500); await page.waitForTimeout(900); }
await page.waitForFunction((s) => [...document.querySelectorAll(s)].some((i) => i.complete && i.naturalWidth), selector, { timeout: 60000 }).catch(() => {});

const found = await page.$$eval(selector, (els, min) => els
  .filter((i) => i.naturalWidth >= min)
  .map((i) => ({ src: i.currentSrc || i.src, alt: i.alt || '', w: i.naturalWidth, h: i.naturalHeight })), min);
const seen = new Set(), list = [];
for (const f of found) {
  const u = new URL(f.src, url), orig = u.pathname.startsWith('/_next/image') && u.searchParams.get('url') ? new URL(u.searchParams.get('url'), url).href : u.href;
  if (seen.has(orig)) continue; seen.add(orig);
  let res; for (let k = 0; k < 3 && !res?.ok(); k++) res = await ctx.request.get(orig, { timeout: 60000 }).catch(() => null);
  if (!res?.ok()) { console.log('✗', orig); continue; }
  const type = res.headers()['content-type'] || '', ext = /png/.test(type) ? 'png' : /webp/.test(type) ? 'webp' : /svg/.test(type) ? 'svg' : /avif/.test(type) ? 'avif' : 'jpg';
  const file = `${prefix}_${list.length}.${ext}`;
  writeFileSync(join(out, file), await res.body());
  list.push({ file, w: f.w, h: f.h, alt: f.alt, url: orig });   // w/h = dimensions affichées par le site (le fichier peut être plus grand)
  console.log('✓', file, f.alt.slice(0, 60));
  if (list.length >= limit) break;
}
writeFileSync(join(out, 'images.json'), JSON.stringify(list, null, 1));
await save(); await browser.close();
console.log(`${list.length} images -> ${out}`);
