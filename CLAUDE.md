# Project Instructions

## Session Startup

At the start of every session, ask Kiran what he's working on today. Based on his answer, **immediately do two things**: (1) mount any additional folders needed using `request_cowork_directory`, and (2) read the specific docs listed in "Context Loading by Workstream" below. Do both before writing any code or making any decisions.

Use AskUserQuestion with these options:

- **Site / Frontend** — Already mounted. Immediately read Tier 1 identity docs + Tier 2 governance docs per the workstream table below.
- **Fenix Backend** — Immediately mount `~/fenix-backend` using `request_cowork_directory(path="~/fenix-backend")`. Then read the Tier 1 + Tier 2 docs listed below and `api/v1/fenix/agent.py` from the mounted backend for ground truth.
- **Command Center** — Already inside site repo at `command-center/`. Read the CC docs listed below.
- **Resume / Job Prep** — Trigger the `customize-resume` skill. Read `docs/Strategy/MASTER-PLAN.md` for career strategy context.
- **Session Capture / Journal** — Trigger the `session-capture` skill. No extra mounts needed.
- **Multiple / Everything** — Immediately mount `~/fenix-backend` using `request_cowork_directory(path="~/fenix-backend")`. Both folders will be available. Read Tier 1 identity docs.

If a continuation prompt is pasted, skip the question — the prompt itself defines the scope. If the prompt references backend files (`agent.py`, `services/`, `api/`), mount `~/fenix-backend` immediately using `request_cowork_directory(path="~/fenix-backend")`.

## Repo Structure

Kiran has two repos. They deploy separately and must stay separate:

| Repo | Local Path | Deploys To | What's In It |
|---|---|---|---|
| **kiran-site** | `~/Kiran's Website/` | Cloudflare Pages | Static site (HTML/JS/CSS), fenix-core, adapters, docs, fenix-journal, command-center, prototypes |
| **fenix-backend** | `~/fenix-backend/` | Vercel | FastAPI API — agent logic, RAG, services, tools, data pipeline scripts |

The site repo is always mounted (it contains CLAUDE.md). The backend repo must be explicitly mounted when needed.

**There is no `fenix-backend/` folder inside the site repo.** If you see references to one in old docs or archive files, ignore them — it was a stale copy that was removed in April 2026.

## Local Path

