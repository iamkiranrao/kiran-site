---
module: tools
title: Tools & Links
created: 2026-03-20
last_updated: 2026-03-20
version: 1
---

# Tools & Links

## Overview

Tools & Links is a central reference hub for all external dashboards, analytics services, and infrastructure tools that support kiranrao.ai and its products. It provides quick-access cards organized by category with contextual help guides, maintenance checklists, and direct links to each service.

The module combines two things:

1. **Dashboard UI** (`dashboard/tools/page.tsx`) — Interactive cards grouped by category (Analytics & Tracking, Hosting & Deployment, Fenix Infrastructure, Code Repositories, SEO & Performance, etc.), each with a direct link, brief description, and contextual help button (? icon).

2. **Tool Guides Content** (`docs/Foundation/ToolGuides/`) — Markdown guides for each major service (GA4, Clarity, Search Console, GitHub, Supabase, Cloudflare, Vercel), stored as structured documentation. API at `/api/tool-guides/` serves guide content on demand.

This separation keeps the dashboard UI lightweight while enabling rich, in-depth help content for each tool.

---

## Architecture

### Frontend Stack

**Dashboard Page** (`frontend/src/app/dashboard/tools/page.tsx`)
- **Layout:** Grid of tool cards, organized by category tabs or persistent categories
- **Card Components:**
  - Tool name and icon (from Font Awesome or custom SVG)
  - Brief 1-line description
  - Direct link to external service (button with external icon)
  - Contextual help button (? icon, styled as small button)
  - Last verified date (when the tool was last checked/updated)

- **Categories:** Collapsible sections or tab-based navigation
  1. Analytics & Tracking (GA4, Clarity, Hotjar)
  2. Hosting & Deployment (Vercel, Cloudflare, Cloudflare Pages)
  3. Fenix Infrastructure (Supabase, Voyage AI, Claude API)
  4. Code Repositories (GitHub, npm Registry)
  5. SEO & Performance (Search Console, PageSpeed Insights, Lighthouse CI)
  6. Command Center Backend (FastAPI, Swagger Docs)
  7. Products (Scannibal TestFlight, DIA Fund Squarespace)
  8. Live Site (kiranrao.ai, Status Page)

- **Contextual Help Button:**
  - Click ? icon → slide-out panel (right side on desktop, bottom sheet on mobile) with full guide content
  - Panel shows: tool name, status badge (operational/needs attention/down), current issues, usage tips, documentation link
  - "Dismiss" or "Back" to return to card view

- **Responsive Design:**
  - Desktop: 3-column grid of cards, side panel for help
  - Tablet: 2-column grid
  - Mobile: 1 column, help bottom sheet

### Backend Stack

