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
    {"step": 1, "label": "Topic", "description": "Theme, angle, and the claim the post will make"},
    {"step": 2, "label": "Research", "description": "Live web search for evidence, examples and current events"},
    {"step": 3, "label": "Draft", "description": "A complete rough article you can actually read"},
    {"step": 4, "label": "React", "description": "What is wrong, what is missing, and your read on it"},
    {"step": 5, "label": "Rewrite", "description": "The real version, with your reaction worked in"},
    {"step": 6, "label": "Check", "description": "AI tells, evidence weight, disclosure, and facts"},
    {"step": 7, "label": "Package", "description": "Publish outputs for the site, Medium, Substack and LinkedIn"},
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
    3: "Kiran's own words from the source are extracted separately. Build the "
       "draft around the position he already took rather than restating the "
       "assistant's half of the conversation.",
    4: "Check the draft against the source. If it has not moved past what the "
       "source already said, say so plainly.",
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
    1: """STEP 1: Topic

{past_posts}

{ideas}

Available themes: {themes}
Cross-cutting angles: {angles}

Help Kiran settle on one topic. He may arrive with an idea, or want to find one
from the themes, the inbox above, or what is happening in the field right now.

Land on three things:
- The territory in a sentence. Not the final angle - the research has not
  happened yet, and picking the angle before the evidence is picking blind.
  The specific options come at the end of Step 2.
- Theme and cross-cutting angle from the lists above
- One-off or part of a series. Series templates available: Demystifying [X],
  Product Teardown, Product Award of the Month, The Value Gap, Signal vs Noise,
  Product Decision Autopsy, The Contrarian Take, 5 Questions With.

If he arrives with a specific idea, take it and move on. If he is exploring,
help him choose a theme and angle worth researching.

End with one line, exactly:
SELECTED: theme=<theme> | angle=<angle> | series=<series or none>""",

    2: """STEP 2: Research

Research the claim: {theme} / {angle}.

Search for:
- Current events and recent news involving this, 2024-2026. Companies Kiran has
  never worked at are fair game and usually the better example.
- Data, studies and documented outcomes
- Concrete cases with a result, not just commentary about the problem
- The strongest evidence AGAINST the claim
- Who has already made this argument, when, and where

Sources for everything. A piece of commentary is evidence that someone holds an
opinion, not evidence that a thing happened. Note which is which, because the
draft will lean on this and the difference matters.

Say plainly where the evidence is thin.

THEN - and this is the half of the step that decides the post - put up 3 to 5
topic options the research actually supports. One of these becomes the article,
so make them genuinely different directions rather than three phrasings of the
same idea. For each:

- WORKING TITLE. Compelling and specific, never a category. "A look at
  engagement metrics" is a subject. "Why the wrong number always wins the room"
  is a title.
- HYPOTHESIS. The position this version would take, stated so it could be
  wrong.
- KEY DATA POINTS. Two or three pieces of evidence from the research above that
  support it, with the source named. If an option has no evidence behind it,
  say so - that is a reason to drop it.
- TIMELINESS HOOK. Why now. A recent case, filing, launch, ruling or
  announcement that makes this the moment.
- WHAT IT COSTS. Any disclosure risk, any company Kiran is close to, any claim
  that will be hard to source.

Rank them. Say which you would take and why, in one honest paragraph - usually
the one with documented evidence rather than commentary behind it.

Kiran picks one, or redirects. He may also combine two.

End with one line, exactly:
CLAIM: <the chosen hypothesis in one sentence, or PENDING if he has not chosen>""",

    3: """STEP 3: Draft

Write the full article now, before asking Kiran for anything.

This is the point of the step. He cannot tell you what is wrong, what is
missing, or where his own experience fits until he can read something concrete.
Asking him in the abstract produces a blank page; asking him to react to a real
draft produces the post.

First, design the shape. Decide these before you write a word, and state them
in a short block headed THE SHAPE at the top of your output:

- NARRATIVE ARC. What is the journey the reader goes on? Where does the tension
  sit, and where does it resolve?
- OPENING HOOK. Which strategy: a surprising fact, a tension, a reframing
  question, or a human moment? Say which and why it fits this argument.
- SECTIONS. What does a reader have to accept, in what order, for this to land?
  That ordered list is the structure. No section quota - the argument decides.
- DATA PLACEMENT. Which evidence lands in which section. Do not stack the
  statistics in one block.
- CLOSING MOVE. A callback close, a provocative question, or a forward-looking
  statement? Say which.
- LENGTH. State the word count you expect and why the argument needs it. A
  sharp observation with one example might be 700 words. A case resting on a
  mechanism and three pieces of evidence might need 2,000. Never pad toward a
  number, and never compress a real argument to hit one.

Then write it, properly, not as an outline:
- Hook inside the first 100 words. If the reader has not been given a reason to
  continue by then, the opening has failed.
- Data woven conversationally, not academically. A statistic should arrive in
  the middle of a sentence that was going somewhere anyway.
- Vary sentence rhythm. Mix short punchy sentences with longer flowing ones.
  Uniform length reads as machine-made.
- Every paragraph earns its place. If it could be cut without the argument
  losing anything, cut it before Kiran has to.
- Vary the section lengths and shapes deliberately. Six sections of the same
  length running setup, example, turn is the clearest sign a machine built it.
- Voice profile and governance rules in the system prompt are binding.
- Use the research. Name real companies and real events. Cite as you go.
- Where you needed something from Kiran and did not have it, write the section
  anyway and mark it inline: [KIRAN: a view on X would strengthen this].

Open with the draft itself. Then, underneath, add a short note headed WHAT THIS
NEEDS: the two or three places you are least confident about, and what would
fix each.

Clean markdown. No frontmatter, no title block.""",

    4: """STEP 4: React

Kiran has now read the draft. This step is one working session about it, not an
interrogation.

Start by giving him something to push against. In order:

1. WHAT IT ARGUES. Two sentences. If you cannot state the claim crisply, that is
   the first problem and you should say so.

2. THE CASE AGAINST IT. The strongest honest objection, argued properly rather
   than as a strawman. Who loses if the claim is right, and do they have a
   point? Where is it simply false? Use the research.

3. WHO ELSE SAID THIS. Search. Who has made this argument, when and where. Being
   first is not the bar and almost nothing is new. The bar is knowing whose
   conversation this joins and what it adds. Say what the draft adds, or say
   honestly that it adds nothing.

4. WHERE IT IS THIN. The weakest evidence, the paragraphs doing no work, the
   claims that outrun what supports them.

Then ask him. Two sets of questions.

FIRST, the sharpening questions. These set the post's intent and the draft
cannot answer them for him. Ask all four, tied to what the draft currently
does:
- What is the one thing he wants readers to do differently after reading this?
- How contrarian should it be: safe-but-insightful, or challenge the
  orthodoxy? Say where the current draft sits on that scale.
- Any companies or products he wants referenced, or explicitly avoided?
- Who is the one person he imagines reading this? Name the draft's implied
  reader and ask whether that is right.

SECOND, three or four questions about this specific draft, tied to passages
rather than general:
- Where is this wrong, in his read
- What is missing that someone in his field would expect to see
- Which companies or events in the news he would bring in instead
- Where his own view differs from the draft's

ON EXPERIENCE. A personal story is one option among several, never a
requirement. A distinctive read on public events, a connection nobody else has
drawn, a position taken clearly, or simply knowing how the industry actually
works are all equally good ways for this to be his. Most topics will not touch
his own career at all, and that is fine.

If experience IS relevant, brief the slot rather than filling it: which section,
what the moment would need to do, roughly how long, and one hypothetical
example in the third person so he has a shape to recognise. Never write a story
as though it happened to him. Then offer the attribution choice - named,
sector only, pattern with no incident, or leave it out - and let him pick.

PRESERVE HIS WORDS. When he gives you a line that lands, keep it verbatim and
say you are keeping it. Smoothing his phrasing into fluent prose is how a post
ends up sounding like nobody wrote it.

If the draft does not survive this - the claim is wrong, or the point has been
made better elsewhere and nothing is being added - say so and recommend
stopping. That is a good outcome, not a failure.

End with one line, exactly:
VERDICT: PROCEED | REWORK | STOP""",

    5: """STEP 5: Rewrite

Rewrite the article using Kiran's reaction. This is the real version.

- Everything he corrected is corrected
- Everything he added is in, in his words where he gave you words
- Any [KIRAN: ...] markers from the draft are resolved or removed
- The strongest objection from Step 4 is addressed in the text, not avoided
- Prior work is credited where the post builds on it
- His experience appears only at the attribution level he chose, with no detail
  he did not supply
- Structure and length still follow the argument

This is a rewrite, not a new article. Keep what worked in the draft.

Clean markdown. No frontmatter, no title block.""",

    6: """STEP 6: Check

Three passes over the rewrite. Be specific, quote lines, do not soften.

PASS 1 - AI TELLS

A deterministic check has already run:

{rule_findings}

Fix every violation listed by rewriting the sentence. Swapping an em dash for a
comma pair leaves the same sentence with worse rhythm, which is still a tell.

Then hunt what a regex cannot see:
- "It's not X. It's Y." as a title or sentence
- Negative parallelism: "not malice, not stupidity"
- Rule of three: "an advocacy movement, a conference circuit, a set of talking points"
- The pseudo-intimate aside: "sit with that for a second", "worth pausing on"
- Every section closing on a short punchy line
- Paragraphs and sections of near-identical length and identical internal shape
- Restating the thesis at the top of every section
- A closing line reaching for profundity

Quote each one, name it, rewrite it.

PASS 2 - EVIDENCE AND EXPOSURE

- EVIDENCE WEIGHT. For each load-bearing claim, grade what supports it: a
  documented action with an outcome, a proposal someone made, an opinion, or an
  anecdote. Does the sentence's confidence match that grade? Writing "the
  industry has already tried this" while citing two people who wrote about it
  is the failure to catch. Flag every mismatch.
- DISCLOSURE. Does the post name or clearly identify Kiran's current employer
  in a critical frame? Does it describe a traceable incident or person at any
  employer? Does it put him on the record against people he still works with?
  Quote the line and say what it risks. This blocks publication.
- REPUTATION RISK SCAN. For every company the post discusses, read each claim
  through the eyes of an employee or executive there. Flag anything that:
  could be perceived as unfair; could burn a professional bridge; could be
  quoted out of context against him; or attributes motives without evidence.
  This applies to every company named, not only ones he has worked for - the
  product leader at the company being analysed is exactly the person most
  likely to read this.
- DECORATION. Anything that does not carry information words could not.
- HEDGING. Does the post take a clear position, or does it go soft? Scan for
  weasel phrases: "might", "could potentially", "it's possible that", "some
  would argue", "arguably". Quote each one and either commit to the claim or
  cut the sentence. A post that hedges its own thesis has no thesis.
- SECTION VALUE. Does every section earn its place? Name any section that
  could be removed without the argument losing anything, and recommend cutting
  it. Length is not an achievement.
- VOICE. Read it against the voice profile. Does this sound like Kiran, or
  like generic thought leadership that any competent writer could have
  produced? Quote the passages that sound anonymous and say what is missing.
- THE HONEST QUESTION. Would a senior practitioner learn something, or
  recognise their own experience here? If not, say so.

PASS 3 - FACTS

Search for a primary source for every factual claim. Build the table:

| Claim | Source | Status |

Status: Verified (link the primary source), Corrected (give it), Removed (say
why), Unverifiable (say where you looked). A summary of a book is not a source
for the book. Wikipedia is a starting point, not a citation. Removing an
unsourceable claim is a better outcome than shipping it.

Output the corrected article in full, then the findings.

End with one line, exactly:
VERDICT: CLEAR | FIX FIRST | DO NOT PUBLISH""",

    7: """STEP 7: Package

Produce the publish set.

1. post.md with YAML frontmatter: title, date, author, theme, angle, series,
   reading_time, word_count
2. The final markdown
3. Sources: only what Step 6 verified
4. A one-sentence description for the blog card and meta description
5. A LinkedIn short post. Open on the single most interesting observation, not
   a preamble. One idea. 120-200 words, short paragraphs, written for a phone.
   End with a line pointing to the full piece. No hashtag spam, no engagement
   bait.

Confirm what is ready and flag anything Step 6 left unresolved.""",
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





