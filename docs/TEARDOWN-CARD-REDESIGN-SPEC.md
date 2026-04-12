# Teardown Card Redesign Spec

**Date:** April 12, 2026
**Status:** Specification (pre-implementation)
**Scope:** Redesign teardown product cards across `how-id-built-it.html` and teardown hub pages (e.g., `teardowns/meta.html`, `teardowns/geico.html`)

---

## Current Card Anatomy

### How I'd Built It — Company Grid (how-id-built-it.html)

**Location:** `.companies-section` → `.companies-grid` → `.company-card`

| Element | Current Markup | Visual Purpose |
|---------|---|---|
| **Logo Banner** | `.company-logo` (120px height) + `<svg>` | Company logo display (centered) |
| **Card Body** | `.company-body` flex container | Text content area |
| **Eyebrow** | Implicit in header structure; not explicitly labeled | None (missing) |
| **Title** | `.company-name` (1.1rem, 600wt) | Company name |
| **Product Count** | `.company-product-count` (0.75rem, caps) | "X TEARDOWNS" or "X PRODUCTS" |
| **Tags** | `.company-products` flex → `.company-product-tag` pills | List of product names (small, muted, pill-styled) |
| **Image** | None in current structure | Not present |
| **Link/CTA** | Implicit (card is an `<a>`) | No visible CTA text |

**Current spacing:**
- Logo banner border-bottom separates from body
- Body padding: `1.25rem 1.5rem 1.5rem`
- Tag gap: `0.4rem`
- Card border: `1px solid var(--border)`
- Hover: `border-color` brightens, `transform: translateY(-2px)`

---

### Teardown Hub — Product Grid (teardowns/meta.html, teardowns/geico.html)

**Location:** `.products-section` → `.products-grid` → `.product-card`

| Element | Current Markup | Visual Purpose |
|---------|---|---|
| **Icon Area** | `.wf-product-icon` (100px height) + `<svg>` | Product icon display (centered) |
| **Card Body** | `.product-body` flex container | Text content area |
| **Eyebrow** | Implicit; not labeled | None (missing) |
| **Title** | `.product-name` (1.1rem, 600wt) | Product name |
| **Tagline** | `.product-tagline` (0.85rem) | Short product description |
| **Tags** | `.product-sections` flex → `.product-section-tag` pills | Section/category tags (small, muted, pill-styled) |
| **CTA** | `.product-cta` with icon | "Read Teardown →" visible text |
| **Image** | None in current structure | Not present |

**Current spacing:**
- Icon area border-bottom separates from body
- Body padding: `1.25rem 1.5rem 1.5rem`
- Tag gap: `0.4rem`
- CTA margin-top: `auto` (bottom-aligned via flex)
- Card border: `1px solid var(--border)`
- Hover: `border-color` brightens, `transform: translateY(-2px)`, CTA color changes

---

## Proposed Redesign

### 1. Add Eyebrow Label Layer

**Purpose:** Add a contextual label that communicates card type at a glance.

**Eyebrow options:**
- **How I'd Built It (company grid):** Display company name OR "Product Teardown" label
  - Examples: "FACEBOOK" / "GEICO" / "AIRBNB" (company name as eyebrow is more useful than generic "Product Teardown")
- **Teardown hubs (product grid):** Display brand/product category
  - Examples: "META PRODUCTS" / "GEICO MOBILE" / "FEATURE TEARDOWN"

**Markup:**
```html
<div class="card-eyebrow">FACEBOOK</div>
```

**Styling (add to CSS):**
```css
.card-eyebrow {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 0.4rem;
}
```

**Implementation location:**
- Company cards: Insert before `.company-name` (or rename company-name to eyebrow, repurpose .company-product-count)
- Product cards: Insert before `.product-name`

---

### 2. Improve Tag Display (Pill Style Enhancement)

**Current state:** Small, flat tags with minimal visual distinction.

**Proposed change:** Enhance pills with:
- Better color differentiation (use persona accent colors or semantic color palette)
- Slightly more padding for breathing room
- Optional: icon prefix for category tags

**CSS updates:**

