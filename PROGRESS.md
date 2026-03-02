# Project Progress Tracker

**Project:** kirangorapalli.com — Portfolio to Platform Migration
**Architecture:** Cloudflare Pages + Vercel + Supabase + Stripe + Claude API
**Last updated:** March 2, 2026

---

## How To Use This File

At the start of every new chat session, say:
> "Read ARCHITECTURE.md, ARCHITECTURE-RULES.md, MIGRATION-RUNBOOK.md, and PROGRESS.md. We're on Phase [X]. Pick up from Step [X.Y]."

That's all the context needed. Don't paste previous conversations — just point to the docs.

---

## Current Status

**Active Phase:** Phase 0 — Hosting Migration (Netlify → Cloudflare Pages)
**Active Step:** Step 0.6 — Decommission Netlify site
**Blocked on:** Nothing — ready to proceed

---

## Phase Tracker

| Phase | Description | Status | Notes |
|-------|------------|--------|-------|
| **Phase 0** | Hosting Migration (Netlify → Cloudflare Pages) | **IN PROGRESS** | Waiting on Cloudflare account creation |
| **Phase 1** | Backend Infrastructure (Vercel + Supabase) | Not started | |
| **Phase 2** | Backend Scaffolding + Health Check | Not started | |
| **Phase 3** | Forms + Auth + Command Center Migration | Not started | |
| **Phase 4** | Content Pipeline + RAG + OG Cards | Not started | |
| **Phase 5** | Fenix MVP (Chat + Persona + Widget) | Not started | |
| **Phase 6** | Store + Agentic Features + Public APIs | Not started | |
| **Phase 7** | Admin Dashboard + Training Loop | Not started | |
| **Phase 8** | Production Hardening | Not started | |

---

## Completed Work (This Session — March 2, 2026)

### Documents Created
- **ARCHITECTURE.md** (v2.0) — Full platform architecture covering Cloudflare + Vercel + Supabase + Stripe + Claude. Includes 7 architecture decision records, system diagrams (Mermaid), request flow sequences for Fenix/forms/store/auth, full database schema, cost model.
- **ARCHITECTURE-RULES.md** — 13 sections covering: scalability, multi-device support, informed decisions, backend rules, frontend rules, deployment rules, architecture checklist, decision log template, domain canonicalization, OG card standards, hosting/CDN standards, data privacy, e-commerce standards.
- **MIGRATION-RUNBOOK.md** — 9 phases (0–8), estimated 24–32 hours total. Detailed step-by-step with time estimates, education moments, decision points, and trade-off documentation.
- **PROGRESS.md** (this file) — Session-to-session handoff tracker.

### Key Decisions Made
1. **Static hosting:** Cloudflare Pages (replaces Netlify) — unlimited builds, fastest CDN, free
2. **Backend:** Vercel — serverless Python/FastAPI, git deploy, scales to zero
3. **Data platform:** Supabase — PostgreSQL + pgvector + Auth + Storage in one
4. **Payments:** Stripe — no monthly fee, full API control, PCI compliant
5. **LLM:** Claude API (Anthropic) — proven in Command Center
6. **OG cards:** Auto-generated per page in publish pipeline
7. **Domain:** kirangorapalli.com canonical everywhere
8. **Repo strategy:** Separate repos (main-site + fenix-backend)

---

## Kiran Action Items (Pending)

- [x] Create Cloudflare account at cloudflare.com — **DONE**
- [x] Add domain kirangorapalli.com to Cloudflare — **ACTIVE** on Cloudflare
- [x] Add domain fenixconsulting.ai to Cloudflare — nameservers propagating
- [ ] Create Vercel account via GitHub OAuth (Phase 1)
- [ ] Create Supabase account (Phase 1)
- [ ] Provide Anthropic API key for production (Phase 1)
- [ ] Create Stripe account (Phase 6)
- [ ] Set up Calendly account + API key (Phase 6)
- [ ] Define what products to sell in Store (before Phase 6)
- [ ] Define access control tiers — what's free vs. gated (before Phase 3)

---

## Known Issues / Technical Debt

