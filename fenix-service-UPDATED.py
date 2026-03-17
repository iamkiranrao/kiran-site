"""
Fenix Service — The conversational AI engine for kirangorapalli.com

Fenix is a conversational AI assistant that understands everything on Kiran's site
and translates that knowledge into whatever context the visitor needs.

Key design decisions (from FENIX-SPEC.md):
- Fenix is NOT Kiran. It says "Kiran built..." not "I built..."
- Persona is INFERRED from the question, not selected by the visitor
- Nudges are contextual and earned (after 2-3 substantive exchanges)
- Fenix is comfortable saying "I don't have information on that"
- Every RAG-sourced answer includes inline citations
"""

import uuid
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional, AsyncGenerator
from dataclasses import dataclass, field

logger = logging.getLogger("fenix.chat")

from core.config import get_settings
from core.database import get_supabase
from core.claude_client import get_client


# ──────────────────────────────────────────────
# Persona System — Inferred, Not Selected
# ──────────────────────────────────────────────

PERSONA_SIGNALS = {
    "hiring_manager": {
        "keywords": [
            "team size", "leadership", "manage", "hire", "org", "business impact",
            "KPIs", "revenue", "headcount", "direct reports", "stakeholders",
            "executive", "VP", "director", "cross-functional", "roadmap",
            "strategy", "vision", "culture", "compensation", "role",
            "position", "candidate", "interview", "reference",
        ],
        "system_context": (
            "The visitor appears to be evaluating Kiran from a hiring or leadership perspective. "
            "Emphasize outcomes, business impact, team leadership, cross-functional collaboration, "
            "and strategic thinking. Use specific metrics and results where available. "
            "Frame Kiran's work in terms of value delivered to organizations."
        ),
    },
    "engineer": {
        "keywords": [
            "architecture", "technical", "code", "API", "database", "stack",
            "framework", "system design", "scalable", "performance", "deploy",
            "serverless", "backend", "frontend", "infrastructure", "CI/CD",
            "testing", "debug", "algorithm", "data model", "schema",
            "vector", "embedding", "RAG", "LLM", "prompt", "pipeline",
        ],
        "system_context": (
            "The visitor appears to be technically minded — likely an engineer or technical evaluator. "
            "Go deeper on technical decisions, architecture trade-offs, implementation details, "
            "and engineering challenges. Use precise technical language. "
            "Highlight Kiran's hands-on building work alongside product thinking."
        ),
    },
    "collaborator": {
        "keywords": [
            "work together", "collaborate", "partner", "project", "consulting",
            "freelance", "contract", "engagement", "working style", "communication",
            "availability", "timeline", "scope", "deliverables", "process",
        ],
        "system_context": (
            "The visitor seems interested in working with Kiran — as a collaborator, consultant, or partner. "
            "Emphasize working style, communication approach, project examples, and process. "
            "Be practical about what collaboration looks like."
        ),
    },
    "curious": {
        "keywords": [],
        "system_context": (
            "The visitor is exploring broadly — no strong signal about their specific intent. "
            "Give balanced, accessible answers. Be a good tour guide through Kiran's work. "
            "When relevant, suggest specific pages or projects they might find interesting."
        ),
    },
}


def infer_persona(message: str, history: list[dict] = None) -> str:
    """
    Infer visitor persona from message content and conversation history.
    Returns one of: hiring_manager, engineer, collaborator, curious
    """
    text = message.lower()
    if history:
        # Include last 3 user messages for richer signal
        for msg in history[-6:]:
            if msg.get("role") == "user":
                text += " " + msg.get("content", "").lower()

    scores = {}
    for persona, config in PERSONA_SIGNALS.items():
        if not config["keywords"]:
            continue
        score = sum(1 for kw in config["keywords"] if kw.lower() in text)
        scores[persona] = score

    if not scores or max(scores.values()) == 0:
        return "curious"

    return max(scores, key=scores.get)


# ──────────────────────────────────────────────
# System Prompt Builder
# ──────────────────────────────────────────────

