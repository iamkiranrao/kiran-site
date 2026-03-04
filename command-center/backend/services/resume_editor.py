"""
Resume Editor Service — XML-level Word document editing with formatting preservation.

Ported from editing_patterns.md and verify_resume.py. Handles:
- Reading template structure
- Rewriting bullets, summaries, skills
- <w:br/> multi-line paragraph management
- Bold/non-bold run management
- Verb uniqueness enforcement
- Quality verification (repeated verbs, bold bullets, metric spacing, bullet length)
"""

import os
import re
import shutil
from typing import Optional, List, Set, Dict, Tuple
from docx import Document
from docx.oxml.ns import qn
from lxml import etree


# ──────────────────────────────────────────────────────────────────────────────
# Core Helper Functions
# ──────────────────────────────────────────────────────────────────────────────

def pt(p) -> str:
    """Get full text of a paragraph, representing <w:br/> as newlines."""
    parts = []
    for child in p._element.iter():
        if child.tag == qn("w:t"):
            parts.append(child.text or "")
        elif child.tag == qn("w:br"):
            parts.append("\n")
    return "".join(parts)


def rewrite(p, new_text: str):
    """Rewrite paragraph text using the first run's formatting.
    For simple single-line paragraphs only."""
    if not p.runs:
        return
    p.runs[0].text = new_text
    for r in p.runs[1:]:
        r.text = ""


def swap(p, old: str, new: str) -> bool:
    """Replace text within a paragraph. Tries run-level first, falls back to full rewrite."""
    for r in p.runs:
        if old in r.text:
            r.text = r.text.replace(old, new)
            return True
    full = pt(p)
    if old in full:
        rewrite(p, full.replace(old, new))
        return True
    return False


def has_br(p) -> bool:
    """Check if a paragraph contains <w:br/> line break elements."""
    return len(p._element.findall(qn("w:r") + "/" + qn("w:br"))) > 0


def get_lines(p) -> List[str]:
    """Split a multi-line paragraph (with <w:br/>) into individual lines."""
    return pt(p).split("\n")


# ──────────────────────────────────────────────────────────────────────────────
# Multi-line Paragraph Editing
# ──────────────────────────────────────────────────────────────────────────────

def rewrite_br_paragraph(p, new_lines: List[str]):
    """Rewrite a paragraph that uses <w:br/> line breaks.
    Preserves formatting from the first text run."""
    if not p.runs:
        return

    # Capture formatting from first text run
    first_run = p.runs[0]
    rpr = first_run._element.find(qn("w:rPr"))
    rpr_xml = etree.tostring(rpr) if rpr is not None else None

    # Remove all existing runs
    for r in p.runs:
        r._element.getparent().remove(r._element)

    # Rebuild with new lines
    p_elem = p._element
    for i, line in enumerate(new_lines):
        if i > 0:
            # Add a <w:br/> before each line after the first
            br_run = etree.SubElement(p_elem, qn("w:r"))
            if rpr_xml:
                br_run.append(etree.fromstring(rpr_xml))
            etree.SubElement(br_run, qn("w:br"))

        # Add the text run
        new_run = etree.SubElement(p_elem, qn("w:r"))
        if rpr_xml:
            new_run.append(etree.fromstring(rpr_xml))
        t_elem = etree.SubElement(new_run, qn("w:t"))
        t_elem.text = line
        if line.startswith(" ") or line.endswith(" "):
            t_elem.set(qn("xml:space"), "preserve")


# ──────────────────────────────────────────────────────────────────────────────
# Bold Management
# ──────────────────────────────────────────────────────────────────────────────

def ensure_not_bold(run):
    """Explicitly set a run to non-bold."""
    rpr = run._element.find(qn("w:rPr"))
    if rpr is None:
        rpr = etree.SubElement(run._element, qn("w:rPr"))
        run._element.insert(0, rpr)

    for b in rpr.findall(qn("w:b")):
        rpr.remove(b)

    b_elem = etree.SubElement(rpr, qn("w:b"))
    b_elem.set(qn("w:val"), "0")


