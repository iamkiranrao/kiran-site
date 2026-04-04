# UNLOCK-STRATEGY.md
## How Personas Become Persons

**Created:** April 3, 2026
**Status:** Foundation established. Per-persona deep dives in progress.
**Purpose:** The conversion architecture for kirangorapalli.com. Defines how the persona unlock system, Fenix introduction, and Connect module work together to transform anonymous visitors into identified connections. Read alongside SITE-WHY.md, ULTIMATE-PERSONA.md, and GO-TO-MARKET.md.

---

## THE SHORT VERSION

When a visitor picks a persona, they see a two-column component. Left column: what's unlocked for them — a mix of anonymous features (use freely) and connected features (identity required). Right column: Fenix, introduced for the first time, acting as concierge. Fenix explains each unlock, guides the visitor to the right one, and when they choose a connected feature, walks them through the Connect flow inline. The visitor never leaves the conversation to convert.

---

## THE NORTHSTAR

**How many personas become persons.**

Not clicks on Connect. Not time on page. Not feature usage. The singular metric: how many anonymous visitors reveal their identity through the Connect flow.

This is a relationship metric, not a button metric. It measures trust — did someone feel confident enough in the value exchange to tell Fenix who they are? Every design decision in this system should be evaluated against this question.

---

## LOCKED PRINCIPLES

These were established in the April 3 strategy session. They're non-negotiable — if a per-persona design conflicts with any of these, the design changes, not the principle.

### 1. The gate must be functional, not artificial.

If someone asks "why do I need to connect for this?" the answer must be "because the feature needs your context to be useful" — not "because I want your email." Connected unlocks are features that genuinely work better with identity: a Fit Score needs a specific job description, "Bring Your Problem" needs company context, a pairing session needs to know who's pairing. The gate is never a paywall. It's a capability requirement.

### 2. Anonymous unlocks must be genuinely generous.

The visitor should walk away thinking "that was worth my time" even if they never connect. No teasers. No deliberately incomplete previews designed to frustrate. The anonymous tier delivers real value that matches the visitor's immediate job-to-be-done. The pull toward connecting comes from wanting more of this quality, not from feeling tricked.

### 3. Every persona gets personality alongside utility.

Each persona's anonymous tier includes at least one "personality feature" — something unexpected, delightful, and human that makes Kiran feel like a real person, not a portfolio. The personality features create emotional residue. They're the thing that makes someone think "I want to know more about this person" rather than "I got what I came for." Utility creates credibility. Personality creates connection. Both are required.

### 4. The system has taste, not uniform rules.

Not every persona needs the same number of unlocks, the same balance of anonymous vs. connected, or any connected unlocks at all. Inner Circle has zero connected features — they already know Kiran. The asymmetry IS the design. Cookie-cutter uniformity would undermine the personalization thesis.

### 5. Fenix is a concierge, not a chatbot.

Fenix's introduction in the unlock module is purposeful. It has specific pills that map to unlock options, persona-aware framing, and a conversational flow that naturally leads toward Connect when appropriate. A general "ask me anything" chatbot is a toy. A concierge with defined capabilities, awareness of who it's talking to, and a path toward deeper engagement is a product feature.

### 6. The relational principle holds.

From SITE-WHY.md: the site is optimized for relational connection, not transactional conversion. The unlock system must feel like an invitation, not a funnel. The visitor should feel recognized and served, not herded and captured. If any piece of this system makes the site feel like a lead-gen machine, it's wrong.

---

## THE THREE MODULES

The unlock experience is one visual component with three functional modules that work in sequence.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  MODULE 1: PERSONA UNLOCK          MODULE 2: FENIX              │
│  (Left Column)                     (Right Column)               │
│                                                                 │
│  "As The [Persona],                "Meet Fenix"                 │
│   here's what's unlocked:"        [Persona-aware intro]         │
│                                                                 │
│  ┌─ Explore Freely ──────┐        [Fenix logo/avatar]           │
│  │ • Unlock A (utility)  │                                      │
│  │ • Unlock B (personal) │        [Persona-relevant pitch]      │
│  └───────────────────────┘                                      │
│                                    ┌──────────────────────┐     │
│  ┌─ Connect to Unlock ───┐        │ Pill: Unlock A       │     │
│  │ 🔒 Unlock C           │        │ Pill: Unlock B       │     │
│  │    (why it needs you)  │        │ 🔒 Pill: Unlock C   │     │
│  └───────────────────────┘        │ Pill: Open question  │     │
│                                    └──────────────────────┘     │
│                                                                 │
│                    MODULE 3: CONNECT                             │
│                    (Embedded in Fenix flow)                      │
│                                                                 │
│                    Triggered when visitor picks                  │
│                    a connected unlock pill.                      │
│                    Fenix explains → presents                     │
│                    dual path → visitor chooses                   │
│                    → identity captured → unlock                  │
│                    activated inline.                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Module 1: Persona Unlock (Left Column)

