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
    {"step": 1, "label": "Theme & Angle", "description": "One-off or series, theme, cross-cutting angle"},
    {"step": 2, "label": "Research", "description": "Live web search for data, examples, counter-arguments"},
    {"step": 3, "label": "Topic Options", "description": "Candidate topics with a claim each, grounded in the research"},
    {"step": 4, "label": "Push Back", "description": "Argue the other side hard. The claim survives, narrows, or dies"},
    {"step": 5, "label": "Who Else Said This", "description": "Whose conversation you are joining, and what you add to it"},
    {"step": 6, "label": "Your Take", "description": "Your thinking goes into the scaffold, in your words"},
    {"step": 7, "label": "Your Experience", "description": "Where a real moment lands, what kind, and how much you name"},
    {"step": 8, "label": "Structure", "description": "Shape and length derived from the argument, not a template"},
    {"step": 9, "label": "Write", "description": "The draft, in your voice"},
    {"step": 10, "label": "Scrub AI Tells", "description": "Deterministic rule check plus the pattern library"},
    {"step": 11, "label": "Attack", "description": "Adversarial review: evidence weight, disclosure, sameness, decoration"},
    {"step": 12, "label": "Fact-Check & Package", "description": "Verify every claim, then build the five publish outputs"},
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
    5: "The source material is the first thing to check the thesis against. "
       "If the thesis has not moved past it, say so plainly.",
    6: "Kiran's own words from the source are already extracted below. Build "
       "from those rather than asking him to repeat himself.",
    11: "Check whether the post says anything the source did not already say. "
        "If not, name what is missing.",
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

{past_posts}

{ideas}

From the research, put up 3-5 candidate topics. For each:
- A working title that is specific, not a category
- THE CLAIM in one sentence - the thing the post would assert and could be
  wrong about. "A look at engagement metrics" is not a claim. "Engagement is
  reported on a cadence that downstream harm never gets" is a claim.
- The two or three pieces of evidence from the research that support it
- Why now

Rank them by which claim is most defensible AND most worth making. Say which
you would pick and why. Kiran chooses.

End with one line, exactly:
CLAIM: <the chosen claim in one sentence>""",

    4: """STEP 4: Push Back

Your job here is to attack the chosen claim as hard as you honestly can. Not
to list polite objections - to make the strongest case that Kiran is wrong.

Write the opposing case as if by someone smart who disagrees, knows this
domain, and has evidence. Give it the best version of its argument, not a
strawman you can knock over. Use the research. If the research does not
contain good counter-evidence, say so, because that is itself a finding.

Cover:
- The strongest factual objection
- The strongest "this is true but trivial" objection
- Who loses if the claim is acted on, and whether they have a point
- The conditions under which the claim is simply false

Then give your honest verdict in one of three forms:
  SURVIVES  - the claim holds. Say what the post must now address to be
              credible, because ignoring this objection would be a tell.
  NARROWS   - the claim holds in a smaller form. State the smaller claim.
  DIES      - the claim does not hold. Say so plainly and recommend stopping
              or returning to Step 3. Do not soften this. A session that ends
              here has saved Kiran from publishing something wrong.

End with two lines, exactly:
VERDICT: SURVIVES | NARROWS | DIES
CLAIM: <the claim as it now stands, or NONE if it died>""",

    5: """STEP 5: Who Else Said This

Search for who has already made this argument, or something close to it. Books,
papers, posts, talks, from any era.

Being first is not the bar and Kiran does not need to clear it. Almost nothing
is new. The bar is knowing whose conversation he is joining and what he adds
to it. A post that re-states a known argument while pretending to discover it
reads as either uninformed or dishonest. A post that says "Harris made this
case in 2013 and here is what it missed" reads as someone who has done the
reading.

Report:
- Who has made this argument, when, and where. Be specific and cite.
- The closest existing piece. What does it get right?
- What is genuinely different here: a different lens (banking, regulated
  industries, a practitioner rather than an academic), a different mechanism,
  a different consequence, newer evidence, or a case the original missed.
- Anything the post should explicitly credit rather than appear to reinvent.

