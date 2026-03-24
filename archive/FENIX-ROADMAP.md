# Fenix & Command Center Roadmap

**Owner:** Kiran Rao
**Created:** 2026-03-04
**Status:** Active

---

## Goal

Ensure all content flows from Command Center through to the live site and into Fenix's knowledge base automatically. Build a Fenix dashboard in Command Center for analytics and training. Validate everything end-to-end.

---

## Architecture Overview

```
Command Center (local FastAPI + Next.js)
    │
    ├── Teardown Builder ──→ git push ──→ GitHub ──→ Netlify deploy
    ├── WordWeaver (Blog) ──→ git push ──→ GitHub ──→ Netlify deploy
    ├── MadLab Builder ────→ git push ──→ GitHub ──→ Netlify deploy  [NEW]
    │                                        │
    │                              GitHub Action triggers
    │                                        │
    │                              content_extractor.py
    │                              chunk_and_embed.py
    │                                        │
    │                                        ▼
    │                              Supabase (pgvector)
    │                              ┌─────────────────┐
    │                              │ content_registry │
    │                              │ content_embeddings│
    │                              │ conversations    │ [NEW]
    │                              │ messages         │ [NEW]
    │                              │ training_data    │ [NEW]
    │                              └─────────────────┘
    │                                        │
    └── Fenix Dashboard ◄──── reads from ────┘
        ├── Query Analytics
        ├── Failure Detection
        ├── Content Coverage
        └── Train Fenix        [NEW]
```

**Live services:**
- Site: kirangorapalli.com (Netlify, from GitHub `kiran-site`)
- Fenix API: fenix-backend-omega.vercel.app (Vercel, from GitHub `fenix-backend`)
- Database: Supabase project `gndzmmywtxvlukoavadj`
- Embeddings: Voyage AI (`voyage-3-lite`, 512 dims)

---

## Phase 1: Validate Existing Content Pipeline

**Goal:** Confirm teardown and blog publishing works end-to-end after rearchitecture, including Fenix auto-reindex.

### Step 1.1 — Start Command Center locally
- [x] Run backend: `cd command-center/backend && python main.py`
- [x] Run frontend: `cd command-center/frontend && npm run dev`
- [x] Verify dashboard loads at localhost:3000
- [x] Verify API health check at localhost:8000/health

### Step 1.2 — Test Teardown Builder end-to-end
- [x] Create a test teardown session (can use a dummy company)
- [x] Walk through at least steps 1-3 to verify streaming works
- [x] Test approve/revise flow
- [x] Test publish (local preview)
- [x] Test deploy (git push to production) — use a test branch if needed
- [x] Document any bugs or failures

### Step 1.3 — Test WordWeaver (Blog) end-to-end
- [x] Create a test blog session
- [x] Walk through at least steps 1-3
- [x] Test publish + deploy flow
- [x] Test crosspost generation (Medium/Substack markdown)
- [x] Document any bugs or failures

### Step 1.4 — Test Content Audit
- [x] Run full site audit from Command Center
- [x] Verify it scans all HTML files and reports violations
- [x] Run visual audit on a teardown page
- **Note:** Content audit found 86 violations (21 high severity) across 10 pages. Visual audit found 1,701 violations (96 high severity) across 25 pages. No accept/ignore workflow exists yet — audit is diagnostic only. No clean pages. Consider adding accept/dismiss UI in a future phase.

### Step 1.5 — Validate GitHub Action reindex
- [x] Confirm `fenix-reindex.yml` workflow exists and is correct
- [x] Check GitHub repo secrets are set: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `VOYAGE_API_KEY`, `FENIX_BACKEND_PAT`
- [x] Push a small HTML change to main and watch Actions tab
- [x] Verify the workflow runs `content_extractor.py` → `chunk_and_embed.py`
- [x] Query Supabase to confirm new/updated embeddings appeared — 197/197, 0 errors (fixed FK mismatch bug in chunk_and_embed.py)
- [x] If secrets are missing, add them in GitHub Settings → Secrets — all 4 present
- **Bug fixed:** `chunk_and_embed.py` had a UUID mismatch between content_registry and content_embeddings. Registry used `uuid5(canonical_url)` but embeddings used `uuid5(hardcoded_domain + path)`. Fixed in commit `038787f` on fenix-backend. Run #30 confirmed 197/197 stored, 0 errors.

