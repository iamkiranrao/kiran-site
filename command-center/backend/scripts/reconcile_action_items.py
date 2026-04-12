#!/usr/bin/env python3
"""
Action Items Reconciliation Script — CC API vs. ACTION-TRACKER.md

Compares action items in the Command Center backend with entries in the
site repo's ACTION-TRACKER.md file to identify tracking drift.

Reports:
- Items in CC but not in tracker (missing from static reference)
- Items in tracker but not in CC (missing from primary system)
- Items with mismatched status (drift between sources)

Run from backend/ directory:
  python scripts/reconcile_action_items.py
  python scripts/reconcile_action_items.py --dry-run
  python scripts/reconcile_action_items.py --fix
  python scripts/reconcile_action_items.py --verbose
  python scripts/reconcile_action_items.py --fix --verbose

Options:
  --dry-run       Show discrepancies but don't write changes (default)
  --fix           Apply fixes: create missing items in CC, update status
  --verbose       Show detailed item-by-item analysis
  --json          Output report as JSON instead of colored text
"""

import json
import os
import sys
import argparse
import re
import requests
from datetime import datetime, timezone
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# ── Constants ────────────────────────────────────────────────────

CC_API_URL = "https://cc.kiranrao.ai"
CC_API_KEY = os.getenv("CC_API_KEY") or "H3Ycu0N5kfv5MERh_5mYwYcMbGu6pYUv2y1KSgsMBLk"

# Project root path (backend/ -> command-center/ -> Kiran's Website/)
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
TRACKER_FILE = os.path.join(PROJECT_ROOT, "ACTION-TRACKER.md")

# ANSI color codes
class Colors:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    WHITE = "\033[97m"

# Status mapping: tracker emoji → CC status
STATUS_MAP = {
    "✅": "done",
    "🟢": "in-progress",
    "🟡": "todo",
    "🔴": "blocked",
}

# Reverse mapping
STATUS_TO_EMOJI = {
    "done": "✅",
    "in-progress": "🟢",
    "todo": "🟡",
    "blocked": "🔴",
}

# ── Data Models ────────────────────────────────────────────────────

@dataclass
class TrackerItem:
    """Represents an action item from ACTION-TRACKER.md"""
    number: int
    title: str
    status: str  # todo, in-progress, blocked, done
    is_done: bool
    raw_line: str  # Original line for context

@dataclass
class CCItem:
    """Represents an action item from CC API"""
    id: str
    title: str
    status: str  # todo, in-progress, blocked, done, wont-do
    workstream: str
    priority: str
    created_at: str

@dataclass
class Discrepancy:
    """Represents a mismatch between tracker and CC"""
    type: str  # 'missing_from_tracker', 'missing_from_cc', 'status_mismatch'
    tracker_item: Optional[TrackerItem]
    cc_item: Optional[CCItem]
    message: str

# ── Helpers ────────────────────────────────────────────────────────

def print_colored(text: str, color: str = Colors.WHITE):
    """Print text with ANSI color."""
    print(f"{color}{text}{Colors.RESET}")

def print_section(title: str):
    """Print a section header."""
    print_colored(f"\n{'=' * 70}", Colors.CYAN)
    print_colored(f"  {title}", Colors.CYAN + Colors.BOLD)
    print_colored(f"{'=' * 70}\n", Colors.CYAN)

