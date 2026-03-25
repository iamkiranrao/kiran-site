# INDEX-HOMEPAGE.md
## Quick Context: What index.html Looks Like and What's Planned

**Created:** March 23, 2026
**Status:** Living document. Update as sections are built or changed.
**Purpose:** Give any session fast context on the current state of the homepage, what's live, what's broken, and what's planned — without having to read 500+ lines of HTML or 777 lines of SITE-HOMEPAGE.md.

---

## PAGE IDENTITY

- **URL:** https://kirangorapalli.com/
- **Hosting:** Cloudflare Pages (deployed via GitHub → Cloudflare Workers)
- **Stack:** Vanilla HTML/CSS/JS. No React, no build step. Inter font from Google Fonts.
- **Analytics:** Google Analytics 4 (G-8Q795C1RJ5) + Microsoft Clarity (vpgxcc8q5n)
- **Theme:** Dark mode default, light mode toggle. CSS custom properties for theming.
- **Password gate:** Client-side gate via `gate.js` (temporary, until site is "reveal ready")

---

## SECTION MAP (top to bottom)

### 1. Navigation Bar ✅
- Theme toggle (dark/light), share button, menu button
- **Viewing As pill** — left side of nav. Shows persona character avatar (with accent ring + dark/white inner stroke via `::after`), "Viewing as" label, persona name in accent color. Clickable to return to picker.
- **Unpicked state** — "Choose your lens · [pick]" nudge.
- **Accent frame** — Both `.accent-frame-medium` and `.accent-frame-full` built, comparison pending.
- Language selector exists but is commented out
- Mobile: hamburger menu + responsive pill sizing at 768px and 480px

### 2. Hero Section ✅
- **H1:** "Kiran Rao"
- **Tagline:** "Builder of Products People Love" — ✅ persona-swappable via `PERSONA_CONFIG.tagline`, renders in accent color.
- **Location:** "(San Francisco, California)"
- **Single-page morph:** ✅ 3-act choreography (cards exit → above-fold reveal → below-fold materialize). View Transitions API.
- **Scroll indicator:** "↘ Scroll Down" — arrow renders in accent color when persona active.

### 3. About Section ✅ (content gap: descriptions)
- **Left column intro:** ✅ Persona-swappable via `PERSONA_CONFIG.introLine`. Each persona has unique phrasing.
- **Right column:** "(About)" label (accent-colored) + description paragraph + social links
- **Description:** ❌ All 6 persona `description` fields are empty strings. Kiran Track.
- **Social links:** ✅ Persona-specific — LinkedIn universal, GitHub for Technologist, Substack for Practitioner, etc.
- **Competencies grid:** ✅ 6 tiles, persona-reorderable via `PERSONA_CONFIG.competencyOrder`:
  - Product Strategy, AI Integration, Digital Transformation, Growth & Adoption, Go-to-Market Strategy, Delivery & Execution

### 4. Fenix Intro Zone ✅
- **Two-column layout** (flex on desktop, stacks on mobile):
  - Left: CSS Grid with persona avatar (120px, accent ring + inner stroke, centered via `1fr|auto` grid) + "As [Persona], here's what's unlocked:" heading + 3 unlock items per persona (label, desc, icon). All `link: '#'` placeholders.
  - Right: Fenix logo (accent ring + glow pulse), "Meet Fenix" title, persona-aware greeting, suggestion chips.
- **Accent divider** between columns (vertical on desktop, horizontal on mobile).

### 4a. Manifesto Video (C10) ✅ SHELL — NEW (March 24)
- **Full-width cinematic section** between About (competencies) and By the Numbers.
- **Layout:** 21:9 aspect ratio (16:9 on mobile). Dark canvas with gradient overlay.
- **Placeholder state:** Play button SVG + italic Playfair "Why this site exists." tagline.
- **Accent threading:** Top/bottom borders at 30% persona accent mix. Play button hover turns accent color.
- **Video slot:** HTML comment marks `<video>` insertion point. Awaiting Kiran's manifesto recording.
- **Purpose:** Kiran's personal welcome — why this site exists. The emotional bridge between "what I do" and "proof."