### Step 1.6 — Validate Fenix answers updated content
- [x] After reindex completes, ask Fenix about the updated content
- [x] Confirm citations reference the correct, updated chunks — tested with ACH blog post, citation correct
- [ ] Test keyword fallback still works

**Exit criteria:** Teardown and blog content published from Command Center appears in Fenix's knowledge base automatically within minutes.

---

## Phase 2: Add Conversation Logging to Fenix Backend

**Goal:** Instrument the Fenix chat API to log every conversation to Supabase. This is the foundation for the dashboard.

### Step 2.1 — Create Supabase tables
- [x] Create `conversations` table:
  ```sql
  CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    started_at TIMESTAMPTZ DEFAULT now(),
    last_activity TIMESTAMPTZ DEFAULT now(),
    page_url TEXT,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'
  );
  ```
- [x] Create `messages` table:
  ```sql
  CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id),
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    citations JSONB DEFAULT '[]',
    rag_chunks_used INT DEFAULT 0,
    similarity_scores JSONB DEFAULT '[]',
    search_type TEXT CHECK (search_type IN ('semantic', 'keyword', 'none')),
    tokens_used INT,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  ```
- [x] Create `training_data` table:
  ```sql
  CREATE TABLE training_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category TEXT,
    source TEXT DEFAULT 'kiran_training',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );
  ```
- [x] Add RLS policies (allow service_role full access)
- [x] Create indexes on `messages.conversation_id`, `messages.created_at`, `conversations.session_id`
- **Migration:** `fenix-backend/migrations/003_conversation_logging.sql` — includes ALTERs for existing tables (added `page_url`, `user_agent` to conversations; `rag_chunks_used`, `similarity_scores`, `search_type` to messages), CREATE for training_data, pg_trgm extension, all indexes, RLS policies, and `updated_at` trigger.

### Step 2.2 — Update Fenix backend to log conversations
- [x] In `fenix_service.py` (or `chat.py`): after generating a response, INSERT into `conversations` (upsert by session_id) and `messages`
- [x] Log: user query, assistant response, citations used, RAG chunk count, similarity scores, search type (semantic/keyword/none), page URL
- [x] Keep logging async and non-blocking — a failed log should never break the chat
- [x] Deploy updated backend to Vercel — auto-deployed via GitHub push (commit `27d9682`, Vercel production green)
- **Changes:** `chat_stream()` now accepts `page_url` and `user_agent` params, passes them to `get_or_create_conversation()`. Assistant messages now log `rag_chunks_used`, `similarity_scores`, and `search_type`.

### Step 2.3 — Update RAG service to log search metadata
- [x] Return search_type ('semantic', 'keyword', 'none') from `retrieve()`
- [x] Return similarity scores array alongside chunks
- [x] Pass this metadata through to the logging layer
- **Changes:** `RAGContext` dataclass now includes `search_type`, `similarity_scores`, and `training_matches` fields. `retrieve()` sets search_type based on which search path succeeds.

### Step 2.4 — Include training_data in RAG retrieval
- [x] Create `match_training_data` SQL function:
  ```sql
  -- Uses pg_trgm similarity() for fuzzy text matching
  -- Returns Q&A pairs where the question is similar to the user query
  -- Included in 003_conversation_logging.sql migration
  ```
- [x] Update `rag_service.py` to also search `training_data` table
- [x] Merge training results with content_embeddings results in context
- [x] Deploy and test — verified end-to-end: inserted 3 test Q&A pairs into training_data, asked Fenix "What is Kiran's favorite programming language?", got response incorporating training data ("Python — versatile enough for backend services, data science, and AI/ML work"). Conversation logged with search_type: keyword, rag_chunks_used: 3.
- **Changes:** New `search_training_data()` function in `rag_service.py` calls `match_training_data` RPC. Training matches are appended to the LLM context under a "Personal Knowledge" section. New `TrainingMatch` dataclass added.