The site repo root on Kiran's machine is `/Users/kiran/Kiran's Website/`. The backend repo is at `/Users/kiran/fenix-backend/`. This is a macOS system. Do not ask for clarification about these paths — they are confirmed.

---

## Context Loading — Tiered Document System

Documents are organized into four tiers. Load the right ones based on the session's task.

### Tier 1: Identity (Always Load for Build Work)

These define why the site exists and who it's for. Read these before any session that produces code, content, or design decisions.

| Doc | What It Provides |
|---|---|
| `docs/Strategy/SITE-WHY.md` | Why the site exists. Broken hiring system, permanent home thesis, medium-is-the-message principle. Read first, always. |
| `docs/Strategy/ULTIMATE-PERSONA.md` | Who it's for. The "Pattern-Breaker Who Hires Pattern-Breakers" — defined by mindset, not title. |
| `docs/Strategy/GO-TO-MARKET.md` | How they find the site. Distribution through work quality, network, community presence. |

These encode principles that override default assumptions:
- The site is a **permanent home**, not a job search campaign.
- The northstar is **relational connection** — personas becoming persons, not clicks or page views.
- The Ultimate Persona is defined by **values and worldview**, not title, company, or hiring need.
- The site's architecture **IS the proof of capability** — the medium is the message.
- The gate is **functional, not artificial** — connected features require identity because identity makes them better.

If a session decision conflicts with these, surface the conflict to Kiran before proceeding.

### Tier 2: Architecture & Governance (Load Based on Domain)

These define how things work and how things get built. They evolve slowly — update when systems change.

**Architecture (the system as it is):**

| Doc | Domain | What It Provides |
|---|---|---|
| `docs/Foundation/ARCHITECTURE.md` | All | Full platform architecture, stack, deployment topology, conflict resolution hierarchy |
| `docs/Fenix/FENIX-AGENT-SPEC.md` | Fenix | Tool registry (9 tools), system prompt structure, SSE streaming contract, identity enforcement rules |
| `docs/Fenix/FENIX-MODULE-ARCHITECTURE.md` | Fenix | Core/adapter decomposition, conversation state machine, panel inventory |
| `docs/Foundation/BACKEND-STANDARDS.md` | Backend | FastAPI patterns, naming conventions, service layer patterns, error handling |
| `docs/Foundation/EXTERNAL-SERVICES-INVENTORY.md` | All | External service integrations (Anthropic, Voyage, Supabase, Cloudflare, Vercel, etc.) |

**Governance (rules for building):**

| Doc | Domain | What It Provides |
|---|---|---|
| `docs/Strategy/UNLOCK-STRATEGY.md` | Site/Fenix | Gating architecture — what's free vs. connected, Fenix's concierge role, per-persona unlock design |
| `docs/Foundation/VISUAL-STANDARDS.md` | Frontend | Design system — colors, typography, components, oklch color space, accessibility |
| `docs/Foundation/CONTENT-STANDARDS.md` | Content | Voice, editorial rules, per-content-type requirements, SEO/metadata |
| `docs/Foundation/AUTHENTICITY-STANDARDS.md` | Content/Design | AI fingerprint detection framework, severity tiers, remediation playbook |
| `docs/Foundation/CONTENT-GOVERNANCE.md` | Content | Banned phrases, readability targets, anti-AI markers, module-specific extensions |

### Tier 3: Active Gameplans (Load for Specific Features)

Tactical execution plans. Intensely useful while active, then they become history. Update or archive when complete.

| Doc | Feature | Status | What It Provides |
|---|---|---|---|
| `docs/Strategy/MASTER-PLAN.md` | Everything | Active | Prioritized workstream sequence — Phase A (done: A1+A2), Phase B/C, dependencies, Kiran's tasks |
| `docs/PersonaPicker/PERSONA-PLAYBOOK.md` | Persona system | Active (Track 1 done, Track 2 partial) | Post-picker personalization — Track 1 (visual) complete, Track 2 (functional) Tier 1 partial, Tier 2-3 not started |
| `docs/Website/Homepage/Bento/BENTO-CARD-GAMEPLAN.md` | Bento cards | Active (code done, art pending) | 14 MJ images remaining for desktop persona-specific slots. Mobile/tablet locked. Persona mappings complete. |
| `docs/Fenix/FENIX-AI-ROADMAP.md` | Fenix | Active (Phase 1 done, Phases 2-4 pending) | Updated April 15. Phase 1 reflects ground truth (10 tools, repo split, built status). Phases 2-4 annotated with persona picker and CC gap system context. |
| `docs/Career/TR-V5-TRIMMING-GAMEPLAN.md` | Track Record | Archived | Bias framework extracted to `docs/Strategy/TRACK-RECORD-STRATEGY.md`. Original doc retained as historical reference only. |
| `docs/Strategy/TRACK-RECORD-STRATEGY.md` | Career positioning | Active | Four biases, diagnostic tests, unexecuted strategic ideas. Applies to the-work.html, resume, interviews. |
| `docs/Career/CAREER-INITIATIVES-CC-GAMEPLAN.md` | Command Center | Active (Steps 1-4 done) | Backend entity built. Data migration, RAG integration, admin UI still pending. |
| `docs/Website/Homepage/HOMEPAGE-GAMEPLAN.md` | Homepage | Active (~90% done) | Claude Track 18/18 complete. Bento system shipped. Remaining: Kiran content items + visual comparisons. |
| `docs/Foundation/PLATFORM-MIGRATION.md` | Infrastructure | Active (Phases 0-3 done) | Phases 4-8 remaining. Time estimates undercount actual persona/Fenix work done. |

### Tier 4: Reference (Look Up When Needed)

Don't pre-load these. Pull them in when a specific question arises.

**Page specs:** `docs/Website/Homepage/SITE-HOMEPAGE.md`, `docs/Website/Homepage/INDEX-HOMEPAGE.md`, `docs/Website/Blog/SITE-BLOG.md`, `docs/Website/Teardowns/SITE-TEARDOWNS.md`, `docs/Website/MadLab/SITE-MADLAB.md`, `docs/Website/Studio/SITE-STUDIO.md`, `docs/Website/Career/SITE-CAREER.md`, `docs/Website/Support/SITE-SUPPORT.md`

**Product specs:** `docs/Fenix/FENIX.md`, `docs/Scannibal/SCANNIBAL.md`, `docs/TheDiaFund/DIA-FUND.md`

**CC module docs:** All CC-*MODULE*.md files in `docs/CommandCenter/`

**Bento MJ prompts:** `docs/Website/Homepage/Bento/BENTO-MONSTER-PROMPT-KIT.md`, `docs/Website/Homepage/Bento/BENTO-MONSTER-PROMPTS-V4.md`, `docs/Website/Homepage/Bento/BENTO-MONSTER-SCENES-V6.md`, `docs/Website/Homepage/Bento/BENTO-RESPONSIVE-AUDIT.md`

**Tool guides:** All files in `docs/Foundation/ToolGuides/` (Cloudflare, Vercel, Supabase, GitHub, GA4, Clarity, Search Console, maintenance checklist)

**Continuation prompts:** `docs/Career/TR-V6-CONTINUATION-PROMPT.md`, `docs/PersonaPicker/CONTINUATION-*.md`

**Living operational doc:** `ACTION-TRACKER.md` (updated every session — current workstream status and blockers)

---

## Context Loading by Workstream

When Kiran says what he's working on, load this specific combination:

### "Site / Frontend / Homepage / Bento"
- **Tier 1:** All three identity docs
- **Tier 2:** VISUAL-STANDARDS, CONTENT-GOVERNANCE, UNLOCK-STRATEGY, ARCHITECTURE
- **Tier 3:** MASTER-PLAN + whichever feature gameplan applies (HOMEPAGE-GAMEPLAN, BENTO-CARD-GAMEPLAN, PERSONA-PLAYBOOK)
- **Tier 4:** Pull in page specs as needed (INDEX-HOMEPAGE, SITE-HOMEPAGE)
- **Code:** `index.html`, `styles.css`, `bento-cards.js`, `persona-system.js`

### "Fenix Backend / Agent"
- **Tier 1:** All three identity docs
- **Tier 2:** FENIX-AGENT-SPEC, FENIX-MODULE-ARCHITECTURE, BACKEND-STANDARDS, UNLOCK-STRATEGY
- **Tier 3:** FENIX-AI-ROADMAP
- **Tier 4:** docs/Fenix/FENIX.md for product context
- **Mount:** `~/fenix-backend` → then read `api/v1/fenix/agent.py` for ground truth
- **Code:** `fenix-core.js`, `fenix-adapters/evaluator-adapter.js`

### "Fenix Frontend / Widget / Adapters"
- **Tier 1:** All three identity docs
- **Tier 2:** FENIX-MODULE-ARCHITECTURE, VISUAL-STANDARDS, UNLOCK-STRATEGY
- **Tier 3:** FENIX-AI-ROADMAP, PERSONA-PLAYBOOK (if persona-specific)
- **Code:** `fenix-core.js`, `fenix-adapters/`, `evaluator-experience.js`, `evaluator-styles.css`

### "Command Center"
- **Tier 2:** BACKEND-STANDARDS, ARCHITECTURE
- **Tier 4:** `docs/CommandCenter/` module docs (read the specific module being worked on)
- **Code:** `command-center/backend/`, `command-center/frontend/src/`

### "Teardowns / Blog / Content"
- **Tier 1:** All three identity docs
- **Tier 2:** CONTENT-STANDARDS, AUTHENTICITY-STANDARDS, CONTENT-GOVERNANCE
- **Tier 4:** SITE-TEARDOWNS or SITE-BLOG as applicable
- **Code:** `teardowns/`, `blog/`, page HTMLs

### "Persona Picker / Unlock System"
- **Tier 1:** All three identity docs
- **Tier 2:** UNLOCK-STRATEGY, VISUAL-STANDARDS
- **Tier 3:** PERSONA-PLAYBOOK, MASTER-PLAN
- **Tier 4:** docs/PersonaPicker/PERSONA-PICKER.md, PersonaPicker/CONTINUATION-*.md

### "Track Record / Career Page"
- **Tier 1:** All three identity docs
- **Tier 2:** CONTENT-STANDARDS, AUTHENTICITY-STANDARDS
- **Tier 3:** TRACK-RECORD-STRATEGY (bias framework), CAREER-INITIATIVES-CC-GAMEPLAN
- **Tier 4:** TR-V6-CONTINUATION-PROMPT, SITE-CAREER, TR-V5-TRIMMING-GAMEPLAN (archived, historical only)

### "Resume / Job Prep"
- **Trigger:** `customize-resume` skill
- **Tier 3:** MASTER-PLAN (career strategy section)
- **Files:** `template_previews/`, `editable_templates/`

### "Session Capture / Journal"
- **Trigger:** `session-capture` skill
- **Files:** `fenix-journal/JOURNAL-GUIDE.md`, `ACTION-TRACKER.md`

### "Bento Card Art / MJ Prompts"
- **Tier 3:** BENTO-CARD-GAMEPLAN (what's needed and priority tiers)
- **Tier 4:** BENTO-MONSTER-PROMPT-KIT, BENTO-MONSTER-PROMPTS-V4, BENTO-MONSTER-SCENES-V6
- **Files:** `images/bento/` for existing assets

### "Infrastructure / Deployment / Services"
- **Tier 2:** ARCHITECTURE, EXTERNAL-SERVICES-INVENTORY
- **Tier 3:** PLATFORM-MIGRATION (remaining steps)
- **Tier 4:** Foundation/ToolGuides/ (Cloudflare, Vercel, Supabase, etc.)

---

## Command Center API

The Command Center backend is accessible at `https://cc.kiranrao.ai` (via Cloudflare Tunnel) or `http://localhost:8000` (direct, only works on Kiran's Mac). From Cowork sessions, always use the tunnel URL. Use it to log entries when Kiran asks.

