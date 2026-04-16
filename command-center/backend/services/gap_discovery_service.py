"""
Gap Discovery Service — 4-step pipeline for analyzing JD coverage against the vault.

Pipeline:
  1. extract_requirements() — Parse JD into structured requirements via Claude
  2. map_coverage() — Match requirements against initiatives vault
  3. classify_gaps() — Assign fill tier + prescription to uncovered requirements
  4. generate_report() — Orchestrate full pipeline into a GapAnalysisReport

Also handles:
  - push_gaps_to_table() — Create Mind the Gap entries from discovered gaps
  - analyze_batch() — Aggregate intelligence across multiple JDs (Phase 4)

Tables used:
  - evidence_gap_items (Mind the Gap) — via evidence_service for gap creation
  - initiatives.json (Career Vault) — loaded from file
"""

import json
import os
import uuid
import logging
import time
from datetime import datetime, timezone
from typing import Optional, List, Dict, Tuple
from collections import Counter

from utils.config import CLAUDE_MODEL, resolve_api_key, get_logger, data_dir
from utils.exceptions import ExternalServiceError

logger = get_logger(__name__)


# ── Initiative Loading ────────────────────────────────────────────

INITIATIVES_PATH = os.path.join(
    os.path.dirname(__file__), "..", "data", "career_initiatives", "initiatives.json"
)


def _load_initiatives() -> List[Dict]:
    """Load career initiatives from the vault JSON file."""
    try:
        with open(INITIATIVES_PATH, "r") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load initiatives: {e}")
        return []


def _build_initiative_catalog(initiatives: List[Dict]) -> str:
    """Build a compact text catalog of initiatives for Claude prompts."""
    lines = []
    for i, init in enumerate(initiatives):
        domains = ", ".join(init.get("domains", []))
        metrics = "; ".join(
            f"{m['number']} {m['label']}" for m in init.get("outcome_metrics", [])
        )
        lines.append(
            f"[{i}] ID={init.get('id','')} | {init['title']} ({init.get('company','')}, {init.get('role','')}) "
            f"| domains: {domains} | metrics: {metrics}\n"
            f"    Problem: {init.get('problem','')[:120]}\n"
            f"    Shipped: {init.get('shipped','')[:120]}\n"
            f"    Outcome: {init.get('outcome','')[:120]}"
        )
    return "\n\n".join(lines)


# ── Claude API Helpers ────────────────────────────────────────────


def _call_claude(client, prompt: str, max_tokens: int = 2000, system: str = None) -> str:
    """Call Claude with retry logic for transient errors."""
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
                wait_time = (attempt + 1) * 2
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


# ── Step 1: Requirement Extraction ────────────────────────────────


def extract_requirements(client, jd_text: str, company: Optional[str] = None, role_title: Optional[str] = None) -> Tuple[List[Dict], str, str]:
    """
    Parse a JD into structured requirements.

    Returns:
        (requirements, company, role_title)
        - requirements: list of {requirement, category, signal_strength}
        - company: extracted or provided company name
        - role_title: extracted or provided role title
    """
    prompt = f"""Analyze this job description and extract ALL requirements.

For each requirement, provide:
- requirement: the specific requirement (concise, 5-15 words)
- canonical_key: a short kebab-case normalized key (2-5 words) that groups semantically identical requirements across different JDs. Examples: "cross-functional-leadership", "ab-testing-experimentation", "sql-proficiency", "3-plus-years-pm-experience", "ml-model-understanding", "stakeholder-management", "data-driven-decision-making", "mobile-app-experience", "agile-scrum-methodology", "technical-api-understanding". Two different JDs asking for the same underlying skill MUST produce the same canonical_key.
- category: one of "experience", "domain", "skill", "tool"
  - experience = years of experience, leadership, team size, company type
  - domain = industry knowledge (fintech, AI/ML, mobile, payments, etc.)
  - skill = capabilities (product strategy, A/B testing, roadmapping, etc.)
  - tool = specific tools or technologies (SQL, Figma, Jira, etc.)
- signal_strength: "hard" (explicitly required) or "soft" (nice-to-have, preferred)

Also extract the company name and role title.

Return JSON:
{{
  "company": "Company Name",
  "role_title": "Role Title",
  "requirements": [
    {{"requirement": "...", "canonical_key": "...", "category": "...", "signal_strength": "..."}}
  ]
}}

Job Description:
{jd_text}"""

    response_text = _call_claude(client, prompt, max_tokens=2000)
    parsed = _parse_json_response(response_text)

    extracted_company = company or parsed.get("company", "Unknown")
    extracted_role = role_title or parsed.get("role_title", "Unknown Role")
    requirements = parsed.get("requirements", [])

    logger.info(f"Extracted {len(requirements)} requirements from {extracted_company} / {extracted_role}")
    return requirements, extracted_company, extracted_role


