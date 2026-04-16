"""
Gap Closure Service — generates company-calibrated closure plans for identified gaps.

Takes a gap × target company pair and produces a 4-section plan:
1. Company Assessment Intelligence
2. Existing Evidence Mining (vault + industry research)
3. Closure Path (sequenced steps)
4. Definition of Done

Plans are stored as JSON on disk at data_dir("gap_closure_plans").
"""

import json
import os
import re
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict
from collections import Counter

from utils.config import CLAUDE_MODEL, resolve_api_key, get_logger, data_dir
from utils.exceptions import ExternalServiceError, NotFoundError

logger = get_logger(__name__)


# ── Paths ──────────────────────────────────────────────────

INITIATIVES_PATH = os.path.join(
    os.path.dirname(__file__), "..", "data", "career_initiatives", "initiatives.json"
)


def _plans_dir() -> str:
    return data_dir("gap_closure_plans")


def _reports_dir() -> str:
    return data_dir("gap_discovery_reports")


# ── Helpers ────────────────────────────────────────────────

def _load_initiatives() -> List[Dict]:
    """Load career initiatives from the vault JSON file."""
    try:
        with open(INITIATIVES_PATH, "r") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load initiatives: {e}")
        return []


def _build_vault_summary(initiatives: List[Dict]) -> str:
    """Build a compact vault summary for the Claude prompt."""
    lines = []
    for init in initiatives:
        domains = ", ".join(init.get("domains", []))
        metrics = "; ".join(
            f"{m['number']} {m['label']}" for m in init.get("outcome_metrics", [])
        )
        lines.append(
            f"ID={init.get('id','')} | {init['title']} ({init.get('company','')}, "
            f"{init.get('date_range', init.get('role',''))}) "
            f"| domains: {domains} | metrics: {metrics}\n"
            f"  Problem: {init.get('problem','')[:200]}\n"
            f"  Shipped: {init.get('shipped','')[:200]}\n"
            f"  Outcome: {init.get('outcome','')[:200]}"
        )
    return "\n\n".join(lines)


def _slugify(text: str) -> str:
    """Convert text to a URL-safe slug."""
    s = text.lower().strip()
    s = re.sub(r'[^a-z0-9\s-]', '', s)
    s = re.sub(r'[\s]+', '-', s)
    return s[:50]


def _call_claude(client, prompt: str, max_tokens: int = 4000, system: str = None) -> str:
    """Call Claude with retry logic."""
    import time
    messages = [{"role": "user", "content": prompt}]
    kwargs = {
        "model": CLAUDE_MODEL,
        "max_tokens": max_tokens,
        "messages": messages,
    }
    if system:
        kwargs["system"] = system

    for attempt in range(3):
        try:
            response = client.messages.create(**kwargs)
            return response.content[0].text.strip()
        except Exception as e:
            error_str = str(e)
            is_retryable = any(code in error_str for code in ["529", "overloaded", "rate_limit", "429"])
            if is_retryable and attempt < 2:
                wait_time = (attempt + 1) * 3
                logger.warning(f"Claude API retryable error (attempt {attempt + 1}/3): {error_str[:100]}. Retrying in {wait_time}s...")
                time.sleep(wait_time)
                continue
            raise ExternalServiceError("Claude API", str(e))


def _parse_json_response(text: str) -> dict:
    """Parse Claude's JSON response, stripping markdown fences if present."""
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return json.loads(text.strip())


def _get_gap_from_supabase(gap_id: str) -> Dict:
    """Fetch a gap item from Supabase."""
    from services.evidence_service import get_gap_item
    return get_gap_item(gap_id)


def _find_company_reports(company: str) -> List[Dict]:
    """Load all gap discovery reports for a specific company."""
    reports = []
    reports_path = _reports_dir()
    if not os.path.exists(reports_path):
        return reports
    for fname in os.listdir(reports_path):
        if not fname.endswith(".json"):
            continue
        try:
            with open(os.path.join(reports_path, fname), "r") as f:
                report = json.load(f)
            if report.get("company", "").lower() == company.lower():
                reports.append(report)
        except Exception:
            continue
    return reports


def _find_gap_across_reports() -> Dict[str, List[str]]:
    """Build a map of canonical_key → list of companies that have this gap."""
    key_companies = {}
    reports_path = _reports_dir()
    if not os.path.exists(reports_path):
        return key_companies
    for fname in os.listdir(reports_path):
        if not fname.endswith(".json"):
            continue
        try:
            with open(os.path.join(reports_path, fname), "r") as f:
                report = json.load(f)
            company = report.get("company", "Unknown")
            for req in report.get("requirements", []):
                ckey = req.get("canonical_key")
                if ckey and req.get("coverage") in ("articulable", "gap"):
                    if ckey not in key_companies:
                        key_companies[ckey] = []
                    if company not in key_companies[ckey]:
                        key_companies[ckey].append(company)
        except Exception:
            continue
    return key_companies


