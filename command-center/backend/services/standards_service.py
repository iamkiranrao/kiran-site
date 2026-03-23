"""Standards & Compliance Dashboard — Scoring engine and check runner.

This service replaces the standalone content_audit and visual_audit services
with a unified audit framework organized by pillar (backend, architecture,
authenticity, content, visual). Each pillar registers its own checks.

Phase 1 (this file): Framework — registry, runner, scorer, persistence.
Phase 2: Backend + Architecture check implementations.
Phase 3: Authenticity check implementations.
Phase 4: Content + Visual check implementations.

Services never import from FastAPI (per BACKEND-STANDARDS.md Section 6).
Domain exceptions are raised here, caught by the router/middleware layer.
"""

import hashlib
import json
import os
import re
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Optional, Tuple, Union, List

from utils.config import data_dir, get_logger
from utils.exceptions import NotFoundError, ValidationError

from models.standards import (
    AuditRunMeta,
    BaselineAcknowledgeRequest,
    BaselineCheckResponse,
    BaselineEntry,
    BaselineSnapshot,
    CheckDefinition,
    ComplianceTier,
    FileReport,
    Pillar,
    PillarDetail,
    PillarScore,
    RemediationRequest,
    RemediationResponse,
    RemediationResult,
    Scorecard,
    ScorecardEntry,
    Severity,
    Violation,
)

logger = get_logger(__name__)

# ── Site root ──────────────────────────────────────────────────────
SITE_ROOT = Path(__file__).resolve().parents[3]  # backend/services -> site root
STANDARDS_DATA = data_dir("standards")
RUNS_FILE = os.path.join(STANDARDS_DATA, "audit_runs.json")
BASELINE_FILE = os.path.join(STANDARDS_DATA, "baseline.json")

# Files to audit
AUDIT_GLOBS = [
    "*.html",
    "teardowns/*.html",
    "prototypes/**/overview.html",
    "prototypes/**/index.html",
    "blog/*.html",
]
SKIP_FILES = {"404.html", "sparkline-preview.html", "index.backup.html"}
SKIP_DIRS = {"node_modules", ".next", "coverage", "__pycache__", ".git"}

PILLAR_LABELS = {
    "backend": "Backend",
    "architecture": "Architecture",
    "authenticity": "Authenticity",
    "content": "Content",
    "visual": "Visual",
}


# ══════════════════════════════════════════════════════════════════════
# BASELINE / IGNORE-DEFER SYSTEM
# ══════════════════════════════════════════════════════════════════════

def fingerprint_violation(
    check_id: str,
    relative_path: str,
    evidence_or_detail: str = "",
) -> str:
    """Generate a deterministic fingerprint for a violation.

    Fingerprint is based on check_id, file path, and evidence.
    Used to match violations across runs and identify new regressions.

    Args:
        check_id: The check that produced the violation
        relative_path: File path relative to site root
        evidence_or_detail: The evidence or detail text from the violation

    Returns:
        12-character hex fingerprint
    """
    content = f"{check_id}|{relative_path}|{evidence_or_detail}"
    digest = hashlib.md5(content.encode()).hexdigest()
    return digest[:12]


def load_baseline() -> dict[str, BaselineEntry]:
    """Load the baseline file and return entries dict.

    Returns empty dict if file doesn't exist.
    """
    if not os.path.exists(BASELINE_FILE):
        return {}

    try:
        with open(BASELINE_FILE) as f:
            data = json.load(f)
        # Convert dicts to BaselineEntry objects
        entries = {}
        if "entries" in data and isinstance(data["entries"], dict):
            for fp, entry_dict in data["entries"].items():
                entries[fp] = BaselineEntry(**entry_dict)
        return entries
    except (json.JSONDecodeError, OSError, TypeError) as e:
        logger.warning("Failed to load baseline: %s", e)
        return {}


