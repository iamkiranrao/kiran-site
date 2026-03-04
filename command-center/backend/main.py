import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from routers import health, teardown, wordweaver, resume, job_central, content_audit, visual_audit

load_dotenv(override=True)

# ── Startup validation ──────────────────────────────────────
REQUIRED_ENV = ["ANTHROPIC_API_KEY"]
RECOMMENDED_ENV = ["KIRAN_SITE_REPO", "GITHUB_PAT"]

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
app.include_router(content_audit.router, prefix="/api/audit", tags=["Content Audit"])
app.include_router(visual_audit.router, prefix="/api/visual-audit", tags=["Visual Audit"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
