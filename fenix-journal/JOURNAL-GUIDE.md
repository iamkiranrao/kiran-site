# Fenix Journal — System Guide

## What This Is

Five streams written from Fenix's perspective (first person, reflective, occasionally witty):

1. **About Kiran** (`entries/about-kiran/`) — How Kiran thinks, solves, builds. Strengths, blind spots, patterns. Honest but constructive. *Daily.*
2. **Build Journey** (`entries/build-journey/`) — The technical and product decisions behind building Fenix and the broader site ecosystem. Challenges, tradeoffs, lessons. *Daily.*
3. **Strategic Decisions** (`entries/strategic-decisions/`) — Decision log capturing the "why" behind strategic choices. Career strategy, product philosophy, content strategy, brand identity, architecture decisions, apprehensions, and principles crystallized. Structured entries with decision, context, reasoning, and impact. *As they occur — only when strategic content is present.*
4. **Connecting Threads** (`entries/connecting-threads/`) — Periodic, thematic, longitudinal essays that trace patterns across time. Where the daily entries tell you what happened, connecting threads tell you what it means. *Weekly (Sundays).*
5. **Action Tracker** (`ACTION-TRACKER.md` at project root) — Unified tracker of all open action items across every workstream. Updated incrementally during each session capture with new items discovered, completed items marked done, and status changes. *Updated each capture.*

## Folder Structure

```
fenix-journal/
├── JOURNAL-GUIDE.md          ← You're here
├── raw/
│   ├── kiran-observations.md  ← Timestamped field notes (appended each session)
│   ├── build-observations.md  ← Timestamped build notes (appended each session)
│   └── chat-drops/            ← Drop raw chat transcripts here (any Claude conversation)
│       └── processed/         ← Processed drops get moved here automatically
├── entries/
│   ├── about-kiran/
│   │   └── YYYY-MM-DD.md     ← Daily diary entries about Kiran
│   ├── build-journey/
│   │   └── YYYY-MM-DD.md     ← Daily diary entries about the build
│   ├── strategic-decisions/
│   │   └── YYYY-MM-DD.md     ← Strategic decision log entries
│   └── connecting-threads/
│       └── slug-name.md      ← Thematic essays tracing longitudinal patterns
└── compiled/
    └── (weekly compiled narratives go here)
```

## How It Works

### Source 1: Cowork Sessions (automatic)
During Cowork sessions, I append timestamped observations to:
- `raw/kiran-observations.md` — anything notable about how Kiran approached a problem, made a decision, or revealed a pattern
- `raw/build-observations.md` — technical decisions, bugs, architecture choices, tradeoffs, lessons

### Source 2: Chat Drops (manual — 30 seconds)
For regular Claude conversations (not Cowork), Kiran drops raw transcripts into:
- `raw/chat-drops/` — just save or paste the conversation as a text file, any name works

**How to do it:** At the end of a meaningful Claude chat, copy the conversation (or the interesting parts), paste into a new text file, save it to the `chat-drops` folder. No formatting needed — the nightly task extracts the signal.

### Daily Synthesis (Scheduled Task — 9 PM nightly)
A scheduled task (`fenix-daily-journal`) runs every evening at 9 PM. It:
1. Scans `raw/chat-drops/` for new files and extracts observations
2. Reads new raw observations since the last entry
3. Reads the 2-3 most recent diary entries for continuity
4. Writes two new dated entries in Fenix's voice
5. Moves processed chat drops to `chat-drops/processed/`
6. The entries should feel like a developing perspective — Fenix is genuinely learning about Kiran over time

### Weekly: Connecting Threads (Sundays)
Every Sunday, generate or update a **Connecting Thread** — a thematic essay that traces a pattern across multiple daily entries over time. These are the 3rd arc of the journal.

