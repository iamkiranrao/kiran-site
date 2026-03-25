"""Content Standards checks — CONTENT-STANDARDS.md enforcement.

Scans HTML content for editorial and content quality violations:
- Readability scoring (Flesch-Kincaid grade level)
- Banned jargon and AI-speak detection
- US English spelling enforcement
- Filler qualifier detection
- Read time accuracy
- Meta description length
- Canonical URL verification
"""

import re
import math
from pathlib import Path
from typing import Optional

from models.standards import CheckDefinition, Violation
from services.standards_service import register_check, SITE_ROOT


# ── Flesch-Kincaid helpers ────────────────────────────────────────

def _count_syllables(word: str) -> int:
    """Estimate syllable count for an English word."""
    word = word.lower().strip()
    if not word:
        return 0
    if len(word) <= 3:
        return 1

    # Remove trailing silent e
    if word.endswith("e"):
        word = word[:-1]

    # Count vowel groups
    vowels = "aeiouy"
    count = 0
    prev_vowel = False
    for ch in word:
        is_vowel = ch in vowels
        if is_vowel and not prev_vowel:
            count += 1
        prev_vowel = is_vowel

    return max(1, count)


def _flesch_kincaid_grade(text: str) -> Optional[float]:
    """Compute Flesch-Kincaid Grade Level for a block of text.

    Returns None if text is too short for meaningful measurement.
    """
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if s.strip()]
    if len(sentences) < 3:
        return None

    words = re.findall(r"[a-zA-Z']+", text)
    if len(words) < 100:
        return None

    total_syllables = sum(_count_syllables(w) for w in words)
    word_count = len(words)
    sentence_count = len(sentences)

    grade = (
        0.39 * (word_count / sentence_count)
        + 11.8 * (total_syllables / word_count)
        - 15.59
    )
    return round(grade, 1)


# ── Grade targets by content type ─────────────────────────────────

def _infer_content_type(relative_path: str) -> tuple[str, float, float]:
    """Infer content type from file path. Returns (type, min_grade, max_grade)."""
    rel = relative_path.lower()
    if "teardown" in rel:
        return ("teardown", 11.0, 13.0)
    elif "blog" in rel:
        return ("blog", 10.0, 12.0)
    elif "learning" in rel or "certification" in rel:
        # Credential/certification pages use formal institutional language
        return ("certification", 9.0, 18.0)
    elif "prototype" in rel or "madlab" in rel or "hero-" in rel:
        # MadLab prototypes and dev tools — exclude from readability
        return ("madlab", 9.0, 20.0)
    elif "scannibal" in rel:
        return ("scannibal", 8.0, 10.0)
    else:
        return ("general", 9.0, 13.0)


# ── Check: Readability (Flesch-Kincaid) ──────────────────────────

def _check_readability(file_path, html, visible_text):
    """Check Flesch-Kincaid grade level against content type targets."""
    violations = []
    grade = _flesch_kincaid_grade(visible_text)
    if grade is None:
        return violations  # Too short to measure

    rel_path = str(Path(file_path).relative_to(SITE_ROOT))
    content_type, min_grade, max_grade = _infer_content_type(rel_path)

    if grade > max_grade:
        severity = "critical" if grade > max_grade + 2 else "warning"
        violations.append(Violation(
            check_id="content-readability",
            severity=severity,
            location=rel_path,
            detail=f"Flesch-Kincaid grade {grade} exceeds target {max_grade} for {content_type} content",
            evidence=f"FK Grade: {grade} (target: {min_grade}-{max_grade})",
            suggestion=f"Simplify language to bring grade below {max_grade}. Shorten sentences, use simpler words.",
            auto_fixable=False,
        ))

    return violations


register_check(
    CheckDefinition(
        id="content-readability",
        pillar="content",
        name="Readability (Flesch-Kincaid)",
        description="Content must meet Flesch-Kincaid grade level targets per content type",
        severity_default="warning",
        method="metric",
        remediation_difficulty="judgment",
        standards_ref="CONTENT-STANDARDS.md §6",
    ),
    runner=_check_readability,
)


# ── Check: Banned jargon ─────────────────────────────────────────

BANNED_JARGON = [
    "leverage", "synergy", "paradigm", "ecosystem", "holistic",
    "scalable solution", "streamline", "cutting-edge", "best-in-class",
    "empower",
]

AI_SPEAK = [
    "delve", "landscape", "multifaceted", "it's important to note",
    "in today's world", "at the end of the day", "game-changer",
    "let's dive in", "here's the thing", "it's worth noting",
    "compelling", "robust",
]

LOFTY_ABSTRACTIONS = [
    "revolutionize the customer experience",
    "exploring identity through",
    "transforming the landscape",
    "reimagining the future",
    "paradigm shift",
]

ALL_BANNED = BANNED_JARGON + AI_SPEAK + LOFTY_ABSTRACTIONS