def save_baseline(entries: dict[str, BaselineEntry]) -> None:
    """Save the baseline file with given entries.

    Uses atomic write (write to temp, then rename).
    """
    now = datetime.now(timezone.utc).isoformat()

    # Load existing to get created_at
    existing = {}
    created_at = now
    if os.path.exists(BASELINE_FILE):
        try:
            with open(BASELINE_FILE) as f:
                data = json.load(f)
            created_at = data.get("created_at", now)
            existing = data.get("entries", {})
        except (json.JSONDecodeError, OSError):
            pass

    snapshot = BaselineSnapshot(
        version=1,
        created_at=created_at,
        updated_at=now,
        entries=entries,
    )

    os.makedirs(os.path.dirname(BASELINE_FILE), exist_ok=True)
    tmp_path = BASELINE_FILE + ".tmp"

    try:
        with open(tmp_path, "w") as f:
            json.dump(snapshot.model_dump(), f, indent=2)
        os.replace(tmp_path, BASELINE_FILE)
        logger.info("Saved baseline with %d entries", len(entries))
    except OSError as e:
        logger.error("Failed to save baseline: %s", e)
        raise


def snapshot_baseline() -> BaselineSnapshot:
    """Capture all current violations as acknowledged baseline.

    Runs full audit, generates fingerprints, and saves to baseline.
    Returns the baseline snapshot that was saved.
    """
    logger.info("Snapshotting baseline — capturing all current violations")

    # Run full audit
    now = datetime.now(timezone.utc).isoformat()
    entries: dict[str, BaselineEntry] = {}

    # Run each pillar audit
    for pillar in list(PILLAR_LABELS.keys()):
        detail = run_pillar_audit(pillar)

        # Extract violations from file reports
        for file_report in detail.file_reports:
            for violation in file_report.violations:
                fp = fingerprint_violation(
                    violation.check_id,
                    file_report.relative_path,
                    violation.evidence or violation.detail,
                )

                entries[fp] = BaselineEntry(
                    check_id=violation.check_id,
                    relative_path=file_report.relative_path,
                    severity=violation.severity,
                    detail=violation.detail,
                    status="acknowledged",
                    acknowledged_at=now,
                    defer_until=None,
                    reason="Baselined during initial snapshot",
                )

    save_baseline(entries)

    snapshot = BaselineSnapshot(
        version=1,
        created_at=now,
        updated_at=now,
        entries=entries,
    )
    logger.info("Baseline snapshot created with %d entries", len(entries))
    return snapshot


def acknowledge_violations(
    violations: List[Violation],
    file_reports: List[FileReport],
    reason: str,
    status: str = "acknowledged",
    defer_until: Optional[str] = None,
) -> int:
    """Acknowledge specific violations by fingerprint.

    Args:
        violations: List of violations to acknowledge
        file_reports: File reports for context
        reason: Why these violations are being acknowledged
        status: "acknowledged" or "deferred"
        defer_until: ISO date string if status is "deferred"

    Returns:
        Count of entries added/updated in baseline
    """
    baseline = load_baseline()
    now = datetime.now(timezone.utc).isoformat()
    count = 0

    for violation in violations:
        # Find the file report for this violation
        file_report = next(
            (fr for fr in file_reports if violation in fr.violations),
            None,
        )
        if not file_report:
            continue

        fp = fingerprint_violation(
            violation.check_id,
            file_report.relative_path,
            violation.evidence or violation.detail,
        )

        baseline[fp] = BaselineEntry(
            check_id=violation.check_id,
            relative_path=file_report.relative_path,
            severity=violation.severity,
            detail=violation.detail,
            status=status,
            acknowledged_at=now,
            defer_until=defer_until,
            reason=reason,
        )
        count += 1

    save_baseline(baseline)
    return count


def remove_baseline_entry(fingerprint: str) -> bool:
    """Remove a violation from the baseline (un-acknowledge).

    Args:
        fingerprint: The fingerprint to remove

    Returns:
        True if entry was removed, False if not found
    """
    baseline = load_baseline()
    if fingerprint in baseline:
        del baseline[fingerprint]
        save_baseline(baseline)
        logger.info("Removed baseline entry: %s", fingerprint)
        return True
    return False


def classify_violations(
    violations: List[Violation],
    file_reports: List[FileReport],
) -> Tuple[List[Violation], List[Violation]]:
    """Classify violations as new (not in baseline) vs baselined.

    Args:
        violations: All violations from current audit
        file_reports: File reports with file paths

    Returns:
        (new_violations, baselined_violations)
    """
    baseline = load_baseline()

    new_violations: List[Violation] = []
    baselined_violations: List[Violation] = []

    for violation in violations:
        # Find file report for this violation
        file_report = next(
            (fr for fr in file_reports if violation in fr.violations),
            None,
        )
        if not file_report:
            # Shouldn't happen, but treat as new
            new_violations.append(violation)
            continue

        fp = fingerprint_violation(
            violation.check_id,
            file_report.relative_path,
            violation.evidence or violation.detail,
        )

        if fp in baseline:
            baselined_violations.append(violation)
        else:
            new_violations.append(violation)

    return new_violations, baselined_violations


