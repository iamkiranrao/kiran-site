# Continuation Prompt — Session 4: UAT Fix Batch

## What happened in Session 3 (this session)

This was a Fenix UAT session. We completed the visitor guestbook feature (backend + frontend + CC tab), fixed the Auth.js issuer validation bug, pushed a first-name-only connect fix to the agent system prompt, then ran through all 13 UAT items with Kiran testing each one live. The session produced **33 findings across 7 areas**. No fixes were made during the UAT pass — the strategy was to capture everything first, then batch-fix.

### Code that shipped this session:
- `kiran--fenix-backend/api/v1/fenix/connect.py` — NEW: public endpoint for form/LinkedIn connect logging
- `kiran--fenix-backend/services/conversation_service.py` — MODIFIED: `log_visitor_connect()` now accepts `source` param
- `kiran--fenix-backend/api/v1/fenix/agent.py` — MODIFIED: connect flow instructions now have 3 cases (first-name-only, full-name-no-company, full-name-with-company); also added `log_visitor_connect` call in tool_use loop for chat connects
- `kiran--fenix-backend/api/index.py` — MODIFIED: registered connect router
- `kiran--fenix-backend/api/v1/admin/fenix_analytics.py` — MODIFIED: added guestbook endpoints (GET + DELETE)
- `Kiran's Website/fenix-core.js` — MODIFIED: `connectVisitor()` POSTs to backend for non-chat sources
- `Kiran's Website/fenix-adapters/evaluator-adapter.js` — MODIFIED: form/LinkedIn handlers pass `source` param
- `Kiran's Website/command-center/frontend/src/app/dashboard/feedback/page.tsx` — MODIFIED: full Guestbook tab
- `Kiran's Website/command-center/frontend/src/lib/auth.ts` — MODIFIED: GitHub OAuth issuer fix

### All 19 action items were posted to CC API. Pull them with:
```bash
curl -s "https://cc.kiranrao.ai/api/action-items/?status=todo&source=session" \
  -H "X-API-Key: H3Ycu0N5kfv5MERh_5mYwYcMbGu6pYUv2y1KSgsMBLk"
```

## Complete UAT findings organized by fix area

### AREA 1: agent.py (System Prompt) — 6 fixes
1. **4c** — Enforce first name + last name + company across ALL connect paths. Chat path must collect all three before calling `connect_visitor`.
2. **5b** — Fenix's Fit Score response should drive for identity before opening the connect panel.
3. **8a** — Single-thread outcomes: when driving feedback/testimonial, don't mix in Fit Score or other CTAs in same message.
4. **8b** — Quality gate for testimonials: short/generic feedback ("nice site") triggers a deepening follow-up, not a publish offer. ~15+ words and specific content required before offering to publish.
5. **8c** — General principle: one message, one intent. Context of what user says shapes the response.
6. **2c** — First Fenix welcome message is too cold/functional. Rewrite to be warmer — say hi, position Fenix as a guide, suggest starting points.

### AREA 2: fenix-core.js / Conversation Architecture — 6 fixes
1. **13d** — CRITICAL: Conversation bleed across pages. Need two modes: (a) Direct landing = fresh start, zero history, orient to THIS page. (b) Fenix-guided navigation = continuation. Signal via URL param like `?fenix=continue`. Without param, start fresh.
2. **13e** — When Fenix guides user to a new page, side panel should open automatically with conversation continuing.
3. **2g** — Dynamic pills: frontend state-driven (Option C). Agent suggests conversational pills, frontend appends contextual action pills based on fenixState (e.g., LinkedIn connect pill when only first name captured).
4. **2d** — Initial Fenix welcome text typing animation triggered by intersection observer on scroll, not pre-populated.
5. **3a** — Panels must swap based on latest interaction. Clicking Resume card then Fit Score card should replace resume panel with connect panel.
6. **5a** — "Does This Role Fit Both of Us?" card click opens connect panel without Fenix asking for identity. Belt and suspenders: Fenix drives identity AND panel enforces required fields.

### AREA 3: evaluator-adapter.js / Connect Panel — 4 fixes
1. **3b + 4a + 4c** — Separate First Name / Last Name fields in connect form. Both required. Company required. All three paths must produce identical data set.
2. **3c** — Resume download button is `// TODO`. Wire up actual PDF downloads for the 3 lenses (AI Product Leader, Growth & Experimentation, Mobile & Consumer Product). PDFs exist in `template_previews/`.
3. **2f** — Card text shifts voice when entering Fenix domain: "My Resume, Focused for Your Role" → "Kiran's Resume, Focused on Your Role" (first person → Fenix third person).
4. **4b** — Minimum identity threshold enforced everywhere — no path lets someone through with less than first + last + company.

