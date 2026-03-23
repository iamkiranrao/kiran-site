---
module: dia-fund
title: The DIA Fund
created: 2026-03-20
last_updated: 2026-03-20
version: 1
---

# The DIA Fund

## Overview

The DIA Fund is a family philanthropy initiative — **Dream. Inspire. Advance.** — named after Kiran's 4-year-old daughter Dia. It's both a charitable vehicle for Scannibal app proceeds and a multi-decade framework for teaching Dia to grow into thoughtful philanthropy and social impact work.

Rather than treating giving as a one-time act, DIA Fund frames it as a lived practice: Dia will grow up observing family commitment to specific causes, understanding how charitable work translates to real-world impact, and eventually making her own giving decisions as she matures.

The Fund supports two partner organizations chosen for alignment with Dia's wellbeing and development:
- **Feeding America** — Food security, childhood nutrition (4-star Charity Navigator)
- **Best Friends Animal Society** — Animal welfare, protection (4-star Charity Navigator)

DIA Fund operates as a Donor-Advised Fund (DAF) structure for tax-efficient giving and professional grant management.

---

## Architecture

### Public Presence

**Landing Page:** `thediafund.org` (Squarespace hosted)
- Mission statement and Dia's story (written in first-person voice from Kiran's perspective)
- Partner organizations featured with ratings, impact metrics, and why they were chosen
- Annual giving dashboard (updated quarterly/annually) showing total proceeds, allocation, and impact stories
- Educational content for other parents interested in teaching children about philanthropy
- Contact form for press inquiries and partnership opportunities

**Site Integration:** `kirangorapalli.com/the-dia-fund.html`
- Shorter landing page (about section) linking to full thediafund.org site
- Mentions in portfolio context (Scannibal case study references DIA Fund as the charitable backend)
- Email signature and social media links include DIA Fund

### Charity Integration

**Feeding America**
- **Organization:** 501(c)(3), EIN 13-3722829
- **Rating:** 4-star Charity Navigator
- **Focus:** Food banks across the US, childhood nutrition programs
- **Why:** Core to child development; Dia has access to abundant food; many families don't
- **Annual Target:** 35-40% of DIA Fund proceeds

**Best Friends Animal Society**
- **Organization:** 501(c)(3), EIN 36-3037442
- **Rating:** 4-star Charity Navigator
- **Focus:** Animal sanctuary, adoption services, welfare advocacy
- **Why:** Dia's love of animals; teaches compassion for vulnerable creatures
- **Annual Target:** 35-40% of DIA Fund proceeds

**Flexible Allocation:** 20-30% of proceeds reserved for emerging causes or special grants (e.g., disaster relief, new partner organizations Dia votes on at family meetings).

### Financial Structure

**Donor-Advised Fund (DAF) Planning:**
- Legal entity: DIA Fund LLC (or Fidelity/Schwab DAF account, pending setup)
- Custodian: Fidelity Charitable (or equivalent) for professional grant administration
- Annual IRS Form 990-N or 990 filing (if applicable based on asset size)
- Tax deduction for contributions (Kiran can deduct charitable gifts to the DAF as itemized deductions)

**Revenue Sources:**
1. **Primary:** 100% net proceeds from Scannibal app (subscription revenue after Stripe fees and ops costs)
2. **Secondary:** Direct personal contributions from Kiran and family
3. **Future:** Grants, partnerships, or other product revenue streams

**Grant Allocation Process:**
- Quarterly review by Kiran (with input from Dia as she matures, starting age 8-10)
- Grants issued to Feeding America and Best Friends via DAF custodian
- Annual impact report compiled and shared publicly on thediafund.org
- Transparency: Total raised, amount distributed, administrative costs, impact metrics

### Database & Tracking

**Supabase Tables:**
- `dia_fund_transactions` — All contributions, grants issued, and reversals
- `dia_fund_impact_metrics` — Tracking data from partner orgs (meals served, animals helped, etc.)
- `dia_fund_family_decisions` — Log of quarterly decisions (partner selection, allocation %, special grants)