# ── Step 2: Coverage Mapping ──────────────────────────────────────


def map_coverage(client, requirements: List[Dict], initiatives: List[Dict]) -> List[Dict]:
    """
    For each requirement, determine coverage level from the vault.

    Coverage levels:
    - strong: 2+ initiatives with direct evidence
    - partial: 1 initiative with tangential evidence
    - articulable: No shipped artifact, but Kiran has the experience (hidden competency)
    - gap: No evidence, no experience
    """
    catalog = _build_initiative_catalog(initiatives)

    req_text = "\n".join(
        f"[{i}] {r['requirement']} (category: {r['category']}, signal: {r['signal_strength']})"
        for i, r in enumerate(requirements)
    )

    # ── Fetch resolved false-positives to prevent re-flagging ──
    resolved_context = ""
    try:
        from services.evidence_service import list_gap_items
        all_gaps = list_gap_items()
        resolved = [
            g for g in all_gaps.get("entries", [])
            if g.get("resolution_type") in ("have-it", "reframed")
            and g.get("resolution_note")
        ]
        if resolved:
            lines = []
            for g in resolved:
                lines.append(f"- \"{g['title']}\" → RESOLVED ({g['resolution_type']}): {g['resolution_note']}")
            resolved_context = "\n\nPREVIOUSLY RESOLVED (do NOT flag these as gaps):\n" + "\n".join(lines)
    except Exception as e:
        logger.warning(f"Could not fetch resolved gaps for context: {e}")

    num_initiatives = len(initiatives)
    prompt = f"""You are analyzing how well a candidate's career vault covers a set of job requirements.

CRITICAL CONTEXT: Kiran is currently in his "AI Chapter" (2025-present). During this period, he has built his ENTIRE personal platform (kiranrao.ai), a production AI assistant (Fenix) with tool-use architecture, a 20-module Command Center (Next.js + FastAPI + Supabase), MadLab prototypes (chatbots, apps), and a Gap Coverage System — ALL built using Claude as his sole engineering partner. When a JD asks for "Claude experience", "AI prototyping", "LLM-based product building", or similar — this is STRONG coverage, not a gap. Look for initiatives tagged with "claude" or in the "ai-chapter" era.

CAREER VAULT ({num_initiatives} initiatives):
{catalog}

JOB REQUIREMENTS:
{req_text}
{resolved_context}

For EACH requirement, determine coverage and provide evidence.

Coverage levels:
- "strong": 2+ initiatives directly demonstrate this. Strong, undeniable evidence.
- "partial": 1 initiative partially covers this, or evidence is tangential.
- "articulable": Kiran likely has this experience but it's not documented as a shipped initiative. Hidden competency that could be articulated in an interview or written up.
- "gap": No evidence in the vault and unlikely based on career trajectory.

For each requirement with strong or partial coverage, list the initiative indices [0-{num_initiatives - 1}] that provide evidence with a brief explanation.

Return JSON:
{{
  "coverage": [
    {{
      "requirement_index": 0,
      "coverage": "strong|partial|articulable|gap",
      "evidence": [
        {{
          "initiative_index": N,
          "relevance": "Brief explanation of how this initiative covers the requirement"
        }}
      ],
      "gap_note": "Only for articulable/gap — what's missing or what could be articulated"
    }}
  ]
}}"""

    response_text = _call_claude(client, prompt, max_tokens=4000)
    parsed = _parse_json_response(response_text)
    coverage_list = parsed.get("coverage", [])

    # Merge coverage data back into requirements
    enriched = []
    for i, req in enumerate(requirements):
        cov = next((c for c in coverage_list if c.get("requirement_index") == i), {})
        evidence_refs = []
        for ev in cov.get("evidence", []):
            idx = ev.get("initiative_index", -1)
            if 0 <= idx < len(initiatives):
                init = initiatives[idx]
                metrics = "; ".join(
                    f"{m['number']} {m['label']}" for m in init.get("outcome_metrics", [])
                )
                evidence_refs.append({
                    "initiative_id": init.get("id", ""),
                    "title": init.get("title", ""),
                    "company": init.get("company", ""),
                    "metric": metrics[:100] if metrics else init.get("headline_metric_number", ""),
                    "relevance_explanation": ev.get("relevance", ""),
                })

        enriched.append({
            **req,
            "coverage": cov.get("coverage", "gap"),
            "evidence": evidence_refs,
            "gap_note": cov.get("gap_note"),
        })

    return enriched


