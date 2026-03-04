"""
Teardown Co-Creation Service — Orchestrates the 8-step teardown workflow.

This is an INTERACTIVE workflow, not a fully automated pipeline. Each step:
1. Claude does research + drafts content
2. Presents findings to Kiran
3. Kiran approves/revises before moving on

The workflow is session-based. Each teardown gets a unique session ID and
its state is persisted to disk so we can resume across requests.

Steps:
1. Real User Pain Points — research + cluster into 4-6 pain points
2. Persona & Journey Map — draft persona + journey map
3. JTBD Framework — frame jobs-to-be-done
4. Keep / Kill / Build — evidence-based KKB grid
5. Redesign & Wireframes — SVG wireframes with annotations
6. Business Case & KPIs — impact sizing + metrics
7. PM Score & Stress Test — final quality check
8. AI-Detection Sweep — full anti-AI pass + HTML generation
"""

import json
import os
import uuid
from datetime import datetime
from typing import Optional, List, Dict

SESSIONS_DIR = "/tmp/command-center/teardowns"


# ── Step definitions ──────────────────────────────────────────────

STEPS = [
    {"step": 1, "label": "Real User Pain Points", "description": "Research app store reviews, public sentiment, identify 4-6 pain point clusters"},
    {"step": 2, "label": "Persona & Journey Map", "description": "Draft persona grounded in selected clusters + journey map stages"},
    {"step": 3, "label": "JTBD Framework", "description": "Frame jobs-to-be-done around verified user needs"},
    {"step": 4, "label": "Keep / Kill / Build", "description": "Evidence-based KKB grid with citations"},
    {"step": 5, "label": "Redesign & Wireframes", "description": "Proposed changes with SVG wireframes and annotations"},
    {"step": 6, "label": "Business Case & KPIs", "description": "Realistic impact sizing with defensible numbers"},
    {"step": 7, "label": "PM Score & Stress Test", "description": "Score out of 10, verify all claims, patch weak spots"},
    {"step": 8, "label": "AI-Detection Sweep & Content", "description": "Full anti-AI pass, generate final content fragments for template"},
]


# ── Claude system prompts per step ────────────────────────────────

TEARDOWN_SYSTEM_PROMPT = """You are helping Kiran Gorapalli build a product teardown page for his portfolio site at kirangorapalli.com. This is a co-creation process: you do the research and drafting, Kiran makes the decisions. The teardown must sound like a real PM wrote it, not like AI generated it. His credibility is on the line.

Critical anti-AI rules (apply to EVERY word):
- Asymmetric structure: KKB counts, journey stages, KPI counts must ALL differ from existing teardowns
- First-person asides: 3-4 per teardown minimum ("I spent two hours on this...")
- Dead ends: Show at least one angle explored and discarded
- Casual conversational English: like explaining to a smart friend, NOT consultant-speak
- Vary sentence length: mix short punchy with longer reasoning
- Specific persona: named, aged, with a story
- Selective citations: source important claims, don't over-cite
- Honest unknowns: name what data is missing and where you looked
- BANNED phrases: "Let's dive in", "Here's the thing", "It's worth noting", "compelling", "robust", "leverage"

No per-section help icons or explainer panels:
- Do NOT generate any explainer-icon markup, data-explainer-* attributes, or slide panel content
- Do NOT create structured help blocks (Key Concepts, My Take, Why It's Here, etc.) as data attributes
- DO generate a per-page glossary section at the TOP of the page (after hero, before first content section)
- The glossary defines only terms relevant to THIS teardown that a smart reader in a different field wouldn't know
- 15-30 words per term, plain English, frame technical choices as product decisions
- If a term is already explained inline in the prose, don't also put it in the glossary
- No fixed number of terms — include what's needed, don't pad or cut

Previous teardowns for asymmetry reference:
- Instagram: 5-stage journey, 2/3/3 KKB split, narrative business case, 4 KPIs
- GEICO: 5-stage journey, 2/2/3 KKB split, numbers-driven business case, 5 KPIs
This new teardown MUST use different counts for all of the above."""


