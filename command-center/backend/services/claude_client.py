"""
Claude Client Service — Handles all Claude API interactions for the resume pipeline.

Accepts API key per-request via X-Claude-Key header. Never stores the key.
Contains 7 purpose-built prompt templates for:
1. JD Analysis
2. Resume Customization (bullets, summary, skills)
3. Match Score & Gap Analysis
4. Cover Letter
5. Interview Question Bank
6. Strategy Proposal (research + proposed changes)
7. Refined Resume Content (with user feedback)
"""

import json
from typing import Optional
from anthropic import Anthropic
from utils.config import CLAUDE_MODEL


KIRAN_BACKGROUND = """
Kiran Gorapalli is a product leader with 15+ years of experience across mobile, AI, fintech,
and digital transformation. He has led teams at Wells Fargo, First Republic Bank, Starbucks,
Hilton, and other enterprise companies. Key accomplishments include:
- Scaled a flagship mobile app from 18M to 32M users (4.9 App Store rating)
- Led AI integration driving $52M+ in projected savings
- Managed $27.5M product portfolio across mobile banking, payments, and digital platforms
- Certified ScrumMaster (CSM), Kellogg Executive Education, General Assembly Product Management
- Expert in: product strategy, roadmap ownership, cross-functional leadership, A/B testing,
  data-driven decision making, stakeholder management, agile methodologies
- Currently targeting Senior PM roles at top tech companies

RESERVE ACHIEVEMENTS — additional accomplishments that can be swapped in when they align
with a specific job description. Use these selectively when the JD emphasizes the relevant
skill area. These are real achievements that were trimmed from baseline templates for brevity
but remain valid and available:

MAGLEY & ASSOCIATES reserves (consulting era, Dec 2008 – Aug 2012):
- PM angle: Advised executive stakeholders on platform modernization, agile transformation, and roadmap execution to accelerate time-to-market.
- PM angle: Implemented UX design, process reengineering, and change management initiatives to launch high-impact customer-facing platforms.
- PMM angle: Advised executives on GTM strategy, positioning, and launch roadmap execution to accelerate time-to-market.
- PMM angle: Established launch campaigns, content strategy, and adoption initiatives to drive high-impact customer-facing platform launches.
- PjM angle: Drove agile adoption: introduced sprint retrospectives, standups, and PI Planning, accelerating time-to-market.
- PjM angle: Established change management and process optimization initiatives to deliver high-impact customer-facing platforms.

FIRST REPUBLIC reserves (Apr 2016 – Oct 2023):
- PM angle: Built AI compliance engine, improving regulatory adherence by 90%.
- PMM angle: Built market rationale for AI compliance tooling, improving regulatory adherence by 90%.
- PjM angle: Launched AI compliance engine on schedule, improving regulatory adherence by 90%.

When a JD emphasizes change management, platform modernization, UX/process reengineering,
GTM strategy, agile transformation, or compliance/regulatory technology, consider swapping
one of these reserve bullets in place of a weaker baseline bullet for that company section.

IMPORTANT TITLE CONTEXT: Kiran's career is primarily in banking/financial services.
In banking, VP and Director titles are seniority bands, NOT indicators of management scope.
A VP at Wells Fargo or First Republic is often an individual contributor — it's equivalent to
a Senior or Staff-level role in tech. Kiran was an IC in his most recent role at Wells Fargo
despite holding a VP-level title. When framing his experience, treat his banking titles as
seniority indicators (like L6/L7 in tech), not as proof of large management spans.
"""


HUMAN_WRITING_RULES = """
ANTI-AI-WRITING RULES — the resume must read as human-written:
1. NO em dashes (—). Use commas, periods, or rewrite the sentence.
2. NO semicolons joining clauses in bullets. Keep bullets as single, punchy statements.
3. BANNED overused AI verbs: "Leveraged", "Utilized", "Orchestrated", "Synergized", "Facilitated",
   "Harnessed", "Endeavored", "Pioneered" (unless truly accurate). Prefer plain strong verbs:
   built, ran, grew, cut, shipped, owned, led, launched, reduced, drove, managed, created, designed.
4. BANNED AI filler words: "robust", "holistic", "cutting-edge", "innovative", "comprehensive",
   "transformative", "best-in-class", "world-class", "state-of-the-art", "seamlessly".
5. VARY bullet structure. NOT every bullet should follow "Verb + what + resulting in + metric".
   Mix it up: some lead with outcome, some are shorter without metrics, some describe scope.
   A few bullets without numbers is FINE for non-quantifiable work (vision, partnerships, process).
6. Write like a human PM describes their work to a hiring manager — direct, specific, no corporate fluff.
   Bad: "Orchestrated cross-functional alignment across stakeholder groups to realize strategic objectives"
   Good: "Aligned 4 teams around a shared product roadmap, cutting planning cycles from 6 weeks to 2"
7. NO excessive parallelism — if 5 bullets all start with the same grammatical pattern
   (e.g., "Led X resulting in Y", "Led X resulting in Y"), vary the sentence structure.
8. Summaries should sound conversational and confident, not like a LinkedIn AI-generated headline.

ATS & RECRUITER OPTIMIZATION RULES:
9. EXACT KEYWORD MATCH — use the JD's exact phrasing for key skills and tools, not synonyms.
   If the JD says "product roadmap" write "product roadmap", not "strategic plan". If it says
   "A/B testing" write "A/B testing", not "experimentation framework". ATS systems match literally.
10. FRONT-LOAD IMPACT — recruiters scan the first 3-4 words of each bullet. Put the most
    impressive element (metric, scope, outcome) near the start, not buried at the end.
    Bad: "Managed the migration process that ultimately reduced costs by 40%"
    Good: "Cut infrastructure costs 40% by leading a 6-month cloud migration"
11. SHOW SCOPE & OWNERSHIP — hiring managers look for seniority signals. Include team size,
    budget, user base, or org scope where relevant. "Led" vs "contributed to" vs "owned" signal
    very different levels. Be precise: "Owned the checkout funnel (12M monthly transactions)"
    not "Worked on payment features".
12. RECENCY WEIGHTING — the most recent 2 roles matter most. Give them the strongest,
    most JD-aligned bullets. Older roles (3+ back) can be more general and shorter.
    The first company a recruiter reads should immediately make them think "this person fits."
13. NO RESPONSIBILITY DESCRIPTIONS — never write "Responsible for..." or "Duties included...".
    Every bullet should describe what you DID and what HAPPENED, not what your job description said.
    Bad: "Responsible for managing the product backlog and sprint planning"
    Good: "Ran 2-week sprints for a 9-person team, shipping 3 major features per quarter"
14. QUANTIFY THOUGHTFULLY — not every number is impressive. "Attended 50+ meetings" adds nothing.
    Metrics should show impact: revenue, users, efficiency, speed, cost savings, adoption rate.
    If a metric doesn't make the reader think "that's impressive", leave it out.

CONTENT INTEGRITY RULES — never fabricate or embellish:
15. ZERO FABRICATION — every metric, number, dollar amount, user count, team size, and percentage
    in the output MUST come from either the template bullet or the KIRAN_BACKGROUND context.
    If the source bullet says "Led mobile app redesign" you CANNOT add "$8M revenue impact"
    unless that number exists in the background. When in doubt, describe scope without a number.
16. REFRAME, DON'T INVENT — you may rephrase, reorder, emphasize, and reframe existing
    accomplishments to better match the JD. You may NOT create new accomplishments, projects,
    or outcomes that aren't grounded in the source material.
17. SKILLS MUST BE REAL — only list skills, tools, and methodologies that appear in the template
    or KIRAN_BACKGROUND. Do not add skills just because the JD asks for them. If Kiran doesn't
    have a skill, the match score should reflect the gap honestly rather than the resume faking it.
18. VERB ACCURACY — "Led" means actually led. "Built" means actually built. Don't upgrade
    "contributed to" into "owned" or "supported" into "drove" unless the source material supports it.
    Inflating ownership level is as misleading as inventing a metric.
"""