def get_baseline_diff() -> dict:
    """Get stale baseline entries — entries no longer found in current violations.

    Returns:
        Dict mapping fingerprint -> BaselineEntry for entries not in current audit
    """
    baseline = load_baseline()

    # Run full audit to get current violations
    all_violations: List[Violation] = []
    all_file_reports: List[FileReport] = []

    for pillar in list(PILLAR_LABELS.keys()):
        detail = run_pillar_audit(pillar)
        for file_report in detail.file_reports:
            all_violations.extend(file_report.violations)
            all_file_reports.append(file_report)

    # Find fingerprints in current audit
    current_fps = set()
    for violation in all_violations:
        file_report = next(
            (fr for fr in all_file_reports if violation in fr.violations),
            None,
        )
        if file_report:
            fp = fingerprint_violation(
                violation.check_id,
                file_report.relative_path,
                violation.evidence or violation.detail,
            )
            current_fps.add(fp)

    # Stale entries are in baseline but not in current audit
    stale: dict[str, BaselineEntry] = {}
    for fp, entry in baseline.items():
        if fp not in current_fps:
            stale[fp] = entry

    return stale


def check_file(file_path: str) -> BaselineCheckResponse:
    """Check a single file before publishing.

    Runs all per-file checks against a single file and returns violations
    grouped by pillar, with a pass/fail verdict (fail if any critical).

    Args:
        file_path: Relative path to file (e.g., "blog/post.html")

    Returns:
        BaselineCheckResponse with violations by pillar and pass/fail verdict
    """
    # Resolve file path
    abs_path = SITE_ROOT / file_path
    if not abs_path.exists():
        raise NotFoundError(f"File not found: {file_path}")

    # Read file
    try:
        html = abs_path.read_text(encoding="utf-8")
    except Exception as e:
        raise ValidationError(f"Failed to read file: {e}")

    visible_text = _extract_visible_text(html)

    # Get all per-file checks from all pillars
    checks = get_registered_checks()
    per_file_checks = [c for c in checks if c.method != "static-analysis" and c.enabled]

    # Run checks and group violations by pillar
    violations_by_pillar: dict[Pillar, List[Violation]] = {
        "backend": [],
        "architecture": [],
        "authenticity": [],
        "content": [],
        "visual": [],
    }

    has_critical = False

    for check in per_file_checks:
        runner = _check_runners.get(check.id)
        if not runner:
            continue

        try:
            violations = runner(str(abs_path), html, visible_text)
            for v in violations:
                violations_by_pillar[check.pillar].append(v)
                if v.severity == "critical":
                    has_critical = True
        except Exception as e:
            logger.warning(
                "Check %s failed on %s: %s", check.id, file_path, e
            )

    return BaselineCheckResponse(
        file_path=str(abs_path),
        relative_path=file_path,
        violations_by_pillar=violations_by_pillar,
        has_critical=has_critical,
        pass_check=not has_critical,
    )


# ══════════════════════════════════════════════════════════════════════
# CHECK REGISTRY
# ══════════════════════════════════════════════════════════════════════

# Maps pillar -> list of CheckDefinition
_check_registry: dict[str, list[CheckDefinition]] = {
    "backend": [],
    "architecture": [],
    "authenticity": [],
    "content": [],
    "visual": [],
}

# Maps check_id -> callable(file_path, html, visible_text) -> list[Violation]
_check_runners: dict[str, Callable] = {}

# Maps check_id -> callable(file_path, violations) -> list[RemediationResult]
_remediation_runners: dict[str, Callable] = {}


def register_check(
    definition: CheckDefinition,
    runner: Callable,
    remediator: Optional[Callable] = None,
) -> None:
    """Register a check with its runner and optional remediator.

    Called by each pillar's implementation module at import time.
    """
    pillar = definition.pillar
    if pillar not in _check_registry:
        raise ValidationError(f"Unknown pillar: {pillar}")

    _check_registry[pillar].append(definition)
    _check_runners[definition.id] = runner
    if remediator:
        _remediation_runners[definition.id] = remediator
    logger.info("Registered check: %s (%s pillar)", definition.id, pillar)


