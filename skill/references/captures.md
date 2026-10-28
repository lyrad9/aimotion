# Captures automatiques de contenu réel

Quand la vidéo parle d'un site, d'une chaîne, d'un produit ou d'un profil, **capturer le vrai contenu soi-même**, sans demander de captures à l'utilisateur :
```
node ~/.claude/skills/aisance-motion-design/scripts/capture.mjs <url> <projet>/assets --name <clé> \
  --el avatar="<css>" --box header="<css>" --list thumb="<css>" --max 12 \
  --text subs="<css>" --texts title="<css>" --attrs href="<css>@href" --img logo="<css img>"
```
- Le script gère seul les bandeaux cookies (boutons « Tout accepter » en plusieurs langues et CMP courants). Il produit `assets/captures.js` (`window.CAPTURES[clé]`) : capture de page, recadrages d'éléments, listes, textes et **boîtes des éléments en pixels de capture**.
- Charger dans la pièce : `<script src="assets/captures.js">`, puis `images: { page: 'assets/' + CAPTURES.x.page, ... }` dans `Motion.run`. Les images arrivent décodées dans `env.img`.
- **Découvrir les sélecteurs d'abord.** Les sites changent leur DOM (YouTube a remplacé `ytd-thumbnail` par `yt-lockup-view-model`). Faire une capture de la page entière, puis une petite sonde Playwright qui liste les balises et classes d'un élément, et seulement ensuite les `--el` / `--list`.
- **Viser la haute définition.** Une capture d'élément est limitée à sa taille à l'écran (une miniature YouTube ≈ 700 px). Quand l'URL d'image porte sa taille, télécharger la version HD :
  - YouTube : miniature `https://i.ytimg.com/vi/<ID>/maxresdefault.jpg` (1280×720), ID tiré de `--attrs href=…@href` ; avatar : remplacer `=s160` par `=s800`.
  - Autres sites : `--img` prend le plus grand `srcset`.
- **Ne citer que des chiffres capturés** (abonnés, vues, dates) : jamais de chiffre inventé.
- Exploiter les captures (helpers du moteur) :
  - `browser(ctx, img, x, y, w, h, { url, cam })` : fenêtre de navigateur avec caméra. Il renvoie `toScreen()` pour épingler cadres et curseur sur un élément réel.
  - `frameBox(box, vw, vh, img.width, pad)` : caméra qui cadre un élément ; `lerpCam` pour un zoom fluide (interpolé en log).
  - `cursor` + `clickRing` : curseur qui clique.
  - `cover(ctx, img, x, y, w, h, { radius })` : image recadrée, utile pour un mur de miniatures.
  - `avatar(ctx, img, cx, cy, r, { ring })` : image en cercle.
- Exemple complet (promo de chaîne YouTube, 8 mesures) : `templates/promo-youtube.html`. Il charge `../scripts/engine.js` et lit `assets/` à côté de lui (copié dans un projet : ajuster le `src` du moteur).
- Applis locales (pas de page web) : `screencapture -l <windowid>` sous macOS, après avoir obtenu l'autorisation d'enregistrement d'écran.

## Visuels d'origine plutôt que recadrages
Une vignette découpée dans une capture est un recadrage de l'interface (format imposé, bandeau de titre, basse résolution). Pour montrer les visuels eux-mêmes (galerie, bibliothèque, historique), récupérer les fichiers d'origine :
`node ~/.claude/skills/aisance-motion-design/scripts/fetch-images.mjs <url> assets/insp --selector "section button.group img" --limit 8 --storage .session.json`
Derrière `/_next/image?url=…`, le script télécharge la source au format natif. Il écrit `images.json` (fichier, dimensions, texte alternatif). Écarter les images à fond blanc ou transparent quand elles vont dans une pile ou un éventail.

## Pièges rencontrés
- **`networkidle` n'arrive jamais** sur les sites temps réel (WebSocket, Convex, Firebase) : attendre `domcontentloaded`, puis un sélecteur précis.
- **Session qui expire** : avec des jetons de rafraîchissement qui tournent, chaque chargement invalide l'ancienne session. Réenregistrer `storageState` après chaque chargement et en cas de plantage (`capture.mjs`, `fetch-images.mjs` le font), sinon la capture suivante tombe sur la page de connexion.
- **Connexion** : Google refuse les navigateurs automatisés. Passer par le lien magique ouvert dans la fenêtre de `login.mjs`, qui surveille tous les onglets.
- **Réglages non mémorisés** : un choix fait dans l'interface (modèle, format) peut disparaître au rechargement. Le refaire dans la page juste avant la capture, et vérifier son libellé.
- **État de l'interface** : avant chaque capture, vérifier qu'aucun interrupteur n'est déjà actif, qu'aucune pièce jointe ne traîne, qu'aucun menu n'est resté ouvert. Si l'état final contient un élément qui doit apparaître à l'écran (vignette jointe…), capturer aussi l'état vide. Dans la pièce, recouvrir la zone avec les pixels de la capture vide jusqu'au bon moment (même géométrie, même échelle).
- **Données privées** : masquer seulement ce que l'utilisateur demande (e-mail, menu d'administration…). Ne pas flouter le reste sans qu'on le demande.
