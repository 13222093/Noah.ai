import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))

from connector_helpers import fixture_bytes  # noqa: E402


@pytest.fixture
def s1_html() -> bytes:
    return fixture_bytes("s1_posko_banjir_20261102T1342Z.html")
