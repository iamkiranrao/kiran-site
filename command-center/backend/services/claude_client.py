"""
Claude Client Service — Handles all Claude API interactions for the resume pipeline.

Accepts API key per-request via X-Claude-Key header. Never stores the key.
Contains 5 purpose-built prompt templates for:
1. JD Analysis
2. Resume Customization (bullets, summary, skills)
3. Match Score & Gap Analysis
4. Cover Letter
5. Interview Question Bank
"""

import json
from typing import Optional
from anthropic import Anthropic


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
"""


def create_client(api_key: str) -> Anthropic:
    """Create an Anthropic client with the provided API key."""
    return Anthropic(api_key=api_key)


async def analyze_jd(api_key: str, jd_text: str) -> dict:
    """Step 2: Analyze the job description and extract structured requirements."""
    client = create_client(api_key)

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        messages=[{
            "role": "user",
            "content": f"""Analyze this job description and extract structured information.
Return a JSON object with these fields:

{{
  "job_title": "exact title from the JD",
  "company": "company name",
  "seniority": "IC/Manager/Director/VP + estimated level (L5/L6/L7)",
  "domain": "industry/vertical (e.g., fintech, social, productivity)",
  "key_requirements": ["list of must-have skills and experiences"],
  "keywords": ["specific phrases and terms from the JD to weave into the resume"],
  "technical_skills": ["tools, frameworks, methodologies mentioned"],
  "soft_skills": ["leadership, communication, stakeholder management signals"],
  "metrics_orientation": "what kind of outcomes the role cares about (revenue, engagement, efficiency, etc.)",
  "summary": "5-10 line analysis of what this role needs and how Kiran's background maps to it"
}}

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
) -> dict:
    """Step 5: Generate customized resume content (summary, bullets, skills order)."""
    client = create_client(api_key)

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4000,
        messages=[{
            "role": "user",
            "content": f"""You are customizing a resume for Kiran Gorapalli.

KIRAN'S BACKGROUND:
{KIRAN_BACKGROUND}

JD ANALYSIS:
{json.dumps(jd_analysis, indent=2)}

RESUME TEMPLATE INFO:
- Persona: {persona}
- Version: {version}
- Template has {template_structure['total_paragraphs']} paragraphs
- Sections found: {json.dumps([s['text'] for s in template_structure['sections']])}
- Bullet paragraphs: {len(template_structure['bullet_paragraphs'])} (each contains multiple bullets separated by line breaks)

RULES — these are non-negotiable:
1. ZERO repeated action verbs. Every bullet must start with a DIFFERENT verb across the entire resume.
2. Keep bullets under 120 characters. Aim for 90-110 chars.
3. Compact metrics: 27.5M not 27.5 M, 15K not 15 K, 40% not 40%.
4. Include Certified ScrumMaster (CSM) when the JD mentions Agile/Scrum.
5. Match the original template's content volume — don't add more bullets than existed.
6. Weave JD keywords naturally — don't force them.

Return a JSON object:
{{
  "summary": "2-3 sentence professional summary tailored to this JD",
  "career_highlights": ["list of 3-4 highlight bullets for the CAREER HIGHLIGHTS section"],
  "experience_bullets": {{
    "Company Name": ["bullet 1", "bullet 2", "bullet 3"]
  }},
  "skills_priority": ["ordered list of skills to prioritize based on JD"],
  "notes": "any notes about editing decisions"
}}

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


async def generate_match_score(api_key: str, jd_text: str, jd_analysis: dict) -> str:
    """Step 8: Generate match score and gap analysis as markdown."""
    client = create_client(api_key)

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=3000,
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

Be honest about gaps. Don't inflate the score. A realistic assessment is more useful."""
        }],
    )

    return message.content[0].text


async def generate_cover_letter(api_key: str, jd_text: str, jd_analysis: dict) -> str:
    """Step 9: Generate a tailored cover letter as markdown."""
    client = create_client(api_key)

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
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
        model="claude-sonnet-4-20250514",
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
        model="claude-sonnet-4-20250514",
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
