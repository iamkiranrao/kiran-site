"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Lightbulb,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  Tag,
  Clock,
  Trash2,
  Edit3,
  Check,
  Archive,
  ArrowUpCircle,
  ArrowRightCircle,
  ArrowDownCircle,
  Zap,
  Filter,
} from "lucide-react";
import ModuleHelp from "@/components/ModuleHelp";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ── Types ──────────────────────────────────────────────── */

interface Idea {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  estimated_effort: string;
  tags: string[];
  notes: string;
  created_at: string;
  updated_at: string;
}

/* ── Constants ──────────────────────────────────────────── */

const CATEGORIES = [
  { value: "job-radar", label: "Job Radar", color: "#f87171" },
  { value: "resume", label: "Resume Customizer", color: "#60a5fa" },
  { value: "fenix", label: "Fenix", color: "#fb923c" },
  { value: "teardowns", label: "Teardowns", color: "#fbbf24" },
  { value: "wordweaver", label: "WordWeaver", color: "#34d399" },
  { value: "madlab", label: "MadLab", color: "#67e8f9" },
  { value: "infra", label: "Infrastructure", color: "#a78bfa" },
  { value: "general", label: "General", color: "#94a3b8" },
];

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: typeof ArrowUpCircle }> = {
  high:   { label: "High",   color: "#f87171", bg: "rgba(248,113,113,0.12)", Icon: ArrowUpCircle },
  medium: { label: "Medium", color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  Icon: ArrowRightCircle },
  low:    { label: "Low",    color: "#60a5fa", bg: "rgba(96,165,250,0.12)",  Icon: ArrowDownCircle },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  backlog:       { label: "Backlog",     color: "var(--text-muted)",  bg: "var(--bg-secondary)" },
  "in-progress": { label: "In Progress", color: "#60a5fa",           bg: "rgba(96,165,250,0.12)" },
  done:          { label: "Done",        color: "#34d399",           bg: "rgba(52,211,153,0.12)" },
  parked:        { label: "Parked",      color: "#fb923c",           bg: "rgba(251,147,60,0.12)" },
};

const EFFORT_OPTIONS = ["small", "medium", "large", "XL"];

/* ── Component ──────────────────────────────────────────── */

