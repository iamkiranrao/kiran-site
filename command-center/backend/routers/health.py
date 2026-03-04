import os
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    has_key = bool(os.getenv("ANTHROPIC_API_KEY", "").strip())
    return {
        "status": "ok",
        "version": "0.1.0",
        "api_key_configured": has_key,
        "modules": {
            "teardown": {"status": "active", "description": "Product teardown builder"},
            "wordweaver": {"status": "active", "description": "Blog & podcast content engine"},
            "resume": {"status": "active", "description": "Resume customizer pipeline"},
            "job_central": {"status": "active", "description": "Job search management"},
        },
    }
