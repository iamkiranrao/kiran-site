"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BookHeart,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  Clock,
  Trash2,
  Edit3,
  Search,
  Filter,
  Sparkles,
  HelpCircle,
  Brain,
  Target,
  Palette,
  Code2,
  Lightbulb,
  AlertCircle,
  MessageSquare,
  CheckCircle2,
  FileText,
} from "lucide-react";
import ModuleHelp from "@/components/ModuleHelp";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ── Types ──────────────────────────────────────────────── */

interface JournalEntry {
  id: string;
  title: string;
  body: string;
  category: string;
  tags: string[];
  workstreams: string[];
  source_session: string | null;
  source_file: string | null;
  decision: string | null;
  alternatives_considered: string | null;
  open_questions: string | null;
  status: string;
  resolution: string | null;
  created_at: string;
  updated_at: string;
}

/* ── Constants ──────────────────────────────────────────── */

const CATEGORIES = [
  { value: "principle",          label: "Principle",          color: "#d4a74a", Icon: Sparkles },
  { value: "architecture",      label: "Architecture",       color: "#a78bfa", Icon: Code2 },
  { value: "product-philosophy", label: "Product Philosophy", color: "#fb923c", Icon: Target },
  { value: "brand-identity",    label: "Brand Identity",     color: "#f472b6", Icon: Palette },
  { value: "career-strategy",   label: "Career Strategy",    color: "#3b82f6", Icon: Brain },
  { value: "content-strategy",  label: "Content Strategy",   color: "#34d399", Icon: MessageSquare },
  { value: "apprehension",      label: "Apprehension",       color: "#f87171", Icon: AlertCircle },
  { value: "idea",              label: "Idea",               color: "#fbbf24", Icon: Lightbulb },
  { value: "general",           label: "General",            color: "#94a3b8", Icon: BookHeart },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active:     { label: "Active",     color: "#34d399", bg: "rgba(52,211,153,0.12)" },
  resolved:   { label: "Resolved",   color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
  superseded: { label: "Superseded", color: "#fb923c", bg: "rgba(251,147,60,0.12)" },
  revisit:    { label: "Revisit",    color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
};

/* ── Component ──────────────────────────────────────────── */

export default function KiransJournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [principles, setPrinciples] = useState<JournalEntry[]>([]);
  const [openQuestions, setOpenQuestions] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  // View mode
  const [view, setView] = useState<"all" | "principles" | "open">("all");

  // Source transcript viewer
  const [sourceContent, setSourceContent] = useState<string | null>(null);
  const [sourceTitle, setSourceTitle] = useState("");
  const [loadingSource, setLoadingSource] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formCategory, setFormCategory] = useState("general");
  const [formTags, setFormTags] = useState("");
  const [formWorkstreams, setFormWorkstreams] = useState("");
  const [formDecision, setFormDecision] = useState("");
  const [formAlternatives, setFormAlternatives] = useState("");
  const [formOpenQuestions, setFormOpenQuestions] = useState("");

  const fetchEntries = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterCategory) params.set("category", filterCategory);
      if (filterStatus) params.set("status", filterStatus);
      if (searchText.trim()) params.set("search", searchText.trim());
      params.set("limit", "200");
      const res = await fetch(`${API}/api/kirans-journal/?${params}`);
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (e) {
      console.error("Failed to fetch journal entries:", e);
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterStatus, searchText]);

  const fetchPrinciples = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/kirans-journal/principles`);
      const data = await res.json();
      setPrinciples(data.principles || []);
    } catch (e) {
      console.error("Failed to fetch principles:", e);
    }
  }, []);

  const fetchOpenQuestions = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/kirans-journal/open-questions`);
      const data = await res.json();
      setOpenQuestions(data.open_questions || []);
    } catch (e) {
      console.error("Failed to fetch open questions:", e);
    }
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);
  useEffect(() => { fetchPrinciples(); fetchOpenQuestions(); }, [fetchPrinciples, fetchOpenQuestions]);

  const resetForm = () => {
    setFormTitle(""); setFormBody(""); setFormCategory("general");
    setFormTags(""); setFormWorkstreams(""); setFormDecision("");
    setFormAlternatives(""); setFormOpenQuestions("");
    setEditingId(null); setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!formTitle.trim() || !formBody.trim()) return;
    const payload: any = {
      title: formTitle.trim(),
      body: formBody.trim(),
      category: formCategory,
      tags: formTags.split(",").map(t => t.trim()).filter(Boolean),
      workstreams: formWorkstreams.split(",").map(t => t.trim()).filter(Boolean),
    };
    if (formDecision.trim()) payload.decision = formDecision.trim();
    if (formAlternatives.trim()) payload.alternatives_considered = formAlternatives.trim();
    if (formOpenQuestions.trim()) payload.open_questions = formOpenQuestions.trim();

    if (editingId) {
      await fetch(`${API}/api/kirans-journal/${editingId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch(`${API}/api/kirans-journal/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    resetForm();
    fetchEntries();
    fetchPrinciples();
    fetchOpenQuestions();
  };

  const handleEdit = (entry: JournalEntry) => {
    setFormTitle(entry.title);
    setFormBody(entry.body);
    setFormCategory(entry.category);
    setFormTags(entry.tags.join(", "));
    setFormWorkstreams(entry.workstreams.join(", "));
    setFormDecision(entry.decision || "");
    setFormAlternatives(entry.alternatives_considered || "");
    setFormOpenQuestions(entry.open_questions || "");
    setEditingId(entry.id);
    setShowForm(true);
  };

  const handleStatusChange = async (id: string, status: string) => {
    await fetch(`${API}/api/kirans-journal/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchEntries();
    fetchPrinciples();
    fetchOpenQuestions();
  };

  const handleDelete = async (id: string) => {
    await fetch(`${API}/api/kirans-journal/${id}`, { method: "DELETE" });
    fetchEntries();
    fetchPrinciples();
    fetchOpenQuestions();
  };

  const viewSource = async (filename: string) => {
    setLoadingSource(true);
    setSourceTitle(filename.replace(/^\d{4}-\d{2}-\d{2}-\d{6}-/, "").replace(/-/g, " ").replace(/\.md$/, ""));
    try {
      const res = await fetch(`${API}/api/kirans-journal/source/${encodeURIComponent(filename)}`);
      if (!res.ok) throw new Error("Not found");
      const text = await res.text();
      setSourceContent(text);
    } catch {
      setSourceContent("*Source transcript not available.*");
    } finally {
      setLoadingSource(false);
    }
  };

  const catConfig = (cat: string) =>
    CATEGORIES.find(c => c.value === cat) || CATEGORIES[CATEGORIES.length - 1];

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  /* ── Which entries to show ──────────────────────────── */
  const displayEntries = view === "principles" ? principles : view === "open" ? openQuestions : entries;

  /* ── Entry card ─────────────────────────────────────── */
  const renderEntry = (entry: JournalEntry) => {
    const cc = catConfig(entry.category);
    const CatIcon = cc.Icon;
    const sc = STATUS_CONFIG[entry.status] || STATUS_CONFIG.active;
    const isExpanded = expandedId === entry.id;

    return (
      <div
        key={entry.id}
        className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden transition-all hover:border-[var(--text-muted)]"
      >
        {/* Row */}
        <div
          className="flex items-center gap-3 px-4 py-3 cursor-pointer"
          onClick={() => setExpandedId(isExpanded ? null : entry.id)}
        >
          {isExpanded
            ? <ChevronDown size={14} className="text-[var(--text-muted)] shrink-0" />
            : <ChevronRight size={14} className="text-[var(--text-muted)] shrink-0" />
          }

          <CatIcon size={16} style={{ color: cc.color }} className="shrink-0" />

          <span className="text-sm text-[var(--text-primary)] font-medium flex-1 truncate">
            {entry.title}
          </span>

          {/* Category badge */}
          <span className="text-xs px-2 py-0.5 rounded-full shrink-0"
                style={{ color: cc.color, backgroundColor: `${cc.color}18` }}>
            {cc.label}
          </span>

          {/* Status */}
          {entry.status !== "active" && (
            <span className="px-2 py-0.5 rounded-full text-xs shrink-0"
              style={{ color: sc.color, backgroundColor: sc.bg }}>
              {sc.label}
            </span>
          )}

          {/* Date */}
          <span className="text-xs text-[var(--text-muted)] shrink-0">
            {formatDate(entry.created_at)}
          </span>
        </div>

        {/* Expanded detail */}
        {isExpanded && (
          <div className="px-4 pb-4 pt-1 border-t border-[var(--border)] space-y-3">
            {/* Body */}
            <div className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
              {entry.body}
            </div>

            {/* Decision */}
            {entry.decision && (
              <div className="p-3 rounded-lg bg-[rgba(212,167,74,0.08)] border border-[rgba(212,167,74,0.2)]">
                <div className="text-xs font-medium text-[#d4a74a] mb-1">Decision</div>
                <div className="text-sm text-[var(--text-primary)]">{entry.decision}</div>
              </div>
            )}

            {/* Alternatives */}
            {entry.alternatives_considered && (
              <div className="text-sm text-[var(--text-muted)]">
                <span className="font-medium">Alternatives considered:</span> {entry.alternatives_considered}
              </div>
            )}

            {/* Open questions */}
            {entry.open_questions && (
              <div className="p-3 rounded-lg bg-[rgba(251,191,36,0.08)] border border-[rgba(251,191,36,0.2)]">
                <div className="text-xs font-medium text-[#fbbf24] mb-1 flex items-center gap-1">
                  <HelpCircle size={12} /> Open Questions
                </div>
                <div className="text-sm text-[var(--text-secondary)]">{entry.open_questions}</div>
              </div>
            )}

            {/* Resolution */}
            {entry.resolution && (
              <div className="p-3 rounded-lg bg-[rgba(52,211,153,0.08)] border border-[rgba(52,211,153,0.2)]">
                <div className="text-xs font-medium text-[#34d399] mb-1 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Resolution
                </div>
                <div className="text-sm text-[var(--text-secondary)]">{entry.resolution}</div>
              </div>
            )}

            {/* Tags + Workstreams */}
            <div className="flex gap-1.5 flex-wrap">
              {entry.workstreams.map(ws => (
                <span key={ws} className="text-xs px-2 py-0.5 rounded-full bg-[rgba(96,165,250,0.12)] text-[#60a5fa]">
                  {ws}
                </span>
              ))}
              {entry.tags.map(tag => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-primary)] text-[var(--text-muted)]">
                  {tag}
                </span>
              ))}
            </div>

            {/* Meta */}
            <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1">
                <Clock size={12} /> {formatDate(entry.created_at)}
              </span>
              {entry.source_file && (
                <button
                  onClick={(e) => { e.stopPropagation(); viewSource(entry.source_file!); }}
                  className="flex items-center gap-1 text-[#60a5fa] hover:text-[#93bbfd] transition-colors"
                >
                  <FileText size={12} /> View source conversation
                </button>
              )}
              {!entry.source_file && entry.source_session && (
                <span>From: {entry.source_session}</span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              {entry.status === "active" && (
                <button onClick={() => handleStatusChange(entry.id, "resolved")}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[#34d399] hover:bg-[rgba(52,211,153,0.08)]">
                  <CheckCircle2 size={12} /> Resolve
                </button>
              )}
              {entry.status !== "revisit" && (
                <button onClick={() => handleStatusChange(entry.id, "revisit")}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[#fbbf24] hover:bg-[rgba(251,191,36,0.08)]">
                  Revisit
                </button>
              )}
              {entry.status !== "active" && (
                <button onClick={() => handleStatusChange(entry.id, "active")}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-primary)]">
                  Reactivate
                </button>
              )}
              <div className="flex-1" />
              <button onClick={() => handleEdit(entry)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <Edit3 size={12} /> Edit
              </button>
              <button onClick={() => handleDelete(entry.id)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[#f87171]">
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookHeart size={24} className="text-[#d4a74a]" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-[var(--text-primary)]">Kiran&apos;s Journal</h1>
              <ModuleHelp moduleSlug="kirans-journal" />
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              Strategic thinking, decisions, principles, and ideas
            </p>
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#d4a74a] text-[#0a0a0a] rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={16} /> New Entry
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setView("all")}
          className={`px-4 py-3 rounded-xl border text-left transition-all ${
            view === "all"
              ? "border-[#d4a74a] bg-[rgba(212,167,74,0.08)]"
              : "border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--text-muted)]"
          }`}
        >
          <div className="text-2xl font-bold text-[var(--text-primary)]">{entries.length}</div>
          <div className="text-xs text-[var(--text-muted)]">All Entries</div>
        </button>
        <button
          onClick={() => setView("principles")}
          className={`px-4 py-3 rounded-xl border text-left transition-all ${
            view === "principles"
              ? "border-[#d4a74a] bg-[rgba(212,167,74,0.08)]"
              : "border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--text-muted)]"
          }`}
        >
          <div className="text-2xl font-bold text-[#d4a74a]">{principles.length}</div>
          <div className="text-xs text-[var(--text-muted)]">Principles</div>
        </button>
        <button
          onClick={() => setView("open")}
          className={`px-4 py-3 rounded-xl border text-left transition-all ${
            view === "open"
              ? "border-[#fbbf24] bg-[rgba(251,191,36,0.08)]"
              : "border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--text-muted)]"
          }`}
        >
          <div className="text-2xl font-bold text-[#fbbf24]">{openQuestions.length}</div>
          <div className="text-xs text-[var(--text-muted)]">Open Questions</div>
        </button>
      </div>

      {/* Search + Filters (only in "all" view) */}
      {view === "all" && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="Search entries..."
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
          </div>
          <Filter size={14} className="text-[var(--text-muted)]" />
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)]"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)]"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
            <option value="superseded">Superseded</option>
            <option value="revisit">Revisit</option>
          </select>
          <span className="text-xs text-[var(--text-muted)] ml-auto">
            {entries.length} entr{entries.length !== 1 ? "ies" : "y"}
          </span>
        </div>
      )}

      {/* Add / Edit Form */}
      {showForm && (
        <div className="p-5 rounded-xl border border-[#d4a74a] bg-[var(--bg-secondary)] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">
              {editingId ? "Edit Entry" : "New Journal Entry"}
            </h3>
            <button onClick={resetForm} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <X size={16} />
            </button>
          </div>

          <input
            value={formTitle}
            onChange={e => setFormTitle(e.target.value)}
            placeholder="Entry title — the core idea or decision"
            className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
          />
          <textarea
            value={formBody}
            onChange={e => setFormBody(e.target.value)}
            placeholder="The full thinking — what was decided, why, what it means, the reasoning..."
            rows={5}
            className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <select value={formCategory} onChange={e => setFormCategory(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)]">
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <input
              value={formWorkstreams}
              onChange={e => setFormWorkstreams(e.target.value)}
              placeholder="Workstreams (comma sep)"
              className="px-3 py-2 text-sm rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
            <input
              value={formTags}
              onChange={e => setFormTags(e.target.value)}
              placeholder="Tags (comma sep)"
              className="px-3 py-2 text-sm rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
          </div>
          <input
            value={formDecision}
            onChange={e => setFormDecision(e.target.value)}
            placeholder="Decision summary (1-2 sentences, optional)"
            className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              value={formAlternatives}
              onChange={e => setFormAlternatives(e.target.value)}
              placeholder="Alternatives considered (optional)"
              className="px-3 py-2 text-sm rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
            <input
              value={formOpenQuestions}
              onChange={e => setFormOpenQuestions(e.target.value)}
              placeholder="Open questions / tensions (optional)"
              className="px-3 py-2 text-sm rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={resetForm}
              className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]">
              Cancel
            </button>
            <button onClick={handleSubmit}
              className="px-4 py-2 text-sm rounded-lg bg-[#d4a74a] text-[#0a0a0a] font-medium hover:opacity-90">
              {editingId ? "Save Changes" : "Add Entry"}
            </button>
          </div>
        </div>
      )}

      {/* Entries */}
      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading journal entries...</p>
      ) : displayEntries.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <BookHeart size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {view === "principles"
              ? "No principles captured yet."
              : view === "open"
              ? "No open questions right now."
              : "No journal entries yet. Start capturing your thinking."
            }
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {view !== "all" && (
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              {view === "principles" ? `Crystallized Principles (${principles.length})` : `Open Questions & Apprehensions (${openQuestions.length})`}
            </h2>
          )}
          {displayEntries.map(renderEntry)}
        </div>
      )}

      {/* Source Transcript Modal */}
      {sourceContent !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
             onClick={() => setSourceContent(null)}>
          <div
            className="relative w-full max-w-3xl max-h-[80vh] mx-4 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)] shrink-0">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-[#60a5fa]" />
                <h3 className="text-sm font-medium text-[var(--text-primary)] capitalize">{sourceTitle}</h3>
              </div>
              <button
                onClick={() => setSourceContent(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X size={18} />
              </button>
            </div>
            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-5">
              {loadingSource ? (
                <p className="text-sm text-[var(--text-muted)]">Loading transcript...</p>
              ) : (
                <pre className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap font-[inherit]">
                  {sourceContent}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
