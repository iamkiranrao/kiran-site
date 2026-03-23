import asyncio
import os
import sys
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

from routers import health, teardown, wordweaver, resume, job_central, job_radar, content_audit, visual_audit, madlab, fenix_dashboard, fenix_training, fenix_journal, session_archive, product_guides, tool_guides, feedback, notifications, library, kirans_journal, action_items, standards, tech_costs
from utils.exceptions import CommandCenterError, NotFoundError, ValidationError, ConflictError

load_dotenv(override=True)

# ── Logging setup ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
# Quiet noisy third-party loggers
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

# ── Startup validation ──────────────────────────────────────
# ANTHROPIC_API_KEY is only needed for AI-powered routes (teardowns, wordweaver, etc.)
# Core logging routes (journal, action items, ideas) work without it.
OPTIONAL_AI_ENV = ["ANTHROPIC_API_KEY"]
RECOMMENDED_ENV = ["KIRAN_SITE_REPO", "GITHUB_PAT", "SUPABASE_URL", "SUPABASE_SERVICE_KEY"]

missing_ai = [v for v in OPTIONAL_AI_ENV if not os.getenv(v)]
if missing_ai:
    print(f"[WARN] Missing env vars (AI-powered routes will fail): {missing_ai}", file=sys.stderr)
    print("       Journal, action items, and idea logging will still work.", file=sys.stderr)

missing_recommended = [v for v in RECOMMENDED_ENV if not os.getenv(v)]
if missing_recommended:
    print(f"[WARN] Missing env vars (git publish will fail): {missing_recommended}", file=sys.stderr)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle. Pre-warms dashboards and notifications on launch."""
    # ── Startup ──
    from services.startup_service import run_startup_tasks
    asyncio.create_task(run_startup_tasks())
    yield
    # ── Shutdown ── (nothing to clean up currently)


app = FastAPI(
    title="Command Center API",
    description="Backend for Kiran's Command Center - content management and career automation.",
    version="0.1.0",
    lifespan=lifespan,
)


# ── Exception handlers (BACKEND-STANDARDS.md §6) ──────────────
# Domain exceptions raised by services, converted to HTTP responses here.
@app.exception_handler(NotFoundError)
async def not_found_handler(request: Request, exc: NotFoundError):
    return JSONResponse(status_code=404, content={
        "type": "not_found",
        "title": exc.message,
        "detail": exc.detail or exc.message,
    })

@app.exception_handler(ValidationError)
async def validation_handler(request: Request, exc: ValidationError):
    return JSONResponse(status_code=400, content={
        "type": "validation_error",
        "title": exc.message,
        "detail": exc.detail or exc.message,
    })

@app.exception_handler(ConflictError)
async def conflict_handler(request: Request, exc: ConflictError):
    return JSONResponse(status_code=409, content={
        "type": "conflict",
        "title": exc.message,
        "detail": exc.detail or exc.message,
    })

@app.exception_handler(CommandCenterError)
async def generic_cc_handler(request: Request, exc: CommandCenterError):
    return JSONResponse(status_code=500, content={
        "type": "internal_error",
        "title": exc.message,
        "detail": exc.detail or exc.message,
    })

# CORS
cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(health.router)
app.include_router(teardown.router, prefix="/api/teardown", tags=["Teardown Builder"])
app.include_router(wordweaver.router, prefix="/api/wordweaver", tags=["WordWeaver"])
app.include_router(resume.router, prefix="/api/resume", tags=["Resume Customizer"])
app.include_router(job_central.router, prefix="/api/jobs", tags=["Job Central"])
app.include_router(job_radar.router, prefix="/api/radar", tags=["Job Radar"])
app.include_router(content_audit.router, prefix="/api/audit", tags=["Content Audit"])
app.include_router(visual_audit.router, prefix="/api/visual-audit", tags=["Visual Audit"])
app.include_router(madlab.router, prefix="/api/madlab", tags=["MadLab"])
app.include_router(fenix_dashboard.router, prefix="/api/fenix", tags=["Fenix Dashboard"])
app.include_router(fenix_training.router, prefix="/api/fenix", tags=["Fenix Training"])
app.include_router(fenix_journal.router, prefix="/api/journal", tags=["Fenix Journal"])
app.include_router(session_archive.router, prefix="/api/journal/archive", tags=["Session Archive"])
app.include_router(product_guides.router, prefix="/api/guides", tags=["Product Guides"])
app.include_router(tool_guides.router, prefix="/api/tool-guides", tags=["Tool Guides"])
app.include_router(feedback.router, prefix="/api/feedback", tags=["Feedback & Testimonials"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(library.router, prefix="/api/library", tags=["Knowledge Library"])
app.include_router(kirans_journal.router, prefix="/api/kirans-journal", tags=["Kiran's Journal"])
app.include_router(action_items.router, prefix="/api/action-items", tags=["Action Items"])
app.include_router(standards.router, prefix="/api/standards", tags=["Standards & Compliance"])
app.include_router(tech_costs.router, prefix="/api/tech-costs", tags=["Tech Cost Calculator"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