STEP_PROMPTS = {
    1: """STEP 1: Real User Pain Points

Research the {company} {product} using:
- App store reviews (iOS + Android) from the LAST TWO YEARS only
- Trustpilot, G2, Reddit, and other public review sites (last 2 years)
- Published user research, ACSI data, public sentiment (last 2 years)
- News articles and industry analysis (last 2 years)

IMPORTANT: Only use data, reviews, and sources from the last 2 years. Older complaints may no longer be relevant if the product has changed. If citing a source, include the date or year.

Organize findings into 4-6 NUMBERED pain point clusters. For each cluster:
- Number each cluster (1, 2, 3, etc.)
- Name the cluster clearly
- Provide 3-5 specific data points with sources and dates
- Note the volume/severity of complaints
- Include direct quotes where available

STRATEGIC PAIN POINTS: Some pain points are well-known but exist because the company has a strategic or revenue reason to keep them (e.g., Intuit gating live support behind paid tiers, or airlines charging for seat selection). These are deliberate business decisions, not product gaps the company failed to notice. For these:
- Still list them briefly so Kiran knows you found them
- Flag them clearly as "Strategic/Revenue-driven — not recommended for focus"
- Explain WHY the company likely keeps it this way (the business incentive)
- Do NOT recommend these as clusters to build the teardown around
Focus the recommended clusters on pain points that represent genuine product gaps — problems the company would likely want to fix if they saw the data.

End by asking Kiran which 2-3 clusters he wants to build the teardown around.

Format your response as clear, readable analysis (not bullet-point lists). Use conversational language.""",

    2: """STEP 2: Persona & Journey Map

Based on the selected pain point clusters, draft:

**Persona:**
- A specific, named person with age, context, and a story
- Ground them in the selected clusters
- Include "How I identified this persona" explanation
- Make the persona feel like a real person, not a demographic profile

**Journey Map:**
- Stages should vary (NOT always 5 — could be 4, 6, or 7 depending on the product)
- One stage should get MORE space because that's where the story is
- Each stage: action, inner thought (real inner monologue like "ugh, not this again"), pain point
- Thoughts should be casual and human, not grammatically perfect sentences

Present both and ask Kiran for approval/adjustments.

Remember: this must be DIFFERENT from Instagram (5 stages) and GEICO (5 stages) in structure.""",

    3: """STEP 3: JTBD Framework

Frame jobs-to-be-done around verified user needs from Step 1:
- Core Job: one clear sentence capturing what the user is trying to do
- Supporting Jobs: 2-3 secondary jobs
- The Gap: where the current product fails to deliver

Include a first-person aside about your framing process ("I initially framed this around X but...")

Credibility check: ensure every job is grounded in real behavior from the research, not speculation.

Present for Kiran's approval.""",

    4: """STEP 4: Keep / Kill / Build

Create the KKB grid. Critical rules:
- Every Kill must trace back to real user feedback from Step 1 with citation
- Keep items should be genuine positives, not faint praise
- Build items should have real-world precedent from competitor decisions
- KKB split MUST be different from Instagram (2/3/3) and GEICO (2/2/3)
- Include first-person asides (e.g., "I almost didn't include this one, but...")

For each item, provide:
- A clear title/description
- Evidence and source citations where appropriate
- Why it matters

Present the full KKB for Kiran's approval.""",

    5: """STEP 5: Redesign & Wireframes

Propose specific changes with descriptions for SVG wireframes:
- Each wireframe needs annotations that sound conversational (like explaining to a friend)
- Include at least one "before/after" concept where modifying an existing screen
- Reference real competitor decisions as precedent

Describe each wireframe in detail so it can be converted to SVG later:
- What the screen shows
- Key UI elements and their placement
- Annotation text and positions
- Which elements are highlighted/changed

Remember SVG rules: all class names prefixed with wf-, no :root overrides, max-width 340px.

Present wireframe descriptions for Kiran's approval.""",

    6: """STEP 6: Business Case & KPIs

Build the business case with:
- Realistic impact sizing with defensible numbers (cite sources!)
- The format MUST differ from Instagram (narrative) and GEICO (numbers-driven)
- KPI count MUST differ from Instagram (4) and GEICO (5)
- "What I can't measure" section naming specific missing data and where you looked
- Honest unknowns and limitations

Counter-arguments: include at least one strong PM pushback and engage with it genuinely.

Present for Kiran's approval.""",

    7: """STEP 7: PM Score & Stress Test

Rate the teardown out of 10 from a PM perspective:
- Identify the 3 weakest spots
- Suggest specific patches for each
- Re-verify every factual claim against current sources
- Flag any claims that feel speculative or unverifiable

Present the score, weak spots, and proposed patches for Kiran's approval.""",

    8: """STEP 8: AI-Detection Sweep & Final HTML Page

PART A — Run the full AI-detection checklist against the complete teardown:

Structure Tests:
- Symmetry break from other teardowns?
- Item count varies across KKB?
- Section lengths uneven (content-driven, not uniform)?

Voice Tests:
- First-person asides present (3-4 minimum)?
- Dead ends shown?
- Sentence length varies?
- User thoughts sound human?

Content Tests:
- Persona has name and specific details?
- Uneven depth?
- Honest unknowns are specific?
- Source citations selective?

Help Content Test:
- NO explainer-icon markup anywhere in the output
- NO data-explainer-* attributes on any HTML element
- NO structured help panels (Key Concepts, My Take, Why It's Here, What to Look For)
- Per-page glossary section present at the TOP (after hero, before first content section)?
- Glossary only contains terms relevant to THIS teardown?
- No glossary term duplicates what the prose already explains?
- Each definition is 15-30 words, plain English?

Flag any violations and suggest remediations.

PART B — Generate content fragments as JSON.

IMPORTANT: Do NOT generate a complete HTML page. The backend has a canonical HTML template with all CSS, navigation, footer, and scripts already defined. You only need to provide the CONTENT that fills the template placeholders.

Output a JSON object with these keys (all values are HTML fragment strings — use the EXACT class names shown):

{{
  "title": "{product} Product Teardown",
  "tagline": "One-line tagline for the hero section",
  "og_description": "Meta description for SEO (1-2 sentences)",
  "glossary_items": "<div class=\\"glossary-term\\"><strong>Term</strong> — Definition.</div>\\n...",
  "persona_name": "Full Name",
  "persona_demographics": "Age, role, location, context",
  "persona_bio": "2-3 sentences about this persona.",
  "discovery_paragraphs": "<p>Paragraph content...</p>\\n<p>More paragraphs...</p>",
  "journey_sentiment_svg": "<svg viewBox=\\"0 0 800 200\\" ...>sentiment curve with cubic bezier C commands, three reference lines (Optimistic/Neutral/Frustrated)</svg>",
  "journey_stages": "<div class=\\"journey-stage-card\\"><div class=\\"stage-label\\">Stage Name</div><div class=\\"stage-action\\">What user does</div><div class=\\"stage-thought\\">Inner monologue in quotes</div><div class=\\"stage-pain\\"><span class=\\"stage-pain-label\\">Pain: </span>The pain point</div></div>\\n... (repeat for each stage)",
  "jtbd_text": "When [situation], I want to [motivation], so I can [outcome].",
  "kkb_keep_items": "<div class=\\"kkb-item\\"><div class=\\"kkb-item-title\\">Feature</div><div class=\\"kkb-item-detail\\">Why keep it.</div></div>\\n...",
  "kkb_kill_items": "<div class=\\"kkb-item\\"><div class=\\"kkb-item-title\\">Feature</div><div class=\\"kkb-item-detail\\">Why kill it with citation.</div></div>\\n...",
  "kkb_build_items": "<div class=\\"kkb-item\\"><div class=\\"kkb-item-title\\">Feature</div><div class=\\"kkb-item-detail\\">What to build and precedent.</div></div>\\n...",
  "kkb_intro_paragraphs": "<p>Intro to KKB section...</p>",
  "redesign_intro_paragraphs": "<p>Intro to the redesign...</p>",
  "wireframe_pairs": "<div class=\\"wireframe-pair\\"><div class=\\"wireframe-label\\">Wireframe Title</div><div class=\\"wireframe-box\\"><div class=\\"wireframe-box-label\\">Before / After</div><svg viewBox=\\"0 0 340 500\\" ...>SVG with wf- prefixed classes only</svg></div><div class=\\"wireframe-caption\\">Explanation.</div></div>\\n...",
  "exec_summary": "One paragraph executive summary.",
  "kpi_cards": "<div class=\\"kpi-card\\"><div class=\\"kpi-funnel-stage\\">Stage</div><div class=\\"kpi-metric\\">+X%</div><div class=\\"kpi-name\\">Name</div><div class=\\"kpi-rationale\\">Rationale.</div></div>\\n...",
  "business_case_paragraphs": "<p>Business case body...</p>",
  "assumptions_text": "Assumptions and limitations text.",
  "product_description": "1-2 sentence product description.",
  "glance_stats": "<div><div class=\\"glance-stat-label\\">Label</div><div class=\\"glance-stat-value\\">Value</div></div>\\n... (4 stats)",
  "competitor_tags": "<span class=\\"glance-competitor-tag\\">Competitor</span>\\n...",
  "leads_text": "<p>Where the product leads...</p>",
  "lags_text": "<p>Where the product lags...</p>"
}}

SVG RULES for wireframes:
- All class names MUST use "wf-" prefix (wf-annotation-dot, wf-annotation-line, wf-annotation-box, wf-annotation-box-green)
- Max width 340px for wireframe SVGs
- Annotation text must be wrapped in callout rect boxes
- No :root overrides

OUTPUT FORMAT: First output the audit results from Part A (briefly). Then output a separator "---JSON-START---" followed by the JSON object. Everything after ---JSON-START--- must be valid JSON.""",
}


