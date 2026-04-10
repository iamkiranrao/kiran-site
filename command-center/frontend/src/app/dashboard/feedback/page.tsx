"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MessageSquare,
  Quote,
  Smile,
  ThumbsUp,
  Meh,
  ThumbsDown,
  Loader2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
  MessageCircle,
  Users,
  Building2,
  Globe,
} from "lucide-react";
import ModuleHelp from "@/components/ModuleHelp";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ────────────────────────────────────────────────────

interface FeedbackStats {
  total: number;
  rating_breakdown: Record<string, number>;
  with_comments: number;
  daily_counts: Record<string, number>;
  period_days: number;
}

interface FeedbackEntry {
  id: string;
  rating: string | null;
  comment: string;
  created_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

interface TestimonialStats {
  total: number;
  status_breakdown: Record<string, number>;
  public_count: number;
}

interface TestimonialEntry {
  id: string;
  name: string;
  role: string;
  testimonial: string;
  is_public: boolean;
  status: string;
  created_at: string;
}

interface VisitorConnect {
  id: string;
  conversation_id: string | null;
  name: string;
  company: string | null;
  email: string | null;
  page_url: string | null;
  connected_at: string;
}

type Tab = "feedback" | "testimonials" | "guestbook";

// ── API helpers ──────────────────────────────────────────────

async function fetchApi(path: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}/api/feedback${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

const FENIX_API_URL = "https://api.kiranrao.ai";
const FENIX_API_KEY = "H3Ycu0N5kfv5MERh_5mYwYcMbGu6pYUv2y1KSgsMBLk";

async function fetchFenixApi(path: string) {
  const res = await fetch(`${FENIX_API_URL}/api/admin/fenix-analytics${path}`, {
    headers: { "X-API-Key": FENIX_API_KEY },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

// ── Rating icon helper ──────────────────────────────────────

function RatingIcon({ rating, size = 18 }: { rating: string | null; size?: number }) {
  switch (rating) {
    case "love":
      return <Smile size={size} style={{ color: "#22c55e" }} />;
    case "like":
      return <ThumbsUp size={size} style={{ color: "#60a5fa" }} />;
    case "neutral":
      return <Meh size={size} style={{ color: "#fbbf24" }} />;
    case "dislike":
      return <ThumbsDown size={size} style={{ color: "#ef4444" }} />;
    default:
      return <MessageCircle size={size} style={{ color: "var(--text-muted)" }} />;
  }
}

function ratingLabel(rating: string): string {
  return { love: "Love it", like: "Like it", neutral: "Okay", dislike: "Not great" }[rating] || rating;
}

function statusColor(status: string): string {
  return { approved: "#22c55e", rejected: "#ef4444", pending: "#fbbf24" }[status] || "#888";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ── Main Page ───────────────────────────────────────────────

export default function FeedbackPage() {
  const [tab, setTab] = useState<Tab>("feedback");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Feedback state
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(null);
  const [feedbackList, setFeedbackList] = useState<FeedbackEntry[]>([]);
  const [feedbackTotal, setFeedbackTotal] = useState(0);
  const [ratingFilter, setRatingFilter] = useState<string | null>(null);

  // Testimonial state
  const [testimonialStats, setTestimonialStats] = useState<TestimonialStats | null>(null);
  const [testimonialList, setTestimonialList] = useState<TestimonialEntry[]>([]);
  const [testimonialTotal, setTestimonialTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Guestbook state
  const [guestbookList, setGuestbookList] = useState<VisitorConnect[]>([]);
  const [guestbookTotal, setGuestbookTotal] = useState(0);

  // ── Load feedback ──────────────────────────────────────────

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const filterParam = ratingFilter ? `&rating=${ratingFilter}` : "";
      const [stats, list] = await Promise.all([
        fetchApi("/stats"),
        fetchApi(`/list?limit=50${filterParam}`),
      ]);
      setFeedbackStats(stats);
      setFeedbackList(list.feedback);
      setFeedbackTotal(list.total);
    } catch (e: any) {
      setError(e.message || "Failed to load feedback");
    }
    setLoading(false);
  }, [ratingFilter]);

  // ── Load testimonials ──────────────────────────────────────

  const loadTestimonials = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const filterParam = statusFilter ? `&status=${statusFilter}` : "";
      const [stats, list] = await Promise.all([
        fetchApi("/testimonials/stats"),
        fetchApi(`/testimonials/list?limit=50${filterParam}`),
      ]);
      setTestimonialStats(stats);
      setTestimonialList(list.testimonials);
      setTestimonialTotal(list.total);
    } catch (e: any) {
      setError(e.message || "Failed to load testimonials");
    }
    setLoading(false);
  }, [statusFilter]);

  // ── Load guestbook ─────────────────────────────────────────

  const loadGuestbook = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data: VisitorConnect[] = await fetchFenixApi("/visitor-connects?limit=100&days=365");
      setGuestbookList(data);
      setGuestbookTotal(data.length);
    } catch (e: any) {
      setError(e.message || "Failed to load guestbook");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "feedback") loadFeedback();
    else if (tab === "testimonials") loadTestimonials();
    else loadGuestbook();
  }, [tab, loadFeedback, loadTestimonials, loadGuestbook]);

  // ── Actions ────────────────────────────────────────────────

  const handleDeleteFeedback = async (id: string) => {
    try {
      await fetchApi(`/${id}`, { method: "DELETE" });
      setFeedbackList((prev) => prev.filter((f) => f.id !== id));
      setFeedbackTotal((prev) => prev - 1);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleTestimonialStatus = async (id: string, status: string) => {
    try {
      await fetchApi(`/testimonials/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setTestimonialList((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status } : t))
      );
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeleteTestimonial = async (id: string) => {
    try {
      await fetchApi(`/testimonials/${id}`, { method: "DELETE" });
      setTestimonialList((prev) => prev.filter((t) => t.id !== id));
      setTestimonialTotal((prev) => prev - 1);
    } catch (e: any) {
      setError(e.message);
    }
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "rgba(244, 114, 182, 0.15)" }}
          >
            <MessageSquare size={20} style={{ color: "#f472b6" }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[var(--text-primary)]">
                Feedback & Testimonials
              </h1>
              <ModuleHelp moduleSlug="feedback" />
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              Site feedback and testimonial submissions from visitors
            </p>
          </div>
        </div>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("feedback")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            tab === "feedback"
              ? "bg-[#f472b620] text-[#f472b6]"
              : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          <BarChart3 size={16} />
          Site Feedback
          {feedbackStats && (
            <span className="ml-1 text-xs opacity-60">({feedbackStats.total})</span>
          )}
        </button>
        <button
          onClick={() => setTab("testimonials")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            tab === "testimonials"
              ? "bg-[#a78bfa20] text-[#a78bfa]"
              : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          <Quote size={16} />
          Testimonials
          {testimonialStats && (
            <span className="ml-1 text-xs opacity-60">({testimonialStats.total})</span>
          )}
        </button>
        <button
          onClick={() => setTab("guestbook")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            tab === "guestbook"
              ? "bg-[#34d39920] text-[#34d399]"
              : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          <Users size={16} />
          Guestbook
          {guestbookTotal > 0 && (
            <span className="ml-1 text-xs opacity-60">({guestbookTotal})</span>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* ─── FEEDBACK TAB ────────────────────────────────────── */}
      {tab === "feedback" && (
        <>
          {/* Stats cards */}
          {feedbackStats && (
            <div className="grid grid-cols-4 gap-4 mb-6">
              <StatCard
                label="Total Feedback"
                value={feedbackStats.total}
                icon={MessageSquare}
                color="#f472b6"
              />
              <StatCard
                label="Love It"
                value={feedbackStats.rating_breakdown.love || 0}
                icon={Smile}
                color="#22c55e"
              />
              <StatCard
                label="With Comments"
                value={feedbackStats.with_comments}
                icon={MessageCircle}
                color="#60a5fa"
              />
              <StatCard
                label="Not Great"
                value={feedbackStats.rating_breakdown.dislike || 0}
                icon={ThumbsDown}
                color="#ef4444"
              />
            </div>
          )}

          {/* Filter chips */}
          <div className="flex gap-2 mb-4">
            {[null, "love", "like", "neutral", "dislike"].map((r) => (
              <button
                key={r || "all"}
                onClick={() => setRatingFilter(r)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  ratingFilter === r
                    ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
                    : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {r ? ratingLabel(r) : "All"}
              </button>
            ))}
            <span className="ml-auto text-xs text-[var(--text-muted)] self-center">
              {feedbackTotal} entries
            </span>
          </div>

          {/* Feedback list */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
            </div>
          ) : feedbackList.length === 0 ? (
            <div className="text-center py-20 text-[var(--text-muted)]">
              <MessageSquare size={40} className="mx-auto mb-3 opacity-40" />
              <p>No feedback yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {feedbackList.map((f) => (
                <div
                  key={f.id}
                  className="group flex items-start gap-4 rounded-xl p-4 transition-all hover:bg-[var(--bg-secondary)]"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="mt-0.5">
                    <RatingIcon rating={f.rating} size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {f.rating ? ratingLabel(f.rating) : "Comment only"}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {formatDateTime(f.created_at)}
                      </span>
                    </div>
                    {f.comment && (
                      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                        {f.comment}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteFeedback(f.id)}
                    className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-500/10 transition-all"
                    title="Delete"
                  >
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── GUESTBOOK TAB ─────────────────────────────────────── */}
      {tab === "guestbook" && (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <StatCard
              label="Total Connects"
              value={guestbookTotal}
              icon={Users}
              color="#34d399"
            />
            <StatCard
              label="With Company"
              value={guestbookList.filter((v) => v.company).length}
              icon={Building2}
              color="#60a5fa"
            />
            <StatCard
              label="Unique Pages"
              value={new Set(guestbookList.map((v) => v.page_url).filter(Boolean)).size}
              icon={Globe}
              color="#a78bfa"
            />
          </div>

          <div className="flex gap-2 mb-4">
            <span className="ml-auto text-xs text-[var(--text-muted)] self-center">
              {guestbookTotal} visitors connected
            </span>
          </div>

          {/* Guestbook list */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
            </div>
          ) : guestbookList.length === 0 ? (
            <div className="text-center py-20 text-[var(--text-muted)]">
              <Users size={40} className="mx-auto mb-3 opacity-40" />
              <p>No visitors have connected yet.</p>
              <p className="text-xs mt-1 opacity-60">
                Visitors connect through Fenix by sharing their name and company.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {guestbookList.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-4 rounded-xl p-4 transition-all hover:bg-[var(--bg-secondary)]"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={{
                      backgroundColor: "rgba(52, 211, 153, 0.12)",
                      color: "#34d399",
                    }}
                  >
                    {v.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Name + company */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[var(--text-primary)]">
                      {v.name}
                    </p>
                    {v.company && (
                      <p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                        <Building2 size={11} />
                        {v.company}
                      </p>
                    )}
                  </div>

                  {/* Page URL */}
                  {v.page_url && (
                    <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded truncate max-w-[200px]">
                      {v.page_url.replace("https://kirangorapalli.com", "").replace("https://kiranrao.ai", "") || "/"}
                    </span>
                  )}

                  {/* Date */}
                  <span className="text-xs text-[var(--text-muted)] shrink-0">
                    {formatDateTime(v.connected_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── TESTIMONIALS TAB ────────────────────────────────── */}
      {tab === "testimonials" && (
        <>
          {/* Stats cards */}
          {testimonialStats && (
            <div className="grid grid-cols-4 gap-4 mb-6">
              <StatCard
                label="Total"
                value={testimonialStats.total}
                icon={Quote}
                color="#a78bfa"
              />
              <StatCard
                label="Pending"
                value={testimonialStats.status_breakdown.pending || 0}
                icon={Clock}
                color="#fbbf24"
              />
              <StatCard
                label="Approved"
                value={testimonialStats.status_breakdown.approved || 0}
                icon={CheckCircle2}
                color="#22c55e"
              />
              <StatCard
                label="Public"
                value={testimonialStats.public_count}
                icon={MessageSquare}
                color="#60a5fa"
              />
            </div>
          )}

          {/* Filter chips */}
          <div className="flex gap-2 mb-4">
            {[null, "pending", "approved", "rejected"].map((s) => (
              <button
                key={s || "all"}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  statusFilter === s
                    ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
                    : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All"}
              </button>
            ))}
            <span className="ml-auto text-xs text-[var(--text-muted)] self-center">
              {testimonialTotal} entries
            </span>
          </div>

          {/* Testimonials list */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
            </div>
          ) : testimonialList.length === 0 ? (
            <div className="text-center py-20 text-[var(--text-muted)]">
              <Quote size={40} className="mx-auto mb-3 opacity-40" />
              <p>No testimonials yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {testimonialList.map((t) => (
                <div
                  key={t.id}
                  className="group rounded-xl p-5 transition-all"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                        style={{
                          backgroundColor: "rgba(167, 139, 250, 0.12)",
                          color: "#a78bfa",
                        }}
                      >
                        {t.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-[var(--text-primary)] text-sm">
                          {t.name}
                        </p>
                        {t.role && (
                          <p className="text-xs text-[var(--text-muted)]">{t.role}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Status badge */}
                      <span
                        className="px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: `${statusColor(t.status)}20`,
                          color: statusColor(t.status),
                        }}
                      >
                        {t.status}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {formatDate(t.created_at)}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4 italic">
                    &ldquo;{t.testimonial}&rdquo;
                  </p>

                  <div className="flex items-center gap-2">
                    {t.is_public && (
                      <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded">
                        Public
                      </span>
                    )}
                    <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      {t.status !== "approved" && (
                        <button
                          onClick={() => handleTestimonialStatus(t.id, "approved")}
                          className="p-2 rounded-lg hover:bg-green-500/10 transition-all"
                          title="Approve"
                        >
                          <CheckCircle2 size={16} className="text-green-400" />
                        </button>
                      )}
                      {t.status !== "rejected" && (
                        <button
                          onClick={() => handleTestimonialStatus(t.id, "rejected")}
                          className="p-2 rounded-lg hover:bg-red-500/10 transition-all"
                          title="Reject"
                        >
                          <XCircle size={16} className="text-red-400" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteTestimonial(t.id)}
                        className="p-2 rounded-lg hover:bg-red-500/10 transition-all"
                        title="Delete"
                      >
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
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
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}
