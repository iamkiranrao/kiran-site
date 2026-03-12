---
module: wordweaver
title: WordWeaver
created: 2026-03-11
last_updated: 2026-03-11
version: 1
---

# WordWeaver

## Overview

WordWeaver is a reusable Cowork skill for structured blog content production. It combines an interactive workflow (for planning and refining blog posts) with web-based preview UI and persistent configuration files. The skill enables semi-automated blog writing by leveraging real-time web research, thematic consistency, and structured narrative planning—while keeping the human author in control at every step.

WordWeaver is designed to help Kiran produce blog content that maintains a consistent voice (professional but approachable, Oxford/Cambridge English), draws from a curated theme library, and hits a consistent target (approximately 1,750 words for a 7-minute read). Unlike template-based writing, each post gets a custom structure determined by its topic and angle.

## Architecture

WordWeaver is structured as a skill (shareable, reusable Claude workflow) with three layers:

**Configuration Files (JSON, stored in user's selected folder):**
- `wordweaver-profile.json` — Voice and tone settings (language proficiency, audience, reference authors like Simon Sinek, Adam Grant, Trevor Noah)
- `wordweaver-themes.json` — Curated theme library that grows over time; themes can have optional sub-categories

**Interactive Workflow (Step-by-step user guidance):**
1. User selects a theme from library (or adds a new one)
2. System performs live web research to gather current stats, studies, data points, and implications
3. Presents 3-5 topic options with different hypothesis/viewpoint angles
4. Asks refinement questions to sharpen the chosen angle
5. Determines optimal structure for that specific topic (Discovery, Deep Dive, Implications, or other formats)
6. Proposes number of sections, headers, compelling data points, and narrative arc
7. Generates `.md` and `.docx` versions to user's folder

**Web Preview UI:**
- Simple HTML interface for viewing formatted blog post output
- Allows rapid feedback on layout, readability, and tone before final export

**Theme Management Commands:**
- Add new themes to library
- Remove themes
- List all themes and sub-categories
- Update theme metadata

## Key Decisions

**Decision: Profile + Themes separation (Feb 17, 2026)**
- Separated voice/tone (constant across all posts) from themes (variable, curated over time)
- Rationale: Allows one voice profile to serve many different topics; themes can grow independently without touching voice settings
- Profile includes language specifics (Oxford/Cambridge English, native/advanced English readers) and influences (named authors for tone guidance)

**Decision: Live web research per theme (Feb 17, 2026)**
- Each blog workflow includes real-time web research for the selected theme
- Rationale: Ensures posts are grounded in current data, studies, and trends; prevents stale or generic takes
- Data gathered includes stats, studies, data points, use cases, and implications

**Decision: Topic angle as primary branching point (Feb 17, 2026)**
- Rather than providing topic options directly, system presents 3-5 topic options *with hypothesis/viewpoint angles*
- Rationale: Forces strategic thinking about the narrative angle before writing begins; prevents generic "beginner's guide" content
- Example: For theme "AI in Product Management," angles might be "AI as stakeholder management tool" vs. "AI as decision-making accelerator" vs. "AI as narrative risk"

**Decision: Custom structure per topic (Feb 17, 2026)**
- No one-size-fits-all template; structure is determined by topic and angle
- Rationale: Different topics benefit from different narrative arcs (data-heavy posts need different structure than argumentative posts)
- Proposal includes: number of sections, specific headers/subheaders, compelling data points to weave in, and narrative arc

**Decision: Dual output format (Markdown + Word doc) (Feb 17, 2026)**
- Always output both `.md` (for version control, blog publishing) and `.docx` (for sharing, editing, print)
- Rationale: Provides flexibility; `docx` allows easy sharing with editors or collaborators; `md` allows git-based workflows
- Both files are saved to user's selected folder

**Decision: Target length = 7-minute read (~1,750 words) (Feb 17, 2026)**
- Standardized target for all posts (unless otherwise specified per-theme)
- Rationale: Long enough to be substantive, short enough to finish in one sitting; consistent reading experience

## Evolution

**Session: Feb 17, 2026 (Initial Specification)**
Kiran initiated WordWeaver as a reusable skill with comprehensive requirements. The skill was specified to include:
- Config-driven voice profile (referencing authors like Simon Sinek, Adam Grant, Trevor Noah for tone)
- Curated theme library (user-maintained, not auto-generated)
- Interactive step-by-step workflow (not a single-turn generation)
- Live web research per theme (to gather current statistics and implications)
- Multiple topic angle options (forcing deliberate narrative choice)
- Custom structure per topic (not templated)
- Dual output (.md and .docx)
- Web preview UI for formatted output

The specification was informed by Kiran's desire to maintain creative control while leveraging AI for research, structure planning, and draft generation.

**Session: Feb 19, 2026 (Status Check)**
Brief session where Kiran accessed WordWeaver to test the "write a blog" workflow. No significant changes recorded, but confirms the skill was operational for testing.

**Session: Feb 26, 2026 (Professional Networking Context)**
While ostensibly about LinkedIn product redesign, Kiran ideated a professional networking trading card concept and discussed how platforms should surface meaningful professional reputation. This research context later informed blog topic ideation (professional reputation, networking authenticity, platform design philosophy).

## Current State

**What works:**
- Skill specification is complete and well-defined
- Configuration file structure is clear (profile.json + themes.json)
- Workflow steps are documented and sequenced
- Integration with live web research is specified
- Output formats (both markdown and Word) are defined
- Theme management commands are conceptually complete

**What's in progress:**
- Full implementation as a reusable Cowork skill
- Web preview UI (specified but not yet built)
- Population of initial theme library (skeleton defined, themes not yet added)
- Testing the workflow on real blog topics
- Refinement of research query generation (ensuring web research is well-targeted)

**What's stubbed out:**
- Voice profile default values (template exists, actual author voice samples not yet captured)
- Theme library (no actual themes yet—user will populate post-setup)
- Web research integration (conceptually specified, implementation details pending)
- Topic angle generation (algorithm not yet tuned; may need refinement based on user feedback)

## Known Issues & Limitations

- **Cold-start problem:** First use requires setting up profile and seeding themes; unclear if users will invest this upfront effort
- **Web research fidelity:** Live research may return irrelevant or low-quality sources; filtering/ranking strategy needs refinement
- **Angle generation:** Creating truly distinct and insightful topic angles is harder than it sounds; current approach may generate redundant or shallow options
- **Structure determination:** Algorithm for "optimal structure per topic" is underspecified; may need manual input or heuristics
- **Preview UI not built:** Web preview is specified but not yet implemented; users may not visualize final output clearly
- **No collaborative editing:** `.docx` output can be edited, but there's no built-in collaboration or feedback loop within the skill

## Ideas & Future Direction

**Short term:**
- Implement web preview UI so users can see formatted output before exporting
- Seed initial theme library with 5-10 default themes (professional growth, AI/ML, product thinking, fintech, etc.)
- Test workflow on 2-3 real blog topics; refine angle generation based on results
- Add optional "editor notes" field so users can add context or constraints before topic selection

**Medium term:**
- Build theme analytics (track which themes produce highest-quality posts, most shares, etc.)
- Add "voice calibration" feature—analyze a few sample posts Kiran has written and auto-tune the profile
- Implement feedback loop (users rate generated structures/topics; system learns from feedback)
- Add timeline/deadline management (plan out content calendar, schedule posts for future publishing)
- Create library of proven narrative arcs ("The Contradiction Arc," "The Systems Arc," "The Personal Journey Arc") as optional structure guides

**Long term:**
- Integrate with blog publishing workflow (auto-publish to blog platform with metadata)
- Build audience insights (which topics resonate? what length performs best?)
- Multi-platform content adaptation (take 1,750-word blog post, auto-generate tweet threads, LinkedIn posts, short-form video scripts)
- Connect to professional networking (WordWeaver posts appear in Fenix graph; used to contextualize portfolio)
- Learning from Kiran's earlier published posts (system can reference "you wrote about X on Feb 12, this could be a follow-up angle")
- Collaborative mode (invite editors to review and annotate before final export)

**Strategic considerations:**
- WordWeaver is designed to reduce friction around blog content production, but the real bottleneck is often deciding *what* to write about. The theme + angle selection process is meant to help here, but may need more scaffolding.
- The skill works best for long-form, substantive writing (the 7-minute read target). For short-form or social content, may need a separate workflow.
- Success metrics should include: time-to-publish (reduced?), post quality/engagement (improved?), publication consistency (more frequent?).

---

## Source Sessions

- `2026-02-17-215849-build-me-a-reusable-cowork-skill-called-wordweaver.md` — Initial specification of WordWeaver with all core requirements, workflow steps, and config file structure
- `2026-02-19-071015-wordweaver.md` — Brief workflow test session
- `2026-02-26-093157-reimagining-linkedin-for-meaningful-professional-connection.md` — Research and ideation on professional reputation, networking authenticity, and platform design (informed future blog topic ideation)
