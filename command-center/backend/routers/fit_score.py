"""
Fit Narrative Router — Builds a compelling case for Kiran's fit, streamed live.

Replaces the old numerical scoring pipeline with a three-section narrative:
  1. Direct alignment — where Kiran's experience maps cleanly to the JD
  2. The advantage of different — where gaps become the pitch
  3. What he brings that the JD doesn't ask for — unexpected value

Endpoints:
  POST /analyze         — Analyze job description and generate fit narrative
  GET  /health          — Health check
"""

import json
import re
import asyncio
from typing import Optional, AsyncGenerator
from pydantic import BaseModel
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from utils.config import CLAUDE_MODEL, resolve_api_key, get_logger
from services.claude_client import create_client

logger = get_logger(__name__)

router = APIRouter()

# ── Constants ─────────────────────────────────────────────────────────────

KIRAN_PROFILE = """
Kiran Rao — Senior Product Manager, 15+ years experience.

Career highlights:
- Scaled flagship mobile banking app from 18M to 32M users (4.9 App Store rating)
- Led AI integration at Fargo driving revenue from $4.1M to $27.5M and $52M+ projected savings
- Built and managed $27.5M product portfolio across mobile banking, payments, digital platforms
- Expert in A/B testing, experimentation, data-driven decision making
- Led cross-functional teams of 15+ across engineering, design, data science
- Certified ScrumMaster (CSM), Kellogg Executive Education

Industry experience: Banking/fintech (Wells Fargo, First Republic), hospitality (Hilton, Starbucks), consulting (Magley & Associates)

Technical skills: Mobile-first product development, API strategy, AI/ML integration, platform migration, Agile/Scrum

Target direction: Breaking out of banking into consumer tech, AI-native companies, mobile-first products. Building this portfolio site itself demonstrates product thinking, AI integration, and full-stack execution.

Key projects to reference when making the case:
- Mobile banking app scaling: Led the product from 18M to 32M MAU while maintaining a 4.9 star rating. This involved performance optimization, feature prioritization under scale constraints, and balancing growth with stability.
- AI revenue transformation: Took Wells Fargo's AI-driven product line from $4.1M to $27.5M revenue. Built the business case, secured executive buy-in, designed the rollout strategy, managed the cross-functional team.
- Platform migration: Led a multi-year platform migration affecting millions of users with zero downtime. Required deep technical coordination, risk management, and phased rollout planning.
- This portfolio site: Built an AI-powered portfolio site from scratch — designed the product, wrote the frontend, built the backend, trained an AI agent (Fenix) on 319 Q&As, implemented tool-calling, RAG, streaming, identity gating. Demonstrates full-stack product thinking and hands-on AI integration.
- Payments infrastructure: Built payment rails serving 11M+ users at JPMorgan Chase/First Republic, navigating regulatory compliance, fraud prevention, and real-time transaction processing.
"""

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

        # ── STEP 1: Extract company, role; assess JD quality ──────────────

        yield f"data: {create_sse_event('narration', {'message': 'Reading the role requirements...'})}\n\n"
        await asyncio.sleep(0.1)

        extraction_prompt = f"""Analyze this job description and extract:
1. Company name (exact match from the text, or "Unknown" if not found)
2. Job title
3. Whether this JD has enough detail to build a meaningful fit assessment (needs at least: role responsibilities, required skills/experience, and seniority indicators)

Return JSON only:
{{
  "company": "...",
  "role_title": "...",
  "scorable": true/false,
  "diagnosis": "If not scorable, explain what's missing (max 1 sentence)"
}}

JD TEXT:
{jd_text}
"""

        extraction_response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=300,
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

        # ── STEP 2: Check preferred companies ─────────────────────────────

        preferred_match = any(
            pref.lower() in company.lower() or company.lower() in pref.lower()
            for pref in PREFERRED_COMPANIES
        )

        yield f"data: {create_sse_event('preferred_company', {'match': preferred_match, 'company': company})}\n\n"

        msg = f"Mapping Kiran's experience to {company}'s {role_title} role..."
        yield f"data: {create_sse_event('narration', {'message': msg})}\n\n"
        await asyncio.sleep(0.1)

        # ── STEP 3: Generate fit narrative (streamed) ─────────────────────

        visitor_context = ""
        if visitor_name:
            visitor_context = f"\nThe person reading this is {visitor_name}"
            if visitor_company:
                visitor_context += f" from {visitor_company}"
            visitor_context += "."

        preferred_note = ""
        if preferred_match:
            preferred_note = f"\n\nNote: {company} is on Kiran's target company list — he is actively interested in this company. You can mention this naturally in section 3 if it fits."

        narrative_prompt = f"""You are Fenix, Kiran Rao's AI agent. A recruiter or hiring manager has pasted a job description. Your job is to show them exactly how Kiran's experience maps to this role — specific, honest, and grounded in what he's actually shipped.

STEP 1 — HONESTLY ASSESS THE FIT (do this silently, do NOT include in output):
Read the JD carefully. Compare it against Kiran's profile. Ask yourself:
- Is Kiran a strong, direct fit for this role? (his experience maps cleanly to most requirements)
- Is Kiran a credible fit with some stretch? (solid foundation but gaps in specific areas)
- Is this a significant reach? (major experience gaps)
Be honest. This assessment determines which structure you use below.

CRITICAL RULES:
- NO percentages, NO scores, NO ratings, NO numerical assessments anywhere
- NEVER use the phrases "career transition", "career pivot", "different background", "non-traditional"
- NEVER name Kiran's industry background as a category ("banking experience", "fintech background") — just describe what he shipped and let the results speak
- NEVER defensively reframe anything. If something is a strength, state it as a strength. Period.
- Write as Fenix speaking directly to the reader — confident, specific, not salesy
- Reference actual projects and results from Kiran's profile — numbers, outcomes, scale
- Use the JD's own language and terminology when describing Kiran's matching experience
- Keep the total response between 150-250 words across all sections
- Each section should be 2-4 sentences. Tight, scannable, no fluff
- Do NOT use bullet points — write in flowing prose

STRUCTURE — Choose based on your honest assessment:

IF STRONG DIRECT FIT (use this when Kiran's experience maps directly to the role):

**What Kiran has shipped that maps to this role**
[2-4 sentences. Lead with the strongest matching experience. Cite specific projects, metrics, and scale using the JD's own language. Don't say "he has experience in X" — say what he did and the result. Every sentence should make the reader think "this person has done this exact job."]

**What he adds on top of the role requirements**
[2-4 sentences. Genuine additional value — things the JD doesn't explicitly ask for but any smart hiring manager wants. Hands-on AI product building (not just strategy — he built a working AI agent with tool-calling and RAG), data infrastructure at the schema level, complex platform migrations with zero downtime. Frame as compounding value, not a consolation prize.]

IF CREDIBLE FIT WITH STRETCH (use this when some requirements are a direct match but others require connecting dots):

**What Kiran has shipped that maps to this role**
[Same as above — lead with the direct matches. Be specific and metric-driven.]

**Where his experience creates unexpected leverage**
[2-4 sentences. WITHOUT naming the source industry or calling it "different," describe specific capabilities that give Kiran an edge. Focus on what he CAN do that most candidates for this role cannot. Regulated environments at scale, complex stakeholder navigation, building trust with millions of users where mistakes have real financial consequences.]

FOR EITHER STRUCTURE, end with:

**The question worth asking**
[One sharp, role-specific question that reframes how the reader thinks about the position. NOT generic ("want me to walk you through a project?"). Make it specific to what the JD asks for and what Kiran has done. Example: "This role asks for someone who's transformed how millions of members get financial help with AI — Kiran has shipped exactly that. Want to see the playbook?" The question should imply Kiran has already solved the hardest problem in the JD.]
{visitor_context}{preferred_note}

JOB DESCRIPTION:
{jd_text[:3000]}

KIRAN'S PROFILE:
{KIRAN_PROFILE}
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
