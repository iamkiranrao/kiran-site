"""
Session Archive Service — reads, lists, and deletes archived session transcripts
from the fenix-journal/session-archive directory.
"""

import os
import re
from typing import Optional, List, Dict

# ── Resolve archive root ────────────────────────────────────
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_COMMAND_CENTER = os.path.dirname(_BACKEND_DIR)
_REPO_ROOT = os.path.dirname(_COMMAND_CENTER)
JOURNAL_ROOT = os.path.join(_REPO_ROOT, "fenix-journal")
ARCHIVE_DIR = os.path.join(JOURNAL_ROOT, "session-archive")
CHAT_DROPS_DIR = os.path.join(JOURNAL_ROOT, "raw", "chat-drops")


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


def _extract_preview(content: str, max_chars: int = 200) -> str:
    """Extract first user message as preview."""
    # Find the first "### Kiran" section
    match = re.search(r"### Kiran[^\n]*\n\n(.+?)(?=\n---|\n###)", content, re.DOTALL)
    if match:
        preview = match.group(1).strip()
        # Clean markdown formatting
        preview = re.sub(r'[#*`\[\]()]', '', preview)
        return preview[:max_chars] + ("..." if len(preview) > max_chars else "")
    return ""


def list_sessions(limit: int = 50, offset: int = 0) -> Dict:
    """List all archived sessions with metadata, newest first."""
    if not os.path.isdir(ARCHIVE_DIR):
        return {"sessions": [], "total": 0, "limit": limit, "offset": offset}

    sessions = []
    for fname in sorted(os.listdir(ARCHIVE_DIR), reverse=True):
        if not fname.endswith(".md") or fname == "_index.md":
            continue

        fpath = os.path.join(ARCHIVE_DIR, fname)
        content = _read_file(fpath)
        if not content:
            continue

        meta = _parse_frontmatter(content)
        preview = _extract_preview(content)

        sessions.append({
            "filename": fname,
            "title": meta.get("title", fname.replace(".md", "")).replace("-", " ").title(),
            "session_id": meta.get("session_id", ""),
            "session_type": meta.get("session_type", "chat"),
            "captured_at": meta.get("captured_at", ""),
            "session_start": meta.get("session_start", ""),
            "session_end": meta.get("session_end", ""),
            "message_count": int(meta.get("message_count", 0)),
            "user_messages": int(meta.get("user_messages", 0)),
            "assistant_messages": int(meta.get("assistant_messages", 0)),
            "total_words": int(meta.get("total_words", 0)),
            "preview": preview,
        })

    total = len(sessions)
    page = sessions[offset: offset + limit]
    return {"sessions": page, "total": total, "limit": limit, "offset": offset}


def get_session(filename: str) -> Optional[Dict]:
    """Get full content of a specific session transcript."""
    if not filename.endswith(".md") or filename == "_index.md":
        return None

    # Prevent path traversal
    if "/" in filename or "\\" in filename or ".." in filename:
        return None

    fpath = os.path.join(ARCHIVE_DIR, filename)
    content = _read_file(fpath)
    if not content:
        return None

    meta = _parse_frontmatter(content)

    # Extract the body (everything after frontmatter)
    body = content
    if content.startswith("---"):
        end = content.find("---", 3)
        if end > 0:
            body = content[end + 3:].strip()

    return {
        "filename": filename,
        "title": meta.get("title", filename.replace(".md", "")).replace("-", " ").title(),
        "session_id": meta.get("session_id", ""),
        "session_type": meta.get("session_type", "chat"),
        "captured_at": meta.get("captured_at", ""),
        "session_start": meta.get("session_start", ""),
        "session_end": meta.get("session_end", ""),
        "message_count": int(meta.get("message_count", 0)),
        "user_messages": int(meta.get("user_messages", 0)),
        "assistant_messages": int(meta.get("assistant_messages", 0)),
        "total_words": int(meta.get("total_words", 0)),
        "content": body,
    }


def delete_session(filename: str) -> Dict:
    """
    Delete a session from the archive and also from chat-drops if it hasn't
    been processed yet. Returns status info.
    """
    if not filename.endswith(".md") or filename == "_index.md":
        return {"deleted": False, "error": "Invalid filename"}

    # Prevent path traversal
    if "/" in filename or "\\" in filename or ".." in filename:
        return {"deleted": False, "error": "Invalid filename"}

    archive_path = os.path.join(ARCHIVE_DIR, filename)
    chat_drops_path = os.path.join(CHAT_DROPS_DIR, filename)

    deleted_from = []

    if os.path.exists(archive_path):
        os.remove(archive_path)
        deleted_from.append("archive")

    if os.path.exists(chat_drops_path):
        os.remove(chat_drops_path)
        deleted_from.append("chat-drops")

    if not deleted_from:
        return {"deleted": False, "error": "File not found"}

    # Rebuild index
    _rebuild_index()

    return {"deleted": True, "deleted_from": deleted_from, "filename": filename}


def get_archive_stats() -> Dict:
    """Return summary stats about the session archive."""
    if not os.path.isdir(ARCHIVE_DIR):
        return {"total_sessions": 0, "total_words": 0, "total_messages": 0}

    total_sessions = 0
    total_words = 0
    total_messages = 0

    for fname in os.listdir(ARCHIVE_DIR):
        if not fname.endswith(".md") or fname == "_index.md":
            continue

        fpath = os.path.join(ARCHIVE_DIR, fname)
        content = _read_file(fpath)
        if not content:
            continue

        meta = _parse_frontmatter(content)
        total_sessions += 1
        total_words += int(meta.get("total_words", 0))
        total_messages += int(meta.get("message_count", 0))

    return {
        "total_sessions": total_sessions,
        "total_words": total_words,
        "total_messages": total_messages,
    }


def _rebuild_index():
    """Rebuild _index.md from all session files in archive."""
    if not os.path.isdir(ARCHIVE_DIR):
        return

    entries = []
    for fname in sorted(os.listdir(ARCHIVE_DIR), reverse=True):
        if not fname.endswith(".md") or fname == "_index.md":
            continue

        fpath = os.path.join(ARCHIVE_DIR, fname)
        content = _read_file(fpath)
        if not content:
            continue

        meta = _parse_frontmatter(content)
        title = meta.get("title", fname).replace("-", " ").title()
        start = meta.get("session_start", "")[:10]
        words = meta.get("total_words", "?")
        msgs = meta.get("message_count", "?")

        entries.append(f"| {start} | {title} | {msgs} | {words} | `{fname}` |")

    from datetime import datetime, timezone
    index_lines = [
        "# Session Archive Index",
        "",
        f"*Last updated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}*",
        "",
        f"**Total sessions:** {len(entries)}",
        "",
        "| Date | Title | Messages | Words | File |",
        "|------|-------|----------|-------|------|",
    ]
    index_lines.extend(entries)
    index_lines.append("")

    index_path = os.path.join(ARCHIVE_DIR, "_index.md")
    with open(index_path, "w", encoding="utf-8") as f:
        f.write("\n".join(index_lines))
