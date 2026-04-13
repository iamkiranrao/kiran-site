# VISUAL STANDARDS — kiranrao.ai
## Cross-Cutting Design System

**Last Updated:** March 20, 2026
**Status:** Production
**Ownership:** Design system (codifies persona picker visual language across entire site)

---

## 1. DESIGN PHILOSOPHY

The visual language is **modern, warm-minimal-typographic** — cutting-edge in execution but never cold or corporate. Think of the site as "the equivalent of a well-lit workshop" where serious work happens, but there's warmth and intention in every detail.

### Core Principles

- **Anti-corporate, anti-template.** Every visual choice reflects a person, not a brand guideline.
- **Warmth as default.** Earth tones, soft gradients, generous breathing room. Never sterile.
- **Typographic priority.** The design lives in how words are presented, not in decorative elements.
- **Glassmorphism with restraint.** Glass panels feel like frosted workshop windows — functional, not flashy.
- **Movement that serves clarity.** Animation reveals information or provides feedback, never gratuitous.
- **Accessibility built in, not bolted on.** Every color, every animation respects WCAG AA + prefers-reduced-motion.

---

## 2. COLOR SYSTEM

### Persona Palette (Locked — Do Not Change)

Six accent colors mapped to persona archetypes. Used throughout the site for borders, text, glows, and accent elements.

| Persona | Name | Color | Hex | Usage | Contrast (WCAG AA) |
|---------|------|-------|-----|-------|-------------------|
| 1 | Evaluator (Merritt) | Steel Blue | `#7B9ACC` | Card border, title text, glow | 5.8:1 ✓ |
| 2 | Seeker (Phil) | Warm Gunmetal | `#8A8580` | Card border, title text, glow | 5.4:1 ✓ |
| 3 | Practitioner (Drew) | Jade Green | `#4DAF8B` | Card border, title text, glow | 4.7:1 ✓ |
| 4 | Learner (Paige) | Lavender Purple | `#A07ED4` | Card border, title text, glow | 5.3:1 ✓ |
| 5 | Explorer (Wanda) | Cherry Red | `#cb5c72` | Card border, title text, glow | 5.1:1 ✓ |
| 6 | Inner Circle (Keshav) | Rusty Orange | `#cb6923` | Card border, title text, glow | 6.2:1 ✓ |

**Usage Rules:**
- Persona colors are applied as **border accent** (25-30% opacity at rest, 40-45% on hover)
- As **title/label text** on persona cards (full opacity)
- As **glow effects** around selected cards (40-80px blur, 0.35 opacity baseline)
- As **gradient tint** in card bottom overlays (8-10% visible saturation, darkening toward black)
- Never as primary background color — maintain dark, warm backgrounds for readability

**CSS Variables Example:**
```css
.evaluator {
  --card-accent: #7B9ACC;
  --card-tint: rgba(13, 20, 38, 0.78);
  border-color: rgba(123,154,204,0.25);
}
.evaluator::after { box-shadow: 0 0 40px rgba(123,154,204,0.35); }
```

### UI Palette (Dark Mode Default)

| Element | Color | Hex | Use Case |
|---------|-------|-----|----------|
| Deep Background | Dark Warm Brown | `#1a1410` | Page background (persona picker) |
| Primary Background | Dark Charcoal | `#0a0a0a` | Main page background |
| Secondary Background | Slightly Lighter | `#231c14` | Cards, panels, secondary surfaces |
| Primary Text | Off-White/Cream | `#e8dcc8` | Body text, headings (hero-class) |
| Secondary Text | Warm Muted | `#a08868` | Subheadings, metadata, captions |
| Borders | Subtle White | `rgba(255,255,255,0.14)` | Card edges, dividers |
| Borders (Active) | Brighter White | `rgba(255,255,255,0.28)` | Hover state, focus ring |

**CSS Root:**
```css
:root {
  --bg-deep: #1a1410;        /* Persona picker, hero sections */
  --bg-primary: #0a0a0a;     /* Main background */
  --bg-secondary: #231c14;   /* Cards, panels */
  --text-cream: #e8dcc8;     /* Primary text */
  --text-muted: #a08868;     /* Secondary text */
  --text-primary: #ffffff;   /* Accent text */
  --text-secondary: #b0b0b0; /* Dimmed text */
  --border: rgba(255,255,255,0.14);
}

[data-theme="light"] {
  --bg-primary: #f8f6f3;
  --text-primary: #0a0a0a;
  /* ... light mode overrides */
}
```

### Semantic Colors

| Intent | Color | Hex | Usage |
|--------|-------|-----|-------|
| Success | Muted Green | `#6b9e6b` | Confirmations, positive journey states |
| Warning | Amber | `#d4a74a` | Cautions, neutral states |
| Error | Muted Red | `#c47474` | Errors, negative journey states, problems |
| Info | Soft Blue | `#7a9ec4` | Informational badges, proposals |

*(From customer journey map color system, applies to alerts, badges, and semantic UI)*

### oklch Color Space (2026 Standard)

oklch (92%+ browser support) is perceptually uniform — lightness 50 in oklch actually *looks* like mid-brightness, unlike hex/HSL where perceived brightness varies by hue. This makes light-mode color generation mathematically predictable.

**Rule:** Define the persona palette in oklch as the primary color definition. Hex values remain as fallbacks.

```css
:root {
  /* Persona colors — oklch primary, hex fallback */
  --color-evaluator: oklch(0.68 0.08 250);   /* Steel Blue, fallback: #7B9ACC */
  --color-seeker: oklch(0.60 0.03 60);        /* Warm Gunmetal, fallback: #8A8580 */
  --color-practitioner: oklch(0.67 0.12 165);  /* Jade Green, fallback: #4DAF8B */
  --color-learner: oklch(0.60 0.14 300);       /* Lavender Purple, fallback: #A07ED4 */
  --color-explorer: oklch(0.55 0.12 10);       /* Cherry Red, fallback: #cb5c72 */
  --color-inner-circle: oklch(0.55 0.14 55);   /* Rusty Orange, fallback: #cb6923 */
}

/* Fallback for browsers without oklch support */
@supports not (color: oklch(0 0 0)) {
  :root {
    --color-evaluator: #7B9ACC;
    --color-seeker: #8A8580;
    --color-practitioner: #4DAF8B;
    --color-learner: #A07ED4;
    --color-explorer: #cb5c72;
    --color-inner-circle: #cb6923;
  }
}
```