```css
.company-product-tag,
.product-section-tag {
  /* Current */
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0.01em;
  padding: 0.3rem 0.7rem;        /* increased from 0.25rem 0.6rem */
  border-radius: 500px;
  border: 1px solid var(--border);
  background: var(--bg-secondary); /* use secondary for slight contrast */
  color: var(--text-secondary);
  transition: all 0.2s ease;      /* new */
}

/* Hover effect for interactivity */
.company-product-tag:hover,
.product-section-tag:hover {
  background: var(--bg-primary);
  border-color: rgba(255,255,255,0.28);
  color: var(--text-primary);
}

/* Optional: Color-code by category (requires data attributes) */
.product-section-tag[data-category="ui"] {
  --tag-accent: var(--color-explorer); /* persona color example */
  border-color: rgba(203,92,114,0.2); /* --color-explorer at opacity */
}
.product-section-tag[data-category="ux"] {
  --tag-accent: var(--color-practitioner);
  border-color: rgba(77,175,139,0.2);
}
```

---

### 3. Add Company/Product Logo Thumbnails

**Purpose:** Visual brand reinforcement and easier scanning of grid.

**Current state:** Logo exists only in banner (centered, large, takes up 120px height).

**Proposed addition:** Small logo thumbnail in card footer or header corner.

**Approach A (Recommended):** Keep banner logo, add small logo in top-right corner of card

```html
<div class="product-card">
  <!-- existing card content -->
  <div class="card-logo-badge">
    <img src="path/to/logo-small.svg" alt="Product logo" />
  </div>
</div>
```

**Styling:**
```css
.product-card {
  position: relative; /* for absolute positioning of badge */
}

.card-logo-badge {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 32px;
  height: 32px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  opacity: 0.6;
  transition: opacity 0.2s ease;
}

.product-card:hover .card-logo-badge {
  opacity: 1;
}

.card-logo-badge img {
  max-width: 100%;
  max-height: 100%;
}
```

**Approach B (Alternative):** Replace banner area with more compact header

If visual redesign allows, shrink banner from 120px to 80px and add eyebrow + badge in same area.

---

### 4. Responsive Considerations

**Desktop (>1024px):** 3–4 column grid (existing)
- Cards maintain current proportions
- Eyebrow visible, tags wrap naturally
- Logo badge visible on hover or always visible (low opacity baseline)

**Tablet (768px–1024px):** 2-column grid (existing)
- Eyebrow reduces to lighter color (more secondary-like)
- Tags may wrap more; padding adjusted

**Mobile (<768px):** 1 column (existing)
- Card scales to full width
- Eyebrow visible, full-size
- Logo banner scales down proportionally (CSS `clamp()` for height)
- Tags stack gracefully
- Badge may hide (`:hidden` at mobile) to save space, or stay visible

**Updated responsive CSS:**

```css
@media (max-width: 768px) {
  .company-logo,
  .wf-product-icon {
    height: clamp(80px, 15vw, 120px); /* scales between 80-120px */
  }

  .card-logo-badge {
    display: none; /* hide badge on mobile to save space */
  }

  .card-eyebrow {
    font-size: 0.65rem; /* slightly smaller */
  }
}
```

---

## CSS Class Recommendations

Follow existing design system conventions (VISUAL-STANDARDS.md):

| Class | Purpose | Applies |
|-------|---------|---------|
| `.card-eyebrow` | Uppercase label above title | Company/product name or category |
| `.card-logo-badge` | Small logo thumbnail, top-right corner | Optional brand reinforcement |
| `.product-tag` (or keep `.product-section-tag`) | Styled pill with hover effect | Categories, products, keywords |
| `.card-body` (or keep `.product-body`) | Main text content flex container | Padding, typography container |

**CSS variable usage:**

```css
/* Use existing design system variables */
:root {
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;

  /* Card typography */
  --font-eyebrow: 0.7rem / 0.65rem (mobile) / 600 weight / 0.04em letter-spacing / uppercase;
  --font-title: 1.1rem / 600 weight / -0.01em letter-spacing;
  --font-tag: 0.7rem / 0.65rem (mobile) / 500 weight / 0.01em letter-spacing;
}

/* Example: use CSS variables instead of hard-coded values */
.card-eyebrow {
  font-size: clamp(0.65rem, 2vw, 0.7rem);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: var(--spacing-sm);
}

.product-section-tag {
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: clamp(0.65rem, 1.5vw, 0.7rem);
  border-radius: 500px;
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text-secondary);
}
```