def parse_verdict(content: str) -> Optional[str]:
    """Read the VERDICT: line a gating step ends with."""
    for line in reversed((content or "").splitlines()):
        line = line.strip().lstrip("*# ").strip()
        if line.upper().startswith("VERDICT:"):
            verdict = line.split(":", 1)[1].strip().strip("*").upper()
            # Steps offer alternatives as "A | B | C"; an unfilled template is not a verdict.
            if "|" in verdict:
                return None
            return verdict or None
    return None


# Verdicts that mean this session should not produce a post.
# Verdicts that mean this session should not produce a post.
STOP_VERDICTS = {"STOP", "DO NOT PUBLISH"}


# ── Deterministic style check ──────────────────────────────────────
#
# The governance rules are instructions to a model, which means they are mostly
# obeyed. Em dashes, banned words and banned openers can be checked exactly, so
# they are, and the findings are handed to the scrub step as facts rather than
# hopes.

def check_style_rules(text: str) -> dict:
    """Return {"violations": [...], "clean": bool} for the rules a regex can decide."""
    import re
    from services.governance_loader import (
        HARD_BANNED, AI_LANGUAGE, BUZZWORDS, BANNED_OPENERS, FILLER_PATTERNS,
    )

    violations = []
    lines = (text or "").splitlines()

    def add(kind, detail, lineno, line):
        violations.append({
            "rule": kind,
            "detail": detail,
            "line": lineno,
            "text": line.strip()[:160],
        })

    for i, line in enumerate(lines, 1):
        for ch, name in (("\u2014", "em dash"), ("\u2013", "en dash")):
            if ch in line:
                add("punctuation", f"{name} is banned; rewrite the sentence", i, line)

        low = line.lower()
        for word in HARD_BANNED + AI_LANGUAGE + BUZZWORDS:
            if re.search(rf"\b{re.escape(word.lower())}\b", low):
                add("banned word", f"'{word}'", i, line)
        for opener in BANNED_OPENERS:
            if low.lstrip("#*>- ").startswith(opener.lower()):
                add("banned opener", f"'{opener}'", i, line)
        for pattern in FILLER_PATTERNS:
            if re.search(pattern, low):
                add("filler", pattern.strip("\\b"), i, line)

    return {"violations": violations, "clean": not violations}