**Migration:** Convert existing persona hex values to oklch equivalents. Use oklch for all new color derivations (hover states, opacity variants, light-mode generation). The hex palette table in §2 remains as the human-readable reference and fallback.

**Light mode win:** In oklch, generating a light-mode variant is predictable: increase lightness (L channel), reduce chroma (C channel) slightly. No more trial-and-error hex adjustments.

### Dark/Light Mode Considerations

**Current status:** Dark mode is default, light mode architecture prepared but not fully implemented.

- All color variables are `[data-theme="light"]` compatible
- Glass panels use `@supports not (backdrop-filter)` fallback (non-blurred, darker background)
- Text contrast ratios exceed 4.5:1 WCAG AA in both modes
- Accent colors tested for both dark and light backgrounds
- Future: Provide light mode toggle identical to existing theme toggle on nav

---

## 3. TYPOGRAPHY

### Font Stack

```css
/* Headings & Accent Text */
font-family: 'Playfair Display', Georgia, serif;

/* Body Text & UI */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

**Load Strategy (Variable Fonts — 2026 Standard):**

Switch to variable font files for both Inter and Playfair Display. A single variable font file covers all weights, reducing total font payload by ~64%.

```html
<!-- Variable fonts — single file per family, all weights -->
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..700;1,400..700&family=Inter:wght@300..600&display=swap" rel="stylesheet">
```

**Fallback font metrics (prevent layout shift):**
```css
/* Size-adjust prevents CLS when web font loads */
@font-face {
  font-family: 'Inter Fallback';
  src: local('Arial');
  size-adjust: 107%;
  ascent-override: 90%;
  descent-override: 22%;
  line-gap-override: 0%;
}

@font-face {
  font-family: 'Playfair Fallback';
  src: local('Georgia');
  size-adjust: 112%;
  ascent-override: 88%;
  descent-override: 24%;
  line-gap-override: 0%;
}

/* Use fallback in the font stack */
font-family: 'Inter', 'Inter Fallback', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
font-family: 'Playfair Display', 'Playfair Fallback', Georgia, serif;
```

**Benefits:** Single HTTP request per font family. Continuous weight axis allows fine-tuning (e.g., `font-weight: 450` for a slightly heavier body text). Fallback metrics eliminate layout shift during font loading.

### Type Scale

| Use Case | Font | Size | Weight | Line Height | Letter Spacing |
|----------|------|------|--------|-------------|-----------------|
| Hero Lead-in | Playfair | 38px | 600 | 1.25 | -0.3px |
| Subpage Hero Title | Serif | clamp(2.5rem, 6vw, 4.5rem) | 700 | 1.1 | -0.04em |
| Card Name (Persona) | Playfair | 21px | 600 | 1.2 | 0.3px |
| Card Title (Label) | Inter | 12px | 700 | 1.0 | 2px uppercase |
| Card Hook (Hover) | Inter | 12.5px | 400 | 1.55 | 0.2px italic |
| Body Text | Inter | 16-17px | 400 | 1.6 | normal |
| Small/Caption | Inter | 13px | 400 | 1.5 | 0.5px |
| Button/CTA | Inter | 15-17px | 500-600 | 1.4 | 0.3px |

**Rules:**
- Playfair Display for **hero statements, persona names, and emphasized typography**
- Inter for **all body, UI, labels, and metadata**
- Never mix serif body text (hard to read on screen at small sizes)
- Headings use `font-weight: 600-700` for visual weight
- Body copy stays at `font-weight: 400` for legibility
- Letter-spacing reduces on serif headings (-0.3px to -0.04em) to tighten expensive glyphs
- Line-height increases on body (1.6+) for accessibility and readability

### Cross-Section Typography Consistency Rules

Sections that sit adjacent on the page must feel like they belong together. These rules prevent font size drift, margin inconsistency, and spacing mismatches across sections.

**Rule 1: Adjacent sections share a type scale.** When two sections stack vertically (e.g., triptych above fenix-intro-zone), their equivalent elements must use proportionally related font sizes. "Equivalent" means elements serving the same role: section headers, card titles, card descriptions, body text.

| Role | Desktop | Tablet (1024px) | Mobile (768px) | Small (480px) |
|------|---------|-----------------|----------------|---------------|
| Section eyebrow/label | 1rem | 1rem | 0.95rem | 0.9rem |
| Card title | 1.1rem-1.5rem | 1.1rem-1.4rem | 1rem-1.3rem | 0.95rem-1.3rem |
| Card description / body | 0.95rem-1.1rem | 0.95rem-1.1rem | 0.9rem-1rem | 0.85rem-0.9rem |
| Chat / interactive text | 0.95rem | 0.95rem | 0.9rem | 0.85rem |
| Pills / tags / metadata | 0.8rem-0.9rem | 0.8rem-0.9rem | 0.8rem | 0.75rem |

**Rule 2: Every font size that appears at desktop must have a mobile value.** If you set a font-size in the base styles, add the corresponding mobile override at 768px (and 480px if distinct). No exceptions. Untouched font sizes on small screens are a bug.

**Rule 3: Font weight 300 is banned on dark backgrounds.** Thin strokes disappear on dark backgrounds. Minimum font-weight on dark mode is 400 for body text.

**Rule 4: Em dashes are not used in user-facing UI copy.** Use periods or commas for sentence separation. Em dashes in editorial content (blog posts, teardowns) are acceptable.

### Cross-Section Spacing Consistency Rules

**Rule 5: Sections flush to parent container.** A section's content area should be flush with its parent's padding edge. Do NOT add both `margin` and `padding` to create horizontal insets — that double-indents the content. If the parent (`#work`, `.about-section`) has `padding: Xrem`, child sections should use `margin: 0` and `padding: Yrem 0` (vertical only).

**Rule 6: Vertical spacing is symmetric within a module.** If a module has N rem above its content block, it must have N rem below. The welcome section, triptych, fenix-intro-zone, and every other visible section must have equal top and bottom breathing room.

**Rule 7: Column padding mirrors at dividers.** In two-column layouts split by a divider, left-column right-padding must equal right-column left-padding. The outer edges (left of left column, right of right column) should be flush with the section content edge (0 padding). Pattern: left column `padding: 0 2rem 0 0`, right column `padding: 0 0 0 2rem`.

**Rule 8: Mobile stacking zeroes side padding.** When columns stack vertically at 768px, all column-specific side padding resets to 0. The parent section's padding provides the side margins. Adding column padding on top of section padding on mobile wastes space.

