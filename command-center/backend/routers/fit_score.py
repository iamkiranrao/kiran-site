"""
Fit Score Router — Dual-direction job fit analysis with Fenix narration.

Endpoints:
  POST /analyze         — Analyze job description and compute fit scores
  GET  /health          — Health check
"""

import json
import asyncio
from typing import Optional, AsyncGenerator, List
from pydantic import BaseModel
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from utils.config import CLAUDE_MODEL, resolve_api_key, get_logger
from services.claude_client import create_client
from anthropic import Anthropic

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
"""

PREFERRED_COMPANIES = {
    "Anthropic", "OpenAI", "Google", "Apple", "NVIDIA",
    "Airbnb", "Uber", "Netflix", "Disney", "Meta",
    "Snap", "Canva", "Adobe", "Intuit", "ServiceNow",
    "Asana", "Figma", "Shopify", "Stripe", "Block",
    "Ramp", "Robinhood", "Spotify", "DoorDash", "Duolingo",
    "McKinsey", "BCG", "Deloitte", "Bain", "Microsoft"
}

# ── Request/Response Models ───────────────────────────────────────────────

class FitScoreRequest(BaseModel):
    jd_text: str
    visitor_name: Optional[str] = None
    visitor_company: Optional[str] = None


class DimensionResult(BaseModel):
    name: str
    score: int
    band: str  # Strong/Solid/Partial/Stretch
    reasoning: str
    gap_note: Optional[str] = None


class FitScoreResult(BaseModel):
    company: str
    role_title: str
    role_to_kiran: List[DimensionResult]
    kiran_to_role: List[DimensionResult]
    role_to_kiran_composite: int
    kiran_to_role_composite: int
    preferred_company: bool
    gap_summary: List[str]
    decline: bool = False
    decline_reason: Optional[str] = None


# ── Utility Functions ──────────────────────────────────────────────────────

def get_band(score: int) -> str:
    """Map score to band."""
    if score >= 85:
        return "Strong"
    if score >= 65:
        return "Solid"
    if score >= 45:
        return "Partial"
    return "Stretch"


def create_sse_event(event_type: str, data: dict) -> str:
    """Create an SSE-formatted event."""
    event_data = {"type": event_type, **data}
    return json.dumps(event_data)


# ── SSE Stream Generator ───────────────────────────────────────────────────

async def fit_score_stream(
    jd_text: str,
    api_key: str,
    visitor_name: Optional[str] = None,
    visitor_company: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """
    Stream Fenix analyzing the job description and computing fit scores.

    Yields SSE-formatted JSON events with types:
    - narration: Fenix thinking out loud
    - role_to_kiran: One Role→Kiran dimension result
    - kiran_to_role: One Kiran→Role dimension result
    - composite: The two composite scores
    - gap_notes: The "what would increase these scores" summary
    - preferred_company: Company match result
    - complete: Final result
    - error: If something goes wrong
    """
    try:
        client = create_client(api_key)

        # ── STEP 1: Extract company, role, seniority; assess JD quality ──────

        yield f"data: {create_sse_event('narration', {'message': 'Reading the role requirements...'})}\n\n"
        await asyncio.sleep(0.1)

        extraction_prompt = f"""Analyze this job description and extract:
1. Company name (exact match from the text)
2. Job title
3. Seniority level (Entry, Mid, Senior, Staff, Principal, C-Level, or Unknown)
4. Which of these 5 Role→Kiran dimensions have SUFFICIENT SIGNAL in the JD (yes/no for each):
   - Experience & Level Fit (evidence of required seniority level)
   - Domain & Industry Fit (mentions relevant industry/vertical)
   - Technical Depth (specifies technical tools/skills/languages)
   - Core Competencies Match (PM-specific: product strategy, roadmap, data, leadership)
   - Product Stage Fit (mentions company stage: startup/growth/scale/enterprise)

