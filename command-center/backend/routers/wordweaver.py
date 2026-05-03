"""
WordWeaver Router — Blog/social content creation workflow endpoints.

Endpoints:
  GET  /themes              — List themes and angles
  POST /themes              — Add a new theme
  DELETE /themes/{name}     — Remove a theme
  POST /create              — Start a new session (blog or social)
  GET  /sessions            — List all sessions
  GET  /sessions/{id}       — Get session state
  POST /sessions/{id}/step  — Run a step (SSE streaming)
  POST /sessions/{id}/approve — Approve current step
  POST /sessions/{id}/revise  — Revise with feedback (SSE streaming)
  POST /sessions/{id}/preview   — Save blog locally for preview
  POST /sessions/{id}/deploy    — Push previewed post to production (git + Netlify)
  POST /sessions/{id}/crosspost — Generate Medium/Substack Markdown + diagram PNGs
  POST /publish               — (Legacy) Publish a post directly
  GET  /steps/{mode}        — Get step definitions for a mode
"""

import os
import json
import shutil
import tempfile
from pathlib import Path
from utils.config import CLAUDE_MODEL, resolve_api_key
from services.claude_client import create_client
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from models.wordweaver import CreateRequest, StepRequest, ApproveRequest, ReviseRequest, GoToStepRequest, EditFinalRequest, ThemeRequest, PreviewRequest, PublishRequest, CrossPostRequest
from typing import Optional

# ── Resolve paths ─────────────────────────────────────────────────
_BACKEND_DIR = Path(__file__).resolve().parent.parent  # backend/
SITE_ROOT = os.getenv(
    "KIRAN_SITE_LOCAL_FOLDER",
    str(_BACKEND_DIR.parent.parent),  # command-center/ → website root
)

from services.wordweaver_service import (
    BLOG_STEPS,
    SOCIAL_STEPS,
    create_session,
    get_session,
    list_sessions,
    save_step_result,
    save_decision,
    update_session,
    run_step_stream,
    get_themes,
    add_theme,
    remove_theme,
)
from services.git_handler import GitHandler

router = APIRouter()

# ── Request models ─────────────────────────────────────────────────

# ── Endpoints ──────────────────────────────────────────────────────

@router.get("/themes", response_model=dict)
async def list_themes_endpoint():
    """List available themes and cross-cutting angles."""
    data = get_themes()
    return {
        "themes": data["themes"],
        "angles": data["angles"],
        "count": len(data["themes"]),
    }

@router.post("/themes", response_model=dict)
async def add_theme_endpoint(request: ThemeRequest):
    """Add a new theme to the library."""
    result = add_theme(request.name, request.description)
    return result

@router.delete("/themes/{name}", response_model=dict)
async def remove_theme_endpoint(name: str):
    """Remove a theme from the library."""
    result = remove_theme(name)
    if not result["found"]:
        raise HTTPException(status_code=404, detail=f"Theme '{name}' not found")
    return result

@router.get("/steps/{mode}", response_model=dict)
async def get_step_definitions(mode: str):
    """Return step definitions for blog or social mode."""
    if mode == "blog":
        return {"mode": "blog", "steps": BLOG_STEPS}
    elif mode == "social":
        return {"mode": "social", "steps": SOCIAL_STEPS}
    else:
        raise HTTPException(status_code=400, detail=f"Unknown mode: {mode}")

@router.post("/create", response_model=dict)
async def create_wordweaver_session(request: CreateRequest):
    """Start a new WordWeaver session."""
    if request.mode not in ("blog", "social"):
        raise HTTPException(status_code=400, detail="Mode must be 'blog' or 'social'")

    initial_data = {}
    if request.theme:
        initial_data["theme"] = request.theme
    if request.angle:
        initial_data["angle"] = request.angle
    if request.series:
        initial_data["series"] = request.series

    session = create_session(request.mode, initial_data)
    steps = BLOG_STEPS if request.mode == "blog" else SOCIAL_STEPS

    return {
        "session_id": session["session_id"],
        "mode": session["mode"],
        "current_step": 1,
        "total_steps": session["total_steps"],
        "steps": steps,
    }

@router.get("/sessions", response_model=dict)
async def get_sessions():
    """List all WordWeaver sessions."""
    return {"sessions": list_sessions()}

@router.get("/sessions/{session_id}", response_model=dict)
async def get_session_detail(session_id: str):
    """Get full session state."""
    state = get_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    return state

@router.delete("/sessions/{session_id}", response_model=dict)
async def delete_session(session_id: str):
    """Delete a WordWeaver session and its data."""
    state = get_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    from utils.config import data_dir
    session_dir = os.path.join(data_dir("wordweaver"), session_id)
    if os.path.isdir(session_dir):
        shutil.rmtree(session_dir)

    return {"deleted": session_id}

