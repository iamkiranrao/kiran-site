"""
Teardown Router — Interactive 8-step co-creation workflow endpoints.

Endpoints:
  POST   /create           — Start a new teardown session
  GET    /sessions         — List all sessions
  GET    /sessions/{id}    — Get session state
  DELETE /sessions/{id}    — Delete a session
  POST   /sessions/{id}/step  — Run a step (with streaming)
  POST /sessions/{id}/approve — Approve current step's draft
  POST /sessions/{id}/revise  — Request revision with feedback
  POST /sessions/{id}/publish — Save teardown locally for preview
  POST /sessions/{id}/deploy  — Push local preview to production (git + Netlify)
  GET  /                 — List published teardowns on the live site
"""

import os
import json
from pathlib import Path
from utils.config import CLAUDE_MODEL, resolve_api_key
from services.claude_client import create_client
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from models.teardown import CreateRequest, StepRequest, ApproveRequest, ReviseRequest, GoToStepRequest, PublishRequest
from typing import Optional

# ── Resolve paths ─────────────────────────────────────────────────

# The user's local website folder (mounted repo)
# Resolves to: routers/ → backend/ → command-center/ → website root
_BACKEND_DIR = Path(__file__).resolve().parent.parent  # backend/
SITE_ROOT = os.getenv(
    "KIRAN_SITE_LOCAL_FOLDER",
    str(_BACKEND_DIR.parent.parent),  # command-center/ → website root
)

from services.teardown_service import (
    STEPS,
    create_session,
    get_session,
    delete_session,
    list_sessions,
    save_step_result,
    save_decision,
    update_session,
    run_step,
    run_step_stream,
)
from services.git_handler import GitHandler

router = APIRouter()

# ── Request models ─────────────────────────────────────────────────

# ── Endpoints ──────────────────────────────────────────────────────

@router.get("/", response_model=dict)
async def list_published_teardowns():
    """List teardowns published on the live site."""
    teardowns_dir = os.path.join(SITE_ROOT, "teardowns")

    published = []
    if os.path.exists(teardowns_dir):
        for f in os.listdir(teardowns_dir):
            if f.endswith(".html") and "-" in f:
                published.append({
                    "filename": f,
                    "url": f"https://kiranrao.ai/teardowns/{f}",
                })

    # Also include known published ones
    known = [
        {"company": "Meta", "product": "Instagram", "filename": "meta-instagram.html",
         "url": "https://kiranrao.ai/teardowns/meta-instagram.html"},
        {"company": "GEICO", "product": "Mobile App", "filename": "geico-mobile-app.html",
         "url": "https://kiranrao.ai/teardowns/geico-mobile-app.html"},
        {"company": "Intuit", "product": "TurboTax", "filename": "intuit-turbo-tax.html",
         "url": "https://kiranrao.ai/teardowns/intuit-turbo-tax.html"},
        {"company": "Airbnb", "product": "Mobile App", "filename": "airbnb-mobile.html",
         "url": "https://kiranrao.ai/teardowns/airbnb-mobile.html"},
    ]

    return {"published": known, "steps": STEPS}

@router.get("/steps", response_model=dict)
async def get_step_definitions():
    """Return the 8-step workflow definition."""
    return {"steps": STEPS}

@router.post("/create", response_model=dict)
async def create_teardown(request: CreateRequest):
    """Start a new teardown co-creation session."""
    session = create_session(request.company, request.product)
    return {
        "session_id": session["session_id"],
        "company": session["company"],
        "product": session["product"],
        "current_step": 1,
        "steps": STEPS,
    }

@router.get("/sessions", response_model=dict)
async def get_sessions():
    """List all teardown sessions."""
    sessions = list_sessions()
    return {"sessions": sessions}

@router.get("/sessions/{session_id}", response_model=dict)
async def get_session_detail(session_id: str):
    """Get full session state."""
    state = get_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    return state

