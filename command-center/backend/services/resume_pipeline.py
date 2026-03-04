"""
Resume Pipeline Orchestrator — 12-step async pipeline with SSE progress events.

Takes a JD and produces 5 documents:
1. Customized Resume (.docx)
2. Match Score & Gap Analysis (.docx)
3. Cover Letter (.docx)
4. Company Research Brief (.docx)
5. Interview Question Bank (.docx)
"""

import os
import json
import uuid
import shutil
import zipfile
import asyncio
from typing import AsyncGenerator, List
from docx import Document

from services.resume_editor import (
    pt, rewrite, swap, has_br, get_lines, rewrite_br_paragraph,
    bold_sweep, detect_persona, copy_template, read_template_structure,
    verify_resume, VerbTracker, find_summary, reorder_skills,
    ensure_not_bold,
)
from services.claude_client import (
    analyze_jd, generate_resume_content, generate_match_score,
    generate_cover_letter, generate_company_brief, generate_interview_questions,
)
from services.doc_creator import (
    create_match_score, create_cover_letter,
    create_company_brief, create_interview_questions,
)


JOBS_DIR = "/tmp/command-center/jobs"

PIPELINE_STEPS = [
    {"step": 1, "label": "Parsing inputs"},
    {"step": 2, "label": "Analyzing job description"},
    {"step": 3, "label": "Selecting template"},
    {"step": 4, "label": "Reading template structure"},
    {"step": 5, "label": "Generating customized content"},
    {"step": 6, "label": "Applying edits to resume"},
    {"step": 7, "label": "Running quality checks"},
    {"step": 8, "label": "Generating match score"},
    {"step": 9, "label": "Writing cover letter"},
    {"step": 10, "label": "Compiling company brief"},
    {"step": 11, "label": "Building interview questions"},
    {"step": 12, "label": "Packaging deliverables"},
]


def _emit(step: int, status: str, detail: str = "") -> str:
    """Create an SSE event JSON string."""
    event = {
        "step": step,
        "total_steps": 12,
        "label": PIPELINE_STEPS[step - 1]["label"],
        "status": status,
        "detail": detail,
    }
    return json.dumps(event)


