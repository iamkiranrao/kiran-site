# ACTION TRACKER
**Last synced:** Session 6 (Prompt Architecture + Eval Suite) — April 11, 2026
**Total open items:** 221 (+6 new from Session 4)
**Status:** Comprehensive workstream inventory; UAT fix batch mostly deployed; pager tool pending agreement

---

## How This Works

This file is the **single source of truth for all open action items** across every workstream. It consolidates incomplete/pending tasks from:
- Module documentation (ARCHITECTURE, CONTENT-STANDARDS, VISUAL-STANDARDS, etc.)
- Product specs (SCANNIBAL, DIA-FUND, PERSONA-PICKER, FENIX, etc.)
- Infrastructure docs (PLATFORM-MIGRATION, CC-CORE, etc.)
- Site pages (HOMEPAGE, BLOG, TEARDOWNS, etc.)

Items are extracted verbatim from source docs with status: 🔴 BLOCKED, 🟡 TODO, 🟢 IN PROGRESS, ✅ DONE (skipped). Blockers and dependencies flagged clearly. **Last updated:** March 23, 2026.

---

## CRITICAL / BLOCKING

| # | Action | Workstream | Source Doc | Priority | Blocker? | Notes |
|---|--------|-----------|-----------|----------|----------|-------|
| 1 | 🔴 Rotate exposed API keys (GitHub PAT + Voyage AI + LinkedIn client secret) | Platform | PLATFORM-MIGRATION.md | CRITICAL | YES | GitHub PAT + LinkedIn client secret scrubbed in Session 5. Voyage AI key also exposed. Need immediate rotation before prod deployment. |
| 2 | ✅ Provide Anthropic API key to Vercel | Platform | PLATFORM-MIGRATION.md | CRITICAL | NO | DONE Apr 11 — Fenix is live and working. Health check shows full integration. |
| 3 | 🔴 Obtain written consent from Feeding America + Best Friends | Products/Scannibal | SCANNIBAL.md, DIA-FUND.md | CRITICAL | YES | Blocks paid tier launch, App Store submission; emails sent Mar 17, await response |
| 4 | 🔴 File California CT-1 charitable solicitation | Legal/DIA Fund | DIA-FUND.md | CRITICAL | YES | Required before paid tier launch; $50 fee; due by Apr 30 |
| 5 | 🔴 Define "net proceeds" calculation for DIA Fund | Legal/DIA Fund | DIA-FUND.md | CRITICAL | YES | Blocks transparency reporting, App Store listing language; formula = Revenue - Apple 30% - API costs |
| 6 | 🔴 Scannibal: Run new EAS build with latest code | Products/Scannibal | SCANNIBAL.md | CRITICAL | YES | Needed before TestFlight device testing; unblocks phase 1 testing |
| 7 | ✅ Persona Picker: Deploy to live (Cloudflare Pages) | Site | PERSONA-PICKER.md | HIGH | NO | DONE Mar 23 — deployed via wrangler.toml + .assetsignore fix. Live at kiranrao.ai/persona-picker-v4-production.html |

---

## THIS WEEK (Mar 19-23)

| # | Action | Owner | Est. Time | Source | Status |
|---|--------|-------|-----------|--------|--------|
| 8 | Run new EAS build (Scannibal, all latest code) | Kiran | 20 min | SCANNIBAL.md | 🟡 TODO |
| 9 | Install TestFlight build on physical iPhone | Kiran | 10 min | SCANNIBAL.md | 🟡 TODO |
| 10 | Test all 9 Scannibal modes with real photos | Kiran | 1 hr | SCANNIBAL.md | 🟡 TODO |
| 11 | Test shake-to-feedback, cross-mode flows, kid-friendly toggle | Kiran | 30 min | SCANNIBAL.md | 🟡 TODO |
| 12 | Confirm rate limiting works (50/day) | Kiran | 15 min | SCANNIBAL.md | 🟡 TODO |
| 13 | Fix bugs from device testing | Claude | Ongoing | SCANNIBAL.md | 🟡 TODO |
| 14 | Recruit 2-3 beta testers, add to TestFlight | Kiran | 30 min | SCANNIBAL.md | 🟡 TODO |
| 15 | Follow up on charity emails (1-week mark) | Kiran | 10 min | SCANNIBAL.md | 🟡 TODO (Mar 24) |

---

## PRODUCTS

### Scannibal
| # | Action | Status | Timeline | Blocker | Notes |
|---|--------|--------|----------|---------|-------|
| 16 | 🟡 Run EAS build, test on physical device (9 modes) | TODO | Week 1 (Mar 19-23) | YES - blocks App Store | Device testing with real photos needed |
| 17 | 🟡 Strip console.log statements | TODO | Week 2 (Mar 25) | NO | ~30 min; affects Vercel logs clutter |
| 18 | 🟡 Add accessibility labels to components | TODO | Week 2 (Mar 25) | NO | 1 hr; App Store review risk if missing |
| 19 | 🟡 Optimize asset file sizes (icon, backgrounds, templates) | TODO | Week 2 (Mar 25) | NO | Images oversized (1.5-3MB); trim to <500KB |
| 20 | 🟡 Create app .gitignore | TODO | Week 2 (Mar 25) | NO | 348MB node_modules at risk; 10 min |
| 21 | 🟡 Test on iPhone SE (smallest) + iPhone 15 Pro Max (largest) | TODO | Week 2 (Mar 25) | NO | Responsive design validation |
| 22 | 🟡 Fix top 3 bugs from tester feedback | TODO | Week 2 (Mar 25) | MAYBE | Depends on device testing results |
| 23 | 🟡 Complete App Store privacy nutrition labels | Kiran | Week 2 (Mar 25) | NO | 15 min |
| 24 | 🟡 Fill in App Store age rating questionnaire | Kiran | Week 2 (Mar 25) | NO | 10 min |
| 25 | 🟡 Set up DUNS number (if Apple requests) | Kiran | Online (few days) | NO | Might not be needed; check submission response |
| 26 | 🟡 Submit to App Store Review | Kiran | Week 2 (Mar 25) | YES - **CRITICAL MILESTONE** | Gateway to public launch |
| 27 | 🟡 Integrate RevenueCat (subscription logic) | Claude | 2-3 hrs | YES - paid tier | Month 2 (late April) |
| 28 | 🟡 Build "Your Impact" section (Dossier tab) | Claude | 2 hrs | YES - paid tier | Month 2 (late April) |
| 29 | 🟡 Build subscription purchase flow | Claude | 1 hr | YES - paid tier | Month 2 (late April) |
| 30 | 🟡 Test sandbox purchases on TestFlight | Kiran | 30 min | NO | Month 2 (late April) |
| 31 | 🟡 Monitor API costs (Gemini, ElevenLabs) | Kiran | 5 min/day | NO | Daily check; enable billing if quota exceeded |
| 32 | 🟡 Collect feedback from beta testers | Kiran | Ongoing | NO | Async; week 1-4 |
| 33 | 🟡 Analyze usage analytics (which modes popular) | Claude | 1 hr/week | NO | Week 3-4 |
| 34 | 🟡 Polish top 2 most-used modes | Claude | 2-3 hrs | NO | Week 3-4 |
| 35 | 🟡 Evaluate underused modes (cut or simplify?) | Kiran + Claude | 1 hr | NO | Week 3-4 |
| 36 | 🟡 Confirm charity consent received | Kiran | 15 min | MAYBE | Week 4 (follow-up) |