def get_registered_checks(pillar: Optional[Pillar] = None) -> list[CheckDefinition]:
    """Return all registered checks, optionally filtered by pillar."""
    if pillar:
        return _check_registry.get(pillar, [])
    return [c for checks in _check_registry.values() for c in checks]


# ══════════════════════════════════════════════════════════════════════
# FILE DISCOVERY
# ══════════════════════════════════════════════════════════════════════

def _get_site_files() -> list[dict]:
    """Find all auditable HTML files."""
    files = []
    for pattern in AUDIT_GLOBS:
        for path in SITE_ROOT.glob(pattern):
            if path.name in SKIP_FILES:
                continue
            # Skip files inside excluded directories
            path_parts = set(path.relative_to(SITE_ROOT).parts)
            if path_parts & SKIP_DIRS:
                continue
            rel = path.relative_to(SITE_ROOT)
            files.append({
                "path": str(path),
                "relative": str(rel),
                "name": path.name,
                "size": path.stat().st_size,
            })
    # Deduplicate
    seen = set()
    unique = []
    for f in files:
        if f["path"] not in seen:
            seen.add(f["path"])
            unique.append(f)
    return sorted(unique, key=lambda x: x["relative"])


def _extract_visible_text(html: str) -> str:
    """Strip HTML tags and extract visible text content."""
    html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL)
    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
    html = re.sub(r'<!--.*?-->', '', html, flags=re.DOTALL)
    text = re.sub(r'<[^>]+>', ' ', html)
    text = text.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    text = text.replace('&middot;', '·').replace('&mdash;', '—').replace('&ndash;', '–')
    text = text.replace('&larr;', '←').replace('&rarr;', '→').replace('&copy;', '©')
    text = re.sub(r'&#x[0-9a-fA-F]+;', '', text)
    text = re.sub(r'&#[0-9]+;', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


# ══════════════════════════════════════════════════════════════════════
# SCORING ENGINE
# ══════════════════════════════════════════════════════════════════════

def _count_severities(violations: list[Violation]) -> tuple[int, int, int]:
    """Return (critical, warning, info) counts."""
    c = sum(1 for v in violations if v.severity == "critical")
    w = sum(1 for v in violations if v.severity == "warning")
    i = sum(1 for v in violations if v.severity == "info")
    return c, w, i


def compute_score(
    violations: list[Violation],
    is_authenticity: bool = False,
) -> Union[PillarScore, Tuple[PillarScore, int, int]]:
    """Compute a pillar score from violations.

    For authenticity, splits into anti-ai and pro-kiran sub-scores.
    Anti-AI checks have IDs starting with 'auth-ai-'.
    Pro-Kiran checks have IDs starting with 'auth-kiran-'.

    Scoring formula (from AUTHENTICITY-STANDARDS.md §7):
      Score = 100 - (Critical × 15) - (Warning × 5) - (Info × 1)
      Final = min(Anti-AI, Pro-Kiran) for authenticity
    """
    critical, warning, info = _count_severities(violations)

    if is_authenticity:
        ai_violations = [v for v in violations if v.check_id.startswith("auth-ai-")]
        kiran_violations = [v for v in violations if v.check_id.startswith("auth-kiran-")]

        ai_c, ai_w, ai_i = _count_severities(ai_violations)
        kiran_c, kiran_w, _kiran_i = _count_severities(kiran_violations)

        anti_ai = max(0, 100 - (ai_c * 15) - (ai_w * 5) - (ai_i * 1))
        pro_kiran = max(0, 100 - (kiran_c * 15) - (kiran_w * 5))
        final = min(anti_ai, pro_kiran)

        return PillarScore(
            pillar="authenticity",
            score=final,
            anti_ai_score=anti_ai,
            pro_kiran_score=pro_kiran,
            rating=_score_to_rating(final),
            critical_count=critical,
            warning_count=warning,
            info_count=info,
            files_scanned=0,  # Caller fills in
            checks_run=0,
            checks_passed=0,
        )

    score = max(0, 100 - (critical * 15) - (warning * 5) - (info * 1))
    return PillarScore(
        pillar="backend",  # Caller overrides
        score=score,
        rating=_score_to_rating(score),
        critical_count=critical,
        warning_count=warning,
        info_count=info,
        files_scanned=0,
        checks_run=0,
        checks_passed=0,
    )


def _score_to_rating(score: int) -> str:
    """Convert numeric score to rating label."""
    if score >= 90:
        return "Authentic"
    elif score >= 75:
        return "Review"
    elif score >= 60:
        return "Remediate"
    return "Rewrite"


def _determine_compliance_tier(
    score: int,
    critical_count: int,
    warning_count: int,
) -> ComplianceTier:
    """Assign compliance tier per AUTHENTICITY-STANDARDS.md §7."""
    if score >= 90 and critical_count == 0 and warning_count == 0:
        return "best-in-class"
    elif score >= 75 and critical_count == 0 and warning_count < 3:
        return "quality"
    elif score >= 60 and critical_count == 0:
        return "ship"
    return "ship"  # Below ship threshold, but "ship" is the lowest named tier


# ══════════════════════════════════════════════════════════════════════
# CHECK RUNNER
# ══════════════════════════════════════════════════════════════════════

def run_pillar_audit(pillar: Pillar) -> PillarDetail:
    """Run all registered checks for a pillar across all site files.

    Returns a full PillarDetail with per-file reports and scoring.
    """
    checks = _check_registry.get(pillar, [])
    enabled_checks = [c for c in checks if c.enabled]

    if not enabled_checks:
        # No checks registered yet — return empty report
        return PillarDetail(
            pillar=pillar,
            pillar_label=PILLAR_LABELS[pillar],
            score=PillarScore(
                pillar=pillar,
                score=100,
                rating="Authentic",
                files_scanned=0,
                checks_run=0,
                checks_passed=0,
            ),
            checks=checks,
            file_reports=[],
            compliance_tier=None,
            generated_at=datetime.now(timezone.utc).isoformat(),
        )

    start = time.monotonic()
    files = _get_site_files()
    all_violations: list[Violation] = []
    file_reports: list[FileReport] = []

    # Split checks into static-analysis (run once, scan source directly)
    # vs per-file checks (run against each HTML file)
    static_checks = [c for c in enabled_checks if c.method == "static-analysis"]
    per_file_checks = [c for c in enabled_checks if c.method != "static-analysis"]

    # Run static-analysis checks once (they scan Python source internally)
    static_violations: list[Violation] = []
    for check in static_checks:
        runner = _check_runners.get(check.id)
        if not runner:
            continue
        try:
            violations = runner(None, "", "")
            static_violations.extend(violations)
        except Exception as e:
            logger.warning("Static check %s failed: %s", check.id, e)
    all_violations.extend(static_violations)

    # If there are only static checks, create a single summary report
    if static_violations and not per_file_checks:
        c, w, i = _count_severities(static_violations)
        file_reports.append(FileReport(
            file_path="(source analysis)",
            relative_path="(source analysis)",
            word_count=0,
            violations=static_violations,
            critical_count=c,
            warning_count=w,
            info_count=i,
        ))

    # Run per-file checks against each HTML file
    for f in files:
        file_path = f["path"]
        try:
            html = Path(file_path).read_text(encoding="utf-8")
        except Exception as e:
            logger.warning("Failed to read %s: %s", file_path, e)
            continue

        visible_text = _extract_visible_text(html)
        word_count = len(visible_text.split())

        file_violations: list[Violation] = []
        for check in per_file_checks:
            runner = _check_runners.get(check.id)
            if not runner:
                continue
            try:
                violations = runner(file_path, html, visible_text)
                file_violations.extend(violations)
            except Exception as e:
                logger.warning(
                    "Check %s failed on %s: %s", check.id, file_path, e
                )

        c, w, i = _count_severities(file_violations)
        file_reports.append(FileReport(
            file_path=file_path,
            relative_path=f["relative"],
            word_count=word_count,
            violations=file_violations,
            critical_count=c,
            warning_count=w,
            info_count=i,
        ))
        all_violations.extend(file_violations)

    # Score — per-file averaging for pillars with per-file checks,
    # legacy aggregate for static-only pillars (backend, architecture).
    is_auth = pillar == "authenticity"
    critical, warning, info = _count_severities(all_violations)

    per_file_reports = [fr for fr in file_reports
                        if fr.relative_path != "(source analysis)"]

    if per_file_reports:
        # Per-file averaging: score each file individually, then average.
        # This prevents one SVG-heavy page from tanking the whole pillar.
        file_scores = []
        for fr in per_file_reports:
            fs = max(0, 100 - (fr.critical_count * 15)
                     - (fr.warning_count * 5) - (fr.info_count * 1))
            file_scores.append(fs)

        # Include clean files (scanned but 0 violations) as 100
        clean_file_count = len(files) - len(per_file_reports)
        file_scores.extend([100] * clean_file_count)

        avg_score = round(sum(file_scores) / len(file_scores)) if file_scores else 100

        if is_auth:
            # For authenticity, still use the dual-score approach but per-file
            pillar_score = compute_score(all_violations, is_authenticity=True)
            # Override with per-file average if it's higher (less punitive)
            pillar_score.score = max(pillar_score.score, avg_score)
            pillar_score.rating = _score_to_rating(pillar_score.score)
        else:
            pillar_score = PillarScore(
                pillar=pillar,
                score=avg_score,
                rating=_score_to_rating(avg_score),
                critical_count=critical,
                warning_count=warning,
                info_count=info,
                files_scanned=0,
                checks_run=0,
                checks_passed=0,
            )
    else:
        # Static-only pillar (backend, architecture) — use aggregate
        pillar_score = compute_score(all_violations, is_authenticity=is_auth)

    pillar_score.pillar = pillar
    pillar_score.files_scanned = len(files)
    pillar_score.checks_run = len(enabled_checks)
    pillar_score.checks_passed = len(enabled_checks) - len(
        {v.check_id for v in all_violations}
    )

    tier = _determine_compliance_tier(
        pillar_score.score,
        pillar_score.critical_count,
        pillar_score.warning_count,
    )

    elapsed_ms = int((time.monotonic() - start) * 1000)
    generated_at = datetime.now(timezone.utc).isoformat()

    # Persist run metadata
    _save_audit_run(AuditRunMeta(
        id=uuid.uuid4().hex[:8],
        pillar=pillar,
        started_at=generated_at,
        completed_at=generated_at,
        duration_ms=elapsed_ms,
        files_scanned=len(files),
        checks_run=len(enabled_checks),
        total_violations=len(all_violations),
        score=pillar_score.score,
        rating=pillar_score.rating,
    ))

    # Classify violations as new vs baselined
    new_vios, baselined_vios = classify_violations(all_violations, file_reports)

    # Push notification if new violations found (especially criticals)
    new_count = len(new_vios)
    if new_count > 0 or pillar_score.critical_count > 0:
        try:
            from services.notification_service import notify_standards_violation
            notify_standards_violation(
                pillar=pillar,
                new_violations=new_count,
                critical_count=pillar_score.critical_count,
                score=pillar_score.score,
            )
        except Exception as e:
            logger.warning("Failed to send standards notification: %s", e)

    return PillarDetail(
        pillar=pillar,
        pillar_label=PILLAR_LABELS[pillar],
        score=pillar_score,
        checks=checks,
        file_reports=file_reports,
        new_violations=len(new_vios),
        baselined_violations=len(baselined_vios),
        compliance_tier=tier,
        generated_at=generated_at,
    )


# ══════════════════════════════════════════════════════════════════════
# SCORECARD
# ══════════════════════════════════════════════════════════════════════

def generate_scorecard(pillars: Optional[list[Pillar]] = None) -> Scorecard:
    """Generate the top-level scorecard across all (or selected) pillars.

    Runs audits for each pillar and aggregates into a single scorecard.
    """
    if pillars is None:
        pillars = list(PILLAR_LABELS.keys())

    entries: list[ScorecardEntry] = []
    total_files = 0
    total_checks = 0
    total_violations = 0

    for pillar in pillars:
        detail = run_pillar_audit(pillar)
        last_run = _get_last_run(pillar)

        entries.append(ScorecardEntry(
            pillar=pillar,
            pillar_label=PILLAR_LABELS[pillar],
            score=detail.score.score,
            rating=detail.score.rating,
            critical_count=detail.score.critical_count,
            warning_count=detail.score.warning_count,
            info_count=detail.score.info_count,
            new_violations=detail.new_violations,
            baselined_violations=detail.baselined_violations,
            compliance_tier=detail.compliance_tier,
            last_run=last_run,
        ))

        total_files += detail.score.files_scanned
        total_checks += detail.score.checks_run
        total_violations += (
            detail.score.critical_count
            + detail.score.warning_count
            + detail.score.info_count
        )

    # Overall = weighted average of pillar scores (equal weight for now)
    if entries:
        overall = sum(e.score for e in entries) // len(entries)
    else:
        overall = 100

    return Scorecard(
        overall_score=overall,
        overall_rating=_score_to_rating(overall),
        pillars=entries,
        generated_at=datetime.now(timezone.utc).isoformat(),
        files_scanned=total_files,
        total_checks_run=total_checks,
        total_violations=total_violations,
    )


# ══════════════════════════════════════════════════════════════════════
# REMEDIATION
# ══════════════════════════════════════════════════════════════════════

def remediate_pillar(
    pillar: Pillar,
    request: RemediationRequest,
) -> RemediationResponse:
    """Run auto-remediation for a pillar's fixable violations.

    1. Run the audit to get current violations
    2. Filter to auto-fixable violations
    3. Run each check's remediator
    4. If dry_run=False, apply the fixes via atomic file writes
    """
    detail = run_pillar_audit(pillar)

    fixable: list[Violation] = []
    for report in detail.file_reports:
        for v in report.violations:
            if v.auto_fixable:
                if request.violation_ids is None or v.location in request.violation_ids:
                    fixable.append(v)

    results: list[RemediationResult] = []
    for v in fixable:
        remediator = _remediation_runners.get(v.check_id)
        if not remediator:
            continue

        try:
            remediation_results = remediator(v)
            for r in remediation_results:
                r.applied = not request.dry_run
                results.append(r)

                # Apply if not dry run
                if not request.dry_run and r.file_path:
                    _apply_fix(r)
        except Exception as e:
            logger.warning("Remediation failed for %s: %s", v.check_id, e)

    return RemediationResponse(
        pillar=pillar,
        dry_run=request.dry_run,
        fixes_available=len(fixable),
        fixes_applied=sum(1 for r in results if r.applied),
        results=results,
    )


def _apply_fix(result: RemediationResult) -> None:
    """Apply a single remediation fix with atomic file write.

    Per BACKEND-STANDARDS.md: write to temp file, then rename.
    """
    path = Path(result.file_path)
    if not path.exists():
        return

    content = path.read_text(encoding="utf-8")
    if result.original not in content:
        logger.warning(
            "Original text not found in %s, skipping fix", result.file_path
        )
        return

    updated = content.replace(result.original, result.replacement, 1)

    # Atomic write: write to temp, rename
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_text(updated, encoding="utf-8")
    tmp_path.rename(path)


# ══════════════════════════════════════════════════════════════════════
# PERSISTENCE — Audit run history
# ══════════════════════════════════════════════════════════════════════

def _load_audit_runs() -> list[dict]:
    """Load audit run history from JSON."""
    if not os.path.exists(RUNS_FILE):
        return []
    try:
        with open(RUNS_FILE) as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return []


def _save_audit_run(run: AuditRunMeta) -> None:
    """Append an audit run to the history file."""
    runs = _load_audit_runs()
    runs.append(run.model_dump())
    # Keep last 100 runs per pillar (500 total max)
    if len(runs) > 500:
        runs = runs[-500:]

    os.makedirs(os.path.dirname(RUNS_FILE), exist_ok=True)
    tmp_path = RUNS_FILE + ".tmp"
    with open(tmp_path, "w") as f:
        json.dump(runs, f, indent=2)
    os.replace(tmp_path, RUNS_FILE)


def _get_last_run(pillar: Pillar) -> Optional[str]:
    """Get the timestamp of the last audit run for a pillar."""
    runs = _load_audit_runs()
    pillar_runs = [r for r in runs if r.get("pillar") == pillar]
    if pillar_runs:
        return pillar_runs[-1].get("completed_at")
    return None


def get_audit_history(
    pillar: Optional[Pillar] = None,
    limit: int = 20,
) -> list[dict]:
    """Get audit run history, optionally filtered by pillar."""
    runs = _load_audit_runs()
    if pillar:
        runs = [r for r in runs if r.get("pillar") == pillar]
    return runs[-limit:]


# ══════════════════════════════════════════════════════════════════════
# AUTO-REGISTER CHECKS — Must be at the bottom of this module so all
# registry functions are defined before check modules call register_check().
# ══════════════════════════════════════════════════════════════════════

import services.checks  # noqa: E402, F401 — triggers registration of all checks
