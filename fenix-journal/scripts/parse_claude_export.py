#!/usr/bin/env python3
"""
parse_claude_export.py — Converts Claude.ai data export (conversations.json)
into the same markdown transcript format as parse_session.py for Fenix Journal.

Usage:
    python parse_claude_export.py <conversations.json> \
        --output-dir <session-archive-dir> \
        --chat-drops-dir <chat-drops-dir> \
        [--skip-existing]
"""

import json
import os
import re
import sys
import argparse
from datetime import datetime, timezone
from typing import List, Dict, Tuple


def load_conversations(path: str) -> List[Dict]:
    """Load conversations.json from Claude.ai export."""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def extract_messages(conversation: Dict) -> List[Dict]:
    """Extract messages from a conversation in Claude.ai export format."""
    messages = []
    for msg in conversation.get("chat_messages", []):
        sender = msg.get("sender", "")
        if sender == "human":
            role = "user"
        elif sender == "assistant":
            role = "assistant"
        else:
            continue

        # Get text content
        text = msg.get("text", "").strip()
        if not text:
            # Try content field as fallback
            content = msg.get("content", "")
            if isinstance(content, str):
                text = content.strip()
            elif isinstance(content, list):
                parts = []
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        parts.append(block.get("text", ""))
                    elif isinstance(block, str):
                        parts.append(block)
                text = "\n\n".join(parts).strip()

        if not text:
            continue

        timestamp = msg.get("created_at", "")

        messages.append({
            "role": role,
            "content": text,
            "timestamp": timestamp,
        })

    return messages


def generate_title(conversation: Dict, messages: List[Dict], max_words: int = 8) -> str:
    """Generate title slug from conversation name or first user message."""
    # Prefer the conversation name from Claude.ai
    name = conversation.get("name", "").strip()
    if name:
        slug = re.sub(r'[^a-z0-9\s-]', '', name.lower())
        slug = re.sub(r'\s+', '-', slug.strip())
        return slug[:60] or "untitled-session"

    # Fallback to first user message
    for msg in messages:
        if msg["role"] == "user":
            text = msg["content"].strip()
            text = re.sub(r'[#*`\[\]()]', '', text)
            first_line = text.split('\n')[0].strip()
            words = first_line.split()[:max_words]
            title = " ".join(words)
            slug = re.sub(r'[^a-z0-9\s-]', '', title.lower())
            slug = re.sub(r'\s+', '-', slug.strip())
            return slug[:60] or "untitled-session"

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


