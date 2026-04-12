#!/usr/bin/env python3
"""
Migration script: Extract initiative cards from career-highlights.html
into the career_initiatives JSON format for the CC backend.

Reads the HTML, parses each .initiative-card, and writes initiatives.json.
"""

import json
import os
import re
import uuid
from datetime import datetime, timezone
from bs4 import BeautifulSoup

# Resolve paths relative to the script location
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)
SITE_ROOT = os.path.dirname(os.path.dirname(BACKEND_DIR))

HTML_FILE = os.path.join(SITE_ROOT, "career-highlights.html")
OUTPUT_FILE = os.path.join(BACKEND_DIR, "data", "career_initiatives", "initiatives.json")

# Domain tag mapping from HTML data-tags to VALID_DOMAINS
DOMAIN_MAP = {
    "ai": "ai-ml",
    "fintech": "payments",
    "mobile": "mobile",
    "scale": "growth-adoption",
    "transformation": "platform",
    "security": "security",
    "fraud": "fraud",
    "zero-to-one": "zero-to-one",
    "payments": "payments",
    "lending": "lending",
    "wealth": "wealth",
    "auth": "auth-identity",
    "identity": "auth-identity",
    "growth": "growth-adoption",
    "engagement": "engagement",
    "marketplace": "marketplace",
    "personalization": "personalization",
    "notifications": "notifications",
    "strategy": "strategy",
    "platform": "platform",
}

# Company name normalization
COMPANY_MAP = {
    "avatour ai": "avatour",
    "avatour": "avatour",
    "wells fargo": "wells-fargo",
    "first republic": "first-republic",
    "first republic bank": "first-republic",
    "first republic private bank": "first-republic",
    "magley": "magley",
    "magley & associates": "magley",
}

# Era mapping by company
COMPANY_ERA_MAP = {
    "avatour": "startup",
    "wells-fargo": "enterprise",
    "first-republic": "enterprise",
    "magley": "consulting",
    "consulting": "consulting",
}


def parse_year_range(meta_text):
    """Extract year_start and year_end from timeline meta text."""
    # Patterns: "Nov 2023 — Oct 2025", "2019 — 2023", "Oct 2025 — Present"
    years = re.findall(r'(\d{4})', meta_text)
    year_start = int(years[0]) if years else None
    year_end = int(years[1]) if len(years) > 1 else None
    if "present" in meta_text.lower():
        year_end = None
    return year_start, year_end


def parse_metric(metric_text):
    """Split metric text into number and label parts."""
    if not metric_text:
        return "", ""
    metric_text = metric_text.strip()
    # Common patterns: "3.2x TAM", "27.5M users", "#9 to #3"
    # Try to split on first space after the number-like part
    match = re.match(r'^([\d,.]+[xXMmBbKk%]*|#\d+\s*to\s*#\d+)\s*(.*)', metric_text)
    if match:
        return match.group(1).strip(), match.group(2).strip()
    return metric_text, ""


