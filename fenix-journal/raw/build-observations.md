# Raw Observations — Build Journey
<!-- Append new observations at the bottom with timestamps. These feed the diary entries. -->

## 2026-03-02 — Foundation: teardown tool and Fenix conception
- The teardown co-creation tool was the original project — a way to automate Kiran's 8-step product teardown process. The architecture decision (Next.js + Claude API) was driven by practical constraints: already on Netlify, needs structured outputs, needs source tracking.
- Key design insight: "The tool handles the 80% that's grunt work so you can spend your time on the 20% that's actual product thinking." This philosophy shaped everything that followed.
- The automation game plan became the seed for Command Center — a local dashboard that grew to encompass teardowns, blog publishing (WordWeaver), and eventually Fenix management.

## 2026-03-02 — Fenix spec: designing an AI assistant as a product
- Fenix started from a product spec, not a technical spec. The FENIX-SPEC.md reads like a product requirements document for a real SaaS product — north star, user journey, outcomes, touchpoints, design decisions, MVP scope.
- Architecture: vanilla JS widget (zero dependencies) → FastAPI backend on Vercel → Voyage AI embeddings → Supabase pgvector → Claude API streaming.
- Key design decisions that shaped everything: inferred personas (not asked), floating overlay (not side panel), contextual CTAs (not generic), earned nudges (not timed).
- The content pipeline: 19 pages → content extraction → 153 chunks (500-token target, 50-token overlap) → Voyage AI embeddings → Supabase pgvector.

## 2026-03-03 — The RAG pipeline crisis
- First real crisis: Fenix was crashing on every query. Root cause: PostgREST vector casting bug — `str(query_embedding)` was sending the embedding as a string literal instead of a proper pgvector format.
- Then discovered the deeper problem: only a subset of content was being returned. Three compounding issues: incomplete fenix-index.json (6 entries when 14+ pages existed), no Supabase observability, and the "Langchart" non-existent content query.
- The retrospective document was written to capture the diagnosis. Options ranged from "fix the index" to "start over with simpler architecture." Chose the pragmatic path: add observability first, then fix the index.
- Lesson: in RAG systems, the embedding pipeline is only as good as the content it ingests. Garbage metadata → garbage retrieval → garbage responses.

## 2026-03-03 — Keyword extraction and similarity tuning
- Added keyword extraction as a fallback when semantic search fails. Adjusted similarity threshold from 0.2 to find the right balance between recall and precision.
- Multiple debugging sessions: bad indentation from browser editor, f-string format spec bug that crashed all queries, Voyage AI 429 rate limiting requiring batch size reduction.
- Each fix was a new commit, a new deploy, a new test. The iteration cycle was tight: identify → fix → push → deploy (Vercel auto-deploys) → test → repeat.

## 2026-03-04 — WordWeaver blog pipeline and site publishing
- Spent a full session getting the blog publishing pipeline working end-to-end. WordWeaver (the blog module in Command Center) generates HTML, which gets committed to the kiran-site repo, deployed via Netlify, and triggers Fenix reindexing.
- Git operations from the sandbox environment were complex: stale lock files, rebase conflicts, diverged branches. The ACH blog post (demystifying-ach.html) went through multiple rounds of conflict resolution before landing on production.
- The pipeline is: write in Command Center → generate HTML → git push → Netlify deploys site → GitHub Action triggers → content_extractor.py + chunk_and_embed.py → Supabase embeddings → Fenix knows about the new content.

## 2026-03-04 — The hallucination incident
- Fenix told a visitor that Kiran "worked at Zeta (card issuing platform)" and "built payment features at GEICO." Both fabricated.
- Root cause analysis: two compounding factors. (1) The system prompt had a soft anti-hallucination instruction: "Never make up facts about Kiran's work. If it's not in the knowledge base, say so." This was easily overridden by the LLM's tendency to confabulate when it has thin context. (2) The RAG context included teardown chunks about GEICO and blog content about ACH/fintech — the LLM connected these dots into a false career narrative.
- The fix was comprehensive: replaced the soft instruction with a CRITICAL anti-hallucination section containing 6 explicit rules. Added the teardown-vs-employment distinction directly into the prompt. Changed "Use this information" to "Use ONLY the information below." Fixed the empty-context fallback to prohibit career claims.
- This was a turning point: Fenix went from "mostly works" to "has production-grade guardrails." The hallucination could have been career-damaging if a hiring manager saw it.
- Broader lesson: in any AI system that represents a real person, the anti-hallucination guardrails need to be *louder* than the helpfulness instructions. The LLM's instinct to be helpful and comprehensive is exactly what causes it to fabricate when it has gaps.

## 2026-03-04 — Browser-based deployment challenges
- Couldn't push to fenix-backend from the sandbox (no GitHub credentials). Attempted browser-based push via GitHub's edit UI and the Contents API.
- GitHub API requires authentication tokens that aren't available from cross-origin browser requests. The CodeMirror 6 editor doesn't expose its view instance for programmatic content replacement.
- Ended up doing the push manually: Kiran copied the updated file content and committed via the GitHub web editor. Sometimes the simplest path is the right one.

