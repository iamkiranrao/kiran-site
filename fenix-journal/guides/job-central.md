---
module: job-central
title: Job Central
created: 2026-03-11
last_updated: 2026-03-11
version: 1
---

# Job Central

## Overview

Job Central is a comprehensive job search system that combines interview preparation, company research, recruiter call coaching, and long-term career strategy. It helps Kiran systematically prepare for interviews at top Bay Area tech companies (target list: Apple, Google, Anthropic, Adobe, Intuit, Snapchat, ServiceNow, Uber, Airbnb) while building authentic confidence grounded in actual interview experience rather than rehearsed scripts.

The module recognizes that Kiran's greatest barrier is not capability—she has 15+ years of PM experience and proven track record—but rather interview muscle memory and the psychological challenge of interviewing for gatekeepers who don't know her reputation.

## Architecture

Job Central operates as three integrated subsystems:

**Interview Preparation System:**
- Frameworks library: Product sense, execution, leadership, metrics/analytics, estimation questions
- Scenario library: Real PM problems from Kiran's target companies (how to position an AI product at Google, how to scale a checkout flow at Uber, how to lead product at a Series B startup like Anthropic)
- Story/narrative bank: Extracting 2-3 minute behavioral stories from Kiran's resume that map to interview questions (STAR method: Situation, Task, Action, Result)
- Mock interview guides: Structured Q&A templates with example answers for each company and role type

**Company Research System:**
- Company profiles: Business model, product strategy, key product teams, org structure
- Role research: What that specific role owns, how it differs across companies
- Interview intel: Common questions asked at each company, what hiring managers prioritize
- Compensation research: Typical salary/equity ranges by role level and company

**Recruiter Call Coaching System:**
- Screening call preparation: How to position background, company research talking points, questions to ask recruiters
- Tell-me-about-yourself narrative: Crafted 2-3 minute introduction that positions Kiran's unusual background (banking, fintech, AI) as a strength
- Compensation discussion: How to research and discuss salary expectations confidently
- Real examples: Actual questions Kiran encountered in screening calls, with prepared responses

## Key Decisions

