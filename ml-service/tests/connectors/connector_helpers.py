from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path

from noah.connectors.base import FetchResponse

FIXTURES = Path(__file__).parent / "fixtures"

# Fetch times of the saved fixtures (server Date headers), UTC.
S1_FETCHED_AT = datetime(2026, 11, 2, 13, 42, 27, tzinfo=timezone.utc)
S5_FETCHED_AT = datetime(2026, 11, 2, 13, 48, 31, tzinfo=timezone.utc)
S15_FETCHED_AT = datetime(2026, 11, 2, 13, 49, 0, tzinfo=timezone.utc)


def fixture_bytes(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


@dataclass
class Clock:
    now: datetime

    def __call__(self) -> datetime:
        return self.now

    def advance(self, **kw: float) -> None:
        self.now += timedelta(**kw)


@dataclass
class FakeFetcher:
    """Serves queued responses; records request headers. No network."""

    responses: list[FetchResponse | Exception] = field(default_factory=list)
    requests: list[tuple[str, dict[str, str]]] = field(default_factory=list)

    def get(self, url: str, *, headers: Mapping[str, str], timeout: float) -> FetchResponse:
        self.requests.append((url, dict(headers)))
        if not self.responses:
            raise AssertionError("unexpected request")
        nxt = self.responses.pop(0)
        if isinstance(nxt, Exception):
            raise nxt
        return nxt


def response(
    content: bytes,
    *,
    status: int = 200,
    content_type: str = "text/html; charset=utf-8",
    fetched_at: datetime = S1_FETCHED_AT,
    headers: Mapping[str, str] | None = None,
    url: str = "https://example.invalid/",
) -> FetchResponse:
    return FetchResponse(
        status_code=status,
        content=content,
        content_type=content_type,
        url=url,
        fetched_at=fetched_at,
        headers=dict(headers or {}),
    )