**Authentication:** All requests to the tunnel URL must include the API key header:
```
X-API-Key: H3Ycu0N5kfv5MERh_5mYwYcMbGu6pYUv2y1KSgsMBLk
```
Localhost requests (from CC frontend) do not require the key. Include this header in every `curl` call to the CC API from Cowork.

## Logging: Kiran's Journal

When Kiran says **"journal this"**, **"add to journal"**, **"log this decision"**, or similar — capture the current discussion as a Kiran's Journal entry.

**Do this immediately, in the moment.** Don't summarize after the fact. Capture the live reasoning.

POST to `https://cc.kiranrao.ai/api/kirans-journal/` with:

```json
{
  "title": "Short, specific title — the core insight or decision",
  "body": "The full reasoning: what was decided, why, what alternatives were considered, what tensions exist. Write in Kiran's voice. Be specific — reference the actual context, not abstractions.",
  "category": "principle | architecture | product-philosophy | brand-identity | career-strategy | content-strategy | apprehension | idea | general",
  "tags": ["relevant", "tags"],
  "workstreams": ["affected-workstream"],
  "decision": "1-2 sentence decision summary (if applicable)",
  "alternatives_considered": "What else was on the table (if applicable)",
  "open_questions": "Unresolved tensions or follow-ups (if applicable)"
}
```