@router.delete("/sessions/{session_id}", response_model=dict)
async def delete_session_endpoint(session_id: str):
    """Delete a teardown session."""
    try:
        delete_session(session_id)
        return {"deleted": True, "session_id": session_id}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

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
            detail=f"Step {step} has no draft to approve (status: {step_data['status'] if step_data else 'no data'})",
        )

    # Mark as approved and advance
    save_step_result(session_id, step, step_data["content"], status="approved")
    save_decision(session_id, step, request.decision or "Approved")

    updated = get_session(session_id)

    # If all 8 steps approved, mark session as ready to publish
    if step == 8:
        update_session(session_id, {"status": "ready_to_publish"})
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
    """Re-run the current step with feedback from Kiran."""
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
    if target < 1 or target > 8:
        raise HTTPException(status_code=400, detail="Step must be between 1 and 8")

    # Can only go to steps that have been completed/approved, or the next step after last approved
    # Find the highest approved step
    max_approved = 0
    for s in range(1, 9):
        sd = state["steps"].get(str(s))
        if sd and sd.get("status") == "approved":
            max_approved = s

    # Can navigate to any step up to max_approved + 1
    if target > max_approved + 1:
        raise HTTPException(status_code=400, detail=f"Cannot jump to step {target}. Latest approved step is {max_approved}.")

    # Update current_step
    update_session(session_id, {"current_step": target})
    updated = get_session(session_id)

    return {
        "current_step": target,
        "status": updated["status"],
    }

# ── HTML Assembly Helpers ─────────────────────────────────────────

def _load_template() -> str:
    template_path = os.path.join(
        os.path.dirname(__file__), "..", "templates", "teardown-template.html"
    )
    with open(template_path, "r", encoding="utf-8") as f:
        return f.read()

def _extract_json_from_step8(content: str) -> Optional[dict]:
    # Try ---JSON-START--- separator first (new format)
    if "---JSON-START---" in content:
        json_part = content.split("---JSON-START---", 1)[1].strip()
        # Clean up markdown fences
        if json_part.startswith("```json"):
            json_part = json_part[7:]
        if json_part.startswith("```"):
            json_part = json_part[3:]
        if json_part.endswith("```"):
            json_part = json_part[:-3]
        try:
            return json.loads(json_part.strip())
        except json.JSONDecodeError:
            return None

    # Legacy: try ---HTML-START--- separator (old format)
    if "---HTML-START---" in content:
        html_part = content.split("---HTML-START---", 1)[1].strip()
        if html_part.startswith("```html"):
            html_part = html_part[7:]
        if html_part.startswith("```"):
            html_part = html_part[3:]
        if html_part.endswith("```"):
            html_part = html_part[:-3]
        return {"_legacy_html": html_part.strip()}

    return None

