"""Build the store from the environment: the worker's sink and the API's health source.

- ``make_sink`` is the zero-argument factory for ``python -m noah.connectors run
  --sink noah.store.factory:make_sink`` (or ``NOAH_SINK``). It returns a
  ``PostgresSink`` over ``NOAH_DATABASE_URL`` plus the object store from
  ``object_store_from_env`` (``NOAH_OBJECT_STORE``, ``NOAH_OBJECT_STORE_DIR``,
  ``NOAH_S3_*``). It fails closed with ``StoreConfigError`` when the database
  URL is missing or the object store is unusable; it never falls back to an
  in-memory sink.
- ``health_source_from_env`` returns the API's ``HealthSource`` (short-lived,
  read-only connections), or ``None`` when ``NOAH_DATABASE_URL`` is not set.

Connections use autocommit, so every ``conn.transaction()`` block in
``PostgresSink`` is a real transaction and a bare SELECT never leaves the
session idle in a transaction. Prepared statements are off
(``prepare_threshold=None``) so a transaction-mode pooler (Supabase
Supavisor, PgBouncer) works. The URL is never logged, printed or put in an
exception message.
"""

from __future__ import annotations

import os
from collections.abc import Callable, Iterator, Mapping, Sequence
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from noah.records import ConnectorRun
from noah.store.objects import LocalObjectStore, ObjectStore, object_store_from_env
from noah.store.postgres import PostgresHealthSource, PostgresSink

__all__ = [
    "StoreConfigError",
    "ReconnectingPostgresSink",
    "PostgresUrlHealthSource",
    "database_url",
    "connect",
    "object_store_checked",
    "make_sink",
    "health_source_from_env",
]

Connect = Callable[[str], Any]


class StoreConfigError(RuntimeError):
    """The store is not configured. The message names the variable, never its value."""


def database_url(env: Mapping[str, str] | None = None, *, purpose: str = "the worker") -> str:
    env = os.environ if env is None else env
    url = (env.get("NOAH_DATABASE_URL") or "").strip()
    if not url:
        raise StoreConfigError(
            f"NOAH_DATABASE_URL is not set: {purpose} needs the Postgres store. "
            "Set it in deploy/<stack>.env (or use --dry-run for an in-memory test run)."
        )
    return url


def connect(url: str, *, connect_timeout: int = 10, application_name: str = "noah") -> Any:
    """A psycopg 3 connection in autocommit mode, with prepared statements off."""
    import psycopg

    return psycopg.connect(
        url,
        autocommit=True,
        prepare_threshold=None,
        connect_timeout=connect_timeout,
        application_name=application_name,
    )


def object_store_checked(env: Mapping[str, str] | None = None) -> ObjectStore:
    """``object_store_from_env`` plus checks that turn a misconfiguration into a
    clear startup error instead of a failure on the first payload."""
    env = os.environ if env is None else env
    kind = (env.get("NOAH_OBJECT_STORE") or "local").strip().lower()
    if kind == "s3" and not (env.get("NOAH_S3_BUCKET") or "").strip():
        raise StoreConfigError("NOAH_OBJECT_STORE=s3 needs NOAH_S3_BUCKET")
    try:
        store = object_store_from_env(env)
    except (ValueError, RuntimeError) as exc:
        raise StoreConfigError(f"object store: {exc}") from None
    if isinstance(store, LocalObjectStore):
        root: Path = store.root
        try:
            root.mkdir(parents=True, exist_ok=True)
        except OSError:
            raise StoreConfigError(
                f"object store directory {root} cannot be created; set NOAH_OBJECT_STORE_DIR to a writable volume"
            ) from None
        if not os.access(root, os.W_OK):
            raise StoreConfigError(
                f"object store directory {root} is not writable; set NOAH_OBJECT_STORE_DIR to a writable volume"
            )
    return store


class ReconnectingPostgresSink(PostgresSink):
    """``PostgresSink`` for a long-running worker: the connection is opened on
    first use and reopened when it is closed or broken (managed Postgres
    restarts, network blips). A failed reconnect raises inside the connector
    run, which records it as failed; the next run tries again."""

    def __init__(self, connect_fn: Callable[[], Any], objects: ObjectStore, **kwargs: Any) -> None:
        self._connect_fn = connect_fn
        self._conn: Any = None
        super().__init__(None, objects, **kwargs)

    @property  # type: ignore[override]
    def conn(self) -> Any:
        c = self._conn
        if c is None or getattr(c, "closed", False) or getattr(c, "broken", False):
            if c is not None:
                try:
                    c.close()
                except Exception:
                    pass
                self._station_cache.clear()
            self._conn = c = self._connect_fn()
        return c

    @conn.setter
    def conn(self, value: Any) -> None:
        self._conn = value

    def close(self) -> None:
        if self._conn is not None:
            self._conn.close()
            self._conn = None

    def __repr__(self) -> str:  # never show the URL
        return f"ReconnectingPostgresSink(objects={type(self.objects).__name__})"


def make_sink(env: Mapping[str, str] | None = None, *, connect_fn: Connect | None = None) -> PostgresSink:
    """Sink factory for the connector worker (``--sink noah.store.factory:make_sink``)."""
    env = os.environ if env is None else env
    url = database_url(env)
    objects = object_store_checked(env)
    opener = connect_fn or (lambda u: connect(u, application_name="noah-worker"))
    return ReconnectingPostgresSink(lambda: opener(url), objects)


class PostgresUrlHealthSource:
    """``HealthSource`` that opens one short-lived connection per health
    request (``session``) and closes it afterwards, so the API holds no idle
    connection and a database restart needs no API restart. Read-only."""

    def __init__(self, connect_fn: Callable[[], Any]) -> None:
        self._connect_fn = connect_fn

    @contextmanager
    def session(self) -> Iterator[PostgresHealthSource]:
        conn = self._connect_fn()
        try:
            yield PostgresHealthSource(conn)
        finally:
            conn.close()

    # Direct use (one connection per call); the API uses ``session`` instead.
    def recent_runs(self, connector: str, limit: int = 5) -> Sequence[ConnectorRun]:
        with self.session() as s:
            return s.recent_runs(connector, limit)

    def last_successful_run(self, connector: str) -> ConnectorRun | None:
        with self.session() as s:
            return s.last_successful_run(connector)

    def __repr__(self) -> str:  # never show the URL
        return "PostgresUrlHealthSource()"


def health_source_from_env(
    env: Mapping[str, str] | None = None, *, connect_fn: Connect | None = None
) -> PostgresUrlHealthSource | None:
    """The API's health source, or ``None`` when ``NOAH_DATABASE_URL`` is unset
    (``/api/v1/health`` then answers 503 ``unconfigured``). Makes no connection."""
    env = os.environ if env is None else env
    url = (env.get("NOAH_DATABASE_URL") or "").strip()
    if not url:
        return None
    opener = connect_fn or (lambda u: connect(u, connect_timeout=5, application_name="noah-api"))
    return PostgresUrlHealthSource(lambda: opener(url))