### 4b. By the Numbers (C11) ✅ FULLY SHIPPED (March 25)
- **Dynamic grid** below manifesto, above Fenix Intro Zone. Populated by `buildNumbersGrid()` in persona-system.js.
- **Layout:** `auto-fit minmax(180px, 1fr)` — single row, 4-6 cards depending on persona. Centered section label.
- **Persona-specific metrics:** Each persona sees different numbers. Code/language-specific metrics removed; AI and product metrics kept. All personas see prototype count and commit count.
- **Live GitHub commit count:** HEAD request to GitHub API on page load. Initial display = (count - 1). Split-flap flip to actual count on scroll into view (2s delay, 500ms animation).
- **Accent threading:** `.number-value` renders in `--persona-accent`. Card borders use accent mix on hover with glow.
- **Seeker accent:** Changed from #8A8580 to #777744 sitewide.

### 5. Work Cards Grid — "(Explore)" section
- **Currently 8 cards.** All are wired to real HTML pages via `app.js` `cardConfig` array (lines 394-426). Cards are `<button>` elements in HTML, but JS attaches click handlers that navigate to the corresponding page (e.g., `career-highlights.html`, `how-id-built-it.html`, etc.).
- **Layout:** Responsive grid — 4-col on desktop (`repeat(4, 1fr)` at 1200px+), 2-col at 1024px, 1-col at 768px.
- Each card has: image, title (h3), description (p), and 2-3 tag chips.

**Current 8 cards (in DOM order):**

| # | ID | Title | Description (abbreviated) | Tags | Status |
|---|---|---|---|---|---|
| 1 | `my-work` | Career Highlights | 0-to-1 launches, platform transformations, fractional consulting | Product, Strategy, Leadership | KEEP |
| 2 | `how-id-built-it` | How I'd've Built It | Product teardowns and redesigns of popular applications | Case Studies, Teardowns | KEEP — flagship |
| 3 | `my-sandbox` | MadLab | Apps, tools, prototypes built from scratch | Prototypes, Apps, Experiments | KEEP (absorbing Studio scope) |
| 4 | `creative-lab` | Studio | Creative playground — art, video, experiments | AI Art, Video, Content | UNDER REVIEW — proposed absorption into MadLab |
| 5 | `blog-podcast` | Blog & Podcast | Long-form thinking on product, AI, leadership | Articles, Podcast, Substack | KEEP |
| 6 | `certifications` | Learning & Certifications | Lifelong learner — the real value isn't the credential | Product, AI/ML, Cloud | UNDER REVIEW — proposed replacement by "Learn With Me" |
| 7 | `causes` | Causes | Where I put my time and energy outside work | Nonprofits, Giving Back, Impact | UNDER REVIEW — proposed removal |
| 8 | `store` | Store | Curated merch, templates, digital resources. Coming soon. | Merch, Templates, Digital | UNDER REVIEW — proposed removal |

**Card lineup decision:** STRATEGY LOCKED (March 24). New lineup: Career Highlights, How I'd've Built It, MadLab (absorbs Studio), Blog & Podcast, Under the Hood (new), Frameworks & Thinking Tools (new), /Now (new), Learn With Me (new). See `fenix-journal/entries/strategic-decisions/2026-03-24.md` for full reasoning. **Execution pending — needs build session.**

### 6. Contact CTA
- "(Connect)" label
- "Let's talk" heading
- "Get in Touch" mailto link (kiranrao@gmail.com)
- Will get persona-aware subtext per Track 1.7

### 7. Footer ✅ (content gap: quotes)
- ✅ Forms and duplicate social links stripped.
- ✅ Quotes component structure built. ✅ **27 quotes populated** (March 25). Random quote on each page load.
- Copyright line + Fenix logo.

### 8. Fenix FAB (Floating Action Button) ✅
- Bottom-right corner, `position: fixed`. Stays fixed during morph/persona-active states.
- ✅ Persona accent ring with glow pulse (`fenixPulsePersona` keyframes).
- Full Fenix chat widget implemented in `fenix-widget.js`.
- Subpage module: Both full and slim treatments built in CSS. `initFenixSubpageModule()` wired.

### 9. Toast Notification System ✅
- ✅ Persona accent border on toast when persona is active.
- ✅ Morph toast: shows at top-center (`top: 2rem`) during persona selection only, bottom-center for other triggers.
- Controlled via `toast-morph` CSS class + `fromMorph` JS parameter.