### DIA Fund
| # | Action | Status | Timeline | Blocker | Notes |
|---|--------|--------|----------|---------|-------|
| 37 | 🟡 Research local community foundations (Silicon Valley CF, California CF) | Kiran | Ongoing | YES - DAF setup | Call 2-3 foundations re: minimums, youth programs |
| 38 | 🟡 Open DAF with initial contribution ($1K-5K) | Kiran | Month 1-3 | YES - grant-making | Blocks first grant after Scannibal revenue |
| 39 | 🟡 Document DAF terms + fee structure | Kiran | Month 1-3 | NO | Part of DAF setup |
| 40 | 🟡 Make first grant recommendation (after Scannibal revenue) | Kiran | Month 2 (late April) | YES | Blocks Q1 transparency report |
| 41 | 🟡 Define "net proceeds" formula (documentation) | Kiran + Claude | Mar 20-25 | YES - blocker | Formula: Revenue - Apple 30% - API costs |
| 42 | 🟡 Draft in-app disclaimer language for "Your Impact" | Claude | Mar 20-25 | NO | Scannibal integration |
| 43 | 🟡 Draft App Store listing charity disclosure | Claude | Mar 20-25 | NO | Needed before paid tier submission |
| 44 | 🟡 Research California CT-1 requirements | Kiran | Mar 20-25 | YES | Due by Apr 30 |
| 45 | 🟡 File California CT-1 form ($50 fee) | Kiran | Apr 20-30 | YES - BLOCKING | Required before paid tier |
| 46 | 🟡 Consider brief lawyer consult on CA compliance | Kiran | Apr 20-30 | NO | $200-500; optional but recommended |
| 47 | 🟡 Search USPTO for "Scannibal" trademark | Kiran | Apr 20-30 | NO | $250-350 TEAS Plus |
| 48 | 🟡 Search USPTO for "DIA Fund" trademark | Kiran | Apr 20-30 | NO | $250-350 TEAS Plus |
| 49 | 🟡 File trademark for "Scannibal" if clear | Kiran | Apr 20-30 | NO | Optional but recommended |
| 50 | 🟡 File trademark for "DIA Fund" if clear | Kiran | Apr 20-30 | NO | Optional but recommended |
| 51 | 🟡 Create `/docs/DIA-FUND/` directory structure | Claude | ✅ DONE | NO | Structure created |
| 52 | 🟡 Set up quarterly transparency report template | Claude | Apr 15 | NO | Due Q1 (Mar 31) → Q2 (Jun 30) |
| 53 | 🟡 Begin DIA Journal (initial entry) | Kiran | Apr 15 | NO | First quarterly entry |
| 54 | 🟡 Scan + archive Dia's first drawings / contributions | Kiran | Ongoing | NO | Age 4-6 involvement starting |
| 55 | 🟡 Photograph first family volunteer activity | Kiran | Ongoing | NO | Documentation for legacy |
| 56 | 🟡 Establish annual archiving process | Claude | Dec 31 | NO | Year-end checklist |
| 57 | 🟡 Family visit to local food bank | Kiran + Dia | Ongoing | NO | Age 4-6 activity |
| 58 | 🟡 Dia draws pictures for website | Kiran + Dia | Ongoing | NO | Age 4-6 involvement |
| 59 | 🟡 First quarterly "DIA meeting" (review fund) | Kiran + Dia | Ongoing | NO | Age 7-9 activity (future) |

---

## PERSONA PICKER & SITE

