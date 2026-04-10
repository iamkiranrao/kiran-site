---
module: feedback-testimonials
title: Feedback & Testimonials Module
created: 2026-03-11
last_updated: 2026-03-11
version: 1
---

# Feedback & Testimonials Module

## Overview

The Feedback & Testimonials module is a public-facing collection system for site visitors to share feedback about Kiran's portfolio site and submit testimonials about their experience. The system captures both structured ratings and free-form text, stores submissions in Supabase, and provides a Command Center dashboard for reviewing, approving, and managing testimonials. Feedback and testimonials from the landing page are submitted via public API endpoints and tracked for quality insights.

## Architecture

The module uses a two-layer architecture: **public submission APIs** called from the landing page, and **authenticated dashboard APIs** accessed through the Command Center frontend.

### Backend Stack

**FastAPI Router** (`routers/feedback.py`)
- **Public endpoints**: `POST /api/feedback/submit` and `POST /api/feedback/testimonial/submit` receive submissions from the landing page (kiranrao.ai)
- **Dashboard endpoints**: `GET /api/feedback/stats`, `GET /api/feedback/list`, `DELETE /api/feedback/{id}` for feedback management; `GET /api/feedback/testimonials/stats`, `GET /api/feedback/testimonials/list`, `PATCH /api/feedback/testimonials/{id}/status`, `DELETE /api/feedback/testimonials/{id}` for testimonial curation

**Supabase Service** (`services/feedback_service.py`)
- Manages CRUD operations against two Supabase tables: `site_feedback` and `testimonials`
- Tracks IP address and user agent on feedback submissions for analytics
- Testimonials include a `status` field: `pending` → `approved` / `rejected` for curation workflow

**Supabase Tables**
- `site_feedback`: id, rating (love/like/neutral/dislike), comment, created_at, ip_address, user_agent
- `testimonials`: id, name, role, testimonial, is_public, status, created_at

### Frontend Stack

**Command Center Dashboard** (`frontend/src/app/dashboard/feedback/page.tsx`)
- Two-tab interface: Feedback tab and Testimonials tab
- Feedback tab: stat cards (total count, rating breakdown, entries with comments), filterable list by rating, delete capability
- Testimonials tab: stat cards (total, pending/approved/rejected counts, public count), filterable list by status, inline approve/reject buttons, delete capability
- Sidebar integration: MessageSquare icon, orange accent color

### Landing Page Integration

**App.js** (kiranrao.ai)
- Feedback form POSTs JSON to `https://api.kiranrao.ai/api/feedback/submit` with optional rating and comment
- Testimonial form POSTs JSON to `https://api.kiranrao.ai/api/feedback/testimonial/submit` with required name, optional role, testimonial text, and is_public flag

### Database Migration

SQL migration (`migrations/001_feedback_tables.sql`) creates both tables with:
- Indexes on created_at and status (testimonials)
- RLS policies for service_role access
- Automatic created_at timestamps

### CORS Configuration

Backend `.env` includes CORS origins to allow requests from:
- localhost:3000 (local Command Center)
- localhost:3001 (local landing page)
- kiranrao.ai and www.kiranrao.ai (production site)

## Key Decisions

**March 6, 2026 — Dual-Form Architecture**
Decided to implement feedback and testimonials as two separate submission forms and database tables rather than a single unified collection. This allows different submission flows: feedback is anonymous and can be structured with ratings; testimonials require attribution and curation. Testimonials get a public approval workflow, feedback is purely logged.

**Public API + Dashboard Separation**
Public endpoints (/submit, /testimonial/submit) accept requests from the landing page without authentication. Dashboard endpoints provide filtering, stats, and curation features. This keeps the public submission experience frictionless while maintaining control over public testimonials.

**IP + User Agent Tracking**
Feedback submissions capture IP address and user agent for spam detection and geographic insights, but testimonials do not. Reflects the principle that detailed feedback comes with attribution requirements, while structured feedback is privacy-preserving.

**Testimonial Approval Workflow**
All testimonials default to pending status. They must be explicitly approved to display as public. This gives Kiran control over what quotes appear on the site while still capturing all submissions for internal review.

## Evolution

**Session: 2026-03-06 (Landing Page Feedback Module)**
Initial conversation identified non-functional feedback and testimonial forms on the landing page. Built the entire system end-to-end in one session: created feedback_service.py with Supabase CRUD for both tables, created feedback.py router with 8 endpoints (public submit + dashboard list/stats/delete), created Command Center dashboard page with two tabs, stat cards, and filtering, updated landing page app.js to POST forms to the API instead of Netlify forms, created and ran Supabase migration to create the tables, deployed backend and frontend to production.

## Current State

**What works:**
- Public feedback and testimonial submissions from the landing page are stored in Supabase
- Dashboard displays stats (total count, rating/status breakdown) and paginated lists
- Testimonials can be approved/rejected via dashboard
- Feedback and testimonials can be deleted
- CORS properly configured for both local and production origins
- Module appears in Command Center sidebar with dedicated tab

**What's partial/incomplete:**
- No analytics dashboard on testimonials (e.g., which testimonials drive conversions, sentiment analysis)
- No email notifications when new testimonials are submitted (Kiran must check dashboard manually)
- No testimonial display on the public site yet (submissions are curated but not surfaced)
- Landing page form styling could better indicate what happens after submission

## Known Issues & Limitations

**Public API Discovery**
There is no documented API spec or `/api/docs` endpoint listing the feedback endpoints. Developers would need to reverse-engineer the submission URLs from the landing page code.

**Rate Limiting**
Public submission endpoints have no rate limiting. A single user could spam feedback or testimonials. Should add per-IP rate limiting on public endpoints before scaling.

**Testimonial Display**
The approval workflow exists but testimonials have no public display location yet. The module is collection-only at present; publishing curated testimonials requires a separate effort.

**Form Validation**
Feedback allows empty submissions if rating is provided. Edge cases around empty or whitespace-only text are handled but could be stricter.

## Ideas & Future Direction

**Testimonial Display Page**
Build a public `/testimonials.html` page that displays approved testimonials in a featured cards grid. Integrate with the dashboard so published testimonials can be flagged and displayed with attribution.

**Email Notifications**
Add a background job that sends Kiran a digest of new testimonials (daily or weekly). Unsubscribe link so he can opt out without touching code.

**Sentiment Analysis**
Use Claude API to analyze feedback comments and testimonials for sentiment and automatically tag high-value testimonials. Surface trending sentiment in the dashboard.

**Rate Limiting & Spam Detection**
Implement per-IP rate limiting (e.g., max 5 submissions per day) and basic spam filters. Flag submissions for manual review if they contain links or suspicious patterns.

**Form Analytics**
Track form abandonment, time to submit, and completion rate on the landing page. Correlate with feedback sentiment.

**Testimonial Widgets**
Build reusable React components so testimonials can be embedded on other pages (e.g., career highlights, about section) dynamically pulling from Supabase.

---

## Source Sessions

- `2026-03-06-230119-in-my-website-landling-page-indexhtml---the.md` — Built entire feedback module end-to-end (backend, frontend, database, deployment)
- `2026-03-05-201142-continue-from-fenix-roadmapmd-phase-1-is-complete-im.md` — Mention in context of Phase 2 logging architecture