# ── Step 3: Gap Classification ────────────────────────────────────


def classify_gaps(client, coverage_results: List[Dict]) -> List[Dict]:
    """
    For requirements with articulable or gap coverage, assign fill tier and prescription.

    4-Tier Fill Strategy:
    - articulate (~hours): Hidden experience not yet written up. Fill by articulating existing knowledge.
    - build-proof (~days): Capability needs a shipped artifact (teardown, blog post, prototype).
    - certify (~weeks): Need structured learning + demonstration project.
    - true-gap (strategic): Years of deep domain experience you genuinely don't have.
    """
    gaps_only = [
        {"index": i, **r}
        for i, r in enumerate(coverage_results)
        if r["coverage"] in ("articulable", "gap")
    ]

    if not gaps_only:
        return coverage_results

    gap_text = "\n".join(
        f"[{g['index']}] {g['requirement']} (category: {g['category']}, coverage: {g['coverage']}, note: {g.get('gap_note', 'N/A')})"
        for g in gaps_only
    )

    prompt = f"""For each gap or articulable requirement below, assign a fill strategy.

REQUIREMENTS WITH GAPS:
{gap_text}

CONTEXT: The candidate is Kiran Rao, a Senior PM with 15+ years in fintech, mobile, AI, and digital transformation. He has extensive Wells Fargo, First Republic, and startup experience.

For each requirement, determine:
- fill_tier: one of "articulate", "build-proof", "certify", "true-gap"
  - articulate (~hours): Kiran HAS this experience but hasn't documented it as a vault initiative. Fix by writing it up or adding it to an interview narrative.
  - build-proof (~days): Kiran has adjacent skills but needs a tangible artifact. Fix by shipping a teardown, blog post, prototype, or case study.
  - certify (~weeks): Kiran needs structured learning in this area. Fix with a course/cert + demonstration project.
  - true-gap (strategic): This requires years of specific domain depth Kiran doesn't have. Acknowledge as a growth area, highlight transferable skills.
- fill_action: specific next step (e.g., "Write up the Apple Pay integration story from Wells Fargo mobile banking")
- fill_time_estimate: realistic time estimate (e.g., "~2 hours", "~1 day", "2-3 weeks")
- fill_output: what artifact gets produced (e.g., "New vault initiative card", "Blog post on kiranrao.ai", "Google Analytics certification")

Return JSON:
{{
  "classifications": [
    {{
      "requirement_index": 0,
      "fill_tier": "...",
      "fill_action": "...",
      "fill_time_estimate": "...",
      "fill_output": "..."
    }}
  ]
}}"""

    response_text = _call_claude(client, prompt, max_tokens=2000)
    parsed = _parse_json_response(response_text)
    classifications = parsed.get("classifications", [])

    # Merge classification data back into coverage results
    for cls in classifications:
        idx = cls.get("requirement_index", -1)
        if 0 <= idx < len(coverage_results):
            coverage_results[idx]["fill_tier"] = cls.get("fill_tier")
            coverage_results[idx]["fill_action"] = cls.get("fill_action")
            coverage_results[idx]["fill_time_estimate"] = cls.get("fill_time_estimate")
            coverage_results[idx]["fill_output"] = cls.get("fill_output")

    return coverage_results


# ── Step 4: Report Assembly ──────────────────────────────────────