**Integration Points:**
- Scannibal app: When user selects charity during onboarding, subscription revenue is tagged with that choice
- Monthly settlement: Automated script sums Scannibal proceeds by month and issues grant to appropriate partner
- Annual report generation: Pull metrics from partner orgs' APIs (or manual upload) and generate public dashboard

---

## Key Decisions

**March 2026 — Named After Dia, With Her Voice Throughout**
Decided to name the fund after Kiran's 4-year-old daughter and write all materials in a voice that acknowledges her perspective (even though she can't explicitly consent yet). This centers Dia as the fund's beneficiary in terms of learning, not just inheritance. Trade-off: requires periodic updates as Dia ages and can express her own preferences. Payoff: creates a lived narrative of philanthropy that's personal and authentic, not performative.

**DAF Structure Over Direct Giving**
Chose Donor-Advised Fund (DAF) via Fidelity/Schwab rather than direct donations to charities. Rationale: DAF provides tax efficiency (one large deduction in a high-income year), professional grant management, and flexibility to adjust allocations annually. Also creates permanence — the fund can outlive Scannibal, becoming a family legacy vehicle.

**Two Partners, Not Many**
Rejected the idea of spreading giving across 10+ causes. Chose two partners (Feeding America and Best Friends) to allow deep engagement and relationship-building. This teaches Dia that meaningful impact comes from focus, not dilution.

**Public Impact Dashboard**
Decided to publish annual giving data and impact stories on thediafund.org rather than keeping giving private. Rationale: transparency builds trust in the fund's mission, and public accountability ensures partner orgs deliver on their commitments. Also models for Dia that philanthropy is not about tax breaks or public status — it's about results.

**Flexible Allocation Tier (20-30%)**
Rather than rigid 50/50 split, built in flexibility for 20-30% of proceeds to support emerging causes or special grants (e.g., Dia votes on a new partner at age 10). This prevents the fund from becoming static and teaches adaptability.

**Scannibal Revenue as Primary Source**
Decided to fund DIA Fund primarily from Scannibal proceeds, not separate personal donations. This creates visibility: users see that their subscription directly supports the mission. Over time, if Scannibal grows, DIA Fund grows proportionally — a natural scaling mechanism.

---

## Evolution

**January 2026 — Conceptualization**
Kiran articulated the vision: teach Dia about giving early, create a charitable vehicle that's personal and meaningful, not just tax-efficient. Named after her, involve her in decisions as she grows.

**February 2026 — Legal & Financial Planning**
Consulted with tax advisor and DAF custodian (Fidelity) on structure. Finalized partner selection (Feeding America, Best Friends). Set up Supabase tables for tracking.

**March 2026 — Public Launch**
Designed and deployed thediafund.org landing page (Squarespace). Integrated with Scannibal app (users choose charity during onboarding). Set up quarterly reporting process.

**Future — Living Legacy**
As Dia grows (ages 8, 12, 18), her voice and decision-making power increase. At 18, she can choose to take over the fund entirely, modify partners, or redirect all proceeds to causes she cares about.

---

## Current State

**Live:**
- **Landing Page:** thediafund.org deployed and public
- **Scannibal Integration:** Charity selection during onboarding fully functional
- **Database:** Supabase tables created; transaction tracking active
- **Legal:** DAF structure under review with tax advisor; formation documents drafted

**In Progress:**
- **Settlement Workflow:** Monthly scripts to calculate Scannibal revenue and issue grants to Feeding America and Best Friends
- **Impact Dashboard:** Public dashboard on thediafund.org showing YTD totals, allocation, and impact metrics (meals served, animals helped)
- **Annual Report:** Template and process for compiling year-end report with partner stats

**Documentation Location:**
- Core vision: `docs/Career/the-dia-fund.md` (foundational document)
- Branding guidelines: `docs/Brand/dia-fund-voice.md` (writing tone, visual identity)
- Landing page copy: `sources/thediafund.org/` (Squarespace content)

