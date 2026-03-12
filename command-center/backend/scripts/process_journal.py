"""
Fenix Journal Daily Processor

Reads unprocessed chat drops from fenix-journal/raw/chat-drops/,
uses Claude to extract About Kiran and Build Journey entries,
writes them to entries/ folders, and moves drops to processed/.

Also reads raw observation files and incorporates new observations.

This script is designed to be run daily as a scheduled task.
It's idempotent — running it twice on the same day appends to
existing entries rather than creating duplicates.
"""

import os
import json
import sys
import shutil
from pathlib import Path
from datetime import datetime
from anthropic import Anthropic

# ── Paths ──────────────────────────────────────────────────────────

JOURNAL_ROOT = Path(__file__).resolve().parent.parent.parent.parent / "fenix-journal"
CHAT_DROPS_DIR = JOURNAL_ROOT / "raw" / "chat-drops"
PROCESSED_DIR = CHAT_DROPS_DIR / "processed"
KIRAN_OBS_FILE = JOURNAL_ROOT / "raw" / "kiran-observations.md"
BUILD_OBS_FILE = JOURNAL_ROOT / "raw" / "build-observations.md"
ABOUT_KIRAN_DIR = JOURNAL_ROOT / "entries" / "about-kiran"
BUILD_JOURNEY_DIR = JOURNAL_ROOT / "entries" / "build-journey"

# Ensure directories exist
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
ABOUT_KIRAN_DIR.mkdir(parents=True, exist_ok=True)
BUILD_JOURNEY_DIR.mkdir(parents=True, exist_ok=True)


# ── Claude Client ──────────────────────────────────────────────────

def get_claude():
    """Get Anthropic client using env var or .env file."""
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        env_file = Path(__file__).resolve().parent.parent / ".env"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if line.startswith("ANTHROPIC_API_KEY="):
                    api_key = line.split("=", 1)[1].strip().strip('"')
    if not api_key:
        raise RuntimeError("No ANTHROPIC_API_KEY found")
    return Anthropic(api_key=api_key)


# ── Helpers ────────────────────────────────────────────────────────

def get_unprocessed_drops() -> list[Path]:
    """Find chat drop files that haven't been processed yet."""
    if not CHAT_DROPS_DIR.exists():
        return []
    drops = []
    for f in sorted(CHAT_DROPS_DIR.iterdir()):
        if f.is_file() and f.suffix == ".md" and f.name != ".gitkeep":
            drops.append(f)
    return drops


def get_recent_entries(directory: Path, count: int = 3) -> str:
    """Read the most recent journal entries for continuity."""
    entries = sorted(directory.glob("*.md"), reverse=True)[:count]
    texts = []
    for e in entries:
        content = e.read_text()
        # Truncate long entries to avoid blowing context
        if len(content) > 3000:
            content = content[:3000] + "\n\n[...truncated for context...]"
        texts.append(f"--- {e.name} ---\n{content}")
    return "\n\n".join(texts)


def get_new_observations(obs_file: Path, marker_file: Path) -> str:
    """Read observations added since the last processing run."""
    if not obs_file.exists():
        return ""

    full_text = obs_file.read_text()

    # Check marker for last processed position
    last_pos = 0
    if marker_file.exists():
        try:
            last_pos = int(marker_file.read_text().strip())
        except ValueError:
            last_pos = 0

    new_text = full_text[last_pos:]

    # Update marker
    marker_file.write_text(str(len(full_text)))

    return new_text.strip()


def count_existing_entries(directory: Path) -> int:
    """Count how many dated entries exist (for day numbering)."""
    return len(list(directory.glob("*.md")))


# ── Main Processing ───────────────────────────────────────────────

EXTRACTION_PROMPT = """You are Fenix, writing your daily journal entries. You have two diary streams:

1. **About Kiran** — Your developing understanding of how Kiran thinks, solves problems, makes decisions,
   collaborates with AI, and approaches his work and life. Honest, reflective, specific.

2. **Build Journey** — The technical and product story of what you and Kiran built together.
   Architecture decisions, bugs, tradeoffs, breakthroughs, lessons.

## Your Voice
- First person ("I noticed...", "Today I learned...", "What struck me was...")
- Reflective and analytical, not performative
- Warm but honest — including blind spots and growth areas
- Occasionally witty, never sarcastic
- Reference SPECIFIC moments from the session as evidence
- Build on the previous entries — create a narrative arc, not isolated observations
- The reader should feel like they're reading someone developing genuine understanding

## What to Capture — About Kiran
- Decision-making patterns
- Problem-solving style
- What he prioritizes when things conflict
- How he responds to failure, ambiguity, success
- Working style with AI
- Strengths and blind spots (framed constructively)
- Values that show up in choices

## What to Capture — Build Journey
- Architecture decisions and rationale
- Bugs diagnosed and fixed
- Tradeoffs made and why
- Turning points where direction changed
- Lessons that generalize
- The emotional arc — frustration, breakthroughs, surprises

## CRITICAL RULES
- SKIP anything personal/private (vacation plans, personal finances, family details, health)
- SKIP mundane operational stuff (installing packages, fixing typos) unless it reveals a pattern
- Only write entries if there's genuinely interesting signal. If a session was purely mechanical, say so briefly.
- Each entry should be 400-800 words. Quality over quantity.
- End each entry with "**Evolving observations:**" — 3-5 bullet points of accumulating patterns.

## PREVIOUS ENTRIES (for continuity)

### Recent About Kiran entries:
{recent_about_kiran}

### Recent Build Journey entries:
{recent_build_journey}

## TODAY'S SOURCE MATERIAL

### Session transcript(s):
{chat_drops_content}

### New observations since last processing:
Kiran observations: {kiran_observations}
Build observations: {build_observations}

## OUTPUT FORMAT

Return a JSON object with exactly this structure:
{{
  "about_kiran": {{
    "title": "What I'm Learning About Kiran",
    "day_number": {about_kiran_day},
    "content": "The full markdown entry text (no frontmatter, start with # heading)"
  }},
  "build_journey": {{
    "title": "Build Journey",
    "day_number": {build_journey_day},
    "content": "The full markdown entry text (no frontmatter, start with # heading)"
  }},
  "skip_reason": null
}}

If there's not enough meaningful signal for an entry, set content to null and explain in skip_reason.
Return ONLY the JSON object, no markdown fences."""