@router.post("/sessions/{session_id}/step")
async def execute_step(
    session_id: str,
    request: StepRequest,
    x_claude_key: str = Header(None, alias="X-Claude-Key"),
):
    """Run the current step via Claude with SSE streaming."""
    api_key = resolve_api_key(x_claude_key)

    state = get_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    step = state["current_step"]

    async def event_stream():
        async for event_json in run_step_stream(
            session_id=session_id,
            step=step,
            api_key=api_key,
            user_input=request.user_input,
        ):
            yield f"data: {event_json}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

@router.post("/sessions/{session_id}/approve", response_model=dict)
async def approve_step(session_id: str, request: ApproveRequest):
    """Approve the current step's draft and advance."""
    state = get_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    step = state["current_step"]
    step_data = state["steps"].get(str(step))

    if not step_data or step_data["status"] != "draft":
        raise HTTPException(
            status_code=400,
            detail=f"Step {step} has no draft to approve",
        )

    save_step_result(session_id, step, step_data["content"], status="approved")
    save_decision(session_id, step, request.decision or "Approved")

    updated = get_session(session_id)

    # Mark complete if final step — enter review mode (not straight to publish)
    if step == updated["total_steps"]:
        update_session(session_id, {"status": "reviewing"})
        updated = get_session(session_id)

    return {
        "approved_step": step,
        "next_step": updated["current_step"],
        "status": updated["status"],
    }

@router.post("/sessions/{session_id}/revise")
async def revise_step(
    session_id: str,
    request: ReviseRequest,
    x_claude_key: str = Header(None, alias="X-Claude-Key"),
):
    """Re-run the current step with revision feedback."""
    api_key = resolve_api_key(x_claude_key)

    state = get_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    step = state["current_step"]

    async def event_stream():
        async for event_json in run_step_stream(
            session_id=session_id,
            step=step,
            api_key=api_key,
            user_input=f"REVISION REQUESTED: {request.feedback}",
        ):
            yield f"data: {event_json}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

@router.post("/sessions/{session_id}/goto-step", response_model=dict)
async def goto_step(session_id: str, request: GoToStepRequest):
    """Navigate to a specific step (back or forward) to review or re-run it."""
    state = get_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    target = request.step
    total = state["total_steps"]
    if target < 1 or target > total:
        raise HTTPException(status_code=400, detail=f"Step must be between 1 and {total}")

    # Find the highest approved step
    max_approved = 0
    for s in range(1, total + 1):
        sd = state["steps"].get(str(s))
        if sd and sd.get("status") == "approved":
            max_approved = s

    # Can navigate to any step up to max_approved + 1
    if target > max_approved + 1:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot jump to step {target}. Latest approved step is {max_approved}.",
        )

    update_session(session_id, {"current_step": target})
    updated = get_session(session_id)

    return {
        "current_step": target,
        "status": updated["status"],
    }

# ── Review Phase: Edit, Preview, Revalidate ─────────────────────

