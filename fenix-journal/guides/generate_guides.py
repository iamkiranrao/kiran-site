#!/usr/bin/env python3
"""
generate_guides.py — One-time script to generate initial product guides
by scouring all session archive transcripts and classifying content by module.

Usage:
    python generate_guides.py --archive-dir <path> --guides-dir <path> --api-key <key>

This script:
1. Reads all session transcripts from the archive
2. For each module, identifies relevant sessions/passages
3. Generates a structured guide using Claude API
4. Writes each guide to the guides directory

Requires ANTHROPIC_API_KEY environment variable or --api-key flag.
"""

import os
import re
import sys
import json
import argparse
from datetime import datetime, timezone
from typing import List, Dict, Optional

# Module definitions — slug, display name, and keywords for matching
MODULES = [
    {
        "slug": "teardown-builder",
        "name": "Teardown Builder",
        "keywords": ["teardown", "teardowns", "product teardown", "tear down", "product analysis"],
        "description": "Research and publish product teardowns to the portfolio site.",
    },
    {
        "slug": "wordweaver",
        "name": "WordWeaver",
        "keywords": ["wordweaver", "word weaver", "blog post", "podcast", "voice profile", "content creation", "blog"],
        "description": "Create blog posts and podcast content with voice profile matching.",
    },
    {
        "slug": "resume-customizer",
        "name": "Resume Customizer",
        "keywords": ["resume", "cv", "job application", "cover letter", "resume customizer", "application package"],
        "description": "Tailor resumes and application packages to job descriptions.",
    },
    {
        "slug": "job-central",
        "name": "Job Central",
        "keywords": ["job central", "job search", "job tracking", "interview prep", "application tracker", "job applications"],
        "description": "Track applications, prep for interviews, manage job search.",
    },
    {
        "slug": "madlab",
        "name": "MadLab",
        "keywords": ["madlab", "mad lab", "prototype", "prototypes", "experiments", "experimental"],
        "description": "Build and publish prototype overview pages.",
    },
    {
        "slug": "fenix-dashboard",
        "name": "Fenix Dashboard",
        "keywords": ["fenix dashboard", "fenix analytics", "fenix training", "fenix ai", "conversational ai", "fenix assistant", "fenix"],
        "description": "Analytics, failure detection, and training for the Fenix AI assistant.",
    },
    {
        "slug": "fenix-journal",
        "name": "Fenix Journal",
        "keywords": ["fenix journal", "journal", "diary", "observations", "session capture", "session archive"],
        "description": "Daily diary entries, session archiving, and observation tracking.",
    },
    {
        "slug": "content-audit",
        "name": "Content Audit",
        "keywords": ["content audit", "voice audit", "accuracy audit", "site scan", "content scan"],
        "description": "Scan site content against voice and accuracy rules.",
    },
    {
        "slug": "feedback-testimonials",
        "name": "Feedback & Testimonials",
        "keywords": ["feedback", "testimonials", "testimonial", "reviews", "site feedback"],
        "description": "View site feedback and manage testimonial submissions.",
    },
    {
        "slug": "website",
        "name": "Website (kiranrao.ai)",
        "keywords": ["website", "portfolio", "framer", "kirangorapalli", "site", "homepage", "navigation", "deployment", "hosting"],
        "description": "The portfolio website — design, structure, deployment, and content.",
    },
]


def read_file(path: str) -> Optional[str]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except (FileNotFoundError, PermissionError):
        return None


def parse_frontmatter(content: str) -> Dict:
    meta = {}
    if not content.startswith("---"):
        return meta
    end = content.find("---", 3)
    if end < 0:
        return meta
    for line in content[3:end].strip().split("\n"):
        if ":" in line:
            key, val = line.split(":", 1)
            meta[key.strip()] = val.strip()
    return meta


def load_sessions(archive_dir: str) -> List[Dict]:
    """Load all session transcripts from the archive directory."""
    sessions = []
    for fname in sorted(os.listdir(archive_dir)):
        if not fname.endswith(".md") or fname.startswith("_"):
            continue
        content = read_file(os.path.join(archive_dir, fname))
        if not content:
            continue
        meta = parse_frontmatter(content)
        # Get body after frontmatter
        body = content
        if content.startswith("---"):
            end = content.find("---", 3)
            if end > 0:
                body = content[end + 3:].strip()
        sessions.append({
            "filename": fname,
            "meta": meta,
            "body": body,
            "content_lower": body.lower(),
        })
    return sessions


