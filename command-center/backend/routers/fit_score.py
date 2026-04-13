"""
Fit Narrative Router — Shows how Kiran's experience maps to a role, streamed live.

Dynamically selects the most relevant career initiatives based on JD requirements,
then generates a three-section narrative grounded in specific shipped work.

Endpoints:
  POST /analyze         — Analyze job description and generate fit narrative
  GET  /health          — Health check
"""

import json
import re
import asyncio
import os
from typing import Optional, AsyncGenerator, List, Dict
from pydantic import BaseModel
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from utils.config import CLAUDE_MODEL, resolve_api_key, get_logger
from services.claude_client import create_client

logger = get_logger(__name__)

router = APIRouter()

# ── Load Career Initiatives ──────────────────────────────────────────────

INITIATIVES_PATH = os.path.join(
    os.path.dirname(__file__), "..", "data", "career_initiatives", "initiatives.json"
)

def load_initiatives() -> List[Dict]:
    """Load career initiatives from JSON file."""
    try:
        with open(INITIATIVES_PATH, "r") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load initiatives: {e}")
        return []

INITIATIVES = load_initiatives()

def build_initiative_catalog() -> str:
    """Build a compact catalog of all initiatives for the selection prompt."""
    lines = []
    for i, init in enumerate(INITIATIVES):
        domains = ", ".join(init.get("domains", []))
        metrics = "; ".join(
            f"{m['number']} {m['label']}" for m in init.get("outcome_metrics", [])
        )
        lines.append(
            f"[{i}] {init['title']} ({init['company']}, {init.get('role', '')}) "
            f"| domains: {domains} | metrics: {metrics}"
        )
    return "\n".join(lines)

INITIATIVE_CATALOG = build_initiative_catalog()

def format_selected_initiatives(indices: List[int]) -> str:
    """Format full detail for selected initiatives."""
    sections = []
    for idx in indices:
        if 0 <= idx < len(INITIATIVES):
            init = INITIATIVES[idx]
            metrics = "\n".join(
                f"  - {m['number']} {m['label']}" for m in init.get("outcome_metrics", [])
            )
            sections.append(
                f"### {init['title']} ({init['company']}, {init.get('role', '')})\n"
                f"**Problem:** {init.get('problem', '')}\n"
                f"**Bet:** {init.get('bet', '')}\n"
                f"**Shipped:** {init.get('shipped', '')}\n"
                f"**Outcome:** {init.get('outcome', '')}\n"
                f"**Metrics:**\n{metrics}"
            )
    return "\n\n".join(sections)


# ── Constants ─────────────────────────────────────────────────────────────

KIRAN_SUMMARY = """Kiran Rao — Senior Product Manager, 15+ years.
Companies: Wells Fargo (VP Product, Mobile & AI Growth), First Republic (VP Digital Products), Avatour (VP Product), Magley & Associates (Consultant).
Education: Kellogg Executive Education, Certified ScrumMaster.
32 documented career initiatives spanning AI/ML, mobile at scale, payments, platform architecture, growth/adoption, personalization, security, lending, and zero-to-one products.
Also built this portfolio site from scratch: AI agent (Fenix) with tool-calling, RAG, streaming, identity gating — hands-on proof of full-stack product + AI execution."""

PREFERRED_COMPANIES = {
    "Anthropic", "OpenAI", "Google", "Apple", "NVIDIA",
    "Airbnb", "Uber", "Netflix", "Disney", "Meta",
    "Snap", "Canva", "Adobe", "Intuit", "ServiceNow",
    "Asana", "Figma", "Shopify", "Stripe", "Block",
    "Ramp", "Robinhood", "Spotify", "DoorDash", "Duolingo",
    "McKinsey", "BCG", "Deloitte", "Bain", "Microsoft"
}

# ── Request Model ─────────────────────────────────────────────────────────

class FitScoreRequest(BaseModel):
    jd_text: str
    visitor_name: Optional[str] = None
    visitor_company: Optional[str] = None


# ── Utility Functions ─────────────────────────────────────────────────────

def create_sse_event(event_type: str, data: dict) -> str:
    """Create an SSE-formatted event."""
    event_data = {"type": event_type, **data}
    return json.dumps(event_data)


# ── SSE Stream Generator ─────────────────────────────────────────────────