def generate_report(
    client,
    jd_text: str,
    company: Optional[str] = None,
    role_title: Optional[str] = None,
    seniority_level: Optional[str] = None,
    role_focus: Optional[str] = None,
    push_to_gap_table: bool = False,
) -> Dict:
    """
    Full pipeline: extract → map → classify → assemble report.

    If push_to_gap_table is True, also creates Mind the Gap entries for new gaps.
    """
    initiatives = _load_initiatives()
    if not initiatives:
        raise ExternalServiceError("Vault", "No career initiatives loaded. Check initiatives.json.")

    # Step 1: Extract requirements
    requirements, extracted_company, extracted_role = extract_requirements(
        client, jd_text, company, role_title
    )

    if not requirements:
        return {
            "report_id": str(uuid.uuid4())[:8],
            "company": extracted_company,
            "role_title": extracted_role,
            "requirements": [],
            "coverage_summary": {
                "total_requirements": 0,
                "strong": 0, "partial": 0, "articulable": 0, "gaps": 0,
                "coverage_pct": 0.0,
            },
            "created_at": datetime.now(timezone.utc).isoformat(),
            "gaps_pushed": 0,
        }

    # Step 2: Map coverage
    coverage_results = map_coverage(client, requirements, initiatives)

    # Step 3: Classify gaps
    classified = classify_gaps(client, coverage_results)

    # Compute summary
    counts = Counter(r["coverage"] for r in classified)
    total = len(classified)
    strong = counts.get("strong", 0)
    partial = counts.get("partial", 0)
    articulable = counts.get("articulable", 0)
    gaps = counts.get("gap", 0)
    coverage_pct = round((strong + partial) / total * 100, 1) if total > 0 else 0.0

    report_id = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()

    # Step 4 (optional): Push gaps to Mind the Gap table
    gaps_pushed = 0
    if push_to_gap_table:
        gaps_pushed = _push_gaps_to_table(
            classified, extracted_company, extracted_role,
            seniority_level=seniority_level, role_focus=role_focus,
        )

    # Save report to disk
    report = {
        "report_id": report_id,
        "company": extracted_company,
        "role_title": extracted_role,
        "seniority_level": seniority_level,
        "role_focus": role_focus,
        "requirements": classified,
        "coverage_summary": {
            "total_requirements": total,
            "strong": strong,
            "partial": partial,
            "articulable": articulable,
            "gaps": gaps,
            "coverage_pct": coverage_pct,
        },
        "created_at": now,
        "gaps_pushed": gaps_pushed,
    }

    _save_report(report)
    logger.info(
        f"Gap report {report_id}: {total} requirements, "
        f"{strong} strong, {partial} partial, {articulable} articulable, {gaps} gaps "
        f"({coverage_pct}% covered) — {gaps_pushed} pushed to Mind the Gap"
    )

    return report


# ── Gap → Mind the Gap Integration ─────────────────────────────


def _push_gaps_to_table(
    classified: List[Dict], company: str, role: str,
    seniority_level: Optional[str] = None, role_focus: Optional[str] = None,
) -> int:
    """Create Mind the Gap entries for newly discovered gaps. Returns count created."""
    from services.evidence_service import list_gap_items, create_gap_item

    existing = list_gap_items()
    existing_titles = {item["title"].lower() for item in existing.get("entries", [])}

    # Skip requirements that match resolved false-positives
    resolved_titles = {
        item["title"].lower()
        for item in existing.get("entries", [])
        if item.get("resolution_type") in ("have-it", "reframed", "not-pursuing")
    }

    created = 0
    for req in classified:
        if req["coverage"] not in ("articulable", "gap"):
            continue

        # Deduplicate by title similarity and skip resolved false-positives
        title = f"{req['requirement']}"
        if title.lower() in existing_titles:
            continue
        if title.lower() in resolved_titles:
            continue

        # Map category to gap item category
        cat_map = {
            "experience": "critical-gap",
            "domain": "domain-specialty",
            "skill": "adjacent-skill",
            "tool": "tool-proficiency",
        }
        category = cat_map.get(req.get("category", ""), "adjacent-skill")

        # Map signal strength to priority
        priority = "high" if req.get("signal_strength") == "hard" else "medium"

        gap_id = f"jd-{str(uuid.uuid4())[:6]}"
        try:
            create_kwargs = dict(
                id=gap_id,
                title=title,
                category=category,
                priority=priority,
                description=req.get("gap_note", ""),
                why_it_matters=f"Required by {company} for {role}",
                current_status="not-started",
                discovered_from="jd-scan",
                source_jd_company=company,
                source_jd_role=role,
                fill_tier=req.get("fill_tier"),
                fill_action=req.get("fill_action"),
                fill_time_estimate=req.get("fill_time_estimate"),
                fill_output=req.get("fill_output"),
                tags=[company.lower().replace(" ", "-")] if company else [],
                sort_order=0,
            )
            if seniority_level:
                create_kwargs["seniority_level"] = seniority_level
            if role_focus:
                create_kwargs["role_focus"] = role_focus
            create_gap_item(**create_kwargs)
            existing_titles.add(title.lower())
            created += 1
        except Exception as e:
            logger.warning(f"Failed to create gap item '{gap_id}': {e}")

    return created


