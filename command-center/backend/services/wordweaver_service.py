"""
WordWeaver Service — Content production engine with 4 modes.

Mode 1 — Blog Workflow: 12-step interactive pipeline (theme → published post)
Mode 2 — Social Post Workflow: 5-step visual-first social content
Mode 3 — Series Management: CRUD for series templates
Mode 4 — Theme Management: CRUD for themes in wordweaver-themes.json

Like the Teardown Builder, this is session-based and interactive.
Each step requires Kiran's approval before advancing.
"""

import json
import os
import uuid
import tempfile
from datetime import datetime
from typing import Optional, List, Dict

from utils.config import CLAUDE_MODEL, data_dir
SESSIONS_DIR = data_dir("wordweaver")
CONFIG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config")


# ── Blog pipeline steps ────────────────────────────────────────────

BLOG_STEPS = [
    {"step": 1, "label": "Format, Theme & Angle", "description": "Choose one-off or series, pick theme and cross-cutting angle"},
    {"step": 2, "label": "Live Web Research", "description": "Run 3-5 web searches for stats, studies, examples, counter-arguments"},
    {"step": 3, "label": "Topic Options", "description": "Present 3-5 topic options with titles, hypotheses, data hooks"},
    {"step": 4, "label": "Refinement Questions", "description": "Sharpening questions about audience, anecdotes, contrarian level"},
    {"step": 5, "label": "Structure & Format", "description": "Design post structure with sections, word counts, narrative arc"},
    {"step": 6, "label": "Anecdote Workshop", "description": "Present 2-3 anecdote options that fit the narrative arc"},
    {"step": 7, "label": "Write the Post", "description": "Full blog post following voice profile, ~1,750 words"},
    {"step": 8, "label": "Editorial Filter", "description": "Quality gate: insight, position, section value, reputation risk scan"},
    {"step": 9, "label": "Visual Assets", "description": "Propose 1-3 SVG visuals (data viz or conceptual diagrams)"},
    {"step": 10, "label": "Fact-Check", "description": "Verify every data point against primary sources"},
    {"step": 11, "label": "Originality Check", "description": "Plagiarism scan, thesis originality, voice distinctiveness"},
    {"step": 12, "label": "Output & Package", "description": "Generate post.md, post.docx, preview HTML, and visuals"},
]

SOCIAL_STEPS = [
    {"step": 1, "label": "Source & Format", "description": "Standalone or derived? Platform? Format (single, carousel, quote)?"},
    {"step": 2, "label": "Concept Options", "description": "Present 3 visual concepts with insights and captions"},
    {"step": 3, "label": "Create Visual", "description": "Generate SVG at correct dimensions with Style B"},
    {"step": 4, "label": "Caption & Copy", "description": "Full caption, hashtags, and alt text"},
    {"step": 5, "label": "Output", "description": "SVG files and caption markdown"},
]


# ── Voice profile system prompt ────────────────────────────────────

def _load_voice_profile() -> str:
    """Load the voice profile JSON and build a system prompt section."""
    profile_path = os.path.join(CONFIG_DIR, "wordweaver-profile.json")
    if not os.path.exists(profile_path):
        return "Voice profile not loaded. Write in a warm, confident, product-leader voice."

    with open(profile_path) as f:
        profile = json.load(f)

    voice = profile.get("voice", {})
    english = profile.get("english_standard", {})
    audience = profile.get("audience", {})
    principles = profile.get("stylistic_principles", [])
    formatting = profile.get("formatting_preferences", {})

    lines = [
        f"Voice: {voice.get('description', '')}",
        f"Tone: {voice.get('tone', '')}",
        f"English standard: {english.get('convention', 'American English')} — {english.get('spelling', '')}",
        f"Audience: {audience.get('description', '')}",
        f"Expertise level: {audience.get('expertise_level', '')}",
        f"Target: ~{formatting.get('target_word_count', 1750)} words, {formatting.get('target_reading_time_minutes', 7)} min read",
        "",
        "Stylistic principles:",
    ]
    for p in principles:
        lines.append(f"- {p}")

    return "\n".join(lines)


def _load_themes() -> dict:
    """Load themes and angles from config."""
    themes_path = os.path.join(CONFIG_DIR, "wordweaver-themes.json")
    if not os.path.exists(themes_path):
        return {"themes": [], "angles": []}

    with open(themes_path) as f:
        data = json.load(f)

    return {
        "themes": [t["name"] for t in data.get("themes", [])],
        "angles": data.get("cross_cutting_angles", []),
        "full": data,
    }