def _load_target_company_tiers() -> Dict[str, str]:
    """Load company → tier mapping from target_companies.json."""
    target_companies_path = os.path.join(
        os.path.dirname(__file__), "..", "data", "target_companies.json"
    )
    tiers = {}
    try:
        if os.path.exists(target_companies_path):
            with open(target_companies_path, "r") as f:
                tc_data = json.load(f)
            for c in tc_data if isinstance(tc_data, list) else tc_data.get("companies", []):
                tiers[c.get("name", "").lower()] = c.get("tier", "target")
    except Exception:
        pass
    return tiers


# Tier ranking — higher number = more demanding bar
TIER_BAR_RANK = {
    "dream": 5,       # Anthropic, OpenAI, Google, Apple, NVIDIA
    "target": 3,       # Stripe, Airbnb, Netflix, etc.
    "target-big-tech": 4,  # Microsoft
    "consulting": 2,   # McKinsey, BCG, etc.
}


def _select_highest_bar_company(companies: List[str], company_tiers: Dict[str, str]) -> str:
    """Pick the most demanding company from a list, based on tier ranking.

    Logic: dream > target-big-tech > target > consulting.
    Within the same tier, prefer the first alphabetically (stable sort).
    """
    if not companies:
        return "General"

    ranked = sorted(
        companies,
        key=lambda c: (-TIER_BAR_RANK.get(company_tiers.get(c.lower(), "target"), 2), c),
    )
    return ranked[0]


# ── Core: Generate Closure Plan ────────────────────────────


CAREER_CONTEXT = """
Kiran Rao's Career Timeline (for mining existing experience):

1. CONSULTING ERA (~2012-2015): Deloitte / similar firms
   - Cross-industry strategy and digital transformation engagements
   - Client-facing delivery, stakeholder management, business case development
   - Exposure to multiple industries: financial services, healthcare, telecom, retail

2. FIRST REPUBLIC BANK (~2015-2018): Premium banking / wealth management
   - Digital products, client experience, mobile banking
   - High-touch client relationship culture, white-glove service model
   - Fintech partnerships, digital onboarding, client portal experiences

3. WELLS FARGO (~2018-2022): Large-scale banking / platform
   - Mobile banking, digital transformation at massive scale
   - Platform architecture, API integrations, cross-org program management
   - Regulatory environment, compliance, enterprise-grade systems
   - Led initiatives touching millions of users across consumer and commercial lines

4. AI CHAPTER (2025-present): Independent / personal platform
   - Full-stack product + AI development with Claude
   - Built kiranrao.ai, Fenix AI, Command Center, MadLab prototypes
   - Demonstrates hands-on technical ability + product thinking with AI/ML

IMPORTANT: Exact dates and initiative details should come from the vault data provided separately.
The vault may contain details that aren't obvious from job titles — dig into each initiative
for angles that could cover the gap being analyzed.
"""


