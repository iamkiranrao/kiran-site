---
module: resume-customizer
title: Resume Customizer
created: 2026-03-11
last_updated: 2026-03-11
version: 1
---

# Resume Customizer

## Overview

The Resume Customizer is a document generation and editing pipeline that tailors Kiran's resume to specific job descriptions without altering its core structure or length. It reads a job description, analyzes gaps between the resume and the JD, and strategically rewrites bullets, competencies, and summaries to maximize alignment—while keeping formatting, page count, and overall design intact.

The tool enables rapid customization for multiple applications, allowing Kiran to apply to roles at different companies with resumes that speak the language of each hiring team.

## Architecture

The Resume Customizer operates as a multi-stage pipeline:

**Input Layer:**
- Accepts resume documents in `.docx` format (Word documents)
- Accepts job descriptions in various formats (PDF, text, attachments)
- Baseline templates exist for three personas: PM (Product Manager), PMM (Product Marketing Manager), PjM (Project/Program Manager)
- Three length variants for each persona: 1-Pager, 2-Pager, Detailed

**Analysis Layer:**
- Claude reads both the JD and the baseline resume
- Identifies keyword coverage gaps (skills, frameworks, industry terms)
- Maps Kiran's actual experience against JD requirements
- Generates a "match score" (0-100) showing alignment before and after customization
- Flags specific competencies, technical skills, and role descriptions for rewriting

**Editing Layer:**
- Rewrites section headers and summaries to mirror JD language
- Strategically swaps bullets while preserving sentence structure and length
- Updates the "Leadership & Strategic Competencies" section to prioritize JD-aligned skills
- Adds technical tools and frameworks mentioned in the JD (SharePoint, Braze, SAFe, CSM, etc.)
- Ensures no bullets exceed 2 lines of rendered text
- Applies tracked changes in Word so Kiran can review/accept edits before submission

**Output Layer:**
- Generates a clean, ready-to-submit `.docx` resume
- Optional: includes yellow highlighting to show all changes made
- Includes a match score breakdown showing before/after alignment
- Can render as PDF for final review

**Integration:**
- Built as part of the Command Center app (FastAPI backend + Next.js frontend)
- Backend services: `claude_client.py` (prompts), `resume_editor.py` (Word document parsing), `resume_pipeline.py` (orchestration)
- Leverages `python-docx` library for `.docx` manipulation
- Uses Claude for analysis and rewriting

## Key Decisions

**November 5, 2025** — Initial concept: Claude scores Kiran's resume against Bay Area tech PM roles. Score: 7.5/10 due to formatting issues (emojis in contact), generic summary, and missing context about team scale and cross-functional scope. Key insight: ATS systems and human reviewers both benefit from optimization.

**February 6, 2026** — First customization for Intuit Senior Marketing Manager role. Kiran's background is product-focused; the JD emphasizes B2B GTM marketing. Claude identifies this as a fundamental alignment gap (7.2/10) rather than a customization problem. Decision: help Kiran upskill on B2B marketing frameworks rather than force-fit product experience. Delivers comprehensive learning resources (Obviously Awesome book, QuickBooks certification, competitor analysis framework).

**February 16, 2026** — Parametric Program Manager roles: Consolidates multiple First Republic roles into single "Data Portfolio Manager" position, merging Data Channel and Core Banking Conversion work into unified narrative. Key decision: identify the strongest single role variant (Data PM was sharper than lending/payments PM) and lean into it heavily ($20M budget, 120-person team, PMO framework, FDIC compliance). Final score: 94/100. This becomes the template approach for future customizations.

**February 20 – March 9, 2026** — Multiple iterations on Wells Fargo Lead Digital PM (Alerts & Messaging role). Claude identifies and fixes:
- Formatting issues (duplicate email addresses, inconsistent fonts)
- Grammar and clarity ("Worked on POCs" → "Piloted in-app local notifications")
- Verb repetition (removed 3 instances of "Launched," varied to "Deployed," "Partnered," "Delivered")
- Missing competencies (added email/SMS/push channels, Braze tool, SAFe certification)
- Missing proof points (restored "Fargo AI" story: 4.1M to 27.5M users, 17% call center cost reduction)
- Naming partner groups explicitly (ATM, Deposits, Fraud & Claims) to signal ecosystem fit

Final insight: A 79/100 resume with broken grammar and missing stories converts poorly; an 87/100 resume with polished phrasing and strong proof points converts well.

**March 10, 2026** — Template audit decision: Rather than continuously fix formatting and language issues on one-off customizations, rebuild all 9 templates (3 personas × 3 lengths) as clean baselines. Remove AI-sounding language ("Orchestrated," "Spearheaded"), update skills/tools per persona, trim less relevant experience (Magley 5→2 bullets), and ensure human voice throughout.

## Evolution

**Phase 1: Manual Customization (Feb 6 – Feb 16, 2026)**

Customizations were entirely manual. Claude analyzes JD, identifies gaps, rewrites bullets and competencies in Word using python-docx, generates PDF preview. Kiran reviews, requests changes, Claude iterates. Process was slow (3–4 rounds per resume) but helped Kiran understand what customization could do.

**Phase 2: Scored Customization (Feb 20 – Mar 9, 2026)**

Claude began scoring resumes against JDs before/after, using a 100-point rubric across six dimensions: domain relevance, skills match, full lifecycle ownership, Agile delivery, seniority alignment, and tools/platforms. Scores ranged from 78–94/100 across different roles.