WORDWEAVER_SYSTEM = """You are WordWeaver, Kiran Gorapalli's personal content production engine. You help create polished blog posts, social media content, and thought leadership pieces.

{voice_profile}

Writing quality standards (non-negotiable):
1. Lead with insight, not information
2. Data is seasoning, not the meal
3. Write for the smart, busy reader
4. Every section transition should feel inevitable
5. American English throughout
6. The Sinek-Grant-Noah blend (start with why, back with evidence, make it human)
7. Credibility bar: if the product leader of the company being analyzed read this, they should respect it

Kiran works in banking, product leadership, and technology. His blog is at kirangorapalli.com/blog-podcast.html.

Domain rule: the canonical domain is kirangorapalli.com. Never use kirangorapalli.com in any user-facing content, OG tags, canonical URLs, or JSON-LD."""


BLOG_STEP_PROMPTS = {
    1: """STEP 1: Format, Theme & Angle Selection

Present the available themes and cross-cutting angles for Kiran to choose from.

Available themes: {themes}

Cross-cutting angles: {angles}

Ask Kiran:
1. Is this a one-off post or part of a series?
2. Which theme interests him?
3. Which angle should we take?

If it's a series post, mention the available series templates: Demystifying [X], Product Teardown, Product Award of the Month, The Value Gap, Signal vs. Noise, Product Decision Autopsy, The Contrarian Take, 5 Questions With.""",

    2: """STEP 2: Live Web Research

Based on the selected theme ({theme}) and angle ({angle}), run comprehensive research:
- Search for current statistics and recent studies (2024-2026)
- Find real-world examples and case studies
- Identify counter-arguments and contrarian viewpoints
- Look for timeliness hooks (recent launches, announcements, trends)

Compile your findings as a research brief. Include sources for every data point.

Present the research and note any gaps or areas where data is limited.""",

    3: """STEP 3: Topic Options

Based on the research, present 3-5 topic options. For each:
- Working title (compelling, specific — not generic)
- Hypothesis/viewpoint angle (the position the post will take)
- 2-3 key data points that support it
- Timeliness hook (why now?)

Ask Kiran to pick one or suggest a different direction.""",

    4: """STEP 4: Refinement Questions

Now that Kiran has picked a topic, ask 3-5 sharpening questions:
- "What's the one thing you want readers to do differently after reading this?"
- "Is there a personal anecdote from your banking/product experience that connects?"
- "How contrarian do you want to be? Safe-but-insightful or challenge-the-orthodoxy?"
- "Any specific companies or products you want to reference (or explicitly avoid)?"
- "Who's the one person you imagine reading this?"

Wait for answers before proceeding.""",

    5: """STEP 5: Structure & Format Design

Design the post structure:
- Narrative arc (what's the emotional journey?)
- 4-7 sections with compelling headers
- Estimated word count per section (total ~1,750 words)
- Opening hook strategy (surprising fact, tension, reframing question, or human moment?)
- Data placement plan (which sections get which stats?)
- Closing move (callback close, provocative question, or forward-looking statement?)

Present the structure with section headers and word counts for Kiran's approval.""",

    6: """STEP 6: Personal Anecdote Workshop

Present 2-3 anecdote options that fit the narrative arc. For each:
- The moment (a specific scene, 80-150 words)
- Where it fits in the structure
- The emotional beat it hits
- The bridge back to the argument

Anecdotes should be first-person, draw from banking/product/technology experience, and feel real. One emotional note per anecdote.

Ask Kiran to pick one or share a real anecdote to use.""",

    7: """STEP 7: Write the Post

Write the full blog post following:
- Approved structure from Step 5
- Voice profile (Sinek-Grant-Noah blend)
- American English throughout
- ~1,750 words / 7 min read
- Hook within first 100 words
- Data woven conversationally (not academically)
- Every paragraph earns its place
- Vary sentence rhythm
- Include the chosen anecdote from Step 6

Output as clean markdown with section headers.""",

    8: """STEP 8: Editorial Filter

Run these quality checks against the draft:

1. Would a smart practitioner learn something they didn't already know?
2. Does it take a clear position, or does it hedge? (Scan for weasel phrases: "might", "could potentially", "it's possible that")
3. Does every section earn its place? (Flag any section that could be removed without loss)
4. Reputation Risk Scan: If the post discusses specific companies, read every claim through the eyes of an employee or executive there. Flag anything that could be perceived as unfair, could burn a professional bridge, could be taken out of context, or attributes motives without evidence.

Present findings and any recommended revisions.""",

    9: """STEP 9: Visual Assets

Propose 1-3 visuals for the post:
- Data visualisations (stat callout, comparison bar, trend line, 2x2 matrix)
- Conceptual diagrams (process flow, before/after split)

For each visual, describe:
- What data/concept it shows
- Style (Clean & Minimal for blog, Hand-Drawn Editorial for social)
- Where it fits in the post
- A rough description of the SVG layout

Ask Kiran which visuals to include.""",

    10: """STEP 10: Fact-Check

Verify every data point in the post against primary sources via web search.

Present a verification table:
| Claim | Source | Status |
|-------|--------|--------|

Status options: Verified, Corrected (with correction), Removed (with reason), Unverifiable (with note).

All verified posts include a Sources section at the bottom.""",

    11: """STEP 11: Originality & Plagiarism Check

Three-layer check:
1. Search for distinctive phrases from the post — flag any that appear verbatim elsewhere
2. Search for the core thesis — check if the argument has been made before. If so, how does ours differ?
3. Read against voice profile — does this sound like Kiran or like generic thought leadership?

Standard: if someone reads this AND the closest existing piece, do they learn something new from ours?

Present findings and any recommended changes.""",

    12: """STEP 12: Output & Package

Generate the final deliverables:
1. post.md — with YAML frontmatter (title, date, author, theme, angle, series, reading_time, word_count)
2. Markdown content of the finalized post
3. Sources section

Confirm the output package is ready for Kiran's final review.

Note: The actual file generation (docx, HTML preview) will be handled by the output pipeline after approval.""",
}