@router.post("/sessions/{session_id}/preview-content", response_model=dict)
async def preview_content(
    session_id: str,
    x_claude_key: str = Header(None, alias="X-Claude-Key"),
):
    """Assemble the blog HTML from all steps and save it for preview.

    Works in 'reviewing', 'revalidating', or 'ready_to_publish' status.
    Returns the path to the saved file so the user can read it.
    """
    state = get_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    if state["status"] not in ("reviewing", "revalidating", "ready_to_publish", "previewing", "published"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot preview in status '{state['status']}'. Complete all steps first.",
        )

    api_key = resolve_api_key(x_claude_key)

    try:
        html_content = await _assemble_blog_html(state, api_key)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to assemble preview: {str(e)}")

    # Determine slug
    slug = state.get("slug", "")
    if not slug:
        slug = state.get("session_id", "draft")
    filename = f"{slug}.html"

    # Save to blog/ folder
    blog_dir = os.path.join(SITE_ROOT, "blog")
    os.makedirs(blog_dir, exist_ok=True)
    blog_path = os.path.join(blog_dir, filename)
    with open(blog_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    # Also mirror to site/blog/
    site_blog_dir = os.path.join(SITE_ROOT, "site", "blog")
    os.makedirs(site_blog_dir, exist_ok=True)
    shutil.copy2(blog_path, os.path.join(site_blog_dir, filename))

    update_session(session_id, {"local_file": f"blog/{filename}", "slug": slug})

    return {
        "status": "preview_ready",
        "local_file": f"blog/{filename}",
        "preview_url": f"file://{blog_path}",
    }

@router.post("/sessions/{session_id}/edit-final")
async def edit_final(
    session_id: str,
    request: EditFinalRequest,
    x_claude_key: str = Header(None, alias="X-Claude-Key"),
):
    """Revise the written post (step 7) based on user feedback during review.

    Streams the revised content back via SSE. The revised text replaces step 7
    as a new draft so the user can approve or request more edits.
    """
    api_key = resolve_api_key(x_claude_key)

    state = get_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    if state["status"] not in ("reviewing",):
        raise HTTPException(
            status_code=400,
            detail=f"Edit is only available during review phase (current status: {state['status']})",
        )

    # Temporarily set current_step to 7 so the service targets step 7
    original_step = state["current_step"]
    update_session(session_id, {"current_step": 7})

    async def event_stream():
        try:
            async for event_json in run_step_stream(
                session_id=session_id,
                step=7,
                api_key=api_key,
                user_input=f"REVISION REQUESTED (during final review): {request.feedback}",
            ):
                yield f"data: {event_json}\n\n"
        finally:
            # Restore current_step to the original (final step)
            update_session(session_id, {"current_step": original_step})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

@router.post("/sessions/{session_id}/approve-final", response_model=dict)
async def approve_final(
    session_id: str,
    x_claude_key: str = Header(None, alias="X-Claude-Key"),
):
    """Approve the reviewed content and rerun validation steps (10: Fact-Check, 11: Originality).

    Streams both revalidation steps sequentially via SSE, then auto-generates
    a fresh preview. At the end, status becomes 'ready_to_publish'.
    """
    api_key = resolve_api_key(x_claude_key)

    state = get_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    if state["status"] not in ("reviewing",):
        raise HTTPException(
            status_code=400,
            detail=f"Approve-final is only available during review phase (current status: {state['status']})",
        )

    update_session(session_id, {"status": "revalidating"})

    # Make sure step 7 is marked approved if it was edited (draft from edit-final)
    step7 = state["steps"].get("7")
    if step7 and step7.get("status") == "draft":
        save_step_result(session_id, 7, step7["content"], status="approved")
        save_decision(session_id, 7, "Approved (final review)")

    async def event_stream():
        # Rerun step 10 (Fact-Check)
        yield f'data: {json.dumps({"type": "revalidation_start", "step": 10, "label": "Fact-Check"})}\n\n'
        update_session(session_id, {"current_step": 10})
        async for event_json in run_step_stream(
            session_id=session_id,
            step=10,
            api_key=api_key,
            user_input="REVALIDATION: The post was edited during final review. Re-run fact-check on the updated content.",
        ):
            yield f"data: {event_json}\n\n"

        # Auto-approve step 10
        refreshed = get_session(session_id)
        step10 = refreshed["steps"].get("10")
        if step10 and step10.get("content"):
            save_step_result(session_id, 10, step10["content"], status="approved")
            save_decision(session_id, 10, "Auto-approved (revalidation)")

        # Rerun step 11 (Originality Check)
        yield f'data: {json.dumps({"type": "revalidation_start", "step": 11, "label": "Originality Check"})}\n\n'
        update_session(session_id, {"current_step": 11})
        async for event_json in run_step_stream(
            session_id=session_id,
            step=11,
            api_key=api_key,
            user_input="REVALIDATION: The post was edited during final review. Re-run originality check on the updated content.",
        ):
            yield f"data: {event_json}\n\n"

        # Auto-approve step 11
        refreshed = get_session(session_id)
        step11 = refreshed["steps"].get("11")
        if step11 and step11.get("content"):
            save_step_result(session_id, 11, step11["content"], status="approved")
            save_decision(session_id, 11, "Auto-approved (revalidation)")

        # Restore current_step to final and set ready_to_publish
        total = refreshed["total_steps"]
        update_session(session_id, {"current_step": total, "status": "ready_to_publish"})

        yield f'data: {json.dumps({"type": "revalidation_complete"})}\n\n'

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

# ── HTML Assembly ──────────────────────────────────────────────

def _load_blog_template() -> str:
    template_path = os.path.join(
        os.path.dirname(__file__), "..", "templates", "blog-template.html"
    )
    with open(template_path, "r", encoding="utf-8") as f:
        return f.read()

async def _assemble_blog_html(state: dict, api_key: str) -> str:
    """Use Claude to assemble a complete HTML blog page using the site template.

    Reads the actual HTML template from /templates/blog-template.html
    and asks Claude to fill in all the {{PLACEHOLDER}} sections with content
    from the 12 steps.
    """
    from datetime import datetime

    template = _load_blog_template()

    # Gather all step content from steps 1-12
    all_content = []
    step_labels = {
        1: "Format, Theme & Angle",
        2: "Live Web Research",
        3: "Topic Options",
        4: "Refinement Questions",
        5: "Structure & Format",
        6: "Anecdote Workshop",
        7: "Write the Post",
        8: "Editorial Filter",
        9: "Visual Assets",
        10: "Fact-Check",
        11: "Originality Check",
        12: "Output & Package",
    }

    for i in range(1, 13):
        step_data = state["steps"].get(str(i))
        if step_data and step_data.get("content"):
            all_content.append(f"=== STEP {i}: {step_labels.get(i, f'Step {i}')} ===\n{step_data['content']}")

    combined = "\n\n".join(all_content)

    # Load CONTENT-RULES for enforcement
    content_rules = ""
    rules_path = os.path.join(SITE_ROOT, "CONTENT-RULES.md")
    if os.path.exists(rules_path):
        with open(rules_path, "r", encoding="utf-8") as f:
            content_rules = f.read()

    client = create_client(api_key)

    # Use streaming to avoid timeout on large requests
    collected = []
    with client.messages.stream(
        model=CLAUDE_MODEL,
        max_tokens=30000,
        messages=[{
            "role": "user",
            "content": f"""You are assembling a final HTML blog page for kiranrao.ai.

CRITICAL RULE: The template below is the CANONICAL source of truth for all CSS and HTML structure. You MUST NOT modify, add, remove, or override ANY CSS properties. Copy the <style> block and all HTML structure EXACTLY. The only thing you change is replacing {{{{PLACEHOLDER}}}} values with actual content.

=== HTML TEMPLATE (DO NOT MODIFY CSS OR STRUCTURE) ===
{template}
=== END TEMPLATE ===

=== BLOG CONTENT (from 12-step process) ===
{combined}
=== END CONTENT ===

=== CONTENT RULES (MUST ENFORCE) ===
{content_rules}
=== END CONTENT RULES ===

ASSEMBLY INSTRUCTIONS:
1. Copy the template's <style> block EXACTLY as-is. Do NOT change font-size, padding, border, background, or any other CSS property.
2. Copy ALL JavaScript EXACTLY as-is.
3. Copy all HTML structure EXACTLY as-is.
4. Replace {{{{PLACEHOLDER}}}} values ONLY:
   - {{{{TITLE}}}}: Extract from step 1/12 metadata or the main article heading. Use this in <title>, h1, og:title, twitter:title, JSON-LD headline.
   - {{{{DESCRIPTION}}}}: A concise 1-2 sentence summary from step 1/12 metadata or article abstract. Use in meta description, og:description, twitter:description, JSON-LD.
   - {{{{SLUG}}}}: The URL slug (lowercase, hyphens). Use in canonical URL, og:url, JSON-LD url. Format: your-slug-here
   - {{{{DATE_ISO}}}}: ISO 8601 date format like 2026-02-28. Use in article:published_time, JSON-LD datePublished.
   - {{{{DATE_DISPLAY}}}}: Human-readable date like "28 February 2026". Use in article-meta display.
   - {{{{READING_TIME}}}}: Extract from step 11/12 or estimate (roughly 200 words per minute). Format: "X min read"
   - {{{{TAGS_HTML}}}}: Generate <span class="article-tag">TagName</span> elements from step 1/12 metadata. One span per tag.
   - {{{{ARTICLE_BODY}}}}: Use the written post content from step 7 ("Write the Post") as the article body. Convert markdown to clean HTML using h2, p, blockquote, strong, em tags. NO h1 tags. NO markdown fences. NO outer <article> tags.
   - {{{{SOURCES_HTML}}}}: Extract sources/references from step 10 ("Fact-Check"). Format as: <div class="article-sources"><h2>Sources</h2><ol><li>Source 1</li><li>Source 2</li>...</ol></div>

STYLE RULES (from CONTENT-RULES.md):
- American English spelling throughout (organization, color, recognize, etc).
- US English conventions.
- NO em dashes anywhere. Use " - " (space-hyphen-space) instead.
- All typography must match the template's CSS exactly.
- Canonical domain is kiranrao.ai in all URLs (canonical, og:url, og:image, twitter:image, JSON-LD).
- Every page needs its own per-post OG image (not the generic site card). The og:image URL must point to a page-specific image.

VISUAL ASSETS (from step 9):
- If step 9 contains approved visual asset descriptions, you MUST build complete inline SVG elements for each approved visual.
- Each SVG must use role="img" and aria-label for accessibility.
- Use CSS variables for ALL colors so diagrams adapt to light/dark theme: var(--text-primary), var(--bg-primary), var(--border), var(--text-muted), var(--text-secondary), var(--accent-blue).
- Wrap each SVG in: <div style="margin: 2.5rem -1rem; padding: 1.5rem 0;"> ... </div>
- Place each diagram at the most relevant location in the article body (near the section it illustrates).
- SVGs should be professional, clean, and use viewBox for responsive scaling (max-width: 720px).
- Include descriptive elements: labels, arrows, boxes with rounded corners, step numbers.

MARKDOWN TO HTML CONVERSION (for article body):
- # Heading 1 → SKIP (no h1 in article body)
- ## Heading 2 → <h2>Heading 2</h2>
- ### Heading 3 → <h3>Heading 3</h3>
- **bold text** → <strong>bold text</strong>
- *italic text* → <em>italic text</em>
- > blockquote → <blockquote><p>blockquote text</p></blockquote>
- Normal paragraph → <p>paragraph text</p>
- Leave blank lines between paragraphs.

Output ONLY the complete HTML page. No explanation, no markdown fences. Start with <!DOCTYPE html> and end with </html>."""
        }],
    ) as stream:
        for text in stream.text_stream:
            collected.append(text)

    html = "".join(collected).strip()
    # Clean up if Claude wrapped it in markdown fences
    if html.startswith("```html"):
        html = html[7:]
    if html.startswith("```"):
        html = html[3:]
    if html.endswith("```"):
        html = html[:-3]
    return html.strip()

# ── Preview (Local Save) ──────────────────────────────────────────

@router.post("/sessions/{session_id}/preview", response_model=dict)
async def preview_post(
    session_id: str,
    request: PreviewRequest,
    x_claude_key: str = Header(None, alias="X-Claude-Key"),
):
    """Save a blog post locally for preview. Does NOT push to production."""
    state = get_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    if state["status"] not in ("ready_to_publish", "published", "previewing"):
        raise HTTPException(
            status_code=400,
            detail=f"Session not ready to publish (status: {state['status']}). Complete all steps first.",
        )

    slug = request.slug.strip().lower().replace(" ", "-")
    if not slug:
        raise HTTPException(status_code=400, detail="Slug is required")

    filename = f"{slug}.html"

    # Check if html_content is valid HTML or needs assembly
    html_content = request.html_content.strip()
    if not (html_content.startswith("<!DOCTYPE") or html_content.startswith("<html")):
        # It's raw step content, need to assemble it
        try:
            api_key = resolve_api_key(x_claude_key)
            html_content = await _assemble_blog_html(state, api_key)
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to assemble HTML from steps: {str(e)}",
            )

    # 1. Save to blog/ folder
    blog_dir = os.path.join(SITE_ROOT, "blog")
    os.makedirs(blog_dir, exist_ok=True)
    blog_path = os.path.join(blog_dir, filename)
    with open(blog_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    # 2. Mirror to site/blog/
    site_blog_dir = os.path.join(SITE_ROOT, "site", "blog")
    os.makedirs(site_blog_dir, exist_ok=True)
    shutil.copy2(blog_path, os.path.join(site_blog_dir, filename))

    # 3. Update session status
    update_session(session_id, {
        "status": "previewing",
        "local_file": f"blog/{filename}",
        "slug": slug,
    })

    return {
        "status": "previewing",
        "local_file": f"blog/{filename}",
        "preview_url": f"file://{blog_path}",
        "message": f"Saved locally at blog/{filename}. Preview the file, then Deploy to push to production.",
    }

# ── Deploy (Push to Production) ──────────────────────────────────

@router.post("/sessions/{session_id}/deploy", response_model=dict)
async def deploy_post(session_id: str):
    """Push a locally-previewed blog post to production via git."""
    import re as _re
    from datetime import datetime as _dt

    state = get_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    if state["status"] not in ("previewing", "published"):
        raise HTTPException(
            status_code=400,
            detail=f"Session must be previewed first (status: {state['status']}). Hit Preview first to save the page locally.",
        )

    slug = state.get("slug", "")
    if not slug:
        raise HTTPException(status_code=400, detail="No slug found in session. Preview first.")

    filename = f"{slug}.html"

    # Read the local file
    blog_path = os.path.join(SITE_ROOT, "blog", filename)
    if not os.path.exists(blog_path):
        raise HTTPException(status_code=404, detail=f"Local file not found: blog/{filename}")

    with open(blog_path, "r", encoding="utf-8") as f:
        html_content = f.read()

    # ── Auto-generate card HTML for blog-podcast.html ──
    card_html = state.get("card_html")
    if not card_html:
        card_html = _generate_blog_card(html_content, slug, state)

    # ── Auto-update fenix-index.json ──
    _update_fenix_index_for_blog(html_content, slug)

    git = GitHandler()

    try:
        result = await git.publish_blog_post(
            slug=slug,
            html_content=html_content,
            card_html=card_html,
        )

        update_session(session_id, {"status": "published"})

        # Fire notification for deployed content
        try:
            from services.notification_service import notify_draft_content
            blog_title = state.get("title", slug.replace("-", " ").title())
            notify_draft_content("blog", blog_title, slug, session_id)
        except Exception:
            pass  # Fire-and-forget — don't break deploy on notification failure

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Deploy failed: {str(e)}")

# ── Family pattern wiring (May 2026) ──
# Maps WordWeaver angle → family pattern that ships in blog-podcast.html cards.
# See docs/Website/Blog/BLOG-PATTERN-PROMPT-KIT.md for the full rationale.
ANGLE_TO_FAMILY = {
    # Explainer family — clarifying, structural posts
    "Explainers": "explainer",
    "Breakdowns": "explainer",
    "Implications": "explainer",
    # Tactics family — practical how-to
    "Tactics": "tactics",
    # Strategy family — long-term thinking
    "Strategies": "strategy",
    "Surprising Strategies": "strategy",
    # Innovation family — what's possible
    "Innovation": "innovation",
    "Opportunities": "innovation",
    # Trend family — directional / market scanning
    "Latest Trends": "trend",
    "Threats": "trend",
    # Story family — narrative arcs
    "Success Stories": "story",
    "Failure Stories": "story",
    "Underdog Stories": "story",
    "Cultural Implications": "story",
    # Case Study family — concrete examples
    "Case Studies": "case-study",
    "Use Cases": "case-study",
}

# Families that get V1 (pure image, no vignette) — pill lands on a dark area.
# All other families get V4 (small left vignette for pill contrast).
V1_FAMILIES = {"tactics", "trend"}

# Display labels for the .pattern-cat pill
FAMILY_LABELS = {
    "demystified": "Demystified",
    "explainer": "Explainer",
    "tactics": "Tactics",
    "strategy": "Strategy",
    "innovation": "Innovation",
    "trend": "Trend",
    "story": "Story",
    "case-study": "Case Study",
}


def _detect_family(state: Optional[dict], tags: list, title: str) -> str:
    """Pick the family pattern for a post.

    Priority:
    1. WordWeaver session series — if it starts with "Demystifying", use Demystified family.
    2. WordWeaver session angle — look up in ANGLE_TO_FAMILY.
    3. Legacy fallback — parse from post tags/title (for posts without WordWeaver state).
    Default: explainer.
    """
    # 1. Series check — Demystified franchise
    if state:
        series = (state.get("series") or "").strip()
        if series.lower().startswith("demystifying"):
            return "demystified"
        # 2. Angle lookup
        angle = (state.get("angle") or "").strip()
        if angle and angle in ANGLE_TO_FAMILY:
            return ANGLE_TO_FAMILY[angle]

    # 3. Legacy fallback — detect from tags/title
    tag_lower = [t.lower() for t in tags]
    title_lower = title.lower()
    if "demystified" in tag_lower or title_lower.startswith("demystifying"):
        return "demystified"
    if "case study" in tag_lower or "case-study" in tag_lower:
        return "case-study"
    if "story" in tag_lower or "stories" in tag_lower:
        return "story"
    if "tactics" in tag_lower:
        return "tactics"
    if "strategy" in tag_lower:
        return "strategy"
    if "innovation" in tag_lower:
        return "innovation"
    if "trend" in tag_lower or "trends" in tag_lower:
        return "trend"
    return "explainer"


def _generate_blog_card(html_content: str, slug: str, state: Optional[dict] = None) -> str:
    import re as _re
    from datetime import datetime as _dt

    # Extract title
    title_match = _re.search(r'<h1[^>]*>(.*?)</h1>', html_content, _re.DOTALL)
    title = _re.sub(r'<[^>]+>', '', title_match.group(1)).strip() if title_match else slug.replace("-", " ").title()

    # Extract description
    desc_match = _re.search(r'<meta\s+name="description"\s+content="([^"]*)"', html_content)
    description = desc_match.group(1) if desc_match else ""

    # Extract tags from article-tag spans
    tags = _re.findall(r'<span class="article-tag">(.*?)</span>', html_content)

    # Extract date
    date_match = _re.search(r'<meta\s+property="article:published_time"\s+content="([^"]*)"', html_content)
    if date_match:
        try:
            dt = _dt.strptime(date_match.group(1), "%Y-%m-%d")
            display_date = dt.strftime("%-d %b %Y")
        except ValueError:
            display_date = _dt.now().strftime("%-d %b %Y")
    else:
        display_date = _dt.now().strftime("%-d %b %Y")

    # Resolve family pattern, treatment class, and label
    family = _detect_family(state, tags, title)
    family_label = FAMILY_LABELS.get(family, family.title())
    vignette_class = "" if family in V1_FAMILIES else " strip-vignette"

    return f"""
        <a href="blog/{slug}.html" class="post-card" data-cat="{family}">
            <div class="pattern-strip bg-{family}{vignette_class}">
                <img class="pattern-img" src="images/blog-patterns/{family}-blog.png" alt="">
                <span class="pattern-cat">{family_label}</span>
            </div>
            <div class="post-body">
                <h2 class="post-title">{title}</h2>
                <p class="post-excerpt">{description}</p>
                <div class="post-date">{display_date}</div>
            </div>
        </a>
"""

def _update_fenix_index_for_blog(html_content: str, slug: str):
    """Auto-add/update a blog entry in fenix-index.json when deploying."""
    import re as _re
    from datetime import datetime as _dt

    index_path = os.path.join(SITE_ROOT, "fenix-index.json")
    if not os.path.exists(index_path):
        return

    with open(index_path, "r", encoding="utf-8") as f:
        index = json.load(f)

    entry_id = f"blog-{slug}"

    # Check if already exists
    pages = index.get("pages", [])
    for p in pages:
        if p.get("id") == entry_id:
            return  # Already indexed

    # Extract metadata from HTML
    title_match = _re.search(r'<h1[^>]*>(.*?)</h1>', html_content, _re.DOTALL)
    title = _re.sub(r'<[^>]+>', '', title_match.group(1)).strip() if title_match else slug.replace("-", " ").title()

    desc_match = _re.search(r'<meta\s+name="description"\s+content="([^"]*)"', html_content)
    description = desc_match.group(1) if desc_match else ""

    tags = _re.findall(r'<span class="article-tag">(.*?)</span>', html_content)
    sections = _re.findall(r'<h2>(.*?)</h2>', html_content)
    # Filter out "Sources" from sections
    sections = [s for s in sections if s.lower() != "sources"]

    date_match = _re.search(r'<meta\s+property="article:published_time"\s+content="([^"]*)"', html_content)
    pub_date = date_match.group(1) if date_match else _dt.now().strftime("%Y-%m-%d")

    read_match = _re.search(r'<span class="article-meta-item">(\d+ min read)</span>', html_content)
    read_time = read_match.group(1) if read_match else "7 min"

    new_entry = {
        "id": entry_id,
        "type": "blog",
        "title": title,
        "url": f"/blog/{slug}.html",
        "datePublished": pub_date,
        "readTime": read_time,
        "tags": [t.lower().replace(" ", "-") for t in tags],
        "sections": sections,
        "skills": [],
        "themes": [t.lower().replace(" ", "-") for t in tags[:2]],
        "status": "published",
        "connections": [],
        "summary": description,
    }

    pages.append(new_entry)
    index["pages"] = pages
    index["lastUpdated"] = _dt.now().strftime("%Y-%m-%d")

    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(index, f, indent=2, ensure_ascii=False)
        f.write("\n")

# ── Cross-Post (Medium / Substack) ────────────────────────────────

@router.post("/sessions/{session_id}/crosspost", response_model=dict)
async def generate_crosspost(
    session_id: str,
    x_claude_key: str = Header(None, alias="X-Claude-Key"),
):
    """Generate Medium/Substack-ready Markdown + diagram PNG from a published post.

    Reads the deployed HTML, strips SVGs (replacing with PNG placeholders),
    converts to clean Markdown, adds canonical link and series footer.
    Also exports any inline SVG diagrams as light-mode PNGs.
    """
    api_key = resolve_api_key(x_claude_key)

    state = get_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    if state["status"] not in ("published", "previewing"):
        raise HTTPException(
            status_code=400,
            detail=f"Post must be published first (status: {state['status']})",
        )

    slug = state.get("slug", "")
    if not slug:
        raise HTTPException(status_code=400, detail="No slug found in session.")

    filename = f"{slug}.html"
    blog_path = os.path.join(SITE_ROOT, "blog", filename)
    if not os.path.exists(blog_path):
        raise HTTPException(status_code=404, detail=f"Published file not found: blog/{filename}")

    with open(blog_path, "r", encoding="utf-8") as f:
        html_content = f.read()

    try:
        result = await _generate_crosspost_markdown(html_content, slug, api_key)

        # Save the Markdown file alongside the blog post
        md_path = os.path.join(SITE_ROOT, f"{slug}-crosspost.md")
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(result["markdown"])

        update_session(session_id, {"crosspost_file": f"{slug}-crosspost.md"})

        return {
            "status": "ready",
            "markdown_file": f"{slug}-crosspost.md",
            "markdown_path": md_path,
            "diagram_images": result.get("diagram_images", []),
            "instructions": {
                "medium": "Import the Markdown. Set canonical URL to the original post URL under Story Settings.",
                "substack": "Paste Markdown into the editor. Upload diagram PNGs where image placeholders appear.",
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cross-post generation failed: {str(e)}")

async def _generate_crosspost_markdown(html_content: str, slug: str, api_key: str) -> dict:
    """Convert a published HTML blog post to clean Markdown for Medium/Substack.

    - Strips all HTML/CSS/JS chrome (nav, footer, styles, scripts)
    - Converts article body to Markdown
    - Replaces inline SVGs with image placeholders
    - Adds canonical link header and series footer
    - Exports SVG diagrams as light-mode PNGs
    """
    import re

    # Extract metadata from HTML
    title_match = re.search(r'<h1[^>]*>(.*?)</h1>', html_content, re.DOTALL)
    title = re.sub(r'<[^>]+>', '', title_match.group(1)).strip() if title_match else slug

    subtitle_match = re.search(r'class="subpage-hero-subtitle"[^>]*>(.*?)</p>', html_content, re.DOTALL)
    subtitle = re.sub(r'<[^>]+>', '', subtitle_match.group(1)).strip() if subtitle_match else ""

    series_match = re.search(r'class="series-banner"[^>]*>(.*?)</div>', html_content, re.DOTALL)
    series_text = re.sub(r'<[^>]+>', '', series_match.group(1)).strip().replace('·', '-') if series_match else ""

    canonical_url = f"https://kiranrao.ai/blog/{slug}.html"

    # Check for inline SVGs with role="img" (architecture diagrams)
    svg_diagrams = re.findall(r'<svg[^>]*role="img"[^>]*>.*?</svg>', html_content, re.DOTALL)
    diagram_images = []

    for i, svg in enumerate(svg_diagrams):
        aria_match = re.search(r'aria-label="([^"]*)"', svg)
        alt_text = aria_match.group(1) if aria_match else f"Diagram {i + 1}"
        img_name = f"{slug}-diagram-{i + 1}.png" if len(svg_diagrams) > 1 else f"{slug}-diagram.png"
        diagram_images.append({"filename": img_name, "alt": alt_text})

    # Extract just the article body
    article_match = re.search(r'<article[^>]*>(.*?)</article>', html_content, re.DOTALL)
    article_html = article_match.group(1) if article_match else ""

    # Use Claude to convert HTML to clean Markdown
    client = create_client(api_key)

    diagram_instructions = ""
    if diagram_images:
        placeholders = "\n".join(
            f"- Replace inline SVG diagrams with: ![{d['alt']}]({d['filename']})"
            for d in diagram_images
        )
        diagram_instructions = f"""
DIAGRAM HANDLING:
The HTML contains inline SVG diagrams. Replace each one with a Markdown image placeholder:
{placeholders}
Add an italic caption below each image placeholder describing what the diagram shows."""

    collected = []
    with client.messages.stream(
        model=CLAUDE_MODEL,
        max_tokens=16000,
        messages=[{
            "role": "user",
            "content": f"""Convert this blog post HTML to clean Markdown for Medium and Substack.

HEADER FORMAT:
# {title}

{"### " + subtitle if subtitle else ""}

*{series_text}*

*This post was originally published on [kiranrao.ai]({canonical_url}). For the best experience - including the interactive, theme-adaptive architecture diagram - read it there.*

---

ARTICLE HTML TO CONVERT:
{article_html}

{diagram_instructions}

CONVERSION RULES:
- Convert all HTML tags to Markdown equivalents
- <h2> becomes ## heading
- <p> becomes plain paragraph with blank line separation
- <strong> becomes **bold**
- <em> becomes *italic*
- <blockquote> becomes > quote
- <br> within a paragraph: keep text flowing naturally
- Remove all HTML class attributes, style attributes, and data attributes
- Remove all <div> wrapper tags
- Preserve the article-sources section as a numbered list under a "Sources" heading
- American English throughout
- No em dashes anywhere - use " - " (space-hyphen-space)
- Do NOT include any HTML tags in the output

FOOTER:
After the Sources section, add:

---

*This is {series_text if series_text else "part of a series"} - breaking down the payment systems we use every day from a product manager's perspective.*

*Originally published at [kiranrao.ai]({canonical_url})*

*Tags: [extract from article tags in the HTML]*

Output ONLY the Markdown. No explanation, no code fences."""
        }],
    ) as stream:
        for text in stream.text_stream:
            collected.append(text)

    markdown = "".join(collected).strip()

    # Export SVG diagrams as light-mode PNGs
    if svg_diagrams:
        try:
            await _export_svg_diagrams(html_content, slug, diagram_images)
        except Exception:
            pass  # Non-fatal: user can manually export

    return {"markdown": markdown, "diagram_images": [d["filename"] for d in diagram_images]}

async def _export_svg_diagrams(html_content: str, slug: str, diagram_images: list):
    """Export inline SVG diagrams as light-mode PNGs using Playwright."""
    import re

    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return  # Playwright not installed, skip PNG export

    svg_blocks = re.findall(r'(<svg[^>]*role="img"[^>]*>.*?</svg>)', html_content, re.DOTALL)
    if not svg_blocks:
        return

    images_dir = os.path.join(SITE_ROOT, "images")
    os.makedirs(images_dir, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 800, "height": 1200})

        for i, svg_html in enumerate(svg_blocks):
            light_html = f"""<!DOCTYPE html>
<html data-theme="light"><head><style>
body {{ margin: 0; padding: 24px; background: #f5f3f0; display: flex; justify-content: center; }}
svg {{ max-width: 720px; width: 100%; }}
:root {{ --text-primary: #3a3632; --text-muted: #9a948e; --bg-primary: #f5f3f0; --border: #c5c0b8; --text-secondary: #5a5347; }}
</style></head><body>{svg_html}</body></html>"""

            await page.set_content(light_html)
            await page.wait_for_timeout(500)

            svg_el = await page.query_selector("svg")
            if svg_el:
                img_filename = diagram_images[i]["filename"] if i < len(diagram_images) else f"{slug}-diagram-{i + 1}.png"
                await svg_el.screenshot(path=os.path.join(images_dir, img_filename))

        await browser.close()

# ── Legacy Publish (Direct) ──────────────────────────────────────

@router.post("/publish", response_model=dict)
async def publish_post(request: PublishRequest):
    """(Legacy) Publish a completed blog post directly to the site."""
    state = get_session(request.session_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Session {request.session_id} not found")

    if state["status"] not in ("ready_to_publish", "previewing"):
        raise HTTPException(
            status_code=400,
            detail=f"Session not ready to publish (status: {state['status']})",
        )

    git = GitHandler()

    try:
        result = await git.publish_blog_post(
            slug=request.slug,
            html_content=request.html_content,
            card_html=request.card_html,
        )

        update_session(request.session_id, {"status": "published"})
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Publishing failed: {str(e)}")