IC_REFRAMING_RULES = """
IC ROLE REFRAMING RULES — this role is an Individual Contributor position.
Kiran's background includes VP and Director titles from banking, where those titles are
standard seniority bands (like L6/L7 in tech) — NOT indicators of large management spans.
Kiran was an IC in his most recent role at Wells Fargo despite holding a VP-level title.
These rules ensure the resume is framed for IC-level execution while leveraging this context.

IC-1. LEAD WITH EXECUTION, NOT MANAGEMENT — every bullet should emphasize what Kiran personally
     built, shipped, analyzed, or decided — not how many people reported to him.
     Bad: "Led a team of 12 PMs across 3 product lines"
     Good: "Drove 0-to-1 product launches across 3 verticals, generating $X ARR"

IC-2. REFRAME TEAM SIZE AS COLLABORATION SCOPE — instead of "managed 12 reports", say
     "partnered with 12 engineers and designers" or "aligned 4 cross-functional teams".
     Show influence without authority, not hierarchical control.

IC-3. MINIMIZE MANAGEMENT LANGUAGE — avoid or reduce: "managed", "supervised", "oversaw",
     "directed reports", "built the team", "hired", "org building", "span of control".
     Prefer: "owned", "drove", "shipped", "built", "designed", "ran", "executed", "delivered".

IC-4. SUMMARY MUST SIGNAL IC FIT — the professional summary should frame Kiran as a
     high-impact hands-on PM who CHOOSES to be close to the product, not as a leader
     stepping down. Frame leadership experience as "breadth of context" and "strategic depth"
     that makes him a stronger IC, not as management experience.
     Bad: "VP of Product seeking to return to individual contributor work"
     Good: "Product leader with 15+ years shipping consumer and enterprise products,
            combining strategic vision with hands-on execution across mobile, AI, and fintech"

IC-5. KEEP REAL TITLES — do NOT change actual job titles (VP, Director, etc.) on the resume.
     In banking, these are seniority bands equivalent to Senior/Staff in tech. Changing them
     would be dishonest and problematic in background checks. Let the BULLETS underneath
     those titles do the reframing work by emphasizing execution over management.

IC-6. BANKING TITLE CONTEXT — when the target role is at a tech company or non-bank,
     acknowledge that banking VP/Director titles differ from tech usage. The cover letter
     or summary can subtly signal this by emphasizing hands-on product work and IC delivery
     within those roles. Do NOT explicitly say "VP in banking means something different" but
     DO make the IC nature of the work obvious through the bullet content.

IC-7. CAREER HIGHLIGHTS SHOULD SHOWCASE CRAFT — pick highlights that demonstrate product
     craft, technical depth, and shipped outcomes rather than org-building or team-scaling.
     "Scaled app from 18M to 32M users" > "Built and managed a 15-person product org"

IC-8. SKILLS SECTION — prioritize hands-on skills (PRD writing, user research, A/B testing,
     SQL, prototyping, sprint management) over leadership skills (team building, hiring,
     executive stakeholder management). The JD's required skills should appear first.
"""


def _ic_rules_block(jd_analysis: dict) -> str:
    """Return IC_REFRAMING_RULES if the JD is detected as an IC role, else empty string."""
    if jd_analysis.get("is_ic_role"):
        signals = jd_analysis.get("ic_signals", [])
        signals_note = ""
        if signals:
            signals_note = f"\nIC signals detected: {', '.join(signals)}\n"
        return f"\n{IC_REFRAMING_RULES}{signals_note}"
    return ""