def fetch_cc_items() -> List[CCItem]:
    """Fetch all action items from CC API."""
    try:
        headers = {"X-API-Key": CC_API_KEY}
        response = requests.get(
            f"{CC_API_URL}/api/action-items/?limit=999&include_done=true",
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        data = response.json()

        items = []
        for item in data.get("items", []):
            items.append(CCItem(
                id=item["id"],
                title=item["title"],
                status=item["status"],
                workstream=item.get("workstream", "cross-cutting"),
                priority=item.get("priority", "medium"),
                created_at=item.get("created_at", "")
            ))
        return items
    except requests.exceptions.RequestException as e:
        print_colored(f"ERROR: Failed to fetch from CC API: {e}", Colors.RED)
        sys.exit(1)

def parse_tracker_file() -> List[TrackerItem]:
    """Parse ACTION-TRACKER.md and extract action items."""
    if not os.path.exists(TRACKER_FILE):
        print_colored(f"ERROR: Tracker file not found: {TRACKER_FILE}", Colors.RED)
        sys.exit(1)

    items = []
    with open(TRACKER_FILE, 'r') as f:
        lines = f.readlines()

    for line_num, line in enumerate(lines, 1):
        # Look for markdown table rows: | # | title | status | ...
        match = re.match(r'\|\s*(\d+)\s*\|\s*([🔴🟡🟢✅])\s+(.+?)\s*\|', line)
        if match:
            number = int(match.group(1))
            emoji = match.group(2)
            title = match.group(3).strip()

            status = STATUS_MAP.get(emoji, "todo")
            is_done = emoji == "✅"

            items.append(TrackerItem(
                number=number,
                title=title,
                status=status,
                is_done=is_done,
                raw_line=line.strip()
            ))

    return items

def normalize_title(title: str) -> str:
    """Normalize title for fuzzy matching (lowercase, strip punctuation)."""
    title = title.lower()
    # Remove common prefixes
    title = re.sub(r'^(build|create|write|setup|deploy|fix|update|refresh|add|remove)\s+', '', title)
    # Remove common suffixes
    title = re.sub(r'\s+(on\s+.*|via\s+.*|with\s+.*|for\s+.*)$', '', title)
    return title

def find_matching_cc_item(tracker_item: TrackerItem, cc_items: List[CCItem]) -> Optional[CCItem]:
    """Find a CC item that matches a tracker item (fuzzy match on title)."""
    tracker_norm = normalize_title(tracker_item.title)

    # Exact match first
    for cc_item in cc_items:
        if tracker_item.title.lower() == cc_item.title.lower():
            return cc_item

    # Fuzzy match: check if normalized titles share significant overlap
    for cc_item in cc_items:
        cc_norm = normalize_title(cc_item.title)
        # Simple heuristic: if >70% of words match
        tracker_words = set(tracker_norm.split())
        cc_words = set(cc_norm.split())
        if tracker_words and cc_words:
            overlap = len(tracker_words & cc_words)
            total = max(len(tracker_words), len(cc_words))
            if overlap / total > 0.7:
                return cc_item

    return None

def reconcile(cc_items: List[CCItem], tracker_items: List[TrackerItem]) -> List[Discrepancy]:
    """Compare CC items with tracker items."""
    discrepancies: List[Discrepancy] = []
    matched_cc_ids = set()
    matched_tracker_ids = set()

    # Find matches and status mismatches
    for tracker_item in tracker_items:
        cc_match = find_matching_cc_item(tracker_item, cc_items)

        if cc_match:
            matched_tracker_ids.add(tracker_item.number)
            matched_cc_ids.add(cc_match.id)

            # Check for status mismatch
            if tracker_item.status != cc_match.status:
                discrepancies.append(Discrepancy(
                    type="status_mismatch",
                    tracker_item=tracker_item,
                    cc_item=cc_match,
                    message=f"Status mismatch: tracker={tracker_item.status}, CC={cc_match.status}"
                ))
        else:
            # Item in tracker but not in CC
            discrepancies.append(Discrepancy(
                type="missing_from_cc",
                tracker_item=tracker_item,
                cc_item=None,
                message=f"Missing from CC: #{tracker_item.number} {tracker_item.title}"
            ))

    # Find CC items not in tracker
    for cc_item in cc_items:
        if cc_item.id not in matched_cc_ids:
            # Skip done/wont-do items in CC (expected to not be in tracker)
            if cc_item.status not in ("done", "wont-do"):
                discrepancies.append(Discrepancy(
                    type="missing_from_tracker",
                    tracker_item=None,
                    cc_item=cc_item,
                    message=f"Missing from tracker: {cc_item.title} ({cc_item.workstream})"
                ))

    return discrepancies

def apply_fixes(discrepancies: List[Discrepancy]) -> Tuple[int, int, List[str]]:
    """Apply fixes to CC API (create missing, update status mismatches)."""
    created = 0
    updated = 0
    errors = []
    headers = {"X-API-Key": CC_API_KEY}

    for disc in discrepancies:
        try:
            if disc.type == "missing_from_cc" and disc.tracker_item:
                # Create new item in CC
                payload = {
                    "title": disc.tracker_item.title,
                    "description": f"Reconciled from ACTION-TRACKER.md (item #{disc.tracker_item.number})",
                    "workstream": "cross-cutting",
                    "priority": "medium",
                    "status": disc.tracker_item.status,
                    "source": "tracker-reconciliation"
                }
                response = requests.post(
                    f"{CC_API_URL}/api/action-items/",
                    json=payload,
                    headers=headers,
                    timeout=10
                )
                response.raise_for_status()
                created += 1

            elif disc.type == "status_mismatch" and disc.cc_item:
                # Update status in CC (CC is source of truth)
                payload = {"status": disc.cc_item.status}
                response = requests.put(
                    f"{CC_API_URL}/api/action-items/{disc.cc_item.id}",
                    json=payload,
                    headers=headers,
                    timeout=10
                )
                response.raise_for_status()
                updated += 1

        except requests.exceptions.RequestException as e:
            errors.append(f"Failed to update {disc.message}: {e}")

    return created, updated, errors

# ── Report Generation ────────────────────────────────────────────────────

def print_text_report(discrepancies: List[Discrepancy], verbose: bool = False):
    """Print human-readable report."""
    if not discrepancies:
        print_colored("✓ No discrepancies found. Tracker and CC are in sync.\n", Colors.GREEN)
        return

    # Group by type
    missing_tracker = [d for d in discrepancies if d.type == "missing_from_tracker"]
    missing_cc = [d for d in discrepancies if d.type == "missing_from_cc"]
    status_mismatch = [d for d in discrepancies if d.type == "status_mismatch"]

    # Print summary
    print_colored(f"Found {len(discrepancies)} discrepanc{'y' if len(discrepancies) == 1 else 'ies'}:\n", Colors.YELLOW)
    if missing_tracker:
        print_colored(f"  • {len(missing_tracker)} items in CC but NOT in tracker", Colors.BLUE)
    if missing_cc:
        print_colored(f"  • {len(missing_cc)} items in tracker but NOT in CC", Colors.YELLOW)
    if status_mismatch:
        print_colored(f"  • {len(status_mismatch)} items with status mismatch", Colors.RED)

    # Detail: Missing from tracker
    if missing_tracker:
        print_section("Missing from Tracker (in CC)")
        for disc in missing_tracker:
            if disc.cc_item:
                status_emoji = STATUS_TO_EMOJI.get(disc.cc_item.status, "❓")
                print_colored(
                    f"{status_emoji} [{disc.cc_item.workstream:20}] {disc.cc_item.title[:60]}",
                    Colors.BLUE
                )
                if verbose:
                    print_colored(f"    ID: {disc.cc_item.id} | Priority: {disc.cc_item.priority}", Colors.DIM)

    # Detail: Missing from CC
    if missing_cc:
        print_section("Missing from CC (in Tracker)")
        for disc in missing_cc:
            if disc.tracker_item:
                status_emoji = STATUS_TO_EMOJI.get(disc.tracker_item.status, "❓")
                print_colored(
                    f"{status_emoji} #{disc.tracker_item.number} {disc.tracker_item.title[:60]}",
                    Colors.YELLOW
                )
                if verbose:
                    print_colored(f"    Action: Create in CC with status={disc.tracker_item.status}", Colors.DIM)

    # Detail: Status mismatches
    if status_mismatch:
        print_section("Status Mismatches")
        for disc in status_mismatch:
            if disc.tracker_item and disc.cc_item:
                tracker_emoji = STATUS_TO_EMOJI.get(disc.tracker_item.status, "❓")
                cc_emoji = STATUS_TO_EMOJI.get(disc.cc_item.status, "❓")
                print_colored(
                    f"  {tracker_emoji} (tracker) → {cc_emoji} (CC): {disc.tracker_item.title[:55]}",
                    Colors.RED
                )
                if verbose:
                    print_colored(
                        f"     CC status is authoritative. Tracker entry #{disc.tracker_item.number} should update to {disc.cc_item.status}",
                        Colors.DIM
                    )

def print_json_report(discrepancies: List[Discrepancy]) -> str:
    """Return JSON report."""
    data = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "total": len(discrepancies),
            "missing_from_tracker": len([d for d in discrepancies if d.type == "missing_from_tracker"]),
            "missing_from_cc": len([d for d in discrepancies if d.type == "missing_from_cc"]),
            "status_mismatches": len([d for d in discrepancies if d.type == "status_mismatch"]),
        },
        "discrepancies": [
            {
                "type": d.type,
                "message": d.message,
                "tracker": {
                    "number": d.tracker_item.number,
                    "title": d.tracker_item.title,
                    "status": d.tracker_item.status,
                } if d.tracker_item else None,
                "cc": {
                    "id": d.cc_item.id,
                    "title": d.cc_item.title,
                    "status": d.cc_item.status,
                    "workstream": d.cc_item.workstream,
                } if d.cc_item else None,
            }
            for d in discrepancies
        ]
    }
    return json.dumps(data, indent=2)

