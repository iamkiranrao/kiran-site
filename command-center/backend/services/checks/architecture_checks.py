"""Architecture Standards checks — ARCHITECTURE.md enforcement.

Scans the codebase for architectural pattern violations:
- Wrong import direction (routers→services→models→utils only)
- Config values not using utils/config.py
- Hardcoded API keys or model names
"""

import re
from pathlib import Path

from models.standards import CheckDefinition, Violation
from services.standards_service import register_check, SITE_ROOT

BACKEND_ROOT = SITE_ROOT / "command-center" / "backend"


def _get_python_files(directory: Path) -> list[Path]:
    if not directory.exists():
        return []
    return [f for f in directory.glob("*.py") if f.name != "__init__.py"]


# ── Check: Wrong import direction ──────────────────────────────────

def _check_import_direction(file_path, html, visible_text):
    """Enforce import direction: routers→services→models→utils. Never reverse."""
    violations = []

    # Models should not import from services or routers
    models_dir = BACKEND_ROOT / "models"
    for mf in _get_python_files(models_dir):
        content = mf.read_text(encoding="utf-8")
        for i, line in enumerate(content.split("\n")):
            if re.match(r'\s*from\s+(services|routers)\s', line) or \
               re.match(r'\s*import\s+(services|routers)', line):
                violations.append(Violation(
                    check_id="arch-import-direction",
                    severity="critical",
                    location=f"models/{mf.name}:{i+1}",
                    detail=f"Model file imports from services/routers — violates import direction",
                    evidence=line.strip(),
                    suggestion="Models import from nothing (or other models and utils). Restructure the dependency.",
                    auto_fixable=False,
                ))

    # Utils should not import from services, routers, or models
    utils_dir = BACKEND_ROOT / "utils"
    for uf in _get_python_files(utils_dir):
        content = uf.read_text(encoding="utf-8")
        for i, line in enumerate(content.split("\n")):
            if re.match(r'\s*from\s+(services|routers|models)\s', line) or \
               re.match(r'\s*import\s+(services|routers|models)', line):
                violations.append(Violation(
                    check_id="arch-import-direction",
                    severity="critical",
                    location=f"utils/{uf.name}:{i+1}",
                    detail=f"Utils file imports from services/routers/models — violates import direction",
                    evidence=line.strip(),
                    suggestion="Utils import from nothing. Move the dependency or restructure.",
                    auto_fixable=False,
                ))

    # Services should not import from routers
    services_dir = BACKEND_ROOT / "services"
    for sf in _get_python_files(services_dir):
        content = sf.read_text(encoding="utf-8")
        for i, line in enumerate(content.split("\n")):
            if re.match(r'\s*from\s+routers\s', line) or \
               re.match(r'\s*import\s+routers', line):
                violations.append(Violation(
                    check_id="arch-import-direction",
                    severity="critical",
                    location=f"services/{sf.name}:{i+1}",
                    detail=f"Service imports from routers — violates import direction",
                    evidence=line.strip(),
                    suggestion="Services import from models and utils only. Never from routers.",
                    auto_fixable=False,
                ))

    return violations


register_check(
    CheckDefinition(
        id="arch-import-direction",
        pillar="architecture",
        name="Wrong import direction",
        description="Import direction must be routers→services→models→utils. Never reverse.",
        severity_default="critical",
        method="static-analysis",
        remediation_difficulty="mechanical",
        standards_ref="BACKEND-STANDARDS.md §2",
    ),
    runner=_check_import_direction,
)


# ── Check: Hardcoded model names ───────────────────────────────────

def _check_hardcoded_model(file_path, html, visible_text):
    """Scan for hardcoded Claude model names instead of using config.CLAUDE_MODEL."""
    violations = []
    dirs = [BACKEND_ROOT / "services", BACKEND_ROOT / "routers"]

    for d in dirs:
        for pf in _get_python_files(d):
            content = pf.read_text(encoding="utf-8")
            lines = content.split("\n")

            for i, line in enumerate(lines):
                # Look for hardcoded model strings
                if re.search(r'["\']claude-(sonnet|opus|haiku)-', line) and \
                   "CLAUDE_MODEL" not in line and "config" not in line.lower():
                    violations.append(Violation(
                        check_id="arch-hardcoded-model",
                        severity="warning",
                        location=f"{pf.parent.name}/{pf.name}:{i+1}",
                        detail="Hardcoded Claude model name — use config.CLAUDE_MODEL",
                        evidence=line.strip(),
                        suggestion="Import CLAUDE_MODEL from utils.config and reference it",
                        auto_fixable=False,
                    ))

    return violations


register_check(
    CheckDefinition(
        id="arch-hardcoded-model",
        pillar="architecture",
        name="Hardcoded Claude model name",
        description="Claude model names should use config.CLAUDE_MODEL, not hardcoded strings",
        severity_default="warning",
        method="static-analysis",
        remediation_difficulty="auto",
        standards_ref="BACKEND-STANDARDS.md §8",
    ),
    runner=_check_hardcoded_model,
)


# ── Check: Hardcoded API keys ──────────────────────────────────────

def _check_hardcoded_keys(file_path, html, visible_text):
    """Scan for hardcoded API keys or secrets in source code."""
    violations = []
    dirs = [
        BACKEND_ROOT / "services",
        BACKEND_ROOT / "routers",
        BACKEND_ROOT / "utils",
    ]

    for d in dirs:
        for pf in _get_python_files(d):
            content = pf.read_text(encoding="utf-8")
            lines = content.split("\n")

            for i, line in enumerate(lines):
                # Skip comments
                stripped = line.strip()
                if stripped.startswith("#"):
                    continue

                # Look for patterns that suggest hardcoded secrets
                if re.search(r'sk-ant-[a-zA-Z0-9]', line):
                    violations.append(Violation(
                        check_id="arch-hardcoded-key",
                        severity="critical",
                        location=f"{pf.parent.name}/{pf.name}:{i+1}",
                        detail="Possible hardcoded API key detected",
                        evidence="[REDACTED — potential secret]",
                        suggestion="Use environment variables via utils.config.resolve_api_key()",
                        auto_fixable=False,
                    ))

    return violations


register_check(
    CheckDefinition(
        id="arch-hardcoded-key",
        pillar="architecture",
        name="Hardcoded API key",
        description="API keys must come from environment variables, never hardcoded in source",
        severity_default="critical",
        method="static-analysis",
        remediation_difficulty="mechanical",
        standards_ref="BACKEND-STANDARDS.md §11",
    ),
    runner=_check_hardcoded_keys,
)
