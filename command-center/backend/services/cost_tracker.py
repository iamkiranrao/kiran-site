"""Cost Tracker — Utility for auto-logging API usage to the Tech Cost Calculator.

Usage in any service that calls an AI API:

    from services.cost_tracker import track_anthropic_usage

    response = client.messages.create(model=..., messages=..., ...)
    track_anthropic_usage(response, endpoint="/api/teardown/generate")

The tracker writes to the same JSON file that the tech-costs router reads,
so usage shows up in the dashboard automatically.
"""

from __future__ import annotations

import json
import os
import uuid
import logging
import tempfile
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────

DATA_ROOT = os.environ.get(
    "COMMAND_CENTER_DATA_DIR",
    os.path.join(os.path.expanduser("~"), ".command-center", "data"),
)
USAGE_FILE = os.path.join(DATA_ROOT, "tech-costs", "api-usage.json")

# Model pricing loaded from data/tech-costs/rate-card.json (USD per 1M tokens)
_RATE_CARD_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "data", "tech-costs", "rate-card.json"
)

def _load_rate_card():
    """Load pricing from the shared rate card data file."""
    try:
        with open(_RATE_CARD_PATH, "r") as f:
            card = json.load(f)
        return card.get("anthropic", {}), card.get("voyage", {})
    except (IOError, json.JSONDecodeError):
        logger.warning("Could not load rate card from %s, using empty pricing", _RATE_CARD_PATH)
        return {}, {}

ANTHROPIC_PRICING, VOYAGE_PRICING = _load_rate_card()

# Service IDs (must match seed data in services.json)
ANTHROPIC_SERVICE_ID = "anthro01"
VOYAGE_SERVICE_ID = "voyage01"


def _ensure_dir():
    os.makedirs(os.path.dirname(USAGE_FILE), exist_ok=True)


def _load_usage() -> list:
    if os.path.exists(USAGE_FILE):
        try:
            with open(USAGE_FILE, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return []
    return []


def _save_usage(logs: list):
    _ensure_dir()
    tmp_path = USAGE_FILE + ".tmp"
    with open(tmp_path, "w") as f:
        json.dump(logs, f, indent=2)
    os.replace(tmp_path, USAGE_FILE)


def _estimate_cost(model: str, input_tokens: int, output_tokens: int,
                   cache_read: int = 0, cache_write: int = 0) -> float:
    """Estimate USD cost for an API call."""
    pricing = ANTHROPIC_PRICING.get(model) or VOYAGE_PRICING.get(model)
    if not pricing:
        # Default to Sonnet pricing
        pricing = {"input": 3.0, "output": 15.0}

    cost = (input_tokens * pricing["input"] / 1_000_000) + \
           (output_tokens * pricing["output"] / 1_000_000)

    # Cache read tokens are 90% cheaper, cache write tokens are 25% more
    if cache_read > 0:
        cost += cache_read * pricing["input"] * 0.1 / 1_000_000
    if cache_write > 0:
        cost += cache_write * pricing["input"] * 1.25 / 1_000_000

    return round(cost, 6)


def track_anthropic_usage(
    response,
    endpoint: str = "",
    model_override: Optional[str] = None,
):
    """Log an Anthropic API call to the usage file.

    Args:
        response: The Anthropic Message response object (has .usage, .model)
        endpoint: Which CC endpoint triggered this call (for analytics)
        model_override: Override the model name if not on the response
    """
    try:
        usage = response.usage
        model = model_override or getattr(response, "model", "unknown")

        input_tokens = getattr(usage, "input_tokens", 0)
        output_tokens = getattr(usage, "output_tokens", 0)
        cache_read = getattr(usage, "cache_read_input_tokens", 0) or 0
        cache_write = getattr(usage, "cache_creation_input_tokens", 0) or 0

        cost = _estimate_cost(model, input_tokens, output_tokens, cache_read, cache_write)

        log_entry = {
            "id": str(uuid.uuid4())[:8],
            "service_id": ANTHROPIC_SERVICE_ID,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "model": model,
            "tokens_input": input_tokens,
            "tokens_output": output_tokens,
            "cost_usd": cost,
            "endpoint": endpoint,
            "cache_read_tokens": cache_read,
            "cache_write_tokens": cache_write,
        }

        logs = _load_usage()
        logs.append(log_entry)
        _save_usage(logs)

        logger.debug(
            f"Tracked API usage: {model} | {input_tokens}in/{output_tokens}out | ${cost:.4f} | {endpoint}"
        )

    except Exception as e:
        # Never let tracking failures break the actual API call
        logger.warning(f"Failed to track API usage: {e}")


def track_voyage_usage(
    model: str,
    input_tokens: int,
    endpoint: str = "",
):
    """Log a Voyage AI embedding call."""
    try:
        cost = _estimate_cost(model, input_tokens, 0)

        log_entry = {
            "id": str(uuid.uuid4())[:8],
            "service_id": VOYAGE_SERVICE_ID,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "model": model,
            "tokens_input": input_tokens,
            "tokens_output": 0,
            "cost_usd": cost,
            "endpoint": endpoint,
            "cache_read_tokens": 0,
            "cache_write_tokens": 0,
        }

        logs = _load_usage()
        logs.append(log_entry)
        _save_usage(logs)

    except Exception as e:
        logger.warning(f"Failed to track Voyage usage: {e}")


def get_usage_summary(period: Optional[str] = None) -> dict:
    """Quick summary of API usage for a period (default: current month)."""
    if not period:
        period = datetime.now(timezone.utc).strftime("%Y-%m")

    logs = _load_usage()
    period_logs = [l for l in logs if l.get("timestamp", "").startswith(period)]

    total_cost = sum(l.get("cost_usd", 0) for l in period_logs)
    total_input = sum(l.get("tokens_input", 0) for l in period_logs)
    total_output = sum(l.get("tokens_output", 0) for l in period_logs)

    return {
        "period": period,
        "total_calls": len(period_logs),
        "total_cost_usd": round(total_cost, 4),
        "total_input_tokens": total_input,
        "total_output_tokens": total_output,
    }