def generate_closure_plan(
    client,
    gap_id: str,
    target_company: Optional[str] = None,
    role_focus: Optional[str] = None,
) -> Dict:
    """
    Generate a closure plan for a gap, calibrated to the highest-bar company.

    If target_company is not provided, automatically selects the most demanding
    company (by tier: dream > target-big-tech > target > consulting) from the
    companies that have this gap. Closing the gap at the highest bar means
    every other company is satisfied too.

    Steps:
    1. Fetch gap details from Supabase
    2. Find which companies have this gap + auto-select calibration target
    3. Load vault initiatives
    4. Load calibration company's JD report(s) for context
    5. Call Claude with a structured prompt
    6. Save plan to disk
    """
    # 1. Fetch gap
    gap = _get_gap_from_supabase(gap_id)
    gap_title = gap.get("title", "Unknown Gap")
    gap_description = gap.get("description", "")
    gap_category = gap.get("category", "")
    gap_fill_tier = gap.get("fill_tier", "")
    gap_canonical_key = gap.get("canonical_key") or _slugify(gap_title)

    # 2. Determine calibration target
    # Each gap item comes from a specific company's JD analysis.
    # Use that company as the calibration target (it's the company whose
    # bar we need to clear). If target_company is explicitly provided, use that.
    company_tiers = _load_target_company_tiers()
    source_company = gap.get("source_jd_company", "")

    if not target_company:
        target_company = source_company or "General"

    calibration_tier = company_tiers.get(target_company.lower(), "target")

    # Also check which other companies have similar gaps (for context)
    gap_across = _find_gap_across_reports()
    matching_companies = gap_across.get(gap_canonical_key, [])
    if not matching_companies:
        title_slug = _slugify(gap_title)
        for key, companies in gap_across.items():
            if title_slug == key:
                matching_companies = companies
                break

    other_companies = [c for c in matching_companies if c != target_company]
    companies_str = ", ".join(matching_companies) if matching_companies else source_company or "Not tracked across other JDs yet"

    # 3. Load vault
    initiatives = _load_initiatives()
    vault_summary = _build_vault_summary(initiatives) if initiatives else "No vault data available."

    # 4. Load calibration company's JD report context
    company_reports = _find_company_reports(target_company)
    company_jd_context = ""
    if company_reports:
        report = company_reports[0]
        reqs = report.get("requirements", [])
        req_lines = [
            f"- {r['requirement']} (coverage: {r['coverage']}, category: {r['category']})"
            for r in reqs[:30]
        ]
        company_jd_context = (
            f"JD analyzed for {target_company}: {report.get('role_title', 'Unknown Role')}\n"
            f"Requirements found ({len(reqs)} total):\n" + "\n".join(req_lines)
        )

    # 5. Build the Claude prompt
    system_prompt = (
        "You are a career strategy advisor and interview coach helping a Senior PM (15+ years experience) "
        "build evidence to close identified gaps. You calibrate to the MOST DEMANDING "
        "company that requires this competency — if the evidence clears that bar, "
        "every other company is satisfied automatically.\n\n"
        "Your closure plans are the COMPLETE MANUAL. When Kiran finishes working through your plan, "
        "two things must be true: (1) his career vault has a rich, detailed record that an AI assistant "
        "can reference to answer any question about this skill area, and (2) his interview prep stories "
        "are written in STAR format, grounded in real work, ready to rehearse.\n\n"
        "Every step must be granular enough that Kiran knows EXACTLY what to produce — not 'write a case study' "
        "but 'write a 500-word case study with these 4 sections, here's what good looks like, here's a model "
        "to follow.' The plan is the guide AND the template."
    )

    prompt = f"""Generate a detailed closure plan for this gap, calibrated to the highest-bar company.

## THE GAP
- Title: {gap_title}
- Description: {gap_description}
- Category: {gap_category}
- Current fill tier: {gap_fill_tier}
- Appears at these companies: {companies_str}

## CALIBRATION TARGET
- Company: {target_company} (tier: {calibration_tier} — selected as the most demanding evaluator)
- Also closes this gap for: {', '.join(other_companies) if other_companies else 'no other companies tracked'}
{f"- Role focus: {role_focus}" if role_focus else ""}

The plan must clear {target_company}'s bar. If it convinces {target_company}, it convinces everyone else.

{f"## CALIBRATION COMPANY JD CONTEXT{chr(10)}{company_jd_context}" if company_jd_context else ""}

## KIRAN'S CAREER CONTEXT
{CAREER_CONTEXT}

## KIRAN'S VAULT (all documented initiatives)
{vault_summary}

---

## WHAT THE PLAN MUST PRODUCE

By the time Kiran completes this plan, two outputs must exist:

**OUTPUT 1: A rich vault record** that an AI assistant (Fenix) can draw from to answer questions like "Tell me about Kiran's experience with [this gap area]." The vault record needs:
- A compelling description (3-5 sentences: what was built/done, why, at what scale)
- Tech stack or methodologies used
- 4-6 display skills this evidence demonstrates
- A highlight (the single most impressive detail — a metric, a scale number, an insight)
- A tagline (one punchy sentence for card display)

**OUTPUT 2: Interview-ready STAR stories** (3-5 stories) that Kiran can rehearse and deliver. Each story must be:
- Grounded in REAL experience from the vault, or real work done during this closure plan
- Calibrated to what {target_company} interviewers specifically probe for
- Detailed enough to survive 2-3 follow-up questions ("How did you decide that?" / "What was the tradeoff?" / "What would you do differently?")

The closure path steps are HOW Kiran gets there. Every step either (a) mines existing experience to surface evidence, or (b) creates NEW evidence that didn't exist before.

---

Generate the closure plan as JSON:

{{
  "company_assessment": {{
    "interview_process": "How {target_company} specifically evaluates this competency (behavioral? case study? system design? portfolio?) — the format, the round, what they're looking for",
    "signals_they_look_for": "The specific signals their interviewers screen for when evaluating THIS competency. Not generic PM skills. Reference their product, scale, org structure, and culture.",
    "operating_level_bar": "What a Senior PM at {target_company} does day-to-day in this area. The scale, the complexity, the types of decisions. This is the altitude — the evidence must demonstrate comfort at this altitude.",
    "internal_examples": ["2-4 specific examples from {target_company}'s product, engineering blog, talks, case studies, or public work that show how they approach this area internally. These help Kiran understand the flavor and calibrate his narrative."],
    "likely_interview_questions": ["3-5 ACTUAL questions {target_company} interviewers would ask about this competency. Not generic — specific to their product, scale, and interview culture. E.g., 'Walk me through how you would instrument analytics for a feature that serves 2B daily events' not 'Tell me about a time you used data.'"]
  }},
  "existing_evidence": {{
    "vault_matches": [
      {{
        "initiative_id": "ID from vault",
        "title": "Initiative title",
        "company": "Company name",
        "what_it_proves": "Exactly which dimension of the gap this initiative addresses",
        "reframe_angle": "The specific narrative angle to use. Not 'mention this' but a 2-3 sentence reframing: 'Lead with the fact that WF's mobile platform serves 27M active users. Frame the [specific feature] as a [gap topic] challenge: you had to [specific constraint], chose [specific approach], measured success by [specific metric]. This directly maps to how {target_company} thinks about [gap topic].'",
        "key_metrics_to_cite": ["Specific numbers from this initiative that relate to the gap"],
        "follow_up_prep": "The hardest follow-up question an interviewer would ask about this story, and how to handle it"
      }}
    ],
    "hidden_experience": "Experience Kiran likely HAS from his roles at Wells Fargo, First Republic, Amazon, and consulting but hasn't documented. What was happening at those companies during his tenure that relates to this gap? Be specific about era, team, and context — help Kiran recognize experience he hasn't yet articulated.",
    "storytelling_framework": "The narrative structure for THIS specific gap at THIS specific company. Not generic STAR. A specific story arc: 'Open with [context that shows scale]. Present the problem as a [gap-area] challenge — what made it hard was [specific tension]. Walk through YOUR approach: [decision framework used], [alternatives considered and why rejected], [what you built/shipped]. Land the outcome with [metric type] at [scale]. The punchline that makes {target_company} lean forward: [specific insight or result].' "
  }},
  "closure_path": [
    {{
      "step_type": "reframe|orient|build|certify|publish|synthesize",
      "title": "Short action title",
      "description": "Exactly what to do, step by step. If it's 'write something', specify the structure (sections, word count, what each section covers). If it's 'build something', specify the scope, tech approach, and what 'done' looks like. If it's 'study something', specify what to read and what to extract from it.",
      "what_good_looks_like": "A concrete example or model of the output. E.g., 'A good analytics case study has 4 sections: (1) Context — 2 sentences on the product and scale, (2) The Question — what you were trying to learn and why it was hard, (3) The Approach — event taxonomy, cohort definition, analysis method, tools used, (4) The Insight — what you found and the product decision it drove. See [specific public example] for the caliber to aim for.'",
      "prototype_idea": "If this step involves building something, describe the specific prototype/artifact. What is it? What does it demonstrate? How complex should it be? What's the minimum viable version vs the impressive version? If this step doesn't involve building, set to null.",
      "resources": [
        {{"title": "Resource name", "url": "URL if available", "type": "article|course|certification|book|tool|example", "what_to_extract": "What specifically to get from this resource — not 'learn about X' but 'extract their framework for Y and adapt it to Z'"}}
      ],
      "time_estimate": "Realistic time (hours or days)",
      "vault_fields_fed": ["Which vault record fields this step produces content for. One or more of: description, tech_stack, display_skills, highlight, tagline, learned, capstone"],
      "artifacts": ["Concrete deliverables — a document, a repo, talking points, a writeup, a certification"]
    }}
  ],
  "vault_record_draft": {{
    "type": "prototype|certification|project|teardown",
    "name": "Evidence title for the vault card",
    "tagline": "One punchy sentence for card display (15 words max)",
    "description": "3-5 sentence description. [Mark sections where Kiran needs to fill in specifics from his actual work with BRACKETS like [insert your metric here]]",
    "tech_stack": ["Technologies, methodologies, or frameworks involved"],
    "display_skills": ["4-6 skills this evidence demonstrates — use terms that match JD language"],
    "highlight": "The single most impressive detail. [Include placeholder for Kiran's actual metric/outcome]",
    "status": "Draft — will be finalized after closure",
    "learned": "For certifications: what the certification covered and the key insight. For prototypes/projects: the key technical or strategic learning.",
    "capstone": "For certifications: the capstone project. For prototypes: the demo scenario. Null if not applicable."
  }},
  "interview_stories": [
    {{
      "question": "The interview question this story answers (from likely_interview_questions above)",
      "story_title": "A short label for this story (e.g., 'WF Mobile Analytics Overhaul')",
      "situation": "STAR S — 2-3 sentences. Specific context: company, team, product, scale, timeframe. [Brackets for details Kiran needs to fill in]",
      "task": "STAR T — 1-2 sentences. The specific challenge or goal. What made it hard. The constraint that made it interesting.",
      "action": "STAR A — 3-5 sentences. What Kiran specifically did. Decisions made, frameworks used, tradeoffs navigated. Be concrete about tools, approaches, and WHY each choice was made.",
      "result": "STAR R — 2-3 sentences. Measurable outcome. [Placeholder for Kiran's actual metrics]. Business impact. What changed because of this work.",
      "follow_ups": [
        {{
          "question": "A drill-down question the interviewer would ask after hearing this story",
          "answer_guidance": "How to handle it — what to emphasize, what to avoid, what the interviewer is really testing"
        }}
      ],
      "source_initiatives": ["vault initiative IDs this story draws from"],
      "confidence": "high|medium|low — how much of this story is based on existing vault evidence vs. needs new work from the closure path"
    }}
  ],
  "definition_of_done": {{
    "artifacts_checklist": ["Every artifact that must exist when the gap is closed — vault record, STAR stories, any prototypes or certifications"],
    "vault_record_complete": "The self-check: 'If someone asks Fenix about my [gap area] experience, can it give a specific, metric-backed, story-rich answer? Or does it have to hedge?'",
    "interview_ready": "The self-check: 'Can I deliver each STAR story fluently, handle 2-3 follow-up questions on each, and pivot between stories if the interviewer redirects? Can I do this for {target_company} specifically and also for {', '.join(other_companies[:3]) if other_companies else 'other target companies'}?'",
    "self_assessment_prompt": "The toughest question: 'If a {target_company} interviewer asked me [specific hardest question about this gap], could I talk for 3 minutes with specifics, metrics, and real examples without breaking a sweat?'"
  }}
}}

CRITICAL INSTRUCTIONS:
- The closure path must be SEQUENCED — each step builds on the previous one.
- Prioritize reframe steps first (mine existing experience before building new).
- The LAST step should always be step_type "synthesize" — this is where all the evidence gets assembled into the final vault record and interview stories.
- Each step's "what_good_looks_like" must be genuinely useful — a template, an example, a model to follow. Not "make it good."
- vault_record_draft should be as complete as possible using existing vault data, with [BRACKETS] for what Kiran needs to fill in after doing the work.
- interview_stories should draw from real vault initiatives wherever possible. Mark confidence level honestly.
- Resources should be REAL and SPECIFIC — actual course names, actual blog posts, actual tools. Not "find a good resource on X."
- Calibrate EVERYTHING to {target_company}'s bar. This company is the hardest evaluator — if the evidence works here, it works everywhere.
- For industry_research/hidden_experience: focus on Kiran's actual tenures. What was happening at Wells Fargo (2015-2019), First Republic (2019-2021), Amazon/consulting during his career that relates to this gap?
- Each interview story must survive the follow-up test: after the candidate gives the STAR answer, the interviewer says "interesting — tell me more about [hardest part]." Is the story deep enough?
"""

    # 6. Call Claude
    response_text = _call_claude(client, prompt, max_tokens=8000, system=system_prompt)
    plan_data = _parse_json_response(response_text)

    # 7. Assemble the plan — one plan per gap (not per gap × company)
    plan_id = f"{gap_id}--closure"
    now = datetime.now(timezone.utc).isoformat()

    plan = {
        "id": plan_id,
        "gap_id": gap_id,
        "gap_title": gap_title,
        "gap_canonical_key": gap_canonical_key,
        "calibrated_to": target_company,
        "calibration_tier": calibration_tier,
        "target_company": target_company,  # Keep for backward compat
        "role_focus": role_focus,
        "company_assessment": plan_data.get("company_assessment", {}),
        "existing_evidence": plan_data.get("existing_evidence", {}),
        "closure_path": [
            {**step, "status": "pending", "journal_note": None}
            for step in plan_data.get("closure_path", [])
        ],
        "vault_record_draft": plan_data.get("vault_record_draft", {}),
        "interview_stories": plan_data.get("interview_stories", []),
        "definition_of_done": plan_data.get("definition_of_done", {}),
        "created_at": now,
        "updated_at": now,
        "companies_affected": matching_companies,
        "gap_frequency": len(matching_companies) if matching_companies else None,
        "closure_journal": [],
    }

    # 8. Save to disk
    _save_plan(plan)
    logger.info(
        f"Closure plan generated: {plan_id} | gap='{gap_title}' | calibrated to '{target_company}' ({calibration_tier}) | "
        f"{len(plan.get('closure_path', []))} steps | affects {len(matching_companies)} companies"
    )

    return plan