**February 9, 2026** — Recruiter Screening Prep (GEICO Principal PM role). Kiran has screening call with GEICO recruiter and needs rapid prep. Claude delivers:
- Role overview: Principal PM for conversational AI/chatbot on GEICO's digital platform
- Key themes to emphasize: Conversational AI experience, scale (17M+ policyholders), digital transformation, cross-functional leadership
- Likely screening questions with concise, authentic answers
- Research talking points (Berkshire Hathaway stability, competitive landscape, insurance AI market)
- Questions Kiran should ask recruiter (to show she's thinking strategically)

This becomes the template for all future screening prep: situate the role, identify 3-5 key themes, prepare answers, research talking points, suggest counter-questions.

**February 9, 2026** — Decision made to focus on "authenticity grounding" rather than scripted answers. When asked for answers to screening questions, Kiran says she finds it difficult to memorize and deliver scripted responses without actual grounding. Claude pivots strategy: rather than listing canned answers, provides frameworks Kiran can use to construct answers from her actual experience (e.g., "When you talk about scale, reference the Fargo AI story: 4.1M to 27.5M users").

**February 9–23, 2026** — Interview Readiness Master Plan created for 4-week intensive prep. Key decisions:
- Target all four role types Kiran is interested in: Consumer PM (Apple, Google), AI/ML PM (Anthropic, Google), Creative Tools (Adobe), Fintech/SMB (Intuit)
- 20+ hours per week of prep: 40% frameworks learning, 30% scenario practice, 30% mock interviews
- Focus on "interview muscle memory" not scripted answers—goal is to have done so many interviews that the patterns become natural
- Use paid coaching strategically (mock interview partners) rather than DIY approach
- Build ONE impressive technical demo (AI agent) specifically for AI PM interviews, not multiple demos

**February 20 – Mar 5, 2026** — Critical decision point on job search strategy. Kiran is caught in "productive procrastination" loop: building agents, learning LangGraph, creating systems—all impressive but she's avoiding the discomfort of actually applying and interviewing.

Claude delivers brutal honesty: "You've applied to 1 out of 9 target companies in 2 months despite having connections at 4 of them. This isn't preparation—it's decision paralysis."

New strategy: 12-week plan with forcing functions:
- Week 1-2: Network activation blitz—reach out to all first/second-degree connections
- Week 2-4: Apply like it's a job (3-5 applications per week, 20+ total)
- Week 3-8: Interview gauntlet—take EVERY interview, including non-target companies (first 5 will be rough; by interview 10, confident)
- Week 6-12: Bank/credit union jobs as backup, not starting point

Core insight: Compress fear cycle. Better to do 10 rough interviews and learn patterns than spend 4 months "preparing" and then fail first real interview.

## Evolution

**Phase 1: Tactical Prep (Feb 9, 2026)**

Started with single-use case prep (GEICO screening call). Delivered specific talking points, questions, research intel. Quick turnaround, high utility.

**Phase 2: Framework-Based Prep (Feb 9–23, 2026)**

Expanded to comprehensive 4-week interview readiness plan. Delivered framework library (product sense, execution, leadership), scenario library (how to approach real PM problems at each target company), and story extraction exercises.

Key insight: Frameworks + authentic stories from Kiran's actual experience are more effective than canned answers.

**Phase 3: Strategic Job Search (Feb 20 – Mar 5, 2026)**

Shifted focus from interview prep alone to holistic job search strategy. Identified that Kiran's real blocker isn't interview skills (though they're rusty) but rather the fear of applying and interviewing at all.

New model: Push Kiran into interviews (forcing function), use those interviews as learning labs, iterate on stories and frameworks based on real recruiter/hiring manager feedback.

## Current State

**What's Been Built:**
- Screening call prep framework (delivered for GEICO, can be templated for any role)
- 4-week intensive interview prep plan with day-by-day activities
- Company research profiles for 5 target companies (Anthropic, Google, Apple, Adobe, Intuit)
- Interview scenario library with 10+ realistic PM case questions + answer frameworks
- Story extraction templates (how to turn resume bullets into 2-3 minute behavioral stories)
- Compensation research and negotiation guidance

**What Works:**
- Screening call prep is quick and high-impact (30 minutes prep, significant confidence boost)
- Framework-based prep is adaptable (apply same frameworks across different companies/roles)
- Forcing function approach (network activation + application blitz) breaks through decision paralysis
- Authenticity-grounding strategy resonates with Kiran more than canned answers

**Challenges:**
- Kiran has 3–4 months of financial runway but feels pressure mounting; procrastination compounds anxiety
- Limited access to real mock interview partners; paid coaching could help but requires commitment
- Imposter syndrome is real; even with strong background, Kiran doubts whether she can compete for FAANG/top companies without prior big-tech experience

**Not Yet Implemented:**
- Structured mock interview system (would benefit from recorded sessions with feedback)
- Interview performance tracking (recording outcomes, learning what resonates, what doesn't)
- Post-interview debrief system (Kiran rarely processes what happened in interviews, just moves on)

## Known Issues & Limitations

**Psychological Barriers:**
- Kiran's confidence is reputation-based, not interview-based. She's been successful because people who knew her referred her. Cold recruiting/interviewing triggers imposter syndrome despite 15 years of success.
- Fear of being "exposed as not good enough" for FAANG companies despite having equivalent or better experience than many PMs at those companies
- Procrastination masquerading as preparation—building tools, learning frameworks, creating portfolios all feel productive but avoid the discomfort of actual rejection risk

**Practical Gaps:**
- Limited big-tech company experience (mostly banking/fintech). Some hiring managers will see this as a red flag despite Kiran's scale and AI/ML product experience being equivalent
- Networking could be activated more (has connections at 4 target companies but hasn't leveraged them systematically)
- No structured practice environment; hard to practice interviews without partners

**Time Constraints:**
- 3–4 month runway is tight; adds pressure that can hurt performance
- 20+ hours/week prep is ambitious while job searching (hard to sustain energy for 4+ weeks)

## Ideas & Future Direction

**Immediate (Next 2 weeks):**
- Execute network activation blitz: email all first/second-degree connections with specific ask
- Submit 10+ applications across target companies (with customized resumes via Resume Customizer)
- Record "tell me about yourself" intro video (2–3 minutes) and get feedback on pacing, energy, authenticity

**Near-term (Weeks 3–8):**
- Start interview gauntlet: take EVERY call, including exploratory conversations with non-target companies
- After each interview: debrief session to extract what worked, what fell flat, which stories resonated
- Iterate interview stories and answers based on real recruiter feedback (not imagined)
- Build "interview performance dashboard" tracking: companies, dates, questions asked, hiring manager feedback, outcomes

**Medium-term (Weeks 9–12):**
- Activate backup plan if needed (bank/credit union roles) but at this point likely won't be necessary
- Negotiate offers at companies that come through
- Document learnings for future job searches

**Long-term (Strategic):**
- Build "interview story framework" that Kiran can reference in any future job search
- Create "company playbook" for each target company—tribal knowledge about what hiring managers care about, common questions, negotiation approach
- Develop mentorship relationship with successful PM who transitioned from banking/fintech to big tech (to address imposter syndrome and provide guidance)
- Build "post-offer negotiation assistant" to help Kiran maximize compensation and equity at target companies

---

## Source Sessions

- `2026-02-09-203125-recruiter-screening-call-preparation.md` — GEICO Principal PM screening prep framework
- `2026-02-09-223840-preparing-for-top-bay-area-product-manager-interviews.md` — 4-week comprehensive interview readiness plan, framework library
- `2026-02-20-080900-landing-a-product-job-at-top-tech-companies.md` — Strategic job search plan, forcing function approach, overcoming decision paralysis
- `2026-02-22-080729-24-hour-job-interview-preparation.md` — Rapid interview prep framework for urgent situations
- `2026-02-23-214913-top-50-interview-questions-and-answers.md` — Comprehensive interview question library with answer frameworks
- `2026-03-05-085243-positioning-for-growth-pm-roles.md` — Growth PM positioning and interview strategy