def _assemble_from_template(state: dict, fragments: dict) -> str:
    """Assemble a complete HTML page by injecting content fragments into the canonical template.

    This is a pure string replacement — no Claude call needed.
    The template has {{PLACEHOLDER}} markers that get replaced with content.
    """
    template = _load_template()

    company = state["company"]
    product = state["product"]
    company_slug = company.lower().replace(" ", "-")
    product_slug = product.lower().replace(" ", "-")

    from datetime import datetime
    today = datetime.now().strftime("%b %d, %Y")

    # Build the replacement map
    replacements = {
        "{{TITLE}}": fragments.get("title", f"{product} Product Teardown"),
        "{{TAGLINE}}": fragments.get("tagline", ""),
        "{{OG_DESCRIPTION}}": fragments.get("og_description", f"Product teardown of {company} {product}."),
        "{{CANONICAL_URL}}": f"https://kiranrao.ai/teardowns/{company_slug}-{product_slug}.html",
        "{{PRODUCT}}": fragments.get("title", f"{product} Product Teardown"),
        "{{BREADCRUMB_HOME_LINK}}": "../how-id-built-it.html",
        "{{BREADCRUMB_CATEGORY_LINK}}": f"{company_slug}.html",
        "{{CATEGORY}}": company,
        "{{GLOSSARY_ITEMS}}": fragments.get("glossary_items", ""),
        "{{PERSONA_IMAGE}}": fragments.get("persona_image", f"https://ui-avatars.com/api/?name={fragments.get('persona_name', 'User').replace(' ', '+')}&size=96&background=random"),
        "{{PERSONA_NAME}}": fragments.get("persona_name", ""),
        "{{PERSONA_DEMOGRAPHICS}}": fragments.get("persona_demographics", ""),
        "{{PERSONA_BIO}}": fragments.get("persona_bio", ""),
        "{{DISCOVERY_PARAGRAPHS}}": fragments.get("discovery_paragraphs", ""),
        "{{JOURNEY_SENTIMENT_SVG}}": fragments.get("journey_sentiment_svg", ""),
        "{{JOURNEY_STAGES}}": fragments.get("journey_stages", ""),
        "{{JTBD_TEXT}}": fragments.get("jtbd_text", ""),
        "{{KKB_INTRO_PARAGRAPHS}}": fragments.get("kkb_intro_paragraphs", ""),
        "{{KKB_KEEP_ITEMS}}": fragments.get("kkb_keep_items", ""),
        "{{KKB_KILL_ITEMS}}": fragments.get("kkb_kill_items", ""),
        "{{KKB_BUILD_ITEMS}}": fragments.get("kkb_build_items", ""),
        "{{REDESIGN_INTRO_PARAGRAPHS}}": fragments.get("redesign_intro_paragraphs", ""),
        "{{WIREFRAME_PAIRS}}": fragments.get("wireframe_pairs", ""),
        "{{EXEC_SUMMARY}}": fragments.get("exec_summary", ""),
        "{{KPI_CARDS}}": fragments.get("kpi_cards", ""),
        "{{BUSINESS_CASE_PARAGRAPHS}}": fragments.get("business_case_paragraphs", ""),
        "{{ASSUMPTIONS_TEXT}}": fragments.get("assumptions_text", ""),
        "{{PRODUCT_DESCRIPTION}}": fragments.get("product_description", ""),
        "{{GLANCE_STATS}}": fragments.get("glance_stats", ""),
        "{{COMPETITOR_TAGS}}": fragments.get("competitor_tags", ""),
        "{{LEADS_TEXT}}": fragments.get("leads_text", ""),
        "{{LAGS_TEXT}}": fragments.get("lags_text", ""),
        "{{VERSION}}": "v1.0.24",
        "{{LAST_UPDATED}}": f"Updated {today}",
    }

    html = template
    for placeholder, value in replacements.items():
        html = html.replace(placeholder, value)

    return html

