"""Object storage for raw payloads and rasters (B-033).

Every fetched payload is stored verbatim under a deterministic key, and the
key is the ``raw_ref`` that normalized rows point to (guardrail 7)::

    raw/{source}/{YYYY}/{MM}/{DD}/{fetched_at}_{sha256[:12]}.{ext}
    rasters/{source}/{YYYY}/{MM}/{DD}/{valid_at}_{sha256[:12]}.{ext}

``fetched_at`` is UTC in ISO 8601 basic format (``20200101T000000Z``): no
colons, so keys are valid file names on Windows too. The date folders come
from the same UTC instant. Because the key contains the content hash, writing
the same payload again is a no-op, and a different payload can never
overwrite an existing key (a mismatch raises).

Backends:
- ``LocalObjectStore`` (default): a directory, ``NOAH_OBJECT_STORE_DIR``.
- ``S3ObjectStore``: any S3-compatible bucket. ``boto3`` is imported only
  when this backend is selected (``NOAH_OBJECT_STORE=s3``); credentials come
  from the standard AWS environment variables or instance profile and are
  never logged.
"""

from __future__ import annotations

import hashlib
import os
import re
import tempfile
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Mapping, Protocol

from noah.records import RawPayload
from noah.timeunits import ensure_utc

__all__ = [
    "ObjectStore",
    "ObjectConflictError",
    "LocalObjectStore",
    "S3ObjectStore",
    "StoredObject",
    "sha256_hex",
    "extension_for",
    "raw_key",
    "raster_key",
    "object_store_from_env",
]

PREFIXES = ("raw/", "rasters/", "research/")

_EXTENSIONS: dict[str, str] = {
    "application/json": "json",
    "application/geo+json": "geojson",
    "application/xml": "xml",
    "text/xml": "xml",
    "text/html": "html",
    "text/csv": "csv",
    "text/plain": "txt",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/tiff": "tif",
    "application/x-netcdf": "nc",
    "application/zip": "zip",
    "application/pdf": "pdf",
    "application/octet-stream": "bin",
}

_SOURCE_RE = re.compile(r"^[a-z0-9][a-z0-9_\-]{0,63}$")
_KEY_RE = re.compile(r"^(raw|rasters|research)/[A-Za-z0-9_\-./]+$")


class ObjectConflictError(RuntimeError):
    """A key already exists with different content. Never overwritten."""


@dataclass(frozen=True, slots=True)
class StoredObject:
    key: str
    sha256: str
    size_bytes: int
    created: bool  # False when the identical object was already there


