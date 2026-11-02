import pytest
from fastapi.testclient import TestClient

from noah.api.app import create_app
from noah.api.settings import Settings


def _assert_error(resp, status, code):
    assert resp.status_code == status
    assert resp.headers["content-type"].startswith("application/json")
    body = resp.json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == code
    assert isinstance(body["error"]["message"], str) and body["error"]["message"]
    return body["error"]


def test_health_without_source_is_503_not_healthy(client):
    # B-040: per-connector freshness. With no database configured the service
    # must not claim to be healthy, and must not crash or show an error text.
    # Freshness cases: tests/connectors/test_health_endpoint.py
    resp = client.get("/api/v1/health")
    assert resp.status_code == 503
    assert resp.json() == {"status": "unconfigured"}
    assert resp.headers["cache-control"] == "no-store"


def test_unknown_route_is_structured_404(client):
    _assert_error(client.get("/api/v1/does-not-exist"), 404, "not_found")


def test_wrong_method_is_structured_405(client):
    _assert_error(client.post("/api/v1/health"), 405, "method_not_allowed")


@pytest.mark.parametrize(
    "method, path",
    [
        ("GET", "/health"),
        ("POST", "/predict"),
        ("POST", "/predict/scenario/scenario_demo"),
        ("GET", "/scenarios"),
        ("POST", "/verify-visual"),
        ("POST", "/admin/set-demo-mode"),
        ("GET", "/admin/demo-status"),
    ],
)
def test_removed_hackathon_endpoints_stay_removed(client, method, path):
    _assert_error(client.request(method, path), 404, "not_found")


def test_unhandled_exception_is_500_without_traceback(app, client):
    @app.get("/api/v1/_boom")
    def boom():
        raise RuntimeError("secret internal detail")

    err = _assert_error(client.get("/api/v1/_boom"), 500, "internal_error")
    assert "secret internal detail" not in err["message"]
    assert err["details"] is None


def test_validation_error_is_structured_422(app, client):
    @app.get("/api/v1/_needs_int")
    def needs_int(n: int):
        return {"n": n}

    err = _assert_error(client.get("/api/v1/_needs_int", params={"n": "x"}), 422, "validation_error")
    assert err["details"]["errors"][0]["loc"] == ["query", "n"]


def test_openapi_served_under_v1(client):
    resp = client.get("/api/v1/openapi.json")
    assert resp.status_code == 200
    assert "/api/v1/health" in resp.json()["paths"]


def test_cors_disabled_by_default(client):
    resp = client.get("/api/v1/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in resp.headers


def test_cors_allows_only_configured_origin():
    app = create_app(Settings(cors_origins=("https://ops.example.go.id",)))
    with TestClient(app) as c:
        ok = c.get("/api/v1/health", headers={"Origin": "https://ops.example.go.id"})
        bad = c.get("/api/v1/health", headers={"Origin": "https://evil.example"})
    assert ok.headers.get("access-control-allow-origin") == "https://ops.example.go.id"
    assert "access-control-allow-origin" not in bad.headers


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("", ()),
        ("https://a.example", ("https://a.example",)),
        (" https://a.example , https://b.example ,", ("https://a.example", "https://b.example")),
    ],
)
def test_settings_parse_cors_origins(raw, expected):
    assert Settings.from_env({"NOAH_CORS_ORIGINS": raw}).cors_origins == expected


def test_settings_reject_wildcard_cors():
    with pytest.raises(ValueError):
        Settings.from_env({"NOAH_CORS_ORIGINS": "*"})
