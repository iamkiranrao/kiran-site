# Evaluator Experience Gameplan

**Created:** April 16, 2026
**Status:** Active — ~95% built, closing loose ends
**Persona:** The Evaluator (Merritt Hunter — Recruiter / Hiring Manager)
**Accent:** #7B9ACC

---

## What's Built (Ground Truth as of April 16, 2026)

### Core Architecture
- **evaluator-adapter.js** (~1400 lines) — Full evaluator flow with panels, tools, pills state machine, animations
- **fenix-core.js** (27.7 KB) — Shared core: session management, state machine, SSE streaming, connect logic
- **evaluator-styles.css** (31 KB) — Complete styling with glass morphism, light/dark, responsive
- **persona-system.js** (1054 lines) — Detection, assignment, bento reorder, hero/tagline swap, metrics

### Panels & Tools (All Built)
1. **Resume Lens Panel** — 3-lens selector (AI Product Leader, Growth & Experimentation, Mobile & Consumer) with PDF download preview
2. **Recruiter Questions Panel** — 5-question framework, UI built, **answers are placeholder stubs awaiting Kiran's content**
3. **Connect Gate Panel** — Dual-path (LinkedIn OAuth blocked on dev app, manual form works)
4. **JD Input Panel** — Post-connect, captures JD text → navigates to fit-narrative.html

### Unlock Cards (Left Side of Fenix Zone)
1. My Resume, Focused for Your Role (unlocked)
2. What Recruiters Never Ask (unlocked)
3. How Kiran's Experience Maps to Your Role (locked until connect)

### Fit Narrative Page (fit-narrative.html — 1595 lines, Fully Built)
- Full SSE-powered analysis rendering
- Company badge + role title + verdict header
- Evidence sections: primary matches, added value, cutting room floor, key takeaway
- Expandable cards with problem → shipped → outcome
- Action buttons: try another role, copy summary, email to self/colleague
- Light/dark theme, mobile responsive