Return JSON only:
{{
  "company": "...",
  "role_title": "...",
  "seniority": "...",
  "signal_count": <number of dimensions with sufficient signal>,
  "signal_by_dimension": {{
    "experience_level": true/false,
    "domain_industry": true/false,
    "technical_depth": true/false,
    "core_competencies": true/false,
    "product_stage": true/false
  }},
  "scorable": true/false,
  "diagnosis": "If not scorable, explain what's missing (max 1 sentence)"
}}

JD TEXT:
{jd_text}
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
        signal_count = extraction.get("signal_count", 0)

        # Check if scorable
        if signal_count < 3 or not extraction.get("scorable", False):
            diagnosis = extraction.get("diagnosis", "Insufficient signal in job description")
            yield f"data: {create_sse_event('decline', {'message': f'Not enough detail to score: {diagnosis}'})}\n\n"
            yield f"data: {create_sse_event('complete', {'decline': True, 'decline_reason': diagnosis})}\n\n"
            return

        msg = "Mapping against Kiran's 15+ years of experience..."
        yield f"data: {create_sse_event('narration', {'message': msg})}\n\n"
        await asyncio.sleep(0.1)

        # ── STEP 2: Score Role→Kiran (5 dimensions) ──────────────────────────

        role_to_kiran_prompt = f"""Score Kiran's fit for this role across 5 dimensions. Output JSON with percentage (0-100) and band (Strong/Solid/Partial/Stretch) for each.

ROLE CONTEXT:
Company: {company}
Role: {role_title}
JD: {jd_text[:2000]}

KIRAN'S PROFILE:
{KIRAN_PROFILE}

SCORING RUBRIC:
1. Experience & Level Fit (0-100):
   - 85+: Exact seniority match; directly applicable experience
   - 65-84: One level off; mostly transferable
   - 45-64: Two levels off; foundational but requires growth
   - <45: Stretch; significant gap in seniority/years

2. Domain & Industry Fit (0-100):
   - 85+: Deep experience in exact industry
   - 65-84: Related industry with clear transfer
   - 45-64: Adjacent industry; some domain knowledge gap
   - <45: New domain; would require ramp

3. Technical Depth (0-100):
   - 85+: Strong hands-on expertise in required tech stack
   - 65-84: Familiar with most key technologies
   - 45-64: Some overlap; could learn others
   - <45: Limited technical overlap; steep learning curve

4. Core Competencies Match (0-100):
   - 85+: Demonstrated mastery of all key PM skills (strategy, roadmap, data, leadership)
   - 65-84: Strong in most; minor gaps
   - 45-64: Moderate match; some key skills missing
   - <45: Limited overlap with core PM role

5. Product Stage Fit (0-100):
   - 85+: Direct experience at this exact stage (startup/scale/enterprise)
   - 65-84: One stage adjacent; processes mostly transfer
   - 45-64: Two stages off; would require process adaptation
   - <45: Stage mismatch; fundamentally different challenges

For each dimension: output percentage, band (auto-calculated from ≥85/65-84/45-64/<45), reasoning (one line), and gap_note (if <85%, what would increase the score).

Return JSON only:
{{
  "dimensions": [
    {{
      "name": "Experience & Level Fit",
      "score": <0-100>,
      "band": "Strong|Solid|Partial|Stretch",
      "reasoning": "...",
      "gap_note": "If <85%, describe what would close the gap" or null
    }},
    ... (5 total)
  ]
}}
"""

        role_to_kiran_response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=1000,
            messages=[{"role": "user", "content": role_to_kiran_prompt}],
        )

        rtk_text = role_to_kiran_response.content[0].text.strip()
        try:
            if rtk_text.startswith("```json"):
                rtk_text = rtk_text[7:]
            if rtk_text.startswith("```"):
                rtk_text = rtk_text[3:]
            if rtk_text.endswith("```"):
                rtk_text = rtk_text[:-3]
            rtk_data = json.loads(rtk_text.strip())
        except json.JSONDecodeError:
            raise ValueError("Claude returned invalid JSON for Role→Kiran scores")

        role_to_kiran_results = []
        for dim in rtk_data.get("dimensions", []):
            result = DimensionResult(
                name=dim["name"],
                score=dim["score"],
                band=dim["band"],
                reasoning=dim["reasoning"],
                gap_note=dim.get("gap_note"),
            )
            role_to_kiran_results.append(result)
            yield f"data: {create_sse_event('role_to_kiran', result.model_dump())}\n\n"
            await asyncio.sleep(0.05)

        # ── STEP 3: Check preferred companies list ──────────────────────────

        preferred_match = any(
            pref.lower() in company.lower() or company.lower() in pref.lower()
            for pref in PREFERRED_COMPANIES
        )

        if preferred_match:
            msg = f"✓ {company} is on Kiran's preferred company list. +8% bonus to Kiran→Role composite."
            yield f"data: {create_sse_event('narration', {'message': msg})}\n\n"
        else:
            check_msg = "Checking Kiran's preferred company list..."
            yield f"data: {create_sse_event('narration', {'message': check_msg})}\n\n"

        yield f"data: {create_sse_event('preferred_company', {'match': preferred_match, 'company': company})}\n\n"
        await asyncio.sleep(0.1)

        # ── STEP 4: Score Kiran→Role (5 dimensions) ────────────────────────

        msg = "Evaluating Kiran's fit for the company growth and culture..."
        yield f"data: {create_sse_event('narration', {'message': msg})}\n\n"
        await asyncio.sleep(0.1)

        kiran_to_role_prompt = f"""Score the company's fit for Kiran across 5 dimensions. Use publicly known information about the company.

COMPANY CONTEXT:
Company: {company}
Role: {role_title}

KIRAN'S TARGET DIRECTION:
Seeking to break out of banking into consumer tech, AI-native companies, and mobile-first products.

SCORING RUBRIC:
1. Culture & Values (0-100):
   - 85+: Company known for strong engineering culture, transparency, ownership
   - 65-84: Solid culture; good engineering practices
   - 45-64: Culture is mixed; some concerns or unknowns
   - <45: Culture misalignment or red flags

2. Growth Trajectory (0-100):
   - 85+: Hypergrowth (>50% YoY) or strong momentum
   - 65-84: Solid growth (20-50% YoY)
   - 45-64: Moderate growth (<20% YoY) or stagnant
   - <45: Declining or significant headwinds

3. Product Vision (0-100):
   - 85+: Compelling, clear vision in mobile/AI/consumer space
   - 65-84: Good product strategy; mostly aligned with Kiran's interests
   - 45-64: Vision exists but less compelling or misaligned
   - <45: Unclear vision or misaligned with Kiran's target

4. Team & Engineering Quality (0-100):
   - 85+: Recognized as top-tier engineering org; strong talent reputation
   - 65-84: Strong engineers; good technical hiring bar
   - 45-64: Mixed team quality or hiring challenges
   - <45: Engineering concerns or weak reputation

5. Company Stage & Momentum (0-100):
   - 85+: Series C+ with clear path to IPO/exit; strong funding/profitability
   - 65-84: Solid funding (Series B+) or profitability; stable trajectory
   - 45-64: Early stage or recent funding; some uncertainty
   - <45: Pre-revenue, struggling, or significant risk

For each dimension: percentage, band (auto-calculated), reasoning (one line), gap_note (if <85%).

Return JSON only:
{{
  "dimensions": [
    {{
      "name": "Culture & Values",
      "score": <0-100>,
      "band": "Strong|Solid|Partial|Stretch",
      "reasoning": "...",
      "gap_note": "If <85%, describe concern" or null
    }},
    ... (5 total)
  ]
}}
"""

        ktr_response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=1000,
            messages=[{"role": "user", "content": kiran_to_role_prompt}],
        )

        ktr_text = ktr_response.content[0].text.strip()
        try:
            if ktr_text.startswith("```json"):
                ktr_text = ktr_text[7:]
            if ktr_text.startswith("```"):
                ktr_text = ktr_text[3:]
            if ktr_text.endswith("```"):
                ktr_text = ktr_text[:-3]
            ktr_data = json.loads(ktr_text.strip())
        except json.JSONDecodeError:
            raise ValueError("Claude returned invalid JSON for Kiran→Role scores")

        kiran_to_role_results = []
        for dim in ktr_data.get("dimensions", []):
            result = DimensionResult(
                name=dim["name"],
                score=dim["score"],
                band=dim["band"],
                reasoning=dim["reasoning"],
                gap_note=dim.get("gap_note"),
            )
            kiran_to_role_results.append(result)
            yield f"data: {create_sse_event('kiran_to_role', result.model_dump())}\n\n"
            await asyncio.sleep(0.05)

        # ── STEP 5: Compute composites ──────────────────────────────────────

        yield f"data: {create_sse_event('narration', {'message': 'Computing mutual fit...'})}\n\n"
        await asyncio.sleep(0.1)

        rtk_composite = int(sum(d.score for d in role_to_kiran_results) / len(role_to_kiran_results))
        ktr_composite = int(sum(d.score for d in kiran_to_role_results) / len(kiran_to_role_results))

        # Apply preferred company bonus
        if preferred_match:
            ktr_composite = min(100, ktr_composite + 8)

        yield f"data: {create_sse_event('composite', {'role_to_kiran': rtk_composite, 'kiran_to_role': ktr_composite})}\n\n"

        # ── STEP 6: Generate gap summary ────────────────────────────────────

        gap_summary = []
        for dim in role_to_kiran_results:
            if dim.score < 85 and dim.gap_note:
                gap_summary.append(f"{dim.name}: {dim.gap_note}")
        for dim in kiran_to_role_results:
            if dim.score < 85 and dim.gap_note:
                gap_summary.append(f"{dim.name}: {dim.gap_note}")

        if not gap_summary:
            gap_summary = ["All dimensions Strong — no gaps identified."]

        yield f"data: {create_sse_event('gap_notes', {'summary': gap_summary})}\n\n"
        await asyncio.sleep(0.1)

        # ── STEP 7: Return final result ─────────────────────────────────────

        result = FitScoreResult(
            company=company,
            role_title=role_title,
            role_to_kiran=role_to_kiran_results,
            kiran_to_role=kiran_to_role_results,
            role_to_kiran_composite=rtk_composite,
            kiran_to_role_composite=ktr_composite,
            preferred_company=preferred_match,
            gap_summary=gap_summary,
            decline=False,
        )

        yield f"data: {create_sse_event('complete', result.model_dump())}\n\n"

    except Exception as e:
        logger.error(f"Fit score streaming error: {str(e)}", exc_info=True)
        yield f"data: {create_sse_event('error', {'message': str(e)})}\n\n"


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.post("/analyze")
async def analyze_fit_score(
    request: FitScoreRequest,
    x_claude_key: str = Header(None, alias="X-Claude-Key"),
):
    """
    POST /api/fit-score/analyze

    Analyze a job description and compute dual-direction fit scores.
    Returns SSE stream with real-time narration, dimension results, and final composite scores.

    Request:
    {
      "jd_text": "Full job description text",
      "visitor_name": "Optional visitor name",
      "visitor_company": "Optional visitor company"
    }

    Response: SSE stream with events:
    - narration: Fenix thinking out loud
    - role_to_kiran: One Role→Kiran dimension
    - kiran_to_role: One Kiran→Role dimension
    - composite: The composite scores
    - gap_notes: Gap summary checklist
    - preferred_company: Company match
    - complete: Final result (FitScoreResult JSON)
    - error: If something goes wrong
    """
    if not request.jd_text.strip():
        raise HTTPException(status_code=400, detail="jd_text is required")

    api_key = resolve_api_key(x_claude_key)

    async def event_stream():
        async for event_json in fit_score_stream(
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
    return {"status": "ok", "service": "fit-score"}