### AREA 4: CSS / Layout — 4 fixes
1. **2a** — "THESE FEATURES WERE CURATED ESPECIALLY FOR YOU ↘" — persona color, "Especially" underlined.
2. **2b** — Add header above Fenix chat column: "Meet Fenix — [tagline]" in persona color. Needs wordsmithing (Kiran wasn't sold on "concierge").
3. **2e** — First unlock card and Fenix chat module aligned to same horizontal line. Even composition across both columns.
4. **3d + 7d** — FULL VISUAL AUDIT: all top-nav/bento-card pages. Margins, dimensions, spacing consistency. Panels wider than unlock/fenix component. Different L/R margins on bento cards. Test all form factors.

### AREA 5: Testimonials Page — 5 fixes
1. **7a** — End-to-end testimonial pipeline: form → backend → approval in CC → public display. Verify it's fully wired.
2. **7b** — Lead-in copy ("Worked with Kiran?...") and "What's on your mind?" placeholder need rewriting. Mission-driven push about connection.
3. **7e + 7f** — API base is `kirangorapalli.com` (retired). Change to `kiranrao.ai`.
4. **13a** — Top nav bar missing.
5. **13b** — Light/dark mode toggle broken.

### AREA 6: Codebase-Wide — 2 fixes
1. **7f** — Replace ALL `kirangorapalli.com` → `kiranrao.ai` across 236 files. Test API calls after.
2. **9a** — Retire `admin/fenix-training` dashboard. CC is the single pane of glass.

### AREA 7: Command Center — 1 fix
1. **12a** — Conversation detail only shows USER messages. Fenix/assistant responses missing from bubble view.

### AREA 8: Evaluator Features — investigation + build
1. **3e** — **Fun unlock feature for evaluator** — this was previously discussed/planned. Investigate what happened to it. If not built, it needs to be. This is a feature Kiran specifically asked about.
2. **3f** — **Pager / push-to-connect functionality** ("Let me ping Kiran now with a push") — Kiran believes this was built or at least discussed. There's a `send_notification()` in `form_service.py` but it's tied to form submissions, NOT a Fenix-triggered "ping Kiran" feature. No Fenix agent tool exists for this. Needs to be built as a Fenix tool that sends Kiran a real-time notification when a high-intent visitor wants to connect live.

### AREA 9: Resume Content Review
1. **3c-content** — The resume PDFs exist in `template_previews/` but are they actually finalized and polished for end users? Or are they drafts? Kiran asked "can you confirm these resumes are ready for end users to download and consume?" — that's a CONTENT question, not just a wiring question. Review all 9 PDFs (3 personas × 3 lengths) for completeness and quality before exposing them.

### RE-TESTS NEEDED
1. **2h** — First-name-only connect fix was pushed to agent.py but never re-tested. Kiran needs to verify "Hi I'm Joe" now triggers Fenix to ask for last name and company.
2. **connect.py bugfixes** — `check_rate_limit` param fix (was `max_requests`, now `limit`) and `source` param pass-through were fixed mid-session. Verify both are working in production.

### FOLLOW-UPS (validation)
1. **10/11** — Training item actions + feedback approval — validate these work in CC (skipped for retired training dashboard).
2. **13c** — Fenix side panel on testimonials hallucinated "agent" context visitor never said.

## Key decisions made this session
1. **Minimum viable identity**: first name + last name + company required across ALL connect paths. No exceptions.
2. **Dynamic pills (Option C)**: agent handles conversational pills, frontend appends contextual action pills from fenixState.
3. **Retire training dashboard**: CC is the single admin interface.
4. **One message, one intent**: Fenix must single-thread outcomes.
5. **Two-mode conversation**: direct landing (fresh) vs Fenix-guided (continue).

## Kiran's critical feedback to internalize
> "By the definition of done is always — 'usable by me or a end user.' Wiring up the backend and not the front end doesn't get us anywhere. When I say do it to completion I'm expecting the full feature implemented to a usable state."

> "Someone who fills out joe and then gets everything and walks off into the abyss without me being able to know who they are or connect with them in any meaningful way is a waste."

> "If you are trying to drive one outcome, jumbling disparate things together doesn't make sense."

## Suggested approach for the fix session
1. Start with Area 6 (kirangorapalli.com → kiranrao.ai sweep) — it touches 236 files and unblocks testimonials and other API calls.
2. Then Area 1 (agent.py prompt fixes) — all 6 changes are in one file.
3. Then Area 3 (connect panel / evaluator-adapter) — identity enforcement + resume downloads.
4. Then Area 2 (fenix-core.js architecture) — conversation modes, dynamic pills, panel swapping.
5. Then Area 4 (CSS audit) — systematic pass across all pages.
6. Then Area 5 (testimonials) and Area 7 (CC conversation detail).
7. Then Area 8 (evaluator features) — investigate fun unlock and build the pager/push-to-connect feature.
