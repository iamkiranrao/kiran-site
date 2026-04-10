# How Cowork Sessions Load Context — A Guide for Kiran

Last updated: April 10, 2026

## The Problem This Solves

Every new Cowork session starts with a blank slate. It doesn't know which of your 30+ docs matter for the task at hand. Without guidance, sessions either read everything (slow, wastes context window) or guess wrong (makes bad decisions because it missed a foundational principle).

CLAUDE.md now acts as a context router. When you tell the session what you're working on, it loads exactly the right docs — no more, no less.

## How It Works

Your documentation is organized into four tiers based on how long it lives and when it's needed:

**Tier 1 — Identity (the constitution)**
SITE-WHY, ULTIMATE-PERSONA, GO-TO-MARKET. These define why the site exists and who it's for. Loaded automatically for any session that builds something. You never need to ask for these — the session knows.

**Tier 2 — Architecture & Governance (the building code)**
FENIX-AGENT-SPEC, VISUAL-STANDARDS, CONTENT-GOVERNANCE, BACKEND-STANDARDS, etc. These define how things work and how things get built. Loaded based on domain — a frontend session gets VISUAL-STANDARDS, a backend session gets BACKEND-STANDARDS.

**Tier 3 — Gameplans (the current sprint)**
MASTER-PLAN, PERSONA-PLAYBOOK, BENTO-CARD-GAMEPLAN, FENIX-AI-ROADMAP, etc. These are tactical execution plans for active features. They expire when the work is done and should be archived.

**Tier 4 — Reference (the encyclopedia)**
Page specs (SITE-HOMEPAGE, SITE-BLOG, etc.), product specs (FENIX.md, SCANNIBAL.md), CC module docs, tool guides. Never pre-loaded — pulled in only when a specific question comes up.

## What to Say at Session Start

The session will ask what you're working on. Here's what each answer triggers:

**"Site" / "frontend" / "homepage" / "bento cards"**
Loads: Identity docs + visual standards + content governance + unlock strategy + the relevant feature gameplan. Reads index.html, styles.css, bento-cards.js.

**"Fenix backend" / "agent" / "system prompt"**
Loads: Identity docs + FENIX-AGENT-SPEC + FENIX-MODULE-ARCHITECTURE + backend standards + unlock strategy. Mounts ~/fenix-backend. Reads agent.py for ground truth.

**"Fenix frontend" / "widget" / "adapters"**
Loads: Identity docs + FENIX-MODULE-ARCHITECTURE + visual standards. Reads fenix-core.js and the adapter files.

**"Command Center" / "CC"**
Loads: Backend standards + architecture doc. Reads the specific CC module docs for whatever feature you're touching.

**"Teardowns" / "blog" / "content"**
Loads: Identity docs + content standards + authenticity standards + content governance. Reads the relevant page specs.

**"Persona picker" / "unlock system" / "personalization"**
Loads: Identity docs + unlock strategy + visual standards + PERSONA-PLAYBOOK.

**"Track record" / "career page"**
Loads: Identity docs + content standards + TR-V5-TRIMMING-GAMEPLAN.

**"Resume" / "job prep"**
Triggers the customize-resume skill. Loads MASTER-PLAN for career strategy.

**"Session capture" / "journal"**
Triggers the session-capture skill. Loads JOURNAL-GUIDE and ACTION-TRACKER.

**"MJ prompts" / "bento art" / "monster images"**
Loads: BENTO-CARD-GAMEPLAN + all three MJ prompt docs (PROMPT-KIT, PROMPTS-V4, SCENES-V6).

**"Infrastructure" / "deployment" / "services"**
Loads: Architecture doc + external services inventory + platform migration status. Pulls in tool guides as needed.

**"Everything" / "multiple things"**
Mounts both repos. Loads identity docs + architecture. You'll direct the session from there.

## Continuation Prompts

If you paste a continuation prompt from a previous session, the session skips the question entirely. The prompt tells it what to do. If the prompt references backend files, the session mounts ~/fenix-backend automatically.

## Mid-Session Context

You can always ask the session to load additional docs during work:
- "Read the visual standards before we touch CSS"
- "Check the persona playbook for the evaluator unlock design"
- "What does the FENIX-AGENT-SPEC say about the connect flow?"

The session will pull in the right file and incorporate it into its working context.

## Keeping the System Current

**When you finish a gameplan** (all phases complete): Tell the session to move it to archive/ and remove it from the Tier 3 list in CLAUDE.md. Gameplans that stick around after they're done create noise.

**When architecture changes** (new service, new patterns, new tool): Tell the session to update the relevant Tier 2 doc. These should always reflect reality, not aspirations.

**When you start a new feature**: The session should create a gameplan doc, add it to Tier 3 in CLAUDE.md, and log it in ACTION-TRACKER.md. This keeps future sessions aware of the new workstream.

**Identity docs should rarely change.** If they do, it means the strategy shifted — which is a journal-worthy decision.

## Where Everything Lives

```
docs/
  SITE-WHY.md                    ← Tier 1 (identity)
  ULTIMATE-PERSONA.md            ← Tier 1 (identity)
  GO-TO-MARKET.md                ← Tier 1 (identity)
  UNLOCK-STRATEGY.md             ← Tier 2 (governance)
  MASTER-PLAN.md                 ← Tier 3 (active gameplan)
  FENIX-AGENT-SPEC.md            ← Tier 2 (architecture)
  FENIX-MODULE-ARCHITECTURE.md   ← Tier 2 (architecture)
  FENIX-AI-ROADMAP.md            ← Tier 3 (active gameplan)
  PERSONA-PICKER.md              ← Tier 4 (reference)
  BENTO-CARD-GAMEPLAN.md         ← Tier 3 (active gameplan)
  HOMEPAGE-GAMEPLAN.md           ← Tier 3 (active gameplan)
  INDEX-HOMEPAGE.md              ← Tier 4 (reference)
  SITE-HOMEPAGE.md               ← Tier 4 (reference)
  SITE-BLOG.md                   ← Tier 4 (reference)
  SITE-TEARDOWNS.md              ← Tier 4 (reference)
  ...
  Foundation/
    ARCHITECTURE.md              ← Tier 2 (architecture)
    VISUAL-STANDARDS.md          ← Tier 2 (governance)
    CONTENT-STANDARDS.md         ← Tier 2 (governance)
    AUTHENTICITY-STANDARDS.md    ← Tier 2 (governance)
    CONTENT-GOVERNANCE.md        ← Tier 2 (governance)
    BACKEND-STANDARDS.md         ← Tier 2 (architecture)
    ToolGuides/                  ← Tier 4 (reference)
  Fenix/FENIX.md                 ← Tier 4 (reference)
  Scannibal/SCANNIBAL.md         ← Tier 4 (reference)
  TheDiaFund/DIA-FUND.md         ← Tier 4 (reference)
  PersonaPicker/
    PERSONA-PLAYBOOK.md          ← Tier 3 (active gameplan)
    PERSONA-PICKER.md            ← Tier 4 (reference)
  CommandCenter/                 ← Tier 4 (reference, per-module)
  archive/                       ← Completed gameplans and old versions
```

## The Short Version

Say what you're working on. The session loads the right docs. You don't need to remember file names — just describe the work area in plain language. If the session is missing context mid-conversation, tell it what to read.
