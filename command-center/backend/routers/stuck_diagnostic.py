"""
Stuck Diagnostic Router — Practitioner persona tool.

A practitioner describes where they're stuck. Kiran's tool diagnoses what KIND
of stuck this is (problem-space / solution-space / validation / distribution /
team / scope / stake) and prescribes the next move.

Single Claude call returning structured JSON. Streams parsed sections as SSE
events so the frontend can render incrementally.

Endpoints:
  POST /analyze   — Analyze a stuck description, return structured diagnosis
  GET  /health    — Health check
"""

import json
import asyncio
import time
from typing import Optional, AsyncGenerator, List
from pydantic import BaseModel
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from utils.config import CLAUDE_MODEL, resolve_api_key, get_logger
from services.claude_client import create_client

logger = get_logger(__name__)


# ── Retry wrapper for Claude API calls ─────────────────────────────────

def call_claude_with_retry(client, max_retries=3, **kwargs):
    """Call Claude API with retry logic for transient errors (429, 529)."""
    for attempt in range(max_retries):
        try:
            return client.messages.create(**kwargs)
        except Exception as e:
            error_str = str(e)
            is_retryable = any(code in error_str for code in ["529", "overloaded", "rate_limit", "429"])
            if is_retryable and attempt < max_retries - 1:
                wait_time = (attempt + 1) * 2
                logger.warning(f"Claude API retryable error (attempt {attempt + 1}/{max_retries}): {error_str[:100]}. Retrying in {wait_time}s...")
                time.sleep(wait_time)
                continue
            raise FriendlyAPIError(error_str)


class FriendlyAPIError(Exception):
    """Wraps Claude API errors with user-friendly messages."""
    def __init__(self, raw_error: str):
        self.raw_error = raw_error
        if "529" in raw_error or "overloaded" in raw_error.lower():
            self.friendly_message = "Claude's servers are temporarily at capacity. Please try again in a moment."
        elif "429" in raw_error or "rate_limit" in raw_error.lower():
            self.friendly_message = "We've hit a temporary rate limit. Please wait a few seconds and try again."
        elif "401" in raw_error or "authentication" in raw_error.lower():
            self.friendly_message = "There's an API configuration issue. Kiran has been notified."
        else:
            self.friendly_message = "Something went wrong generating the diagnosis. Please try again."
        super().__init__(self.friendly_message)


router = APIRouter()


# ── Request Model ────────────────────────────────────────────────────────

class StuckRequest(BaseModel):
    user_input: str
    visitor_name: Optional[str] = None


# ── Utility ──────────────────────────────────────────────────────────────

def create_sse_event(event_type: str, data: dict) -> str:
    """Create an SSE-formatted JSON event."""
    event_data = {"type": event_type, **data}
    return json.dumps(event_data)


# ── System Prompt ────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are Fenix, Kiran Rao's AI agent. A practitioner has described where they're stuck on a product problem. Your job: diagnose what KIND of stuck this is, and prescribe the next move.

THE RUBRIC — 7 kinds of stuck:

1. **Problem-space** — solving the wrong problem, or solving an imagined version of the right one
2. **Solution-space** — right problem, wrong solution shape
3. **Validation** — insufficient signal to know what's actually true
4. **Distribution** — right problem + solution, can't get it to the people who need it
5. **Team** — coordination, decision-rights, or trust issue blocking forward motion
6. **Scope** — too big to learn from, too small to matter, or the wrong slice
7. **Stake** — the people whose buy-in you need aren't aligned

RULES:
- Pick ONE primary type. Add a secondary only if the input clearly shows both.
- The diagnosis must trace SPECIFICALLY to what the user said. Quote or reference their words.
- No corporate language. No generic frameworks. Sound like a senior PM thinking with the user, not a chatbot.
- The next move must be concrete enough to do this week. Not a principle, a step.
- Use Kiran's voice: direct, plain, occasionally wry. Never use "leverage", "spearhead", "drive synergy", "north star", "double down", "circle back", or other corporate verbs.
- No verdict labels like "this is a strong/weak case". You diagnose, you don't grade.

Return ONLY valid JSON in this exact structure:

{
  "diagnosis": "This is a [primary type] issue.",
  "secondary": "Optional: 'With some [secondary type] underneath.' Leave empty string if no secondary.",
  "why": "2-3 sentences. Read their input, name the pattern, explain the call. Reference specific things they said.",
  "next_move": "1-2 sentences. Concrete action they can take this week. Not 'do user research' — give the specific shape of the research.",
  "watch_for": [
    "A specific signal to listen for or measure (one sentence)",
    "Another specific signal",
    "Another specific signal"
  ]
}