def extract_initiatives():
    with open(HTML_FILE, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f.read(), "html.parser")

    initiatives = []
    now = datetime.now(timezone.utc).isoformat()

    timeline_entries = soup.find_all("div", class_="timeline-entry")

    for entry in timeline_entries:
        # Extract company-level info
        data_tags_raw = entry.get("data-tags", "")
        entry_domains = []
        for tag in data_tags_raw.split(","):
            tag = tag.strip().lower()
            if tag in DOMAIN_MAP:
                mapped = DOMAIN_MAP[tag]
                if mapped not in entry_domains:
                    entry_domains.append(mapped)

        # Company name
        company_el = entry.find("span", class_="company-name")
        company_raw = company_el.get_text(strip=True) if company_el else ""
        company = COMPANY_MAP.get(company_raw.lower(), "")

        # Role
        role_el = entry.find("h2")
        role = role_el.get_text(strip=True) if role_el else ""

        # Year range from meta
        meta_el = entry.find("div", class_="timeline-meta")
        meta_text = meta_el.get_text(strip=True) if meta_el else ""
        year_start, year_end = parse_year_range(meta_text)

        # Era
        era = COMPANY_ERA_MAP.get(company, "")

        # Now extract each initiative card within this entry
        cards = entry.find_all("div", class_="initiative-card")

        for card in cards:
            # Title
            title_el = card.find("div", class_="initiative-title")
            title = title_el.get_text(strip=True) if title_el else ""

            # One-liner
            oneliner_el = card.find("div", class_="initiative-oneliner")
            one_liner = oneliner_el.get_text(strip=True) if oneliner_el else ""

            # Headline metric
            metric_el = card.find("div", class_="initiative-metric")
            metric_text = metric_el.get_text(strip=True) if metric_el else ""
            headline_number, headline_label = parse_metric(metric_text)

            # Tags
            tag_els = card.find_all("span", class_="initiative-tag")
            tags = [t.get_text(strip=True) for t in tag_els]

            # Initiative-specific domains: merge entry domains + map card tags
            card_domains = list(entry_domains)
            for tag_text in tags:
                tag_lower = tag_text.lower()
                if tag_lower in DOMAIN_MAP:
                    mapped = DOMAIN_MAP[tag_lower]
                    if mapped not in card_domains:
                        card_domains.append(mapped)

            # Four beats
            beat_texts = card.find_all("div", class_="initiative-beat-text")
            problem = beat_texts[0].get_text(strip=True) if len(beat_texts) > 0 else ""
            bet = beat_texts[1].get_text(strip=True) if len(beat_texts) > 1 else ""
            shipped = beat_texts[2].get_text(strip=True) if len(beat_texts) > 2 else ""
            outcome = beat_texts[3].get_text(strip=True) if len(beat_texts) > 3 else ""

            # Outcome metrics
            outcome_metrics = []
            outcome_stats = card.find_all("div", class_="initiative-outcome-stat")
            for stat in outcome_stats:
                num_el = stat.find("div", class_="initiative-outcome-number")
                label_el = stat.find("div", class_="initiative-outcome-label")
                if num_el and label_el:
                    outcome_metrics.append({
                        "number": num_el.get_text(strip=True),
                        "label": label_el.get_text(strip=True),
                    })

            # Gallery items
            gallery_items = []
            gallery_els = card.find_all("div", class_="initiative-gallery-placeholder")
            for g in gallery_els:
                text = g.get_text(strip=True)
                if text:
                    gallery_items.append(text)

            initiative = {
                "id": str(uuid.uuid4())[:8],
                "title": title,
                "one_liner": one_liner,
                "company": company,
                "role": role,
                "era": era,
                "year_start": year_start,
                "year_end": year_end,
                "domains": card_domains,
                "tags": tags,
                "problem": problem,
                "bet": bet,
                "shipped": shipped,
                "outcome": outcome,
                "headline_metric_number": headline_number,
                "headline_metric_label": headline_label,
                "outcome_metrics": outcome_metrics,
                "gallery_items": gallery_items,
                "public": True,
                "fenix_indexed": True,
                "notes": "",
                "created_at": now,
                "updated_at": now,
            }

            initiatives.append(initiative)

    return initiatives


def main():
    print(f"Reading: {HTML_FILE}")
    initiatives = extract_initiatives()

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(initiatives, f, indent=2)

    print(f"\nTotal initiatives extracted: {len(initiatives)}")

    # Breakdown by company
    companies = {}
    for init in initiatives:
        c = init["company"] or "unknown"
        companies[c] = companies.get(c, 0) + 1
    print("\nBy company:")
    for c, count in sorted(companies.items()):
        print(f"  {c}: {count}")

    # Breakdown by domain
    domains = {}
    for init in initiatives:
        for d in init["domains"]:
            domains[d] = domains.get(d, 0) + 1
    print("\nBy domain:")
    for d, count in sorted(domains.items(), key=lambda x: -x[1]):
        print(f"  {d}: {count}")

    print(f"\nOutput written to: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
