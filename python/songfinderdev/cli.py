"""``songfinder`` command line entry point."""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from .client import SongFinder, SongFinderError, is_valid_isrc, tempo_disagrees

BRAND = "https://songfinder.dev"


def _pct(value: float | None) -> str | None:
    return None if value is None else f"{round(value * 100)}%"


def _print_detail(detail: dict[str, Any]) -> None:
    track = detail.get("track") or {}
    features = detail.get("features") or {}
    key = features.get("key") or {}

    print(f"\n{track.get('title')} — {track.get('artist')}")
    album = track.get("album")
    if album:
        year = track.get("releaseYear")
        print(f"{album}{f' ({year})' if year else ''}")
    print(f"ISRC:           {track.get('isrc')}\n")

    if not features:
        print("No acoustic analysis is available for this recording.")
        return

    if features.get("tempo"):
        print(f"Tempo:          {round(features['tempo'])} BPM")
    if key:
        print(
            f"Key:            {key.get('name')} "
            f"(Camelot {key.get('camelot')}, Open Key {key.get('openKey')})"
        )
        if key.get("compatible"):
            print(f"Mixes with:     {', '.join(key['compatible'])}")
    for label, raw in (
        ("Energy", features.get("energy")),
        ("Danceability", features.get("danceability")),
        ("Valence", features.get("valence")),
        ("Acousticness", features.get("acousticness")),
    ):
        formatted = _pct(raw)
        if formatted:
            print(f"{label + ':':<16}{formatted}")
    if features.get("loudness"):
        print(f"Loudness:       {features['loudness']:.1f} dB")

    if tempo_disagrees(detail):
        print(
            f"\n! A second source reads {round(detail['tempoCrossCheck'])} BPM."
            "\n  A gap this size means one reading is half- or double-time."
        )
    print(f"\nFull breakdown: {BRAND}/tools/song-bpm-key")


def _print_recognition(result: dict[str, Any], isrc: str | None) -> None:
    if not result.get("matched"):
        print("\nNo match.\n")
        print("Most likely one of:")
        print("  - the excerpt is instrumental, live, or a remix with no catalogue entry")
        print("  - the clip landed on an intro or a gap — retry with --start 60")
        print("  - the audio is buried under speech or crowd noise")
        return

    print(f"\n{result.get('title')} — {result.get('artist')}")
    for label, value in (
        ("Album", result.get("album")),
        ("Released", result.get("releaseDate")),
        ("Label", result.get("label")),
        ("Confidence", f"{result['score']}%" if result.get("score") else None),
        ("ISRC", isrc),
        ("Spotify", result.get("spotifyUrl")),
        ("Apple Music", result.get("appleMusicUrl")),
    ):
        if value:
            print(f"{label + ':':<16}{value}")
    if isrc:
        print(f"\nsongfinder analyze {isrc}   # tempo, key, Camelot code")
    print(f"\nIdentified by Song Finder — {BRAND}")


def _to_isrc(client: SongFinder, value: str) -> str:
    """Accept an ISRC or a search phrase anywhere a track is named.

    Making the user run ``search`` first just to copy a code is pure friction.
    """
    if is_valid_isrc(value):
        return value
    results = client.search(value)
    if not results:
        raise SongFinderError(f'Nothing found for "{value}".')
    first = results[0]
    print(f"Using: {first['title']} — {first['artist']} ({first['isrc']})")
    return first["isrc"]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="songfinder",
        description="Identify songs, read tempo and key. Powered by songfinder.dev.",
    )
    parser.add_argument("--json", action="store_true", help="print the raw API response")
    sub = parser.add_subparsers(dest="command", required=True)

    identify = sub.add_parser("identify", help="identify a URL or an audio file")
    identify.add_argument("target", help="page/media URL, or a path to an audio file")
    identify.add_argument(
        "--start", type=int, metavar="SECONDS",
        help="sample a URL from this offset; use when the first try misses",
    )

    search = sub.add_parser("search", help="look up tracks and their ISRCs")
    search.add_argument("query", nargs="+")

    analyze = sub.add_parser("analyze", help="tempo, key, Camelot code, features")
    analyze.add_argument("target", nargs="+", help="search phrase or ISRC")

    similar = sub.add_parser("similar", help="find neighbouring tracks")
    similar.add_argument("target", nargs="+", help="search phrase or ISRC")
    similar.add_argument("--limit", type=int, default=12)
    similar.add_argument(
        "--harmonic", action="store_true",
        help="restrict to keys that mix cleanly on the Camelot wheel",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    client = SongFinder()

    try:
        if args.command == "identify":
            target = args.target
            if target.startswith(("http://", "https://")):
                result = client.identify_url(target, args.start)
            else:
                result = client.identify_file(target)
            isrc = (
                client.resolve_isrc(result.get("title"), result.get("artist"))
                if result.get("matched")
                else None
            )
            if args.json:
                print(json.dumps({**result, "isrc": isrc}, indent=2, ensure_ascii=False))
            else:
                _print_recognition(result, isrc)
            return 0 if result.get("matched") else 1

        if args.command == "search":
            query = " ".join(args.query)
            tracks = client.search(query)
            if args.json:
                print(json.dumps(tracks, indent=2, ensure_ascii=False))
            elif not tracks:
                print(f'Nothing found for "{query}".')
            else:
                for track in tracks:
                    year = f" ({track['releaseYear']})" if track.get("releaseYear") else ""
                    print(f"{track['isrc']}  {track['title']} — {track['artist']}{year}")
            return 0 if tracks else 1

        if args.command == "analyze":
            detail = client.detail(_to_isrc(client, " ".join(args.target)))
            if args.json:
                print(json.dumps(detail, indent=2, ensure_ascii=False))
            else:
                _print_detail(detail)
            return 0

        if args.command == "similar":
            result = client.similar(
                _to_isrc(client, " ".join(args.target)),
                limit=args.limit,
                harmonic=args.harmonic,
            )
            if args.json:
                print(json.dumps(result, indent=2, ensure_ascii=False))
                return 0
            seed = result["seed"]["track"]
            seed_key = (result["seed"].get("features") or {}).get("key") or {}
            heading = "Harmonically compatible with" if args.harmonic else "Similar to"
            suffix = (
                f" ({seed_key.get('name')}, {seed_key.get('camelot')})"
                if seed_key
                else ""
            )
            print(f"\n{heading} {seed['title']} — {seed['artist']}{suffix}\n")
            if not result["tracks"]:
                print(
                    "No matches. Harmonic filtering narrows results sharply — "
                    "try without --harmonic."
                )
                return 1
            for entry in result["tracks"]:
                features = entry.get("features") or {}
                key = features.get("key") or {}
                meta = " · ".join(
                    part
                    for part in (
                        f"{round(features['tempo'])} BPM" if features.get("tempo") else None,
                        f"{key.get('name')} ({key.get('camelot')})" if key else None,
                    )
                    if part
                )
                print(f"{entry['track']['isrc']}  {entry['track']['title']} — {entry['track']['artist']}")
                if meta:
                    print(f"              {meta}")
            return 0

    except SongFinderError as error:
        print(f"\n{error}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        return 130

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
