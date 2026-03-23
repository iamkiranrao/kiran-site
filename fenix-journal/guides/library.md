---
module: library
title: Knowledge Library
created: 2026-03-20
last_updated: 2026-03-20
version: 1
---

# Knowledge Library

## Overview

The Knowledge Library is a searchable, indexed catalog of all project documentation across Kiran's entire codebase. It auto-discovers non-journal markdown files and makes them discoverable through full-text search, with rich metadata including document type, category, word count, and last-modified date.

The library serves as the "find anything" discovery layer for the site — it scans the repo root recursively, extracts summaries from the first 200-300 characters of each document, categorizes files by their directory path, and surfaces them through a unified search interface. Unlike the Product Guides (curated, deep-dive views of specific modules) and Tool Guides (references for external infrastructure), the Library is comprehensive and programmatic.

When a visitor or Kiran opens the Library, they can:
- Search across all documentation with full-text matching on titles, summaries, and file paths
- Filter by category (Architecture, Career, Content, Fenix, Strategy, Products, etc.)
- Click to read the full markdown content in-browser
- See word count, creation date, and last modification timestamps
- Understand relationships between documents via inline links and cross-references

---

## Architecture

### Backend Stack

**FastAPI Router** (`routers/library.py`)
- `GET /api/library/index` — Returns paginated list of all indexed documents with metadata
- `GET /api/library/search?q=<query>` — Full-text search across titles, summaries, and file paths
- `GET /api/library/{doc_id}` or `GET /api/library/docs/{slug}` — Retrieves full markdown content for in-browser rendering
- `GET /api/library/categories` — Lists all available categories for filtering

**Library Service** (`services/library_service.py` or inline in router)
- Scans the project repo root (`/Users/kiran/Kiran's Website/`) recursively at startup
- Discovers all `.md` files excluding:
  - Fenix Journal entries (anything in `fenix-journal/diary/`, the dated journal session files)
  - Product guides and tool guides (indexed separately)
  - `node_modules/` and other build artifacts
  - `.git/` and other hidden directories
- Extracts and caches:
  - File path and slug
  - First line as title (or frontmatter `title` field)
  - First 200-300 characters as summary
  - Word count (tokenized)
  - File size and last modified timestamp
  - Category (inferred from directory path)

**Category Inference Engine**
- Maps directory paths to categories:
  - `docs/Foundation/` → Architecture
  - `docs/Career/` → Career
  - `docs/Content/` → Content
  - `docs/Fenix/` → Fenix
  - `docs/Strategy/` → Strategy
  - `docs/Scannibal/` → Products
  - `docs/Products/` → Products
  - `prototypes/` → Products
  - Root-level files → General
- Categories are flexible and can be overridden via frontmatter `category` field

### Frontend Stack

**Command Center Dashboard** (`frontend/src/app/dashboard/library/page.tsx`)
- Full-width search bar at top with icon and placeholder "Search all docs..."
- Real-time search as user types (debounced 300ms to reduce API calls)
- Category filter chips (Architecture, Career, Content, Fenix, Strategy, Products, General)
- Results displayed as document cards with:
  - Title, summary (truncated with ellipsis), file path breadcrumb
  - Category badge, word count, last modified date
  - "Read" button that opens content in modal or side panel
- Infinite scroll or pagination (load more at bottom)
- Empty state when no results

**Content Reader Modal/Panel**
- Full markdown rendering (headers, paragraphs, code blocks, links, lists, blockquotes)
- Copy button (copy to clipboard)
- Raw markdown download option
- Breadcrumb navigation back to library

### Database/Cache

The library does NOT use a database. It's cache-first:
- On server startup, scan the repo and build in-memory index
- Index is cached in FastAPI application state
- Rescan triggered manually via `/api/library/reindex` endpoint (admin only, called after major documentation additions)
- If durability is needed, index can be serialized to JSON and stored in Supabase for faster cold-start

**Index Structure:**
```python
{
  "documents": [
    {
      "id": "uuid",
      "slug": "docs-architecture-rag-pipeline",
      "title": "RAG Pipeline",
      "summary": "The RAG service implements semantic search using pgvector...",
      "category": "Architecture",
      "file_path": "docs/Foundation/Architecture/rag-pipeline.md",
      "word_count": 1250,
      "created_at": "2026-03-10T14:22:00Z",
      "last_modified": "2026-03-15T09:45:00Z",
      "content": "# RAG Pipeline\n\n## Overview\n..."
    }
  ]
}
```

---

## Key Decisions

**March 20, 2026 — Comprehensive vs. Curated**
Decided to make Library comprehensive and automated (all markdown files) rather than hand-curated like Product Guides. The goal is discoverability for Kiran and visitors who want to dive deep into any documentation. Product Guides remain curated for narrative coherence and depth; the Library is the index.

**Auto-Scan at Startup, Manual Reindex**
The library scans the repo once on server startup and caches the index in memory for speed. It's not real-time because file system watching would add complexity. Instead, `/api/library/reindex` is available as an admin endpoint for manual refresh after documentation changes. This balances performance with freshness.