### Connect Flow (Fully Built)
- Form captures first name, last name, company, optional email
- Stores in localStorage + fenixState
- Name capitalization on connect (April 16 fix — "kiran rao" → "Kiran Rao")
- Triggers persona-to-person transition ("The Evaluator" → visitor's name)
- Unlocks fit narrative flow

### Bento Card Layout (Evaluator Persona)
- Hero (4×2): Career / The Work
- Top-right (2×2): Testimonials
- Tall (3×2): Teardowns
- Others: studio, madlab, underhood, learning, blog, now

### Pills State Machine (Fully Built)
- Opening: Resume | Questions | Connect | Tour
- Post-resume: Growth lens | AI lens | Questions | History
- Post-connect: Evaluate fit | Resume | Questions | Differences
- Near cap (25 msgs): Connect nudge | Mutual evaluation

### Testimonials Page (Redesigned April 16)
- Testimonials (about Kiran) + Feedback (about site) split
- Submits to CC backend, displays approved public testimonials
- Fenix hands off to page instead of collecting inline
- Single guided question: "How would you describe Kiran to someone who's never met him?"

---

## What's Remaining

### Kiran's Homework (Blocks B1)
1. **Resume PDFs** — 3 actual resume PDFs for the lens selector (AI Product Leader, Growth & Experimentation, Mobile & Consumer). The UI is built, just needs the files.
2. **Recruiter question answers** — Pick 5 from the 12 candidates in HOMEWORK-Recruiter-Questions.md. Author honest, authentic answers (2-4 sentences each). These feed both the "What Recruiters Never Ask" panel AND the Fenix RAG knowledge bank.

### Fun Card (Needs Design + Build — see "Fun Card" section below)

### Future Enhancements (Logged as Ideas — see "Future Ideas" section below)

---

## Fun Card

**Status:** Not started. Needs concept, build, ship.
**Goal:** Pick something, build it in one session, move on. Don't overthink.

The evaluator persona needs a "personality unlock" bento card — something that showcases Kiran's personality or an unexpected dimension, consistent with the fun cards for other personas. This is the card that breaks the professional veneer and makes the evaluator think "this person is interesting beyond the resume."

**Context from MASTER-PLAN.md (B2):**
The original concept was an "Interview Anti-Pattern Spotter" — three format options were proposed:
- **Option A: "Spot the Red Flag"** — Fenix presents 5-7 interview scenarios with embedded red flags. Visitor identifies them. Fenix reveals Kiran's take. Playful scoring.
- **Option B: "Would You Hire This Process?"** — Fenix describes anonymized interview processes. Visitor rates them. Fenix gives Kiran's analysis.
- **Option C: "The Anti-Interview"** — Fenix asks the evaluator the questions Kiran wishes interviewers would ask candidates. Flips the dynamic.

**Kiran's direction:** Lock something in, build it fast, ship it. Pace matters more than perfection. All three options play to Kiran's authentic frustration with broken hiring processes.

**Implementation notes:**
- Would likely be a panel or lightweight page triggered from a bento card
- Can reuse Fenix SSE streaming for conversational formats (Options B, C)
- Should work without backend changes if possible (content can be hardcoded initially)
- The evaluator adapter already has the panel infrastructure

---

## Future Ideas (Parked — Gated on Vault Data)

### Idea 1: Dynamic Resume from Vault Data

**What:** Instead of the current resume customizer (which interprets three baseline resumes with strict content rules), build a version that dynamically pulls from the Career Vault in Command Center. It would query the Vault for evidence matching a specific job description and construct a resume around that real content.

**Value to the evaluator:** They get a resume precisely mapped to their role with real examples, not templated bullets. This is a genuine differentiator — the resume is a living document that's always current with Kiran's best work.

**Why not now:** The Vault needs critical mass. With thin data, the output would be worse than the template approach. The quality bar is: dynamic must beat templated. Currently it can't.

**Gate:** Vault population. Estimated threshold: enough initiatives and evidence items across Product, AI, Growth, and Leadership domains to cover a typical PM/Director-level JD without thin spots.

**Architecture when ready:**
- Fit narrative page already parses JDs via SSE backend
- Resume customizer skill already exists with strict content rules
- New flow: JD parse → Vault query (evidence_embedding_service.py) → dynamic resume assembly
- CC backend already has Career Vault endpoints (career-vault, evidence, gap-discovery)

**Journal entry:** `63662836` (April 16, 2026)

### Idea 2: Force Graph — JD Requirements Mapped to Evidence

**What:** On the fit narrative page, add a toggle to a D3.js force-directed graph visualization. Two phases:
1. Parse the job description and surface key requirements as nodes/circles
2. Populate Kiran's evidence of experience as connected nodes to those requirements

Orphaned requirement circles become visible gaps (e.g., "STEM degree required") with commentary below on how gaps are covered through reframing.

**Why this is the stronger idea:** It's visually unique (nobody does this), it directly answers the evaluator's core question ("does this person match what I need?"), and the orphaned nodes showing gaps with reframing commentary demonstrate self-awareness and strategic thinking. The skills page already proves force graphs work on this site.

**Why not now:** Same Vault gate as Idea 1, though this could work with moderate data since you're mapping to specific JD requirements, not trying to cover everything. Richer Vault data makes it extraordinary.

**Architecture when ready:**
- fit-narrative.html already has the page shell and SSE backend connection
- D3.js v7.8.5 already loaded on skills.html — same library, similar force simulation
- The fit narrative backend already parses JDs and returns structured matches
- New SSE events needed: `requirements_parsed` (nodes), `evidence_mapped` (links), `gaps_identified` (orphans)
- Toggle between narrative view (current) and graph view (new)
- Gap reframing commentary could come from the existing fit narrative `cutting_room_floor` or `key_takeaway` events
- Consider: does the graph REPLACE the narrative or live ALONGSIDE it as a tab/toggle?

**Open question:** JD parsing for requirements extraction — currently done in the fit narrative backend as part of the SSE stream. Would need a structured extraction step that returns discrete requirement entities (not prose) for the graph nodes.

**Journal entry:** `5cad055a` (April 16, 2026)

### Relationship Between the Two Ideas

Both are gated on the same thing: Vault richness. The real unlock is getting content into the Vault, which feeds both. Prioritize Idea 2 (force graph) over Idea 1 (dynamic resume) — it's more visually impactful and can work with less data.

**The sequence when Vault is ready:**
1. Force graph on fit narrative page (Idea 2)
2. Dynamic resume from Vault (Idea 1) — builds on the same JD parsing + Vault query infrastructure

---

## Technical Reference

### Key Files
| File | What |
|---|---|
| `fenix-core.js` | Shared core — session, state, SSE, connect logic |
| `fenix-adapters/evaluator-adapter.js` | Evaluator-specific panels, pills, unlock cards |
| `evaluator-styles.css` | All .ev-* evaluator styling |
| `persona-system.js` | Persona detection, bento reorder, personalization |
| `fit-narrative.html` | Dedicated fit analysis page |
| `testimonials.html` | Testimonial display + collection |
| `bento-cards.js` | Card data, persona mappings, page routing |
| `index.html` | Homepage with persona picker + bento grid |

### Backend Endpoints
| Endpoint | What |
|---|---|
| `api.kiranrao.ai/api/v1/fenix/agent` | Fenix SSE agent stream |
| `api.kiranrao.ai/api/v1/fenix/feedback` | Feedback submission (Fenix backend) |
| `cc.kiranrao.ai/api/feedback/testimonial/submit` | Testimonial submission (CC backend, public) |
| `cc.kiranrao.ai/api/feedback/testimonials/public` | Approved testimonials display (CC backend, public) |
| `cc.kiranrao.ai/api/feedback/submit` | Site feedback submission (CC backend, public) |
| `cc.kiranrao.ai/api/fit-score/analyze` | Fit narrative SSE analysis |

### Supabase Tables
- `feedback` (Fenix backend) — visitor feedback with public_ok + approved flags
- `testimonials` (CC backend) — testimonial submissions with pending/approved/rejected status
- `site_feedback` (CC backend) — emoji rating + comment, private
- `visitor_connects` (Fenix backend) — connect event logging

### CC Backend Auth Bypass (April 16)
Three public paths exempted from API key requirement in `main.py`:
- `/api/feedback/submit`
- `/api/feedback/testimonial/submit`
- `/api/feedback/testimonials/public`

**Important:** CC backend needs restart for these to take effect.
