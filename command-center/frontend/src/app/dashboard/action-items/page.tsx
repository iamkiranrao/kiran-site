"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckSquare,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  Clock,
  Trash2,
  Edit3,
  Check,
  Filter,
  AlertTriangle,
  ArrowUpCircle,
  ArrowRightCircle,
  ArrowDownCircle,
  Zap,
  Ban,
  Calendar,
  Tag,
  Search,
  BarChart3,
} from "lucide-react";
import ModuleHelp from "@/components/ModuleHelp";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ── Types ──────────────────────────────────────────────── */

interface ActionItem {
  id: string;
  title: string;
  description: string;
  workstream: string;
  priority: string;
  status: string;
  source: string;
  due_date: string | null;
  tags: string[];
  blocked_by: string | null;
  owner: string;
  completed_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

interface Summary {
  total: number;
  open: number;
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
  overdue: number;
}

/* ── Constants ──────────────────────────────────────────── */

const WORKSTREAMS = [
  { value: "persona-picker", label: "Persona Picker", color: "#fb923c" },
  { value: "scannibal", label: "Scannibal", color: "#67e8f9" },
  { value: "dia-fund", label: "DIA Fund", color: "#f472b6" },
  { value: "fenix", label: "Fenix", color: "#fb923c" },
  { value: "command-center", label: "Command Center", color: "#a78bfa" },
  { value: "site-homepage", label: "Site Homepage", color: "#34d399" },
  { value: "site-teardowns", label: "Site Teardowns", color: "#fbbf24" },
  { value: "site-blog", label: "Site Blog", color: "#60a5fa" },
  { value: "site-madlab", label: "Site MadLab", color: "#67e8f9" },
  { value: "site-career", label: "Site Career", color: "#3b82f6" },
  { value: "site-studio", label: "Site Studio", color: "#8b5cf6" },
  { value: "site-support", label: "Site Support", color: "#94a3b8" },
  { value: "resume-pipeline", label: "Resume Pipeline", color: "#60a5fa" },
  { value: "wordweaver", label: "WordWeaver", color: "#34d399" },
  { value: "fenix-journal", label: "Fenix Journal", color: "#2dd4bf" },
  { value: "fenix-training", label: "Fenix Training", color: "#fb923c" },
  { value: "platform-migration", label: "Platform Migration", color: "#a78bfa" },
  { value: "infrastructure", label: "Infrastructure", color: "#818cf8" },
  { value: "cross-cutting", label: "Cross-Cutting", color: "#94a3b8" },
];

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: typeof ArrowUpCircle }> = {
  critical: { label: "Critical", color: "#f87171", bg: "rgba(248,113,113,0.15)", Icon: AlertTriangle },
  high:     { label: "High",     color: "#fb923c", bg: "rgba(251,147,60,0.12)",  Icon: ArrowUpCircle },
  medium:   { label: "Medium",   color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  Icon: ArrowRightCircle },
  low:      { label: "Low",      color: "#60a5fa", bg: "rgba(96,165,250,0.12)",  Icon: ArrowDownCircle },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  todo:          { label: "Todo",        color: "var(--text-muted)",  bg: "var(--bg-secondary)" },
  "in-progress": { label: "In Progress", color: "#60a5fa",           bg: "rgba(96,165,250,0.12)" },
  blocked:       { label: "Blocked",     color: "#f87171",           bg: "rgba(248,113,113,0.12)" },
  done:          { label: "Done",        color: "#34d399",           bg: "rgba(52,211,153,0.12)" },
  "wont-do":     { label: "Won't Do",   color: "#94a3b8",           bg: "rgba(148,163,184,0.12)" },
};