**Category Inference from Path**
Rather than requiring frontmatter category on every document, categories are inferred from directory structure (e.g., `docs/Architecture/` → Architecture category). This reduces metadata burden and keeps documents focused on content, not metadata. Frontmatter can override if needed.

**Full-Text Search Over Tags**
Chose full-text search (titles, summaries, file paths) over a tagging system. Tags would require maintenance on every document; full-text is self-maintaining and more intuitive for users.

**Exclude Journal Entries**
Fenix Journal diary entries (the daily session transcripts in `fenix-journal/diary/`) are excluded from the Library because they're personal working notes, not polished documentation. Flame On mode in Fenix accesses them directly via the embed_flame_on_data pipeline, which is separate.

---

## Evolution

**Session: 2026-03-20 (System Wiring, Task 3)**
Initial implementation context. The Library was designed as part of the Command Center knowledge infrastructure to expose all project documentation through a single unified search interface. Built alongside Tool Guides and Product Guides as the three knowledge discovery layers.

---

## Current State

**What works:**
- Backend library router with index, search, and document endpoints
- In-memory index built at server startup from recursive markdown scan
- Full-text search across titles, summaries, and file paths
- Category inference from directory paths
- Frontend dashboard page with search bar, result cards, and category filters
- Content reader modal with markdown rendering
- Admin reindex endpoint for manual refresh

**What's partial/incomplete:**
- Analytics on library searches (top queries, most-viewed documents)
- Tagging system for cross-document relationships (related docs)
- Breadcrumb navigation from a document back to its category
- SEO metadata per document (og:title, og:description for sharing)
- Dark mode styling for code blocks in reader

---

## Known Issues & Limitations

**Scanning Performance**
If the repo grows to thousands of markdown files, the startup scan could become slow. At present scale (50-100 docs), it's instant. Mitigation: implement incremental scanning or cache the index to Supabase for faster cold-start.

**Index Staleness**
The in-memory index doesn't update when files change. New documents won't appear until `/api/library/reindex` is called. For Kiran's workflow (batch documentation updates), this is acceptable; for real-time collaboration, could implement file watcher.

**Summary Extraction**
The 200-300 char summary is naive (just the first N chars of the first paragraph). For documents starting with lengthy introductions or disclaimers, the summary might be uninformative. Could be improved with intelligent excerpt generation (e.g., first sentence with context).

**Search Query Ambiguity**
Full-text search can return many results for broad queries like "design" or "strategy". No relevance ranking or weighting is implemented. Could improve with TF-IDF scoring or semantic search (vector embeddings).

**Category Ambiguity**
Some documents might legitimately fit multiple categories (e.g., a product strategy doc is both Strategy and Products). Single-category assignment requires choosing one or using frontmatter override.

---

## Ideas & Future Direction

**Semantic Search**
Embed library documents using Voyage AI (same pipeline as Fenix RAG) and offer semantic search ("find docs about AI") in addition to keyword search. Could integrate with Fenix to auto-populate the Library as a fallback knowledge source.

**Document Relationships**
Parse markdown links within documents and build a graph of relationships. In the reader, show "Related documents" based on link graph. Help users discover connections across the codebase.

**Full-Text Indexing**
Implement true full-text search (not just regex) using Postgres `tsvector` or SQLite FTS if documents are ever moved to a database. Current implementation is JavaScript string matching, which doesn't handle stemming or fuzzy search.

**Analytics Dashboard**
Track which documents are searched for, most viewed, and abandoned. Surface gaps (docs that should exist but don't, inferred from search queries returning zero results).

**Auto-Generated Table of Contents**
Parse the library index and generate a "Contents" page grouping documents by category, sortable by date or word count.

**Export Capabilities**
Allow Kiran to export a subset of the library (by category or search) as a single markdown file or PDF for sharing with others.

**Collaborative Annotations**
Add a notes/comments feature where Kiran can highlight passages and leave private notes within documents (stored in Supabase, not in the markdown files).

---

## Relationship to Other Components

**Product Guides** are curated, narrative-driven deep-dives into specific modules (Fenix, Scannibal, etc.). The Library is the comprehensive index of all documentation — Product Guides are subset of Library, displayed separately for narrative coherence.

**Tool Guides** are reference docs for external infrastructure (GA4, Supabase, GitHub). They're also discoverable through the Library, but have their own dedicated dashboard for contextual help and maintenance checklists.

**Fenix Assistant** uses the Library (published content) as one source in its RAG pipeline. When a visitor asks Fenix a question, Fenix searches the Library index for relevant context before responding.

**Flame On mode** (in Fenix) searches a different knowledge source: working-process data (journal entries, session transcripts, guides). The Library excludes those, so there's clean separation between polished documentation and personal process notes.

---

## Source Sessions

- **2026-03-20** — System Wiring Phase, Task 3: Comprehensive documentation discovery layer built as part of Command Center infrastructure upgrade
