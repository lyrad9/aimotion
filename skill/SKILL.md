---
name: aisance-motion-design
description: Use when asked to create motion design, a promo video for a channel/site/product (capturing its real pages, thumbnails, stats), an animated reel, a kinetic typography piece, an animated intro/outro, a logo animation, a looping animated visual or a "video written in code" (HTML canvas → MP4, with synced music and sound effects), or when an animation feels flat, floaty, generic or "not premium" and needs pro motion-design polish.
---

# Motion design en code

## Principe
Une pièce de motion « satisfaisante » est **verrouillée sur un tempo** et **calculée image par image**. Chaque image est une fonction pure de `t`, chaque événement tombe sur un temps musical, et tout ce qui bouge vite est flou comme sous un obturateur de caméra. Le reste (palette, motif, transitions) sert ce rythme.

Référence décortiquée : `references/techniques.md`. C'est le catalogue des 15 techniques, avec la structure mesure par mesure du reel d'origine.

## Déroulé d'une commande de vidéo (toujours dans cet ordre)
Quand l'utilisateur demande de réaliser une vidéo (promo d'un produit, d'une app, d'un site…), suivre ces étapes une par une. Ne jamais sauter une validation : une question coûte quelques secondes, un rendu raté des dizaines de minutes.

1. **Cadrage** (questions fermées, recommandation en premier) : format (9:16, 16:9 ou les deux) et durée ; objectif et cible ; appel à l'action ; lieu de diffusion ; livraison attendue (déclinaisons, version sans texte, son à part, dossier de livraison).
2. **Charte graphique.** L'utilisateur fournit le logo. Chercher en ligne le produit, en lien avec ce que la vidéo doit montrer :
   - site officiel et fiches des stores : positionnement, fonctions, slogans, chiffres ;
   - couleurs exactes (variables CSS du site), polices (fichiers du site), vraies captures de l'app ou du site (images du site, `scripts/capture.mjs`) ;
   - logo en basse définition : le reconstruire en haute définition (masque agrandi, lissé puis seuillé) plutôt que de l'agrandir flou ;
   - pas de site web : demander la charte (couleurs, polices) et des captures.
   **Que des informations vérifiées** : n'afficher ni ne dire aucune fonction, aucun chiffre, aucune promesse qui ne vienne d'une source (site, store), et noter la source. Consigner la charte dans `preferences.md`.
