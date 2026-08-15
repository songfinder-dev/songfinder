![Un fichier se résolvant en forme d'onde puis en bandes de fréquences](https://raw.githubusercontent.com/songfinder-dev/songfinder/main/assets/hero.png)

<div align="center">

# Song Finder

**Identifiez n'importe quel morceau depuis un lien ou un fichier audio, puis lisez son BPM, sa tonalité et son code Camelot — depuis votre terminal ou votre code.**

[![npm](https://img.shields.io/npm/v/songfinder?style=flat-square&color=0E1218&label=npm)](https://www.npmjs.com/package/songfinder)
[![downloads](https://img.shields.io/npm/dm/songfinder?style=flat-square&color=0E1218)](https://www.npmjs.com/package/songfinder)
[![License](https://img.shields.io/badge/license-MIT-0E1218?style=flat-square)](../LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A5%2020-0E1218?style=flat-square)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-0E1218?style=flat-square)](../js/tsconfig.json)
[![Dependencies](https://img.shields.io/badge/dépendances-0-00C470?style=flat-square)](../js/package.json)
[![API key](https://img.shields.io/badge/API%20key-non%20requise-00C470?style=flat-square)](https://songfinder.dev)
[![Website](https://img.shields.io/badge/songfinder.dev-2155FF?style=flat-square)](https://songfinder.dev)

[English](../README.md) · [简体中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Deutsch](./README.de.md) · **Français**

</div>

---

Clients officiels de [Song Finder](https://songfinder.dev), un **moteur de recherche de chansons** en ligne et gratuit qui identifie la musique à partir d'un fichier, d'un enregistrement micro ou d'un lien. Pas de clé API. Pas de compte. Pas de grille tarifaire.

---

## Démarrage rapide

```bash
npx songfinder identify "https://www.youtube.com/watch?v=..."
npx songfinder analyze "strobe deadmau5"
```

```
I Remember (Strobelight Edit) — deadmau5
Strobelite Seduction (2013)
ISRC:           USUS10800096

Tempo:          128 BPM
Key:            B Minor (Camelot 10A, Open Key 3m)
Mixes with:     10B, 9A, 11A
Energy:         59%
Danceability:   66%
Valence:        49%
Loudness:       -7.2 dB
```

*(Sortie réelle, pas une maquette)*

---

## Installation

```bash
npm install -g songfinder      # CLI dans votre PATH
npm install songfinder         # comme bibliothèque
```

Node.js 20 ou plus récent. **Zéro dépendance à l'exécution.**

---

## Ligne de commande

```
songfinder identify <url|file> [--start <seconds>]
songfinder search   <query>
songfinder analyze  <query|ISRC>
songfinder similar  <query|ISRC> [--limit <n>] [--harmonic]
```

Toute commande qui désigne un morceau accepte aussi bien un ISRC qu'une phrase de recherche — vous n'avez jamais à chercher un code à la main d'abord. Ajoutez `--json` à n'importe quelle commande pour obtenir la réponse brute de l'API au lieu du texte formaté.

```bash
# quel est le morceau de cette vidéo
songfinder identify "https://www.tiktok.com/@user/video/123..."

# qu'est-ce que ce fichier sur le disque
songfinder identify ~/Music/unknown.mp3

# échantillonner à 90 secondes, quand le début est silencieux ou une intro
songfinder identify "https://youtu.be/..." --start 90

# cinq titres qui s'enchaînent harmoniquement
songfinder similar "strobe deadmau5" --harmonic --limit 5
```

---

## Bibliothèque

```ts
import { SongFinder, tempoDisagrees } from 'songfinder';

const sf = new SongFinder();

const [track] = await sf.search('blinding lights weeknd');
const detail = await sf.detail(track.isrc);

console.log(detail.features?.tempo);           // 171.005
console.log(detail.features?.key?.camelot);    // "3B"
console.log(detail.features?.key?.compatible); // ["3A", "2B", "4B"]

if (tempoDisagrees(detail)) {
  // un second fournisseur l'a lu en demi- ou double-temps — voir plus bas
}
```

| Méthode | Renvoie |
|---|---|
| `search(query)` | Jusqu'à 10 candidats du catalogue avec leur ISRC |
| `detail(isrc)` | Tempo, tonalité, code Camelot, énergie/dansabilité/valence, genre |
| `similar(isrc, { limit, harmonic })` | Morceaux voisins, chacun avec son propre tempo et sa tonalité |
| `identifyUrl(url, startSeconds?)` | Reconnaissance depuis une page ou une URL média |
| `identifyFile(bytes, name, mime)` | Reconnaissance depuis un tampon audio (10 Mo max) |
| `resolveIsrc(title, artist)` | Relie la sortie de la reconnaissance aux méthodes d'analyse |

Tout est entièrement typé. `SongFinderError` transporte le statut HTTP lorsqu'il y en avait un.

---

## Deux choses bien faites ici

**Demi-temps et double-temps.** `detail()` renvoie la mesure d'un second fournisseur dans `tempoCrossCheck`. Lorsque les deux diffèrent de plus de 3 BPM, l'une a compté le groove à demi-vitesse — une paire 87/174 est le même morceau. `tempoDisagrees(detail)` vous le signale et la CLI affiche un avertissement. Ne rapporter que le chiffre principal, c'est précisément la façon dont ces données trompent le plus souvent.

**La reconnaissance ne renvoie pas d'ISRC.** Or chaque endpoint d'analyse est indexé par ISRC : la chaîne s'arrêterait juste après la partie intéressante. `resolveIsrc()` comble ce trou avec une recherche catalogue et ne lève jamais d'exception — un échec de résolution ne doit pas couler une reconnaissance réussie.

---

## Remarques

**La reconnaissance est limitée par IP** car elle consomme un quota payant réel. Les endpoints d'analyse autorisent environ un appel toutes les une à cinq secondes selon leur diffusion en amont. Un 429 signifie que vous êtes allé trop vite, pas que le morceau manque.

**L'artiste crédité n'est pas toujours l'artiste d'origine.** Les morceaux massivement réuploadés correspondent à des entrées de labels blancs : une chanson célèbre peut donc revenir créditée à un label inconnu. Le titre reste correct — recherchez-le pour trouver la sortie originale.

**L'audio que vous faites identifier est téléversé** vers `songfinder.dev` et n'est pas conservé. Les appels d'analyse n'envoient qu'une requête textuelle ou un ISRC, jamais d'audio.

**La couverture est inégale sur la longue traîne.** Beaucoup de morceaux ont un tempo mais pas de tonalité, voire aucune analyse. Les champs manquants reviennent à `null` plutôt que d'être inventés.

---

## Également disponible

| | |
|---|---|
| **[songfinder-mcp](https://github.com/songfinder-dev/songfinder-mcp)** | Serveur MCP — les mêmes capacités dans Claude, Cursor, Windsurf ou Zed |
| **[songfinder-skills](https://github.com/songfinder-dev/songfinder-skills)** | Agent Skills Claude Code, sans rien installer d'autre que curl |
| **[songfinder.dev](https://songfinder.dev)** | L'application web : identification par fichier, micro ou lien, plus détection BPM/tonalité, roue Camelot, découpe audio et davantage |

---

## Développement

```bash
cd js
pnpm install
pnpm build
node dist/cli.js analyze "strobe deadmau5"
```

## Licence

MIT
