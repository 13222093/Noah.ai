"""The set of connectors this deployment runs, built from the environment.

Building connectors makes no network request. Connectors whose endpoint is
not confirmed (S4 features, S5 image) stay disabled until their URL is set.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence

from .base import Connector, Fetcher, HealthSpec
from .s1_posko_banjir import PoskoBanjirConnector
from .s4_bpbd_infobanjir import BpbdInfoBanjirConnector
from .s5_bmkg_nowcast import BmkgNowcastFeedConnector, BmkgNowcastImageConnector
from .s15_petabencana import PetaBencanaConnector

__all__ = ["ALIASES", "CONNECTOR_CLASSES", "build_connectors", "health_specs", "resolve"]

CONNECTOR_CLASSES: tuple[type[Connector], ...] = (
    PoskoBanjirConnector,
    BpbdInfoBanjirConnector,
    BmkgNowcastFeedConnector,
    BmkgNowcastImageConnector,
    PetaBencanaConnector,
)

ALIASES: dict[str, str] = {
    "s1": PoskoBanjirConnector.id,
    "s4": BpbdInfoBanjirConnector.id,
    "s5": BmkgNowcastFeedConnector.id,
    "s5img": BmkgNowcastImageConnector.id,
    "s15": PetaBencanaConnector.id,
}


def resolve(name: str) -> str:
    key = name.strip().lower()
    ids = {c.id for c in CONNECTOR_CLASSES}
    if key in ALIASES:
        return ALIASES[key]
    if key in ids:
        return key
    raise KeyError(f"unknown connector {name!r}; known: {sorted(ALIASES)} or {sorted(ids)}")


def build_connectors(
    env: Mapping[str, str] | None = None,
    fetcher: Fetcher | None = None,
    only: Sequence[str] | None = None,
) -> list[Connector]:
    wanted = {resolve(n) for n in only} if only else None
    return [
        cls(env=env, fetcher=fetcher)
        for cls in CONNECTOR_CLASSES
        if wanted is None or cls.id in wanted
    ]


def health_specs(env: Mapping[str, str] | None = None) -> list[HealthSpec]:
    return [c.health_spec() for c in build_connectors(env)]