def format_rule_findings(text: str) -> str:
    """Render the deterministic findings for the scrub step's prompt."""
    result = check_style_rules(text)
    if not text.strip():
        return "DETERMINISTIC CHECK: no draft found to check."
    if result["clean"]:
        return ("DETERMINISTIC CHECK: clean. No banned punctuation, words, openers or "
                "filler found. The structural tells below are still yours to hunt.")

    lines = [f"DETERMINISTIC CHECK: {len(result['violations'])} violation(s). "
             f"Every one must be fixed by rewriting, not by substitution."]
    for v in result["violations"][:60]:
        lines.append(f"  [{v['rule']}] line {v['line']}: {v['detail']}")
        lines.append(f"      {v['text']}")
    if len(result["violations"]) > 60:
        lines.append(f"  ... and {len(result['violations']) - 60} more.")
    return "\n".join(lines)


# ── Seeded input: splitting a conversation into two channels ───────
#
# Source material often arrives as a back-and-forth with an AI. The two halves
# need opposite handling: Kiran's turns are the voice the post should have and
# must be preserved, while the assistant's turns are raw material to be mined
# and doubted. Treating the whole blob as one thing launders his voice out of
# the very input that contained it.

_SPEAKER_PATTERNS = [
    # "Kiran:", "Me:", "User:", "You said:" and the common export headings.
    (r"^\s*(?:#{1,6}\s*)?(?:\*\*)?(kiran|me|user|you|q|question)(?:\s+said)?(?:\*\*)?\s*[:\-]\s*(?:\*\*)?\s*", "kiran"),
    (r"^\s*(?:#{1,6}\s*)?(?:\*\*)?(chatgpt|gpt|claude|assistant|ai|answer|response)(?:\s+said)?(?:\*\*)?\s*[:\-]\s*(?:\*\*)?\s*", "other"),
    (r"^\s*#{1,6}\s*(you said|user)\s*:?\s*$", "kiran"),
    (r"^\s*#{1,6}\s*(chatgpt said|chatgpt|assistant|claude said)\s*:?\s*$", "other"),
]


