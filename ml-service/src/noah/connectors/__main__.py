"""CLI: ``python -m noah.connectors run [--once] [--connector s1 ...] [--dry-run]``.

``--dry-run`` writes to an in-memory sink and prints counts; it still makes
one real GET per selected connector, so run it no more often than the
source cadence. Without ``--dry-run`` a sink factory must be named with
``--sink module:callable`` or ``NOAH_SINK``; the CLI never guesses one.

The worker (compose service ``worker``) runs::

    python -m noah.connectors run --sink noah.store.factory:make_sink

``make_sink`` needs ``NOAH_DATABASE_URL`` and a usable object store. If the
factory cannot build a sink the CLI prints the reason (never a URL or
secret) and exits 2 before any connector runs: fail closed.
"""

from __future__ import annotations

import argparse
import importlib
import logging
import os
import re
import sys
from collections.abc import Sequence

from ..records import Sink
from ..timeunits import to_iso_utc
from .base import Fetcher
from .memory import MemorySink
from .registry import ALIASES, build_connectors
from .scheduler import Scheduler


_ANY_URL_RE = re.compile(r"\b[a-zA-Z][a-zA-Z0-9+.\-]*://\S+")


class SinkLoadError(Exception):
    pass


def _redact(text: str) -> str:
    return _ANY_URL_RE.sub("<url>", text).replace("\n", " ").strip()[:300]


def _load_sink(spec: str) -> Sink:
    module, _, attr = spec.partition(":")
    if not module or not attr:
        raise SinkLoadError("sink must be given as module:callable")
    try:
        factory = getattr(importlib.import_module(module), attr)
    except (ImportError, AttributeError):
        raise SinkLoadError(f"cannot load sink factory {spec!r}") from None
    try:
        return factory()
    except Exception as exc:
        # Configuration errors name the variable, never its value; redact anyway.
        raise SinkLoadError(f"{type(exc).__name__}: {_redact(str(exc))}") from None


def main(argv: Sequence[str] | None = None, *, fetcher: Fetcher | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m noah.connectors")
    sub = parser.add_subparsers(dest="cmd", required=True)
    run = sub.add_parser("run", help="run connectors")
    run.add_argument("--once", action="store_true", help="run each selected connector once and exit")
    run.add_argument(
        "--connector",
        action="append",
        default=None,
        help=f"connector alias or id; repeatable ({', '.join(sorted(ALIASES))})",
    )
    run.add_argument("--dry-run", action="store_true", help="in-memory sink; print counts")
    run.add_argument("--sink", default=None, help="sink factory module:callable (default: $NOAH_SINK)")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    try:
        connectors = build_connectors(fetcher=fetcher, only=args.connector)
    except KeyError as exc:
        print(f"error: {exc.args[0]}", file=sys.stderr)
        return 2

    if args.dry_run:
        sink: Sink = MemorySink()
    else:
        spec = args.sink or os.environ.get("NOAH_SINK", "").strip()
        if not spec:
            print("error: no sink configured; use --dry-run or --sink module:callable (or NOAH_SINK)", file=sys.stderr)
            return 2
        try:
            sink = _load_sink(spec)
        except SinkLoadError as exc:
            print(f"error: no usable sink: {exc}", file=sys.stderr)
            return 2

    sched = Scheduler(connectors, sink)
    for c in connectors:
        if not c.enabled:
            print(f"{c.id}: disabled (endpoint not configured)")
    if not args.once:
        sched.run_forever()
        return 0

    runs = sched.run_once()
    for r in runs:
        newest = to_iso_utc(r.newest_ts) if r.newest_ts else "-"
        line = f"{r.connector}: {r.status.value} rows={r.rows_written} newest_ts={newest}"
        if r.error:
            line += f" error={r.error}"
        print(line)
    if isinstance(sink, MemorySink):
        print("counts: " + " ".join(f"{k}={v}" for k, v in sink.counts().items()))
    return 0 if all(r.status.value != "failed" for r in runs) else 1


if __name__ == "__main__":
    raise SystemExit(main())
