"""
Content Audit Service — Scans all site HTML for content rule violations.

Reads CONTENT-RULES.md, extracts visible text from each HTML file,
and uses Claude to audit the content against the rules.
"""

import os
import re
import json
from typing import Optional
from anthropic import Anthropic
from pathlib import Path


# ── Site root ──────────────────────────────────────────────────────

SITE_ROOT = Path(__file__).resolve().parents[3]  # command-center/backend/services -> site root
RULES_PATH = SITE_ROOT / "CONTENT-RULES.md"

# Files to audit (main content pages + prototypes)
AUDIT_GLOBS = [
    "*.html",
    "teardowns/*.html",
    "prototypes/**/overview.html",
    "prototypes/**/index.html",
]

# Files to skip
SKIP_FILES = {"404.html", "sparkline-preview.html", "index.backup.html"}


def _get_site_files() -> list[dict]:
    """Find all auditable HTML files and return metadata."""
    files = []
    for pattern in AUDIT_GLOBS:
        for path in SITE_ROOT.glob(pattern):
            if path.name in SKIP_FILES:
                continue
            rel = path.relative_to(SITE_ROOT)
            files.append({
                "path": str(path),
                "relative": str(rel),
                "name": path.name,
                "size": path.stat().st_size,
            })
    # Deduplicate by path
    seen = set()
    unique = []
    for f in files:
        if f["path"] not in seen:
            seen.add(f["path"])
            unique.append(f)
    return sorted(unique, key=lambda x: x["relative"])


def _extract_visible_text(html: str) -> str:
    """Strip HTML tags and extract visible text content only."""
    # Remove style and script blocks
    html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL)
    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
    # Remove HTML comments
    html = re.sub(r'<!--.*?-->', '', html, flags=re.DOTALL)
    # Remove tags but keep content
    text = re.sub(r'<[^>]+>', ' ', html)
    # Decode common entities
    text = text.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    text = text.replace('&middot;', '·').replace('&mdash;', '—').replace('&ndash;', '–')
    text = text.replace('&larr;', '←').replace('&rarr;', '→').replace('&copy;', '©')
    text = text.replace('&#8600;', '↘').replace('&#8595;', '↓')
    # Remove HTML numeric entities (emojis etc)
    text = re.sub(r'&#x[0-9a-fA-F]+;', '', text)
    text = re.sub(r'&#[0-9]+;', '', text)
    # Collapse whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def get_rules() -> str:
    """Read the content rules file."""
    if RULES_PATH.exists():
        return RULES_PATH.read_text()
    return "No CONTENT-RULES.md found at site root."


def list_auditable_files() -> list[dict]:
    """Return list of files that can be audited."""
    return _get_site_files()


def extract_page_content(file_path: str) -> dict:
    """Read an HTML file and return its visible text."""
    path = Path(file_path)
    if not path.exists():
        return {"error": f"File not found: {file_path}"}
    html = path.read_text()
    text = _extract_visible_text(html)
    # Truncate if very long (keep under ~4000 words for API efficiency)
    words = text.split()
    if len(words) > 4000:
        text = ' '.join(words[:4000]) + '\n\n[Truncated — full file has more content]'
    return {
        "path": str(path),
        "relative": str(path.relative_to(SITE_ROOT)),
        "word_count": len(words),
        "text": text,
    }


async def audit_file(api_key: str, file_path: str) -> dict:
    """Audit a single file's content against CONTENT-RULES.md."""
    rules = get_rules()
    page = extract_page_content(file_path)

    if "error" in page:
        return page

    client = Anthropic(api_key=api_key)

    prompt = f"""You are a content auditor for Kiran Gorapalli's portfolio website. Your job is to find every piece of text that violates his content rules.

## CONTENT RULES
{rules}

## PAGE CONTENT (from {page['relative']})
{page['text']}

## YOUR TASK
Audit every piece of visible text on this page against the rules above. For each violation:

1. Quote the exact text that violates
2. Name which rule it breaks (be specific: "Jargon", "AI-sounding", "Technical posturing", "Passive voice", "Lofty abstraction", "Unverifiable number", "Filler qualifier")
3. Suggest a replacement that follows the rules

If the page has NO violations, say so clearly.

Return your audit as a JSON array. Each item should have:
- "text": the exact violating text
- "rule": which rule it breaks
- "severity": "high" (definitely wrong), "medium" (borderline), or "low" (minor style issue)
- "suggestion": the replacement text

Return ONLY the JSON array, no other text. If no violations, return an empty array: []"""

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )

    response_text = message.content[0].text.strip()

    # Parse JSON from response
    try:
        # Handle markdown code blocks
        if response_text.startswith("```"):
            response_text = re.sub(r'^```\w*\n?', '', response_text)
            response_text = re.sub(r'\n?```$', '', response_text)
        violations = json.loads(response_text)
    except json.JSONDecodeError:
        violations = [{"text": "Failed to parse audit response", "rule": "System", "severity": "high", "suggestion": response_text}]

    return {
        "file": page["relative"],
        "word_count": page["word_count"],
        "violation_count": len(violations),
        "violations": violations,
    }


async def audit_all(api_key: str) -> dict:
    """Audit all site files and return a summary."""
    files = _get_site_files()
    results = []
    total_violations = 0

    for f in files:
        result = await audit_file(api_key, f["path"])
        results.append(result)
        total_violations += result.get("violation_count", 0)

    return {
        "files_scanned": len(files),
        "total_violations": total_violations,
        "results": results,
    }
