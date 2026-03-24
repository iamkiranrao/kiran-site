# Homepage Build Gameplan

**Created:** March 23, 2026
**Last Updated:** March 24, 2026
**Status:** Active — significant progress. Claude Track mostly complete, Kiran Track content gaps remain.
**Context:** Decisions made in session after completing strategy docs (SITE-WHY, ULTIMATE-PERSONA, GO-TO-MARKET) and the HOMEPAGE-STRAWMAN audit.

---

## Architecture Decision: Single-Page Morph (Option B)

The persona picker becomes the first state of `index.html`, not a separate page. First-time visitors see picker mode. Returning visitors (persona in localStorage) skip to customized homepage.

**Transition choreography:**
1. Cards dissolve (~400ms)
2. Hero image reshapes from 85vh → 5:2 aspect ratio (~600ms)
3. Accent color top border draws in from edges
4. Viewing As pill lands in nav (emphasis pause ~800ms, tunable via CSS variable)
5. Rest of page materializes (~500ms staggered)

Total: ~2.5-3 seconds. First-time experience only.

---

## Component Decisions (C1-C11)

### C1: Navigation ✅ SHIPPED
- **Viewing As pill** — left side of nav. Shows persona name + avatar + accent-colored border. Clickable "change" returns to picker mode.
- **Avatar treatment:** Persona character avatar in pill with accent-colored outer ring + dark inner stroke (black in dark mode, white in light mode) via `::after` pseudo-element overlay.
- **Unpicked state** — "Choose your lens · [pick]" nudge in muted text, links to picker mode.
- **Accent frame** — BOTH treatments built as switchable CSS classes (`.accent-frame-medium`, `.accent-frame-full`). **Comparison pending** (Joint Track).
- **Nav buttons** — Stay neutral. No persona accent strokes on theme/share/menu.
- **Mobile menu link** — FIXED: `#how-id-built-it` → `how-id-built-it.html`

### C2: Hero ✅ SHIPPED
- **Image** — SHIPPED. Shared asset from persona picker (`final-hero-image3`), `object-position: center 60%`, `<picture>` with WebP + PNG fallback.
- **Tagline** — "Builder of Products People Love" persona-swappable. ✅ Wired via `PERSONA_CONFIG.tagline`.
- **Single-page morph** — ✅ Full 3-act choreography built. View Transitions API.
- **Video** — Future: Runway Gen-4 cinemagraph loop (Kiran track). 5:2 ratio, MP4 H.264, under 5MB.

### C3: About ✅ STRUCTURE SHIPPED (content gap)
- **Personalization wiring:** ✅ All built — introLine, description, socialLinks, competencyOrder, cardOrder, contactSubtext per persona.
- **Default (no persona):** Current copy serves as the generic fallback. ✅
- **Copy variants:** ❌ ALL 6 `description` fields are empty strings. **Kiran Track — highest priority content gap.**
- **Social links per persona:** ✅ LinkedIn universal. GitHub for Technologist. Substack for Practitioner. Etc.
- **Competency reorder:** ✅ Same 6 tiles, different priority order per persona. Pure code.

### C4: Fenix Intro Zone ✅ SHIPPED
- **Two-column layout:** ✅ Built with CSS Grid.
  - Left: "As [Persona], here's what's unlocked:" with persona avatar (120px, centered via CSS Grid `1fr|auto`), accent ring + inner stroke, and 3 unlock items per persona.
  - Right: Fenix module with persona-aware greeting, suggestion chips, accent ring on Fenix logo (glow pulse).
- **Key principle:** Fenix is the primary CTA. Unlocks are context, Fenix is action.
- **Unlock links:** All `link: '#'` — placeholders until destination pages/services exist.

### C5: Work Cards — PENDING
- **Confirmed keeps:** Career Highlights, How I'd've Built It, MadLab, Blog & Podcast
- **Under review:** Studio, Learning & Certs, Causes, Store
- **Decision:** Deferred to standalone strategy session (continuation prompt provided)
- **Grid:** Currently 4-col desktop. Final card count affects layout.

### C6: Connect — PENDING
- **Vision:** Progressive engagement system, not a static section.
- **Current state:** Simple "Let's talk" CTA with persona-aware subtext. ✅ Subtext wired.
- **Decision:** Deferred to standalone deep-dive session.

### C7: Footer ✅ STRUCTURE SHIPPED (content gap)
- **Strip:** ✅ Forms and duplicate social links removed.
- **Keep:** ✅ Copyright line.
- **Quotes component:** ✅ Structure built. ❌ `QUOTES` array empty — **Kiran Track.**

