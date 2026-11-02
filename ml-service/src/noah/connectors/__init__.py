"""Connectors (B-035 to B-039): one module per public source.

Each connector fetches its source politely, stores the raw payload through
``Sink.write_raw`` and appends normalized records (``noah.records``).
See ``docs/data/connectors.md``. Run with ``python -m noah.connectors``.
"""

from .base import Connector, HealthSpec, ParseResult
from .memory import MemorySink

__all__ = ["Connector", "HealthSpec", "MemorySink", "ParseResult"]
