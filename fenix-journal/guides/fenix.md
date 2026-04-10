---
module: fenix
title: Fenix (AI Assistant)
created: 2026-03-12
last_updated: 2026-04-09
version: 2
---

# Fenix (AI Assistant)

## Overview

Fenix is a conversational AI assistant embedded across kiranrao.ai that answers questions about Kiran's work, experience, and expertise. It's not Kiran, but rather a knowledgeable guide that translates portfolio content into whatever context a visitor needs.

Fenix operates in two distinct modes:

- **Published mode** (default): Answers from curated, polished portfolio content
- **Flame On mode** (opt-in): Answers from Kiran's working-process data (journal entries, session transcripts, product guides)

The assistant uses a retrieval-augmented generation (RAG) pipeline to ground responses in actual content, infers the visitor's intent through persona detection, and streams responses in real-time with inline citations.

---

## Architecture

### Frontend: Vanilla JS Widget

The widget (`fenix-widget.js`) is a self-contained IIFE (immediately-invoked function expression) with zero dependencies. It's loaded on every page via deferred script tag, so it doesn't block initial page load.

**Key components:**

- **Floating action button (FAB):** Persistent chat icon in bottom-right corner
- **Chat overlay:** Full-screen on mobile, side panel on desktop (responsive CSS)
- **Session persistence:** Uses `localStorage` to maintain conversation state and Flame On toggle
- **SSE streaming:** Connects to backend via `fetch()` POST with streaming event handler (EventSource-like pattern)
- **Markdown rendering:** Simple parser for bold, italic, links, lists, and code blocks
- **Flame On toggle:** Checkbox in header that switches RAG to working-process data
- **Flame On onboarding:** First-time toggle shows explanation card, then mark as onboarded

**Configuration:**

```javascript
const API_BASE = 'https://api.kiranrao.ai';
const CHAT_ENDPOINT = `${API_BASE}/api/v1/fenix/chat`;
const MAX_MESSAGE_LENGTH = 2000;
const FLAME_ON_KEY = 'fenix_flame_on';
const TOOLTIP_DELAY_MS = 1500;
const TOOLTIP_DURATION_MS = 5000;
```

The widget automatically:
- Detects when it's open and streams messages
- Recovers from connection failures gracefully
- Stores session ID in localStorage to resume conversations
- Shows contextual tooltips after page settles (delayed, finite duration, once per session)

### Backend: FastAPI on Vercel

The backend (`fenix_service.py`) runs on Vercel serverless at api.kiranrao.ai and orchestrates the entire chat pipeline:

1. **Conversation management:** Creates or retrieves conversation from Supabase
2. **Persona inference:** Analyzes user message + history for hiring_manager, engineer, collaborator, or curious
3. **RAG retrieval:** Queries pgvector for similar content chunks
4. **System prompt assembly:** Builds base + persona + RAG context + page context
5. **Claude streaming:** Calls Claude API with server-sent events for real-time response
6. **Message storage:** Persists user and assistant messages with metadata
7. **Training queue:** Logs low-confidence questions for future knowledge curation

### RAG Pipeline: Vector Search + Fallbacks

The RAG service (`rag_service.py`) implements a sophisticated retrieval strategy:

**Embedding model:** Voyage AI voyage-3-lite (512 dimensions, optimized for semantic search)

**Search flow:**

1. **Query embedding:** Convert user question to 512-dim vector via Voyage AI API
2. **Vector similarity search:** Use pgvector cosine similarity on Supabase with `match_content_embeddings()` RPC
3. **Source type filtering:** Pass `filter_source_type='published'` (default) or `'flame_on'` (when Flame On is active)
4. **Keyword fallback:** If semantic search returns 0 results, extract keywords and try text-based search via `keyword_search_content()` RPC
5. **Training data search:** Independently search `training_data` table for Q&A pairs (personal knowledge) via semantic and text matching
6. **Context assembly:** Format chunks with citation markers, similarity scores, and training matches into LLM context