### C8: Fenix FAB + Subpage Module ✅ SHIPPED
- **FAB:** ✅ Persona accent ring with glow pulse. `fenixPulsePersona` keyframes.
- **Subpage module:** ✅ Both full and slim CSS treatments built. `initFenixSubpageModule()` wired.
- **Fenix chat integration:** `launchFenix()` / `launchFenixWithMessage()` not yet defined — awaiting Fenix widget hookup.
- **Beer bet comparison:** PENDING (Joint Track).

### C9: Toast ✅ SHIPPED
- **Persona accent border:** ✅ Thin accent border on toast when persona is active.
- **Morph toast:** ✅ Shows at top-center of page during persona selection (via `toast-morph` class + `fromMorph` parameter), bottom-center for other triggers.

### C10: Manifesto Video ✅ SHELL SHIPPED (March 24)
- **Full-width cinematic section** between About (competencies) and By the Numbers.
- **Layout:** 21:9 aspect ratio (16:9 on mobile), dark canvas with subtle gradient overlay.
- **Placeholder:** Play button SVG + italic Playfair "Why this site exists." tagline.
- **Accent threading:** Top/bottom borders use `--persona-accent` at 30% mix.
- **Video slot ready:** HTML comment marks where `<video>` tag drops in.
- **Content:** Kiran's personal welcome — why this site exists. **Kiran Track — needs script + recording.**

### C11: By the Numbers ✅ SHELL SHIPPED (March 24)
- **6-card grid** with placeholder em dashes and "Placeholder" labels.
- **Layout:** 6-col desktop → 3-col tablet → 2-col mobile.
- **Accent threading:** Values render in `--persona-accent`. Card borders use accent mix on hover.
- **Content:** Metrics will be persona-specific — different numbers matter to different visitors. **Joint Track — needs metric definition session.**

---

## Track Split

### Claude Track (build independently, Kiran reviews)
1. ~~C1 Nav — Viewing As pill + both accent frame treatments~~ ✅ DONE
2. ~~C2 Hero — Single-page morph (persona picker → homepage transition)~~ ✅ DONE
3. ~~C3 About — JS config structure + personalization wiring (placeholder copy)~~ ✅ DONE
4. ~~C4 Fenix Intro — Two-column shell with content slots~~ ✅ DONE
5. ~~C7 Footer — Strip forms/socials, build quotes component~~ ✅ DONE (quotes array empty)
6. ~~C8 Fenix module — Both subpage treatments (full + slim), accent ring on FAB~~ ✅ DONE
7. ~~C9 Toast — Persona accent border~~ ✅ DONE
8. ~~C10 Manifesto Video — Full-width cinematic shell~~ ✅ DONE (March 24)
9. ~~C11 By the Numbers — Impact metrics grid shell~~ ✅ DONE (March 24)

### Kiran Track (independent, no Claude dependency)
1. **C3 About — Write 6 persona copy variants (intro + description)** ❌ HIGHEST PRIORITY
2. C5 Work Cards — Strategy session (use continuation prompt) ❌
3. C6 Connect — Deep-dive session (use continuation prompt) ❌
4. **C7 Footer — Curate personal quotes (5-10)** ❌
5. D1 Hero — Generate 2560×1024 master asset if regenerating ✅ (current hero shipped)
6. **D4 Cal.com — Set up account + booking page** ❌ (blocks unlock links)
7. D1 Hero — Runway video loop (when ready) ❌
8. **C10 Manifesto — Script + record manifesto video** ❌ NEW

### Joint Track (build together)
1. ~~C4 Fenix Intro — Content ideation for persona unlocks + Fenix shortcuts~~ ✅ DONE (3 unlocks per persona defined)
2. C8 Fenix module — Full vs slim bar comparison (beer bet) ❌
3. C1 Nav — Accent frame comparison (medium vs full) ❌
4. **C11 By the Numbers — Define persona-specific metrics** ❌ NEW

---

## Open Decisions

| ID | Decision | Owner | Status |
|----|----------|-------|--------|
| D3 | Card lineup (4 under review) | Kiran (strategy session) | PENDING |
| D5 | Footer social links | Resolved — removing from footer, personalizing in About | DONE |
| D7 | Testimonial display location | Resolved — tabbed into Connect module | DONE |
| D8 | Accent frame: medium vs full | Joint (comparison session) | PENDING |
| D9 | Fenix subpage: full module vs slim bar | Joint (beer bet) | PENDING |
| D10 | By the Numbers: which metrics per persona | Joint (ideation session) | PENDING |
| D11 | Manifesto video: script + format | Kiran | PENDING |

---

## Build Order (Claude Track) — STATUS

All 9 Claude Track items are **COMPLETE**:

