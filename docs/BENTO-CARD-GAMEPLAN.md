# Bento Card System — Progress & Gameplan

**Last updated:** March 28, 2026 (Session 10 — mobile/tablet lockdown)
**Status:** Mobile/tablet LOCKED. Desktop has 22 gradient-fallback slots awaiting MJ art.

---

## What Got Done This Session

### Mobile & Tablet (LOCKED)
- **Single-column layout** at ≤1024px with bottom-bar glassmorphism overlays
- **Every card shows an image on mobile** regardless of persona — `mobileImageOverrides` covers all 9 cards
- **Dedicated mobile images** for blog (`blogmobile.png`) and learning (`learnermobile.png`)
- **Shortened copy** made universal: all descriptions are now tight one-liners everywhere
- **Heading font reduced** to 1.3rem (tablet) / 1.2rem (phone) so every title fits one line
- **Overlay compressed** — padding halved, gaps near-zero, line-heights tightened to show more art
- **`<br>` tags hidden** via CSS at mobile breakpoints

### Persona System Integration
- Cards wired to persona ranking — slot order = priority order per persona
- Mobile overrides target `data-card` (not slot), so they work with all persona configs
- **Hover interaction** — `::before` pseudo-element shows persona accent color stroke on mouseover
- `applyMobileOverrides()` auto-runs after every persona switch via wrapped `switchBentoCards`

### Morph Choreography Fix
- `.manifesto-section` and `.numbers-section` wired into picker-mode hide, persona-active show, morph-content-in animations, morph-reverse, and prefers-reduced-motion
- Stagger timing: about (0s) → manifesto (0.12s) → metrics (0.24s) → work (0.36s) → contact (0.48s) → footer (0.6s)
- Cleanup timeout bumped from 1200ms → 1500ms

### Misc
- Removed decorative `"` from testimonials card overlay (`::before` pseudo-element)
- Fixed `background` shorthand resetting individual properties in `switchBentoCards`

---

## Current Desktop Image Coverage

**9 unique desktop images** serve **41 of 63** card+slot combos (65%).
**22 combos** (35%) show gradient fallbacks — these are the MJ work remaining.

### Per-Card Status

| Card | Character | Desktop Images | Slots Covered | Slots Missing | Mobile |
|------|-----------|---------------|---------------|---------------|--------|
| teardowns | Analyst (owl) | analyst-hero-2-1.png | hero ×2 | tall ×2, topright ×1, widel ×1 | ✅ |
| testimonials | Connector (quokka) | connector-square-1_1_2.png, learner-library1.png | topright ×2, center ×2, learning ×1 | wider ×2 | ✅ |
| studio | Artist (chinchilla) | studiocardwide3_1.png | widel ×5 | hero ×1, topright ×1 | ✅ |
| madlab | Tinkerer (meerkat) | tinkerer-hero-2-1-flipped.png | wider ×3 | hero ×1, tall ×3 | ✅ |
| career | Veteran (bear) | veteran-hero-2-1.png | hero ×2, tall ×1 | topright ×2, center ×1, wider ×1 | ✅ |
| underhood | Engineer (bulldog) | engineer2.png | center ×4 | wider ×1, widel ×1, blog ×1 | ✅ |
| now | Explorer (fox) | explorer2.png | now ×7 | — | ✅ |
| learning | Student (bush baby) | learner-library1.png | learning ×6 | topright ×1 | ✅ (learnermobile.png) |
| blog | Storyteller (orangutan) | blogging-monster2.png | blog ×6 | — | ✅ (blogmobile.png) |

---

## MJ Asset Gameplan — What to Generate

### Priority 1: High-Impact Gaps (appear in 2+ personas)

These gradient slots are visible to the most visitors.

| # | Card | Slot | Aspect | Personas Affected | MJ Prompt Approach |
|---|------|------|--------|-------------------|-------------------|
| 1 | **madlab** | tall | 3:2 | seeker, practitioner, innercircle | Tinkerer (meerkat) in workshop, vertical comp, tools/gadgets visible. `--ar 3:2` |
| 2 | **career** | topright | 1:1 | practitioner, innercircle | Veteran (bear) portrait, close-up with cityscape BG. `--ar 1:1` |
| 3 | **teardowns** | tall | 3:2 | evaluator, learner, technologist | Analyst (owl) at desk, deconstructed app screens around. `--ar 3:2` |
| 4 | **testimonials** | wider | 3:1 | practitioner, innercircle | Connector (quokka) with speech bubbles/people, wide scene. `--ar 3:1` |

