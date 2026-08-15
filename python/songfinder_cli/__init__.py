"""Song Finder — identify songs and read their BPM, key and Camelot code.

The distribution is ``songfinder-cli`` and the module is ``songfinder_cli``:
an unrelated ``songfinder`` project already owns both names on PyPI, and a
top-level collision would have the two installs silently overwrite each other.

    >>> from songfinder_cli import SongFinder
    >>> sf = SongFinder()
    >>> sf.detail(sf.search("strobe deadmau5")[0]["isrc"])["features"]["key"]["camelot"]
    '10A'

Free API, no key required. https://songfinder.dev
"""

from .client import (
    MAX_UPLOAD_BYTES,
    TEMPO_DISAGREEMENT_BPM,
    SongFinder,
    SongFinderError,
    is_valid_isrc,
    tempo_disagrees,
)

__version__ = "0.1.0"
__all__ = [
    "SongFinder",
    "SongFinderError",
    "MAX_UPLOAD_BYTES",
    "TEMPO_DISAGREEMENT_BPM",
    "is_valid_isrc",
    "tempo_disagrees",
    "__version__",
]
