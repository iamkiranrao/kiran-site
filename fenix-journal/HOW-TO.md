# Fenix Journal — Quick Reference

## What Is This?

Three diary streams written from Fenix's perspective:

1. **"What I'm Learning About Kiran"** — How you think, decide, solve. Strengths, blind spots, patterns. Candid but constructive. *Daily.*
2. **"The Build Journey"** — Technical and product decisions behind Fenix and the site ecosystem. Bugs, tradeoffs, breakthroughs, lessons. *Daily.*
3. **"Connecting Threads"** — Thematic essays tracing longitudinal patterns across time. Where the daily entries tell you what happened, these tell you what it means. *Weekly (Sundays).*

All written in first person as Fenix — reflective, warm, occasionally witty, building a narrative arc over time.

---

## Your Daily Workflow (< 1 minute)

### Cowork sessions → Automatic
Nothing to do. I append observations to the raw files during our sessions.

### Regular Claude chats → One quick step
After any meaningful Claude conversation:

1. **Copy** the conversation (or just the interesting parts)
2. **Save** as a text file in: `fenix-journal/raw/chat-drops/`
3. That's it. Name the file anything — `chat-march5.txt`, `fenix-debug.md`, `random-convo.txt` — doesn't matter.

**Shortcut on Mac:** In Claude app → select conversation text → Cmd+C → open TextEdit → Cmd+V → Save to the chat-drops folder.

### At 9 PM every night → Automatic
The `fenix-daily-journal` scheduled task:
- Reads any new chat drops + raw observations
- Reads recent diary entries for continuity
- Writes two new dated entries (About Kiran + Build Journey)
- Moves processed chat drops to `processed/` subfolder
- **On Sundays:** generates or extends a Connecting Thread essay + compiles the week

---

## Where Everything Lives

```
fenix-journal/
├── HOW-TO.md                  ← You're reading this
├── JOURNAL-GUIDE.md           ← Full voice/style guidelines
│
├── raw/                       ← RAW INPUTS (you + me contribute here)
│   ├── kiran-observations.md  ← I append during Cowork sessions
│   ├── build-observations.md  ← I append during Cowork sessions
│   └── chat-drops/            ← YOU drop chat transcripts here
│       └── processed/         ← Drops move here after being read
│
├── entries/                   ← DIARY ENTRIES (generated nightly + weekly)
│   ├── about-kiran/           ← "What I'm Learning About Kiran" (daily)
│   │   ├── 2026-03-02.md
│   │   ├── 2026-03-03.md
│   │   └── ...
│   ├── build-journey/         ← "The Build Journey" (daily)
│   │   ├── 2026-03-02.md
│   │   ├── 2026-03-03.md
│   │   └── ...
│   └── connecting-threads/    ← "Connecting Threads" (weekly thematic essays)
│       ├── the-debugging-pattern.md
│       ├── failure-recovery-patterns.md
│       └── ...
│
└── compiled/                  ← WEEKLY NARRATIVES (generated Sundays)
```

---

## What Makes Good Chat Drops

Don't overthink this. Any of these work:

- A full conversation copy-paste (the task extracts the signal)
- Just the interesting parts you want captured
- A quick note like "today I debated X vs Y and chose Y because Z"
- Screenshots pasted into a doc (though text is better for extraction)

**The more you drop, the richer the diary gets.** But even dropping 1-2 chats a week will build a meaningful narrative over time.

---

## Reading the Diary

The entries are in `entries/about-kiran/` and `entries/build-journey/`, dated by day. Start from the earliest and read forward — they build on each other.

The weekly compilations in `compiled/` are the best "catch up" format if you miss a few days.

---

## Future Possibilities

- **Blog series:** The build journey entries are written at blog-post quality. With light editing, they could become "Building with AI: A Daily Diary."
- **Book material:** The "About Kiran" entries are a unique artifact — an AI's developing portrait of a person it works with. That's never been done as a sustained narrative.
- **Fenix training data:** These observations could feed into Fenix's Q&A bank, teaching it about you from its own perspective.
- **Career evidence:** Specific entries document your decision-making, problem-solving, and product thinking with concrete examples.
