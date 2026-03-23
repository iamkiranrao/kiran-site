"""
Startup Service — runs on backend launch to pre-warm dashboards and notifications.

Ensures that when you open Command Center, data is already populated
instead of requiring manual "Run" or "Refresh" clicks.

Runs these tasks in order:
  1. Health check — verify dependencies, push notifications for failures
  2. Tech Cost aggregation — roll up API usage logs into cost entries
  3. Standards scorecard — run all 5 pillar audits, push violation notifications
  4. Job Radar scan — run if last scan was >4 hours ago (skipped otherwise)
"""

import asyncio
import logging
import os
from datetime import datetime, timezone

logger = logging.getLogger("startup")


async def run_startup_tasks():
    """Run all startup tasks. Each task is wrapped so failures don't block others."""
    logger.info("Running startup tasks to pre-warm dashboards...")

    results = {}

    # 1. Health check
    results["health"] = await _run_health_check()

    # 2. Tech Cost aggregation
    results["tech_costs"] = await _run_cost_aggregation()

    # 3. Standards scorecard
    results["standards"] = await _run_standards_audit()

    # 4. Job Radar scan (conditional)
    results["job_radar"] = await _run_job_radar_scan()

    logger.info("Startup tasks complete: %s", {k: v for k, v in results.items()})
    return results


async def _run_health_check() -> str:
    """Check all dependencies and push notifications for failures."""
    try:
        from routers.health import health_check
        result = await health_check()
        status = result.get("status", "unknown")
        logger.info("  Health check: %s", status)
        return status
    except Exception as e:
        logger.warning("  Health check failed: %s", e)
        return f"error: {e}"


async def _run_cost_aggregation() -> str:
    """Roll up API usage logs into cost entries for the current month."""
    try:
        from routers.tech_costs import aggregate_usage
        result = aggregate_usage()
        created = result.get("entries_created", 0)
        updated = result.get("entries_updated", 0)
        msg = f"created={created}, updated={updated}"
        logger.info("  Tech Cost aggregation: %s", msg)
        return msg
    except Exception as e:
        logger.warning("  Tech Cost aggregation failed: %s", e)
        return f"error: {e}"


async def _run_standards_audit() -> str:
    """Run the full standards scorecard and trigger violation notifications."""
    try:
        from services.standards_service import generate_scorecard
        scorecard = generate_scorecard()
        # The scorecard calls run_pillar_audit() for each pillar,
        # which already hooks into notify_standards_violation() via Task 2 wiring.
        overall = scorecard.overall_score if hasattr(scorecard, "overall_score") else "done"
        logger.info("  Standards audit: overall_score=%s", overall)
        return f"score={overall}"
    except Exception as e:
        logger.warning("  Standards audit failed: %s", e)
        return f"error: {e}"


async def _run_job_radar_scan() -> str:
    """Run Job Radar if the last scan was more than 4 hours ago."""
    try:
        from services.job_radar_service import get_scan_history, run_full_scan

        # Check last scan time
        history = get_scan_history(limit=1)
        if history:
            last_ts = history[0].get("timestamp", "")
            if last_ts:
                try:
                    last_dt = datetime.fromisoformat(last_ts.replace("Z", "+00:00"))
                    now = datetime.now(timezone.utc)
                    hours_since = (now - last_dt).total_seconds() / 3600
                    if hours_since < 4:
                        msg = f"skipped (last scan {hours_since:.1f}h ago)"
                        logger.info("  Job Radar: %s", msg)
                        return msg
                except (ValueError, TypeError):
                    pass  # Can't parse timestamp — run the scan

        # Run the scan
        result = await run_full_scan()
        new_jobs = result.get("new_jobs", 0)
        msg = f"scanned, new_jobs={new_jobs}"
        logger.info("  Job Radar: %s", msg)
        return msg
    except Exception as e:
        logger.warning("  Job Radar scan failed: %s", e)
        return f"error: {e}"
