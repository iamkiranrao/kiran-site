"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellOff,
  Inbox,
  Loader2,
  MessageSquare,
  Quote,
  AlertTriangle,
  Zap,
  BookOpen,
  Brain,
  FileText,
  Bot,
  Settings,
  Database,
  CheckCheck,
  X,
  Eye,
  ExternalLink,
  Filter,
  ChevronDown,
  HelpCircle,
  CheckSquare,
  BookHeart,
  FileWarning,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ────────────────────────────────────────────────────

interface Notification {
  id: string;
  type: string;
  source: string;
  title: string;
  summary: string;
  action_url: string | null;
  priority: string;
  read: boolean;
  dismissed: boolean;
  reference_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
  read_at: string | null;
  dismissed_at: string | null;
}

interface NotificationCounts {
  total_active: number;
  unread: number;
  by_type: Record<string, number>;
  by_priority: Record<string, number>;
}

// ── Constants ────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<any>; color: string }
> = {
  feedback: { label: "Feedback", icon: MessageSquare, color: "#f472b6" },
  testimonial: { label: "Testimonial", icon: Quote, color: "#a78bfa" },
  fenix_widget: { label: "Fenix Widget", icon: Bot, color: "#fb923c" },
  fenix_dead_end: { label: "Fenix Dead End", icon: Bot, color: "#ef4444" },
  task_failure: { label: "Task Failure", icon: AlertTriangle, color: "#ef4444" },
  embedding_status: { label: "Embeddings", icon: Database, color: "#60a5fa" },
  content_freshness: { label: "Stale Content", icon: FileText, color: "#fbbf24" },
  journal_pending: { label: "Journal", icon: BookOpen, color: "#2dd4bf" },
  training_progress: { label: "Training", icon: Brain, color: "#fb923c" },
  draft_content: { label: "Draft", icon: FileText, color: "#a78bfa" },
  action_item: { label: "Action Item", icon: CheckSquare, color: "#34d399" },
  journal_entry: { label: "Journal", icon: BookHeart, color: "#d4a74a" },
  docs_drift: { label: "Docs Drift", icon: FileWarning, color: "#fbbf24" },
  system: { label: "System", icon: Settings, color: "#888" },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "#ef4444" },
  high: { label: "High", color: "#fb923c" },
  normal: { label: "Normal", color: "#60a5fa" },
  low: { label: "Low", color: "#888" },
};

// ── API helpers ──────────────────────────────────────────────