async def _assemble_html_from_steps(state: dict, api_key: str) -> str:
    """Use Claude to generate content fragments, then inject into the canonical template.

    Step 1: Claude generates a JSON object with content for each template placeholder.
    Step 2: Python injects those fragments into the template mechanically.
    """
    # Gather all step content
    all_content = []
    for i in range(1, 9):
        step_data = state["steps"].get(str(i))
        if step_data and step_data.get("content"):
            all_content.append(f"=== STEP {i}: {STEPS[i-1]['label']} ===\n{step_data['content']}")

    combined = "\n\n".join(all_content)
    company = state["company"]
    product = state["product"]

    # Check if step 8 already has JSON fragments
    step8 = state["steps"].get("8")
    if step8 and step8.get("content"):
        fragments = _extract_json_from_step8(step8["content"])
        if fragments and "_legacy_html" not in fragments:
            return _assemble_from_template(state, fragments)

    # Load CONTENT-RULES for enforcement
    content_rules = ""
    rules_path = os.path.join(SITE_ROOT, "CONTENT-RULES.md")
    if os.path.exists(rules_path):
        with open(rules_path, "r", encoding="utf-8") as f:
            content_rules = f.read()

    client = create_client(api_key)

    # Ask Claude to generate JSON content fragments
    collected = []
    with client.messages.stream(
        model=CLAUDE_MODEL,
        max_tokens=30000,
        messages=[{
            "role": "user",
            "content": f"""Generate content fragments for a teardown page on kiranrao.ai.

Company: {company}
Product: {product}

=== TEARDOWN CONTENT (from 8-step process) ===
{combined}
=== END CONTENT ===

=== CONTENT RULES ===
{content_rules}
=== END CONTENT RULES ===

Output a JSON object with these keys (all values are HTML fragment strings using EXACT class names from the site template):

{{
  "title": "{product} Product Teardown",
  "tagline": "Tagline",
  "og_description": "SEO description",
  "glossary_items": "<div class=\\"glossary-term\\"><strong>Term</strong> — Def.</div>\\n...",
  "persona_name": "Name",
  "persona_demographics": "Demographics",
  "persona_bio": "Bio",
  "discovery_paragraphs": "<p>...</p>",
  "journey_sentiment_svg": "<svg ...>curve</svg>",
  "journey_stages": "<div class=\\"journey-stage-card\\">...</div>\\n...",
  "jtbd_text": "JTBD statement",
  "kkb_keep_items": "<div class=\\"kkb-item\\"><div class=\\"kkb-item-title\\">X</div><div class=\\"kkb-item-detail\\">Y</div></div>\\n...",
  "kkb_kill_items": "...",
  "kkb_build_items": "...",
  "kkb_intro_paragraphs": "<p>...</p>",
  "redesign_intro_paragraphs": "<p>...</p>",
  "wireframe_pairs": "<div class=\\"wireframe-pair\\"><div class=\\"wireframe-label\\">Title</div><div class=\\"wireframe-box\\"><div class=\\"wireframe-box-label\\">Label</div><svg ...>wf- prefixed classes only</svg></div><div class=\\"wireframe-caption\\">Caption</div></div>",
  "exec_summary": "Summary text",
  "kpi_cards": "<div class=\\"kpi-card\\"><div class=\\"kpi-funnel-stage\\">Stage</div><div class=\\"kpi-metric\\">+X%</div><div class=\\"kpi-name\\">Name</div><div class=\\"kpi-rationale\\">Why</div></div>\\n...",
  "business_case_paragraphs": "<p>...</p>",
  "assumptions_text": "Assumptions text",
  "product_description": "Product description",
  "glance_stats": "<div><div class=\\"glance-stat-label\\">Label</div><div class=\\"glance-stat-value\\">Value</div></div>\\n...",
  "competitor_tags": "<span class=\\"glance-competitor-tag\\">Name</span>\\n...",
  "leads_text": "<p>Where it leads</p>",
  "lags_text": "<p>Where it lags</p>"
}}

RULES:
- NO em dashes. Use " - " (space-hyphen-space).
- SVG wireframe classes MUST use wf- prefix only.
- Journey sentiment SVG MUST use viewBox="0 0 500 130", cubic bezier C commands, 3 reference lines at y=20/55/90, Y-axis labels at x=8 (Optimistic/Neutral/Frustrated) font-size=7, colored circle data points r=6 (#6b9e6b green positive, #c47474 red negative, #d4a74a amber neutral), sentiment labels above each dot, and X-axis UPPERCASE stage labels at y=120. Use var(--text-muted), var(--border), var(--text-secondary) for theme compatibility. Include <title> and aria-label. Sentiment dot labels must NOT share the same y-coordinate as Y-axis tier labels - minimum 5px clearance.
- All content from all 8 steps must be represented.
- Journey stage grid columns: set --journey-cols CSS variable on .journey-stages to match the actual number of stages.
- SVG TEXT CONTAINMENT (critical): Before placing any <text>, calculate width = chars × font-size × 0.6. Text must fit inside its parent rect with 10px padding on each side. If text is too long: reduce font-size, split into 2 lines, or widen container. Right-side text near edges MUST use text-anchor="end". Button text must fit within button width minus 20px. Max single-line header font-size inside 300px wireframe screen is 13px for text > 25 chars - split longer headers into 2 <text> elements.

Output ONLY valid JSON. No explanation, no markdown fences."""
        }],
    ) as stream:
        for text in stream.text_stream:
            collected.append(text)

    raw = "".join(collected).strip()
    # Clean up markdown fences
    if raw.startswith("```json"):
        raw = raw[7:]
    if raw.startswith("```"):
        raw = raw[3:]
    if raw.endswith("```"):
        raw = raw[:-3]

    try:
        fragments = json.loads(raw.strip())
    except json.JSONDecodeError:
        raise RuntimeError("Claude returned invalid JSON for content fragments. Try again.")

    return _assemble_from_template(state, fragments)

# ── Publish (Local Preview) ───────────────────────────────────────

