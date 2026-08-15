/**
 * Song Finder API client — zero runtime dependencies.
 *
 * Every endpoint answers with the envelope `{ code, message, data }`, and a
 * non-zero `code` means failure **regardless of the HTTP status**. Unwrapping
 * that in one place is the whole reason this file exists.
 */

export const DEFAULT_BASE_URL = 'https://songfinder.dev';

/**
 * Recognition refuses anonymous callers because it spends paid third-party
 * quota. Clients with no browser context to run a Turnstile challenge in
 * identify themselves with this header instead.
 *
 * **Cross-repo contract.** The other half is `isPrivilegedClient` in
 * `music-finder`'s `src/routes/api/music/recognize.ts`. Change the literal on
 * one side only and every recognition call here starts returning 403.
 */
const CLIENT_HEADER = 'X-SongFinder-Client';
const CLIENT_VALUE = 'cli';

/** Matches the server-side cap. Checked locally so an oversized file fails
 * immediately instead of after a pointless upload. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export class SongFinderError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'SongFinderError';
  }
}

export interface Track {
  isrc: string;
  title: string;
  artist: string;
  album: string | null;
  artworkUrl: string | null;
  previewUrl: string | null;
  durationMs: number | null;
  releaseYear: number | null;
  rank: number | null;
  source: string;
}

export interface MusicalKey {
  pitchClass: number;
  mode: number;
  /** e.g. `B Minor` */
  name: string;
  /** Camelot wheel position, e.g. `10A`. */
  camelot: string;
  openKey: string;
  /** Camelot codes that mix harmonically with `camelot`. */
  compatible: string[];
}

export interface Features {
  tempo: number | null;
  key: MusicalKey | null;
  energy: number | null;
  danceability: number | null;
  valence: number | null;
  acousticness: number | null;
  instrumentalness: number | null;
  liveness: number | null;
  speechiness: number | null;
  loudness: number | null;
  tempoSource: string | null;
}

export interface TrackDetail {
  track: Track;
  features: Features | null;
  /** A second provider's tempo reading. See {@link tempoDisagrees}. */
  tempoCrossCheck: number | null;
  genre: {
    primary: string | null;
    styles: string[];
    differs: boolean;
    containerLabel: boolean;
  } | null;
  similar?: Track[];
}

export interface SimilarResult {
  seed: { track: Track; features: Features | null };
  tracks: { track: Track; features: Features | null }[];
}

/**
 * Fields are individually optional because engines disagree about what they
 * return: some fill the streaming links, others supply `score` and neither
 * link. Treat everything except `matched` as "may not be here".
 */
export interface RecognizedTrack {
  matched: boolean;
  artist?: string;
  title?: string;
  album?: string | null;
  releaseDate?: string | null;
  label?: string | null;
  songLink?: string | null;
  artworkUrl?: string | null;
  spotifyUrl?: string | null;
  appleMusicUrl?: string | null;
  /** Match confidence, 0–100. */
  score?: number | null;
  engine?: string;
}

export interface ClientOptions {
  /** Point at a different deployment. Defaults to `https://songfinder.dev`. */
  baseUrl?: string;
  /** Per-request timeout. Recognition overrides this — the server budgets 100s
   * for the engine chain, so a short timeout aborts work that would succeed. */
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}

/**
 * Two tempo readings more than this far apart mean one source counted the
 * groove at half or double speed — an 87/174 pair is the same track. Below it,
 * the gap is just measurement noise.
 */
export const TEMPO_DISAGREEMENT_BPM = 3;

/** True when the two providers disagree enough to imply half/double time. */
export function tempoDisagrees(detail: TrackDetail): boolean {
  const primary = detail.features?.tempo;
  const cross = detail.tempoCrossCheck;
  if (!primary || !cross) return false;
  return Math.abs(primary - cross) > TEMPO_DISAGREEMENT_BPM;
}

const ISRC_PATTERN = /^[A-Za-z0-9]{12}$/;

export function isValidIsrc(value: string): boolean {
  return ISRC_PATTERN.test(value);
}

export class SongFinder {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(options: ClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 45_000;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
  }