async def fit_narrative_stream(
    jd_text: str,
    api_key: str,
    visitor_name: Optional[str] = None,
    visitor_company: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """
    Stream Fenix analyzing the job description and building a fit narrative.

    Yields SSE-formatted JSON events with types:
    - narration: Fenix thinking out loud during analysis
    - narrative_chunk: A piece of the fit narrative (streamed token by token)
    - section: Section header marker (direct_alignment, advantage_of_different, unexpected_value)
    - preferred_company: Company match result
    - complete: Signal that generation is finished
    - decline: JD doesn't have enough signal
    - error: If something goes wrong
    """
    try:
        client = create_client(api_key)

        # ── STEP 1: Extract JD + select relevant initiatives (single call) ──

        yield f"data: {create_sse_event('narration', {'message': 'Reading the role requirements...'})}\n\n"
        await asyncio.sleep(0.1)

        extraction_prompt = f"""You have two jobs:

JOB 1: Analyze this job description and extract the company, role title, and whether it has enough detail for a fit assessment.

JOB 2: From the INITIATIVE CATALOG below, select the 5-8 initiatives that are MOST relevant to this JD's requirements. Pick initiatives where Kiran's shipped work directly addresses what the JD asks for. Prioritize:
- Direct skill/domain matches (JD asks for AI experience → pick AI initiatives)
- Scale matches (JD is for enterprise role → pick enterprise-scale work)
- Capability matches (JD asks for cross-functional leadership → pick initiatives demonstrating that)

Return JSON only:
{{
  "company": "...",
  "role_title": "...",
  "scorable": true/false,
  "diagnosis": "If not scorable, explain what's missing (max 1 sentence)",
  "selected_initiatives": [0, 3, 7, 12, 15]
}}

The selected_initiatives array should contain the INDEX NUMBERS from the catalog below. Pick 5-8 that best map to the JD requirements.

JD TEXT:
{jd_text[:3000]}

INITIATIVE CATALOG:
{INITIATIVE_CATALOG}
"""

        extraction_response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=500,
            messages=[{"role": "user", "content": extraction_prompt}],
        )

        extraction_text = extraction_response.content[0].text.strip()
        try:
            if extraction_text.startswith("```json"):
                extraction_text = extraction_text[7:]
            if extraction_text.startswith("```"):
                extraction_text = extraction_text[3:]
            if extraction_text.endswith("```"):
                extraction_text = extraction_text[:-3]
            extraction = json.loads(extraction_text.strip())
        except json.JSONDecodeError:
            raise ValueError("Claude returned invalid JSON for extraction")

        company = extraction.get("company", "Unknown Company")
        role_title = extraction.get("role_title", "Unknown Role")

        # Check if scorable
        if not extraction.get("scorable", False):
            diagnosis = extraction.get("diagnosis", "Not enough detail in the job description")
            yield f"data: {create_sse_event('decline', {'message': f'I need more to work with: {diagnosis}'})}\n\n"
            yield f"data: {create_sse_event('complete', {'decline': True, 'decline_reason': diagnosis})}\n\n"
            return

        # ── STEP 2: Build rich profile from selected initiatives ──────────

        selected_indices = extraction.get("selected_initiatives", [])
        if not selected_indices:
            # Fallback: use first 6 initiatives
            selected_indices = list(range(min(6, len(INITIATIVES))))

        selected_profile = format_selected_initiatives(selected_indices)
        logger.info(f"Selected {len(selected_indices)} initiatives for {company} {role_title}: {selected_indices}")

        # ── STEP 3: Check preferred companies ─────────────────────────────

        preferred_match = any(
            pref.lower() in company.lower() or company.lower() in pref.lower()
            for pref in PREFERRED_COMPANIES
        )

        yield f"data: {create_sse_event('preferred_company', {'match': preferred_match, 'company': company})}\n\n"

        msg = f"Mapping Kiran's experience to {company}'s {role_title} role..."
        yield f"data: {create_sse_event('narration', {'message': msg})}\n\n"
        await asyncio.sleep(0.1)

        # ── STEP 4: Generate fit narrative (streamed) ─────────────────────

        visitor_context = ""
        if visitor_name:
            visitor_context = f"\nThe person reading this is {visitor_name}"
            if visitor_company:
                visitor_context += f" from {visitor_company}"
            visitor_context += "."

        preferred_note = ""
        if preferred_match:
            preferred_note = f"\n\nNote: {company} is on Kiran's target company list — he is actively interested in this company. You can mention this naturally in section 3 if it fits."

        narrative_prompt = f"""You are Fenix, Kiran Rao's AI agent. A recruiter or hiring manager has pasted a job description. Below are the specific career initiatives from Kiran's history that are most relevant to this role. Your job: map this evidence to their requirements. Fast, specific, undeniable.

The reader is comparing Kiran against a stack of candidates. Make the match the easiest to see.

RULES:
- Every claim must trace to a specific initiative below. Cite the project name, the metric, the outcome. No vague references.
- Use the JD's own language when describing Kiran's matching work. If the JD says "drive member engagement," don't say "improved user metrics" — say what Kiran did that drove member engagement and the number.
- NO percentages, NO scores, NO ratings
- NEVER use "career transition", "career pivot", "different background", "non-traditional"
- NEVER label Kiran's industry as a category — just describe what he shipped
- NEVER defensively reframe. Strengths are strengths. Period.
- Confident, direct, matter-of-fact. Not salesy, not apologetic.
- 150-250 words total. 2-4 sentences per section. No bullet points — flowing prose.

STRUCTURE:

**[Write a section header that names the strongest match between Kiran's work and this specific role — use the JD's language]**
[2-4 sentences. Lead with the initiative that most directly maps to the JD's core ask. State what Kiran shipped, the scale, the result. Then layer the next strongest match. Every sentence should make the reader think "this person has done exactly this."]

**[Write a section header that names additional value Kiran brings beyond what the JD asks for]**
[2-4 sentences. What the JD doesn't ask for but any smart hiring manager wants. Draw from the initiatives — capabilities, scale of impact, or cross-domain experience that compounds. Frame as upside, not consolation.]

**The question worth asking**
[One sharp, specific question tied to the hardest problem in the JD. Imply that Kiran has already solved it. Not generic — reference a specific initiative and metric. The reader should think "I need to ask this person about that."]
{visitor_context}{preferred_note}

JOB DESCRIPTION:
{jd_text[:3000]}

KIRAN RAO — BACKGROUND:
{KIRAN_SUMMARY}

SELECTED CAREER INITIATIVES (most relevant to this role):
{selected_profile}
"""

        # Stream the narrative response
        with client.messages.stream(
            model=CLAUDE_MODEL,
            max_tokens=1000,
            messages=[{"role": "user", "content": narrative_prompt}],
        ) as stream:
            current_section = None
            section_count = 0
            buffer = ""

            # Section IDs for styling (mapped by order of appearance)
            section_ids = ["shipped_match", "added_value", "sharp_question"]

            for text in stream.text_stream:
                buffer += text

                # Detect any markdown bold header (** ... **)
                header_match = re.search(r'\*\*([^*]+)\*\*', buffer)
                if header_match:
                    header_text = header_match.group(1).strip()
                    section_id = section_ids[section_count] if section_count < len(section_ids) else f"section_{section_count}"
                    section_count += 1
                    current_section = section_id

                    yield f"data: {create_sse_event('section', {'id': section_id, 'label': header_text})}\n\n"

                    # Remove the full header from buffer
                    full_match = header_match.group(0)
                    buffer = buffer[buffer.index(full_match) + len(full_match):].lstrip("\n")

                # Send buffered text as narrative chunks (flush every few chars for smooth streaming)
                if len(buffer) > 3:
                    yield f"data: {create_sse_event('narrative_chunk', {'text': buffer})}\n\n"
                    buffer = ""

            # Flush remaining buffer
            if buffer.strip():
                yield f"data: {create_sse_event('narrative_chunk', {'text': buffer})}\n\n"

        # ── STEP 4: Complete ──────────────────────────────────────────────

        yield f"data: {create_sse_event('complete', {'company': company, 'role_title': role_title, 'preferred_company': preferred_match, 'decline': False})}\n\n"

    except Exception as e:
        logger.error(f"Fit narrative streaming error: {str(e)}", exc_info=True)
        yield f"data: {create_sse_event('error', {'message': str(e)})}\n\n"


# ── Endpoints ─────────────────────────────────────────────────────────────

@router.post("/analyze")
async def analyze_fit(
    request: FitScoreRequest,
    x_claude_key: str = Header(None, alias="X-Claude-Key"),
):
    """
    POST /api/fit-score/analyze

    Analyze a job description and generate a streamed fit narrative.
    Returns SSE stream with real-time narration and narrative chunks.

    Request:
    {
      "jd_text": "Full job description text",
      "visitor_name": "Optional visitor name",
      "visitor_company": "Optional visitor company"
    }

    Response: SSE stream with events:
    - narration: Fenix thinking out loud
    - section: Section header marker
    - narrative_chunk: Piece of narrative text
    - preferred_company: Company match
    - complete: Final result
    - decline: JD doesn't have enough detail
    - error: If something goes wrong
    """
    if not request.jd_text.strip():
        raise HTTPException(status_code=400, detail="jd_text is required")

    api_key = resolve_api_key(x_claude_key)

    async def event_stream():
        async for event_json in fit_narrative_stream(
            jd_text=request.jd_text,
            api_key=api_key,
            visitor_name=request.visitor_name,
            visitor_company=request.visitor_company,
        ):
            yield event_json

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "fit-narrative"}