def _check_banned_jargon(file_path, html, visible_text):
    """Scan content for banned jargon, AI-speak, and lofty abstractions."""
    violations = []
    text_lower = visible_text.lower()
    rel_path = str(Path(file_path).relative_to(SITE_ROOT))

    found_terms = []
    for term in ALL_BANNED:
        if term.lower() in text_lower:
            found_terms.append(term)

    if found_terms:
        severity = "critical" if len(found_terms) >= 3 else "warning"
        violations.append(Violation(
            check_id="content-banned-jargon",
            severity=severity,
            location=rel_path,
            detail=f"Found {len(found_terms)} banned jargon/AI-speak terms",
            evidence=", ".join(found_terms[:5]),
            suggestion="Rewrite using plain, conversational language per CONTENT-STANDARDS.md §4",
            auto_fixable=False,
        ))

    return violations


register_check(
    CheckDefinition(
        id="content-banned-jargon",
        pillar="content",
        name="Banned jargon & AI-speak",
        description="Content must not contain banned jargon, AI-sounding language, or lofty abstractions",
        severity_default="warning",
        method="regex",
        remediation_difficulty="judgment",
        standards_ref="CONTENT-STANDARDS.md §4",
    ),
    runner=_check_banned_jargon,
)


# ── Check: US English spelling ───────────────────────────────────

BRITISH_SPELLINGS = {
    "organisation": "organization",
    "behaviour": "behavior",
    "recognise": "recognize",
    "colour": "color",
    "favour": "favor",
    "analyse": "analyze",
    "centre": "center",
    "defence": "defense",
    "programme": "program",
    "licence": "license",
    "practise": "practice",
    "catalogue": "catalog",
    "dialogue": "dialog",
    "manoeuvre": "maneuver",
    "travelled": "traveled",
    "modelling": "modeling",
    "fulfil": "fulfill",
    "skilful": "skillful",
    "judgement": "judgment",
    "apologise": "apologize",
    "optimise": "optimize",
    "realise": "realize",
    "specialise": "specialize",
    "utilise": "utilize",
    "summarise": "summarize",
    "minimise": "minimize",
    "maximise": "maximize",
    "prioritise": "prioritize",
    "customise": "customize",
    "personalise": "personalize",
}


def _check_us_english(file_path, html, visible_text):
    """Scan for British English spellings that should be US English."""
    violations = []
    text_lower = visible_text.lower()
    rel_path = str(Path(file_path).relative_to(SITE_ROOT))

    british_found = []
    for british, american in BRITISH_SPELLINGS.items():
        # Word boundary match
        if re.search(rf'\b{re.escape(british)}\b', text_lower):
            british_found.append(f"{british} → {american}")

    if british_found:
        violations.append(Violation(
            check_id="content-us-english",
            severity="warning",
            location=rel_path,
            detail=f"Found {len(british_found)} British English spellings",
            evidence="; ".join(british_found[:5]),
            suggestion="Replace with US English equivalents per CONTENT-STANDARDS.md §4",
            auto_fixable=False,
        ))

    return violations


register_check(
    CheckDefinition(
        id="content-us-english",
        pillar="content",
        name="US English spelling",
        description="All content must use American English spelling conventions",
        severity_default="warning",
        method="regex",
        remediation_difficulty="mechanical",
        standards_ref="CONTENT-STANDARDS.md §4",
    ),
    runner=_check_us_english,
)


# ── Check: Filler qualifiers ────────────────────────────────────

FILLER_QUALIFIERS = [
    "very", "really", "extremely", "incredibly", "highly",
    "absolutely", "definitely", "totally", "completely", "utterly",
]


def _check_filler_qualifiers(file_path, html, visible_text):
    """Scan for filler qualifier words that weaken writing."""
    violations = []
    words = visible_text.lower().split()
    word_count = len(words)
    if word_count < 200:
        return violations

    rel_path = str(Path(file_path).relative_to(SITE_ROOT))
    filler_count = sum(1 for w in words if w.strip(".,;:!?\"'()") in FILLER_QUALIFIERS)
    density = (filler_count / word_count) * 1000

    if density > 8:
        severity = "warning" if density <= 15 else "critical"
        violations.append(Violation(
            check_id="content-filler-qualifiers",
            severity=severity,
            location=rel_path,
            detail=f"Filler qualifier density: {density:.1f} per 1000 words ({filler_count} total)",
            evidence=f"{filler_count} filler words in {word_count} words",
            suggestion="Cut filler qualifiers (very, really, extremely, etc.) per CONTENT-STANDARDS.md §4",
            auto_fixable=False,
        ))

    return violations


register_check(
    CheckDefinition(
        id="content-filler-qualifiers",
        pillar="content",
        name="Filler qualifiers",
        description="Filler words (very, really, extremely, etc.) should be cut from content",
        severity_default="warning",
        method="regex",
        remediation_difficulty="judgment",
        standards_ref="CONTENT-STANDARDS.md §4",
    ),
    runner=_check_filler_qualifiers,
)


# ── Check: Em dashes in content ──────────────────────────────────