# ── Report Persistence ───────────────────────────────────────────


def _reports_dir() -> str:
    return data_dir("gap_discovery_reports")


def _save_report(report: Dict):
    """Save a report to the filesystem."""
    path = os.path.join(_reports_dir(), f"{report['report_id']}.json")
    with open(path, "w") as f:
        json.dump(report, f, indent=2)


def get_report(report_id: str) -> Optional[Dict]:
    """Load a saved report by ID."""
    path = os.path.join(_reports_dir(), f"{report_id}.json")
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return None


def list_reports(
    limit: int = 20, offset: int = 0,
    seniority_level: Optional[str] = None, role_focus: Optional[str] = None,
) -> Dict:
    """List all saved reports, most recent first. Optionally filter by lens."""
    reports_path = _reports_dir()
    files = sorted(
        [f for f in os.listdir(reports_path) if f.endswith(".json")],
        key=lambda f: os.path.getmtime(os.path.join(reports_path, f)),
        reverse=True,
    )

    # Load all and filter by lens
    all_reports = []
    for fname in files:
        path = os.path.join(reports_path, fname)
        try:
            with open(path, "r") as f:
                report = json.load(f)
            if seniority_level and report.get("seniority_level") != seniority_level:
                continue
            if role_focus and report.get("role_focus") != role_focus:
                continue
            all_reports.append({
                "report_id": report.get("report_id"),
                "company": report.get("company"),
                "role_title": report.get("role_title"),
                "seniority_level": report.get("seniority_level"),
                "role_focus": report.get("role_focus"),
                "coverage_summary": report.get("coverage_summary"),
                "created_at": report.get("created_at"),
                "gaps_pushed": report.get("gaps_pushed", 0),
            })
        except Exception as e:
            logger.warning(f"Failed to load report {fname}: {e}")

    total = len(all_reports)
    page = all_reports[offset:offset + limit]

    return {"reports": page, "total": total, "offset": offset, "limit": limit}


# ── Requirement Canonicalization ────────────────────────────────


def _get_canonical_key(req: Dict) -> Optional[str]:
    """Get the canonical key for a requirement dict.

    Returns the Claude-generated canonical_key if present, else None.
    Requirements without canonical keys are skipped in aggregate analysis
    (they need backfilling via the /backfill-canonical-keys endpoint).
    """
    return req.get("canonical_key")


# ── Coverage Summary (across all reports) ────────────────────────