### Responsive Step-Down Pattern

When content scales from desktop to mobile, follow this reduction pattern consistently:

| Breakpoint | Reduction | Example |
|------------|-----------|---------|
| Desktop (default) | Base size | 1.1rem |
| Tablet (1024px) | Same or -0.05rem | 1.1rem or 1.05rem |
| Mobile (768px) | -0.1rem from desktop | 1rem |
| Small phone (480px) | -0.15rem from desktop | 0.95rem |

This pattern applies to all card titles, descriptions, and interactive text. Section headers and eyebrows step down less aggressively (-0.05rem per breakpoint).

---

## 4. SPACING & LAYOUT

### Grid System

**Container:**
- Maximum width: `1440px` (desktop standard)
- Padding: `40px` left/right (desktop), `20px` (tablet), `16px` (mobile)
- Padding top/bottom varies by section (48px hero, 40-100px content)

**Card Grid (Persona Picker):**
```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);  /* Desktop */
  gap: 24px;                               /* Consistent spacing */
}
```

### Responsive Breakpoints

| Device | Width | Layout | Behavior |
|--------|-------|--------|----------|
| Mobile | < 768px | Single column, full-width cards | Touch-first, vertical scroll, no hover effects (prefers-reduced-motion) |
| Tablet | 768px – 1023px | 2-column grid | Hybrid touch/keyboard, flexible card sizing, subtle hover (if mouse detected) |
| Desktop | ≥ 1024px | 3-column grid, full sidebar nav | Full interactions, hover states, keyboard shortcuts enabled |

**Media Query Pattern:**
```css
/* Mobile-first approach */
.card-grid { grid-template-columns: 1fr; }

@media (min-width: 768px) {
  .card-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1024px) {
  .card-grid { grid-template-columns: repeat(3, 1fr); }
}
```

### Container Queries (2026 Standard)

Container queries (96% browser support) allow components to respond to their container's size rather than the viewport. This is the correct model for reusable card components.

**Rule:** Card components use container queries. Page-level layout uses media queries. This separation keeps components portable across different page layouts.

```css
/* Define the container */
.card-grid {
  container-type: inline-size;
  container-name: card-grid;
}

/* Components respond to container, not viewport */
@container card-grid (min-width: 600px) {
  .card { flex-direction: row; }
  .card-glass { width: 40%; }
}

@container card-grid (min-width: 900px) {
  .card-grid { grid-template-columns: repeat(3, 1fr); }
}
```

**Migration:** Refactor existing card grid to use `container-type: inline-size` on the parent. Convert card-level `@media` queries to `@container` queries. Keep page-level layout media queries as-is.

### Spacing Scale

Use a consistent spacing scale across padding, margins, and gaps:

| Unit | Value | Usage |
|------|-------|-------|
| xs | 4px | Icon spacing, minimal gaps |
| sm | 8px | Small padding, tight spacing |
| md | 16px | Standard padding, section gaps |
| lg | 24px | Card gaps, section spacing |
| xl | 32px | Major section padding |
| 2xl | 40px | Hero padding, container margins |
| 3xl | 48-60px | Full section spacing |

**In Practice:**
```css
/* Persona cards gap: 24px (lg) */
.card-grid { gap: 24px; }

/* Card internal padding: 18px top/bottom, 22px sides (custom) */
.card-glass { padding: 18px 22px 22px; }

/* Section padding: 40px (2xl) */
.persona-section { padding: 0 40px 100px; }
```

---

## 5. GLASSMORPHISM & EFFECTS

### Glass Panel Implementation

**Definition:** Semi-transparent panels with `backdrop-filter: blur()` creating a "frosted glass" effect that reveals the layer beneath.

**Card Glass Panel (Persona Cards):**
```css
.card-glass {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 18px 22px 22px;

  /* Core glassmorphism */
  background: rgba(10, 8, 6, 0.45);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);

  /* Border treatment */
  border-top: 1.5px solid rgba(255,255,255,0.18);
  transition: background 0.5s ease, border-top-color 0.4s ease;
}

/* Fallback for browsers without backdrop-filter support */
@supports not (backdrop-filter: blur(14px)) {
  .card-glass {
    background: rgba(10, 8, 6, 0.85);  /* More opaque fallback */
  }
}
```

**Lead-in Glass (Hero Section):**
```css
.lead-glass {
  display: inline-block;
  padding: 32px 48px;
  border-radius: 20px;
  background: rgba(26, 20, 16, 0.35);
  backdrop-filter: blur(16px) saturate(1.3);
  -webkit-backdrop-filter: blur(16px) saturate(1.3);
  border: 1px solid rgba(255,255,255,0.06);
}

@supports not (backdrop-filter: blur(1px)) {
  .lead-glass {
    background: rgba(26, 20, 16, 0.82);
  }
}
```

### Card Styling

**At Rest:**
- Border: Persona-color at 25% opacity, 2px
- Bottom gradient: Persona-tinted (8-10% saturation) → dark black
- Glass panel: Subtle backdrop blur, neutral top border
- Box shadow: None (clean minimalism)

**On Hover:**
- Border: Brightens to 28% opacity
- Glass panel: Background darkens, top border becomes persona-color at 30% opacity
- Glow ring: 40-80px persona-colored box-shadow appears (outer ring)
- Image: 1.06x scale, slight brightness boost, increased saturation
- Text: Hook text fades in, name grows slightly

**CSS Example:**
```css
.card {
  border: 1px solid rgba(255,255,255,0.14);
  transition: border-color 0.4s ease, box-shadow 0.4s ease;
}

.card:hover {
  border-color: rgba(255,255,255,0.28);
}

.card.evaluator::after {
  box-shadow: 0 0 40px rgba(123,154,204,0.35), 0 0 80px rgba(123,154,204,0.15);
}

.card.evaluator:hover .card-glass {
  border-top-color: rgba(123,154,204,0.3);
}
```

### Liquid/Frosted Glass Patterns

**Overlay Gradients:**
- Bottom glass panels use layered gradients: persona-tint at bottom (highest saturation) → black (lowest)
- Creates depth illusion where glass appears to "float" over character image
- Height: 60% of card bottom (persona cards)

**Accent Threads:**
- Subtle persona-colored top borders on glass panels (30% opacity)
- Brighten to full opacity on hover/selected state
- Creates visual continuity between card and panel

---

## 6. ANIMATION STANDARDS

### Motion Tokens (2026 Standard)

