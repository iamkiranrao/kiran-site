"""
MadLab Service — Simple session management for prototype overview pages.

Each session stores project metadata + content for 4 sections (problem, architecture,
try_it, related). Content can be written manually or drafted with a single Claude call.
"""

import json
import os
import uuid
import tempfile
from datetime import datetime
from typing import Optional, List, Dict

from utils.config import CLAUDE_MODEL, data_dir
from services.governance_loader import get_banned_phrases_prompt

SESSIONS_DIR = data_dir("madlab")

CATEGORIES = [
    "Chatbots & AI Assistants",
    "Agentic AI",
    "Voice & Audio AI",
    "Computer Vision",
    "Browser Extensions",
    "Data & Visualisations",
    "Automations & Workflows",
]


# ── Session management ────────────────────────────────────────────

def _session_path(session_id: str) -> str:
    return os.path.join(SESSIONS_DIR, session_id, "state.json")


def create_session(project_name: str, project_slug: str, category: str) -> dict:
    """Create a new MadLab session."""
    session_id = str(uuid.uuid4())[:8]
    session_dir = os.path.join(SESSIONS_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)

    state = {
        "session_id": session_id,
        "project_name": project_name,
        "project_slug": project_slug,
        "category": category,
        "status": "draft",  # draft → previewing → published
        "content": {
            "tagline": "",
            "meta_description": "",
            "tags": [],
            "launch_url": "index.html",
            "project_status": "Live Prototype",
            "glossary": [],
            "details_html": "",
            "architecture_html": "",
            "try_it_html": "",
            "related_html": "",
        },
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    }

    path = _session_path(session_id)
    tmp_path = path + ".tmp"
    with open(tmp_path, "w") as f:
        json.dump(state, f, indent=2)
    os.replace(tmp_path, path)

    return state


def get_session(session_id: str) -> Optional[dict]:
    """Load session state from disk."""
    path = _session_path(session_id)
    if not os.path.exists(path):
        return None
    with open(path, "r") as f:
        return json.load(f)


def update_session(session_id: str, updates: dict) -> dict:
    """Merge updates into session state."""
    state = get_session(session_id)
    if not state:
        raise FileNotFoundError(f"Session {session_id} not found")

    for key, value in updates.items():
        if key == "content" and isinstance(value, dict):
            state["content"].update(value)
        else:
            state[key] = value

    state["updated_at"] = datetime.now().isoformat()

    path = _session_path(session_id)
    tmp_path = path + ".tmp"
    with open(tmp_path, "w") as f:
        json.dump(state, f, indent=2)
    os.replace(tmp_path, path)

    return state


def delete_session(session_id: str) -> bool:
    """Delete a session."""
    session_dir = os.path.join(SESSIONS_DIR, session_id)
    if not os.path.exists(session_dir):
        raise FileNotFoundError(f"Session {session_id} not found")
    import shutil
    shutil.rmtree(session_dir)
    return True


def list_sessions() -> List[Dict]:
    """List all sessions."""
    if not os.path.exists(SESSIONS_DIR):
        return []

    sessions = []
    for d in os.listdir(SESSIONS_DIR):
        state = get_session(d)
        if state:
            sessions.append({
                "session_id": state["session_id"],
                "project_name": state["project_name"],
                "project_slug": state["project_slug"],
                "category": state["category"],
                "status": state["status"],
                "created_at": state["created_at"],
                "updated_at": state["updated_at"],
            })
    return sorted(sessions, key=lambda s: s["updated_at"], reverse=True)


# ── Claude draft (optional) ──────────────────────────────────────

def _build_draft_system_prompt() -> str:
    """Build MadLab system prompt with governance-loaded banned phrases."""
    banned = get_banned_phrases_prompt()
    return f"""You are helping Kiran Gorapalli write a prototype overview page for his portfolio site. Write like a real builder, not like AI. Casual conversational English, like explaining to a smart friend. Include first-person asides. Be honest about tradeoffs.

{banned}"""


