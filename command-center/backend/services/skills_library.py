"""
Skills Library — Curated bank of Kiran's verified skills, organized by domain.

All skills in this library are real — sourced from resume_context.md, verified
role descriptions, and actual tools/platforms used. Nothing is fabricated.

Two tiers:
1. Core Competencies: Strategic/leadership skills (bullet-formatted, 16 per resume)
2. Technical Skills: Tools, platforms, languages, frameworks (pipe-delimited, varies by template)

Each skill is tagged with one or more domains. The selection function reads the JD,
detects which domains are relevant, and assembles the optimal skills list.

Domains:
- universal:   Appears in every PM resume regardless of specialization
- growth:      MAU, conversion, retention, experimentation, PLG
- payments:    Payment rails, wallets, compliance, fraud, fintech
- ai:          AI/ML products, conversational AI, prompt engineering
- platform:    APIs, migrations, infrastructure, developer experience
- enterprise:  Portfolio management, P&L, large-scale org leadership
- security:    Authentication, fraud prevention, identity, biometrics
- mobile:      Mobile-first strategy, app scaling, responsive design
- data:        Analytics, data infrastructure, business intelligence
- startup:     0-to-1, pivots, TAM expansion, lean methodology

Usage:
    from services.skills_library import select_skills
    result = select_skills(jd_text, version="2-Page")
    # result["core_competencies"] → list of 16 skill strings
    # result["technical_skills"] → dict with categories for 2-Page/Detailed, or flat list for 1-Page
    # result["detected_domains"] → ranked list of matched domains
"""

import re
from typing import Dict, List, Tuple, Optional
from collections import Counter


# ══════════════════════════════════════════════════════════════════════════════
# CORE COMPETENCIES — Strategic/Leadership Skills
# ══════════════════════════════════════════════════════════════════════════════
# Each tuple: (display_text, set_of_domains, priority_within_domain)
# Priority 1 = always include when domain matches, 2 = include if space, 3 = backup

