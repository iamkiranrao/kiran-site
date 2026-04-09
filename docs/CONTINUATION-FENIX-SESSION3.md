# Continuation Prompt — Fenix Session 3

**Created:** April 9, 2026
**Use this to start the next Cowork session for Fenix development.**

Copy everything below the line into the first message of a new Cowork session. Mount both `~/Kiran's Website` and `~/fenix-backend`.

---

## Context

I'm continuing Fenix development. Last two sessions built the agentic Fenix layer (Phase 1 of the AI roadmap). Here's what's live and what's next.

### What's deployed and working

**Backend** (`api.kirangorapalli.com` / `fenix-backend-omega.vercel.app`):
- `POST /api/v1/fenix/agent` — agentic endpoint with 6 tools, RAG pipeline (319 Q&As + 153 chunks via Supabase pgvector), Claude tool_use API, multi-round tool loop (up to 5), SSE streaming
- System prompt tuned on April 9 for better response depth — energy-matching instead of rigid word caps
- `suggested_pills` SSE event — Claude suggests contextual follow-up pills, parsed from `[PILLS: "...", "..."]` at end of response

**Frontend** (`evaluator-experience.js` on Cloudflare Pages):
- Full agent layer: `sendToAgent()`, `toolExecutors`, `fenixState` (sessionStorage), streaming text renderer
- 6 tool executors: open_panel, close_panel, select_resume_lens, scroll_to_section, get_visitor_context, start_fit_score
- Dynamic pills: hybrid state machine (`getDefaultPills()`) + backend override (`suggested_pills` SSE event) + `updatePills()` with fade transition
- Pills route through `sendToAgent()` — Fenix decides what to do

**Key files:**
- `evaluator-experience.js` — frontend agent layer, ~1200 lines
- `evaluator-styles.css` — all evaluator page styles including agent message types
- `fenix-backend/api/v1/fenix/agent.py` — backend agent endpoint, ~500 lines
- `fenix-backend/services/rag_service.py` — RAG pipeline (used by agent)
- `fenix-backend/services/fenix_service.py` — original chat pipeline (has conversation logging pattern to port)
- `docs/FENIX-AI-ROADMAP.md` — 4-phase strategic plan
- `docs/FENIX-AGENT-SPEC.md` — technical spec (v1.0, updated April 9)

### Two tasks for this session

#### Task 1: Add conversation logging to the agent endpoint (HIGH PRIORITY)

The `/api/v1/fenix/chat` endpoint logs every conversation to Supabase (conversations table + messages table). The `/api/v1/fenix/agent` endpoint does NOT log anything. We need visibility into how real visitors interact with agentic Fenix.

**How to approach:**
1. Read `fenix-backend/services/fenix_service.py` — specifically the `chat_stream()` function. It creates/retrieves conversations via `conversation_service.py` and stores messages via the same service. Understand the pattern.
2. Read `fenix-backend/services/conversation_service.py` — the Supabase conversation + message persistence layer.
3. Port the logging into `agent.py`. Key decisions:
   - Log at the END of each agent turn (after the tool loop resolves), not per-tool-round
   - Store the full assistant response (text only, not tool events) as the assistant message
   - Store visitor messages as they come in
   - Create a conversation record on first message, retrieve on subsequent
   - The agent request includes `visitor` and `explored` — store these as metadata
4. Don't break the streaming — logging should be async/fire-and-forget after the stream completes

**Supabase tables (already exist):**
- `conversations`: id, session_id, persona, page_url, user_agent, started_at, last_active_at
- `messages`: id, conversation_id, role, content, citations, search_metadata, created_at

#### Task 2: Design cross-page Fenix navigation (DESIGN + SPEC, NOT BUILD)

Kiran's vision: Fenix lives on every page of the site, not just the evaluator page. When a visitor asks about teardowns, Fenix can navigate them to the teardowns page. The conversation persists via sessionStorage across the navigation. The Fenix module on the new page picks up the conversation and continues.

**What to produce:**
1. A spec for the `navigate_to_page` tool — tool definition, available pages, how the frontend handles the navigation
2. A design for "lightweight Fenix modules" on non-evaluator pages — what's shared (agent endpoint, fenixState, SSE parsing, streaming renderer) vs. what's page-specific (tools, panels, UI chrome)
3. A plan for page-contextual tool registries — how the backend knows which tools are available on which page, and how the frontend registers page-specific tool executors
4. Important context: Fenix will eventually be on every persona page (not just evaluator), each with persona-specific tools and unlocks. The architecture needs to support this.

**DON'T build this yet** — just produce the spec. The build is a separate session.

### Reference docs to read first

- `docs/FENIX-AI-ROADMAP.md` — the full 4-phase plan
- `docs/FENIX-AGENT-SPEC.md` — current agent spec
- `docs/ARCHITECTURE.md` — system topology
- `fenix-backend/services/fenix_service.py` — conversation logging pattern to port
- `fenix-backend/services/conversation_service.py` — Supabase persistence layer

### Build process reminder

Follow the three-gate process from CLAUDE.md: Agreement → Gameplan → Pre-flight. Task 1 is a build task (all three gates). Task 2 is design only (Gate 1 only — just get alignment on the approach).
