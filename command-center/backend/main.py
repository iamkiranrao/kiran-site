import os
import sys
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from routers import health, teardown, wordweaver, resume, job_central, job_radar, content_audit, visual_audit, madlab, fenix_dashboard, fenix_training, fenix_journal, session_archive, product_guides, feedback, ideas, notifications, library

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
REQUIRED_ENV = ["ANTHROPIC_API_KEY"]
RECOMMENDED_ENV = ["KIRAN_SITE_REPO", "GITHUB_PAT", "SUPABASE_URL", "SUPABASE_SERVICE_KEY"]

missing_required = [v for v in REQUIRED_ENV if not os.getenv(v)]
if missing_required:
    print(f"[FATAL] Missing required env vars: {missing_required}", file=sys.stderr)
    print("       Copy backend/.env.example to backend/.env and fill in values.", file=sys.stderr)
    sys.exit(1)

missing_recommended = [v for v in RECOMMENDED_ENV if not os.getenv(v)]
if missing_recommended:
    print(f"[WARN] Missing env vars (git publish will fail): {missing_recommended}", file=sys.stderr)

app = FastAPI(
    title="Command Center API",
    description="Backend for Kiran's Command Center - content management and career automation.",
    version="0.1.0",
)

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
app.include_router(feedback.router, prefix="/api/feedback", tags=["Feedback & Testimonials"])
app.include_router(ideas.router, prefix="/api/ideas", tags=["Future Ideas"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(library.router, prefix="/api/library", tags=["Knowledge Library"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
