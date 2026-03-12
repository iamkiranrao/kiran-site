"""
Fenix Training Service — structured Q&A interview to teach Fenix personal knowledge.

Flow:
  1. Start a training session → Claude generates 100 questions across 10 categories
  2. Questions are served in batches of 10 (one category at a time)
  3. Kiran answers each question naturally
  4. Claude does an editorial pass (clean grammar, preserve voice, split compound answers)
  5. Kiran approves or edits the polished version
  6. Approved answers are stored in `training_data` table in Supabase

Tables used:
  - training_data: question, answer, category, source, status, created_at
"""

import os
from utils.config import CLAUDE_MODEL
import json
import uuid
import hashlib
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional
from anthropic import Anthropic
from supabase import create_client, Client

try:
    import httpx
except ImportError:
    httpx = None  # Embedding will fall back to hash-based

logger = logging.getLogger("fenix.training")

# In-memory cache for question bank generated answers (avoids re-calling API)
_qb_answer_cache: dict[str, dict] = {}


# ── Constants ─────────────────────────────────────────────────────────

SESSIONS_DIR = Path(__file__).resolve().parent.parent / "data" / "training_sessions"
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

CATEGORIES = [
    {
        "id": "professional",
        "label": "Professional",
        "description": "Product philosophy, leadership style, decision-making, career highlights, proudest work",
    },
    {
        "id": "technical",
        "label": "Technical",
        "description": "Tech stack preferences, AI opinions, tools you love/hate, build vs buy philosophy",
    },
    {
        "id": "personal",
        "label": "Personal",
        "description": "Hobbies, interests, values, communication style, fun facts, favorites",
    },
    {
        "id": "working_style",
        "label": "Working Style",
        "description": "How you run meetings, give feedback, handle conflict, mentor, collaborate",
    },
    {
        "id": "industry_views",
        "label": "Industry Views",
        "description": "Insurance tech opinions, AI in product, startup vs enterprise, emerging trends",
    },
    {
        "id": "site_specific",
        "label": "Site-Specific",
        "description": "What visitors should know, what Fenix should emphasize, common misconceptions",
    },
    {
        "id": "career_story",
        "label": "Career Story",
        "description": "Key career pivots, lessons from failures, mentors, formative experiences",
    },
    {
        "id": "product_craft",
        "label": "Product Craft",
        "description": "Prioritization frameworks, user research methods, metrics philosophy, shipping culture",
    },
    {
        "id": "opinions",
        "label": "Opinions & Takes",
        "description": "Hot takes on tech, product management, AI, design, leadership — things that make you YOU",
    },
    {
        "id": "fun",
        "label": "Fun & Personality",
        "description": "Guilty pleasures, unpopular opinions, what you'd do with unlimited time, conversation starters",
    },
]

QUESTION_GENERATION_PROMPT = """You are helping Kiran Gorapalli teach his AI assistant (Fenix) about himself.
Fenix lives on Kiran's personal portfolio site and answers visitor questions about Kiran's work,
skills, experience, and personality.

Generate exactly {count} thoughtful, specific interview questions for the category: **{category_label}**
Category description: {category_description}

RULES:
1. Questions should be conversational and specific — not generic. Think "What's your hot take on
   PMs who don't code?" not "What do you think about product management?"
2. Mix deep/reflective questions with lighter ones
3. Questions should elicit answers that would be genuinely useful for an AI assistant to know
4. Avoid questions that would be answered by Kiran's resume or website content (Fenix already knows that)
5. Focus on opinions, personality, working style, and things that make Kiran unique
6. Each question should be self-contained (no "following up on..." references)

Return a JSON array of question strings. No explanations, just the array.
Example: ["What's the worst product decision you ever made, and what did it teach you?", ...]"""

EDITORIAL_PROMPT = """You are an editorial assistant helping Kiran Gorapalli teach his AI assistant (Fenix).
Kiran just answered an interview question. Your job is to polish his answer for storage in Fenix's
knowledge base.

QUESTION: {question}
CATEGORY: {category}
KIRAN'S RAW ANSWER: {answer}

EDITORIAL RULES:
1. PRESERVE Kiran's voice, personality, and opinions — don't make it sound corporate or generic
2. Fix grammar, spelling, and clarity issues
3. If the answer contains multiple distinct points, split into separate Q&A pairs
4. Keep each answer concise but complete (2-5 sentences ideal)
5. Don't add information Kiran didn't provide
6. Don't soften strong opinions — if Kiran has a take, keep it sharp
7. Don't add qualifiers like "in my experience" or "I believe" — Fenix already knows these are Kiran's views

Return a JSON object:
{{
  "pairs": [
    {{
      "question": "the question (may be rephrased for clarity)",
      "answer": "the polished answer",
      "needs_review": false
    }}
  ],
  "editorial_notes": "brief note about what you changed (or 'no changes needed')"
}}

If you split the answer into multiple pairs, create specific sub-questions for each.
Set needs_review to true if the answer seems incomplete, unclear, or potentially controversial."""


