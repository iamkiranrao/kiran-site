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
from services.governance_loader import (
    DOMAIN_RULES,
    READABILITY_TARGETS,
    get_full_governance_prompt,
)

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



# Extra instructions applied only when a blog session was seeded with source
# material. Steps not listed here need no steer — the source is already in
# context from the leading message.
SEEDED_STEP_DIRECTIVES = {
    1: "Infer the most likely theme and angle from the source material and "
       "propose them, rather than asking Kiran to pick blind. He can override.",
    2: "Research AGAINST the source, not just around it. Verify its factual "
       "claims, find who has already made this argument and when, and hunt for "
       "the strongest counter-argument. Report where the source is unoriginal.",
    3: "Each option must state what it adds beyond what the source already "
       "says. Drop any option that is just the source restated.",
    4: "Ask specifically for the evidence the source lacks: which of Kiran's own "
       "decisions, numbers or outcomes make this argument his rather than generic.",
    8: "Add a check: does this post say anything the source material did not "
       "already say? If not, name what is missing.",
    11: "The source material is the first thing to check the thesis against. "
        "If the post has not moved past it, say so plainly.",
}


SOURCE_MATERIAL_FRAMING = """SOURCE MATERIAL — Kiran seeded this session with the raw material below.

Treat it as a starting substrate, not a draft and not an authority:
- Mine it for the thesis, the tensions and the vocabulary worth keeping.
- Every factual claim in it is UNVERIFIED. It does not survive into the post
  until Step 10 verifies it against a primary source.
- Never reproduce its phrasing. The post is written in Kiran's voice profile,
  not the source's.
- Where the source is generic or well-trodden, say so and push for the sharper
  version rather than restating it.

<source_material>
{source_material}
</source_material>"""


# ── Voice profile system prompt ────────────────────────────────────

def _load_voice_profile() -> str:
    """Build the voice-profile prompt section from the full profile JSON.

    Every field Kiran wrote is sent. Earlier this read seven keys and silently
    dropped the rest — including the punctuation rule that bans em dashes and
    the influence map that defines the Sinek-Grant-Noah blend step 7 is told
    to follow.
    """
    profile_path = os.path.join(CONFIG_DIR, "wordweaver-profile.json")
    if not os.path.exists(profile_path):
        return "Voice profile not loaded. Write in a warm, confident, product-leader voice."

    with open(profile_path) as f:
        profile = json.load(f)

    voice = profile.get("voice", {})
    influences = profile.get("influence_map", {})
    english = profile.get("english_standard", {})
    audience = profile.get("audience", {})
    principles = profile.get("stylistic_principles", [])
    formatting = profile.get("formatting_preferences", {})

    lines = [
        "VOICE PROFILE",
        f"Voice: {voice.get('description', '')}",
        f"Tone: {voice.get('tone', '')}",
    ]

    traits = voice.get("personality_traits", [])
    if traits:
        lines.append("")
        lines.append("Personality traits:")
        lines.extend(f"- {t}" for t in traits)

    if influences:
        lines.append("")
        lines.append("Influence map (this is what the Sinek-Grant-Noah blend means):")
        for name, detail in influences.items():
            label = name.replace("_", " ").title()
            if isinstance(detail, dict) and "what_to_borrow" in detail:
                lines.append(f"- {label}:")
                lines.extend(f"    - {b}" for b in detail.get("what_to_borrow", []))
                shows = detail.get("how_it_shows_up")
                if shows:
                    lines.append(f"    How it shows up: {shows}")
            elif isinstance(detail, dict):
                for sub, text in detail.items():
                    lines.append(f"- {sub.replace('_', ' ').title()}: {text}")
            else:
                lines.append(f"- {label}: {detail}")

    lines.append("")
    lines.append("English standard:")
    lines.append(f"- Convention: {english.get('convention', 'American English')}")
    for key in ("spelling", "british_to_american", "punctuation", "notes"):
        val = english.get(key)
        if val:
            lines.append(f"- {key.replace('_', ' ').capitalize()}: {val}")

    lines.append("")
    lines.append("Audience:")
    for key in ("description", "expertise_level", "reading_context"):
        val = audience.get(key)
        if val:
            lines.append(f"- {key.replace('_', ' ').capitalize()}: {val}")

    if principles:
        lines.append("")
        lines.append("Stylistic principles:")
        lines.extend(f"- {p}" for p in principles)

    lines.append("")
    lines.append("Formatting:")
    lines.append(
        f"- Target: ~{formatting.get('target_word_count', 1750)} words, "
        f"{formatting.get('target_reading_time_minutes', 7)} min read"
    )
    for key in ("heading_style", "paragraph_length", "use_of_quotes", "use_of_lists"):
        val = formatting.get(key)
        if val:
            lines.append(f"- {key.replace('_', ' ').capitalize()}: {val}")

    blog_target = (READABILITY_TARGETS or {}).get("blog", {})
    if blog_target.get("grade_level"):
        lines.append(f"- Readability target: grade {blog_target['grade_level']}")

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


