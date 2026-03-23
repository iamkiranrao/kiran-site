"""Authenticity Standards checks — AUTHENTICITY-STANDARDS.md enforcement.

Two-part scoring system:
  Anti-AI checks (auth-ai-*): Detect AI-generated signals
  Pro-Kiran checks (auth-kiran-*): Verify Kiran's voice markers are present

Final score = min(Anti-AI, Pro-Kiran)
"""

import re
import statistics
from pathlib import Path

from models.standards import CheckDefinition, Violation
from services.standards_service import register_check


# ══════════════════════════════════════════════════════════════════════
# HELPER: Extract visible text and sentences from HTML
# ══════════════════════════════════════════════════════════════════════

def _extract_body_text(html: str) -> str:
    """Extract visible body text, stripping nav/footer/scripts."""
    # Remove nav, footer, header elements
    text = re.sub(r'<(nav|footer|header)\b[^>]*>.*?</\1>', '', html, flags=re.DOTALL)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL)
    text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = text.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    text = text.replace('&mdash;', '—').replace('&ndash;', '–')
    text = text.replace('&rsquo;', "'").replace('&lsquo;', "'")
    text = text.replace('&rdquo;', '"').replace('&ldquo;', '"')
    text = re.sub(r'&#x[0-9a-fA-F]+;', '', text)
    text = re.sub(r'&#[0-9]+;', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def _get_sentences(text: str) -> list[str]:
    """Split text into sentences."""
    # Split on sentence-ending punctuation followed by space or end
    sentences = re.split(r'(?<=[.!?])\s+', text)
    return [s.strip() for s in sentences if len(s.strip()) > 5]


def _get_paragraphs(html: str) -> list[str]:
    """Extract paragraph text from HTML."""
    paragraphs = re.findall(r'<p[^>]*>(.*?)</p>', html, re.DOTALL)
    result = []
    for p in paragraphs:
        text = re.sub(r'<[^>]+>', ' ', p)
        text = re.sub(r'\s+', ' ', text).strip()
        if len(text) > 20:  # Skip tiny fragments
            result.append(text)
    return result


def _word_count(text: str) -> int:
    return len(text.split())


# ══════════════════════════════════════════════════════════════════════
# ANTI-AI CHECKS (auth-ai-*)
# ══════════════════════════════════════════════════════════════════════

# ── Lexical Tell Scan (§4.1 + §8) ─────────────────────────────────

BANNED_WORDS = [
    "delve", "synergy", "synergistic", "paradigm", "confluence",
    "underpinning", "intricacies", "elevate", "streamline", "robust",
    "innovative", "innovation", "pivotal", "transformative",
]

BANNED_PHRASES = [
    "in today's fast-paced world",
    "it's important to note that",
    "without further ado",
    "in today's digital landscape",
    "at its core",
    "it goes without saying",
    "as we've discussed",
    "in light of this",
    "first and foremost",
    "moving forward",
    "unlock the potential",
    "paradigm shift",
]


def _check_lexical_tells(file_path, html, visible_text):
    """Scan for banned words and phrases from the exclusion list."""
    violations = []
    text_lower = visible_text.lower()

    if _word_count(visible_text) < 50:
        return violations  # Skip very short pages

    # Check banned words
    found_words = []
    for word in BANNED_WORDS:
        pattern = r'\b' + re.escape(word) + r'\b'
        matches = list(re.finditer(pattern, text_lower))
        if matches:
            for m in matches:
                start = max(0, m.start() - 40)
                end = min(len(visible_text), m.end() + 40)
                snippet = visible_text[start:end]
                found_words.append(word)
                violations.append(Violation(
                    check_id="auth-ai-lexical-tell",
                    severity="warning",
                    location=Path(file_path).name,
                    detail=f"Banned word '{word}' found",
                    evidence=f"...{snippet}...",
                    suggestion=f"Replace '{word}' — see AUTHENTICITY-STANDARDS.md §4.1 for alternatives",
                    auto_fixable=False,
                ))

    # Escalate: 3+ banned words on same page = critical
    if len(found_words) >= 3:
        for v in violations:
            if v.check_id == "auth-ai-lexical-tell":
                v.severity = "critical"

    # Check banned phrases
    for phrase in BANNED_PHRASES:
        if phrase in text_lower:
            violations.append(Violation(
                check_id="auth-ai-lexical-tell",
                severity="critical",
                location=Path(file_path).name,
                detail=f"Banned phrase found: '{phrase}'",
                evidence=phrase,
                suggestion="Delete this phrase entirely. Just state the thing directly.",
                auto_fixable=True,
            ))

    return violations


register_check(
    CheckDefinition(
        id="auth-ai-lexical-tell",
        pillar="authenticity",
        name="Lexical tell scan",
        description="Detects banned words and phrases from the AI exclusion list (§4.1 + §8)",
        severity_default="warning",
        method="regex",
        remediation_difficulty="mechanical",
        standards_ref="AUTHENTICITY-STANDARDS.md §4.1, §8",
    ),
    runner=_check_lexical_tells,
)


# ── Sentence Length Variance (§4.2) ────────────────────────────────

def _check_sentence_variance(file_path, html, visible_text):
    """Check sentence length variance — low variance signals AI."""
    violations = []
    sentences = _get_sentences(visible_text)

    if len(sentences) < 8:
        return violations  # Need enough sentences to measure

    lengths = [len(s.split()) for s in sentences]
    mean = statistics.mean(lengths)
    if mean == 0:
        return violations

    try:
        stdev = statistics.stdev(lengths)
    except statistics.StatisticsError:
        return violations

    variance_pct = (stdev / mean) * 100

    if variance_pct < 10:
        violations.append(Violation(
            check_id="auth-ai-sentence-variance",
            severity="critical",
            location=Path(file_path).name,
            detail=f"Sentence length variance is {variance_pct:.0f}% (need >20%). Text reads as machine-generated.",
            evidence=f"Mean: {mean:.1f} words, StdDev: {stdev:.1f}, {len(sentences)} sentences",
            suggestion="Deliberately mix short punchy sentences (4-6 words) with longer ones (25+ words)",
            auto_fixable=False,
        ))
    elif variance_pct < 20:
        violations.append(Violation(
            check_id="auth-ai-sentence-variance",
            severity="warning",
            location=Path(file_path).name,
            detail=f"Sentence length variance is {variance_pct:.0f}% (borderline, need >20%)",
            evidence=f"Mean: {mean:.1f} words, StdDev: {stdev:.1f}, {len(sentences)} sentences",
            suggestion="Add more variation — break up uniform rhythm with short declaratives",
            auto_fixable=False,
        ))

    return violations


register_check(
    CheckDefinition(
        id="auth-ai-sentence-variance",
        pillar="authenticity",
        name="Sentence length variance",
        description="Low sentence length variance signals AI authorship. Human writing has high burstiness.",
        severity_default="warning",
        method="metric",
        remediation_difficulty="judgment",
        standards_ref="AUTHENTICITY-STANDARDS.md §4.2",
    ),
    runner=_check_sentence_variance,
)


# ── Hedge Density (§4.2) ──────────────────────────────────────────

HEDGE_WORDS = [
    "may", "might", "could", "arguably", "potentially",
    "possibly", "seemingly", "perhaps", "somewhat", "relatively",
    "generally", "typically", "often", "usually", "tends to",
]


def _check_hedge_density(file_path, html, visible_text):
    """Count hedge words per 1000 words."""
    violations = []
    word_count = _word_count(visible_text)

    if word_count < 200:
        return violations

    text_lower = visible_text.lower()
    hedge_count = 0
    for word in HEDGE_WORDS:
        hedge_count += len(re.findall(r'\b' + re.escape(word) + r'\b', text_lower))

    density = (hedge_count / word_count) * 1000

    if density > 18:
        violations.append(Violation(
            check_id="auth-ai-hedge-density",
            severity="critical",
            location=Path(file_path).name,
            detail=f"Hedge density is {density:.1f} per 1000 words (max: 18). Over-hedging is an AI tell.",
            evidence=f"{hedge_count} hedge words in {word_count} words",
            suggestion="Remove at least half. If uncertain, say 'I'm not sure' once — don't spread doubt everywhere.",
            auto_fixable=False,
        ))
    elif density > 12:
        violations.append(Violation(
            check_id="auth-ai-hedge-density",
            severity="warning",
            location=Path(file_path).name,
            detail=f"Hedge density is {density:.1f} per 1000 words (warning at >12)",
            evidence=f"{hedge_count} hedge words in {word_count} words",
            suggestion="Review and cut unnecessary qualifiers",
            auto_fixable=False,
        ))

    return violations


register_check(
    CheckDefinition(
        id="auth-ai-hedge-density",
        pillar="authenticity",
        name="Hedge density",
        description="Excessive hedging (may, might, could, potentially) signals AI caution",
        severity_default="warning",
        method="metric",
        remediation_difficulty="judgment",
        standards_ref="AUTHENTICITY-STANDARDS.md §4.2",
    ),
    runner=_check_hedge_density,
)


# ── Passive Voice Density (§4.2) ──────────────────────────────────

PASSIVE_PATTERNS = [
    r'\b(?:is|are|was|were|been|being)\s+\w+ed\b',
    r'\b(?:is|are|was|were|been|being)\s+\w+en\b',
    r'\bhas been\b', r'\bhave been\b', r'\bhad been\b',
    r'\bwill be\b', r'\bcan be\b', r'\bshould be\b',
    r'\bwas made\b', r'\bwere made\b',
    r'\bwas given\b', r'\bwere given\b',
    r'\bwas found\b', r'\bwere found\b',
]


def _check_passive_voice(file_path, html, visible_text):
    """Count passive voice constructions per 1000 words."""
    violations = []
    word_count = _word_count(visible_text)

    if word_count < 200:
        return violations

    passive_count = 0
    for pattern in PASSIVE_PATTERNS:
        passive_count += len(re.findall(pattern, visible_text, re.IGNORECASE))

    density_pct = (passive_count / word_count) * 100

    if density_pct > 15:
        violations.append(Violation(
            check_id="auth-ai-passive-voice",
            severity="critical",
            location=Path(file_path).name,
            detail=f"Passive voice at {density_pct:.1f}% (max: 15%). Reads robotic.",
            evidence=f"{passive_count} passive constructions in {word_count} words",
            suggestion="Rewrite in active voice: 'A decision was made' → 'We decided'",
            auto_fixable=False,
        ))
    elif density_pct > 10:
        violations.append(Violation(
            check_id="auth-ai-passive-voice",
            severity="warning",
            location=Path(file_path).name,
            detail=f"Passive voice at {density_pct:.1f}% (warning at >10%)",
            evidence=f"{passive_count} passive constructions in {word_count} words",
            suggestion="Review passive constructions and convert where active voice is clearer",
            auto_fixable=False,
        ))

    return violations


register_check(
    CheckDefinition(
        id="auth-ai-passive-voice",
        pillar="authenticity",
        name="Passive voice density",
        description="High passive voice usage signals AI or corporate writing",
        severity_default="warning",
        method="metric",
        remediation_difficulty="judgment",
        standards_ref="AUTHENTICITY-STANDARDS.md §4.2",
    ),
    runner=_check_passive_voice,
)


# ── Contraction Check (§4.2) ──────────────────────────────────────

UNCONTRACTED = [
    (r"\bit is\b", "it's"),
    (r"\bdo not\b", "don't"),
    (r"\bcannot\b", "can't"),
    (r"\bwill not\b", "won't"),
    (r"\bI am\b", "I'm"),
    (r"\bI have\b", "I've"),
    (r"\bI would\b", "I'd"),
    (r"\bthat is\b", "that's"),
    (r"\bwhat is\b", "what's"),
    (r"\bthere is\b", "there's"),
    (r"\bwe are\b", "we're"),
    (r"\bthey are\b", "they're"),
    (r"\bwould not\b", "wouldn't"),
    (r"\bcould not\b", "couldn't"),
    (r"\bshould not\b", "shouldn't"),
    (r"\bdoes not\b", "doesn't"),
    (r"\bdid not\b", "didn't"),
    (r"\bhas not\b", "hasn't"),
    (r"\bhave not\b", "haven't"),
    (r"\bis not\b", "isn't"),
    (r"\bare not\b", "aren't"),
]


def _check_contractions(file_path, html, visible_text):
    """Check for uncontracted forms that read formally/robotically."""
    violations = []
    word_count = _word_count(visible_text)

    if word_count < 100:
        return violations

    uncontracted_count = 0
    examples = []
    for pattern, contraction in UNCONTRACTED:
        matches = re.findall(pattern, visible_text, re.IGNORECASE)
        uncontracted_count += len(matches)
        if matches and len(examples) < 3:
            examples.append(f"'{matches[0]}' → '{contraction}'")

    if uncontracted_count > 5:
        violations.append(Violation(
            check_id="auth-ai-contraction",
            severity="warning",
            location=Path(file_path).name,
            detail=f"{uncontracted_count} uncontracted forms found — reads formally/robotically",
            evidence="; ".join(examples),
            suggestion="Use contractions. 'It's', 'don't', 'can't'. Formal writing without contractions reads robotic.",
            auto_fixable=True,
        ))

    return violations


register_check(
    CheckDefinition(
        id="auth-ai-contraction",
        pillar="authenticity",
        name="Missing contractions",
        description="Uncontracted forms (it is, do not, cannot) read robotic. Use contractions.",
        severity_default="warning",
        method="regex",
        remediation_difficulty="auto",
        standards_ref="AUTHENTICITY-STANDARDS.md §4.2",
    ),
    runner=_check_contractions,
)


# ── Em-Dash Overuse (§9.1 Claude tell) ────────────────────────────

def _check_em_dash_density(file_path, html, visible_text):
    """Check for em-dash overuse — a Claude-specific tell."""
    violations = []
    word_count = _word_count(visible_text)

    if word_count < 100:
        return violations

    # Count em dashes in visible text
    em_dash_count = visible_text.count('—')
    # Also check HTML entities
    em_dash_count += html.count('&mdash;') + html.count('&#8212;')

    per_500 = (em_dash_count / max(word_count, 1)) * 500

    if per_500 > 4:
        violations.append(Violation(
            check_id="auth-ai-em-dash",
            severity="critical",
            location=Path(file_path).name,
            detail=f"{em_dash_count} em dashes ({per_500:.1f} per 500 words). Claude fingerprint.",
            evidence=f"Em-dashes in {word_count} words of content",
            suggestion="Replace with commas, periods, colons, or parentheses. Max 2 per 500 words.",
            auto_fixable=True,
        ))
    elif per_500 > 2:
        violations.append(Violation(
            check_id="auth-ai-em-dash",
            severity="warning",
            location=Path(file_path).name,
            detail=f"{em_dash_count} em dashes ({per_500:.1f} per 500 words). Getting dense.",
            evidence=f"Em-dashes in {word_count} words of content",
            suggestion="Review each em-dash — could it be a comma, period, or colon instead?",
            auto_fixable=False,
        ))

    return violations


register_check(
    CheckDefinition(
        id="auth-ai-em-dash",
        pillar="authenticity",
        name="Em-dash overuse (Claude tell)",
        description="Claude overuses em-dashes. More than 2 per 500 words is a fingerprint.",
        severity_default="warning",
        method="regex",
        remediation_difficulty="mechanical",
        standards_ref="AUTHENTICITY-STANDARDS.md §9.1",
    ),
    runner=_check_em_dash_density,
)


# ── Bullet List Placement (§4.2) ──────────────────────────────────

def _check_bullet_placement(file_path, html, visible_text):
    """Count standalone bullet lists in body text."""
    violations = []

    # Find <ul> and <ol> elements that aren't inside nav/header/footer
    clean_html = re.sub(r'<(nav|footer|header)\b[^>]*>.*?</\1>', '', html, flags=re.DOTALL)
    list_count = len(re.findall(r'<(?:ul|ol)\b[^>]*>', clean_html))

    if list_count > 2:
        violations.append(Violation(
            check_id="auth-ai-bullet-placement",
            severity="warning",
            location=Path(file_path).name,
            detail=f"{list_count} bullet/numbered lists in body text. Human writers rarely interrupt prose with lists.",
            evidence=f"Found {list_count} <ul>/<ol> elements in body content",
            suggestion="Integrate into flowing prose: 'The key factors are A, B, and C — where A matters most because...'",
            auto_fixable=False,
        ))

    return violations


register_check(
    CheckDefinition(
        id="auth-ai-bullet-placement",
        pillar="authenticity",
        name="Bullet list placement",
        description="Standalone bullet lists in body text is an AI structural tell",
        severity_default="warning",
        method="regex",
        remediation_difficulty="judgment",
        standards_ref="AUTHENTICITY-STANDARDS.md §4.2",
    ),
    runner=_check_bullet_placement,
)


# ══════════════════════════════════════════════════════════════════════
# PRO-KIRAN CHECKS (auth-kiran-*)
# ══════════════════════════════════════════════════════════════════════

# ── First-Person Presence (§4.3 + §11) ─────────────────────────────

def _check_first_person(file_path, html, visible_text):
    """Check for first-person presence in long-form content."""
    violations = []
    word_count = _word_count(visible_text)

    if word_count < 500:
        return violations  # Only check long-form

    first_person = re.findall(
        r"\b(?:I |I'm|I've|I'd|I'll|my |me |myself)\b",
        visible_text,
        re.IGNORECASE,
    )

    if len(first_person) == 0:
        violations.append(Violation(
            check_id="auth-kiran-first-person",
            severity="critical",
            location=Path(file_path).name,
            detail=f"Zero first-person markers in {word_count}-word piece. Reads as corporate/AI.",
            evidence="No 'I', 'my', 'I've', 'I'm' found in long-form content",
            suggestion="Add first-person asides: 'I spent two hours testing this...' or 'Honestly, I'm not sure this is right.'",
            auto_fixable=False,
        ))
    elif len(first_person) < 3:
        violations.append(Violation(
            check_id="auth-kiran-first-person",
            severity="warning",
            location=Path(file_path).name,
            detail=f"Only {len(first_person)} first-person markers in {word_count} words. Needs more Kiran.",
            evidence=f"Found: {', '.join(first_person[:5])}",
            suggestion="Add 2-3 first-person asides per long-form page",
            auto_fixable=False,
        ))

    return violations


register_check(
    CheckDefinition(
        id="auth-kiran-first-person",
        pillar="authenticity",
        name="First-person presence",
        description="Long-form content must include first-person voice — it's Kiran's site, not a press release",
        severity_default="critical",
        method="regex",
        remediation_difficulty="judgment",
        standards_ref="AUTHENTICITY-STANDARDS.md §4.3, §11",
    ),
    runner=_check_first_person,
)


# ── Opening Hook Analysis (§11.1) ──────────────────────────────────

ABSTRACT_OPENERS = [
    r"^in today'?s",
    r"^the (?:modern|current|digital|evolving)",
    r"^(?:artificial intelligence|AI|machine learning) (?:is|has|represents)",
    r"^(?:as|when|while) (?:the|our|we|technology)",
    r"^it (?:is|has become) (?:clear|evident|apparent|increasingly)",
    r"^in (?:an era|a world|the age|the realm)",
]


def _check_opening_hook(file_path, html, visible_text):
    """Check if the opening paragraph has a specific hook, not an abstraction."""
    violations = []
    paragraphs = _get_paragraphs(html)

    if len(paragraphs) < 3:
        return violations  # Too short to judge

    first_para = paragraphs[0].strip()
    first_para_lower = first_para.lower()

    # Check for abstract openers
    for pattern in ABSTRACT_OPENERS:
        if re.match(pattern, first_para_lower):
            violations.append(Violation(
                check_id="auth-kiran-opening-hook",
                severity="critical",
                location=Path(file_path).name,
                detail="Opening paragraph starts with an abstract/definition — not Kiran's style",
                evidence=first_para[:120] + "..." if len(first_para) > 120 else first_para,
                suggestion="Open with a specific scene, moment, or observation. Not a thesis statement.",
                auto_fixable=False,
            ))
            return violations

    # Check for named entities (names, companies, products, dates, places)
    has_specifics = bool(re.search(
        r'(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*|'  # Proper nouns
        r'\d{4}|'  # Years
        r'\$[\d,.]+|'  # Dollar amounts
        r'\d+%|'  # Percentages
        r'(?:January|February|March|April|May|June|July|August|September|October|November|December))',
        first_para
    ))

    if not has_specifics:
        violations.append(Violation(
            check_id="auth-kiran-opening-hook",
            severity="warning",
            location=Path(file_path).name,
            detail="Opening paragraph lacks named entities (people, companies, dates, numbers)",
            evidence=first_para[:120] + "..." if len(first_para) > 120 else first_para,
            suggestion="Kiran opens with specifics: named entities, concrete moments. Not abstractions.",
            auto_fixable=False,
        ))

    return violations


register_check(
    CheckDefinition(
        id="auth-kiran-opening-hook",
        pillar="authenticity",
        name="Narrative opening hook",
        description="Kiran opens with specific scenes and moments, not abstract definitions",
        severity_default="warning",
        method="metric",
        remediation_difficulty="judgment",
        standards_ref="AUTHENTICITY-STANDARDS.md §11.1",
    ),
    runner=_check_opening_hook,
)


# ── Directness Check (§11.5) ──────────────────────────────────────

QUALIFYING_PHRASES = [
    r"it might be\b",
    r"perhaps\b",
    r"one could argue\b",
    r"it'?s worth considering\b",
    r"it may be\b",
    r"there is an argument\b",
    r"some would say\b",
    r"it could be argued\b",
    r"one might think\b",
    r"in some ways\b",
]


def _check_directness(file_path, html, visible_text):
    """Count qualifying phrases — Kiran is direct, not hedging."""
    violations = []
    word_count = _word_count(visible_text)

    if word_count < 300:
        return violations

    qual_count = 0
    examples = []
    text_lower = visible_text.lower()
    for pattern in QUALIFYING_PHRASES:
        matches = re.findall(pattern, text_lower)
        qual_count += len(matches)
        if matches and len(examples) < 3:
            examples.extend(matches[:2])

    if qual_count > 5:
        violations.append(Violation(
            check_id="auth-kiran-directness",
            severity="critical",
            location=Path(file_path).name,
            detail=f"{qual_count} qualifying phrases — Kiran states positions directly, not diplomatically",
            evidence="; ".join(examples[:3]),
            suggestion="Remove qualifiers. 'It might be worth considering' → just state the thing.",
            auto_fixable=False,
        ))
    elif qual_count > 3:
        violations.append(Violation(
            check_id="auth-kiran-directness",
            severity="warning",
            location=Path(file_path).name,
            detail=f"{qual_count} qualifying phrases (warning at >3)",
            evidence="; ".join(examples[:3]),
            suggestion="Kiran writes the shorter version. Cut the qualifiers.",
            auto_fixable=False,
        ))

    return violations


register_check(
    CheckDefinition(
        id="auth-kiran-directness",
        pillar="authenticity",
        name="Directness check",
        description="Kiran states positions directly — excessive qualifiers don't sound like him",
        severity_default="warning",
        method="regex",
        remediation_difficulty="judgment",
        standards_ref="AUTHENTICITY-STANDARDS.md §11.5",
    ),
    runner=_check_directness,
)


# ── Honesty Markers (§11.7) ───────────────────────────────────────

HONESTY_PATTERNS = [
    r"I (?:initially|originally|first) (?:thought|looked|tried|assumed|expected)",
    r"I (?:couldn'?t|can'?t|wasn'?t able to) find",
    r"(?:surprised|unexpected|didn'?t expect|caught me off guard)",
    r"I'?m not (?:sure|certain|convinced)",
    r"(?:dead end|wrong|mistake|failed|didn'?t work)",
    r"I don'?t (?:know|have|think)",
    r"(?:honestly|to be honest|the truth is|the uncomfortable truth)",
    r"I (?:changed my mind|reconsidered|was wrong)",
    r"this (?:shouldn'?t have|didn'?t need to) surprise",
]


def _check_honesty_markers(file_path, html, visible_text):
    """Check for honesty markers — dead ends, unknowns, surprises."""
    violations = []
    word_count = _word_count(visible_text)

    if word_count < 1000:
        return violations  # Only check substantial pieces

    marker_count = 0
    for pattern in HONESTY_PATTERNS:
        marker_count += len(re.findall(pattern, visible_text, re.IGNORECASE))

    if marker_count == 0:
        violations.append(Violation(
            check_id="auth-kiran-honesty-markers",
            severity="critical",
            location=Path(file_path).name,
            detail=f"Zero honesty markers in {word_count}-word piece. No dead ends, unknowns, or surprises.",
            evidence="No admitted dead ends, named unknowns, personal surprises, or first-person errors found",
            suggestion="Add at least one: 'I initially looked at X, but...', 'I couldn't find data on...', 'This surprised me...'",
            auto_fixable=False,
        ))

    return violations


register_check(
    CheckDefinition(
        id="auth-kiran-honesty-markers",
        pillar="authenticity",
        name="Honesty markers",
        description="Kiran names dead ends, unknowns, and surprises — this is his strongest authenticity signal",
        severity_default="critical",
        method="regex",
        remediation_difficulty="judgment",
        standards_ref="AUTHENTICITY-STANDARDS.md §11.7",
    ),
    runner=_check_honesty_markers,
)


# ── Vocabulary Tone (§11.4) ───────────────────────────────────────

INFLATING_WORDS = [
    "innovative", "transformative", "cutting-edge", "disruptive",
    "game-changing", "best-in-class", "world-class", "revolutionary",
    "groundbreaking", "next-generation", "state-of-the-art",
]


def _check_vocabulary_tone(file_path, html, visible_text):
    """Scan for inflating words — Kiran uses plain, direct language."""
    violations = []
    text_lower = visible_text.lower()

    if _word_count(visible_text) < 100:
        return violations

    found = []
    for word in INFLATING_WORDS:
        if re.search(r'\b' + re.escape(word) + r'\b', text_lower):
            found.append(word)

    if found:
        violations.append(Violation(
            check_id="auth-kiran-vocabulary",
            severity="warning",
            location=Path(file_path).name,
            detail=f"Inflating words found: {', '.join(found)}. Kiran deflates, not inflates.",
            evidence=f"{len(found)} inflating words",
            suggestion="Replace with plain language. Kiran says 'useful', 'works well', 'solid' — not 'innovative' or 'transformative'.",
            auto_fixable=False,
        ))

    return violations


register_check(
    CheckDefinition(
        id="auth-kiran-vocabulary",
        pillar="authenticity",
        name="Vocabulary tone",
        description="Kiran uses plain, deflating language — inflating words don't sound like him",
        severity_default="warning",
        method="regex",
        remediation_difficulty="mechanical",
        standards_ref="AUTHENTICITY-STANDARDS.md §11.4",
    ),
    runner=_check_vocabulary_tone,
)
