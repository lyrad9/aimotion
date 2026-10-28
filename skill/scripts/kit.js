/* kit.js : animations réutilisables pour le moteur Motion (charger après engine.js).
 * Tirées de vraies références décortiquées image par image (voir references/kit.md). Tout est une fonction pure du
 * temps : bt = temps musicaux locaux à la scène (lt / env.beat). Couleurs, polices et tailles passent en options :
 * aucune identité de marque n'est codée ici.
 *
 *   <script src="engine.js"></script><script src="kit.js"></script>
 *   const { line, wordLines, roleBox, giantPan, carousel3, perspectiveCarousel, ring, folder } = Kit;
 */
(function () {
  'use strict';
  const { ease, range, lerp, clamp, text, roundRect, cover, spring } = Motion;
  const cache = new Map();
  const FAMILY = 'sans-serif';

  // ======================= textes =======================
  // atterrissage « Give » (pinterest-saas-dynamic-text) : le mot arrive à `from` (160 %) et se pose avec un fort ease-out.
  // k = progression 0→1 (≈ 0,5 temps = 0,27 s à 112 BPM)
  function landWord(ctx, s, x, y, size, k, { weight = 800, family = FAMILY, color = '#fff', from = 1.6 } = {}) {
    if (k <= 0) return;
    const e = ease.outExpo(clamp(k)), font = `${weight} ${size}px ${family}`;
    ctx.font = font; const w = ctx.measureText(s).width;
    ctx.save(); ctx.globalAlpha *= clamp(k * 6);
    ctx.translate(x + w / 2, y - size * 0.36); const sc = lerp(from, 1, e); ctx.scale(sc, sc);
    text(ctx, s, -w / 2, size * 0.36, { font, color });
    ctx.restore();
  }
  // entrée d'un mot : petite montée, fondu, léger grossissement ; ni flou ni interlettrage
  function pop(ctx, s, x, y, size, k, { weight = 800, family = FAMILY, color = '#fff' } = {}) {
    if (k <= 0) return;
    const e = ease.outCubic(clamp(k)), font = `${weight} ${size}px ${family}`;
    ctx.save(); ctx.globalAlpha *= e;
    ctx.translate(x, y + (1 - e) * size * 0.12); const sc = 0.94 + 0.06 * e; ctx.scale(sc, sc);
    text(ctx, s, 0, 0, { font, color });
    ctx.restore();
  }
  // ligne vivante : les mots arrivent un à un (at[i] en temps), la ligne se recentre à chaque mot ; les mots listés dans
  // `land` atterrissent à la « Give ». Chaque mot occupe sa largeur finale dès son entrée : jamais de chevauchement.
  // Renvoie la position de chaque mot [{ x, w }].
  function line(ctx, words, y, size, bt, at, { colors = [], color = '#fff', weight = 800, family = FAMILY, gap = 0.26, dur = 0.4, cx = 960, align = 'center', land = [0] } = {}) {
    ctx.font = `${weight} ${size}px ${family}`;
    const ws = words.map((w) => ctx.measureText(w).width), sp = size * gap;
    const ks = words.map((_, i) => range(bt, at[i], at[i] + dur));
    const full = (n) => ws.slice(0, n).reduce((a, c) => a + c, 0) + sp * Math.max(0, n - 1);
    let n = 0; words.forEach((_, i) => { if (ks[i] > 0) n = i + 1; });
    const slide = n > 0 ? ease.inOutCubic(ks[n - 1]) : 1, vis = lerp(full(Math.max(0, n - 1)), full(n), slide);
    let x = align === 'center' ? cx - vis / 2 : cx; const pos = [];
    words.forEach((w, i) => {
      const c = colors[i] || color;
      if (land.includes(i)) landWord(ctx, w, x, y, size, range(bt, at[i], at[i] + 0.5), { weight, family, color: c });
      else pop(ctx, w, x, y, size, ks[i], { weight, family, color: c });
      pos.push({ x, w: ws[i] }); x += ws[i] + sp;
    });
    return pos;
  }
  // deux lignes mot par mot : quand la 2e commence, le bloc remonte d'une demi-ligne pour rester centré ;
  // sortie en traînée floue vers le haut (out = [début, fin] en temps). l1/l2 = { words, at, colors }
  function wordLines(ctx, bt, l1, l2, { cx = 960, y = 570, s1 = 100, s2 = 100, out = [3.4, 3.95], gap = 1.18, family = FAMILY, color = '#fff' } = {}) {
    const lh = (s1 + s2) / 2 * gap, lift = ease.inOutCubic(range(bt, l2.at[0], l2.at[0] + 0.5)) * lh / 2;
    const o = ease.inCubic(range(bt, out[0], out[1]));
    ctx.save(); ctx.globalAlpha *= 1 - o; if (o > 0.02) ctx.filter = `blur(${(o * 16).toFixed(1)}px)`; ctx.translate(0, -o * 60);
    line(ctx, l1.words, y - lift, s1, bt, l1.at, { cx, colors: l1.colors, family, color });
    line(ctx, l2.words, y - lift + lh, s2, bt, l2.at, { cx, colors: l2.colors, family, color, land: [] });
    ctx.restore();
  }
  // mot écrit lettre par lettre : chaque lettre monte du bas en apparaissant (t en temps depuis le début)
  function typed(ctx, s, x, y, font, t, per, rise, color) {
    ctx.font = font; let acc = '';
    for (let j = 0; j < s.length; j++) {
      const k = clamp((t - j * per) / 0.18); if (k <= 0) break;
      const xj = x + ctx.measureText(acc).width, e = ease.outCubic(k); acc += s[j];
      ctx.save(); ctx.globalAlpha *= clamp(k * 1.6); text(ctx, s[j], xj, y + (1 - e) * rise, { font, color }); ctx.restore();
    }
  }
  // rôle qui change dans un cadre surligné (pinterest-finqube-freelancers) : `lead` (ex. ['Tu', 'es']) entre mot par mot,
  // le 1er à la « Give » ; deux barres apparaissent, le cadre s'ouvre, les lettres du rôle montent une à une ; au
  // changement, l'ancien rôle sort par le haut et le cadre prend la largeur du nouveau. roles = [[nom, temps], …]
  function roleBox(ctx, bt, { lead = ['Tu', 'es'], leadAt = [0, 0.6], roles, cx = 960, y = 588, size = 132, family = FAMILY, color = '#fff',
    fill = 'rgba(108,92,231,0.5)', bar = '#9D8FFF', ink = '#E6E2FF', per = 0.05, pad = 0.3, drift = 6 } = {}) {
    const font = `800 ${size}px ${family}`; ctx.font = font;
    const sp = size * 0.26, padX = size * pad, lw = lead.map((w) => ctx.measureText(w).width), rw = roles.map(([r]) => ctx.measureText(r).width);
    let i = 0; roles.forEach(([, at], j) => { if (bt >= at) i = j; });
    const t0 = roles[0][1], bars = ease.outCubic(range(bt, t0, t0 + 0.15)), open = ease.outExpo(range(bt, t0 + 0.1, t0 + 0.45));
    const swap = i === 0 ? 1 : ease.inOutCubic(range(bt, roles[i][1], roles[i][1] + 0.4));
    const bw = i === 0 ? lerp(14, rw[0] + 2 * padX, open) : lerp(rw[i - 1], rw[i], swap) + 2 * padX;
    let vis = lw[0]; for (let j = 1; j < lead.length; j++) vis += (sp + lw[j]) * ease.inOutCubic(range(bt, leadAt[j], leadAt[j] + 0.4));
    vis += (sp + bw) * bars;
    let x = cx - vis / 2 + (4 - bt) * drift;
    lead.forEach((w, j) => { if (j === 0) landWord(ctx, w, x, y, size, range(bt, leadAt[0], leadAt[0] + 0.5), { family, color }); else pop(ctx, w, x, y, size, range(bt, leadAt[j], leadAt[j] + 0.4), { family, color }); x += lw[j] + sp; });
    if (bars <= 0) return;
    const bx = x, top = y - size * 0.86, h = size * 1.12;
    ctx.save(); ctx.globalAlpha *= bars;
    ctx.fillStyle = fill; ctx.fillRect(bx, top, bw, h);
    const bh = h * bars + 14; ctx.fillStyle = bar; ctx.fillRect(bx - 3, top + h / 2 - bh / 2, 6, bh); ctx.fillRect(bx + bw - 3, top + h / 2 - bh / 2, 6, bh);
    ctx.beginPath(); ctx.rect(bx + 3, top, bw - 6, h); ctx.clip();
    if (i > 0) { const o = ease.inCubic(range(bt, roles[i][1], roles[i][1] + 0.3)); if (o < 1) typed(ctx, roles[i - 1][0], bx + bw / 2 - rw[i - 1] / 2, y - o * size * 1.2, font, 99, per, 0, ink); }
    typed(ctx, roles[i][0], bx + bw / 2 - rw[i] / 2, y, font, bt - roles[i][1] - (i ? 0.12 : 0.3), per, size * 0.75, ink);
    ctx.restore();
  }
  // texte géant tout près de l'écran avec panoramiques (pinterest-saas-help-them-unlock-their) : le 1er mot naît petit
  // et grossit fortement ; la caméra cadre un groupe de mots, puis file en panoramique rapide vers le groupe suivant ;
  // chaque mot apparaît à sa taille pendant le panoramique ; le texte dérive sans jamais s'arrêter.
  // groups[i] = indices des mots cadrés quand le mot i arrive ; un nouveau groupe = panoramique rapide.
  // Renvoie { x, y, size, xs, ws, cam } pour accrocher un cadre de sélection ou un curseur au dernier mot.
  function giantPan(ctx, bt, { words, at, groups, colors = [], color = '#fff', family = FAMILY, fill = 0.96, maxSize = 360, W = 1920, H = 1080, drift = 14 }) {
    ctx.font = `800 100px ${family}`; const sp100 = 26, w100 = words.map((w) => ctx.measureText(w).width);
    const span = (g) => g.reduce((a, i) => a + w100[i], 0) + sp100 * (g.length - 1);
    const uniq = [...new Set(groups.map((g) => g.join(',')))].map((s) => s.split(',').map(Number));
    const size = Math.min(maxSize, (W * fill / Math.max(...uniq.map(span))) * 100), f = size / 100, sp = sp100 * f, ws = w100.map((w) => w * f), xs = [];
    let acc = 0; ws.forEach((w) => { xs.push(acc); acc += w + sp; });
    const focus = (g) => (xs[g[0]] + xs[g[g.length - 1]] + ws[g[g.length - 1]]) / 2;
    let cam = focus(groups[0]);
    for (let i = 1; i < words.length; i++) {
      const whip = groups[i][0] === i;
      cam = lerp(cam, focus(groups[i]), whip ? ease.inOutCubic(range(bt, at[i] - 0.2, at[i] + 0.35)) : ease.outCubic(range(bt, at[i], at[i] + 0.7)));
    }
    cam += bt * drift;
    const font = `800 ${size}px ${family}`, y = H / 2 + size * 0.36;
    words.forEach((w, i) => {
      const x = W / 2 + xs[i] - cam; if (x > W + 40 || x + ws[i] < -40) return;
      const a = i === 0 ? clamp(range(bt, 0, 0.12)) : clamp(range(bt, at[i] - 0.12, at[i] + 0.06)); if (a <= 0) return;
      const sc = i === 0 ? lerp(0.45, 1, ease.outExpo(range(bt, 0, 0.5))) : 1;
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(x + ws[i] / 2, y - size * 0.36); ctx.scale(sc, sc);
      text(ctx, w, -ws[i] / 2, size * 0.36, { font, color: colors[i] || color }); ctx.restore();
    });
    return { x: (i) => W / 2 + xs[i] - cam, y, size, xs, ws, cam };
  }

  // ======================= cartes =======================
  // carte prédécoupée (image recadrée au format, coins arrondis) dans un canvas ×2 entouré d'une marge transparente :
  // une fois tournée, ses bords restent lisses (pas de crénelage), sans liseré ni fond qui fuit. Mise en cache.
  function prepCard(img, w, h, { radius = 18, margin = 3, scale = 2, fx = 0.5, fy = 0.5 } = {}) {
    const key = `${img.src || img.width}|${w}x${h}|${radius}|${fx},${fy}`; let c = cache.get(key);
    if (!c) {
      c = document.createElement('canvas'); c.width = (w + 2 * margin) * scale; c.height = (h + 2 * margin) * scale;
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.scale(scale, scale);
      cover(g, img, margin, margin, w, h, { radius, fx, fy });
      c.margin = margin; cache.set(key, c);
    }
    return c;
  }
  // dessine une carte prédécoupée centrée en (x, y), avec rotation, échelle, opacité et ombre portée douce
  function drawCard(ctx, c, x, y, w, h, { rot = 0, s = 1, alpha = 1, shadow = 'rgba(8,4,30,0.45)', blur = 26, dy = 10 } = {}) {
    if (alpha <= 0 || s <= 0) return;
    const m = c.margin || 0;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    if (shadow) { ctx.shadowColor = shadow; ctx.shadowBlur = blur; ctx.shadowOffsetY = dy; }
    ctx.drawImage(c, -w / 2 - m, -h / 2 - m, w + 2 * m, h + 2 * m);
    ctx.restore();
  }

  // ======================= carrousels =======================
  // trois cartes (pinterest-animation-motion-graphic-video) : la carte du centre devant ; ses voisines à `side`, assombries,
  // presque collées à elle. Un cran (steps[k] en temps, durée `dur`) : la carte du centre recule vers la droite pendant
  // que celle de gauche avance ; elles se croisent à taille égale puis celle de gauche passe devant ; la carte de droite
  // glisse derrière et disparaît, une nouvelle sort de derrière à gauche. Mettre `motionBlur: 1` sur la scène (référence nette).
  function carousel3(ctx, imgs, bt, { cx = 960, cy = 590, w = 700, ratio = 9 / 16, side = 0.8, off = 644, steps = [1.2, 3.3, 5.4], dur = 1.2, dim = 0.45, radius = 20, night = '11,10,22', alpha = 1 } = {}) {
    const n = imgs.length, shift = steps.reduce((a, t0) => a + ease.inOutCubic(range(bt, t0, t0 + dur)), 0);
    const slot = (d) => { const a = Math.min(Math.abs(d), 2), near = a <= 1;
      return { x: Math.sign(d) * (near ? off * a : lerp(off, off * 0.55, a - 1)), s: near ? lerp(1, side, a) : lerp(side, 0.64, a - 1), dim: near ? dim * a : dim, alpha: near ? 1 : 2 - a }; };
    const items = []; for (let i = -3; i <= steps.length + 3; i++) items.push(i);
    const key = (i) => Math.abs(shift - i) + (shift - i < 0 ? 0.001 : 0);
    items.sort((a, c) => key(c) - key(a));
    for (const i of items) {
      const d = shift - i; if (Math.abs(d) > 2) continue;
      const sl = slot(d), cw = w * sl.s, ch = cw * ratio, r = radius * sl.s, x = cx + sl.x - cw / 2, y = cy - ch / 2;
      ctx.save(); ctx.globalAlpha *= sl.alpha * alpha;
      ctx.shadowColor = 'rgba(8,4,30,0.6)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18;
      roundRect(ctx, x, y, cw, ch, r); ctx.fillStyle = '#111'; ctx.fill(); ctx.shadowColor = 'transparent';
      cover(ctx, imgs[((i % n) + n) % n], x, y, cw, ch, { radius: r });
      roundRect(ctx, x, y, cw, ch, r); ctx.lineWidth = 1.5; ctx.strokeStyle = `rgba(255,255,255,${0.18 * (1 - sl.dim / dim)})`; ctx.stroke();
      if (sl.dim > 0.01) { roundRect(ctx, x, y, cw, ch, r); ctx.fillStyle = `rgba(${night},${sl.dim})`; ctx.fill(); }
      ctx.restore();
    }
  }
  // carrousel en perspective (pinterest-smooth-carousel-animation) : carte centrale grande et de face ; voisines plus
  // petites, tournées vers le centre, assombries ; avance d'un cran (glissé doux) à chaque `steps`, puis pause.
  // slots = [[décalage x, largeur, hauteur côté centre, hauteur côté extérieur, assombrissement], …] du centre vers le bord
  function perspectiveCarousel(ctx, cards, bt, { cx = 960, cy = 610, steps = [1.2, 3.7, 6.2], dur = 0.95, slots = [[0, 760, 428, 428, 0], [505, 400, 330, 282, 0.3], [800, 230, 262, 230, 0.5], [970, 120, 214, 192, 0.72]], night = '11,10,22', alpha = 1 } = {}) {
    const n = cards.length, shift = steps.reduce((a, t0) => a + ease.inOutCubic(range(bt, t0, t0 + dur)), 0);
    const at = (d) => { const a = Math.min(Math.abs(d), 3), i = Math.min(slots.length - 2, Math.floor(a)), t = a - i, A = slots[i], B = slots[i + 1];
      return { x: Math.sign(d) * lerp(A[0], B[0], t), w: lerp(A[1], B[1], t), hin: lerp(A[2], B[2], t), hout: lerp(A[3], B[3], t), dim: lerp(A[4], B[4], t), fade: clamp(3.6 - Math.abs(d)) }; };
    const items = []; for (let i = -4; i <= steps.length + 4; i++) items.push(i);
    items.sort((a, c) => Math.abs(c - shift) - Math.abs(a - shift));
    for (const i of items) {
      const d = i - shift; if (Math.abs(d) > 3.6) continue;
      const s = at(d), img = cards[((i % n) + n) % n], x = cx + s.x, N = 48, sw = img.width / N;
      ctx.save(); ctx.globalAlpha *= s.fade * alpha;
      for (let j = 0; j < N; j++) {
        const u = (j + 0.5) / N, inner = d > 0 ? 1 - u : d < 0 ? u : 1, h = lerp(s.hout, s.hin, inner);
        ctx.drawImage(img, j * sw, 0, sw + 0.6, img.height, x - s.w / 2 + (j / N) * s.w, cy - h / 2, s.w / N + 0.9, h);
      }
      if (s.dim > 0.01) {
        const hl = d > 0 ? s.hin : s.hout, hr = d > 0 ? s.hout : s.hin, x0 = x - s.w / 2, x1 = x + s.w / 2;
        ctx.beginPath(); ctx.moveTo(x0, cy - hl / 2); ctx.lineTo(x1, cy - hr / 2); ctx.lineTo(x1, cy + hr / 2); ctx.lineTo(x0, cy + hl / 2); ctx.closePath();
        ctx.fillStyle = `rgba(${night},${s.dim})`; ctx.fill();
      }
      ctx.restore();
    }
  }
  // anneau de cartes carrées (pinterest-carousel-after-effects) : les cartes restent droites pendant que l'anneau tourne
  // dans le sens horaire ; chaque cycle = lent, tour rapide, ralenti (inOutExpo). Les cartes jaillissent du centre à
  // l'entrée ; celles du bas passent devant. card/r ≈ 0,8 comme la référence. Mettre `motionBlur: 1` sur la scène.
  function ring(ctx, imgs, bt, { cx = 960, cy = 610, r = 280, card = 220, cycles = [0.9, 4.5], len = 3.1, turn = 0.75, drift = 0.02, radius = 22, out = 0 } = {}) {
    const rot = (bt * drift + cycles.reduce((a, t0) => a + turn * ease.inOutExpo(range(bt, t0, t0 + len)), 0)) * Math.PI * 2;
    imgs.map((img, i) => {
      const k = ease.outExpo(range(bt, i * 0.04, i * 0.04 + 0.7)), a = -Math.PI / 2 + (i / imgs.length) * Math.PI * 2 + rot;
      return { img, k, x: lerp(cx, cx + Math.cos(a) * r, k), y: lerp(cy, cy + Math.sin(a) * r, k) };
    }).sort((p, q) => p.y - q.y).forEach(({ img, k, x, y }) => {
      if (k <= 0) return;
      drawCard(ctx, prepCard(img, card, card, { radius }), x, y, card, card, { s: lerp(0.1, 1, k) * (1 - out * 0.3), alpha: clamp(k * 3) * (1 - out), blur: 30, dy: 12 });
    });
  }

  // ======================= objets =======================
  // dossier qui s'ouvre : arrive fermé ; ses images (même format, prédécoupées) sortent l'une après l'autre et s'ouvrent
  // en éventail, toujours dans la largeur du dossier ; leur base reste cachée derrière la face avant (au moins 40 px,
  // rebond compris). Dos nettement plus foncé que la face avant (profondeur) ; face avant plate et fixe (une bascule ou
  // une bande de reflet la font paraître penchée). t en temps depuis l'arrivée ; t ≥ 2 = ouvert.
  function folder(ctx, imgs, t, cx, cy, s, a, { w = 460, h = 340, tabW = 170, tabH = 36, front = 76, cw = 165, ch = 220, spread = 118, tilt = 0.17,
    back = ['#5546D6', '#3B2FB0'], face = ['#8A7BF6', '#7464EC'], blur = 0 } = {}) {
    if (a <= 0) return;
    const x0 = -w / 2, y0 = -h / 2, fy = y0 + front, n = imgs.length, mid = (n - 1) / 2;
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(cx, cy); ctx.scale(s, s);
    if (blur > 0.4) ctx.filter = `blur(${blur.toFixed(1)}px)`;
    ctx.save(); ctx.shadowColor = 'rgba(60,40,160,0.35)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20;
    const gb = ctx.createLinearGradient(0, y0 - tabH, 0, h / 2); gb.addColorStop(0, back[0]); gb.addColorStop(1, back[1]); ctx.fillStyle = gb;
    roundRect(ctx, x0, y0 - tabH, tabW, tabH + 30, 18); ctx.fill(); roundRect(ctx, x0, y0, w, h, 26); ctx.fill(); ctx.restore();
    imgs.map((img, k) => {
      const off = k - mid, rank = Math.abs(off), e = ease.outBack(range(t, 0.85 + rank * 0.16, 1.4 + rank * 0.16)), lift = rank ? 0 : 40;
      return { img, rank, e, x: lerp(off * spread * 0.4, off * spread, e), y: lerp(fy + 16 + ch / 2, fy + 0.45 * ch - ch / 2 - lift, e), rot: off * tilt * e };
    }).sort((p, q) => q.rank - p.rank).forEach((c) => drawCard(ctx, prepCard(c.img, cw, ch, { radius: 14 }), c.x, c.y, cw, ch, { rot: c.rot, shadow: 'rgba(30,16,80,0.3)', blur: 22, dy: 6 }));
    const fh = h / 2 - fy;
    ctx.save(); ctx.shadowColor = 'rgba(40,24,110,0.22)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = -4;
    const gf = ctx.createLinearGradient(0, fy, 0, h / 2); gf.addColorStop(0, face[0]); gf.addColorStop(1, face[1]);
    roundRect(ctx, x0, fy, w, fh, 26); ctx.fillStyle = gf; ctx.fill(); ctx.restore();
    ctx.save(); roundRect(ctx, x0, fy, w, fh, 26); ctx.clip();
    const edge = ctx.createLinearGradient(0, fy, 0, fy + 36); edge.addColorStop(0, 'rgba(255,255,255,0.55)'); edge.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = edge; ctx.lineWidth = 3; roundRect(ctx, x0, fy, w, fh, 26); ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  // ======================= structure =======================
  // insérer `count` mesures à la mesure `at` sans casser la musique ni le découpage : les scènes, drops, coupures, montées
  // et notes de mélodie situés à partir de `at` sont décalés ; les mesures insérées tiennent l'accord et l'énergie de la
  // mesure précédente (ou `energy` si fourni). Renvoie { bars, music, scenes } à passer à Motion.run.
  function insertBars({ bars, music = null, scenes = [] }, at, count = 1, { energy } = {}) {
    const shift = (b) => (b >= at ? b + count : b);
    const ins = (arr, v) => (Array.isArray(arr) ? [...arr.slice(0, at), ...Array(count).fill(v ?? arr[Math.max(0, at - 1)]), ...arr.slice(at)] : arr);
    let m = music;
    if (m && typeof m === 'object') {
      m = { ...m, prog: ins(m.prog), energy: ins(m.energy, energy), drops: m.drops?.map(shift), risers: m.risers?.map(shift) };
      if (m.cuts) m.cuts = Object.fromEntries(Object.entries(m.cuts).map(([k, v]) => [shift(+k), v]));
      if (m.lead) m.lead = m.lead.map(([beat, ...rest]) => [beat >= at * 4 ? beat + count * 4 : beat, ...rest]);
    }
    return { bars: bars + count, music: m, scenes: scenes.map((s) => (s.bar >= at ? { ...s, bar: s.bar + count } : s)) };
  }

  window.Kit = { landWord, pop, line, wordLines, typed, roleBox, giantPan, prepCard, drawCard, carousel3, perspectiveCarousel, ring, folder, insertBars };
})();