# ── CRUD Operations ────────────────────────────────────────


def _save_plan(plan: Dict):
    """Save a closure plan to the filesystem."""
    path = os.path.join(_plans_dir(), f"{plan['id']}.json")
    with open(path, "w") as f:
        json.dump(plan, f, indent=2)


def get_closure_plan(plan_id: str) -> Optional[Dict]:
    """Load a saved closure plan by ID."""
    path = os.path.join(_plans_dir(), f"{plan_id}.json")
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return None


def list_closure_plans(
    gap_id: Optional[str] = None,
    company: Optional[str] = None,
) -> Dict:
    """List all saved closure plans, optionally filtered."""
    plans_path = _plans_dir()
    if not os.path.exists(plans_path):
        return {"plans": [], "total": 0}

    files = sorted(
        [f for f in os.listdir(plans_path) if f.endswith(".json")],
        key=lambda f: os.path.getmtime(os.path.join(plans_path, f)),
        reverse=True,
    )

    plans = []
    for fname in files:
        try:
            with open(os.path.join(plans_path, fname), "r") as f:
                plan = json.load(f)
            if gap_id and plan.get("gap_id") != gap_id:
                continue
            if company and plan.get("target_company", "").lower() != company.lower():
                continue

            # Return summary, not the full plan
            steps = plan.get("closure_path", [])
            done_count = sum(1 for s in steps if s.get("status") == "done")
            plans.append({
                "id": plan["id"],
                "gap_id": plan.get("gap_id"),
                "gap_title": plan.get("gap_title"),
                "calibrated_to": plan.get("calibrated_to", plan.get("target_company")),
                "calibration_tier": plan.get("calibration_tier"),
                "target_company": plan.get("target_company"),
                "role_focus": plan.get("role_focus"),
                "total_steps": len(steps),
                "done_steps": done_count,
                "created_at": plan.get("created_at"),
                "updated_at": plan.get("updated_at"),
                "companies_affected": plan.get("companies_affected", []),
            })
        except Exception as e:
            logger.warning(f"Failed to load closure plan {fname}: {e}")

    return {"plans": plans, "total": len(plans)}