  private async request<T>(
    path: string,
    init: RequestInit & { timeoutMs?: number } = {}
  ): Promise<T> {
    const { timeoutMs = this.timeoutMs, ...rest } = init;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...rest,
        signal: controller.signal,
        headers: {
          [CLIENT_HEADER]: CLIENT_VALUE,
          accept: 'application/json',
          ...rest.headers,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new SongFinderError(
          `Request to ${path} timed out after ${Math.round(timeoutMs / 1000)}s.`
        );
      }
      throw new SongFinderError(
        `Could not reach ${this.baseUrl}: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 429) {
      throw new SongFinderError(
        'Rate limited. The analysis endpoints allow roughly one call every 1–5 seconds.',
        429
      );
    }

    let payload: { code: number; message?: string; data?: T };
    try {
      payload = (await response.json()) as typeof payload;
    } catch {
      throw new SongFinderError(
        `Unexpected non-JSON response (HTTP ${response.status}) from ${path}.`,
        response.status
      );
    }
    if (payload.code !== 0) {
      throw new SongFinderError(
        payload.message || `Request to ${path} failed (HTTP ${response.status}).`,
        response.status
      );
    }
    return payload.data as T;
  }

  /** Search the catalogue by title and/or artist. Returns up to 10 candidates. */
  async search(query: string): Promise<Track[]> {
    const data = await this.request<Track[]>(
      `/api/track/search?q=${encodeURIComponent(query)}`
    );
    return data ?? [];
  }

  /** Tempo, key, Camelot code and acoustic features for one recording. */
  detail(isrc: string): Promise<TrackDetail> {
    this.assertIsrc(isrc);
    return this.request<TrackDetail>(
      `/api/track/detail?isrc=${encodeURIComponent(isrc)}`
    );
  }

  /**
   * Tracks that sound like the seed. With `harmonic`, restricted to keys that
   * mix cleanly with it on the Camelot wheel.
   *
   * Rate-limited to one call per 3s upstream — it fans out to a dozen requests.
   */
  similar(
    isrc: string,
    options: { limit?: number; harmonic?: boolean } = {}
  ): Promise<SimilarResult> {
    this.assertIsrc(isrc);
    const params = new URLSearchParams({ isrc });
    if (options.limit) params.set('limit', String(options.limit));
    if (options.harmonic) params.set('harmonic', '1');
    return this.request<SimilarResult>(`/api/track/similar?${params}`);
  }

  /** Identify the music in a page or direct media URL. */
  identifyUrl(url: string, startSeconds?: number): Promise<RecognizedTrack> {
    const form = new FormData();
    form.set('url', url);
    form.set('source', CLIENT_VALUE);
    if (startSeconds && startSeconds > 0) {
      form.set('start', String(Math.floor(startSeconds)));
    }
    return this.request<RecognizedTrack>('/api/music/recognize', {
      method: 'POST',
      body: form,
      timeoutMs: 120_000,
    });
  }

  /** Identify music in an audio buffer. Max 10MB. */
  identifyFile(
    bytes: Uint8Array,
    fileName: string,
    mimeType: string
  ): Promise<RecognizedTrack> {
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      return Promise.reject(
        new SongFinderError(
          `File is ${(bytes.byteLength / 1024 / 1024).toFixed(1)}MB; the limit is 10MB.`
        )
      );
    }
    const form = new FormData();
    form.set('file', new Blob([bytes], { type: mimeType }), fileName);
    form.set('source', CLIENT_VALUE);
    return this.request<RecognizedTrack>('/api/music/recognize', {
      method: 'POST',
      body: form,
      timeoutMs: 120_000,
    });
  }

  /**
   * Recognition returns a title and artist but no ISRC, while every analysis
   * method is keyed by ISRC. This closes that gap with one catalogue search.
   *
   * Never throws: failing to resolve must not sink a successful match.
   */
  async resolveIsrc(title?: string, artist?: string): Promise<string | null> {
    if (!title || !artist) return null;
    try {
      const candidates = await this.search(`${title} ${artist}`);
      const wanted = title.toLowerCase();
      const exact = candidates.find((t) => t.title.toLowerCase() === wanted);
      return (exact ?? candidates[0])?.isrc ?? null;
    } catch {
      return null;
    }
  }

  private assertIsrc(isrc: string): void {
    if (!isValidIsrc(isrc)) {
      throw new SongFinderError(
        `"${isrc}" is not an ISRC. An ISRC is exactly 12 letters/digits, e.g. USUG11904206.`
      );
    }
  }
}

export default SongFinder;