Verdict in one of two forms:
  POSITIONED - there is a real addition. State it in one sentence. The post
               should name the prior work and build on it.
  REDUNDANT  - the point has been made, better, and nothing is being added.
               Say so and recommend stopping or returning to Step 3.

End with one line, exactly:
VERDICT: POSITIONED | REDUNDANT""",

    6: """STEP 6: Your Take

The scaffold exists now: a claim that survived attack, the prior work it sits
beside, and the evidence. This step puts Kiran into it.

{kiran_words}

If his own words are above, lead with them. Play back what he actually
argues, in his phrasing, and ask what is missing or wrong. Do not paraphrase
his position into neutral prose - his wording is the voice the post is
supposed to have.

If there is nothing above, ask for it. Three or four questions, each tied to
a specific part of the argument rather than general. Aim at:
- Where he agrees, and where he does not, with the claim as it stands
- What the research missed that he knows from working in this domain
- What a peer who knows his work would push back on
- The version of this he would say out loud but hesitate to publish, and why

HARD RULE: preserve his phrasing. When he gives you a line that lands, keep
it word for word and tell him you are keeping it. The failure mode here is
sanding his voice into something fluent and anonymous. If his sentence is
rough but alive, rough wins.

Close by stating, in his words not yours, what this post argues and why he is
the one making the case.