### Persona Picker
| # | Action | Status | Timeline | Blocker | Notes |
|---|--------|--------|----------|---------|-------|
| 184 | 🟡 Build full production Evaluator experience on live site | Claude | 6-8 hrs | NO | Session 20: Persona unlock component (card layout, 2 anon + 1 connected), Fenix opening frame, resume lens system (3 PDFs), Dual Fit Score frontend (5 asymmetric dimensions per direction), post-connect flow, pager escalation. Real integrations, no stubs. |
| 185 | 🟡 Write hero video script (4-beat narrative) | Claude | 1 hr | NO | Session 20: 15-20s script emphasizing relational, non-transactional nature. Beats: (1) what is this, (2) who it's for, (3) what you'll discover, (4) CTA. AI avatar will narrate. |
| 186 | 🟡 Select AI avatar tool for hero video | Kiran | 1 hr | NO | Session 20: Evaluate Midjourney, custom avatar service, alternatives. Avatar should be intentional, cohesive with site visual language. Privacy + appearance bias rationale locked. |
| 187 | 🟡 Write Fenix opening frames for remaining 5 personas | Claude | 2 hrs | NO | Session 20: Technologist, Practitioner, Seeker, Learner, Inner Circle. Evaluator frame locked. Per-persona context (what you'll experience, why this site is different). |
| 60 | 🟡 Generate hero video via Runway Gen-4 | Claude | 30 min | MAYBE | 10-15s cinemagraph; commented <video> element ready |
| 61 | 🟡 Optimize hero video to <3MB | Claude | 15 min | MAYBE | Compress for web delivery |
| 62 | 🟡 Create posterframe image for hero video | Claude | 15 min | MAYBE | <200KB JPEG; fallback for iOS autoplay |
| 63 | 🟡 Deploy hero video to root + uncomment <video> element | Claude | 10 min | NO | Final step after video generation |
| 64 | ✅ Deploy to Cloudflare Pages | Claude | 10 min | NO | DONE Mar 23 — wrangler.toml + .assetsignore added, 62 assets deployed |
| 65 | 🟡 Test persona picker on live domain | Kiran | 10 min | NO | Verify all 6 personas, localStorage persistence |
| 66 | 🟡 Test "Change your lens" flow | Kiran | 10 min | NO | Persona selection + site re-rendering |
| 128 | 🟡 Wire persona picker as site entry point | Claude/Kiran | 1 hr | NO | Decide: replace index.html or route via cookie check for first-time visitors |
| 129 | 🟡 Define Technologist content surfacing strategy | Kiran | 30 min | NO | Which teardowns, prototypes, case studies highlighted for CTO/AI Lead audience |
| 130 | ✅ Fix session-capture skill mount (enhanced version not loading) | Claude | 30 min | NO | DONE Mar 23 — packaged as .skill file and installed via Cowork UI |
| 131 | 🟡 Rotate API keys exposed during tunnel security window | Kiran | 15 min | NO | ElevenLabs, Gemini (scannibal .env.local), optionally GitHub PAT, Anthropic, Supabase, Voyage (backend .env) |
| 132 | 🟡 Clean up stray CNAME from fenixconsulting.ai DNS | Kiran | 5 min | NO | cloudflared added cc.kiranrao.ai to wrong zone; delete from fenixconsulting.ai Cloudflare dashboard |
| 133 | 🟡 Repackage session-capture skill with tunnel URLs | Claude | 15 min | NO | .claude-skills/ source updated but .skills/ mount still has localhost URLs; needs repackage + reinstall |
| 134 | 🟡 Track 1: Build persona visual touches on index.html | Claude | 14-16 hrs | NO | 8 items: tagline swap, about copy, grid reorder, card reorder, accent thread, Fenix tooltip, CTA subtext, viewing-as indicator. See PERSONA-PICKER.md §10. |
| 135 | 🟡 Track 1: Light-theme contrast audit for 6 persona accent colors | Claude | 1 hr | NO | Dark theme audited (WCAG AA passed). Light theme needs check — especially Warm Gunmetal #8A8580. |
| 136 | 🟡 Track 2: Build two-column persona unlock component shell | Claude | 3-4 hrs | NO | Replaces current Fenix intro section. Left: persona acknowledgment + unlocks. Right: Fenix intro. |
| 137 | 🟡 Track 2: Implement Tier 1 unlocks (zero-dependency) | Claude | 6-8 hrs | NO | Inner Circle (Flame On + WhatsApp + now page), Learner (ADPList link), Evaluator (resume DL), Technologist (GitHub links) |
| 138 | 🟡 Track 2: Create content for Tier 2 unlocks | Kiran/Claude | 12-16 hrs | NO | Fractional brief, PM starter kit, ADRs, teardown commentary, founder case studies, reference sheet |
| 139 | 🟡 Track 2: Set up Cal.com with 3 event types | Kiran | 1 hr | NO | "Intro Conversation" (Evaluator 30m), "Technical Pairing" (Technologist 45m), plus ADPList profile activation (Learner) |
| 140 | 🟡 Track 2: Implement Fenix-dependent features (Tier 3) | Claude | 12-16 hrs | YES | "Bring Your Problem" (Seeker), "Roast My Product" (Practitioner), mentorship mode (Learner). Blocked on Fenix backend. |
| 141 | 🟡 Evaluate work card lineup (8 cards) against 6 personas | Kiran | 1-2 hrs | NO | Framework-driven analysis done (Persona Pull, Differentiation, JTBD). 4 weak cards identified (Store, Causes, Learning & Certs, Studio). 4 replacements proposed (Under the Hood, Frameworks & Tools, /Now, Learn With Me). **Decision NOT LOCKED — Kiran reviewing.** |
| 142 | 🟡 Build "By the Numbers" persona-dynamic component | Claude | 3-4 hrs | YES | 2 universal anchor stats + 2 persona-specific rotating stats. All metrics about site-building (not career). Blocked on Kiran providing actual numbers. |
| 143 | 🟡 Build Manifesto Video component shell | Claude | 2-3 hrs | YES | 45-60s click-to-play video below Fenix intro. Script exists. Blocked on Kiran producing the video asset via Runway. |
| 144 | 🟡 Provide actual "By the Numbers" metrics | Kiran | 30 min | NO | Build hours, tool count, compression ratios can be mined from git history. Coffee cups, late-night sessions need Kiran's input. |
| 145 | 🟡 Produce manifesto video asset (Runway Gen-4 or self-filmed) | Kiran | 2-4 hrs | NO | Script exists in PERSONA-PICKER.md §9. 45-60 seconds. |
| 146 | ✅ Split PERSONA-PICKER.md → PERSONA-PLAYBOOK.md | Claude | 30 min | NO | DONE Mar 23 — Section 10 playbook content moved to separate doc. Cross-reference added. |
| 147 | ✅ Deploy password gate (gate.js) to all 25 HTML files | Claude | 30 min | NO | DONE Mar 23 — sessionStorage-based. Password: workshop2026. Remove when site is reveal-ready. |
| 148 | ✅ Flush pending CC API journal/action posts | Claude | 15 min | NO | DONE Mar 24 — 2026-03-24 entries flushed successfully. Some older 03-23 entries had format issues (404). Files remain in pending-posts due to permissions. |
| 149 | 🟡 Build strawman end state for index.html | Claude/Kiran | 4-6 hrs | YES | Full page design with new components (By the Numbers, Manifesto Video), finalized card grid. Blocked on card strategy decision (#141). |
| 150 | 🟡 Create parallel work split (Claude coding vs Kiran assets) | Kiran/Claude | 1 hr | NO | Break PERSONA-PLAYBOOK.md execution into two independent workstreams with continuation prompts. |
| 151 | 🟡 Map warm network against 9 target companies | Kiran | 2 hrs | NO | LinkedIn 1st/2nd degree connections at Apple, Anthropic, Adobe, OpenAI, Google, Airbnb, Uber, Microsoft, Netflix. Highest-ROI GTM activity. |
| 152 | 🟡 Choose first teardown target company and product/feature | Kiran | 1 hr | NO | Select company with genuine product insight + warm network connection. First teardown is GTM distribution test. |
| 153 | 🟡 Review SITE-WHY.md, ULTIMATE-PERSONA.md, INDEX-HOMEPAGE.md, GO-TO-MARKET.md | Kiran | 1 hr | NO | Four new strategy docs from Mar 24 session. These become reference docs for all future sessions. |
| 154 | 🟡 Set up Cal.com with intro call event type | Kiran | 30 min | NO | "Intro Conversation" (30 min). Frictionless contact critical for conversion. |
| 155 | 🟡 Ensure teardown landing pages bypass persona picker | Claude | 1 hr | NO | LinkedIn traffic should land on teardown content, not the picker. Critical for GTM. |
| 156 | 🟡 Write first product teardown for GTM distribution | Kiran/Claude | 4-6 hrs | YES | Blocked on #152 (target selection). 2000-4000 words. Must work as both portfolio piece and LinkedIn distribution content. |
| 157 | 🟡 Rewrite ULTIMATE-PERSONA.md around values/worldview | Claude/Kiran | 2 hrs | NO | Current doc defines target by title/company. Session revealed target is defined by mindset — leaders who build differently. How I Built This references. |
| 158 | 🟡 Reframe GO-TO-MARKET.md from transactional to relational | Claude/Kiran | 2 hrs | NO | Current ABM campaign framing doesn't match site-as-home vision. Relational connection and organic discovery through distinctiveness. |
| 159 | 🟡 Research site award/recognition channels | Claude | 2 hrs | NO | Awwwards, CSS Design Awards, Product Hunt, Webby Awards. Unexplored distribution channel for reaching unconventional leaders. |

### Homepage
| # | Action | Status | Timeline | Blocker | Notes |
|---|--------|--------|----------|---------|-------|
| 67 | 🟡 Replace hero video placeholder with actual video or image | Claude | 1 hr | NO | Asset or embed code needed |
| 68 | ✅ Wire up work card navigation (8 cards → actual pages) | Claude | — | NO | DONE Mar 27. Click routing via data-card → cardPageMap in bento-cards.js. Testimonials shows "coming soon" toast. |
| 69 | ✅ Fix mobile menu link to "How I'd've Built It" | Claude | 10 min | NO | DONE Mar 24 — fixed in nav bar update |
| 70 | 🟡 Integrate Fenix chat widget (Phase 1-4) | Claude | 4-5 hrs | NO | FAB currently shows alert placeholder |
| 71 | 🟡 Add testimonials display section | Claude | 2 hrs | NO | Collect via form but not displayed; needs testimonial cards grid |
| 72 | 🟡 Add release notes section | Claude | 2 hrs | NO | Mentioned in architecture docs but not in HTML |
| 73 | 🟡 Re-enable language selector | Claude | 2 hrs | NO | Currently commented out (lines 96-113) |
| 74 | 🟢 Generate per-page OG cards | Claude | 2-3 hrs | NO | IN PROGRESS. The Work OG image done (Apr 1, veteran bear bento card style). 4 secondary pages still need custom OG images. |
| 160 | 🟢 C5 Work Cards: Visual redesign — illustrated character theme | Joint | 3-4 hrs remaining | NO | IN PROGRESS. **Mobile/tablet LOCKED (Mar 28).** Single-column layout, compressed overlays, all 9 cards show images on mobile, shortened universal copy, heading font reduction, persona hover stroke. Morph choreography fixed (manifesto+metrics wired in). **Remaining:** 14 MJ images for desktop persona rotation gaps (22/63 desktop combos are gradient fallback). See `docs/BENTO-CARD-GAMEPLAN.md` for full inventory. |
| 161 | 🟡 C6 Connect: Deep-dive on progressive engagement | Joint | 2-3 hrs | NO | Currently simple CTA. Needs testimonial tabs, Cal.com, conversation starters. |
| 162 | 🟡 D8/D9: Accent frame + Fenix subpage visual comparisons | Joint | 30 min | NO | Both treatments built as switchable CSS classes. Quick comparison session needed. |
| 163 | 🟡 C10: Manifesto video script + recording | Kiran | 3-4 hrs | NO | Shell built (21:9, dark canvas, play button). Needs script and recording. |
| 164 | 🟡 Cal.com: Set up account + booking page | Kiran | 30 min | YES | Blocks C4 unlock links. All unlock links currently placeholder (#). |
| 165 | 🟡 Create content for new work cards (Under the Hood, Frameworks, /Now, Learn With Me) | Kiran + Claude | 8-12 hrs | NO | Four new cards require content that doesn't exist yet. Priority order TBD. |
| 166 | ✅ Finalize card lineup (9 cards confirmed) | Joint | — | NO | DONE Mar 25. 9 cards: how-id-built-it, my-work, my-sandbox, creative-lab, blog-podcast, learning, now, under-the-hood, testimonials. Store removed. Cards considered stable — no additions/removals expected. |
| 167 | 🟡 Audit Studio creative content — what exists? | Kiran | 30 min | YES | Photography, AI music, custom fonts. Studio card only earns spot if content is real. |
| 168 | ✅ Build C5 bento grid layout (Config 3/6) | Claude | — | NO | DONE Mar 25: bento-shapes.html. Explicit 6-col grid, row spans, 5 distinct card shapes. Persona heroCard wiring deferred to production port. |
| 169 | 🟡 Redesign card internals (eyebrow, tags, images) | Claude | 2 hrs | NO | Now part of three-layer architecture: glassmorphism text overlay with eyebrow/meta, varied text alignment per card, 2-3 layout templates. |
| 172 | ✅ Generate 9 monster character illustrations (Midjourney) | Kiran | — | NO | DONE Mar 27. All 9 default-persona characters complete. Final two: Student bush baby (1:2, learner-library1.png), Storyteller orangutan (2:1, blogging-monster2.png). Full roster live at bento-monster-preview.html on Cloudflare Pages. |
| 173 | ✅ Build three-layer card CSS architecture | Claude | — | NO | DONE Mar 27. Production port complete: card-bg (image) + card-overlay (frosted glass) + card-glass (text). All position classes, per-card fonts, card accents live in styles.css. |
| 174 | ✅ Design card text layout templates (2-3 variants) | Claude | — | NO | DONE: 4 templates (A=left, B=right, C=center, D=center+stat). All working in prototype. |
| 175 | ✅ Finalize Gate 1 agreement for bento card visual redesign | Joint | — | NO | DONE: Monsters confirmed, warm neutrals, one spill per row, per-card fonts. All 3 gates cleared. |
| 170 | ✅ Decide Learning card reframe vs removal | Kiran | — | NO | DONE: Kept. Reframed as cross-disciplinary craft sharpening (consumer psychology, behavioral design). |
| 176 | 🟡 Resolve /Now vs /Newsfeed card name | Kiran | — | NO | Kiran asked about renaming, not yet resolved. |
| 177 | 🟡 Test card min-heights on real devices | Claude | 30 min | YES | 260/280/300px per span. Blocked by illustration integration (#172). |
| 178 | 🟡 Explore AI collaborator testimonial format | Kiran | — | NO | Use Fenix Journal observations as testimonial source. Also friends/family testimonials. Format TBD. |
| 171 | 🟡 Build /Now page | Claude | 1 hr | NO | Derek Sivers-style. Deprioritized — exploring CC-powered auto-generation instead of manual maintenance. Card stays on bento grid (Explorer gecko done), destination page deferred. |
| 179 | ✅ Update V5→V6 scene prompt dimensions for V3 grid | Claude | — | NO | DONE Mar 26. V6 prompt kit fully updated with correct aspect ratios, two-channel approach, 23 prompts. |
| 180 | ✅ Design persona-to-grid-slot mapping for explicit placement | Claude | — | NO | DONE Mar 27. 7 persona mappings in bento-cards.js. switchBentoCards() updates data-card, position class, background image per slot. Full persona matrix analyzed in BENTO-RESPONSIVE-AUDIT.md. |
| 181 | ✅ Build shape-varied bento grid prototype (bento-shapes.html) | Claude | — | NO | DONE Mar 25. Explicit 6-col grid with row spans producing 5 distinct aspect ratios. |
| 182 | 🟡 Generate correct default-slot ratio images for Tinkerer (3:1) and Veteran (3:2) | Kiran | 30 min | NO | Current images are all 2:1 HERO. Need regeneration at correct aspect ratios for MadLab and Career slots. |
| 183 | ✅ Generate Artist (chinchilla) for Studio — 3:1 WIDE | Kiran | — | NO | DONE Mar 26. Pink-lavender, beret, painting easel. studiocardwide3_1.png. Used incremental workflow. |
| 184 | ✅ Generate Connector (quokka) for Testimonials — 1:1 SQUARE | Kiran | — | NO | DONE Mar 26. Warm fuzzy monster in cardigan, cafe scene. connector-square-1_1_2.png. |
| 185 | ✅ Generate Engineer (bulldog) for Under the Hood — 1:1 SQUARE | Kiran | — | NO | DONE Mar 26. Peeking into engine bay under car hood. engineer2.png. |
| 186 | ✅ Generate Explorer (fox) for /Now — 4:1 WIDE | Kiran | — | NO | DONE Mar 26. First NON-FUZZY character — smooth gecko skin, antennae, lean build. Mountain trail scene. explorer2.png. |
| 187 | ✅ Generate Student (bush baby) for Learning — 1:2 PORTRAIT | Kiran | — | NO | DONE Mar 27. Library setting with golden hour light. learner-library1.png. New pos-tc overlay class created. |
| 188 | ✅ Generate Storyteller (orangutan) for Blog — 2:1 WIDE | Kiran | — | NO | DONE Mar 27. Broadcast booth setting. blogging-monster2.png. Copy: "Written Word" / "Product meets prose." |
| 190 | 🟡 Generate 14 aspect ratio variants for persona rotation matrix | Kiran | 3-4 hrs | YES — MJ credits | 22 desktop gradient-fallback slots need art. 14 unique images cover all gaps: 4×1:1, 2×3:2, 4×3:1, 3×2:1. Priority 1 (4 images, 8 slots): madlab tall, career topright, teardowns tall, testimonials wider. Full gameplan in `docs/BENTO-CARD-GAMEPLAN.md`. |
| 191 | 🟡 Update V6 prompt doc for incremental MJ workflow | Claude | 1 hr | NO | docs/BENTO-MONSTER-SCENES-V6.md still describes old single-prompt approach. |
| 189 | ✅ Integrate bento monster grid into index.html Section 5 | Claude | — | NO | DONE Mar 27. Ported CSS/HTML/JS from preview. New bento-cards.js (280 lines). 5 files modified. Persona switching wired via switchBentoCards(). Desktop QA passed. Responsive fixes pending (see BENTO-RESPONSIVE-AUDIT.md). |
| 193 | ✅ Apply responsive CSS rules for mobile/tablet bento grid | Claude | — | NO | DONE Mar 28. Single-column at ≤1024px, compressed bottom-bar overlays, typography floors (heading 1.3/1.2rem, desc 0.82/0.75rem), `<br>` hidden, per-card bg positioning. All 9 cards show images on mobile via applyMobileOverrides(). Supersedes original 28-rule audit — approach changed to single-column + mobile image overrides. |
| 192 | 🟡 Explore CC-powered auto-generating /now page | Claude | 2-3 hrs | NO | Use CC action items + journal entries to auto-generate /now content. Avoids manual maintenance burden. Concept from Mar 27 session. |
| 194 | ✅ Replace About section with triptych layout + competency carousel | Claude | — | NO | DONE Mar 29. Three-column grid (identity, context, competency). Scroll-snap carousel with persona-ordered cards, dot pagination, arrow navigation. Responsive: 2-col tablet, stacked mobile. Crossfade on persona switch. |
| 195 | ✅ Apply 34 bento-responsive-audit CSS rules to styles.css | Claude | — | NO | DONE Mar 29. Category A (slot-level), B (card-level), C (card-in-slot) rules across 4 breakpoints. |
| 196 | ✅ Create under-the-hood.html coming-soon page | Claude | — | NO | DONE Mar 29. Minimal placeholder with same nav/theme/Fenix pattern as other subpages. |
| 197 | ✅ Update INDEX-HOMEPAGE.md (mobileImageOverrides + morph choreography) | Claude | — | NO | DONE Mar 29. Added documentation for mobile image override system and 3-act morph choreography. |
| 198 | ✅ Add Act 2 morph comment marker to styles.css | Claude | — | NO | DONE Mar 29. Accent frame reveal section now labeled alongside Act 1 and Act 3. |
| 199 | ✅ Delete card-exploration.html and card-weights.html prototypes | Claude | — | NO | DONE Mar 29. Old prototypes with no live references. |
| 200 | 🟡 Test triptych layout on real mobile/tablet devices | Kiran | 30 min | NO | Carousel swipe feel, dot tap targets, arrow button size, mobile reorder. Built via viewport sim only. |
| 201 | 🟡 Document triptych section in INDEX-HOMEPAGE.md | Claude | 30 min | NO | Triptych structure, CSS classes, carousel JS, persona integration, responsive breakpoints. |
| 202 | 🟡 Build automated CC action item reconciliation script | Claude | 2 hrs | NO | Cross-reference CC items against codebase to clear tracking drift. Low priority, high payoff. |
| 203 | 🟡 Build CC API endpoint for site OUTCOMES metrics | command-center | HIGH | NO | /api/site-metrics/ — stores and serves 3 OUTCOMES numbers. GET is public (no key), POST needs rate limiting. Blocks OUTCOMES column going live. |
| 204 | 🟡 Design the Connect contact flow | site-homepage | HIGH | NO | CTA exists visually but has no functional target. Form? Mailto? Calendly? WhatsApp? Blocks OUTCOMES tracking. Kiran has persona-specific ideas. |
| 205 | ✅ Em-dash sweep across 10 files | site-homepage | MEDIUM | NO | DONE Mar 29 — Completed across bento-enhanced-d, bento-layout-options, career-highlights, madlab, now, studio, index-homepage, persona-picker, visual-standards, and 1 additional file. |
| 206 | 🟡 Add honesty markers to 5 flagged blog posts | site-blog | MEDIUM | NO | Pro-Kiran voice signals: dead ends, named unknowns, personal surprises, first-person error references. Kiran-authored, not Claude. |
| 207 | 🟡 Explore career-highlights infographic via NotebookLM → Figma → HTML/CSS | site-homepage | MEDIUM | NO | Convert highlights into visual narrative. NotebookLM to generate outline, Figma for design, then build interactive component. |
| 208 | ✅ TR-V5 Phase 1: Strategic angle review | site-homepage | HIGH | NO | DONE Apr 1 — Leadership signals, business impact audit, arrow reclassification (decided to keep 8/14/4 ratio as honest), cross-functional complexity identified, forward CTA parked, social proof skipped. |
| 209 | ✅ TR-V5 Phase 2: Trim from 26 pairs to 16 pairs | site-homepage | HIGH | NO | DONE Apr 1 — Cut DailyChange, Alerts Next Gen, Apple Pay, Digital Wealth, Digital Lending, Teen Banking, Open Banking, AI Insights. Bundled Apple Watch into Mobile. Merged Cloud+Platform into Infrastructure Modernization. Built as tr-v6.html. |
| 210 | ✅ TR-V5 Phase 3-5: Card calibration, structural decisions, polish + production build | site-homepage | HIGH | NO | DONE Apr 1 — Descriptions shortened to one-liners. 7 domain pills added (AI/ML, Growth, Identity & Fraud, Mobile, Platform, Personalization, Payments). Full view kept (no condensed). Built the-work.html production page with light mode, mobile responsive, CSS scroll animations (replaced GSAP), OG image, deployed to kiranrao.ai. |
| 215 | 🟡 Get Eagle Invest metrics from former colleagues | site-homepage | HIGH | NO | Need outcome metric for Eagle Invest card — adoption, AUM, or pipeline conversion. Currently $5K vs $250K+ tension stat. |
| 216 | 🟡 Decide CTA forward signal for The Work page | site-homepage | MEDIUM | NO | Options: (A) Keep open, (B) Light AI-first signal, (C) Role-specific. Parked until page is live — now live, needs decision. |
| 217 | 🟡 Extract the-work.css from inline styles | infrastructure | LOW | NO | ~1000 lines inline CSS. Not urgent but improves maintainability. |
| 211 | 🟡 Consider making other eyebrow labels persona-dynamic | persona-picker | LOW | NO | Currently only accent color switches. Tags, labels, and other metadata could rotate per persona like the grid. Low priority exploration. |
| 212 | 🟡 Technical upskilling Phase 1: ADRs, Fenix RAG pipeline work, DDIA chapters 1-4 | career | HIGH | NO | Foundation: architecture decision records, production RAG debugging, distributed systems fundamentals. Estimated 40-50 hours over 4 weeks. |
| 213 | 🟡 Technical upskilling Phase 2: Ship MadLab project with AI pair programmer, AI courses, Fenix eval framework | career | HIGH | NO | Build: ship complete product with Claude collab, take AI/ML courses, define Fenix quality metrics. Estimated 50-60 hours over 4-6 weeks. |
| 214 | 🟡 Technical upskilling Phase 3: System design case studies, SQL refresh, technical blog post | career | HIGH | NO | Polish: deep-dive on 3-5 system design problems, strengthen database fundamentals, publish first technical piece. Estimated 30-40 hours over 4 weeks. |
| 218 | ✅ Create UNLOCK-STRATEGY.md foundation document | persona-picker | HIGH | NO | DONE Apr 3 — Created with 6 locked principles, three-module architecture, Connect mechanism, per-persona deep dive template. |
| 219 | 🟢 Deep dive: Evaluator (Merritt) persona unlock design | persona-picker | HIGH | NO | IN PROGRESS — Resume lens system, Dual Fit Score, personality features identified. Needs: constraint confirmation, Fit Score mechanics session, visual format prototype. |
| 220 | 🟡 Register LinkedIn OAuth developer application | infrastructure | MEDIUM | NO | Required for Connect module OAuth flow. Research LinkedIn developer app requirements. |
| 221 | 🟡 Design Connect notification pipeline for Command Center | command-center | MEDIUM | NO | Persona-to-person conversion notifications. Identity, persona type, trigger unlock. New CC dashboard view. |
| 222 | 🟡 Design Fit Score mechanics — scoring dimensions, weighting, reverse evaluation | persona-picker | HIGH | NO | Dual Fit Score needs dedicated session: scoring dimensions, weighting methodology, reverse evaluation criteria, diplomatic result presentation. |
| 223 | 🟡 Research "What recruiters never ask but should" questions | persona-picker | MEDIUM | NO | Evaluator personality feature. Find surprising interview questions. Kiran authors answers in his voice. |
| 224 | 🟡 Kiran writes "What's not on my resume" — design DNA story | persona-picker | MEDIUM | NO | Kiran-authored piece about college design systems experience. Not Claude-generated. |
| 225 | 🟡 Create resume lens variants — AI Product Leader, Growth & Experimentation, Mobile & Consumer | resume-pipeline | MEDIUM | NO | Three PDF lens variants + unconventional rendered page. Lenses validated against market data + career goals. Needs resume-pipeline skill. |
| 226 | 🟡 Prototype unlock component visual format | persona-picker | MEDIUM | NO | Card-based vs. text vs. menu. What creates "hold on, THIS is interesting" reaction. Affects all 6 personas. |
| 227 | 🟡 Confirm constraint framework — 3 per persona, prioritization test | persona-picker | HIGH | NO | Proposed: 3 unlocks max (2 anon + 1 connected). 3-part test (JTBD fit, differentiation, Kiran-authenticity). Test against more personas. |
| 228 | 🟡 Build CC notification service with Pushover integration | command-center | MEDIUM | NO | Generic notify_kiran() function. $5 one-time Pushover app. Priority levels. First use case: Fit Score pager. |
| 229 | 🟡 Soft launch messaging — how to introduce site to friendly recruiters | site-homepage | HIGH | NO | 30-second why-this-exists-and-why-its-different framing. Connected to hero video gap. |
| 230 | 🟡 Hero video — why this site exists (foundational gap) | site-homepage | HIGH | NO | Visitors need context before engaging with unlock system. Same framing problem as soft launch at different scale. |

### Teardowns
| # | Action | Status | Timeline | Blocker | Notes |
|---|--------|--------|----------|---------|-------|
| 75 | 🟡 Publish 4 live teardowns (Instagram, GEICO, TurboTax, Airbnb) | Kiran | Ongoing | NO | Already published but may need updates |
| 76 | 🟡 Audit existing teardowns for accuracy (facts, links, company details) | Claude | 4-6 hrs | NO | ARCHITECTURE.md: marks stale content for archival |
| 77 | 🟡 Mark stale teardowns with "Last updated" date | Claude | 1 hr | NO | If older than 12 months without updates |
| 78 | 🟡 Refresh 6-month scheduled teardowns | Claude | 2-3 hrs/post | NO | Per ARCHITECTURE.md content refresh cadence |

### Blog
| # | Action | Status | Timeline | Blocker | Notes |
|---|--------|--------|----------|---------|-------|
| 79 | 🟡 Determine content + title for untitled post (ca192ebf.html) | Kiran | 1 hr | NO | Hash-based filename needs human-readable slug |
| 80 | 🟡 Generate per-post OG cards (3 live posts) | Claude | 2 hrs | NO | Currently using generic og-image.png; need 1200×630px cards |
| 81 | 🟡 Rename hash-based blog file (ca192ebf.html → human-readable) | Claude | 30 min | NO | URL rework plan step 1 |
| 82 | 🟡 Update internal links in hub page + nav after slug rename | Claude | 30 min | NO | URL rework plan step 2 |
| 83 | 🟡 Set up 301 redirects for old blog URLs | Claude | 30 min | NO | URL rework plan step 3 |
| 84 | 🟡 Write remaining 8 blog placeholder posts OR remove cards | Kiran | 4-8 hrs | NO | blog-podcast.html has 8 articles with `href="#"` |
| 85 | 🟡 Cross-post 3 live articles to Medium + Substack | Kiran | 1 hr | NO | Wait 7 days after publication per CONTENT-STANDARDS.md |

### MadLab
| # | Action | Status | Timeline | Blocker | NO | SITE-MADLAB.md not yet read; pending |

### Career
| # | Action | Status | Timeline | Blocker | NO | SITE-CAREER.md not yet read; pending |

### Studio
| # | Action | Status | Timeline | Blocker | NO | SITE-STUDIO.md not yet read; pending |

### Support
| # | Action | Status | Timeline | Blocker | NO | SITE-SUPPORT.md not yet read; pending |

---

## COMMAND CENTER

### Resume Pipeline
| # | Action | Status | Timeline | Blocker | Notes |
|---|--------|--------|----------|---------|-------|
| 86 | 🟢 Resume Pipeline 12-step workflow WORKING | IN PROGRESS | — | NO | Full pipeline functional; phased mode + quality gates complete |
| 87 | 🟡 PM 1-Pager template locked (96-97/100 quality) | TODO | Month 1 | NO | 8 templates remaining (3 personas × 3 lengths, minus PM 1-Pager) |
| 88 | 🟡 Template rebuild via docx-js integration | BLOCKED | Month 2 | NO | Requires programmatic DOCX creation; on hold |

### WordWeaver (Blog Pipeline)
| # | Action | Status | Timeline | Blocker | Notes |
|---|--------|--------|----------|---------|-------|
| 89 | 🟢 12-step blog workflow fully functional | IN PROGRESS | — | NO | All steps working; session-based, streaming SSE |
| 90 | 🟢 5-step social media workflow operational | IN PROGRESS | — | NO | Visual-first pipeline for Twitter, LinkedIn |
| 91 | 🟡 Migrate session storage to Supabase | TODO | Month 1 | NO | Currently in `/tmp/`; needs persistent storage like Teardown Builder |
| 92 | 🟡 Add SSE error boundaries | TODO | Month 1 | NO | Streaming can fail silently on Claude timeout |
| 93 | 🟡 Parallelize git operations (stage → commit → push) | TODO | Month 1 | NO | Currently serial; opportunity for speedup |
| 94 | 🟡 Implement series template library | TODO | Month 2 | NO | Defined but not fully implemented; needs full CRUD |
| 95 | 🟡 Build voice profile UI | TODO | Month 2 | NO | Loaded from config but no frontend editor |
| 96 | 🟡 Series template implementation (multi-post workflows) | TODO | Month 2 | NO | Auto-publish on schedule, batch operations |

### Teardown Builder
| # | Action | Status | Timeline | Blocker | Notes |
|---|--------|--------|----------|---------|-------|
| 97 | 🟢 8-step workflow fully functional | IN PROGRESS | — | NO | All steps working; session management, streaming SSE |
| 98 | 🟢 Publishing pipeline (local → git → production) | IN PROGRESS | — | NO | 4 teardowns live (Instagram, GEICO, TurboTax, Airbnb) |
| 99 | 🟢 Content template with 60+ placeholders locked | IN PROGRESS | — | NO | Canonical template complete; Step 8 JSON injection working |

### Skills Evidence Management (NEW — Session 16)
| # | Action | Status | Timeline | Blocker | Notes |
|---|--------|--------|----------|---------|-------|
| 185 | ✅ Build "Add Skills" feature in Command Center | DONE | Session 18 | NO | Evidence management page: 4 tabs (Inventory, Skill Mapper, Taxonomy, Publish), 25 API endpoints, 6 Supabase tables, full seed data migrated from skills.html. |
| 186 | ✅ Plug evidence update step into MadLab publish pipeline | DONE | Session 18 | NO | Fire-and-forget evidence source creation on prototype deploy + notification for skill mapping. |
| 187 | ✅ Plug evidence update step into teardown publish pipeline | DONE | Session 18 | NO | Same pattern as MadLab: auto-capture with td- prefix on teardown publish. |
| 193 | 🟡 Migrate skills.html to consume from data/skills-evidence.json | TODO | Medium | NO | CC publish generates the manifest; skills.html still reads inline JS. |
| 194 | 🟡 Add cert/item detail editing modals to Add Skills Inventory tab | TODO | Medium | NO | Extended details (learned, capstone, techStack) are API-only; need dashboard forms. |
| 195 | 🟡 Fix CC layout dual scroll context (main overflow-y vs window scroll) | TODO | Low | NO | Causes blank viewport when scrolling expanded cards; pre-existing across CC pages. |
| 196 | 🟡 Add focus queue view to Mind the Gap | TODO | Low | NO | Top 3-5 items view to prevent 37-item backlog from feeling overwhelming. |
| 188 | 🟡 Address skills page audit warnings (conscious decisions) | TODO | Low priority | NO | (1) No Playfair Display font — intentional? (2) No page-specific OG image. (3) Meta description is corporate-neutral. |
| 189 | 🟡 Add evidence popup cards to skills page | TODO | High | NO | Click evidence pills → rich popup with org, date, coverage, links. Cert modal infra partially exists. |
| 190 | 🟡 Delete or redirect learning.html to /skills | TODO | Medium | NO | Old page still in repo. Either delete or meta-refresh redirect. |
| 191 | 🟡 Delete prototype files from repo (proto-*.html, tr-*.html, etc.) | TODO | Medium | NO | ~15 development artifacts accessible on production domain. |
| 192 | 🟡 Skills page light theme polish pass | TODO | Low | NO | Dark-first CSS; some elements less visible in light mode. |

### Fenix Journal
| # | Action | Status | Timeline | Blocker | Notes |
|---|--------|--------|----------|---------|-------|
| 100 | 🟡 CC-FENIX-JOURNAL.md not yet read | BLOCKED | TBD | — | Part of Command Center modules; content unknown |

### Fenix Training
| # | Action | Status | Timeline | Blocker | Notes |
|---|--------|--------|----------|---------|-------|
| 101 | ✅ Step 5.1-5.4 COMPLETE | DONE | — | NO | Training backend, frontend (5 views), Q&A bank (319 questions), embeddings |
| 102 | 🟡 Step 5.5: Run migration 004 in Supabase | TODO | This week | NO | Enables training vector search |
| 103 | 🟡 Step 5.5: Run backfill script (embed_training_data.py) | TODO | This week | NO | Populates training_data.embedding column |
| 104 | 🟡 Step 5.5: Deploy updated rag_service.py to Vercel | TODO | This week | NO | Integrates training data into RAG context |
| 105 | 🟡 Step 5.5: Complete 20+ training questions via Command Center | Kiran | This week | NO | Test training data integration |
| 106 | 🟡 Step 5.5: Ask Fenix questions answered by training data | Kiran | This week | NO | Verify training appears in context |
| 107 | 🟡 Step 5.5: Verify training doesn't override site content | Kiran | This week | NO | Sanity check for priority weighting |

### Auditing & Core
| # | Action | Status | Timeline | Blocker | Notes |
|---|--------|--------|----------|---------|-------|
| 108 | 🟡 CC-AUDITING.md not yet read | BLOCKED | TBD | — | Content & visual audit modules; status unknown |
| 109 | 🟡 CC-CORE.md not yet read | BLOCKED | TBD | — | Core infrastructure modules (60+ endpoints); status unknown |

---

## PLATFORM & ARCHITECTURE

### Platform Migration Phases
| # | Action | Status | Timeline | Blocker | Notes |
|---|--------|--------|----------|---------|-------|
| 110 | ✅ Phase 0: Hosting migration (Netlify → Cloudflare) | DONE | Mar 2 | NO | Site LIVE on Cloudflare Pages |
| 111 | ✅ Phase 1: Backend infrastructure (Vercel + Supabase) | DONE | Mar 2 | NO | All 11 tables created, env vars configured |
| 112 | ✅ Phase 2: Scaffolding + health check | DONE | Mar 2 | NO | FastAPI, core utilities, health endpoint verified |
| 113 | ✅ Phase 3: Forms + auth + Command Center migration | DONE | Mar 2 | NO | 6 modules ported, auth gates working |
| 114 | 🟡 Phase 4: Content pipeline + RAG + OG cards | TODO | Mar 25 | NO | Content extractor, chunking, retrieval pipeline, OG generation |
| 115 | 🟡 Phase 5: Fenix MVP (chat + widget) | TODO | Apr 1 | NO | Chat API, persona system, widget, end-to-end testing |
| 116 | 🟡 Phase 6: Store + agentic features + public APIs | TODO | Apr 15 | NO | Stripe, Fenix intelligence, MadLab APIs |
| 117 | 🟡 Phase 7: Admin dashboard + training loop | TODO | May 1 | NO | Analytics, training queue, content re-indexing |
| 118 | 🟡 Phase 8: Production hardening | TODO | May 15 | NO | Error handling, monitoring, rate limiting, performance |
| 188 | 🟡 Purchase Pushover and configure API keys | Kiran | 15 min | NO | Session 20: $5 one-time purchase. Build as generic CC notification service (notify_kiran function). Supports Fit Score matches, persona conversions, resume downloads, testimonials, engagement thresholds, task completions. |
| 189 | 🟡 Register LinkedIn developer app for OAuth | Claude/Kiran | 1 hr | NO | Session 20: Create app, obtain Client ID + Secret. Configure OAuth endpoint for Fit Score Connect flow (dual path: LinkedIn OAuth + 'introduce yourself' form). Both paths → same backend notification pipeline. |

### Architecture Quick Wins
| # | Action | Status | Timeline | Blocker | Notes |
|---|--------|--------|----------|---------|-------|
| 119 | 🟡 Add readability targets (Flesch-Kincaid) | TODO | Week 1 | NO | Blog: Grade 10-11; Teardowns: 11-12; Scannibal: 8-9 |
| 120 | 🟡 Add inclusive language guidelines | TODO | Week 1 | NO | Gender-neutral pronouns, ableist language, stereotypes |
| 121 | 🟡 Formalize content ownership matrix | TODO | Week 1 | NO | Who writes what, reviewer, QA process |
| 122 | 🟡 Content governance: review cadence + archival rules | TODO | Month 1 | NO | Monthly check-in, 18-month review threshold, deprecation process |
| 123 | 🟡 Analytics-driven content strategy | TODO | Month 1 | NO | Track dwell time, scroll depth, return visitors; action triggers on underperformance |
| 124 | 🟡 A/B testing framework for headlines | TODO | Month 1 | NO | Test on social (LinkedIn/Twitter); document winners |

### Content Standards Quick Wins
| # | Action | Status | Timeline | Blocker | Notes |
|---|--------|--------|----------|---------|-------|
| 125 | 🟡 Integrate Flesch-Kincaid scoring into pre-publish | TODO | Week 1 | NO | Tool: readability grade plugin |
| 126 | 🟡 Implement inclusive language guidelines | TODO | Week 1 | NO | Add to CONTENT-STANDARDS.md + update voice checklist |

### Visual Standards Quick Wins
| # | Action | Status | Timeline | Blocker | Notes |
|---|--------|--------|----------|---------|-------|
| 127 | 🟡 Tokenize CSS variables (color, typography, spacing) | TODO | Week 2 | NO | Already partially done; systematize all tokens |
| 128 | 🟡 Implement dark/light mode toggle | TODO | Week 2-3 | NO | Architecture ready; UI not built; 3-4 hours |
| 129 | 🟡 Build icon system (Feather Icons or custom) | TODO | Week 2 | NO | Replace emoji + ad-hoc SVG; 2-3 hours |
| 130 | 🟡 Build lightweight CSS component library | TODO | Month 1 | NO | 1-2 weeks; reduces duplication |
| 131 | 🟡 Storybook documentation | TODO | Month 2 | NO | 1 week; enables collaboration, onboards contributors |

---

## FENIX

### RAG Pipeline
| # | Action | Status | Timeline | Blocker | Notes |
|---|--------|--------|----------|---------|-------|
| 132 | 🟢 RAG pipeline LIVE (19 pages → 153 chunks) | IN PROGRESS | — | NO | Voyage AI embeddings, dual search (semantic + keyword) |
| 133 | 🟡 Update fenix-index.json with all 8+ missing entries | TODO | Week 1 | NO | Career Highlights, MadLab hub, Learning, Causes, Store missing |
| 134 | 🟡 Force manual reindex from GitHub Actions | TODO | Week 1 | NO | Re-index after updating fenix-index.json |
| 135 | 🟡 Build /fenix/debug observability endpoint | TODO | Week 2 | NO | Inspect content_registry, content_embeddings, sample queries |

### Fenix Roadmap
| # | Action | Status | Timeline | Blocker | Notes |
|---|--------|--------|----------|---------|-------|
| 136 | ✅ Phase 1: Validate pipeline | DONE | Mar 2 | NO | End-to-end testing complete |
| 137 | ✅ Phase 2: Conversation logging | DONE | Mar 2 | NO | Supabase tables, metadata, training data integration |
| 138 | ✅ Phase 3: MadLab module | DONE | Mar 2 | NO | Backend router, service, frontend, git_handler integration |
| 139 | 🟡 Phase 4: Fenix dashboard | TODO | Month 1 | NO | Analytics, top queries, failure log, content coverage, conversation browser |
| 140 | ✅ Phase 5.1-5.4: Train Fenix (setup + frontend) | DONE | Mar 19 | NO | Q&A bank (319 questions), training UI (5 views), embeddings |
| 141 | 🟡 Phase 5.5: Test training integration | TODO | This week | YES | Run migration 004, backfill, verify end-to-end |

### Session 4 UAT Fixes (April 10, 2026)
| # | Action | Status | Timeline | Blocker | Notes |
|---|--------|--------|----------|---------|-------|
| 216 | ✅ Fix search_metadata bug in conversation_service.py | DONE | Apr 10 | NO | Root cause: insert tried writing to non-existent column. Assistant messages with tool calls were silently lost. |
| 217 | ✅ Implement single-hop conversation context | DONE | Apr 10 | NO | lastHopMessages snapshot in fenix-core.js. Only previous page's conversation carried on navigation. |
| 218 | ✅ Agent system prompt overhaul (5 fixes) | DONE | Apr 10 | NO | Warmer welcome, one-message-one-intent, single-thread outcomes, fit score flow, testimonial quality gate. |
| 219 | ✅ Testimonials copy update (collaborative Direction B) | DONE | Apr 10 | NO | "Say Something Real" → "What Stood Out?" after 4-direction riff with Kiran. |
| 220 | ✅ form_service.py domain fix | DONE | Apr 10 | NO | kirangorapalli.com → kiranrao.ai in email notification sender and body. |
| 221 | 🟡 Clear backend HEAD.lock + push pager tool changes | TODO | Next session | YES — needs Kiran agreement | ping_kiran tool built without gates. Code ready but unpushed. Decide: Resend vs Pushover. |
| 222 | 🟡 Build lens-specific resume PDFs | TODO | Kiran track | YES — Kiran-authored | 3 lens variants needed. Download code wired but pointing to wrong files. |
| 223 | 🟡 Live test first-name-only connect scenario | TODO | Next session | NO | System prompt updated but never live-tested. |
| 224 | 🟡 Full visual audit (margins/spacing/nav) | TODO | Next session | NO | Never started. Systematic pass across all pages and form factors. |
| 225 | 🟡 Rotate exposed secrets (GitHub PAT + LinkedIn client secret) | TODO | ASAP | NO | Session archive contained keys. GitHub blocked push. Keys should be rotated. |
| 226 | 🟡 Add metadata JSONB column to messages table | TODO | Low priority | NO | Tool call persistence deferred. Current debug logging sufficient. |

### Session 5-6 Completions (April 10-11, 2026)
| # | What Got Done | Workstream | Details |
|---|--------------|-----------|---------|
| 1 | ✅ Arrival context system | Fenix | `arrival_context` field, content-adapter sends page context on Fenix-guided navigation. Prevents infinite navigation loops via server-side tool stripping + prompt rules. |
| 2 | ✅ Single-hop context isolation | Fenix | `_hopStartIndex` tracks current page conversation start. Only current page messages snapshotted for next hop. Fixes A→B→C context leak. |
| 3 | ✅ Dynamic prompt assembly | Fenix | `_detect_turn_type()` classifies turn → `build_agent_system_prompt()` assembles CORE + one BRANCH + CONTEXT. 8 turn types. |
| 4 | ✅ Behavioral eval suite (35 tests) | Fenix | `tests/test_agent_behaviors.py` — automated regression tests against live API. Covers greeting, identity, anti-hallucination, testimonials, tour, arrival, response style, pills, feedback. |
| 5 | ✅ Identity validation hardened | Fenix | Schema minLength, server-side: empty/duplicate/company-as-surname/placeholder rejection. Counting rule in prompt. |
| 6 | ✅ Negative feedback handling | Fenix | Feedback detection expanded to negative sentiment. Decision tree explicitly handles: positive → collect, negative → acknowledge, generic → draw out. |
| 7 | ✅ Cross-page navigation centralized | Fenix | Both adapters use `FC.navigateWithFenix()`. Manual sessionStorage writes removed. |
| 8 | ✅ Fenix re-introduction fixed | Fenix | Prompt rule: frontend already shows intro message, don't repeat. |
| 9 | ✅ Contextual pills | Fenix | After positive feedback → "Share as testimonial" pill. Topic-relevant pills after Q&A. |
| 10 | ✅ Blog post draft | Content | `blog/fenix-how-it-works.md` — ~1,800 words. In WordWeaver session fbb30a84, step 8. Needs Kiran's voice in 4 flagged sections. |
| 11 | ✅ Secrets scrubbed from repo | Infrastructure | GitHub PAT and LinkedIn client secret replaced with [REDACTED]. Rotation still needed (Kiran manual task). |

### Post-MVP Iteration (High Impact, Low Effort)
| # | Action | Status | Timeline | Blocker | Notes |
|---|--------|--------|----------|---------|-------|
| 142 | 🟡 Citation deduplication | TODO | Month 1 | NO | Dedupe by URL; cap at 2-3 citations; prioritize diversity |
| 143 | 🟡 Tone/length controls | TODO | Month 1 | NO | Add guidance: 2-4 sentences for simple questions, 1-2 paragraphs max for complex |
| 144 | 🟡 Suggestion pills redesign | TODO | Month 1 | NO | Make unexpected, drive connection, show personality; test new patterns |
| 145 | 🟡 CTA visual hardening | TODO | Month 1 | NO | Verify all 11 CTAs fit 220px (desktop) / 200px (mobile); test dark/light mode |

### Post-MVP Iteration (Medium Effort)
| # | Action | Status | Timeline | Blocker | Notes |
|---|--------|--------|----------|---------|-------|
| 146 | 🟡 Fenix Dashboard (Phase 4) | TODO | Month 1 | NO | 6 views: overview, queries, failures, coverage, browser, quality |
| 147 | 🟡 Q&A bank ingestion (highest priority) | TODO | Month 1 | NO | Manual Q&A pairs, embedded, stored; highest quality |
| 148 | 🟡 Automatic site re-crawl | TODO | Month 1 | NO | Keeps content fresh on schedule |
| 149 | 🟡 Lightweight integrations (Calendly, GitHub Activity, date/time awareness) | TODO | Month 2 | NO | Medium-term improvements |
| 150 | 🟡 Write "How I Built Fenix" blog post | TODO | Month 2 | NO | Hook: "I built an AI assistant that knows my portfolio better than I do" |

---

## SUMMARY BY CATEGORY

**CRITICAL BLOCKERS (6):** API keys rotation, Anthropic key, charity consent, CT-1 filing, net proceeds definition, EAS build ~~, Persona Picker deploy~~ (DONE Mar 23)

**HIGH PRIORITY (15):** Scannibal device testing, App Store submission, DIA Fund DAF setup, Fenix training integration, content pipeline, hero video, Technical upskilling Phase 1-3 (career-strategy foundation)

**MEDIUM PRIORITY (51):** Template implementations, session migrations, UI improvements, analytics dashboards, documentation updates, career-highlights infographic

**LOW PRIORITY (59):** Nice-to-have features, optimizations, long-term vision items, secondary workflows, persona-dynamic eyebrow labels

**TOTAL:** 184 open action items across 8 major workstreams

---

---

## SESSION 7b LOG (April 12, 2026 — Autonomous Continuation)

Kiran asleep. Continuation prompt executed against MASTER-ACTION-PLAN.xlsx backlog.

### Completed

| # | Item | Details |
|---|------|---------|
| 1 | **Career Initiatives Entity (Steps 1-5)** | Created `models/career_initiatives.py`, `routers/career_initiatives.py`, registered in `main.py`. Migration script extracted 32 initiatives from career-highlights.html (18 Wells Fargo, 9 First Republic, 4 Magley, 1 Avatour). Full CRUD + filtering by domain/company/era/search. Bulk create endpoint for future imports. Seed data at `data/career_initiatives/initiatives.json`. |
| 2 | **Fenix Outcomes Metrics Endpoint** | Added `GET /api/fenix/outcomes` to fenix_dashboard router. Aggregates: total conversations, unique visitors, connected visitors, testimonials, fit scores completed, Fenix-driven page navigation, engagement rate, avg conversation depth. Configurable time period. |
| 3 | **Learning Page Finalized** | Confirmed learning.html correctly redirects to /skills. skills.html is a full D3.js interactive skills visualization — IS the learning page. No further work needed. |
| 4 | **V5 Scene Prompt Dimensions** | Confirmed BENTO-MONSTER-SCENES-V6.md already has correct full-card aspect ratios matching the bento-shapes layout (2:1, 1:1, 3:2, 3:1). V6 doc IS the updated version. No changes needed. |
| 5 | **Visual Consistency Audit** | Full audit of all 10 top-nav pages against VISUAL-STANDARDS.md. Report at `docs/VISUAL-AUDIT-REPORT.md`. Found: hardcoded colors in 4 pages, missing light-mode support in 8 inline style blocks, inconsistent grid gaps, font loading bloat, missing responsive breakpoints. 10 prioritized recommendations. |
| 6 | **Add Skills Feature** | Confirmed already exists: 5-tab React component at `command-center/frontend/src/app/dashboard/add-skills/page.tsx` (1,614 lines) with full backend support (evidence_service.py, evidence.py router, 6 Supabase tables). Inventory, Mapper, Taxonomy, Mind the Gap, and Publish tabs all functional. |

### Commits

1. `feat(cc): add career-initiatives entity with CRUD API and data migration`
2. `feat(cc): add Fenix outcomes metrics endpoint`
3. `docs: add full visual consistency audit report`
4. `chore: update ACTION-TRACKER.md with Session 7b log` (this commit)

### Not Attempted (time/dependency constraints)

- Structured logging + error tracking (Parked — lower priority)
- Dynamic frontend state-driven pills (Parked — needs design decisions)

---

*This document is the single source of truth for all open action items. Update at session end to reflect completed work and new discoveries.*

**Last Updated:** April 12, 2026
**Next Review:** After Session 8 — visual audit fixes, career initiatives RAG integration, homepage gameplan