3. **Références.** Demander à l'utilisateur sur quelles vidéos s'appuyer : elles sont dans `D:\Code\VMD\references` (lister les fichiers présents pour qu'il choisisse). Les analyser image par image et les mesurer (section « Vidéos de référence » plus bas) : animations, transitions, son, voix, bruitages. Écrire la fiche `references.md` du projet (geste par geste, temps mesurés, transposition au projet).
4. **Script et storyboard** (`script.md`) : voix off mot pour mot, déroulé scène par scène avec la référence de chaque geste, son, liste des images à produire. **L'utilisateur valide le script avant toute génération** (image, voix, musique).
5. **Images.** Toujours demander comment les obtenir : générées par IA via Figma (`generate_image`) ou cherchées en ligne. Prévenir du coût avant de dépenser des crédits (Figma, ElevenLabs). Pour des personnages récurrents : une description fixe (visage, coiffure, tenue) reprise dans chaque génération, et dire la limite (génération à partir de texte seul : les visages peuvent varier). Plusieurs portraits secondaires : une seule image en grille, découpée ensuite. **L'utilisateur valide les images avant l'animation.**
6. **Voix off : toujours ElevenLabs.**
   - Voix choisie selon la cible (langue, accent, genre, âge, ton) avec `creative_list_voices`, sans demander ; préciser le choix à l'utilisateur.
   - Une seule prise par génération (le compte est vite limité : erreurs 429 et quota). Ne jamais relancer une génération qui a démarré ; une requête refusée avant de démarrer (429) peut être relancée plus tard.
   - Quota épuisé ou ElevenLabs indisponible : prévenir l'utilisateur et faire une **voix témoin provisoire** (edge-tts) pour avancer ; la remplacer par la voix ElevenLabs dès qu'elle est disponible, sans changer les instants des phrases dans la vidéo.
   - **Toujours transcrire la voix avec Scribe** (`creative_transcribe_audio`, `connect_from` = le nœud de la voix) pour avoir chaque mot avec son début et sa fin ; l'enregistrer dans le projet (`voix/…/mots.js`). Les légendes et les gestes se calent sur ces temps.
   - Montage de la voix : chaque morceau de phrase est coupé dans le fichier et posé à son instant dans la vidéo (`voix/montage.js`, lu par la pièce ET par le mixage), pour donner à chaque scène sa respiration.
7. **Musique : demander à l'utilisateur** s'il la préfère générée en code (`sound.mjs`) ou par ElevenLabs. ElevenLabs musique demande le connecteur complet (`https://api.elevenlabs.io/v1/mcp`, à ajouter en connecteur personnalisé) : celui de base ne fait que la voix ; le rappeler.
8. **Point de contrôle avant de monter.** Récapituler et faire confirmer que tout est prêt : charte, références analysées, script validé, images validées, voix et transcription, choix de la musique. Ne commencer l'animation qu'après ce « c'est bon ».
9. **Animation : fluide, et rien en retard.**
   - Chaque mot, objet ou geste lié à la voix arrive **au plus tard sur son mot** (temps Scribe), jamais après ; un élément annoncé par la voix ne traîne pas derrière elle.
   - Transitions et animations fluides : final à 60 i/s avec flou de mouvement, vocabulaire de courbes unique, rien de ce qui parcourt plus de 100 px ne bouge en moins de 0,3 s, temps de pose après chaque mouvement.
   - Les éléments d'un même geste partent ensemble : aucun ne doit être en retard sur l'autre (une poussée suit la même courbe et la même durée que l'entrée qui la provoque).
   - Vérifier la fluidité par la mesure (section « Contrôle qualité »).
10. **Son : la musique et les bruitages n'interfèrent jamais avec la voix off.** Mixer avec `scripts/mix-voix.mjs` : musique baissée sous la voix dès qu'elle parle (sidechain), et gain automatique qui place le passage le plus fort de musique + bruitages (sonie court terme, 3 s) à **5 LU sous la voix** (entre 4 et 6 : jamais plus fort qu'elle, jamais enterrée) ; sortie à -14 LUFS. Le script affiche la marge obtenue : la vérifier.
11. **Rendus** : images fixes de contrôle de chaque scène → **aperçu complet à 30 i/s** avec voix, musique et bruitages, que l'utilisateur valide → **rendu final à 60 i/s**. Donner l'heure de fin de chaque rendu. Ne lancer le final qu'avec l'accord de l'utilisateur.
12. **Livraison** : les fichiers demandés à l'étape 1 (formats, déclinaisons, version sans texte, son seul), dans le dossier convenu.

## Démarrage
0. **Préférences du projet** : lire `preferences.md` à la racine du dossier des vidéos (ou de la pièce) **à chaque tour**. S'il n'existe pas, le créer dès le premier échange : façon de travailler, machine, identité (couleurs, polices, CTA, URL), interdits et règles de goût, décisions de contenu, table des références. Il prime sur les règles générales de ce skill. Le compléter dès qu'un retour fixe une règle durable (« ne fais plus jamais… », « toujours… », « partout »). Les goûts d'un client restent dans son projet, pas dans ce skill.
1. Copier `templates/reel.html` dans le projet, et `scripts/engine.js` à côté (puis ajuster le `src`). Déclarer chaque police utilisée dans `fonts: [...]` de `Motion.run` : le canvas ne déclenche pas seul le chargement des polices.
2. Écrire le **storyboard en mesures** avant tout code (format ci-dessous).
3. Une fonction `draw(ctx, p, lt, env)` par scène. `p` = 0→1 sur la scène, `lt` = secondes locales, `env.beat` / `env.bar` = durées.
4. Vérifier en ouvrant le HTML (espace, flèches, shift + flèches = un temps).
5. Rendre. Le script reste dans le dossier du skill et se lance depuis n'importe où :
   - une seule fois : `cd ~/.claude/skills/aisance-motion-design/scripts && npm i && npx playwright install chromium-headless-shell`
   - images de contrôle (rapide, un seul lancement) : `node ~/.claude/skills/aisance-motion-design/scripts/render.mjs piece.html - --frames 50,160,300,420 --stills chk`
   - vérifier une transition : `node ~/.claude/skills/aisance-motion-design/scripts/render.mjs piece.html - --from 220 --to 232 --stills chk --every 3`
   - rendu complet : `node ~/.claude/skills/aisance-motion-design/scripts/render.mjs piece.html out.mp4 [--stills dir --every 15]`
   - **pièce longue ou machine lente** : `node ~/.claude/skills/aisance-motion-design/scripts/render-chunks.mjs piece.html renders/out.mp4 [--bars 33-36] [--round N]`. Le rendu se fait en morceaux de 600 images, puis il est assemblé sans réencodage, avec le son et le manifeste.
     - Relancé sans option, il reprend là où il s'est arrêté : seuls les morceaux absents ou incomplets sont refaits.
     - `--bars a-b` refait seulement les morceaux de la scène retouchée.
     - Si la durée change, tout le découpage est recalculé.
     - `--dry` montre le plan, et l'heure de fin s'affiche après chaque morceau.
     - Ne jamais lancer deux rendus en même temps.
   - coût indicatif : environ 2 à 4 min pour 600 à 700 frames avec le flou activé (jusqu'à 25 min sur un portable ancien). Itérer sur des images fixes, ne faire le rendu complet qu'à la fin.
6. **Regarder les images en taille réelle autour de chaque coupe** (3 ou 4 frames juxtaposées avec ffmpeg `hstack`, ou une planche de 8 frames au plus). Les grandes planches contact induisent en erreur. À vérifier : coupes nettes, rien de rogné, texte lisible, dernière image posée.
7. **Manifeste de relecture, à chaque vidéo créée ou mise à jour.** Le rendu complet (`render.mjs` sans `--from/--to`) et le mixage (`sound.mjs`) écrivent automatiquement `review/manifest.json` à côté de la pièce. Si la vidéo finale a été assemblée autrement (rendu en morceaux + `ffmpeg concat`, ou `sound.mjs` lancé avec `--no-review`), le lancer à la main : `node ~/.claude/skills/aisance-motion-design/scripts/review.mjs piece.html renders/out.mp4`. Vérifier que la ligne `review: round N … (valide)` s'affiche. Puis proposer d'ouvrir la relecture : `clap open <dossier de la pièce>`. Détails → section « Relecture » plus bas.

## Contenu réel et son (toujours lire la référence avant)
- **Captures** : quand la vidéo parle d'un site, d'une chaîne ou d'un produit, capturer soi-même le vrai contenu avec `scripts/capture.mjs` (pages, éléments, listes, textes, positions des éléments pour les zooms caméra). → `references/captures.md`. Pour les visuels eux-mêmes (galerie, bibliothèque), récupérer les fichiers d'origine au format natif avec `scripts/fetch-images.mjs` plutôt que de recadrer une capture. Exemple complet : `templates/promo-youtube.html`. Intro / jingle de chaîne (5 mesures, sans HUD, logo sonore, textes dans `BRAND`) : `templates/intro-jingle.html`.
- **Voix off** : ElevenLabs, transcrite par Scribe, montée par `voix/montage.js` et mixée par `scripts/mix-voix.mjs` (règles aux étapes 6 et 10 du déroulé) : `node ~/.claude/skills/aisance-motion-design/scripts/mix-voix.mjs piece.html renders/out.silent.mp4 renders/out.mp4 [--voix voix.wav] [--marge 5]`. Le fichier `.silent.mp4` est laissé par `render-chunks.mjs`.
- **Son** : activé par défaut. Bruitages déclarés par scène en **temps** (`sfx: [[2, 'swish', 0.5]]`, mêmes nombres que l'animation), fond musical synthétisé au BPM de la pièce, ou piste licenciée fournie par l'utilisateur. Mixé et masterisé par `render.mjs`. → `references/sound.md`.

## Relecture (Clap)
L'app de relecture locale **Clap** (dossier `D:\Code\aisance-video-editing`, commande `clap` ; l'ancien nom `aisance-video-editing` reste un alias) lit `review/manifest.json` et écrit les commentaires de l'utilisateur dans `review/review.json`. `scripts/review.mjs` produit le manifeste (stade `final`) depuis la pièce elle-même : une piste **Scènes** (une entrée par scène de `Motion.run`), **Mesures** (un repère par mesure), **Bruitages** (un repère par sfx) et **Son** (forme d'onde lue dans le MP4). Chemins relatifs au dossier `review/`.
- **Identifiants stables** : les commentaires sont rattachés à l'id de la scène. Id = `scene.id` s'il existe, sinon le nom de la fonction `draw` (`draw: hook` → `hook`), sinon `bar-N`. Toujours nommer les fonctions de scène (pas de `draw: (ctx) => …` anonyme) et **ne jamais renommer** une fonction entre deux tours. Champs facultatifs lus par le manifeste (ignorés par le moteur) : `label` (titre lisible, ex. `'01 Inspiration'`) et `note` (ce qui se passe à l'écran). Les renseigner dans chaque scène.
- **Tours** : le numéro de tour reste le même tant que personne n'a commenté la version courante ; dès que `review.json` contient des commentaires du tour courant, le rendu suivant passe au tour + 1. `--round N` force la valeur.
- **Appliquer des retours** (« applique les retours », « corrige d'après la relecture ») :
  1. `clap comments <dossier>` pour lister les commentaires ouverts (temps, frame, scène visée, texte ; la capture est dans `review/shots/`, la regarder) et les **coupes**.
     - Un commentaire peut viser une **zone** (`area` : x, y, w, h entre 0 et 1, aussi donnée en pixels du canevas par `clap comments`) au lieu d'un point : la retouche porte sur tout ce qui est dans ce rectangle ; la capture assombrit le reste.
     - Ou une **flèche** / un **tracé libre** (`drawing` : la pointe de la flèche désigne le sujet, souvent « à déplacer ici »), ou un **marqueur** (`marker: true`, posé avec M sans texte : regarder la capture et deviner le problème, demander si ce n'est pas évident).
     - **Coupes** (`cuts` du tour courant dans `review.json`, listées « ✂ » par `clap comments`) : passages à retirer de la vidéo, en temps de la vidéo de ce tour. Les retirer dans la pièce (raccourcir ou supprimer les scènes concernées, recaler la musique et les bruitages au BPM), pas en découpant le MP4. Ne jamais modifier ni effacer `cuts` : le tour suivant les rend caduques.
  2. Corriger dans la pièce la scène visée (`target.item` = id de la scène, `t` / `frame` = l'instant exact). Vérifier par images de contrôle autour de `frame`.
  3. Dans `review/review.json`, passer chaque commentaire traité à `"status": "resolved"` (ou `"wontfix"`) et écrire une explication courte de la correction dans `"resolution"`. Ne jamais toucher au statut global ni aux approbations : c'est l'app qui les gère.
  4. Refaire le rendu complet : le manifeste passe tout seul au tour suivant. Proposer de rouvrir la relecture.
- Sous Windows, si `open` plante sur `xdg-open`, utiliser `--no-open` et ouvrir l'URL affichée.

## Vidéos de référence : les mesurer avant d'animer
Quand l'utilisateur fournit une référence (« fais exactement comme… »), une analyse rapide ne suffit pas : chaque approximation coûte un tour de rendu.
1. **Planche image par image** avec le temps sur chaque image, 12 à 30 i/s sur le passage concerné, recadrée sur le sujet :
   `ffmpeg -ss 0.4 -t 1.5 -i ref.mp4 -vf "fps=15,crop=…,scale=360:-1,drawtext=text='%{pts\:flt}':x=4:y=4:fontsize=14:fontcolor=red,tile=6x5" -frames:v 1 planche.png`
   (sous Windows, `drawtext` sans `fontfile` affiche un avertissement Fontconfig sans gravité). Commencer par une planche large à 2–4 i/s pour situer le passage, puis zoomer dessus.
2. **Relever des chiffres**, pas des impressions :
   - tailles en % du cadre (hauteur des capitales, largeur d'une ligne, taille des cartes) ;
   - écarts et recouvrements (une carte de côté est-elle collée, cachée de 10 %, de 40 % ?) ;
   - durées en secondes de chaque phase, puis converties en temps (`b`) ;
   - courbe (démarrage lent, coup rapide, long ralenti = `inOutExpo` ; arrivée sèche = `outExpo`…) ;
   - ordre de passage devant / derrière, moment où il s'inverse ;
   - présence ou non de flou de mouvement (beaucoup de références restent nettes : ne pas en ajouter) ;
   - ce qui ne bouge pas (fond, texte) autant que ce qui bouge.
3. Écrire ces mesures en commentaire au-dessus de la scène, puis coder. À la livraison, dire ce qui a été repris et ce qui a été adapté (ex. cartes carrées → 16:9).
4. Ne pas recopier les éléments du décor de la référence (quadrillage, logos, flèche) sans qu'on le demande.

## Questions avant de coder
Dès qu'un retour est ambigu, poser les questions **avant** de toucher au code (2 à 4 questions fermées, avec la recommandation en premier) : quelle scène exactement, quel texte, quel format d'images, quel fond, combien d'éléments, quelle durée. Une question coûte quelques secondes, un rendu raté coûte des dizaines de minutes. Si une contrainte rend la demande impossible telle quelle (pas assez d'images au bon format…), le dire avec des chiffres et proposer des options.
- Ne jamais valider à la place de l'utilisateur : montrer, contrôler, puis le laisser trancher.
- Signaler tout changement fait sans demande, et proposer de revenir en arrière.
- Après chaque série de retours : consigner chaque retour traité dans `review/review.json` (`resolved` + `resolution`), refaire le manifeste, donner l'heure de fin estimée du rendu.

## Storyboard obligatoire (à remplir avant de coder)
```
BPM: 128 · mesures: 8 · fps: 60 · format: 1920×1080
Motif: <l'objet récurrent, couleur signal>
| Mesure | Fond | Ce qui se passe, temps par temps (1-2-3-4) | Sortie → raccord vers la mesure suivante |
```
Chaque ligne doit nommer : l'événement sur le temps 1, les accents sur 2-3-4, et la transition motivée (iris, explosion, raccord, traversée, sortie de champ).

## Les règles qui font la différence
| Règle | Concrètement |
|---|---|
| Tempo d'abord | 1 scène = 1 mesure ; coupes sur le temps 1, accents sur les temps. Aucune durée « au hasard » (0,8 s, 1,9 s…) : tout s'exprime en `b` (temps). |
| Coupes franches en aplats | Le fond change à chaque scène (5 couleurs **de fond** max ; une couleur d'accent ou de chrome en plus, c'est OK) ; alterner sombre / clair ; pas de fondu entre scènes. |
| Motif récurrent | Un élément présent dans au moins 3 scènes, résolu dans le plan final (point → ponctuation du logo). |
| Transitions motivées | Les ~0,4 dernier temps de chaque scène fabriquent l'entrée de la suivante. |
| Flou de mouvement réel | `motionBlur` du moteur (sous-frames). 12 à 16 pour les gros bords rapides. Jamais à travers une coupe (géré). Sur les carrousels et les cartes qui tournent, vérifier la référence : si elle reste nette, `motionBlur: 1` sur la scène. |
| Courbes | Entrée `outExpo`/`spring`, sortie `inExpo`, déplacement `inOutExpo`/`inOutCubic`. `linear` seulement pour du défilement continu. |
| Physique | Squash & stretch selon la vitesse (`blob`), dépassement par ressort, rotation qui se résorbe. |
| Cascade | `stagger` sur lettres, points, rangées ; ordre spatial (centre → bord, gauche → droite). |
| Couche process | HUD (mesure, temps, frame, timecode) + outil de design (cadre, poignées, valeurs live). |
| Finition | Grain animé + léger vignettage sur tout. Plan final épuré, HUD réduit aux coins. |
| Pose finale | Tout est arrivé et immobile au moins 1 temps avant la dernière image (rien ne s'écrit encore). |
| Densité | Alterner scène chargée (1 règle × 1000 éléments) et scène épurée (1 forme). |

## Contrôle qualité avant de livrer
1. **Avant tout rendu long** : images fixes des moments clés de chaque scène modifiée (`--frames … --stills`), puis une planche de 6 à 9 vignettes, et **au moins un recadrage en pleine résolution** sur l'élément retouché. Les défauts fins (liseré, bord crénelé, base de carte visible) ne se voient pas sur une vignette.
2. **Après le rendu** : planche des coupes (image avant / après chaque changement de scène) **et** des jonctions entre morceaux (dernière image d'un morceau / première du suivant), forme d'onde stéréo (`showwavespic=split_channels=1`), nombre d'images et durée (`ffprobe -count_frames`).
3. **Fluidité mesurée** (avant de livrer un aperçu ou un final) : différence d'une image à la suivante sur toute la vidéo, `ffmpeg -i out.mp4 -vf "scale=270:-1,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG" -f null - 2>&1 | grep YAVG`. Hors des coupes voulues, aucun saut isolé : un pic qui dépasse nettement ses voisins = un mouvement trop rapide ou un élément qui saute ; le ralentir ou augmenter le flou de la scène. Relever aussi l'écart voix / image : les mots affichés doivent tomber sur les temps Scribe.
4. **Mesurer au lieu de regarder** quand l'utilisateur parle d'alignement (« incliné », « déborde », « pas centré », « écarts inégaux ») : lire les pixels d'une image du MP4 (`ffmpeg -vf crop=1:N:x:y -f rawvideo -pix_fmt rgb24 -`) sur plusieurs colonnes et comparer les bords. Si la géométrie est juste, la cause est un effet visuel (bande de reflet, bascule, perspective) : le retirer.
5. **Son** : relire la marge affichée par `mix-voix.mjs` (lit 4 à 6 LU sous la voix) ; forme d'onde de la voix et du lit l'une sous l'autre (`renders/…/stems/voix.wav`, `lit.wav`) : le lit ne dépasse jamais la voix.
6. Vérifier la liste de défauts ci-dessous sur chaque élément composé (cartes, dossiers, piles d'images).

### Défauts classiques des cartes et images
- **Image coupée par un masque** : un `clip` rectangulaire sur des cartes tournées coupe leurs coins en biseau. Placer les cartes pour qu'elles restent dans la forme, plutôt que de les rogner.
- **Bords crénelés quand une carte tourne** : prédécouper chaque carte (coins arrondis, image recadrée) dans un canvas hors écran à ×2, entouré d'une **marge transparente de 2–3 px**, puis dessiner ce canvas tourné. Le lissage bilinéaire adoucit alors les bords.
- **Liserés parasites** : un contour clair tracé autour d'une image non découpée laisse fuir le fond. Pas de contour, ou le même pour toutes les cartes, intégré au canvas prédécoupé.
- **Fonds blancs d'images** (détourages, logos sur blanc) : ils se lisent comme des languettes blanches. Les écarter d'une pile ou d'un éventail.
- **Proportions disparates** dans un groupe : quand la référence montre des cartes uniformes, recadrer toutes les images au même format.
- **Base de carte visible** au-dessus d'un panneau avant : calculer la position des cartes à partir du bord réel du panneau (après toute animation), avec une marge qui couvre le dépassement des ressorts (`outBack`, `spring`).
- **Rebond qui touche un texte** : remplacer le ressort par `outExpo` quand il y a peu de place.
- **Panneaux d'un même objet désalignés** : n'appliquer rotation et échelle qu'à l'objet entier, jamais à une seule de ses parties.
- **Groupe déséquilibré** : centres sur la même ligne, écarts égaux entre éléments, groupe centré dans le cadre. Calculer les positions finales à partir des largeurs réelles, pas à l'œil.
- **Élément qui flotte** (oscillation `sin(lt)` sur une carte posée) : à éviter par défaut, beaucoup de clients le lisent comme amateur.

## Kit d'animations (`Kit.*`, `scripts/kit.js`)
Avant d'écrire une animation de texte, un carrousel ou un objet animé, regarder s'il existe déjà dans le kit. Chaque animation y est mesurée sur une vraie référence :
- textes : atterrissage « Give », mot par mot, deux lignes, rôle dans un cadre surligné, texte géant avec panoramiques ;
- cartes prédécoupées aux bords lisses ;
- carrousel à 3 cartes, carrousel en perspective, anneau, dossier qui s'ouvre ;
- `insertBars`, pour insérer ou allonger des mesures sans casser la musique.

Catalogue et usage dans `references/kit.md`, démonstration dans `templates/kit-demo.html`. Une nouvelle animation tirée d'une référence et validée par l'utilisateur rejoint le kit, en version générique : couleurs et polices en options.

## API du moteur (`Motion.*`)
`run(opts)` · `range(t,a,b)` · `ease.{outExpo,inExpo,inOutExpo,outBack,inOutBack,outCubic,inOutQuart,outQuint,inOutQuint,…}` (long ralenti des deux côtés et coup rapide au milieu = `inOutExpo`) · `spring(elapsed, freq, damping)` · `stagger(t,a,b,i,n,dur)` · `blob(ctx,x,y,r,vx,vy,color,k,square)` (`square=true` = étirement aligné sur les axes, pour les motifs pixel) · `velocity(fn,t)` · `text(ctx,str,x,y,{font,color,align,tracking,stroke})` · `textOnArc` · `mixColor` · `hash` (bruit déterministe).
Captures : `browser`, `frameBox`, `lerpCam`, `cursor`, `clickRing`, `cover`, `avatar`, `roundRect` (voir plus haut).
Options de `run` : `w,h,fps,bpm,bars,title,monoFont,fonts[],images{},music,sfx[[sec,nom,vol]],grain,vignette,motionBlur,shutter,showHud,scenes[]`. Une scène prend `{bar, bars, bg, hudInk, hud:'corners', motionBlur, sfx, draw}`, plus `id`, `label`, `note` pour le manifeste de relecture.

## Erreurs fréquentes
- **`Math.random()` dans `draw`** : les images ne sont plus reproductibles et le grain scintille différemment au rendu. Utiliser `hash(i)`.
- **État mutable entre frames** (positions qu'on incrémente) : casse le scrub et le rendu. Tout doit se calculer depuis `t`.
- **`-x ** 2`** est une erreur de syntaxe en JS : écrire `-(x ** 2)`.
- **Marches visibles** sur un iris ou un volet : augmenter le `motionBlur` de la scène.
- **Texte tapé qui se dédouble** : un texte centré qui s'écrit lettre à lettre se décale à chaque frame, et le flou moyenne ces positions. Ancrer le texte tapé au bord gauche de la chaîne complète.
- **Clignotement gris** : un curseur ou un flash qui change d'état pendant l'obturateur ressort à moitié. Placer les fronts de clignotement sur des multiples exacts de frame (`Math.floor(frame/…)`), ou dessiner l'élément hors flou.
- **Carré qui tourne selon sa vitesse** : sur une diagonale, ça se lit comme un « × ». Utiliser `blob(..., square=true)`.
- **Compteur à rouleaux (odomètre)** : découper chaque colonne au plus près de la hauteur des capitales (environ 0,75 em), sinon les chiffres voisins dépassent en haut et en bas.
- **Arrêter un rendu** : tuer aussi le navigateur headless (`chrome-headless-shell`) et le `node render.mjs` orphelins, sinon ils continuent d'occuper la machine. `render-chunks.mjs` le fait tout seul sur Ctrl+C. Ne jamais modifier la pièce pendant le rendu d'un morceau qui contient la scène touchée : il a déjà chargé l'ancienne version.
- **Windows** : Git Bash convertit les arguments qui commencent par `/` (ex. `/dashboard`) ; passer par PowerShell ou `MSYS_NO_PATHCONV=1`. PowerShell 5.1 retire les guillemets internes des arguments natifs : écrire le JSON dans un fichier, ou passer par Git Bash.
- **Le rendu dit « page never became ready »** : l'erreur JS est affichée juste au-dessus (`pageerror:`).
- **Typo trop petite** : un mot-titre occupe 50 à 70 % de la largeur (≈ 200 px+ en 1080p).
- **Tout bouge tout le temps** : garder des temps de pose ; c'est le contraste pose / mouvement qui rend le claquement satisfaisant.
- **Vertical 9:16 / 4:5** : changer `w/h` (le ratio du canvas et le HUD suivent) ; tout le placement doit partir de `CX/CY`/`W/H`, pas de coordonnées en dur ; réduire les tailles de typo d'environ 40 %.
