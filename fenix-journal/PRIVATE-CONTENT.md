# Private Content Convention

**Purpose:** Prevent sensitive journal content from being indexed into Fenix's Flame On RAG pipeline.

---

## Two Ways to Mark Content as Private

### 1. Frontmatter Flag (for individual files)

Add `private: true` to the YAML frontmatter of any `.md` file:

```markdown
---
private: true
---

# Entry Title
Content here...
```

The embedding script (`embed_flame_on_data.py`) checks for this flag and skips the file during indexing. The file stays in its normal location — it just won't appear in Fenix responses.

### 2. Private Directory (for batches of files)

Each journal stream has a `private/` subdirectory:

```
fenix-journal/entries/about-kiran/private/
fenix-journal/entries/build-journey/private/
fenix-journal/entries/connecting-threads/private/
```

Any `.md` file placed in a `private/` directory is skipped entirely during indexing. Use this when an entire entry is sensitive rather than flagging individual files.

---

## What's Already Excluded

- **`strategic-decisions/`** — This directory is not in the `CONTENT_TYPES` map in `embed_flame_on_data.py`, so it is never indexed regardless of private flags.
- **`docs/`** — Strategy documents (SITE-WHY.md, ULTIMATE-PERSONA.md, GO-TO-MARKET.md, etc.) are never indexed. They live outside the journal tree.
- **`session-archive/`** and **`raw/`** — Not indexed.

---

## What IS Indexed (When Not Private)

- `entries/about-kiran/*.md` → Flame On (behind toggle)
- `entries/build-journey/*.md` → Flame On (behind toggle)
- `entries/connecting-threads/*.md` → Flame On (behind toggle)
- `guides/*.md` → Flame On (behind toggle)

All of the above are only returned when a visitor explicitly enables the Flame On toggle. They never appear in default Fenix responses.

---

## What Counts as "Private"

Use private flags for content that includes:
- Job search strategy, target companies, specific hiring contacts
- Personal vulnerabilities, imposter syndrome discussions, fears
- Financial details or salary information
- Competitive analysis of Kiran's positioning vs. other candidates
- Anything you wouldn't want a hiring manager at a target company to read

Content that's fine for Flame On (no private flag needed):
- How Kiran works and thinks (working style, design process)
- Technical build decisions and tradeoffs
- General product philosophy
- Build journey entries about what was shipped and why

---

## For Future Sessions

When writing journal entries, the session-capture skill should evaluate each entry:
- If it contains strategic/personal sensitivity → add `private: true` frontmatter
- If it's about the build process or working style → leave public for Flame On

When in doubt, mark it private. It's easy to remove the flag later; it's harder to un-index something that's already been embedded.
