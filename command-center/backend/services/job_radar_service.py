"""
Job Radar — Automated job discovery engine with freshness scoring.

Scans company career pages (via ATS APIs) and job boards for matching roles,
scores them by freshness, and feeds into the Resume Customizer pipeline.

Architecture:
- Company career pages are the primary source (4x higher response rate vs LinkedIn)
- ATS APIs (Greenhouse, Lever, Ashby) provide structured data with timestamps
- Job boards (Indeed, LinkedIn) are secondary discovery channels
- Each scan stores results in a local JSON db with deduplication
- Freshness badges: gold (<6h), strong (<24h), decent (<48h), stale (>48h)

Scanning frequency is adaptive based on research:
- Tue-Thu 8am-2pm: every 2 hours (peak posting window)
- Mon/Fri: every 4 hours
- Weekends: every 8 hours
"""

import os
import json
import hashlib
import logging
import re
import tempfile
from datetime import datetime, timezone, timedelta
from typing import Optional
from enum import Enum

import httpx

from utils.config import data_dir, get_logger, CLAUDE_MODEL

logger = get_logger("job-radar")

DATA_DIR = data_dir("job-radar")
JOBS_FILE = os.path.join(DATA_DIR, "discovered_jobs.json")
SCAN_LOG_FILE = os.path.join(DATA_DIR, "scan_log.json")
CONFIG_FILE = os.path.join(DATA_DIR, "radar_config.json")
DISMISSED_FILE = os.path.join(DATA_DIR, "dismissed_jobs.json")

# Aggregator API credentials (optional)
ADZUNA_APP_ID = os.getenv("ADZUNA_APP_ID", "")
ADZUNA_APP_KEY = os.getenv("ADZUNA_APP_KEY", "")


# ── Freshness Tiers ─────────────────────────────────────────────────────

class Freshness(str, Enum):
    GOLD = "gold"        # < 6 hours — top priority, act immediately
    STRONG = "strong"    # 6-24 hours — high priority
    DECENT = "decent"    # 24-48 hours — worth applying
    STALE = "stale"      # > 48 hours — lower priority, 200+ applicants likely