def _check_em_dashes(file_path, html, visible_text):
    """Detect em dashes in content (banned per CONTENT-STANDARDS.md §4)."""
    violations = []
    rel_path = str(Path(file_path).relative_to(SITE_ROOT))

    # Check visible text
    em_dash_count = visible_text.count("—")
    # Check HTML entities
    entity_count = len(re.findall(r'&mdash;|&#8212;', html))

    total = em_dash_count + entity_count
    if total > 0:
        severity = "critical" if total > 3 else "warning"
        violations.append(Violation(
            check_id="content-em-dash",
            severity=severity,
            location=rel_path,
            detail=f"Found {total} em dashes (banned per content standards)",
            evidence=f"{em_dash_count} in text, {entity_count} as HTML entities",
            suggestion="Replace em dashes with hyphens or rewrite the sentence",
            auto_fixable=False,
        ))

    return violations


register_check(
    CheckDefinition(
        id="content-em-dash",
        pillar="content",
        name="Em dashes in content",
        description="Em dashes are banned — use hyphens or rewrite",
        severity_default="warning",
        method="regex",
        remediation_difficulty="mechanical",
        standards_ref="CONTENT-STANDARDS.md §4",
    ),
    runner=_check_em_dashes,
)


# ── Check: Meta description length ──────────────────────────────

def _check_meta_description(file_path, html, visible_text):
    """Check meta description exists and is within 150-160 char range."""
    violations = []
    rel_path = str(Path(file_path).relative_to(SITE_ROOT))

    match = re.search(
        r'<meta\s+name=["\']description["\']\s+content=["\']([^"\']*)["\']',
        html, re.IGNORECASE
    )
    if not match:
        # Also check reversed attribute order
        match = re.search(
            r'<meta\s+content=["\']([^"\']*)["\'][^>]*name=["\']description["\']',
            html, re.IGNORECASE
        )

    if not match:
        violations.append(Violation(
            check_id="content-meta-description",
            severity="warning",
            location=rel_path,
            detail="Missing meta description tag",
            evidence="No <meta name=\"description\"> found",
            suggestion="Add a 150-160 character meta description per CONTENT-STANDARDS.md §5",
            auto_fixable=False,
        ))
    else:
        desc = match.group(1)
        if len(desc) < 100:
            violations.append(Violation(
                check_id="content-meta-description",
                severity="info",
                location=rel_path,
                detail=f"Meta description too short: {len(desc)} chars (target: 150-160)",
                evidence=desc[:80] + "..." if len(desc) > 80 else desc,
                suggestion="Expand meta description to 150-160 characters",
                auto_fixable=False,
            ))
        elif len(desc) > 170:
            violations.append(Violation(
                check_id="content-meta-description",
                severity="info",
                location=rel_path,
                detail=f"Meta description too long: {len(desc)} chars (target: 150-160)",
                evidence=desc[:80] + "...",
                suggestion="Trim meta description to 150-160 characters",
                auto_fixable=False,
            ))

    return violations


register_check(
    CheckDefinition(
        id="content-meta-description",
        pillar="content",
        name="Meta description",
        description="Every page needs a 150-160 character meta description",
        severity_default="info",
        method="regex",
        remediation_difficulty="mechanical",
        standards_ref="CONTENT-STANDARDS.md §5",
    ),
    runner=_check_meta_description,
)


# ── Check: Canonical URL ─────────────────────────────────────────

def _check_canonical_url(file_path, html, visible_text):
    """Verify canonical URLs use kiranrao.ai, not netlify.app."""
    violations = []
    rel_path = str(Path(file_path).relative_to(SITE_ROOT))

    # Check for netlify URLs in canonical, og:url, og:image, JSON-LD
    netlify_matches = re.findall(
        r'kirangorapalli\.netlify\.app', html
    )
    if netlify_matches:
        violations.append(Violation(
            check_id="content-canonical-url",
            severity="critical",
            location=rel_path,
            detail=f"Found {len(netlify_matches)} references to netlify.app domain",
            evidence="kirangorapalli.netlify.app found in HTML",
            suggestion="Replace all kirangorapalli.netlify.app with kiranrao.ai",
            auto_fixable=True,
        ))

    # Check for missing canonical link
    if not re.search(r'<link[^>]*rel=["\']canonical["\']', html):
        violations.append(Violation(
            check_id="content-canonical-url",
            severity="warning",
            location=rel_path,
            detail="Missing canonical link tag",
            evidence="No <link rel=\"canonical\"> found",
            suggestion="Add <link rel=\"canonical\" href=\"https://kiranrao.ai/...\">",
            auto_fixable=False,
        ))

    return violations


register_check(
    CheckDefinition(
        id="content-canonical-url",
        pillar="content",
        name="Canonical URL",
        description="All canonical URLs must use kiranrao.ai domain",
        severity_default="critical",
        method="regex",
        remediation_difficulty="mechanical",
        standards_ref="CONTENT-STANDARDS.md §5",
    ),
    runner=_check_canonical_url,
)
