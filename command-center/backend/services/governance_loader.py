"""
Governance Loader — Loads content governance rules from the central config file.

All content-creating services should use this module instead of hardcoding
banned phrases, voice rules, or readability targets inline. The governance
rules live in config/content-governance.json and are loaded once at import
time, then cached for the lifetime of the process.

Usage:
    from services.governance_loader import (
        HARD_BANNED, SOFT_BANNED, AI_LANGUAGE, BUZZWORDS,
        ANTI_PATTERNS, FILLER_PATTERNS, BANNED_OPENERS,
        get_banned_phrases_prompt, get_voice_rules_prompt,
        get_anti_ai_prompt,
    )
"""

import json
import os
import logging

logger = logging.getLogger(__name__)

CONFIG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config")
GOVERNANCE_PATH = os.path.join(CONFIG_DIR, "content-governance.json")


# ── Load governance rules ─────────────────────────────────────────────

def _load_governance() -> dict:
    """Load and cache the governance JSON."""
    if not os.path.exists(GOVERNANCE_PATH):
        logger.warning("content-governance.json not found at %s — using empty rules", GOVERNANCE_PATH)
        return {}
    with open(GOVERNANCE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


_GOV = _load_governance()
_BANNED = _GOV.get("banned_phrases", {})


# ── Exported constants (drop-in replacements for inline lists) ────────

HARD_BANNED: list[str] = _BANNED.get("hard_banned", {}).get("words", [])
SOFT_BANNED: list[str] = _BANNED.get("soft_banned", {}).get("words", [])
AI_LANGUAGE: list[str] = _BANNED.get("ai_language", {}).get("words", [])
BUZZWORDS: list[str] = _BANNED.get("buzzwords", {}).get("words", [])
ANTI_PATTERNS: list[str] = _BANNED.get("anti_patterns", {}).get("words", [])
FILLER_PATTERNS: list[str] = _BANNED.get("filler_qualifiers", {}).get("patterns", [])
BANNED_OPENERS: list[str] = _BANNED.get("banned_openers", {}).get("phrases", [])

# Resume-specific overrides
_RESUME = _GOV.get("resume_overrides", {})
SOFT_BANNED_LIMIT: int = _RESUME.get("soft_banned_limit", 1)
PM_KEYWORDS: list[str] = _RESUME.get("pm_keywords", [])
ATS_HEADERS: list[str] = _RESUME.get("ats_headers", [])
VERB_CATEGORIES: dict = _RESUME.get("verb_categories", {})
PREFERRED_VERBS: list[str] = _RESUME.get("preferred_verbs", [])

# Readability targets
READABILITY_TARGETS: dict = _GOV.get("readability_targets", {})

# Voice rules
VOICE_RULES: dict = _GOV.get("voice_rules", {})

# Anti-AI markers
ANTI_AI_MARKERS: dict = _GOV.get("anti_ai_markers", {})

# Domain rules
DOMAIN_RULES: dict = _GOV.get("domain_rules", {})


# ── Prompt builders (for injecting rules into Claude system prompts) ──

def get_banned_phrases_prompt() -> str:
    """Build a prompt section listing all banned phrases for Claude."""
    lines = ["BANNED phrases (never use in any content):"]
    all_banned = HARD_BANNED + AI_LANGUAGE + BANNED_OPENERS
    lines.append(f"  {', '.join(repr(w) for w in all_banned)}")
    if BUZZWORDS:
        lines.append(f"BUZZWORDS to cut: {', '.join(repr(w) for w in BUZZWORDS)}")
    return "\n".join(lines)


def get_voice_rules_prompt() -> str:
    """Build a prompt section for voice rules."""
    lines = ["Voice & writing rules:"]
    for principle in VOICE_RULES.get("core_principles", []):
        lines.append(f"- {principle}")
    lines.append(f"- English standard: {VOICE_RULES.get('english_standard', 'American English')}")
    lines.append(f"- Em dashes: {VOICE_RULES.get('em_dash_rule', 'BANNED')}")
    lines.append(f"- {VOICE_RULES.get('conversational_test', '')}")
    return "\n".join(lines)


def get_anti_ai_prompt() -> str:
    """Build a prompt section for anti-AI authenticity rules."""
    required = ANTI_AI_MARKERS.get("required", {})
    structural = ANTI_AI_MARKERS.get("structural", {})

    lines = ["Anti-AI authenticity rules (apply to EVERY word):"]

    if "first_person_asides" in required:
        fp = required["first_person_asides"]
        lines.append(f"- First-person asides: {fp.get('minimum_per_long_form', 3)} per teardown/post minimum")
        lines.append(f"  ({fp.get('description', '')})")

    if "dead_ends" in required:
        de = required["dead_ends"]
        lines.append(f"- Dead ends: Show at least {de.get('minimum_per_long_form', 1)} angle explored and discarded")

    if "honest_unknowns" in required:
        lines.append(f"- {required['honest_unknowns'].get('description', '')}")

    if "selective_citations" in required:
        lines.append(f"- {required['selective_citations'].get('description', '')}")

    if "specificity" in required:
        lines.append(f"- {required['specificity'].get('description', '')}")

    if structural:
        lines.append(f"- Asymmetry: {structural.get('asymmetry', '')}")
        lines.append(f"- {structural.get('sentence_length_variation', '')}")
        lines.append(f"- {structural.get('no_excessive_parallelism', '')}")

    return "\n".join(lines)


def get_full_governance_prompt() -> str:
    """Build a complete governance prompt section combining all rules."""
    return "\n\n".join([
        get_banned_phrases_prompt(),
        get_voice_rules_prompt(),
        get_anti_ai_prompt(),
    ])


def reload():
    """Force reload governance rules from disk. Useful for testing or hot-reload."""
    global _GOV, _BANNED
    global HARD_BANNED, SOFT_BANNED, AI_LANGUAGE, BUZZWORDS
    global ANTI_PATTERNS, FILLER_PATTERNS, BANNED_OPENERS
    global SOFT_BANNED_LIMIT, PM_KEYWORDS, ATS_HEADERS, VERB_CATEGORIES, PREFERRED_VERBS
    global READABILITY_TARGETS, VOICE_RULES, ANTI_AI_MARKERS, DOMAIN_RULES

    _GOV = _load_governance()
    _BANNED = _GOV.get("banned_phrases", {})

    HARD_BANNED = _BANNED.get("hard_banned", {}).get("words", [])
    SOFT_BANNED = _BANNED.get("soft_banned", {}).get("words", [])
    AI_LANGUAGE = _BANNED.get("ai_language", {}).get("words", [])
    BUZZWORDS = _BANNED.get("buzzwords", {}).get("words", [])
    ANTI_PATTERNS = _BANNED.get("anti_patterns", {}).get("words", [])
    FILLER_PATTERNS = _BANNED.get("filler_qualifiers", {}).get("patterns", [])
    BANNED_OPENERS = _BANNED.get("banned_openers", {}).get("phrases", [])

    _RESUME = _GOV.get("resume_overrides", {})
    SOFT_BANNED_LIMIT = _RESUME.get("soft_banned_limit", 1)
    PM_KEYWORDS = _RESUME.get("pm_keywords", [])
    ATS_HEADERS = _RESUME.get("ats_headers", [])
    VERB_CATEGORIES = _RESUME.get("verb_categories", {})
    PREFERRED_VERBS = _RESUME.get("preferred_verbs", [])

    READABILITY_TARGETS = _GOV.get("readability_targets", {})
    VOICE_RULES = _GOV.get("voice_rules", {})
    ANTI_AI_MARKERS = _GOV.get("anti_ai_markers", {})
    DOMAIN_RULES = _GOV.get("domain_rules", {})

    logger.info("Content governance rules reloaded from %s", GOVERNANCE_PATH)