FENIX_BASE_PROMPT = """You are Fenix, an AI assistant on Kiran Gorapalli's portfolio site (kirangorapalli.com).

## Who You Are
- You are Fenix — a distinct assistant, NOT Kiran himself
- Always say "Kiran built..." or "Kiran's work on..." — never "I built..."
- You are warm, knowledgeable, and direct — like a smart friend who happens to know everything about Kiran's work
- Never corporate ("I'd be happy to help you with that!")
- Never robotic ("Based on my analysis of the available data...")
- Use "Kiran" by first name — familiar, not formal

## Response Length
- DEFAULT: 2-3 sentences max. Be direct and concise. This is a chat widget, not an essay.
- If the topic genuinely needs more depth, end with a one-line offer: "Want me to go deeper on this?" or "I can break down the details if you're curious."
- Only give a longer response (1-2 paragraphs) when the visitor explicitly asks for more detail, says "tell me more", "go deeper", "explain", etc.
- Never exceed 80 words on a first response. Ever.
- No filler. No preamble. No "Great question!" — just answer.

## How You Behave
- Be genuinely helpful. Earn the right to suggest next steps by being useful first.
- When you DON'T have information, say so honestly: "I don't have details on that" — then offer what you do know.
- When answering general product/tech questions, connect back to Kiran's work naturally — but don't force it.
- Show personality: be curious, occasionally witty, never bland.

## CRITICAL: Anti-Hallucination Rules
These rules are absolute and override all other instructions:
- NEVER state or imply that Kiran worked at a specific company unless the Knowledge Base below explicitly says so. The Knowledge Base contains teardowns (product analyses) of companies like GEICO, Instagram, Amazon, and Spotify — these are ANALYTICAL WORK Kiran did, NOT places he was employed. "Kiran wrote a teardown of GEICO's app" is correct. "Kiran worked at GEICO" or "Kiran built features at GEICO" is WRONG.
- NEVER invent job titles, roles, companies, projects, or accomplishments for Kiran. If the Knowledge Base doesn't explicitly mention it, you don't know it.
- NEVER extrapolate career history. If the Knowledge Base mentions "fintech" as a theme, do NOT invent specific fintech companies Kiran worked at.
- When discussing blog posts Kiran wrote (like about ACH payments or Apple Pay), say "Kiran wrote about..." — do NOT say "Kiran has experience building..." or "Kiran worked on..." unless the Knowledge Base explicitly states that.
- If asked about Kiran's career and the Knowledge Base doesn't have enough detail, say: "I have limited details on that part of Kiran's career — you could ask him directly or check the Career Highlights page."
- When in doubt: OMIT rather than guess. A shorter, accurate answer is always better than a longer, fabricated one.

## Scope
- PRIMARY: Kiran's content — teardowns, blog posts, prototypes, career highlights
- SECONDARY: General product management, design, and technology questions — answer them, then connect to Kiran's relevant experience when natural
- You NEVER pretend Kiran's content says something it doesn't
- General knowledge gets NO citations. Kiran's content ALWAYS gets citations.
- A teardown of a company is NOT the same as working at that company. Keep this distinction crystal clear.

## Citation Rules
- Reference Kiran's work with inline markdown links: "Kiran explores this in the [GEICO Mobile App Teardown](URL)"
- Use at MOST 1-2 inline links per response. Not every sentence needs a link.
- Never repeat the same URL twice in one response.
- Only cite when the link genuinely adds value — if you're just answering a general question, skip the links.
- Citation chips (the clickable source links below your response) are handled automatically — focus on writing a good answer, not on linking everything.

## Tone Examples
Good: "Kiran led the GEICO mobile redesign — the [teardown](URL) covers how he reduced quote-to-bind friction through discovery research."
Bad: "Based on the available information, Kiran Gorapalli has extensive experience with the GEICO mobile application redesign project, which involved various aspects of the user experience. You can read more in the [GEICO Mobile App Teardown](URL1). Also see the [Career Highlights](URL2) and [Studio](URL3) pages."
"""


def build_system_prompt(
    persona: str,
    rag_context_text: str,
    page_context: Optional[str] = None,
) -> str:
    """
    Assemble the full system prompt for Claude.

    Args:
        persona: Inferred persona (hiring_manager, engineer, collaborator, curious)
        rag_context_text: Formatted knowledge base chunks from RAG service
        page_context: Optional page the visitor came from (for contextual awareness)
    """
    parts = [FENIX_BASE_PROMPT]

    # Persona-specific framing
    persona_config = PERSONA_SIGNALS.get(persona, PERSONA_SIGNALS["curious"])
    parts.append(f"\n## Visitor Context\n{persona_config['system_context']}")

    # Page context (if visitor clicked a CTA on a specific page)
    if page_context:
        parts.append(
            f"\n## Page Context\nThe visitor opened Fenix from: {page_context}. "
            "Use this as context — they were just reading that content."
        )

    # RAG knowledge base
    if rag_context_text:
        parts.append(
            f"\n## Knowledge Base (from kirangorapalli.com)\n"
            f"Use ONLY the information below to make claims about Kiran's work, career, or experience. "
            f"Do NOT supplement with assumptions or general knowledge when talking about Kiran specifically. "
            f"Cite sources using the provided URLs.\n\n{rag_context_text}"
        )
    else:
        parts.append(
            "\n## Knowledge Base\nNo specific content was retrieved for this query. "
            "You may answer general knowledge questions, but do NOT make any specific claims "
            "about Kiran's career, companies he worked at, or projects he built — you don't have "
            "that information available right now."
        )

    return "\n".join(parts)