### Priority 2: Single-Persona Gaps

| # | Card | Slot | Aspect | Persona | MJ Prompt Approach |
|---|------|------|--------|---------|-------------------|
| 5 | **studio** | hero | 2:1 | innercircle | Artist (chinchilla) in full creative studio, wide panoramic. `--ar 2:1` |
| 6 | **studio** | topright | 1:1 | technologist | Artist (chinchilla) portrait, paintbrush in hand. `--ar 1:1` |
| 7 | **madlab** | hero | 2:1 | technologist | Tinkerer (meerkat) with prototypes, wide lab scene. `--ar 2:1` |
| 8 | **career** | center | 1:1 | learner | Veteran (bear) square portrait, contemplative. `--ar 1:1` |
| 9 | **career** | wider | 3:1 | technologist | Veteran (bear) in panoramic office/meeting scene. `--ar 3:1` |
| 10 | **underhood** | wider | 3:1 | seeker | Engineer (bulldog) wide workshop, blueprints visible. `--ar 3:1` |
| 11 | **underhood** | widel | 3:1 | technologist | (same image as #10 can work — or flipped variant) |
| 12 | **underhood** | blog | 2:1 | learner | Engineer (bulldog) at desk, documentation/code on screens. `--ar 2:1` |
| 13 | **learning** | topright | 1:1 | learner | Student (bush baby) portrait with books/certificate. `--ar 1:1` |
| 14 | **teardowns** | widel | 3:1 | innercircle | Analyst (owl) panoramic, deconstructed interfaces. `--ar 3:1` |

### Summary: 14 New Images Needed

| Aspect Ratio | Count | Cards |
|-------------|-------|-------|
| 1:1 | 4 | career, studio, learning, teardowns |
| 3:2 | 2 | madlab, teardowns |
| 3:1 | 4 | testimonials, underhood ×2, career, teardowns |
| 2:1 | 3 | studio, madlab, underhood |

**Reuse opportunity:** underhood wider and widel are both 3:1 — one image (or a flipped variant) can fill both. Brings actual unique generations to ~13.

### MJ Generation Notes

- Use V6 prompts from `docs/BENTO-MONSTER-SCENES-V6.md` as base templates
- `--sref` with the orange blob monster for Pixar/monster DNA (all prompts)
- `--oref` with single animal image at `--ow 25` for character silhouette
- Keep compositions clean: 2-3 hero props, not cluttered
- Leave breathing room for glassmorphism overlay (bottom 30% of card)
- Overlay positions vary by slot — check `overlayPos` in cardData for each card+slot combo

---

## Files Modified This Session

| File | Changes |
|------|---------|
| `bento-cards.js` | Split background shorthand to individual props; added mobileImageOverrides for all 9 cards; added applyMobileOverrides(); shortened all descriptions; wrapped switchBentoCards to auto-apply mobile overrides |
| `styles.css` | Mobile single-column layout; bottom-bar overlays; compressed padding/gaps; heading font reduction; persona hover stroke; morph system wiring for manifesto+numbers; removed testimonials decorative quote |
| `persona-system.js` | Bumped morph cleanup timeout 1200→1500ms |
| `images/blogmobile.png` | New — dedicated mobile blog image (3072×1536, 2:1) |
| `images/learnermobile.png` | New — dedicated mobile learning image (2912×1632, ~16:9) |

---

## When You Pick This Up Again

1. Generate the 14 MJ images listed above (Priority 1 first — 4 images cover 8 persona slots)
2. Drop them in `/images/` with naming convention: `[character]-[slot]-[ratio].png` (e.g., `tinkerer-tall-3_2.png`)
3. Update `imageMap` in `bento-cards.js` — fill in the null slots with the new filenames
4. Test each persona on desktop to verify gradients are replaced
5. Mobile requires no changes — `mobileImageOverrides` already covers everything
