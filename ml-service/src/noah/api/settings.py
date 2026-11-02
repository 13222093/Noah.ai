"""Runtime settings, read from environment variables only (guardrail 10).

No secrets are needed yet. When they are, read them here from the
environment and fail closed when they are missing; never add defaults.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    env: str = "development"
    # Exact origins allowed by CORS. Empty means no cross-origin access.
    cors_origins: tuple[str, ...] = ()

    @classmethod
    def from_env(cls, environ: Mapping[str, str] | None = None) -> "Settings":
        env = os.environ if environ is None else environ
        raw = env.get("NOAH_CORS_ORIGINS", "")
        origins = tuple(o.strip() for o in raw.split(",") if o.strip())
        if "*" in origins:
            raise ValueError("NOAH_CORS_ORIGINS must list exact origins; '*' is not allowed")
        return cls(env=env.get("NOAH_ENV", "development").strip() or "development", cors_origins=origins)