CORE_COMPETENCIES = [
    # ── Universal (every PM resume) ──────────────────────────────────────
    ("Product Strategy & Roadmap",          {"universal"},                          1),
    ("Cross-Functional Leadership",         {"universal"},                          1),
    ("Stakeholder Management",              {"universal"},                          1),
    ("Data-Driven Decision Making",         {"universal"},                          2),
    ("Product Lifecycle Management",        {"universal"},                          2),
    ("Roadmap Prioritization",              {"universal"},                          3),

    # ── Growth ───────────────────────────────────────────────────────────
    ("Product-Led Growth (PLG)",            {"growth", "universal"},                1),
    ("Go-to-Market (GTM)",                  {"growth", "universal"},                1),
    ("A/B Testing & Experimentation",       {"growth", "data"},                     1),
    ("Conversion Optimization",             {"growth"},                             1),
    ("User Research",                       {"growth", "universal"},                2),
    ("Funnel Optimization",                 {"growth"},                             2),
    ("Retention & Engagement Strategy",     {"growth", "mobile"},                   2),
    ("Customer Acquisition Strategy",       {"growth"},                             3),
    ("Behavioral Analytics",                {"growth", "data"},                     3),

    # ── Payments / Fintech ───────────────────────────────────────────────
    ("Payment Rails & Processing",          {"payments"},                           1),
    ("Digital Wallet Strategy",             {"payments", "mobile"},                 1),
    ("P2P & ACH Payments",                  {"payments"},                           1),
    ("Payment System Architecture",         {"payments", "platform"},               1),
    ("Regulatory Compliance",               {"payments", "enterprise"},             2),
    ("Fraud Prevention & Risk Management",  {"payments", "security"},               2),
    ("Financial Product Management",        {"payments", "enterprise"},             2),
    ("KYC/AML Compliance",                  {"payments", "security"},               2),
    ("Transaction Monitoring",              {"payments", "security"},               2),
    ("Cross-Border & Multi-Currency",       {"payments"},                           3),
    ("Merchant & Consumer Payment UX",      {"payments", "growth"},                 3),
    ("Settlement & Reconciliation",         {"payments"},                           3),

    # ── AI / ML ──────────────────────────────────────────────────────────
    ("AI/ML Product Strategy",              {"ai", "universal"},                    1),
    ("Conversational AI & NLP",             {"ai"},                                 1),
    ("AI Governance & Safety",              {"ai", "enterprise"},                   1),
    ("LLM Evaluation & Model Selection",    {"ai"},                                 2),
    ("AI Product Lifecycle",                {"ai"},                                 2),
    ("Responsible AI & Safety",             {"ai"},                                 2),
    ("Non-Deterministic Product Design",    {"ai"},                                 2),
    ("Computational Cost Optimization",     {"ai", "platform"},                     3),
    ("Prompt Engineering Strategy",         {"ai"},                                 3),
    ("ML Model Integration",               {"ai", "platform"},                     3),

    # ── Platform / Infrastructure ────────────────────────────────────────
    ("Platform & API Strategy",             {"platform", "universal"},              1),
    ("Platform Migration & Modernization",  {"platform"},                           1),
    ("API-First Architecture",              {"platform"},                           2),
    ("Developer Experience (DX)",           {"platform"},                           2),
    ("System Integration",                  {"platform", "enterprise"},             3),
    ("Microservices & Service Architecture",{"platform"},                           3),

    # ── Enterprise / B2B ─────────────────────────────────────────────────
    ("P&L Ownership",                       {"enterprise", "universal"},            1),
    ("Revenue Growth",                      {"enterprise", "growth"},               1),
    ("Enterprise Security & Compliance",    {"enterprise", "security"},             1),
    ("Change Management",                   {"enterprise"},                         2),
    ("Portfolio Management",                {"enterprise"},                         2),
    ("Enterprise Integration Strategy",     {"enterprise", "platform"},             2),
    ("Complex Sales Cycle Support",         {"enterprise"},                         3),
    ("Enterprise Sales Enablement",         {"enterprise"},                         3),
    ("Vendor & Partner Management",         {"enterprise"},                         3),

    # ── Security / Identity ──────────────────────────────────────────────
    ("Authentication & Identity Management",{"security"},                           1),
    ("Biometric Authentication",            {"security", "mobile"},                 1),
    ("Risk-Based Authentication",           {"security"},                           2),
    ("Identity Verification",               {"security"},                           3),

    # ── Mobile ───────────────────────────────────────────────────────────
    ("Mobile-First Product Strategy",       {"mobile"},                             1),
    ("App Store Optimization (ASO)",        {"mobile", "growth"},                   1),
    ("Cross-Platform Strategy",             {"mobile", "platform"},                 1),
    ("App Scaling & Performance",           {"mobile", "growth"},                   2),
    ("Push & In-App Messaging",             {"mobile", "growth"},                   2),
    ("Device Fragmentation Management",     {"mobile"},                             2),
    ("Mobile Performance Optimization",     {"mobile", "data"},                     3),
    ("Responsive & Adaptive Design",        {"mobile", "platform"},                 3),

    # ── Data / Analytics ─────────────────────────────────────────────────
    ("Product Analytics",                   {"data", "universal"},                  1),
    ("Metrics Framework Design",            {"data"},                               1),
    ("Data Governance & Quality",           {"data", "enterprise"},                 1),
    ("Business Intelligence & Reporting",   {"data", "enterprise"},                 2),
    ("Experimentation Frameworks",          {"data", "growth"},                     2),
    ("Data Democratization",                {"data"},                               2),
    ("Analytics Maturity Roadmapping",      {"data", "startup"},                    3),
    ("Data Pipeline & Infrastructure",      {"data", "platform"},                   3),

    # ── Startup / 0-to-1 ────────────────────────────────────────────────
    ("0-to-1 Product Development",          {"startup"},                            1),
    ("TAM Expansion & Market Sizing",       {"startup", "growth"},                  1),
    ("Customer Discovery & Validation",     {"startup", "growth"},                  1),
    ("Lean Product Discovery",              {"startup"},                            2),
    ("Unit Economics & Financial Modeling",  {"startup", "enterprise"},              2),
    ("Fundraising Narrative",               {"startup"},                            2),
    ("No-Code Rapid Prototyping",           {"startup"},                            3),
    ("Pivot Strategy",                      {"startup"},                            3),
]