- ~~HTML files still reference `kirangorapalli.netlify.app` in canonical/OG tags~~ **FIXED** — replaced across 46 files
- ~~Root domain A records pointing to Netlify IPs~~ **FIXED** — deleted, replaced with Cloudflare Worker custom domain
- ~~2 `www` A records still point to old Netlify IPs~~ **FIXED** — deleted, added CNAME `www` → `kirangorapalli.com` + 301 redirect rule
- ~~`netlify.toml` and `netlify/` directory still in repo~~ **FIXED** — removed from repo
- Netlify Forms attributes (`data-netlify="true"`) still in index.html (removed in Phase 3)
- Command Center uses `/tmp/` for session storage (replaced with Supabase in Phase 3)
- Duplicated boilerplate across Command Center routers (consolidated in Phase 3)

---

## Session Log

### Session 1 — March 2, 2026
**Duration:** ~1 session
**What happened:**
- Consumed context from previous chat about Fenix requirements, infrastructure discussion
- Created ARCHITECTURE.md v1.0 (Fenix-focused)
- Created ARCHITECTURE-RULES.md with 3 core principles + implementation standards
- Created MIGRATION-RUNBOOK.md with 8 phases
- Discussed hosting: Netlify vs Cloudflare Pages vs consolidate on Vercel
- Kiran raised full scope: forms, auth, e-commerce, public APIs, MadLab
- Decided on Option A: Distributed Stack (Cloudflare + Vercel + Supabase + Stripe)
- Updated all three documents to v2.0 reflecting full platform scope
- Verified cross-document consistency
- Created PROGRESS.md for session handoffs
- **Next:** Kiran creates Cloudflare account, then we execute Phase 0

### Session 2 — March 2, 2026
**Duration:** ~1 session
**What happened:**
- Picked up from context compaction — resumed Phase 0
- Updated kirangorapalli.com nameservers at Squarespace → Cloudflare (felipe/marissa)
- kirangorapalli.com went **Active** on Cloudflare
- Domain canonicalization sweep: replaced `kirangorapalli.netlify.app` → `kirangorapalli.com` across 46 files
- Added fenixconsulting.ai to Cloudflare (Free plan, DNS records imported)
- Updated fenixconsulting.ai nameservers at Squarespace → Cloudflare
- fenixconsulting.ai nameserver propagation in progress
- Updated PROGRESS.md
- **Next:** Connect GitHub repo to Cloudflare Pages (Step 0.2)

### Session 3 — March 2, 2026
**Duration:** ~1 session
**What happened:**
- Connected GitHub repo (`iamkiranrao/kiran-site`) to Cloudflare Workers & Pages
- Cloudflare's new unified Workers & Pages flow deployed site as a static asset Worker
- Site deployed successfully at `kiran-site.kiranrao.workers.dev`
- Verified site loads correctly on workers.dev subdomain
- Attempted to add custom domain `kirangorapalli.com` — blocked by existing Netlify A records
- Deleted 2 old Netlify A records from Cloudflare DNS (`13.52.188.95`, `52.52.192.191`)
- Successfully added `kirangorapalli.com` as custom domain on kiran-site Worker
- Cloudflare auto-provisioned HTTPS certificate
- **Verified site is live at `https://kirangorapalli.com`** — fully served from Cloudflare CDN
- 2 old `www` A records still in DNS (pointing to Netlify IPs) — need cleanup
- Updated PROGRESS.md
- **Next:** Clean up www DNS records, set up www→root redirect, decommission Netlify (Step 0.4–0.6)

### Session 4 — March 2, 2026
**Duration:** ~1 session
**What happened:**
- Deleted 2 old `www` A records from Cloudflare DNS (`98.84.224.111`, `18.208.88.157`)
- Added CNAME record: `www` → `kirangorapalli.com` (Proxied, Auto TTL)
- Deployed Cloudflare Redirect Rule: "Redirect from WWW to root" — 301 redirect `https://www.*` → `https://${1}`
- Removed `netlify.toml` (root + site/) and `netlify/functions/` directory from repo
- Updated PROGRESS.md with session log and fixed known issues
- **DNS state:** 2 records — Worker (`kirangorapalli.com` → `kiran-site`) + CNAME (`www` → `kirangorapalli.com`)
- **Next:** Decommission Netlify site, commit all changes, begin Phase 1