def ensure_bold(run):
    """Explicitly set a run to bold."""
    rpr = run._element.find(qn("w:rPr"))
    if rpr is None:
        rpr = etree.SubElement(run._element, qn("w:rPr"))
        run._element.insert(0, rpr)

    for b in rpr.findall(qn("w:b")):
        rpr.remove(b)

    etree.SubElement(rpr, qn("w:b"))


def bold_sweep(doc):
    """Post-edit sweep: ensure all bullet text runs in <w:br/> paragraphs are NOT bold.
    Only affects runs that contain actual text (not headers)."""
    for p in doc.paragraphs:
        if not has_br(p):
            continue

        lines = get_lines(p)
        # Skip the header paragraph (paragraph 0 with name/contact)
        if any(line.strip().isupper() and len(line.strip()) < 40 for line in lines):
            continue

        # Find runs that contain bullet text (not headers, not <w:br/> runs)
        for run in p.runs:
            text = run.text.strip() if run.text else ""
            if not text:
                continue
            # If text is > 30 chars or starts with bullet marker, it's bullet text
            if len(text) > 30 or text.startswith("•") or text.startswith("-"):
                if run.bold:
                    ensure_not_bold(run)


# ──────────────────────────────────────────────────────────────────────────────
# Section Finders
# ──────────────────────────────────────────────────────────────────────────────

def find_summary(doc) -> Tuple[Optional[int], Optional[object]]:
    """Find the professional summary paragraph."""
    for i, p in enumerate(doc.paragraphs):
        text = pt(p).strip()
        if len(text) > 50 and not has_br(p) and i < 10:
            if not all(r.bold for r in p.runs if r.text.strip()):
                return i, p
            if "experience" in text.lower() or "product" in text.lower():
                return i, p
    return None, None


def find_section_header(doc, section_name: str) -> Optional[int]:
    """Find the paragraph index of a section header (e.g., 'EXPERIENCE', 'SKILLS')."""
    for i, p in enumerate(doc.paragraphs):
        text = pt(p).strip()
        if text.upper() == section_name.upper():
            return i
    return None


def find_job_section(doc, company_name: str) -> Tuple[Optional[int], Optional[int]]:
    """Find the paragraph index range for a specific job entry."""
    start = None
    for i, p in enumerate(doc.paragraphs):
        text = pt(p)
        if company_name.lower() in text.lower():
            start = i
            break

    if start is None:
        return None, None

    end = len(doc.paragraphs)
    for i in range(start + 1, len(doc.paragraphs)):
        text = pt(doc.paragraphs[i]).strip()
        if text and len(text) < 40:
            all_bold = all(r.bold for r in doc.paragraphs[i].runs if r.text.strip())
            if all_bold:
                end = i
                break

    return start, end


# ──────────────────────────────────────────────────────────────────────────────
# Verb Tracking
# ──────────────────────────────────────────────────────────────────────────────

VERB_BANK = [
    "Accelerated", "Achieved", "Activated", "Advanced", "Aligned",
    "Amplified", "Architected", "Automated", "Boosted", "Built",
    "Catalyzed", "Championed", "Co-created", "Consolidated", "Converted",
    "Coordinated", "Crafted", "Cultivated", "Customized", "Decreased",
    "Defined", "Delivered", "Designed", "Developed", "Directed",
    "Drove", "Elevated", "Eliminated", "Enabled", "Engineered",
    "Established", "Evaluated", "Evolved", "Executed", "Expanded",
    "Facilitated", "Forged", "Founded", "Generated", "Grew",
    "Guided", "Halved", "Headed", "Identified", "Implemented",
    "Improved", "Increased", "Influenced", "Initiated", "Innovated",
    "Integrated", "Introduced", "Launched", "Led", "Managed",
    "Mapped", "Mentored", "Migrated", "Modernized", "Negotiated",
    "Operationalized", "Optimized", "Orchestrated", "Overhauled", "Partnered",
    "Piloted", "Pioneered", "Prioritized", "Produced", "Propelled",
    "Rationalized", "Rebuilt", "Redesigned", "Reduced", "Refined",
    "Reimagined", "Replatformed", "Restructured", "Revamped", "Reversed",
    "Scaled", "Secured", "Shaped", "Simplified", "Spearheaded",
    "Standardized", "Steered", "Streamlined", "Strengthened", "Surpassed",
    "Systematized", "Transformed", "Tripled", "Unified", "Unlocked",
]