export default function IdeasPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formCategory, setFormCategory] = useState("general");
  const [formPriority, setFormPriority] = useState("medium");
  const [formEffort, setFormEffort] = useState("");
  const [formTags, setFormTags] = useState("");

  const fetchIdeas = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterCategory) params.set("category", filterCategory);
      if (filterStatus) params.set("status", filterStatus);
      const res = await fetch(`${API}/api/ideas/?${params}`);
      const data = await res.json();
      setIdeas(data.ideas || []);
    } catch (e) {
      console.error("Failed to fetch ideas:", e);
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterStatus]);

  useEffect(() => { fetchIdeas(); }, [fetchIdeas]);

  const resetForm = () => {
    setFormTitle(""); setFormDesc(""); setFormCategory("general");
    setFormPriority("medium"); setFormEffort(""); setFormTags("");
    setEditingId(null); setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!formTitle.trim()) return;
    const payload = {
      title: formTitle.trim(),
      description: formDesc.trim(),
      category: formCategory,
      priority: formPriority,
      estimated_effort: formEffort,
      tags: formTags.split(",").map(t => t.trim()).filter(Boolean),
    };

    if (editingId) {
      await fetch(`${API}/api/ideas/${editingId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch(`${API}/api/ideas/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    resetForm();
    fetchIdeas();
  };

  const handleEdit = (idea: Idea) => {
    setFormTitle(idea.title);
    setFormDesc(idea.description);
    setFormCategory(idea.category);
    setFormPriority(idea.priority);
    setFormEffort(idea.estimated_effort);
    setFormTags(idea.tags.join(", "));
    setEditingId(idea.id);
    setShowForm(true);
  };

  const handleStatusChange = async (id: string, status: string) => {
    await fetch(`${API}/api/ideas/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchIdeas();
  };

  const handleDelete = async (id: string) => {
    await fetch(`${API}/api/ideas/${id}`, { method: "DELETE" });
    fetchIdeas();
  };

  const catColor = (cat: string) =>
    CATEGORIES.find(c => c.value === cat)?.color || "#94a3b8";
  const catLabel = (cat: string) =>
    CATEGORIES.find(c => c.value === cat)?.label || cat;

  /* ── Grouped by status ──────────────────────────────── */
  const statusOrder = ["in-progress", "backlog", "parked", "done"];
  const grouped = statusOrder.reduce((acc, s) => {
    acc[s] = ideas.filter(i => i.status === s);
    return acc;
  }, {} as Record<string, Idea[]>);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Lightbulb size={24} className="text-[var(--accent-amber)]" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-[var(--text-primary)]">Future Ideas</h1>
              <ModuleHelp moduleSlug="ideas" />
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              Feature backlog and improvement ideas for Command Center
            </p>
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-amber)] text-[#0a0a0a] rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={16} /> Add Idea
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
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
          {statusOrder.map(s => <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>)}
        </select>
        <span className="text-xs text-[var(--text-muted)] ml-auto">
          {ideas.length} idea{ideas.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="p-5 rounded-xl border border-[var(--accent-amber)] bg-[var(--bg-secondary)] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">
              {editingId ? "Edit Idea" : "New Idea"}
            </h3>
            <button onClick={resetForm} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <X size={16} />
            </button>
          </div>

          <input
            value={formTitle}
            onChange={e => setFormTitle(e.target.value)}
            placeholder="Idea title..."
            className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
          />
          <textarea
            value={formDesc}
            onChange={e => setFormDesc(e.target.value)}
            placeholder="Description, context, approach ideas..."
            rows={3}
            className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none"
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <select value={formCategory} onChange={e => setFormCategory(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)]">
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select value={formPriority} onChange={e => setFormPriority(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)]">
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
            <select value={formEffort} onChange={e => setFormEffort(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)]">
              <option value="">Effort...</option>
              {EFFORT_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <input
              value={formTags}
              onChange={e => setFormTags(e.target.value)}
              placeholder="Tags (comma sep)"
              className="px-3 py-2 text-sm rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={resetForm}
              className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]">
              Cancel
            </button>
            <button onClick={handleSubmit}
              className="px-4 py-2 text-sm rounded-lg bg-[var(--accent-amber)] text-[#0a0a0a] font-medium hover:opacity-90">
              {editingId ? "Save Changes" : "Add Idea"}
            </button>
          </div>
        </div>
      )}

      {/* Ideas grouped by status */}
      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading ideas...</p>
      ) : ideas.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <Lightbulb size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No ideas yet. Click "Add Idea" to start your backlog.</p>
        </div>
      ) : (
        statusOrder.map(status => {
          const items = grouped[status];
          if (!items || items.length === 0) return null;
          const sc = STATUS_CONFIG[status] || STATUS_CONFIG.backlog;

          return (
            <div key={status} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2"
                  style={{ color: sc.color }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sc.color }} />
                {sc.label} ({items.length})
              </h2>

              <div className="space-y-2">
                {items.map(idea => {
                  const pc = PRIORITY_CONFIG[idea.priority] || PRIORITY_CONFIG.medium;
                  const PIcon = pc.Icon;
                  const isExpanded = expandedId === idea.id;

                  return (
                    <div
                      key={idea.id}
                      className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden transition-all hover:border-[var(--text-muted)]"
                    >
                      {/* Row */}
                      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                           onClick={() => setExpandedId(isExpanded ? null : idea.id)}>
                        {isExpanded
                          ? <ChevronDown size={14} className="text-[var(--text-muted)] shrink-0" />
                          : <ChevronRight size={14} className="text-[var(--text-muted)] shrink-0" />
                        }

                        {/* Category dot */}
                        <span className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: catColor(idea.category) }}
                              title={catLabel(idea.category)} />

                        <span className="text-sm text-[var(--text-primary)] font-medium flex-1 truncate">
                          {idea.title}
                        </span>

                        {/* Priority badge */}
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs shrink-0"
                              style={{ color: pc.color, backgroundColor: pc.bg }}>
                          <PIcon size={12} /> {pc.label}
                        </span>

                        {/* Effort */}
                        {idea.estimated_effort && (
                          <span className="text-xs text-[var(--text-muted)] px-2 py-0.5 rounded-full bg-[var(--bg-primary)] shrink-0">
                            {idea.estimated_effort}
                          </span>
                        )}

                        {/* Category label */}
                        <span className="text-xs px-2 py-0.5 rounded-full shrink-0"
                              style={{ color: catColor(idea.category), backgroundColor: `${catColor(idea.category)}18` }}>
                          {catLabel(idea.category)}
                        </span>
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 border-t border-[var(--border)] space-y-3">
                          {idea.description && (
                            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                              {idea.description}
                            </p>
                          )}

                          {idea.tags.length > 0 && (
                            <div className="flex gap-1.5 flex-wrap">
                              {idea.tags.map(tag => (
                                <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-primary)] text-[var(--text-muted)]">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                            <Clock size={12} />
                            Added {formatDate(idea.created_at)}
                            {idea.updated_at !== idea.created_at && (
                              <span> · Updated {formatDate(idea.updated_at)}</span>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 pt-1">
                            {status !== "in-progress" && (
                              <button onClick={() => handleStatusChange(idea.id, "in-progress")}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[#60a5fa] hover:bg-[rgba(96,165,250,0.08)]">
                                <Zap size={12} /> Start
                              </button>
                            )}
                            {status !== "done" && (
                              <button onClick={() => handleStatusChange(idea.id, "done")}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[#34d399] hover:bg-[rgba(52,211,153,0.08)]">
                                <Check size={12} /> Done
                              </button>
                            )}
                            {status !== "parked" && (
                              <button onClick={() => handleStatusChange(idea.id, "parked")}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[#fb923c] hover:bg-[rgba(251,147,60,0.08)]">
                                <Archive size={12} /> Park
                              </button>
                            )}
                            {status !== "backlog" && (
                              <button onClick={() => handleStatusChange(idea.id, "backlog")}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-primary)]">
                                Backlog
                              </button>
                            )}
                            <div className="flex-1" />
                            <button onClick={() => handleEdit(idea)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                              <Edit3 size={12} /> Edit
                            </button>
                            <button onClick={() => handleDelete(idea.id)}
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