# ══════════════════════════════════════════════════════════════════════════════
# TECHNICAL SKILLS — Tools, Platforms, Languages, Frameworks
# ══════════════════════════════════════════════════════════════════════════════
# Each tuple: (display_text, category, set_of_domains, priority)
# Category is used for 2-Page/Detailed grouped format

TECHNICAL_SKILLS = [
    # ── PM Tools ─────────────────────────────────────────────────────────
    ("Jira",                    "PM Tools",     {"universal"},                  1),
    ("Confluence",              "PM Tools",     {"universal"},                  1),
    ("Aha!",                    "PM Tools",     {"universal"},                  2),
    ("Figma",                   "PM Tools",     {"universal"},                  1),
    ("Pendo",                   "PM Tools",     {"growth", "mobile"},           2),
    ("Asana",                   "PM Tools",     {"universal"},                  2),
    ("Notion",                  "PM Tools",     {"universal", "startup"},       2),
    ("Linear",                  "PM Tools",     {"universal", "startup"},       3),
    ("Miro",                    "PM Tools",     {"universal"},                  3),
    ("ProductBoard",            "PM Tools",     {"universal"},                  3),

    # ── Analytics ────────────────────────────────────────────────────────
    ("Mixpanel",                "Analytics",    {"data", "growth", "mobile"},   1),
    ("Amplitude",               "Analytics",    {"data", "growth"},             1),
    ("Google Analytics",        "Analytics",    {"data", "growth"},             1),
    ("Looker",                  "Analytics",    {"data", "enterprise"},         2),
    ("SQL",                     "Analytics",    {"data", "universal"},          1),
    ("Snowflake",               "Analytics",    {"data", "platform"},           2),
    ("Tableau",                 "Analytics",    {"data", "enterprise"},         2),
    ("Heap",                    "Analytics",    {"data", "growth"},             3),
    ("Fullstory",               "Analytics",    {"data", "growth"},             3),

    # ── AI & ML ──────────────────────────────────────────────────────────
    ("OpenAI",                  "AI & ML",      {"ai"},                         1),
    ("Claude",                  "AI & ML",      {"ai"},                         1),
    ("Prompt Engineering",      "AI & ML",      {"ai"},                         1),
    ("Python",                  "AI & ML",      {"ai", "data"},                 1),
    ("LangChain",               "AI & ML",      {"ai"},                         2),
    ("Vector Databases",        "AI & ML",      {"ai", "data"},                 2),
    ("AWS SageMaker",           "AI & ML",      {"ai", "platform"},             3),
    ("Hugging Face",            "AI & ML",      {"ai"},                         3),

    # ── Payments & Fintech ───────────────────────────────────────────────
    ("Zelle",                   "Payments",     {"payments"},                   1),
    ("Apple Pay",               "Payments",     {"payments", "mobile"},         1),
    ("Google Pay",              "Payments",     {"payments", "mobile"},         1),
    ("Stripe",                  "Payments",     {"payments", "platform"},       2),
    ("Plaid",                   "Payments",     {"payments", "platform"},       2),
    ("ACH / Wire / SWIFT",      "Payments",     {"payments"},                   2),
    ("FIS / Fiserv",            "Payments",     {"payments", "enterprise"},     3),
    ("PCI DSS",                 "Payments",     {"payments", "security"},       3),

    # ── Frameworks & Methodologies ───────────────────────────────────────
    ("Agile",                   "Frameworks",   {"universal"},                  1),
    ("Scrum",                   "Frameworks",   {"universal"},                  1),
    ("OKRs",                    "Frameworks",   {"universal"},                  1),
    ("RICE",                    "Frameworks",   {"universal", "growth"},        2),
    ("JTBD",                    "Frameworks",   {"universal", "growth"},        2),
    ("Dual-Track Discovery",    "Frameworks",   {"universal", "startup"},       2),
    ("SAFe",                    "Frameworks",   {"enterprise"},                 3),
    ("Kanban",                  "Frameworks",   {"universal"},                  3),
    ("Design Thinking",         "Frameworks",   {"startup", "growth"},          3),
    ("Lean Startup",            "Frameworks",   {"startup"},                    3),

    # ── Platform & Infrastructure ────────────────────────────────────────
    ("REST APIs",               "Platform",     {"platform"},                   1),
    ("GraphQL",                 "Platform",     {"platform"},                   2),
    ("AWS",                     "Platform",     {"platform"},                   2),
    ("GCP",                     "Platform",     {"platform"},                   3),
    ("Microservices",           "Platform",     {"platform"},                   3),

    # ── Security & Identity ──────────────────────────────────────────────
    ("OAuth / OIDC",            "Security",     {"security", "platform"},       1),
    ("MFA / Biometrics",        "Security",     {"security", "mobile"},         1),
    ("Okta / IAM",              "Security",     {"security", "enterprise"},     2),
    ("Device Fingerprinting",   "Security",     {"security"},                   2),
    ("Tokenization",            "Security",     {"security", "payments"},       2),

    # ── Mobile ──────────────────────────────────────────────────────────
    ("Firebase",                "Mobile",       {"mobile", "data"},             1),
    ("App Store Connect",       "Mobile",       {"mobile"},                     2),

    # ── Data Engineering ────────────────────────────────────────────────
    ("dbt",                     "Data",         {"data"},                       1),
    ("Power BI",                "Data",         {"data", "enterprise"},         2),
    ("BigQuery",                "Data",         {"data", "platform"},           3),

    # ── Enterprise ──────────────────────────────────────────────────────
    ("Salesforce",              "Enterprise",   {"enterprise"},                 2),

    # ── Startup / No-Code ───────────────────────────────────────────────
    ("Airtable",                "Startup",      {"startup"},                    2),
    ("Zapier / Make",           "Startup",      {"startup"},                    3),
]


