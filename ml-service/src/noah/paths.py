"""Where ``db/migrations`` and ``config/`` live, in a checkout and in the image.

Precedence (first match wins):

1. A file-specific override: ``NOAH_MIGRATIONS_DIR`` or ``NOAH_STATIONS_CONFIG``
   (handled by the callers in ``noah.store``).
2. ``NOAH_BASE_DIR``: the directory that holds ``db/`` and ``config/``. The
   ml-service image sets it to ``/app`` (``ml-service/Dockerfile``).
3. The nearest ancestor of this file that contains ``db/migrations``. In a
   checkout that is the repository root; in the image it is ``/app``.
4. The repository root as seen from a checkout (``ml-service/src/noah`` -> up
   three), so error messages still name a sensible path.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from pathlib import Path

__all__ = ["base_dir", "migrations_dir", "stations_config_path"]

_HERE = Path(__file__).resolve()


def base_dir(env: Mapping[str, str] | None = None, *, start: Path | None = None) -> Path:
    env = os.environ if env is None else env
    raw = (env.get("NOAH_BASE_DIR") or "").strip()
    if raw:
        return Path(raw)
    here = (start or _HERE).resolve()
    for parent in here.parents:
        if (parent / "db" / "migrations").is_dir():
            return parent
    # ml-service/src/noah/paths.py -> repository root
    return here.parents[3] if len(here.parents) > 3 else here.parent


def migrations_dir(env: Mapping[str, str] | None = None) -> Path:
    env = os.environ if env is None else env
    raw = (env.get("NOAH_MIGRATIONS_DIR") or "").strip()
    return Path(raw) if raw else base_dir(env) / "db" / "migrations"


def stations_config_path(env: Mapping[str, str] | None = None) -> Path:
    env = os.environ if env is None else env
    raw = (env.get("NOAH_STATIONS_CONFIG") or "").strip()
    return Path(raw) if raw else base_dir(env) / "config" / "stations.yaml"