async def run_pipeline(
    jd_text: str,
    persona: str,
    version: str,
    api_key: str,
) -> AsyncGenerator[str, None]:
    """Run the 12-step resume customization pipeline, yielding SSE events."""

    job_id = str(uuid.uuid4())[:8]
    job_dir = os.path.join(JOBS_DIR, job_id)
    os.makedirs(job_dir, exist_ok=True)

    try:
        # ── Step 1: Parse inputs ──────────────────────────────────────────
        yield _emit(1, "in_progress")

        if persona == "auto":
            persona = detect_persona(jd_text)

        yield _emit(1, "completed", f"Persona: {persona}, Version: {version}")

        # ── Step 2: Analyze JD ────────────────────────────────────────────
        yield _emit(2, "in_progress")

        jd_analysis = await analyze_jd(api_key, jd_text)

        company = jd_analysis.get("company", "Unknown")
        role = jd_analysis.get("job_title", "Product Manager")
        yield _emit(2, "completed", f"{role} at {company}")

        # ── Step 3: Select and copy template ──────────────────────────────
        yield _emit(3, "in_progress")

        resume_path = os.path.join(job_dir, "Resume.docx")
        copy_template(persona, version, resume_path)

        yield _emit(3, "completed", f"{persona} {version} template")

        # ── Step 4: Read template structure ───────────────────────────────
        yield _emit(4, "in_progress")

        structure = read_template_structure(resume_path)
        yield _emit(4, "completed", f"{structure['total_paragraphs']} paragraphs, {len(structure['sections'])} sections")

        # ── Step 5: Generate customized content via Claude ────────────────
        yield _emit(5, "in_progress", "Calling Claude API...")

        content = await generate_resume_content(
            api_key, jd_analysis, structure, persona, version
        )

        if "error" in content:
            yield _emit(5, "warning", f"Partial content: {content.get('error', '')}")
        else:
            yield _emit(5, "completed", "Content generated")

        # ── Step 6: Apply edits to resume ─────────────────────────────────
        yield _emit(6, "in_progress")

        doc = Document(resume_path)
        verb_tracker = VerbTracker()

        # 6a: Rewrite summary
        if "summary" in content and isinstance(content.get("summary"), str):
            summary_idx, summary_p = find_summary(doc)
            if summary_p and content.get("summary"):
                rewrite(summary_p, content["summary"])

        # 6b: Rewrite career highlights (if present in content)
        if "career_highlights" in content and isinstance(content["career_highlights"], list):
            for i, p in enumerate(doc.paragraphs):
                text = pt(p).strip()
                if text == "CAREER HIGHLIGHTS":
                    # Next paragraph with <w:br/> is the highlights
                    for j in range(i + 1, min(i + 3, len(doc.paragraphs))):
                        if has_br(doc.paragraphs[j]):
                            new_lines = []
                            for bullet in content["career_highlights"]:
                                if not bullet.startswith("•"):
                                    bullet = f"• {bullet}"
                                first_word = bullet.lstrip("• ").split()[0] if bullet.lstrip("• ").split() else ""
                                verb_tracker.register(first_word)
                                new_lines.append(bullet)
                            rewrite_br_paragraph(doc.paragraphs[j], new_lines)
                            break
                    break

        # 6c: Rewrite experience bullets
        if "experience_bullets" in content and isinstance(content["experience_bullets"], dict):
            for company_name, bullets in content["experience_bullets"].items():
                for i, p in enumerate(doc.paragraphs):
                    text = pt(p)
                    if company_name.lower() in text.lower() and has_br(p):
                        new_lines = []
                        for bullet in bullets:
                            if not bullet.startswith("•"):
                                bullet = f"• {bullet}"
                            words = bullet.lstrip("• ").split()
                            if words:
                                verb = words[0]
                                unique_verb = verb_tracker.pick_verb(verb)
                                if unique_verb != verb:
                                    bullet = bullet.replace(verb, unique_verb, 1)
                            new_lines.append(bullet)
                        rewrite_br_paragraph(p, new_lines)
                        break

        # 6d: Reorder skills
        if "skills_priority" in content and isinstance(content["skills_priority"], list):
            for i, p in enumerate(doc.paragraphs):
                text = pt(p).strip()
                if text.upper() in ("SKILLS", "CORE SKILLS", "TECHNICAL SKILLS"):
                    # Next paragraph is likely the skills list
                    if i + 1 < len(doc.paragraphs):
                        skills_p = doc.paragraphs[i + 1]
                        if not has_br(skills_p) and "," in pt(skills_p):
                            reorder_skills(skills_p, content["skills_priority"])
                    break

        # 6e: Bold sweep — ensure bullets are not accidentally bold
        bold_sweep(doc)

        doc.save(resume_path)
        yield _emit(6, "completed", "Resume edits applied")

        # ── Step 7: Quality checks (loop up to 3 times) ──────────────────
        yield _emit(7, "in_progress")

        for attempt in range(3):
            result = verify_resume(resume_path, check_interests=(version != "1-Page"))

            if result["passed"]:
                yield _emit(7, "completed", f"Passed (attempt {attempt + 1})")
                break

            if attempt < 2:
                # Auto-fix: re-run bold sweep
                doc = Document(resume_path)
                bold_sweep(doc)
                doc.save(resume_path)
                yield _emit(7, "in_progress", f"Auto-fixing issues (attempt {attempt + 2})...")
            else:
                detail = f"{result['error_count']} errors, {result['warning_count']} warnings remaining"
                yield _emit(7, "warning", detail)

        # ── Step 8: Match Score ───────────────────────────────────────────
        yield _emit(8, "in_progress")

        match_content = await generate_match_score(api_key, jd_text, jd_analysis)
        match_path = os.path.join(job_dir, "Match_Score.docx")
        create_match_score(match_content, company, role, match_path)

        yield _emit(8, "completed")

        # ── Step 9: Cover Letter ──────────────────────────────────────────
        yield _emit(9, "in_progress")

        letter_content = await generate_cover_letter(api_key, jd_text, jd_analysis)
        letter_path = os.path.join(job_dir, "Cover_Letter.docx")
        create_cover_letter(letter_content, company, role, letter_path)

        yield _emit(9, "completed")

        # ── Step 10: Company Brief ────────────────────────────────────────
        yield _emit(10, "in_progress")

        brief_content = await generate_company_brief(api_key, jd_analysis)
        brief_path = os.path.join(job_dir, "Company_Brief.docx")
        create_company_brief(brief_content, company, role, brief_path)

        yield _emit(10, "completed")

        # ── Step 11: Interview Questions ──────────────────────────────────
        yield _emit(11, "in_progress")

        questions_content = await generate_interview_questions(api_key, jd_text, jd_analysis)
        questions_path = os.path.join(job_dir, "Interview_Questions.docx")
        create_interview_questions(questions_content, company, role, questions_path)

        yield _emit(11, "completed")

        # ── Step 12: Package deliverables ─────────────────────────────────
        yield _emit(12, "in_progress")

        # Create ZIP
        zip_path = os.path.join(job_dir, "Application_Package.zip")
        files_to_zip = [
            "Resume.docx", "Match_Score.docx", "Cover_Letter.docx",
            "Company_Brief.docx", "Interview_Questions.docx",
        ]
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for fname in files_to_zip:
                fpath = os.path.join(job_dir, fname)
                if os.path.exists(fpath):
                    zf.write(fpath, fname)

        # Final event with download info
        final = {
            "step": 12,
            "total_steps": 12,
            "label": "Complete",
            "status": "completed",
            "job_id": job_id,
            "company": company,
            "role": role,
            "persona": persona,
            "version": version,
            "files": files_to_zip + ["Application_Package.zip"],
        }
        yield json.dumps(final)

    except Exception as e:
        yield json.dumps({
            "step": 0,
            "status": "error",
            "label": "Pipeline error",
            "detail": str(e),
        })


def get_job_file(job_id: str, filename: str) -> str:
    """Get the path to a specific file in a job's output folder."""
    path = os.path.join(JOBS_DIR, job_id, filename)
    if not os.path.exists(path):
        raise FileNotFoundError(f"File not found: {filename} for job {job_id}")
    return path


def list_job_files(job_id: str) -> List[str]:
    """List all files in a job's output folder."""
    job_dir = os.path.join(JOBS_DIR, job_id)
    if not os.path.exists(job_dir):
        return []
    return [f for f in os.listdir(job_dir) if f.endswith((".docx", ".zip"))]
