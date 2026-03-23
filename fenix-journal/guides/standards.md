---
module: standards
title: Standards & Compliance
created: 2026-03-20
last_updated: 2026-03-20
version: 1
---

# Standards & Compliance

## Overview

Standards & Compliance is a real-time audit framework that scans all Command Center and portfolio site content against five compliance pillars: backend code quality, architecture patterns, content authenticity, content rules, and visual design consistency. The system generates a unified scorecard that aggregates all five pillars, identifies violations, and provides remediation guidance.

The core value: Standards ensures Kiran's portfolio maintains consistent quality and voice across all surfaces (code, content, design). Rather than relying on manual reviews, the audit runs automatically on startup and before deployment, surfacing regressions before they reach production.

The framework uses a three-level drill-down model: scorecard overview → pillar details → specific violations with remediation. A baseline system allows acknowledging known violations so only new regressions show, preventing false-positive noise.

## Architecture

### Core Service & Router

- **Service**: `backend/services/standards_service.py` contains audit logic for all five pillars
- **Router**: `backend/routers/standards.py` exposes REST endpoints

### Five Compliance Pillars

| Pillar | Focus | Examples |
|--------|-------|----------|
| **Backend** | Code quality, patterns, security | Type hints, error handling, API consistency, database query efficiency |
| **Architecture** | System design, dependencies, decoupling | Service boundaries, circular imports, config management, testing |
| **Authenticity** | Voice and personality consistency | First-person markers, honesty declarations, directness vs. sales tone |
| **Content** | Rule compliance, metadata accuracy | CONTENT-RULES.md violations (page types, required fields, SEO tags) |
| **Visual** | Design consistency and accessibility | Color palette adherence, typography scales, contrast ratios, component patterns |

### Pillar Audit Implementation

Each pillar runs independently and returns a score (0–100) plus a list of violations:

```python
def audit_backend_pillar():
    violations = []
    # Check for missing type hints in critical functions
    for func in all_functions():
        if not has_type_hints(func):
            violations.append({
                "level": "high",
                "location": f"{func.__module__}.{func.__name__}",
                "rule": "All public functions must have type hints",
                "remediation": f"Add type hints to {func.__name__}"
            })
    score = 100 - (len(violations) * penalty_per_violation)
    return {"score": score, "violations": violations}
```

Each violation includes:

- **level** — critical, high, medium, low
- **location** — file, line, or component name
- **rule** — which standard was violated
- **remediation** — specific fix instructions

### Scorecard Aggregation

The scorecard endpoint (`GET /api/standards/scorecard`) returns:

```json
{
  "overall_score": 87,
  "timestamp": "2026-03-20T14:30:00Z",
  "pillars": {
    "backend": {"score": 92, "violation_count": 3},
    "architecture": {"score": 88, "violation_count": 5},
    "authenticity": {"score": 79, "violation_count": 12},
    "content": {"score": 91, "violation_count": 2},
    "visual": {"score": 85, "violation_count": 4}
  },
  "trend": "improving"
}
```

The overall score is a weighted average of all five pillars.

### Pillar Details Endpoint

`GET /api/standards/pillars/{pillar_name}` returns full violation details:

```json
{
  "pillar": "content",
  "score": 91,
  "violations": [
    {
      "id": "content-001",
      "level": "high",
      "location": "/pages/teardown/react-auth.md",
      "rule": "Teardown pages must include 'Built With' section",
      "remediation": "Add a 'Built With' section listing technologies used",
      "fixable": true
    }
  ]
}
```

### Baseline & Ignore System

The baseline system allows Kiran to acknowledge known violations so they don't clutter the audit report:

- `POST /api/standards/baseline` — Snapshot all current violations as acknowledged
- `PATCH /api/standards/baseline/{violation_id}` — Manually acknowledge a single violation
- `GET /api/standards/baseline` — View all acknowledged violations

When a baseline is set:

- Audit still runs against all files (nothing is ignored)
- Only NEW violations (not in baseline) show in reports
- Baseline is timestamped and versioned (can revert or update)
- Useful for gradual cleanup without the report being noisy

### Auto-Remediation

Some violations can be automatically fixed. The `POST /api/standards/remediate/{violation_id}` endpoint:

- Accepts a `dry_run` parameter (default: true) to preview changes
- Shows exactly what will change (diff preview)
- Applies the fix if confirmed

Examples of auto-remediable violations:

- Missing type hints (scan function, infer from usage, add annotation)
- Unused imports (remove them)
- Missing YAML frontmatter on content pages (add template)
- Color values not matching palette (suggest correct value)

### Pre-Publish Check

The `POST /api/standards/check` endpoint validates a single file before deployment:

```bash
curl -X POST http://localhost:8000/api/standards/check \
  -H "Content-Type: application/json" \
  -d '{"file": "pages/teardown/react-auth.md"}'
```

Returns violations for that file only. Used as a pre-deploy gate in the Teardown Builder and WordWeaver workflows.

### Audit History

All audit runs are logged to `audit_history` table in Supabase:

- Timestamp of audit run
- Overall score
- Violations found
- Baseline applied (if any)
- User who triggered the audit

Enables trend tracking: Is the overall score improving or declining? Which pillars are getting worse?

## Key Decisions

### Five Pillars Over Binary Pass/Fail

