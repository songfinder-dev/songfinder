![A file resolving into a waveform and then into frequency bands](https://raw.githubusercontent.com/songfinder-dev/songfinder/main/assets/hero.png)

<div align="center">

# Song Finder

**Identify any song from a link or an audio file, then read its BPM, musical key and Camelot code — from your terminal or your code.**

[![npm](https://img.shields.io/npm/v/songfinder?style=flat-square&color=0E1218&label=npm)](https://www.npmjs.com/package/songfinder)
[![downloads](https://img.shields.io/npm/dm/songfinder?style=flat-square&color=0E1218)](https://www.npmjs.com/package/songfinder)
[![License](https://img.shields.io/badge/license-MIT-0E1218?style=flat-square)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A5%2020-0E1218?style=flat-square)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-0E1218?style=flat-square)](./js/tsconfig.json)
[![Dependencies](https://img.shields.io/badge/dependencies-0-00C470?style=flat-square)](./js/package.json)
[![API key](https://img.shields.io/badge/API%20key-not%20required-00C470?style=flat-square)](https://songfinder.dev)
[![Website](https://img.shields.io/badge/songfinder.dev-2155FF?style=flat-square)](https://songfinder.dev)

**English** · [简体中文](./docs/README.zh-CN.md) · [日本語](./docs/README.ja.md) · [한국어](./docs/README.ko.md) · [Español](./docs/README.es.md) · [Deutsch](./docs/README.de.md) · [Français](./docs/README.fr.md)

</div>

---

Official clients for [Song Finder](https://songfinder.dev), a free online **song finder** that identifies music from a file, a microphone recording or a link. No API key. No account. No rate card.

---

## Quick start

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

*(Real output, not a mock-up.)*

---

## Install

```bash
npm install -g songfinder      # CLI on your PATH
npm install songfinder         # as a library
```

Node.js 20+. **Zero runtime dependencies.**

---

## CLI

```
songfinder identify <url|file> [--start <seconds>]
songfinder search   <query>
songfinder analyze  <query|ISRC>
songfinder similar  <query|ISRC> [--limit <n>] [--harmonic]
```

Every command that names a track accepts either an ISRC or a plain search phrase — you never have to look a code up by hand first. Add `--json` anywhere to get the raw API response instead of formatted text.

```bash
# what is playing in this video
songfinder identify "https://www.tiktok.com/@user/video/123..."

# what is this file on disk
songfinder identify ~/Music/unknown.mp3

# sample 90 seconds in, when the opening is silence or an intro
songfinder identify "https://youtu.be/..." --start 90

# five tracks that mix harmonically into this one
songfinder similar "strobe deadmau5" --harmonic --limit 5
```

---

## Library

```ts
import { SongFinder, tempoDisagrees } from 'songfinder';

const sf = new SongFinder();

const [track] = await sf.search('blinding lights weeknd');
const detail = await sf.detail(track.isrc);

console.log(detail.features?.tempo);        // 171.005
console.log(detail.features?.key?.camelot); // "3B"
console.log(detail.features?.key?.compatible); // ["3A", "2B", "4B"]

if (tempoDisagrees(detail)) {
  // a second provider read this at half or double time — see below
}
```

| Method | Returns |
|---|---|
| `search(query)` | Up to 10 catalogue candidates with ISRCs |
| `detail(isrc)` | Tempo, key, Camelot code, energy/danceability/valence, genre |
| `similar(isrc, { limit, harmonic })` | Neighbouring tracks, each with its own tempo and key |
| `identifyUrl(url, startSeconds?)` | Recognition from a page or media URL |
| `identifyFile(bytes, name, mime)` | Recognition from an audio buffer (max 10MB) |
| `resolveIsrc(title, artist)` | Bridges recognition output to the analysis methods |

Everything is fully typed. `SongFinderError` carries the HTTP status when there was one.

---

## Two things this gets right

**Half-time and double-time tempo.** `detail()` returns a second provider's reading in `tempoCrossCheck`. When the two disagree by more than 3 BPM, one of them counted the groove at half speed — an 87/174 pair is the same track. `tempoDisagrees(detail)` tells you; the CLI prints a warning. Reporting the primary figure alone is how tempo data most often misleads people.

**Recognition returns no ISRC.** Every analysis endpoint is keyed by ISRC, so the chain would dead-end right after the interesting part. `resolveIsrc()` closes that gap with one catalogue search, and never throws — a lookup failure must not sink a successful match.

---

## Notes

**Recognition is rate-limited per IP** because it spends paid third-party quota. The analysis endpoints allow roughly one call per 1–5 seconds depending on how far they fan out upstream. A 429 means you went too fast, not that the track is missing.

**The credited artist is not always the original artist.** Widely re-uploaded tracks match white-label catalogue entries, so a famous song can come back credited to a label nobody has heard of. The title is still right — search that title to find the original release.

**Audio you identify is uploaded** to `songfinder.dev` and is not retained. Analysis calls send only a text query or an ISRC — no audio.

**Coverage is uneven for long-tail releases.** Many have a tempo but no key, or no analysis at all. Missing fields come back `null` rather than being invented.

---

## Also available

| | |
|---|---|
| **[songfinder-mcp](https://github.com/songfinder-dev/songfinder-mcp)** | MCP server — the same capabilities inside Claude, Cursor, Windsurf or Zed |
| **[songfinder-skills](https://github.com/songfinder-dev/songfinder-skills)** | Claude Code Agent Skills, no install beyond `curl` |
| **[Song Finder — free online song finder](https://songfinder.dev)** | The web app: identify by file, microphone or link, plus BPM/key detection, a Camelot wheel, stem separation, audio trimming and more |
| **[Song finder browser extensions](https://songfinder.dev)** | Chrome, Edge, Firefox and a userscript |

---

## Repository layout

```
js/       npm package "songfinder" — client + CLI
assets/   README artwork
```

## Development

```bash
cd js
pnpm install
pnpm build
node dist/cli.js analyze "strobe deadmau5"
```

## License

MIT
