# AImotion pour Claude · Version gratuite

Les grandes lignes pour faire ta première vidéo motion design avec Claude. Tu décris la vidéo en français, Claude l'écrit en code, la rend en MP4, et tu la corriges dans Clap. Tu n'as pas besoin de savoir coder.

> Claude est une marque d'Anthropic. AImotion est un produit indépendant, sans lien avec Anthropic.

---

## Ce que contient la version gratuite

- **Le skill motion design**, version de base : lancements de produits, démos, spots publicitaires.
- **Clap**, l'éditeur de relecture, version de base : tu commentes la vidéo à l'image près, Claude corrige.

---

## Ce qu'il te faut

| Élément | Détail |
| --- | --- |
| **Claude Desktop** | L'application Claude ([claude.ai/download](https://claude.ai/download)), avec un abonnement **Pro** au minimum. Max est conseillé. |
| **Node.js 22 ou plus** | Vérifie avec `node --version` dans un terminal. |
| **ffmpeg** | Vérifie avec `ffmpeg -version`. |
| **Le connecteur ElevenLabs** | Pour la voix off. Dans Claude Desktop : **Paramètres**, **Connecteurs**, **ElevenLabs**. |
| **Le connecteur Figma** | Facultatif, pour générer des images par IA. |

**Claude Desktop et Claude Code** : Claude Desktop est l'application installée sur ton ordinateur. Claude Code, c'est son onglet **Code** : c'est là qu'on travaille, parce qu'il peut lire et écrire des fichiers et lancer des commandes.

---

## Installer

Ouvre un terminal (PowerShell sous Windows, Terminal sous macOS) et tape :

```bash
npx aimotion-pro install --gratuit
```

La commande range le kit à deux endroits de ton dossier personnel :

| Partie | Dossier |
| --- | --- |
| Le skill | `~/.claude/skills/aimotion` (sous Windows : `C:\Users\<ton nom>\.claude\skills\aimotion`) |
| Clap | `~/.aimotion/clap` |

Ferme puis rouvre Claude Desktop. Dans l'onglet **Code**, choisis un dossier pour tes vidéos (par exemple `Documents\Videos`), puis tape `/aimotion`.

**Sans la commande**, depuis [github.com/lyrad9/aimotion](https://github.com/lyrad9/aimotion) : copie le dossier `skill` dans `~/.claude/skills/aimotion`, puis lance dans un terminal :

```bash
cd ~/.claude/skills/aimotion/scripts && npm i && npx playwright install chromium-headless-shell
cd <dossier clap> && npm ci && npm run build && npm link
```

---

## Ta première vidéo, étape par étape

Lance le skill en une phrase, par exemple :

```text
/aimotion Une promo de 45 secondes pour mon application
```

Claude suit toujours le même déroulé, et **te demande ton accord à chaque étape** :

1. **Cadrage.** Format (16:9, 9:16), durée, objectif, cible, appel à l'action, lieu de diffusion. Sa première proposition est toujours sa recommandation.
2. **Charte graphique.** Donne l'adresse du site et le logo. Claude relève les couleurs, les polices et des captures des vraies pages. Vérifie ce qu'il a trouvé.
3. **Références.** Range des vidéos qui t'inspirent dans un dossier `references/` de ton dossier de vidéos. Claude les mesure image par image pour reprendre leur rythme, sans les copier.
4. **Script.** La voix off mot pour mot, scène par scène. **Rien n'est généré tant que tu ne l'as pas validé.** Relis-le à voix haute.
5. **Images, voix, musique.** Les images (générées avec Figma ou cherchées en ligne), que tu valides. La voix off ElevenLabs, transcrite mot par mot pour caler l'animation. La musique, générée par ElevenLabs ou en code.
6. **Animation.** Claude écrit chaque scène en code et te montre des **images de contrôle**. Regarde-les bien : un défaut vu ici coûte quelques secondes, vu après le rendu une demi-heure.
7. **Aperçu, relecture, final.** Un aperçu à 30 images par seconde, que tu relis dans Clap, puis le rendu final à 60 images par seconde.

Le rendu se fait en morceaux qui reprennent là où ils s'arrêtent. Compte environ 2 heures pour une première vidéo sur un ordinateur modeste, et environ 25 minutes sur une machine puissante. Garde l'ordinateur allumé pendant le rendu.

---

## Relire dans Clap

Après le rendu, Claude ouvre Clap dans ton navigateur.

1. **Clique** sur l'élément qui ne va pas, à l'image exacte, et écris ta remarque. `Entrée` pour l'envoyer.
2. Quand tu as tout commenté, reviens dans Claude Code et dis : **« applique la review »**.
3. Claude corrige chaque scène visée et refait le rendu. Tu relis le tour suivant, jusqu'à ce que tout te convienne, puis tu **approuves** dans Clap.

---

## Bien parler à Claude

- Cite la **scène** et le **moment** : « Scène 4, à 0:19, le bouton arrive trop tard. »
- Sois concret : « Agrandis le titre de moitié » plutôt que « fais plus pro ».
- Ne valide jamais un script ou une image qui ne te plaît pas : chaque changement après coup coûte du temps et des crédits.

---

## Ce que le pack AImotion PRO ajoute

- **Le skill amélioré**, corrigé après chacune des vidéos réalisées avec.
- **Les sous-skills** : `faceless` (vidéos avec ton avatar illustré), `celebration` (motion flyers d'anniversaire et de mariage) et `declinaison` (ta vidéo recomposée en 9:16, 1:1 ou 4:5).
- **Clap complet** : commentaires sur une zone, flèches et crayon, coupes et export, silences, recadrage, comparaison de deux versions, dictée.
- **Le manuel complet**, en Markdown et en PDF illustré, de l'installation au MP4 final.

---

## Une question ?

- Email : [mbakopngako@gmail.com](mailto:mbakopngako@gmail.com)
- WhatsApp : [wa.me/33756991068](https://wa.me/33756991068)
