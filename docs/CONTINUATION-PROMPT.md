# Continuation Prompt — Post Evaluator Build (April 4, 2026)

Paste this into a new Cowork session to pick up where we left off.

---

## PRIORITY #1: Rebuild Evaluator Frontend to Production Quality

The current `evaluator-experience.js` is functionally complete but visually broken. It doesn't match the site's design language at all. The backend (`fit_score.py`) is solid — keep it. The frontend needs to be rebuilt.

### The Problem
The Evaluator experience was built by parallel agents late in a session. They optimized for functional completeness (SSE streaming, state management, scoring pipeline) but ignored visual quality. The result is programmatically generated DOM elements with basic utility CSS that looks nothing like the rest of the site. Additionally, the script may not be loading at all — the live site still shows the default persona-system.js rendering (old pills like "Something else" instead of "Give me a quick tour", no opening frame text).

### What to Do
1. **Debug first**: Open the live site (kirangorapalli.com), select Evaluator persona, check browser console for JS errors. Figure out why `evaluator-experience.js` isn't taking over from the default persona-system.js rendering. The hook is in `persona-system.js` lines 802-806.

2. **Rebuild the frontend** using `prototypes/evaluator-unlock-v1.html` (785 lines) as the VISUAL REFERENCE. That prototype has the right aesthetic — glass morphism, proper typography (Inter + Playfair Display), color palette (`--accent: #7B9ACC`), card styling, Fenix section layout. The production code should look like the prototype, not like a Bootstrap starter template.

3. **Keep the backend as-is**. `command-center/backend/routers/fit_score.py` works. The SSE event format is correct. The frontend just needs to consume it properly while looking good.

4. **The frontend must handle these flows**:
   - Fenix opening frame (locked text in UNLOCK-STRATEGY.md under "Fenix Opening Frame")
   - Three unlock cards: Resume Lens (anonymous), Recruiter Questions (anonymous), Fit Score (connected)
   - Four Fenix pills: "Show me resume options", "What should I be asking?", "How would we evaluate each other?" (locked), "Give me a quick tour"
   - Connect flow (name, company, email) — inline, no page navigation
   - Fit Score panel: JD paste → SSE-streamed narration → results with composites, dimensions, bands, gap summary
   - Persona-to-person name transition after connect
   - Light theme compatibility

5. **Read the existing site's CSS patterns** before writing any styles. Look at `index.html` and the site's actual stylesheet to match fonts, colors, spacing, card treatments, and glass effects. The Evaluator experience should feel like it belongs on this site.

### Technical Constraints
- Vanilla JS (no React, no framework) — the site is HTML/CSS/JS on Cloudflare Pages
- IIFE pattern, `var` not `const/let`, matches persona-system.js coding style
- All CSS classes prefixed with `ev-`
- Hook: `window.EvaluatorExperience = { init: function(persona) {...} }` called from persona-system.js
- API: POST to `https://cc.kiranrao.ai/api/fit-score/analyze` with `X-API-Key` header
- SSE events: narration, role_to_kiran, kiran_to_role, composite, preferred_company, gap_notes, decline, complete, error

---

## Context

We just finished a pivotal strategy session (April 3-4, 2026) that accomplished two major things:

### 1. Locked All Open Design Decisions
All of these are documented in `docs/UNLOCK-STRATEGY.md`:
- **Fit Score dimensions**: 5 per direction, asymmetric. Role→Kiran: Experience & Level Fit, Domain & Industry Fit, Technical Depth, Core Competencies Match, Product Stage Fit. Kiran→Role: Culture & Values, Growth Trajectory, Product Vision, Team & Engineering Quality, Company Stage & Momentum.
- **Rating scale**: Percentage with qualitative bands — Strong (85-100%), Solid (65-84%), Partial (45-64%), Stretch (below 45%)
- **Vague JD handling**: Decline with diagnosis if fewer than 3 dimensions scorable
- **Composite scores**: Two separate composites (equal-weighted average), no single blended number
- **Preferred company bonus**: +8% to Kiran→Role composite. 30-company flat list (no tiers exposed to visitors)
- **Three-layer video strategy**: Hero video (homepage, AI avatar), Fenix text frame (per-persona, instant), optional persona video (enrichment layer)
- **Fenix opening frame**: Full locked text in UNLOCK-STRATEGY.md under "Fenix Opening Frame (Locked — April 4, 2026)". Key line: "The more you experience the uniqueness of this site, the more you understand about how Kiran thinks and works."
- **Persona-to-person transition**: Visual name-swap animation + Fenix one-liner, universally everywhere
- **Avatar (not face)**: Deliberate creative choice — thematic coherence + eliminates appearance bias
- **Tour pill**: "Give me a quick tour" replaces "Something else" / "Under the hood"
- **Fenix is a he**

