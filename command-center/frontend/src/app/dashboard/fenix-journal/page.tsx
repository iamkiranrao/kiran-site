"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  Calendar,
  FileText,
  ChevronLeft,
  ChevronRight,
  User,
  Hammer,
  Loader2,
  BarChart3,
  Eye,
  Notebook,
  MessageSquare,
  Trash2,
  Clock,
  Hash,
  Search,
  X,
  Link2,
} from "lucide-react";
import ModuleHelp from "@/components/ModuleHelp";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ────────────────────────────────────────────────────
interface StreamMeta {
  title: string;
  word_count: number;
  preview: string;
  day_number: number | null;
}

interface EntryListItem {
  date: string;
  streams: Record<string, StreamMeta>;
}

interface StreamContent {
  title: string;
  content: string;
  word_count: number;
  day_number: number | null;
}

interface EntryDetail {
  date: string;
  streams: Record<string, StreamContent>;
}

interface JournalStats {
  total_entries: number;
  total_words: number;
  streams: Record<string, number>;
  date_range: { first: string | null; last: string | null };
}

interface RawObservations {
  kiran: { title: string; content: string };
  build: { title: string; content: string };
}

interface SessionListItem {
  filename: string;
  title: string;
  session_id: string;
  session_type: "chat" | "cowork";
  captured_at: string;
  session_start: string;
  session_end: string;
  message_count: number;
  user_messages: number;
  assistant_messages: number;
  total_words: number;
  preview: string;
}

interface SessionDetail {
  filename: string;
  title: string;
  session_id: string;
  session_type: "chat" | "cowork";
  captured_at: string;
  session_start: string;
  session_end: string;
  message_count: number;
  user_messages: number;
  assistant_messages: number;
  total_words: number;
  content: string;
}

interface ArchiveStats {
  total_sessions: number;
  total_words: number;
  total_messages: number;
}

interface ConnectingThread {
  slug: string;
  filename: string;
  date: string;
  title: string;
  word_count: number;
  preview: string;
  stream: "connecting-threads";
}

interface ConnectingThreadDetail {
  slug: string;
  title: string;
  date: string;
  content: string;
  word_count: number;
  stream: "connecting-threads";
}

interface SearchResult {
  source_type: "journal" | "session";
  stream: string | null;
  stream_title: string | null;
  date: string;
  title: string;
  snippets: string[];
  word_count: number;
  filename: string | null;
  session_type?: "chat" | "cowork";
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
}

type View = "timeline" | "entry" | "raw" | "sessions" | "session-detail" | "search" | "thread-detail";

// ── API helper ───────────────────────────────────────────────
async function fetchApi(path: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}/api/journal${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

// ── Minimal markdown rendering ───────────────────────────────
function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-5 mb-2 text-[var(--text-primary)]">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-6 mb-2 text-[var(--text-primary)]">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mb-1 text-[var(--text-primary)]">$1</h1>')
    .replace(/^---$/gm, '<hr class="border-[var(--border)] my-4" />')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-[var(--text-primary)]">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded text-xs bg-[var(--bg-secondary)] text-[var(--text-primary)]">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 mb-1.5">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, (match) => `<ul class="list-disc pl-2 my-3">${match}</ul>`)
    .replace(/\n\n/g, '</p><p class="mb-3 leading-relaxed text-[var(--text-secondary)]">')
    .replace(/^(?!<[hHuUlLoO])(.+)$/gm, (_, text) => {
      if (text.startsWith("<")) return text;
      return text;
    });
}

// ── Highlight search terms ───────────────────────────────
function highlightTerms(text: string, query: string): string {
  if (!query) return text;
  const terms = query.trim().split(/\s+/).filter(Boolean);
  let result = text;
  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(
      new RegExp(`(${escaped})`, "gi"),
      '<mark class="bg-[#2dd4bf30] text-[var(--text-primary)] rounded px-0.5">$1</mark>'
    );
  }
  return result;
}

