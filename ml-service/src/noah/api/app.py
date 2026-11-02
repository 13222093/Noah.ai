"""FastAPI application factory for the Noah v1 API.

Run with: ``uvicorn --factory noah.api.app:create_app`` (with ``src`` on PYTHONPATH).

Health wiring: when no ``health_source`` is passed, ``NOAH_DATABASE_URL``
selects the Postgres ``connector_runs`` reader (one short-lived connection
per health request, ``noah.store.factory``). Without it ``/api/v1/health``
answers 503 ``{"status": "unconfigured"}``; the app still starts.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .. import __version__
from ..connectors.base import HealthSpec
from ..connectors.registry import health_specs as default_health_specs
from ..timeunits import utc_now
from .errors import install_error_handlers
from .health import HealthSource
from .settings import Settings
from .v1 import router as v1_router


def create_app(
    settings: Settings | None = None,
    *,
    health_source: HealthSource | None = None,
    health_specs: Sequence[HealthSpec] | None = None,
    clock: Callable[[], datetime] = utc_now,
    environ: Mapping[str, str] | None = None,
) -> FastAPI:
    """``health_source`` reads ``connector_runs``. When it is not given, it is
    built from ``environ`` (default ``os.environ``): the Postgres reader if
    ``NOAH_DATABASE_URL`` is set, otherwise none, and ``/api/v1/health``
    answers 503 ``unconfigured``. ``health_specs`` defaults to the connectors
    configured from the same environment."""
    settings = settings or Settings.from_env(environ)
    if health_source is None:
        from ..store.factory import health_source_from_env

        health_source = health_source_from_env(environ)

    app = FastAPI(
        title="Noah AI API",
        version=__version__,
        description=(
            "Decision-support API for DSDA and BPBD DKI operators. Rebuild in progress; "
            "no validated forecast is served. Operator use only, no public warnings."
        ),
        openapi_url="/api/v1/openapi.json",
        docs_url="/api/v1/docs",
        redoc_url=None,
    )
    app.state.settings = settings
    app.state.health_source = health_source
    app.state.health_specs = list(health_specs) if health_specs is not None else default_health_specs(environ)
    app.state.clock = clock

    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=list(settings.cors_origins),
            allow_credentials=False,
            allow_methods=["GET", "POST"],
            allow_headers=["Authorization", "Content-Type"],
        )

    install_error_handlers(app)
    app.include_router(v1_router)
    return app