class VerbTracker:
    """Track used action verbs across the entire resume to prevent duplicates."""

    def __init__(self):
        self.used: Set[str] = set()

    def pick_verb(self, preferred: str, alternatives: Optional[List[str]] = None) -> str:
        """Return preferred verb if unused, otherwise try alternatives, then verb bank."""
        if preferred.lower() not in self.used:
            self.used.add(preferred.lower())
            return preferred

        if alternatives:
            for alt in alternatives:
                if alt.lower() not in self.used:
                    self.used.add(alt.lower())
                    return alt

        # Fall back to verb bank
        for verb in VERB_BANK:
            if verb.lower() not in self.used:
                self.used.add(verb.lower())
                return verb

        return preferred  # Last resort

    def register(self, verb: str):
        """Register a verb as used without picking."""
        self.used.add(verb.lower())


# ──────────────────────────────────────────────────────────────────────────────
# Skills Editing
# ──────────────────────────────────────────────────────────────────────────────

def reorder_skills(p, priority_skills: List[str]):
    """Move JD-relevant skills to the front of a comma-separated skills line."""
    text = pt(p)
    skills = [s.strip() for s in text.split(",")]

    priority = [s for s in skills if any(ps.lower() in s.lower() for ps in priority_skills)]
    other = [s for s in skills if s not in priority]

    new_text = ", ".join(priority + other)
    rewrite(p, new_text)


# ──────────────────────────────────────────────────────────────────────────────
# Template Management
# ──────────────────────────────────────────────────────────────────────────────

TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")

TEMPLATE_MAP = {
    ("PM", "1-Page"): "PM_1Pager.docx",
    ("PM", "2-Page"): "PM_2Pager.docx",
    ("PM", "Detailed"): "PM_Detailed.docx",
    ("PjM", "1-Page"): "PjM_1Pager.docx",
    ("PjM", "2-Page"): "PjM_2Pager.docx",
    ("PjM", "Detailed"): "PjM_Detailed.docx",
    ("PMM", "1-Page"): "PMM_1Pager.docx",
    ("PMM", "2-Page"): "PMM_2Pager.docx",
    ("PMM", "Detailed"): "PMM_Detailed.docx",
}


def detect_persona(jd_text: str) -> str:
    """Auto-detect persona from job description text."""
    jd_lower = jd_text.lower()
    pm_signals = ["product manager", "group pm", "apm", "head of product", "director of product"]
    pjm_signals = ["program manager", "project manager", "tpm", "delivery manager", "technical program"]
    pmm_signals = ["product marketing", "pmm", "growth marketing", "gtm", "go-to-market"]

    pm_score = sum(1 for s in pm_signals if s in jd_lower)
    pjm_score = sum(1 for s in pjm_signals if s in jd_lower)
    pmm_score = sum(1 for s in pmm_signals if s in jd_lower)

    if pmm_score > pm_score and pmm_score > pjm_score:
        return "PMM"
    if pjm_score > pm_score:
        return "PjM"
    return "PM"


def copy_template(persona: str, version: str, dest_path: str) -> str:
    """Copy the selected template to a working location. Never modify originals."""
    key = (persona, version)
    if key not in TEMPLATE_MAP:
        raise ValueError(f"No template for persona={persona}, version={version}")

    src = os.path.join(TEMPLATES_DIR, TEMPLATE_MAP[key])
    if not os.path.exists(src):
        raise FileNotFoundError(f"Template not found: {src}")

    shutil.copy2(src, dest_path)
    return dest_path


