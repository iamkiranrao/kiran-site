---
module: command-center
title: Command Center
created: 2026-03-12
last_updated: 2026-03-12
version: 1
---

# Command Center

## Overview

Command Center is the operational hub and admin dashboard for Kiran's entire portfolio ecosystem. It's a local-only application that bridges content creation, career management, analytics, and portfolio administration. Built with FastAPI (Python backend) and Next.js (TypeScript/React frontend), Command Center runs on `localhost:8000` (backend) and `localhost:3000` (frontend) during active development and is never deployed publicly.

The core value proposition: Command Center consolidates 13+ specialized tools into a single unified interface, allowing Kiran to manage his portfolio, track career progress, create content, audit site quality, and monitor AI assistant performance — all from one dashboard.

## Architecture

### Backend Stack

The FastAPI backend (`backend/main.py`) serves as a REST API that powers all Command Center functionality. It includes:

- **Framework**: FastAPI (async Python web framework)
- **Port**: 8000 (localhost only)
- **Environment**: Requires `ANTHROPIC_API_KEY` (required); `KIRAN_SITE_REPO`, `GITHUB_PAT`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (recommended for full functionality)
- **Middleware**: CORS support (configurable origins, defaults to `localhost:3000`)
- **Logging**: Structured logging with noise filtering for third-party libraries

### Frontend Stack

The Next.js frontend (`frontend/src/app/dashboard/`) provides the user interface:

- **Framework**: Next.js 13+ with TypeScript and React
- **Port**: 3000
- **Layout**: Sidebar navigation with main content area (260px left sidebar + responsive main)
- **Components**: Sidebar, ApiKeyModal, and page-specific modules
- **Styling**: CSS variables (`--bg-primary` theme support)

### API Routes & Routers

The backend exposes 15 specialized routers, each handling a distinct tool or feature:

| Router | Prefix | Purpose |
|--------|--------|---------|
| **teardown** | `/api/teardown` | 8-step teardown creation workflow (How I'd've Built It pages) |
| **wordweaver** | `/api/wordweaver` | Blog/social content creation (multi-step SSE streaming) |
| **resume** | `/api/resume` | Resume customizer (job-tailored resume generation) |
| **job_central** | `/api/jobs` | Job search hub (applications, interviews, checklists, networking) |
| **job_radar** | `/api/radar` | Job market monitoring and alerts |
| **content_audit** | `/api/audit` | Content rules compliance checker |
| **visual_audit** | `/api/visual-audit` | Visual design consistency checker |
| **madlab** | `/api/madlab` | Prototype/MadLab tool management |
| **fenix_dashboard** | `/api/fenix` | Analytics for Fenix AI assistant (conversations, queries, citations) |
| **fenix_training** | `/api/fenix` | Training data stats and management for Fenix |
| **fenix_journal** | `/api/journal` | Fenix Journal viewer and metadata |
| **session_archive** | `/api/journal/archive` | Session archive browser and search |
| **product_guides** | `/api/guides` | Product guides viewer (like this one) |
| **feedback** | `/api/feedback` | Feedback and testimonials admin |
| **ideas** | `/api/ideas` | Feature backlog and improvement ideas |

### Frontend Pages

The dashboard is organized by tool in `frontend/src/app/dashboard/`:

- **teardowns** — List and create teardowns
- **wordweaver** — Write blog posts and social content
- **resume** — Customize resume for jobs
- **job-central** — Job search tracking, applications, checklists
- **job-radar** — Job market insights
- **content-audit** — Content compliance diagnostics
- **fenix** — Fenix AI analytics dashboard (conversations, query analysis, coverage)
- **fenix-journal** — Fenix Journal viewer
- **madlab** — Prototype management
- **guides** — Product guides viewer (including this guide)
- **feedback** — Testimonials and feedback admin
- **ideas** — Future ideas and backlog
- **tools** — Tool directory/help
- **help** — Documentation and support

## Key Decisions

### Local-Only Architecture

Command Center is intentionally not deployed publicly. It serves as a private admin tool, accessible only on localhost. This decision allows:

- Direct file system access to the portfolio repo (git publish, Netlify deploy)
- Tight coupling with local development workflows
- No authentication overhead (assumes single-user desktop environment)
- Faster iteration without deployment hassle
- Storage flexibility (local JSON files, Supabase, git)

### Multi-Step Workflows with Streaming

Both Teardown Builder and WordWeaver implement interactive 8-step and 6-step workflows (respectively) that:

- Break complex creation tasks into manageable steps
- Use Claude to generate draft content (streaming via SSE/FastAPI StreamingResponse)
- Allow human review and approval before proceeding
- Support revision loops (provide feedback → regenerate)
- Automatically save to disk and deploy via git + Netlify

This pattern scales to other tools and reflects Kiran's preference for human-in-the-loop content creation.

### Fenix Analytics as a Dashboard View

The Fenix analytics dashboard is **not** a separate product — it's one view within Command Center. It monitors:

- Conversation volume and depth metrics
- Top user queries and common failure modes (zero-citation results)
- Content page citation frequency (which topics are most asked about)
- Search quality trends (similarity scores, search type distribution)
- Training data effectiveness

This integration ensures Fenix insights inform editorial decisions (what content gaps exist) and technical improvements (low-similarity queries).

### Dual Storage: File-Based + Database

Command Center uses two complementary storage approaches:

- **File-based**: Teardowns, blog posts, resumes stored as .md/.html files in the site repo (version controlled, deployed via git)
- **Database (Supabase)**: Fenix conversations, feedback, job applications, ideas stored in Supabase (analytics, search, real-time sync)

This hybrid approach gives Kiran version control for content assets while maintaining queryable analytics for operational data.

### Data Attributes for Fenix Ingestion

The explainer panel system (from Phase 1 session) embeds `data-*` attributes on HTML elements so structured content is both human-readable and machine-ingestible. Fenix eventually ingests these attributes as metadata to understand site relationships (teardown → prototype → skills).

## Evolution

### Phase 1: Foundation (Feb 27 – Mar 5)

Established the core architecture:

- Built Teardown Builder (8-step workflow, git + Netlify deployment)
- Created WordWeaver (blog/social content tool, multi-step SSE streaming)
- Set up Fenix backend conversation logging (Supabase tables: conversations, messages, training_data)
- Implemented Content Audit (CONTENT-RULES.md compliance checker)
- Added explainer icon system to teardowns and prototypes (structured metadata for Fenix)
- Created fenix-index.json (content graph for Fenix to reason about site topology)

**Key outcomes**: Both creation workflows validated. Fenix logging infrastructure tested (197/197 embeddings stored, 0 errors). Site ready for Phase 2 expansion.

### Phase 2: Analytics & Expansion (Mar 5 – Present)

Focus on visibility and operational tools:

- Fenix Dashboard (overview, queries, failures, coverage, conversation browser)
- Session Archive viewer (searchable history of Fenix Journal sessions)
- Job Central (application tracking, interview debriefs, daily checklists, networking)
- Job Radar (job market monitoring)
- Ideas backlog (feature tracking for Command Center itself)
- Product Guides viewer (documentation for tools, including this guide)

## Current State

### Operational Tools (Fully Functional)

- **Teardown Builder**: Create How I'd've Built It teardowns via 8-step workflow → preview locally → deploy to production
- **WordWeaver**: Create blog posts (6 steps) or social content (3 steps) → preview → publish
- **Resume Customizer**: Generate job-tailored resume from master resume + job description
- **Job Central**: Track job applications, interviews, daily checklists, networking contacts, weekly plans
- **Content Audit**: Scan site for CONTENT-RULES.md violations (diagnostics only, no UI for accept/dismiss yet)

### Analytics & Monitoring

- **Fenix Dashboard**: View Fenix performance metrics (conversation stats, top queries, failure modes, citation coverage)
- **Fenix Training**: Training data overview and stats
- **Session Archive**: Browse and search archived Fenix Journal sessions
- **Ideas Backlog**: Track Command Center feature ideas and improvements

### Viewers & Managers

