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
from pathlib import Path
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional


# ── Resolve paths ─────────────────────────────────────────────────
_BACKEND_DIR = Path(__file__).resolve().parent.parent  # backend/
SITE_ROOT = os.getenv(
    "KIRAN_SITE_LOCAL_FOLDER",
    str(_BACKEND_DIR.parent.parent),  # command-center/ → website root
)


def _resolve_api_key(header_key: Optional[str]) -> str:
    """Use header key if provided, otherwise fall back to env var."""
    if header_key and header_key.startswith("sk-ant-"):
        return header_key
    env_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if env_key and env_key.startswith("sk-ant-"):
        return env_key
    raise HTTPException(status_code=401, detail="No valid Claude API key found. Set ANTHROPIC_API_KEY in backend/.env or provide X-Claude-Key header.")

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

class CreateRequest(BaseModel):
    mode: str  # "blog" or "social"
    theme: Optional[str] = None
    angle: Optional[str] = None
    series: Optional[str] = None


class StepRequest(BaseModel):
    user_input: Optional[str] = None


class ApproveRequest(BaseModel):
    decision: Optional[str] = "Approved"


class ReviseRequest(BaseModel):
    feedback: str


class ThemeRequest(BaseModel):
    name: str
    description: str


class PreviewRequest(BaseModel):
    html_content: str
    slug: str
    card_html: Optional[str] = None


class PublishRequest(BaseModel):
    session_id: str
    html_content: str
    slug: str
    card_html: Optional[str] = None


class CrossPostRequest(BaseModel):
    """Request to generate Medium/Substack-ready Markdown from a published post."""
    session_id: str


# ── Endpoints ──────────────────────────────────────────────────────

@router.get("/themes")
async def list_themes_endpoint():
    """List available themes and cross-cutting angles."""
    data = get_themes()
    return {
        "themes": data["themes"],
        "angles": data["angles"],
        "count": len(data["themes"]),
    }


@router.post("/themes")
async def add_theme_endpoint(request: ThemeRequest):
    """Add a new theme to the library."""
    result = add_theme(request.name, request.description)
    return result


@router.delete("/themes/{name}")
async def remove_theme_endpoint(name: str):
    """Remove a theme from the library."""
    result = remove_theme(name)
    if not result["found"]:
        raise HTTPException(status_code=404, detail=f"Theme '{name}' not found")
    return result


@router.get("/steps/{mode}")
async def get_step_definitions(mode: str):
    """Return step definitions for blog or social mode."""
    if mode == "blog":
        return {"mode": "blog", "steps": BLOG_STEPS}
    elif mode == "social":
        return {"mode": "social", "steps": SOCIAL_STEPS}
    else:
        raise HTTPException(status_code=400, detail=f"Unknown mode: {mode}")


@router.post("/create")
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


@router.get("/sessions")
async def get_sessions():
    """List all WordWeaver sessions."""
    return {"sessions": list_sessions()}


@router.get("/sessions/{session_id}")
async def get_session_detail(session_id: str):
    """Get full session state."""
    state = get_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    return state


@router.post("/sessions/{session_id}/step")
async def execute_step(
    session_id: str,
    request: StepRequest,
    x_claude_key: str = Header(None, alias="X-Claude-Key"),
):
    """Run the current step via Claude with SSE streaming."""
    api_key = _resolve_api_key(x_claude_key)

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


@router.post("/sessions/{session_id}/approve")
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

    # Mark complete if final step
    if step == updated["total_steps"]:
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
    """Re-run the current step with revision feedback."""
    api_key = _resolve_api_key(x_claude_key)

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


# ── HTML Assembly ──────────────────────────────────────────────

def _load_blog_template() -> str:
    """Load the blog post HTML template."""
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
    import anthropic
    from datetime import datetime

    template = _load_blog_template()

    # Gather all step content from steps 1-12
    all_content = []
    step_labels = {
        1: "Define the Theme",
        2: "Brainstorm Angles",
        3: "Choose & Outline",
        4: "Research",
        5: "Draft the Post",
        6: "Revise & Edit",
        7: "Write the Post",
        8: "Create Social Card",
        9: "Final Polish",
        10: "Fact-Check",
        11: "SEO & Metadata",
        12: "Final Review",
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

    client = anthropic.Anthropic(api_key=api_key)

    # Use streaming to avoid timeout on large requests
    collected = []
    with client.messages.stream(
        model="claude-sonnet-4-20250514",
        max_tokens=30000,
        messages=[{
            "role": "user",
            "content": f"""You are assembling a final HTML blog page for kirangorapalli.com.

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
- Canonical domain is kirangorapalli.com in all URLs (canonical, og:url, og:image, twitter:image, JSON-LD).
- Every page needs its own per-post OG image (not the generic site card). The og:image URL must point to a page-specific image.

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

@router.post("/sessions/{session_id}/preview")
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
            api_key = _resolve_api_key(x_claude_key)
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

@router.post("/sessions/{session_id}/deploy")
async def deploy_post(session_id: str):
    """Push a locally-previewed blog post to production via git."""
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

    git = GitHandler()

    try:
        result = await git.publish_blog_post(
            slug=slug,
            html_content=html_content,
            card_html=state.get("card_html"),
        )

        update_session(session_id, {"status": "published"})

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Deploy failed: {str(e)}")


# ── Cross-Post (Medium / Substack) ────────────────────────────────

@router.post("/sessions/{session_id}/crosspost")
async def generate_crosspost(
    session_id: str,
    x_claude_key: str = Header(None, alias="X-Claude-Key"),
):
    """Generate Medium/Substack-ready Markdown + diagram PNG from a published post.

    Reads the deployed HTML, strips SVGs (replacing with PNG placeholders),
    converts to clean Markdown, adds canonical link and series footer.
    Also exports any inline SVG diagrams as light-mode PNGs.
    """
    api_key = _resolve_api_key(x_claude_key)

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
    import anthropic
    import re

    # Extract metadata from HTML
    title_match = re.search(r'<h1[^>]*>(.*?)</h1>', html_content, re.DOTALL)
    title = re.sub(r'<[^>]+>', '', title_match.group(1)).strip() if title_match else slug

    subtitle_match = re.search(r'class="subpage-hero-subtitle"[^>]*>(.*?)</p>', html_content, re.DOTALL)
    subtitle = re.sub(r'<[^>]+>', '', subtitle_match.group(1)).strip() if subtitle_match else ""

    series_match = re.search(r'class="series-banner"[^>]*>(.*?)</div>', html_content, re.DOTALL)
    series_text = re.sub(r'<[^>]+>', '', series_match.group(1)).strip().replace('·', '-') if series_match else ""

    canonical_url = f"https://kirangorapalli.com/blog/{slug}.html"

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
    client = anthropic.Anthropic(api_key=api_key)

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
        model="claude-sonnet-4-20250514",
        max_tokens=16000,
        messages=[{
            "role": "user",
            "content": f"""Convert this blog post HTML to clean Markdown for Medium and Substack.

HEADER FORMAT:
# {title}

{"### " + subtitle if subtitle else ""}

*{series_text}*

*This post was originally published on [kirangorapalli.com]({canonical_url}). For the best experience - including the interactive, theme-adaptive architecture diagram - read it there.*

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

*Originally published at [kirangorapalli.com]({canonical_url})*

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

@router.post("/publish")
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
