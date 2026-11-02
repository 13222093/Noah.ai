"""B-033: object keys are deterministic and content-addressed; writes never overwrite."""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

import pytest

from noah.records import RawPayload
from noah.store.objects import (
    LocalObjectStore,
    ObjectConflictError,
    S3ObjectStore,
    extension_for,
    object_store_from_env,
    raster_key,
    raw_key,
    sha256_hex,
)

WIB = timezone(timedelta(hours=7))
UTC = timezone.utc
KEY_RE = re.compile(r"^raw/[a-z0-9_\-]+/\d{4}/\d{2}/\d{2}/\d{8}T\d{6}Z_[0-9a-f]{12}\.[a-z]+$")


def _payload(content=b"<xml>1</xml>", when=datetime(2026, 11, 2, 3, 15, 7, tzinfo=UTC), ctype="text/xml"):
    return RawPayload(source="s1_posko_banjir", fetched_at=when, content=content, content_type=ctype)


def test_raw_key_format_and_determinism():
    p = _payload()
    k1, k2 = raw_key(p), raw_key(_payload())
    assert k1 == k2
    assert KEY_RE.match(k1)
    assert k1 == f"raw/s1_posko_banjir/2026/11/02/20261102T031507Z_{sha256_hex(b'<xml>1</xml>')[:12]}.xml"


def test_raw_key_uses_utc_date_folders():
    # 03:00 WIB on 1 Jan is 20:00 UTC on 31 Dec.
    p = _payload(when=datetime(2020, 1, 1, 3, 0, tzinfo=WIB))
    assert raw_key(p).startswith("raw/s1_posko_banjir/2019/12/31/20191231T200000Z_")


def test_raw_key_changes_with_content_and_time():
    base = raw_key(_payload())
    assert raw_key(_payload(content=b"<xml>2</xml>")) != base
    assert raw_key(_payload(when=datetime(2026, 11, 2, 3, 20, tzinfo=UTC))) != base


def test_raw_key_rejects_naive_time_and_bad_source():
    with pytest.raises(ValueError):
        raw_key(_payload(when=datetime(2026, 1, 1)))
    with pytest.raises(ValueError):
        raw_key(RawPayload(source="../etc", fetched_at=datetime.now(UTC), content=b"", content_type="text/plain"))


def test_extensions():
    assert extension_for("application/json; charset=utf-8") == "json"
    assert extension_for("TEXT/CSV") == "csv"
    assert extension_for("image/png") == "png"
    assert extension_for("application/x-unknown") == "bin"


def test_raster_key_prefix():
    k = raster_key("s5_bmkg_nowcast", datetime(2026, 11, 2, 6, 10, tzinfo=UTC), b"PNG", "image/png")
    assert k.startswith("rasters/s5_bmkg_nowcast/2026/11/02/20261102T061000Z_") and k.endswith(".png")


def test_local_store_write_is_idempotent(tmp_path):
    store = LocalObjectStore(tmp_path)
    p = _payload()
    key = raw_key(p)
    first = store.put(key, p.content, p.content_type)
    second = store.put(key, p.content, p.content_type)
    assert first.created and not second.created
    assert first.sha256 == sha256_hex(p.content) and first.size_bytes == len(p.content)
    assert store.exists(key)
    assert store.get(key) == p.content
    assert store.uri(key).startswith("file:")
    # no temp files left behind
    assert [f.name for f in (tmp_path / key).parent.iterdir()] == [key.rsplit("/", 1)[1]]


def test_local_store_never_overwrites(tmp_path):
    store = LocalObjectStore(tmp_path)
    key = raw_key(_payload())
    store.put(key, b"<xml>1</xml>", "text/xml")
    with pytest.raises(ObjectConflictError):
        store.put(key, b"tampered", "text/xml")
    assert store.get(key) == b"<xml>1</xml>"


@pytest.mark.parametrize("key", ["raw/../x", "/etc/passwd", "other/x.bin", "raw//x", "raw/a b"])
def test_local_store_rejects_bad_keys(tmp_path, key):
    with pytest.raises(ValueError):
        LocalObjectStore(tmp_path).put(key, b"x", "text/plain")


class FakeS3:
    class _Missing(Exception):
        response = {"Error": {"Code": "404"}}

    def __init__(self):
        self.objects = {}

    def head_object(self, Bucket, Key):
        if (Bucket, Key) not in self.objects:
            raise self._Missing()
        body, meta = self.objects[(Bucket, Key)]
        return {"Metadata": meta, "ContentLength": len(body)}

    def put_object(self, Bucket, Key, Body, ContentType, Metadata):
        self.objects[(Bucket, Key)] = (Body, Metadata)

    def get_object(self, Bucket, Key):
        import io

        return {"Body": io.BytesIO(self.objects[(Bucket, Key)][0])}


def test_s3_store_with_fake_client():
    fake = FakeS3()
    store = S3ObjectStore("noah-bucket", prefix="staging", client=fake)
    p = _payload()
    key = raw_key(p)
    assert not store.exists(key)
    assert store.put(key, p.content, p.content_type).created
    assert not store.put(key, p.content, p.content_type).created
    assert ("noah-bucket", "staging/" + key) in fake.objects
    assert store.get(key) == p.content
    assert store.uri(key) == f"s3://noah-bucket/staging/{key}"
    with pytest.raises(ObjectConflictError):
        store.put(key, b"other", "text/xml")


def test_store_from_env(tmp_path):
    store = object_store_from_env({"NOAH_OBJECT_STORE_DIR": str(tmp_path)})
    assert isinstance(store, LocalObjectStore) and store.root == tmp_path.resolve()
    with pytest.raises(ValueError):
        object_store_from_env({"NOAH_OBJECT_STORE": "ftp"})