# ── Main ────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Reconcile action items between CC API and ACTION-TRACKER.md",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/reconcile_action_items.py              # Dry-run report
  python scripts/reconcile_action_items.py --fix        # Apply fixes to CC
  python scripts/reconcile_action_items.py --json       # Output JSON
  python scripts/reconcile_action_items.py --verbose    # Detailed output
        """
    )
    parser.add_argument(
        "--fix",
        action="store_true",
        help="Apply fixes: create missing items in CC, update status"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Show discrepancies but don't write changes (default behavior)"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Show detailed item-by-item analysis"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output report as JSON instead of colored text"
    )

    args = parser.parse_args()

    # Fetch data
    print_colored("Fetching action items from CC API...", Colors.CYAN)
    cc_items = fetch_cc_items()
    print_colored(f"  ✓ Loaded {len(cc_items)} items from CC API\n", Colors.GREEN)

    print_colored("Parsing ACTION-TRACKER.md...", Colors.CYAN)
    tracker_items = parse_tracker_file()
    print_colored(f"  ✓ Parsed {len(tracker_items)} items from tracker\n", Colors.GREEN)

    # Reconcile
    print_colored("Reconciling...", Colors.CYAN)
    discrepancies = reconcile(cc_items, tracker_items)

    # Report
    if args.json:
        print(print_json_report(discrepancies))
    else:
        print_text_report(discrepancies, verbose=args.verbose)

    # Apply fixes if requested
    if args.fix and discrepancies:
        print_section("Applying Fixes")
        created, updated, errors = apply_fixes(discrepancies)
        print_colored(f"✓ Created: {created} items", Colors.GREEN)
        print_colored(f"✓ Updated: {updated} items", Colors.GREEN)
        if errors:
            for error in errors:
                print_colored(f"✗ {error}", Colors.RED)
        print()
    elif args.fix:
        print_section("No Fixes Needed")
        print_colored("Everything is in sync.", Colors.GREEN)
    else:
        # Dry-run mode
        if discrepancies:
            print_section("Next Steps")
            print("To apply fixes, run:")
            print_colored(f"  python {os.path.basename(__file__)} --fix", Colors.YELLOW)
        print()

if __name__ == "__main__":
    main()
