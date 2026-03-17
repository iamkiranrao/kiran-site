# Fenix Journal — System Guide

## What This Is

Two parallel diary streams written from Fenix's perspective (first person, reflective, occasionally witty):

1. **About Kiran** (`entries/about-kiran/`) — How Kiran thinks, solves, builds. Strengths, blind spots, patterns. Honest but constructive.
2. **Build Journey** (`entries/build-journey/`) — The technical and product decisions behind building Fenix and the broader site ecosystem. Challenges, tradeoffs, lessons.

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
│   └── build-journey/
│       └── YYYY-MM-DD.md     ← Daily diary entries about the build
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

### Weekly Compilation (Sundays)
Every Sunday, a compiled narrative is generated from that week's entries — a single cohesive document per stream, with narrative arc and through-line.

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

**What to capture about the build:**
- Architecture decisions and their rationale
- Bugs and how they were diagnosed and fixed
- Tradeoffs that were made and why
- Turning points (moments where the project's direction changed)
- Lessons that generalize beyond this specific build
- The emotional arc of building — frustration, breakthroughs, surprises

## Future Uses
- Personal reference for Kiran
- Potential blog series ("Building with AI: A Daily Diary")
- Book material ("What AI Actually Sees When It Works With You")
- Training data for Fenix's Q&A bank (teaching Fenix about Kiran from Fenix's own observations)
- Evidence base for career narratives and case studies
