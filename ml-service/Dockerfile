# Noah ml-service image: the v1 API (default CMD), the connector worker and the
# one-shot migrate job all run from this one image with different commands
# (docker-compose.yml: ml-api, worker, migrate).
# Pure-Python dependencies only: no TensorFlow, OpenCV or model weights.
#
# Build context is the REPOSITORY ROOT, so the image can carry db/migrations
# and config/ next to the code:
#   docker build -f ml-service/Dockerfile -t noah-ml-api .
# The context is filtered by ml-service/Dockerfile.dockerignore (BuildKit reads
# the ignore file next to the Dockerfile), not by the root .dockerignore.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONPATH=/app/src \
    NOAH_BASE_DIR=/app \
    NOAH_OBJECT_STORE_DIR=/var/lib/noah/objects

WORKDIR /app

RUN groupadd --system --gid 10001 noah \
    && useradd --system --uid 10001 --gid noah --home-dir /app --shell /usr/sbin/nologin noah \
    && mkdir -p /var/lib/noah/objects \
    && chown -R noah:noah /var/lib/noah

COPY ml-service/requirements.txt ./requirements.txt
RUN pip install -r requirements.txt

# Code, schema and configuration only. Data files and tests stay out of the image.
# noah.paths resolves db/ and config/ under NOAH_BASE_DIR=/app.
COPY --chown=noah:noah ml-service/src/ ./src/
COPY --chown=noah:noah db/migrations/ ./db/migrations/
COPY --chown=noah:noah config/ ./config/

USER noah

# /var/lib/noah/objects (owned by noah) holds raw payloads when
# NOAH_OBJECT_STORE=local. The worker mounts a named volume there; Docker
# copies this directory's ownership into a new empty volume. No VOLUME
# instruction, so the API and migrate containers get no anonymous volume.

EXPOSE 8000

# Liveness only: the API process answers. /api/v1/health is the freshness
# report (503 while unconfigured or while any connector is stale) and is
# watched by the uptime monitor, not by Docker. The worker and migrate
# services disable this check in docker-compose.yml.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/v1/openapi.json', timeout=4).status == 200 else 1)"]

CMD ["uvicorn", "--factory", "noah.api.app:create_app", "--host", "0.0.0.0", "--port", "8000"]
