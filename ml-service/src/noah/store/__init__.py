"""Append-only store: Postgres/PostGIS rows plus object storage for raw payloads.

- ``noah.store.migrate``: applies ``db/migrations`` (schema_migrations).
- ``noah.store.objects``: object storage backends and deterministic keys.
- ``noah.store.stations``: station configuration and Siaga thresholds.
- ``noah.store.postgres``: ``PostgresSink``, the ``Sink`` implementation.
"""