---

## WHAT'S BROKEN / INCOMPLETE

| Issue | Severity | Notes |
|-------|----------|-------|
| ~~Work cards are non-functional~~ | ~~High~~ | **RESOLVED** — All 8 cards navigate to real pages via `app.js` `cardConfig`. No longer broken. |
| Hero video missing | Low | Static hero image now in place (shared with persona picker). Video loop is a future enhancement via Runway Gen-4. |
| ~~Fenix FAB is placeholder~~ | ~~Medium~~ | **RESOLVED** — Full chat widget implemented in `fenix-widget.js` (778 lines). SSE streaming, Flame On, session persistence, suggestions, feedback. Needs persona visual cue enhancements. |
| ~~Mobile menu broken link~~ | ~~Low~~ | **RESOLVED** — Fixed `#how-id-built-it` → `how-id-built-it.html` |
| No testimonials displayed | Low | Form collects them but nothing renders on page |

---

## PREVIOUSLY PLANNED SECTIONS — STATUS

| Section | Status | Notes |
|---------|--------|-------|
| Manifesto Video | ✅ SHELL SHIPPED (March 24) | Section C10. 21:9 placeholder with play button. Awaiting video asset. |
| "By the Numbers" | ✅ FULLY SHIPPED (March 25) | Section C11. Persona-specific metrics, live GitHub count, split-flap animation, prototype metrics. |
| Two-Column Persona Unlock | ✅ SHIPPED | Built into C4 Fenix Intro Zone. Unlock items + avatar per persona. |
| "Viewing As" Indicator | ✅ SHIPPED | Built as nav pill (C1) with avatar, accent ring, inner stroke. |

---

## PERSONALIZATION LAYERS (summary — full detail in PERSONA-PLAYBOOK.md)

**Track 1 ("Look")** — JS reads `localStorage.getItem('persona')`, applies visual tweaks:
- Tagline swap (1.1), About copy swap (1.2), Competencies reorder (1.3), Card order (1.4), Accent color thread (1.5), Fenix tooltip (1.6), Contact CTA subtext (1.7), "Viewing as" indicator (1.8)
- Total: ~14-16 hours, zero dependencies

**Track 2 ("Does")** — Two-column component with per-persona functional unlocks:
- Evaluator: calendar booking, resume download, references
- Seeker: "bring your problem" Fenix mode, fractional brief, founder case studies
- Practitioner: teardown vault, "roast my product," frameworks
- Learner: ADPList mentorship, PM starter kit, mentorship Fenix mode
- Technologist: GitHub tour, architecture decision records, pair session booking
- Inner Circle: Flame On auto-enable, /now page, WhatsApp direct line
- Total: ~50-62 hours, three viability tiers

---

## KEY FILES

| File | What It Contains |
|------|-----------------|
| `index.html` | The page itself (~590 lines, updated March 24 with C10/C11) |
| `styles.css` | Main stylesheet (shared across all pages, ~3300+ lines) |
| `persona-system.js` | **Core persona engine** — PERSONA_CONFIG (6 personas), morph choreography, pill/avatar/unlock/toast/accent wiring |
| `fenix-widget.js` | Fenix chat widget (778 lines) — SSE streaming, Flame On, session persistence |
| `fenix-widget.css` | Fenix FAB styling |
| `app.js` | Card click handlers (`cardConfig`), page routing, dynamic behavior |
| `main.js` | Theme toggle, mobile menu, share modal, scroll behavior |
| `gate.js` | Password gate (temporary) |
| `docs/SITE-HOMEPAGE.md` | Detailed documentation (777 lines — the full reference) |
| `docs/HOMEPAGE-GAMEPLAN.md` | Build gameplan with Track Split and component status |
| `docs/PersonaPicker/PERSONA-PLAYBOOK.md` | Personalization gameplan (365 lines) |

---

## HOW TO USE THIS DOCUMENT

Starting a session that touches index.html? Read this file first. It gives you the layout, current state, and what's planned in under 5 minutes. For deeper detail on any section, read SITE-HOMEPAGE.md. For personalization specifics, read PERSONA-PLAYBOOK.md.

---

*Last verified against index.html + persona-system.js + styles.css: March 24, 2026*
