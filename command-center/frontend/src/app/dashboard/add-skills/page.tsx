"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Award,
  Beaker,
  FolderOpen,
  FileSearch,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Link2,
  Upload,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronRight,
  Layers,
  Grid3X3,
  Palette,
  Save,
  AlertTriangle,
  ExternalLink,
  Target,
  BookOpen,
  Wrench,
  Lightbulb,
  GraduationCap,
  Compass,
  Zap,
  Star,
  Filter,
} from "lucide-react";
import ModuleHelp from "@/components/ModuleHelp";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ────────────────────────────────────────────────────

interface Domain {
  id: string;
  label: string;
  color: string;
  sort_order: number;
}

interface Skill {
  id: string;
  label: string;
  domain_id: string;
  sort_order: number;
}

interface Source {
  id: string;
  label: string;
  type: string;
  issuer: string | null;
  year: number | null;
  url: string | null;
  archived: boolean;
}

interface SkillLink {
  id: string;
  source_id: string;
  skill_id: string;
}

interface Stats {
  total_sources: number;
  total_links: number;
  total_skills: number;
  total_domains: number;
  by_type: Record<string, number>;
}

type Tab = "inventory" | "mapper" | "taxonomy" | "publish" | "gap";
type SourceType = "certification" | "prototype" | "project" | "teardown";

interface GapItem {
  id: string;
  title: string;
  category: string;
  subcategory: string | null;
  priority: string;
  persona_relevance: string[];
  description: string | null;
  why_it_matters: string | null;
  current_status: string;
  provider: string | null;
  provider_url: string | null;
  cost: string | null;
  time_estimate: string | null;
  alternative_sources: string | null;
  demonstration_idea: string | null;
  demonstration_type: string | null;
  portfolio_value: string | null;
  tags: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface GapStats {
  by_category: Record<string, number>;
  by_priority: Record<string, number>;
  by_status: Record<string, number>;
  total: number;
}

const GAP_CATEGORIES: { value: string; label: string; color: string; icon: typeof AlertTriangle }[] = [
  { value: "critical-gap", label: "Critical Gaps", color: "#EF4444", icon: AlertTriangle },
  { value: "recognized-cert", label: "Recognized Certs", color: "#7CADE8", icon: GraduationCap },
  { value: "persona-cred", label: "Persona Cred", color: "#A78BFA", icon: Target },
  { value: "domain-specialty", label: "Domain Specialties", color: "#F59E0B", icon: Compass },
  { value: "adjacent-skill", label: "Adjacent Skills", color: "#7CE8A3", icon: Zap },
  { value: "horizon-expander", label: "Horizon Expanders", color: "#EC4899", icon: Lightbulb },
  { value: "tool-proficiency", label: "Tool Proficiency", color: "#8B5CF6", icon: Wrench },
  { value: "framework-method", label: "Frameworks & Methods", color: "#14B8A6", icon: BookOpen },
];

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#EF4444",
  high: "#F59E0B",
  medium: "#7CADE8",
  low: "#7CE8A3",
  "nice-to-have": "#6B7280",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  "not-started": { label: "Not Started", color: "#6B7280" },
  researching: { label: "Researching", color: "#F59E0B" },
  "in-progress": { label: "In Progress", color: "#7CADE8" },
  completed: { label: "Completed", color: "#22C55E" },
  deprioritized: { label: "Deprioritized", color: "#9CA3AF" },
};

const SOURCE_TYPES: { value: SourceType; label: string; color: string; icon: typeof Award }[] = [
  { value: "certification", label: "Certifications", color: "#7CADE8", icon: Award },
  { value: "prototype", label: "Prototypes", color: "#7CE8A3", icon: Beaker },
  { value: "project", label: "Projects", color: "#E8D67C", icon: FolderOpen },
  { value: "teardown", label: "Teardowns", color: "#E8927C", icon: FileSearch },
];

// ── API helpers ──────────────────────────────────────────────

async function fetchApi(path: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}/api/evidence${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || err.title || "Request failed");
  }
  return res.json();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Main Page ───────────────────────────────────────────────