## 2026-03-05 — The Fenix Journal system
- New infrastructure: `fenix-journal/` folder with two-layer architecture. Layer 1: raw observations (field notes appended during sessions + chat drops from regular Claude conversations). Layer 2: daily diary entries synthesized by a scheduled task at 9 PM nightly.
- Folder structure: `raw/` (kiran-observations.md, build-observations.md, chat-drops/), `entries/about-kiran/` and `entries/build-journey/` (dated .md files), `compiled/` (weekly narratives on Sundays).
- Scheduled task `fenix-daily-journal` created — runs at 9 PM daily, reads raw observations + chat drops + recent diary entries for continuity, writes two new entries in Fenix's voice, moves processed drops to `processed/` subfolder.
- Chat drops system solves the cross-session context problem: Kiran can paste any Claude conversation (Cowork or regular) into `raw/chat-drops/` and the nightly task extracts observations from it. No formatting required.
- Wrote 3 days of retrospective entries (March 2-4) for both streams, mining FENIX-SPEC, FENIX-ITERATION, fenix-rag-retrospective, and the current session transcript for material. These establish the narrative baseline and voice.
- Key architectural insight: the journal is a *memory layer* that persists across sessions. Each Cowork session reads the raw files and recent entries to maintain continuity. The diary entries themselves become context for future sessions — a self-reinforcing knowledge base.
- This is potentially Fenix's most important infrastructure: the journal gives Fenix a developing model of Kiran that goes beyond static content. It's the bridge between "chatbot that knows a website" and "AI that knows a person."

## 2026-03-05 — Fenix vision: three evolutionary leaps
- Articulated the long-term vision for Fenix in conversation with Kiran: (1) Fenix as externalized memory/professional identity, (2) Fenix as proactive agent (initiating based on visitor behavior, drafting follow-ups, preparing briefs), (3) Fenix as a platform ("Fenix for Creators/Consultants/Founders").
- The end-state scenario: visitor browses site → Fenix observes behavior and infers intent → adapts persona and conversation → offers contextual next step → pre-fills meeting context → briefs Kiran before the call. Both sides walk in prepared.
- This vision positions Fenix as a new category: not a generic AI assistant, but a deeply personal one that gets smarter about a specific person over time. The journal system is the foundation of this — without a developing model of Kiran, Fenix is just another RAG chatbot.
- Platform potential: the architecture (content pipeline → RAG → persona inference → guardrails → conversation logging → training loop → journal) is generalizable. Every professional could deploy their own Fenix.

## 2026-03-06 — System documentation, hero video direction, feedback system
- Created SYSTEM-CONTEXT.md — a 530+ line comprehensive architecture document covering the entire platform: repo structure, tech stack (Cloudflare Pages + Vercel + Supabase + Voyage AI), database schema (11 tables), all API endpoints for Command Center (30+ endpoints across 12 routers), frontend architecture (Next.js 16, React 19, Tailwind 4), and deployment architecture. This is designed to be pasted into any new AI session as onboarding context.
- HERO-VIDEO-BRIEF.md: Made a significant visual direction decision. The current hero section uses a 5:2 aspect ratio video placeholder ("Video coming soon"). The brief recommends expanding to full-viewport video background with text overlay. Researched backed by engagement data (2.6x longer engagement per Social Spike) and scroll behavior research (57% viewing time above the fold per NN/g).
- Privacy decision: evaluated three approaches for the hero video — abstract/atmospheric motion, Pixar-style 3D avatar, and silhouette/hands-only. Chose abstract motion (flowing warm gradients in the site's amber/brown/cream palette with subtle geometric elements). Reasoning: aligns with the site's clean editorial aesthetic, ages well, keeps focus on work not face, follows the approach of premium sites (Stripe, Linear).
- The Pixar avatar isn't dead — it's reserved for a secondary "My Story" video (60-second manifesto, click-to-play, below the fold). This is a characteristic Kiran move: find the right context for each idea rather than killing it entirely.
- VIDEO-PRODUCTION-RUNBOOK.md: Full production pipeline — Midjourney (scene generation + avatar) → Runway Gen-4 (animation) → HeyGen (lip sync + AI voice) → Artlist (music) → CapCut (final edit). Total cost ~$98 with all subscriptions cancelled after. Total time estimate: 3 hours.
- The manifesto script (60 seconds, 5 scenes) articulates the site's philosophy: anti-algorithmic, AI-as-collaborator, "not a resume but a workshop." Success metric: "Whether you reach out and say hi."
- Seamless loop technique documented: forward + reversed clip + cross-dissolve in CapCut to create 18-second seamless loop from 10 seconds of Runway output.
- FEEDBACK-DEPLOYMENT-GUIDE.md: Database schema for site_feedback (rating + comment) and testimonials (name + role + testimonial + approval workflow) tables in Supabase. Includes RLS policies and indexes. This adds a two-way interaction layer to the site.
- The hero video integration includes specific CSS: absolute-positioned video, gradient overlay for text readability, flex-end alignment for text positioning. The code is ready — just waiting for the actual video assets.
- The site's evolution arc: static HTML portfolio → AI-powered chatbot (Fenix) → content pipeline (RAG + embeddings) → analytics dashboard → journal/memory system → multimedia experience (video) → feedback/interaction layer. Each addition builds on the previous layer.