**Visual Format: Card-Based (Locked — April 3, 2026)**

Each unlock is a distinct card, not a list item. Cards are the site's existing visual language (bento grid, glass morphism) brought into the unlock component. Vertical stack: 2 anonymous cards on top, 1 connected card at bottom.

**Card anatomy:**
- Icon or visual indicator (specific to the unlock, not generic)
- Title (short, punchy — action-oriented)
- One-line hook (the "why you'd want this" — not a feature description)
- State indicator: open vs. connected
- Hover reveal: card lifts, shows CTA (anonymous) or functional gate explanation (connected)

**Open card treatment:** Full opacity, accent-colored border (persona color), clear CTA on hover ("View" / "Explore").

**Connected card treatment:** 70-80% opacity (NOT grayed out — still readable, still enticing). Subtle lock icon in accent color (corner placement, not a banner). Hook changes tone: invitation language ("Connect to see how we'd evaluate each other") not restriction language ("Locked — sign in to access"). Hover reveals Fenix's one-line explanation: "This one works better when I know who I'm talking to."

**Sequencing principle:** Anonymous cards first, connected card last. Visitor gets two wins before encountering the gate. By the time they reach the connected card, they've experienced the quality and the gate feels like escalation, not a barrier.

**Design constraint:** The cards must feel like a curated menu of gifts, not a pricing page. No "free tier vs. premium tier" language. No comparison tables. The framing is "here's what you can do right now" and "here's what opens up when I know who you are."

**Dual entry points:** Clicking a card on the left OR clicking the corresponding Fenix chip on the right triggers the same experience. Two paths, one journey.

### Module 2: Fenix Introduction (Right Column)

**What the visitor sees:** Fenix, introduced for the first time. This is Fenix's debut — the visitor has never seen it before (the FAB and subpage banner were removed from the site). The introduction must earn attention without assuming familiarity.

**Components:**
1. **Fenix identity** — Logo/avatar, name, one-line positioning statement that's persona-specific
2. **The pitch** — 2-3 sentences explaining what Fenix can do, framed for this persona's needs
3. **Pills** — Pre-defined conversation starters that map 1:1 to the unlock options on the left, plus one open-ended exploration pill

**Persona-specific behavior:**
- Fenix's intro copy, tone, and pill text all change per persona
- The connected unlock pill has a visual indicator matching the left column
- The open-ended pill ("Tell me about Kiran" / "What makes you different" / etc.) is always present as an escape hatch for visitors who don't fit the prescribed paths

### Module 3: Connect (Embedded Conversion)

**Not a separate section.** The Connect flow lives inside Fenix's conversation. When a visitor clicks a connected unlock pill:

1. Fenix explains the feature in more detail — what they'll get, why it's valuable
2. Fenix explains why identity is needed — framed as "this works better when I know who you are," not "pay to unlock"
3. Fenix presents two paths:
   - **LinkedIn sign-in** — "Connect with LinkedIn for instant access" (OAuth popup, one click, returns to site with unlock active)
   - **Introduce yourself** — "Or just tell me who you are" (simple form: name + company, optionally LinkedIn URL)
4. Visitor chooses → identity captured → localStorage flag set → backend notified → Fenix shifts tone: "Welcome, [Name]. Let's do this."
5. The connected feature activates inline — no page reload, no redirect

**Why dual paths:** Different visitors have different comfort levels. A recruiter who lives on LinkedIn will prefer OAuth. A founder who's skeptical of corporate platforms might prefer typing their name. Offering both means the Connect moment adapts to the visitor, not the site.

---

## THE CONNECT MECHANISM — TECHNICAL DESIGN

### Identity Capture

Both paths feed into the same backend pipeline:

**LinkedIn OAuth:**
- Visitor clicks "Connect with LinkedIn" → OAuth popup → authorize → callback
- Backend receives: name, headline, profile URL, email (if granted)
- localStorage: `connected=true`, `connect_method=linkedin`, `connect_name=[name]`
- Backend POST to CC API: persona type, identity data, timestamp, which unlock triggered it