DRAFT_SYSTEM_PROMPT = _build_draft_system_prompt()

DRAFT_USER_PROMPT = """Write content for a prototype overview page.

Project: {project_name}
Category: {category}
{extra_context}

Return a JSON object with these keys:
{{
  "tagline": "One sentence describing what this prototype does (plain, conversational)",
  "meta_description": "1-2 sentence SEO description",
  "tags": ["Tech1", "Tech2", "Tech3"],
  "glossary": [{{"term": "Term", "definition": "15-30 word plain English definition"}}],
  "details_html": "<p>1-2 paragraphs about what this prototype does and why it matters. Use <p> tags.</p>",
  "architecture_html": "<p>1-2 paragraphs about the system design. Include a <p class='key-decision'>Why X over Y?</p> aside.</p>",
  "try_it_html": "<p>Brief instructions for trying the prototype.</p>",
  "related_html": "<a href='../../madlab.html' class='related-link'><svg viewBox='0 0 24 24'><path d='M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z'></path><path d='M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'></path></svg> Back to all prototypes</a>"
}}

Keep it short and real. Each section should be 1-2 paragraphs max. Output ONLY valid JSON."""


async def draft_content(
    api_key: str,
    project_name: str,
    category: str,
    extra_context: str = "",
) -> dict:
    """Single Claude call to draft all section content."""
    from services.claude_client import create_client

    client = create_client(api_key)
    prompt = DRAFT_USER_PROMPT.format(
        project_name=project_name,
        category=category,
        extra_context=f"Additional context: {extra_context}" if extra_context else "",
    )

    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=4096,
        system=DRAFT_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.content[0].text

    # Extract JSON
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0]
    elif "```" in text:
        text = text.split("```")[1].split("```")[0]

    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        return {"error": "Could not parse Claude's response as JSON", "raw": text}


# ── HTML assembly ────────────────────────────────────────────────

def assemble_html(state: dict) -> str:
    """Build the final HTML page from template + session content."""
    template_path = os.path.join(
        os.path.dirname(__file__), "..", "templates", "madlab-template.html"
    )
    with open(template_path, "r", encoding="utf-8") as f:
        html = f.read()

    content = state["content"]
    today = datetime.now().strftime("%b %Y")

    # Build tags HTML
    tags_html = ""
    for tag in content.get("tags", []):
        tags_html += f"<span class='hero-tag'>{tag}</span>\n                "

    # Build glossary HTML
    glossary_html = ""
    for item in content.get("glossary", []):
        glossary_html += f"<div class='glossary-term'><strong>{item['term']}</strong> — {item['definition']}</div>\n            "

    replacements = {
        "{{PROJECT_TITLE}}": state["project_name"],
        "{{PROJECT_SLUG}}": state["project_slug"],
        "{{CATEGORY}}": state["category"],
        "{{META_DESCRIPTION}}": content.get("meta_description", ""),
        "{{OG_DESCRIPTION}}": content.get("meta_description", ""),
        "{{TAGLINE}}": content.get("tagline", ""),
        "{{PROJECT_STATUS}}": content.get("project_status", "Live Prototype"),
        "{{HERO_TAGS_HTML}}": tags_html.strip(),
        "{{LAUNCH_URL}}": content.get("launch_url", "index.html"),
        "{{GLOSSARY_HTML}}": glossary_html.strip(),
        "{{DETAILS_HTML}}": content.get("details_html", ""),
        "{{ARCHITECTURE_HTML}}": content.get("architecture_html", ""),
        "{{TRY_IT_HTML}}": content.get("try_it_html", ""),
        "{{RELATED_HTML}}": content.get("related_html", ""),
        "{{VERSION}}": "v1.0.0",
        "{{LAST_UPDATED}}": f"Updated {today}",
    }

    for placeholder, value in replacements.items():
        html = html.replace(placeholder, value)

    return html