def get_coverage_summary(
    seniority_level: Optional[str] = None, role_focus: Optional[str] = None,
) -> Dict:
    """Analyze all reports to identify structural patterns across analyzed JDs.
    Optionally filter by seniority_level and/or role_focus lens."""
    reports_path = _reports_dir()
    files = [f for f in os.listdir(reports_path) if f.endswith(".json")]

    if not files:
        return {
            "total_jds_analyzed": 0,
            "strong_domains": [],
            "weak_domains": [],
            "structural_gaps": [],
            "filters": {"seniority_level": seniority_level, "role_focus": role_focus},
        }

    domain_strength = Counter()  # domain → strong/partial count
    domain_weakness = Counter()  # domain → gap count
    # Canonical key → frequency across JDs (each key counted once per JD)
    canonical_freq = Counter()
    # Canonical key → best coverage level seen
    canonical_coverage = {}
    # Canonical key → best human-readable requirement text (longest)
    canonical_labels = {}
    # Canonical key → set of report_ids it appears in (for dedup within same report)
    canonical_reports = {}
    matched_files = 0

    coverage_rank = {"strong": 4, "partial": 3, "articulable": 2, "gap": 1}

    for fname in files:
        path = os.path.join(reports_path, fname)
        try:
            with open(path, "r") as f:
                report = json.load(f)
        except Exception:
            continue

        # Apply lens filters
        if seniority_level and report.get("seniority_level") != seniority_level:
            continue
        if role_focus and report.get("role_focus") != role_focus:
            continue
        matched_files += 1
        report_id = report.get("report_id", fname)

        seen_canonical_in_report = set()

        for req in report.get("requirements", []):
            ckey = _get_canonical_key(req)
            if not ckey:
                # No canonical key — skip for canonical aggregation,
                # but still count for domain stats
                cat = req.get("category", "")
                if req.get("coverage") in ("strong", "partial"):
                    domain_strength[cat] += 1
                elif req.get("coverage") == "gap":
                    domain_weakness[cat] += 1
                continue

            # Count each canonical key once per report (JD)
            if ckey not in seen_canonical_in_report:
                canonical_freq[ckey] += 1
                seen_canonical_in_report.add(ckey)

            # Track best coverage seen for this canonical key
            current_rank = coverage_rank.get(canonical_coverage.get(ckey, "gap"), 1)
            new_rank = coverage_rank.get(req.get("coverage", "gap"), 1)
            if new_rank > current_rank:
                canonical_coverage[ckey] = req["coverage"]

            # Keep the best (longest) human-readable label
            req_text = req["requirement"]
            if ckey not in canonical_labels or len(req_text) > len(canonical_labels[ckey]):
                canonical_labels[ckey] = req_text

            cat = req.get("category", "")
            if req["coverage"] in ("strong", "partial"):
                domain_strength[cat] += 1
            elif req["coverage"] == "gap":
                domain_weakness[cat] += 1

    # Structural gaps: canonical keys appearing in threshold+ JDs
    # with worst coverage being articulable or gap
    structural_gaps = []
    threshold = max(2, int(matched_files * 0.3)) if matched_files >= 5 else 2
    for ckey, freq in canonical_freq.most_common(50):
        if freq >= threshold and canonical_coverage.get(ckey) in ("articulable", "gap"):
            structural_gaps.append({
                "requirement": canonical_labels.get(ckey, ckey),
                "canonical_key": ckey,
                "count": freq,
                "total_reports": matched_files,
                "frequency_pct": round(freq / matched_files * 100, 1) if matched_files else 0,
                "current_coverage": canonical_coverage[ckey],
            })

    # Top strengths: canonical keys that appear frequently with strong/partial coverage
    top_strengths = []
    strength_threshold = max(2, int(matched_files * 0.2)) if matched_files >= 5 else 2
    for ckey, freq in canonical_freq.most_common(50):
        if freq >= strength_threshold and canonical_coverage.get(ckey) in ("strong", "partial"):
            top_strengths.append({
                "skill": canonical_labels.get(ckey, ckey),
                "canonical_key": ckey,
                "count": freq,
                "frequency_pct": round(freq / matched_files * 100, 1) if matched_files else 0,
                "coverage": canonical_coverage[ckey],
            })
    top_strengths = top_strengths[:15]  # Cap at top 15

    # Strong/weak domains based on aggregate counts
    all_domains = set(list(domain_strength.keys()) + list(domain_weakness.keys()))
    strong_domains = [d for d in all_domains if domain_strength[d] > domain_weakness.get(d, 0) * 2]
    weak_domains = [d for d in all_domains if domain_weakness[d] > domain_strength.get(d, 0)]

    return {
        "total_jds_analyzed": matched_files,
        "total_reports": len(files),
        "strong_domains": sorted(strong_domains),
        "weak_domains": sorted(weak_domains),
        "structural_gaps": structural_gaps,
        "top_strengths": top_strengths,
        "filters": {"seniority_level": seniority_level, "role_focus": role_focus},
    }


# ── Canonical Key Backfill ──────────────────────────────────────