Rather than a simple "pass/fail" check, five pillars give Kiran visibility into different failure modes. Backend code might be solid while authenticity is weak. A five-pillar score encourages balanced improvement across all dimensions.

### No Cached Audit Results

Audits run on every GET request (not cached). This ensures results are always fresh and reflects the current state of files. The tradeoff: 2–5 second response time for full audits. Acceptable because audits don't run on every page load, only when explicitly requested or before deployment.

### Baseline Prevents Alert Fatigue

Without a baseline, every audit after fixing violations would still show legacy violations. The baseline system says "I acknowledge these current issues; only alert me on NEW ones." This makes the audit actionable rather than demoralizing.

### Graduated Violation Levels

Violations have severity levels (critical, high, medium, low) rather of a flat list. Kiran can filter to show only critical issues or focus on addressing high-priority items first.

### Auto-Remediation with Dry-Run Defaults

Auto-remediation is opt-in (requires explicit confirmation) and defaults to `dry_run=true` so Kiran can preview changes. Only after reviewing the diff is the fix applied.

## Evolution

### Initial Launch (Feb 27, 2026)

Launched with Content pillar only:

- Scanned CONTENT-RULES.md violations (required fields, page metadata)
- No UI yet (backend-only)
- Manual dry-run for testing

### Phase 1 Expansion (Mar 5, 2026)

Added Backend and Architecture pillars:

- Type hints and function signature checks
- Circular import detection
- Service boundary validation
- Content Audit UI in dashboard

### Phase 2 Integration (Mar 17, 2026)

- Added Authenticity pillar (voice consistency checks)
- Integrated with notification service (standards_violation notifications)
- Implemented baseline system for managing known violations
- Pre-publish check endpoint used by Teardown Builder and WordWeaver

### System Startup Automation (Mar 20, 2026)

Task 1 added auto-audit on backend startup. Every time the Command Center backend launches, it runs the full audit and logs results. This ensures:

- Fresh audit data is always available
- Regressions are caught immediately if something breaks
- Baseline is automatically applied to avoid noise

Content governance rules consolidated from inline code into `governance_loader.py` for maintainability.

## Current State

### Fully Functional

- All five pillars auditing (backend, architecture, authenticity, content, visual)
- Real-time scorecard aggregation
- Violation-level drill-down with remediation guidance
- Baseline system for acknowledging known violations
- Auto-remediation with dry-run preview for fixable violations
- Pre-publish check endpoint (used before deploying teardowns and blog posts)
- Audit history tracking and trend analysis
- Startup automation (audit runs on backend launch)
- Notification integration (new violations trigger standards_violation notifications)

### Dashboard Integration

- Standards Overview page shows scorecard and pillar breakdown
- Pillar Detail pages list all violations with remediation instructions
- Baseline management UI for acknowledging violations

### Known Good Practices

- Violations are never silently ignored; baseline is explicit
- Remediation is always conservative (dry-run first, then confirm)
- Pre-publish checks prevent regressions from deploying

## Known Issues & Limitations

### Visual Pillar Accuracy

The Visual pillar relies on static analysis of CSS/Tailwind classes and color values. It may miss subtle design inconsistencies or accessibility issues that require human review (e.g., contrast ratios are checked, but nuanced visual balance is not).

**Workaround**: Combine Visual pillar results with periodic manual design review.

### Authenticity Pillar Subjectivity

The Authenticity pillar checks for markers like first-person pronouns and honesty declarations. It cannot deeply evaluate tone or personality fit. Some authentic content may flag as "not matching voice" if it uses unusual structure.

**Workaround**: Review flagged content manually. Can update rules if false positives are frequent.

### No Real-Time Updates

The scorecard updates when audits run (startup, explicit request), but doesn't auto-update when files change. If Kiran edits a file directly (not through Command Center), the audit won't reflect that until the next audit run.

**Future enhancement**: Watch file system for changes and trigger incremental audits.

### Architecture Pillar Limited Scope

Architecture pillar checks for circular imports and basic service decoupling but doesn't analyze deeper design concerns (e.g., command-query separation, event-driven patterns).

**Considerations**: Expand checks as patterns emerge in the codebase.

## Ideas & Future Direction

### Pillar Weighting

Allow Kiran to weight pillars differently. E.g., "Authenticity is more important than Backend, so weight it 40% instead of 20%." Encourages different teams or projects to have different standards.

### Custom Rules

Add a UI to define custom audit rules per pillar without modifying service code. E.g., "All blog posts must be >500 words" or "No external dependencies in the auth module."

### Audit Scheduling

Run audits on a schedule (e.g., daily at 9am) and email a summary. Useful for passive monitoring without actively checking the dashboard.

### Automated Fixes

Expand auto-remediation to handle more violation types (e.g., auto-add missing YAML frontmatter, auto-fix formatting).

### Per-File Ignores

Allow a file to opt out of specific audit rules via inline comments:

```markdown
<!-- standards-ignore: authenticity-first-person -->
This is auto-generated content, so first-person is not applicable.
```

### Audit Comparisons

Compare audits across time. Show a diff: "3 new violations, 5 fixed, overall score up 2%." Useful for quarterly reviews.

### Integration with CI/CD

Export audit results in a format consumable by GitHub Actions, so deployment can fail if audit score drops below a threshold.
