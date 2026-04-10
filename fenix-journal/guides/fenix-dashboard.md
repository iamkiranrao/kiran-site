---
module: fenix-dashboard
title: Fenix Analytics Dashboard
created: 2026-03-11
last_updated: 2026-03-12
version: 3
---

# Fenix Analytics Dashboard

## Overview

The Fenix Analytics Dashboard is a view within Command Center that provides visibility into how visitors interact with the Fenix AI assistant on kiranrao.ai. It surfaces conversation metrics, RAG retrieval quality, persona distribution, search effectiveness, and content coverage — giving Kiran the data to iteratively improve Fenix's responses.

This is an admin-only tool (runs locally as part of Command Center, not publicly deployed). For the Fenix AI assistant itself, see the `fenix.md` guide. For Command Center, see `command-center.md`.

## Architecture

The dashboard is a single Next.js page (`/dashboard/fenix`) with a tabbed interface, powered by a dedicated FastAPI router (`fenix_dashboard.py`) that queries Supabase tables.

**Backend:** `command-center/backend/routers/fenix_dashboard.py` — 6 API endpoints querying `conversations`, `messages`, and `content_embeddings` tables via Supabase PostgREST.

**Frontend:** `command-center/frontend/src/app/dashboard/fenix/page.tsx` — tabbed React component with recharts visualizations.

**Data Source:** All data comes from Fenix's conversation logging (added in Phase 2, Mar 5). Every chat turn is stored with: `rag_chunks_used`, `similarity_scores`, `search_type`, `page_url`, `user_agent`, and `persona`.

## Dashboard Tabs

**Overview** — Total conversations, messages, average conversation depth, unique visitors. Trends over time.

**Top Queries** — Most frequently asked questions, grouped by similarity. Shows average chunk count and search type per query pattern.

**Failures** — Conversations where RAG returned 0 results, fell back to keyword search, or had low similarity scores (<0.5). Helps identify knowledge gaps.

**Coverage** — Which content pages get cited most frequently. Reveals whether RAG is surfacing the right portfolio content. Identifies pages with zero citations (potential content gap).

**Conversations** — Browsable list of recent conversations with persona, message count, page URL, and timestamp. Click-through to see full conversation history with RAG metadata per turn.

**Search Quality** — Distribution of search types (semantic vs. keyword vs. none). Similarity score trends. Good (≥0.7) / OK (0.5–0.7) / Poor (<0.5) breakdown.

## Key Decisions

**2026-03-05 — Built as Command Center view, not standalone**
Decision: embed analytics in Command Center rather than building a separate Fenix admin panel. Rationale: Command Center already has the sidebar, auth-free localhost setup, and shared backend. Adding a tab is simpler than a new deployment.

**2026-03-05 — Log everything, filter later**
Decision: store full RAG metadata (chunk IDs, similarity scores, search type) on every message, not just aggregated stats. Rationale: enables retroactive analysis, allows debugging individual conversations, supports future ML-based quality scoring.

## Current State

The dashboard is functional with all 6 tabs populated from live Supabase data. It provides actionable metrics for tuning Fenix: identifying low-coverage content, frequent query patterns, and RAG failure modes.

The training queue (questions Fenix couldn't answer well) surfaces in the Failures tab, giving Kiran a clear list of Q&A pairs to add to `training_data`.

## Known Issues & Limitations

1. No date range filtering — shows all-time data only. Needs date pickers for week/month/custom ranges.
2. Conversation detail view doesn't show the actual RAG chunks retrieved — only chunk count and scores.
3. No export functionality — can't download conversation logs or query patterns as CSV.
4. Search quality metrics are basic — no statistical confidence intervals on similarity distributions.
5. No real-time updates — dashboard requires page refresh to see new conversations.

## Ideas & Future Direction

- Add user satisfaction signal (thumbs up/down on Fenix responses, surfaced in dashboard)
- A/B test tracking for different system prompts or persona definitions
- Automated alerts when failure rate exceeds threshold
- Flame On analytics tab — separate metrics for Flame On mode conversations
- Conversation quality scoring model (train on user feedback data)
- Weekly email digest of dashboard highlights

---

## Source Sessions

- `2026-03-05-201142-continue-from-fenix-roadmapmd-phase-1-is-complete-im.md` — Phase 2 conversation logging, SQL migrations, dashboard planning
- `2026-03-06-002419-ontinue-from-fenix-roadmapmd-phases-1-2-and-3.md` — Dashboard implementation
