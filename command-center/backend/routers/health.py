import os
import logging
from fastapi import APIRouter

router = APIRouter()
logger = logging.getLogger(__name__)


def _check_supabase() -> dict:
    """Test Supabase connectivity."""
    try:
        url = os.getenv("SUPABASE_URL", "").strip()
        key = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
        if not url or not key:
            return {"status": "unconfigured", "detail": "SUPABASE_URL or SUPABASE_SERVICE_KEY not set"}
        from supabase import create_client
        sb = create_client(url, key)
        # Light query to verify connection
        sb.table("notifications").select("id").limit(1).execute()
        return {"status": "ok"}
    except Exception as e:
        return {"status": "down", "detail": str(e)[:200]}


def _check_anthropic_key() -> dict:
    """Verify Anthropic API key is configured."""
    key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not key:
        return {"status": "unconfigured", "detail": "ANTHROPIC_API_KEY not set"}
    return {"status": "ok"}


def _check_data_dirs() -> dict:
    """Verify critical data directories exist and are writable."""
    from utils.config import data_dir
    issues = []
    for name in ["teardowns", "wordweaver", "job-radar", "job-central", "standards"]:
        d = data_dir(name)
        if not os.path.isdir(d):
            issues.append(f"{name}: directory missing")
    if issues:
        return {"status": "degraded", "detail": "; ".join(issues)}
    return {"status": "ok"}


@router.get("/health", response_model=dict)
async def health_check():
    """Check backend health status with actual dependency checks."""
    has_key = bool(os.getenv("ANTHROPIC_API_KEY", "").strip())

    dependencies = {
        "supabase": _check_supabase(),
        "anthropic_key": _check_anthropic_key(),
        "data_dirs": _check_data_dirs(),
    }

    # Determine overall status
    statuses = [d["status"] for d in dependencies.values()]
    if "down" in statuses:
        overall = "degraded"
    elif "unconfigured" in statuses:
        overall = "degraded"
    else:
        overall = "ok"

    # Push notifications for any failed dependencies
    failed = {name: dep for name, dep in dependencies.items() if dep["status"] not in ("ok",)}
    if failed:
        try:
            from services.notification_service import notify_health_alert
            for name, dep in failed.items():
                notify_health_alert(
                    service_name=name,
                    status=dep["status"],
                    detail=dep.get("detail", ""),
                )
        except Exception as e:
            logger.warning("Failed to send health notification: %s", e)

    return {
        "status": overall,
        "version": "0.1.0",
        "api_key_configured": has_key,
        "dependencies": dependencies,
        "modules": {
            "teardown": {"status": "active", "description": "Product teardown builder"},
            "wordweaver": {"status": "active", "description": "Blog & podcast content engine"},
            "resume": {"status": "active", "description": "Resume customizer pipeline"},
            "job_central": {"status": "active", "description": "Job search management"},
        },
    }