---

## Implementation Plan

### Files to Touch

| File | Changes | Effort | Notes |
|------|---------|--------|-------|
| `how-id-built-it.html` | Add `.card-eyebrow` to company cards; update `.company-product-tag` CSS | Low | Markup adds eyebrow div; CSS updates for tags |
| `teardowns/meta.html` | Add `.card-eyebrow` to product cards; update `.product-section-tag` CSS; add logo badge | Low–Med | Similar to above + optional badge |
| `teardowns/geico.html` | Same as meta.html | Low–Med | Consistent with meta redesign |
| `styles.css` | Add eyebrow, tag enhancement, logo badge, responsive rules | Med | Centralized CSS for all teardown pages |

### Implementation Phases

**Phase 1: Core Structure (2–3 hours)**
1. Add `.card-eyebrow` markup to all three teardown pages
2. Update `.company-product-tag` and `.product-section-tag` CSS with new padding, colors, hover effects
3. Test responsive behavior at mobile/tablet/desktop
4. Verify eyebrow text fits without truncation

**Phase 2: Logo Badge (1–2 hours, optional)**
1. Add `.card-logo-badge` HTML structure
2. Style badge positioning, sizing, opacity transitions
3. Add mobile hide rule
4. Test badge alignment and behavior on hover

**Phase 3: Refinement (1 hour)**
1. Tweak colors based on design system (verify persona color usage if applicable)
2. Test performance (no layout shift during hover)
3. Accessibility audit: ensure text contrast, keyboard focus, screen reader labels

**Total estimated effort:** 4–6 hours

---

## Design System Alignment

### Color System (from VISUAL-STANDARDS.md)