# ── Session management (shared pattern with teardown) ──────────────

def _session_path(session_id: str) -> str:
    return os.path.join(SESSIONS_DIR, session_id, "state.json")


def create_session(mode: str, initial_data: Optional[dict] = None) -> dict:
    """Create a new WordWeaver session."""
    session_id = str(uuid.uuid4())[:8]
    session_dir = os.path.join(SESSIONS_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)

    steps = BLOG_STEPS if mode == "blog" else SOCIAL_STEPS
    total_steps = len(steps)

    state = {
        "session_id": session_id,
        "mode": mode,
        "current_step": 1,
        "total_steps": total_steps,
        "status": "in_progress",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "config": initial_data or {},
        "steps": {},
        "decisions": {},
    }

    with open(_session_path(session_id), "w") as f:
        json.dump(state, f, indent=2)

    return state


def get_session(session_id: str) -> Optional[dict]:
    path = _session_path(session_id)
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f)


def update_session(session_id: str, updates: dict) -> dict:
    state = get_session(session_id)
    if not state:
        raise FileNotFoundError(f"Session {session_id} not found")
    state.update(updates)
    state["updated_at"] = datetime.now().isoformat()
    with open(_session_path(session_id), "w") as f:
        json.dump(state, f, indent=2)
    return state


def save_step_result(session_id: str, step: int, content: str, status: str = "draft") -> dict:
    state = get_session(session_id)
    if not state:
        raise FileNotFoundError(f"Session {session_id} not found")

    state["steps"][str(step)] = {
        "content": content,
        "status": status,
        "updated_at": datetime.now().isoformat(),
    }

    if status == "approved":
        state["current_step"] = min(step + 1, state["total_steps"])

    state["updated_at"] = datetime.now().isoformat()
    with open(_session_path(session_id), "w") as f:
        json.dump(state, f, indent=2)
    return state


def save_decision(session_id: str, step: int, decision: str) -> dict:
    state = get_session(session_id)
    if not state:
        raise FileNotFoundError(f"Session {session_id} not found")
    state["decisions"][str(step)] = {
        "decision": decision,
        "decided_at": datetime.now().isoformat(),
    }
    state["updated_at"] = datetime.now().isoformat()
    with open(_session_path(session_id), "w") as f:
        json.dump(state, f, indent=2)
    return state