def get_date_range(messages: List[Dict]) -> Tuple[str, str]:
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
    conversation_name: str = "",
) -> str:
    """Build the full markdown transcript with YAML frontmatter."""
    first_ts, last_ts = get_date_range(messages)

    user_count = sum(1 for m in messages if m["role"] == "user")
    assistant_count = sum(1 for m in messages if m["role"] == "assistant")
    total_words = sum(len(m["content"].split()) for m in messages)

    # Use conversation name for the title if available
    display_title = conversation_name if conversation_name else title_slug.replace('-', ' ').title()

    lines = [
        "---",
        f"title: {title_slug}",
        f"session_id: {session_id}",
        f"source: claude-ai-export",
        f"captured_at: {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}",
        f"session_type: {session_type}",
        f"session_start: {first_ts}",
        f"session_end: {last_ts}",
        f"message_count: {user_count + assistant_count}",
        f"user_messages: {user_count}",
        f"assistant_messages: {assistant_count}",
        f"total_words: {total_words}",
        "---",
        "",
        f"# Session: {display_title}",
        "",
        f"**Date range:** {format_timestamp(first_ts)} → {format_timestamp(last_ts)}",
        f"**Messages:** {user_count} from Kiran, {assistant_count} from Claude",
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


def update_index(archive_dir: str) -> int:
    """Rebuild _index.md from all session files in the archive directory."""
    index_path = os.path.join(archive_dir, "_index.md")
    entries = []

    for fname in sorted(os.listdir(archive_dir), reverse=True):
        if not fname.endswith(".md") or fname == "_index.md":
            continue

        fpath = os.path.join(archive_dir, fname)
        with open(fpath, "r", encoding="utf-8") as f:
            content = f.read()

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


def get_existing_session_ids(archive_dir: str) -> set:
    """Read all session_ids already in the archive."""
    ids = set()
    if not os.path.isdir(archive_dir):
        return ids
    for fname in os.listdir(archive_dir):
        if not fname.endswith(".md") or fname == "_index.md":
            continue
        fpath = os.path.join(archive_dir, fname)
        with open(fpath, "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("session_id:"):
                    ids.add(line.split(":", 1)[1].strip())
                    break
                if line == "---" and len(ids) == 0:
                    continue
                if not line.startswith("---") and ":" not in line:
                    break
    return ids


def main():
    parser = argparse.ArgumentParser(description="Parse Claude.ai export into session archive markdown")
    parser.add_argument("export_path", help="Path to conversations.json from Claude.ai export")
    parser.add_argument("--output-dir", required=True, help="Directory for permanent session archive")
    parser.add_argument("--chat-drops-dir", default=None, help="Optional: Fenix Journal chat-drops directory")
    parser.add_argument("--skip-existing", action="store_true", help="Skip conversations already in archive")
    args = parser.parse_args()

    if not os.path.exists(args.export_path):
        print(f"Error: File not found: {args.export_path}", file=sys.stderr)
        sys.exit(1)

    conversations = load_conversations(args.export_path)
    print(f"Found {len(conversations)} conversations in export")

    # Get existing session IDs to skip duplicates
    existing_ids = set()
    if args.skip_existing:
        existing_ids = get_existing_session_ids(args.output_dir)
        print(f"Found {len(existing_ids)} existing sessions in archive")

    os.makedirs(args.output_dir, exist_ok=True)
    if args.chat_drops_dir:
        os.makedirs(args.chat_drops_dir, exist_ok=True)

    captured = 0
    skipped = 0

    for conv in conversations:
        session_id = conv.get("uuid", "unknown")

        # Skip if already archived
        if session_id in existing_ids:
            skipped += 1
            continue

        messages = extract_messages(conv)
        if not messages:
            skipped += 1
            continue

        # Skip very short conversations (just 1 message with no reply)
        if len(messages) < 2:
            skipped += 1
            continue

        title_slug = generate_title(conv, messages)
        conversation_name = conv.get("name", "").strip()
        first_ts = messages[0].get("timestamp", "") if messages else ""

        # Build filename
        try:
            dt = datetime.fromisoformat(first_ts.replace("Z", "+00:00"))
            date_prefix = dt.strftime("%Y-%m-%d-%H%M%S")
        except (ValueError, TypeError):
            date_prefix = datetime.now().strftime("%Y-%m-%d-%H%M%S")

        filename = f"{date_prefix}-{title_slug}.md"

        # Build markdown
        markdown = build_markdown(
            messages, session_id, "claude-ai-export",
            title_slug, "chat", conversation_name
        )

        # Write to archive
        archive_path = os.path.join(args.output_dir, filename)
        with open(archive_path, "w", encoding="utf-8") as f:
            f.write(markdown)

        # Write to chat-drops
        if args.chat_drops_dir:
            drops_path = os.path.join(args.chat_drops_dir, filename)
            with open(drops_path, "w", encoding="utf-8") as f:
                f.write(markdown)

        captured += 1
        print(f"  [{captured}] {filename} ({len(messages)} msgs, {sum(len(m['content'].split()) for m in messages)} words)")

    # Update index
    total = update_index(args.output_dir)
    print(f"\nDone: {captured} captured, {skipped} skipped, {total} total in archive")


if __name__ == "__main__":
    main()
