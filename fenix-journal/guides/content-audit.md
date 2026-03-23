---
module: content-audit
title: Content Audit Module (RETIRED)
created: 2026-03-11
last_updated: 2026-03-21
version: 1.1
status: retired
retired_reason: "Module absorbed into Standards & Compliance. All content audit functionality is now part of the Standards dashboard."
redirect: standards
---

# Content Audit Module (RETIRED)

> **This module has been retired.** Its functionality was absorbed into the **Standards & Compliance** module during the March 2026 system consolidation. See the [Standards & Compliance guide](standards.md) for current documentation.

## Overview

The Content Audit module is an automated quality assurance system that scans all site content against a set of editorial rules defined in CONTENT-RULES.md. It extracts visible text from HTML files, invokes Claude to audit content violations, and reports findings with severity levels and suggested corrections. The system is designed to enforce Kiran's voice and accuracy standards across the portfolio site, catching linguistic inconsistencies, jargon, technical posturing, and unverifiable claims before they're published.

## Architecture

The module consists of three main components: the rule definition file, the audit service that coordinates scanning, and the API router that exposes audit endpoints through the Command Center backend.

### Backend Stack

**Content Rules File** (`CONTENT-RULES.md` at site root)
- Defines editorial standards and principles Kiran wants enforced across his site
- Categories include: Jargon, AI-sounding language, Technical posturing, Passive voice, Lofty abstraction, Unverifiable numbers, Filler qualifiers
- Used as the system prompt context for Claude's audit process

**Content Audit Service** (`services/content_audit_service.py`)
- Discovers all auditable HTML files using glob patterns: `*.html`, `teardowns/*.html`, `prototypes/**/overview.html`, `prototypes/**/index.html`
- Extracts visible text from HTML by stripping tags, scripts, styles, and HTML comments
- Handles HTML entity decoding (common entities like &amp;, &mdash;, and numeric emoji codes)
- Invokes Claude API with the file content and rules, receives JSON array of violations
- Parses violations with fields: text (exact quote), rule (which rule violated), severity (high/medium/low), suggestion (replacement)
- Tracks word count for each page and truncates very long pages (>4000 words) for API efficiency

**Content Audit Router** (`routers/content_audit.py`)
- `GET /rules` — Returns the current CONTENT-RULES.md contents
- `GET /files` — Lists all auditable site files with metadata (path, relative path, name, size)
- `POST /audit` — Audits a single file against the rules, returns violation list
- `POST /audit-all` — Full site scan across all files, returns summary + per-file results
- `GET /preview/{file_path}` — Extracts and returns visible text from a file (what Claude sees during audit)

### Supabase Integration

Currently the module does not persist audit results to Supabase. Audits are run on-demand via the API and results are returned directly. A future version could store audit history for trending and regression detection.

### Frontend Integration

The Command Center dashboard includes audit features accessible via the API but the UI for viewing audit results is not fully detailed in the implementation. The backend is ready for a frontend dashboard tab (similar to the pattern used for Feedback & Fenix Dashboard).

### API Authentication

Audit endpoints accept an optional `X-Claude-Key` header for API key injection, allowing flexibility in key management. Falls back to environment variables if header is not provided.

## Key Decisions

**Claude-Powered Semantic Auditing**
Chosen to use Claude for auditing rather than rule-based regex patterns. Rationale: Editorial violations are semantic and contextual. A rule-based approach would miss nuance (e.g., passive voice is sometimes correct, but overuse signals weak writing; technical jargon is sometimes necessary, but excessive use is a problem). Claude can read the rules, see the context, and make judgment calls about severity.

**Rule Extraction via Text Processing**
HTML text extraction uses regex and entity decoding rather than a full HTML parser. Keeps dependencies light and covers the common cases. Edge cases with complex nested HTML might be missed, but the truncation at 4000 words ensures API calls stay within token budgets.

**Per-File Auditing**
The design supports both single-file and full-site audits. Single-file allows fast feedback during content editing. Full-site audits provide holistic quality checks. Both return the same violation schema for consistency.

**Severity Levels**
Violations are tagged as high (definitely wrong), medium (borderline), or low (minor style). Allows Kiran to triage quickly in the dashboard and focus on blocking issues first.

**Skip List**
Certain files are excluded from audits (404.html, sparkline-preview.html, index.backup.html) to avoid noise on auto-generated or temporary files.

## Evolution