def update_step_status(
    plan_id: str,
    step_index: int,
    status: str,
    journal_note: Optional[str] = None,
) -> Dict:
    """Update the status of a specific step in a closure plan.
    Also logs to the closure_journal for trail-keeping."""
    plan = get_closure_plan(plan_id)
    if not plan:
        raise NotFoundError(f"Closure plan '{plan_id}' not found")

    steps = plan.get("closure_path", [])
    if step_index < 0 or step_index >= len(steps):
        raise ValueError(f"Step index {step_index} out of range (0-{len(steps)-1})")

    # Update the step
    steps[step_index]["status"] = status
    if journal_note:
        steps[step_index]["journal_note"] = journal_note

    plan["closure_path"] = steps
    plan["updated_at"] = datetime.now(timezone.utc).isoformat()

    # Add to closure journal
    journal_entry = {
        "timestamp": plan["updated_at"],
        "action": f"Step {step_index} ({steps[step_index].get('title', '')}) → {status}",
        "note": journal_note or "",
    }
    if "closure_journal" not in plan:
        plan["closure_journal"] = []
    plan["closure_journal"].append(journal_entry)

    # Check if all steps are done — if so, auto-create vault entry and finalize
    all_done = all(s.get("status") in ("done", "skipped") for s in steps)
    if all_done:
        plan["all_steps_complete"] = True
        journal_entry_complete = {
            "timestamp": plan["updated_at"],
            "action": "All closure steps complete — gap ready for resolution update",
            "note": "Consider updating the gap's resolution_type in Mind the Gap",
        }
        plan["closure_journal"].append(journal_entry_complete)

        # Auto-create rich vault entry from vault_record_draft
        vault_draft = plan.get("vault_record_draft")
        if vault_draft and vault_draft.get("name"):
            try:
                _finalize_vault_from_plan(plan)
                plan["closure_journal"].append({
                    "timestamp": plan["updated_at"],
                    "action": "Vault record auto-created from closure plan draft",
                    "note": f"Source: {vault_draft.get('name')} ({vault_draft.get('type', 'project')})",
                })
            except Exception as e:
                logger.warning(f"Failed to auto-create vault entry from plan: {e}")
                plan["closure_journal"].append({
                    "timestamp": plan["updated_at"],
                    "action": f"Vault record auto-creation failed: {str(e)[:100]}",
                    "note": "Create manually from the vault_record_draft",
                })

    _save_plan(plan)
    return plan