def _build_wordweaver_system() -> str:
    """Build WordWeaver system prompt with governance-loaded domain rules.

    Returns a template string with {voice_profile} placeholder for runtime formatting.
    """
    domain = DOMAIN_RULES.get("canonical_domain", "kiranrao.ai")
    domain_note = DOMAIN_RULES.get(
        "usage_rule",
        f"Use {domain} for all canonical URLs, OG tags and JSON-LD.",
    )
    governance = get_full_governance_prompt()

    # Use concatenation to preserve {voice_profile} as a format placeholder
    return (
        "You are WordWeaver, Kiran Rao's personal content production engine. "
        "You help create polished blog posts, social media content, and thought leadership pieces.\n\n"
        "{voice_profile}\n\n"
        "Writing quality standards (non-negotiable):\n"
        "1. Lead with insight, not information\n"
        "2. Data is seasoning, not the meal\n"
        "3. Write for the smart, busy reader\n"
        "4. Every section transition should feel inevitable\n"
        "5. American English throughout\n"
        "6. The Sinek-Grant-Noah blend (start with why, back with evidence, make it human)\n"
        "7. Credibility bar: if the product leader of the company being analyzed read this, "
        "they should respect it\n\n"
        f"Kiran works in banking, product leadership, and technology. "
        f"His blog is at {domain}/blog-podcast.html.\n\n"
        f"Domain rule: the canonical domain is {domain}. {domain_note}\n\n"
        + governance
    )


WORDWEAVER_SYSTEM = _build_wordweaver_system()


