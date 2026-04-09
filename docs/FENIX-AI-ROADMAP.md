# Fenix AI Roadmap — From Chat Stub to Flagship Product

**Author:** Kiran Rao
**Date:** April 8, 2026
**Status:** STRATEGIC PLAN — Guides all Fenix development
**Depends on:** FENIX-AGENT-SPEC.md (Phase 1 technical contract), ARCHITECTURE.md (system topology)

---

## The Vision

Fenix isn't a chatbot bolted onto a portfolio site. It's the site's primary interaction layer — a conversational agent that understands my work deeply, guides visitors through it with real page actions, evaluates mutual fit honestly, and turns anonymous visitors into real relationships.

Every feature in this roadmap serves one of two goals:
1. **Demonstrate product thinking in real-time** — the visitor doesn't read about how I think, they experience it
2. **Turn personas into persons** — the site's northstar metric (from UNLOCK-STRATEGY.md)

Each phase builds on the last. No throwaway work. Every piece compounds.

---

## Phase 1: The Foundation — Agentic Fenix
**Effort:** 2–3 sessions
**Status:** Spec complete (FENIX-AGENT-SPEC.md), not yet built
**Depends on:** Existing Fenix Vercel backend + evaluator-experience.js chat module

### What gets built
- Tool-use API endpoint (`POST /api/v1/fenix/agent`) on the Fenix Vercel backend
- SSE streaming with interleaved text + tool calls
- Frontend tool executor — 6 tools that manipulate the page:
  - `open_panel` — opens resume, questions, or connect panels
  - `close_panel` — closes the current panel
  - `select_resume_lens` — pre-selects PM/PMM/PjM resume
  - `scroll_to_section` — navigates to page sections
  - `get_visitor_context` — checks what the visitor has explored
  - `start_fit_score` — initiates the fit evaluation (gated behind connect)
- Conversation state object (`fenixState`) with session tracking
- 30-message session cap with graceful nudge toward connect
- Streaming text renderer (tokens append to bubble in real-time)
- RAG integration using existing pipeline (319 training Q&As + 153 content chunks)

### Why first
Every subsequent feature is "add a tool definition to Fenix." The agent architecture is the multiplier. Without this, every other feature is a standalone hack. With it, every future feature is one tool registration away.

### Key decisions (locked)
- **Backend:** Fenix Vercel backend (has RAG already, always-on, auto-deploys)
- **All 6 tools** in v1 (scoped to page manipulation only)
- **SessionStorage** for conversation persistence (survives page nav, gone on tab close)
- **Port 319 training answers** into the agent system prompt as grounding
- **30-message cap** per session with nudge toward connect

### Success criteria
A visitor types a question → Fenix responds with streaming text + tool calls → the page reacts (panel opens, section scrolls, resume selects) → the conversation feels natural, not scripted.

---

## Phase 2: The Relationship Layer — Booking + Smart Follow-up
**Effort:** 1 session
**Depends on:** Phase 1 (agent framework operational)

### What gets built
Two new tools added to Fenix's registry:

**`book_meeting`** — Fenix pulls available Calendly slots via API, presents them in-chat as selectable options, visitor picks one, confirmation happens without leaving the page. Fenix only offers this after substantive conversation (inherits existing nudge logic from fenix_service.py, but now with a real action behind it). No redirect, no new tab, no friction at the moment of highest intent.

**`send_summary`** — After a visitor connects (shares identity) and has a real conversation, Fenix offers to email a personalized recap: "Want me to send you a summary of what we covered + the PM resume we looked at?" Composed from conversation history, sent via Resend (already in the stack). The conversation outlives the browser tab.

### Why second
These directly serve the site's northstar — personas become persons. A booked meeting is the strongest conversion signal. A follow-up email maintains the relationship after the tab closes. Both are just new tools in the existing agent framework, so the implementation is scoped (one session) because the hard architecture work is done in Phase 1.

### Key integrations
- Calendly API (already in the stack per ARCHITECTURE.md)
- Resend (already in the stack for transactional email)

### Success criteria
A visitor has a good conversation → Fenix naturally suggests booking time → visitor picks a slot without leaving the page → gets a personalized email summary within minutes. The entire journey from "who is this person?" to "we have a meeting" happens in one continuous experience.

---

## Phase 3: The Showcase Layer — Live Fit Score + Micro-Teardown
**Effort:** 1–2 sessions
**Depends on:** Phase 1 (agent framework), Phase 2 nice-to-have but not blocking

### What gets built

**`run_fit_score`** — The existing fit score concept, reimagined as a conversational experience. Visitor pastes a JD into the chat. Fenix processes it with visible thinking steps rendered as `tool_thinking` messages:

> *"Analyzing role requirements..."*
> *"Strong match on cross-functional product leadership..."*
> *"Gap: no enterprise SaaS experience listed, but consulting work overlaps..."*

Then delivers a scored breakdown with honest commentary. Not a black box number — a narrative evaluation that demonstrates how I think about fit. If there are gaps, Fenix says so. Honesty is the feature.

**`generate_micro_teardown`** — Visitor names a product or app. Fenix applies my teardown methodology to generate a structured 3–4 point analysis on the spot. It references published teardowns as comparables ("This reminds me of a pattern Kiran identified in the GEICO teardown..."). This turns my methodology from static content into a live, interactive capability.