**Primary text:** `var(--text-primary)` (#ffffff) — Card titles, primary information
**Secondary text:** `var(--text-secondary)` (#b0b0b0) — Eyebrow, supporting text
**Muted text:** `var(--text-muted)` (#a08868) — Metadata, tertiary info (currently used for tags)
**Borders:** `var(--border)` (rgba(255,255,255,0.14)) — Card edges, tag borders
**Background secondary:** `var(--bg-secondary)` (#231c14) — Card backgrounds, secondary surfaces

**Recommendation:** Use `--text-muted` for eyebrow (already in use for tags), and keep `.product-section-tag` styling consistent with existing pill design.

### Typography (from VISUAL-STANDARDS.md)

**Eyebrow:** 0.7rem / 600 weight / 0.04em letter-spacing / uppercase
**Body text:** Inter, 0.9–1rem, 400–500 weight
**Tags:** 0.7rem / 500 weight / 0.01em letter-spacing

All proposed sizes align with existing type scale.

### Spacing

Use consistent `--spacing-*` variables where available:
- Eyebrow bottom margin: `--spacing-sm` (0.5rem)
- Tag padding: `--spacing-xs` to `--spacing-sm` (0.25rem–0.5rem)
- Badge offset: `--spacing-md` (0.75rem–1rem)

---

## Accessibility Considerations

1. **Text contrast:** Eyebrow color (muted) is `#a08868` on `#0a0a0a` background = ~4.5:1 WCAG AA ✓
2. **Interactive elements:** Tags should have `:focus-visible` state for keyboard navigation
3. **Logo badge:** If added, include `alt` text on `<img>` and ensure it's not keyboard-trappable (decorative element)
4. **Screen readers:** Eyebrow should not create redundant announcements; use semantic HTML (`<span class="card-eyebrow">`) or consider ARIA labeling if it replaces other metadata

**Added CSS for keyboard focus:**
```css
.product-section-tag:focus-visible {
  outline: 2px solid var(--text-primary);
  outline-offset: 2px;
}

.card-logo-badge img:focus-visible {
  outline: 2px solid var(--text-primary);
  outline-offset: 2px;
}
```

---

## Visual Preview (Text Description)

### Before Redesign

**Company Card (how-id-built-it):**
```
┌─────────────────┐
│   [LOGO AREA]   │  ← 120px height, centered
├─────────────────┤
│ FACEBOOK        │  ← Title (1.1rem)
│ 2 TEARDOWNS     │  ← Count (0.75rem, muted)
│ [Instagram]     │  ← Tags (0.7rem pills, subtle)
│ [Threads]       │
└─────────────────┘
```

### After Redesign

**Company Card (improved):**
```
┌──────────────[📱]┐
│   [LOGO AREA]   │  ← 120px height, centered
├─────────────────┤
│ FACEBOOK        │  ← New: Eyebrow (0.7rem, muted)
│ FACEBOOK        │  ← Title (1.1rem)
│ 2 TEARDOWNS     │  ← Count (0.75rem, muted)
│ [Instagram]     │  ← Tags: Enhanced pills with hover
│ [Threads]       │
└─────────────────┘
  ↑ Logo badge (optional)
```

---

## Questions for Review

1. **Eyebrow content:** Should it be the company name (as in current design) or a generic "Product Teardown" label? Recommend: **company name** (more scannable).
2. **Logo badge:** Essential or nice-to-have? Recommend: **Nice-to-have (Phase 2)** — start with eyebrow + tag improvements.
3. **Tag color-coding:** Should tags be color-coded by category (using persona colors or semantic palette)? Recommend: **No** (keep simple for now; add in future iteration if user feedback requests it).
4. **Mobile badge behavior:** Hide or show? Recommend: **Hide on mobile** (saves space, badge is more useful on desktop where hover works).

---

## Appendix: Before/After Code Snippets

### Company Card HTML

**Current:**
```html
<a href="how-id-built-it.html#facebook" class="company-card" data-company="facebook">
  <div class="company-logo">
    <svg><!-- logo --></svg>
  </div>
  <div class="company-body">
    <h3 class="company-name">Facebook</h3>
    <p class="company-product-count">2 Teardowns</p>
    <div class="company-products">
      <span class="company-product-tag">Instagram</span>
      <span class="company-product-tag">Threads</span>
    </div>
  </div>
</a>
```

**Proposed:**
```html
<a href="how-id-built-it.html#facebook" class="company-card" data-company="facebook">
  <div class="company-logo">
    <svg><!-- logo --></svg>
    <div class="card-logo-badge">
      <img src="images/facebook-badge.svg" alt="Facebook logo" />
    </div>
  </div>
  <div class="company-body">
    <span class="card-eyebrow">Facebook</span>  <!-- NEW -->
    <h3 class="company-name">Facebook</h3>
    <p class="company-product-count">2 Teardowns</p>
    <div class="company-products">
      <span class="company-product-tag">Instagram</span>
      <span class="company-product-tag">Threads</span>
    </div>
  </div>
</a>
```

### Product Card HTML

**Current:**
```html
<a href="../../instagram-teardown.html" class="product-card" data-product="instagram">
  <div class="wf-product-icon">
    <svg><!-- product icon --></svg>
  </div>
  <div class="product-body">
    <h3 class="product-name">Instagram</h3>
    <p class="product-tagline">Social photo sharing network</p>
    <div class="product-sections">
      <span class="product-section-tag">Feed UI</span>
      <span class="product-section-tag">Navigation</span>
    </div>
    <span class="product-cta">
      Read Teardown
      <svg><!-- arrow icon --></svg>
    </span>
  </div>
</a>
```

**Proposed:**
```html
<a href="../../instagram-teardown.html" class="product-card" data-product="instagram">
  <div class="wf-product-icon">
    <svg><!-- product icon --></svg>
    <div class="card-logo-badge">
      <img src="images/instagram-badge.svg" alt="Instagram logo" />
    </div>
  </div>
  <div class="product-body">
    <span class="card-eyebrow">Meta Products</span>  <!-- NEW -->
    <h3 class="product-name">Instagram</h3>
    <p class="product-tagline">Social photo sharing network</p>
    <div class="product-sections">
      <span class="product-section-tag">Feed UI</span>
      <span class="product-section-tag">Navigation</span>
    </div>
    <span class="product-cta">
      Read Teardown
      <svg><!-- arrow icon --></svg>
    </span>
  </div>
</a>
```

---

## References

- **Design System:** `/docs/Foundation/VISUAL-STANDARDS.md` — Color palette, typography, spacing variables
- **Current Card Styling:** `how-id-built-it.html` (inline `<style>`), `teardowns/meta.html`, `teardowns/geico.html`
- **Related:** Command Center card designs (if applicable for consistency)

---

*Specification created: April 12, 2026*
*Status: Ready for implementation*