**Exit criteria:** Every Fenix conversation is logged to Supabase with full metadata. Training data is searchable alongside indexed content.

---

## Phase 3: Build MadLab Module in Command Center

**Goal:** Create a repeatable workflow for publishing MadLab prototypes, matching the teardown/blog pattern.

### Step 3.1 — Define MadLab content template
- [x] Analyze existing prototype pages (e.g., insurance chatbot) for structure
- [x] Create `madlab-template.html` in `backend/templates/`
- [x] Define sections: The Problem, System Architecture, How It Works, Try It Yourself, Tech Stack
- [x] Include Fenix-compatible metadata (skills, themes, connections)

### Step 3.2 — Build MadLab backend router
- [x] Create `backend/routers/madlab.py` with endpoints:
  - `GET /api/madlab/steps` — return workflow step definitions
  - `POST /api/madlab/create` — start new prototype session
  - `GET /api/madlab/sessions` — list sessions
  - `GET /api/madlab/sessions/{id}` — get session state
  - `POST /api/madlab/sessions/{id}/step` — run current step (SSE)
  - `POST /api/madlab/sessions/{id}/approve` — approve step
  - `POST /api/madlab/sessions/{id}/revise` — revise with feedback (SSE)
  - `POST /api/madlab/sessions/{id}/publish` — local preview
  - `POST /api/madlab/sessions/{id}/deploy` — git push to production
- [x] Create `backend/services/madlab_service.py`
- [x] Register router in `main.py`

### Step 3.3 — Define MadLab workflow steps
- [x] Step 1: Problem Space & User Pain (research + framing)
- [x] Step 2: Solution Architecture (system design + tech choices)
- [x] Step 3: User Flow & Interaction Design
- [x] Step 4: Build Narrative (how you built it, decisions, tradeoffs)
- [x] Step 5: Demo & Screenshots (visual walkthrough)
- [x] Step 6: Tech Stack & Lessons Learned
- [x] Step 7: Editorial Pass + HTML Generation

### Step 3.4 — Build MadLab frontend page
- [x] Create `frontend/src/app/dashboard/madlab/page.tsx`
- [x] Follow teardown page pattern (session list, create flow, step-by-step workflow)
- [x] Add to dashboard layout navigation

### Step 3.5 — Update git_handler for MadLab publishing
- [x] Add MadLab publish flow to `git_handler.py`:
  - Save to `madlab/[slug].html`
  - Update `madlab.html` hub page (add prototype card)
  - Update `sitemap.xml`
  - Update `fenix-index.json` with new prototype metadata
- [x] Test deploy flow

### Step 3.6 — Test end-to-end
- [x] Create a test prototype through the full workflow
- [x] Publish and verify it appears on the site
- [x] Verify GitHub Action reindexes the new content
- [x] Ask Fenix about the prototype and confirm it returns relevant answers

**Exit criteria:** MadLab prototypes can be published from Command Center with the same reliability as teardowns and blogs, and Fenix indexes them automatically.

---

## Phase 4: Build Fenix Dashboard in Command Center

**Goal:** Add a Fenix analytics and training module to Command Center.

### Step 4.1 — Build dashboard backend router
- [ ] Create `backend/routers/fenix_dashboard.py` with endpoints:
  - `GET /api/fenix/overview` — summary stats (total conversations, messages, avg per day)
  - `GET /api/fenix/queries` — top queries by frequency, with time range filter
  - `GET /api/fenix/failures` — queries with 0 citations or keyword fallback
  - `GET /api/fenix/coverage` — which content pages get cited most/least
  - `GET /api/fenix/conversations` — browse conversation transcripts
  - `GET /api/fenix/conversations/{id}` — full conversation detail
  - `GET /api/fenix/search-quality` — avg similarity scores, search type distribution