def split_transcript(text: str) -> dict:
    """Split a pasted conversation into Kiran's turns and everything else.

    Returns {"kiran": str, "other": str, "is_transcript": bool}. When no speaker
    labels are found the text is not a transcript, and it all stays as source
    material rather than being guessed at.
    """
    import re

    lines = (text or "").splitlines()
    buckets = {"kiran": [], "other": []}
    current = None
    found_any = False

    for line in lines:
        matched = None
        for pattern, who in _SPEAKER_PATTERNS:
            m = re.match(pattern, line, re.I)
            if m:
                matched = who
                line = line[m.end():]
                break

        if matched:
            current = matched
            found_any = True
            if not line.strip():
                continue

        if current:
            buckets[current].append(line)

    if not found_any:
        return {"kiran": "", "other": text or "", "is_transcript": False}

    kiran = "\n".join(buckets["kiran"]).strip()
    other = "\n".join(buckets["other"]).strip()

    # Labels existed but Kiran never spoke: treat it as plain source material.
    if not kiran:
        return {"kiran": "", "other": text or "", "is_transcript": False}

    return {"kiran": kiran, "other": other, "is_transcript": True}


KIRAN_WORDS_FRAMING = """KIRAN'S OWN WORDS, taken from the conversation he seeded this session with.

These are his, and they are handled the opposite way to source material:
- Preserve the phrasing. Where a line lands, keep it word for word.
- These are his positions, not claims to be fact-checked out of existence.
- Where he pushed back on something, that pushback is usually the post.
- Do not smooth, summarise or neutralise them into fluent prose.

<kiran_words>
{kiran_words}
</kiran_words>"""