def create_client(api_key: str) -> Anthropic:
    """Create an Anthropic client with the provided API key."""
    return Anthropic(api_key=api_key)


async def analyze_jd(api_key: str, jd_text: str) -> dict:
    """Step 2: Analyze the job description and extract structured requirements."""
    client = create_client(api_key)

    message = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=2000,
        messages=[{
            "role": "user",
            "content": f"""Analyze this job description and extract structured information.
Return a JSON object with these fields:

{{
  "job_title": "exact title from the JD",
  "company": "company name",
  "seniority": "IC/Manager/Director/VP + estimated level (L5/L6/L7)",
  "is_ic_role": true/false,
  "ic_signals": ["list of clues that this is an IC role, e.g. 'no direct reports mentioned', 'says individual contributor', 'title is Senior PM not Director', 'emphasizes hands-on execution'. Empty list if not IC."],
  "domain": "industry/vertical (e.g., fintech, social, productivity)",
  "key_requirements": ["list of must-have skills and experiences"],
  "keywords": ["specific phrases and terms from the JD to weave into the resume"],
  "technical_skills": ["tools, frameworks, methodologies mentioned"],
  "soft_skills": ["leadership, communication, stakeholder management signals"],
  "metrics_orientation": "what kind of outcomes the role cares about (revenue, engagement, efficiency, etc.)",
  "summary": "5-10 line analysis of what this role needs and how Kiran's background maps to it"
}}

IC ROLE DETECTION GUIDANCE:
A role is IC (Individual Contributor) if ANY of these are true:
- Title is Senior PM, Staff PM, Principal PM, or Product Manager (without Director/VP/Head prefix)
- JD explicitly says "individual contributor" or "no direct reports"
- JD emphasizes hands-on execution: writing PRDs, running sprints, doing user research personally
- JD does NOT mention team management, hiring, or org building
- JD focuses on a single product area rather than a portfolio
Set is_ic_role=true if the role is clearly IC. Set false if it involves managing other PMs or building teams.

IMPORTANT NOTE: In banking/financial services, VP and Director titles are seniority bands (like L6/L7 in tech),
NOT management indicators. A VP at a bank is often an IC. If the TARGET role has a banking VP/Director title,
it may still be IC. Look at the actual responsibilities described, not just the title.

JOB DESCRIPTION:
{jd_text}"""
        }],
    )

    # Parse JSON from response
    text = message.content[0].text
    # Try to extract JSON from the response
    try:
        # Look for JSON block
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        return json.loads(text)
    except json.JSONDecodeError:
        return {"raw_analysis": text, "error": "Could not parse structured JSON"}


async def generate_resume_content(
    api_key: str,
    jd_analysis: dict,
    template_structure: dict,
    persona: str,
    version: str,
    jd_text: str = "",
) -> dict:
    """Step 5: Generate customized resume content (summary, bullets, skills order)."""
    client = create_client(api_key)

    # Build per-company bullet count instructions
    experience_entries = template_structure.get("experience_entries", [])
    if experience_entries:
        bullet_spec_lines = []
        for entry in experience_entries:
            bullet_spec_lines.append(
                f"  - \"{entry['header_text'][:80]}\" → EXACTLY {entry['bullet_count']} bullets"
            )
        bullet_spec = "\n".join(bullet_spec_lines)
        experience_keys_example = ",\n    ".join(
            f'"{entry["header_text"].split("|")[1].strip().split(",")[0].strip() if "|" in entry["header_text"] else entry["header_text"][:30]}": [exactly {entry["bullet_count"]} bullets]'
            for entry in experience_entries
        )
    else:
        bullet_spec = "  (No specific counts available — match the original template)"
        experience_keys_example = '"Company Name": ["bullet 1", "bullet 2", ...]'

    message = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=4000,
        messages=[{
            "role": "user",
            "content": f"""You are customizing a resume for Kiran Gorapalli.

KIRAN'S BACKGROUND:
{KIRAN_BACKGROUND}

RAW JOB DESCRIPTION:
{jd_text if jd_text else "(not provided — rely on the analysis below)"}

JD ANALYSIS:
{json.dumps(jd_analysis, indent=2)}

RESUME TEMPLATE INFO:
- Persona: {persona}
- Version: {version}
- Template has {template_structure['total_paragraphs']} paragraphs
- Sections found: {json.dumps([s['text'] for s in template_structure['sections']])}

EXPERIENCE ENTRIES — you MUST generate EXACTLY this many bullets per company:
{bullet_spec}

RULES — these are non-negotiable:
1. ZERO repeated action verbs. Every bullet must start with a DIFFERENT verb across the entire resume.
2. Keep bullets under 120 characters. Aim for 90-110 chars.
3. Compact metrics: 27.5M not 27.5 M, 15K not 15 K, 40% not 40%.
4. Include Certified ScrumMaster (CSM) when the JD mentions Agile/Scrum.
5. CRITICAL: The number of bullets per company MUST EXACTLY match the counts above. Do not add or remove bullets.
6. Weave JD keywords naturally — don't force them.
7. Use a company name substring as the key in experience_bullets (e.g., "Wells Fargo Strategy", "First Republic", "Avatour", "Magley"). The key must appear in the header text above.

SUMMARY & TAGLINE RULES:
The tagline and summary are the highest-value real estate on the resume. Recruiters fixate on the top 3 lines first.

TAGLINE (all formats): Rewrite to mirror the JD's title and priority signals. Max 20 words. Must convey identity, scale, and domain breadth. Echo the JD's exact title language — if they say "Growth PM" include "growth" prominently.

SUMMARY (2-pager and detailed only — skip if the template has no SUMMARY section):
- Sentence 1: Domain authority + career scope (years, what you do, where).
- Sentence 2: Signature achievement with quantified metric. Pick the 2 most JD-relevant metrics from this arsenal:
  * 18M to 32M MAU (for growth/consumer/mobile roles)
  * 27.5M AI interactions (for AI/ML roles)
  * 3.2x TAM expansion (for startup/strategy roles)
  * $20M portfolio (for enterprise/P&L roles)
  * 18% YoY revenue (for revenue/business impact roles)
  * 40+ A/B tests (for experimentation/data-driven roles)
- Sentence 3: Versatility signal tuned to the target company type:
  * Startup: emphasize 0-to-1, pivot, TAM expansion, speed
  * Enterprise: emphasize scale, portfolio size, P&L
  * Growth: emphasize MAU growth, experimentation, conversion
  * AI: emphasize AI product shipping, interaction scale
- NEVER start with "Results-driven" or "Dynamic" or any adjective-first opener.
- NEVER use "passionate about" or "dedicated to."
- NEVER list skills in the summary.
- NEVER include more than 3 metrics. Two is ideal.
- Mirror the top 2-3 JD keywords naturally in the first two sentences.
- No employer names unless strategically justified (e.g., applying to another bank).
- 2-pager: 40-60 words. Detailed: 60-100 words.

Return a JSON object:
{{
  "tagline": "rewritten tagline (max 20 words) mirroring the JD title and priorities",
  "summary": "2-3 sentence professional summary following the rules above (or null if template has no SUMMARY section)",
  "career_highlights": ["list of 3-4 highlight bullets for the CAREER HIGHLIGHTS section"],
  "experience_bullets": {{
    {experience_keys_example}
  }},
  "skills_priority": ["ordered list of skills to prioritize based on JD"],
  "notes": "any notes about editing decisions"
}}

{HUMAN_WRITING_RULES}{_ic_rules_block(jd_analysis)}

Make bullets specific, quantified, and action-oriented. Start each with a unique action verb."""
        }],
    )

    text = message.content[0].text
    try:
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        return json.loads(text)
    except json.JSONDecodeError:
        return {"raw_content": text, "error": "Could not parse structured JSON"}


