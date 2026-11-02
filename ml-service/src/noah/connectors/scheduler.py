"""A small polling loop for the connectors (B-035).

Why not APScheduler: we have five fixed-interval jobs in one process, no
cron expressions, no persistent job store and no need for thread pools. A
plain loop with injectable ``clock``/``sleep`` is fewer moving parts, has no
extra dependency, and is fully testable without real time. The process
supervisor (container ``restart: unless-stopped``) handles restarts; health
(``/api/v1/health``) detects a dead loop because runs stop arriving.

Behaviour:
- Connectors run one after another, each inside its own isolated ``run``
  (which never raises); a second guard here catches anything that slips
  through, so one connector cannot stop the loop.
- Next run of a connector = ``backoff_delay_s(interval, failures)``: the plain
  interval after a success, exponentially longer (deterministic jitter, capped
  at 1 h) after consecutive failures, and never sooner than a ``Retry-After``.
- Disabled connectors (endpoint not configured) are skipped.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from datetime import datetime, timedelta

from ..records import ConnectorRun, RunStatus, Sink
from ..timeunits import utc_now
from .base import Connector, backoff_delay_s, safe_error

__all__ = ["Scheduler"]

logger = logging.getLogger("noah.connectors.scheduler")


@dataclass
class _State:
    connector: Connector
    next_at: datetime
    failures: int = 0


class Scheduler:
    def __init__(
        self,
        connectors: Iterable[Connector],
        sink: Sink,
        *,
        clock: Callable[[], datetime] = utc_now,
        sleep: Callable[[float], None] = time.sleep,
        backoff_cap_s: float = 3600.0,
    ) -> None:
        self.sink = sink
        self.clock = clock
        self.sleep = sleep
        self.backoff_cap_s = backoff_cap_s
        now = clock()
        all_connectors = list(connectors)
        self.states = [_State(c, now) for c in all_connectors if c.enabled]
        self.skipped = [c.id for c in all_connectors if not c.enabled]

    def _run_one(self, st: _State) -> ConnectorRun:
        c = st.connector
        try:
            run = c.run(self.sink)
        except Exception as exc:  # Connector.run should never raise; belt and braces
            now = self.clock()
            run = ConnectorRun(c.id, now, now, RunStatus.FAILED, error=safe_error(exc))
            logger.error("connector %s escaped isolation: %s", c.id, run.error)
        st.failures = st.failures + 1 if run.status is RunStatus.FAILED else 0
        delay = backoff_delay_s(
            c.interval_s,
            st.failures,
            key=c.id,
            cap_s=max(self.backoff_cap_s, c.interval_s),
            retry_after_s=c.last_retry_after_s,
        )
        st.next_at = self.clock() + timedelta(seconds=delay)
        return run

    def run_once(self) -> list[ConnectorRun]:
        """Run every enabled connector once, in order."""
        return [self._run_one(st) for st in self.states]

    def run_due(self) -> list[ConnectorRun]:
        now = self.clock()
        return [self._run_one(st) for st in self.states if st.next_at <= now]

    def run_forever(self, *, max_cycles: int | None = None) -> None:
        cycles = 0
        while self.states and (max_cycles is None or cycles < max_cycles):
            self.run_due()
            cycles += 1
            wait = (min(st.next_at for st in self.states) - self.clock()).total_seconds()
            if wait > 0:
                self.sleep(wait)