const OWNER_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  kiran:  { label: "Kiran",  color: "#fb923c", bg: "rgba(251,147,60,0.12)" },
  claude: { label: "Claude", color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  joint:  { label: "Joint",  color: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
};

/* ── Component ──────────────────────────────────────────── */

export default function ActionItemsPage() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");

  // Filters
  const [filterWorkstream, setFilterWorkstream] = useState<string>("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterOwner, setFilterOwner] = useState<string>("");

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formWorkstream, setFormWorkstream] = useState("cross-cutting");
  const [formPriority, setFormPriority] = useState("medium");
  const [formDueDate, setFormDueDate] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formBlockedBy, setFormBlockedBy] = useState("");
  const [formSource, setFormSource] = useState("");
  const [formOwner, setFormOwner] = useState("");

  // Tab: "active" vs "completed"
  const [tab, setTab] = useState<"active" | "completed">("active");

  const fetchItems = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterWorkstream) params.set("workstream", filterWorkstream);
      if (filterPriority) params.set("priority", filterPriority);
      if (filterStatus) params.set("status", filterStatus);
      if (filterOwner) params.set("owner", filterOwner);
      if (searchText.trim()) params.set("search", searchText.trim());
      if (tab === "completed") {
        params.set("include_done", "true");
        params.set("status", "done");
      }
      params.set("limit", "500");
      const res = await fetch(`${API}/api/action-items/?${params}`);
      const data = await res.json();
      setItems(data.items || []);
    } catch (e) {
      console.error("Failed to fetch action items:", e);
    } finally {
      setLoading(false);
    }
  }, [filterWorkstream, filterPriority, filterStatus, filterOwner, searchText, tab]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/action-items/summary`);
      const data = await res.json();
      setSummary(data);
    } catch (e) {
      console.error("Failed to fetch summary:", e);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const resetForm = () => {
    setFormTitle(""); setFormDesc(""); setFormWorkstream("cross-cutting");
    setFormPriority("medium"); setFormDueDate(""); setFormTags("");
    setFormBlockedBy(""); setFormSource(""); setFormOwner("");
    setEditingId(null); setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!formTitle.trim()) return;
    const payload: any = {
      title: formTitle.trim(),
      description: formDesc.trim(),
      workstream: formWorkstream,
      priority: formPriority,
      source: formSource.trim(),
      owner: formOwner,
      tags: formTags.split(",").map(t => t.trim()).filter(Boolean),
    };
    if (formDueDate) payload.due_date = formDueDate;
    if (formBlockedBy.trim()) payload.blocked_by = formBlockedBy.trim();

    if (editingId) {
      await fetch(`${API}/api/action-items/${editingId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch(`${API}/api/action-items/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    resetForm();
    fetchItems();
    fetchSummary();
  };

  const handleEdit = (item: ActionItem) => {
    setFormTitle(item.title);
    setFormDesc(item.description);
    setFormWorkstream(item.workstream);
    setFormPriority(item.priority);
    setFormDueDate(item.due_date || "");
    setFormTags(item.tags.join(", "));
    setFormBlockedBy(item.blocked_by || "");
    setFormSource(item.source);
    setFormOwner(item.owner || "");
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleQuickComplete = async (id: string) => {
    await fetch(`${API}/api/action-items/${id}/complete`, { method: "PUT" });
    fetchItems();
    fetchSummary();
  };

  const handleStatusChange = async (id: string, status: string) => {
    await fetch(`${API}/api/action-items/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchItems();
    fetchSummary();
  };

  const handleDelete = async (id: string) => {
    await fetch(`${API}/api/action-items/${id}`, { method: "DELETE" });
    fetchItems();
    fetchSummary();
  };

  const wsColor = (ws: string) =>
    WORKSTREAMS.find(w => w.value === ws)?.color || "#94a3b8";
  const wsLabel = (ws: string) =>
    WORKSTREAMS.find(w => w.value === ws)?.label || ws;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const isOverdue = (item: ActionItem) => {
    if (!item.due_date || item.status === "done" || item.status === "wont-do") return false;
    return item.due_date < new Date().toISOString().slice(0, 10);
  };

  /* ── Group items by priority ──────────────────────────── */
  const priorityOrder = ["critical", "high", "medium", "low"];
  const grouped = priorityOrder.reduce((acc, p) => {
    acc[p] = items.filter(i => i.priority === p);
    return acc;
  }, {} as Record<string, ActionItem[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckSquare size={24} className="text-[var(--accent-green)]" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-[var(--text-primary)]">Action Items</h1>
              <ModuleHelp moduleSlug="action-items" />
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              Unified task tracker across all workstreams
            </p>
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-green)] text-[#0a0a0a] rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={16} /> Add Item
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
            <div className="text-2xl font-bold text-[var(--text-primary)]">{summary.open}</div>
            <div className="text-xs text-[var(--text-muted)]">Open Items</div>
          </div>
          <div className="px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
            <div className="text-2xl font-bold text-[#f87171]">{summary.by_priority?.critical || 0}</div>
            <div className="text-xs text-[var(--text-muted)]">Critical</div>
          </div>
          <div className="px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
            <div className="text-2xl font-bold text-[#fb923c]">{summary.by_priority?.high || 0}</div>
            <div className="text-xs text-[var(--text-muted)]">High</div>
          </div>
          {summary.overdue > 0 && (
            <div className="px-4 py-3 rounded-xl border border-[#f87171] bg-[rgba(248,113,113,0.08)]">
              <div className="text-2xl font-bold text-[#f87171]">{summary.overdue}</div>
              <div className="text-xs text-[#f87171]">Overdue</div>
            </div>
          )}
          <div className="px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
            <div className="text-2xl font-bold text-[#34d399]">{summary.by_status?.done || 0}</div>
            <div className="text-xs text-[var(--text-muted)]">Completed</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--border)]">
        <button
          onClick={() => setTab("active")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "active"
              ? "border-[var(--accent-green)] text-[var(--text-primary)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          Active
        </button>
        <button
          onClick={() => setTab("completed")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "completed"
              ? "border-[#34d399] text-[var(--text-primary)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          Completed
        </button>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Search items..."
            className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
          />
        </div>
        <Filter size={14} className="text-[var(--text-muted)]" />
        <select
          value={filterWorkstream}
          onChange={e => setFilterWorkstream(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)]"
        >
          <option value="">All Workstreams</option>
          {WORKSTREAMS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
        </select>
        <select
          value={filterPriority}
          onChange={e => setFilterPriority(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)]"
        >
          <option value="">All Priorities</option>
          {priorityOrder.map(p => <option key={p} value={p}>{PRIORITY_CONFIG[p]?.label || p}</option>)}
        </select>
        {tab === "active" && (
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)]"
          >
            <option value="">All Statuses</option>
            <option value="todo">Todo</option>
            <option value="in-progress">In Progress</option>
            <option value="blocked">Blocked</option>
          </select>
        )}
        <select
          value={filterOwner}
          onChange={e => setFilterOwner(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)]"
        >
          <option value="">All Owners</option>
          <option value="kiran">Kiran</option>
          <option value="claude">Claude</option>
          <option value="joint">Joint</option>
        </select>
        <span className="text-xs text-[var(--text-muted)] ml-auto">
          {items.length} item{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="p-5 rounded-xl border border-[var(--accent-green)] bg-[var(--bg-secondary)] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">
              {editingId ? "Edit Action Item" : "New Action Item"}
            </h3>
            <button onClick={resetForm} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <X size={16} />
            </button>
          </div>

          <input
            value={formTitle}
            onChange={e => setFormTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
          />
          <textarea
            value={formDesc}
            onChange={e => setFormDesc(e.target.value)}
            placeholder="Details, context, acceptance criteria..."
            rows={2}
            className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none"
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <select value={formWorkstream} onChange={e => setFormWorkstream(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)]">
              {WORKSTREAMS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
            <select value={formPriority} onChange={e => setFormPriority(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)]">
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <input
              type="date"
              value={formDueDate}
              onChange={e => setFormDueDate(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)]"
            />
            <input
              value={formTags}
              onChange={e => setFormTags(e.target.value)}
              placeholder="Tags (comma sep)"
              className="px-3 py-2 text-sm rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <input
              value={formSource}
              onChange={e => setFormSource(e.target.value)}
              placeholder="Source (e.g. session filename, manual)"
              className="px-3 py-2 text-sm rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
            <input
              value={formBlockedBy}
              onChange={e => setFormBlockedBy(e.target.value)}
              placeholder="Blocked by... (optional)"
              className="px-3 py-2 text-sm rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
            <select value={formOwner} onChange={e => setFormOwner(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)]">
              <option value="">No Owner</option>
              <option value="kiran">Kiran</option>
              <option value="claude">Claude</option>
              <option value="joint">Joint</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={resetForm}
              className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]">
              Cancel
            </button>
            <button onClick={handleSubmit}
              className="px-4 py-2 text-sm rounded-lg bg-[var(--accent-green)] text-[#0a0a0a] font-medium hover:opacity-90">
              {editingId ? "Save Changes" : "Add Item"}
            </button>
          </div>
        </div>
      )}

      {/* Items grouped by priority */}
      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading action items...</p>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <CheckSquare size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {tab === "completed" ? "No completed items yet." : "No open action items. Nice work!"}
          </p>
        </div>
      ) : tab === "completed" ? (
        /* Flat list for completed items */
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
              <Check size={16} className="text-[#34d399] shrink-0" />
              <span className="text-sm text-[var(--text-secondary)] line-through flex-1 truncate">{item.title}</span>
              <span className="text-xs px-2 py-0.5 rounded-full shrink-0"
                style={{ color: wsColor(item.workstream), backgroundColor: `${wsColor(item.workstream)}18` }}>
                {wsLabel(item.workstream)}
              </span>
              {item.completed_at && (
                <span className="text-xs text-[var(--text-muted)]">{formatDate(item.completed_at)}</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Grouped by priority for active items */
        priorityOrder.map(priority => {
          const group = grouped[priority];
          if (!group || group.length === 0) return null;
          const pc = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
          const PIcon = pc.Icon;

          return (
            <div key={priority} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2"
                  style={{ color: pc.color }}>
                <PIcon size={14} />
                {pc.label} ({group.length})
              </h2>

              <div className="space-y-2">
                {group.map(item => {
                  const isExpanded = expandedId === item.id;
                  const overdue = isOverdue(item);
                  const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.todo;

                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border bg-[var(--bg-secondary)] overflow-hidden transition-all hover:border-[var(--text-muted)] ${
                        overdue ? "border-[#f87171]" : "border-[var(--border)]"
                      }`}
                    >
                      {/* Row */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        {/* Quick complete */}
                        <button
                          onClick={() => handleQuickComplete(item.id)}
                          className="w-5 h-5 rounded border border-[var(--border)] flex items-center justify-center shrink-0 hover:border-[#34d399] hover:bg-[rgba(52,211,153,0.08)] transition-colors"
                          title="Mark complete"
                        >
                          <Check size={12} className="text-transparent hover:text-[#34d399]" />
                        </button>

                        {/* Expand toggle */}
                        <button onClick={() => setExpandedId(isExpanded ? null : item.id)} className="shrink-0">
                          {isExpanded
                            ? <ChevronDown size={14} className="text-[var(--text-muted)]" />
                            : <ChevronRight size={14} className="text-[var(--text-muted)]" />
                          }
                        </button>

                        {/* Title */}
                        <span
                          className="text-sm text-[var(--text-primary)] font-medium flex-1 truncate cursor-pointer"
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        >
                          {item.title}
                        </span>

                        {/* Overdue badge */}
                        {overdue && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-[#f87171] bg-[rgba(248,113,113,0.12)] shrink-0">
                            <AlertTriangle size={10} /> Overdue
                          </span>
                        )}

                        {/* Status badge */}
                        {item.status !== "todo" && (
                          <span className="px-2 py-0.5 rounded-full text-xs shrink-0"
                            style={{ color: sc.color, backgroundColor: sc.bg }}>
                            {sc.label}
                          </span>
                        )}

                        {/* Due date */}
                        {item.due_date && (
                          <span className={`flex items-center gap-1 text-xs shrink-0 ${overdue ? "text-[#f87171]" : "text-[var(--text-muted)]"}`}>
                            <Calendar size={10} /> {formatDate(item.due_date)}
                          </span>
                        )}

                        {/* Owner badge */}
                        {item.owner && OWNER_CONFIG[item.owner] && (
                          <span className="text-xs px-2 py-0.5 rounded-full shrink-0 font-medium"
                            style={{ color: OWNER_CONFIG[item.owner].color, backgroundColor: OWNER_CONFIG[item.owner].bg }}>
                            {OWNER_CONFIG[item.owner].label}
                          </span>
                        )}

                        {/* Workstream */}
                        <span className="text-xs px-2 py-0.5 rounded-full shrink-0"
                              style={{ color: wsColor(item.workstream), backgroundColor: `${wsColor(item.workstream)}18` }}>
                          {wsLabel(item.workstream)}
                        </span>
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 border-t border-[var(--border)] space-y-3">
                          {item.description && (
                            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                              {item.description}
                            </p>
                          )}

                          {item.blocked_by && (
                            <div className="flex items-center gap-2 text-xs text-[#f87171]">
                              <Ban size={12} />
                              <span>Blocked by: {item.blocked_by}</span>
                            </div>
                          )}

                          {item.tags.length > 0 && (
                            <div className="flex gap-1.5 flex-wrap">
                              {item.tags.map(tag => (
                                <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-primary)] text-[var(--text-muted)]">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                            <span className="flex items-center gap-1">
                              <Clock size={12} /> Added {formatDate(item.created_at)}
                            </span>
                            {item.source && (
                              <span>Source: {item.source}</span>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 pt-1">
                            {item.status !== "in-progress" && (
                              <button onClick={() => handleStatusChange(item.id, "in-progress")}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[#60a5fa] hover:bg-[rgba(96,165,250,0.08)]">
                                <Zap size={12} /> Start
                              </button>
                            )}
                            {item.status !== "blocked" && (
                              <button onClick={() => handleStatusChange(item.id, "blocked")}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[#f87171] hover:bg-[rgba(248,113,113,0.08)]">
                                <Ban size={12} /> Blocked
                              </button>
                            )}
                            {item.status !== "todo" && (
                              <button onClick={() => handleStatusChange(item.id, "todo")}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-primary)]">
                                Todo
                              </button>
                            )}
                            <button onClick={() => handleQuickComplete(item.id)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[#34d399] hover:bg-[rgba(52,211,153,0.08)]">
                              <Check size={12} /> Done
                            </button>
                            <div className="flex-1" />
                            <button onClick={() => handleEdit(item)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                              <Edit3 size={12} /> Edit
                            </button>
                            <button onClick={() => handleDelete(item.id)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[#f87171]">
                              <Trash2 size={12} /> Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