async def generate_pre_match_score(api_key: str, jd_text: str, jd_analysis: dict) -> int:
    """Quick pre-customization match score — just a number from 0-100."""
    client = create_client(api_key)

    message = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=200,
        messages=[{
            "role": "user",
            "content": f"""Score how well Kiran Gorapalli's BASELINE resume matches this role, BEFORE any customization.

KIRAN'S BACKGROUND (as-is, not tailored):
{KIRAN_BACKGROUND}

JD ANALYSIS:
{json.dumps(jd_analysis, indent=2)}

Return ONLY a JSON object: {{"score": <number 0-100>, "rationale": "<one sentence>"}}
Be honest — this is the raw template match, not a customized version. Most raw matches should be 50-75."""
        }],
    )

    text = message.content[0].text
    try:
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        result = json.loads(text)
        return result.get("score", 60)
    except (json.JSONDecodeError, AttributeError):
        return 60  # fallback


async def generate_match_score(api_key: str, jd_text: str, jd_analysis: dict) -> str:
    """Step 8: Generate match score and gap analysis as markdown."""
    client = create_client(api_key)

    message = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=4000,
        messages=[{
            "role": "user",
            "content": f"""Generate a Match Score & Gap Analysis for Kiran Gorapalli against this role.

KIRAN'S BACKGROUND:
{KIRAN_BACKGROUND}

JD ANALYSIS:
{json.dumps(jd_analysis, indent=2)}

JOB DESCRIPTION:
{jd_text}

Write a professional document with these sections:

# Match Score: [X]/100
Brief rationale for the score based on keyword coverage, seniority alignment, domain relevance, skills match.

## Strengths (3-5 bullet points)
Where Kiran's background strongly aligns. Be specific with evidence.

## Gaps & Mitigations (3-5 bullet points)
Each gap paired with a mitigation strategy or talking point.

## Talking Points (2-3 suggestions)
Narrative angles for the interview that play to Kiran's strengths.

## Gap-Closing Resources
For each gap identified above, provide 2-3 specific learning resources to help close that gap.
Format each as:
### [Gap Name]
- **[Resource Title]** — [URL] — [1-sentence description of what you'll learn]

Focus on: free/affordable online courses (Coursera, Udemy, LinkedIn Learning), official documentation,
industry blogs, YouTube channels, and books. Use REAL, well-known resources — do not invent URLs.
Prefer resources that can be completed in 1-4 weeks, not 6-month programs.

Be honest about gaps. Don't inflate the score. A realistic assessment is more useful."""
        }],
    )

    return message.content[0].text


async def audit_resume_content(api_key: str, resume_text: str, jd_analysis: dict) -> dict:
    """Post-generation audit — checks final resume text against all 18 rules."""
    client = create_client(api_key)

    message = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=3000,
        messages=[{
            "role": "user",
            "content": f"""You are a strict QA auditor. Review this FINAL resume text against every rule below.
Flag ANY violations. Be thorough — this is the last check before the resume goes out.

FINAL RESUME TEXT:
{resume_text}

KIRAN'S BACKGROUND (ground truth):
{KIRAN_BACKGROUND}

JD CONTEXT:
Company: {jd_analysis.get('company', 'Unknown')}
Role: {jd_analysis.get('job_title', 'Unknown')}

RULES TO CHECK:
{HUMAN_WRITING_RULES}{_ic_rules_block(jd_analysis)}

ADDITIONAL CHECKS:
- Are there any metrics/numbers that do NOT appear in the background context or template? (potential fabrication)
- Are any action verbs repeated across bullets?
- Are any bullets over 120 characters?
- If this is an IC role (is_ic_role={jd_analysis.get('is_ic_role', False)}): do any bullets over-emphasize management hierarchy (e.g., "managed 12 direct reports", "built the team") instead of execution? Flag as IC-reframing warnings.

Return a JSON object:
{{
  "passed": true/false,
  "score": <0-100 quality score>,
  "violations": [
    {{"rule": "<rule number or name>", "text": "<the offending text>", "suggestion": "<how to fix it>"}}
  ],
  "warnings": [
    {{"issue": "<description>", "text": "<the relevant text>", "suggestion": "<recommendation>"}}
  ],
  "summary": "1-2 sentence overall assessment"
}}

If the resume is clean, return passed=true with an empty violations array. Be strict but fair."""
        }],
    )

    resp_text = message.content[0].text
    try:
        if "```json" in resp_text:
            resp_text = resp_text.split("```json")[1].split("```")[0]
        elif "```" in resp_text:
            resp_text = resp_text.split("```")[1].split("```")[0]
        return json.loads(resp_text)
    except json.JSONDecodeError:
        return {"passed": True, "score": 80, "violations": [], "warnings": [], "summary": "Could not parse audit results"}