All animation durations and easing curves are defined as CSS custom properties. These values already exist in the codebase — tokenizing them makes them referenceable and consistent.

```css
:root {
  /* Durations */
  --duration-instant: 100ms;   /* Micro-interactions (focus ring, active state) */
  --duration-fast: 300ms;      /* Hover feedback, opacity changes */
  --duration-base: 500ms;      /* Component transitions, card hover */
  --duration-slow: 800ms;      /* Entrance animations, section reveals */
  --duration-hero: 2200ms;     /* Hero text reveal (signature animation) */

  /* Easing curves */
  --ease-default: ease;
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-smooth: cubic-bezier(0.22, 1, 0.36, 1);    /* Persona card hover */
  --ease-reveal: cubic-bezier(0.25, 0.46, 0.45, 0.94); /* Text clip-path reveal */
}
```

**Rule:** All new animations reference motion tokens, never hardcoded values. "The card hover uses `var(--duration-base)` with `var(--ease-smooth)`" — not "500ms cubic-bezier(0.22, 1, 0.36, 1)."

### Transition Defaults

| Property | Duration Token | Easing Token | Use Case |
|----------|---------------|-------------|----------|
| Hover state (color, opacity) | `--duration-fast` | `--ease-out` | Interactive feedback |
| Hover state (transform) | `--duration-base` | `--ease-smooth` | Smooth lift effect |
| Text reveal (entrance) | `--duration-hero` | `--ease-reveal` | Clip-path animation |
| Gradient shift (infinite) | 4s | `--ease-in-out` | Shimmer loop |
| Fade transitions | `--duration-fast` | `--ease-default` | Opacity changes |

### Hover Effects

**Card Lift:**
```css
.card:hover .card-image img {
  transform: scale(1.06);
  filter: contrast(1.05) saturate(1.1) brightness(1.05);
  transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
```

**Glow Effect:**
```css
.card::after {
  content: '';
  position: absolute;
  inset: -3px;
  opacity: 0;
  transition: opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1);
  z-index: -1;
}

.card:hover::after {
  opacity: 1;
}

/* Per-persona glow color */
.evaluator::after {
  box-shadow: 0 0 40px rgba(123,154,204,0.35), 0 0 80px rgba(123,154,204,0.15);
}
```

### Text Reveal Patterns

**"Reshapes Itself" Animation (Hero Section):**

Three-part sequence on emphasized text (`<em>` tag):

1. **Clip-path reveal** (L→R): Text hidden via `clip-path: inset(0 100% 0 0)`, animates to `inset(0 0 0 0)`
2. **Gradient shimmer**: Background gradient at 200% width, animates position for flowing color shift
3. **Underline draw-on**: After-pseudo-element starts at width 0, animates to full width

```css
.lead-hook em {
  background: linear-gradient(90deg,
    var(--em-color-1, #e0952a) 0%,
    var(--em-color-2, #f0b050) 25%,
    var(--em-color-1, #e0952a) 50%,
    var(--em-color-3, #d4822a) 75%,
    var(--em-color-1, #e0952a) 100%
  );
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  clip-path: inset(0 100% 0 0);
  animation: textReveal 2.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) 1.2s forwards,
             gradientShift 4s ease-in-out 3.4s infinite;
}

.lead-hook em::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 0;
  height: 1.5px;
  background: linear-gradient(90deg, var(--em-color-1), var(--em-color-2));
  border-radius: 1px;
  animation: underlineDraw 1.0s ease-out 3.4s forwards;
}

@keyframes textReveal {
  to { clip-path: inset(0 0 0 0); }
}

@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes underlineDraw {
  to { width: 100%; }
}
```

### Entrance Animations

**Staggered Card Entrance:**
```css
.card:nth-child(1) { animation: cardIn 0.6s ease-out 0.6s forwards; }
.card:nth-child(2) { animation: cardIn 0.6s ease-out 0.72s forwards; }
/* ... continues with 0.12s stagger */

@keyframes cardIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
```

**Fade-up with Stagger:**
```css
.lead-hook { animation: fadeUp 0.9s ease-out 0.3s forwards; }
.lead-cta { animation: fadeUp 0.9s ease-out 0.55s forwards; }

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### View Transitions API (2026 Standard)

The View Transitions API enables animated page transitions and element morphs during navigation. Widely supported and production-deployed at scale. Perfect for two transitions on this site:

1. **Persona card selection → persona page:** The selected card morphs into the hero of the destination page.
2. **Blog list → blog post:** The blog card title morphs into the article title.

```css
/* Mark elements that should morph between pages */
.card.evaluator {
  view-transition-name: evaluator-card;
}

/* On the destination page */
.hero-evaluator {
  view-transition-name: evaluator-card;
}

/* Customize the transition animation */
::view-transition-old(evaluator-card) {
  animation: var(--duration-base) var(--ease-smooth) fade-out;
}

::view-transition-new(evaluator-card) {
  animation: var(--duration-base) var(--ease-smooth) fade-in;
}
```

**Rule:** Use for page-to-page transitions where an element has a clear visual counterpart on both pages. Don't use for every navigation — that becomes a template tell (see AUTHENTICITY-STANDARDS.md §5.4).

### @property for Gradient Animations (2026 Standard)

CSS `@property` (universal support) enables animating individual gradient color stops — something previously impossible without JavaScript. Upgrade the shimmer effect:

```css
@property --shimmer-pos {
  syntax: '<percentage>';
  initial-value: 0%;
  inherits: false;
}

.lead-hook em {
  background: linear-gradient(
    90deg,
    var(--em-color-1) var(--shimmer-pos),
    var(--em-color-2) calc(var(--shimmer-pos) + 25%),
    var(--em-color-1) calc(var(--shimmer-pos) + 50%)
  );
  animation: shimmer 4s var(--ease-in-out) infinite;
}

@keyframes shimmer {
  to { --shimmer-pos: 100%; }
}
```

**Benefit:** Smoother gradient animation, less GPU compositing than `background-position` hacks. The current shimmer effect works; this is a quality upgrade.

### Scroll-Driven Animations (2026 Standard)

Scroll-driven animations (83-85% support) tie animation progress to scroll position. Use as **progressive enhancement** — content sections fade in on scroll without JavaScript scroll listeners.

```css
/* Content sections fade in as they scroll into view */
.content-section {
  animation: fade-up linear both;
  animation-timeline: view();
  animation-range: entry 0% entry 40%;
}