**What makes a good entry:** Specificity. "We chose X over Y because Z, even though Y had advantage W" is good. "Made a strategic decision about the architecture" is bad.

**Categories:**
- `principle` — A reusable belief crystallized from experience ("Always X because Y")
- `architecture` — Technical design decisions and tradeoffs
- `product-philosophy` — How products should work, what matters to users
- `brand-identity` — Voice, positioning, how Kiran presents himself
- `career-strategy` — Job search, positioning, skill development decisions
- `content-strategy` — What to write, how to distribute, gating decisions
- `apprehension` — Fears, tensions, things that feel unresolved
- `idea` — Sparks worth capturing but not yet actionable
- `general` — Anything that doesn't fit above

## Logging: Action Items

When Kiran says **"action item"**, **"track this"**, **"add a task"**, **"todo"**, or similar — capture it as an action item.

POST to `https://cc.kiranrao.ai/api/action-items/` with:

```json
{
  "title": "Clear, actionable task title",
  "description": "Context on what needs to happen and why",
  "workstream": "persona-picker | scannibal | dia-fund | fenix | command-center | site-homepage | site-teardowns | site-blog | site-madlab | resume-pipeline | wordweaver | platform-migration | fenix-training | infrastructure | cross-cutting | creative-lab | content | career",
  "priority": "critical | high | medium | low",
  "source": "session",
  "status": "todo"
}
```

