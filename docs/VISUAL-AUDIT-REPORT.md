# Visual Consistency Audit Report

**Date:** April 12, 2026 (Session 7b)
**Scope:** All 10 top-nav pages audited against VISUAL-STANDARDS.md
**Pages audited:** index.html, how-id-built-it.html, career-highlights.html, madlab.html, studio.html, skills.html, blog-podcast.html, causes.html, store.html, testimonials.html

---

## Executive Summary

The site has strong foundational consistency: all pages share styles.css, use CSS custom properties for primary colors, and follow consistent hero section typography via `clamp()`. However, there are several areas where individual pages deviate from the design system, primarily around hardcoded colors, missing light-mode support in inline styles, inconsistent spacing, and font loading.

---

## Critical Issues

### 1. Hardcoded Colors Breaking Theme Architecture

Multiple pages use hardcoded hex colors instead of CSS custom properties, which will break dark/light theme toggling.

- **career-highlights.html** line 73: `border: 3px solid #B08527` on `.impact-video-container` — should use a theme-aware variable
- **career-highlights.html** lines 231, 262: `#c0392b` for error states — should use a semantic error variable
- **testimonials.html** lines 94, 158, 192, 210, 232: `#C9A87C` for accent elements — should use `--accent` or persona variable
- **store.html** lines 75-288: Entire mock storefront uses Tailwind-style hardcoded colors (`#111827`, `#f3f4f6`, `#ef4444`) — should use design system variables

### 2. No Light Mode Support in Inline Styles

8 pages with inline `<style>` blocks lack `[data-theme="light"]` overrides for their custom styles. Light mode will render with dark-mode colors in custom sections, causing contrast and readability issues.

Affected: career-highlights.html, testimonials.html, store.html, blog-podcast.html, madlab.html, studio.html, causes.html, skills.html

### 3. Inconsistent Grid Gaps

Card grids use different gap values, breaking visual rhythm:
- how-id-built-it.html (`.companies-grid`): 1.25rem (20px)
- blog-podcast.html (`.content-grid`): 1.5rem (24px)
- causes.html (`.causes-grid`): 1.25rem (20px)
- madlab.html/studio.html (`.category-scroll`): 1rem (16px)

Spec defines `lg: 24px` for card gaps. Should standardize via `--spacing-card-gap: var(--spacing-lg)`.

---

## High-Priority Issues

### 4. Font Loading Inconsistency

- **index.html** loads 9+ font families (Playfair, Inter, Bebas Neue, Space Mono, Archivo Black, Orbitron, Caveat, Lora, Syne, Corben, Josefin Sans, Space Grotesk) — VISUAL-STANDARDS requires only 2 (Playfair Display + Inter) with variable fonts
- Other pages load only non-variable Inter
- No variable font syntax (`wght@300..600`) used anywhere
- Playfair Display is loaded in index.html but never applied to any element

### 5. Missing Responsive Grid Columns

`grid-template-columns: repeat(4, 1fr)` on how-id-built-it, causes, and blog-podcast will break on mobile. No media queries to reduce columns at smaller viewports.

### 6. Inconsistent Hero Section Padding

Hero padding varies across subpages without clear rationale. Most subpages use `6rem 4rem Xrem` but the bottom value ranges from 1rem to 2rem. testimonials.html deviates significantly with `4rem 1.5rem 2rem` and an unusually small max-width of 680px.

---

## What's Consistent (Positive Findings)

- All pages correctly import styles.css
- Navigation styling consistent across all pages (fixed top nav, theme toggle, menu button)
- CSS custom property hierarchy followed for primary colors
- Dark mode default universally applied
- Hero titles consistently use `clamp(2.5rem, 6vw, 4.5rem)` across subpages
- Taglines use `clamp(1rem, 2vw, 1.2rem)` consistently
- Border-bottom separator (`1px solid var(--border)`) consistent on hero sections
- Card hover states uniform: `border-color: var(--text-muted)` + `transform: translateY(-2px)`
- Button pill styling (`border-radius: 500px`) consistent
- Skip link and aria-labels present on key elements
- Color contrast likely meets WCAG AA for primary text on dark background

---

## Recommendations (Priority Order)

| # | Fix | Effort | Pages |
|---|-----|--------|-------|
| 1 | Replace hardcoded colors with CSS variables; add `[data-theme="light"]` overrides | High | 4 pages |
| 2 | Add light mode support to all inline `<style>` blocks | High | 8 pages |
| 3 | Standardize grid gaps to 24px via shared CSS variable | Low | 6 pages |
| 4 | Migrate font loading to variable syntax; remove unused font families from index | Medium | All pages |
| 5 | Add responsive grid breakpoints for mobile | Medium | 3 pages |
| 6 | Standardize hero padding bottom values | Low | 9 pages |
| 7 | Apply Playfair Display to hero titles per spec intent | Medium | All pages |
| 8 | Implement oklch color space as primary (hex as fallback) | Low | styles.css |
| 9 | Add `prefers-reduced-motion` to page-specific styles | Low | All pages |
| 10 | Align testimonials.html hero padding to 4rem pattern | Low | 1 page |

---

## Design System Compliance Summary

| Spec Section | Compliance |
|---|---|
| Color System (CSS variables) | Partial — hardcoded hex in 4 pages |
| oklch Color Space | Not implemented |
| Dark/Light Mode | Partial — inline styles missing light overrides |
| Typography (Playfair + Inter variable) | Partial — loaded but unused; not variable |
| Spacing Scale | Inconsistent — gaps range 16-24px |
| Responsive (container queries) | Not implemented |
| Accessibility (prefers-reduced-motion) | Not found in page styles |
| Button Sizing (44x44px minimum) | Compliant |