# ══════════════════════════════════════════════════════════════════════════════
# DOMAIN DETECTION — JD keyword → domain mapping
# ══════════════════════════════════════════════════════════════════════════════

DOMAIN_SIGNALS = {
    "growth": [
        "growth", "plg", "product-led", "mau", "dau", "retention", "engagement",
        "conversion", "funnel", "acquisition", "activation", "a/b test",
        "experimentation", "optimize", "onboarding", "virality", "referral",
        "churn", "ltv", "arpu", "cohort",
    ],
    "payments": [
        "payment", "fintech", "banking", "financial", "lending", "credit",
        "debit", "wallet", "p2p", "ach", "wire", "settlement", "compliance",
        "regulatory", "pci", "fraud", "risk", "underwriting", "treasury",
        "neobank", "transaction", "remittance", "zelle", "venmo", "stripe",
        "plaid", "money transfer", "kyc", "aml", "cross-border", "multi-currency",
        "merchant", "checkout", "disbursement", "reconciliation",
    ],
    "ai": [
        "ai", "artificial intelligence", "machine learning", "ml", "nlp",
        "llm", "gpt", "generative", "chatbot", "conversational", "prompt",
        "neural", "deep learning", "recommendation", "personalization",
        "automation", "intelligent", "copilot", "assistant", "inference",
        "fine-tuning", "rag", "retrieval", "embedding", "vector",
        "hallucination", "model evaluation", "responsible ai",
    ],
    "platform": [
        "platform", "api", "infrastructure", "migration", "microservice",
        "developer", "sdk", "integration", "architecture", "scalab",
        "distributed", "cloud", "aws", "gcp", "azure", "devops",
        "backend", "frontend", "full-stack", "saas", "paas",
    ],
    "enterprise": [
        "enterprise", "b2b", "fortune", "portfolio", "p&l", "revenue",
        "budget", "stakeholder", "executive", "director", "vp",
        "organizational", "transformation", "governance", "procurement",
        "vendor", "partner", "sales enablement", "strategic",
        "soc2", "hipaa", "sox", "change management", "presales",
        "rbac", "audit", "salesforce", "long-term roadmap",
    ],
    "security": [
        "security", "authentication", "identity", "biometric", "mfa",
        "oauth", "fraud", "encryption", "compliance", "soc2", "gdpr",
        "privacy", "zero trust", "access control", "iam",
    ],
    "mobile": [
        "mobile", "ios", "android", "app", "responsive", "native",
        "react native", "flutter", "push notification", "in-app",
        "mobile-first", "tablet", "wearable", "cross-platform",
        "app store", "aso", "firebase", "crash rate", "anr",
        "device fragmentation", "biometric",
    ],
    "data": [
        "data", "analytics", "sql", "warehouse", "pipeline", "dashboard",
        "metrics", "bi", "business intelligence", "tableau", "looker",
        "snowflake", "databricks", "dbt", "data-driven", "insight",
        "data governance", "data quality", "lineage", "reverse etl",
        "self-service", "democratiz",
    ],
    "startup": [
        "startup", "0-to-1", "zero to one", "early stage", "seed",
        "series a", "series b", "pivot", "mvp", "lean", "scrappy",
        "founder", "greenfield", "tam", "market fit", "product-market",
        "customer discovery", "unit economics", "cac", "ltv",
        "fundrais", "investor", "runway", "no-code", "airtable",
    ],
}


