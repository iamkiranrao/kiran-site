"""Standards & Compliance Dashboard Router.

Replaces the separate content_audit and visual_audit routers with a
unified multi-pillar audit framework.

Endpoints:
  GET   /scorecard                   — Top-level scorecard across all pillars
  GET   /{pillar}/details            — Full drill-down for a single pillar
  POST  /{pillar}/remediate          — Auto-remediate fixable violations
  GET   /checks                      — List all registered checks
  GET   /checks/{pillar}             — List checks for a specific pillar
  GET   /history                     — Audit run history
  GET   /history/{pillar}            — Audit run history for a pillar
"""

from typing import Optional, List

from fastapi import APIRouter, Query

from models.standards import (
    BaselineAcknowledgeRequest,
    BaselineCheckResponse,
    BaselineSnapshot,
    Pillar,
    PillarDetail,
    RemediationRequest,
    RemediationResponse,
    Scorecard,
    Violation,
)
from services.standards_service import (
    acknowledge_violations,
    check_file,
    classify_violations,
    fingerprint_violation,
    generate_scorecard,
    get_audit_history,
    get_baseline_diff,
    get_registered_checks,
    load_baseline,
    remediate_pillar,
    remove_baseline_entry,
    run_pillar_audit,
    snapshot_baseline,
)
from utils.exceptions import NotFoundError, ValidationError

router = APIRouter()

VALID_PILLARS = {"backend", "architecture", "authenticity", "content", "visual"}


def _validate_pillar(pillar: str) -> Pillar:
    if pillar not in VALID_PILLARS:
        raise ValidationError(
            f"Invalid pillar: '{pillar}'. "
            f"Valid pillars: {', '.join(sorted(VALID_PILLARS))}"
        )
    return pillar


# ── Scorecard ──────────────────────────────────────────────────────

@router.get("/scorecard", response_model=Scorecard)
async def get_scorecard():
    """Top-level scorecard — dashboard landing view.

    Runs audits for all five pillars and returns aggregated scores,
    ratings, violation counts, and compliance tiers.
    """
    return generate_scorecard()


# ── Pillar Detail ──────────────────────────────────────────────────

@router.get("/{pillar}/details", response_model=PillarDetail)
async def get_pillar_details(pillar: str):
    """Full drill-down for a single pillar.

    Returns per-check results, per-file violations, scoring breakdown,
    and compliance tier. This is the second level of the three-level
    drill-down: scorecard → pillar details → remediation.
    """
    validated = _validate_pillar(pillar)
    return run_pillar_audit(validated)


# ── Remediation ────────────────────────────────────────────────────

@router.post("/{pillar}/remediate", response_model=RemediationResponse)
async def remediate(pillar: str, request: RemediationRequest):
    """Auto-remediate fixable violations for a pillar.

    Default: dry_run=True (shows what would change without applying).
    Set dry_run=False to apply fixes. Fixes are atomic file writes.

    Third level of the drill-down: scorecard → details → remediation.
    """
    validated = _validate_pillar(pillar)
    return remediate_pillar(validated, request)


# ── Baseline / Ignore-Defer System ─────────────────────────────────

@router.get("/baseline", response_model=dict)
async def get_baseline():
    """View current baseline with counts.

    Returns the current baseline snapshot with all acknowledged violations.
    """
    baseline = load_baseline()
    return {
        "count": len(baseline),
        "entries": {
            fp: entry.model_dump()
            for fp, entry in baseline.items()
        },
    }


@router.post("/baseline/snapshot", response_model=BaselineSnapshot)
async def snapshot_violations():
    """Capture all current violations as baseline (the 'acknowledge all' button).

    This snapshotting marks all 175+ current violations as acknowledged,
    so the dashboard will only highlight NEW regressions going forward.

    Returns the baseline snapshot that was created.
    """
    return snapshot_baseline()