def classify_sessions(sessions: List[Dict], module: Dict) -> List[Dict]:
    """Find sessions relevant to a specific module based on keyword matching."""
    relevant = []
    keywords = module["keywords"]
    for session in sessions:
        text = session["content_lower"]
        score = sum(1 for kw in keywords if kw.lower() in text)
        if score > 0:
            relevant.append({**session, "relevance_score": score})
    relevant.sort(key=lambda x: x["relevance_score"], reverse=True)
    return relevant


def build_guide_prompt(module: Dict, relevant_sessions: List[Dict]) -> str:
    """Build the prompt for Claude to generate the guide."""
    session_excerpts = []
    total_chars = 0
    max_chars = 80000  # Stay well within context limits

    for session in relevant_sessions:
        if total_chars > max_chars:
            break
        excerpt = session["body"][:8000]  # Cap per session
        session_excerpts.append(
            f"### Session: {session['meta'].get('title', session['filename'])}\n"
            f"Date: {session['meta'].get('session_start', 'unknown')}\n"
            f"Type: {session['meta'].get('session_type', 'unknown')}\n\n"
            f"{excerpt}\n\n---\n"
        )
        total_chars += len(excerpt)

    if not session_excerpts:
        return None

    excerpts_text = "\n".join(session_excerpts)

    return f"""You are writing a product guide for a module called "{module['name']}" in Kiran Rao's Command Center.

Module description: {module['description']}

Below are excerpts from Kiran's chat/cowork session transcripts that are relevant to this module. Extract all useful information and organize it into a structured guide.

<session_transcripts>
{excerpts_text}
</session_transcripts>

Write the guide using this exact structure. Only include sections where you have real information from the transcripts. If you have nothing for a section, write "No data yet — will be populated as more sessions are captured."

---
module: {module['slug']}
title: {module['name']}
created: {datetime.now().strftime('%Y-%m-%d')}
last_updated: {datetime.now().strftime('%Y-%m-%d')}
version: 1
---

# {module['name']}

## Overview
What it does and why it exists. Be specific based on what you learned from the transcripts.

## Architecture
How it's built — tech stack, key files, integrations, data flow. Include specific file paths, frameworks, and patterns if mentioned.

## Key Decisions
The "why" behind major choices. Format as dated entries when possible:
- **YYYY-MM-DD**: Decision description and rationale

## Evolution
How the module changed over time. Chronological narrative sourced from session history.

## Current State
What works, what's in progress. Be specific about features and their status.

## Known Issues & Limitations
Things to fix or revisit. Include specific bugs or pain points mentioned.

## Ideas & Future Direction
Things discussed but not yet built. Include Kiran's stated intentions.

Rules:
- Only include information evidenced in the transcripts. Never fabricate.
- Use specific details (file names, tech choices, dates) whenever available.
- Write in third person ("The module...", "Kiran decided...").
- Keep it concise and scannable — this is a reference doc, not a narrative.
- If a section has no data, say so clearly.
"""


def generate_guide_with_api(prompt: str, api_key: str) -> Optional[str]:
    """Call Claude API to generate the guide content."""
    try:
        import urllib.request
        import urllib.error

        data = json.dumps({
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 4096,
            "messages": [{"role": "user", "content": prompt}],
        }).encode("utf-8")

        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=data,
            headers={
                "Content-Type": "application/json",
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
            },
        )

        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode("utf-8"))

        # Extract text from response
        for block in result.get("content", []):
            if block.get("type") == "text":
                return block["text"]
        return None

    except Exception as e:
        print(f"  API error: {e}", file=sys.stderr)
        return None