export default function AddSkillsPage() {
  const [tab, setTab] = useState<Tab>("inventory");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Core data
  const [stats, setStats] = useState<Stats | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [links, setLinks] = useState<SkillLink[]>([]);

  // Filters
  const [typeFilter, setTypeFilter] = useState<SourceType | null>(null);

  // Modals
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [editingDomain, setEditingDomain] = useState<Domain | null>(null);
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);

  // Publish state
  const [publishing, setPublishing] = useState(false);
  const [manifestPreview, setManifestPreview] = useState<any>(null);

  // Gap items state
  const [gapItems, setGapItems] = useState<GapItem[]>([]);
  const [gapStats, setGapStats] = useState<GapStats | null>(null);
  const [gapCategoryFilter, setGapCategoryFilter] = useState<string | null>(null);
  const [gapStatusFilter, setGapStatusFilter] = useState<string | null>(null);

  // ── Load all data ──────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [statsRes, domainsRes, skillsRes, sourcesRes, linksRes, gapRes, gapStatsRes] = await Promise.all([
        fetchApi("/stats"),
        fetchApi("/domains"),
        fetchApi("/skills"),
        fetchApi("/sources?limit=500"),
        fetchApi("/links"),
        fetchApi("/gap-items").catch(() => ({ entries: [] })),
        fetchApi("/gap-items/stats").catch(() => ({ by_category: {}, by_priority: {}, by_status: {}, total: 0 })),
      ]);
      setStats(statsRes);
      setDomains(domainsRes.entries);
      setSkills(skillsRes.entries);
      setSources(sourcesRes.entries);
      setLinks(linksRes.entries);
      setGapItems(gapRes.entries || []);
      setGapStats(gapStatsRes);
    } catch (e: any) {
      setError(e.message || "Failed to load evidence data");
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Clear success messages after 3 seconds
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  // ── Filtered sources ──────────────────────────────────────

  const filteredSources = typeFilter
    ? sources.filter((s) => s.type === typeFilter)
    : sources;

  // ── Source CRUD ────────────────────────────────────────────

  const handleSaveSource = async (data: Partial<Source> & { id: string; label: string; type: string }) => {
    try {
      if (editingSource) {
        const { id, ...updates } = data;
        await fetchApi(`/sources/${editingSource.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        setSuccess(`Updated "${data.label}"`);
      } else {
        await fetchApi("/sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        setSuccess(`Created "${data.label}"`);
      }
      setShowSourceModal(false);
      setEditingSource(null);
      await loadAll();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeleteSource = async (id: string) => {
    try {
      await fetchApi(`/sources/${id}/archive`, { method: "POST" });
      setSuccess("Source archived");
      await loadAll();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // ── Link management ───────────────────────────────────────

  const handleToggleLink = async (sourceId: string, skillId: string) => {
    const existing = links.find((l) => l.source_id === sourceId && l.skill_id === skillId);
    try {
      if (existing) {
        await fetchApi(`/links/${existing.id}`, { method: "DELETE" });
        setLinks((prev) => prev.filter((l) => l.id !== existing.id));
      } else {
        const res = await fetchApi("/links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source_id: sourceId, skill_id: skillId }),
        });
        setLinks((prev) => [...prev, { id: res.id, source_id: sourceId, skill_id: skillId }]);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  // ── Domain CRUD ───────────────────────────────────────────

  const handleSaveDomain = async (data: { id: string; label: string; color: string; sort_order: number }) => {
    try {
      if (editingDomain) {
        const { id, ...updates } = data;
        await fetchApi(`/domains/${editingDomain.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        setSuccess(`Updated domain "${data.label}"`);
      } else {
        await fetchApi("/domains", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        setSuccess(`Created domain "${data.label}"`);
      }
      setShowDomainModal(false);
      setEditingDomain(null);
      await loadAll();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeleteDomain = async (id: string) => {
    try {
      await fetchApi(`/domains/${id}`, { method: "DELETE" });
      setSuccess("Domain deleted");
      await loadAll();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // ── Skill CRUD ────────────────────────────────────────────

  const handleSaveSkill = async (data: { id: string; label: string; domain_id: string; sort_order: number }) => {
    try {
      if (editingSkill) {
        const { id, ...updates } = data;
        await fetchApi(`/skills/${editingSkill.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        setSuccess(`Updated skill "${data.label}"`);
      } else {
        await fetchApi("/skills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        setSuccess(`Created skill "${data.label}"`);
      }
      setShowSkillModal(false);
      setEditingSkill(null);
      await loadAll();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeleteSkill = async (id: string) => {
    try {
      await fetchApi(`/skills/${id}`, { method: "DELETE" });
      setSuccess("Skill deleted");
      await loadAll();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // ── Gap Items ─────────────────────────────────────────────

  const handleUpdateGapStatus = async (id: string, status: string) => {
    try {
      await fetchApi(`/gap-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_status: status }),
      });
      setGapItems((prev) =>
        prev.map((g) => (g.id === id ? { ...g, current_status: status } : g))
      );
      setSuccess(`Updated status to "${STATUS_LABELS[status]?.label || status}"`);
    } catch (e: any) {
      setError(e.message);
    }
  };

  // ── Publish ───────────────────────────────────────────────

  const handlePreview = async () => {
    try {
      setPublishing(true);
      const manifest = await fetchApi("/manifest");
      setManifestPreview(manifest);
    } catch (e: any) {
      setError(e.message);
    }
    setPublishing(false);
  };

  const handlePublish = async () => {
    try {
      setPublishing(true);
      const res = await fetchApi("/publish", { method: "POST" });
      setSuccess(res.message || "Published successfully");
      setManifestPreview(null);
    } catch (e: any) {
      setError(e.message);
    }
    setPublishing(false);
  };

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "rgba(124, 173, 232, 0.15)" }}
          >
            <Layers size={20} style={{ color: "#7CADE8" }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[var(--text-primary)]">
                Add Skills
              </h1>
              <ModuleHelp moduleSlug="add-skills" />
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              Evidence management for the Skills page
            </p>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-5 gap-3 mb-6">
          {SOURCE_TYPES.map((t) => (
            <div
              key={t.value}
              className="rounded-lg px-4 py-3 flex items-center gap-3"
              style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${t.color}20` }}
              >
                <t.icon size={16} style={{ color: t.color }} />
              </div>
              <div>
                <p className="text-lg font-bold text-[var(--text-primary)]">
                  {stats.by_type[t.value] || 0}
                </p>
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                  {t.label}
                </p>
              </div>
            </div>
          ))}
          <div
            className="rounded-lg px-4 py-3 flex items-center gap-3"
            style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "rgba(167, 139, 250, 0.15)" }}
            >
              <Link2 size={16} style={{ color: "#a78bfa" }} />
            </div>
            <div>
              <p className="text-lg font-bold text-[var(--text-primary)]">
                {stats.total_links}
              </p>
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                Mappings
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab toggle */}
      <div className="flex gap-2 mb-6">
        {([
          { key: "inventory" as Tab, label: "Evidence Inventory", icon: FolderOpen, color: "#7CADE8" },
          { key: "mapper" as Tab, label: "Skill Mapper", icon: Grid3X3, color: "#a78bfa" },
          { key: "taxonomy" as Tab, label: "Taxonomy", icon: Palette, color: "#E8D67C" },
          { key: "gap" as Tab, label: "Mind the Gap", icon: AlertTriangle, color: "#EF4444" },
          { key: "publish" as Tab, label: "Publish", icon: Upload, color: "#7CE8A3" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? `bg-[${t.color}20] text-[${t.color}]`
                : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
            style={tab === t.key ? { backgroundColor: `${t.color}20`, color: t.color } : {}}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError("")}><X size={14} /></button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-2">
          <CheckCircle2 size={14} />
          {success}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
        </div>
      ) : (
        <>
          {/* ─── INVENTORY TAB ─────────────────────────────────── */}
          {tab === "inventory" && (
            <InventoryTab
              sources={filteredSources}
              typeFilter={typeFilter}
              setTypeFilter={setTypeFilter}
              links={links}
              skills={skills}
              onEdit={(s) => { setEditingSource(s); setShowSourceModal(true); }}
              onDelete={handleDeleteSource}
              onAdd={() => { setEditingSource(null); setShowSourceModal(true); }}
            />
          )}

          {/* ─── MAPPER TAB ────────────────────────────────────── */}
          {tab === "mapper" && (
            <MapperTab
              sources={sources}
              skills={skills}
              domains={domains}
              links={links}
              onToggle={handleToggleLink}
            />
          )}

          {/* ─── TAXONOMY TAB ──────────────────────────────────── */}
          {tab === "taxonomy" && (
            <TaxonomyTab
              domains={domains}
              skills={skills}
              onEditDomain={(d) => { setEditingDomain(d); setShowDomainModal(true); }}
              onDeleteDomain={handleDeleteDomain}
              onAddDomain={() => { setEditingDomain(null); setShowDomainModal(true); }}
              onEditSkill={(s) => { setEditingSkill(s); setShowSkillModal(true); }}
              onDeleteSkill={handleDeleteSkill}
              onAddSkill={() => { setEditingSkill(null); setShowSkillModal(true); }}
            />
          )}

          {/* ─── GAP TAB ─────────────────────────────────────── */}
          {tab === "gap" && (
            <GapTab
              items={gapItems}
              stats={gapStats}
              categoryFilter={gapCategoryFilter}
              setCategoryFilter={setGapCategoryFilter}
              statusFilter={gapStatusFilter}
              setStatusFilter={setGapStatusFilter}
              onUpdateStatus={handleUpdateGapStatus}
            />
          )}

          {/* ─── PUBLISH TAB ───────────────────────────────────── */}
          {tab === "publish" && (
            <PublishTab
              stats={stats}
              manifestPreview={manifestPreview}
              publishing={publishing}
              onPreview={handlePreview}
              onPublish={handlePublish}
            />
          )}
        </>
      )}

      {/* ─── MODALS ──────────────────────────────────────────── */}
      {showSourceModal && (
        <SourceModal
          source={editingSource}
          onSave={handleSaveSource}
          onClose={() => { setShowSourceModal(false); setEditingSource(null); }}
        />
      )}
      {showDomainModal && (
        <DomainModal
          domain={editingDomain}
          onSave={handleSaveDomain}
          onClose={() => { setShowDomainModal(false); setEditingDomain(null); }}
        />
      )}
      {showSkillModal && (
        <SkillModal
          skill={editingSkill}
          domains={domains}
          onSave={handleSaveSkill}
          onClose={() => { setShowSkillModal(false); setEditingSkill(null); }}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TAB COMPONENTS
// ════════════════════════════════════════════════════════════

// ── Inventory Tab ───────────────────────────────────────────

function InventoryTab({
  sources, typeFilter, setTypeFilter, links, skills, onEdit, onDelete, onAdd,
}: {
  sources: Source[];
  typeFilter: SourceType | null;
  setTypeFilter: (t: SourceType | null) => void;
  links: SkillLink[];
  skills: Skill[];
  onEdit: (s: Source) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  const skillMap = Object.fromEntries(skills.map((s) => [s.id, s.label]));

  return (
    <>
      {/* Filter + Add */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setTypeFilter(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            !typeFilter
              ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
              : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          All ({sources.length})
        </button>
        {SOURCE_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setTypeFilter(t.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              typeFilter === t.value
                ? "text-[var(--bg-primary)]"
                : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
            style={typeFilter === t.value ? { backgroundColor: t.color } : {}}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={onAdd}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent-blue)] text-white hover:opacity-90 transition-all"
        >
          <Plus size={14} /> Add Evidence
        </button>
      </div>

      {/* Source cards */}
      <div className="space-y-2">
        {sources.map((s) => {
          const typeInfo = SOURCE_TYPES.find((t) => t.value === s.type);
          const sourceLinks = links.filter((l) => l.source_id === s.id);
          return (
            <div
              key={s.id}
              className="group flex items-center gap-4 rounded-xl p-4 transition-all hover:bg-[var(--bg-secondary)]"
              style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              {/* Type indicator */}
              <div
                className="w-2 h-10 rounded-full flex-shrink-0"
                style={{ backgroundColor: typeInfo?.color || "#888" }}
              />
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-[var(--text-primary)]">{s.label}</span>
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                    style={{
                      backgroundColor: `${typeInfo?.color || "#888"}20`,
                      color: typeInfo?.color || "#888",
                    }}
                  >
                    {s.type}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                  {s.issuer && <span>{s.issuer}</span>}
                  {s.year && <span>{s.year}</span>}
                  <span>{sourceLinks.length} skill{sourceLinks.length !== 1 ? "s" : ""} linked</span>
                </div>
                {sourceLinks.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {sourceLinks.slice(0, 6).map((l) => (
                      <span
                        key={l.id}
                        className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-secondary)] text-[var(--text-muted)]"
                      >
                        {skillMap[l.skill_id] || l.skill_id}
                      </span>
                    ))}
                    {sourceLinks.length > 6 && (
                      <span className="px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
                        +{sourceLinks.length - 6} more
                      </span>
                    )}
                  </div>
                )}
              </div>
              {/* Actions */}
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button
                  onClick={() => onEdit(s)}
                  className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-all"
                  title="Edit"
                >
                  <Pencil size={14} className="text-[var(--text-muted)]" />
                </button>
                <button
                  onClick={() => onDelete(s.id)}
                  className="p-2 rounded-lg hover:bg-red-500/10 transition-all"
                  title="Archive"
                >
                  <Trash2 size={14} className="text-red-400" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Mapper Tab ──────────────────────────────────────────────

function MapperTab({
  sources, skills, domains, links, onToggle,
}: {
  sources: Source[];
  skills: Skill[];
  domains: Domain[];
  links: SkillLink[];
  onToggle: (sourceId: string, skillId: string) => void;
}) {
  const [mapperType, setMapperType] = useState<SourceType>("certification");
  const filteredSources = sources.filter((s) => s.type === mapperType);
  const typeInfo = SOURCE_TYPES.find((t) => t.value === mapperType);

  // Group skills by domain
  const domainGroups = domains.map((d) => ({
    ...d,
    skills: skills.filter((s) => s.domain_id === d.id),
  }));

  const hasLink = (sourceId: string, skillId: string) =>
    links.some((l) => l.source_id === sourceId && l.skill_id === skillId);

  return (
    <>
      {/* Type selector */}
      <div className="flex gap-2 mb-6">
        {SOURCE_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setMapperType(t.value)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              mapperType === t.value
                ? "text-white"
                : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
            style={mapperType === t.value ? { backgroundColor: t.color } : {}}
          >
            <t.icon size={14} />
            {t.label} ({sources.filter((s) => s.type === t.value).length})
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left p-2 text-[var(--text-muted)] font-medium sticky left-0 bg-[var(--bg-primary)] min-w-[200px]">
                Source
              </th>
              {domainGroups.map((d) =>
                d.skills.map((s) => (
                  <th
                    key={s.id}
                    className="p-1 text-center font-medium min-w-[32px]"
                    style={{ color: d.color }}
                    title={s.label}
                  >
                    <div className="writing-mode-vertical text-[10px] whitespace-nowrap" style={{ writingMode: "vertical-lr", transform: "rotate(180deg)", height: "80px" }}>
                      {s.label}
                    </div>
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {filteredSources.map((source) => (
              <tr key={source.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-secondary)]">
                <td className="p-2 text-[var(--text-primary)] font-medium sticky left-0 bg-[var(--bg-primary)]">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-1.5 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: typeInfo?.color || "#888" }}
                    />
                    {source.label}
                  </div>
                </td>
                {domainGroups.map((d) =>
                  d.skills.map((skill) => {
                    const linked = hasLink(source.id, skill.id);
                    return (
                      <td key={skill.id} className="p-1 text-center">
                        <button
                          onClick={() => onToggle(source.id, skill.id)}
                          className={`w-6 h-6 rounded transition-all ${
                            linked
                              ? "bg-[var(--accent-blue)] hover:opacity-80"
                              : "bg-[var(--bg-secondary)] hover:bg-[var(--border)]"
                          }`}
                          title={`${linked ? "Remove" : "Add"}: ${source.label} → ${skill.label}`}
                        >
                          {linked && <CheckCircle2 size={12} className="mx-auto text-white" />}
                        </button>
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Taxonomy Tab ────────────────────────────────────────────

function TaxonomyTab({
  domains, skills,
  onEditDomain, onDeleteDomain, onAddDomain,
  onEditSkill, onDeleteSkill, onAddSkill,
}: {
  domains: Domain[];
  skills: Skill[];
  onEditDomain: (d: Domain) => void;
  onDeleteDomain: (id: string) => void;
  onAddDomain: () => void;
  onEditSkill: (s: Skill) => void;
  onDeleteSkill: (id: string) => void;
  onAddSkill: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          Domains & Skills ({domains.length} domains, {skills.length} skills)
        </h2>
        <div className="flex gap-2">
          <button
            onClick={onAddDomain}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
          >
            <Plus size={14} /> Domain
          </button>
          <button
            onClick={onAddSkill}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent-blue)] text-white hover:opacity-90 transition-all"
          >
            <Plus size={14} /> Skill
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {domains.map((d) => {
          const domainSkills = skills.filter((s) => s.domain_id === d.id);
          return (
            <div
              key={d.id}
              className="rounded-xl overflow-hidden"
              style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              {/* Domain header */}
              <div className="group flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-sm font-semibold text-[var(--text-primary)] flex-1">
                  {d.label}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {domainSkills.length} skill{domainSkills.length !== 1 ? "s" : ""}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => onEditDomain(d)} className="p-1.5 rounded hover:bg-[var(--bg-secondary)]">
                    <Pencil size={12} className="text-[var(--text-muted)]" />
                  </button>
                  <button onClick={() => onDeleteDomain(d.id)} className="p-1.5 rounded hover:bg-red-500/10">
                    <Trash2 size={12} className="text-red-400" />
                  </button>
                </div>
              </div>
              {/* Skills list */}
              <div className="divide-y divide-[var(--border)]">
                {domainSkills.map((s) => (
                  <div key={s.id} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-secondary)] transition-all">
                    <span className="text-sm text-[var(--text-secondary)] flex-1">{s.label}</span>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">{s.id}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => onEditSkill(s)} className="p-1 rounded hover:bg-[var(--bg-secondary)]">
                        <Pencil size={12} className="text-[var(--text-muted)]" />
                      </button>
                      <button onClick={() => onDeleteSkill(s.id)} className="p-1 rounded hover:bg-red-500/10">
                        <Trash2 size={12} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Gap Tab (Mind the Gap) ──────────────────────────────────

function GapTab({
  items, stats, categoryFilter, setCategoryFilter, statusFilter, setStatusFilter, onUpdateStatus,
}: {
  items: GapItem[];
  stats: GapStats | null;
  categoryFilter: string | null;
  setCategoryFilter: (c: string | null) => void;
  statusFilter: string | null;
  setStatusFilter: (s: string | null) => void;
  onUpdateStatus: (id: string, status: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter items
  const filtered = items.filter((item) => {
    if (categoryFilter && item.category !== categoryFilter) return false;
    if (statusFilter && item.current_status !== statusFilter) return false;
    return true;
  });

  // Group by category
  const grouped = GAP_CATEGORIES.map((cat) => ({
    ...cat,
    items: filtered.filter((i) => i.category === cat.value),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      {/* Stats summary */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="rounded-lg px-4 py-3" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className="text-lg font-bold text-[var(--text-primary)]">{stats.total}</p>
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Total Items</p>
          </div>
          <div className="rounded-lg px-4 py-3" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className="text-lg font-bold text-[#EF4444]">{(stats.by_priority?.critical || 0) + (stats.by_priority?.high || 0)}</p>
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">High Priority</p>
          </div>
          <div className="rounded-lg px-4 py-3" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className="text-lg font-bold text-[#7CADE8]">{stats.by_status?.["in-progress"] || 0}</p>
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">In Progress</p>
          </div>
          <div className="rounded-lg px-4 py-3" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className="text-lg font-bold text-[#22C55E]">{stats.by_status?.completed || 0}</p>
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Completed</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Filter size={14} className="text-[var(--text-muted)]" />
        <button
          onClick={() => setCategoryFilter(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            !categoryFilter
              ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
              : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          All ({items.length})
        </button>
        {GAP_CATEGORIES.map((cat) => {
          const count = items.filter((i) => i.category === cat.value).length;
          if (count === 0) return null;
          return (
            <button
              key={cat.value}
              onClick={() => setCategoryFilter(categoryFilter === cat.value ? null : cat.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                categoryFilter === cat.value
                  ? "text-white"
                  : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
              style={categoryFilter === cat.value ? { backgroundColor: cat.color } : {}}
            >
              {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Status filter row */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Status:</span>
        <button
          onClick={() => setStatusFilter(null)}
          className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
            !statusFilter
              ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
              : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          All
        </button>
        {Object.entries(STATUS_LABELS).map(([key, { label, color }]) => (
          <button
            key={key}
            onClick={() => setStatusFilter(statusFilter === key ? null : key)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
              statusFilter === key
                ? "text-white"
                : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
            style={statusFilter === key ? { backgroundColor: color } : {}}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Grouped items */}
      {grouped.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <AlertTriangle size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No gap items match the current filters</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => {
            const CatIcon = group.icon;
            return (
              <div key={group.value}>
                {/* Category header */}
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${group.color}20` }}
                  >
                    <CatIcon size={14} style={{ color: group.color }} />
                  </div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    {group.label}
                  </h3>
                  <span className="text-xs text-[var(--text-muted)]">
                    ({group.items.length})
                  </span>
                </div>

                {/* Items */}
                <div className="space-y-2">
                  {group.items.map((item) => {
                    const expanded = expandedId === item.id;
                    const statusInfo = STATUS_LABELS[item.current_status] || { label: item.current_status, color: "#6B7280" };
                    const priorityColor = PRIORITY_COLORS[item.priority] || "#6B7280";

                    return (
                      <div
                        key={item.id}
                        className="rounded-xl overflow-hidden transition-all"
                        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
                      >
                        {/* Collapsed row */}
                        <button
                          onClick={() => setExpandedId(expanded ? null : item.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg-secondary)] transition-all"
                        >
                          <div
                            className="w-1.5 h-8 rounded-full flex-shrink-0"
                            style={{ backgroundColor: priorityColor }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-medium text-[var(--text-primary)]">
                                {item.title}
                              </span>
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                                style={{ backgroundColor: `${priorityColor}20`, color: priorityColor }}
                              >
                                {item.priority}
                              </span>
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                                style={{ backgroundColor: `${statusInfo.color}20`, color: statusInfo.color }}
                              >
                                {statusInfo.label}
                              </span>
                            </div>
                            {item.description && (
                              <p className="text-xs text-[var(--text-muted)] truncate">
                                {item.description}
                              </p>
                            )}
                          </div>
                          {item.persona_relevance.length > 0 && (
                            <div className="hidden sm:flex gap-1 flex-shrink-0">
                              {item.persona_relevance.slice(0, 3).map((p) => (
                                <span
                                  key={p}
                                  className="px-1.5 py-0.5 rounded text-[9px] bg-[var(--bg-secondary)] text-[var(--text-muted)]"
                                >
                                  {p.replace(/-/g, " ")}
                                </span>
                              ))}
                            </div>
                          )}
                          <ChevronRight
                            size={16}
                            className={`text-[var(--text-muted)] transition-transform flex-shrink-0 ${expanded ? "rotate-90" : ""}`}
                          />
                        </button>

                        {/* Expanded details */}
                        {expanded && (
                          <div className="px-4 pb-4 border-t border-[var(--border)]">
                            <div className="grid grid-cols-2 gap-4 mt-4">
                              {/* Left: Info */}
                              <div className="space-y-3">
                                {item.why_it_matters && (
                                  <div>
                                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">
                                      Why It Matters
                                    </p>
                                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                                      {item.why_it_matters}
                                    </p>
                                  </div>
                                )}
                                {item.persona_relevance.length > 0 && (
                                  <div>
                                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">
                                      Persona Relevance
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {item.persona_relevance.map((p) => (
                                        <span
                                          key={p}
                                          className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
                                        >
                                          {p.replace(/-/g, " ")}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {/* Status selector */}
                                <div>
                                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">
                                    Status
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {Object.entries(STATUS_LABELS).map(([key, { label, color }]) => (
                                      <button
                                        key={key}
                                        onClick={() => onUpdateStatus(item.id, key)}
                                        className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                                          item.current_status === key
                                            ? "text-white"
                                            : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                                        }`}
                                        style={item.current_status === key ? { backgroundColor: color } : {}}
                                      >
                                        {label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* Right: Learning + Demo */}
                              <div className="space-y-3">
                                {(item.provider || item.cost || item.time_estimate) && (
                                  <div>
                                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">
                                      Learning Plan
                                    </p>
                                    <div className="space-y-1">
                                      {item.provider && (
                                        <div className="flex items-center gap-1.5">
                                          <GraduationCap size={11} className="text-[var(--text-muted)]" />
                                          <span className="text-xs text-[var(--text-secondary)]">
                                            {item.provider}
                                          </span>
                                          {item.provider_url && (
                                            <a
                                              href={item.provider_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-[var(--accent-blue)] hover:underline"
                                            >
                                              <ExternalLink size={10} />
                                            </a>
                                          )}
                                        </div>
                                      )}
                                      {item.cost && (
                                        <p className="text-xs text-[var(--text-muted)]">
                                          Cost: {item.cost}
                                        </p>
                                      )}
                                      {item.time_estimate && (
                                        <p className="text-xs text-[var(--text-muted)]">
                                          Time: {item.time_estimate}
                                        </p>
                                      )}
                                      {item.alternative_sources && (
                                        <p className="text-xs text-[var(--text-muted)]">
                                          Alt: {item.alternative_sources}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {(item.demonstration_idea || item.portfolio_value) && (
                                  <div>
                                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">
                                      Demonstration Idea
                                    </p>
                                    {item.demonstration_idea && (
                                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-1">
                                        {item.demonstration_idea}
                                      </p>
                                    )}
                                    {item.demonstration_type && (
                                      <span
                                        className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--bg-secondary)] text-[var(--text-muted)] mb-1"
                                      >
                                        {item.demonstration_type}
                                      </span>
                                    )}
                                    {item.portfolio_value && (
                                      <div className="flex items-start gap-1.5 mt-1">
                                        <Star size={11} className="text-[#F59E0B] mt-0.5 flex-shrink-0" />
                                        <p className="text-xs text-[var(--text-muted)]">
                                          {item.portfolio_value}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {item.tags.length > 0 && (
                                  <div>
                                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">
                                      Tags
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {item.tags.map((t) => (
                                        <span
                                          key={t}
                                          className="px-1.5 py-0.5 rounded text-[9px] bg-[var(--bg-secondary)] text-[var(--text-muted)]"
                                        >
                                          {t}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── Publish Tab ─────────────────────────────────────────────

function PublishTab({
  stats, manifestPreview, publishing, onPreview, onPublish,
}: {
  stats: Stats | null;
  manifestPreview: any;
  publishing: boolean;
  onPreview: () => void;
  onPublish: () => void;
}) {
  return (
    <div className="max-w-2xl">
      <div
        className="rounded-xl p-6"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
          Publish Evidence Manifest
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6 leading-relaxed">
          Generate a JSON manifest from the current evidence data and commit it to the site repo.
          The skills page will read this file instead of embedded JavaScript data.
        </p>

        {stats && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="rounded-lg p-3 bg-[var(--bg-secondary)]">
              <span className="text-xs text-[var(--text-muted)]">Sources</span>
              <p className="text-lg font-bold text-[var(--text-primary)]">{stats.total_sources}</p>
            </div>
            <div className="rounded-lg p-3 bg-[var(--bg-secondary)]">
              <span className="text-xs text-[var(--text-muted)]">Skill Mappings</span>
              <p className="text-lg font-bold text-[var(--text-primary)]">{stats.total_links}</p>
            </div>
            <div className="rounded-lg p-3 bg-[var(--bg-secondary)]">
              <span className="text-xs text-[var(--text-muted)]">Skills</span>
              <p className="text-lg font-bold text-[var(--text-primary)]">{stats.total_skills}</p>
            </div>
            <div className="rounded-lg p-3 bg-[var(--bg-secondary)]">
              <span className="text-xs text-[var(--text-muted)]">Domains</span>
              <p className="text-lg font-bold text-[var(--text-primary)]">{stats.total_domains}</p>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onPreview}
            disabled={publishing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all disabled:opacity-50"
          >
            {publishing ? <Loader2 size={16} className="animate-spin" /> : <FileSearch size={16} />}
            Preview
          </button>
          <button
            onClick={onPublish}
            disabled={publishing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-[var(--accent-blue)] text-white hover:opacity-90 transition-all disabled:opacity-50"
          >
            {publishing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Publish to Site
          </button>
        </div>

        {manifestPreview && (
          <div className="mt-6">
            <h3 className="text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider">
              Manifest Preview
            </h3>
            <pre
              className="rounded-lg p-4 text-xs text-[var(--text-secondary)] overflow-auto max-h-96"
              style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border)" }}
            >
              {JSON.stringify(manifestPreview, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// MODAL COMPONENTS
// ════════════════════════════════════════════════════════════

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-lg mx-4 rounded-xl p-6"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)]">
            <X size={16} className="text-[var(--text-muted)]" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, required, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean; type?: string;
}) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
      />
    </div>
  );
}

// ── Source Modal ─────────────────────────────────────────────

function SourceModal({ source, onSave, onClose }: {
  source: Source | null;
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const [id, setId] = useState(source?.id || "");
  const [label, setLabel] = useState(source?.label || "");
  const [type, setType] = useState<string>(source?.type || "certification");
  const [issuer, setIssuer] = useState(source?.issuer || "");
  const [year, setYear] = useState(source?.year?.toString() || "");
  const [url, setUrl] = useState(source?.url || "");

  return (
    <ModalShell title={source ? "Edit Evidence" : "Add Evidence"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSave({ id, label, type, issuer: issuer || null, year: year ? parseInt(year) : null, url: url || null }); }}>
        {!source && (
          <InputField label="ID (slug)" value={id} onChange={setId} placeholder="my-certification" required />
        )}
        <InputField label="Label" value={label} onChange={setLabel} placeholder="Display name" required />

        <div className="mb-4">
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]"
          >
            {SOURCE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <InputField label="Issuer" value={issuer} onChange={setIssuer} placeholder="Organization name (optional)" />
        <InputField label="Year" value={year} onChange={setYear} placeholder="2023" type="number" />
        <InputField label="URL" value={url} onChange={setUrl} placeholder="https://... (optional)" />

        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent-blue)] text-white hover:opacity-90">
            <Save size={14} className="inline mr-1.5" />
            {source ? "Update" : "Create"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ── Domain Modal ────────────────────────────────────────────

function DomainModal({ domain, onSave, onClose }: {
  domain: Domain | null;
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const [id, setId] = useState(domain?.id || "");
  const [label, setLabel] = useState(domain?.label || "");
  const [color, setColor] = useState(domain?.color || "#7CADE8");
  const [sortOrder, setSortOrder] = useState(domain?.sort_order?.toString() || "0");

  return (
    <ModalShell title={domain ? "Edit Domain" : "Add Domain"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSave({ id, label, color, sort_order: parseInt(sortOrder) || 0 }); }}>
        {!domain && (
          <InputField label="ID (slug)" value={id} onChange={setId} placeholder="my-domain" required />
        )}
        <InputField label="Label" value={label} onChange={setLabel} placeholder="Domain name" required />

        <div className="mb-4">
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border border-[var(--border)]"
            />
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg text-sm bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] font-mono"
            />
          </div>
        </div>

        <InputField label="Sort Order" value={sortOrder} onChange={setSortOrder} type="number" />

        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[var(--text-muted)]">
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent-blue)] text-white hover:opacity-90">
            <Save size={14} className="inline mr-1.5" />
            {domain ? "Update" : "Create"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ── Skill Modal ─────────────────────────────────────────────

function SkillModal({ skill, domains, onSave, onClose }: {
  skill: Skill | null;
  domains: Domain[];
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const [id, setId] = useState(skill?.id || "");
  const [label, setLabel] = useState(skill?.label || "");
  const [domainId, setDomainId] = useState(skill?.domain_id || domains[0]?.id || "");
  const [sortOrder, setSortOrder] = useState(skill?.sort_order?.toString() || "0");

  return (
    <ModalShell title={skill ? "Edit Skill" : "Add Skill"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSave({ id, label, domain_id: domainId, sort_order: parseInt(sortOrder) || 0 }); }}>
        {!skill && (
          <InputField label="ID (slug)" value={id} onChange={setId} placeholder="my-skill" required />
        )}
        <InputField label="Label" value={label} onChange={setLabel} placeholder="Skill name" required />

        <div className="mb-4">
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Domain</label>
          <select
            value={domainId}
            onChange={(e) => setDomainId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]"
          >
            {domains.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </div>

        <InputField label="Sort Order" value={sortOrder} onChange={setSortOrder} type="number" />

        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[var(--text-muted)]">
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent-blue)] text-white hover:opacity-90">
            <Save size={14} className="inline mr-1.5" />
            {skill ? "Update" : "Create"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
