"""Tiny forward-only migration runner for ``db/migrations`` (B-031).

- Files are ``NNNN_snake_case.sql``, applied in order, each in its own
  transaction, and recorded in ``schema_migrations(version, name, checksum,
  applied_at)``.
- An applied file must never change: a checksum mismatch stops the run.
- A session advisory lock prevents two runners from racing.
- No down migrations. Facts are append-only, so the schema only grows; a
  mistake is fixed by a new migration.

CLI (reads ``NOAH_DATABASE_URL``; the URL is never printed)::

    python -m noah.store.migrate             # apply pending migrations
    python -m noah.store.migrate --status    # list applied / pending
"""

from __future__ import annotations

import argparse
import hashlib
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

__all__ = [
    "Migration",
    "MigrationError",
    "default_migrations_dir",
    "discover_migrations",
    "applied_migrations",
    "pending_migrations",
    "migrate",
]

_FILE_RE = re.compile(r"^(?P<version>\d{4})_(?P<name>[a-z0-9_]+)\.sql$")
_LOCK_KEY = 0x4E4F_4148  # "NOAH"

_BOOTSTRAP = """
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     text PRIMARY KEY,
  name        text NOT NULL,
  checksum    text NOT NULL,
  applied_at  timestamptz NOT NULL DEFAULT now()
)
"""


class MigrationError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class Migration:
    version: str
    name: str
    path: Path
    sql: str
    checksum: str


def default_migrations_dir() -> Path:
    """``NOAH_MIGRATIONS_DIR``, else ``<base>/db/migrations`` (``noah.paths``):
    the repository root in a checkout, ``/app`` in the image."""
    from noah.paths import migrations_dir

    return migrations_dir()


def discover_migrations(directory: str | os.PathLike[str] | None = None) -> list[Migration]:
    d = Path(directory) if directory is not None else default_migrations_dir()
    if not d.is_dir():
        raise MigrationError(f"migrations directory not found: {d}")
    found: dict[str, Migration] = {}
    for path in sorted(d.iterdir()):
        if path.suffix != ".sql":
            continue
        m = _FILE_RE.match(path.name)
        if not m:
            raise MigrationError(f"bad migration file name {path.name!r}; expected NNNN_snake_case.sql")
        version = m.group("version")
        if version in found:
            raise MigrationError(f"duplicate migration version {version}")
        raw = path.read_bytes()
        # Normalize line endings so a Windows checkout has the same checksum.
        text = raw.decode("utf-8").replace("\r\n", "\n")
        checksum = hashlib.sha256(text.encode("utf-8")).hexdigest()
        found[version] = Migration(version, m.group("name"), path, text, checksum)
    return [found[v] for v in sorted(found)]


def applied_migrations(conn: Any) -> dict[str, str]:
    """``{version: checksum}`` of applied migrations (empty if none)."""
    row = conn.execute("SELECT to_regclass('schema_migrations') IS NOT NULL").fetchone()
    if not row or not row[0]:
        return {}
    return {v: c for v, c in conn.execute("SELECT version, checksum FROM schema_migrations")}


def pending_migrations(conn: Any, directory: str | os.PathLike[str] | None = None) -> list[Migration]:
    migrations = discover_migrations(directory)
    done = applied_migrations(conn)
    _check_checksums(migrations, done)
    return [m for m in migrations if m.version not in done]


def _check_checksums(migrations: list[Migration], done: dict[str, str]) -> None:
    known = {m.version: m for m in migrations}
    for version, checksum in done.items():
        m = known.get(version)
        if m is None:
            raise MigrationError(f"migration {version} is applied but its file is missing")
        if m.checksum != checksum:
            raise MigrationError(f"migration {m.path.name} changed after it was applied; add a new migration instead")


def migrate(conn: Any, directory: str | os.PathLike[str] | None = None) -> list[str]:
    """Apply pending migrations; return the versions applied. ``conn`` is a
    psycopg 3 connection; it is left in autocommit mode as it was given."""
    migrations = discover_migrations(directory)
    applied_now: list[str] = []
    prev_autocommit = conn.autocommit
    conn.autocommit = True
    try:
        conn.execute("SELECT pg_advisory_lock(%s)", (_LOCK_KEY,))
        try:
            conn.execute(_BOOTSTRAP)
            done = applied_migrations(conn)
            _check_checksums(migrations, done)
            for m in migrations:
                if m.version in done:
                    continue
                with conn.transaction():
                    # No parameters: psycopg sends the file as one simple
                    # query, so multi-statement files and $$ bodies work.
                    conn.execute(m.sql)
                    conn.execute(
                        "INSERT INTO schema_migrations (version, name, checksum) VALUES (%s, %s, %s)",
                        (m.version, m.name, m.checksum),
                    )
                applied_now.append(m.version)
        finally:
            conn.execute("SELECT pg_advisory_unlock(%s)", (_LOCK_KEY,))
    finally:
        conn.autocommit = prev_autocommit
    return applied_now


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m noah.store.migrate", description="Apply db/migrations.")
    parser.add_argument("--dir", help="migrations directory (default: db/migrations or NOAH_MIGRATIONS_DIR)")
    parser.add_argument("--status", action="store_true", help="show applied and pending migrations only")
    args = parser.parse_args(argv)
    url = os.environ.get("NOAH_DATABASE_URL")
    if not url:
        print("NOAH_DATABASE_URL is not set", file=sys.stderr)
        return 2
    import psycopg

    try:
        with psycopg.connect(url) as conn:
            if args.status:
                done = applied_migrations(conn)
                for m in discover_migrations(args.dir):
                    print(f"{m.version} {m.name}: {'applied' if m.version in done else 'pending'}")
                return 0
            applied = migrate(conn, args.dir)
    except MigrationError as exc:
        print(f"migration error: {exc}", file=sys.stderr)
        return 1
    print(f"applied {len(applied)} migration(s): {', '.join(applied) or 'none pending'}")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