# ══════════════════════════════════════════════════════════════════════════════
# SELECTION ENGINE
# ══════════════════════════════════════════════════════════════════════════════

def detect_domains(jd_text: str) -> List[Tuple[str, int]]:
    """
    Detect which PM specialization domains are signaled by the JD.

    Returns a list of (domain, hit_count) sorted by relevance (most hits first).
    Only returns domains with at least 2 keyword hits to avoid false positives.
    """
    jd_lower = jd_text.lower()
    domain_scores = {}

    for domain, keywords in DOMAIN_SIGNALS.items():
        hits = sum(1 for kw in keywords if kw in jd_lower)
        if hits >= 2:
            domain_scores[domain] = hits

    # Sort by hit count descending
    ranked = sorted(domain_scores.items(), key=lambda x: -x[1])
    return ranked


def _select_from_pool(pool, target_domains: set, count: int) -> List:
    """Select top items from a pool based on domain relevance."""
    # Score each item: domain overlap * priority weight
    scored = []
    for item in pool:
        if len(item) == 3:
            text, domains, priority = item
            category = None
        else:
            text, category, domains, priority = item

        # Domain relevance score
        # Non-universal domain matches score 3 each (strong signal for specialization)
        # Universal tag adds 1 (baseline relevance, shouldn't dominate)
        # This ensures domain-specific skills outrank pure-universal ones
        overlap = domains & target_domains
        if not overlap:
            domain_score = 0
        else:
            non_universal = overlap - {"universal"}
            universal_bonus = 1 if "universal" in overlap else 0
            domain_score = universal_bonus + len(non_universal) * 3

        # Priority weight (1 = highest)
        priority_weight = 4 - priority  # 1→3, 2→2, 3→1

        total = domain_score * 10 + priority_weight

        scored.append((total, text, category, domains))

    # Sort by score descending, then alphabetically for stability
    scored.sort(key=lambda x: (-x[0], x[1]))

    # Deduplicate and take top N
    seen = set()
    selected = []
    for score, text, category, domains in scored:
        if text not in seen:
            seen.add(text)
            selected.append((text, category, domains, score))
            if len(selected) >= count:
                break

    return selected