- [ ] Create `backend/services/fenix_dashboard_service.py`
- [ ] Register router in `main.py`

### Step 4.2 — Build dashboard frontend
- [ ] Create `frontend/src/app/dashboard/fenix/page.tsx`
- [ ] Sections:
  - **Overview cards:** Total conversations, messages today, avg messages per conversation, unique visitors
  - **Top Queries:** Table of most-asked questions, sortable by frequency and recency
  - **Failure Log:** Queries that got 0 RAG results, low similarity, or keyword fallback — with "Train Fenix" action button
  - **Content Coverage:** Heatmap or ranked list of which pages get cited, which are never cited
  - **Conversation Browser:** Searchable list of conversations, click to expand full transcript
  - **Search Quality:** Chart of semantic vs keyword vs no-match distribution over time
- [ ] Add to dashboard navigation

### Step 4.3 — Key metrics to track

**Volume:**
- Conversations per day/week
- Messages per conversation (depth)
- Unique session IDs (proxy for unique visitors)
- Peak hours

**Quality:**
- % of queries with 3 citations (good)
- % of queries with 0 citations (failure)
- Average top similarity score
- Semantic vs keyword vs no-match ratio

**Content:**
- Most cited pages (what content is most valuable)
- Never-cited pages (dead content or indexing gap)
- Content gaps (frequent queries with no matching content)

**Training:**
- Questions in training queue
- Training data entries created
- % of queries now answered by training data

---

## Phase 5: Train Fenix Module

**Goal:** Let Kiran teach Fenix things that aren't on the website — personal knowledge, opinions, preferences, working style.

### Step 5.1 — Build training backend
- [x] Create `backend/routers/fenix_training.py` with endpoints:
  - `POST /api/fenix/training/start` — begin a training session (Claude asks 100 questions)
  - `GET /api/fenix/training/sessions` — list training sessions
  - `GET /api/fenix/training/sessions/{id}` — get session state
  - `POST /api/fenix/training/sessions/{id}/answer` — submit answer to current question
  - `POST /api/fenix/training/sessions/{id}/skip` — skip a question
  - `GET /api/fenix/training/data` — list all training data entries
  - `PUT /api/fenix/training/data/{id}` — edit an entry
  - `DELETE /api/fenix/training/data/{id}` — remove an entry
- [x] Create `backend/services/fenix_training_service.py`
- [x] Extended with: question bank endpoints, manual input, production-ready voice conversion, draft generation
- **Files:** `backend/routers/fenix_training.py`, `backend/services/fenix_training_service.py`, `backend/data/question_bank.py`

### Step 5.2 — Design the training flow
- [x] Claude generates 100 questions across 10 categories (professional, technical, personal, working style, industry views, site-specific, career story, product craft, opinions, fun & personality)
- [x] Questions are generated in batches of 10 (one per category)
- [x] Kiran answers naturally (no formatting needed)
- [x] Claude does an editorial pass on each answer:
  - Clean up grammar and clarity
  - Preserve Kiran's voice and personality
  - Split compound answers into distinct Q&A pairs
  - Flag anything that needs Kiran's review
- [x] Kiran approves or edits the polished version
- [x] Approved answers are stored in `training_data` table
- [x] Added: Question Bank (319 research-backed questions, persona/dimension taxonomy), Manual Input mode, Draft Answer generation, Production Ready voice conversion
- [x] Already-answered question tracking prevents re-asking across sessions

### Step 5.3 — Build training frontend
- [x] Create `frontend/src/app/dashboard/fenix/training/page.tsx`
- [x] UI: Five views — Home, Interview, Data Browser, Question Bank, Manual Input
  - Interview: Claude asks → Kiran answers → editorial pass → approve/edit/skip
  - Question Bank: Browse 319 questions by persona/dimension, generate best-answer examples + customized drafts
  - Manual Input: Free-form Q&A entry
  - Data Browser: Search, filter, edit all training data
  - Production Ready button: one-click voice conversion + content rules check