End with one line, exactly:
POSITION: <one sentence, in Kiran's own words where possible>""",

    7: """STEP 6: Experience & Evidence Workshop

This is the step the whole post depends on. Research is delegable; the lived
part is not. Posts that fail do so because nothing on the page could only have
been written by Kiran. Your job is to help him author that part, not to write
it for him.

HARD RULE: give him an example to spark his own memory. Never write his memory
for him. Both halves matter - an abstract request ("do you have an anecdote
about metrics?") gets a blank stare, so you MUST illustrate the kind of moment
that would work. The rule is about whose story the example is:

  DO THIS - a clearly hypothetical illustration, someone else, flagged as an
  example, followed by the handoff:
      "The kind of moment that works here: someone pushes back on a launch
       date, gets overruled, then watches the rollback three weeks later. That
       is an illustration, not a guess about you. What is your version?"

  NEVER THIS - the same story written as his, in second person, as if it
  happened:
      "At [company] in 2019 you sat in a review where the engagement chart went
       up and you said nothing..."

The first gives him a shape to recognise and sends him to his own memory. The
second hands him a draft of his own life, and he will edit your invention
instead of reaching for what actually happened - which is exactly how a post
ends up sounding like nobody wrote it.

So: illustrate freely, in the third person, flagged as hypothetical. Never
assert, imply or assume anything about his actual history. Never supply a
scene, meeting, number, colleague or quote as though it were his.

Run this as a working session, in four moves.

MOVE 1 - BRIEF THE SLOTS. Go through the approved structure and name the
specific places where lived experience would be load-bearing. For each one,
write a short brief: which section, what the anecdote would have to do there,
roughly how long, what KIND of moment would fit, and one hypothetical example
of such a moment so he has something to recognise against.

"A personal anecdote would help here" is useless. This is a brief he can
answer: "Section 3 needs a moment where you chose the slower option and had to
justify it - about 120 words, placed right before the turn. For instance: a
team delays a release to fix something only they can see, and spends the next
month explaining the delay. Yours will look different. What comes to mind?"

There are four useful kinds, and they are not equal:
  (a) A defensible number from work he has already published
  (b) A pattern he has seen repeat across organizations (no incident, no date)
  (c) A decision he made and what it cost
  (d) A thing he got wrong and what changed his mind
(d) is the most valuable and the least used, because it is the one thing no
one can write on his behalf. Say which kind THIS argument needs most, and why
that kind rather than the others. Do not assume he has any of them.

MOVE 2 - PROBE AGAINST THE BRIEFS. For each slot you briefed, ask the question
that would surface the matching memory. Tie the question to the brief so he can
see what it is for. Aim the set at different kinds of memory: a moment he
argued and lost, a tradeoff he chose deliberately, a number he watched that
nobody else did, a belief he has since abandoned.

You do not know his history and must not guess at it. Ask where he has stood on
either side of the claim, not whether he "has an anecdote".

Then give him a way to interrogate his own experience rather than a request to
produce. Useful frames:
  - Invert the thesis. If the opposite were true, what would he have seen?
  - Where does the claim stop being true in his world, and why?
  - Which part of this argument would a peer who knows his work push back on?
  - What is the most boring version of this that he knows is correct?
Ask for rough notes. Situation, what he did, what happened. Messy is fine, and
say so. Stop and wait for his answer.

MOVE 3 - SHAPE. When he answers, do not simply accept it. First, play back what
you heard in his own facts and confirm you have it right. Then show the SAME
material at four attribution levels, with what each buys and what it costs:
  1. NAMED      - the company and the year. Most weight, most exposure.
  2. SECTOR     - the kind of company, not the name. Keeps the specificity,
                  drops the attribution.
  3. PATTERN    - a thing he has seen repeat, stated concretely, with no
                  incident, no date and nothing anyone can trace to a team.
                  Build this from what he actually told you, not from a
                  template. Still concrete, still his, still carries.
  4. OMIT       - and say how the post would change to not need it.
Name the risk of each honestly, especially level 1 or 2 where the subject is
his current employer. He decides. Do not decide for him.

MOVE 4 - CLOSE. State plainly whether what he gave you is enough to carry the
post, or whether it is thin. "This is enough" and "this is not enough yet" are
both acceptable answers. Flattery here costs him his credibility later.

End your output with two lines, exactly:
EXPERIENCE: SUPPLIED | PARTIAL | NONE
ATTRIBUTION: NAMED | SECTOR | PATTERN | NONE""",

    8: """STEP 8: Structure

Derive the shape from the argument. There is no target section count and no
target word count.

Ask: what does a reader have to accept, in what order, for this case to land?
That ordered list IS the structure. Each section exists to move the reader one
step, and a section that does not move them gets cut before it is written.

Then decide length from the argument's weight. A single sharp observation
backed by one example might be 700 words and lose nothing. A case built on
three pieces of evidence and a mechanism might need 2,000. Do not pad toward a
number, and do not compress a real argument to hit one. State the length you
expect and why the argument needs it.

Also place:
- Where Kiran's experience sits, using the attribution level he chose
- Where the opposing case from Step 4 gets addressed, because ignoring it is
  a tell
- Where prior work from Step 5 gets credited
- The opening move, and what makes it earn the second paragraph
- The close, which should land the argument rather than summarize it

Deliberately vary the shape. Sections of near-identical length reading
setup-example-turn, over and over, is the single clearest sign a machine
built this.

Present the structure for approval.""",

    9: """STEP 9: Write

Write the post from the approved structure.

- Voice profile and governance rules in the system prompt are binding, not
  aspirational
- Kiran's preserved phrasing from Step 6 goes in as he wrote it
- His experience at the attribution level he chose in Step 7, with no detail
  he did not supply
- Address the strongest objection from Step 4 rather than writing around it
- Credit prior work from Step 5 where the post builds on it
- Length as set in Step 8

Write it as someone who works in this field and is telling a peer what he has
noticed. Not as an explainer, not as a brief, not as a magazine feature.

Clean markdown. Section headers. No title block, no frontmatter.""",

    10: """STEP 10: Scrub AI Tells

A deterministic rule check has already run and its findings are below. Your job
is the half a regex cannot do.

{rule_findings}

First, fix every rule violation listed above. Rewrite the sentence rather than
swapping punctuation - replacing an em dash with a comma pair produces the
same sentence with worse rhythm, which is still a tell.

Then hunt the structural tells. These are the patterns that mark machine
authorship even when every word is allowed:

- "It's not X. It's Y." as a title or a sentence
- Negative parallelism: "not malice, not stupidity"
- Rule of three: "an advocacy movement, a conference circuit, a set of talking points"
- The pseudo-intimate aside: "sit with that for a second", "worth pausing on"
- Every section closing on a short punchy standalone line
- Paragraphs of near-identical length
- Sections of near-identical length and identical internal shape
- Commas doing the work of em dashes
- Restating the thesis at the top of each section
- Symmetrical openings and closings that feel engineered
- A closing line that reaches for profundity

For each one you find: quote the line, name the tell, rewrite it. Some
repetition is human. A page where every section ends on a punchy line is not.

Output the full revised post, then a short list of what you changed and why.""",

    11: """STEP 11: Attack

Adversarial review of the draft. You are not editing. You are trying to find
the thing that embarrasses Kiran after publication. Be specific, quote lines,
and do not soften.

1. EVIDENCE WEIGHT. For every load-bearing claim, grade what actually supports
   it: a documented action with an outcome, a proposal someone made, an
   opinion, or an anecdote. Then ask whether the sentence's confidence matches
   that grade. Writing "the industry has already tried this" and citing two
   people who wrote about it is the failure to catch. Flag every mismatch.

2. DISCLOSURE. Does the post name or clearly identify Kiran's current employer
   in a critical frame? Does it describe an incident, decision or person at any
   employer in a way that could be traced? Does it put him on the record
   against people he still works with? Quote the line and say what it risks.
   This is a blocking finding, not a note.

3. SAMENESS. Are the sections the same length and shape? Does every one run
   setup, example, turn? Name it.

4. DECORATION. Is there a diagram or visual that does not carry information
   words could not? A labelled line is decoration, and decoration is a tell.
   Recommend cutting it.

5. THE HONEST QUESTION. Would a senior practitioner who knows this field learn
   something, or recognise their own experience in it? If the honest answer is
   no, say so.

End with one line, exactly:
VERDICT: CLEAR | FIX FIRST | DO NOT PUBLISH
followed by a numbered list of what must change, most serious first.""",

    12: """STEP 12: Fact-Check & Package

PART ONE - verify. Search for a primary source for every factual claim in the
post. Build the table:

| Claim | Source | Status |

Status is one of: Verified (link the primary source), Corrected (give the
correction), Removed (say why), Unverifiable (say where you looked).

Rules: a summary of a book is not a source for the book. Wikipedia is a
starting point, not a citation. If you could not find a primary source, the
status is Unverifiable, not Verified. Removing a claim is a valid outcome and
a better one than shipping an unsourced number.

PART TWO - package. Produce:
1. post.md with YAML frontmatter: title, date, author, theme, angle, series,
   reading_time, word_count
2. The final markdown
3. A Sources section listing only what you verified
4. A one-sentence description for the blog card and meta description
5. A LinkedIn short post: the hook, the single idea, and a line pointing home.
   Written to be read on a phone, no hashtag spam.

Confirm what is ready and what is not.""",
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
STOP_VERDICTS = {"DIES", "REDUNDANT", "DO NOT PUBLISH"}


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