@router.post("/sessions/{session_id}/publish", response_model=dict)
async def publish_teardown(
    session_id: str,
    request: PublishRequest,
    x_claude_key: str = Header(None, alias="X-Claude-Key"),
):
    """Save teardown locally for preview. Does NOT push to production."""
    state = get_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    if state["status"] not in ("ready_to_publish", "published", "previewing"):
        raise HTTPException(
            status_code=400,
            detail=f"Session not ready to publish (status: {state['status']}). Complete all 8 steps first.",
        )

    product_slug = state["product"].lower().replace(" ", "-")
    company_slug = state["company"].lower().replace(" ", "-")
    filename = f"{company_slug}-{product_slug}.html"

    # ALWAYS use template-based assembly.
    # Step 8 generates JSON content fragments; we inject them into the canonical template.
    # This guarantees CSS, navigation, footer, and Fenix widget are always correct.
    step8 = state["steps"].get("8")
    if step8 and step8.get("content"):
        fragments = _extract_json_from_step8(step8["content"])
        if fragments and "_legacy_html" not in fragments:
            # New format: JSON fragments → template injection (no Claude call needed)
            html_content = _assemble_from_template(state, fragments)
        else:
            # Legacy or no JSON: use Claude to re-generate fragments from all steps
            api_key = resolve_api_key(x_claude_key)
            try:
                html_content = await _assemble_html_from_steps(state, api_key)
            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to assemble HTML page: {str(e)}",
                )
    else:
        # No step 8 content at all — assemble from earlier steps
        api_key = resolve_api_key(x_claude_key)
        try:
            html_content = await _assemble_html_from_steps(state, api_key)
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to assemble HTML page: {str(e)}",
            )

    # Save to local teardowns folder
    teardowns_dir = os.path.join(SITE_ROOT, "teardowns")
    os.makedirs(teardowns_dir, exist_ok=True)
    teardown_path = os.path.join(teardowns_dir, filename)
    with open(teardown_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    # Update session status to previewing
    update_session(session_id, {"status": "previewing", "local_file": teardown_path})

    return {
        "status": "previewing",
        "local_file": f"teardowns/{filename}",
        "message": f"Saved locally at teardowns/{filename}. Open the file to preview, then Deploy to push to production.",
    }

# ── Deploy (Push to Production) ───────────────────────────────────

@router.post("/sessions/{session_id}/deploy", response_model=dict)
async def deploy_teardown(session_id: str):
    """Push a locally-previewed teardown to production via git."""
    state = get_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    if state["status"] not in ("previewing", "published"):
        raise HTTPException(
            status_code=400,
            detail=f"Session must be previewed first (status: {state['status']}). Hit Publish first to generate the page locally.",
        )

    product_slug = state["product"].lower().replace(" ", "-")
    company_slug = state["company"].lower().replace(" ", "-")
    filename = f"{company_slug}-{product_slug}.html"

    # Read the local file
    teardown_path = os.path.join(SITE_ROOT, "teardowns", filename)
    if not os.path.exists(teardown_path):
        raise HTTPException(status_code=404, detail=f"Local file not found: teardowns/{filename}")

    with open(teardown_path, "r", encoding="utf-8") as f:
        html_content = f.read()

    git = GitHandler()

    try:
        result = await git.publish_teardown(
            filename=filename,
            html_content=html_content,
            company=state["company"],
            product=state["product"],
        )

        update_session(session_id, {"status": "published"})

        # Fire notification for deployed content
        try:
            from services.notification_service import notify_draft_content
            teardown_title = f"{state['company']} — {state['product']}"
            notify_draft_content("teardown", teardown_title, filename.replace(".html", ""), session_id)
        except Exception:
            pass  # Fire-and-forget

        # Auto-capture evidence source for the skills page
        try:
            from services.evidence_service import create_source, get_source
            source_id = f"td-{company_slug}"
            teardown_label = f"{state['company']} {state['product']} Teardown"
            try:
                get_source(source_id)  # Check if already exists
            except Exception:
                create_source(
                    id=source_id,
                    label=teardown_label,
                    type="teardown",
                    issuer="How I'd've Built It",
                    url=f"teardowns/{filename}",
                )
            from services.notification_service import create_notification
            create_notification(
                type="draft_content",
                title=f"New teardown needs skill mappings: {teardown_label}",
                summary="Published via Teardown Builder. Add skill links in Add Skills dashboard.",
                source="teardown_pipeline",
                action_url="/dashboard/add-skills",
                priority="normal",
            )
        except Exception:
            pass  # Fire-and-forget — evidence capture is non-blocking

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Deploy failed: {str(e)}")