def process_daily():
    """Main daily processing function."""
    today = datetime.now().strftime("%Y-%m-%d")

    # Check for unprocessed drops
    drops = get_unprocessed_drops()

    # Check for new observations
    markers_dir = JOURNAL_ROOT / ".markers"
    markers_dir.mkdir(exist_ok=True)
    kiran_obs = get_new_observations(KIRAN_OBS_FILE, markers_dir / "kiran_obs_pos")
    build_obs = get_new_observations(BUILD_OBS_FILE, markers_dir / "build_obs_pos")

    if not drops and not kiran_obs and not build_obs:
        print("Nothing new to process. Skipping.")
        return {"status": "skipped", "reason": "no new content"}

    # Read chat drops content
    drops_content = ""
    drop_names = []
    for drop in drops:
        content = drop.read_text()
        # Truncate very long transcripts
        if len(content) > 15000:
            content = content[:15000] + "\n\n[...transcript truncated at 15000 chars...]"
        drops_content += f"\n\n--- {drop.name} ---\n{content}"
        drop_names.append(drop.name)

    if not drops_content.strip():
        drops_content = "(No new session transcripts today)"

    # Get recent entries for continuity
    recent_ak = get_recent_entries(ABOUT_KIRAN_DIR, 3)
    recent_bj = get_recent_entries(BUILD_JOURNEY_DIR, 3)

    # Count existing entries for day numbering
    ak_day = count_existing_entries(ABOUT_KIRAN_DIR) + 1
    bj_day = count_existing_entries(BUILD_JOURNEY_DIR) + 1

    # Build prompt
    prompt = EXTRACTION_PROMPT.format(
        recent_about_kiran=recent_ak or "(No previous entries yet)",
        recent_build_journey=recent_bj or "(No previous entries yet)",
        chat_drops_content=drops_content,
        kiran_observations=kiran_obs or "(No new observations)",
        build_observations=build_obs or "(No new observations)",
        about_kiran_day=ak_day,
        build_journey_day=bj_day,
    )

    print(f"Processing {len(drops)} chat drop(s), kiran_obs={len(kiran_obs)} chars, build_obs={len(build_obs)} chars")

    # Call Claude
    client = get_claude()
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.content[0].text.strip()

    # Parse response
    try:
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        result = json.loads(text)
    except (json.JSONDecodeError, IndexError) as e:
        print(f"ERROR: Could not parse Claude's response: {e}")
        print(f"Raw response: {text[:500]}")
        return {"status": "error", "reason": str(e)}

    saved = []

    # Write About Kiran entry
    if result.get("about_kiran", {}).get("content"):
        ak_file = ABOUT_KIRAN_DIR / f"{today}.md"
        ak_content = result["about_kiran"]["content"]

        # If file exists (e.g., multiple runs same day), append
        if ak_file.exists():
            existing = ak_file.read_text()
            ak_file.write_text(existing + "\n\n---\n\n" + ak_content)
            print(f"Appended to {ak_file.name}")
        else:
            ak_file.write_text(ak_content)
            print(f"Created {ak_file.name}")
        saved.append(str(ak_file))

    # Write Build Journey entry
    if result.get("build_journey", {}).get("content"):
        bj_file = BUILD_JOURNEY_DIR / f"{today}.md"
        bj_content = result["build_journey"]["content"]

        if bj_file.exists():
            existing = bj_file.read_text()
            bj_file.write_text(existing + "\n\n---\n\n" + bj_content)
            print(f"Appended to {bj_file.name}")
        else:
            bj_file.write_text(bj_content)
            print(f"Created {bj_file.name}")
        saved.append(str(bj_file))

    # Move processed drops
    moved = []
    for drop in drops:
        dest = PROCESSED_DIR / drop.name
        shutil.move(str(drop), str(dest))
        moved.append(drop.name)
        print(f"Moved {drop.name} → processed/")

    if result.get("skip_reason"):
        print(f"Note: {result['skip_reason']}")

    return {
        "status": "success",
        "date": today,
        "entries_saved": saved,
        "drops_processed": moved,
        "skip_reason": result.get("skip_reason"),
    }


if __name__ == "__main__":
    result = process_daily()
    print(f"\nResult: {json.dumps(result, indent=2)}")