**Priority guide:**
- `critical` — Blocks other work or has a hard deadline
- `high` — Important, should be done this week
- `medium` — Should be done, but not urgent
- `low` — Nice to have, backlog

## Logging: Ideas

When Kiran says **"log idea"**, **"idea:"**, **"capture this idea"**, or similar — log it as a journal entry with category `idea`.

Use the same journal POST endpoint above with `"category": "idea"`. Ideas are lightweight — title and body are enough, other fields optional.

## General Rules

- **Always confirm** what you logged after posting (show the title and category/workstream).
- **Don't over-categorize.** If unsure about category or priority, ask Kiran.
- **Don't batch.** Log each item as Kiran calls it out, not at the end of a session.
- **Capture in Kiran's voice.** These are his thoughts, not a third-party summary.
- If the CC backend isn't running (connection refused), tell Kiran and offer to note it for later.

## Build Process — Agreement, Gameplan, Pre-flight

Every task that produces code, content, or changes infrastructure follows this sequence. No exceptions. Do not write a single line of code or content, and do not modify deployment configs, DNS records, network exposure, API access, or authentication boundaries until all three gates are cleared.

### Gate 1: Agreement

Discuss with Kiran until there is a clear, shared understanding of WHAT is being built and WHY. No ambiguity left hanging. If the request is underspecified, ask questions. Don't assume. The agreement is confirmed when Kiran explicitly says he's aligned (e.g., "yes", "that's it", "exactly").

### Gate 2: Gameplan

Lay out the steps, approach, files that will be touched, and any tradeoffs. Kiran confirms the gameplan. If the gameplan changes during the build, stop and re-confirm before continuing.

### Gate 3: Standards Pre-flight

Before building, run a mental pre-flight check against the applicable standards for this type of work. Surface these explicitly to Kiran:

1. **Technical standards** — Which pillar checks apply? What thresholds matter? (e.g., FK readability limits by content type, SVG class prefix requirements, backend patterns)
2. **Authenticity standards** — What are the voice requirements? First-person markers, honesty markers, directness rules?
3. **Security pre-flight** — Does this change alter what's exposed to the internet? Does it move anything from private to public? Does it create, modify, or remove authentication? Does it touch secrets, API keys, or credentials? If YES to any: security review happens BEFORE the change, not after. Auth goes in first, exposure second. Never the reverse.
4. **Claude fingerprint advisory** — Where will Claude's output likely look generic? What pieces should Kiran source externally? Provide specific tool recommendations and ready-to-use prompts. (See Claude Fingerprint Reference below.)

Only after all three gates are cleared and Kiran says "let's go" does the build begin.

### When to skip gates

- Pure conversation, questions, brainstorming — no gates needed.
- Logging journal entries, action items, ideas — just do it immediately per the logging rules.
- Trivial fixes Kiran explicitly asks for (e.g., "fix that typo") — just do it.
- If Kiran explicitly says "just do it" or "skip the process" — respect that, but confirm once.
- **NEVER skip gates for:** anything that changes network exposure, authentication, DNS, deployment configuration, API access boundaries, or touches secrets/credentials. These always go through all three gates regardless of how "quick" they seem.

## Claude Fingerprint Reference

When the pre-flight identifies pieces of the build that are likely to come out looking "Claude-made," recommend the right external tool scaled to the task. Always provide a ready-to-use prompt Kiran can take to that tool.

### Visual Assets

| Risk Signal | Scale | Recommended Tool | When to Use |
|---|---|---|---|
| Generic icon or small graphic | Small | Google Gemini / Imagen | Quick generation, low stakes |
| Hero image, illustration, header art | Medium | Midjourney or Ideogram | When visual identity matters |
| Photorealistic image | Medium | Midjourney (--style raw) or Flux | Product shots, lifestyle imagery |
| Complex data visualization | Medium | D3.js / Recharts with custom theme | Break the default chart look |
| Architecture diagram, flow chart | Medium | Excalidraw (hand-drawn) or Figma | Avoid the symmetric SVG look |
| Video or animation | Large | Runway, Pika, or Kling | Motion content |
| Audio or voiceover | Large | ElevenLabs or NotebookLM | When voice is needed |