# ── Supabase client ──────────────────────────────────────────────────


def _get_supabase() -> Client:
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
    return create_client(url, key)


def _get_claude(api_key: Optional[str] = None) -> Anthropic:
    key = api_key
    if not key or not key.startswith("sk-ant-"):
        key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not key or not key.startswith("sk-ant-"):
        raise RuntimeError("No valid Claude API key available")
    return Anthropic(api_key=key)


# ── Already-answered tracking ────────────────────────────────────────


def get_answered_questions() -> dict:
    """Fetch all question texts already saved to training_data (from any source).
    Returns a dict with 'questions' (set of lowercase question texts) and
    'question_bank_ids' (set of question_bank IDs that have been answered)."""
    sb = _get_supabase()

    # Fetch all saved questions — we only need question text and source
    result = sb.table("training_data").select("question, source, category").execute()

    answered_texts = set()
    qb_answered_ids = set()  # track which qb questions have been answered

    if result.data:
        for row in result.data:
            answered_texts.add(row["question"].strip().lower())

    # Also check if any question_bank source entries exist — map them back to IDs
    # by matching question text against the question bank
    try:
        from data.question_bank import QUESTION_BANK
        for q in QUESTION_BANK:
            if q["question"].strip().lower() in answered_texts:
                qb_answered_ids.add(q["id"])
    except ImportError:
        pass

    return {
        "texts": answered_texts,
        "question_bank_ids": qb_answered_ids,
        "count": len(answered_texts),
    }


# ── Session file helpers ─────────────────────────────────────────────


def _session_path(session_id: str) -> Path:
    return SESSIONS_DIR / f"{session_id}.json"


def _save_session(state: dict):
    with open(_session_path(state["session_id"]), "w") as f:
        json.dump(state, f, indent=2)


def _load_session(session_id: str) -> Optional[dict]:
    path = _session_path(session_id)
    if not path.exists():
        return None
    with open(path) as f:
        return json.load(f)


# ── Session management ───────────────────────────────────────────────


def create_training_session(api_key: Optional[str] = None) -> dict:
    """Start a new training session. Generates all 100 questions upfront,
    excluding questions that have already been answered in previous sessions."""
    client = _get_claude(api_key)
    session_id = str(uuid.uuid4())[:8]

    # Get already-answered questions to avoid re-asking
    already_answered_texts = set()
    try:
        answered = get_answered_questions()
        already_answered_texts = answered["texts"]
    except Exception as e:
        logger.warning(f"Could not load answered questions: {e}")

    # Build exclusion context for the prompt
    exclusion_note = ""
    if already_answered_texts:
        # Sample up to 20 already-answered questions per category to keep prompt manageable
        exclusion_note = (
            "\n\nIMPORTANT: The following questions have already been answered in previous sessions. "
            "Do NOT generate similar questions. Generate completely NEW and different questions:\n"
        )

    # Generate questions for all categories (10 per category = 100 total)
    all_questions: list[dict] = []

    for cat in CATEGORIES:
        # Build per-category exclusion list
        cat_exclusion = exclusion_note
        if already_answered_texts:
            # Find questions from this category's previous answers
            sample = list(already_answered_texts)[:20]
            cat_exclusion += "\n".join(f"- {q}" for q in sample)

        prompt = QUESTION_GENERATION_PROMPT.format(
            count=10,
            category_label=cat["label"],
            category_description=cat["description"],
        ) + cat_exclusion

        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )

        text = response.content[0].text.strip()
        # Parse JSON array from response
        try:
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]
            questions = json.loads(text)
        except (json.JSONDecodeError, IndexError):
            # Fallback: try to find array in text
            import re
            match = re.search(r"\[.*\]", text, re.DOTALL)
            if match:
                questions = json.loads(match.group())
            else:
                questions = [f"Tell me about your {cat['label'].lower()} background."] * 10

        for i, q in enumerate(questions[:10]):
            all_questions.append({
                "id": f"{cat['id']}_{i}",
                "question": q,
                "category_id": cat["id"],
                "category_label": cat["label"],
                "status": "pending",  # pending → answered → polished → approved → saved | skipped
                "raw_answer": None,
                "polished_pairs": None,
                "editorial_notes": None,
            })

    state = {
        "session_id": session_id,
        "created_at": datetime.now().isoformat(),
        "status": "active",  # active → completed
        "questions": all_questions,
        "current_index": 0,
        "stats": {
            "total": len(all_questions),
            "answered": 0,
            "approved": 0,
            "skipped": 0,
            "saved": 0,
        },
    }

    _save_session(state)
    return _session_summary(state)