# ── Session management ─────────────────────────────────────────────

def _session_path(session_id: str) -> str:
    return os.path.join(SESSIONS_DIR, session_id, "state.json")


def create_session(company: str, product: str) -> dict:
    """Create a new teardown session."""
    session_id = str(uuid.uuid4())[:8]
    session_dir = os.path.join(SESSIONS_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)

    state = {
        "session_id": session_id,
        "company": company,
        "product": product,
        "current_step": 1,
        "status": "in_progress",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "steps": {},
        "decisions": {},
    }

    with open(_session_path(session_id), "w") as f:
        json.dump(state, f, indent=2)

    return state


def get_session(session_id: str) -> Optional[dict]:
    """Load a session from disk."""
    path = _session_path(session_id)
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f)


def update_session(session_id: str, updates: dict) -> dict:
    """Update a session's state."""
    state = get_session(session_id)
    if not state:
        raise FileNotFoundError(f"Session {session_id} not found")

    state.update(updates)
    state["updated_at"] = datetime.now().isoformat()

    with open(_session_path(session_id), "w") as f:
        json.dump(state, f, indent=2)

    return state


def save_step_result(session_id: str, step: int, content: str, status: str = "draft") -> dict:
    """Save the output of a step."""
    state = get_session(session_id)
    if not state:
        raise FileNotFoundError(f"Session {session_id} not found")

    state["steps"][str(step)] = {
        "content": content,
        "status": status,
        "updated_at": datetime.now().isoformat(),
    }

    if status == "approved":
        state["current_step"] = min(step + 1, 8)

    state["updated_at"] = datetime.now().isoformat()

    with open(_session_path(session_id), "w") as f:
        json.dump(state, f, indent=2)

    return state


