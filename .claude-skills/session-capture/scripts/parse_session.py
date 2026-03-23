#!/usr/bin/env python3
"""
parse_session.py — Reads Claude JSONL session transcript files and outputs
a clean markdown transcript with timestamps, metadata header, and auto-generated title.

Usage:
    python parse_session.py <jsonl_path> --output-dir <dir> [--chat-drops-dir <dir>]

Outputs:
    - A markdown file to output-dir (session-archive) with YAML frontmatter
    - Optionally a copy to chat-drops-dir for Fenix Journal processing
    - Updates _index.md in output-dir
"""

import json
import os
import re
import sys
import argparse
from datetime import datetime, timezone
from typing import List, Dict, Optional, Tuple


def parse_jsonl(path: str) -> List[Dict]:
    """Read a JSONL file and return list of parsed JSON objects."""
    records = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return records


def extract_messages(records: List[Dict]) -> List[Dict]:
    """
    Extract user and assistant messages from JSONL records.
    Returns list of {role, content, timestamp} dicts.
    """
    messages = []
    seen_ids = set()

    for record in records:
        # Only process user and assistant message records
        if record.get("type") not in ("user", "assistant"):
            continue

        msg = record.get("message", {})
        role = msg.get("role")
        if role not in ("user", "assistant"):
            continue

        # Deduplicate by message ID (assistant messages) or uuid (user messages)
        msg_id = msg.get("id") or record.get("uuid")
        if msg_id and msg_id in seen_ids:
            continue
        if msg_id:
            seen_ids.add(msg_id)

        timestamp = record.get("timestamp", "")

        # Extract text content
        content_raw = msg.get("content", "")
        if isinstance(content_raw, str):
            text = content_raw
        elif isinstance(content_raw, list):
            # Content blocks — extract text blocks, skip thinking/tool_use
            text_parts = []
            for block in content_raw:
                if isinstance(block, dict) and block.get("type") == "text":
                    text_parts.append(block.get("text", ""))
                elif isinstance(block, str):
                    text_parts.append(block)
            text = "\n\n".join(text_parts)
        else:
            continue

        text = text.strip()
        if not text:
            continue

        messages.append({
            "role": role,
            "content": text,
            "timestamp": timestamp,
        })

    return messages


def detect_session_type(records: List[Dict]) -> str:
    """
    Detect whether this is a Cowork or Chat/CLI session.
    Cowork sessions have cwd paths like /sessions/{name},
    while CLI/Chat sessions use user directories like /Users/kiran.
    """
    for record in records:
        cwd = record.get("cwd", "")
        if cwd.startswith("/sessions/"):
            return "cowork"
        if cwd and not cwd.startswith("/sessions/"):
            return "chat"
    return "chat"


def generate_title(messages: List[Dict], max_words: int = 8) -> str:
    """
    Auto-generate a short descriptive title from the first user message.
    Returns a lowercase-kebab-case slug.
    """
    for msg in messages:
        if msg["role"] == "user":
            # Take first sentence or first N words
            text = msg["content"].strip()
            # Remove markdown formatting
            text = re.sub(r'[#*`\[\]()]', '', text)
            # Take first line
            first_line = text.split('\n')[0].strip()
            # Take first N words
            words = first_line.split()[:max_words]
            title = " ".join(words)
            # Clean up for filename
            slug = re.sub(r'[^a-z0-9\s-]', '', title.lower())
            slug = re.sub(r'\s+', '-', slug.strip())
            slug = slug[:60]  # max length
            return slug or "untitled-session"
    return "untitled-session"


def format_timestamp(ts: str) -> str:
    """Format ISO timestamp to human-readable form."""
    if not ts:
        return "Unknown time"
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d %H:%M:%S UTC")
    except (ValueError, TypeError):
        return ts


def format_timestamp_short(ts: str) -> str:
    """Format ISO timestamp to HH:MM."""
    if not ts:
        return ""
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return dt.strftime("%H:%M")
    except (ValueError, TypeError):
        return ""


def get_session_date_range(messages: List[Dict]) -> Tuple[str, str]:
    """Return (first_timestamp, last_timestamp) from messages."""
    timestamps = [m["timestamp"] for m in messages if m.get("timestamp")]
    if not timestamps:
        return ("", "")
    return (timestamps[0], timestamps[-1])


