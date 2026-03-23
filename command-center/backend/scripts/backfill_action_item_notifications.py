"""
Backfill notifications for action items that were created without them.

Run from backend/ directory:
  python scripts/backfill_action_item_notifications.py

Reads all open action items from items.json and creates notifications
for any that don't already have one in Supabase.
"""

import json
import os
import sys

# Add parent directory to path so we can import services
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from services.notification_service import notify_new_action_item
from utils.config import data_dir

ITEMS_FILE = os.path.join(data_dir("action_items"), "items.json")


def main():
    if not os.path.exists(ITEMS_FILE):
        print(f"No items file found at {ITEMS_FILE}")
        return

    with open(ITEMS_FILE) as f:
        items = json.load(f)

    open_items = [i for i in items if i.get("status") not in ("done", "wont-do")]
    print(f"Found {len(open_items)} open action items")

    created = 0
    skipped = 0
    failed = 0

    for item in open_items:
        try:
            result = notify_new_action_item(
                item_id=item["id"],
                title=item["title"],
                priority=item.get("priority", "medium"),
                workstream=item.get("workstream", "cross-cutting"),
            )
            if result.get("deduplicated"):
                skipped += 1
            else:
                created += 1
                print(f"  + {item['title'][:60]}")
        except Exception as e:
            failed += 1
            print(f"  ! Failed: {item['title'][:40]} — {e}")

    print(f"\nDone: {created} created, {skipped} already existed, {failed} failed")


if __name__ == "__main__":
    main()