def save_decision(session_id: str, step: int, decision: str) -> dict:
    """Save a user decision for a step."""
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


def delete_session(session_id: str) -> bool:
    """Delete a teardown session and its directory."""
    session_dir = os.path.join(SESSIONS_DIR, session_id)
    if not os.path.exists(session_dir):
        raise FileNotFoundError(f"Session {session_id} not found")
    import shutil
    shutil.rmtree(session_dir)
    return True


def list_sessions() -> List[Dict]:
    """List all teardown sessions."""
    if not os.path.exists(SESSIONS_DIR):
        return []

    sessions = []
    for d in os.listdir(SESSIONS_DIR):
        state = get_session(d)
        if state:
            sessions.append({
                "session_id": state["session_id"],
                "company": state["company"],
                "product": state["product"],
                "current_step": state["current_step"],
                "status": state["status"],
                "created_at": state["created_at"],
                "updated_at": state["updated_at"],
            })
    return sorted(sessions, key=lambda s: s["updated_at"], reverse=True)


# ── Seed sessions ─────────────────────────────────────────────────

# Pre-seeded teardowns that should always appear in the "In Progress"
# list so Kiran can pick them up. Each entry creates a session at Step 1
# if no matching session already exists. Remove entries once published.
_SEED_SESSIONS = [
    {"company": "Spotify", "product": "Playlist Discovery"},
]