### 2. Backend is Built and Deployed
- **`command-center/backend/routers/fit_score.py`** (505 lines) — FastAPI router. POST /api/fit-score/analyze streams SSE events. 3 Claude API calls: extraction/quality assessment, Role→Kiran scoring, Kiran→Role scoring. Preferred company string matching. Composites with +8% bonus. Gap summary generation. SSE field alignment verified.
- **`command-center/backend/main.py`** — Router registered.
- Backend needs a server restart to pick up the new router. Kiran needs to run: `cd ~/Kiran\'s\ Website/command-center/backend && python main.py`
- CORS_ORIGINS env var must include `kirangorapalli.com`

### 3. Frontend Exists but Needs Full Rebuild
- **`evaluator-experience.js`** (1267+ lines) — Functionally complete but visually unacceptable. Use for LOGIC REFERENCE only (SSE parsing, state management, event handling). Rebuild the visual layer.
- **`evaluator-styles.css`** (395 lines) — Supplementary CSS. Will likely be replaced during rebuild.
- **`prototypes/evaluator-unlock-v1.html`** (785 lines) — The VISUAL REFERENCE. This is what the production experience should look like.
- Integration: `persona-system.js` (lines 802-806), `index.html` (script + CSS refs)

## Deployment
- Frontend: Cloudflare Pages, auto-deploys from GitHub `main` branch
- Backend: FastAPI on Kiran's Mac, accessible via Cloudflare Tunnel at `cc.kiranrao.ai`
- Commit and push to `main` to deploy frontend changes

## Blocked on Kiran
- **Recruiter question answers** — `docs/HOMEWORK-Recruiter-Questions.md` has 12 questions, Kiran picks top 5 and writes answers
- **"What's not on my resume" story** — Design DNA piece, Kiran writes this
- **Pushover purchase** ($5) — Enables pager notifications when high-fit scores come in
- **LinkedIn developer app registration** — Enables LinkedIn OAuth in Connect flow
- **AI avatar tool selection** — For hero video (HeyGen, Synthesia, or D-ID recommended)
- **Backend restart** — Kiran needs to restart the FastAPI server on his Mac

## After Evaluator is Production-Ready
- Fenix opening frames for 5 remaining personas (Seeker, Practitioner, Learner, Technologist, Inner Circle)
- Next persona deep dive (same depth as Evaluator)
- CC notification service with Pushover (after purchase)
- Hero video script (4-beat narrative: hello, context, payoff, invitation)
- Soft launch messaging strategy

## Key Files to Read
1. `docs/UNLOCK-STRATEGY.md` — Master strategy, all locked decisions, build status
2. `prototypes/evaluator-unlock-v1.html` — VISUAL REFERENCE for rebuild
3. `evaluator-experience.js` — LOGIC REFERENCE (SSE, state, events)
4. `command-center/backend/routers/fit_score.py` — Backend (keep as-is)
5. `persona-system.js` — Hook point for Evaluator experience
6. `index.html` — Site structure, existing styles, integration points
7. `docs/SITE-WHY.md` — Why the site exists
8. `docs/ULTIMATE-PERSONA.md` — Who it's for
9. `CLAUDE.md` — Project instructions, API keys, build process gates

## Quality Bar: Verify in Browser, Iterate Until Excellent

Do NOT just write code and push. After every significant change:
1. Open the live site in the browser (use Claude in Chrome tools)
2. Take a screenshot and visually compare against the prototype (`prototypes/evaluator-unlock-v1.html`)
3. Check: Does the spacing feel right? Do the cards have the glass effect? Is the typography correct? Does Fenix's section have presence? Do the pills feel clickable? Does the Fit Score results screen look polished?
4. If it doesn't look as good as the prototype — iterate. Fix it. Take another screenshot. Compare again.
5. Test the full flow: persona selection → opening frame → cards → pills → connect → JD paste → processing animation → results
6. Check light theme too
7. Only push when you are genuinely satisfied this is your best work

Kiran's standard: "I want production ready — fully loaded — as close to end result as possible so I can finesse and clean up in the morning." Ship something Kiran would be proud to show a recruiter tomorrow.

## What NOT to Redo
All Fit Score design decisions are LOCKED. Don't reopen dimensions, rating scale, bands, composite methodology, preferred company list, or scoring mechanics. The backend is LOCKED. Only the frontend visual layer needs rebuilding.