def backfill_canonical_keys(client) -> Dict:
    """Add canonical_key to requirements in all existing reports that lack them.

    For each report, collects requirements without canonical_key, sends them
    to Claude in a single batch call asking ONLY for key assignment, then
    writes the keys back into the report JSON on disk.

    Returns summary of how many reports and requirements were updated.
    """
    reports_path = _reports_dir()
    files = [f for f in os.listdir(reports_path) if f.endswith(".json")]

    reports_updated = 0
    reqs_updated = 0
    errors = []

    for fname in files:
        path = os.path.join(reports_path, fname)
        try:
            with open(path, "r") as f:
                report = json.load(f)
        except Exception as e:
            errors.append(f"{fname}: read error: {e}")
            continue

        # Find requirements missing canonical_key
        missing = []
        for i, req in enumerate(report.get("requirements", [])):
            if not req.get("canonical_key"):
                missing.append((i, req["requirement"]))

        if not missing:
            continue  # All requirements already have keys

        # Build a batch prompt for Claude
        req_lines = "\n".join(
            f"[{i}] {text}" for i, text in missing
        )
        prompt = f"""Assign a canonical_key to each requirement below.

A canonical_key is a short kebab-case normalized label (2-5 words) that groups
semantically identical requirements across different job descriptions. Two JDs
asking for the same underlying skill MUST get the same canonical_key.

Examples:
- "Cross-functional collaboration with engineering" → cross-functional-leadership
- "Strong cross-functional leadership across design, data" → cross-functional-leadership
- "5+ years of product management experience" → pm-experience-years
- "7+ years PM experience in consumer products" → pm-experience-years
- "A/B testing and experimentation methodology" → experimentation-ab-testing
- "Experience designing and running experiments" → experimentation-ab-testing
- "Strong SQL and data analysis skills" → sql-data-analysis
- "Data-driven decision making" → data-driven-decisions
- "Stakeholder management across C-suite" → stakeholder-management
- "Machine learning and AI product experience" → ml-ai-product-experience
- "Bachelor's degree in CS or related field" → degree-requirement

Requirements to classify:
{req_lines}

Return JSON:
{{
  "keys": [
    {{"index": 0, "canonical_key": "..."}},
    ...
  ]
}}"""

        try:
            response_text = _call_claude(client, prompt, max_tokens=1500)
            parsed = _parse_json_response(response_text)
            key_map = {k["index"]: k["canonical_key"] for k in parsed.get("keys", [])}

            # Write keys back into report
            updated_count = 0
            for orig_idx, _ in missing:
                if orig_idx in key_map:
                    report["requirements"][orig_idx]["canonical_key"] = key_map[orig_idx]
                    updated_count += 1

            if updated_count > 0:
                with open(path, "w") as f:
                    json.dump(report, f, indent=2)
                reports_updated += 1
                reqs_updated += updated_count
                logger.info(f"Backfilled {updated_count} canonical keys in {fname}")

        except Exception as e:
            errors.append(f"{fname}: Claude call failed: {e}")
            logger.error(f"Backfill failed for {fname}: {e}")

    return {
        "reports_scanned": len(files),
        "reports_updated": reports_updated,
        "requirements_updated": reqs_updated,
        "errors": errors,
    }


# ── Phase 4: Batch Analysis ─────────────────────────────────────