def generate_placeholder_guide(module: Dict, relevant_sessions: List[Dict]) -> str:
    """Generate a placeholder guide without API (lists relevant sessions)."""
    today = datetime.now().strftime("%Y-%m-%d")
    session_refs = []
    for s in relevant_sessions[:10]:
        meta = s["meta"]
        session_refs.append(
            f"- **{meta.get('title', s['filename']).replace('-', ' ').title()}** "
            f"({meta.get('session_start', 'unknown date')[:10]}) — "
            f"{meta.get('message_count', '?')} messages, "
            f"{meta.get('total_words', '?')} words"
        )

    refs_text = "\n".join(session_refs) if session_refs else "No relevant sessions found yet."

    return f"""---
module: {module['slug']}
title: {module['name']}
created: {today}
last_updated: {today}
version: 1
---

# {module['name']}

## Overview

{module['description']}

*Detailed overview will be generated when session archive data is available.*

## Architecture

No data yet — will be populated as more sessions are captured.

## Key Decisions

No data yet — will be populated as more sessions are captured.

## Evolution

No data yet — will be populated as more sessions are captured.

## Current State

No data yet — will be populated as more sessions are captured.

## Known Issues & Limitations

No data yet — will be populated as more sessions are captured.

## Ideas & Future Direction

No data yet — will be populated as more sessions are captured.

---

## Source Sessions

The following archived sessions are relevant to this module:

{refs_text}
"""


def update_index(guides_dir: str):
    """Rebuild _index.md from all guide files."""
    entries = []
    for fname in sorted(os.listdir(guides_dir)):
        if not fname.endswith(".md") or fname.startswith("_"):
            continue
        content = read_file(os.path.join(guides_dir, fname))
        if not content:
            continue
        meta = parse_frontmatter(content)
        title = meta.get("title", fname.replace(".md", "").replace("-", " ").title())
        updated = meta.get("last_updated", "—")
        version = meta.get("version", "1")
        entries.append(f"| {title} | v{version} | {updated} | `{fname}` |")

    index = [
        "# Product Guides Index",
        "",
        f"*Last updated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}*",
        "",
        f"**Total guides:** {len(entries)}",
        "",
        "| Module | Version | Last Updated | File |",
        "|--------|---------|--------------|------|",
    ]
    index.extend(entries)
    index.append("")

    with open(os.path.join(guides_dir, "_index.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(index))


def main():
    parser = argparse.ArgumentParser(description="Generate product guides from session archive")
    parser.add_argument("--archive-dir", required=True, help="Path to session-archive directory")
    parser.add_argument("--guides-dir", required=True, help="Path to guides output directory")
    parser.add_argument("--api-key", default=None, help="Anthropic API key (or set ANTHROPIC_API_KEY)")
    parser.add_argument("--placeholder-only", action="store_true",
                        help="Generate placeholder guides without API calls")
    parser.add_argument("--modules", default=None,
                        help="Comma-separated list of module slugs to generate (default: all)")
    args = parser.parse_args()

    api_key = args.api_key or os.environ.get("ANTHROPIC_API_KEY")
    if not api_key and not args.placeholder_only:
        print("Warning: No API key provided. Generating placeholder guides.", file=sys.stderr)
        args.placeholder_only = True

    os.makedirs(args.guides_dir, exist_ok=True)

    # Load sessions
    print(f"Loading sessions from {args.archive_dir}...")
    sessions = load_sessions(args.archive_dir)
    print(f"Found {len(sessions)} session transcripts.\n")

    # Filter modules if specified
    modules_to_generate = MODULES
    if args.modules:
        slugs = [s.strip() for s in args.modules.split(",")]
        modules_to_generate = [m for m in MODULES if m["slug"] in slugs]

    for module in modules_to_generate:
        print(f"{'='*60}")
        print(f"Module: {module['name']}")

        relevant = classify_sessions(sessions, module)
        print(f"  Relevant sessions: {len(relevant)}")

        if args.placeholder_only or not relevant:
            guide = generate_placeholder_guide(module, relevant)
            label = "placeholder"
        else:
            prompt = build_guide_prompt(module, relevant)
            if prompt:
                print(f"  Generating with API...")
                guide = generate_guide_with_api(prompt, api_key)
                if not guide:
                    print(f"  API failed, using placeholder")
                    guide = generate_placeholder_guide(module, relevant)
                    label = "placeholder"
                else:
                    label = "generated"
            else:
                guide = generate_placeholder_guide(module, relevant)
                label = "placeholder"

        # Write guide
        output_path = os.path.join(args.guides_dir, f"{module['slug']}.md")
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(guide)
        print(f"  Written: {output_path} ({label})")
        print()

    # Update index
    update_index(args.guides_dir)
    print(f"Index updated in {args.guides_dir}/_index.md")
    print("Done!")


if __name__ == "__main__":
    main()
