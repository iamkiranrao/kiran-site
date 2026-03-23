"""
Fenix Journal Service — reads diary entries and raw observations
from the fenix-journal directory.
"""

import os
import re
from typing import Optional, List, Dict
from datetime import datetime

# ── Resolve journal root ─────────────────────────────────────
# The journal lives at the repo root under fenix-journal/
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_COMMAND_CENTER = os.path.dirname(_BACKEND_DIR)
_REPO_ROOT = os.path.dirname(_COMMAND_CENTER)
JOURNAL_ROOT = os.path.join(_REPO_ROOT, "fenix-journal")

STREAMS = {
    "about-kiran": "What I'm Learning About Kiran",
    "build-journey": "The Build Journey",
    "connecting-threads": "Connecting Threads",
}


def _read_file(path: str) -> Optional[str]:
    """Safely read a file, return None if missing."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except (FileNotFoundError, PermissionError):
        return None


def _word_count(text: str) -> int:
    return len(text.split())


def _extract_preview(text: str, max_chars: int = 160) -> str:
    """Extract first meaningful paragraph as preview."""
    lines = text.strip().split("\n")
    for line in lines:
        stripped = line.strip()
        # skip headers, separators, bold date lines
        if not stripped or stripped.startswith("#") or stripped == "---" or stripped.startswith("**Day"):
            continue
        if len(stripped) > 20:
            return stripped[:max_chars] + ("..." if len(stripped) > max_chars else "")
    return ""


def _extract_day_number(text: str) -> Optional[int]:
    """Extract day number from **Day N — Date** pattern."""
    m = re.search(r"\*\*Day\s+(\d+)", text)
    return int(m.group(1)) if m else None


def _is_date_filename(fname: str) -> bool:
    """Check if filename matches YYYY-MM-DD.md pattern."""
    return bool(re.match(r"^\d{4}-\d{2}-\d{2}\.md$", fname))


def _extract_thread_date(text: str) -> Optional[str]:
    """Extract date from connecting-threads content like '**Thread written:** March 11, 2026'."""
    m = re.search(r"\*\*Thread written:\*\*\s*(.+?)$", text, re.MULTILINE)
    if m:
        try:
            dt = datetime.strptime(m.group(1).strip(), "%B %d, %Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None


def _extract_thread_title(text: str) -> Optional[str]:
    """Extract title from connecting-threads content like '# Connecting Thread: The Title'."""
    m = re.search(r"^#\s+(?:Connecting Thread:\s*)?(.+)$", text, re.MULTILINE)
    return m.group(1).strip() if m else None


def get_journal_stats() -> Dict:
    """Return summary stats about the journal."""
    entries_dir = os.path.join(JOURNAL_ROOT, "entries")
    all_dates = set()
    total_words = 0
    stream_counts = {}

    for stream_key in STREAMS:
        stream_dir = os.path.join(entries_dir, stream_key)
        if not os.path.isdir(stream_dir):
            stream_counts[stream_key] = 0
            continue
        files = [f for f in os.listdir(stream_dir) if f.endswith(".md")]
        stream_counts[stream_key] = len(files)
        for fname in files:
            content = _read_file(os.path.join(stream_dir, fname))
            if content:
                total_words += _word_count(content)
            # Only add date-based filenames to the date set
            if _is_date_filename(fname):
                all_dates.add(fname.replace(".md", ""))

    sorted_dates = sorted(all_dates)
    return {
        "total_entries": sum(stream_counts.values()),
        "total_words": total_words,
        "streams": stream_counts,
        "date_range": {
            "first": sorted_dates[0] if sorted_dates else None,
            "last": sorted_dates[-1] if sorted_dates else None,
        },
    }


def list_entries(
    stream: str = "all",
    limit: int = 50,
    offset: int = 0,
) -> Dict:
    """List entry dates with metadata for all streams."""
    entries_dir = os.path.join(JOURNAL_ROOT, "entries")
    date_map: Dict[str, Dict] = {}
    connecting_threads: List[Dict] = []

    streams_to_scan = list(STREAMS.keys()) if stream == "all" else [stream]

    for stream_key in streams_to_scan:
        stream_dir = os.path.join(entries_dir, stream_key)
        if not os.path.isdir(stream_dir):
            continue
        for fname in os.listdir(stream_dir):
            if not fname.endswith(".md"):
                continue
            content = _read_file(os.path.join(stream_dir, fname))
            if not content:
                continue

            # Connecting-threads use slug filenames, not dates
            if stream_key == "connecting-threads":
                slug = fname.replace(".md", "")
                thread_date = _extract_thread_date(content) or ""
                thread_title = _extract_thread_title(content) or slug.replace("-", " ").title()
                connecting_threads.append({
                    "slug": slug,
                    "filename": fname,
                    "date": thread_date,
                    "title": thread_title,
                    "word_count": _word_count(content),
                    "preview": _extract_preview(content),
                    "stream": "connecting-threads",
                })
                continue

            date_str = fname.replace(".md", "")
            if date_str not in date_map:
                date_map[date_str] = {"date": date_str, "streams": {}}

            date_map[date_str]["streams"][stream_key] = {
                "title": STREAMS[stream_key],
                "word_count": _word_count(content),
                "preview": _extract_preview(content),
                "day_number": _extract_day_number(content),
            }

    # Sort reverse-chronological, then paginate
    sorted_entries = sorted(date_map.values(), key=lambda e: e["date"], reverse=True)
    total = len(sorted_entries)
    page = sorted_entries[offset : offset + limit]

    # Sort connecting threads by date descending
    connecting_threads.sort(key=lambda t: t.get("date", ""), reverse=True)

    return {
        "entries": page,
        "connecting_threads": connecting_threads,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


def get_entry(date: str) -> Optional[Dict]:
    """Get full content of both streams for a given date."""
    entries_dir = os.path.join(JOURNAL_ROOT, "entries")
    result = {"date": date, "streams": {}}
    found = False

    for stream_key, title in STREAMS.items():
        if stream_key == "connecting-threads":
            continue  # connecting-threads use get_connecting_thread()
        path = os.path.join(entries_dir, stream_key, f"{date}.md")
        content = _read_file(path)
        if content:
            found = True
            result["streams"][stream_key] = {
                "title": title,
                "content": content,
                "word_count": _word_count(content),
                "day_number": _extract_day_number(content),
            }

    return result if found else None


def get_connecting_thread(slug: str) -> Optional[Dict]:
    """Get full content of a connecting-threads entry by slug."""
    path = os.path.join(JOURNAL_ROOT, "entries", "connecting-threads", f"{slug}.md")
    content = _read_file(path)
    if not content:
        return None
    return {
        "slug": slug,
        "title": _extract_thread_title(content) or slug.replace("-", " ").title(),
        "date": _extract_thread_date(content) or "",
        "content": content,
        "word_count": _word_count(content),
        "stream": "connecting-threads",
    }


def delete_entry(stream: str, identifier: str) -> bool:
    """Delete a journal entry. identifier is a date (YYYY-MM-DD) or slug for connecting-threads."""
    entries_dir = os.path.join(JOURNAL_ROOT, "entries")
    if stream == "connecting-threads":
        path = os.path.join(entries_dir, stream, f"{identifier}.md")
    else:
        path = os.path.join(entries_dir, stream, f"{identifier}.md")
    if os.path.exists(path):
        os.remove(path)
        return True
    return False


def get_raw_observations() -> Dict:
    """Return raw observation files content."""
    raw_dir = os.path.join(JOURNAL_ROOT, "raw")
    return {
        "kiran": {
            "title": "Kiran Observations",
            "content": _read_file(os.path.join(raw_dir, "kiran-observations.md")) or "",
        },
        "build": {
            "title": "Build Observations",
            "content": _read_file(os.path.join(raw_dir, "build-observations.md")) or "",
        },
    }


def search_journal(query: str, limit: int = 20) -> Dict:
    """
    Full-text search across journal entries and session archive.
    Returns matching snippets with context, grouped by source type.
    """
    if not query or not query.strip():
        return {"results": [], "total": 0, "query": query}

    query_lower = query.lower().strip()
    query_terms = query_lower.split()
    results = []

    # ── Search journal entries ────────────────────────────
    entries_dir = os.path.join(JOURNAL_ROOT, "entries")
    for stream_key, stream_title in STREAMS.items():
        stream_dir = os.path.join(entries_dir, stream_key)
        if not os.path.isdir(stream_dir):
            continue
        for fname in os.listdir(stream_dir):
            if not fname.endswith(".md"):
                continue
            fpath = os.path.join(stream_dir, fname)
            content = _read_file(fpath)
            if not content:
                continue
            content_lower = content.lower()
            # Check if ALL query terms appear in the content
            if not all(term in content_lower for term in query_terms):
                continue
            # Extract matching snippets with context
            snippets = _extract_snippets(content, query_terms, max_snippets=2)
            date_str = fname.replace(".md", "")
            results.append({
                "source_type": "journal",
                "stream": stream_key,
                "stream_title": stream_title,
                "date": date_str,
                "title": f"{stream_title} — {date_str}",
                "snippets": snippets,
                "word_count": _word_count(content),
                "filename": None,
            })

    # ── Search session archive ────────────────────────────
    from services.session_archive_service import ARCHIVE_DIR, _parse_frontmatter as parse_fm
    if os.path.isdir(ARCHIVE_DIR):
        for fname in os.listdir(ARCHIVE_DIR):
            if not fname.endswith(".md") or fname == "_index.md":
                continue
            fpath = os.path.join(ARCHIVE_DIR, fname)
            content = _read_file(fpath)
            if not content:
                continue
            content_lower = content.lower()
            if not all(term in content_lower for term in query_terms):
                continue
            meta = parse_fm(content)
            snippets = _extract_snippets(content, query_terms, max_snippets=2)
            results.append({
                "source_type": "session",
                "stream": None,
                "stream_title": None,
                "date": meta.get("session_start", "")[:10],
                "title": meta.get("title", fname).replace("-", " ").title(),
                "snippets": snippets,
                "word_count": int(meta.get("total_words", 0)),
                "filename": fname,
                "session_type": meta.get("session_type", "chat"),
            })

    # Sort by date descending
    results.sort(key=lambda r: r.get("date", ""), reverse=True)
    total = len(results)
    results = results[:limit]

    return {"results": results, "total": total, "query": query}


def _extract_snippets(
    content: str, query_terms: List[str], max_snippets: int = 2, context_chars: int = 120
) -> List[str]:
    """Extract text snippets around query term matches with surrounding context."""
    snippets = []
    content_lower = content.lower()
    seen_positions = set()

    for term in query_terms:
        start = 0
        while len(snippets) < max_snippets:
            pos = content_lower.find(term, start)
            if pos < 0:
                break
            # Skip if too close to an already-found snippet
            if any(abs(pos - sp) < context_chars for sp in seen_positions):
                start = pos + len(term)
                continue
            seen_positions.add(pos)
            # Extract context window
            snippet_start = max(0, pos - context_chars)
            snippet_end = min(len(content), pos + len(term) + context_chars)
            snippet = content[snippet_start:snippet_end].strip()
            # Clean up: remove markdown formatting noise
            snippet = re.sub(r'^---\s*$', '', snippet, flags=re.MULTILINE)
            snippet = re.sub(r'^#{1,3}\s+', '', snippet, flags=re.MULTILINE)
            snippet = snippet.replace('\n', ' ').strip()
            # Add ellipsis
            if snippet_start > 0:
                snippet = "..." + snippet
            if snippet_end < len(content):
                snippet = snippet + "..."
            if snippet and len(snippet) > 20:
                snippets.append(snippet)
            start = pos + len(term)

    return snippets[:max_snippets]
