"""Guardrail 13 / F12: GPL test tools stay out of shipped code and the image."""

from __future__ import annotations

import re
from pathlib import Path

ML = Path(__file__).resolve().parents[1]
GPL_DEV_ONLY = ("pglast",)


def test_gpl_dev_tools_not_imported_by_application_code():
    pattern = re.compile(r"^\s*(?:import|from)\s+(" + "|".join(GPL_DEV_ONLY) + r")\b", re.M)
    offenders = [str(p.relative_to(ML)) for p in (ML / "src").rglob("*.py") if pattern.search(p.read_text("utf-8"))]
    assert offenders == []


def test_gpl_dev_tools_not_in_runtime_requirements():
    names = {
        re.split(r"[\[=<>~!; ]", line.strip(), maxsplit=1)[0].lower()
        for line in (ML / "requirements.txt").read_text("utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith(("#", "-"))
    }
    assert not names & set(GPL_DEV_ONLY)


def test_runtime_requirements_are_pinned():
    for line in (ML / "requirements.txt").read_text("utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith(("#", "-")):
            assert re.search(r"==\d", line), f"unpinned requirement: {line}"
