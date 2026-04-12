# Persona Accent Colors — WCAG 2.1 Contrast Audit

**Date:** 2026-04-12
**Audit Scope:** 6 persona accent colors against light and dark theme backgrounds
**Standard:** WCAG 2.1 Level AA (minimum: 4.5:1 for normal text, 3:1 for large text)

---

## Executive Summary

**Light theme has critical accessibility failures.** Five of six persona accent colors fail WCAG AA contrast requirements against white and near-white backgrounds. This makes persona-specific text unreadable in light mode for normal-sized text.

**Dark theme passes across the board.** All colors achieve AA normal contrast (4.5:1 or better) against dark backgrounds.

**Immediate action required:** Either adopt suggested darker variants for light theme, or switch persona colors to a different visual encoding (e.g., icons, patterns, positioned borders) that doesn't rely on text contrast in light mode.

---

## Test Setup

**Persona Accent Colors:**
- Evaluator: `#7B9ACC`
- Seeker: `#777744`
- Practitioner: `#CC7B7B`
- Learner: `#7BCC9A`
- Technologist: `#9A7BCC`
- Inner Circle: `#CCB87B`

**Background Colors Tested:**

| Theme | Background | Hex Value | Use Case |
|-------|-----------|-----------|----------|
| Light | White | `#FFFFFF` | Default page background |
| Light | Near-white | `#F5F5F5` | Card background |
| Dark | Near-black | `#0A0A0A` | Default page background |
| Dark | Dark card | `#1A1A1A` | Card background |

**WCAG 2.1 Thresholds:**

| Level | Normal Text | Large Text |
|-------|-------------|-----------|
| **AA** | 4.5:1 | 3:1 |
| **AAA** | 7:1 | 4.5:1 |

---

## Results Table — Contrast Ratios