def list_training_sessions() -> list[dict]:
    """List all training sessions."""
    sessions = []
    for path in sorted(SESSIONS_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            with open(path) as f:
                state = json.load(f)
            sessions.append(_session_summary(state))
        except (json.JSONDecodeError, KeyError):
            continue
    return sessions


def get_training_session(session_id: str) -> Optional[dict]:
    """Get full session state."""
    state = _load_session(session_id)
    if not state:
        return None
    return state


def get_current_question(session_id: str) -> Optional[dict]:
    """Get the current question in the session."""
    state = _load_session(session_id)
    if not state:
        return None

    idx = state["current_index"]
    questions = state["questions"]

    # Find next unanswered question from current index
    while idx < len(questions) and questions[idx]["status"] in ("approved", "saved", "skipped"):
        idx += 1

    if idx >= len(questions):
        return {"done": True, "stats": state["stats"]}

    state["current_index"] = idx
    _save_session(state)

    q = questions[idx]
    return {
        "done": False,
        "index": idx,
        "question": q["question"],
        "category_id": q["category_id"],
        "category_label": q["category_label"],
        "status": q["status"],
        "raw_answer": q.get("raw_answer"),
        "polished_pairs": q.get("polished_pairs"),
        "editorial_notes": q.get("editorial_notes"),
        "stats": state["stats"],
        "total": len(questions),
    }


def _fetch_kiran_context(question: str, category: str = "", limit: int = 8) -> str:
    """Fetch relevant approved training data to enrich draft answer prompts.

    Pulls previously approved answers that are relevant to the question,
    giving Claude real examples of Kiran's voice, experiences, and opinions.
    """
    try:
        sb = _get_supabase()
        # Get approved answers, prioritizing same category
        results = []

        # First: same-category answers
        if category:
            cat_result = (
                sb.table("training_data")
                .select("question, answer, category")
                .eq("status", "approved")
                .eq("category", category)
                .order("created_at", desc=True)
                .limit(4)
                .execute()
            )
            results.extend(cat_result.data or [])

        # Then: other approved answers for broader context
        other_result = (
            sb.table("training_data")
            .select("question, answer, category")
            .eq("status", "approved")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        # Deduplicate
        seen = {r["question"] for r in results}
        for r in (other_result.data or []):
            if r["question"] not in seen:
                results.append(r)
                seen.add(r["question"])

        if not results:
            return ""

        context_lines = []
        for r in results[:limit]:
            context_lines.append(f"Q: {r['question']}\nA: {r['answer']}")

        return "\n\n".join(context_lines)

    except Exception as e:
        logging.warning(f"Could not fetch training context: {e}")
        return ""


DRAFT_ANSWER_PROMPT = """You are helping Kiran Gorapalli teach his AI assistant (Fenix) about himself.
Fenix lives on Kiran's personal portfolio site and answers visitor questions about Kiran's work,
skills, experience, and personality.

{kiran_context_section}

TASK: Draft an answer to this interview question AS IF Kiran is answering.

CRITICAL RULES:
- NEVER fabricate or assume ANY specific details about Kiran (company names, job titles, dates, projects, metrics).
- ONLY use facts that appear in the context above. If the context is empty or limited, that's OK.
- For anything you don't know, use [brackets] as placeholders — e.g. [company name], [specific project], [metric/outcome].
- It's better to have a draft full of [brackets] than one with made-up details.
- Write a STRUCTURE/SKELETON that Kiran can quickly fill in with his real experiences.
- 2-3 sentences MAX. Natural, authentic senior PM voice.
- End with a follow-up prompt like "Want me to go deeper on [aspect]?" to keep it conversational.
- Minimize vertical scroll — be punchy, not encyclopedic.

QUESTION: {question}
CATEGORY: {category}

Return a JSON object:
{{
  "draft_answer": "the draft answer text with [bracketed placeholders] for unknown details",
  "placeholders": ["list of all [bracketed] items Kiran should fill in"]
}}

Return ONLY the JSON object, no markdown formatting."""


def generate_draft_answer(
    session_id: str,
    api_key: Optional[str] = None,
    regenerate: bool = False,
) -> dict:
    """Generate a draft answer for the current question in a training session."""
    state = _load_session(session_id)
    if not state:
        raise FileNotFoundError(f"Session {session_id} not found")

    idx = state["current_index"]
    q = state["questions"][idx]

    # If already has a draft and not regenerating, return cached version
    if q.get("draft_answer") and not regenerate:
        return {
            "index": idx,
            "question": q["question"],
            "category_id": q["category_id"],
            "category_label": q["category_label"],
            "draft_answer": q["draft_answer"],
            "placeholders": q.get("placeholders", []),
        }

    client = _get_claude(api_key)

    # Fetch real context from approved training data
    raw_context = _fetch_kiran_context(q["question"], category=q.get("category_id", ""))
    if raw_context:
        kiran_context_section = f"WHAT KIRAN HAS ALREADY SHARED (use ONLY these facts — do not invent others):\n\n{raw_context}"
    else:
        kiran_context_section = "NO CONTEXT AVAILABLE YET — Kiran has not approved any training data yet. Use [brackets] for ALL specific details (companies, projects, metrics, dates). Do not guess."

    prompt = DRAFT_ANSWER_PROMPT.format(
        question=q["question"],
        category=q["category_label"],
        kiran_context_section=kiran_context_section,
    )

    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.content[0].text.strip()
    try:
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        result = json.loads(text)
    except (json.JSONDecodeError, IndexError):
        result = {
            "draft_answer": "Could not generate draft. Please try again or write your own answer.",
            "placeholders": []
        }

    # Cache the draft in the session state
    q["draft_answer"] = result.get("draft_answer", "")
    q["placeholders"] = result.get("placeholders", [])
    q["status"] = "drafted"
    _save_session(state)

    return {
        "index": idx,
        "question": q["question"],
        "category_id": q["category_id"],
        "category_label": q["category_label"],
        "draft_answer": q["draft_answer"],
        "placeholders": q.get("placeholders", []),
    }


def answer_question(
    session_id: str, answer: str, api_key: Optional[str] = None
) -> dict:
    """Submit an answer. Claude does an editorial pass and returns polished version."""
    state = _load_session(session_id)
    if not state:
        raise FileNotFoundError(f"Session {session_id} not found")

    idx = state["current_index"]
    q = state["questions"][idx]

    # Store raw answer
    q["raw_answer"] = answer
    q["status"] = "answered"

    # Run editorial pass
    client = _get_claude(api_key)
    prompt = EDITORIAL_PROMPT.format(
        question=q["question"],
        category=q["category_label"],
        answer=answer,
    )

    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.content[0].text.strip()
    try:
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        editorial = json.loads(text)
    except (json.JSONDecodeError, IndexError):
        # Fallback: use the answer as-is
        editorial = {
            "pairs": [{"question": q["question"], "answer": answer, "needs_review": False}],
            "editorial_notes": "Could not parse editorial response — using raw answer.",
        }

    q["polished_pairs"] = editorial.get("pairs", [])
    q["editorial_notes"] = editorial.get("editorial_notes", "")
    q["status"] = "polished"
    state["stats"]["answered"] += 1

    _save_session(state)

    return {
        "index": idx,
        "original_question": q["question"],
        "raw_answer": answer,
        "polished_pairs": q["polished_pairs"],
        "editorial_notes": q["editorial_notes"],
        "status": q["status"],
    }


# ── Embedding helpers ─────────────────────────────────────────────

EMBEDDING_MODEL = "voyage-3-lite"
EMBEDDING_DIMENSIONS = 512


def _embed_text_voyage(text: str) -> Optional[list[float]]:
    """Generate embedding via Voyage AI. Returns None on failure."""
    voyage_key = os.getenv("VOYAGE_API_KEY", "").strip()
    if not voyage_key or not httpx:
        return None
    try:
        response = httpx.post(
            "https://api.voyageai.com/v1/embeddings",
            json={
                "model": EMBEDDING_MODEL,
                "input": [text],
                "input_type": "document",
            },
            headers={
                "Authorization": f"Bearer {voyage_key}",
                "Content-Type": "application/json",
            },
            timeout=30,
        )
        response.raise_for_status()
        return response.json()["data"][0]["embedding"]
    except Exception as e:
        logger.warning(f"Voyage embedding failed: {e}")
        return None


def _embed_text_fallback(text: str) -> list[float]:
    """Hash-based pseudo-embedding fallback (matches rag_service.py)."""
    text_hash = hashlib.sha512(text.encode()).hexdigest()
    embedding = []
    for j in range(0, min(len(text_hash), EMBEDDING_DIMENSIONS * 2), 2):
        byte_val = int(text_hash[j : j + 2], 16)
        embedding.append((byte_val - 128) / 128.0)
    while len(embedding) < EMBEDDING_DIMENSIONS:
        embedding.append(0.0)
    return embedding[:EMBEDDING_DIMENSIONS]


def _generate_training_embedding(question: str, answer: str, category: str = "") -> list[float]:
    """Generate embedding for a Q&A pair. Tries Voyage AI, falls back to hash."""
    cat_label = f" [Category: {category}]" if category else ""
    text = f"Q: {question}\nA: {answer}{cat_label}"
    embedding = _embed_text_voyage(text)
    if embedding is None:
        embedding = _embed_text_fallback(text)
    return embedding


def _store_embedding(sb: Client, entry_id: str, embedding: list[float]):
    """Update a training_data row with its embedding vector."""
    try:
        sb.table("training_data").update(
            {"embedding": str(embedding)}
        ).eq("id", entry_id).execute()
    except Exception as e:
        logger.warning(f"Failed to store embedding for {entry_id}: {e}")


def approve_question(
    session_id: str,
    edited_pairs: Optional[list[dict]] = None,
) -> dict:
    """Approve the polished answer (optionally with edits) and save to Supabase."""
    state = _load_session(session_id)
    if not state:
        raise FileNotFoundError(f"Session {session_id} not found")

    idx = state["current_index"]
    q = state["questions"][idx]

    # Use edited pairs if provided, otherwise use the polished ones
    pairs = edited_pairs if edited_pairs else q.get("polished_pairs", [])

    if not pairs:
        raise ValueError("No Q&A pairs to approve")

    # Save each pair to Supabase training_data and generate embeddings
    sb = _get_supabase()
    saved_ids = []

    for pair in pairs:
        row = {
            "question": pair["question"],
            "answer": pair["answer"],
            "category": q["category_id"],
            "source": "training_interview",
            "status": "active",
        }
        result = sb.table("training_data").insert(row).execute()
        if result.data:
            entry_id = result.data[0]["id"]
            saved_ids.append(entry_id)

            # Generate and store embedding (non-blocking — failure won't break the save)
            try:
                embedding = _generate_training_embedding(
                    pair["question"], pair["answer"], q["category_id"]
                )
                _store_embedding(sb, entry_id, embedding)
            except Exception as e:
                logger.warning(f"Embedding generation failed for {entry_id}: {e}")

    q["status"] = "saved"
    state["stats"]["approved"] += 1
    state["stats"]["saved"] += len(saved_ids)

    # Advance to next question
    state["current_index"] = idx + 1
    _save_session(state)

    return {
        "saved_count": len(saved_ids),
        "saved_ids": saved_ids,
        "next": get_current_question(session_id),
    }


def skip_question(session_id: str) -> dict:
    """Skip the current question."""
    state = _load_session(session_id)
    if not state:
        raise FileNotFoundError(f"Session {session_id} not found")

    idx = state["current_index"]
    state["questions"][idx]["status"] = "skipped"
    state["stats"]["skipped"] += 1
    state["current_index"] = idx + 1
    _save_session(state)

    return {"skipped": True, "next": get_current_question(session_id)}


# ── Training data CRUD ───────────────────────────────────────────────


def list_training_data(
    category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """List all training data entries with optional filters."""
    sb = _get_supabase()

    query = (
        sb.table("training_data")
        .select("*", count="exact")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )

    if category:
        query = query.eq("category", category)
    if status:
        query = query.eq("status", status)
    if search:
        query = query.or_(f"question.ilike.%{search}%,answer.ilike.%{search}%")

    result = query.execute()

    return {
        "entries": result.data,
        "total": result.count or 0,
        "offset": offset,
        "limit": limit,
    }


def update_training_entry(entry_id: str, question: Optional[str] = None, answer: Optional[str] = None, category: Optional[str] = None, status: Optional[str] = None) -> dict:
    """Update a training data entry."""
    sb = _get_supabase()

    updates = {}
    if question is not None:
        updates["question"] = question
    if answer is not None:
        updates["answer"] = answer
    if category is not None:
        updates["category"] = category
    if status is not None:
        updates["status"] = status

    if not updates:
        raise ValueError("No fields to update")

    updates["updated_at"] = datetime.now().isoformat()

    result = sb.table("training_data").update(updates).eq("id", entry_id).execute()
    if not result.data:
        raise FileNotFoundError(f"Training entry {entry_id} not found")

    return result.data[0]


def delete_training_entry(entry_id: str) -> dict:
    """Delete a training data entry."""
    sb = _get_supabase()
    result = sb.table("training_data").delete().eq("id", entry_id).execute()
    if not result.data:
        raise FileNotFoundError(f"Training entry {entry_id} not found")
    return {"deleted": True, "id": entry_id}


# ── Helpers ──────────────────────────────────────────────────────────


def _session_summary(state: dict) -> dict:
    """Return a compact summary of a session (for list views)."""
    return {
        "session_id": state["session_id"],
        "created_at": state["created_at"],
        "status": state["status"],
        "stats": state["stats"],
        "current_index": state.get("current_index", 0),
        "total_questions": len(state.get("questions", [])),
    }


def get_categories() -> list[dict]:
    """Return the list of training categories."""
    return CATEGORIES


# ── Question Bank service ──────────────────────────────────────────

def get_question_bank_questions(
    persona: Optional[str] = None,
    dimension: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    exclude_answered: bool = True,
) -> dict:
    """List questions from the question bank with optional filters.
    By default excludes questions already saved to training_data."""
    from data.question_bank import QUESTION_BANK, PERSONAS, DIMENSIONS

    filtered = QUESTION_BANK
    if persona:
        filtered = [q for q in filtered if q["persona"] == persona]
    if dimension:
        filtered = [q for q in filtered if q["dimension"] == dimension]

    # Exclude questions that have already been answered and saved
    if exclude_answered:
        try:
            answered = get_answered_questions()
            answered_ids = answered["question_bank_ids"]
            answered_texts = answered["texts"]
            filtered = [
                q for q in filtered
                if q["id"] not in answered_ids
                and q["question"].strip().lower() not in answered_texts
            ]
        except Exception as e:
            logger.warning(f"Could not filter answered questions: {e}")

    total = len(filtered)
    page = filtered[offset:offset + limit]

    return {
        "questions": page,
        "total": total,
        "offset": offset,
        "limit": limit,
        "personas": PERSONAS,
        "dimensions": DIMENSIONS,
    }


def get_question_bank_meta() -> dict:
    """Return personas and dimensions metadata with counts excluding already-answered questions."""
    from data.question_bank import PERSONAS, DIMENSIONS, QUESTION_BANK

    # Get already-answered questions to exclude from counts
    answered_ids = set()
    answered_texts = set()
    try:
        answered = get_answered_questions()
        answered_ids = answered["question_bank_ids"]
        answered_texts = answered["texts"]
    except Exception as e:
        logger.warning(f"Could not get answered questions for meta: {e}")

    # Count remaining (unanswered) questions per persona and dimension
    remaining = [
        q for q in QUESTION_BANK
        if q["id"] not in answered_ids
        and q["question"].strip().lower() not in answered_texts
    ]

    persona_counts = {}
    dimension_counts = {}
    for q in remaining:
        persona_counts[q["persona"]] = persona_counts.get(q["persona"], 0) + 1
        dimension_counts[q["dimension"]] = dimension_counts.get(q["dimension"], 0) + 1

    return {
        "personas": {k: {**v, "count": persona_counts.get(k, 0)} for k, v in PERSONAS.items()},
        "dimensions": {k: {**v, "count": dimension_counts.get(k, 0)} for k, v in DIMENSIONS.items()},
        "total_questions": len(remaining),
        "total_answered": len(QUESTION_BANK) - len(remaining),
    }


def generate_question_bank_answer(
    question_id: str,
    api_key: Optional[str] = None,
) -> dict:
    """Generate a best answer example and customized draft for a question bank entry.

    Results are cached in-memory so the API is only called once per question.
    """
    # Return cached result if available
    if question_id in _qb_answer_cache:
        logger.info(f"Returning cached answer for question {question_id}")
        return _qb_answer_cache[question_id]

    from data.question_bank import get_question_by_id, PERSONAS, DIMENSIONS

    q = get_question_by_id(question_id)
    if not q:
        raise FileNotFoundError(f"Question {question_id} not found")

    client = _get_claude(api_key)
    persona_info = PERSONAS.get(q["persona"], {})
    dimension_info = DIMENSIONS.get(q["dimension"], {})

    # Fetch real context from approved training data
    raw_context = _fetch_kiran_context(q["question"], limit=6)
    if raw_context:
        kiran_context = f"WHAT KIRAN HAS ALREADY SHARED (use ONLY these facts — do not invent others):\n\n{raw_context}"
    else:
        kiran_context = "NO CONTEXT AVAILABLE YET — Kiran has not approved any training data yet."

    prompt = f"""You are helping create training data for Fenix, an AI assistant on Kiran Gorapalli's personal portfolio website.

{kiran_context}

TASK: For this question, provide TWO things:

1. BEST ANSWER EXAMPLE: A real-world caliber answer that a top product leader would give. Reference the hint "{q['hint']}" for inspiration on sourcing style. Write as if a senior PM or tech leader is answering authentically — with specifics, personality, and earned perspective. Include a brief attribution note like "(Inspired by [Professional Name]'s approach)" if relevant.

2. CUSTOMIZED DRAFT FOR KIRAN: Write a draft answer structure AS IF Kiran is answering. CRITICAL: NEVER fabricate specific details (company names, job titles, projects, metrics). ONLY reference facts from the context above. For anything unknown, use [brackets] like [company name], [specific project], [metric]. The draft should be a useful skeleton that Kiran can quickly fill in — not a fictional biography. Natural PM voice.

BREVITY IS CRITICAL — Fenix's answers must minimize vertical scroll:
- Aim for 2-3 sentences MAX for most answers. Never exceed 4 sentences.
- Be conversational, not encyclopedic. Give the core insight, not a lecture.
- End with a natural follow-up prompt like "Want me to go deeper on [specific aspect]?" or "I can share more about [topic] if you're curious."
- Think: quick, punchy, personality-forward. The user can always ask for more.

QUESTION: {q['question']}
PERSONA CONTEXT: This question comes from "{persona_info.get('label', '')}" — {persona_info.get('description', '')}
DIMENSION: {dimension_info.get('label', '')} (Depth: {dimension_info.get('depth', '')})

Return a JSON object:
{{
  "best_answer": {{
    "text": "the example answer text (2-3 sentences + follow-up prompt)",
    "attribution": "brief note about inspiration source"
  }},
  "customized_draft": {{
    "text": "Kiran's customized draft answer (2-3 sentences + follow-up prompt)",
    "placeholders": ["list of any [bracketed] items Kiran should fill in"]
  }}
}}

Return ONLY the JSON object, no markdown formatting."""

    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.content[0].text.strip()
    try:
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        result = json.loads(text)
    except (json.JSONDecodeError, IndexError):
        result = {
            "best_answer": {
                "text": "Could not generate example answer. Please try again.",
                "attribution": ""
            },
            "customized_draft": {
                "text": "Could not generate draft. Please try again.",
                "placeholders": []
            }
        }

    cached = {
        "question": q,
        "best_answer": result.get("best_answer", {}),
        "customized_draft": result.get("customized_draft", {}),
    }
    # Cache the result so subsequent views don't re-call the API
    _qb_answer_cache[question_id] = cached
    return cached


def approve_question_bank_answer(
    question_id: str,
    question_text: str,
    answer_text: str,
    category: str = "question_bank",
) -> dict:
    """Approve and save a question bank answer to Supabase training_data."""
    from data.question_bank import get_question_by_id

    q = get_question_by_id(question_id)
    if not q:
        raise FileNotFoundError(f"Question {question_id} not found")

    sb = _get_supabase()

    # Map dimension to a category for storage
    storage_category = q.get("dimension", category)

    row = {
        "question": question_text,
        "answer": answer_text,
        "category": storage_category,
        "source": "question_bank",
        "status": "active",
    }
    result = sb.table("training_data").insert(row).execute()

    if not result.data:
        raise RuntimeError("Failed to save to Supabase")

    entry_id = result.data[0]["id"]

    # Generate and store embedding
    try:
        embedding = _generate_training_embedding(question_text, answer_text, storage_category)
        _store_embedding(sb, entry_id, embedding)
    except Exception as e:
        logger.warning(f"Embedding generation failed for {entry_id}: {e}")

    return {
        "saved": True,
        "entry_id": entry_id,
        "question_id": question_id,
    }


def save_manual_training_entry(
    question: str,
    answer: str,
    category: str = "manual",
) -> dict:
    """Save a manually entered question-answer pair to Supabase training_data."""
    sb = _get_supabase()

    row = {
        "question": question.strip(),
        "answer": answer.strip(),
        "category": category,
        "source": "manual",
        "status": "active",
    }
    result = sb.table("training_data").insert(row).execute()

    if not result.data:
        raise RuntimeError("Failed to save to Supabase")

    entry_id = result.data[0]["id"]

    # Generate and store embedding
    try:
        embedding = _generate_training_embedding(question, answer, category)
        _store_embedding(sb, entry_id, embedding)
    except Exception as e:
        logger.warning(f"Embedding generation failed for manual entry {entry_id}: {e}")

    return {
        "saved": True,
        "entry_id": entry_id,
    }


# ── Production Ready ──────────────────────────────────────────────────

PRODUCTION_READY_PROMPT = """You are an editor preparing training data for Fenix, the AI assistant on Kiran Gorapalli's portfolio website (kirangorapalli.com).

Your job is to take a question-answer pair and make it PRODUCTION READY by doing two things:

## 1. VOICE CONVERSION — Kiran's voice → Fenix's voice

The answer is currently written as if Kiran is speaking (first person: "I built...", "My approach...").
Convert it so Fenix is speaking ABOUT Kiran (third person: "Kiran built...", "His approach...").

Fenix's voice rules:
- Warm, knowledgeable, and direct — like a smart friend who knows everything about Kiran's work
- Says "Kiran built..." not "I built..."
- Uses "Kiran" by first name — familiar, not formal
- Never corporate ("I'd be happy to help you with that!")
- Never robotic ("Based on my analysis of the available data...")
- BREVITY IS THE #1 PRINCIPLE: 2-3 sentences for most answers. NEVER exceed 4 sentences.
- Minimize vertical scroll — conversations should feel conversational, not like a wall of text
- End with a natural follow-up prompt: "Want me to go deeper on [aspect]?" or "I can share more about [topic] if you're curious."
- The pattern is: succinct core answer → offer to go deeper. Not: dump everything at once.
- No filler, no preamble, no "Great question!" — just answer
- Show personality: curious, occasionally witty, never bland
- When Fenix doesn't have info, it says so honestly

## 2. CONTENT RULES CHECK — apply these rules from kirangorapalli.com's content rulebook:

### Banned Jargon & Buzzwords (REMOVE or REPLACE):
"leverage," "synergy," "paradigm," "ecosystem," "holistic," "scalable solution," "streamline," "cutting-edge," "best-in-class," "empower"

### Banned AI-Sounding Language (REMOVE or REPLACE):
"delve," "landscape," "multifaceted," "it's important to note," "in today's world," "at the end of the day," "game-changer," "let's dive in," "here's the thing," "it's worth noting," "compelling," "robust"

### Remove Filler Qualifiers:
"very," "really," "extremely," "incredibly," "highly"

### Fix Passive Voice:
Convert to active voice. "A decision was made to use X" → "Kiran chose X because..."

### No Lofty Abstractions:
Don't say "revolutionize the customer experience." Say what actually changes for the user.

### No Technical Posturing:
Frame technical choices as product decisions — why this approach serves the user, not how the code works internally.

### US English:
Use American spellings: organize, behavior, recognize, color, center, defense, program, license, judgment, modeling, traveled, fulfill.

### Anti-AI Authenticity:
Vary sentence length. Mix short punchy sentences with longer flowing ones. Should sound like a real person, not a template.

## OUTPUT FORMAT

Return a JSON object with these fields:
{
  "question": "<the question, cleaned up if needed>",
  "answer": "<the production-ready answer in Fenix's voice>",
  "changes": [
    {"type": "voice", "description": "brief description of voice change"},
    {"type": "jargon", "original": "word/phrase removed", "replacement": "what replaced it"},
    {"type": "passive_voice", "original": "passive phrase", "replacement": "active version"},
    {"type": "filler", "original": "filler word removed"},
    {"type": "ai_speak", "original": "AI phrase removed", "replacement": "what replaced it"},
    {"type": "spelling", "original": "British spelling", "replacement": "US spelling"}
  ]
}

If the text is already clean, the changes array can be empty but still convert voice if needed.
Return ONLY the JSON object, no markdown fences."""


def make_production_ready(
    question: str,
    answer: str,
    api_key: Optional[str] = None,
) -> dict:
    """Run content rules check and convert to Fenix's voice."""
    client = _get_claude(api_key)

    user_msg = f"""Make this training data production ready.

QUESTION: {question}

ANSWER: {answer}"""

    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=2000,
        system=PRODUCTION_READY_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )

    text = response.content[0].text.strip()

    try:
        result = json.loads(text)
    except json.JSONDecodeError:
        # Try to extract JSON from response
        import re
        match = re.search(r'\{[\s\S]*\}', text)
        if match:
            result = json.loads(match.group())
        else:
            result = {
                "question": question,
                "answer": text,
                "changes": [{"type": "error", "description": "Could not parse structured response"}],
            }

    return result