@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Feature detection — only apply if supported */
@supports (animation-timeline: view()) {
  .content-section {
    opacity: 0; /* Start hidden, scroll reveals */
  }
}
```

**Rules:**
- Always wrap in `@supports (animation-timeline: view())` — content must be visible without JavaScript or scroll support.
- Be selective. Not every section needs scroll-driven entrance. AUTHENTICITY-STANDARDS.md §5.4 flags "fade-up on every element" as an AI tell.
- Use for 2-3 key content sections per page maximum.

### Prefers-Reduced-Motion Handling

**Must apply to every animated element:**

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Every page must include this rule. Animations should resolve to instant completion without removal (users can still see final state).

---

## 7. COMPONENT PATTERNS

### Persona Cards

**Structure:**
```html
<div class="card evaluator">
  <div class="card-image">
    <picture>
      <source srcset="evaluator-merritt.webp" type="image/webp">
      <img src="evaluator-merritt.png" alt="Merritt Hunter, 34-year-old recruiter">
    </picture>
  </div>
  <div class="card-glass">
    <div class="card-title">Recruiter · Hiring Manager</div>
    <div class="card-name">Merritt Hunter</div>
    <div class="card-hook">I've got a Job to be Done — is Kiran my guy?</div>
  </div>
</div>
```

**Design Notes:**
- Aspect ratio: 3:4 portrait (taller than wide, fits full character body)
- Image: 3:4 portrait orientation, optimized WebP + PNG fallback
- Glass panel: Bottom 30% of card, positioned absolute
- Text hierarchy: Title (small, uppercase, accent color) → Name (large, serif, white) → Hook (italic, muted, hidden until hover)

### Navigation

**Top Navigation:**
- Minimal: Theme toggle (sun/moon), Share button, Menu
- Buttons: 42px circular with 2.5px border, text-primary color
- Hover: Opacity 0.8, subtle transform on icon
- Mobile: Hamburger menu icon, slide-out vertical menu

**Mobile Menu:**
- Fixed overlay, full height, dark background
- Menu items: Left-arrow prefix, left-aligned, pointer-friendly spacing
- Dismiss: X button top-right, Escape key, click outside
- Animation: Slide from right, 0.3s ease

### Buttons & CTAs

**Primary Button:**
```css
.cta-button {
  background: var(--text-primary);
  color: var(--bg-primary);
  border: 2.5px solid var(--text-primary);
  padding: 12px 24px;
  border-radius: 25px;
  font-weight: 600;
  font-size: 15px;
  transition: all 0.3s ease;
  cursor: pointer;
}

.cta-button:hover {
  opacity: 0.85;
  transform: translateY(-2px);
}
```

**Button Sizes:**
- Small: 12px padding
- Default: 12-16px padding
- Large: 16-20px padding
- Always: 44×44px minimum click target (44px height, min 44px width + padding)

### Toast Notifications

**Selection Toast (Persona Picker):**
```css
.toast {
  position: fixed;
  bottom-right: 20px;
  padding: 16px 24px;
  background: rgba(0,0,0,0.8);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 12px;
  color: var(--text-cream);
  font-size: 14px;
  animation: slideUp 0.5s ease;
  opacity: 0;
  animation: fadeInOut 0.5s ease forwards;
}

@keyframes fadeInOut {
  0% { opacity: 0; transform: translateY(10px); }
  50% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(10px); }
}
```

### Modals

**Share Modal:**
- Fixed overlay: `background: rgba(0, 0, 0, 0.85)`, `backdrop-filter: blur(12px)`
- Content box: Rounded 20px, padding 32px, max-width 400px
- Close button: X top-right, subtle on hover
- Grid of share options (3 columns): Icon buttons, hover lift effect
- Animation: Slide up from bottom, 0.3s ease

**Focus Management:**
- Focus trapped within modal while open
- Focus returned to trigger button on close
- Escape key closes modal

---

## 8. IMAGERY

### Midjourney Aesthetic

**Character Portraits (Persona Cards):**
- Orientation: 3:4 portrait (taller than wide)
- Framing: Three-quarter body, slight angle toward camera, confident pose
- Lighting: Persona-colored accent lighting (warm key light, cool rim light creating colored glow)
- Diversity Matrix: 6 unique ethnicities + genders, no demographic overlap
- Props: Character-relevant (tablet for recruiter, whiteboard for founder, etc.)
- Background: Soft studio blur, no distracting elements

**Generation Specs:**
```
Midjourney Prompt Pattern:
"Portrait of [name], [age], [role], [clothing], [pose], [lighting],
studio lighting, professional photography, 3:4 aspect ratio,
accent lighting in [persona color], soft background blur,
cinematic depth, --ar 3:4 --q 2 --s 750"
```

### Image Optimization

**Format Strategy (2026 Standard):**
- **Primary:** AVIF (92-95% browser support, ~30% smaller than WebP, ~80% smaller than PNG)
- **Fallback 1:** WebP (modern browsers)
- **Fallback 2:** PNG (legacy browsers)
- Load via `<picture>` element with `<source>` tags in priority order

**File Sizes:**
- Original Midjourney PNGs: ~44MB total (7MB per character)
- Optimized AVIF: ~400KB total (~65KB per character)
- Optimized WebP: ~600KB total (~100KB per character)
- Compression tools: Squoosh (AVIF encoding), ImageOptim, or libavif CLI

**HTML Pattern:**
```html
<picture>
  <source srcset="evaluator-merritt.avif" type="image/avif">
  <source srcset="evaluator-merritt.webp" type="image/webp">
  <img src="evaluator-merritt.png"
       alt="Merritt Hunter, 34-year-old recruiter and hiring manager"
       loading="lazy"
       decoding="async">
</picture>
```

**Hero Image Priority:**
```html
<!-- Hero images get fetchpriority="high" and no lazy loading -->
<img src="hero.avif"
     alt="..."
     fetchpriority="high"
     decoding="async">
