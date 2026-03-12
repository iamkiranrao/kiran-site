---
module: madlab
title: MadLab
created: 2026-03-11
last_updated: 2026-03-11
version: 1
---

# MadLab

## Overview

MadLab is an experimental projects section of Kiran's portfolio website that showcases AI prototypes, chatbots, web/mobile apps, and creative automation tools. Built as a Netflix-style browsable grid, MadLab organizes these projects by category (Chatbots, Agentic AI, Mobile Apps, Web Apps, AR/VR, Voice & Audio AI, Computer Vision, Browser Extensions, Automations & Workflows, APIs & Integrations, Data & Visualizations, Games & Simulations) with placeholder cards that can be populated with real projects over time.

The design intentionally starts with foundational page scaffolding before populating individual project content—this allows rapid iteration on the layout and structure before committing to the detail pages for each prototype. Cards can be clicked to navigate to detail pages (once built) or remain as placeholders while projects are in development.

## Architecture

MadLab is built as a single static HTML page with the following components:

- **Page structure:** `madlab.html` — standalone subpage with all CSS and JS inline (matching the site's pattern of no external stylesheets per page)
- **Navigation:** Links from `app.js` cardConfig direct users to the MadLab page from the homepage
- **Mobile menu:** Updated across all site pages to point to `madlab.html`
- **Card layout:** Horizontal scroll rows (12 categories, 3 placeholder cards each = 36 total cards initially)
- **Design pattern:** Last card in each category is larger to highlight it as "latest" — a visual emphasis technique borrowed from streaming platforms
- **Tech stack:** Vanilla HTML/CSS/JS, no frameworks or external dependencies
- **Styling:** Inherits dark/light theme toggle from shared `styles.css` variables, inline `<style>` block for page-specific styles

## Key Decisions

**Decision: Netflix-style layout (Feb 25, 2026)**
- Rather than a single-column list of projects, chose horizontal scroll rows grouped by category
- Rationale: Makes browsing feel more exploratory and playful; easier to compare similar projects side-by-side
- Alternative considered: Grid-based layout (rejected as less conducive to discovery)

**Decision: Start with placeholder cards (Feb 25, 2026)**
- Created 12 categories with 3 placeholder cards each instead of waiting for content
- Rationale: Allowed design validation and structural iteration without blocking on project details; visitors see the page is "coming soon" rather than absent
- This approach lets Kiran populate projects incrementally as they're built

**Decision: Highlight latest card in each category (Feb 25, 2026)**
- Made the rightmost card in each category larger to signal it as the most recent
- Rationale: Draws attention to newest work; uses familiar design pattern from streaming platforms
- Implementation: CSS-based size scaling on the last child of each category row

**Decision: Remove CLI Tools category (Feb 25, 2026)**
- Initially included 13 categories; trimmed to 12 by removing "CLI Tools"
- Rationale: Better focus and manageability; overlapping with "Automations & Workflows"

## Evolution

**Session: Feb 25, 2026 (Population Start)**
Kiran asked to finish populating content for the last two cards on the homepage (Mad Lab and Studio). Discussed Netflix-like UI with horizontal scroll categories and started with placeholder cards. Categories proposed included Chatbots, Agentic AI, Mobile Apps, Web Apps, AR/VR, plus AI-specific categories. Page was built with all foundational structure and styling.

**Session: Feb 25, 2026 (Design Enhancement)**
Implemented visual enhancement to highlight the rightmost card in each category as "latest." This required CSS changes to scale the final card larger while keeping the layout responsive.

**Session: Feb 27, 2026 (Integration with Fenix Explainers)**
MadLab pages were integrated with the Fenix explainer system. This involved adding support for explainer icons next to category titles on the MadLab page, allowing structured content about each project category to be fed into the Fenix content graph. The explainer template includes: What This Is, Why It's Here, What to Look For, Kiran's Take (first-person narrative explaining the purpose of this category), and Connected To (relationships to other parts of the site).

## Current State

**What works:**
- Page structure and navigation are complete and functional
- All 12 categories are defined with placeholder cards
- Dark/light theme toggle works across the page
- Mobile menu navigation is wired correctly
- Visual hierarchy is clear (latest cards highlighted)
- No external dependencies—pure HTML/CSS/JS

**What's in progress:**
- Population of actual prototype projects into categories
- Detail pages for individual projects
- Explainer panels with educational content about each category
- Fenix integration (content graph metadata)

**What's stubbed out:**
- All 36 placeholder cards have generic titles and descriptions
- No links to actual project pages yet (cards are clickable but non-functional)
- No project-specific imagery or visual distinction between categories

## Known Issues & Limitations

- **Placeholder burden:** 36 empty cards on page load (though clearly marked as placeholders) may feel incomplete to visitors
- **No filtering/search:** With 12 categories, navigation is linear; no way to filter or search across projects
- **Mobile scroll UX:** Horizontal scroll rows work on desktop but may feel cramped on mobile (not yet tested across devices)
- **Card click behavior:** Currently placeholder cards show no feedback; need to define what happens when user clicks before content exists
- **Responsive design:** Layout hasn't been tested on tablets/mobile screens comprehensively

## Ideas & Future Direction

**Short term:**
- Build 2-3 real projects to flesh out categories (e.g., a chatbot, an agentic workflow tool, a browser extension)
- Create detail page template for projects and populate first batch
- Add project-specific icons/visual indicators for tech stack (LangChain, LangGraph, etc.)
- Write explainer panels for each category explaining what makes projects in that category interesting

**Medium term:**
- Add filtering by tech stack or use case (e.g., "Show all AI projects" or "Show all web apps")
- Implement search/discovery across MadLab and Studio
- Add timestamps and "new" badges for recently added projects
- Create cross-references between projects that use similar technologies or solve related problems

**Long term:**
- Connect MadLab projects to blog posts that explain design decisions or learnings
- Build "related projects" suggestions (e.g., "If you liked this chatbot, check out this automation workflow")
- Allow filtering by skills demonstrated (e.g., "Projects that show prompt engineering," "Projects with multi-agent systems")
- Integrate with Fenix so the AI can guide visitors through projects based on what they're interested in
- Consider interactive project previews (embed working prototypes within MadLab cards, like the insurance chatbot)

---

## Source Sessions

- `2026-02-25-030851-i-want-to-try-and-finish-populating-content.md` — Initial MadLab page creation with Netflix-style layout and placeholder cards
- `2026-02-27-060124-1-explainer-icons-from-your-earlier-request.md` — Integration of explainer panels and Fenix content graph support