**Thresholds:**
- Similarity threshold: 0.2 (lowered from 0.3 to catch edge-case matches)
- Top-k default: 5 chunks
- Training data top-k: 3 matches

**Citation handling:**
- Up to 3 unique URLs deduplicated by citation chips (keep highest-similarity one per page)
- Inline markdown links embedded in response text
- All RAG-sourced claims cite sources automatically

### Data Pipeline: Chunking & Embedding

**Published content pipeline** (`chunk_and_embed.py`):

1. Takes extracted content JSON (pages with sections, metadata)
2. Splits into semantic chunks at sentence boundaries (~500 tokens, 50-token overlap)
3. Prefixes chunks with page title + section context for coherence
4. Generates embeddings via Voyage AI in batches (4 texts per batch, 20s between batches for rate limits)
5. Stores in Supabase `content_registry` and `content_embeddings` tables with `source_type='published'`

**Flame On data pipeline** (`embed_flame_on_data.py`):

1. Discovers journal entries (about-kiran, build-journey, connecting-threads) and product guides from `fenix-journal/`
2. Strips frontmatter, chunks at markdown section (## heading) boundaries
3. Generates embeddings with `source_type='flame_on'`
4. Stores separately so RAG can filter by source type

**Database tables:**

- `content_registry`: Pages/guides with metadata, title, URL, content_type, source_type
- `content_embeddings`: Chunks with pgvector embeddings, parent content ID, source_type
- `training_data`: Q&A pairs (fallback knowledge for personal/opinion questions)
- `conversations`: Session tracking with persona, language, page_url, user_agent
- `messages`: Full message history with citations, tokens, similarity scores

---

## Key Decisions

### Persona System: Inferred, Not Selected

Fenix detects the visitor's role by analyzing keywords in their message and conversation history. This happens automatically without explicit user input.

**Four personas:**

- **hiring_manager:** Keywords like "team size", "leadership", "hire", "KPIs" → emphasizes business impact, metrics, cross-functional collaboration
- **engineer:** Keywords like "architecture", "code", "API", "system design", "vector", "RAG" → goes deeper on technical decisions and implementation details
- **collaborator:** Keywords like "work together", "partner", "consulting", "availability" → emphasizes working style, process, deliverables
- **curious:** No strong signal → balanced, accessible answers; acts as a tour guide

The persona is inferred per-conversation and stored in the database, allowing the response tone to adapt over multiple exchanges.

### System Prompt Assembly

The final system prompt is built from multiple layers:

1. **Base prompt:** Fenix's core voice and rules (never claim to be Kiran, say "Kiran built...", direct and concise, max 2-3 sentences by default)
2. **Persona context:** Visitor-specific framing based on inferred role
3. **Page context:** Where the visitor opened Fenix (e.g., "opened from the GEICO teardown page")
4. **RAG context:** Retrieved knowledge base chunks with citation markers
5. **Flame On instructions** (conditional): When Flame On is active, rules shift to "answer ONLY from working-process data, be transparent about sources, admit knowledge gaps"
6. **Nudge instruction** (conditional): After 3+ substantive exchanges, offer to send a summary or connect with Kiran directly

### Anti-Hallucination Rules

The system prompt includes explicit guardrails:

- Never claim Kiran worked at a company unless the knowledge base explicitly says so. (A teardown of GEICO ≠ employment at GEICO)
- Never invent projects, titles, or roles
- Never extrapolate career history
- When lacking information, say so: "I have limited details on that"
- Omit rather than guess

### Flame On Mode

Flame On is a toggle that switches RAG to search only working-process data instead of published portfolio content. When active:

- User sees a "Flame On" badge in the chat header
- RAG queries filter embeddings by `source_type='flame_on'`
- System prompt includes Flame On-specific instructions ("answer from working-process data", "be transparent about source dates", "admit knowledge gaps")
- Tone shifts from polished to candid and reflective
- First-time toggle shows explanation: "Talk directly to Fenix about Kiran's working process — daily journal entries, session transcripts, and product guides"

**Storage:**
- Flame On state persists in localStorage (`fenix_flame_on = 'true'` or `'false'`)
- Onboarded flag stored separately to show explanation card once

### Training Queue & Knowledge Curation

When Fenix receives a question with zero RAG chunks (low confidence), it logs the question to `training_queue` with frequency tracking. This surfaces gaps in the knowledge base for Kiran to curate:

- Similar questions are deduplicated and frequency is incremented
- Dashboard can show top unanswered questions
- Answers can be added to `training_data` table as Q&A pairs

### Nudge System

After a visitor has engaged substantively (3+ exchanges with >20 chars each), Fenix may nudge:

- **Deep engagement nudge** (5+ exchanges): "I can send you a summary of everything we've covered if you share your email. Or if you'd like to chat with Kiran directly, I can help you find a time."
- **Gentle nudge** (3-4 exchanges): "You might also enjoy the [GEICO teardown](URL) — it covers similar themes."

Each conversation only gets nudged once, and only if the offer hasn't already appeared.

---

## Evolution

### Phase 5: MVP Complete (March 2026)

The initial release brings the following online:

- Vanilla JS widget with zero dependencies, responsive design
- FastAPI backend with Claude streaming via SSE
- RAG pipeline with Voyage AI embeddings + pgvector
- Persona inference from keywords
- Conversation persistence with page/user-agent tracking
- Citation extraction and inline linking
- Flame On toggle with onboarding card
- Training queue for knowledge gaps
- Dashboard analytics (conversation count, personas, sources)
- Dark/light mode support

All deployed and live on kiranrao.ai across 16+ pages.

### Phase 6: Agentic Fenix (April 8, 2026)

Fenix upgraded from a RAG chatbot to a full conversational agent with tool use on the evaluator persona page. This is the foundation for the 4-phase AI roadmap (see `docs/FENIX-AI-ROADMAP.md`).

**New backend endpoint:** `POST /api/v1/fenix/agent` — lives alongside the original `/chat` endpoint. Runs an agentic loop: RAG retrieval, Claude with tool definitions, multi-round tool execution (up to 5 rounds per turn), SSE streaming with interleaved text + tool_use events.

**6 page-manipulation tools:**
- `open_panel` — opens resume, questions, or connect panels
- `close_panel` — closes the current panel
- `select_resume_lens` — pre-selects AI, Growth, or Mobile lens
- `scroll_to_section` — navigates to about, work, numbers, or contact
- `get_visitor_context` — reads the visitor's exploration state
- `start_fit_score` — initiates the fit evaluation (gated behind connect)

**Frontend agent layer** (in `evaluator-experience.js`):
- `fenixState` conversation state object tracking messages, visitor info, explored content, and UI state, persisted to sessionStorage
- `sendToAgent()` — SSE stream parser using fetch/ReadableStream that handles text_start/text_delta/text_end/tool_use/suggested_pills/error/done events
- `toolExecutors` — maps tool_use events to actual page manipulation (opening panels, scrolling, selecting lenses)
- Streaming text renderer with cursor blink animation
- Tool thinking + tool result message renderers
- Input disable/enable during Fenix thinking
- Card clicks and pill clicks route through the agent instead of directly opening panels

**Rate limiting:** 30 requests/minute per IP, 30-message session cap on frontend with graceful connect nudge.

### Phase 6b: Dynamic Pills (April 9, 2026)

Pills (quick-action buttons below the chat) upgraded from static to contextual. Hybrid approach: frontend state machine provides instant default pills after each response, backend can override with Claude-suggested pills via a `suggested_pills` SSE event.

**Frontend state machine (`getDefaultPills()`):** Returns pill set based on `fenixState.explored` — different pills for opening state, mid-conversation, post-resume, post-connect, and near-cap. The 🔒 connect pill appears after 3+ exchanges for unconnected visitors.

**Backend pill suggestions:** System prompt instructs Claude to append `[PILLS: "phrase", "phrase"]` at the end of responses. The backend extracts this, strips it from displayed text, and emits it as a `suggested_pills` SSE event. Claude's suggestions override the state machine defaults when present.

**`updatePills()` function:** Swaps pill container contents with a CSS fade transition (fade out old, fade in new).

---

## Current State

### Two Fenix Modes

**1. Widget mode** (original, all pages): The `fenix-widget.js` FAB + overlay chat. Uses `POST /api/v1/fenix/chat`. Persona inference, Flame On toggle, citation chips, nudge system. Still active on all non-evaluator pages.

**2. Agent mode** (evaluator page only): Embedded in `evaluator-experience.js` chat module. Uses `POST /api/v1/fenix/agent`. Tool use, page manipulation, dynamic pills, streaming text with tool interleaving. This is the flagship experience going forward.

### Tables & Data

**Conversations:**
- Persisted in `conversations` table with session_id (localStorage key)
- Tracks persona (inferred), page_url, user_agent, started_at, last_active_at
- Max 20 messages loaded for context window management
- Note: Agent mode conversation logging not yet implemented (pending Session 2)

**Messages:**
- Stored with role, content, citations (list of {id, title, url, section, similarity})
- Assistant messages include search metadata: rag_chunks_used, similarity_scores, search_type ("semantic", "keyword", "none")

**Content Embeddings:**
- 512-dimensional Voyage AI vectors
- Filtered by source_type: 'published' (default) or 'flame_on'
- Indexed for fast pgvector similarity search
- 319 training Q&As + 153 content chunks currently indexed

**Training Data:**
- Q&A pairs with category and source
- Dual search strategy: semantic (vector) + text (pg_trgm)
- Used as fallback for personal/opinion questions when RAG chunks are sparse

### Frontend State Management

**Widget mode** state tracked in localStorage:
- `fenix_session_id`: Persists conversation across page navigations
- `fenix_flame_on`: Flame On toggle state ('true' or 'false')
- `fenix_flame_on_onboarded`: First-time toggle flag
- `fenix_tooltip_seen`: Prevents duplicate tooltips in same session

**Agent mode** state tracked in sessionStorage via `fenixState`:
- `messages`: Full conversation history (capped at 40 stored)
- `visitor`: Persona, name, company, email, connected status
- `explored`: Cards clicked, panels opened, resume lens selected, fit score started, pills used, messages exchanged
- `ui`: Current panel, pills visible, input enabled, Fenix typing

### API Endpoints

**Original chat (all pages):**
```
POST https://api.kiranrao.ai/api/v1/fenix/chat
```
Response: SSE with session, persona, chunk, citations, nudge, done events.

**Agent (evaluator page):**
```
POST https://api.kiranrao.ai/api/v1/fenix/agent
{
  "messages": [{"role": "user", "content": "..."}],
  "visitor": {"persona": "evaluator", "name": null, "connected": false},
  "explored": {"cardsClicked": [], "panelsOpened": [], "messagesExchanged": 1}
}
```
Response: SSE with text_start, text_delta, text_end, tool_use, suggested_pills, error, done events.

**Health check:**
```
GET https://api.kiranrao.ai/api/health
```

---

## Known Issues & Limitations

### RAG Limitations

1. **Keyword search fallback is noisy:** When semantic search fails, keyword extraction can match on common words without semantic relevance. This is acceptable for rare edge cases but not ideal.

2. **Embedding dimensions mismatch risk:** If Voyage AI API changes model or dimensions, old embeddings won't match. Voyage AI stability is assumed.

3. **Training data dual search overhead:** Searching training_data via both semantic and text methods adds latency. Could be optimized by weighting one strategy higher.

4. **Citation deduplication:** Only top 3 unique URLs are shown to frontend, but LLM context includes all chunks. This asymmetry could cause LLM to cite something not shown in the chips.

### Frontend Limitations

1. **SSE via fetch() is not standard EventSource:** Custom event parsing is implemented, which could fail with edge-case server responses.

2. **Markdown rendering is simplistic:** Bold, italic, links, lists work; tables, inline HTML, complex nested structures don't.

3. **Session recovery only on widget open:** If a conversation is left idle and localStorage is cleared, it's lost. No server-side fallback.

### Backend Limitations

1. **Vercel serverless timeout:** Chat responses must complete within 30s (Vercel limit). Long elaborations or high latency could timeout.

2. **Rate limiting on Voyage AI:** Free tier batches at 4 texts per request with 20s delay between. This slows embedding generation for large bulk operations.

3. **No user authentication:** Conversations are identified by session_id only. No way to retrieve old conversations across browsers or devices.

### Flame On Data Freshness

Flame On data is static after embedding. New journal entries don't automatically appear in RAG until the `embed_flame_on_data.py` script is run manually.

---

## Ideas & Future Direction

The primary roadmap is in `docs/FENIX-AI-ROADMAP.md`. The agentic architecture (Phase 1) is the multiplier — every future feature is just "add a tool definition to Fenix."

### Roadmap (from FENIX-AI-ROADMAP.md)

**Phase 2 — Relationship Layer (~1 session):** `book_meeting` tool (Calendly slots in-chat, no redirect) + `send_summary` tool (personalized email recap via Resend). Conversation persistence in Supabase. Agent conversation logging.

**Phase 3 — Showcase Layer (~1-2 sessions):** `run_fit_score` tool (visitor pastes JD, Fenix evaluates with visible thinking steps) + `generate_micro_teardown` tool (live methodology application). Both demonstrate product thinking in real-time.

**Phase 4 — Immersion Layer (~2-3 sessions):** Voice mode (Web Speech API input + ElevenLabs output) + dynamic page personalization (page adapts based on conversation signals).

### Widget Mode Improvements (Lower Priority)

1. **Flame On automatic updates:** Trigger re-embedding on file change
2. **Better keyword fallback:** Query intent classification
3. **Session recovery API:** Resume conversations across devices
4. **Feedback loop:** Thumbs up/down on responses
5. **Knowledge base versioning:** Tag embeddings with content version/date

---

## Source Sessions

- **2026-03-03 08:49:47 UTC** — Initial context session: full Fenix architecture, schema, infrastructure credentials, and Phase 5 completion status
- **2026-03-03 20:14:05 UTC** — Debug session: RAG returning 0 chunks despite embeddings existing; identified source_type filtering design decision and RPC function updates
- **Multiple build sessions** — Iterative implementation of RAG, Flame On, persona system, citation extraction, widget UI, streaming, and training queue

---

## Relationship to Other Components

**Fenix Dashboard** is NOT part of this product — it's a separate analytics view in the Command Center that shows conversation metrics, persona distribution, and query volume.

**Fenix Journal** is the knowledge base for Flame On mode (diary entries, session transcripts, guides), but separate from the Fenix Assistant product itself.

**Evaluator Experience** (`evaluator-experience.js`) is the persona page where agent-mode Fenix lives. The chat module, cards, panels, and pills are all part of this file. Fenix manipulates this page via tool use.

**FENIX-AGENT-SPEC.md** (`docs/FENIX-AGENT-SPEC.md`) is the technical contract for the agent layer — message types, SSE events, tool definitions, frontend-backend contract.

**FENIX-AI-ROADMAP.md** (`docs/FENIX-AI-ROADMAP.md`) is the strategic 4-phase plan for Fenix's evolution from chat stub to flagship product.

**Fenix** (this product) is the user-facing conversational AI in two modes: widget (RAG chat across all pages) and agent (tool-use conversational agent on the evaluator page). The agent mode is the primary development focus going forward.