```

**Rules:**
- Hero/above-fold images: `fetchpriority="high"`, no `loading="lazy"`
- Below-fold images: `loading="lazy"`, `decoding="async"`
- Generate AVIF versions for all new images. Backfill existing images during content refresh cycles.

**Lazy Loading:**
```html
<img src="..." alt="..." loading="lazy" decoding="async">
```

### OG Card Design

**Specs:**
- Dimensions: 1200×630px (standard OG image size)
- Format: PNG or JPEG (<200KB)
- Safe text zone: Title must be readable at ~400px wide
- Layout: Dark background (persona-tinted), title center or top, author/read time bottom

**Per Type:**
- **Blog posts:** Title, series badge, subtitle, author name, read time
- **Teardowns:** Company name, teardown tagline, "How I'd've Built It" series marker
- **Prototypes:** Project name, one-line description
- **Generic pages:** Page title and brief descriptor

**Process:** Auto-generated during deploy, never manual afterthought.

---

## 9. ACCESSIBILITY

### WCAG 2.2 AA Compliance
<!-- check_id: vis-a11y — comprehensive WCAG 2.2 AA: missing lang attr, skip-link, alt text, form labels, SVG aria, heading hierarchy, link text -->

**Baseline requirement.** Every design decision must pass accessibility audit.

### Contrast Ratios

**Text Contrast (Minimum 4.5:1):**
- Body text on dark background: `#e8dcc8` on `#0a0a0a` = 10.1:1 ✓ Excellent
- Secondary text on dark background: `#a08868` on `#0a0a0a` = 5.1:1 ✓ Pass
- Persona accent colors (title text): All ≥ 5.1:1 against dark backgrounds ✓ Pass
- Muted secondary text: If ratio < 4.5:1, bump color up or add weight

**Large Text Contrast (Minimum 3:1):**
- Heading text (≥24px or ≥19px bold): All exceed 3:1 ✓ Pass

**APCA Contrast Documentation (Future-Proofing for WCAG 3.0):**

Run the full color palette through the APCA (Accessible Perceptual Contrast Algorithm) calculator alongside WCAG 2.x checks. Document both values.

| Color Pair | WCAG 2.x Ratio | APCA Lc Value | Status |
|---|---|---|---|
| `#e8dcc8` on `#0a0a0a` | 10.1:1 | Lc ~85 | Exceeds both |
| `#a08868` on `#0a0a0a` | 5.1:1 | Lc ~55 | Passes WCAG, borderline APCA for body text |

APCA doesn't change any current design decisions — all persona colors already pass. But documenting APCA values now means the transition to WCAG 3.0 is a documentation update, not a design audit.

**Testing:** Use WebAIM Contrast Checker (WCAG 2.x) and Myndex APCA calculator (WCAG 3.0 preview) or Deque axe DevTools.

### Focus Styles

**Visible Focus Outline (Required):**
```css
a:focus,
button:focus,
[role="button"]:focus,
input:focus,
textarea:focus,
select:focus {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}

/* Keyboard-only focus (don't show on click) */
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

**Rules:**
- Never remove default focus outline
- Minimum outline width: 2px
- Outline color must contrast with background (test with Contrast Checker)
- Focus order follows visual reading order (use `tabindex` sparingly)

### Skip Links

**First focusable element:**
```html
<a href="#main-content" class="skip-link">Skip to main content</a>
```

**CSS:**
```css
.skip-link {
  position: absolute;
  left: -9999px;
  z-index: 999;
}

.skip-link:focus {
  left: 50%;
  transform: translateX(-50%);
  top: 0;
  /* Make visible and accessible */
  background: var(--text-primary);
  color: var(--bg-primary);
  padding: 12px 20px;
  border-radius: 0 0 12px 12px;
}
```

### Images

**Alt Text Requirements:**
- Every `<img>` must have `alt` attribute (never empty unless decorative)
- Descriptive: "Merritt Hunter, 34-year-old recruiter" not "persona.jpg"
- Decorative images: `alt=""` (empty string) + `aria-hidden="true"`

**Example:**
```html
<!-- Informational -->
<img src="evaluator-merritt.webp"
     alt="Merritt Hunter, 34-year-old recruiter and hiring manager in charcoal blazer">

<!-- Decorative -->
<svg aria-hidden="true" focusable="false">...</svg>
```

### SVGs
<!-- check_id: vis-svg-root-override — detects :root selectors inside SVG elements (breaks theme toggle) -->
<!-- check_id: vis-svg-class-prefix — ensures all SVG class names are prefixed with wf- or dg- -->
<!-- check_id: vis-svg-text-overlap — checks vertical spacing between SVG text elements within 20px horizontally -->
<!-- check_id: vis-wireframe-sizing — verifies .wireframe-box has max-width: 340px -->
<!-- check_id: vis-journey-bezier — detects quadratic bezier (Q/T) in paths. Journey maps must use cubic (C) -->

**Informational SVGs (diagrams, icons):**
```html
<svg role="img" aria-label="Customer journey from awareness to advocacy">
  <title>Customer Journey Diagram</title>
  <desc>Shows sentiment curve through 5 journey stages...</desc>
  ...
</svg>
```

**Decorative SVGs (next to visible text):**
```html
<svg aria-hidden="true" focusable="false">...</svg>
```

**Class Naming (avoid conflicts):**
- Prefix diagram SVG classes with `dg-` (e.g., `.dg-step-badge`)
- Prefix wireframe SVG classes with `wf-` (e.g., `.wf-phone-frame`)

### Visualization Spacing
<!-- check_id: vis-label-overlap — checks sentiment label positions relative to circles (min 6px clearance) -->
<!-- check_id: vis-annotation-sizing — verifies annotation/callout rect boxes have 10px padding around text -->

Visual elements like sentiment labels and annotation boxes must maintain minimum clearance and padding to ensure readability and visual hierarchy.

### Keyboard Navigation

**Requirements:**
- All interactive elements reachable via Tab key
- Focus order flows left→right, top→bottom
- No keyboard traps (Tab must always move forward)
- Enter/Space activates buttons
- Escape closes modals/menus

**Testing:** Tab through entire page without mouse.

### Headings & Structure

**Hierarchy Rules:**
- One `<h1>` per page (usually in hero)
- Follow order: h1 → h2 → h3 (never skip levels)
- Semantic HTML: `<nav>`, `<main>`, `<article>`, `<section>`, `<header>`, `<footer>`

```html
<main id="main-content">
  <h1>Page Title</h1>
  <section>
    <h2>Section Heading</h2>
    <h3>Subsection</h3>
  </section>
</main>
```

### Forms

**Label Association:**
```html
<label for="email-input">Email Address</label>
<input id="email-input" type="email" required>

