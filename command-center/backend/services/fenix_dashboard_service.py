"""
Fenix Dashboard Service — queries Supabase for Fenix analytics data.

Tables used:
  - conversations: session_id, started_at, last_active_at, page_url, user_agent, metadata
  - messages: conversation_id, role, content, citations, rag_chunks_used,
              similarity_scores, search_type, tokens_used, created_at
  - training_data: question, answer, category, source, status, created_at
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from supabase import create_client, Client


def _get_client() -> Client:
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env"
        )
    return create_client(url, key)


# ── Overview stats ────────────────────────────────────────────────────


def get_overview(days: int = 30) -> dict:
    """Summary stats: total conversations, messages, avg depth, unique sessions."""
    sb = _get_client()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    # Total conversations in range
    convos = (
        sb.table("conversations")
        .select("id, session_id, started_at")
        .gte("started_at", cutoff)
        .execute()
    )
    convo_ids = [c["id"] for c in convos.data]
    total_conversations = len(convo_ids)
    unique_sessions = len(set(c["session_id"] for c in convos.data))

    # Today's messages
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    ).isoformat()
    today_msgs = (
        sb.table("messages")
        .select("id", count="exact")
        .gte("created_at", today_start)
        .execute()
    )
    messages_today = today_msgs.count or 0

    # All messages in range (for avg depth)
    if convo_ids:
        all_msgs = (
            sb.table("messages")
            .select("conversation_id", count="exact")
            .in_("conversation_id", convo_ids)
            .execute()
        )
        total_messages = all_msgs.count or 0
        avg_depth = round(total_messages / total_conversations, 1) if total_conversations else 0
    else:
        total_messages = 0
        avg_depth = 0

    # Conversations per day (last 7 days breakdown)
    week_cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    week_convos = (
        sb.table("conversations")
        .select("started_at")
        .gte("started_at", week_cutoff)
        .execute()
    )
    daily_counts = {}
    for c in week_convos.data:
        day = c["started_at"][:10]
        daily_counts[day] = daily_counts.get(day, 0) + 1

    return {
        "total_conversations": total_conversations,
        "unique_sessions": unique_sessions,
        "messages_today": messages_today,
        "total_messages": total_messages,
        "avg_messages_per_conversation": avg_depth,
        "daily_conversations": daily_counts,
        "period_days": days,
    }


# ── Top queries ───────────────────────────────────────────────────────


def get_top_queries(limit: int = 20, days: int = 30) -> list[dict]:
    """Most frequent user queries, grouped by similarity."""
    sb = _get_client()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    msgs = (
        sb.table("messages")
        .select("content, search_type, rag_chunks_used, similarity_scores, created_at")
        .eq("role", "user")
        .gte("created_at", cutoff)
        .order("created_at", desc=True)
        .limit(500)
        .execute()
    )

    # Simple frequency count by exact content (lowercase, trimmed)
    freq: dict[str, dict] = {}
    for m in msgs.data:
        key = m["content"].strip().lower()
        if key not in freq:
            freq[key] = {
                "query": m["content"].strip(),
                "count": 0,
                "search_types": [],
                "avg_chunks": 0,
                "last_asked": m["created_at"],
            }
        freq[key]["count"] += 1
        freq[key]["search_types"].append(m.get("search_type", "none"))
        freq[key]["avg_chunks"] += m.get("rag_chunks_used", 0) or 0

    results = []
    for key, data in freq.items():
        count = data["count"]
        data["avg_chunks"] = round(data["avg_chunks"] / count, 1)
        # Most common search type
        types = data["search_types"]
        data["primary_search_type"] = max(set(types), key=types.count) if types else "none"
        del data["search_types"]
        results.append(data)

    results.sort(key=lambda x: x["count"], reverse=True)
    return results[:limit]


# ── Failure detection ─────────────────────────────────────────────────


def get_failures(limit: int = 50, days: int = 30) -> list[dict]:
    """Queries with 0 RAG citations, low similarity, or keyword fallback."""
    sb = _get_client()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    # Get assistant messages with 0 chunks or keyword fallback
    failures = (
        sb.table("messages")
        .select(
            "id, conversation_id, content, search_type, rag_chunks_used, "
            "similarity_scores, created_at"
        )
        .eq("role", "assistant")
        .gte("created_at", cutoff)
        .or_("rag_chunks_used.eq.0,search_type.eq.keyword,search_type.eq.none")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )

    # For each failure, get the user query that preceded it
    results = []
    for f in failures.data:
        # Find the user message immediately before this assistant message
        user_msg = (
            sb.table("messages")
            .select("content")
            .eq("conversation_id", f["conversation_id"])
            .eq("role", "user")
            .lt("created_at", f["created_at"])
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        user_query = user_msg.data[0]["content"] if user_msg.data else "(unknown)"

        # Determine failure reason
        reasons = []
        if (f.get("rag_chunks_used") or 0) == 0:
            reasons.append("no_rag_results")
        if f.get("search_type") == "keyword":
            reasons.append("keyword_fallback")
        if f.get("search_type") == "none":
            reasons.append("no_search_match")

        # Check for low similarity
        scores = f.get("similarity_scores") or []
        if scores and max(scores) < 0.5:
            reasons.append("low_similarity")

        results.append({
            "id": f["id"],
            "conversation_id": f["conversation_id"],
            "user_query": user_query,
            "failure_reasons": reasons,
            "search_type": f.get("search_type"),
            "rag_chunks_used": f.get("rag_chunks_used", 0),
            "top_similarity": round(max(scores), 3) if scores else None,
            "created_at": f["created_at"],
        })

    # Push notification if failure count is above threshold
    if len(results) >= 5:
        try:
            from services.notification_service import notify_fenix_dead_end
            top_query = results[0]["user_query"] if results else ""
            notify_fenix_dead_end(
                failure_count=len(results),
                top_query=top_query,
            )
        except Exception:
            pass  # Never let notification failure break the dashboard

    return results


# ── Content coverage ──────────────────────────────────────────────────


def get_content_coverage(days: int = 30) -> dict:
    """Which content pages get cited most/least."""
    sb = _get_client()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    # Get all citations from assistant messages
    msgs = (
        sb.table("messages")
        .select("citations")
        .eq("role", "assistant")
        .gte("created_at", cutoff)
        .not_.is_("citations", "null")
        .limit(1000)
        .execute()
    )

    # Count citation sources
    source_counts: dict[str, int] = {}
    for m in msgs.data:
        citations = m.get("citations") or []
        if isinstance(citations, list):
            for c in citations:
                source = None
                if isinstance(c, dict):
                    source = c.get("source") or c.get("url") or c.get("page_url")
                elif isinstance(c, str):
                    source = c
                if source:
                    source_counts[source] = source_counts.get(source, 0) + 1

    # Get all content registry entries for comparison
    registry = sb.table("content_registry").select("url, title").execute()
    all_pages = {r["url"]: r.get("title", r["url"]) for r in registry.data}

    # Build coverage list
    cited = []
    for url, count in sorted(source_counts.items(), key=lambda x: -x[1]):
        cited.append({
            "url": url,
            "title": all_pages.get(url, url),
            "citation_count": count,
        })

    # Find never-cited pages
    cited_urls = set(source_counts.keys())
    never_cited = [
        {"url": url, "title": title}
        for url, title in all_pages.items()
        if url not in cited_urls
    ]

    return {
        "most_cited": cited[:20],
        "never_cited": never_cited,
        "total_pages": len(all_pages),
        "pages_cited": len(cited_urls),
        "period_days": days,
    }


# ── Conversation browser ─────────────────────────────────────────────


def list_conversations(
    limit: int = 30, offset: int = 0, search: Optional[str] = None
) -> dict:
    """Browse conversations with message preview."""
    sb = _get_client()

    query = (
        sb.table("conversations")
        .select("id, session_id, started_at, last_active_at, page_url, metadata")
        .order("last_active_at", desc=True)
        .range(offset, offset + limit - 1)
    )

    convos = query.execute()

    # For each conversation, get message count and first user message
    results = []
    for c in convos.data:
        msgs = (
            sb.table("messages")
            .select("role, content", count="exact")
            .eq("conversation_id", c["id"])
            .order("created_at")
            .limit(1)
            .execute()
        )
        first_msg = msgs.data[0]["content"][:120] if msgs.data else ""
        msg_count = msgs.count or 0

        results.append({
            "id": c["id"],
            "session_id": c["session_id"],
            "started_at": c["started_at"],
            "last_activity": c.get("last_active_at"),
            "page_url": c.get("page_url"),
            "message_count": msg_count,
            "preview": first_msg,
        })

    return {"conversations": results, "offset": offset, "limit": limit}


def get_conversation_detail(conversation_id: str) -> dict:
    """Full conversation transcript with all metadata."""
    sb = _get_client()

    convo = (
        sb.table("conversations")
        .select("*")
        .eq("id", conversation_id)
        .single()
        .execute()
    )

    messages = (
        sb.table("messages")
        .select("*")
        .eq("conversation_id", conversation_id)
        .order("created_at")
        .execute()
    )

    return {
        "conversation": convo.data,
        "messages": messages.data,
    }


# ── Search quality ────────────────────────────────────────────────────


def get_search_quality(days: int = 30) -> dict:
    """Search type distribution and similarity score trends."""
    sb = _get_client()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    msgs = (
        sb.table("messages")
        .select("search_type, similarity_scores, rag_chunks_used, created_at")
        .eq("role", "assistant")
        .gte("created_at", cutoff)
        .order("created_at")
        .limit(1000)
        .execute()
    )

    # Search type distribution
    type_counts = {"semantic": 0, "keyword": 0, "none": 0}
    all_top_scores = []
    daily_quality: dict[str, list[float]] = {}

    for m in msgs.data:
        st = m.get("search_type") or "none"
        type_counts[st] = type_counts.get(st, 0) + 1

        scores = m.get("similarity_scores") or []
        if scores:
            top = max(scores)
            all_top_scores.append(top)
            day = m["created_at"][:10]
            daily_quality.setdefault(day, []).append(top)

    total = sum(type_counts.values()) or 1
    distribution = {k: round(v / total * 100, 1) for k, v in type_counts.items()}

    # Daily avg similarity
    daily_avg = {
        day: round(sum(scores) / len(scores), 3)
        for day, scores in sorted(daily_quality.items())
    }

    avg_similarity = (
        round(sum(all_top_scores) / len(all_top_scores), 3) if all_top_scores else 0
    )

    # Quality buckets
    good = sum(1 for s in all_top_scores if s >= 0.7)
    ok = sum(1 for s in all_top_scores if 0.5 <= s < 0.7)
    poor = sum(1 for s in all_top_scores if s < 0.5)

    return {
        "search_type_distribution": distribution,
        "search_type_counts": type_counts,
        "avg_top_similarity": avg_similarity,
        "similarity_buckets": {
            "good_gte_0.7": good,
            "ok_0.5_to_0.7": ok,
            "poor_lt_0.5": poor,
        },
        "daily_avg_similarity": daily_avg,
        "total_responses": sum(type_counts.values()),
        "period_days": days,
    }


# ── Outcomes metrics ─────────────────────────────────────────────────


def get_outcomes(days: int = 30) -> dict:
    """Site-level outcomes: conversations, connections, testimonials,
    fit scores, Fenix-driven navigation, engagement metrics."""
    sb = _get_client()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    # Total conversations
    convos = (
        sb.table("conversations")
        .select("id, session_id", count="exact")
        .gte("started_at", cutoff)
        .execute()
    )
    total_conversations = convos.count or 0
    unique_visitors = len(set(c["session_id"] for c in convos.data)) if convos.data else 0

    # Connected visitors (conversations with identity data in metadata)
    connected = (
        sb.table("conversations")
        .select("id", count="exact")
        .gte("started_at", cutoff)
        .not_.is_("metadata->identity", "null")
        .execute()
    )
    visitors_connected = connected.count or 0

    # Testimonials collected (from feedback table if it exists)
    try:
        testimonials = (
            sb.table("feedback")
            .select("id", count="exact")
            .gte("created_at", cutoff)
            .execute()
        )
        testimonials_count = testimonials.count or 0
    except Exception:
        testimonials_count = 0

    # Fit scores completed (check messages for fit-score tool usage)
    fit_scores = (
        sb.table("messages")
        .select("id", count="exact")
        .eq("role", "assistant")
        .gte("created_at", cutoff)
        .like("content", "%fit_score%")
        .execute()
    )
    fit_scores_completed = fit_scores.count or 0

    # Fenix-driven navigation (messages containing navigation links)
    nav_msgs = (
        sb.table("messages")
        .select("id", count="exact")
        .eq("role", "assistant")
        .gte("created_at", cutoff)
        .like("content", "%kiranrao.ai/%")
        .execute()
    )
    pages_navigated = nav_msgs.count or 0

    # Average conversation depth
    if total_conversations > 0:
        all_msgs = (
            sb.table("messages")
            .select("id", count="exact")
            .gte("created_at", cutoff)
            .execute()
        )
        total_messages = all_msgs.count or 0
        avg_depth = round(total_messages / total_conversations, 1)
    else:
        total_messages = 0
        avg_depth = 0

    # Engagement rate (conversations with 3+ user messages / total)
    if convos.data:
        convo_ids = [c["id"] for c in convos.data]
        engaged_count = 0
        # Check message counts per conversation in batches
        for cid in convo_ids:
            msgs = (
                sb.table("messages")
                .select("id", count="exact")
                .eq("conversation_id", cid)
                .eq("role", "user")
                .execute()
            )
            if (msgs.count or 0) >= 3:
                engaged_count += 1
        engagement_rate = round(engaged_count / total_conversations * 100, 1) if total_conversations else 0
    else:
        engaged_count = 0
        engagement_rate = 0

    return {
        "total_conversations": total_conversations,
        "unique_visitors": unique_visitors,
        "visitors_connected": visitors_connected,
        "testimonials_collected": testimonials_count,
        "fit_scores_completed": fit_scores_completed,
        "pages_navigated_via_fenix": pages_navigated,
        "total_messages": total_messages,
        "avg_conversation_depth": avg_depth,
        "engaged_conversations": engaged_count,
        "engagement_rate_pct": engagement_rate,
        "period_days": days,
    }


# ── Training data stats ──────────────────────────────────────────────


def get_training_stats() -> dict:
    """Training data overview."""
    sb = _get_client()

    active = (
        sb.table("training_data")
        .select("id", count="exact")
        .eq("status", "active")
        .execute()
    )
    draft = (
        sb.table("training_data")
        .select("id", count="exact")
        .eq("status", "draft")
        .execute()
    )

    # Recent entries
    recent = (
        sb.table("training_data")
        .select("id, question, category, status, created_at")
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )

    # Categories
    all_td = sb.table("training_data").select("category").execute()
    categories: dict[str, int] = {}
    for t in all_td.data:
        cat = t.get("category") or "uncategorized"
        categories[cat] = categories.get(cat, 0) + 1

    return {
        "active_count": active.count or 0,
        "draft_count": draft.count or 0,
        "categories": categories,
        "recent": recent.data,
    }