def select_skills(
    jd_text: str,
    version: str = "2-Page",
    core_count: int = 16,
    tech_per_category: int = 6,
    max_tech_categories: int = 4,
) -> Dict:
    """
    Select the optimal skills for a resume based on JD analysis.

    Args:
        jd_text: Job description text
        version: Template version ("1-Page", "2-Page", "Detailed")
        core_count: Number of core competencies to select (default 16 = 4 rows of 4)
        tech_per_category: Max technical skills per category for grouped format

    Returns:
        Dict with:
        - core_competencies: list of skill strings (for bullet-formatted section)
        - technical_skills: dict of category→[skills] (2-Page/Detailed) or flat list (1-Page)
        - detected_domains: ranked list of (domain, hit_count)
        - domain_tags: set of active domain names
    """
    # Step 1: Detect domains
    ranked_domains = detect_domains(jd_text)
    active_domains = {"universal"}
    for domain, hits in ranked_domains:
        active_domains.add(domain)

    # Step 2: Select core competencies
    # Guarantee the top priority-1 universal skills always appear (PM foundation)
    # These contain critical ATS/PM keywords: roadmap, stakeholder, data-driven, etc.
    universal_p1 = [
        (text, None, domains, 999)  # High score to ensure inclusion
        for text, domains, priority in CORE_COMPETENCIES
        if "universal" in domains and priority == 1
    ]
    min_universal = min(6, core_count // 3)  # Reserve ~1/3 of slots for universals

    # Get domain-specific picks (excluding the guaranteed universals)
    guaranteed_texts = {text for text, _, _, _ in universal_p1[:min_universal]}
    domain_pool = [item for item in CORE_COMPETENCIES
                   if item[0] not in guaranteed_texts]
    domain_selected = _select_from_pool(domain_pool, active_domains, core_count - min_universal)

    # Merge: guaranteed universals first, then domain-specific
    core_list = [text for text, _, _, _ in universal_p1[:min_universal]]
    for text, _, _, _ in domain_selected:
        if text not in guaranteed_texts and len(core_list) < core_count:
            core_list.append(text)

    # Step 3: Select technical skills
    tech_selected = _select_from_pool(TECHNICAL_SKILLS, active_domains, 40)

    if version == "1-Page":
        # Flat pipe-delimited list, ~20 skills max
        tech_list = [text for text, _, _, _ in tech_selected[:22]]
        tech_output = tech_list
    else:
        # Grouped by category
        grouped = {}
        for text, category, domains, score in tech_selected:
            if category not in grouped:
                grouped[category] = []
            if len(grouped[category]) < tech_per_category:
                grouped[category].append(text)

        # Order categories by relevance: categories with more high-scoring skills first
        category_scores = {}
        for text, category, domains, score in tech_selected:
            if category not in category_scores:
                category_scores[category] = 0
            category_scores[category] += score

        ordered_categories = sorted(
            grouped.keys(),
            key=lambda c: -category_scores.get(c, 0)
        )

        tech_output = {cat: grouped[cat] for cat in ordered_categories if grouped.get(cat)}

        # Always include Frameworks, limit to template's category count
        top_categories = ordered_categories[:max_tech_categories]
        if "Frameworks" not in top_categories and "Frameworks" in tech_output:
            # Replace the lowest-scoring category with Frameworks
            if len(top_categories) >= max_tech_categories:
                top_categories[-1] = "Frameworks"
            else:
                top_categories.append("Frameworks")
        tech_output = {cat: tech_output[cat] for cat in top_categories if cat in tech_output}

    return {
        "core_competencies": core_list,
        "technical_skills": tech_output,
        "detected_domains": ranked_domains,
        "domain_tags": active_domains,
    }


def format_skills_preview(result: Dict) -> str:
    """Format skills selection as a human-readable preview."""
    lines = []

    # Domains
    domains = result["detected_domains"]
    if domains:
        domain_str = ", ".join(f"{d} ({h})" for d, h in domains[:5])
        lines.append(f"Detected domains: {domain_str}")
    else:
        lines.append("Detected domains: universal only")

    lines.append("")

    # Core competencies (4 per row, bullet-formatted)
    lines.append("Core Competencies:")
    core = result["core_competencies"]
    for i in range(0, len(core), 4):
        row = core[i:i+4]
        lines.append("  " + "  |  ".join(f"• {s}" for s in row))

    lines.append("")

    # Technical skills
    tech = result["technical_skills"]
    if isinstance(tech, list):
        lines.append("Technical Skills:")
        lines.append("  " + " | ".join(tech))
    else:
        lines.append("Technical Skills:")
        for cat, skills in tech.items():
            lines.append(f"  {cat}: {' | '.join(skills)}")

    return "\n".join(lines)