- [x] Category filter and search
- [x] Progress tracking and persona/dimension color coding

### Step 5.4 — Embed training data for RAG
- [x] Generate embeddings for each training Q&A pair (Voyage AI `voyage-3-lite`, 512 dims)
- [x] Embeddings stored directly on `training_data.embedding` column (migration 004)
- [x] `match_training_embeddings` SQL function for semantic vector search
- [x] `match_training_data` SQL function for pg_trgm text fallback
- [x] Update `rag_service.py` to search training data alongside content — dual strategy: semantic + text fallback, merged and deduplicated
- [x] Training matches injected as "Personal Knowledge" section in LLM context, prioritized for personal/opinion questions
- [x] RAGContext extended with `search_type`, `similarity_scores`, `training_matches` fields
- [x] Backfill script: `fenix-backend/scripts/embed_training_data.py`
- **Migration:** `fenix-backend/migrations/004_training_embeddings.sql` — run in Supabase SQL Editor

### Step 5.5 — Test training integration
- [ ] Run migration 004 in Supabase SQL Editor
- [ ] Run backfill script to embed any existing training data
- [ ] Deploy updated `rag_service.py` to Vercel (push to fenix-backend repo)
- [ ] Complete at least 20 training questions via Command Center
- [ ] Ask Fenix questions that should be answered by training data
- [ ] Verify training data appears in context (check logs for "Training data search found X matches")
- [ ] Verify training doesn't override factual content from the site

**Exit criteria:** Kiran can teach Fenix personal knowledge through a structured Q&A flow, and Fenix uses that knowledge when answering visitor questions.

---

## Phase Summary

| Phase | What | Depends On | Effort |
|-------|------|-----------|--------|
| 1 | Validate existing pipeline | Nothing | 1-2 sessions |
| 2 | Conversation logging | Phase 1 | 1 session |
| 3 | MadLab module | Phase 1 | 2-3 sessions |
| 4 | Fenix dashboard | Phase 2 | 2-3 sessions |
| 5 | Train Fenix | Phases 2 + 4 | 2-3 sessions |

---

## How to Use This Document

When starting a new chat session, share this file and say:

> "Continue from FENIX-ROADMAP.md. I'm on Phase X, Step X.X."

The assistant will read this file, understand the full context, and pick up where you left off. Check off completed items as you go.

---

## Key Files Reference

| File | Location | Purpose |
|------|----------|---------|
| This roadmap | `/FENIX-ROADMAP.md` | Master plan |
| Fenix widget | `/fenix-widget.js` | Chat UI on all pages |
| Fenix widget CSS | `/fenix-widget.css` | Tooltip + overlay styles |
| Fenix backend | `github.com/iamkiranrao/fenix-backend` | Vercel-deployed API |
| RAG service | `fenix-backend/services/rag_service.py` | Embedding + search |
| Content extractor | `fenix-backend/scripts/content_extractor.py` | HTML → text |
| Chunk & embed | `fenix-backend/scripts/chunk_and_embed.py` | Text → vectors → Supabase |
| Reindex workflow | `.github/workflows/fenix-reindex.yml` | Auto-reindex on push |
| Content index | `/fenix-index.json` | Content taxonomy + metadata |
| Command Center BE | `/command-center/backend/` | FastAPI (local) |
| Command Center FE | `/command-center/frontend/` | Next.js (local) |
| Training service | `command-center/backend/services/fenix_training_service.py` | Training Q&A + question bank |
| Training router | `command-center/backend/routers/fenix_training.py` | Training API endpoints |
| Training frontend | `command-center/frontend/src/app/dashboard/fenix/training/page.tsx` | Training UI (5 views) |
| Question bank | `command-center/backend/data/question_bank.py` | 319 research-backed questions |
| Embed backfill | `fenix-backend/scripts/embed_training_data.py` | Backfill training embeddings |
| Migration 004 | `fenix-backend/migrations/004_training_embeddings.sql` | Training vector search |
| Supabase project | `gndzmmywtxvlukoavadj` | PostgreSQL + pgvector |
