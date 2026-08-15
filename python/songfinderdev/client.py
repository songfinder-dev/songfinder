"""Song Finder API client — standard library only.

Every endpoint answers with the envelope ``{"code", "message", "data"}`` and a
non-zero ``code`` means failure **regardless of the HTTP status**. Unwrapping
that in one place is the whole reason this module exists.
"""

from __future__ import annotations

import json
import mimetypes
import os
import re
import secrets
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

__all__ = [
    "SongFinder",
    "SongFinderError",
    "MAX_UPLOAD_BYTES",
    "TEMPO_DISAGREEMENT_BPM",
    "is_valid_isrc",
    "tempo_disagrees",
]

DEFAULT_BASE_URL = "https://songfinder.dev"

# Recognition refuses anonymous callers because it spends paid third-party
# quota. Clients with no browser context to run a Turnstile challenge in
# identify themselves with this header instead.
#
# **Cross-repo contract.** The other half is ``isPrivilegedClient`` in
# music-finder's ``src/routes/api/music/recognize.ts``. Change the literal on
# one side only and every recognition call here starts returning 403.
CLIENT_HEADER = "X-SongFinder-Client"
CLIENT_VALUE = "cli"

#: ``urllib`` otherwise announces itself as ``Python-urllib/3.x``, which
#: Cloudflare's bot rules reject outright — every request comes back 403 while
#: the identical call from curl succeeds. Measured, not guessed: the only
#: variable that changes the result is this header.
USER_AGENT = "songfinderdev/0.1.0 (+https://songfinder.dev)"

#: Matches the server-side cap. Checked locally so an oversized file fails
#: immediately instead of after a pointless upload.
MAX_UPLOAD_BYTES = 10 * 1024 * 1024

#: Two tempo readings further apart than this mean one source counted the
#: groove at half or double speed — an 87/174 pair is the same track.
TEMPO_DISAGREEMENT_BPM = 3.0

_ISRC = re.compile(r"^[A-Za-z0-9]{12}$")

_AUDIO_MIME = {
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".mp4": "audio/mp4",
    ".aac": "audio/aac",
    ".wav": "audio/wav",
    ".flac": "audio/flac",
    ".ogg": "audio/ogg",
    ".opus": "audio/opus",
    ".webm": "audio/webm",
}


class SongFinderError(Exception):
    """Any failure reaching or understanding the API."""

    def __init__(self, message: str, status: int | None = None) -> None:
        super().__init__(message)
        self.status = status


def is_valid_isrc(value: str) -> bool:
    """An ISRC is exactly 12 letters/digits, e.g. ``USUG11904206``."""
    return bool(_ISRC.match(value))


def tempo_disagrees(detail: dict[str, Any]) -> bool:
    """True when the two providers disagree enough to imply half/double time.

    Reporting the primary figure alone is how this data most often misleads
    people, so callers should surface both readings when this returns True.
    """
    features = detail.get("features") or {}
    primary = features.get("tempo")
    cross = detail.get("tempoCrossCheck")
    if not primary or not cross:
        return False
    return abs(primary - cross) > TEMPO_DISAGREEMENT_BPM


def guess_audio_mime(path: str | os.PathLike[str]) -> str | None:
    """Return the MIME type for a supported audio extension, else ``None``."""
    suffix = Path(path).suffix.lower()
    return _AUDIO_MIME.get(suffix) or (
        mimetypes.guess_type(str(path))[0]
        if suffix in _AUDIO_MIME
        else None
    )


