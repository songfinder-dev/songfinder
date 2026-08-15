![Eine Datei, die sich in eine Wellenform und dann in Frequenzbänder auflöst](https://raw.githubusercontent.com/songfinder-dev/songfinder/main/assets/hero.png)

<div align="center">

# Song Finder

**Jeden Song aus einem Link oder einer Audiodatei erkennen und anschließend BPM, Tonart und Camelot-Code auslesen — im Terminal oder im eigenen Code.**

[![npm](https://img.shields.io/npm/v/songfinder?style=flat-square&color=0E1218&label=npm)](https://www.npmjs.com/package/songfinder)
[![downloads](https://img.shields.io/npm/dm/songfinder?style=flat-square&color=0E1218)](https://www.npmjs.com/package/songfinder)
[![License](https://img.shields.io/badge/license-MIT-0E1218?style=flat-square)](../LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A5%2020-0E1218?style=flat-square)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-0E1218?style=flat-square)](../js/tsconfig.json)
[![Dependencies](https://img.shields.io/badge/Abhängigkeiten-0-00C470?style=flat-square)](../js/package.json)
[![API key](https://img.shields.io/badge/API%20key-nicht%20nötig-00C470?style=flat-square)](https://songfinder.dev)
[![Website](https://img.shields.io/badge/songfinder.dev-2155FF?style=flat-square)](https://songfinder.dev)

[English](../README.md) · [简体中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · **Deutsch** · [Français](./README.fr.md)

</div>

---

Offizielle Clients für [Song Finder](https://songfinder.dev), eine kostenlose Online-**Musikerkennung**, die Songs aus einer Datei, einer Mikrofonaufnahme oder einem Link bestimmt. Kein API-Key. Kein Konto. Keine Preisliste.

---

## Schnellstart

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

*(Echte Ausgabe, keine Attrappe)*

---

## Installation

```bash
npm install -g songfinder      # CLI im PATH
npm install songfinder         # als Bibliothek
```

Node.js 20 oder neuer. **Null Laufzeitabhängigkeiten.**

---

## Kommandozeile

```
songfinder identify <url|file> [--start <seconds>]
songfinder search   <query>
songfinder analyze  <query|ISRC>
songfinder similar  <query|ISRC> [--limit <n>] [--harmonic]
```

Jeder Befehl, der einen Track benennt, akzeptiert sowohl einen ISRC als auch eine Suchphrase — du musst nie erst von Hand einen Code nachschlagen. Mit `--json` liefert jeder Befehl die rohe API-Antwort statt formatierten Text.

```bash
# was läuft in diesem Video
songfinder identify "https://www.tiktok.com/@user/video/123..."

# was ist diese Datei auf der Platte
songfinder identify ~/Music/unknown.mp3

# ab Sekunde 90 abtasten, wenn der Anfang Stille oder Intro ist
songfinder identify "https://youtu.be/..." --start 90

# fünf harmonisch passende Tracks
songfinder similar "strobe deadmau5" --harmonic --limit 5
```

---

## Bibliothek

```ts
import { SongFinder, tempoDisagrees } from 'songfinder';

const sf = new SongFinder();

const [track] = await sf.search('blinding lights weeknd');
const detail = await sf.detail(track.isrc);

console.log(detail.features?.tempo);           // 171.005
console.log(detail.features?.key?.camelot);    // "3B"
console.log(detail.features?.key?.compatible); // ["3A", "2B", "4B"]

if (tempoDisagrees(detail)) {
  // ein zweiter Anbieter las das in halbem oder doppeltem Tempo — siehe unten
}
```

| Methode | Liefert |
|---|---|
| `search(query)` | Bis zu 10 Katalogtreffer mit ISRC |
| `detail(isrc)` | Tempo, Tonart, Camelot-Code, Energie/Tanzbarkeit/Valenz, Genre |
| `similar(isrc, { limit, harmonic })` | Benachbarte Tracks, jeder mit eigenem Tempo und eigener Tonart |
| `identifyUrl(url, startSeconds?)` | Erkennung aus einer Seiten- oder Medien-URL |
| `identifyFile(bytes, name, mime)` | Erkennung aus einem Audio-Puffer (max. 10 MB) |
| `resolveIsrc(title, artist)` | Verbindet die Erkennungsausgabe mit den Analysemethoden |

Alles ist vollständig typisiert. `SongFinderError` führt den HTTP-Status mit, sofern es einen gab.

---

## Zwei Dinge, die hier stimmen

**Halbes und doppeltes Tempo.** `detail()` liefert die Messung eines zweiten Anbieters in `tempoCrossCheck`. Weichen beide um mehr als 3 BPM ab, hat eine den Groove in halber Geschwindigkeit gezählt — ein 87/174-Paar ist derselbe Track. `tempoDisagrees(detail)` sagt es dir, die CLI gibt eine Warnung aus. Nur den Primärwert zu melden ist die häufigste Art, wie diese Daten in die Irre führen.

**Die Erkennung liefert keinen ISRC.** Da aber jeder Analyse-Endpunkt über ISRC adressiert wird, endet die Kette genau nach dem interessanten Teil. `resolveIsrc()` schließt diese Lücke mit einer Katalogsuche und wirft nie — ein fehlgeschlagenes Nachschlagen darf eine erfolgreiche Erkennung nicht versenken.

---

## Hinweise

**Die Erkennung ist pro IP begrenzt,** weil sie echtes bezahltes Kontingent verbraucht. Die Analyse-Endpunkte erlauben je nach Fan-out nach oben etwa einen Aufruf alle ein bis fünf Sekunden. Ein 429 heißt, du warst zu schnell — nicht, dass der Track fehlt.

**Der genannte Interpret ist nicht immer der ursprüngliche.** Vielfach hochgeladene Tracks treffen White-Label-Einträge, sodass ein bekannter Song einem unbekannten Label zugeschrieben wird. Der Titel stimmt weiterhin — eine Suche nach diesem Titel fördert die Originalveröffentlichung zutage.

**Audio, das du erkennen lässt, wird hochgeladen** — an `songfinder.dev`, und nicht gespeichert. Analyseaufrufe senden nur eine Textabfrage oder einen ISRC, niemals Audio.

**Die Abdeckung im Long Tail ist ungleichmäßig.** Viele Tracks haben ein Tempo, aber keine Tonart, oder gar keine Analyse. Fehlende Felder kommen als `null` zurück, statt erfunden zu werden.

---

## Ebenfalls verfügbar

| | |
|---|---|
| **[songfinder-mcp](https://github.com/songfinder-dev/songfinder-mcp)** | MCP-Server — dieselben Fähigkeiten in Claude, Cursor, Windsurf oder Zed |
| **[songfinder-skills](https://github.com/songfinder-dev/songfinder-skills)** | Claude-Code-Agent-Skills, ohne mehr als curl zu installieren |
| **[songfinder.dev](https://songfinder.dev)** | Die Web-App: Erkennung per Datei, Mikrofon oder Link, dazu BPM-/Tonart-Erkennung, Camelot-Rad, Audio-Trimmer und mehr |

---

## Entwicklung

```bash
cd js
pnpm install
pnpm build
node dist/cli.js analyze "strobe deadmau5"
```

## Lizenz

MIT