Key insight: Scoring provided transparency. A score of 80+ with clear fixable gaps (add a tool, reframe a bullet) was actionable. A score of 7.2/10 with fundamental misalignment (lacking entire domain) signaled Kiran should either upskill or deprioritize the role.

**Phase 3: Tracked Changes & Highlighting (Feb – Mar 2026)**

Shifted from rewrites that Kiran had to integrate manually to delivering resumes with all changes marked (strikethrough + underline in tracked changes, or yellow highlighting). This reduced review friction and let Kiran accept/reject changes individually.

**Phase 4: Template Standardization (Mar 10, 2026)**

All 9 templates were audited and rebuilt using consistent design system:
- Font: Calibri 10pt body, 11pt headers (bold, all-caps)
- Contact line: 9.5pt, centered, pipes between email/LinkedIn/portfolio
- Bullets: individual paragraphs with "• " prefix, 0.15" hanging indent
- Section order: Name > Contact > Tagline > Core Competencies > Experience > Education & Certifications > Technical Competencies
- Removed emojis, AI language, and formatting cruft
- Persona-specific content: PM gets PLG/Experimentation bullets; PMM gets GTM/positioning; PjM gets CSM cert and delivery frameworks

## Current State

**What Works Well:**
- Match scoring is accurate. Resumes scoring 80+ get interview callbacks; <75 scores are harder sells.
- Customization is fast: 20–30 minutes from JD upload to submission-ready output
- Tracked changes mode lets Kiran see and approve every edit before submission
- Template variants (1-Pager, 2-Pager, Detailed) provide flexibility for different application formats
- Reserve achievements framework (variant bullets for each persona/role) enables quick pivots across different company profiles

**In Progress:**
- Automating PDF rendering from `.docx` (LibreOffice CLI integration)
- Web UI in Command Center app to upload JD, select template, and auto-generate customized resume
- Integration with job tracking (auto-save resumes by company and date)
- Real-world testing: validating that match scores predict interview success

**Completed Customizations:**
- Wells Fargo (5+ iterations, final: 87/100)
- Intuit (gap analysis, learning plan)
- Parametric (94/100, became template model)
- GEICO (recruiter screening prep)
- 9 baseline templates rebuilt and standardized (Mar 10, 2026)

## Known Issues & Limitations

**Unfixable Gaps:**
- If Kiran lacks fundamental domain expertise (e.g., B2B marketing for Intuit), customization alone won't close the gap. A 7.2/10 score signals interviews will require narrative skill to overcome mismatch.
- Hands-on technical tool experience is hard to fake. Claude can name "Braze" in skills but can't generate authentic bullet points about platform operation if Kiran hasn't used it.

**Technical Debt:**
- Old XML-based templates are fragile; inserting/deleting bullets sometimes creates duplicate text or spacing breaks
- Word tracked changes markup is error-prone; occasionally produces malformed XML that requires manual cleanup
- LibreOffice PDF rendering inconsistent across systems; page 2 sometimes renders with font size shifts
- Customizing "Detailed" templates is tricky because they have more content; difficult to keep everything within 2-page limit after expansion

**Content Constraints:**
- 2-line bullet limit is tight for complex stories; hard to convey full scope without becoming unreadable
- Each role gets 2–5 bullets; can't tell complete narrative if experience is multifaceted
- Wells Fargo and First Republic roles have 10+ meaningful achievements; always hard to prioritize without losing important signals

## Ideas & Future Direction

**Immediate (Next 4 weeks):**
- Build "bullet variant generator" to help Kiran draft new reserve achievements for specific domains (fintech PM bullets, data PM bullets, AI PM bullets) before a JD arrives
- Add "JD keyword extractor" that pulls skills/tools from JD and shows them visually against resume coverage
- Create "before/after comparison view" showing original resume vs. customized version side-by-side

**Near-term (Next 2–3 months):**
- Build "target company dashboard" showing match scores across all of Kiran's companies (Anthropic, Google, Apple, Adobe, Intuit, etc.), highlighting strongest vs. longest-shot targets
- Add "competitor resume benchmarking": analyze what similar candidates put on resumes for same JD, identify gaps
- Create "interview story mapper" that extracts bullet points and generates 2-minute behavioral interview scripts

**Long-term (Strategic):**
- Expand to cover letters, case study responses, and interview preparation docs
- Build "portfolio customizer" that auto-frames projects based on JD emphasis areas
- Create "salary/equity benchmarker" to guide offer negotiation based on company, role level, and background

---

## Source Sessions

- `2025-11-05-071121-product-manager-resume-optimization-for-top-tech-companies.md` — Initial 7.5/10 score and optimization recommendations
- `2026-02-06-181605-resume-optimization-for-senior-marketing-manager-role-at-int.md` — Intuit SMM customization, gap analysis, learning resources
- `2026-02-16-071712-tailoring-resume-for-first-republic-bank-roles.md` — Parametric customization, 94/100 score, template approach
- `2026-03-09-165229-im-having-issues-with-the-resume-customizer-in.md` — Wells Fargo iteration, grammar fixes, verb deduplication, 87/100 score
- `2026-03-09-175515-resume-customization-for-job-application.md` — Tracked changes implementation, JD-aligned competencies, 79–87/100 scores
- `2026-03-10-073450-context-resume-customizer-baseline-template-modifications.md` — Template audit and cleanup, reserve achievements framework
- `2026-03-10-205857-resume-templates-continuation-prompt-for-remaining-8.md` — Full template rebuilding, design system documentation, persona-specific frameworks