// ── Format date ──────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(isoStr: string): string {
  if (!isoStr) return "—";
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return isoStr;
  }
}

function formatDateShort(isoStr: string): string {
  if (!isoStr) return "—";
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return isoStr;
  }
}

// ── Main Page Component ──────────────────────────────────────
export default function FenixJournalPage() {
  const [view, setView] = useState<View>("timeline");
  const [stats, setStats] = useState<JournalStats | null>(null);
  const [entries, setEntries] = useState<EntryListItem[]>([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Entry detail state
  const [selectedDate, setSelectedDate] = useState("");
  const [entryDetail, setEntryDetail] = useState<EntryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Raw observations state
  const [rawData, setRawData] = useState<RawObservations | null>(null);
  const [rawTab, setRawTab] = useState<"kiran" | "build">("kiran");
  const [rawLoading, setRawLoading] = useState(false);

  // Session archive state
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [archiveStats, setArchiveStats] = useState<ArchiveStats | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(null);
  const [sessionDetailLoading, setSessionDetailLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Connecting threads state
  const [connectingThreads, setConnectingThreads] = useState<ConnectingThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<ConnectingThreadDetail | null>(null);
  const [threadDetailLoading, setThreadDetailLoading] = useState(false);

  // Entry delete state (stream/identifier)
  const [entryDeleteConfirm, setEntryDeleteConfirm] = useState<{ stream: string; identifier: string } | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // ── Load timeline data ──────────────────────────────────
  const loadTimeline = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [statsRes, entriesRes] = await Promise.all([
        fetchApi("/stats"),
        fetchApi("/entries?limit=50"),
      ]);
      setStats(statsRes);
      setEntries(entriesRes.entries);
      setTotalEntries(entriesRes.total);
      setConnectingThreads(entriesRes.connecting_threads || []);
    } catch (e: any) {
      setError(e.message || "Failed to load journal");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  // ── Load entry detail ───────────────────────────────────
  const openEntry = async (date: string) => {
    setSelectedDate(date);
    setView("entry");
    setDetailLoading(true);
    try {
      const data = await fetchApi(`/entries/${date}`);
      setEntryDetail(data);
    } catch (e: any) {
      setError(e.message);
    }
    setDetailLoading(false);
  };

  // ── Navigate between entries ────────────────────────────
  const navigateEntry = (direction: "prev" | "next") => {
    const idx = entries.findIndex((e) => e.date === selectedDate);
    if (direction === "next" && idx > 0) openEntry(entries[idx - 1].date);
    if (direction === "prev" && idx < entries.length - 1) openEntry(entries[idx + 1].date);
  };

  // ── Load raw observations ──────────────────────────────
  const openRaw = async () => {
    setView("raw");
    if (rawData) return;
    setRawLoading(true);
    try {
      const data = await fetchApi("/raw");
      setRawData(data);
    } catch (e: any) {
      setError(e.message);
    }
    setRawLoading(false);
  };

  // ── Load sessions ──────────────────────────────────────
  const openSessions = async () => {
    setView("sessions");
    setSessionsLoading(true);
    setError("");
    try {
      const [sessionsRes, statsRes] = await Promise.all([
        fetchApi("/archive/sessions?limit=100"),
        fetchApi("/archive/stats"),
      ]);
      setSessions(sessionsRes.sessions);
      setArchiveStats(statsRes);
    } catch (e: any) {
      setError(e.message);
    }
    setSessionsLoading(false);
  };

  // ── Open session detail ────────────────────────────────
  const openSessionDetail = async (filename: string) => {
    setView("session-detail");
    setSessionDetailLoading(true);
    setError("");
    try {
      const data = await fetchApi(`/archive/sessions/${encodeURIComponent(filename)}`);
      setSelectedSession(data);
    } catch (e: any) {
      setError(e.message);
    }
    setSessionDetailLoading(false);
  };

  // ── Search ───────────────────────────────────────────
  const handleSearch = async (query: string) => {
    if (!query.trim()) return;
    setView("search");
    setSearchLoading(true);
    setError("");
    try {
      const data = await fetchApi(`/search?q=${encodeURIComponent(query.trim())}&limit=30`);
      setSearchResults(data);
    } catch (e: any) {
      setError(e.message);
    }
    setSearchLoading(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(searchQuery);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults(null);
    setView("timeline");
  };

  // Click a search result to open the source
  const openSearchResult = (result: SearchResult) => {
    if (result.source_type === "journal" && result.date) {
      openEntry(result.date);
    } else if (result.source_type === "session" && result.filename) {
      openSessionDetail(result.filename);
    }
  };

  // ── Open connecting thread detail ─────────────────────
  const openThread = async (slug: string) => {
    setView("thread-detail");
    setThreadDetailLoading(true);
    try {
      const data = await fetchApi(`/connecting-threads/${slug}`);
      setSelectedThread(data);
    } catch (e: any) {
      setError(e.message);
    }
    setThreadDetailLoading(false);
  };

  // ── Delete journal entry ────────────────────────────────
  const handleEntryDelete = async (stream: string, identifier: string) => {
    try {
      await fetchApi(`/entries/${stream}/${identifier}`, { method: "DELETE" });
      setEntryDeleteConfirm(null);
      // Refresh timeline
      loadTimeline();
      // If viewing the deleted entry, go back
      if (view === "entry" && selectedDate === identifier) {
        setView("timeline");
      }
      if (view === "thread-detail" && selectedThread?.slug === identifier) {
        setView("timeline");
        setSelectedThread(null);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  // ── Delete session ─────────────────────────────────────
  const handleDelete = async (filename: string) => {
    try {
      await fetchApi(`/archive/sessions/${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      setSessions((prev) => prev.filter((s) => s.filename !== filename));
      setDeleteConfirm(null);
      if (archiveStats) {
        setArchiveStats({
          ...archiveStats,
          total_sessions: archiveStats.total_sessions - 1,
        });
      }
      // If viewing the deleted session, go back to list
      if (selectedSession?.filename === filename) {
        setView("sessions");
        setSelectedSession(null);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  // ── Index helpers ──────────────────────────────────────
  const currentIdx = entries.findIndex((e) => e.date === selectedDate);
  const hasPrev = currentIdx < entries.length - 1;
  const hasNext = currentIdx > 0;

  // ── Back navigation ────────────────────────────────────
  const handleBack = () => {
    if (view === "session-detail") {
      if (searchResults) {
        setView("search");
      } else {
        setView("sessions");
      }
      setSelectedSession(null);
    } else if (view === "thread-detail") {
      setView("timeline");
      setSelectedThread(null);
    } else if (view === "entry" && searchResults) {
      setView("search");
    } else {
      setView("timeline");
    }
  };

  // ════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          {view !== "timeline" && (
            <button
              onClick={handleBack}
              className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
            >
              <ChevronLeft size={20} className="text-[var(--text-muted)]" />
            </button>
          )}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "rgba(45, 212, 191, 0.15)" }}
          >
            <BookOpen size={20} style={{ color: "#2dd4bf" }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[var(--text-primary)]">Fenix Journal</h1>
              <ModuleHelp moduleSlug="fenix-journal" />
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              {view === "timeline" && "Daily diary entries from Fenix"}
              {view === "entry" && formatDate(selectedDate)}
              {view === "raw" && "Raw observation notes"}
              {view === "sessions" && "Archived session transcripts"}
              {view === "session-detail" && (selectedSession?.title || "Session detail")}
              {view === "thread-detail" && (selectedThread?.title || "Connecting Thread")}
              {view === "search" && `Search results for "${searchResults?.query || searchQuery}"`}
            </p>
          </div>
        </div>

        {/* View tabs */}
        {view === "timeline" && (
          <div className="flex gap-2">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search journal & sessions..."
                className="pl-9 pr-4 py-2 rounded-lg text-sm bg-[var(--bg-secondary)] text-[var(--text-primary)]
                  placeholder:text-[var(--text-muted)] border border-transparent focus:border-[var(--border)]
                  focus:outline-none w-[240px] transition-all"
              />
            </form>
            <button
              onClick={openSessions}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors
                bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <MessageSquare size={16} />
              Sessions
            </button>
            <button
              onClick={openRaw}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors
                bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <Notebook size={16} />
              Raw Notes
            </button>
          </div>
        )}

        {view === "search" && (
          <div className="flex gap-2 items-center">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search journal & sessions..."
                className="pl-9 pr-4 py-2 rounded-lg text-sm bg-[var(--bg-secondary)] text-[var(--text-primary)]
                  placeholder:text-[var(--text-muted)] border border-transparent focus:border-[var(--border)]
                  focus:outline-none w-[240px] transition-all"
                autoFocus
              />
            </form>
            <button
              onClick={clearSearch}
              className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
              title="Clear search"
            >
              <X size={16} className="text-[var(--text-muted)]" />
            </button>
          </div>
        )}

        {view === "entry" && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateEntry("prev")}
              disabled={!hasPrev}
              className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-30"
            >
              <ChevronLeft size={18} className="text-[var(--text-muted)]" />
            </button>
            <span className="text-xs text-[var(--text-muted)] min-w-[60px] text-center">
              {currentIdx >= 0 ? `${entries.length - currentIdx} of ${entries.length}` : ""}
            </span>
            <button
              onClick={() => navigateEntry("next")}
              disabled={!hasNext}
              className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-30"
            >
              <ChevronRight size={18} className="text-[var(--text-muted)]" />
            </button>
          </div>
        )}

        {view === "session-detail" && selectedSession && (
          <button
            onClick={() => setDeleteConfirm(selectedSession.filename)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors
              bg-red-500/10 text-red-400 hover:bg-red-500/20"
          >
            <Trash2 size={16} />
            Delete
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="rounded-xl p-6 max-w-md mx-4"
            style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Delete session?</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-1">
              This will permanently remove the session from the archive.
            </p>
            <p className="text-sm text-[var(--text-muted)] mb-6">
              If Fenix hasn&apos;t processed it yet, it will also be removed from chat-drops.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg text-sm bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 rounded-lg text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30"
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entry delete confirmation modal */}
      {entryDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="rounded-xl p-6 max-w-md mx-4"
            style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Delete entry?</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-1">
              This will permanently remove the {entryDeleteConfirm.stream === "connecting-threads" ? "connecting thread" : "journal entry"}.
            </p>
            <p className="text-sm text-[var(--text-muted)] mb-6">
              {entryDeleteConfirm.stream === "about-kiran"
                ? "Both the About Kiran and Build Journey entries for this date will be deleted."
                : `"${entryDeleteConfirm.identifier.replace(/-/g, " ")}"`}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setEntryDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg text-sm bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (entryDeleteConfirm.stream === "about-kiran") {
                    // Delete both streams for this date
                    handleEntryDelete("about-kiran", entryDeleteConfirm.identifier);
                    handleEntryDelete("build-journey", entryDeleteConfirm.identifier);
                  } else {
                    handleEntryDelete(entryDeleteConfirm.stream, entryDeleteConfirm.identifier);
                  }
                }}
                className="px-4 py-2 rounded-lg text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30"
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TIMELINE VIEW ─────────────────────────────────── */}
      {view === "timeline" && (
        <>
          {/* Stats row */}
          {stats && (
            <div className="grid grid-cols-5 gap-4 mb-8">
              <StatCard
                label="Total Entries"
                value={stats.total_entries}
                icon={Calendar}
                color="#2dd4bf"
              />
              <StatCard
                label="Total Words"
                value={stats.total_words.toLocaleString()}
                icon={FileText}
                color="#a78bfa"
              />
              <StatCard
                label="About Kiran"
                value={stats.streams["about-kiran"] || 0}
                icon={User}
                color="#fb923c"
              />
              <StatCard
                label="Build Journey"
                value={stats.streams["build-journey"] || 0}
                icon={Hammer}
                color="#60a5fa"
              />
              <StatCard
                label="Threads"
                value={stats.streams["connecting-threads"] || 0}
                icon={Link2}
                color="#34d399"
              />
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-20 text-[var(--text-muted)]">
              <BookOpen size={40} className="mx-auto mb-3 opacity-40" />
              <p>No journal entries yet.</p>
            </div>
          ) : (
            <>
            {/* Connecting Threads section */}
            {connectingThreads.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Link2 size={16} style={{ color: "#34d399" }} />
                  <h2 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                    Connecting Threads
                  </h2>
                  <span className="text-xs text-[var(--text-muted)]">
                    — thematic essays tracing patterns over time
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-8">
                  {connectingThreads.map((thread) => (
                    <div
                      key={thread.slug}
                      className="rounded-xl p-4 transition-all"
                      style={{
                        backgroundColor: "var(--bg-card)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <button
                          onClick={() => openThread(thread.slug)}
                          className="flex-1 text-left"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <div
                              className="w-7 h-7 rounded-md flex items-center justify-center"
                              style={{ backgroundColor: "rgba(52, 211, 153, 0.12)" }}
                            >
                              <Link2 size={13} style={{ color: "#34d399" }} />
                            </div>
                            <p className="font-semibold text-sm text-[var(--text-primary)]">
                              {thread.title}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] ml-9 mb-1">
                            {thread.date && <span>{formatDate(thread.date)}</span>}
                            <span>{thread.word_count.toLocaleString()} words</span>
                          </div>
                          <p className="text-xs text-[var(--text-secondary)] line-clamp-2 ml-9">
                            {thread.preview}
                          </p>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEntryDeleteConfirm({ stream: "connecting-threads", identifier: thread.slug });
                          }}
                          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0 ml-2"
                          title="Delete thread"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Daily entries section header */}
            {connectingThreads.length > 0 && entries.length > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <Calendar size={16} style={{ color: "#2dd4bf" }} />
                <h2 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                  Daily Entries
                </h2>
              </div>
            )}

            <div className="space-y-3">
              {entries.map((entry) => {
                const aboutKiran = entry.streams["about-kiran"];
                const buildJourney = entry.streams["build-journey"];
                const dayNum = aboutKiran?.day_number || buildJourney?.day_number;
                const totalWords =
                  (aboutKiran?.word_count || 0) + (buildJourney?.word_count || 0);

                return (
                  <div
                    key={entry.date}
                    className="rounded-xl p-5 transition-all"
                    style={{
                      backgroundColor: "var(--bg-card)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <button
                        onClick={() => openEntry(entry.date)}
                        className="flex-1 text-left"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold"
                            style={{
                              backgroundColor: "rgba(45, 212, 191, 0.12)",
                              color: "#2dd4bf",
                            }}
                          >
                            {dayNum ? `D${dayNum}` : "—"}
                          </div>
                          <div>
                            <p className="font-semibold text-[var(--text-primary)]">
                              {formatDate(entry.date)}
                            </p>
                            <p className="text-xs text-[var(--text-muted)]">
                              {totalWords.toLocaleString()} words
                            </p>
                          </div>
                        </div>

                        {/* Stream previews */}
                        <div className="grid grid-cols-2 gap-4 mt-2">
                          {aboutKiran && (
                            <div className="flex items-start gap-2">
                              <User
                                size={14}
                                className="mt-0.5 flex-shrink-0"
                                style={{ color: "#fb923c" }}
                              />
                              <p className="text-sm text-[var(--text-secondary)] line-clamp-2">
                                {aboutKiran.preview}
                              </p>
                            </div>
                          )}
                          {buildJourney && (
                            <div className="flex items-start gap-2">
                              <Hammer
                                size={14}
                                className="mt-0.5 flex-shrink-0"
                                style={{ color: "#60a5fa" }}
                              />
                              <p className="text-sm text-[var(--text-secondary)] line-clamp-2">
                                {buildJourney.preview}
                              </p>
                            </div>
                          )}
                        </div>
                      </button>

                      <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEntryDeleteConfirm({ stream: "about-kiran", identifier: entry.date });
                          }}
                          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete entry"
                        >
                          <Trash2 size={14} />
                        </button>
                        <ChevronRight size={18} className="text-[var(--text-muted)]" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            </>
          )}
        </>
      )}

      {/* ─── ENTRY DETAIL VIEW ─────────────────────────────── */}
      {view === "entry" && (
        <>
          {detailLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
            </div>
          ) : entryDetail ? (
            <div className="grid grid-cols-2 gap-6">
              {/* About Kiran stream */}
              <StreamPanel
                streamKey="about-kiran"
                data={entryDetail.streams["about-kiran"]}
                icon={User}
                color="#fb923c"
                fallbackTitle="What I'm Learning About Kiran"
              />

              {/* Build Journey stream */}
              <StreamPanel
                streamKey="build-journey"
                data={entryDetail.streams["build-journey"]}
                icon={Hammer}
                color="#60a5fa"
                fallbackTitle="The Build Journey"
              />
            </div>
          ) : (
            <div className="text-center py-20 text-[var(--text-muted)]">
              <p>Entry not found.</p>
            </div>
          )}
        </>
      )}

      {/* ─── THREAD DETAIL VIEW ────────────────────────────── */}
      {view === "thread-detail" && (
        <>
          {threadDetailLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
            </div>
          ) : selectedThread ? (
            <div
              className="rounded-xl overflow-hidden"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                className="px-5 py-3 flex items-center justify-between"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-2">
                  <Link2 size={16} style={{ color: "#34d399" }} />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {selectedThread.title}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--text-muted)]">
                    {selectedThread.word_count.toLocaleString()} words
                    {selectedThread.date && ` · ${formatDate(selectedThread.date)}`}
                  </span>
                  <button
                    onClick={() => setEntryDeleteConfirm({ stream: "connecting-threads", identifier: selectedThread.slug })}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Delete thread"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div
                className="px-6 py-5 text-sm leading-relaxed text-[var(--text-secondary)]"
                style={{ maxHeight: "75vh", overflowY: "auto" }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedThread.content) }}
              />
            </div>
          ) : (
            <div className="text-center py-20 text-[var(--text-muted)]">
              <p>Thread not found.</p>
            </div>
          )}
        </>
      )}

      {/* ─── RAW OBSERVATIONS VIEW ─────────────────────────── */}
      {view === "raw" && (
        <>
          {/* Tab toggle */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setRawTab("kiran")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                rawTab === "kiran"
                  ? "bg-[#fb923c20] text-[#fb923c]"
                  : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <User size={16} />
              Kiran Observations
            </button>
            <button
              onClick={() => setRawTab("build")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                rawTab === "build"
                  ? "bg-[#60a5fa20] text-[#60a5fa]"
                  : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <Hammer size={16} />
              Build Observations
            </button>
          </div>

          {rawLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
            </div>
          ) : rawData ? (
            <div
              className="rounded-xl p-6 prose-custom"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                className="text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap font-mono"
                style={{ maxHeight: "70vh", overflowY: "auto" }}
              >
                {rawData[rawTab].content || "No observations yet."}
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* ─── SESSION ARCHIVE VIEW ──────────────────────────── */}
      {view === "sessions" && (
        <>
          {/* Archive stats */}
          {archiveStats && (
            <div className="grid grid-cols-3 gap-4 mb-8">
              <StatCard
                label="Sessions"
                value={archiveStats.total_sessions}
                icon={MessageSquare}
                color="#8b5cf6"
              />
              <StatCard
                label="Total Messages"
                value={archiveStats.total_messages.toLocaleString()}
                icon={Hash}
                color="#2dd4bf"
              />
              <StatCard
                label="Total Words"
                value={archiveStats.total_words.toLocaleString()}
                icon={FileText}
                color="#a78bfa"
              />
            </div>
          )}

          {sessionsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-20 text-[var(--text-muted)]">
              <MessageSquare size={40} className="mx-auto mb-3 opacity-40" />
              <p>No archived sessions yet.</p>
              <p className="text-xs mt-2">
                Use the session-capture skill in any Cowork session to archive conversations.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.filename}
                  className="rounded-xl p-5 transition-all"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="flex items-start justify-between">
                    <button
                      onClick={() => openSessionDetail(session.filename)}
                      className="flex-1 text-left"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: "rgba(139, 92, 246, 0.12)" }}
                        >
                          <MessageSquare size={16} style={{ color: "#8b5cf6" }} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-[var(--text-primary)] text-sm">
                              {session.title}
                            </p>
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
                              style={{
                                backgroundColor: session.session_type === "cowork" ? "rgba(45, 212, 191, 0.15)" : "rgba(251, 146, 60, 0.15)",
                                color: session.session_type === "cowork" ? "#2dd4bf" : "#fb923c",
                              }}
                            >
                              {session.session_type}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                            <span className="flex items-center gap-1">
                              <Clock size={11} />
                              {formatDateTime(session.session_start)}
                            </span>
                            <span>{session.message_count} messages</span>
                            <span>{session.total_words.toLocaleString()} words</span>
                          </div>
                        </div>
                      </div>
                      {session.preview && (
                        <p className="text-sm text-[var(--text-secondary)] line-clamp-2 ml-12">
                          {session.preview}
                        </p>
                      )}
                    </button>

                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm(session.filename);
                        }}
                        className="p-2 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete session"
                      >
                        <Trash2 size={15} />
                      </button>
                      <ChevronRight size={18} className="text-[var(--text-muted)]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── SESSION DETAIL VIEW ───────────────────────────── */}
      {view === "session-detail" && (
        <>
          {sessionDetailLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
            </div>
          ) : selectedSession ? (
            <div>
              {/* Session metadata */}
              <div
                className="rounded-xl p-5 mb-6"
                style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <div className="grid grid-cols-5 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Type</span>
                    <p className="mt-1">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider"
                        style={{
                          backgroundColor: selectedSession.session_type === "cowork" ? "rgba(45, 212, 191, 0.15)" : "rgba(251, 146, 60, 0.15)",
                          color: selectedSession.session_type === "cowork" ? "#2dd4bf" : "#fb923c",
                        }}
                      >
                        {selectedSession.session_type}
                      </span>
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Started</span>
                    <p className="text-[var(--text-primary)] mt-1">{formatDateTime(selectedSession.session_start)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Ended</span>
                    <p className="text-[var(--text-primary)] mt-1">{formatDateTime(selectedSession.session_end)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Messages</span>
                    <p className="text-[var(--text-primary)] mt-1">
                      {selectedSession.user_messages} from Kiran, {selectedSession.assistant_messages} from Claude
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Words</span>
                    <p className="text-[var(--text-primary)] mt-1">{selectedSession.total_words.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Transcript */}
              <div
                className="rounded-xl overflow-hidden"
                style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <div
                  className="px-5 py-3 flex items-center gap-2"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <MessageSquare size={16} style={{ color: "#8b5cf6" }} />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    Full Transcript
                  </span>
                </div>
                <div
                  className="px-6 py-5 text-sm leading-relaxed text-[var(--text-secondary)]"
                  style={{ maxHeight: "70vh", overflowY: "auto" }}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedSession.content) }}
                />
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-[var(--text-muted)]">
              <p>Session not found.</p>
            </div>
          )}
        </>
      )}

      {/* ─── SEARCH RESULTS VIEW ─────────────────────────────── */}
      {view === "search" && (
        <>
          {searchLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
            </div>
          ) : searchResults ? (
            <>
              {/* Results count */}
              <div className="mb-6 text-sm text-[var(--text-muted)]">
                {searchResults.total === 0
                  ? "No results found"
                  : `${searchResults.total} result${searchResults.total !== 1 ? "s" : ""} found`}
              </div>

              {searchResults.results.length === 0 ? (
                <div className="text-center py-20 text-[var(--text-muted)]">
                  <Search size={40} className="mx-auto mb-3 opacity-40" />
                  <p>No matches for &ldquo;{searchResults.query}&rdquo;</p>
                  <p className="text-xs mt-2">Try different keywords or shorter search terms.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {searchResults.results.map((result, idx) => {
                    const isJournal = result.source_type === "journal";
                    const iconColor = isJournal
                      ? result.stream === "about-kiran"
                        ? "#fb923c"
                        : "#60a5fa"
                      : "#8b5cf6";
                    const Icon = isJournal
                      ? result.stream === "about-kiran"
                        ? User
                        : Hammer
                      : MessageSquare;
                    const typeLabel = isJournal
                      ? result.stream_title || "Journal"
                      : "Session";

                    return (
                      <button
                        key={`${result.source_type}-${result.date}-${result.stream}-${idx}`}
                        onClick={() => openSearchResult(result)}
                        className="w-full text-left rounded-xl p-5 transition-all hover:scale-[1.003]"
                        style={{
                          backgroundColor: "var(--bg-card)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: `${iconColor}20` }}
                          >
                            <Icon size={16} style={{ color: iconColor }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-sm text-[var(--text-primary)] truncate">
                                {result.title}
                              </p>
                              <span
                                className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider flex-shrink-0"
                                style={{
                                  backgroundColor: `${iconColor}20`,
                                  color: iconColor,
                                }}
                              >
                                {typeLabel}
                              </span>
                              {result.session_type && (
                                <span
                                  className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider flex-shrink-0"
                                  style={{
                                    backgroundColor: result.session_type === "cowork" ? "rgba(45, 212, 191, 0.15)" : "rgba(251, 146, 60, 0.15)",
                                    color: result.session_type === "cowork" ? "#2dd4bf" : "#fb923c",
                                  }}
                                >
                                  {result.session_type}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mb-2">
                              {result.date && <span>{result.date}</span>}
                              <span>{result.word_count.toLocaleString()} words</span>
                            </div>
                            {/* Snippets */}
                            {result.snippets.map((snippet, si) => (
                              <p
                                key={si}
                                className="text-sm text-[var(--text-secondary)] leading-relaxed mb-1 line-clamp-2"
                                dangerouslySetInnerHTML={{
                                  __html: highlightTerms(snippet, searchResults.query),
                                }}
                              />
                            ))}
                          </div>
                          <ChevronRight size={16} className="text-[var(--text-muted)] flex-shrink-0 mt-2" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : null}
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

// ── Stream Panel (side-by-side reading) ──────────────────────
function StreamPanel({
  streamKey,
  data,
  icon: Icon,
  color,
  fallbackTitle,
}: {
  streamKey: string;
  data?: StreamContent;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  fallbackTitle: string;
}) {
  if (!data) {
    return (
      <div
        className="rounded-xl p-6 flex items-center justify-center"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border)",
          minHeight: "300px",
        }}
      >
        <div className="text-center text-[var(--text-muted)]">
          <Icon size={28} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No entry for this stream</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Stream header */}
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <Icon size={16} style={{ color }} />
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {data.title}
          </span>
        </div>
        <span className="text-xs text-[var(--text-muted)]">
          {data.word_count.toLocaleString()} words
          {data.day_number && ` · Day ${data.day_number}`}
        </span>
      </div>

      {/* Content */}
      <div
        className="px-6 py-5 text-sm leading-relaxed text-[var(--text-secondary)]"
        style={{ maxHeight: "75vh", overflowY: "auto" }}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(data.content) }}
      />
    </div>
  );
}