<!-- Error message association -->
<input aria-describedby="email-error">
<span id="email-error" role="alert">Invalid email format</span>
```

### Reduced Transparency (2026 Standard)

Add `prefers-reduced-transparency` media query for glass panels. Users who request less visual complexity get increased opacity — content becomes easier to read against complex backgrounds.

```css
@media (prefers-reduced-transparency: reduce) {
  .card-glass {
    background: rgba(10, 8, 6, 0.85);  /* Much more opaque */
    backdrop-filter: none;               /* Remove blur effect */
  }

  .lead-glass {
    background: rgba(26, 20, 16, 0.90);
    backdrop-filter: none;
  }

  .glass-panel {
    background: rgba(26, 20, 16, 0.90);
    backdrop-filter: none;
  }
}
```

**Rule:** Every `backdrop-filter` element must have a `prefers-reduced-transparency` override. This complements the existing `@supports not (backdrop-filter)` fallbacks but serves a different user need — the `@supports` fallback is for browser capability, the `prefers-reduced-transparency` override is for user preference.

### Color Alone

**Never use color alone to convey meaning.** Always pair with:
- Text label ("Error: field required")
- Icon (✓ for success, ✗ for error)
- Pattern (dashed vs solid border)

---

## 10. COMPONENT LIBRARY PATTERNS

### CSS Cascade Layers (2026 Standard)

All CSS is organized into cascade layers (96%+ browser support). Layers eliminate specificity conflicts as the site grows. No visual change — this is architectural hygiene.

```css
/* Layer order declaration — earlier layers have lower priority */
@layer reset, tokens, base, components, utilities;

@layer reset {
  /* CSS reset / normalize */
}

@layer tokens {
  :root {
    --bg-primary: #0a0a0a;
    --text-cream: #e8dcc8;
    /* ... all design tokens */
  }
}

@layer base {
  /* Element-level styles: body, h1-h6, p, a, etc. */
}

@layer components {
  /* .card, .glass-panel, .cta-button, .modal, etc. */
}

