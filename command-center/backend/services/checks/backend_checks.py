"""Backend Standards checks — BACKEND-STANDARDS.md enforcement.

Scans Python source files in the CC backend for pattern violations:
- Missing response_model on router endpoints
- Services importing from fastapi (wrong import direction)
- Non-atomic file writes in services
- Missing docstrings on endpoints
- Inline Pydantic models in router files
"""

import re
from pathlib import Path

from models.standards import CheckDefinition, Violation
from services.standards_service import register_check, SITE_ROOT

BACKEND_ROOT = SITE_ROOT / "command-center" / "backend"
ROUTERS_DIR = BACKEND_ROOT / "routers"
SERVICES_DIR = BACKEND_ROOT / "services"


def _get_python_files(directory: Path) -> list[Path]:
    """Get all .py files in a directory (non-recursive)."""
    if not directory.exists():
        return []
    return [f for f in directory.glob("*.py") if f.name != "__init__.py"]


# ── Check: Missing response_model ──────────────────────────────────

def _check_missing_response_model(file_path, html, visible_text):
    """Scan router files for endpoints missing response_model."""
    violations = []
    router_files = _get_python_files(ROUTERS_DIR)

    for rf in router_files:
        content = rf.read_text(encoding="utf-8")
        lines = content.split("\n")

        for i, line in enumerate(lines):
            # Match @router.get/post/put/delete/patch decorators
            match = re.match(
                r'\s*@router\.(get|post|put|delete|patch)\s*\(', line
            )
            if match:
                # Check if response_model is in the decorator args
                # Look at this line and the next few (decorator can span lines)
                decorator_block = "\n".join(lines[i:i+5])
                if "response_model" not in decorator_block:
                    # Skip streaming/file endpoints — they can't use response_model
                    # Look ahead up to the next decorator or end of file
                    end = min(i + 80, len(lines))
                    for j in range(i + 1, len(lines)):
                        if j > i and re.match(r'\s*@router\.(get|post|put|delete|patch)', lines[j]):
                            end = j
                            break
                    func_block = "\n".join(lines[i:end])
                    if "StreamingResponse" in func_block or "FileResponse" in func_block:
                        continue
                    method = match.group(1).upper()
                    violations.append(Violation(
                        check_id="be-response-model",
                        severity="warning",
                        location=f"{rf.name}:{i+1}",
                        detail=f"{method} endpoint missing response_model declaration",
                        evidence=line.strip(),
                        suggestion="Add response_model= to the decorator for OpenAPI docs and output validation",
                        auto_fixable=False,
                    ))

    return violations


register_check(
    CheckDefinition(
        id="be-response-model",
        pillar="backend",
        name="Missing response_model",
        description="Router endpoints should declare response_model for OpenAPI docs and output validation",
        severity_default="warning",
        method="static-analysis",
        remediation_difficulty="mechanical",
        standards_ref="BACKEND-STANDARDS.md §3",
    ),
    runner=_check_missing_response_model,
)


# ── Check: Service importing FastAPI ───────────────────────────────

def _check_service_fastapi_import(file_path, html, visible_text):
    """Scan service files for fastapi imports (wrong import direction)."""
    violations = []
    service_files = _get_python_files(SERVICES_DIR)

    for sf in service_files:
        content = sf.read_text(encoding="utf-8")
        lines = content.split("\n")

        for i, line in enumerate(lines):
            if re.match(r'\s*from\s+fastapi\s+import', line) or \
               re.match(r'\s*import\s+fastapi', line):
                violations.append(Violation(
                    check_id="be-service-fastapi-import",
                    severity="critical",
                    location=f"{sf.name}:{i+1}",
                    detail="Service imports from fastapi — services must not depend on HTTP framework",
                    evidence=line.strip(),
                    suggestion="Raise domain exceptions (NotFoundError, ValidationError) instead of HTTPException",
                    auto_fixable=False,
                ))

    return violations


register_check(
    CheckDefinition(
        id="be-service-fastapi-import",
        pillar="backend",
        name="Service imports FastAPI",
        description="Services must not import from fastapi — they raise domain exceptions, routers handle HTTP",
        severity_default="critical",
        method="static-analysis",
        remediation_difficulty="mechanical",
        standards_ref="BACKEND-STANDARDS.md §4",
    ),
    runner=_check_service_fastapi_import,
)


# ── Check: Non-atomic file writes ──────────────────────────────────

def _check_atomic_writes(file_path, html, visible_text):
    """Scan services for json.dump() without atomic write pattern."""
    violations = []
    service_files = _get_python_files(SERVICES_DIR)

    for sf in service_files:
        content = sf.read_text(encoding="utf-8")
        lines = content.split("\n")

        for i, line in enumerate(lines):
            # Look for json.dump that writes directly to the target file
            # The atomic pattern is: write to .tmp, then os.replace/rename
            if "json.dump(" in line and "tmp" not in line:
                # Check surrounding lines for atomic write pattern
                context = "\n".join(lines[max(0, i-3):i+4])
                if ".tmp" not in context and "os.replace" not in context and "os.rename" not in context and "rename" not in context:
                    violations.append(Violation(
                        check_id="be-atomic-write",
                        severity="warning",
                        location=f"{sf.name}:{i+1}",
                        detail="json.dump() without atomic write pattern (write to .tmp then rename)",
                        evidence=line.strip(),
                        suggestion="Write to a .tmp file first, then os.replace() to the target path",
                        auto_fixable=False,
                    ))

    return violations


