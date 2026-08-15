# songfinderdev

**Identify any song from a link or an audio file, then read its BPM, musical key and Camelot code — from your terminal or your Python code.**

[![PyPI](https://img.shields.io/pypi/v/songfinderdev?style=flat-square&color=0E1218)](https://pypi.org/project/songfinderdev/)
[![Python](https://img.shields.io/pypi/pyversions/songfinderdev?style=flat-square&color=0E1218)](https://pypi.org/project/songfinderdev/)
[![License](https://img.shields.io/badge/license-MIT-0E1218?style=flat-square)](https://github.com/songfinder-dev/songfinder/blob/main/LICENSE)
[![Dependencies](https://img.shields.io/badge/dependencies-0-00C470?style=flat-square)](https://github.com/songfinder-dev/songfinder)
[![API key](https://img.shields.io/badge/API%20key-not%20required-00C470?style=flat-square)](https://songfinder.dev)

The official Python client for [Song Finder](https://songfinder.dev), a free online **song finder** that identifies music from a file, a microphone recording or a link. No API key. No account. No rate card.

**Standard library only** — no `requests`, no transitive dependencies, nothing to audit.

---

## Install

```bash
pip install songfinderdev
```

Python 3.9+.

> **Why not `songfinder`?** An unrelated project already owns that name on
> PyPI, and its wheel's top-level directory is `songfinder` too — sharing
> either name would have the two installs silently overwrite each other.
> `songfinder-cli` is not an option either: PyPI's similarity check strips
> common suffixes like `cli`, `api` and `sdk` before comparing, so every such
> variant collides as well. Hence `songfinderdev`, matching the domain.

The command installs as both `songfinder` and `songfinderdev`, so it still works if something else on your `PATH` already claims the shorter name.

---

## Command line

```bash
songfinder identify "https://www.youtube.com/watch?v=..."
songfinder analyze "strobe deadmau5"
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
```

*(Real output, not a mock-up.)*

```
songfinder identify <url|file> [--start SECONDS]
songfinder search   <query>
songfinder analyze  <query|ISRC>
songfinder similar  <query|ISRC> [--limit N] [--harmonic]
```

Every command that names a track accepts a search phrase as readily as an ISRC — you never have to look a code up by hand first. Add `--json` to any command for the raw API response.

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

```python
from songfinderdev import SongFinder, tempo_disagrees

sf = SongFinder()

track = sf.search("blinding lights weeknd")[0]
detail = sf.detail(track["isrc"])

print(detail["features"]["tempo"])              # 171.005
print(detail["features"]["key"]["camelot"])     # '3B'
print(detail["features"]["key"]["compatible"])  # ['3A', '2B', '4B']

if tempo_disagrees(detail):
    # a second provider read this at half or double time — see below
    ...
```

| Method | Returns |
|---|---|
| `search(query)` | Up to 10 catalogue candidates with ISRCs |
| `detail(isrc)` | Tempo, key, Camelot code, energy/danceability/valence, genre |
| `similar(isrc, limit=…, harmonic=…)` | Neighbouring tracks, each with its own tempo and key |
| `identify_url(url, start_seconds=None)` | Recognition from a page or media URL |
| `identify_file(path)` | Recognition from a local audio file (max 10MB) |
| `resolve_isrc(title, artist)` | Bridges recognition output to the analysis methods |

Failures raise `SongFinderError`, which carries the HTTP status when there was one.

---

## Two things this gets right

**Half-time and double-time tempo.** `detail()` returns a second provider's reading in `tempoCrossCheck`. When the two disagree by more than 3 BPM, one of them counted the groove at half speed — an 87/174 pair is the same track. `tempo_disagrees(detail)` tells you; the CLI prints a warning. Reporting the primary figure alone is how this data most often misleads people.

**Recognition returns no ISRC.** Every analysis method is keyed by ISRC, so the chain would dead-end right after the interesting part. `resolve_isrc()` closes that gap with one catalogue search, and never raises — a lookup failure must not sink a successful match.

---

## Notes

**Recognition is rate-limited per IP** because it spends paid third-party quota. The analysis endpoints allow roughly one call per 1–5 seconds depending on how far they fan out upstream. A 429 means you went too fast, not that the track is missing.

**The credited artist is not always the original artist.** Widely re-uploaded tracks match white-label catalogue entries, so a famous song can come back credited to a label nobody has heard of. The title is still right — search that title to find the original release.

**Audio you identify is uploaded** to `songfinder.dev` and is not retained. Analysis calls send only a text query or an ISRC — no audio.

**Coverage is uneven for long-tail releases.** Many have a tempo but no key, or no analysis at all. Missing fields come back `None` rather than being invented.

---

## Also available

- **[songfinder](https://www.npmjs.com/package/songfinder)** — the same client and CLI for Node.js
- **[songfinder-mcp](https://www.npmjs.com/package/songfinder-mcp)** — MCP server for Claude, Cursor, Windsurf and Zed
- **[songfinder-skills](https://github.com/songfinder-dev/songfinder-skills)** — Agent Skills, installable with `npx skills add`
- **[songfinder.dev](https://songfinder.dev)** — the web app, plus [BPM & key detection](https://songfinder.dev/tools/song-bpm-key), a [similar-songs finder](https://songfinder.dev/tools/similar-songs) and more

## License

MIT