### Why third
These are showcase features — they demonstrate thinking in real-time. But they're more complex: fit score needs JD parsing logic and scoring rubrics, micro-teardown needs methodology encoding in the system prompt. Both benefit from Phase 1 being live for a while so I can observe how visitors actually use Fenix and calibrate these features accordingly.

### Design principles
- **Fit score is mutual** — it evaluates fit in both directions, not just "is Kiran qualified for this role?"
- **Micro-teardown is methodology, not content** — it shows how I think, not what I've already published
- **Honesty over polish** — both features gain credibility by being transparent about limitations and gaps

### Success criteria
A hiring manager pastes a JD → sees Fenix think through the evaluation in real-time → gets an honest, scored assessment that surfaces both strengths and gaps → feels like they just had a substantive conversation about fit, not a sales pitch. A curious visitor names a product → gets a structured mini-analysis that makes them think "this is how this person's brain works."

---

## Phase 4: The Immersion Layer — Voice + Dynamic Personalization
**Effort:** 2–3 sessions
**Depends on:** Phases 1–3 stable and live

### What gets built

**Voice mode (input + output)** — Web Speech API for visitor input (talk to Fenix), ElevenLabs for Fenix's voice output (consistent, warm, not robotic). The visitor can have a spoken conversation with the site. Toggle between text and voice seamlessly. Speech-to-text input is simpler (browser-native API); text-to-speech output is the wow factor.

**Dynamic page personalization** — Fenix learns through conversation what the visitor cares about. The page subtly adapts:
- Work section reorders to surface relevant projects first
- Numbers section highlights pertinent metrics
- Card recommendations adjust based on explored content
- Section emphasis shifts (an engineer sees more technical depth, a hiring manager sees more outcomes)

The visitor doesn't notice the mechanics — it just feels like the site understands them. This is the invisible version of the persona picker: instead of asking "who are you?", the site figures it out and adapts.

### Why last
These are the most technically complex and benefit most from everything else being stable. Voice mode needs a smooth agent experience underneath (you don't want voice on top of a buggy chat). Dynamic personalization touches the entire page layout, not just the chat module, and benefits from understanding visitor behavior patterns collected during Phases 1–3.

### Technical considerations
- **Voice:** ElevenLabs has per-character costs — need to scope which responses get voice vs. which stay text-only. Short responses are voice-friendly; long explanations should stay text.
- **Personalization:** Needs a lightweight scoring model that maps conversation signals to content weights. The persona inference logic in fenix_service.py is a starting point but needs to drive page layout, not just system prompt selection.
- **Privacy:** Dynamic personalization should feel helpful, not creepy. No "I noticed you've been looking at..." — just silently surface the most relevant content.

### Success criteria
A visitor arrives → speaks to Fenix naturally → the site adapts to their interests in real-time → they have a voice conversation that ends with a booked meeting → they receive a personalized email follow-up → they tell someone "you have to see this site." The site isn't showing my work — it IS my work.

---

## Timeline View

```
Phase 1: Foundation          ████████████░░░░░░░░░░░░░░  2-3 sessions
Phase 2: Relationships       ░░░░░░░░░░░░████░░░░░░░░░░  1 session
Phase 3: Showcase            ░░░░░░░░░░░░░░░░█████░░░░░  1-2 sessions
Phase 4: Immersion           ░░░░░░░░░░░░░░░░░░░░░██████  2-3 sessions
                             ─────────────────────────────
                             ~7-9 sessions total
```

---

## What's NOT on this roadmap (and why)

**Multi-language Fenix** — The existing Fenix backend has language support scaffolded (Spanish). Deferred because the Ultimate Persona is English-first and adding languages multiplies testing surface for every feature.

**Fenix on other pages** — Right now Fenix lives on the evaluator persona page. Expanding to all pages (teardowns, blog, MadLab) is architecturally simple (the agent endpoint is page-agnostic) but should wait until the evaluator experience is polished. The evaluator page is the highest-stakes context.

**OpenClaw / external agent frameworks** — Evaluated and rejected for this use case. OpenClaw is a personal assistant (single user, system access, messaging apps). Fenix is a public-facing website agent with scoped tools and no system access. Different architectures for different problems. OpenClaw could be interesting as a personal productivity layer (e.g., checking form submissions via WhatsApp) but that's a separate project.

**Autonomous outreach** — Fenix proactively emailing visitors who didn't connect, or following up on lapsed conversations. Deferred because it crosses from "helpful" to "aggressive" and the site's philosophy is "let the visitor lead."

---

## Principles (apply to all phases)

1. **The agent architecture is the multiplier.** Every feature is a tool. The investment is in Phase 1; everything after is incremental.
2. **Honesty is the feature.** Fenix says "I don't know" and "there's a gap here." This is what makes it credible.
3. **The visitor leads.** Fenix responds, guides, suggests — never pushes, gates, or manipulates.
4. **The medium is the message.** How Fenix works IS the proof of product capability. A visitor experiencing a well-designed conversational agent learns more about how I think than any resume could tell them.
5. **No throwaway work.** Each phase builds on the last. SessionStorage becomes Supabase persistence when needed. The 6 tools become 10. The nudge logic becomes the booking flow. Nothing gets rebuilt.