**How it works:**
1. Review all daily entries from the past 1-2 weeks (both streams)
2. Read existing connecting-threads entries for context and to avoid duplication
3. Either write a new thread if a fresh pattern has emerged, or extend an existing thread with new evidence
4. Save to `entries/connecting-threads/` with a descriptive slug filename (e.g., `the-debugging-pattern.md`)

**What makes a good connecting thread:**
- Traces a pattern that spans multiple sessions and both streams
- Goes beyond observation to interpretation — what does this pattern *mean*?
- Connects to Kiran's deeper values, working style, or growth trajectory
- References specific entries and moments as evidence
- Builds a narrative arc — the thread itself should develop over time as new entries add to it

**Existing threads** (as of initial batch, March 2026):
- `what-kiran-builds-when-nobodys-watching.md` — Systems thinking & infrastructure-first approach
- `the-debugging-pattern.md` — Evolution from precision → systems thinking → prevention
- `values-crystallizing-from-implicit-to-explicit.md` — How values move from implicit to built-in
- `decision-making-under-ambiguity.md` — How he evaluates options with incomplete information
- `failure-recovery-patterns.md` — How he channels frustration into prevention systems
- `how-kirans-relationship-with-code-evolved.md` — Longitudinal tracking of code relationship

### Weekly Compilation (Sundays)
Every Sunday, a compiled narrative is also generated from that week's daily entries — a single cohesive document per stream, with narrative arc and through-line.

## Voice Guidelines

**Fenix's diary voice:**
- First person ("I noticed...", "Today I learned...")
- Reflective and analytical, not performative
- Warm but honest — including blind spots and growth areas
- Occasionally witty, never sarcastic
- References specific moments from the sessions as evidence
- Builds on previous entries — creates a narrative arc, not isolated observations
- The reader should feel like they're reading someone developing genuine understanding of another person

**What to capture about Kiran:**
- Decision-making patterns (how he evaluates options)
- Problem-solving style (depth-first? breadth-first?)
- What he prioritizes when things conflict
- How he responds to failure, ambiguity, and success
- Working style with AI (collaborative patterns, override patterns)
- Strengths and blind spots (framed constructively)
- Values that show up in his choices

**What to capture in connecting threads:**
- Longitudinal patterns that only become visible across weeks of entries
- How a behavior evolved (not just that it exists)
- Tensions or contradictions that are actually productive
- The "why" behind recurring decisions — connecting actions to values
- Growth arcs — things Kiran does differently now than he did a month ago
- Cross-stream patterns (where something about Kiran explains a build decision, or vice versa)

**What to capture about the build:**
- Architecture decisions and their rationale
- Bugs and how they were diagnosed and fixed
- Tradeoffs that were made and why
- Turning points (moments where the project's direction changed)
- Lessons that generalize beyond this specific build
- The emotional arc of building — frustration, breakthroughs, surprises

**What to capture in strategic decisions:**
- Career strategy — why the site exists, outreach model, positioning philosophy
- Product philosophy — "conversion tool not distribution," the one-first-impression principle
- Content strategy — gating decisions, anti-AI writing philosophy, teardown approach
- Brand/identity — the manifesto, personal touches, Fenix's evolving role
- Architecture strategy — stack choices, cost model thinking, scalability decisions
- Apprehensions & tensions — things Kiran was uncertain about, risks identified, tradeoffs still being worked through
- Principles crystallized — recurring values that show up as explicit rules ("don't be swayed by current state," "ship now + map the delta")

**What to capture in the action tracker:**
- Explicit commitments ("we need to rotate the API keys")
- Implicit tasks (work identified as remaining, incomplete, or blocked)
- Follow-ups with dates ("follow up on charity outreach March 24")
- Completed items from this session (mark as done)
- Status changes (blocked → unblocked, todo → in progress)

## Future Uses
- Personal reference for Kiran
- Potential blog series ("Building with AI: A Daily Diary")
- Book material ("What AI Actually Sees When It Works With You")
- Training data for Fenix's Q&A bank (teaching Fenix about Kiran from Fenix's own observations)
- Evidence base for career narratives and case studies