1. ~~**C1 Nav**~~ ✅
2. ~~**C2 Single-page morph**~~ ✅
3. ~~**C3 About personalization**~~ ✅
4. ~~**C4 Fenix Intro shell**~~ ✅
5. ~~**C7 Footer**~~ ✅
6. ~~**C8 Fenix subpage module**~~ ✅
7. ~~**C9 Toast**~~ ✅
8. ~~**C10 Manifesto Video shell**~~ ✅
9. ~~**C11 By the Numbers shell**~~ ✅

**Next Claude Track work** depends on Joint Track decisions (accent frame, Fenix subpage comparison) and Kiran Track content (descriptions, quotes, metrics, manifesto video).

---

## Persona Accent System

All driven by a single CSS variable: `--persona-accent` (set from `localStorage.getItem('persona-accent')` on page load). No persona selected = no accent applied, everything falls back to neutral defaults.

### Implemented

| Element | Location | Treatment | Notes |
|---------|----------|-----------|-------|
| Top border | Above nav, `position: fixed` | 3px solid `--persona-accent` | Both medium (top only) and full frame (top + fading sides) built as switchable classes |
| Viewing As pill | Nav left side | Accent-colored border on the pill | The persona name text stays neutral for readability |
| Section dividers | `<hr>` / `.divider` elements between sections | Thin line in `--persona-accent` | Replaces current neutral gray |
| Section labels | `(About)`, `(Explore)`, `(Connect)` | Accent-colored text | Small accent dot/dash before the label |
| Scroll indicator | Hero `↘ Scroll Down` | Arrow in accent color | Text stays neutral |
| Work card hover | Card grid | Accent border/glow on hover | Replaces current neutral hover state |
| Competency tile hover | Competency grid | Accent border on hover | Same treatment as cards |
| Hero tagline | Persona-swappable text | Rendered in accent color | Signals "this is the customized part" |
| Persona name in pill | Nav Viewing As pill | Accent colored | Already part of pill design |
| Fenix logo ring | C4 section + FAB | Accent-colored stroke/ring with glow pulse on first load | The key visual anchor for Fenix |
| Toast border | Toast notification pill | Thin accent border | Low priority polish |
| Pill avatar ring | Nav Viewing As pill | Accent-colored outer ring on persona avatar | Inner stroke: black (dark mode) / white (light mode) via `::after` |
| Unlock avatar ring | C4 Fenix Intro left column | Accent-colored outer ring (3px) + accent glow | 120px avatar, CSS Grid centered. Inner stroke via `::after` |
| Manifesto borders | C10 section top/bottom | Accent at 30% mix | Subtle framing on cinematic placeholder |
| Numbers values | C11 metric cards | Values render in accent color | Card borders also use accent mix on hover |

### Considered but NOT Implemented

| Element | Why Rejected | Revisit If... |
|---------|-------------|----------------|
| Background tints (section bg colors) | Too heavy, fights the dark/light theme system. The site's palette is carefully neutral — accent tints would muddy it. | We decide to do full persona-themed pages (different layouts per persona, not just accent threading) |
| Accent on body text / paragraphs | Kills readability. Accent colors are chosen for visual pop, not for reading 14px body copy against dark/light backgrounds. | We shift to a much more constrained accent palette with WCAG AA-tested text colors |
| Fenix chat interface theming | Fenix should feel neutral/trustworthy — a reliable assistant, not a themed experience. The accent ring AROUND Fenix marks the boundary. Inside, it's Fenix's space. | User testing reveals visitors don't associate Fenix with their persona and feel disconnected |
| Multiple glows (cards + Fenix + FAB + toast all glowing) | One glow is a feature, three is a rave. The Fenix ring glow is the special one — everything else uses solid borders. | We move to a more maximalist visual design language overall |
| Nav button accent strokes (theme/share/menu) | These are utility controls — they should feel neutral and consistent regardless of persona. Accenting them dilutes the signal of what's personalized vs. what's infrastructure. | We redesign the nav to be more expressive overall (unlikely) |
| Footer accent treatment | Footer is being stripped to quotes + copyright. Too minimal to warrant accent threading. | Footer grows in scope or becomes interactive |
| Card image overlay tint | Considered tinting card thumbnail images with the accent color as an overlay. Too aggressive — changes how the card art reads. | Card images are all monochrome/neutral and could benefit from a unifying tint |
| Accent-colored scrollbar | Cool in theory, inconsistent cross-browser. Chrome supports `::-webkit-scrollbar` but Firefox doesn't style scrollbars the same way. | Browser support improves or we add a custom scrollbar library |
| Link underline color | Considered making all `<a>` underlines accent-colored. Too scattered — accent should feel intentional, not everywhere. | We adopt a design system with explicit link styling per context |

---

*Reference docs: SITE-WHY.md, ULTIMATE-PERSONA.md, GO-TO-MARKET.md, HOMEPAGE-STRAWMAN.md, INDEX-HOMEPAGE.md, PERSONA-PLAYBOOK.md*
