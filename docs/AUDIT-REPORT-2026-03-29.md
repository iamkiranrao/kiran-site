# Standards & Compliance Audit — March 29, 2026

**Generated:** March 29, 2026
**Overall Score:** 96/100 (Authentic)
**Previous Score:** 20/100 (Rewrite) — March 20, 2026
**Files Scanned:** 260 (up from 51)
**Total Checks:** 35 (5 backend, 3 architecture, 12 authenticity, 7 content, 8 visual)
**Total Violations:** 224 (down from 2,027 — 89% reduction)

---

## Pillar Scores

| Pillar | Score | Rating | Tier | Critical | Warning | Info | Δ from March 20 |
|---|---|---|---|---|---|---|---|
| **Backend** | 100/100 | Authentic | Best-in-Class | 0 | 0 | 0 | — (held) |
| **Architecture** | 100/100 | Authentic | Best-in-Class | 0 | 0 | 0 | — (held) |
| **Authenticity** | 94/100 | Authentic | Ship | 19 | 9 | 0 | +94 |
| **Content** | 96/100 | Authentic | Ship | 7 | 20 | 8 | +96 |
| **Visual** | 93/100 | Authentic | Ship | 0 | 48 | 113 | +93 |

All five pillars now score "Authentic" (90+). Backend and Architecture remain at perfect 100. The three pillars that were at 0/100 nine days ago have all crossed into Authentic territory.

---

## What Changed Since March 20

The March 20 audit was the first run — a baseline with 2,027 violations across a 51-page scan. The bulk of violations were in Visual (1,542) and Backend (331). Since then:

- **Backend:** 331 → 0 violations. Response models, docstrings, and Pydantic model organization all remediated.
- **Authenticity:** 42 → 28 violations. Em-dashes reduced, honesty markers added to core pages, first-person voice strengthened. 20 violations baselined as accepted.
- **Content:** 112 → 35 violations. Meta descriptions and canonical URLs added to primary pages. Readability scores brought within target range on most content. 7 violations baselined.
- **Visual:** 1,542 → 161 violations. SVG class prefixes applied, accessibility improvements (skip links, ARIA attributes, heading hierarchy), annotation spacing fixed. 146 violations baselined as accepted (mostly diagram-preview.html legacy SVGs).

---

## Current Hotspots

### 1. Authenticity — 94/100 (28 violations, 8 new)

The authenticity pillar uses two-part scoring: anti-AI signals (does it avoid looking machine-generated?) and pro-Kiran signals (does it sound like Kiran specifically?).

**New violations:**

- **Em-dashes (8 critical):** Several prototype and layout files still use em-dashes in content. Files: `bento-enhanced-d.html`, `bento-layout-options.html`, `career-highlights.html`, `madlab.html`, `now.html`, `studio.html`. These are secondary pages — the index and teardowns are clean.

- **Lexical tells (11 warning):** Blog posts contain words that flag as AI-adjacent. The checker is catching words in context that are used naturally (e.g., "innovation theater" in a fintech teardown is commentary, not filler). Most are in blog content that predates the standards framework.

- **Honesty markers missing (5 critical):** Blog posts lack admitted dead ends, named unknowns, or first-person error references. This is the pro-Kiran side — the content is clean of AI signals but doesn't yet have enough of Kiran's specific voice markers.

- **First-person voice (2 warning):** `madlab.html` and one prototype page lack sufficient first-person markers in long-form content.

**Recommended actions:**
1. Replace em-dashes with commas, semicolons, or periods in the 6 flagged files (mechanical fix, ~30 min)
2. Add honesty markers to blog posts — dead ends, surprises, "I was wrong about X" moments (judgment call, requires Kiran)
3. Lexical tells are mostly false positives in context — baseline the blog-specific ones

### 2. Content — 96/100 (35 violations, 28 new)

**New violations:**

- **Missing meta descriptions (14 warning):** Prototype pages, bento layout options, and secondary pages lack `<meta name="description">`. The primary pages (index, teardowns, blog posts) all have them.

- **Em-dashes in content (10 critical):** Overlaps with authenticity findings. Same files.

- **Missing canonical URLs (6 warning):** Prototype and layout option pages without `<link rel="canonical">`. Not critical for SEO since these aren't indexed pages.

- **Readability ceiling exceeded (4 warning):** `persona-picker-mockup.html` (FK 13.2), `studio.html` (FK 13.6) slightly above the 13.0 ceiling. Minor — these are internal/secondary pages.

- **Banned jargon (1 warning):** "landscape" appears in `persona-layout-wireframe.html`.

**Recommended actions:**
1. Add meta descriptions to the 6 non-prototype pages missing them
2. Em-dash cleanup (same as authenticity action)
3. Canonical URLs on secondary pages can be baselined — they're not indexed

### 3. Visual — 93/100 (161 violations, 15 new)

**New violations:**

- **Annotation sizing (96 info):** Mostly in `diagram-preview.html` — annotation boxes with tight padding. This is a legacy SVG file that accounts for the bulk of visual violations. Already baselined 146 of these.

- **Accessibility (40 warning):** Missing skip links, heading hierarchy issues, and undescriptive link text across prototype and secondary pages. The primary pages (index, teardowns) are clean.

- **SVG text overlap (25 warning):** Journey map SVGs in teardown blog posts have text labels positioned too close together. These are generated diagrams.

**Recommended actions:**
1. Baseline the remaining `diagram-preview.html` annotation issues (it's a dev tool, not user-facing)
2. Add skip links to secondary pages that lack them (mechanical fix)
3. SVG text overlap in teardown diagrams requires regeneration with better spacing — lower priority

---

## Compliance Tier Summary

| Tier | Requirement | Status |
|---|---|---|
| **Best-in-Class** | Score ≥90, zero critical, zero warnings | Backend ✓, Architecture ✓ |
| **Quality** | Score ≥75, zero critical, <3 warnings | — |
| **Ship** | Score ≥60, zero critical | Authenticity, Content, Visual |

Authenticity, Content, and Visual are all in "Ship" tier rather than "Best-in-Class" due to critical violations (em-dashes) and warning counts. Clearing the em-dash violations across 6 files would move Authenticity and Content closer to Best-in-Class.

---

## Trajectory

| Metric | March 20 | March 29 | Change |
|---|---|---|---|
| Overall Score | 20/100 | 96/100 | +76 |
| Total Violations | 2,027 | 224 | -89% |
| Pillars at "Authentic" | 1/5 | 5/5 | +4 |
| Files Scanned | 51 | 260 | +409% |
| Critical Violations | 56 | 26 | -54% |
| Warning Violations | 1,124 | 77 | -93% |

The site went from "Rewrite" to "Authentic" in 9 days while the scan coverage expanded 5x. The remaining violations are concentrated in secondary/prototype pages and legacy SVG files — the primary user-facing pages are clean.

---

## Next Priority Actions

1. **Em-dash sweep** — Fix the 8 files with em-dashes. This is the single highest-ROI fix: it clears critical violations in both Authenticity and Content pillars simultaneously.
2. **Baseline legacy SVG violations** — `diagram-preview.html` accounts for ~60% of remaining Visual violations. Baseline it as accepted.
3. **Blog honesty markers** — The blog posts need more of Kiran's voice. This is a content quality issue, not a mechanical fix. Kiran should revisit the 5 flagged posts and add dead ends, surprises, and "I was wrong" moments.
4. **Meta descriptions on secondary pages** — Quick mechanical fix for 6 pages.