- **Product Guides**: Documentation viewer (this file is displayed here)
- **Feedback & Testimonials**: Admin for collected feedback
- **MadLab**: Prototype and project management
- **Fenix Journal**: Read-only viewer for Fenix Journal entries

### Infrastructure

- Backend runs on port 8000 (FastAPI with uvicorn)
- Frontend runs on port 3000 (Next.js dev server)
- All routers mounted with consistent `/api/*` prefixes
- CORS configured for localhost:3000 by default
- Environment validation on startup (fails if ANTHROPIC_API_KEY missing)

## Known Issues & Limitations

### Content Audit UX

The Content Audit router runs successfully but the frontend has no UI to accept/dismiss violations. Currently diagnostic-only. Violations are logged but cannot be resolved through the dashboard.

**Impact**: Low priority. Manual review of violations is adequate for now.

### Visual Audit Incomplete

Visual Audit router exists but is minimally implemented. Not fully integrated into the dashboard workflow.

**Impact**: Defer to future phase when design consistency becomes critical.

### Job Radar Incomplete

Job Radar exists and can monitor job listings but lacks connection to actual job market APIs. Currently a placeholder for future integration.

**Impact**: Job Central is the primary job tool; Radar is secondary.

### No Authentication

Command Center assumes single-user, localhost-only access. No login system. If deployed remotely, security would be at risk.

**Impact**: Not an issue for intended use (local admin). Would need major refactoring for multi-user or remote deployment.

### Fenix Journal Nightly Task

The Fenix Journal nightly task (scheduled 9 PM) sometimes fails silently. No alerting system for task failures.

**Impact**: Low priority. Manual check of Fenix Journal viewer shows if data is stale.

## Ideas & Future Direction

### Short Term (Next Phase)

1. **Content Audit UI** — Add accept/dismiss buttons to resolve violations in-dashboard
2. **Fenix Q&A Training** — Add interface to review and approve training data from conversations
3. **Job Radar Integration** — Connect to real job boards (LinkedIn, Indeed) with automated filtering
4. **Weekly Report Generation** — Auto-generate Job Central weekly progress report as markdown

### Medium Term

1. **Multi-tool Workflows** — Create cascading workflows (e.g., "Write blog post" → "Repurpose as social posts" → "Extract training data" → "Update Fenix index")
2. **Analytics Export** — Add CSV/PDF export for Fenix dashboard metrics and Job Central reports
3. **Notification Alerts** — Email or Slack alerts for job market matches, Fenix failures, task completion
4. **Scheduled Publishing** — Schedule blog posts and social content for future publish dates

### Long Term (Post-MVP)

1. **Command Center Mobile App** — View job alerts and Fenix conversations on mobile
2. **Collaborative Features** — Multi-user support for feedback collection, testimonials review
3. **Advanced Fenix Tuning** — UI for fine-tuning Fenix RAG parameters, training data weighting, prompt engineering
4. **Portfolio Growth Insights** — Trend analysis (growth in followers, newsletter subscribers, speaking gigs)

### Architectural Improvements

1. **Database Migrations** — Formalize Supabase schema versioning
2. **API Testing** — Add comprehensive integration tests for all routers
3. **Error Handling** — Standardize error responses and add request logging
4. **Frontend Type Safety** — Convert frontend components to strict TypeScript
5. **Documentation** — Generate API docs from routers, add README to each tool

---

## Source Sessions

This guide was synthesized from the following session archives:

1. **2026-02-27-060124-1-explainer-icons-from-your-earlier-request.md** (727 messages, 72,687 words)
   - Initial Command Center conception and Phase 1 architecture
   - Teardown Builder and WordWeaver workflow design
   - Explainer icon system and Fenix foundation planning
   - Content graph (fenix-index.json) architecture

2. **2026-03-05-201142-continue-from-fenix-roadmapmd-phase-1-is-complete-im.md** (288 messages, 21,177 words)
   - Fenix backend conversation logging setup
   - Supabase schema and search metadata integration
   - Phase 2 analytics dashboard planning
   - Session archive and training data infrastructure

**Last verified**: 2026-03-12 — Backend and frontend code reviewed; all routers listed; API surface documented.