**Session: 2026-03-05 (Fenix Phase 1 Validation)**
The Content Audit module was mentioned in the context of Phase 1 validation. Notes indicate that Phase 1 included a Content Audit subsystem, and the module was tested end-to-end: run against all site files, captured 86 content violations and 1,701 visual violations (likely from a parallel visual audit system). Status was marked as "diagnostic only for now" with low priority on the UI.

**Session: 2026-02-27 (Portfolio Work Translation)**
High-level discussion about translating portfolio work into tangible outcomes. Audit module was not specifically mentioned but the broader theme of quality and consistency across site content was relevant.

**Session: 2026-02-25 (Finishing Content Population)**
While populating the MadLab and Studio pages, no explicit mention of the audit system, but the freshly created content would be candidates for audit once the module is fully operational.

## Current State

**What works:**
- File discovery via glob patterns correctly identifies auditable files
- HTML text extraction handles common entities and strips tags cleanly
- Claude-powered audit invocation works end-to-end
- Violation JSON parsing handles both bare JSON and markdown code blocks
- API endpoints are defined and callable
- Per-file and full-site audit modes both functional

**What's partial/incomplete:**
- Frontend dashboard for viewing audit results not yet built
- Audit history not persisted to Supabase (results are ephemeral)
- Full-site audits are slow because they call Claude sequentially for each file (no parallelization)
- No integration with deployment pipeline (audits are manual, not required before publish)
- Rules file (CONTENT-RULES.md) exists but may not be complete or regularly updated

## Known Issues & Limitations

**Performance at Scale**
Full-site audits invoke Claude once per file. With 50+ files, this is slow and expensive. Should be parallelized or moved to a background job with caching.

**Rules Maintenance**
CONTENT-RULES.md is a static file. Rules can drift or become inconsistent with Kiran's actual preferences. No versioning or approval workflow for rule changes.

**Wordcount Truncation**
Very long pages are truncated at 4000 words to fit API budgets. Violations in the truncated tail are missed. Should implement sliding-window or multi-pass approach for comprehensive audits.

**False Positives**
Claude may flag violations that are intentionally correct (e.g., technical terms used properly, passive voice in appropriate contexts). Requires manual review and suppression mechanism.

**No Suppression Mechanism**
Once a violation is flagged, there's no way to mark it as "reviewed and intentional" without removing the content. Future versions should support suppression annotations (e.g., `<!-- audit: suppress "jargon" -->`) to reduce noise on repeated audits.

**Limited Rule Categories**
Rules are text-based and limited to common writing issues. Domain-specific rules (e.g., "never use real client names without permission") are not supported.

## Ideas & Future Direction

**Audit History & Trending**
Persist audit results to Supabase with timestamps. Build a dashboard showing violation trends: are violations increasing or decreasing? which rules are most commonly violated? which pages are most problematic?

**Deployment Integration**
Add pre-publish checks: require a full-site audit to pass before deploying to production. Fail fast on high-severity violations, warn on medium, allow low-severity to pass with acknowledgment.

**Suppression Annotations**
Support HTML comments like `<!-- audit-suppress: jargon, unverifiable-number -->` to allow intentional violations without false positives. Log all suppressions for manual review.

**Parallelized Auditing**
Use asyncio and concurrent Claude requests to audit multiple files in parallel. Reduce full-site audit time from O(n) to O(1) relative to file count.

**Rule Versioning**
Store CONTENT-RULES.md in Supabase with version history. Build a UI to propose, review, and approve rule changes. Track which violations are due to rule changes vs. content drift.

**Custom Rule Engine**
Supplement Claude audits with simple regex rules for performance-critical checks (e.g., "no em dashes," "no exclamation marks"). Reserve Claude for semantic judgments.

**Content Inventory**
Audit results feed into a content inventory system: track every piece of content on the site, when it was last audited, how many violations, which are resolved, etc. Dashboard view of content health.

**Integration with Fenix Training**
Violations found in audit could be logged as training data for Fenix's knowledge base, so Fenix learns what Kiran considers "correct" writing style and can guide users toward better content.

---

## Source Sessions

- `2026-03-05-201142-continue-from-fenix-roadmapmd-phase-1-is-complete-im.md` — Phase 1 validation mentioned content audit system, noted as "diagnostic only" with low priority UI
- `2026-02-27-082718-translating-portfolio-work-into-tangible-outcomes.md` — High-level discussion about quality and consistency across site content
- `2026-02-25-030851-i-want-to-try-and-finish-populating-content.md` — Content population session creating MadLab and Studio pages (candidates for audit)
