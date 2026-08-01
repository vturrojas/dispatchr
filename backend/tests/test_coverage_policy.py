import tomllib
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
BACKEND_CONFIG = REPOSITORY_ROOT / "backend" / "pyproject.toml"
CI_WORKFLOW = REPOSITORY_ROOT / ".github" / "workflows" / "tests.yml"
COVERAGE_COMMAND = "pytest -q --cov=app --cov-report=term-missing --cov-fail-under=80"


def test_backend_ci_enforces_coverage_gate_with_declared_plugin() -> None:
    project = tomllib.loads(BACKEND_CONFIG.read_text(encoding="utf-8"))
    dev_dependencies = project["project"]["optional-dependencies"]["dev"]
    workflow = CI_WORKFLOW.read_text(encoding="utf-8")

    assert "pytest-cov" in dev_dependencies
    assert COVERAGE_COMMAND in workflow