# ── Web search ─────────────────────────────────────────────────────
#
# Steps 2, 10 and 11 instruct Claude to search the web. Until now no tools were
# passed, so those steps generated statistics, "Verified" statuses and
# originality findings from memory. These are the steps that get real eyes.

SEARCH_STEPS = {2, 4, 6}

# The step where Kiran's own experience is authored.
DRAFT_STEP = 3        # the first full article, written before Kiran is asked for anything
REACT_STEP = 4        # his reaction to it
WRITE_STEP = 5        # the rewrite that incorporates it
CHECK_STEP = 6

# Steps where the session can legitimately end without a post.
KILL_STEPS = {4}

# A turn with server tools can pause while searches run.
MAX_RESUMES = 8

# 1,750 words is ~2,400 tokens, and 4,096 also has to cover a thinking block.
DEFAULT_MAX_TOKENS = 8000
STEP_MAX_TOKENS = {2: 16000, 3: 16000, 4: 12000, 5: 16000, 6: 16000, 7: 16000}

# max_uses is per request. Research ranges wider than verification does.
# Each search adds latency before a single word reaches the screen, so these
# are deliberately modest. Ten searches on step 2 meant minutes of blank UI.
SEARCH_BUDGET = {2: 5, 4: 4, 6: 6}


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



# ── Idea inbox ─────────────────────────────────────────────────────
#
# Ideas arrive between sessions, not during them. Without somewhere to put a
# half-thought, the weekly post always starts from a blank theme list.

IDEAS_PATH = os.path.join(SESSIONS_DIR, "_ideas.json")


def _read_ideas() -> list:
    if not os.path.exists(IDEAS_PATH):
        return []
    try:
        with open(IDEAS_PATH) as f:
            return json.load(f)
    except Exception:
        return []


def _write_ideas(ideas: list) -> None:
    os.makedirs(SESSIONS_DIR, exist_ok=True)
    tmp = IDEAS_PATH + ".tmp"
    with open(tmp, "w") as f:
        json.dump(ideas, f, indent=2)
    os.replace(tmp, IDEAS_PATH)


def add_idea(text: str, note: str = "") -> dict:
    idea = {
        "id": str(uuid.uuid4())[:8],
        "text": text.strip(),
        "note": (note or "").strip(),
        "created_at": datetime.now().isoformat(),
        "used_by": None,
    }
    ideas = _read_ideas()
    ideas.insert(0, idea)
    _write_ideas(ideas)
    return idea


def _format_ideas() -> str:
    """Unused inbox items, offered to the topic step as candidates."""
    ideas = [i for i in _read_ideas() if not i.get("used_by")]
    if not ideas:
        return ""
    lines = ["KIRAN'S IDEA INBOX - thoughts he jotted down between sessions. "
             "Consider these alongside the research when proposing topics, and "
             "say which option came from which idea:"]
    for i in ideas[:20]:
        lines.append(f"- [{i['id']}] {i['text']}" + (f"  ({i['note']})" if i.get("note") else ""))
    return "\n".join(lines)


def list_ideas(include_used: bool = False) -> list:
    ideas = _read_ideas()
    return ideas if include_used else [i for i in ideas if not i.get("used_by")]


def delete_idea(idea_id: str) -> bool:
    ideas = _read_ideas()
    remaining = [i for i in ideas if i["id"] != idea_id]
    if len(remaining) == len(ideas):
        return False
    _write_ideas(remaining)
    return True