def _finalize_vault_from_plan(plan: Dict):
    """Create a rich vault entry from the plan's vault_record_draft.

    This creates both the evidence_sources entry AND the detail record
    (evidence_item_details or evidence_cert_details) so Fenix has real
    content to work with, not just a thin stub.
    """
    from services.evidence_service import (
        create_source, upsert_item_detail, upsert_cert_detail,
        create_link, list_skills,
    )

    draft = plan.get("vault_record_draft", {})
    if not draft or not draft.get("name"):
        return

    gap_id = plan.get("gap_id", "unknown")
    source_id = f"closure-{gap_id}"
    source_type = draft.get("type", "project")

    # Map draft types to evidence_sources types
    type_map = {"prototype": "prototype", "certification": "certification", "project": "project", "teardown": "teardown"}
    ev_type = type_map.get(source_type, "project")

    # 1. Create the evidence_sources entry
    try:
        create_source(
            id=source_id,
            label=draft.get("name", f"Gap Closure: {plan.get('gap_title', gap_id)}"),
            type=ev_type,
            issuer=plan.get("calibrated_to", "Self"),
            year=str(datetime.now().year),
            url=None,
        )
    except Exception as e:
        if "already exists" not in str(e).lower() and "duplicate" not in str(e).lower():
            raise
        logger.info(f"Source {source_id} already exists, updating details only")

    # 2. Create the rich detail record
    if ev_type == "certification":
        upsert_cert_detail({
            "source_id": source_id,
            "display_skills": draft.get("display_skills", []),
            "learned": draft.get("learned", ""),
            "capstone": draft.get("capstone", ""),
        })
    else:
        upsert_item_detail({
            "source_id": source_id,
            "description": draft.get("description", ""),
            "tech_stack": draft.get("tech_stack", []),
            "display_skills": draft.get("display_skills", []),
            "highlight": draft.get("highlight", ""),
            "tagline": draft.get("tagline", ""),
        })

    # 3. Link to relevant skills based on display_skills text matching
    try:
        all_skills = list_skills()
        skill_entries = all_skills.get("entries", [])
        skill_labels = {s["label"].lower(): s["id"] for s in skill_entries}
        for ds in draft.get("display_skills", []):
            ds_lower = ds.lower()
            for label, skill_id in skill_labels.items():
                if ds_lower in label or label in ds_lower:
                    try:
                        create_link(source_id=source_id, skill_id=skill_id)
                    except Exception:
                        pass  # Link may already exist
                    break
    except Exception as e:
        logger.warning(f"Skill linking failed for {source_id}: {e}")

    logger.info(f"Vault entry finalized from closure plan: {source_id} ({ev_type})")

    # Push to RAG embeddings (Layer 3) so Fenix can find this evidence
    try:
        from services.evidence_embedding_service import embed_evidence_source, embed_closure_plan_narrative
        embed_evidence_source(source_id)
        embed_closure_plan_narrative(plan)
        logger.info(f"Evidence pushed to RAG embeddings: {source_id}")
    except Exception as e:
        logger.warning(f"RAG embedding push failed for {source_id}: {e} (vault entry still created)")