---

## Known Issues & Limitations

**Partner Organization API Access**
Feeding America and Best Friends don't expose public APIs for impact metrics. Currently relying on manual quarterly data collection (emails, reports) from partner org contacts. If partners change contact or reporting structure, dashboard updates could stall.

Mitigation: Annual partnership agreement should specify reporting format and frequency.

**DAF Formation Complexity**
Setting up a true DAF (vs. Fidelity donor-advised fund account) requires legal entity formation, IRS letters, and compliance overhead. Currently in review phase; if too complex, will use Fidelity's hosted DAF instead (simpler, but less customizable).

**Dia's Evolving Involvement**
At age 4, Dia can't meaningfully participate in decisions. As she grows, involving her in grant decisions could be pedagogically valuable but logistically complicated. No clear decision framework yet for "how much say does an 8-year-old have?"

**Tax Planning**
If Scannibal revenue spikes, Kiran's personal tax liability could increase if contributions don't align with income. Requires annual tax planning with accountant.

**Public Scrutiny**
Publishing giving data (and naming the fund after his daughter) creates potential for public criticism or privacy concerns. Risk: if Scannibal faces controversy, DIA Fund's charitable work gets entangled with product perception.

Mitigation: Maintain clear separation between product and philanthropy in public communications.

---

## Ideas & Future Direction

**Family Governance Board**
As Dia grows, formalize quarterly family meetings where Kiran and Dia review impact reports, vote on new partner orgs, and decide special grants. Document decisions in `dia_fund_family_decisions` table. Build a "decision history" timeline Dia can revisit later.

**Educational Content Series**
Create blog posts and video content on thediafund.org for other parents wanting to teach children about giving. Topics: "Talking to Kids About Money," "How to Choose Charities," "Making Giving a Family Practice." Position DIA Fund as a model, not just a personal project.

**Partner Spotlights**
Monthly deep-dive interviews (written or video) with program directors at Feeding America or Best Friends. Show where DIA Fund money goes, what impact it has, and tell stories of people/animals helped. Increase Dia's connection to the work.

**Annual Giving Challenge**
Invite other families to "join the DIA Fund" by directing a portion of their Scannibal subscriptions to the same partners. Create a competitive leaderboard of families, track collective impact. Builds community around shared giving.

**Scholarship Program**
If DIA Fund grows significantly, create scholarships for college students studying social work, nonprofit management, or animal welfare. Dia could eventually help select winners, teaching her about meritocratic giving.

**Multimedia Storytelling**
Produce short documentaries or photo essays showing the work of Feeding America and Best Friends, and how DIA Fund subscriptions directly fund specific programs. Share on Instagram, TikTok (age-appropriate content featuring Dia).

**Endowment Planning**
Design a long-term endowment strategy so that DIA Fund can exist in perpetuity, even after Scannibal's peak revenue years. Explore donor matching (e.g., "For every $1 you give, Kiran matches $1").

**Partner Expansion**
If Dia develops interests (e.g., climate, education, technology), add partners aligned with those causes. Make DIA Fund responsive to her evolving worldview.

---

## Relationship to Other Components

**Scannibal** is the primary funding engine for DIA Fund. Every paid subscription to Scannibal directs revenue to the fund.

**kirangorapalli.com** includes DIA Fund links and positions it as part of Kiran's work philosophy (building products with purpose). It's not a portfolio case study, but a personal commitment.

**Command Center** does NOT manage DIA Fund operationally — it's external. However, it could eventually surface DIA Fund metrics on a dashboard for Kiran's reference.

---

## Source Sessions

- **2026-01-15** — Initial conversation: vision for teaching Dia about philanthropy, named after her
- **2026-02-20** — Tax/legal planning: DAF structure, partner selection, Scannibal integration design
- **2026-03-20** — Public launch: landing page, branding, integration with Scannibal app onboarding