def build_markdown(
    messages: List[Dict],
    session_id: str,
    source_file: str,
    title_slug: str,
    session_type: str = "chat",
) -> str:
    """Build the full markdown transcript with YAML frontmatter."""
    first_ts, last_ts = get_session_date_range(messages)

    user_msg_count = sum(1 for m in messages if m["role"] == "user")
    assistant_msg_count = sum(1 for m in messages if m["role"] == "assistant")
    total_words = sum(len(m["content"].split()) for m in messages)

    # YAML frontmatter
    lines = [
        "---",
        f"title: {title_slug}",
        f"session_id: {session_id}",
        f"source: {os.path.basename(source_file)}",
        f"captured_at: {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}",
        f"session_type: {session_type}",
        f"session_start: {first_ts}",
        f"session_end: {last_ts}",
        f"message_count: {user_msg_count + assistant_msg_count}",
        f"user_messages: {user_msg_count}",
        f"assistant_messages: {assistant_msg_count}",
        f"total_words: {total_words}",
        "---",
        "",
        f"# Session: {title_slug.replace('-', ' ').title()}",
        "",
        f"**Date range:** {format_timestamp(first_ts)} → {format_timestamp(last_ts)}",
        f"**Messages:** {user_msg_count} from Kiran, {assistant_msg_count} from Claude",
        f"**Total words:** {total_words:,}",
        "",
        "---",
        "",
    ]

    for msg in messages:
        role_label = "Kiran" if msg["role"] == "user" else "Claude"
        time_str = format_timestamp_short(msg["timestamp"])
        time_badge = f" `{time_str}`" if time_str else ""

        lines.append(f"### {role_label}{time_badge}")
        lines.append("")
        lines.append(msg["content"])
        lines.append("")
        lines.append("---")
        lines.append("")

    return "\n".join(lines)


def update_index(archive_dir: str):
    """Rebuild _index.md from all session files in the archive directory."""
    index_path = os.path.join(archive_dir, "_index.md")
    entries = []

    for fname in sorted(os.listdir(archive_dir), reverse=True):
        if not fname.endswith(".md") or fname == "_index.md":
            continue

        fpath = os.path.join(archive_dir, fname)
        with open(fpath, "r", encoding="utf-8") as f:
            content = f.read()

        # Parse YAML frontmatter
        meta = {}
        if content.startswith("---"):
            end = content.find("---", 3)
            if end > 0:
                for line in content[3:end].strip().split("\n"):
                    if ":" in line:
                        key, val = line.split(":", 1)
                        meta[key.strip()] = val.strip()

        title = meta.get("title", fname.replace(".md", ""))
        session_start = meta.get("session_start", "")
        total_words = meta.get("total_words", "?")
        msg_count = meta.get("message_count", "?")

        entries.append(
            f"| {format_timestamp(session_start)[:10]} | {title.replace('-', ' ').title()} | {msg_count} | {total_words} | `{fname}` |"
        )

    index_content = [
        "# Session Archive Index",
        "",
        f"*Last updated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}*",
        "",
        f"**Total sessions:** {len(entries)}",
        "",
        "| Date | Title | Messages | Words | File |",
        "|------|-------|----------|-------|------|",
    ]
    index_content.extend(entries)
    index_content.append("")

    with open(index_path, "w", encoding="utf-8") as f:
        f.write("\n".join(index_content))

    return len(entries)


def main():
    parser = argparse.ArgumentParser(description="Parse Claude session JSONL into markdown transcript")
    parser.add_argument("jsonl_path", help="Path to the JSONL session file")
    parser.add_argument("--output-dir", required=True, help="Directory for permanent session archive")
    parser.add_argument("--chat-drops-dir", default=None, help="Optional: Fenix Journal chat-drops directory")
    parser.add_argument("--dry-run", action="store_true", help="Print output without writing files")
    args = parser.parse_args()

    if not os.path.exists(args.jsonl_path):
        print(f"Error: File not found: {args.jsonl_path}", file=sys.stderr)
        sys.exit(1)

    # Parse
    records = parse_jsonl(args.jsonl_path)
    messages = extract_messages(records)

    if not messages:
        print("No messages found in session file.", file=sys.stderr)
        sys.exit(1)

    # Generate metadata
    session_id = os.path.basename(args.jsonl_path).replace(".jsonl", "")
    session_type = detect_session_type(records)
    title_slug = generate_title(messages)
    first_ts, _ = get_session_date_range(messages)

    # Build filename: YYYY-MM-DD-HHMMSS-title-slug.md
    try:
        dt = datetime.fromisoformat(first_ts.replace("Z", "+00:00"))
        date_prefix = dt.strftime("%Y-%m-%d-%H%M%S")
    except (ValueError, TypeError):
        date_prefix = datetime.now().strftime("%Y-%m-%d-%H%M%S")

    filename = f"{date_prefix}-{title_slug}.md"

    # Build markdown
    markdown = build_markdown(messages, session_id, args.jsonl_path, title_slug, session_type)

    if args.dry_run:
        print(f"Would write: {filename}")
        print(f"Messages: {len(messages)}")
        print(f"Words: {sum(len(m['content'].split()) for m in messages)}")
        print("---")
        print(markdown[:2000])
        return

    # Write to archive
    os.makedirs(args.output_dir, exist_ok=True)
    archive_path = os.path.join(args.output_dir, filename)
    with open(archive_path, "w", encoding="utf-8") as f:
        f.write(markdown)
    print(f"Archive: {archive_path}")

    # Write to chat-drops (if specified)
    if args.chat_drops_dir:
        os.makedirs(args.chat_drops_dir, exist_ok=True)
        drops_path = os.path.join(args.chat_drops_dir, filename)
        with open(drops_path, "w", encoding="utf-8") as f:
            f.write(markdown)
        print(f"Chat drop: {drops_path}")

    # Update index
    count = update_index(args.output_dir)
    print(f"Index updated: {count} sessions")
    print(f"Filename: {filename}")


if __name__ == "__main__":
    main()