**Tool Guides API** (`/api/tool-guides/`)
- `GET /api/tool-guides/` — List all available guides with metadata (tool name, category, status)
- `GET /api/tool-guides/{slug}` — Retrieve full guide content (markdown rendered to HTML)
- `GET /api/tool-guides/{slug}/status` — Current operational status (fetch from tool's status page API or cached status)

**Guide Service** (`services/tool_guide_service.py`)
- Scans `docs/Foundation/ToolGuides/` for `.md` files
- Caches guides in memory at startup (like Library module)
- Maps guide slug to tool name and category
- Supports `status` field pulled from external status pages (Vercel, Supabase, etc.)

### Tool Guides Content

**Storage:** `docs/Foundation/ToolGuides/` with one markdown file per major tool
- `ga4.md` — Google Analytics 4 setup, goals, reporting
- `clarity.md` — Microsoft Clarity heatmaps and session recording
- `search-console.md` — Google Search Console indexing and coverage
- `github.md` — Repository structure, GitHub Actions, branch protection
- `supabase.md` — Database, auth, realtime subscriptions
- `cloudflare.md` — DNS, caching, Workers, page rules
- `vercel.md` — Deployment, preview environments, serverless functions
- `slack.md` — Notifications, integrations, command center alerts (if applicable)

**Guide Structure:**
```markdown
---
tool_name: Google Analytics 4
slug: ga4
category: Analytics & Tracking
status: operational
last_verified: 2026-03-20
---

# Google Analytics 4

## Quick Links
- Dashboard: https://analytics.google.com
- Property ID: G-XXXXXXXXX

## Setup Notes
[How GA4 is configured for the site]

## Current Issues
[Any known issues or caveats]

## Common Tasks
[Step-by-step for frequent operations]

## Further Reading
[Links to documentation]
```

### Maintenance Checklist

**Post-Publish Checklist (5 min)**
- [ ] GA4: Verify new pages are tracked (check real-time view)
- [ ] Clarity: Check session recording is active
- [ ] Search Console: Submit updated sitemap
- [ ] Cloudflare: Purge cache if content changed

**Weekly Checklist (15 min)**
- [ ] Check Vercel deployment status (all builds successful?)
- [ ] Review GitHub Actions logs for any failed workflows
- [ ] GA4: Check for data processing delays or missing events
- [ ] Supabase: Monitor query latency (no slow queries?)
- [ ] Clarity: Spot-check one session recording for data quality

**Monthly Checklist (30 min)**
- [ ] GA4: Review top traffic sources, conversion rate, device breakdown
- [ ] Search Console: Check coverage (any crawl errors?), indexation rate
- [ ] Lighthouse: Run performance audit on key pages, address yellow/red items
- [ ] Cloudflare: Review DNS records, ensure no typos or stale entries
- [ ] GitHub: Review security alerts on dependencies
- [ ] Supabase: Check database size, backup status, unused indexes

**Quarterly Checklist (1 hr)**
- [ ] Conduct full-stack security audit (dependencies, secrets, permissions)
- [ ] Review all third-party service agreements (uptime SLAs, pricing, data residency)
- [ ] Audit Fenix embeddings and RAG performance
- [ ] Verify disaster recovery: can we restore from backups?
- [ ] Update all tool documentation if services changed
- [ ] Run Lighthouse on entire site (sample 10-15 pages)
- [ ] Review analytics for big drops or anomalies

**Known Maintenance Debt:**
- Netlify references in old documentation (replaced by Cloudflare Pages in March 2026)
- Voyage AI rate limits not yet documented (added after first scale issue)
- No runbook for responding to deployment failures (partially documented)

### Dashboard Integration

**Sidebar Link:**
- Icon: Wrench or Gear
- Label: "Tools"
- Color: Gray or accent
- Only visible to Kiran (not public)

**Metrics Card (Optional):**
- Total tools tracked: 15+
- Operational status: Green if all systems nominal
- Last updated: Date of last maintenance checklist

---

## Key Decisions

**March 20, 2026 — Separate Dashboard UI from Guide Content**
Decided to split Tools into two layers: lightweight dashboard cards (just links and descriptions) and rich guide documentation (stored as markdown). This keeps the dashboard fast and scannable while allowing deep help content for each tool. Alternative (monolithic page with all guides inline) would be bloated.

**Tool Guides as Markdown, Not Wiki**
Chose to store tool guides as markdown in the repo (like other documentation) rather than building a custom wiki. This keeps everything version-controlled and searchable via the Library module. Trade-off: requires manual updates; a live wiki would auto-sync with tool changes.

**Maintenance Checklists Built Into Guide Content**
Rather than a separate spreadsheet or tool, the checklists live as markdown sections in each guide. This ensures they stay in sync with tool documentation and don't get lost or forgotten.

**Status Badges Cached, Not Real-Time**
Tool status (operational/degraded/down) is cached rather than polling external status pages every page load. Rationale: status rarely changes, and polling would add latency. Checklists mention "check status page" explicitly.

**Post-Publish Checklist, Not Pre-Publish**
Decided that the post-publish checklist should be the primary one (fast, immediate verification). Pre-publish checks (staging, local testing) are covered in other deployment docs, not here. This focuses the Tool Guides on operational health, not dev workflow.

**Fixed Quarterly SLA (Not Real-Time Monitoring)**
Rather than implementing real-time alerting for all tools (complexity overhead), established quarterly audits + monthly checks + weekly spot-checks. This cadence catches issues without requiring a 24/7 monitoring system.

---

## Evolution

**March 20, 2026 — System Wiring Phase, Task 3 (Build + Deploy)**
Built the entire Tools module as part of Command Center infrastructure upgrade:
1. Created dashboard page with tool cards and contextual help panels
2. Wrote tool guides for GA4, Clarity, Search Console, GitHub, Supabase, Cloudflare, Vercel
3. Implemented `/api/tool-guides/` API with guide retrieval
4. Created comprehensive maintenance checklists (post-publish, weekly, monthly, quarterly)
5. Fixed stale documentation: Removed Netlify references, updated to Cloudflare Pages
6. Deployed frontend to Vercel, backend API live

---

## Current State

**Live & Operational:**
- ✅ Dashboard page deployed at `dashboard/tools`
- ✅ 7 tool guides written and published (GA4, Clarity, Search Console, GitHub, Supabase, Cloudflare, Vercel)
- ✅ `/api/tool-guides/` API responding
- ✅ Contextual help panels working (click ? to reveal full guide in side panel)
- ✅ Post-publish and weekly checklists documented and in use
- ✅ Cloudflare Pages verified as primary host (Netlify references removed)

**What's Partial:**
- [ ] Quarterly audit not yet run (scheduled for March 31)
- [ ] Analytics dashboard (which tools are used most, help panel click-through rate) not yet built
- [ ] Tool status API (pull real status from Vercel/Supabase status pages) not yet integrated

**Documentation Location:**
- Guides: `/docs/Foundation/ToolGuides/` (individual .md files)
- Dashboard code: `frontend/src/app/dashboard/tools/page.tsx`
- API code: `routers/tools.py` or `routers/tool_guides.py`
- Checklists: Embedded in each guide's markdown

**Maintenance Schedule:**
- Post-publish: After every site deploy (ad-hoc, ~5 min)
- Weekly: Every Monday 10am (standing 15-min check)
- Monthly: Last Friday of month (30-min audit)
- Quarterly: March 31, June 30, Sept 30, Dec 31 (1-hr full audit)

---

## Known Issues & Limitations

**Netlify References Cleaned Up**
Documentation previously referenced Netlify for hosting. Migrated to Cloudflare Pages in March 2026. All references updated.

**Real-Time Status Polling Not Implemented**
Tool status badges are manually cached, not polling external status pages. If a tool goes down, the dashboard won't reflect it until next manual refresh. Acceptable trade-off for performance; checklists remind to "check status page" if issues suspected.

**Help Panel Content Not Searchable**
Contextual help guides are only accessible by clicking the ? icon on each card. Not searchable like the Library module. If user wants to find all mentions of "Supabase," they'd need to click Supabase's help panel rather than keyword search.

**Limited Tool Coverage**
Only 7 major tools have guides. Smaller services (Stripe, Postmark, Slack, etc.) are listed as cards but lack deep guides. This is intentional (focus on critical infrastructure); could expand if needed.

**Maintenance Checklist Discipline**
Checklists only work if Kiran actually does them. No automated reminders or task tracking integration (could connect to Command Center action items). Currently relies on manual discipline.

**Missing Runbooks**
Checklists identify issues ("check for crawl errors") but don't always include remediation steps ("if crawl errors exist, here's how to fix"). Could be improved with runbook-style guides ("If Vercel deployment fails, follow these 5 steps").

---

## Ideas & Future Direction

**Automated Status Dashboard**
Integrate with Vercel API, Supabase API, and Cloudflare API to pull real operational status (deployments, database availability, DDoS alerts). Display status badges on-site (green/yellow/red).

**Tool Alerts & Integrations**
Connect tool events (failed GitHub Actions, Vercel build failures, search coverage drops) to Fenix or Slack notifications. Alert Kiran immediately if something breaks, not just during scheduled checks.

**Analytics on Tool Usage**
Track which tools Kiran accesses most, which guides are most helpful (click-through rate on help panels), and which tools have highest "support burden" (most questions asked).

**Tool Recommendations**
Based on usage patterns, suggest new tools or tool configurations. E.g., "You're tracking X events in GA4 but not Y — consider adding Y for better insights."

**Tool Benchmarking**
Compare site's tool stack against industry benchmarks. E.g., "Your Lighthouse score is 87/100 (top 10%)," "Your GA4 setup is more sophisticated than typical for sites your size."

**Collaborative Tool Documentation**
Invite other Kiran's collaborators (designers, engineers) to contribute to tool guides. Keep documentation fresh and multi-perspective.

**Tool Integration Diagrams**
Create visual diagrams showing how tools interconnect (GA4 → Data Studio, Supabase → Fenix backend, GitHub → Vercel → Cloudflare). Help visualize the tech stack.

**Emergency Procedures**
Add a "Security Incident Response" and "Data Loss Recovery" guide, with step-by-step runbooks for worst-case scenarios.

**Cost Tracking**
Track spend per tool (GA4, Supabase, Vercel, etc.) and identify opportunities to optimize or consolidate (e.g., "Clarity costs $X/month; consider using Session Replay in GA4 instead").

---

## Relationship to Other Components

**Command Center Dashboard** — Tools module is a sub-page of the main dashboard, like Feedback, Library, and Fenix Analytics. Appears in sidebar navigation.

**Fenix Infrastructure** — Some tools (Supabase, Voyage AI, Claude API) directly support Fenix backend. Guides reference their specific configs.

**Deployment Workflow** — Post-publish checklist is part of the deploy ceremony. After pushing to production, run the checklist to verify health.

**Library Module** — Tool Guides are discoverable through the Library search alongside other documentation.

---

## Source Sessions

- **2026-03-20 14:00-16:00 UTC** — System Wiring Phase, Task 3: Designed and deployed entire Tools module, wrote 7 guides, built maintenance checklists, fixed Netlify → Cloudflare Pages migration, deployed to production
- **Post-launch:** Ongoing weekly and monthly maintenance per checklists