### Written Content

| Risk Signal | What to Do |
|---|---|
| Copy that needs Kiran's authentic voice | Provide structure/outline, let Kiran write the actual words. Don't ghost-write personality. |
| Blog post or teardown narrative | Draft structure and analysis, flag sections where Kiran's real experience/opinion is the value — those sections are his to write. |
| Microcopy (button labels, UI text, taglines) | Flag the generic options. Suggest 3-4 alternatives but note which ones sound like "every SaaS product." |
| Technical documentation | Claude can write this — low fingerprint risk. |

### Code & Components

| Risk Signal | What to Do |
|---|---|
| React component with default Tailwind patterns | Flag the "Claude card" look: rounded-lg, blue/purple gradients, identical padding. Suggest specific style overrides. |
| Over-commented, over-organized code | Note where human code would be messier. Don't add comments that explain the obvious. |
| SVG diagrams generated by Claude | These all look the same. Recommend Excalidraw or Figma for visual diagrams. Claude-generated SVGs are fine for functional elements (sparklines, simple charts). |
| Identical component structure across pages | Flag when multiple components are using the same layout skeleton. Suggest variation. |

### Prompt Templates

When recommending an external tool, provide the prompt. Format:

> **Tool:** [Recommended tool]
> **Prompt:** `[specific prompt tailored to the current task]`
> **Why external:** [1-sentence explanation of the Claude fingerprint risk]

This keeps Kiran in flow — he doesn't have to context-switch to figure out how to ask the tool for the right thing.

## Non-Negotiable Working Behaviors

These rules exist because they were violated repeatedly and caused friction. They are not guidelines — they are requirements. Every session, every task.

### 1. Always go through the gates.

The Build Process (Agreement → Gameplan → Pre-flight) applies to EVERY code, CSS, HTML, or content change pushed to production. "It's just a small CSS tweak" is not an excuse to skip gates. The gates are fastest when the change is small — state what you're changing, list the files, confirm responsive/light-dark/accessibility, get "let's go." This takes 30 seconds and prevents 30 minutes of rework.

### 2. Mockup before implementation. Always.

Any visual or content change gets a mockup (prototype HTML or clear before/after description) BEFORE touching production files. Kiran approves the mockup. Implementation matches the mockup exactly. If implementation diverges from the mockup, stop and re-confirm — do not silently deviate.

### 3. Lead with a recommendation.

When presenting options, always state which one you'd pick and why. Do not present a numbered list and wait for Kiran to choose. Have a point of view. Kiran can override it, but he shouldn't have to drag an opinion out of you.

### 4. When Kiran says something looks wrong, measure first.

Do not explain why the CSS should be correct. Do not say "it's a visual trick." Open the browser, run getBoundingClientRect(), check getComputedStyle(), take a screenshot. Verify with data, then respond. Kiran's eyes are more reliable than your assumptions about what the CSS should be doing.

### 5. Read before you write.

Every session that produces code: read the Tier 1 identity docs and the applicable Tier 2 docs BEFORE writing anything. This is in the Session Startup section and it is not optional. Continuation prompts do not exempt you from context loading.

### 6. Parse instructions carefully.

If an instruction is ambiguous, ask — don't assume the interpretation that lets you move fastest. "No mockup first" could mean "skip the mockup" or "do the mockup first." When in doubt, confirm. The cost of asking is 10 seconds. The cost of assuming wrong is a frustrated Kiran and wasted work.

### 7. Don't optimize for speed. Optimize for precision.

The earlier sessions worked well because changes were deliberate, verified, and aligned. Rushing to push code is not a feature. Getting it right the first time is.

### 8. Disclose data provenance. Always.

When any data is generated from Claude's training knowledge rather than sourced from real-world artifacts (job postings, user input, APIs, files on disk), say so explicitly before it enters any pipeline or system. "This is generated from my training data, not from a real source" — every time, no exceptions. Never populate a pipeline, database, or analysis system with synthetic data without Kiran's informed consent. The cost of this disclosure is one sentence. The cost of omitting it was an entire gap pipeline built on fabricated job descriptions (Session 15, April 2026). This rule exists because that happened.
