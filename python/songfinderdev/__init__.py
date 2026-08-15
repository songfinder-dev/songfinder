"""Song Finder — identify songs and read their BPM, key and Camelot code.

Both the distribution and the module are ``songfinderdev``. An unrelated
``songfinder`` project already owns that name on PyPI, and its wheel's
top-level directory is ``songfinder`` — sharing either name would have the two
installs silently overwrite each other. PyPI also rejects ``songfinder-cli``
and friends outright: its similarity check strips common suffixes like ``cli``,
``api`` and ``sdk`` before comparing, so every such variant collides too.

    >>> from songfinderdev import SongFinder
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