def analyze_batch(
    client,
    jds: List[Dict],
    push_to_gap_table: bool = False,
) -> Dict:
    """
    Analyze multiple JDs and produce aggregate intelligence.

    For each JD, runs the full pipeline. Then aggregates:
    - Requirement frequency across JDs
    - Structural gaps (appear in 50%+ of JDs)
    - Strong/weak domain identification
    """
    per_jd_report_ids = []
    all_requirements = []

    for jd_input in jds:
        try:
            report = generate_report(
                client,
                jd_text=jd_input["jd_text"],
                company=jd_input.get("company"),
                role_title=jd_input.get("role_title"),
                push_to_gap_table=push_to_gap_table,
            )
            per_jd_report_ids.append(report["report_id"])
            all_requirements.extend(report.get("requirements", []))
        except Exception as e:
            logger.error(f"Batch analysis failed for JD ({jd_input.get('company', 'unknown')}): {e}")

    if not all_requirements:
        return {
            "report_id": str(uuid.uuid4())[:8],
            "total_jds": len(jds),
            "structural_gaps": [],
            "strong_domains": [],
            "weak_domains": [],
            "per_jd_reports": per_jd_report_ids,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "gaps_pushed": 0,
        }

    # Aggregate requirement patterns
    req_freq = Counter()
    req_coverage = {}
    req_details = {}
    domain_strength = Counter()
    domain_weakness = Counter()
    total_jds = len(per_jd_report_ids)

    for req in all_requirements:
        norm = req["requirement"].lower().strip()
        req_freq[norm] += 1

        # Track best coverage and source companies
        if norm not in req_details:
            req_details[norm] = {
                "coverage": req["coverage"],
                "fill_tier": req.get("fill_tier"),
                "fill_action": req.get("fill_action"),
                "companies": set(),
            }
        # Use worst-case coverage for structural gap assessment
        coverage_rank = {"gap": 1, "articulable": 2, "partial": 3, "strong": 4}
        if coverage_rank.get(req["coverage"], 1) < coverage_rank.get(req_details[norm]["coverage"], 4):
            req_details[norm]["coverage"] = req["coverage"]
            req_details[norm]["fill_tier"] = req.get("fill_tier")
            req_details[norm]["fill_action"] = req.get("fill_action")

        cat = req.get("category", "")
        if req["coverage"] in ("strong", "partial"):
            domain_strength[cat] += 1
        elif req["coverage"] == "gap":
            domain_weakness[cat] += 1

    # Structural gaps: appear in 50%+ of JDs with gap/articulable coverage
    threshold = max(2, total_jds * 0.5)
    structural_gaps = []
    for norm_req, freq in req_freq.most_common(30):
        details = req_details.get(norm_req, {})
        if freq >= threshold and details.get("coverage") in ("articulable", "gap"):
            structural_gaps.append({
                "requirement_pattern": norm_req,
                "frequency": freq,
                "frequency_pct": round(freq / total_jds * 100, 1),
                "current_coverage": details["coverage"],
                "fill_tier": details.get("fill_tier"),
                "fill_action": details.get("fill_action"),
                "source_companies": list(details.get("companies", [])),
            })

    all_domains = set(list(domain_strength.keys()) + list(domain_weakness.keys()))
    strong_domains = sorted([d for d in all_domains if domain_strength[d] > domain_weakness.get(d, 0) * 2])
    weak_domains = sorted([d for d in all_domains if domain_weakness[d] > domain_strength.get(d, 0)])

    batch_report_id = str(uuid.uuid4())[:8]
    batch_report = {
        "report_id": batch_report_id,
        "total_jds": total_jds,
        "structural_gaps": structural_gaps,
        "strong_domains": strong_domains,
        "weak_domains": weak_domains,
        "per_jd_reports": per_jd_report_ids,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "gaps_pushed": sum(1 for r in all_requirements if r["coverage"] in ("articulable", "gap")),
    }

    # Save batch report
    path = os.path.join(_reports_dir(), f"batch-{batch_report_id}.json")
    with open(path, "w") as f:
        json.dump(batch_report, f, indent=2)

    return batch_report


# ── Initiative-Gap Linkage (Phase 3) ─────────────────────────────


def link_gap_to_initiative(gap_id: str, initiative_id: str) -> Dict:
    """
    Mark a gap as closed by linking it to a vault initiative.

    Updates the gap's closed_by_initiative_id and status to completed.
    Also updates the initiative's closed_gap_id if it exists.
    """
    from services.evidence_service import update_gap_item, get_gap_item

    # Update the gap item
    updated_gap = update_gap_item(
        gap_id,
        closed_by_initiative_id=initiative_id,
        current_status="completed",
    )

    # Try to update the initiative with the gap linkage
    try:
        _update_initiative_gap_link(initiative_id, gap_id)
    except Exception as e:
        logger.warning(f"Failed to update initiative {initiative_id} with gap link: {e}")

    return {
        "gap_id": gap_id,
        "initiative_id": initiative_id,
        "status": "linked",
        "gap": updated_gap,
    }


def _update_initiative_gap_link(initiative_id: str, gap_id: str):
    """Update an initiative's closed_gap_id field."""
    initiatives_path = os.path.join(
        os.path.dirname(__file__), "..", "data", "career_initiatives", "initiatives.json"
    )
    try:
        with open(initiatives_path, "r") as f:
            initiatives = json.load(f)
    except Exception:
        return

    for init in initiatives:
        if init.get("id") == initiative_id:
            init["closed_gap_id"] = gap_id
            init["updated_at"] = datetime.now(timezone.utc).isoformat()
            break

    with open(initiatives_path, "w") as f:
        json.dump(initiatives, f, indent=2)