async def extract_ats_keywords(api_key: str, jd_analysis: dict, resume_text: str) -> dict:
    """Extract JD keywords and check which appear in the final resume."""
    client = create_client(api_key)

    message = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=2000,
        messages=[{
            "role": "user",
            "content": f"""Analyze keyword coverage between this job description and resume.

JD ANALYSIS (keywords and requirements):
{json.dumps(jd_analysis, indent=2)}

FINAL RESUME TEXT:
{resume_text}

Extract the important ATS keywords from the JD, then check which ones appear in the resume.

Return a JSON object:
{{
  "total_keywords": <number>,
  "matched_count": <number>,
  "coverage_pct": <number 0-100>,
  "matched": ["keyword1", "keyword2", ...],
  "missing": ["keyword3", "keyword4", ...],
  "critical_missing": ["any must-have keywords that are missing — these could hurt your application"]
}}

Focus on: hard skills, tools, methodologies, domain terms, and role-specific phrases.
Do NOT include generic words like "team", "experience", "communication".
Order critical_missing by importance (most damaging gap first)."""
        }],
    )

    resp_text = message.content[0].text
    try:
        if "```json" in resp_text:
            resp_text = resp_text.split("```json")[1].split("```")[0]
        elif "```" in resp_text:
            resp_text = resp_text.split("```")[1].split("```")[0]
        return json.loads(resp_text)
    except json.JSONDecodeError:
        return {"total_keywords": 0, "matched_count": 0, "coverage_pct": 0, "matched": [], "missing": [], "critical_missing": []}


async def generate_cover_letter(api_key: str, jd_text: str, jd_analysis: dict) -> str:
    """Step 9: Generate a tailored cover letter as markdown."""
    client = create_client(api_key)

    message = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=2000,
        messages=[{
            "role": "user",
            "content": f"""Write a tailored cover letter for Kiran Gorapalli.

KIRAN'S BACKGROUND:
{KIRAN_BACKGROUND}

JD ANALYSIS:
{json.dumps(jd_analysis, indent=2)}

JOB DESCRIPTION:
{jd_text}

RULES:
- Address to "Dear Hiring Manager" unless a name is in the JD
- Open with a specific, compelling hook — NOT "I'm excited to apply"
- 3-4 paragraphs total, fitting on one page
- Mirror the JD's language naturally
- Highlight 2-3 specific accomplishments mapped to the JD's top requirements
- Close with confidence and a clear call to action
- Professional but warm tone
- AVOID cliches: "I believe I would be a great fit", "I am passionate about"
- Show fit through specific examples, not generic enthusiasm

Write the full letter text (no markdown headers, just the letter body)."""
        }],
    )

    return message.content[0].text


async def generate_company_brief(api_key: str, jd_analysis: dict) -> str:
    """Step 10: Generate a company research brief as markdown."""
    client = create_client(api_key)
    company = jd_analysis.get("company", "Unknown Company")

    message = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=3000,
        messages=[{
            "role": "user",
            "content": f"""Write a company research brief for {company} to help prepare for a job interview.

JD ANALYSIS:
{json.dumps(jd_analysis, indent=2)}

KIRAN'S BACKGROUND:
{KIRAN_BACKGROUND}

Cover these sections:

## Company Overview
Mission, founding year, HQ, size, public/private, funding/market cap.

## Leadership
CEO and key leaders relevant to the role.

## Core Products
What they build, primary products/services, where this role fits.

## Recent News & Launches
Last 6-12 months of notable events (use your knowledge up to your training cutoff).

## Competitive Landscape
3-5 key competitors and differentiation.

## Culture & Values
Values, work style, what employees say.

## Why This Role Matters
How it connects to current company strategy.

## Kiran's Angle
2-3 talking points connecting Kiran's background to this company's challenges.

Keep it 2-3 pages worth of content. Be specific and practical."""
        }],
    )

    return message.content[0].text


async def generate_interview_questions(api_key: str, jd_text: str, jd_analysis: dict) -> str:
    """Step 11: Generate an interview question bank as markdown."""
    client = create_client(api_key)
    company = jd_analysis.get("company", "Unknown Company")

    message = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=4000,
        messages=[{
            "role": "user",
            "content": f"""Create an interview question bank for Kiran Gorapalli preparing for a
{jd_analysis.get('job_title', 'Product Manager')} role at {company}.

JD ANALYSIS:
{json.dumps(jd_analysis, indent=2)}

JOB DESCRIPTION:
{jd_text}

KIRAN'S BACKGROUND:
{KIRAN_BACKGROUND}

Include these sections:

## Role-Specific Questions (8-10)
Common questions for this role type at this company. For each, include a brief note (1-2 sentences)
on what the interviewer is looking for and how Kiran might approach it.

## Behavioral Questions (5-7)
STAR-format behavioral questions this company likely asks. Include prep guidance.

## Company-Specific Questions (3-5)
Questions unique to this company's interview process, values, or current challenges.

## Questions to Ask the Interviewer (5)
Smart questions showing research and genuine interest. Not generic questions.

Make questions specific to the role and company, not generic PM interview questions."""
        }],
    )

    return message.content[0].text