@layer utilities {
  /* .text-center, .text-muted, .rounded-lg, etc. */
}
```

**Rule:** Every new CSS rule goes in its layer. Utility classes always win over component styles (higher layer). No `!important` needed.

**Migration:** Wrap existing CSS in the appropriate `@layer` blocks. This can be done incrementally — unlayered CSS has higher priority than layered CSS, so existing styles won't break during migration.

### Reusable Classes

**Utility Classes (use sparingly):**
```css
.text-center { text-align: center; }
.text-muted { color: var(--text-muted); }
.bg-secondary { background: var(--bg-secondary); }
.rounded-lg { border-radius: 12px; }
.rounded-xl { border-radius: 20px; }
.shadow-sm { box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.shadow-md { box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
```

**Card Patterns:**
```css
.card-base {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 24px;
  transition: all 0.3s ease;
}

.card-base:hover {
  border-color: rgba(255,255,255,0.28);
  transform: translateY(-2px);
}
```

**Glass Panel Base:**
```css
.glass-panel {
  background: rgba(26, 20, 16, 0.35);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 20px;
}

@supports not (backdrop-filter: blur(1px)) {
  .glass-panel {
    background: rgba(26, 20, 16, 0.82);
  }
}
```

---

## 11. DELTA TO WORLD CLASS

Research: Apple Human Interface Guidelines, Material Design 3, Linear Design System, Vercel Design System, Radix UI primitives.

### What We Have vs. Best-in-Class

| Aspect | Current | Best-in-Class | Gap |
|--------|---------|---------------|-----|
| **Color System** | 6 persona colors + basic UI palette | Full token system (50+ semantic colors) | Medium — we have brand colors, missing semantic expansion |
| **Typography** | 2 font families, manual scale | Typographic scale token system | Medium — manual scaling works now, scale could be tokenized |
| **Spacing** | Ad-hoc padding/margin values | 12-step spacing scale as tokens | Low — we use consistent values, not yet tokenized |
| **Components** | Individual styled elements | Reusable component library (CSS or web components) | High — no component library yet |
| **Animation** | Hover/entrance effects | Comprehensive motion language (timing, easing, physics) | Medium — we have good defaults, no formal language |
| **Dark Mode** | Architecture ready, not implemented | Full light/dark theme system with toggle | High — architecture prepared, UI not built |
| **Icon System** | Emoji + inline SVG (inconsistent) | Consistent icon set (Material Icons, Feather, custom) | High — no icon system |
| **Documentation** | This file + inline comments | Storybook, Figma, living component docs | High — no external documentation |

### Quick Wins

These add up to production-grade design infrastructure:

**1. CSS Custom Properties (Tokenization):**
Already partially done. Expand systematically:

```css
:root {
  /* Colors */
  --color-primary: #0a0a0a;
  --color-secondary: #231c14;
  --color-accent-evaluator: #7B9ACC;
  /* ... all persona colors */

  /* Typography */
  --font-serif: 'Playfair Display', Georgia, serif;
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-size-xs: 12px;
  --font-size-sm: 13px;
  --font-size-base: 16px;
  --font-size-lg: 18px;
  --font-size-xl: 21px;
  --font-size-2xl: 28px;
  --font-size-3xl: 38px;
  --line-height-tight: 1.2;
  --line-height-base: 1.5;
  --line-height-relaxed: 1.75;

  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-2xl: 40px;
  --spacing-3xl: 48px;

  /* Transitions */
  --transition-fast: 200ms;
  --transition-base: 300ms;
  --transition-slow: 500ms;
  --easing-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --easing-smooth: cubic-bezier(0.22, 1, 0.36, 1);
}
```

**Effort:** 2 hours. **Impact:** High — reduces manual tweaking, enables future dark mode, improves maintainability.

**2. Dark Mode Implementation:**

Toggle button already exists in nav. Build light mode variant:

```css
[data-theme="light"] {
  --color-primary: #f8f6f3;
  --color-secondary: #ede9e3;
  --color-text: #0a0a0a;
  /* ... continue for all tokens */
}

/* Toggle logic in JS */
document.documentElement.dataset.theme = localStorage.getItem('theme') || 'dark';
```

**Effort:** 3-4 hours. **Impact:** High — expands audience (accessibility + preference), differentiates from templates.

**3. Icon System:**

Replace emoji tooltips + ad-hoc SVG with consistent icon set:

```
Option A: Feather Icons (18px, 2px stroke, clean)
Option B: Material Icons (24px, filled + outlined)
Option C: Custom set (matches brand warmth)

Recommendation: Feather Icons (lightweight, on-brand aesthetic)
```

**Implementation:**
```html
<!-- One SVG sprite file, referenced via <use> -->
<svg class="icon">
  <use xlink:href="icons.svg#arrow-right"></use>
</svg>

/* Styles */
.icon {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  stroke-width: 2;
  fill: none;
}
```

**Effort:** 2-3 hours. **Impact:** Medium — improves UI consistency, reduces visual noise.

### Medium-Term Improvements

**1. Component Library:**

Build a lightweight CSS component library (no JS framework overhead):

```
/components/
  ├── button.css
  ├── card.css
  ├── modal.css
  ├── form.css
  ├── navigation.css
  └── _base.css (tokens + resets)
```

Export to npm or vendor locally. Document in README with usage patterns.

**Effort:** 1-2 weeks. **Impact:** High — reduces duplication, speeds up new page builds, enables scaling.

**2. Motion Language:**

Formalize animation guidance:

```css
/* Timing */
--duration-instant: 100ms;    /* Micro-interactions */
--duration-fast: 300ms;        /* Hover, focus feedback */
--duration-base: 500ms;        /* Component transitions */
--duration-slow: 1000ms;       /* Page entrance, hero reveals */

/* Easing */
--easing-ease-in: cubic-bezier(0.4, 0, 1, 1);
--easing-ease-out: cubic-bezier(0, 0, 0.2, 1);
--easing-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--easing-smooth: cubic-bezier(0.22, 1, 0.36, 1);  /* Persona hover */
```

Document rules: "Entrance animations use slow timing + ease-out. Hover effects use base timing + smooth easing."

**Effort:** 4 hours. **Impact:** Medium — improves perceived performance, feels more intentional.

**3. Storybook Documentation:**

Add Storybook (or lightweight alternative like Histoire) to document all components:

```bash
npm install storybook
npx storybook init
```

Create stories for:
- Persona cards (all 6 personas)
- Buttons (sizes, states)
- Forms (inputs, labels, errors)
- Modals
- Navigation

**Effort:** 1 week. **Impact:** High — enables collaboration, onboards future contributors, proves component maturity.

### Long-Term Vision

**1. Design Token Pipeline (W3C DTCG Format — Spec Stable Since Oct 2025):**

Define tokens in W3C Design Tokens Community Group JSON format. Use Style Dictionary to generate CSS custom properties at build time. Do this when building light mode — the token pipeline makes light/dark mode generation systematic rather than manual.

```json
{
  "$type": "color",
  "color": {
    "primary": { "$value": "#0a0a0a", "$description": "Main background" },
    "accent": {
      "evaluator": { "$value": "oklch(0.68 0.08 250)", "$description": "Steel Blue" }
    }
  },
  "typography": {
    "heading": {
      "font-family": { "$value": "Playfair Display", "$type": "fontFamily" },
      "font-size": { "$value": "38px", "$type": "dimension" }
    }
  },
  "duration": {
    "fast": { "$value": "300ms", "$type": "duration" },
    "base": { "$value": "500ms", "$type": "duration" }
  }
}
```

**Pipeline:** `tokens.json` → Style Dictionary → CSS custom properties + JSON for JS components. Single source of truth across web, Scannibal, and Command Center.

**Timing:** When light mode is the active project. The token pipeline makes theme generation a configuration change, not a manual CSS pass.

**2. Cross-Platform Consistency:**

Extend design system to:
- **Scannibal** (AI chat interface): Reuse persona colors, glassmorphism, typography
- **Command Center** (admin dashboard): Reuse spacing, icons, form patterns
- **Mobile app** (future): Reuse color palette, component logic (adapted for mobile)

**3. Accessibility Automation:**

- Lighthouse CI integration (catch contrast violations, accessibility issues)
- Automated contrast testing in CI/CD
- axe DevTools integration for PR reviews

---

## 12. IMPLEMENTATION CHECKLIST

Use this when adding new pages or updating existing ones:

### Design Audit

- [ ] Color palette uses only defined values (personas + UI palette)
- [ ] Typography follows scale (no arbitrary font-sizes)
- [ ] Spacing uses scale units (4px, 8px, 16px, 24px, 32px, 40px)
- [ ] All glass panels include `@supports not` fallback
- [ ] Hover states consistent across similar elements
- [ ] Glassmorphism not overused (accents only, not entire layout)
- [ ] Dark mode prepared (CSS variables extensible to `[data-theme="light"]`)

### Animation Audit

- [ ] All animations respect `prefers-reduced-motion`
- [ ] Entrance animations have stagger (not simultaneous)
- [ ] Hover effects use consistent timing (300-500ms for color, 500-600ms for transform)
- [ ] Motion serves clarity (not gratuitous)
- [ ] Touch devices disable hover-only interactions

### Accessibility Audit

- [ ] Skip link present and functional
- [ ] All interactive elements keyboard accessible
- [ ] Focus outline visible (2px, contrasting color, 2px offset)
- [ ] Heading hierarchy correct (h1 → h2 → h3, no skips)
- [ ] Images have descriptive alt text (not filenames)
- [ ] SVGs have `aria-label` (informational) or `aria-hidden="true"` (decorative)
- [ ] Color contrast ≥ 4.5:1 for text, ≥ 3:1 for large text
- [ ] Form inputs have associated `<label>` elements
- [ ] Semantic HTML used (`<nav>`, `<main>`, `<article>`, etc.)
- [ ] Link text meaningful out of context (no "click here")

### Performance Audit

- [ ] Images optimized (WebP primary, PNG fallback, <100KB per image)
- [ ] CSS critical path inlined, non-critical deferred
- [ ] JavaScript deferred (no render-blocking scripts)
- [ ] No layout shifts (content area spacing reserved)
- [ ] Lazy loading on images below fold

---

## CLOSING NOTES

This design system is living. As the site evolves, patterns will be discovered that warrant documentation. When that happens:

1. **Add to this file.** Don't create separate pattern docs.
2. **Update examples** with real code from production.
3. **Test across breakpoints.** Document gotchas (e.g., "glass blur behaves differently on Safari iOS").
4. **Version this file** in git. Note major changes (layout, color system, component additions) in commits.

The goal: **One source of truth** for visual standards. When a question arises ("What color should this be?" "How long should this animation last?"), the answer lives here.

---

*Last updated: March 20, 2026*
*Maintained by: Claude Code for kiranrao.ai*
*Research brief recommendations integrated: container queries, CSS @layer, AVIF/fetchpriority, motion tokens, oklch color space, variable fonts, View Transitions API, @property gradients, scroll-driven animations, W3C design tokens, APCA contrast, prefers-reduced-transparency.*