async function fetchApi(path: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}/api/notifications${path}`, options);
  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

// ── Helpers ──────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ── Main Page ────────────────────────────────────────────────

export default function NotificationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [counts, setCounts] = useState<NotificationCounts | null>(null);
  const [total, setTotal] = useState(0);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // ── Load data ──────────────────────────────────────────────

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (typeFilter) params.set("type", typeFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      if (unreadOnly) params.set("unread_only", "true");

      const [list, countData] = await Promise.all([
        fetchApi(`/?${params}`),
        fetchApi("/counts"),
      ]);
      setNotifications(list.notifications);
      setTotal(list.total);
      setCounts(countData);
    } catch (e: any) {
      setError(e.message || "Failed to load notifications");
    }
    setLoading(false);
  }, [typeFilter, priorityFilter, unreadOnly]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // ── Actions ────────────────────────────────────────────────

  const handleMarkRead = async (id: string) => {
    try {
      await fetchApi(`/${id}/read`, { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, read: true, read_at: new Date().toISOString() } : n
        )
      );
      setCounts((prev) =>
        prev ? { ...prev, unread: Math.max(0, prev.unread - 1) } : prev
      );
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await fetchApi(`/${id}/dismiss`, { method: "PATCH" });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setTotal((prev) => prev - 1);
      setCounts((prev) =>
        prev
          ? { ...prev, total_active: Math.max(0, prev.total_active - 1) }
          : prev
      );
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetchApi("/read-all", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: typeFilter }),
      });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true, read_at: new Date().toISOString() }))
      );
      setCounts((prev) => (prev ? { ...prev, unread: 0 } : prev));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDismissAll = async () => {
    try {
      await fetchApi("/dismiss-all", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: typeFilter }),
      });
      setNotifications([]);
      setTotal(0);
      setCounts((prev) =>
        prev ? { ...prev, total_active: 0, unread: 0 } : prev
      );
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleNavigate = (n: Notification) => {
    // Mark as read first, then navigate
    if (!n.read) handleMarkRead(n.id);
    if (n.action_url) router.push(n.action_url);
  };

  // ── Active type filters (only show types that have notifications) ──

  const activeTypes = counts?.by_type
    ? Object.entries(counts.by_type)
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
    : [];

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "rgba(251, 146, 60, 0.15)" }}
          >
            <Inbox size={20} style={{ color: "#fb923c" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">
              Notification Center
            </h1>
            <p className="text-sm text-[var(--text-muted)]">
              Everything that needs your attention, in one place
            </p>
          </div>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className={`p-2 rounded-lg transition-all ${
              showHelp
                ? "bg-[#60a5fa20] text-[#60a5fa]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
            }`}
            title="What feeds into the Notification Center?"
          >
            <HelpCircle size={18} />
          </button>
        </div>

        {/* Bulk actions */}
        <div className="flex items-center gap-2">
          {counts && counts.unread > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-all"
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
          )}
          {total > 0 && (
            <button
              onClick={handleDismissAll}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-red-400 transition-all"
            >
              <BellOff size={14} />
              Dismiss all
            </button>
          )}
        </div>
      </div>

      {/* Help panel */}
      {showHelp && (
        <div
          className="mb-6 rounded-xl p-5 space-y-4"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              What feeds into the Notification Center?
            </h3>
            <button
              onClick={() => setShowHelp(false)}
              className="p-1 rounded-lg hover:bg-[var(--bg-secondary)] transition-all"
            >
              <X size={14} className="text-[var(--text-muted)]" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { type: "feedback", desc: "New site feedback submissions from visitors" },
              { type: "testimonial", desc: "Testimonials pending your approval" },
              { type: "fenix_widget", desc: "Feedback submitted through the Fenix chat widget" },
              { type: "fenix_dead_end", desc: "Fenix conversations where RAG found no results" },
              { type: "task_failure", desc: "Scheduled tasks that failed to run" },
              { type: "embedding_status", desc: "Embedding pipeline events (reindex runs, errors)" },
              { type: "content_freshness", desc: "Pages that haven't been updated in a while" },
              { type: "journal_pending", desc: "Journal entries ready for your review" },
              { type: "training_progress", desc: "Fenix training milestones and gap alerts" },
              { type: "draft_content", desc: "Content drafts waiting to be published" },
              { type: "action_item", desc: "New action items from sessions or manual entry" },
              { type: "journal_entry", desc: "New strategic thinking entries in Kiran's Journal" },
              { type: "docs_drift", desc: "Documentation that may be out of sync with code changes" },
              { type: "system", desc: "Generic system alerts and announcements" },
            ].map(({ type, desc }) => {
              const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.system;
              const Icon = cfg.icon;
              return (
                <div key={type} className="flex items-start gap-2.5">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: `${cfg.color}18` }}
                  >
                    <Icon size={14} style={{ color: cfg.color }} />
                  </div>
                  <div>
                    <span className="text-xs font-medium text-[var(--text-secondary)]">
                      {cfg.label}
                    </span>
                    <p className="text-[11px] text-[var(--text-muted)] leading-snug">
                      {desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-[var(--text-muted)] pt-2" style={{ borderTop: "1px solid var(--border)" }}>
            Notifications are created automatically by backend services. Deduplication prevents repeats for the same event. Dismissed notifications are cleaned up after 90 days.
          </p>
        </div>
      )}

      {/* Stats row */}
      {counts && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Total Active"
            value={counts.total_active}
            icon={Bell}
            color="#fb923c"
          />
          <StatCard
            label="Unread"
            value={counts.unread}
            icon={Inbox}
            color="#60a5fa"
          />
          <StatCard
            label="High Priority"
            value={
              (counts.by_priority.high || 0) +
              (counts.by_priority.urgent || 0)
            }
            icon={AlertTriangle}
            color="#ef4444"
          />
          <StatCard
            label="Types"
            value={Object.keys(counts.by_type).length}
            icon={Zap}
            color="#a78bfa"
          />
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {/* Type filter chips */}
        <button
          onClick={() => setTypeFilter(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            typeFilter === null
              ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
              : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          All
        </button>
        {activeTypes.map(([type, count]) => {
          const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.system;
          return (
            <button
              key={type}
              onClick={() => setTypeFilter(typeFilter === type ? null : type)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                typeFilter === type
                  ? "text-[var(--bg-primary)]"
                  : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
              style={
                typeFilter === type
                  ? { backgroundColor: cfg.color }
                  : undefined
              }
            >
              {cfg.label}
              <span className="opacity-60">({count})</span>
            </button>
          );
        })}

        {/* Right-side toggles */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setUnreadOnly(!unreadOnly)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              unreadOnly
                ? "bg-[#60a5fa30] text-[#60a5fa]"
                : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <Eye size={12} />
            Unread only
          </button>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              showFilters || priorityFilter
                ? "bg-[#a78bfa30] text-[#a78bfa]"
                : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <Filter size={12} />
            Priority
            <ChevronDown size={12} />
          </button>
        </div>
      </div>

      {/* Priority filter dropdown */}
      {showFilters && (
        <div className="flex gap-2 mb-4 ml-auto justify-end">
          {[null, "urgent", "high", "normal", "low"].map((p) => {
            const cfg = p ? PRIORITY_CONFIG[p] : null;
            return (
              <button
                key={p || "all"}
                onClick={() => {
                  setPriorityFilter(p);
                  setShowFilters(false);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  priorityFilter === p
                    ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
                    : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {p ? cfg!.label : "Any priority"}
              </button>
            );
          })}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Count label */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-[var(--text-muted)]">
          {total} notification{total !== 1 ? "s" : ""}
          {typeFilter && ` (${TYPE_CONFIG[typeFilter]?.label || typeFilter})`}
          {priorityFilter &&
            ` · ${PRIORITY_CONFIG[priorityFilter]?.label || priorityFilter}`}
        </span>
      </div>

      {/* Notification list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2
            size={24}
            className="animate-spin text-[var(--text-muted)]"
          />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20 text-[var(--text-muted)]">
          <Inbox size={40} className="mx-auto mb-3 opacity-40" />
          <p className="mb-1">
            {typeFilter || priorityFilter || unreadOnly
              ? "No matching notifications."
              : "All clear — nothing needs your attention."}
          </p>
          <p className="text-xs opacity-60">
            Notifications appear here when feedback arrives, tasks fail, or
            content needs attention.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <NotificationCard
              key={n.id}
              notification={n}
              onMarkRead={handleMarkRead}
              onDismiss={handleDismiss}
              onNavigate={handleNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Notification Card ────────────────────────────────────────

function NotificationCard({
  notification: n,
  onMarkRead,
  onDismiss,
  onNavigate,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onNavigate: (n: Notification) => void;
}) {
  const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.system;
  const priorityCfg = PRIORITY_CONFIG[n.priority] || PRIORITY_CONFIG.normal;
  const Icon = cfg.icon;

  return (
    <div
      className={`group flex items-start gap-4 rounded-xl p-4 transition-all hover:bg-[var(--bg-secondary)] ${
        n.read ? "opacity-60" : ""
      }`}
      style={{
        backgroundColor: "var(--bg-card)",
        border: `1px solid ${!n.read && (n.priority === "high" || n.priority === "urgent") ? `${priorityCfg.color}30` : "var(--border)"}`,
      }}
    >
      {/* Type icon */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ backgroundColor: `${cfg.color}18` }}
      >
        <Icon size={18} style={{ color: cfg.color }} />
      </div>

      {/* Content */}
      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => onNavigate(n)}
      >
        <div className="flex items-center gap-2 mb-0.5">
          {/* Unread dot */}
          {!n.read && (
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: "#60a5fa" }}
            />
          )}
          <span
            className={`text-sm ${
              n.read
                ? "text-[var(--text-secondary)]"
                : "font-medium text-[var(--text-primary)]"
            }`}
          >
            {n.title}
          </span>

          {/* Priority badge (only for high/urgent) */}
          {(n.priority === "high" || n.priority === "urgent") && (
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
              style={{
                backgroundColor: `${priorityCfg.color}20`,
                color: priorityCfg.color,
              }}
            >
              {priorityCfg.label}
            </span>
          )}
        </div>

        {n.summary && (
          <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-2 mt-0.5">
            {n.summary}
          </p>
        )}

        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
            {cfg.label}
          </span>
          <span className="text-[10px] text-[var(--text-muted)]">·</span>
          <span className="text-[10px] text-[var(--text-muted)]">
            {timeAgo(n.created_at)}
          </span>
          {n.action_url && (
            <>
              <span className="text-[10px] text-[var(--text-muted)]">·</span>
              <span className="text-[10px] text-[var(--accent-blue, #60a5fa)] flex items-center gap-0.5">
                <ExternalLink size={10} />
                View
              </span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
        {!n.read && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead(n.id);
            }}
            className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-all"
            title="Mark as read"
          >
            <Eye size={14} className="text-[var(--text-muted)]" />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(n.id);
          }}
          className="p-2 rounded-lg hover:bg-red-500/10 transition-all"
          title="Dismiss"
        >
          <X size={14} className="text-red-400" />
        </button>
      </div>
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
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border)",
      }}
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