async def generate_strategy_proposal(
    api_key: str,
    jd_text: str,
    jd_analysis: dict,
    template_structure: dict,
    persona: str,
    version: str,
) -> dict:
    """
    Phase 1 — Research + Strategy Proposal.
    Analyzes the company, role, and template, then produces:
    - A strategy summary explaining the customization approach
    - The actual proposed bullet text changes for user review
    """
    client = create_client(api_key)

    # Build per-company bullet count instructions
    experience_entries = template_structure.get("experience_entries", [])
    if experience_entries:
        bullet_spec_lines = []
        for entry in experience_entries:
            bullet_spec_lines.append(
                f"  - \"{entry['header_text'][:80]}\" → EXACTLY {entry['bullet_count']} bullets"
            )
        bullet_spec = "\n".join(bullet_spec_lines)
        experience_keys_example = ",\n    ".join(
            f'"{entry["header_text"].split("|")[1].strip().split(",")[0].strip() if "|" in entry["header_text"] else entry["header_text"][:30]}": [exactly {entry["bullet_count"]} bullets]'
            for entry in experience_entries
        )
    else:
        bullet_spec = "  (No specific counts available — match the original template)"
        experience_keys_example = '"Company Name": ["bullet 1", "bullet 2", ...]'

    message = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=6000,
        messages=[{
            "role": "user",
            "content": f"""You are preparing a customization proposal for Kiran Gorapalli's resume.

KIRAN'S BACKGROUND:
{KIRAN_BACKGROUND}

JD ANALYSIS:
{json.dumps(jd_analysis, indent=2)}

FULL JOB DESCRIPTION:
{jd_text}

RESUME TEMPLATE INFO:
- Persona: {persona}
- Version: {version}
- Template has {template_structure['total_paragraphs']} paragraphs
- Sections found: {json.dumps([s['text'] for s in template_structure['sections']])}

EXPERIENCE ENTRIES — you MUST generate EXACTLY this many bullets per company:
{bullet_spec}

YOUR TASK:
Think deeply about this role and company. Consider:
1. What does this company value in candidates? (culture, technical depth, leadership style)
2. What keywords and themes from the JD should be woven in?
3. Which of Kiran's experiences map best to this role's requirements?
4. What narrative angle will make the strongest impression?
5. Is this an IC (Individual Contributor) role? If so, how should Kiran's VP/Director experience be reframed to emphasize hands-on execution over management hierarchy? (Check is_ic_role in the JD analysis)

Then produce a JSON object with TWO parts:

Part 1 — "strategy": A markdown-formatted strategy summary (3-5 paragraphs) that explains:
- Your overall customization approach and why
- Key themes and keywords you'll emphasize
- Which experiences you'll highlight and how you'll frame them
- Any gaps you're aware of and how you'll mitigate them
- The narrative angle tying everything together
- If IC role: your specific approach to reframing leadership experience as high-impact IC execution

Part 2 — "proposed_changes": The actual content you propose to write, AND a rationale for EACH section explaining WHY you made those specific choices. The rationale should reference the JD requirements and Kiran's background so the user understands your reasoning upfront.

RULES — these are non-negotiable for proposed_changes:
1. ZERO repeated action verbs. Every bullet must start with a DIFFERENT verb across the entire resume.
2. Keep bullets under 120 characters. Aim for 90-110 chars.
3. Compact metrics: 27.5M not 27.5 M, 15K not 15 K, 40% not 40%.
4. Include Certified ScrumMaster (CSM) when the JD mentions Agile/Scrum.
5. CRITICAL: The number of bullets per company MUST EXACTLY match the counts above.
6. Weave JD keywords naturally — don't force them.
7. Use a company name substring as the key in experience_bullets.

{HUMAN_WRITING_RULES}{_ic_rules_block(jd_analysis)}

SUMMARY & TAGLINE RULES:
The tagline and summary are the highest-value real estate on the resume. Recruiters fixate on the top 3 lines first.

TAGLINE (all formats): Rewrite to mirror the JD's title and priority signals. Max 20 words. Must convey identity, scale, and domain breadth. Echo the JD's exact title language — if they say "Growth PM" include "growth" prominently.

SUMMARY (2-pager and detailed only — skip if the template has no SUMMARY section):
- Sentence 1: Domain authority + career scope (years, what you do, where).
- Sentence 2: Signature achievement with quantified metric. Pick the 2 most JD-relevant metrics from this arsenal:
  * 18M to 32M MAU (for growth/consumer/mobile roles)
  * 27.5M AI interactions (for AI/ML roles)
  * 3.2x TAM expansion (for startup/strategy roles)
  * $20M portfolio (for enterprise/P&L roles)
  * 18% YoY revenue (for revenue/business impact roles)
  * 40+ A/B tests (for experimentation/data-driven roles)
- Sentence 3: Versatility signal tuned to the target company type:
  * Startup: emphasize 0-to-1, pivot, TAM expansion, speed
  * Enterprise: emphasize scale, portfolio size, P&L
  * Growth: emphasize MAU growth, experimentation, conversion
  * AI: emphasize AI product shipping, interaction scale
- NEVER start with "Results-driven" or "Dynamic" or any adjective-first opener.
- NEVER use "passionate about" or "dedicated to."
- NEVER list skills in the summary.
- NEVER include more than 3 metrics. Two is ideal.
- Mirror the top 2-3 JD keywords naturally in the first two sentences.
- No employer names unless strategically justified (e.g., applying to another bank).
- 2-pager: 40-60 words. Detailed: 60-100 words.

Return this JSON:
{{
  "strategy": "markdown strategy summary",
  "proposed_changes": {{
    "tagline": "rewritten tagline (max 20 words) mirroring the JD title and priorities",
    "tagline_rationale": "1-2 sentences explaining why this tagline works — what JD signals it mirrors",
    "summary": "2-3 sentence professional summary following the rules above (or null if template has no SUMMARY section)",
    "summary_rationale": "1-2 sentences explaining WHY this summary works for this role — what JD keywords/themes it addresses, which metrics were selected and why",
    "career_highlights": ["list of 3-4 highlight bullets"],
    "career_highlights_rationale": "1-2 sentences on why these highlights were selected and what JD requirements they map to",
    "experience_bullets": {{
      {experience_keys_example}
    }},
    "experience_rationale": {{
      "CompanyName": "1-2 sentences on why you chose these specific bullets for this company — what JD skills/requirements they demonstrate"
    }},
    "core_competencies_priority": ["ordered list of 16 core competencies to prioritize — these are high-level capabilities like Product Strategy, Go-to-Market, A/B Testing, etc."],
    "core_competencies_rationale": "1-2 sentences on why these competencies — which JD requirements they address",
    "technical_skills_priority": ["ordered list of technical tools and platforms to prioritize — these are specific tools like Jira, Figma, SQL, Python, etc."],
    "technical_skills_rationale": "1-2 sentences on why these tools — which technical requirements the JD emphasizes",
    "notes": "any notes about editing decisions"
  }}
}}"""
        }],
    )

    text = message.content[0].text
    try:
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        return json.loads(text)
    except json.JSONDecodeError:
        return {"raw_content": text, "error": "Could not parse structured JSON"}