def get_prioritized_gaps() -> List[Dict]:
    """Return all unresolved gaps scored and ranked by closure priority.

    Each gap item stays individual (no merging/dedup — the 197 Supabase rows
    are genuinely distinct gaps from different company JD scans). Scoring ranks
    them by:
      (a) tier weight of the source company (dream > target > consulting)
      (b) priority level (critical > high > medium > low)
      (c) fill_tier difficulty (articulate easiest → true-gap hardest)

    The source company comes from the gap's own `source_jd_company` field.
    The highest-bar company is selected for closure calibration context.
    """
    from services.evidence_service import list_gap_items

    # Get all unresolved gaps
    all_gaps = list_gap_items()
    unresolved = [
        g for g in all_gaps.get("entries", [])
        if g.get("resolution_type") not in ("have-it", "reframed", "built-proof", "certified", "not-pursuing")
        and g.get("current_status") not in ("closed", "completed", "deprioritized")
    ]

    company_tiers = _load_target_company_tiers()

    TIER_WEIGHTS = {
        "dream": 5,
        "target": 3,
        "target-big-tech": 4,
        "consulting": 2,
    }

    PRIORITY_RANK = {"critical": 4, "high": 3, "medium": 2, "low": 1}

    # ── Score each gap individually ────────────────────────

    scored = []
    for gap in unresolved:
        src_company = gap.get("source_jd_company") or ""
        src_tier = company_tiers.get(src_company.lower(), "target")

        # Company tier weight — how demanding is the source company?
        company_score = TIER_WEIGHTS.get(src_tier, 2)

        # Priority weight
        priority_score = PRIORITY_RANK.get(gap.get("priority", "low"), 0) * 3

        # Fill tier penalty — harder gaps rank higher (they need more work)
        tier_bonus = {
            "true-gap": 5,
            "certify": 3,
            "build-proof": 1,
            "articulate": 0,
        }.get(gap.get("fill_tier", ""), 0)

        total_score = company_score + priority_score + tier_bonus

        # Build entry with all gap fields + scoring metadata
        entry = {
            "gap_id": gap["id"],
            "source_company": src_company,
            "source_tier": src_tier,
            "calibrated_to": src_company or "General",
            "score": total_score,
            "existing_plans": [],
        }
        # Pass through all fields from the gap item
        for field in (
            "id", "title", "category", "subcategory", "priority",
            "persona_relevance", "description", "why_it_matters",
            "current_status", "provider", "provider_url", "cost",
            "time_estimate", "alternative_sources", "demonstration_idea",
            "demonstration_type", "portfolio_value", "tags", "sort_order",
            "created_at", "updated_at", "resolution_type", "resolution_note",
            "fill_tier", "source_jd_company",
        ):
            if field not in entry:
                entry[field] = gap.get(field)

        scored.append(entry)

    # Sort by score descending
    scored.sort(key=lambda x: x["score"], reverse=True)

    # ── Attach existing plans ───────────────────────────────

    existing_plans = list_closure_plans()
    plan_map = {}
    for p in existing_plans.get("plans", []):
        gid = p.get("gap_id")
        if gid not in plan_map:
            plan_map[gid] = []
        plan_map[gid].append({
            "plan_id": p["id"],
            "calibrated_to": p.get("calibrated_to", p.get("target_company")),
            "done_steps": p.get("done_steps", 0),
            "total_steps": p.get("total_steps", 0),
        })

    for item in scored:
        item["existing_plans"] = plan_map.get(item["gap_id"], [])

    return scored