| Persona | vs White | vs Near-white | vs Dark (#0A0A0A) | vs Dark Card (#1A1A1A) |
|---------|----------|--------------|-------------------|------------------------|
| **Evaluator** `#7B9ACC` | 2.86:1 | 2.63:1 | 6.92:1 | 6.08:1 |
| **Seeker** `#777744` | 4.66:1 | 4.27:1 | 4.25:1 | 3.73:1 |
| **Practitioner** `#CC7B7B` | 3.14:1 | 2.88:1 | 6.30:1 | 5.54:1 |
| **Learner** `#7BCC9A` | 1.92:1 | 1.76:1 | 10.32:1 | 9.07:1 |
| **Technologist** `#9A7BCC` | 3.45:1 | 3.17:1 | 5.73:1 | 5.04:1 |
| **Inner Circle** `#CCB87B` | 1.96:1 | 1.80:1 | 10.10:1 | 8.88:1 |

---

## Pass/Fail Matrix — Light Theme

| Persona | vs White | vs Near-white |
|---------|----------|--------------|
| **Evaluator** | ✗ AA Normal FAIL<br>✓ Large FAIL | ✗ AA Normal FAIL<br>✗ Large FAIL |
| **Seeker** | ✓ AA Normal PASS<br>✗ Large FAIL | ✗ AA Normal FAIL<br>✓ Large PASS |
| **Practitioner** | ✗ AA Normal FAIL<br>✓ Large PASS | ✗ AA Normal FAIL<br>✗ Large FAIL |
| **Learner** | ✗ AA Normal FAIL<br>✗ Large FAIL | ✗ AA Normal FAIL<br>✗ Large FAIL |
| **Technologist** | ✗ AA Normal FAIL<br>✓ Large PASS | ✗ AA Normal FAIL<br>✓ Large PASS |
| **Inner Circle** | ✗ AA Normal FAIL<br>✗ Large FAIL | ✗ AA Normal FAIL<br>✗ Large FAIL |

**Summary:** Only Seeker passes AA normal on white. Five of six colors (83%) fail light theme.

---

## Pass/Fail Matrix — Dark Theme

| Persona | vs Dark (#0A0A0A) | vs Dark Card (#1A1A1A) |
|---------|-------------------|------------------------|
| **Evaluator** | ✓ AA Normal PASS<br>✗ AAA Normal FAIL | ✓ AA Normal PASS<br>✗ AAA Normal FAIL |
| **Seeker** | ✗ AA Normal FAIL<br>✓ Large PASS | ✗ AA Normal FAIL<br>✓ Large PASS |
| **Practitioner** | ✓ AA Normal PASS<br>✗ AAA Normal FAIL | ✓ AA Normal PASS<br>✗ AAA Normal FAIL |
| **Learner** | ✓ AA Normal PASS<br>✓ AAA Normal PASS | ✓ AA Normal PASS<br>✓ AAA Normal PASS |
| **Technologist** | ✓ AA Normal PASS<br>✗ AAA Normal FAIL | ✓ AA Normal PASS<br>✗ AAA Normal FAIL |
| **Inner Circle** | ✓ AA Normal PASS<br>✓ AAA Normal PASS | ✓ AA Normal PASS<br>✓ AAA Normal PASS |

**Summary:** Dark theme is strong. All colors pass AA normal except Seeker (3.73:1 – just below threshold). Learner and Inner Circle even pass AAA normal.

---

## Colors Needing Attention — Light Mode

All five failing colors are too light (high luminance) to contrast adequately against white/near-white:

| Persona | Problem | Current Contrast | Target (AA Normal) | Severity |
|---------|---------|------------------|-------------------|----------|
| **Evaluator** `#7B9ACC` | Very light blue | 2.86:1 | 4.5:1 | CRITICAL |
| **Practitioner** `#CC7B7B` | Light coral/rose | 3.14:1 | 4.5:1 | CRITICAL |
| **Learner** `#7BCC9A` | Very light mint | 1.92:1 | 4.5:1 | CRITICAL |
| **Technologist** `#9A7BCC` | Light lavender | 3.45:1 | 4.5:1 | CRITICAL |
| **Inner Circle** `#CCB87B` | Very light gold | 1.96:1 | 4.5:1 | CRITICAL |

Seeker (`#777744`, the dark olive) is the only color by design that contrasts well with white on its own (4.66:1).

---

## Recommended Solutions

### Option A: Darker Accent Color Variants (for light theme)

Use adjusted hex values when rendering persona accents in light-theme text contexts:

| Persona | Current | Light-Theme Variant | Contrast | Change |
|---------|---------|-------------------|----------|--------|
| **Evaluator** | `#7B9ACC` | `#5877A9` | 4.54:1 ✓ | Darker blue (R-35 G-35 B-35) |
| **Practitioner** | `#CC7B7B` | `#B05F5F` | 4.52:1 ✓ | Darker coral (R-28 G-28 B-28) |
| **Learner** | `#7BCC9A` | `#348553` | 4.54:1 ✓ | Much darker green (R-71 G-71 B-71) |
| **Technologist** | `#9A7BCC` | `#8667B8` | 4.52:1 ✓ | Darker purple (R-20 G-20 B-20) |
| **Inner Circle** | `#CCB87B` | `#897538` | 4.50:1 ✓ | Much darker gold (R-67 G-67 B-67) |
| **Seeker** | `#777744` | (no change) | 4.66:1 ✓ | Already passes |

**Implementation:** Detect light theme and apply variant hex in CSS or component logic for text-based persona indicators (labels, badges, etc.). Keep original colors for background fills and non-text uses.

### Option B: Non-Text Visual Encoding

Instead of relying on text color contrast, encode persona identity through:
- **Icons** (persona-specific icon set, high contrast always)
- **Patterns** (diagonal stripe, dot pattern, solid block indicator)
- **Positioned borders** (left border, top border, accent underline)
- **Symbols** (emoji, number, letter code)

These don't require text contrast ratios and work equally well in light and dark modes.

### Option C: Hybrid Approach

- Use original colors for **backgrounds and non-critical decorative elements** (light or dark mode)
- Use **darker variants (Option A) for readable text** in light theme
- Keep original colors for **dark theme where contrast is strong**

This preserves visual recognition while maintaining accessibility.

---

## Recommendation

**Adopt Option C (Hybrid) — most practical:**

1. Keep existing persona color assignments (the light colors are visually distinctive and work in dark mode)
2. Create SCSS variables with theme-aware color overrides:
   ```scss
   --persona-evaluator: #7B9ACC;        // Original (light mode will use variant)
   --persona-evaluator-light-text: #5877A9; // Darker for light theme text
   ```
3. In light theme, apply darker variant only to text/readable elements
4. No visual changes to dark mode or decorative uses

This preserves the design intent while fixing accessibility without major redesign.

---

## Methodology

Contrast ratios calculated using WCAG 2.1 relative luminance formula:

```
L = 0.2126×R' + 0.7152×G' + 0.0722×B'

where R', G', B' are linearized sRGB values:
  - if channel ≤ 0.03928: channel / 12.92
  - else: ((channel + 0.055) / 1.055)^2.4

Contrast ratio = (L_light + 0.05) / (L_dark + 0.05)
```

All calculations verified via Python with double-precision floating point.

---

## Next Steps

- [ ] Decide: Option A (variants), Option B (icons), or Option C (hybrid)
- [ ] If variants: Create CSS overrides or component prop for light-mode text colors
- [ ] If icons/patterns: Design persona indicator system
- [ ] Test chosen solution against WCAG AAA if full compliance is a goal
- [ ] Audit impact on brand identity and visual consistency