def seed_sessions():
    """Create seed sessions if they don't already exist."""
    os.makedirs(SESSIONS_DIR, exist_ok=True)
    existing = list_sessions()
    existing_keys = {(s["company"], s["product"]) for s in existing}

    for seed in _SEED_SESSIONS:
        if (seed["company"], seed["product"]) not in existing_keys:
            create_session(seed["company"], seed["product"])


# Auto-seed on startup
seed_sessions()


# ── Claude interaction ─────────────────────────────────────────────

def build_step_messages(state: dict, step: int, user_input: Optional[str] = None) -> List[Dict]:
    """Build the message history for a Claude API call at the given step."""
    messages = []

    # Add context from all previous approved steps
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
                    "content": decision["decision"]
                })

    # Current step prompt
    prompt = STEP_PROMPTS[step].format(
        company=state["company"],
        product=state["product"],
    )

    if user_input:
        prompt = f"{prompt}\n\nKiran's input: {user_input}"

    messages.append({"role": "user", "content": prompt})

    return messages


async def run_step(
    session_id: str,
    step: int,
    api_key: str,
    user_input: Optional[str] = None,
) -> str:
    """Run a single step of the teardown workflow via Claude."""
    from services.claude_client import create_client

    state = get_session(session_id)
    if not state:
        raise FileNotFoundError(f"Session {session_id} not found")

    client = create_client(api_key)
    messages = build_step_messages(state, step, user_input)

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=TEARDOWN_SYSTEM_PROMPT,
        messages=messages,
    )

    content = response.content[0].text

    # Save as draft
    save_step_result(session_id, step, content, status="draft")

    return content


async def run_step_stream(
    session_id: str,
    step: int,
    api_key: str,
    user_input: Optional[str] = None,
):
    """Stream a single step of the teardown workflow via Claude SSE."""
    from services.claude_client import create_client

    state = get_session(session_id)
    if not state:
        raise FileNotFoundError(f"Session {session_id} not found")

    client = create_client(api_key)
    messages = build_step_messages(state, step, user_input)

    full_content = ""

    with client.messages.stream(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=TEARDOWN_SYSTEM_PROMPT,
        messages=messages,
    ) as stream:
        for text in stream.text_stream:
            full_content += text
            yield json.dumps({
                "type": "text_delta",
                "delta": text,
            })

    # Save as draft when streaming completes
    save_step_result(session_id, step, full_content, status="draft")

    yield json.dumps({
        "type": "step_complete",
        "step": step,
        "label": STEPS[step - 1]["label"],
    })