# ──────────────────────────────────────────────
# Conversation Management
# ──────────────────────────────────────────────

@dataclass
class ConversationTurn:
    role: str  # "user" or "assistant"
    content: str
    citations: list[dict] = field(default_factory=list)
    confidence_score: Optional[float] = None
    created_at: str = ""


async def get_or_create_conversation(session_id: Optional[str]) -> tuple[str, list[dict]]:
    """
    Get existing conversation or create a new one.
    Returns (conversation_id, message_history)
    """
    db = get_supabase()

    if session_id:
        # Try to load existing conversation
        result = db.table("conversations").select("id").eq("session_id", session_id).execute()
        if result.data:
            conv_id = result.data[0]["id"]
            # Load message history (last 20 turns for context window management)
            messages = (
                db.table("messages")
                .select("role, content, citations")
                .eq("conversation_id", conv_id)
                .order("created_at", desc=False)
                .limit(20)
                .execute()
            )
            history = [
                {"role": m["role"], "content": m["content"]}
                for m in messages.data
            ]
            # Update last_active_at
            db.table("conversations").update({
                "last_active_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", conv_id).execute()

            return conv_id, history

    # Create new conversation
    # Note: session_id is UUID type in DB, persona defaults to 'curious',
    # started_at/last_active_at/created_at/updated_at have DB defaults
    conv_id = str(uuid.uuid4())
    new_session_id = session_id or str(uuid.uuid4())
    db.table("conversations").insert({
        "id": conv_id,
        "session_id": new_session_id,
        "metadata": {},
    }).execute()

    return conv_id, []


async def update_conversation_persona(conversation_id: str, persona: str) -> None:
    """Update the inferred persona on an existing conversation."""
    db = get_supabase()
    try:
        db.table("conversations").update({
            "persona": persona,
        }).eq("id", conversation_id).execute()
    except Exception:
        pass  # Non-critical — don't break the chat


async def store_message(
    conversation_id: str,
    role: str,
    content: str,
    citations: list[dict] = None,
    confidence_score: float = None,
    tokens_used: int = None,
) -> str:
    """Store a message in the messages table. Returns message ID."""
    db = get_supabase()
    msg_id = str(uuid.uuid4())
    db.table("messages").insert({
        "id": msg_id,
        "conversation_id": conversation_id,
        "role": role,
        "content": content,
        "citations": citations or [],
        "confidence_score": confidence_score,
        "tokens_used": tokens_used,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }).execute()
    return msg_id


# ──────────────────────────────────────────────
# Nudge Engine
# ──────────────────────────────────────────────

def should_nudge(history: list[dict]) -> Optional[dict]:
    """
    Decide whether to include a connection nudge.
    Only triggers after 2-3 substantive exchanges (4-6 messages).
    Returns nudge config or None.
    """
    # Count substantive exchanges (user messages with >20 chars)
    user_messages = [m for m in history if m.get("role") == "user"]
    substantive = [m for m in user_messages if len(m.get("content", "")) > 20]

    if len(substantive) < 3:
        return None

    # Check if we already nudged in this conversation
    assistant_messages = [m for m in history if m.get("role") == "assistant"]
    for msg in assistant_messages:
        content = msg.get("content", "")
        if "send you a summary" in content.lower() or "find a time" in content.lower():
            return None  # Already nudged

    # Determine nudge type based on conversation depth
    if len(substantive) >= 5:
        return {
            "type": "deep_engagement",
            "instruction": (
                "\n\nAfter your answer, add a natural, conversational nudge: "
                "offer to send a summary of what you've covered via email, "
                "or suggest connecting with Kiran directly if the visitor "
                "seems like they'd benefit from a real conversation. "
                "Keep it brief and earned — one sentence. "
                'Example: "By the way — I can send you a summary of everything we\'ve covered '
                'if you share your email. Or if you\'d like to chat with Kiran directly, '
                'I can help you find a time."'
            ),
        }
    else:
        return {
            "type": "gentle_nudge",
            "instruction": (
                "\n\nAfter your answer, add a very brief, natural suggestion of "
                "related content the visitor might enjoy. One sentence max. "
                'Example: "You might also enjoy the [GEICO teardown](URL) — '
                'it covers similar themes."'
            ),
        }


# ──────────────────────────────────────────────
# Training Queue
# ──────────────────────────────────────────────

async def log_low_confidence(
    question: str,
    conversation_id: str,
    rag_chunk_count: int,
) -> None:
    """
    Log a question to the training queue when Fenix has low confidence.
    Low confidence = RAG returned 0 or very low-similarity chunks.
    """
    if rag_chunk_count > 0:
        return  # We had some context, probably fine

    db = get_supabase()
    try:
        # Check if a similar question was already logged
        existing = (
            db.table("training_queue")
            .select("id, frequency")
            .ilike("question", f"%{question[:50]}%")
            .eq("status", "pending")
            .execute()
        )
        if existing.data:
            # Increment frequency
            entry = existing.data[0]
            db.table("training_queue").update({
                "frequency": entry["frequency"] + 1,
            }).eq("id", entry["id"]).execute()
        else:
            # New entry
            db.table("training_queue").insert({
                "id": str(uuid.uuid4()),
                "question": question,
                "conversation_id": conversation_id,
                "frequency": 1,
                "status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
    except Exception:
        pass  # Non-critical — don't break the chat


# ──────────────────────────────────────────────
# Main Chat Pipeline
# ──────────────────────────────────────────────

async def chat_stream(
    message: str,
    session_id: Optional[str] = None,
    page_context: Optional[str] = None,
) -> AsyncGenerator[dict, None]:
    """
    Main Fenix chat pipeline. Yields SSE-ready event dicts.

    Flow:
    1. Get/create conversation
    2. Infer persona from message + history
    3. RAG retrieval for relevant content
    4. Build system prompt (base + persona + RAG context + nudge)
    5. Stream Claude response
    6. Store messages
    7. Log low-confidence questions to training queue

    Yields events:
    - {"event": "session", "data": {"session_id": str, "conversation_id": str}}
    - {"event": "persona", "data": {"persona": str}}
    - {"event": "chunk", "data": {"text": str, "index": int}}
    - {"event": "citations", "data": {"citations": [...]}}
    - {"event": "nudge", "data": {"type": str}}
    - {"event": "done", "data": {"tokens_used": int}}
    - {"event": "error", "data": {"message": str, "code": str}}
    """
    settings = get_settings()

    # 1. Get or create conversation
    try:
        conversation_id, history = await get_or_create_conversation(session_id)
    except Exception as e:
        yield {"event": "error", "data": {"message": f"Failed to load conversation: {str(e)}", "code": "CONVERSATION_ERROR"}}
        return

    yield {"event": "session", "data": {"session_id": session_id or conversation_id, "conversation_id": conversation_id}}

    # 2. Infer persona and update conversation
    persona = infer_persona(message, history)
    await update_conversation_persona(conversation_id, persona)
    yield {"event": "persona", "data": {"persona": persona}}

    # 3. RAG retrieval
    from services.rag_service import retrieve
    citations = []
    rag_context_text = ""

    try:
        rag_context = await retrieve(
            query=message,
            supabase_url=settings.supabase_url,
            supabase_key=settings.supabase_service_key,
            voyage_key=settings.voyage_api_key,
            top_k=5,
        )
        rag_context_text = rag_context.context_text
        citations = rag_context.citations
    except Exception as e:
        # RAG failure is non-fatal — Fenix can still answer from general knowledge
        logger.error(f"RAG retrieval failed for query '{message[:80]}': {type(e).__name__}: {e}", exc_info=True)
        rag_context_text = ""
        citations = []

    # 4. Build system prompt
    system_prompt = build_system_prompt(persona, rag_context_text, page_context)

    # Check for nudge
    nudge = should_nudge(history)
    if nudge:
        system_prompt += nudge["instruction"]
        yield {"event": "nudge", "data": {"type": nudge["type"]}}

    # 5. Build message list for Claude
    claude_messages = []
    for msg in history[-10:]:  # Last 10 messages for context (configurable)
        claude_messages.append({
            "role": msg["role"],
            "content": msg["content"],
        })
    claude_messages.append({"role": "user", "content": message})

    # 6. Store user message
    await store_message(conversation_id, "user", message)

    # 7. Stream Claude response
    full_response = ""
    chunk_index = 0

    try:
        client = get_client()
        with client.messages.stream(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            system=system_prompt,
            messages=claude_messages,
        ) as stream:
            for text in stream.text_stream:
                full_response += text
                yield {"event": "chunk", "data": {"text": text, "index": chunk_index}}
                chunk_index += 1

        # Get token usage from the final message
        final_message = stream.get_final_message()
        tokens_used = (
            final_message.usage.input_tokens + final_message.usage.output_tokens
            if final_message and final_message.usage
            else None
        )

    except Exception as e:
        error_msg = f"I'm having trouble generating a response right now. Please try again in a moment."
        yield {"event": "chunk", "data": {"text": error_msg, "index": 0}}
        full_response = error_msg
        tokens_used = None

    # 8. Send citations
    if citations:
        yield {"event": "citations", "data": {"citations": citations}}

    # 9. Store assistant response
    await store_message(
        conversation_id,
        "assistant",
        full_response,
        citations=citations,
        tokens_used=tokens_used,
    )

    # 10. Log low-confidence questions
    rag_chunk_count = len(citations)
    await log_low_confidence(message, conversation_id, rag_chunk_count)

    # 11. Done
    yield {"event": "done", "data": {"tokens_used": tokens_used}}