SEARCH_STEPS = {2, 5, 12}

# The step where Kiran's own experience is authored.
YOUR_TAKE_STEP = 6
EXPERIENCE_STEP = 7
WRITE_STEP = 9
SCRUB_STEP = 10

# Steps where the session can legitimately end without a post.
KILL_STEPS = {4, 5}

# A turn with server tools can pause while searches run.
MAX_RESUMES = 8

# 1,750 words is ~2,400 tokens, and 4,096 also has to cover a thinking block.
DEFAULT_MAX_TOKENS = 8000
STEP_MAX_TOKENS = {2: 16000, 5: 12000, 9: 16000, 11: 12000, 12: 16000}

# max_uses is per request. Research ranges wider than verification does.
SEARCH_BUDGET = {2: 10, 5: 8, 12: 12}


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
            kiran_words=(
                KIRAN_WORDS_FRAMING.format(kiran_words=kiran_words)
                if (step == YOUR_TAKE_STEP and kiran_words) else ""
            ),
            past_posts=(past_posts_summary(state.get("session_id")) if step == 3 else ""),
            ideas=(_format_ideas() if step == 3 else ""),
            rule_findings=(
                format_rule_findings((state["steps"].get(str(WRITE_STEP)) or {}).get("content", ""))
                if step == SCRUB_STEP else ""
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
