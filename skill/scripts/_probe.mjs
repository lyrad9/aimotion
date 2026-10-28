import { chromium } from 'playwright';
const url = process.argv[2];
const log = (...a) => { console.log(...a); };
log('step: launching');
const b = await chromium.launch({ timeout: 60000 });
log('step: launched');
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
const p = await ctx.newPage();
p.on('console', (m) => { if (m.type() === 'error') log('pageerror:', m.text().slice(0, 120)); });
log('step: goto');
await p.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
log('step: committed, waiting for h1');
await p.waitForSelector('h1', { timeout: 30000 }).catch((e) => log('no h1:', e.message.slice(0, 60)));
await p.waitForTimeout(3500);
log('step: evaluating');
const info = await p.evaluate(() => {
  const r = { h: document.documentElement.scrollHeight, sections: [], headings: [], imgs: [], buttons: [] };
  document.querySelectorAll('section').forEach((s) => {
    const b = s.getBoundingClientRect();
    r.sections.push({ id: s.id || '', cls: (s.className || '').toString().slice(0, 60), top: Math.round(b.top + scrollY), h: Math.round(b.height) });
  });
  document.querySelectorAll('h1,h2,h3').forEach((h) => {
    const b = h.getBoundingClientRect();
    r.headings.push({ t: h.tagName, txt: h.innerText.replace(/\s+/g, ' ').slice(0, 95), top: Math.round(b.top + scrollY) });
  });
  document.querySelectorAll('img').forEach((i) => {
    if (i.naturalWidth < 40) return;
    const b = i.getBoundingClientRect();
    r.imgs.push({ src: i.currentSrc.slice(0, 115), w: i.naturalWidth, h: i.naturalHeight, top: Math.round(b.top + scrollY), dw: Math.round(b.width) });
  });
  document.querySelectorAll('a[href],button').forEach((a) => {
    const t = (a.innerText || '').replace(/\s+/g, ' ').trim();
    if (t && t.length < 42) r.buttons.push({ t, href: (a.getAttribute('href') || '').slice(0, 44) });
  });
  return r;
});
log('scrollHeight', info.h);
log('--- SECTIONS'); info.sections.forEach((s) => log(` top=${s.top} h=${s.h} id="${s.id}" cls="${s.cls}"`));
log('--- HEADINGS'); info.headings.forEach((h) => log(` ${h.t} top=${h.top} "${h.txt}"`));
log('--- IMGS'); info.imgs.slice(0, 45).forEach((i) => log(` top=${i.top} nat=${i.w}x${i.h} disp=${i.dw} ${i.src}`));
log('--- CTA/BTN'); [...new Map(info.buttons.map((x) => [x.t, x])).values()].slice(0, 45).forEach((x) => log(` "${x.t}" -> ${x.href}`));
await b.close();
log('done');