BLOG_STEP_PROMPTS = {
    1: """STEP 1: Format, Theme & Angle Selection

Present the available themes and cross-cutting angles for Kiran to choose from.

Available themes: {themes}

Cross-cutting angles: {angles}

Ask Kiran:
1. Is this a one-off post or part of a series?
2. Which theme interests him?
3. Which angle should we take?

If it's a series post, mention the available series templates: Demystifying [X], Product Teardown, Product Award of the Month, The Value Gap, Signal vs. Noise, Product Decision Autopsy, The Contrarian Take, 5 Questions With.

Once Kiran has chosen, end your output with one line, exactly in this form, so
the rest of the pipeline can read the choice:
SELECTED: theme=<theme> | angle=<angle> | series=<series or none>

If he has not chosen yet, ask your questions and omit the line.""",

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

HARD RULE: You do not know Kiran's stories. Never write one for him, never
invent a scene, a meeting, a number, a colleague or a quote, and never offer a
"draft" anecdote for him to edit. A fabricated first-person story published
under his name is the single worst failure this pipeline can produce. If you
are tempted to write "something like: the quarter we..." — stop. That is the
failure.

Your job here is to interview him, not to write.

1. Name the slot. Say exactly where in the approved structure an anecdote
   belongs, what work it has to do there (open with tension, make an abstract
   point concrete, land the turn), and how long it should run.

2. Ask for the real thing. Prompt him with the kind of moment that would fit —
   the shape, not the content. For example: "a time you argued against a metric
   and lost", "a launch you slowed down", "a decision you'd make differently
   now". Ask for Situation, Task, Action, Result in rough notes. Messy is fine.

3. If he gives you one, play it back. Summarize what he said in his own facts,
   confirm you have it right, then say where it will sit and what you will cut.
   You may shape his words. You may not add events, numbers or dialogue he did
   not give you.

4. If he has no anecdote, say so plainly and offer two honest options: proceed
   without one and carry the argument on evidence instead, or pause the session
   until he has one. Do not fill the gap yourself.

End your output with one line, exactly:
ANECDOTE: SUPPLIED  — if Kiran has given you real material
ANECDOTE: NONE  — if he has not""",

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
- Include the anecdote ONLY if Step 6 ended with 'ANECDOTE: SUPPLIED'. Use only
  the facts Kiran gave; invent no events, numbers, names or dialogue. If Step 6
  ended with 'ANECDOTE: NONE', write the post without a personal story and carry
  the argument on evidence — do not substitute an invented one

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

    path = _session_path(session_id)
    tmp_path = path + ".tmp"
    with open(tmp_path, "w") as f:
        json.dump(state, f, indent=2)
    os.replace(tmp_path, path)

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
    path = _session_path(session_id)
    tmp_path = path + ".tmp"
    with open(tmp_path, "w") as f:
        json.dump(state, f, indent=2)
    os.replace(tmp_path, path)
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
    path = _session_path(session_id)
    tmp_path = path + ".tmp"
    with open(tmp_path, "w") as f:
        json.dump(state, f, indent=2)
    os.replace(tmp_path, path)
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
    path = _session_path(session_id)
    tmp_path = path + ".tmp"
    with open(tmp_path, "w") as f:
        json.dump(state, f, indent=2)
    os.replace(tmp_path, path)
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




def parse_step1_selection(content: str) -> dict:
    """Pull theme/angle/series out of step 1's trailing SELECTED: line.

    Returns {} when the line is absent or empty, so a session that skipped it
    behaves exactly as before rather than storing junk.
    """
    out = {}
    for line in reversed((content or "").splitlines()):
        line = line.strip().lstrip("*# ").strip()
        if not line.upper().startswith("SELECTED:"):
            continue
        for part in line.split(":", 1)[1].split("|"):
            if "=" not in part:
                continue
            key, _, val = part.partition("=")
            key = key.strip().lower().lstrip("*").strip()
            # Strip markdown emphasis and the <> of an unfilled placeholder.
            val = val.strip().strip("*").strip().strip("<>").strip()
            if key not in ("theme", "angle", "series"):
                continue
            # "<theme>" left as-is means the model never filled it in.
            if not val or val.lower() in ("none", "n/a", "tbd", key):
                continue
            out[key] = val
        break
    return out


# ── Web search ─────────────────────────────────────────────────────
#
# Steps 2, 10 and 11 instruct Claude to search the web. Until now no tools were
# passed, so those steps generated statistics, "Verified" statuses and
# originality findings from memory. These are the steps that get real eyes.

SEARCH_STEPS = {2, 10, 11}

# A turn with server tools can pause while searches run.
MAX_RESUMES = 8

# 1,750 words is ~2,400 tokens, and 4,096 also has to cover a thinking block.
DEFAULT_MAX_TOKENS = 8000
STEP_MAX_TOKENS = {2: 16000, 7: 16000, 10: 12000, 11: 12000, 12: 16000}

# max_uses is per request. Research ranges wider than verification does.
SEARCH_BUDGET = {2: 10, 10: 12, 11: 8}


def _web_search_tool(step: int) -> list:
    return [{
        "type": "web_search_20260209",
        "name": "web_search",
        "max_uses": SEARCH_BUDGET.get(step, 8),
    }]


def _summarize_search_activity(content) -> dict:
    """Count searches and surface any the API returned as errors.

    Server-tool failures come back as HTTP 200 with an error object in the
    result block rather than raising, so they are easy to miss. A step that
    searched zero times is a step that did not verify anything.
    """
    searches, errors = 0, []
    for block in content or []:
        btype = getattr(block, "type", None)
        if btype == "server_tool_use":
            searches += 1
        elif btype == "web_search_tool_result":
            inner = getattr(block, "content", None)
            # Success is a list of results; an error is a single object.
            code = getattr(inner, "error_code", None)
            if code:
                errors.append(code)
    return {"searches": searches, "errors": errors}


# ── Claude interaction ─────────────────────────────────────────────

def build_step_messages(
    state: dict,
    step: int,
    user_input: Optional[str] = None,
    include_draft: bool = False,
) -> List[Dict]:
    """Build message history for a Claude API call.

    include_draft puts this step's existing draft in front of the model. Without
    it a revision is not a revision: only approved steps are carried forward, so
    Claude never saw the text it was being asked to change and rewrote from
    scratch instead.
    """
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
    source_material = (config.get("source_material") or "").strip()

    # A seeded session leads with its source material so every step can see it.
    if source_material:
        messages.insert(0, {
            "role": "user",
            "content": SOURCE_MATERIAL_FRAMING.format(source_material=source_material),
        })

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

    if source_material and state["mode"] == "blog":
        directive = SEEDED_STEP_DIRECTIVES.get(step)
        if directive:
            prompt = f"{prompt}\n\nSEEDED SESSION: {directive}"

    if include_draft:
        draft = (state["steps"].get(str(step)) or {}).get("content", "").strip()
        if draft:
            messages.append({
                "role": "assistant",
                "content": f"[Step {step} - current draft]\n\n{draft}",
            })
            prompt = (
                "Revise the draft above. Keep everything that works and change only "
                "what the feedback calls for — this is an edit, not a rewrite. "
                "Return the complete revised version.\n\n" + prompt
            )

    if user_input:
        prompt = f"{prompt}\n\nKiran's input: {user_input}"

    messages.append({"role": "user", "content": prompt})
    return messages


async def run_step_stream(
    session_id: str,
    step: int,
    api_key: str,
    user_input: Optional[str] = None,
    include_draft: bool = False,
):
    """Stream a step via Claude SSE.

    Steps 2, 10 and 11 get the web search tool. Those turns can pause while
    searches run, so the request is resumed until the model finishes.
    """
    from services.claude_client import create_client

    state = get_session(session_id)
    if not state:
        raise FileNotFoundError(f"Session {session_id} not found")

    voice_profile = _load_voice_profile()
    system_prompt = WORDWEAVER_SYSTEM.format(voice_profile=voice_profile)

    client = create_client(api_key)
    convo = build_step_messages(state, step, user_input, include_draft=include_draft)

    searching = state["mode"] == "blog" and step in SEARCH_STEPS
    tools = _web_search_tool(step) if searching else None
    max_tokens = STEP_MAX_TOKENS.get(step, DEFAULT_MAX_TOKENS)

    if searching:
        yield json.dumps({
            "type": "search_start",
            "step": step,
            "max_uses": SEARCH_BUDGET.get(step, 8),
        })

    full_content = ""
    totals = {"searches": 0, "errors": []}

    # A turn using server tools can come back as pause_turn; resume it until done.
    for _ in range(MAX_RESUMES):
        kwargs = {
            "model": CLAUDE_MODEL,
            "max_tokens": max_tokens,
            "system": system_prompt,
            "messages": convo,
        }
        if tools:
            kwargs["tools"] = tools

        with client.messages.stream(**kwargs) as stream:
            for text in stream.text_stream:
                full_content += text
                yield json.dumps({"type": "text_delta", "delta": text})
            final = stream.get_final_message()

        activity = _summarize_search_activity(final.content)
        totals["searches"] += activity["searches"]
        totals["errors"].extend(activity["errors"])

        if final.stop_reason != "pause_turn":
            break

        convo = convo + [{"role": "assistant", "content": final.content}]
    else:
        yield json.dumps({
            "type": "warning",
            "message": f"Step {step} paused more than {MAX_RESUMES} times and was cut short.",
        })

    if searching:
        yield json.dumps({
            "type": "search_complete",
            "step": step,
            "searches": totals["searches"],
            "errors": totals["errors"],
        })
        if totals["searches"] == 0:
            # Nothing was looked up, so nothing in this step is verified.
            yield json.dumps({
                "type": "warning",
                "message": (
                    f"Step {step} ran no web searches. Treat its output as unverified "
                    f"and re-run before relying on it."
                ),
            })

    save_step_result(session_id, step, full_content, status="draft")

    yield json.dumps({
        "type": "step_complete",
        "step": step,
        "label": (BLOG_STEPS if state["mode"] == "blog" else SOCIAL_STEPS)[step - 1]["label"],
        "searches": totals["searches"] if searching else None,
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

    tmp_path = themes_path + ".tmp"
    with open(tmp_path, "w") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp_path, themes_path)

    return {"added": name, "total": len(data["themes"])}


def remove_theme(name: str) -> dict:
    """Remove a theme by name."""
    themes_path = os.path.join(CONFIG_DIR, "wordweaver-themes.json")
    with open(themes_path) as f:
        data = json.load(f)

    original_count = len(data["themes"])
    data["themes"] = [t for t in data["themes"] if t["name"] != name]
    data["last_updated"] = datetime.now().isoformat()

    tmp_path = themes_path + ".tmp"
    with open(tmp_path, "w") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp_path, themes_path)

    removed = original_count - len(data["themes"])
    return {"removed": name, "found": removed > 0, "total": len(data["themes"])}
