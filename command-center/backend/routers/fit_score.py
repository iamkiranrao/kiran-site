"""
Fit Narrative Router — V2: Structured card-based experience.

Dynamically selects the most relevant career initiatives based on JD requirements,
then generates structured JSON for evidence cards instead of streaming prose.

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
                f"**ID:** {init.get('id', '')}\n"
                f"**One-liner:** {init.get('one_liner', '')}\n"
                f"**Problem:** {init.get('problem', '')}\n"
                f"**Bet:** {init.get('bet', '')}\n"
                f"**Shipped:** {init.get('shipped', '')}\n"
                f"**Outcome:** {init.get('outcome', '')}\n"
                f"**Metrics:**\n{metrics}"
            )
    return "\n\n".join(sections)


def get_initiative_by_index(idx: int) -> Optional[Dict]:
    """Get an initiative by its catalog index."""
    if 0 <= idx < len(INITIATIVES):
        return INITIATIVES[idx]
    return None


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
    Stream structured fit narrative data as SSE events.

    Yields SSE-formatted JSON events with types:
    - narration: Progress messages during analysis
    - extraction: Company, role, preferred status
    - verdict: 1-2 sentence fit summary for header card
    - primary_matches: Top evidence cards with JD match quotes
    - added_value: Beyond-JD capabilities
    - cutting_floor: Lighter next-tier cards
    - key_takeaway: The sharp insight
    - complete: Signal that generation is finished
    - decline: JD doesn't have enough signal
    - error: If something goes wrong
    """
    try:
        client = create_client(api_key)

        # ── STEP 1: Extract JD + select relevant initiatives ─────────

        yield f"data: {create_sse_event('narration', {'message': 'Reading the role requirements...'})}\n\n"
        await asyncio.sleep(0.1)

        extraction_prompt = f"""You have two jobs:

JOB 1: Analyze this job description and extract the company, role title, and whether it has enough detail for a fit assessment.

JOB 2: From the INITIATIVE CATALOG below, select the 5-8 initiatives that are MOST relevant to this JD's requirements. Pick initiatives where Kiran's shipped work directly addresses what the JD asks for. Prioritize:
- Direct skill/domain matches (JD asks for AI experience → pick AI initiatives)
- Scale matches (JD is for enterprise role → pick enterprise-scale work)
- Capability matches (JD asks for cross-functional leadership → pick initiatives demonstrating that)

Also assign each selected initiative to a TIER:
- "primary" (top 3): The strongest, most direct matches to the JD's core requirements
- "added_value" (1-2): Capabilities beyond what the JD asks for but any smart hiring manager wants
- "cutting_floor" (2-4): JD-relevant work that a resume would force you to cut — still strong, just not top 3

Return JSON only:
{{
  "company": "...",
  "role_title": "...",
  "scorable": true/false,
  "diagnosis": "If not scorable, explain what's missing (max 1 sentence)",
  "selected_initiatives": [
    {{"index": 0, "tier": "primary"}},
    {{"index": 3, "tier": "primary"}},
    {{"index": 7, "tier": "primary"}},
    {{"index": 12, "tier": "added_value"}},
    {{"index": 15, "tier": "cutting_floor"}},
    {{"index": 18, "tier": "cutting_floor"}}
  ]
}}

JD TEXT:
{jd_text[:3000]}

INITIATIVE CATALOG:
{INITIATIVE_CATALOG}
"""

        extraction_response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=600,
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

        # ── STEP 2: Parse tiered initiative selections ───────────────

        selected_raw = extraction.get("selected_initiatives", [])

        # Handle both old format (flat list of ints) and new format (list of dicts with tier)
        primary_indices = []
        added_value_indices = []
        cutting_floor_indices = []

        for item in selected_raw:
            if isinstance(item, dict):
                idx = item.get("index", 0)
                tier = item.get("tier", "cutting_floor")
                if tier == "primary":
                    primary_indices.append(idx)
                elif tier == "added_value":
                    added_value_indices.append(idx)
                else:
                    cutting_floor_indices.append(idx)
            elif isinstance(item, int):
                # Legacy format fallback: first 3 primary, next 2 added value, rest cutting floor
                if len(primary_indices) < 3:
                    primary_indices.append(item)
                elif len(added_value_indices) < 2:
                    added_value_indices.append(item)
                else:
                    cutting_floor_indices.append(item)

        if not primary_indices:
            # Safety fallback
            all_indices = [item.get("index", item) if isinstance(item, dict) else item for item in selected_raw]
            if not all_indices:
                all_indices = list(range(min(6, len(INITIATIVES))))
            primary_indices = all_indices[:3]
            added_value_indices = all_indices[3:5]
            cutting_floor_indices = all_indices[5:]

        all_selected = primary_indices + added_value_indices + cutting_floor_indices
        selected_profile = format_selected_initiatives(all_selected)

        logger.info(
            f"Selected initiatives for {company} {role_title}: "
            f"primary={primary_indices}, added_value={added_value_indices}, "
            f"cutting_floor={cutting_floor_indices}"
        )

        # ── STEP 3: Check preferred companies ─────────────────────────

        preferred_match = any(
            pref.lower() in company.lower() or company.lower() in pref.lower()
            for pref in PREFERRED_COMPANIES
        )

        # Emit extraction event
        yield f"data: {create_sse_event('extraction', {'company': company, 'role_title': role_title, 'preferred_company': preferred_match})}\n\n"

        msg = f"Mapping Kiran's experience to {company}'s {role_title} role..."
        yield f"data: {create_sse_event('narration', {'message': msg})}\n\n"
        await asyncio.sleep(0.1)

        # ── STEP 4: Generate structured narrative JSON ────────────────

        # Build initiative ID → index mapping for the prompt
        primary_refs = []
        for idx in primary_indices:
            init = get_initiative_by_index(idx)
            if init:
                primary_refs.append(f"- [{idx}] {init['title']} ({init['company']}): {init.get('one_liner', '')}")

        added_value_refs = []
        for idx in added_value_indices:
            init = get_initiative_by_index(idx)
            if init:
                added_value_refs.append(f"- [{idx}] {init['title']} ({init['company']}): {init.get('one_liner', '')}")

        cutting_floor_refs = []
        for idx in cutting_floor_indices:
            init = get_initiative_by_index(idx)
            if init:
                cutting_floor_refs.append(f"- [{idx}] {init['title']} ({init['company']}): {init.get('one_liner', '')}")

        visitor_context = ""
        if visitor_name:
            visitor_context = f"\nThe person reading this is {visitor_name}"
            if visitor_company:
                visitor_context += f" from {visitor_company}"
            visitor_context += "."

        preferred_note = ""
        if preferred_match:
            preferred_note = f"\n\nNote: {company} is on Kiran's target company list — he is actively interested in this company. You can reference this naturally in the verdict if it fits."

        narrative_prompt = f"""You are Fenix, Kiran Rao's AI agent. A recruiter or hiring manager has pasted a job description. Below are Kiran's career initiatives tiered by relevance to this role. Your job: produce structured JSON that maps evidence to their requirements. Fast, specific, undeniable.

The reader is comparing Kiran against a stack of candidates. Make the match the easiest to see.

RULES:
- Every claim must trace to a specific initiative below. Cite the project name, the metric, the outcome.
- Use the JD's own language when describing matches. If the JD says "drive member engagement," map directly to what Kiran did that drove engagement and the number.
- NO percentages as standalone scores. Metrics from initiatives are fine.
- NEVER use "career transition", "career pivot", "different background", "non-traditional"
- NEVER label Kiran's industry as a category — just describe what he shipped
- NEVER defensively reframe. Strengths are strengths. Period.
- Confident, direct, matter-of-fact. Not salesy, not apologetic.

Return ONLY valid JSON in this exact structure:

{{
  "verdict": "1-2 sentences. Confident summary for the header card. State the match directly — what Kiran has done that maps to this role's core requirements. Reference specific scale or domain. No hedging.",

  "primary_matches": [
    {{
      "initiative_index": 0,
      "title": "Initiative title",
      "company": "Company name",
      "metric": "The headline metric (e.g. '18M to 32M active users')",
      "context": "2-3 sentences. What Kiran shipped and why it matters for THIS role. Use the JD's language. Reference the specific outcome.",
      "jd_match_quote": "The exact phrase from the JD that this initiative maps to (e.g. 'drive product strategy for mobile engagement')",
      "problem": "1 sentence — what was broken",
      "shipped": "1 sentence — what Kiran built",
      "outcome": "1 sentence — what happened as a result"
    }}
  ],

  "added_value": [
    {{
      "initiative_index": 0,
      "title": "Initiative title",
      "company": "Company name",
      "metric": "The headline metric",
      "context": "2-3 sentences. What this capability adds beyond the JD requirements.",
      "why_it_matters": "1 sentence. Why a smart hiring manager at {company} would care about this even though the JD doesn't ask for it."
    }}
  ],

  "cutting_floor": [
    {{
      "initiative_index": 0,
      "title": "Initiative title",
      "subtitle": "One-liner description",
      "metric": "The headline metric"
    }}
  ],

  "key_takeaway": "1-2 sentences. The sharp insight. Not a pitch — an observation that makes the reader think. Reference a specific capability or pattern across initiatives. No empty promises like 'want to see the playbook?' — state what's true."
}}

PRIMARY MATCHES (top 3 — write full evidence for each):
{chr(10).join(primary_refs)}

ADDED VALUE (beyond-JD capabilities — write context for each):
{chr(10).join(added_value_refs)}

CUTTING FLOOR (JD-relevant work a resume forces you to cut — title + metric only):
{chr(10).join(cutting_floor_refs)}
{visitor_context}{preferred_note}

JOB DESCRIPTION:
{jd_text[:3000]}

KIRAN RAO — BACKGROUND:
{KIRAN_SUMMARY}

FULL INITIATIVE DETAILS (for the selected initiatives):
{selected_profile}
"""

        yield f"data: {create_sse_event('narration', {'message': 'Building the evidence map...'})}\n\n"
        await asyncio.sleep(0.1)

        narrative_response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=3000,
            messages=[{"role": "user", "content": narrative_prompt}],
        )

        narrative_text = narrative_response.content[0].text.strip()

        # Parse the JSON response
        try:
            if narrative_text.startswith("```json"):
                narrative_text = narrative_text[7:]
            if narrative_text.startswith("```"):
                narrative_text = narrative_text[3:]
            if narrative_text.endswith("```"):
                narrative_text = narrative_text[:-3]
            narrative_data = json.loads(narrative_text.strip())
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse narrative JSON: {e}\nRaw text: {narrative_text[:500]}")
            raise ValueError(f"Claude returned invalid JSON for narrative: {e}")

        # ── STEP 5: Enrich and emit structured SSE events ─────────────

        # Emit verdict
        verdict_text = narrative_data.get("verdict", "")
        if verdict_text:
            yield f"data: {create_sse_event('verdict', {'text': verdict_text})}\n\n"
            await asyncio.sleep(0.1)

        # Emit primary matches — enrich with initiative data
        # Claude's output takes precedence; initiative data fills gaps (empty strings)
        primary_matches = narrative_data.get("primary_matches", [])
        enriched_primary = []
        for match in primary_matches:
            idx = match.get("initiative_index")
            init = get_initiative_by_index(idx) if idx is not None else None
            enriched = {
                "initiative_id": init.get("id", "") if init else "",
                "title": match.get("title") or (init.get("title", "") if init else ""),
                "company": match.get("company") or (init.get("company", "") if init else ""),
                "metric": match.get("metric", ""),
                "context": match.get("context", ""),
                "jd_match_quote": match.get("jd_match_quote", ""),
                "problem": match.get("problem") or (init.get("problem", "") if init else ""),
                "shipped": match.get("shipped") or (init.get("shipped", "") if init else ""),
                "outcome": match.get("outcome") or (init.get("outcome", "") if init else ""),
            }
            enriched_primary.append(enriched)

        if enriched_primary:
            yield f"data: {create_sse_event('primary_matches', {'matches': enriched_primary})}\n\n"
            await asyncio.sleep(0.1)

        # Emit added value
        added_value = narrative_data.get("added_value", [])
        enriched_added = []
        for match in added_value:
            idx = match.get("initiative_index")
            init = get_initiative_by_index(idx) if idx is not None else None
            enriched = {
                "initiative_id": init.get("id", "") if init else "",
                "title": match.get("title") or (init.get("title", "") if init else ""),
                "company": match.get("company") or (init.get("company", "") if init else ""),
                "metric": match.get("metric", ""),
                "context": match.get("context", ""),
                "why_it_matters": match.get("why_it_matters", ""),
            }
            enriched_added.append(enriched)

        if enriched_added:
            yield f"data: {create_sse_event('added_value', {'matches': enriched_added})}\n\n"
            await asyncio.sleep(0.1)

        # Emit cutting floor
        cutting_floor = narrative_data.get("cutting_floor", [])
        enriched_floor = []
        for match in cutting_floor:
            idx = match.get("initiative_index")
            init = get_initiative_by_index(idx) if idx is not None else None
            enriched = {
                "initiative_id": init.get("id", "") if init else "",
                "title": match.get("title") or (init.get("title", "") if init else ""),
                "subtitle": match.get("subtitle") or (init.get("one_liner", "") if init else ""),
                "metric": match.get("metric", ""),
            }
            enriched_floor.append(enriched)

        if enriched_floor:
            yield f"data: {create_sse_event('cutting_floor', {'matches': enriched_floor})}\n\n"
            await asyncio.sleep(0.1)

        # Emit key takeaway
        key_takeaway = narrative_data.get("key_takeaway", "")
        if key_takeaway:
            yield f"data: {create_sse_event('key_takeaway', {'text': key_takeaway})}\n\n"
            await asyncio.sleep(0.1)

        # ── STEP 6: Complete ──────────────────────────────────────────

        yield f"data: {create_sse_event('complete', {'company': company, 'role_title': role_title, 'preferred_company': preferred_match})}\n\n"

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

    Analyze a job description and generate a structured fit narrative.
    Returns SSE stream with structured data events for card-based rendering.

    Request:
    {
      "jd_text": "Full job description text",
      "visitor_name": "Optional visitor name",
      "visitor_company": "Optional visitor company"
    }

    Response: SSE stream with events:
    - narration: Progress messages
    - extraction: { company, role_title, preferred_company }
    - verdict: { text }
    - primary_matches: { matches: [...] }
    - added_value: { matches: [...] }
    - cutting_floor: { matches: [...] }
    - key_takeaway: { text }
    - complete: Final signal
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
    return {"status": "ok", "service": "fit-narrative", "version": "2.0"}