**Introduce Yourself:**
- Visitor fills simple form: name (required), company (required), LinkedIn URL (optional)
- No CAPTCHA — the persona selection itself is a mild bot filter (bots don't pick personas)
- localStorage: `connected=true`, `connect_method=form`, `connect_name=[name]`
- Backend POST to CC API: same payload structure as OAuth

### Backend Notification

When a persona becomes a person, the Command Center receives:

```json
{
  "event": "persona_converted",
  "persona": "evaluator",
  "method": "linkedin|form",
  "identity": {
    "name": "Sarah Chen",
    "company": "Anthropic",
    "title": "Senior Recruiter",
    "linkedin_url": "linkedin.com/in/sarahchen",
    "email": "sarah@anthropic.com"
  },
  "trigger_unlock": "fit-score",
  "timestamp": "2026-04-15T10:30:00Z",
  "session_data": {
    "pages_visited": 3,
    "time_on_site": "4:32",
    "persona_selected_at": "2026-04-15T10:25:00Z"
  }
}
```

This becomes a new CC dashboard view: **Conversions** — showing who connected, when, from which persona, triggered by which feature.

### Post-Connect Experience

After connecting, the visitor's experience changes:
- Fenix addresses them by name
- Connected unlock pills become active (lock icons removed)
- If they return to the site later (localStorage persists), they're greeted as a known person, not an anonymous persona
- Fenix remembers their persona AND their identity — "Welcome back, Sarah. Still looking for that PM role?"

### Persona-to-Person Transition (Locked — April 3, 2026)

The connect moment is the northstar event. When a visitor shares their identity, every reference to the persona label is replaced with their actual name — universally, everywhere, immediately.

**The moment itself (visual + conversational):**
- The persona label (e.g., "Evaluator") visually animates/dissolves into the person's actual name wherever it appears — section headers, card labels, Fenix's conversational context
- Fenix delivers one line that acknowledges the shift without making a speech:
  *"Much better. This site was built for exactly this — real people, not personas. Nice to actually meet you, Sarah."*
- Two lines max. The animation does the heavy lifting. Relational, not transactional.

**What NOT to do:**
- No counter ("You're person #47") — gamifies a relational moment
- No "thank you for converting" energy — this isn't a signup confirmation
- No metrics language — the visitor doesn't need to know about northstar metrics
- No speech — Fenix stays sharp and warm, not grateful or performative

**Implementation:** Name stored in session state on connect. Any component rendering a persona label checks for name override first. Persona label becomes the anonymous-state fallback only. Persists via localStorage for return visits.

**Design principle:** Relational over transactional, always.

---

## PER-PERSONA DESIGN STATUS

Each persona gets a dedicated deep dive to design the full journey. The deep dives are conducted one at a time, in focused sessions.

### Deep Dive Template

For each persona, we design:

1. **Anonymous Unlock: Utility** — The feature that matches their immediate job-to-be-done. Delivers real, complete value with no strings.
2. **Anonymous Unlock: Personality** — The unexpected, human feature that creates emotional residue. Makes Kiran feel like a person, not a portfolio.
3. **Connected Unlock** — The premium feature that genuinely requires identity context. The functional gate is real, not artificial.
4. **Fenix Introduction** — The persona-specific intro copy, tone, and pitch. How Fenix earns attention and trust with this specific visitor.
5. **Fenix Pills** — The pre-defined conversation starters. Map to unlocks + one open-ended exploration option.
6. **Connect Moment** — How Fenix frames the identity request for this persona. The specific language, the value proposition, the emotional register.
7. **Post-Connect Flow** — What happens after they identify. How Fenix shifts. What the connected feature actually delivers.
8. **Edge Cases** — What if they click a connected pill but don't convert? What if they come back later? What if they switch personas?

### Status Tracker

| Persona | Character | Deep Dive Status | Session |
|---------|-----------|-----------------|---------|
| **Evaluator** | Merritt Hunter | 🟢 IN PROGRESS | Apr 3 |
| **Seeker** | Phil Thevoid | ⬜ Not started | — |
| **Practitioner** | Drew Skematics | ⬜ Not started | — |
| **Learner** | Paige Turner | ⬜ Not started | — |
| **Technologist** | Ray Turing | ⬜ Not started | — |
| **Inner Circle** | Keshav Shivdasani | ⬜ Not started | — |

### Order Rationale

**Evaluator first** because: (a) recruiters and hiring managers are the highest-stakes visitors for Kiran's career goals, (b) the Fit Score is the most technically complex connected unlock and sets the pattern for others, (c) getting the hardest persona right first makes the remaining five easier.

---

## CONSTRAINT FRAMEWORK (Proposed — April 3, 2026)

**Not yet locked.** Proposed during Evaluator deep dive. Needs confirmation after testing against 1-2 more persona deep dives.

### Maximum 3 unlocks per persona
- 2 anonymous (1 utility + 1 personality) + 1 connected
- 6 personas × 3 = 18 total features. Manageable for design, build, and maintenance.
- Inner Circle exception: no connected unlocks (they already know Kiran), so 3 can all be anonymous.

### 3-Part Prioritization Test
Every feature that wants to survive must pass all three:
1. **Job-to-be-done fit** — Does it match the persona's primary reason for visiting?
2. **Differentiation** — Is it something they wouldn't find on any other portfolio site?
3. **Kiran-authenticity** — Could only Kiran deliver this? (Not a generic tool or template.)

Features that pass all three stay. Features that fail any one get redesigned or cut.

---

## PER-PERSONA DESIGNS

The Evaluator section below contains LOCKED designs from deep dive sessions. The remaining personas contain WORKING HYPOTHESES — preliminary ideas that will be validated or replaced during their deep dives.

### Evaluator (Merritt) — Recruiter / Hiring Manager — 🟢 DEEP DIVE IN PROGRESS

**Anonymous Unlock #1 (Utility): Resume Lens Download**
- Not a single resume — a lens system. Same career, different focal points.
- Three lenses (validated against market data + Kiran's career goals):
  - **AI Product Leader** — Foregrounds Fargo AI (4.1M→27.5M), Avatour AI agents, Fenix build. Targets: Anthropic, OpenAI, Google, Apple AI.
  - **Growth & Experimentation** — Foregrounds mobile 18M→32M, A/B testing, adoption metrics. Targets: Uber, Airbnb, Meta, Intuit.
  - **Mobile & Consumer Product** — Foregrounds mobile-first at scale, consumer UX, cross-industry. Targets: Netflix, Disney, consulting, all of the above. Chosen over Enterprise & Platform to break from banking anchor.
- No generic fallback. Three lenses, no catch-all. A generic option dilutes the concept.
- Traditional PDF format (ATS-compatible, forwardable to hiring managers).
- Plus: unconventional rendered page version including site work as portfolio evidence. Email-to-self option for this version.
- Trust framing: PDF says "I respect your process." Rendered page says "I can also show, not just tell."
- UX flow: Fenix says "Kiran's resume comes in three flavors — same experience, different emphasis. Which one fits your search?" → selector appears → preview + download (2b pattern) → option to view unconventional rendered version.
- Card hook: "My resume, focused for your role"
- Status: Direction LOCKED. Lens variants not yet created.

**Anonymous Unlock #2 (Personality): "What Recruiters Never Ask But Should"**
- The interview questions that would actually reveal fit, but recruiters rarely think to ask.
- Makes recruiters think "huh, I should be asking that."
- 12 candidate questions researched and logged to Fenix training bank. Kiran narrows to 5 and authors answers (homework doc: `docs/HOMEWORK-Recruiter-Questions.md`).
- Format: Hybrid (1c) — Fenix intro line ("These are the questions that actually tell you whether someone's the right fit — and my honest answers"), then scannable content panel with all 5 questions + Kiran's answers visible.
- Card hook: "The questions that actually reveal fit"
- Status: Format LOCKED. Questions researched. Awaiting Kiran's authored answers and top-5 selection.

**Connected Unlock: Dual Fit Score**
- Not just "does Kiran fit your role?" — also "does your role fit Kiran?" Mutual evaluation.
- Recruiter pastes JD → Fenix analyzes bidirectional match → both sides surfaced.
- Differentiator: flips the power dynamic. Signals the kind of hire Kiran is.
- Reverse scoring must be honest, not defensive. If poor fit, say so diplomatically.
- Pager service (direct notification to Kiran) is POST-CONNECT ESCALATION only — appears after Fit Score establishes mutual interest.
- Card hook: "Does this role fit both of us?"
- **Input:** Large text paste zone for JD + "Build my Fit Score" button.
- **Processing:** Narrated loading — Fenix describes what he's doing ("Reading the role requirements... Mapping against Kiran's experience... Evaluating mutual fit..."). Builds anticipation, feels considered not algorithmic. During Kiran→Role evaluation, Fenix narrates external research in real time ("Checking Glassdoor... pulling recent funding data... reading engineering blog posts..."). The research IS the performance.
- **Results layout: Unified (locked).** Each dimension shows both directions stacked: Kiran → Role score + explanation, then Role → Kiran score + explanation. Tension visible within each row, not across two panels.
- **"What would increase these scores" (locked):** Inline notes per dimension that scores below threshold ("specifying whether this role owns AI strategy vs. supports it would clarify fit"), PLUS summary section at bottom pulling together a ready-made checklist the recruiter can bring to the hiring manager.

- **Scoring Mechanics (Locked — April 3, 2026):**

  **Asymmetric dimensions — each side has its own 5:**

  Role → Kiran (powered by JD text, scored against Kiran's background):
  1. **Experience & Level Fit** — years, seniority match, scope of past roles
  2. **Domain & Industry Fit** — does Kiran's background map to what they need?
  3. **Technical Depth** — does the role's technical bar match Kiran's capabilities?
  4. **Core Competencies Match** — roadmap ownership, stakeholder management, data-driven execution, user research
  5. **Product Stage Fit** — 0→1 vs. growth vs. scale, B2B vs. B2C, team size, complexity

  Kiran → Role (powered by external enrichment — Glassdoor, Crunchbase, news, engineering blogs — researched by Fenix in real time):
  1. **Culture & Values** — employee sentiment, ethical reputation, Glassdoor ratings, how the company treats people, DEI signals, crisis handling
  2. **Growth Trajectory** — does this role build toward where Kiran's going? (consumer, mobile, AI — not back into banking)
  3. **Product Vision** — is the company building something genuinely interesting? Innovation signal vs. maintenance mode
  4. **Team & Engineering Quality** — engineering blog presence, tech reputation, design maturity signals
  5. **Company Stage & Momentum** — funding, growth rate, market position, trajectory up or plateau

  Compensation deliberately excluded from dimensions — it's a negotiation, not a fit signal.

  **Rating scale:** Percentage (0-100%) with qualitative bands:
  - **Strong** (85-100%) — clear alignment
  - **Solid** (65-84%) — good fit with minor gaps
  - **Partial** (45-64%) — some alignment, notable gaps
  - **Stretch** (below 45%) — significant reach on this dimension
  Each dimension includes a one-line reasoning ("Domain Fit: 85% — JD requires fintech experience; Kiran has 8 years across banking and payments"). No formula shown — reasoning-based transparency, not math-based.

  **Composite scores:** Two composites, one per direction, equal-weighted across 5 dimensions. Displayed side by side. The dual number IS the product insight — fit goes both ways and they might not match.

  **Vague JD handling:** Fenix requires confident signal on at least 3 of 5 Role→Kiran dimensions. If fewer than 3 are scorable, Fenix declines and diagnoses: tells the recruiter exactly what's missing ("I'd need at least the seniority level, a specific domain or product type, and what success looks like in the first year"). Helpful in the decline — becomes a JD quality coach.

  **Input layers:**
  - Layer 1: JD (always required, baseline) — powers Role→Kiran side
  - Layer 2: Company identity (Fenix researches autonomously) — powers Kiran→Role side
  - Layer 3: Conversation context (supplementary signal from recruiter interaction)

  **Preferred Company Bonus (Locked — April 3, 2026):**
  If the company in the JD matches Kiran's preferred list, the Kiran→Role composite gets a flat boost. Fenix narrates it: *"Cross-referencing against Kiran's target companies... match found."* One flat list, no tiers — the dimensions do the differentiating, not the list hierarchy. Every preferred company gets equal treatment.

  **Kiran's Preferred Companies (25 + startups):**
  - AI-Native: Anthropic, OpenAI, Google, Apple, NVIDIA
  - Consumer & Marketplace: Airbnb, Uber, Netflix, Disney, Meta, Snap, Canva
  - Product-Led SaaS: Adobe, Intuit, ServiceNow, Asana, Figma, Shopify
  - Fintech (experience as asset): Stripe, Block, Ramp, Robinhood
  - Growth & Mobile: Spotify, DoorDash, Duolingo
  - Consulting: McKinsey, BCG, Deloitte, Bain
  - General: Microsoft
  - Startups: Open category, industry-standard comp required

  This list is a living document — companies can be added or removed as Kiran's strategy evolves. The tiering (dream vs. stepping stone) is private career strategy, not exposed in the Fit Score.

  Status: Scoring mechanics LOCKED.

**Fenix Opening Frame (Locked — April 4, 2026):**
- Appears before the introduction/pitch, first thing the visitor reads from Fenix. Sets the context that this site is different and worth their time. Per-persona (this version is Evaluator-specific).
- Text:
  *"Quick context before we start. This isn't a portfolio site. It's a product Kiran built.*
  *The resume comes in three versions, each tuned to a different kind of search. There's a Fit Score that evaluates both directions, whether Kiran fits the role and whether the role fits Kiran. And I'm not a template chatbot. I've been trained on Kiran's actual work, his decisions, and how he thinks.*
  *This site isn't designed for a 30-second skim. But every minute you spend here will surface insights you'd otherwise spend weeks piecing together. The more you experience, the more you understand about how Kiran thinks and works.*
  *I'm here to help you focus on what matters to you."*
- Design principles: matter-of-fact confidence, no sales language, challenges the visitor to slow down but makes clear the depth is in their interest. Last line is reassurance that Fenix makes the depth efficient.

**Fenix Introduction (Locked — April 3, 2026):**
- Heading: "Fenix, at your service"
- Positioning line: "I know Kiran's work better than his resume does."
- Pitch: "I can walk you through Kiran's experience, pull up the resume that fits your search, or if you're up for it, help you both figure out whether this is actually a match. The pills below are the fast paths. Or just ask me whatever's on your mind."
- Register: sharp colleague who respects your time. Professional warmth + confident informality. Not chatty, not corporate, not overselling.
**Fenix Pills:** Map 1:1 to cards plus tour: "Show me resume options" / "What should I be asking?" / "How would we evaluate each other?" (connected) / "Give me a quick tour" (navigates to Under the Hood page with Fenix providing persona-aware commentary on what matters to the visitor).

**Three-Layer Video Strategy (Locked — April 4, 2026):**
- Layer 1: **Hero video** (homepage, before persona picker). AI-generated avatar (not Kiran's face) delivering a 4-beat narrative: (1) desire to build free from platform constraints, (2) AI reawakening the joy of building and making execution possible, (3) site as beacon for connection with like-minded builders and problem-solvers, (4) CTA to connect or forward to someone in their tribe. Avatar choice is deliberate: thematic coherence (AI avatar on AI-built site), eliminates appearance bias in hiring contexts, easier to update. NOT on the persona picker page. Picker needs to be clean and fast.
- Layer 2: **Fenix opening frame** (text, per-persona, immediate). See above. No friction, no play button, lands instantly.
- Layer 3: **Optional persona video** (avatar, short, offered by Fenix as enrichment). Fenix offers: "Want to hear why Kiran built this? 90 seconds." A pill or subtle link, not autoplay. Visitor chooses depth.
- Privacy principle: Kiran's non-digital life is private. The avatar represents him publicly. This is a creative choice, not a workaround.
**Connect Moment (Locked — April 3, 2026):**
- Trigger: recruiter clicks connected card or "How would we evaluate each other?" pill.
- Fenix explains: "The Fit Score goes both ways — it evaluates how your role aligns with Kiran's experience, and how Kiran's priorities align with what you're offering. To make that work, I need a job description to analyze. And since this generates a personalized report, I'll need to know who I'm building it for. Two ways to do that:"
- Dual path presented as equals (side by side): LinkedIn OAuth ("Connect with LinkedIn" / "Instant access, one click") and Introduce Yourself form ("Introduce yourself" / "Name + company — that's it").
- After identity: "Welcome, [Name]. Got it. Now paste the job description you're evaluating Kiran for, and I'll build the Fit Score."
- Bail-out (no connect): "The other features are yours to explore without signing in. Want to check out the resume options instead?" — no "no pressure" preamble, the redirect IS the grace.
- Re-engagement: one gentle nudge after anonymous unlocks explored ("Whenever you're ready for the Fit Score, I'm here."), not a loop.
**Post-Connect Flow (Locked — April 3, 2026):**
- After Fit Score renders, Fenix adds a bridge line: "That's the picture from what I can see in the JD. If you want to explore any dimension deeper, just ask."
- Recruiter can ask follow-up questions — Fenix answers from training bank. Fit Score is a launchpad, not a terminal artifact.
- Save/share: "Download as PDF" (one-page report) and "Email me this" (sends to email from Connect). One click, no new friction.
- **Pager escalation (Option C — mutual threshold):** Both forward AND reverse scores must be above threshold. When triggered: "Looks like there's real alignment here. Want me to flag this for Kiran directly? He reviews these personally." When NOT triggered: Fenix simply doesn't mention it. Graceful absence, no rejection language.
- Pager mechanic: Pushover push notification to Kiran's phone via CC notification service. Recruiter name, company, role, mutual score summary. Recruiter sees: "Flagged. Kiran typically responds within 24 hours."
- **CC notification service:** Pushover integration built as generic service, not Fit Score-specific. Any CC event can trigger notifications with priority levels. Pager is first use case; future: persona conversions, testimonials, resume downloads, engagement thresholds.
**Edge Cases:** TBD.

**Also identified (parked for now):**
- "What's not on my resume" — design DNA story from college. Kiran writes this. May become a sub-element of one of the cards or a Fenix conversation piece.
- Interview anti-pattern game ("spot the dysfunction"). Concept liked, needs better name and Kiran-authored answers. May fold into personality unlock or become its own thing.

### Seeker (Phil) — Founder / Needs Product Leader
- Anonymous utility: Fractional engagement brief
- Anonymous: Founder case studies
- Connected: Bring Your Problem (Fenix walks through product framing)
- Personality feature: TBD

### Practitioner (Drew) — Product / Design / Data
- Anonymous utility: Frameworks & mental models
- Anonymous: Teardown vault preview
- Connected: Roast My Product (submit URL, get Kiran-style teardown)
- Personality feature: TBD

### Learner (Paige) — Aspiring PM / Career Grower
- Anonymous utility: PM starter kit
- Anonymous: Book a mentorship session (ADPList)
- Connected: Personal PM coaching mode (Fenix tracks their journey)
- Personality feature: TBD

### Technologist (Ray) — CTO / AI Lead / Tech Lead
- Anonymous utility: GitHub tour + Architecture decision records
- Anonymous: TBD
- Connected: Pair with me (Cal.com booking)
- Personality feature: TBD

### Inner Circle (Keshav) — Old Friend
- Anonymous: Flame On by default
- Anonymous: What I'm actually working on (now page)
- Anonymous: Direct line (WhatsApp)
- Connected: None — they already know Kiran
- Personality feature: The ENTIRE experience is personality

---

## RELATIONSHIP TO EXISTING DOCS

**This doc supersedes** the Track 2 ("Does") section of PERSONA-PLAYBOOK.md for strategic direction. The PLAYBOOK's Track 2 unlock list was designed before the anonymous/connected split was conceived. The specific unlocks listed there are working hypotheses that will be validated or replaced through deep dives.

**This doc does NOT supersede:**
- PERSONA-PLAYBOOK.md Track 1 ("Look") — visual touches are independent of the unlock strategy
- PERSONA-PICKER.md — the picker page itself is baked and unaffected
- SITE-WHY.md — the foundational principles. If anything in this doc conflicts with SITE-WHY, SITE-WHY wins.
- ULTIMATE-PERSONA.md — the unlock system serves all 6 personas, but the Ultimate Persona (pattern-breaker who hires pattern-breakers) remains the person the site ultimately exists to reach.

**This doc adds to:**
- GO-TO-MARKET.md — the Connect mechanism is a conversion event that GO-TO-MARKET should reference
- INDEX-HOMEPAGE.md — the two-column unlock component replaces the current Fenix intro section

---

## CONTINUATION PROMPT

Use this when starting a new session on unlock strategy work:

```
## Continue: Unlock Strategy Deep Dives — kirangorapalli.com

### Context
Read docs/UNLOCK-STRATEGY.md first. This is the master doc for the persona unlock system — how anonymous visitors convert to identified connections through a two-tier unlock architecture + Fenix concierge + embedded Connect flow.

### Foundation (Locked — April 3, 2026)
- Two-tier unlock: "Explore freely" (anonymous) + "Connect to unlock" (identity-gated)
- Gate principle: functional, not artificial. Identity makes the feature better.
- Anonymous tier: generous + personality feature. No teasers.
- Connect mechanism: dual path (LinkedIn OAuth + "introduce yourself" form)
- Fenix: concierge with persona-specific intro, pills mapping to unlocks, Connect flow embedded in conversation
- Northstar: how many personas become persons

### Locked Decisions (April 3, 2026)

**Container (affects all personas):**
- Visual format: Card-based left column (not list). Vertical stack: 2 open + 1 connected at bottom. Hover reveals. Locked card uses 70-80% opacity + subtle lock icon + invitation language.
- Fenix pills map 1:1 to cards + one open-ended. Dual entry points (card click or chip click).
- Connect flow: Fenix explains feature → dual path (LinkedIn OAuth / introduce yourself form as equals) → identity captured → unlock activates inline.
- Bail-out: silent redirect to anonymous unlocks ("The other features are yours to explore without signing in."). Re-engagement: one gentle nudge, not a loop.
- Constraint proposal (not yet locked): 3 per persona max, 3-part prioritization test.

**Evaluator-specific:**
- Fenix intro: "Fenix, at your service" + "I know Kiran's work better than his resume does." + pitch connecting to pills.
- Resume Lens: 3 lenses (AI Product Leader, Growth & Experimentation, Mobile & Consumer Product). No generic. Traditional PDF + unconventional rendered page. Preview + download (2b).
- "What Recruiters Never Ask": Hybrid format (Fenix intro + scannable content panel). 12 questions researched, Kiran selecting top 5 and authoring answers (homework doc: `docs/HOMEWORK-Recruiter-Questions.md`).
- Dual Fit Score: Unified layout (both directions per dimension row). Narrated processing. "What would increase these scores" — inline per dimension + summary checklist at bottom.
- Post-connect: Fenix bridge line → follow-up conversation from training bank → save/share (PDF + email). Pager: Option C mutual threshold via Pushover notification service.

### Evaluator Build Status (Updated April 4, 2026)

**BUILT AND IN PRODUCTION (commit c64bcb5):**
- Full Evaluator experience frontend (`evaluator-experience.js`, 1267+ lines) — opening frame, resume lens cards, recruiter question slots, connect flow, Fit Score panel with SSE streaming, results rendering, persona-to-person name transition
- Supplementary CSS (`evaluator-styles.css`, 395 lines) — composite scores, dimensions, gap summary, light theme, animations
- Fit Score backend router (`command-center/backend/routers/fit_score.py`, 505 lines) — 3 Claude API calls, 10-dimension scoring, preferred company bonus, SSE streaming
- Integration: persona-system.js hooks into EvaluatorExperience.init(), index.html has script/CSS refs, main.py registers router
- SSE field alignment between frontend and backend verified and fixed
- Prototype reference (`prototypes/evaluator-unlock-v1.html`) — superseded by real build

**DEPLOYMENT NOTE:** Frontend auto-deploys via Cloudflare Pages. Backend requires FastAPI server restart to register the new fit_score router. CORS_ORIGINS env var must include the production domain.

**BLOCKED / NEEDS KIRAN:**
1. **Recruiter questions content** — Kiran homework. Author answers for 12 questions, pick top 5. Homework doc: `docs/HOMEWORK-Recruiter-Questions.md`
2. **"What's not on my resume" story** — Kiran homework. Design DNA piece.
3. **Pushover notification service** — Blocked on Kiran's $5 purchase. Needed for pager threshold alerts.
4. **LinkedIn OAuth** — Blocked on Kiran registering a LinkedIn developer app.
5. **AI avatar tool selection** — For hero video. Recommended: HeyGen, Synthesia, or D-ID.
6. **Hero video script** — 4-beat narrative (hello, context, payoff, invitation) needs to become a real script.

**REMAINING BUILD WORK:**
1. **Fenix opening frames for 5 remaining personas** (Seeker, Practitioner, Learner, Technologist, Inner Circle)
2. **5 remaining persona deep dives** — Same depth as Evaluator
3. **CC notification service** — Generic notify_kiran() with Pushover (after purchase)
4. **Pager threshold tuning** — Decide percentage threshold once real scores exist
5. **Interview anti-pattern game** — Parked. Kiran names it, authors answers.
6. **Edge cases** — Return visitors, persona switching, incomplete connect flows
7. **Soft launch messaging** — How to introduce site to friendly recruiters

### Start by
Reading UNLOCK-STRATEGY.md (this doc). The Evaluator build is in production. Next major work: restart the CC backend to bring the Fit Score API online, test the full Evaluator flow end-to-end on the live site (select Evaluator persona → opening frame → cards → connect → paste JD → watch Fenix narrate → see results). Then either iterate on the Evaluator based on live testing, or begin the next persona deep dive.
```

---

*The unlock system's thesis in one line: Give generously, show personality, and when someone wants more — make it easy to say who they are, because knowing them makes the experience better for both of you.*
