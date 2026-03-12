---
module: teardown-builder
title: Teardown Builder (Command Center Module)
created: 2026-03-11
last_updated: 2026-03-12
version: 1
---

# Teardown Builder

## Overview

The Teardown Builder is a Command Center module that enables Kiran to publish detailed product analysis pages directly to the website through a seven-step co-creation workflow with Claude. Users create a teardown session (name, slug, category), run through guided steps to build out content collaboratively, then publish the resulting HTML page to the site and update search indexes. The module combines real-time AI collaboration (SSE streaming), state management, and git-based publishing to create a repeatable, auditable workflow for long-form product writing.

## Architecture

**Technology Stack:**
- **Backend**: Python 3.9.6, FastAPI, SQLite-based session state storage
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS 4, lucide-react icons
- **AI Engine**: Claude (Anthropic API), streaming via SSE for real-time response delivery
- **Git Pipeline**: GitPython for committing and pushing changes to GitHub
- **Database**: Supabase PostgreSQL for content indexing (fenix-index.json)
- **Hosting**: Command Center backend runs locally on port 8000, frontend on port 3000

**File Structure:**
```
command-center/
├── backend/
│   ├── services/teardown_service.py    (~650 lines, 7-step workflow engine)
│   ├── routers/teardown.py             (~480 lines, 13 API endpoints)
│   ├── templates/teardown-template.html (~600 lines, canonical HTML template)
│   └── services/git_handler.py          (modified, added publish_teardown + fenix-index updates)
│
├── frontend/
│   ├── src/app/dashboard/teardowns/page.tsx (~1,200 lines, full UI workflow)
│   ├── src/lib/constants.ts             (modified, added Teardowns module)
│   └── src/components/Sidebar.tsx       (modified, added icon mappings)
```

**State Management:**
Session state is stored as JSON in `/tmp/command-center/teardowns/{session_id}/state.json` with the following structure:
```json
{
  "session_id": "abc123",
  "project_name": "Spotify Discover Weekly",
  "project_slug": "spotify-discover-weekly",
  "category": "Music Streaming",
  "current_step": 1,
  "steps": {
    "1_problem_space": { "result": "...", "approved": false, "revisions": 0 },
    "2_solution_architecture": { "result": "...", "approved": false, "revisions": 0 },
    ...
    "7_editorial_and_html": { "result": "...", "approved": false, "revisions": 0 }
  },
  "created_at": "2026-02-18T08:10:49Z",
  "updated_at": "2026-02-18T08:10:49Z"
}
```

**7-Step Workflow:**
1. **Problem Space** — What problem does the product solve? Target user? Use cases? (~500 tokens)
2. **Solution Architecture** — How is the product built? Key features? Technical decisions? (~500 tokens)
3. **User Journey & Flow** — How do users interact with it? Key flows? (~500 tokens)
4. **Build Narrative** — What would you build differently? Lessons learned? (~500 tokens)
5. **Demo & Screenshots** — Visual walkthrough. CTAs and key moments. (~500 tokens)
6. **Tech Stack & Lessons** — Technologies used. Key takeaways. What Kiran would steal. (~500 tokens)
7. **Editorial + HTML Generation** — AI-detection audit. Generate JSON fragments for HTML template injection. (~4,096 tokens for output)

Each step runs Claude through the TEARDOWN_SYSTEM_PROMPT, generates a response, and stores it. Users can approve each step or request revisions (loops back to re-run the step with revision notes).

## Key Decisions

**Feb 18, 2026 — Teardown builder architecture**
- Decided on 7-step guided workflow to ensure structured, in-depth analysis
- Each step has a specific focus and token budget (~500 tokens per step, 4,096 for Step 7)
- Session-based state management using JSON files in `/tmp/` for simplicity and auditability
- SSE streaming for real-time response delivery in the frontend (no waiting for full response)
- Step approval/revision loop ensures human review before proceeding

**Feb 25, 2026 — Template-based HTML generation**
- Created canonical teardown-template.html with 22 `{{PLACEHOLDER}}` markers for content injection
- Step 7 generates JSON fragments matching the placeholders
- Python replaces placeholders with JSON content to assemble final HTML
- Template includes full CSS (responsive, dark/light mode, SEO meta tags)
- Approach mirrors teardown-builder pattern for consistency

**Feb 25, 2026 — Git publishing pipeline**
- Decided to integrate git publishing into the workflow (not manual)
- Step: Publish → validates HTML → calls `git_handler.publish_teardown()`
- Automatically updates related files: teardowns hub page (teardowns.html), sitemap.xml, fenix-index.json
- One-command deploy: user just clicks "Deploy" button, rest is automated

**Mar 5, 2026 — Anti-AI guardrails in system prompt**
- Added explicit rules to prevent AI hallucination and generic advice
- Rules: avoid "as an AI," "I can't," "I don't have personal experience", always use first-person for Kiran's perspective
- Banned phrases: "In this digital age," "In today's world," "It's important to," etc.
- Step 7 includes AI-detection audit to catch and flag any violations before publishing

