import pytest
from fastapi.testclient import TestClient

from noah.api.app import create_app
from noah.api.settings import Settings


@pytest.fixture(autouse=True)
def _no_real_database(monkeypatch):
    # Unit tests never reach a real database, even when the shell (or the CI
    # migrations job) has NOAH_DATABASE_URL set. Integration tests use
    # NOAH_TEST_DATABASE_URL instead.
    monkeypatch.delenv("NOAH_DATABASE_URL", raising=False)


@pytest.fixture
def app():
    return create_app(Settings(env="test"), environ={})


@pytest.fixture
def client(app):
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
