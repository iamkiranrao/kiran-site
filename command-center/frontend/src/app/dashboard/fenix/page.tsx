"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bot,
  MessageSquare,
  Users,
  TrendingUp,
  AlertTriangle,
  Search,
  BookOpen,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Loader2,
  RefreshCw,
  ExternalLink,
  Zap,
  BarChart3,
  HelpCircle,
} from "lucide-react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Tab = "overview" | "queries" | "failures" | "coverage" | "conversations" | "quality";

// ── API helpers ──────────────────────────────────────────────────────

async function fetchApi(path: string) {
  const res = await fetch(`${API_URL}/api/fenix${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

// ── Sub-components ───────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  sub?: string;
}) {
  return (
    <div
      className="rounded-lg p-5"
      style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
          {label}
        </span>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon size={16} className={`text-[${color}]`} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
      {sub && <p className="text-xs text-[var(--text-muted)] mt-1">{sub}</p>}
    </div>
  );
}

function TabButton({
  id,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  id: Tab;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  active: boolean;
  onClick: (t: Tab) => void;
}) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
        active
          ? "bg-[var(--bg-secondary)] text-[var(--text-primary)] font-medium"
          : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function SearchTypeTag({ type }: { type: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    semantic: { bg: "rgba(16,185,129,0.15)", color: "#10b981" },
    keyword: { bg: "rgba(251,146,60,0.15)", color: "#fb923c" },
    none: { bg: "rgba(239,68,68,0.15)", color: "#ef4444" },
  };
  const s = styles[type] || styles.none;
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {type}
    </span>
  );
}

function FailureReasonTag({ reason }: { reason: string }) {
  const labels: Record<string, string> = {
    no_rag_results: "No RAG results",
    keyword_fallback: "Keyword fallback",
    no_search_match: "No match",
    low_similarity: "Low similarity",
  };
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ backgroundColor: "rgba(239,68,68,0.12)", color: "#f87171" }}
    >
      {labels[reason] || reason}
    </span>
  );
}

// ── Mini bar for similarity ──────────────────────────────────────────

function SimilarityBar({ score }: { score: number | null }) {
  if (score === null || score === undefined) return <span className="text-xs text-[var(--text-muted)]">—</span>;
  const pct = Math.round(score * 100);
  const color = score >= 0.7 ? "#10b981" : score >= 0.5 ? "#fb923c" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-mono" style={{ color }}>{score.toFixed(2)}</span>
    </div>
  );
}

// ── Distribution bar ─────────────────────────────────────────────────

function DistributionBar({
  distribution,
}: {
  distribution: Record<string, number>;
}) {
  const colors: Record<string, string> = {
    semantic: "#10b981",
    keyword: "#fb923c",
    none: "#ef4444",
  };
  return (
    <div>
      <div className="w-full h-6 rounded-lg overflow-hidden flex">
        {Object.entries(distribution).map(([type, pct]) => (
          <div
            key={type}
            style={{ width: `${pct}%`, backgroundColor: colors[type] || "#666" }}
            className="flex items-center justify-center"
          >
            {pct >= 10 && (
              <span className="text-[10px] font-bold text-white/90">{pct}%</span>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-2">
        {Object.entries(distribution).map(([type, pct]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: colors[type] || "#666" }}
            />
            <span className="text-xs text-[var(--text-muted)]">
              {type} ({pct}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────

export default function FenixDashboardPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [overview, setOverview] = useState<any>(null);
  const [queries, setQueries] = useState<any[]>([]);
  const [failures, setFailures] = useState<any[]>([]);
  const [coverage, setCoverage] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [quality, setQuality] = useState<any>(null);
  const [training, setTraining] = useState<any>(null);

  // Conversation detail
  const [selectedConvo, setSelectedConvo] = useState<any>(null);
  const [convoDetail, setConvoDetail] = useState<any>(null);

  const loadTab = useCallback(
    async (t: Tab) => {
      setLoading(true);
      setError(null);
      try {
        switch (t) {
          case "overview": {
            const [ov, tr] = await Promise.all([
              fetchApi(`/overview?days=${days}`),
              fetchApi("/training"),
            ]);
            setOverview(ov);
            setTraining(tr);
            break;
          }
          case "queries":
            setQueries((await fetchApi(`/queries?days=${days}&limit=30`)).queries);
            break;
          case "failures":
            setFailures((await fetchApi(`/failures?days=${days}&limit=50`)).failures);
            break;
          case "coverage":
            setCoverage(await fetchApi(`/coverage?days=${days}`));
            break;
          case "conversations":
            setConversations(
              (await fetchApi("/conversations?limit=30")).conversations
            );
            break;
          case "quality":
            setQuality(await fetchApi(`/search-quality?days=${days}`));
            break;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load data");
      }
      setLoading(false);
    },
    [days]
  );

  useEffect(() => {
    loadTab(tab);
  }, [tab, loadTab]);

  const loadConvoDetail = async (id: string) => {
    setLoading(true);
    try {
      const detail = await fetchApi(`/conversations/${id}`);
      setConvoDetail(detail);
      setSelectedConvo(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load conversation");
    }
    setLoading(false);
  };

  // ── Shared styles ──────────────────────────────────────────────────
  const cardStyle = {
    backgroundColor: "var(--bg-card)",
    border: "1px solid var(--border)",
  };

  // ── Conversation detail view ───────────────────────────────────────
  if (selectedConvo && convoDetail) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <button
          onClick={() => {
            setSelectedConvo(null);
            setConvoDetail(null);
          }}
          className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-6 transition-colors"
        >
          <ArrowLeft size={14} /> Back to conversations
        </button>

        <div className="mb-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
            Conversation
          </h2>
          <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
            <span>
              {new Date(convoDetail.conversation.started_at).toLocaleString()}
            </span>
            {convoDetail.conversation.page_url && (
              <span>from {convoDetail.conversation.page_url}</span>
            )}
            <span>{convoDetail.messages.length} messages</span>
          </div>
        </div>

        <div className="space-y-3">
          {convoDetail.messages.map((msg: any) => (
            <div
              key={msg.id}
              className="rounded-lg p-4"
              style={{
                ...cardStyle,
                borderLeftWidth: "3px",
                borderLeftColor:
                  msg.role === "user" ? "#3b82f6" : "#fb923c",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-xs font-medium uppercase"
                  style={{
                    color: msg.role === "user" ? "#3b82f6" : "#fb923c",
                  }}
                >
                  {msg.role}
                </span>
                <div className="flex items-center gap-2">
                  {msg.search_type && <SearchTypeTag type={msg.search_type} />}
                  {msg.rag_chunks_used > 0 && (
                    <span className="text-xs text-[var(--text-muted)]">
                      {msg.rag_chunks_used} chunks
                    </span>
                  )}
                  <SimilarityBar
                    score={
                      msg.similarity_scores?.length
                        ? Math.max(...msg.similarity_scores)
                        : null
                    }
                  />
                </div>
              </div>
              <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">
                {msg.content}
              </p>
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[var(--border)]">
                  <span className="text-xs text-[var(--text-muted)]">
                    Citations:{" "}
                    {msg.citations.map((c: any, i: number) => (
                      <span key={i}>
                        {typeof c === "string"
                          ? c
                          : c.source || c.url || JSON.stringify(c)}
                        {i < msg.citations.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Main dashboard ─────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Bot size={24} style={{ color: "#fb923c" }} />
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              Fenix Dashboard
            </h1>
            <Link
              href="/dashboard/help?module=fenix"
              className="text-[var(--text-muted)] hover:text-[#fb923c] transition-colors"
              title="Help"
            >
              <HelpCircle size={18} />
            </Link>
          </div>
          <p className="text-[var(--text-secondary)] text-sm">
            Analytics and insights for your AI assistant.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="text-xs rounded-lg px-3 py-2 focus:outline-none"
            style={cardStyle}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
          <button
            onClick={() => loadTab(tab)}
            disabled={loading}
            className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-secondary)]"
            title="Refresh"
          >
            <RefreshCw
              size={16}
              className={`text-[var(--text-muted)] ${loading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-between">
          <span className="text-red-400 text-sm">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-400 text-xs font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div
        className="flex flex-wrap gap-1 mb-6 p-1 rounded-lg"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <TabButton id="overview" label="Overview" icon={BarChart3} active={tab === "overview"} onClick={setTab} />
        <TabButton id="queries" label="Top Queries" icon={Search} active={tab === "queries"} onClick={setTab} />
        <TabButton id="failures" label="Failures" icon={AlertTriangle} active={tab === "failures"} onClick={setTab} />
        <TabButton id="coverage" label="Coverage" icon={BookOpen} active={tab === "coverage"} onClick={setTab} />
        <TabButton id="conversations" label="Conversations" icon={MessageSquare} active={tab === "conversations"} onClick={setTab} />
        <TabButton id="quality" label="Search Quality" icon={TrendingUp} active={tab === "quality"} onClick={setTab} />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
        </div>
      )}

      {/* ── Overview Tab ──────────────────────────────────────────── */}
      {!loading && tab === "overview" && overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Conversations"
              value={overview.total_conversations}
              icon={MessageSquare}
              color="#3b82f6"
              sub={`${days} day period`}
            />
            <StatCard
              label="Messages Today"
              value={overview.messages_today}
              icon={Zap}
              color="#fb923c"
            />
            <StatCard
              label="Avg Depth"
              value={overview.avg_messages_per_conversation}
              icon={TrendingUp}
              color="#10b981"
              sub="messages per conversation"
            />
            <StatCard
              label="Unique Visitors"
              value={overview.unique_sessions}
              icon={Users}
              color="#a78bfa"
              sub="by session ID"
            />
          </div>

          {/* Daily conversations mini-chart */}
          {overview.daily_conversations &&
            Object.keys(overview.daily_conversations).length > 0 && (
              <div className="rounded-lg p-5" style={cardStyle}>
                <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">
                  Conversations (last 7 days)
                </h3>
                <div className="flex items-end gap-2 h-20">
                  {Object.entries(overview.daily_conversations)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([day, count]) => {
                      const maxCount = Math.max(
                        ...Object.values(overview.daily_conversations as Record<string, number>)
                      );
                      const height = maxCount > 0 ? ((count as number) / maxCount) * 100 : 0;
                      return (
                        <div
                          key={day}
                          className="flex-1 flex flex-col items-center gap-1"
                        >
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {count as number}
                          </span>
                          <div
                            className="w-full rounded-t"
                            style={{
                              height: `${Math.max(height, 4)}%`,
                              backgroundColor: "#3b82f6",
                              minHeight: "2px",
                            }}
                          />
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {day.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

          {/* Training data summary */}
          {training && (
            <div className="rounded-lg p-5" style={cardStyle}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                  <BookOpen size={14} style={{ color: "#10b981" }} />
                  Training Data
                </h3>
                <Link
                  href="/dashboard/fenix/training"
                  className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors hover:opacity-80"
                  style={{ backgroundColor: "rgba(251,146,60,0.15)", color: "#fb923c" }}
                >
                  Train Fenix <ChevronRight size={12} />
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xl font-bold text-[var(--text-primary)]">
                    {training.active_count}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">Active entries</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-[var(--text-primary)]">
                    {training.draft_count}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">Drafts</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-[var(--text-primary)]">
                    {Object.keys(training.categories || {}).length}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">Categories</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Top Queries Tab ───────────────────────────────────────── */}
      {!loading && tab === "queries" && (
        <div className="rounded-lg overflow-hidden" style={cardStyle}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left text-xs font-medium text-[var(--text-muted)] px-4 py-3 uppercase tracking-wider">
                  Query
                </th>
                <th className="text-center text-xs font-medium text-[var(--text-muted)] px-4 py-3 uppercase tracking-wider w-20">
                  Count
                </th>
                <th className="text-center text-xs font-medium text-[var(--text-muted)] px-4 py-3 uppercase tracking-wider w-24">
                  Search
                </th>
                <th className="text-center text-xs font-medium text-[var(--text-muted)] px-4 py-3 uppercase tracking-wider w-20">
                  Chunks
                </th>
              </tr>
            </thead>
            <tbody>
              {queries.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-sm text-[var(--text-muted)]"
                  >
                    No queries found for this period.
                  </td>
                </tr>
              )}
              {queries.map((q, i) => (
                <tr
                  key={i}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-[var(--text-primary)]">
                    {q.query}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {q.count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <SearchTypeTag type={q.primary_search_type} />
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-[var(--text-muted)]">
                    {q.avg_chunks}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Failures Tab ──────────────────────────────────────────── */}
      {!loading && tab === "failures" && (
        <div className="space-y-3">
          {failures.length === 0 && (
            <div className="text-center py-12 text-sm text-[var(--text-muted)]">
              No failures found — Fenix is answering everything well!
            </div>
          )}
          {failures.map((f) => (
            <div key={f.id} className="rounded-lg p-4" style={cardStyle}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm text-[var(--text-primary)] font-medium mb-2">
                    &ldquo;{f.user_query}&rdquo;
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {f.failure_reasons.map((r: string) => (
                      <FailureReasonTag key={r} reason={r} />
                    ))}
                    <SimilarityBar score={f.top_similarity} />
                    <span className="text-xs text-[var(--text-muted)]">
                      {new Date(f.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => loadConvoDetail(f.conversation_id)}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors hover:opacity-80"
                  style={{ backgroundColor: "rgba(251,146,60,0.15)", color: "#fb923c" }}
                  title="View conversation"
                >
                  View
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Coverage Tab ──────────────────────────────────────────── */}
      {!loading && tab === "coverage" && coverage && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              label="Total Pages"
              value={coverage.total_pages}
              icon={BookOpen}
              color="#3b82f6"
            />
            <StatCard
              label="Pages Cited"
              value={coverage.pages_cited}
              icon={TrendingUp}
              color="#10b981"
              sub={`${
                coverage.total_pages > 0
                  ? Math.round((coverage.pages_cited / coverage.total_pages) * 100)
                  : 0
              }% coverage`}
            />
            <StatCard
              label="Never Cited"
              value={coverage.never_cited?.length || 0}
              icon={AlertTriangle}
              color="#ef4444"
              sub="potential gaps"
            />
          </div>

          {/* Most cited */}
          {coverage.most_cited?.length > 0 && (
            <div className="rounded-lg p-5" style={cardStyle}>
              <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">
                Most Cited Pages
              </h3>
              <div className="space-y-2">
                {coverage.most_cited.map((p: any, i: number) => {
                  const maxCitations = coverage.most_cited[0]?.citation_count || 1;
                  const barWidth = (p.citation_count / maxCitations) * 100;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[var(--text-primary)] truncate">
                          {p.title}
                        </p>
                      </div>
                      <div className="w-32 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor: "#3b82f6",
                            }}
                          />
                        </div>
                        <span className="text-xs font-mono text-[var(--text-muted)] w-6 text-right">
                          {p.citation_count}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Never cited */}
          {coverage.never_cited?.length > 0 && (
            <div className="rounded-lg p-5" style={cardStyle}>
              <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3 flex items-center gap-2">
                <AlertTriangle size={14} style={{ color: "#ef4444" }} />
                Never Cited (potential content gaps)
              </h3>
              <div className="space-y-1.5">
                {coverage.never_cited.map((p: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1.5"
                  >
                    <p className="text-sm text-[var(--text-muted)]">{p.title}</p>
                    {p.url && (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[var(--accent-blue)] flex items-center gap-1 hover:underline"
                      >
                        View <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Conversations Tab ─────────────────────────────────────── */}
      {!loading && tab === "conversations" && (
        <div className="space-y-2">
          {conversations.length === 0 && (
            <div className="text-center py-12 text-sm text-[var(--text-muted)]">
              No conversations recorded yet.
            </div>
          )}
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => loadConvoDetail(c.id)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors hover:opacity-90"
              style={cardStyle}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--text-primary)] truncate">
                  {c.preview || "(empty conversation)"}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-[var(--text-muted)]">
                    {new Date(c.started_at).toLocaleString()}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {c.message_count} messages
                  </span>
                  {c.page_url && (
                    <span className="text-xs text-[var(--text-muted)] truncate max-w-[200px]">
                      {c.page_url}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight size={16} className="text-[var(--text-muted)] shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* ── Search Quality Tab ────────────────────────────────────── */}
      {!loading && tab === "quality" && quality && (
        <div className="space-y-6">
          {/* Key metrics */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              label="Avg Similarity"
              value={quality.avg_top_similarity}
              icon={TrendingUp}
              color={
                quality.avg_top_similarity >= 0.7
                  ? "#10b981"
                  : quality.avg_top_similarity >= 0.5
                  ? "#fb923c"
                  : "#ef4444"
              }
              sub="top score per query"
            />
            <StatCard
              label="Total Responses"
              value={quality.total_responses}
              icon={MessageSquare}
              color="#3b82f6"
              sub={`${days} day period`}
            />
            <StatCard
              label="Semantic Rate"
              value={`${quality.search_type_distribution?.semantic || 0}%`}
              icon={Search}
              color="#10b981"
              sub="of all searches"
            />
          </div>

          {/* Search type distribution */}
          <div className="rounded-lg p-5" style={cardStyle}>
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">
              Search Type Distribution
            </h3>
            <DistributionBar distribution={quality.search_type_distribution} />
          </div>

          {/* Similarity buckets */}
          <div className="rounded-lg p-5" style={cardStyle}>
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">
              Similarity Score Quality
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg" style={{ backgroundColor: "rgba(16,185,129,0.08)" }}>
                <p className="text-xl font-bold" style={{ color: "#10b981" }}>
                  {quality.similarity_buckets?.["good_gte_0.7"] || 0}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Good (&ge;0.7)</p>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ backgroundColor: "rgba(251,146,60,0.08)" }}>
                <p className="text-xl font-bold" style={{ color: "#fb923c" }}>
                  {quality.similarity_buckets?.["ok_0.5_to_0.7"] || 0}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">OK (0.5–0.7)</p>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ backgroundColor: "rgba(239,68,68,0.08)" }}>
                <p className="text-xl font-bold" style={{ color: "#ef4444" }}>
                  {quality.similarity_buckets?.["poor_lt_0.5"] || 0}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Poor (&lt;0.5)</p>
              </div>
            </div>
          </div>

          {/* Daily trend */}
          {quality.daily_avg_similarity &&
            Object.keys(quality.daily_avg_similarity).length > 0 && (
              <div className="rounded-lg p-5" style={cardStyle}>
                <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">
                  Daily Average Similarity
                </h3>
                <div className="flex items-end gap-1 h-24">
                  {Object.entries(quality.daily_avg_similarity)
                    .slice(-14)
                    .map(([day, avg]) => {
                      const height = (avg as number) * 100;
                      const color =
                        (avg as number) >= 0.7
                          ? "#10b981"
                          : (avg as number) >= 0.5
                          ? "#fb923c"
                          : "#ef4444";
                      return (
                        <div
                          key={day}
                          className="flex-1 flex flex-col items-center gap-1"
                          title={`${day}: ${(avg as number).toFixed(3)}`}
                        >
                          <div
                            className="w-full rounded-t"
                            style={{
                              height: `${Math.max(height, 4)}%`,
                              backgroundColor: color,
                              minHeight: "2px",
                            }}
                          />
                          <span className="text-[9px] text-[var(--text-muted)] -rotate-45 origin-top-left">
                            {day.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