def compute_freshness(posted_at: str) -> Freshness:
    """Compute freshness tier from ISO timestamp."""
    try:
        posted = datetime.fromisoformat(posted_at.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return Freshness.STALE

    now = datetime.now(timezone.utc)
    age = now - posted
    hours = age.total_seconds() / 3600

    if hours < 6:
        return Freshness.GOLD
    elif hours < 24:
        return Freshness.STRONG
    elif hours < 48:
        return Freshness.DECENT
    else:
        return Freshness.STALE


def freshness_label(freshness: Freshness) -> str:
    labels = {
        Freshness.GOLD: "Just Posted — Apply Now",
        Freshness.STRONG: "Posted Today — High Priority",
        Freshness.DECENT: "Posted Recently — Still Viable",
        Freshness.STALE: "Older Posting — Lower Priority",
    }
    return labels.get(freshness, "Unknown")


# ── Data Persistence ────────────────────────────────────────────────────

def _load_json(path: str) -> list:
    if not os.path.exists(path):
        return []
    with open(path) as f:
        return json.load(f)


def _save_json(path: str, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp_path = path + ".tmp"
    with open(tmp_path, "w") as f:
        json.dump(data, f, indent=2, default=str)
    os.replace(tmp_path, path)


def _job_id(company: str, title: str, url: str) -> str:
    """Generate a stable dedup key for a job posting."""
    raw = f"{company.lower().strip()}|{title.lower().strip()}|{url.strip()}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


# ── Target Companies Registry ───────────────────────────────────────────

# ATS type → base API pattern
# Greenhouse, Lever, and Ashby all expose public JSON job board APIs
ATS_APIS = {
    "greenhouse": "https://boards-api.greenhouse.io/v1/boards/{board_id}/jobs",
    "lever": "https://api.lever.co/v0/postings/{board_id}",
    "ashby": "https://api.ashby.engineering/posting-api/job-board/{board_id}",
}

# Target companies with their ATS info
# board_id is the company's public job board identifier
# This list covers companies with known public ATS APIs from our 107 target list
COMPANY_CAREER_SOURCES = [
    # ── AI ────────────────────────────────────────────────
    {"company": "Anthropic", "ats": "ashby", "board_id": "anthropic", "careers_url": "https://www.anthropic.com/careers"},
    {"company": "OpenAI", "ats": "ashby", "board_id": "openai", "careers_url": "https://openai.com/careers"},
    {"company": "Midjourney", "ats": "lever", "board_id": "midjourney", "careers_url": "https://www.midjourney.com/careers"},
    {"company": "Runway", "ats": "greenhouse", "board_id": "runwayml", "careers_url": "https://runwayml.com/careers"},
    {"company": "Character.AI", "ats": "greenhouse", "board_id": "characterai", "careers_url": "https://character.ai/careers"},
    {"company": "ElevenLabs", "ats": "ashby", "board_id": "elevenlabs", "careers_url": "https://elevenlabs.io/careers"},
    {"company": "Cursor / Anysphere", "ats": "ashby", "board_id": "anysphere", "careers_url": "https://www.cursor.com/careers"},
    {"company": "Perplexity", "ats": "ashby", "board_id": "perplexity", "careers_url": "https://www.perplexity.ai/hub/careers"},
    {"company": "Glean", "ats": "greenhouse", "board_id": "glaboratories", "careers_url": "https://www.glean.com/careers"},
    {"company": "Stability AI", "ats": "lever", "board_id": "stabilityai", "careers_url": "https://stability.ai/careers"},
    {"company": "Synthesia", "ats": "greenhouse", "board_id": "synthesia", "careers_url": "https://www.synthesia.io/careers"},
    {"company": "Replit", "ats": "ashby", "board_id": "replit", "careers_url": "https://replit.com/site/careers"},

    # ── SaaS / Productivity ───────────────────────────────
    {"company": "Figma", "ats": "greenhouse", "board_id": "figma", "careers_url": "https://www.figma.com/careers"},
    {"company": "Notion", "ats": "greenhouse", "board_id": "notion", "careers_url": "https://www.notion.so/careers"},
    {"company": "Asana", "ats": "greenhouse", "board_id": "asana", "careers_url": "https://asana.com/jobs"},
    {"company": "Linear", "ats": "ashby", "board_id": "linear", "careers_url": "https://linear.app/careers"},
    {"company": "Miro", "ats": "greenhouse", "board_id": "maboroshiinc", "careers_url": "https://miro.com/careers"},
    {"company": "Airtable", "ats": "greenhouse", "board_id": "airtable", "careers_url": "https://airtable.com/careers"},
    {"company": "Retool", "ats": "greenhouse", "board_id": "retool", "careers_url": "https://retool.com/careers"},
    {"company": "HubSpot", "ats": "greenhouse", "board_id": "hubspot", "careers_url": "https://www.hubspot.com/careers"},

    # ── Fintech ───────────────────────────────────────────
    {"company": "Stripe", "ats": "greenhouse", "board_id": "stripe", "careers_url": "https://stripe.com/jobs"},
    {"company": "Ramp", "ats": "greenhouse", "board_id": "raboramp", "careers_url": "https://ramp.com/careers"},
    {"company": "Coinbase", "ats": "greenhouse", "board_id": "coinbase", "careers_url": "https://www.coinbase.com/careers"},
    {"company": "Affirm", "ats": "greenhouse", "board_id": "affirm", "careers_url": "https://www.affirm.com/careers"},
    {"company": "Robinhood", "ats": "greenhouse", "board_id": "robinhood", "careers_url": "https://robinhood.com/careers"},
    {"company": "Revolut", "ats": "lever", "board_id": "revolut", "careers_url": "https://www.revolut.com/careers"},
    {"company": "Wise", "ats": "greenhouse", "board_id": "transferwise", "careers_url": "https://www.wise.jobs"},
    {"company": "Monzo", "ats": "greenhouse", "board_id": "monzo", "careers_url": "https://monzo.com/careers"},

    # ── Social / Communication ────────────────────────────
    {"company": "Discord", "ats": "greenhouse", "board_id": "discord", "careers_url": "https://discord.com/careers"},
    {"company": "Reddit", "ats": "greenhouse", "board_id": "reddit", "careers_url": "https://www.redditinc.com/careers"},
    {"company": "Pinterest", "ats": "greenhouse", "board_id": "pinterest", "careers_url": "https://www.pinterestcareers.com"},
    {"company": "Nextdoor", "ats": "greenhouse", "board_id": "nextdoor", "careers_url": "https://about.nextdoor.com/careers"},
    {"company": "Bumble", "ats": "greenhouse", "board_id": "bumble", "careers_url": "https://bumble.com/en/careers"},

    # ── Marketplace / Delivery ────────────────────────────
    {"company": "DoorDash", "ats": "greenhouse", "board_id": "doordash", "careers_url": "https://careers.doordash.com"},
    {"company": "Instacart", "ats": "greenhouse", "board_id": "instacart", "careers_url": "https://instacart.careers"},

    # ── Gaming ────────────────────────────────────────────
    {"company": "Riot Games", "ats": "greenhouse", "board_id": "riotgames", "careers_url": "https://www.riotgames.com/en/work-with-us"},
    {"company": "Epic Games", "ats": "greenhouse", "board_id": "epicgames", "careers_url": "https://www.epicgames.com/site/en-US/careers"},
    {"company": "Roblox", "ats": "greenhouse", "board_id": "roblox", "careers_url": "https://corp.roblox.com/careers"},

    # ── Media / Streaming ─────────────────────────────────
    {"company": "Spotify", "ats": "lever", "board_id": "spotify", "careers_url": "https://www.lifeatspotify.com"},
    {"company": "Roku", "ats": "greenhouse", "board_id": "roku", "careers_url": "https://www.roku.com/en-us/jobs"},

    # ── Mobile-First ──────────────────────────────────────
    {"company": "Strava", "ats": "greenhouse", "board_id": "strava", "careers_url": "https://www.strava.com/careers"},
    {"company": "Calm", "ats": "greenhouse", "board_id": "calm", "careers_url": "https://www.calm.com/careers"},
    {"company": "AllTrails", "ats": "lever", "board_id": "alltrails", "careers_url": "https://www.alltrails.com/careers"},
    {"company": "Whatnot", "ats": "lever", "board_id": "whatnot", "careers_url": "https://www.whatnot.com/careers"},

    # ── Australia ─────────────────────────────────────────
    {"company": "Canva", "ats": "greenhouse", "board_id": "canva", "careers_url": "https://www.canva.com/careers"},
    {"company": "Atlassian", "ats": "lever", "board_id": "atlassian", "careers_url": "https://www.atlassian.com/company/careers"},

    # ── HR / Enterprise ───────────────────────────────────
    {"company": "Rippling", "ats": "ashby", "board_id": "rippling", "careers_url": "https://www.rippling.com/careers"},
    {"company": "Grammarly", "ats": "greenhouse", "board_id": "grammarly", "careers_url": "https://www.grammarly.com/careers"},
    {"company": "Shopify", "ats": "greenhouse", "board_id": "shopify", "careers_url": "https://www.shopify.com/careers"},
    {"company": "Dropbox", "ats": "greenhouse", "board_id": "dropbox", "careers_url": "https://www.dropbox.com/jobs"},

    # ── Cloud / Data / Infrastructure ────────────────────
    {"company": "Databricks", "ats": "greenhouse", "board_id": "databricks", "careers_url": "https://www.databricks.com/company/careers"},
    {"company": "Snowflake", "ats": "greenhouse", "board_id": "snowflake", "careers_url": "https://careers.snowflake.com"},
    {"company": "Cloudflare", "ats": "greenhouse", "board_id": "cloudflare", "careers_url": "https://www.cloudflare.com/careers"},
    {"company": "Twilio", "ats": "greenhouse", "board_id": "twilio", "careers_url": "https://www.twilio.com/company/jobs"},
    {"company": "MongoDB", "ats": "greenhouse", "board_id": "mongodb", "careers_url": "https://www.mongodb.com/careers"},
    {"company": "Elastic", "ats": "greenhouse", "board_id": "elastic", "careers_url": "https://www.elastic.co/careers"},
    {"company": "HashiCorp", "ats": "greenhouse", "board_id": "hashicorp", "careers_url": "https://www.hashicorp.com/careers"},
    {"company": "PlanetScale", "ats": "ashby", "board_id": "planetscale", "careers_url": "https://planetscale.com/careers"},
    {"company": "Vercel", "ats": "greenhouse", "board_id": "vercel", "careers_url": "https://vercel.com/careers"},
    {"company": "Supabase", "ats": "ashby", "board_id": "supabase", "careers_url": "https://supabase.com/careers"},

    # ── Cybersecurity ────────────────────────────────────
    {"company": "CrowdStrike", "ats": "greenhouse", "board_id": "crowdstrike", "careers_url": "https://www.crowdstrike.com/careers"},
    {"company": "Palo Alto Networks", "ats": "greenhouse", "board_id": "paboraltonetworks2", "careers_url": "https://www.paloaltonetworks.com/company/careers"},
    {"company": "SentinelOne", "ats": "greenhouse", "board_id": "sentinelone", "careers_url": "https://www.sentinelone.com/careers"},
    {"company": "1Password", "ats": "greenhouse", "board_id": "1password", "careers_url": "https://1password.com/careers"},
    {"company": "Verkada", "ats": "greenhouse", "board_id": "verkada", "careers_url": "https://www.verkada.com/careers"},

    # ── Health Tech ──────────────────────────────────────
    {"company": "Flatiron Health", "ats": "greenhouse", "board_id": "flatironhealth", "careers_url": "https://flatiron.com/careers"},
    {"company": "Noom", "ats": "greenhouse", "board_id": "noom", "careers_url": "https://www.noom.com/careers"},
    {"company": "Hinge Health", "ats": "greenhouse", "board_id": "hingehealth", "careers_url": "https://www.hingehealth.com/careers"},
    {"company": "Ro", "ats": "greenhouse", "board_id": "ro", "careers_url": "https://ro.co/careers"},
    {"company": "Color Health", "ats": "greenhouse", "board_id": "color", "careers_url": "https://www.color.com/careers"},

    # ── E-Commerce / Retail Tech ─────────────────────────
    {"company": "Squarespace", "ats": "greenhouse", "board_id": "squarespace", "careers_url": "https://www.squarespace.com/careers"},
    {"company": "Faire", "ats": "greenhouse", "board_id": "faire", "careers_url": "https://www.faire.com/careers"},
    {"company": "Webflow", "ats": "greenhouse", "board_id": "webflow", "careers_url": "https://webflow.com/careers"},

    # ── Fintech (additional) ─────────────────────────────
    {"company": "Brex", "ats": "greenhouse", "board_id": "brex", "careers_url": "https://www.brex.com/careers"},
    {"company": "Mercury", "ats": "greenhouse", "board_id": "mercury", "careers_url": "https://mercury.com/careers"},
    {"company": "Chime", "ats": "greenhouse", "board_id": "chime", "careers_url": "https://www.chime.com/careers"},
    {"company": "Plaid", "ats": "lever", "board_id": "plaid", "careers_url": "https://plaid.com/careers"},
    {"company": "Marqeta", "ats": "greenhouse", "board_id": "marqeta", "careers_url": "https://www.marqeta.com/careers"},
    {"company": "Deel", "ats": "ashby", "board_id": "deel", "careers_url": "https://www.deel.com/careers"},
    {"company": "Kraken", "ats": "ashby", "board_id": "kraken.com", "careers_url": "https://www.kraken.com/careers"},

    # ── Developer Tools ──────────────────────────────────
    {"company": "Postman", "ats": "greenhouse", "board_id": "postman", "careers_url": "https://www.postman.com/company/careers"},
    {"company": "LaunchDarkly", "ats": "greenhouse", "board_id": "launchdarkly", "careers_url": "https://launchdarkly.com/careers"},
    {"company": "Sentry", "ats": "greenhouse", "board_id": "sentry", "careers_url": "https://sentry.io/careers"},
    {"company": "Grafana Labs", "ats": "greenhouse", "board_id": "grafanalabs", "careers_url": "https://grafana.com/about/careers"},
    {"company": "Sourcegraph", "ats": "greenhouse", "board_id": "sourcegraph91", "careers_url": "https://about.sourcegraph.com/careers"},
    {"company": "Raycast", "ats": "ashby", "board_id": "raycast", "careers_url": "https://www.raycast.com/careers"},
    {"company": "Zapier", "ats": "ashby", "board_id": "zapier", "careers_url": "https://zapier.com/careers"},

    # ── EdTech ───────────────────────────────────────────
    {"company": "Duolingo", "ats": "greenhouse", "board_id": "duolingo", "careers_url": "https://careers.duolingo.com"},
    {"company": "Coursera", "ats": "lever", "board_id": "coursera", "careers_url": "https://www.coursera.org/about/careers"},
    {"company": "Khan Academy", "ats": "lever", "board_id": "khanacademy", "careers_url": "https://www.khanacademy.org/careers"},

    # ── Travel / Hospitality ─────────────────────────────
    {"company": "Airbnb", "ats": "greenhouse", "board_id": "airbnb", "careers_url": "https://careers.airbnb.com"},
    {"company": "Expedia", "ats": "greenhouse", "board_id": "expedia", "careers_url": "https://careers.expediagroup.com"},

    # ── HR / People Tech ─────────────────────────────────
    {"company": "Gusto", "ats": "greenhouse", "board_id": "gusto", "careers_url": "https://gusto.com/about/careers"},
    {"company": "Lattice", "ats": "greenhouse", "board_id": "lattice", "careers_url": "https://lattice.com/careers"},

    # ── Productivity / Communication ─────────────────────
    {"company": "Superhuman", "ats": "ashby", "board_id": "superhuman", "careers_url": "https://superhuman.com/careers"},
    {"company": "Loom", "ats": "greenhouse", "board_id": "loom", "careers_url": "https://www.loom.com/careers"},
    {"company": "Intercom", "ats": "greenhouse", "board_id": "intercom", "careers_url": "https://www.intercom.com/careers"},
    {"company": "Gong", "ats": "greenhouse", "board_id": "gong", "careers_url": "https://www.gong.io/careers"},

    # ── AI (additional) ──────────────────────────────────
    {"company": "Suno", "ats": "ashby", "board_id": "suno", "careers_url": "https://www.suno.com/careers"},
    {"company": "Cohere", "ats": "lever", "board_id": "cohere", "careers_url": "https://cohere.com/careers"},
    {"company": "Scale AI", "ats": "lever", "board_id": "scaleai", "careers_url": "https://scale.com/careers"},
    {"company": "Hugging Face", "ats": "greenhouse", "board_id": "huggingface", "careers_url": "https://huggingface.co/careers"},
    {"company": "Weights & Biases", "ats": "greenhouse", "board_id": "wandb", "careers_url": "https://wandb.ai/careers"},
    {"company": "Mistral AI", "ats": "lever", "board_id": "mistral", "careers_url": "https://mistral.ai/careers"},
    {"company": "Adept AI", "ats": "ashby", "board_id": "adept", "careers_url": "https://www.adept.ai/careers"},

    # ── UAE / Middle East ────────────────────────────────
    {"company": "Careem", "ats": "greenhouse", "board_id": "careem", "careers_url": "https://www.careem.com/careers"},
]

# Role title keywords — product manager roles only (no PgM or PMM)
ROLE_KEYWORDS = [
    "product manager", "product lead", "product director", "vp product",
    "head of product", "senior product manager", "staff product manager",
    "principal product manager", "group product manager",
    "growth pm", "growth product",
]

# Exclude roles that match keywords but aren't a fit
ROLE_EXCLUDE_KEYWORDS = [
    "associate product manager", "apm",         # too junior
    "intern", "internship", "co-op",            # too junior
    "backend", "infrastructure", "platform eng", # backend focus
    "data product", "data platform",            # data infra
    "supply chain", "operations manager",       # ops, not product
    "sales", "account manager",                 # sales roles
    "hardware", "mechanical",                   # hardware roles
    "program manager", "technical program manager",  # PgM — not product
    "product marketing", "product marketing manager", # PMM — not product
]

# ── Salary Extraction ──────────────────────────────────────────────────
# Many companies in CA/CO/NY/WA post pay ranges due to transparency laws.
# We extract from structured ATS fields first, then regex from JD content.

SALARY_PATTERN = re.compile(
    r"\$\s*([\d,]+(?:\.\d+)?)\s*(?:k|K)?\s*(?:[-–—to]+\s*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:k|K)?)?",
)


def _extract_salary_from_text(text: str) -> dict:
    """Parse salary range from free text (job description HTML/content).
    Returns {"min": int, "max": int, "raw": str} or empty dict.
    """
    if not text:
        return {}
    matches = SALARY_PATTERN.findall(text)
    # Look for plausible annual salary amounts (> $50k, < $2M)
    for match in matches:
        lo_str = match[0].replace(",", "")
        hi_str = match[1].replace(",", "") if match[1] else ""
        try:
            lo = float(lo_str)
            # Handle "k" suffix: 250k → 250000
            if lo < 1000:
                lo *= 1000
            hi = float(hi_str) if hi_str else lo
            if hi < 1000:
                hi *= 1000
            # Filter out hourly rates and unrealistic numbers
            if 50_000 <= lo <= 2_000_000 and 50_000 <= hi <= 2_000_000:
                return {"min": int(lo), "max": int(hi), "raw": match[0] + ("-" + match[1] if match[1] else "")}
        except (ValueError, IndexError):
            continue
    return {}


def _extract_salary_greenhouse(job: dict) -> dict:
    """Extract salary from Greenhouse job data. Checks pay_input_ranges and content."""
    # Structured field (not always present)
    pay_ranges = job.get("pay_input_ranges", [])
    if pay_ranges:
        r = pay_ranges[0]
        lo = r.get("min_cents", 0) / 100
        hi = r.get("max_cents", 0) / 100
        if 50_000 <= lo <= 2_000_000:
            return {"min": int(lo), "max": int(hi), "raw": f"${lo:,.0f}-${hi:,.0f}"}
    # Fallback: parse from job description content
    content = job.get("content", "")
    return _extract_salary_from_text(content)


def _extract_salary_lever(job: dict) -> dict:
    """Extract salary from Lever job data. Checks salaryRange and description."""
    salary_range = job.get("salaryRange", {})
    if salary_range:
        lo = salary_range.get("min", 0)
        hi = salary_range.get("max", 0)
        if 50_000 <= lo <= 2_000_000:
            return {"min": int(lo), "max": int(hi), "raw": f"${lo:,.0f}-${hi:,.0f}"}
    # Additional field sometimes has compensation
    additional = job.get("additional", "") or ""
    desc = job.get("descriptionPlain", "") or job.get("description", "")
    return _extract_salary_from_text(additional + " " + desc)


def _extract_salary_ashby(job: dict) -> dict:
    """Extract salary from Ashby job data. Checks compensation and description."""
    comp = job.get("compensation", {})
    if comp:
        lo = comp.get("min", 0)
        hi = comp.get("max", 0)
        if 50_000 <= lo <= 2_000_000:
            return {"min": int(lo), "max": int(hi), "raw": f"${lo:,.0f}-${hi:,.0f}"}
    content = job.get("descriptionHtml", "") or job.get("description", "")
    return _extract_salary_from_text(content)

# ── Location Groups ────────────────────────────────────────────────────
# Organized into groups for frontend filtering

LOCATION_GROUPS = {
    "bay_area": [
        "san francisco", "sf", "bay area", "mountain view", "palo alto",
        "menlo park", "sunnyvale", "san jose", "cupertino", "oakland",
        "redwood city", "south san francisco", "foster city", "sacramento",
    ],
    "remote": [
        "remote", "anywhere", "distributed", "work from home",
    ],
    "uk": [
        "london", "uk", "united kingdom", "england", "manchester",
        "edinburgh", "cambridge", "bristol", "birmingham",
    ],
    "australia": [
        "sydney", "melbourne", "australia", "brisbane", "perth",
        "adelaide", "canberra",
    ],
    "uae": [
        "dubai", "uae", "abu dhabi", "united arab emirates",
    ],
    "other_us": [
        "new york", "nyc", "los angeles", "la", "seattle", "austin",
        "boston", "chicago", "denver", "portland", "san diego", "washington",
    ],
}

# International groups — used for salary filter bypass and comp display
INTERNATIONAL_GROUPS = {"uk", "australia", "uae"}

# Flat list for scanner-level filtering (accept all known locations)
LOCATION_KEYWORDS = [kw for group in LOCATION_GROUPS.values() for kw in group]


# ── ATS Scanners ────────────────────────────────────────────────────────

async def _scan_greenhouse(client: httpx.AsyncClient, board_id: str, company: str) -> list:
    """Scan Greenhouse job board API for matching roles."""
    url = ATS_APIS["greenhouse"].format(board_id=board_id)
    jobs = []
    try:
        resp = await client.get(url, params={"content": "true"}, timeout=15)
        if resp.status_code != 200:
            logger.warning(f"Greenhouse {board_id}: HTTP {resp.status_code}")
            return []
        data = resp.json()
        for job in data.get("jobs", []):
            title = job.get("title", "")
            if not _matches_role(title):
                continue
            location = job.get("location", {}).get("name", "")
            posted_at = job.get("updated_at", job.get("first_published_at", ""))
            job_url = job.get("absolute_url", "")
            salary = _extract_salary_greenhouse(job)
            jobs.append({
                "company": company,
                "title": title,
                "location": location,
                "posted_at": posted_at,
                "url": job_url,
                "source": "career_page",
                "ats": "greenhouse",
                "department": _extract_department(job),
                "salary": salary,
            })
    except Exception as e:
        logger.error(f"Greenhouse {board_id} scan failed: {e}")
    return jobs


async def _scan_lever(client: httpx.AsyncClient, board_id: str, company: str) -> list:
    """Scan Lever job board API for matching roles."""
    url = ATS_APIS["lever"].format(board_id=board_id)
    jobs = []
    try:
        resp = await client.get(url, timeout=15)
        if resp.status_code != 200:
            logger.warning(f"Lever {board_id}: HTTP {resp.status_code}")
            return []
        data = resp.json()
        for job in data if isinstance(data, list) else []:
            title = job.get("text", "")
            if not _matches_role(title):
                continue
            location = job.get("categories", {}).get("location", "")
            posted_at = ""
            created_at = job.get("createdAt")
            if created_at:
                posted_at = datetime.fromtimestamp(created_at / 1000, tz=timezone.utc).isoformat()
            job_url = job.get("hostedUrl", "")
            salary = _extract_salary_lever(job)
            jobs.append({
                "company": company,
                "title": title,
                "location": location,
                "posted_at": posted_at,
                "url": job_url,
                "source": "career_page",
                "ats": "lever",
                "department": job.get("categories", {}).get("team", ""),
                "salary": salary,
            })
    except Exception as e:
        logger.error(f"Lever {board_id} scan failed: {e}")
    return jobs


async def _scan_ashby(client: httpx.AsyncClient, board_id: str, company: str) -> list:
    """Scan Ashby job board API for matching roles."""
    url = ATS_APIS["ashby"].format(board_id=board_id)
    jobs = []
    try:
        resp = await client.get(url, timeout=15)
        if resp.status_code != 200:
            logger.warning(f"Ashby {board_id}: HTTP {resp.status_code}")
            return []
        data = resp.json()
        for job in data.get("jobs", []):
            title = job.get("title", "")
            if not _matches_role(title):
                continue
            location = job.get("location", "")
            posted_at = job.get("publishedAt", job.get("updatedAt", ""))
            job_url = job.get("jobUrl", "")
            department = job.get("departmentName", "")
            salary = _extract_salary_ashby(job)
            jobs.append({
                "company": company,
                "title": title,
                "location": location,
                "posted_at": posted_at,
                "url": job_url,
                "source": "career_page",
                "ats": "ashby",
                "department": department,
                "salary": salary,
            })
    except Exception as e:
        logger.error(f"Ashby {board_id} scan failed: {e}")
    return jobs


def _matches_role(title: str) -> bool:
    """Check if a job title matches PM/PgM/PMM keywords, excluding poor fits."""
    title_lower = title.lower()
    # Must match at least one include keyword
    if not any(kw in title_lower for kw in ROLE_KEYWORDS):
        return False
    # Must not match any exclude keyword
    if any(kw in title_lower for kw in ROLE_EXCLUDE_KEYWORDS):
        return False
    return True


def _matches_location(location: str) -> bool:
    """Check if a location matches target geographies. Empty/remote always matches."""
    if not location:
        return True
    loc_lower = location.lower()
    return any(kw in loc_lower for kw in LOCATION_KEYWORDS)


def classify_location(location: str) -> str:
    """Classify a location into a group: bay_area, remote, uk, australia, uae, other_us, unknown."""
    if not location:
        return "remote"  # No location listed = likely remote
    loc_lower = location.lower()
    for group_name, keywords in LOCATION_GROUPS.items():
        if any(kw in loc_lower for kw in keywords):
            return group_name
    return "unknown"


def _extract_department(job: dict) -> str:
    """Extract department from Greenhouse job data."""
    depts = job.get("departments", [])
    if depts:
        return depts[0].get("name", "")
    return ""


# ── Aggregator API Scanners ─────────────────────────────────────────────

async def _scan_remotive(client: httpx.AsyncClient) -> list:
    """Scan Remotive API for remote-only product manager roles.

    Endpoint: GET https://remotive.com/api/remote-jobs?search=product+manager
    Completely free, no authentication required.
    """
    url = "https://remotive.com/api/remote-jobs"
    jobs = []
    try:
        resp = await client.get(url, params={"search": "product manager"}, timeout=15)
        if resp.status_code != 200:
            logger.warning(f"Remotive API: HTTP {resp.status_code}")
            return []
        data = resp.json()
        for job in data.get("jobs", []):
            title = job.get("title", "")
            if not _matches_role(title):
                continue

            company = job.get("company_name", "")
            location = job.get("candidate_required_location", "Remote")  # Remotive is remote-only
            job_url = job.get("url", "")
            posted_at = job.get("publication_date", "")

            # Normalize date format if needed
            if posted_at and "T" not in posted_at:
                try:
                    # Try parsing as simple date and convert to ISO
                    dt = datetime.fromisoformat(posted_at)
                    posted_at = dt.isoformat()
                except (ValueError, AttributeError):
                    pass

            jobs.append({
                "company": company,
                "title": title,
                "location": location,
                "posted_at": posted_at,
                "url": job_url,
                "source": "remotive",
                "department": "",
                "salary": {},
            })
    except Exception as e:
        logger.error(f"Remotive scan failed: {e}")

    return jobs


async def _scan_themuse(client: httpx.AsyncClient) -> list:
    """Scan The Muse API for product manager roles.

    Endpoint: GET https://www.themuse.com/api/public/jobs?category=Product%20Management&page=0
    Free tier: 500 requests/hour without API key. Paginate up to 5 pages.
    """
    url = "https://www.themuse.com/api/public/jobs"
    jobs = []
    max_pages = 5

    try:
        for page in range(max_pages):
            params = {
                "category": "Product Management",
                "page": page,
            }
            resp = await client.get(url, params=params, timeout=15)
            if resp.status_code != 200:
                logger.warning(f"The Muse API page {page}: HTTP {resp.status_code}")
                break

            data = resp.json()
            results = data.get("results", [])

            if not results:
                break  # No more results

            for job in results:
                title = job.get("name", "")
                if not _matches_role(title):
                    continue

                company = job.get("company", {}).get("name", "")

                # Locations is a list of dicts with "name" key
                locations = job.get("locations", [])
                location = locations[0].get("name", "") if locations else ""

                job_url = job.get("refs", {}).get("landing_page", "")
                posted_at = job.get("publication_date", "")

                # Normalize date format if needed
                if posted_at and "T" not in posted_at:
                    try:
                        dt = datetime.fromisoformat(posted_at)
                        posted_at = dt.isoformat()
                    except (ValueError, AttributeError):
                        pass

                jobs.append({
                    "company": company,
                    "title": title,
                    "location": location,
                    "posted_at": posted_at,
                    "url": job_url,
                    "source": "themuse",
                    "department": "",
                    "salary": {},
                })

    except Exception as e:
        logger.error(f"The Muse scan failed: {e}")

    return jobs


async def _scan_adzuna(client: httpx.AsyncClient) -> list:
    """Scan Adzuna API for product manager roles across multiple countries.

    Endpoint: GET https://api.adzuna.com/v1/api/jobs/{country}/search/1
    Requires ADZUNA_APP_ID and ADZUNA_APP_KEY environment variables.
    Searches: us, gb (UK), au (Australia), ae (UAE)
    """
    jobs = []

    # Only run if credentials are configured
    if not ADZUNA_APP_ID or not ADZUNA_APP_KEY:
        logger.debug("Adzuna API: credentials not configured, skipping")
        return []

    countries = ["us", "gb", "au", "ae"]

    for country in countries:
        url = f"https://api.adzuna.com/v1/api/jobs/{country}/search/1"

        try:
            params = {
                "app_id": ADZUNA_APP_ID,
                "app_key": ADZUNA_APP_KEY,
                "what": "product manager",
                "results_per_page": 50,
            }

            resp = await client.get(url, params=params, timeout=15)
            if resp.status_code != 200:
                logger.warning(f"Adzuna API {country}: HTTP {resp.status_code}")
                continue

            data = resp.json()
            for job in data.get("results", []):
                title = job.get("title", "")
                if not _matches_role(title):
                    continue

                company = job.get("company", {}).get("display_name", "")
                location = job.get("location", {}).get("display_name", "")
                job_url = job.get("redirect_url", "")
                posted_at = job.get("created", "")

                # Extract salary if available
                salary = {}
                salary_min = job.get("salary_min")
                salary_max = job.get("salary_max")
                if salary_min and salary_max:
                    salary = {
                        "min": int(salary_min),
                        "max": int(salary_max),
                        "raw": f"${int(salary_min):,}-${int(salary_max):,}",
                    }

                jobs.append({
                    "company": company,
                    "title": title,
                    "location": location,
                    "posted_at": posted_at,
                    "url": job_url,
                    "source": "adzuna",
                    "department": "",
                    "salary": salary,
                })

        except Exception as e:
            logger.error(f"Adzuna {country} scan failed: {e}")

    return jobs


# ── Core Scan Engine ────────────────────────────────────────────────────

ATS_SCANNERS = {
    "greenhouse": _scan_greenhouse,
    "lever": _scan_lever,
    "ashby": _scan_ashby,
}


async def run_full_scan() -> dict:
    """
    Run a full scan across all configured company career pages and job aggregators.
    Returns summary with new jobs found, total scanned, and errors.
    """
    existing_jobs = _load_json(JOBS_FILE)
    existing_ids = {j["id"] for j in existing_jobs}
    dismissed = set(_load_json(DISMISSED_FILE))

    new_jobs = []
    errors = []
    companies_scanned = 0
    aggregators_scanned = 0

    async with httpx.AsyncClient() as client:
        # ── ATS Company Career Pages ────────────────────────────────────────
        for source in COMPANY_CAREER_SOURCES:
            ats = source["ats"]
            scanner = ATS_SCANNERS.get(ats)
            if not scanner:
                continue

            try:
                raw_jobs = await scanner(client, source["board_id"], source["company"])
                companies_scanned += 1

                for job in raw_jobs:
                    if not _matches_location(job.get("location", "")):
                        continue

                    jid = _job_id(job["company"], job["title"], job["url"])
                    if jid in existing_ids or jid in dismissed:
                        continue

                    job["id"] = jid
                    job["freshness"] = compute_freshness(job.get("posted_at", "")).value
                    job["location_group"] = classify_location(job.get("location", ""))
                    fit = compute_fit_score(job)
                    job["fit_score"] = fit["score"]
                    job["fit_label"] = fit["label"]
                    job["fit_breakdown"] = fit["breakdown"]
                    job["rank_score"] = compute_rank_score(fit["score"], job["freshness"])
                    job["discovered_at"] = datetime.now(timezone.utc).isoformat()
                    job["status"] = "new"
                    new_jobs.append(job)
                    existing_ids.add(jid)

            except Exception as e:
                errors.append({"company": source["company"], "error": str(e)})
                logger.error(f"Scan error for {source['company']}: {e}")

        # ── Job Aggregator APIs ────────────────────────────────────────────
        aggregator_scanners = [
            ("remotive", _scan_remotive),
            ("themuse", _scan_themuse),
            ("adzuna", _scan_adzuna),
        ]

        for agg_name, agg_scanner in aggregator_scanners:
            try:
                raw_jobs = await agg_scanner(client)
                if raw_jobs:
                    aggregators_scanned += 1

                for job in raw_jobs:
                    if not _matches_location(job.get("location", "")):
                        continue

                    jid = _job_id(job["company"], job["title"], job["url"])
                    if jid in existing_ids or jid in dismissed:
                        continue

                    job["id"] = jid
                    job["freshness"] = compute_freshness(job.get("posted_at", "")).value
                    job["location_group"] = classify_location(job.get("location", ""))
                    fit = compute_fit_score(job)
                    job["fit_score"] = fit["score"]
                    job["fit_label"] = fit["label"]
                    job["fit_breakdown"] = fit["breakdown"]
                    job["rank_score"] = compute_rank_score(fit["score"], job["freshness"])
                    job["discovered_at"] = datetime.now(timezone.utc).isoformat()
                    job["status"] = "new"
                    new_jobs.append(job)
                    existing_ids.add(jid)

            except Exception as e:
                errors.append({"source": agg_name, "error": str(e)})
                logger.error(f"Aggregator scan error for {agg_name}: {e}")

    # Merge new jobs with existing, update freshness + location_group on existing
    for job in existing_jobs:
        job["freshness"] = compute_freshness(job.get("posted_at", "")).value
        if "location_group" not in job:
            job["location_group"] = classify_location(job.get("location", ""))

    all_jobs = existing_jobs + new_jobs
    _save_json(JOBS_FILE, all_jobs)

    # Log scan
    scan_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "companies_scanned": companies_scanned,
        "aggregators_scanned": aggregators_scanned,
        "new_jobs_found": len(new_jobs),
        "total_jobs": len(all_jobs),
        "errors": len(errors),
    }
    scan_log = _load_json(SCAN_LOG_FILE)
    scan_log.append(scan_entry)
    _save_json(SCAN_LOG_FILE, scan_log[-100:])  # Keep last 100 scans

    logger.info(f"Scan complete: {companies_scanned} ATS companies, {aggregators_scanned} aggregators, {len(new_jobs)} new jobs, {len(errors)} errors")

    sorted_new = sorted(new_jobs, key=lambda j: -(j.get("rank_score", 0)))

    # Push notification if new jobs found
    if sorted_new:
        try:
            from services.notification_service import notify_job_match
            notify_job_match(
                new_job_count=len(sorted_new),
                top_match=sorted_new[0] if sorted_new else None,
            )
        except Exception as e:
            logger.warning("Failed to send job match notification: %s", e)

    return {
        "new_jobs": sorted_new,
        "companies_scanned": companies_scanned,
        "aggregators_scanned": aggregators_scanned,
        "total_jobs": len(all_jobs),
        "errors": errors,
        "scan_time": scan_entry["timestamp"],
    }


def _freshness_sort_key(freshness: str) -> int:
    order = {"gold": 0, "strong": 1, "decent": 2, "stale": 3}
    return order.get(freshness, 4)


# Freshness multiplier for composite ranking.
# Fresh + strong fit should always beat stale + strong fit or fresh + weak fit.
# Multiplier × fit_score (0–100) = rank_score (0–200).
FRESHNESS_MULTIPLIER = {
    "gold": 2.0,     # < 6h — doubles fit score
    "strong": 1.6,   # 6-24h — strong boost
    "decent": 1.2,   # 24-48h — moderate boost
    "stale": 0.7,    # > 48h — penalizes fit score
}


def compute_rank_score(fit_score: int, freshness: str) -> float:
    """Composite rank score = freshness_multiplier × fit_score.
    A gold/100-fit job scores 200. A stale/100-fit scores 70. A gold/30-fit scores 60.
    This ensures you need BOTH freshness AND fit to rank at the top.
    """
    mult = FRESHNESS_MULTIPLIER.get(freshness, 0.7)
    return round(mult * fit_score, 1)


# ── Fit Scoring ────────────────────────────────────────────────────────
# Surfaces best-fit jobs to the top based on Kiran's profile:
#   - Senior/Director/VP PM with 15+ years in fintech, mobile, AI, enterprise
#   - Wells Fargo (mobile growth 18M→32M, Fargo AI 4.1M→27.5M), First Republic (Director, payments)
#   - Avatour AI (VP Product, AR/VR, AI agents)
#   - Target: Bay Area, $250K+, consumer/growth/platform product
#
# Score range: 0–100. Higher = better fit. Used as secondary sort within freshness tiers.

# Seniority signals in title — IC roles promoted over management titles
SENIORITY_SCORES = {
    "principal product manager": 30,   # Senior IC — top target
    "staff product manager": 29,       # Senior IC
    "group product manager": 28,       # Senior IC / player-coach
    "senior product manager": 27,      # Core IC target
    "product lead": 25,                # IC-leaning lead
    "head of product": 18,             # Management — still okay
    "director": 16,                    # Management
    "vp": 14,                          # Management-heavy
    "vice president": 14,              # Management-heavy
    "product manager": 12,             # generic PM — might be any level
}

# Domain keywords detected from title + department (matched against Kiran's strengths)
# Note: "fintech" scores high (tech companies doing finance) but "banking" scores low
# (traditional banks) — Kiran has the experience but wants to move away from banks.
DOMAIN_SCORES = {
    # Strong fit — direct experience, tech-forward
    "fintech": 15, "payments": 15,
    "ai": 14, "ml": 14, "machine learning": 14, "llm": 14, "generative": 14,
    "growth": 13, "engagement": 12, "retention": 12, "activation": 12,
    "mobile": 12, "app": 10,
    "consumer": 12, "b2c": 12,
    "platform": 10, "api": 10, "infrastructure": 8,
    "security": 10, "identity": 10, "authentication": 10,
    "enterprise": 8, "b2b": 8, "saas": 8,
    # Moderate fit — adjacent experience
    "marketplace": 7, "e-commerce": 7, "commerce": 7,
    "data": 7, "analytics": 7,
    "design": 6, "ux": 6,
    "developer": 6, "devtools": 6, "dev tools": 6,
    # Weaker fit — less direct overlap
    "content": 4, "media": 4, "social": 4,
    "hardware": 2, "robotics": 2, "biotech": 2,
    # Domain signals for traditional finance — deprioritized
    "finance": 5, "banking": 3,
}

# Companies identified as traditional banks / financial institutions — penalized
BANK_KEYWORDS = [
    "wells fargo", "jpmorgan", "jp morgan", "chase", "bank of america",
    "citibank", "citi", "goldman sachs", "morgan stanley", "capital one",
    "us bank", "u.s. bank", "pnc", "truist", "td bank", "hsbc",
    "barclays", "ubs", "credit suisse", "deutsche bank", "bnp",
    "first republic", "svb", "silicon valley bank", "fifth third",
    "regions bank", "keybank", "citizens bank", "ally bank",
    "american express", "discover financial", "synchrony",
]

# Company-level tier boost (from target list context)
COMPANY_TIER = {
    # Dream companies — strong brand, product-led, aligned domains
    "stripe": "dream", "figma": "dream", "notion": "dream", "anthropic": "dream",
    "openai": "dream", "linear": "dream", "ramp": "dream", "cursor / anysphere": "dream",
    "perplexity": "dream", "midjourney": "dream",
    # High-probability — good fit, realistic targets
    "coinbase": "high-prob", "discord": "high-prob", "reddit": "high-prob",
    "spotify": "high-prob", "asana": "high-prob", "airtable": "high-prob",
    "shopify": "high-prob", "hubspot": "high-prob", "retool": "high-prob",
    "robinhood": "high-prob", "affirm": "high-prob", "glean": "high-prob",
    "canva": "high-prob", "atlassian": "high-prob", "dropbox": "high-prob",
    "rippling": "high-prob", "grammarly": "high-prob", "pinterest": "high-prob",
    # Practice tier — good companies but less direct fit
}

TIER_SCORES = {"dream": 15, "high-prob": 10, "practice": 3}

# Location preference order
LOCATION_PREF_SCORES = {
    "bay_area": 10,
    "remote": 8,
    "uk": 6,
    "australia": 6,
    "uae": 6,
    "other_us": 5,
    "unknown": 3,
}


def compute_fit_score(job: dict) -> dict:
    """
    Compute a 0–100 fit score for a job based on Kiran's profile.
    Returns {"score": int, "breakdown": {...}, "label": str}.

    Dimensions (max 100):
      - Seniority match:   0–30  (title level alignment)
      - Domain alignment:  0–25  (up to 25 from domain keyword matches)
      - Company tier:      0–15  (dream/high-prob/practice boost)
      - Location pref:     0–10  (bay_area > remote > international > other)
      - Compensation:      0–20  (salary relative to $250K target)
    """
    title_lower = (job.get("title", "") or "").lower()
    dept_lower = (job.get("department", "") or "").lower()
    company_lower = (job.get("company", "") or "").lower()
    combined_text = f"{title_lower} {dept_lower}"

    breakdown = {}

    # 1. Seniority match (0–30)
    seniority = 12  # default: unknown level
    for keyword, score in SENIORITY_SCORES.items():
        if keyword in title_lower:
            seniority = max(seniority, score)
    breakdown["seniority"] = seniority

    # 2. Domain alignment (0–25, sum of matching domains, capped)
    domain_total = 0
    matched_domains = []
    seen_domains = set()
    for keyword, score in DOMAIN_SCORES.items():
        if keyword in combined_text and keyword not in seen_domains:
            domain_total += score
            matched_domains.append(keyword)
            seen_domains.add(keyword)
    domain_capped = min(domain_total, 25)
    breakdown["domain"] = domain_capped
    breakdown["domain_matches"] = matched_domains[:5]  # top 5 for display

    # 3. Company tier (0–15), with bank penalty
    is_bank = any(bk in company_lower for bk in BANK_KEYWORDS)
    tier = COMPANY_TIER.get(company_lower, "practice")
    tier_score = TIER_SCORES.get(tier, 3)
    if is_bank:
        tier_score = 0  # zero out company boost for banks
    breakdown["company_tier"] = "bank" if is_bank else tier
    breakdown["company_tier_score"] = tier_score
    breakdown["is_bank"] = is_bank

    # 4. Location preference (0–10)
    loc_group = job.get("location_group", "unknown")
    loc_score = LOCATION_PREF_SCORES.get(loc_group, 3)
    breakdown["location"] = loc_score

    # 5. Compensation (0–20)
    salary = job.get("salary", {})
    if salary and salary.get("max"):
        max_comp = salary["max"]
        if max_comp >= 350_000:
            comp_score = 20
        elif max_comp >= 300_000:
            comp_score = 17
        elif max_comp >= 250_000:
            comp_score = 14
        elif max_comp >= 200_000:
            comp_score = 8
        else:
            comp_score = 4
    else:
        # Unknown comp — neutral score (don't penalize, don't reward)
        comp_score = 10
    breakdown["compensation"] = comp_score

    # Bank penalty: additional score reduction for traditional banks
    bank_penalty = 15 if is_bank else 0
    breakdown["bank_penalty"] = bank_penalty

    # Total
    total = seniority + domain_capped + tier_score + loc_score + comp_score - bank_penalty
    total = max(0, min(total, 100))

    # Label
    if total >= 80:
        label = "Excellent Fit"
    elif total >= 65:
        label = "Strong Fit"
    elif total >= 50:
        label = "Good Fit"
    elif total >= 35:
        label = "Moderate Fit"
    else:
        label = "Low Fit"

    return {"score": total, "breakdown": breakdown, "label": label}


# ── Query Functions ─────────────────────────────────────────────────────

US_LOCATION_GROUPS = {"bay_area", "other_us"}


MAX_AGE_DAYS = 45  # Discard jobs older than this


def get_all_jobs(
    freshness_filter: Optional[str] = None,
    company_filter: Optional[str] = None,
    status_filter: Optional[str] = None,
    location_groups: Optional[list[str]] = None,
    min_salary: Optional[int] = None,
    max_salary: Optional[int] = None,
    fit_label: Optional[str] = None,
    min_fit_score: Optional[int] = None,
    company_tier: Optional[str] = None,
    source: Optional[str] = None,
    has_salary: Optional[bool] = None,
    seniority: Optional[str] = None,
    exclude_banks: Optional[bool] = None,
    page: int = 1,
    page_size: int = 25,
) -> dict:
    """Get discovered jobs with optional filters, sorted by rank_score.

    location_groups: list of group names to include, e.g. ["bay_area", "remote", "uk"]
    min_salary / max_salary: salary range filter — applied only to US jobs.
                International and remote jobs pass through regardless. US jobs with
                unknown comp also pass through (tagged for the frontend to show).
    fit_label: filter by fit label (Excellent, Strong, Good, Moderate, Low)
    min_fit_score: minimum fit score (0-100)
    company_tier: filter by tier (dream, high-prob, practice)
    source: filter by source (greenhouse, lever, ashby, remotive, themuse, adzuna)
    has_salary: if True, only jobs with salary data; if False, only jobs without
    seniority: filter by seniority keyword in title (senior, staff, principal, group, director, vp, head)
    exclude_banks: if True, exclude jobs flagged as bank roles
    page: 1-indexed page number.
    page_size: results per page (default 25). 0 = no pagination (return all).

    Returns dict with "jobs", "total", "page", "page_size", "total_pages".
    """
    jobs = _load_json(JOBS_FILE)
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=MAX_AGE_DAYS)

    # Recompute freshness, backfill location_group, recompute fit scores, and drop old jobs
    valid_jobs = []
    for job in jobs:
        # Drop jobs older than 45 days
        posted_at = job.get("posted_at", "")
        if posted_at:
            try:
                posted = datetime.fromisoformat(posted_at.replace("Z", "+00:00"))
                if posted < cutoff:
                    continue
            except (ValueError, AttributeError):
                pass  # Keep jobs with unparseable dates

        job["freshness"] = compute_freshness(posted_at).value
        if "location_group" not in job:
            job["location_group"] = classify_location(job.get("location", ""))
        # Always recompute fit + rank scores (profile weights may change)
        fit = compute_fit_score(job)
        job["fit_score"] = fit["score"]
        job["fit_label"] = fit["label"]
        job["fit_breakdown"] = fit["breakdown"]
        job["rank_score"] = compute_rank_score(fit["score"], job["freshness"])
        valid_jobs.append(job)

    jobs = valid_jobs

    if freshness_filter:
        jobs = [j for j in jobs if j["freshness"] == freshness_filter]
    if company_filter:
        jobs = [j for j in jobs if company_filter.lower() in j.get("company", "").lower()]
    if status_filter:
        jobs = [j for j in jobs if j.get("status") == status_filter]
    if location_groups:
        jobs = [j for j in jobs if j.get("location_group", "unknown") in location_groups]

    # Salary filter: only gate US jobs. International/remote pass through.
    # US jobs with unknown salary also pass through (we don't want to hide them).
    if min_salary or max_salary:
        def passes_salary(j: dict) -> bool:
            loc_group = j.get("location_group", "unknown")
            # Non-US jobs are not salary-gated
            if loc_group not in US_LOCATION_GROUPS:
                return True
            salary = j.get("salary", {})
            if not salary:
                # Unknown comp — let it through, frontend will tag it
                return True
            if min_salary and salary.get("max", 0) < min_salary:
                return False
            if max_salary and salary.get("min", 0) > max_salary:
                return False
            return True
        jobs = [j for j in jobs if passes_salary(j)]

    # Fit score / label filter
    if fit_label:
        jobs = [j for j in jobs if j.get("fit_label", "").lower() == fit_label.lower()]
    if min_fit_score is not None:
        jobs = [j for j in jobs if j.get("fit_score", 0) >= min_fit_score]

    # Company tier filter
    if company_tier:
        jobs = [j for j in jobs if j.get("fit_breakdown", {}).get("company_tier", "").lower() == company_tier.lower()]

    # Source filter (ATS type or aggregator name)
    if source:
        jobs = [j for j in jobs if j.get("source", j.get("ats", "")).lower() == source.lower()]

    # Has salary filter
    if has_salary is True:
        jobs = [j for j in jobs if j.get("salary") and j["salary"].get("min")]
    elif has_salary is False:
        jobs = [j for j in jobs if not j.get("salary") or not j["salary"].get("min")]

    # Seniority keyword filter (matches in title)
    if seniority:
        seniority_kw = seniority.lower()
        jobs = [j for j in jobs if seniority_kw in j.get("title", "").lower()]

    # Exclude banks
    if exclude_banks:
        jobs = [j for j in jobs if not j.get("fit_breakdown", {}).get("is_bank")]

    # Sort: composite rank_score (freshness × fit) — highest first, then newest as tiebreaker.
    # A job needs BOTH freshness AND strong fit to rank at the top.
    jobs.sort(key=lambda j: (
        -(j.get("rank_score", 0)),
        -(datetime.fromisoformat(j["posted_at"].replace("Z", "+00:00")).timestamp()
          if j.get("posted_at") else 0),
    ))

    total = len(jobs)

    # Paginate
    if page_size > 0:
        start = (page - 1) * page_size
        end = start + page_size
        page_jobs = jobs[start:end]
        total_pages = (total + page_size - 1) // page_size
    else:
        page_jobs = jobs
        total_pages = 1

    return {
        "jobs": page_jobs,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


def get_job_by_id(job_id: str) -> Optional[dict]:
    jobs = _load_json(JOBS_FILE)
    for job in jobs:
        if job.get("id") == job_id:
            job["freshness"] = compute_freshness(job.get("posted_at", "")).value
            fit = compute_fit_score(job)
            job["fit_score"] = fit["score"]
            job["fit_label"] = fit["label"]
            job["fit_breakdown"] = fit["breakdown"]
            job["rank_score"] = compute_rank_score(fit["score"], job["freshness"])
            return job
    return None


def update_job_status(job_id: str, status: str, notes: str = "") -> Optional[dict]:
    """Update job status: new, reviewing, applied, dismissed, saved."""
    jobs = _load_json(JOBS_FILE)
    for job in jobs:
        if job.get("id") == job_id:
            job["status"] = status
            if notes:
                job["notes"] = notes
            job["updated_at"] = datetime.now(timezone.utc).isoformat()
            _save_json(JOBS_FILE, jobs)

            if status == "dismissed":
                dismissed = _load_json(DISMISSED_FILE)
                dismissed.append(job_id)
                _save_json(DISMISSED_FILE, dismissed)

            return job
    return None


def get_scan_history(limit: int = 20) -> list:
    """Get recent scan history."""
    log = _load_json(SCAN_LOG_FILE)
    return list(reversed(log[-limit:]))


def get_stats() -> dict:
    """Get overall Job Radar statistics."""
    jobs = _load_json(JOBS_FILE)
    for job in jobs:
        job["freshness"] = compute_freshness(job.get("posted_at", "")).value

    total = len(jobs)
    by_freshness = {}
    by_company = {}
    by_status = {}

    for job in jobs:
        f = job.get("freshness", "stale")
        by_freshness[f] = by_freshness.get(f, 0) + 1
        c = job.get("company", "Unknown")
        by_company[c] = by_company.get(c, 0) + 1
        s = job.get("status", "new")
        by_status[s] = by_status.get(s, 0) + 1

    scan_log = _load_json(SCAN_LOG_FILE)
    last_scan = scan_log[-1] if scan_log else None

    return {
        "total_jobs": total,
        "by_freshness": by_freshness,
        "by_company": dict(sorted(by_company.items(), key=lambda x: -x[1])[:20]),
        "by_status": by_status,
        "last_scan": last_scan,
        "companies_monitored": len(COMPANY_CAREER_SOURCES),
    }