register_check(
    CheckDefinition(
        id="be-atomic-write",
        pillar="backend",
        name="Non-atomic file writes",
        description="File writes should use write-to-tmp-then-rename pattern to prevent corruption",
        severity_default="warning",
        method="static-analysis",
        remediation_difficulty="mechanical",
        standards_ref="BACKEND-STANDARDS.md §9",
    ),
    runner=_check_atomic_writes,
)


# ── Check: Missing endpoint docstrings ─────────────────────────────

def _check_endpoint_docstrings(file_path, html, visible_text):
    """Scan router endpoints for missing docstrings."""
    violations = []
    router_files = _get_python_files(ROUTERS_DIR)

    for rf in router_files:
        content = rf.read_text(encoding="utf-8")
        lines = content.split("\n")

        i = 0
        while i < len(lines):
            # Find decorator
            match = re.match(
                r'\s*@router\.(get|post|put|delete|patch)\s*\(', lines[i]
            )
            if match:
                # Find the def line after the decorator(s)
                j = i + 1
                while j < len(lines) and (
                    lines[j].strip().startswith("@") or
                    lines[j].strip() == "" or
                    lines[j].strip().startswith(")")
                ):
                    j += 1

                if j < len(lines) and (lines[j].strip().startswith("def ") or
                   lines[j].strip().startswith("async def ")):
                    # Check for docstring in the next few lines
                    func_line = j
                    # Find end of function signature by tracking parentheses
                    k = func_line
                    paren_depth = 0
                    sig_started = False
                    while k < len(lines):
                        for ch in lines[k]:
                            if ch == "(":
                                paren_depth += 1
                                sig_started = True
                            elif ch == ")":
                                paren_depth -= 1
                        if sig_started and paren_depth == 0:
                            break
                        k += 1
                    k += 1  # Line after the closing ):
                    # Skip blank lines
                    while k < len(lines) and not lines[k].strip():
                        k += 1
                    if k < len(lines):
                        next_line = lines[k].strip()
                        if not next_line.startswith('"""') and not next_line.startswith("'''"):
                            func_name = re.search(r'def\s+(\w+)', lines[func_line])
                            name = func_name.group(1) if func_name else "unknown"
                            violations.append(Violation(
                                check_id="be-endpoint-docstring",
                                severity="info",
                                location=f"{rf.name}:{func_line+1}",
                                detail=f"Endpoint '{name}' missing docstring — these become OpenAPI descriptions",
                                evidence=lines[func_line].strip(),
                                suggestion="Add a docstring describing what the endpoint does",
                                auto_fixable=False,
                            ))
            i += 1

    return violations


register_check(
    CheckDefinition(
        id="be-endpoint-docstring",
        pillar="backend",
        name="Missing endpoint docstring",
        description="Router endpoints should have docstrings — they become OpenAPI operation descriptions",
        severity_default="info",
        method="static-analysis",
        remediation_difficulty="mechanical",
        standards_ref="BACKEND-STANDARDS.md §3",
    ),
    runner=_check_endpoint_docstrings,
)


# ── Check: Inline models in routers ────────────────────────────────

def _check_inline_models(file_path, html, visible_text):
    """Scan routers for Pydantic model definitions that should be in models/."""
    violations = []
    router_files = _get_python_files(ROUTERS_DIR)

    for rf in router_files:
        content = rf.read_text(encoding="utf-8")
        lines = content.split("\n")

        for i, line in enumerate(lines):
            # Look for class definitions that inherit from BaseModel
            match = re.match(r'\s*class\s+(\w+)\s*\(.*BaseModel.*\)', line)
            if match:
                class_name = match.group(1)
                violations.append(Violation(
                    check_id="be-inline-model",
                    severity="warning",
                    location=f"{rf.name}:{i+1}",
                    detail=f"Pydantic model '{class_name}' defined inline in router — move to models/",
                    evidence=line.strip(),
                    suggestion=f"Move '{class_name}' to models/{rf.stem}.py and import it",
                    auto_fixable=False,
                ))

    return violations


register_check(
    CheckDefinition(
        id="be-inline-model",
        pillar="backend",
        name="Inline Pydantic model in router",
        description="Pydantic models should live in models/, not inline in router files",
        severity_default="warning",
        method="static-analysis",
        remediation_difficulty="mechanical",
        standards_ref="BACKEND-STANDARDS.md §5",
    ),
    runner=_check_inline_models,
)