def _multipart(fields: dict[str, str], files: dict[str, tuple[str, bytes, str]]):
    """Hand-rolled multipart body.

    Deliberate: this package has no runtime dependencies, and pulling in
    ``requests`` purely to encode one form would trade that for nothing.
    """
    boundary = f"----songfinder{secrets.token_hex(16)}"
    parts: list[bytes] = []
    for name, value in fields.items():
        parts.append(
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{name}"\r\n\r\n'
            f"{value}\r\n".encode()
        )
    for name, (filename, payload, content_type) in files.items():
        parts.append(
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'
            f"Content-Type: {content_type}\r\n\r\n".encode()
        )
        parts.append(payload)
        parts.append(b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


@dataclass
class SongFinder:
    """Client for the free Song Finder API. No key, no account.

    >>> sf = SongFinder()
    >>> track = sf.search("blinding lights weeknd")[0]
    >>> detail = sf.detail(track["isrc"])
    >>> round(detail["features"]["tempo"])
    171
    """

    base_url: str = DEFAULT_BASE_URL
    timeout: float = 45.0

    def __post_init__(self) -> None:
        self.base_url = (
            os.environ.get("SONGFINDER_API_URL") or self.base_url
        ).rstrip("/")

    def _request(
        self,
        path: str,
        *,
        data: bytes | None = None,
        content_type: str | None = None,
        timeout: float | None = None,
    ) -> Any:
        request = urllib.request.Request(f"{self.base_url}{path}", data=data)
        request.add_header(CLIENT_HEADER, CLIENT_VALUE)
        request.add_header("User-Agent", USER_AGENT)
        request.add_header("Accept", "application/json")
        if content_type:
            request.add_header("Content-Type", content_type)

        try:
            with urllib.request.urlopen(
                request, timeout=timeout or self.timeout
            ) as response:
                body = response.read()
        except urllib.error.HTTPError as exc:
            if exc.code == 429:
                raise SongFinderError(
                    "Rate limited. The analysis endpoints allow roughly one "
                    "call every one to five seconds.",
                    429,
                ) from exc
            # The API returns its envelope even on error statuses, so prefer
            # the server's message over a bare "HTTP 400".
            try:
                payload = json.loads(exc.read())
                raise SongFinderError(
                    payload.get("message") or f"Request to {path} failed.",
                    exc.code,
                ) from exc
            except (json.JSONDecodeError, ValueError):
                raise SongFinderError(
                    f"Request to {path} failed (HTTP {exc.code}).", exc.code
                ) from exc
        except urllib.error.URLError as exc:
            raise SongFinderError(
                f"Could not reach {self.base_url}: {exc.reason}"
            ) from exc
        except TimeoutError as exc:
            raise SongFinderError(f"Request to {path} timed out.") from exc

        try:
            payload = json.loads(body)
        except json.JSONDecodeError as exc:
            raise SongFinderError(
                f"Unexpected non-JSON response from {path}."
            ) from exc

        if payload.get("code") != 0:
            raise SongFinderError(
                payload.get("message") or f"Request to {path} failed."
            )
        return payload.get("data")

    def _assert_isrc(self, isrc: str) -> None:
        if not is_valid_isrc(isrc):
            raise SongFinderError(
                f'"{isrc}" is not an ISRC. An ISRC is exactly 12 '
                "letters/digits, e.g. USUG11904206."
            )

    def search(self, query: str) -> list[dict[str, Any]]:
        """Search the catalogue by title and/or artist. Up to 10 candidates."""
        q = urllib.parse.quote(query)
        return self._request(f"/api/track/search?q={q}") or []

    def detail(self, isrc: str) -> dict[str, Any]:
        """Tempo, key, Camelot code and acoustic features for one recording."""
        self._assert_isrc(isrc)
        return self._request(f"/api/track/detail?isrc={urllib.parse.quote(isrc)}")

    def similar(
        self, isrc: str, *, limit: int | None = None, harmonic: bool = False
    ) -> dict[str, Any]:
        """Tracks that sound like the seed.

        With ``harmonic``, restricted to keys that mix cleanly with it on the
        Camelot wheel. Rate-limited to one call per 3s upstream — it fans out
        to a dozen requests.
        """
        self._assert_isrc(isrc)
        params = {"isrc": isrc}
        if limit:
            params["limit"] = str(limit)
        if harmonic:
            params["harmonic"] = "1"
        return self._request(f"/api/track/similar?{urllib.parse.urlencode(params)}")

    def identify_url(
        self, url: str, start_seconds: int | None = None
    ) -> dict[str, Any]:
        """Identify the music in a page or direct media URL."""
        fields = {"url": url, "source": CLIENT_VALUE}
        if start_seconds and start_seconds > 0:
            fields["start"] = str(int(start_seconds))
        body, content_type = _multipart(fields, {})
        # The chain may fall through four engines plus a middleware extraction
        # and the server budgets 100s for that; a short timeout aborts work
        # that would have succeeded.
        return self._request(
            "/api/music/recognize",
            data=body,
            content_type=content_type,
            timeout=120.0,
        )

    def identify_file(self, path: str | os.PathLike[str]) -> dict[str, Any]:
        """Identify music in a local audio file. Max 10MB."""
        file_path = Path(path).expanduser().resolve()
        mime = guess_audio_mime(file_path)
        if not mime:
            supported = ", ".join(sorted(_AUDIO_MIME))
            raise SongFinderError(
                f'Unsupported file type "{file_path.suffix or "(none)"}". '
                f"Supported: {supported}."
            )
        if not file_path.is_file():
            raise SongFinderError(f"No readable file at {file_path}.")

        size = file_path.stat().st_size
        if size == 0:
            raise SongFinderError(f"{file_path} is empty.")
        if size > MAX_UPLOAD_BYTES:
            raise SongFinderError(
                f"File is {size / 1024 / 1024:.1f}MB; the limit is 10MB. "
                "Trim a 10–20 second excerpt of the music and try that."
            )

        body, content_type = _multipart(
            {"source": CLIENT_VALUE},
            {"file": (file_path.name, file_path.read_bytes(), mime)},
        )
        return self._request(
            "/api/music/recognize",
            data=body,
            content_type=content_type,
            timeout=120.0,
        )

    def resolve_isrc(self, title: str | None, artist: str | None) -> str | None:
        """Bridge recognition output to the analysis methods.

        Recognition returns a title and artist but no ISRC, while every
        analysis method is keyed by ISRC — without this the chain dead-ends
        right after the interesting part.

        Never raises: failing to resolve must not sink a successful match.
        """
        if not title or not artist:
            return None
        try:
            candidates = self.search(f"{title} {artist}")
        except SongFinderError:
            return None
        if not candidates:
            return None
        wanted = title.lower()
        for candidate in candidates:
            if candidate.get("title", "").lower() == wanted:
                return candidate.get("isrc")
        return candidates[0].get("isrc")