def read_template_structure(docx_path: str) -> dict:
    """Read and analyze the template structure for editing guidance."""
    doc = Document(docx_path)
    structure = {
        "total_paragraphs": len(doc.paragraphs),
        "tables": len(doc.tables),
        "sections": [],
        "bullet_paragraphs": [],
        "summary_index": None,
    }

    for i, p in enumerate(doc.paragraphs):
        text = pt(p).strip()
        if not text:
            continue

        br_count = len(p._element.findall(".//" + qn("w:br")))
        all_bold = all(r.bold for r in p.runs if r.text.strip()) if p.runs else False

        if all_bold and len(text) < 40:
            structure["sections"].append({"index": i, "text": text})

        if br_count > 0 and len(text) > 50:
            lines = text.split("\n")
            structure["bullet_paragraphs"].append({
                "index": i,
                "line_count": len([l for l in lines if l.strip()]),
                "preview": lines[0][:80] if lines else "",
            })

    # Find summary
    idx, _ = find_summary(doc)
    structure["summary_index"] = idx

    return structure


# ──────────────────────────────────────────────────────────────────────────────
# Quality Verification
# ──────────────────────────────────────────────────────────────────────────────

def verify_resume(docx_path: str, check_interests: bool = False) -> dict:
    """Run all quality checks. Returns dict with errors, warnings, and details."""
    doc = Document(docx_path)
    errors = []
    warnings = []

    # 1. Repeated verbs
    verb_locations: Dict[str, List] = {}
    for i, p in enumerate(doc.paragraphs):
        text = pt(p)
        lines = text.split("\n")
        for line in lines:
            line = line.strip()
            if not line or len(line) < 15:
                continue
            words = line.split()
            if not words:
                continue
            verb = words[0].rstrip(",.:;")
            if verb[0].isdigit() or len(verb) < 3:
                continue
            if verb.isupper() and len(verb) > 3:
                continue
            # Skip education keywords
            if verb.lower() in ("bachelor", "master", "mba", "certified", "university", "college"):
                continue
            verb_lower = verb.lower()
            if verb_lower not in verb_locations:
                verb_locations[verb_lower] = []
            verb_locations[verb_lower].append({"paragraph": i, "text": line[:80]})

    for verb, locs in verb_locations.items():
        if len(locs) > 1:
            errors.append({
                "type": "repeated_verb",
                "verb": verb,
                "count": len(locs),
                "locations": locs,
            })

    # 2. Bold bullets
    for i, p in enumerate(doc.paragraphs):
        br_count = len(p._element.findall(".//" + qn("w:br")))
        if br_count == 0:
            continue
        for j, run in enumerate(p.runs):
            if run.bold and run.text and len(run.text.strip()) > 30:
                errors.append({
                    "type": "bold_bullet",
                    "paragraph": i,
                    "run": j,
                    "text": run.text[:60],
                })

    # 3. Metric spacing
    bad_pattern = re.compile(r"\d\s+[MKB%](?:\b|$)")
    for i, p in enumerate(doc.paragraphs):
        text = pt(p)
        matches = bad_pattern.findall(text)
        if matches:
            warnings.append({
                "type": "metric_spacing",
                "paragraph": i,
                "matches": matches,
            })

    # 4. Bullet length
    for i, p in enumerate(doc.paragraphs):
        text = pt(p)
        for line_num, line in enumerate(text.split("\n")):
            line = line.strip()
            if len(line) > 120:
                warnings.append({
                    "type": "long_bullet",
                    "paragraph": i,
                    "line": line_num,
                    "length": len(line),
                    "text": line[:80] + "...",
                })

    # 5. Interests section
    if check_interests:
        has_interests = any(
            "interest" in pt(p).strip().lower() and len(pt(p).strip()) < 30
            for p in doc.paragraphs
        )
        if not has_interests:
            errors.append({"type": "missing_interests"})

    return {
        "errors": errors,
        "warnings": warnings,
        "error_count": len(errors),
        "warning_count": len(warnings),
        "passed": len(errors) == 0,
    }
