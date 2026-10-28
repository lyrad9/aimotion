# Kit : animations réutilisables (`scripts/kit.js`)

Charger après le moteur : `<script src="engine.js"></script><script src="kit.js"></script>`, puis `const { line, … } = Kit;`.
Démonstration de chaque animation : `templates/kit-demo.html`.

Chaque animation vient d'une vraie référence décortiquée image par image (tailles, écarts, durées, courbes mesurés).
Les mesures sont dans les commentaires de `kit.js`. Toutes les fonctions prennent `bt` = temps musicaux locaux à la
scène (`lt / env.beat`). Couleurs, polices et tailles passent en options : aucune identité de marque n'est codée dans le kit.

## Textes
| Fonction | Ce que ça fait | Référence |
|---|---|---|
| `landWord(ctx, mot, x, y, taille, k, opts)` | Le mot arrive à 160 % et se pose avec un fort ease-out (≈ 0,27 s) | pinterest-saas-dynamic-text (« Give ») |
| `pop(ctx, mot, x, y, taille, k, opts)` | Petite montée, fondu, léger grossissement | idem, mots suivants |
| `line(ctx, mots, y, taille, bt, at, opts)` | Mots un à un, la ligne se recentre ; `land: [0]` = le 1er atterrit (défaut). Renvoie la position de chaque mot | idem |
| `wordLines(ctx, bt, l1, l2, opts)` | Deux lignes mot par mot, le bloc remonte quand la 2e arrive, sortie en traînée floue | pinterest-company-profile-motion |
| `roleBox(ctx, bt, { lead, roles, … })` | « Tu es [rôle] » : cadre surligné à deux barres, lettres qui montent, l'ancien rôle sort par le haut, le cadre s'adapte | pinterest-finqube-freelancers |
| `giantPan(ctx, bt, { words, at, groups })` | Texte géant (≈ 96 % de la largeur), le 1er mot grossit fortement, panoramiques rapides de groupe en groupe, dérive continue. Renvoie de quoi accrocher un cadre de sélection | pinterest-saas-help-them-unlock-their |

Règle : **la même animation de texte partout** dans une pièce (1er mot qui atterrit, puis mot par mot). Mélanger les styles se voit.

## Cartes
| Fonction | Ce que ça fait |
|---|---|
| `prepCard(img, w, h, { radius })` | Carte prédécoupée (image recadrée au format, coins arrondis) dans un canvas ×2 avec marge transparente : bords lisses quand elle tourne, aucun liseré. En cache |
| `drawCard(ctx, carte, x, y, w, h, { rot, s, alpha, shadow })` | Dessine une carte prédécoupée centrée, avec ombre douce |

## Carrousels et objets
| Fonction | Ce que ça fait | Référence |
|---|---|---|
| `carousel3(ctx, imgs, bt, { steps, dur, w, ratio })` | 3 cartes, côtés à 80 % presque collés ; à chaque cran les cartes se croisent à taille égale, celle de gauche passe devant | pinterest-animation-motion-graphic-video |
| `perspectiveCarousel(ctx, imgs, bt, { steps })` | Carte centrale de face, voisines en perspective et assombries, un cran puis une pause | pinterest-smooth-carousel-animation |
| `ring(ctx, imgs, bt, { cycles, len, turn })` | Anneau de cartes carrées qui restent droites ; cycles « lent, tour rapide, ralenti » | pinterest-carousel-after-effects |
| `folder(ctx, imgs, t, cx, cy, s, a, opts)` | Dossier qui arrive fermé ; ses images sortent en éventail dans sa largeur, base toujours cachée | image Spotify fournie par un client |

Les carrousels et l'anneau des références restent **nets** : mettre `motionBlur: 1` sur leur scène.

## Structure
`insertBars({ bars, music, scenes }, at, count)` insère des mesures à la mesure `at`. Elle décale ensemble les scènes, les drops, les coupures, les montées et les notes de mélodie. Les mesures insérées tiennent l'accord et l'énergie de la mesure précédente.

Pour **allonger une scène**, insérer après elle (`at = bar + bars`), puis augmenter son `bars` :
```js
const plan = insertBars({ bars: 36, music, scenes }, 29, 1);
plan.scenes.find((s) => s.draw === flyers).bars += 1;
Motion.run({ …, ...plan });
```
Ensuite, `render-chunks.mjs` voit que la durée a changé et refait tout le découpage.
