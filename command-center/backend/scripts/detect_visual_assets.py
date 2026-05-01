#!/usr/bin/env python3
"""
Detect visual assets that have shipped.

Walks every asset's `output_path` and checks if the file exists on disk.
If it does and the asset isn't already shipped, flips status to "shipped"
and stamps `shipped_at`.

Usage:
    cd command-center/backend
    python3 scripts/detect_visual_assets.py            # update repo seed file
    python3 scripts/detect_visual_assets.py --live     # also update live data dir

The repo seed file is the source of truth for fresh checkouts; the live
data file (~/.command-center/data/visual_assets/items.json) is what the
running backend reads. By default this script updates the seed only — pass
--live to also flip the running copy.
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────
BACKEND_DIR = Path(__file__).resolve().parent.parent
SEED_FILE = BACKEND_DIR / "data" / "visual_assets" / "items.json"
SITE_ROOT = BACKEND_DIR.parent.parent  # backend -> command-center -> site repo
LIVE_FILE = Path.home() / ".command-center" / "data" / "visual_assets" / "items.json"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def detect(items_path: Path, dry_run: bool = False) -> dict:
    """Read items.json at items_path, flip newly-shipped, write back."""
    if not items_path.exists():
        return {"path": str(items_path), "exists": False, "flipped": []}

    with items_path.open() as f:
        assets = json.load(f)

    flipped = []
    for asset in assets:
        path = asset.get("output_path")
        if not path:
            continue
        rel = path.lstrip("/")
        full = SITE_ROOT / rel
        if full.exists() and asset.get("status") != "shipped":
            asset["status"] = "shipped"
            asset["shipped_at"] = _now()
            asset["updated_at"] = _now()
            flipped.append({"id": asset.get("id"), "name": asset.get("name"), "path": rel})

    if flipped and not dry_run:
        with items_path.open("w") as f:
            json.dump(assets, f, indent=2, default=str)

    return {"path": str(items_path), "exists": True, "flipped": flipped, "checked": len(assets)}


def main():
    parser = argparse.ArgumentParser(description="Auto-detect shipped visual assets.")
    parser.add_argument("--live", action="store_true",
                        help="Also update the live data file at ~/.command-center/")
    parser.add_argument("--dry-run", action="store_true",
                        help="Report what would change without writing.")
    args = parser.parse_args()

    print(f"Site root: {SITE_ROOT}")
    print(f"Seed file: {SEED_FILE}")

    seed_result = detect(SEED_FILE, dry_run=args.dry_run)
    print(f"\nSeed file → {len(seed_result.get('flipped', []))} flipped (out of {seed_result.get('checked', 0)} checked):")
    for f in seed_result.get("flipped", []):
        print(f"  ✓ {f['name']}  ({f['path']})")

    if args.live:
        live_result = detect(LIVE_FILE, dry_run=args.dry_run)
        print(f"\nLive file → {len(live_result.get('flipped', []))} flipped (out of {live_result.get('checked', 0)} checked):")
        for f in live_result.get("flipped", []):
            print(f"  ✓ {f['name']}  ({f['path']})")
    else:
        print("\n(Skipping live file — pass --live to update it too.)")

    if args.dry_run:
        print("\n[DRY RUN] No files were written.")


if __name__ == "__main__":
    sys.exit(main())