async def refine_resume_content(
    api_key: str,
    original_proposal: dict,
    feedback: str,
    jd_analysis: dict,
    template_structure: dict,
    persona: str,
    version: str,
) -> dict:
    """
    Refine the proposed resume content based on user feedback.
    Returns the same structure as generate_resume_content.
    """
    client = create_client(api_key)

    # Build per-company bullet count instructions
    experience_entries = template_structure.get("experience_entries", [])
    if experience_entries:
        bullet_spec_lines = []
        for entry in experience_entries:
            bullet_spec_lines.append(
                f"  - \"{entry['header_text'][:80]}\" → EXACTLY {entry['bullet_count']} bullets"
            )
        bullet_spec = "\n".join(bullet_spec_lines)
    else:
        bullet_spec = "  (No specific counts available — match the original template)"

    proposed = original_proposal.get("proposed_changes", {})

    message = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=4000,
        messages=[{
            "role": "user",
            "content": f"""You previously proposed resume customization content for Kiran Gorapalli.
The user reviewed it and provided feedback. Please revise the content accordingly.

ORIGINAL PROPOSAL:
{json.dumps(proposed, indent=2)}

USER FEEDBACK:
{feedback}

JD ANALYSIS:
{json.dumps(jd_analysis, indent=2)}

EXPERIENCE ENTRIES — you MUST generate EXACTLY this many bullets per company:
{bullet_spec}

RULES (still non-negotiable):
1. ZERO repeated action verbs across the entire resume.
2. Keep bullets under 120 characters.
3. Compact metrics.
4. CRITICAL: Bullet counts per company MUST EXACTLY match the counts above.
5. Incorporate the user's feedback while maintaining quality.

{HUMAN_WRITING_RULES}{_ic_rules_block(jd_analysis)}

Return the revised content as JSON:
{{
  "summary": "revised professional summary",
  "career_highlights": ["revised highlight bullets"],
  "experience_bullets": {{
    "Company Name": ["revised bullets..."]
  }},
  "core_competencies_priority": ["revised core competencies order"],
  "technical_skills_priority": ["revised technical tools order"],
  "notes": "what you changed based on feedback"
}}"""
        }],
    )

    text = message.content[0].text
    try:
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        return json.loads(text)
    except json.JSONDecodeError:
        return {"raw_content": text, "error": "Could not parse structured JSON"}


async def refine_section(
    api_key: str,
    section_id: str,
    section_label: str,
    original_text,          # str or list of str
    current_proposed_text,   # str or list of str
    feedback: str,
    jd_analysis: dict,
    bullet_count: Optional[int] = None,
) -> dict:
    """
    Refine a single section based on user feedback.
    Returns {"revised_text": str_or_list, "rationale": str}.
    """
    client = create_client(api_key)

    is_bullets = isinstance(current_proposed_text, list)

    bullet_rule = ""
    if is_bullets and bullet_count is not None:
        bullet_rule = f"\nCRITICAL: You MUST return EXACTLY {bullet_count} bullets. No more, no less."

    format_instruction = (
        'Return as JSON: {{"revised_text": ["bullet 1", "bullet 2", ...], "rationale": "what you changed and why"}}'
        if is_bullets else
        'Return as JSON: {{"revised_text": "the revised text", "rationale": "what you changed and why"}}'
    )

    current_text_display = json.dumps(current_proposed_text, indent=2) if is_bullets else current_proposed_text
    original_text_display = json.dumps(original_text, indent=2) if isinstance(original_text, list) else original_text

    message = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=2000,
        messages=[{
            "role": "user",
            "content": f"""You are revising ONE SECTION of Kiran Gorapalli's resume based on user feedback.

SECTION: {section_label} (id: {section_id})

ORIGINAL TEMPLATE TEXT:
{original_text_display}

CURRENT PROPOSED TEXT:
{current_text_display}

USER FEEDBACK:
{feedback}

JD CONTEXT:
Company: {jd_analysis.get('company', 'Unknown')}
Role: {jd_analysis.get('job_title', 'Unknown')}
Key requirements: {json.dumps(jd_analysis.get('key_requirements', []))}

KIRAN'S BACKGROUND:
{KIRAN_BACKGROUND}

RULES:
- Address the user's feedback directly
- Keep bullets under 120 characters, aim for 90-110 chars
- Every bullet starts with a unique action verb
- Compact metrics (27.5M not 27.5 M)
- Weave JD keywords naturally{bullet_rule}

{HUMAN_WRITING_RULES}{_ic_rules_block(jd_analysis)}

{format_instruction}"""
        }],
    )

    resp_text = message.content[0].text
    try:
        if "```json" in resp_text:
            resp_text = resp_text.split("```json")[1].split("```")[0]
        elif "```" in resp_text:
            resp_text = resp_text.split("```")[1].split("```")[0]
        return json.loads(resp_text)
    except json.JSONDecodeError:
        return {"revised_text": current_proposed_text, "rationale": "Could not parse response", "error": resp_text}


