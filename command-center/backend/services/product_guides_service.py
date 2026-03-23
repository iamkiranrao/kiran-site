"""
Product Guides Service — reads and serves product module guides.
Scans the docs/ module folder structure for guide files (those with
YAML frontmatter containing a 'module:' field). Falls back to
fenix-journal/guides/ for any guides not yet migrated.
"""

import os
import re
from typing import Optional, Dict, List

# ── Resolve roots ─────────────────────────────────────
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_COMMAND_CENTER = os.path.dirname(_BACKEND_DIR)
_REPO_ROOT = os.path.dirname(_COMMAND_CENTER)
DOCS_DIR = os.path.join(_REPO_ROOT, "docs")
# Legacy location (kept as fallback)
LEGACY_GUIDES_DIR = os.path.join(_REPO_ROOT, "fenix-journal", "guides")


def _read_file(path: str) -> Optional[str]:
    """Safely read a file, return None if missing."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except (FileNotFoundError, PermissionError):
        return None


def _parse_frontmatter(content: str) -> Dict:
    """Extract YAML frontmatter from markdown content."""
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


def _word_count(text: str) -> int:
    return len(text.split())


def _extract_sections(content: str) -> Dict[str, str]:
    """Extract h2 sections from markdown content."""
    sections = {}
    body = content
    if content.startswith("---"):
        end = content.find("---", 3)
        if end > 0:
            body = content[end + 3:].strip()

    # Split on ## headers
    parts = re.split(r'^## ', body, flags=re.MULTILINE)
    for part in parts[1:]:  # skip everything before first ##
        lines = part.strip().split("\n", 1)
        if lines:
            header = lines[0].strip()
            content_text = lines[1].strip() if len(lines) > 1 else ""
            sections[header] = content_text
    return sections


def _has_real_content(section_text: str) -> bool:
    """Check if a section has real content vs just placeholder text."""
    placeholder_phrases = [
        "no data yet",
        "will be populated",
        "will be generated",
    ]
    lower = section_text.lower().strip()
    if not lower:
        return False
    return not any(phrase in lower for phrase in placeholder_phrases)


def _find_guide_files() -> List[str]:
    """Find all guide files (those with 'module:' in YAML frontmatter) across docs/ tree."""
    guide_files = []
    seen_slugs = set()

    # Scan docs/ recursively for guide files
    if os.path.isdir(DOCS_DIR):
        for root, dirs, files in os.walk(DOCS_DIR):
            for fname in files:
                if not fname.endswith(".md") or fname.startswith("_") or fname == "RESUME.md":
                    continue
                fpath = os.path.join(root, fname)
                content = _read_file(fpath)
                if content and "module:" in content[:500]:
                    meta = _parse_frontmatter(content)
                    slug = meta.get("module", "")
                    if slug and slug not in seen_slugs:
                        seen_slugs.add(slug)
                        guide_files.append(fpath)

    # Fallback: scan legacy location for any guides not yet found
    if os.path.isdir(LEGACY_GUIDES_DIR):
        for fname in os.listdir(LEGACY_GUIDES_DIR):
            if not fname.endswith(".md") or fname.startswith("_"):
                continue
            fpath = os.path.join(LEGACY_GUIDES_DIR, fname)
            content = _read_file(fpath)
            if content:
                meta = _parse_frontmatter(content)
                slug = meta.get("module", fname.replace(".md", ""))
                if slug not in seen_slugs:
                    seen_slugs.add(slug)
                    guide_files.append(fpath)

    return sorted(guide_files)


def list_guides() -> Dict:
    """List all product guides with metadata."""
    guide_files = _find_guide_files()

    guides = []
    for fpath in guide_files:
        content = _read_file(fpath)
        if not content:
            continue

        fname = os.path.basename(fpath)
        meta = _parse_frontmatter(content)
        sections = _extract_sections(content)

        populated = sum(1 for v in sections.values() if _has_real_content(v))
        total_sections = len(sections)

        guides.append({
            "slug": meta.get("module", fname.replace(".md", "")),
            "title": meta.get("title", fname.replace(".md", "").replace("-", " ").title()),
            "created": meta.get("created", ""),
            "last_updated": meta.get("last_updated", ""),
            "version": int(meta.get("version", 1)),
            "word_count": _word_count(content),
            "sections_populated": populated,
            "sections_total": total_sections,
            "filename": fname,
        })

    return {"guides": guides, "total": len(guides)}


def get_guide(slug: str) -> Optional[Dict]:
    """Get the full content of a specific guide by slug."""
    # Prevent path traversal
    if "/" in slug or "\\" in slug or ".." in slug:
        return None

    # Search all guide files for the matching slug
    guide_files = _find_guide_files()
    for fpath in guide_files:
        content = _read_file(fpath)
        if not content:
            continue
        meta = _parse_frontmatter(content)
        file_slug = meta.get("module", os.path.basename(fpath).replace(".md", ""))
        if file_slug == slug:
            sections = _extract_sections(content)
            body = content
            if content.startswith("---"):
                end = content.find("---", 3)
                if end > 0:
                    body = content[end + 3:].strip()

            populated = sum(1 for v in sections.values() if _has_real_content(v))

            return {
                "slug": file_slug,
                "title": meta.get("title", slug.replace("-", " ").title()),
                "created": meta.get("created", ""),
                "last_updated": meta.get("last_updated", ""),
                "version": int(meta.get("version", 1)),
                "word_count": _word_count(content),
                "sections_populated": populated,
                "sections_total": len(sections),
                "content": body,
                "sections": {k: {"content": v, "has_data": _has_real_content(v)} for k, v in sections.items()},
            }

    return None


def get_guides_stats() -> Dict:
    """Return summary stats about the guides."""
    result = list_guides()
    guides = result["guides"]

    total_words = sum(g["word_count"] for g in guides)
    total_populated = sum(g["sections_populated"] for g in guides)
    total_sections = sum(g["sections_total"] for g in guides)

    return {
        "total_guides": len(guides),
        "total_words": total_words,
        "sections_populated": total_populated,
        "sections_total": total_sections,
        "completeness": round(total_populated / total_sections * 100) if total_sections > 0 else 0,
    }