## Evolution

**Feb 18, 2026 — Initial teardown builder design**
- Designed 7-step workflow based on Kiran's product analysis style
- Created session-based state management approach
- Defined template-injection architecture for final HTML generation

**Feb 25, 2026 — First implementation and testing**
- Built teardown_service.py with all 7 steps and Claude integration
- Implemented SSE streaming on frontend for real-time response display
- Created teardown-template.html canonical template with 22 placeholders
- Tested Step 7 JSON fragment generation and template injection
- Integrated git publishing: publish_teardown() + fenix-index updates

**Feb 25-28, 2026 — Content creation**
- Used teardown builder to create first teardown (Spotify case study)
- Worked through all 7 steps, approved and revised as needed
- Published to site, verified in Command Center dashboard

**Mar 5, 2026 — Phase 3 planning**
- Analyzed teardown_service.py patterns for replication in MadLab (similar 7-step workflow)
- Documented architecture for consistency across future modules

**Mar 6 (current), 2026 — Continued iterative refinement**
- Fixed icon mappings in Sidebar component
- Verified all lucide-react icon names are correct
- MadLab module created using identical architectural patterns (mirrors teardown exactly)

## Current State

**What works:**
- Full 7-step workflow with SSE streaming responses
- Session creation with auto-generated slugs (editable)
- Step execution with Claude streaming responses
- Step approval and revision loop (unlimited revisions)
- Preview mode showing generated HTML before publishing
- One-click publish to GitHub (commits and pushes)
- Automatic sitemap.xml and fenix-index.json updates
- Admin dashboard listing all teardown sessions with status
- Step navigation (jump to any step, continue from last)
- Session deletion for cleanup

**Known limitations:**
- Step 7 is token-intensive (~4,096 max_tokens) due to 6 prior steps as context + large JSON output requirement
- No draft autosave (state only persists when explicitly approved)
- Frontend UX requires full page reload to reflect git publish completion
- HTML preview is in an iframe (may have sandbox/CORS issues on some deployments)

**Recently tested:**
- Frontend icon rendering (Beaker icon added to Sidebar's iconMap)
- Backend router registration (teardown.py properly imported and included in main.py)
- SSE streaming from Claude (working for all 7 steps)
- Git publishing pipeline (commits and pushes correctly)

## Known Issues & Limitations

1. **Step 7 token budget** — With all 6 prior steps as context, the token count is high. If users request large revisions in Step 7, output may be truncated or incomplete. Mitigation: increased max_tokens to 4,096, but Step 7 is still the most resource-intensive step.

2. **No autosave** — If a user's browser crashes during step execution, in-progress work is lost. Session state only persists when a step is explicitly approved.

3. **Revision loop unbounded** — Users can revise indefinitely, which could lead to token waste on minor tweaks. Consider adding a revision limit or cost tracking in future.

4. **Template placeholders are rigid** — Adding new sections to teardowns requires modifying the canonical template and updating Step 7's JSON generation logic. Not flexible for custom layouts.

5. **Git authentication** — Publishing requires GITHUB_PAT environment variable set. If token expires or lacks permissions, publish fails silently with error logging only.

6. **HTML preview limitations** — iframe sandbox may block certain CSS/JS features. Users should always preview the published page on the actual site after deploying.

## Ideas & Future Direction

**Short-term:**
- Add autosave for in-progress steps (save to Supabase instead of just local JSON)
- Implement revision limit (e.g., max 3 revisions per step before user has to reword request)
- Build "Quick Publish" mode (skip approval loop for minor tweaks)
- Add teardown analytics (view count, search queries that land on it, engagement time)

**Medium-term:**
- Create library of pre-written teardown templates (e.g., "SaaS Product", "Marketplace", "Creator Economy")
- Build batch teardown mode (queue multiple teardowns, run 7 steps across all in parallel)
- Implement A/B testing for different Step 7 prompts (different tones/styles)
- Add teardown comparison view (side-by-side two teardowns for learning)

**Long-term:**
- Teardown versioning (publish v1, v2, etc. as product evolves)
- Community teardowns (allow collaborators to contribute teardowns)
- Teardown API (expose generated teardowns as JSON for external tools)
- Search and recommendation engine (Fenix suggesting related teardowns based on user questions)

**Deferred:**
- Automatic screenshot/GIF generation from product links (complex, would require Playwright or Puppeteer)
- Teardown collaboration/comments (would require Supabase auth and real-time updates)

---

## Source Sessions

Key sessions informing this guide:
- 2026-02-18-081049-im-continuing-work-on-my-personal-portfolio-site.md — Teardown strategy, 7-step workflow design, first exploration
- 2026-02-25-030851-i-want-to-try-and-finish-populating-content.md — MadLab builder design (mirrors teardown pattern), first content creation
- 2026-03-05-201142-continue-from-fenix-roadmapmd-phase-1-is-complete-im.md — Phase 3 MadLab implementation, analysis of teardown patterns for replication