@router.post("/baseline/acknowledge", response_model=dict)
async def acknowledge_specific_violations(request: BaselineAcknowledgeRequest):
    """Acknowledge specific violations by fingerprint.

    Args:
        fingerprints: List of violation fingerprints to acknowledge
        reason: Why these violations are being acknowledged
        status: "acknowledged" or "deferred"
        defer_until: ISO date string if status is "deferred"

    Returns:
        Count of entries added/updated in baseline
    """
    # Load current violations from full audit
    all_violations: List[Violation] = []
    all_file_reports = []

    for pillar in ["backend", "architecture", "authenticity", "content", "visual"]:
        detail = run_pillar_audit(pillar)
        for file_report in detail.file_reports:
            all_violations.extend(file_report.violations)
            all_file_reports.append(file_report)

    # Match fingerprints to violations
    violations_to_ack: List[Violation] = []
    for violation in all_violations:
        file_report = next(
            (fr for fr in all_file_reports if violation in fr.violations),
            None,
        )
        if not file_report:
            continue

        fp = fingerprint_violation(
            violation.check_id,
            file_report.relative_path,
            violation.evidence or violation.detail,
        )

        if fp in request.fingerprints:
            violations_to_ack.append(violation)

    count = acknowledge_violations(
        violations_to_ack,
        all_file_reports,
        request.reason,
        request.status,
        request.defer_until,
    )

    return {
        "acknowledged": count,
        "message": f"Acknowledged {count} violations",
    }


@router.delete("/baseline/{fingerprint}", response_model=dict)
async def remove_baseline_violation(fingerprint: str):
    """Un-acknowledge a violation (remove from baseline).

    Args:
        fingerprint: The fingerprint of the violation to remove

    Returns:
        Success status
    """
    removed = remove_baseline_entry(fingerprint)
    if not removed:
        raise NotFoundError(f"Baseline entry not found: {fingerprint}")
    return {"message": "Baseline entry removed"}


@router.get("/baseline/diff", response_model=dict)
async def get_baseline_drift():
    """Get stale baseline entries — entries no longer in current violations.

    Returns entries that are in the baseline but no longer found in the audit.
    These can be cleaned up to keep the baseline current.
    """
    stale = get_baseline_diff()
    return {
        "stale_count": len(stale),
        "entries": {
            fp: entry.model_dump()
            for fp, entry in stale.items()
        },
    }


# ── Pre-Publish Compliance Check ────────────────────────────────────

@router.post("/check", response_model=BaselineCheckResponse)
async def check_single_file(request: dict):
    """Check a single file before publishing.

    Body: {"file_path": "relative/path.html"}

    Runs all per-file checks against the file and returns violations
    grouped by pillar with a pass/fail verdict (fail if any critical).
    """
    if "file_path" not in request:
        raise ValidationError("Request must include 'file_path'")

    return check_file(request["file_path"])


@router.post("/check-batch", response_model=dict)
async def check_multiple_files(request: dict):
    """Check multiple files before publishing.

    Body: {"file_paths": ["path1.html", "path2.html"]}

    Returns results for each file with overall pass/fail.
    """
    if "file_paths" not in request:
        raise ValidationError("Request must include 'file_paths'")

    file_paths = request["file_paths"]
    if not isinstance(file_paths, list):
        raise ValidationError("'file_paths' must be a list")

    results = []
    overall_pass = True

    for file_path in file_paths:
        try:
            check_result = check_file(file_path)
            results.append({
                "file_path": file_path,
                "result": check_result.model_dump(),
            })
            if not check_result.pass_check:
                overall_pass = False
        except (NotFoundError, ValidationError) as e:
            results.append({
                "file_path": file_path,
                "error": str(e),
            })
            overall_pass = False

    return {
        "overall_pass": overall_pass,
        "files_checked": len(file_paths),
        "results": results,
    }


# ── Check Registry ─────────────────────────────────────────────────

@router.get("/checks", response_model=dict)
async def list_all_checks():
    """List all registered checks across all pillars."""
    checks = get_registered_checks()
    return {
        "total": len(checks),
        "checks": [c.model_dump() for c in checks],
    }


@router.get("/checks/{pillar}", response_model=dict)
async def list_pillar_checks(pillar: str):
    """List registered checks for a specific pillar."""
    validated = _validate_pillar(pillar)
    checks = get_registered_checks(validated)
    return {
        "pillar": validated,
        "total": len(checks),
        "checks": [c.model_dump() for c in checks],
    }


# ── Audit History ──────────────────────────────────────────────────

@router.get("/history", response_model=dict)
async def get_history(
    limit: int = Query(20, ge=1, le=100),
):
    """Get audit run history across all pillars."""
    runs = get_audit_history(limit=limit)
    return {"total": len(runs), "runs": runs}


@router.get("/history/{pillar}", response_model=dict)
async def get_pillar_history(
    pillar: str,
    limit: int = Query(20, ge=1, le=100),
):
    """Get audit run history for a specific pillar."""
    validated = _validate_pillar(pillar)
    runs = get_audit_history(pillar=validated, limit=limit)
    return {"pillar": validated, "total": len(runs), "runs": runs}
