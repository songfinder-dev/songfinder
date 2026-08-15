#!/usr/bin/env node
/**
 * `songfinder` CLI — identify a track and read its tempo/key without leaving
 * the terminal.
 *
 * Argument parsing is hand-rolled on purpose: this package ships with zero
 * runtime dependencies, and pulling in an arg parser to read four flags would
 * trade that for nothing.
 */
import { readFile, stat } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';

import {
  SongFinder,
  SongFinderError,
  isValidIsrc,
  tempoDisagrees,
  type Features,
  type RecognizedTrack,
  type TrackDetail,
} from './client.js';

const VERSION = '0.1.0';

const AUDIO_MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.webm': 'audio/webm',
};

const USAGE = `songfinder ${VERSION} — identify songs, read tempo and key

Usage:
  songfinder identify <url|file> [--start <seconds>]
  songfinder search   <query>
  songfinder analyze  <query|ISRC>
  songfinder similar  <query|ISRC> [--limit <n>] [--harmonic]

Options:
  --start <seconds>   Sample a URL from this offset. Use when the first try misses.
  --limit <n>         How many similar tracks to return (default 12, max 30).
  --harmonic          Restrict to keys that mix cleanly on the Camelot wheel.
  --json              Print the raw API response instead of formatted text.
  -h, --help          Show this message.
  -v, --version       Show the version.

Examples:
  songfinder identify "https://www.youtube.com/watch?v=..."
  songfinder identify ~/Music/unknown.mp3
  songfinder analyze "strobe deadmau5"
  songfinder similar "strobe deadmau5" --harmonic --limit 5

Powered by https://songfinder.dev — no API key required.
`;

interface Flags {
  start?: number;
  limit?: number;
  harmonic: boolean;
  json: boolean;
}

function parseArgs(argv: string[]): { command?: string; input: string; flags: Flags } {
  const flags: Flags = { harmonic: false, json: false };
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    switch (arg) {
      case '--harmonic':
        flags.harmonic = true;
        break;
      case '--json':
        flags.json = true;
        break;
      case '--start':
      case '--limit': {
        const raw = argv[++i];
        const value = Number(raw);
        if (!Number.isFinite(value) || value < 0) {
          throw new SongFinderError(`${arg} needs a number, got "${raw ?? ''}".`);
        }
        if (arg === '--start') flags.start = Math.floor(value);
        else flags.limit = Math.floor(value);
        break;
      }
      default:
        if (arg.startsWith('-')) throw new SongFinderError(`Unknown option "${arg}".`);
        positional.push(arg);
    }
  }
  // Everything after the command joins back into one query, so an unquoted
  // `songfinder analyze strobe deadmau5` behaves the way people expect.
  return { command: positional[0], input: positional.slice(1).join(' '), flags };
}

const pct = (v: number | null | undefined) =>
  v === null || v === undefined ? null : `${Math.round(v * 100)}%`;

function featureLines(features: Features | null): string[] {
  if (!features) return ['No acoustic analysis is available for this recording.'];
  const out: string[] = [];
  if (features.tempo) out.push(`Tempo:          ${Math.round(features.tempo)} BPM`);
  if (features.key) {
    out.push(`Key:            ${features.key.name} (Camelot ${features.key.camelot}, Open Key ${features.key.openKey})`);
    if (features.key.compatible?.length) {
      out.push(`Mixes with:     ${features.key.compatible.join(', ')}`);
    }
  }
  const pairs: [string, string | null][] = [
    ['Energy', pct(features.energy)],
    ['Danceability', pct(features.danceability)],
    ['Valence', pct(features.valence)],
    ['Acousticness', pct(features.acousticness)],
  ];
  for (const [label, value] of pairs) {
    if (value) out.push(`${`${label}:`.padEnd(16)}${value}`);
  }
  if (features.loudness) out.push(`Loudness:       ${features.loudness.toFixed(1)} dB`);
  return out;
}

function printDetail(detail: TrackDetail): void {
  const { track } = detail;
  console.log(`\n${track.title} — ${track.artist}`);
  if (track.album) console.log(`${track.album}${track.releaseYear ? ` (${track.releaseYear})` : ''}`);
  console.log(`ISRC:           ${track.isrc}\n`);
  console.log(featureLines(detail.features).join('\n'));

  if (tempoDisagrees(detail)) {
    console.log(
      `\n! A second source reads ${Math.round(detail.tempoCrossCheck!)} BPM.` +
        `\n  A gap this size means one reading is half- or double-time.`
    );
  }
  console.log(`\nFull breakdown: https://songfinder.dev/tools/song-bpm-key`);
}