async def discuss_section(
    api_key: str,
    section_id: str,
    section_label: str,
    original_text,          # str or list of str
    current_proposed_text,   # str or list of str
    message_text: str,
    conversation_history: list,  # [{role: "user"|"assistant", content: str}]
    jd_analysis: dict,
    bullet_count: Optional[int] = None,
) -> dict:
    """
    Conversational section review — handles questions, rationale requests, AND change requests.

    The user might:
    - Ask a question: "Why doesn't bullet 3 have a metric?"
    - Request rationale: "Explain your reasoning for the summary changes"
    - Request a change: "Rewrite bullet 2 to emphasize AI"
    - Mix of both: "Is it ok that there's no metric? If not, can you add one?"

    Returns:
    {
        "message": "assistant's conversational response",
        "revised_text": <updated text if changes were made, null if just answering>,
        "has_changes": true/false
    }
    """
    client = create_client(api_key)

    is_bullets = isinstance(current_proposed_text, list)

    bullet_rule = ""
    if is_bullets and bullet_count is not None:
        bullet_rule = f"\nIf you make changes to bullets, you MUST keep EXACTLY {bullet_count} bullets. No more, no less."

    current_text_display = json.dumps(current_proposed_text, indent=2) if is_bullets else current_proposed_text
    original_text_display = json.dumps(original_text, indent=2) if isinstance(original_text, list) else original_text

    # Build conversation history for multi-turn context
    history_block = ""
    if conversation_history:
        history_lines = []
        for msg in conversation_history[-6:]:  # Keep last 6 messages for context
            role_label = "USER" if msg["role"] == "user" else "ASSISTANT"
            history_lines.append(f"{role_label}: {msg['content']}")
        history_block = f"\nCONVERSATION HISTORY:\n" + "\n".join(history_lines) + "\n"

    revised_text_format = (
        '"revised_text": ["bullet 1", "bullet 2", ...]'
        if is_bullets else
        '"revised_text": "the revised text"'
    )

    system_prompt = f"""You are a resume customization expert having a conversation with a user about ONE SECTION of Kiran Gorapalli's resume. You are knowledgeable, direct, and collaborative.

SECTION: {section_label} (id: {section_id})

ORIGINAL TEMPLATE TEXT (before customization):
{original_text_display}

CURRENT PROPOSED TEXT (your latest suggestion):
{current_text_display}

JD CONTEXT:
Company: {jd_analysis.get('company', 'Unknown')}
Role: {jd_analysis.get('job_title', 'Unknown')}
Key requirements: {json.dumps(jd_analysis.get('key_requirements', []))}

KIRAN'S BACKGROUND:
{KIRAN_BACKGROUND}
{history_block}
YOUR BEHAVIOR:
1. If the user asks a QUESTION (why, how, is it ok, explain, etc.) — answer it thoughtfully. Provide rationale, cite specific JD requirements, explain trade-offs. Do NOT change the text unless they ask you to.
2. If the user requests a CHANGE (rewrite, emphasize, add, remove, modify, etc.) — make the change AND explain what you did.
3. If the user asks BOTH (e.g., "Is this ok? If not, fix it") — answer the question first, then make changes if appropriate.
4. Be concise but substantive. 2-4 sentences for answers, more if the question warrants it.
5. When explaining choices, reference the JD requirements and Kiran's background specifically.

RULES for any text changes:
- Keep bullets under 120 characters, aim for 90-110 chars
- Every bullet starts with a unique action verb
- Compact metrics (27.5M not 27.5 M)
- Weave JD keywords naturally{bullet_rule}

{HUMAN_WRITING_RULES}{_ic_rules_block(jd_analysis)}

RESPONSE FORMAT — always return JSON:
{{
  "message": "Your conversational response — answer questions, explain reasoning, describe changes if any",
  "revised_text": {revised_text_format} OR null if no changes were made,
  "has_changes": true if you modified the text, false if you only answered a question
}}"""

    messages = [{
        "role": "user",
        "content": f"{system_prompt}\n\nUSER MESSAGE:\n{message_text}"
    }]

    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=2000,
        messages=messages,
    )

    resp_text = response.content[0].text
    try:
        if "```json" in resp_text:
            resp_text = resp_text.split("```json")[1].split("```")[0]
        elif "```" in resp_text:
            resp_text = resp_text.split("```")[1].split("```")[0]
        result = json.loads(resp_text)
        # Ensure required fields exist
        result.setdefault("message", "I've reviewed this section.")
        result.setdefault("revised_text", None)
        result.setdefault("has_changes", result["revised_text"] is not None)
        return result
    except json.JSONDecodeError:
        # Fallback: treat the whole response as a message (no changes)
        return {
            "message": response.content[0].text,
            "revised_text": None,
            "has_changes": False,
        }