Do not wrap in markdown code blocks. Return raw JSON only."""


# ── SSE Stream Generator ─────────────────────────────────────────────────

async def stuck_diagnostic_stream(
    user_input: str,
    api_key: str,
    visitor_name: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """
    Stream structured stuck diagnostic as SSE events.

    Yields events: narration, diagnosis, why, next_move, watch_for, complete, error.
    """
    try:
        client = create_client(api_key)

        # ── Narrated loading ────────────────────────────────────
        yield f"data: {create_sse_event('narration', {'message': 'Reading what you have tried...'})}\n\n"
        await asyncio.sleep(0.4)

        yield f"data: {create_sse_event('narration', {'message': 'Looking for the pattern...'})}\n\n"
        await asyncio.sleep(0.3)

        yield f"data: {create_sse_event('narration', {'message': 'Picking out which kind of stuck this is...'})}\n\n"
        await asyncio.sleep(0.2)

        # ── Call Claude ────────────────────────────────────────
        visitor_context = ""
        if visitor_name:
            visitor_context = f"\nThe person describing this is {visitor_name}."

        user_message = f"""USER INPUT:
{user_input[:3000]}
{visitor_context}

Return ONLY the JSON. No other text, no markdown wrapper."""

        response = call_claude_with_retry(
            client,
            model=CLAUDE_MODEL,
            max_tokens=1500,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )

        raw_text = response.content[0].text.strip()

        # Strip any accidental markdown wrapper
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        if raw_text.startswith("```"):
            raw_text = raw_text[3:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
        raw_text = raw_text.strip()

        try:
            data = json.loads(raw_text)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse stuck-diagnostic JSON: {e}\nRaw text: {raw_text[:500]}")
            yield f"data: {create_sse_event('error', {'message': 'The diagnosis came back in an unexpected format. Try rephrasing your input.'})}\n\n"
            return

        # ── Emit structured events ────────────────────────────
        diagnosis = data.get("diagnosis", "")
        secondary = data.get("secondary", "")
        why = data.get("why", "")
        next_move = data.get("next_move", "")
        watch_for = data.get("watch_for", [])

        if diagnosis:
            yield f"data: {create_sse_event('diagnosis', {'text': diagnosis, 'secondary': secondary})}\n\n"
            await asyncio.sleep(0.2)
        if why:
            yield f"data: {create_sse_event('why', {'text': why})}\n\n"
            await asyncio.sleep(0.2)
        if next_move:
            yield f"data: {create_sse_event('next_move', {'text': next_move})}\n\n"
            await asyncio.sleep(0.2)
        if watch_for and isinstance(watch_for, list):
            yield f"data: {create_sse_event('watch_for', {'items': watch_for})}\n\n"
            await asyncio.sleep(0.1)

        yield f"data: {create_sse_event('complete', {})}\n\n"

    except FriendlyAPIError as e:
        logger.error(f"Stuck diagnostic API error: {e.raw_error}", exc_info=True)
        yield f"data: {create_sse_event('error', {'message': e.friendly_message})}\n\n"
    except Exception as e:
        logger.error(f"Stuck diagnostic streaming error: {str(e)}", exc_info=True)
        yield f"data: {create_sse_event('error', {'message': 'Something went wrong generating the diagnosis. Please try again.'})}\n\n"


# ── Endpoints ─────────────────────────────────────────────────────────────

@router.post("/analyze")
async def analyze_stuck(
    request: StuckRequest,
    x_claude_key: str = Header(None, alias="X-Claude-Key"),
):
    """
    POST /api/stuck-diagnostic/analyze

    Analyze where a practitioner is stuck and generate a structured diagnosis.
    Returns SSE stream with structured events for incremental rendering.

    Request:
    {
      "user_input": "Description of where they are stuck",
      "visitor_name": "Optional visitor name"
    }

    Response: SSE stream with events:
    - narration: Progress messages
    - diagnosis: { text, secondary }
    - why: { text }
    - next_move: { text }
    - watch_for: { items: [...] }
    - complete: Final signal
    - error: If something goes wrong
    """
    if not request.user_input.strip():
        raise HTTPException(status_code=400, detail="user_input is required")

    api_key = resolve_api_key(x_claude_key)

    async def event_stream():
        async for event_json in stuck_diagnostic_stream(
            user_input=request.user_input,
            api_key=api_key,
            visitor_name=request.visitor_name,
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
    return {"status": "ok", "service": "stuck-diagnostic", "version": "1.0"}