def list_sessions() -> List[Dict]:
    if not os.path.exists(SESSIONS_DIR):
        return []
    sessions = []
    for d in os.listdir(SESSIONS_DIR):
        state = get_session(d)
        if state:
            sessions.append({
                "session_id": state["session_id"],
                "mode": state["mode"],
                "current_step": state["current_step"],
                "total_steps": state["total_steps"],
                "status": state["status"],
                "config": state.get("config", {}),
                "created_at": state["created_at"],
                "updated_at": state["updated_at"],
            })
    return sorted(sessions, key=lambda s: s["updated_at"], reverse=True)


# ── Claude interaction ─────────────────────────────────────────────

def build_step_messages(state: dict, step: int, user_input: Optional[str] = None) -> List[Dict]:
    """Build message history for a Claude API call."""
    messages = []

    # Carry forward approved steps as context
    for s in range(1, step):
        step_data = state["steps"].get(str(s))
        if step_data and step_data["status"] == "approved":
            messages.append({
                "role": "assistant",
                "content": f"[Step {s} - Approved]\n\n{step_data['content']}"
            })
            decision = state["decisions"].get(str(s))
            if decision:
                messages.append({
                    "role": "user",
                    "content": decision["decision"],
                })

    # Build the step prompt
    config = state.get("config", {})
    theme_data = _load_themes()

    if state["mode"] == "blog":
        prompt_template = BLOG_STEP_PROMPTS.get(step, "Continue with the next step.")
        prompt = prompt_template.format(
            themes=", ".join(theme_data["themes"]),
            angles=", ".join(theme_data["angles"]),
            theme=config.get("theme", "not yet selected"),
            angle=config.get("angle", "not yet selected"),
        )
    else:
        # Social workflow — simpler prompts
        prompt = f"SOCIAL STEP {step}: {SOCIAL_STEPS[step - 1]['label']}\n\n{SOCIAL_STEPS[step - 1]['description']}"

    if user_input:
        prompt = f"{prompt}\n\nKiran's input: {user_input}"

    messages.append({"role": "user", "content": prompt})
    return messages


async def run_step_stream(
    session_id: str,
    step: int,
    api_key: str,
    user_input: Optional[str] = None,
):
    """Stream a step via Claude SSE."""
    from services.claude_client import create_client

    state = get_session(session_id)
    if not state:
        raise FileNotFoundError(f"Session {session_id} not found")

    voice_profile = _load_voice_profile()
    system_prompt = WORDWEAVER_SYSTEM.format(voice_profile=voice_profile)

    client = create_client(api_key)
    messages = build_step_messages(state, step, user_input)

    full_content = ""

    with client.messages.stream(
        model=CLAUDE_MODEL,
        max_tokens=4096,
        system=system_prompt,
        messages=messages,
    ) as stream:
        for text in stream.text_stream:
            full_content += text
            yield json.dumps({"type": "text_delta", "delta": text})

    save_step_result(session_id, step, full_content, status="draft")

    yield json.dumps({
        "type": "step_complete",
        "step": step,
        "label": (BLOG_STEPS if state["mode"] == "blog" else SOCIAL_STEPS)[step - 1]["label"],
    })


# ── Theme & Series management ─────────────────────────────────────

def get_themes() -> dict:
    """Return themes and angles."""
    return _load_themes()


def add_theme(name: str, description: str) -> dict:
    """Add a new theme."""
    themes_path = os.path.join(CONFIG_DIR, "wordweaver-themes.json")
    with open(themes_path) as f:
        data = json.load(f)

    data["themes"].append({
        "name": name,
        "description": description,
        "subcategories": [],
        "added_on": datetime.now().isoformat(),
    })
    data["last_updated"] = datetime.now().isoformat()

    with open(themes_path, "w") as f:
        json.dump(data, f, indent=2)

    return {"added": name, "total": len(data["themes"])}


def remove_theme(name: str) -> dict:
    """Remove a theme by name."""
    themes_path = os.path.join(CONFIG_DIR, "wordweaver-themes.json")
    with open(themes_path) as f:
        data = json.load(f)

    original_count = len(data["themes"])
    data["themes"] = [t for t in data["themes"] if t["name"] != name]
    data["last_updated"] = datetime.now().isoformat()

    with open(themes_path, "w") as f:
        json.dump(data, f, indent=2)

    removed = original_count - len(data["themes"])
    return {"removed": name, "found": removed > 0, "total": len(data["themes"])}