function printRecognition(result: RecognizedTrack, isrc: string | null): void {
  if (!result.matched) {
    console.log('\nNo match.\n');
    console.log('Most likely one of:');
    console.log('  - the excerpt is instrumental, live, or a remix with no catalogue entry');
    console.log('  - the clip landed on an intro or a gap — retry with --start 60');
    console.log('  - the audio is buried under speech or crowd noise');
    return;
  }
  console.log(`\n${result.title} — ${result.artist}`);
  if (result.album) console.log(`Album:          ${result.album}`);
  if (result.releaseDate) console.log(`Released:       ${result.releaseDate}`);
  if (result.label) console.log(`Label:          ${result.label}`);
  if (result.score) console.log(`Confidence:     ${result.score}%`);
  if (isrc) console.log(`ISRC:           ${isrc}`);
  if (result.spotifyUrl) console.log(`Spotify:        ${result.spotifyUrl}`);
  if (result.appleMusicUrl) console.log(`Apple Music:    ${result.appleMusicUrl}`);
  if (isrc) console.log(`\nsongfinder analyze ${isrc}   # tempo, key, Camelot code`);
  console.log(`\nIdentified by Song Finder — https://songfinder.dev`);
}

/** Accept either an ISRC or a search phrase everywhere a track is named —
 * making the user run `search` first just to copy a code is pure friction. */
async function toIsrc(client: SongFinder, input: string): Promise<string> {
  if (isValidIsrc(input)) return input;
  const [first] = await client.search(input);
  if (!first) throw new SongFinderError(`Nothing found for "${input}".`);
  console.log(`Using: ${first.title} — ${first.artist} (${first.isrc})`);
  return first.isrc;
}

async function identify(client: SongFinder, input: string, flags: Flags) {
  const looksLikeUrl = /^https?:\/\//i.test(input);
  if (looksLikeUrl) {
    const result = await client.identifyUrl(input, flags.start);
    const isrc = result.matched ? await client.resolveIsrc(result.title, result.artist) : null;
    return { result, isrc };
  }

  const path = resolve(input);
  const ext = extname(path).toLowerCase();
  const mime = AUDIO_MIME[ext];
  if (!mime) {
    throw new SongFinderError(
      `Unsupported file type "${ext || '(none)'}". Supported: ${Object.keys(AUDIO_MIME).join(', ')}.`
    );
  }
  let size: number;
  try {
    size = (await stat(path)).size;
  } catch {
    throw new SongFinderError(`No readable file at ${path}.`);
  }
  if (size === 0) throw new SongFinderError(`${path} is empty.`);

  const bytes = await readFile(path);
  const result = await client.identifyFile(bytes, basename(path), mime);
  const isrc = result.matched ? await client.resolveIsrc(result.title, result.artist) : null;
  return { result, isrc };
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    console.log(USAGE);
    return 0;
  }
  if (argv.includes('-v') || argv.includes('--version')) {
    console.log(VERSION);
    return 0;
  }

  const { command, input, flags } = parseArgs(argv);
  const client = new SongFinder();

  if (!command) {
    console.error('No command given.\n');
    console.error(USAGE);
    return 1;
  }
  if (!input) {
    console.error(`"${command}" needs something to work on. See --help.`);
    return 1;
  }

  switch (command) {
    case 'identify': {
      const { result, isrc } = await identify(client, input, flags);
      if (flags.json) console.log(JSON.stringify({ ...result, isrc }, null, 2));
      else printRecognition(result, isrc);
      return result.matched ? 0 : 1;
    }
    case 'search': {
      const tracks = await client.search(input);
      if (flags.json) {
        console.log(JSON.stringify(tracks, null, 2));
      } else if (tracks.length === 0) {
        console.log(`Nothing found for "${input}".`);
      } else {
        for (const t of tracks) {
          const year = t.releaseYear ? ` (${t.releaseYear})` : '';
          console.log(`${t.isrc}  ${t.title} — ${t.artist}${year}`);
        }
      }
      return tracks.length > 0 ? 0 : 1;
    }
    case 'analyze': {
      const detail = await client.detail(await toIsrc(client, input));
      if (flags.json) console.log(JSON.stringify(detail, null, 2));
      else printDetail(detail);
      return 0;
    }
    case 'similar': {
      const result = await client.similar(await toIsrc(client, input), {
        limit: flags.limit,
        harmonic: flags.harmonic,
      });
      if (flags.json) {
        console.log(JSON.stringify(result, null, 2));
        return 0;
      }
      const seedKey = result.seed.features?.key;
      console.log(
        `\n${flags.harmonic ? 'Harmonically compatible with' : 'Similar to'} ` +
          `${result.seed.track.title} — ${result.seed.track.artist}` +
          (seedKey ? ` (${seedKey.name}, ${seedKey.camelot})` : '') +
          '\n'
      );
      if (result.tracks.length === 0) {
        console.log('No matches. Harmonic filtering narrows results sharply — try without --harmonic.');
        return 1;
      }
      for (const entry of result.tracks) {
        const f = entry.features;
        const meta = [
          f?.tempo ? `${Math.round(f.tempo)} BPM` : null,
          f?.key ? `${f.key.name} (${f.key.camelot})` : null,
        ].filter(Boolean).join(' · ');
        console.log(`${entry.track.isrc}  ${entry.track.title} — ${entry.track.artist}`);
        if (meta) console.log(`              ${meta}`);
      }
      return 0;
    }
    default:
      console.error(`Unknown command "${command}".\n`);
      console.error(USAGE);
      return 1;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    if (error instanceof SongFinderError) {
      console.error(`\n${error.message}`);
    } else {
      console.error(`\nUnexpected failure: ${error instanceof Error ? error.message : String(error)}`);
    }
    process.exit(1);
  });