def sha256_hex(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def extension_for(content_type: str) -> str:
    """File extension for a MIME type; parameters such as charset are ignored."""
    base = content_type.split(";", 1)[0].strip().lower()
    return _EXTENSIONS.get(base, "bin")


def _check_source(source: str) -> str:
    if not _SOURCE_RE.match(source):
        raise ValueError(f"invalid source id {source!r}: use lowercase letters, digits, _ or -")
    return source


def _dated_key(prefix: str, source: str, when: datetime, sha: str, ext: str) -> str:
    when = ensure_utc(when)
    stamp = when.strftime("%Y%m%dT%H%M%SZ")
    return f"{prefix}/{_check_source(source)}/{when:%Y/%m/%d}/{stamp}_{sha[:12]}.{ext}"


def raw_key(payload: RawPayload) -> str:
    """Deterministic key for a raw payload (same payload, same key)."""
    return _dated_key(
        "raw",
        payload.source,
        payload.fetched_at,
        sha256_hex(payload.content),
        extension_for(payload.content_type),
    )


def raster_key(source: str, valid_at: datetime, content: bytes, content_type: str) -> str:
    """Deterministic key for a raster or image (``rain_products.uri``)."""
    return _dated_key("rasters", source, valid_at, sha256_hex(content), extension_for(content_type))


def _check_key(key: str) -> str:
    if not _KEY_RE.match(key) or ".." in key.split("/") or "//" in key:
        raise ValueError(f"invalid object key {key!r}")
    return key


class ObjectStore(Protocol):
    def put(self, key: str, content: bytes, content_type: str) -> StoredObject: ...

    def get(self, key: str) -> bytes: ...

    def exists(self, key: str) -> bool: ...

    def uri(self, key: str) -> str: ...


class LocalObjectStore:
    """Objects as files under ``root``. Writes are atomic and never overwrite."""

    def __init__(self, root: str | os.PathLike[str]):
        self.root = Path(root).resolve()

    def _path(self, key: str) -> Path:
        path = (self.root / _check_key(key)).resolve()
        if self.root not in path.parents:
            raise ValueError(f"key escapes the store root: {key!r}")
        return path

    def put(self, key: str, content: bytes, content_type: str) -> StoredObject:
        path = self._path(key)
        sha = sha256_hex(content)
        if path.exists():
            existing = path.read_bytes()
            if sha256_hex(existing) != sha:
                raise ObjectConflictError(f"{key} exists with different content")
            return StoredObject(key, sha, len(content), created=False)
        path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=".tmp-", suffix=".part")
        try:
            with os.fdopen(fd, "wb") as fh:
                fh.write(content)
                fh.flush()
                os.fsync(fh.fileno())
            try:
                # os.link fails if the target exists: no silent overwrite in a race.
                os.link(tmp, path)
            except FileExistsError:
                if sha256_hex(path.read_bytes()) != sha:
                    raise ObjectConflictError(f"{key} exists with different content") from None
                return StoredObject(key, sha, len(content), created=False)
            except OSError:
                # Filesystems without hard links: fall back to an atomic rename.
                if path.exists():
                    if sha256_hex(path.read_bytes()) != sha:
                        raise ObjectConflictError(f"{key} exists with different content") from None
                    return StoredObject(key, sha, len(content), created=False)
                os.replace(tmp, path)
                tmp = ""
        finally:
            if tmp and os.path.exists(tmp):
                os.unlink(tmp)
        return StoredObject(key, sha, len(content), created=True)

    def get(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def exists(self, key: str) -> bool:
        return self._path(key).is_file()

    def uri(self, key: str) -> str:
        return self._path(key).as_uri()


class S3ObjectStore:
    """S3-compatible bucket (AWS, Cloudflare R2, MinIO, Wasabi, ...).

    ``prefix`` is prepended to every key (for example ``noah-prod/``) so that
    prod and staging can share a bucket. Objects are never overwritten: an
    existing key is compared by its stored sha256 metadata.
    """

    def __init__(
        self,
        bucket: str,
        *,
        prefix: str = "",
        endpoint_url: str | None = None,
        region: str | None = None,
        client: object | None = None,
    ):
        if not bucket:
            raise ValueError("bucket is required")
        self.bucket = bucket
        self.prefix = prefix.strip("/") + "/" if prefix.strip("/") else ""
        if client is None:
            try:
                import boto3  # optional dependency
            except ImportError as exc:  # pragma: no cover - depends on the environment
                raise RuntimeError(
                    "NOAH_OBJECT_STORE=s3 needs boto3; install it in the worker image"
                ) from exc
            client = boto3.client("s3", endpoint_url=endpoint_url or None, region_name=region or None)
        self._s3 = client

    def _full(self, key: str) -> str:
        return self.prefix + _check_key(key)

    def _head(self, key: str) -> Mapping[str, object] | None:
        try:
            return self._s3.head_object(Bucket=self.bucket, Key=self._full(key))  # type: ignore[attr-defined]
        except Exception as exc:  # botocore ClientError; avoid importing botocore here
            code = getattr(exc, "response", {}).get("Error", {}).get("Code")
            if code in ("404", "NoSuchKey", "NotFound"):
                return None
            raise

    def put(self, key: str, content: bytes, content_type: str) -> StoredObject:
        sha = sha256_hex(content)
        head = self._head(key)
        if head is not None:
            meta = head.get("Metadata") or {}
            if isinstance(meta, Mapping) and meta.get("sha256") == sha:
                return StoredObject(key, sha, len(content), created=False)
            raise ObjectConflictError(f"{key} exists with different or unverifiable content")
        self._s3.put_object(  # type: ignore[attr-defined]
            Bucket=self.bucket,
            Key=self._full(key),
            Body=content,
            ContentType=content_type,
            Metadata={"sha256": sha},
        )
        return StoredObject(key, sha, len(content), created=True)

    def get(self, key: str) -> bytes:
        obj = self._s3.get_object(Bucket=self.bucket, Key=self._full(key))  # type: ignore[attr-defined]
        return obj["Body"].read()

    def exists(self, key: str) -> bool:
        return self._head(key) is not None

    def uri(self, key: str) -> str:
        return f"s3://{self.bucket}/{self._full(key)}"


def object_store_from_env(env: Mapping[str, str] | None = None) -> ObjectStore:
    """Build the configured backend.

    - ``NOAH_OBJECT_STORE``: ``local`` (default) or ``s3``.
    - local: ``NOAH_OBJECT_STORE_DIR`` (default ``./var/objects``).
    - s3: ``NOAH_S3_BUCKET`` (required), ``NOAH_S3_PREFIX``,
      ``NOAH_S3_ENDPOINT_URL``, ``NOAH_S3_REGION``; credentials through the
      standard ``AWS_*`` variables.
    """
    env = os.environ if env is None else env
    kind = env.get("NOAH_OBJECT_STORE", "local").strip().lower()
    if kind == "local":
        return LocalObjectStore(env.get("NOAH_OBJECT_STORE_DIR", "./var/objects"))
    if kind == "s3":
        return S3ObjectStore(
            env.get("NOAH_S3_BUCKET", ""),
            prefix=env.get("NOAH_S3_PREFIX", ""),
            endpoint_url=env.get("NOAH_S3_ENDPOINT_URL"),
            region=env.get("NOAH_S3_REGION"),
        )
    raise ValueError(f"unknown NOAH_OBJECT_STORE {kind!r}; expected 'local' or 's3'")
