"""F3: db/migrations and config/ resolve from an overridable base directory,
so the same defaults work in a checkout and in the image (/app)."""

from __future__ import annotations

from pathlib import Path

from noah import paths
from noah.store.migrate import default_migrations_dir, discover_migrations
from noah.store.stations import default_config_path, load_station_config

REPO = Path(__file__).resolve().parents[2]


def _image_like(tmp_path: Path) -> Path:
    """The image layout: /app/src/noah/..., /app/db/migrations, /app/config."""
    app = tmp_path / "app"
    (app / "src" / "noah").mkdir(parents=True)
    (app / "db" / "migrations").mkdir(parents=True)
    (app / "config").mkdir()
    return app


def test_checkout_default_is_repository_root():
    assert paths.base_dir({}) == REPO
    assert paths.migrations_dir({}) == REPO / "db" / "migrations"
    assert paths.stations_config_path({}) == REPO / "config" / "stations.yaml"


def test_base_dir_env_override(tmp_path):
    env = {"NOAH_BASE_DIR": str(tmp_path)}
    assert paths.base_dir(env) == tmp_path
    assert paths.migrations_dir(env) == tmp_path / "db" / "migrations"
    assert paths.stations_config_path(env) == tmp_path / "config" / "stations.yaml"


def test_file_specific_overrides_win_over_base_dir(tmp_path):
    env = {
        "NOAH_BASE_DIR": str(tmp_path / "base"),
        "NOAH_MIGRATIONS_DIR": str(tmp_path / "m"),
        "NOAH_STATIONS_CONFIG": str(tmp_path / "s.yaml"),
    }
    assert paths.migrations_dir(env) == tmp_path / "m"
    assert paths.stations_config_path(env) == tmp_path / "s.yaml"


def test_blank_env_values_are_ignored():
    env = {"NOAH_BASE_DIR": "  ", "NOAH_MIGRATIONS_DIR": "", "NOAH_STATIONS_CONFIG": ""}
    assert paths.migrations_dir(env) == REPO / "db" / "migrations"


def test_image_layout_found_without_env(tmp_path):
    # In the image the package sits at /app/src/noah: two levels shallower than
    # in a checkout. The marker search must still find /app, not /.
    app = _image_like(tmp_path)
    start = app / "src" / "noah" / "paths.py"
    assert paths.base_dir({}, start=start) == app


def test_store_defaults_follow_noah_base_dir(tmp_path, monkeypatch):
    monkeypatch.delenv("NOAH_MIGRATIONS_DIR", raising=False)
    monkeypatch.delenv("NOAH_STATIONS_CONFIG", raising=False)
    monkeypatch.setenv("NOAH_BASE_DIR", str(tmp_path))
    assert default_migrations_dir() == tmp_path / "db" / "migrations"
    assert default_config_path() == tmp_path / "config" / "stations.yaml"


def test_copied_tree_loads_like_the_image(tmp_path, monkeypatch):
    # Copy what ml-service/Dockerfile copies and load it through NOAH_BASE_DIR.
    app = _image_like(tmp_path)
    for f in (REPO / "db" / "migrations").glob("*.sql"):
        (app / "db" / "migrations" / f.name).write_bytes(f.read_bytes())
    (app / "config" / "stations.yaml").write_bytes((REPO / "config" / "stations.yaml").read_bytes())
    monkeypatch.delenv("NOAH_MIGRATIONS_DIR", raising=False)
    monkeypatch.delenv("NOAH_STATIONS_CONFIG", raising=False)
    monkeypatch.setenv("NOAH_BASE_DIR", str(app))
    assert [m.path.parent for m in discover_migrations()] == [app / "db" / "migrations"] * len(
        list((REPO / "db" / "migrations").glob("*.sql"))
    )
    assert len(load_station_config().stations) > 0