# ── Interview Prep Generation ──────────────────────────────

def generate_interview_prep(client, gap_id: str) -> Dict:
    """Generate interview questions and prepared STAR answers for a gap.

    Returns the updated gap item with interview_questions and prepared_answers populated.
    """
    gap = _get_gap_from_supabase(gap_id)
    gap_title = gap.get("title", "Unknown")
    gap_description = gap.get("description", "")
    gap_category = gap.get("category", "")
    fill_tier = gap.get("fill_tier", "")
    source_company = gap.get("source_jd_company", "")
    source_role = gap.get("source_jd_role", "")
    resolution_type = gap.get("resolution_type")
    fill_action = gap.get("fill_action", "")
    fill_output = gap.get("fill_output", "")

    # Load vault for evidence context
    initiatives = _load_initiatives()
    vault_summary = _build_vault_summary(initiatives) if initiatives else "No vault data available."

    is_closed = resolution_type in {"have-it", "reframed", "built-proof", "certified", "not-pursuing", "not-a-gap"}

    system_prompt = (
        "You are an interview coach for a Senior PM (15+ years experience, ex-Amazon, ex-startup). "
        "You generate REALISTIC interview questions that companies actually ask for PM roles, "
        "and prepare STAR-format answers grounded in real career experience from the vault. "
        "Be specific — use real initiative names, real metrics, real product decisions. "
        "Never make up experience."
    )

    prompt = f"""Generate interview prep for this skill/gap area.

## GAP / SKILL AREA
- Title: {gap_title}
- Description: {gap_description}
- Category: {gap_category}
- Fill tier: {fill_tier}
- Source: {source_company}{f' — {source_role}' if source_role else ''}
- Resolution: {resolution_type or 'open'}
{f'- Fill action taken: {fill_action}' if fill_action else ''}
{f'- Fill output: {fill_output}' if fill_output else ''}

## KIRAN'S CAREER CONTEXT
{CAREER_CONTEXT}

## KIRAN'S VAULT
{vault_summary}

---

Return a JSON object with exactly this shape:
{{
  "interview_questions": [
    {{
      "question": "The actual interview question as an interviewer would phrase it",
      "why_they_ask": "What the interviewer is really testing for — the hidden signal",
      "signal": "What a strong answer demonstrates"
    }}
  ],
  "prepared_answers": [
    {{
      "question": "Same question text (must match the question above)",
      "situation": "STAR S — specific context from Kiran's real experience",
      "task": "STAR T — the specific challenge or goal",
      "action": "STAR A — what Kiran specifically did (be concrete, mention tools/frameworks/decisions)",
      "result": "STAR R — measurable outcome with metrics where possible"
    }}
  ]
}}

Generate 3-5 questions that are:
1. Realistic for senior PM interviews at companies like {source_company or 'top tech companies'}
2. Specifically about this skill area ({gap_title})
3. {"Answerable with existing evidence since this gap is resolved" if is_closed else "Forward-looking — what questions WILL they ask, and what partial answers does Kiran have now"}

{"For each question, provide a prepared STAR answer drawing from Kiran's vault. Use REAL initiatives and REAL metrics." if is_closed else "For each question, provide the BEST answer Kiran can give today — even if partial. Note where the answer is thin and what additional evidence would strengthen it."}

Return ONLY valid JSON, no markdown fences."""

    raw = _call_claude(client, prompt, max_tokens=4000, system=system_prompt)
    result = _parse_json_response(raw)

    questions = result.get("interview_questions", [])
    answers = result.get("prepared_answers", [])

    # Save to Supabase
    from services.evidence_service import _get_client
    sb = _get_client()
    sb.table("evidence_gap_items").update({
        "interview_questions": questions,
        "prepared_answers": answers,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", gap_id).execute()

    return {
        "gap_id": gap_id,
        "gap_title": gap_title,
        "interview_questions": questions,
        "prepared_answers": answers,
    }