def mark_idea_used(idea_id: str, session_id: str) -> bool:
    ideas = _read_ideas()
    for idea in ideas:
        if idea["id"] == idea_id:
            idea["used_by"] = session_id
            idea["used_at"] = datetime.now().isoformat()
            _write_ideas(ideas)
            return True
    return False


# ── Memory of past posts ───────────────────────────────────────────
#
# Without this, post five repeats post two and no series ever builds.

def past_posts_summary(exclude_session: Optional[str] = None, limit: int = 15) -> str:
    """What Kiran has already argued, for the steps that choose a topic."""
    entries = []
    for state in (list_sessions() or []):
        if state.get("session_id") == exclude_session:
            continue
        if state.get("status") not in ("published", "ready_to_publish", "previewing"):
            continue
        cfg = state.get("config") or {}
        claim = ""
        for step in ("6", "4", "3"):
            content = ((state.get("steps") or {}).get(step) or {}).get("content", "")
            for key in ("POSITION:", "CLAIM:"):
                for line in reversed(content.splitlines()):
                    line = line.strip().lstrip("*# ").strip()
                    if line.upper().startswith(key):
                        claim = line.split(":", 1)[1].strip()
                        break
                if claim:
                    break
            if claim:
                break
        entries.append({
            "title": state.get("title") or state.get("slug") or state.get("session_id"),
            "theme": cfg.get("theme", ""),
            "angle": cfg.get("angle", ""),
            "claim": claim,
            "updated": state.get("updated_at", ""),
        })

    if not entries:
        return ""

    entries.sort(key=lambda e: e["updated"], reverse=True)
    lines = ["WHAT KIRAN HAS ALREADY PUBLISHED OR FINISHED (do not repeat these arguments; "
             "a new post may build on one, but say so explicitly):"]
    for e in entries[:limit]:
        bits = [b for b in (e["theme"], e["angle"]) if b]
        lines.append(f"- {e['title']}" + (f" ({', '.join(bits)})" if bits else ""))
        if e["claim"]:
            lines.append(f"    argued: {e['claim']}")
    return "\n".join(lines)


# ── Claude interaction ─────────────────────────────────────────────

def _latest_article(state: dict) -> str:
    """The most recent full article: the rewrite if it exists, else the draft."""
    steps = state.get("steps") or {}
    for step in (WRITE_STEP, DRAFT_STEP):
        content = (steps.get(str(step)) or {}).get("content", "")
        if content.strip():
            return content
    return ""


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

    # A pasted conversation carries two kinds of material that need opposite
    # handling, so split it before anything else sees it.
    split = split_transcript(source_material) if source_material else {
        "kiran": "", "other": "", "is_transcript": False,
    }
    kiran_words = split["kiran"]
    external = split["other"] if split["is_transcript"] else source_material

    if external:
        messages.insert(0, {
            "role": "user",
            "content": SOURCE_MATERIAL_FRAMING.format(source_material=external),
        })
    if kiran_words:
        messages.insert(1 if external else 0, {
            "role": "user",
            "content": KIRAN_WORDS_FRAMING.format(kiran_words=kiran_words),
        })

    if state["mode"] == "blog":
        prompt_template = BLOG_STEP_PROMPTS.get(step, "Continue with the next step.")
        prompt = prompt_template.format(
            themes=", ".join(theme_data["themes"]),
            angles=", ".join(theme_data["angles"]),
            theme=config.get("theme", "not yet selected"),
            angle=config.get("angle", "not yet selected"),
            past_posts=(past_posts_summary(state.get("session_id")) if step == 1 else ""),
            ideas=(_format_ideas() if step == 1 else ""),
            rule_findings=(
                format_rule_findings(_latest_article(state)) if step == CHECK_STEP else ""
            ),
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
    run_searches = 0
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
            if searching:
                # Searches run server-side and emit no text, so without this the
                # screen stays blank for minutes and the step looks hung.
                for event in stream:
                    etype = getattr(event, "type", "")
                    if etype == "content_block_start":
                        block = getattr(event, "content_block", None)
                        if getattr(block, "type", "") == "server_tool_use":
                            run_searches += 1
                            yield json.dumps({
                                "type": "search_progress",
                                "step": step,
                                "searching": run_searches,
                                "max_uses": SEARCH_BUDGET.get(step, 8),
                            })
                    elif etype == "content_block_delta":
                        delta = getattr(event, "delta", None)
                        text = getattr(delta, "text", None)
                        if text:
                            full_content += text
                            yield json.dumps({"type": "text_delta", "delta": text})
            else:
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
