"""v1 routes (plan 03, "API (v1)"). Endpoints are added as their backlog items land."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from .errors import ErrorResponse, error_response
from .health import HealthResponse, compute_health

router = APIRouter(prefix="/api/v1")
logger = logging.getLogger("noah.api")


@router.get(
    "/health",
    summary="Per-connector freshness",
    description=(
        "200 when every enabled connector is fresh and its last run did not fail; 503 otherwise. "
        "The body is the same health report in both cases. A 503 with "
        '`{"status": "unconfigured"}` means no database is configured (NOAH_DATABASE_URL unset); '
        "a 503 with the standard error body means the health source is unreachable."
    ),
    response_model=HealthResponse,
    responses={503: {"model": HealthResponse, "description": "A connector is stale or failing, or no health source"}},
)
def health(request: Request) -> JSONResponse:
    state = request.app.state
    headers = {"Cache-Control": "no-store"}
    source = getattr(state, "health_source", None)
    if source is None:
        return JSONResponse(status_code=503, content={"status": "unconfigured"}, headers=headers)
    try:
        session = getattr(source, "session", None)
        if callable(session):
            # One short-lived connection for the whole report.
            with session() as s:
                report = compute_health(state.health_specs, s, state.clock())
        else:
            report = compute_health(state.health_specs, source, state.clock())
    except Exception:
        # Never leak store errors (connection strings, SQL) to the client.
        logger.exception("health source failed")
        return error_response(503, "unavailable", "Health source unavailable", headers=headers)
    status = 200 if report.status == "ok" else 503
    return JSONResponse(status_code=status, content=jsonable_encoder(report), headers=headers)


__all__ = ["router", "ErrorResponse"]
