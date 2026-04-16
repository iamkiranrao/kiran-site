"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Briefcase,
  FolderOpen,
  Grid3X3,
  ExternalLink,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  MapPin,
  Calendar,
  Tag,
  BarChart3,
  Plus,
  X,
  Save,
  Pencil,
  Trash2,
  Link2,
  Award,
  Beaker,
  FileSearch,
  CheckCircle2,
  Loader2,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ── Types ──────────────────────────────────────────────── */

interface OutcomeMetric {
  number: string;
  label: string;
}

interface Initiative {
  id: string;
  title: string;
  one_liner: string;
  company: string;
  role: string;
  era: string;
  year_start: number | null;
  year_end: number | null;
  domains: string[];
  tags: string[];
  problem: string;
  bet: string;
  shipped: string;
  outcome: string;
  headline_metric_number: string;
  headline_metric_label: string;
  outcome_metrics: OutcomeMetric[];
  gallery_items: string[];
  public: boolean;
  fenix_indexed: boolean;
  closed_gap_id?: string;
  requirement_coverage?: string[];
  created_at: string;
  updated_at: string;
}

interface DomainCount {
  domain: string;
  count: number;
}

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

type Tab = "initiatives" | "evidence" | "skills" | "publish";
type SourceType = "certification" | "prototype" | "project" | "teardown";

const DOMAIN_COLORS: Record<string, string> = {
  "ai-ml": "#a78bfa",
  "payments": "#60a5fa",
  "mobile": "#34d399",
  "growth-adoption": "#fb923c",
  "platform": "#818cf8",
  "security": "#f87171",
  "fraud": "#f87171",
  "zero-to-one": "#67e8f9",
  "strategy": "#fbbf24",
  "personalization": "#f472b6",
  "lending": "#60a5fa",
  "wealth": "#a3e635",
  "engagement": "#fb923c",
  "notifications": "#94a3b8",
  "marketplace": "#34d399",
  "auth-identity": "#f87171",
};

const VALID_DOMAINS = [
  "auth-identity", "payments", "growth-adoption", "ai-ml", "mobile",
  "marketplace", "engagement", "security", "fraud", "platform",
  "personalization", "notifications", "lending", "wealth", "zero-to-one", "strategy",
];

const VALID_COMPANIES = ["wells-fargo", "first-republic", "avatour", "consulting", "magley"];
const VALID_ERAS = ["enterprise", "startup", "consulting", "ai-chapter"];

const COMPANY_LABELS: Record<string, string> = {
  "wells-fargo": "Wells Fargo",
  "first-republic": "First Republic",
  "avatour": "Avatour",
  "consulting": "Consulting",
  "magley": "Magley & Associates",
};

const ERA_LABELS: Record<string, string> = {
  "enterprise": "Enterprise",
  "startup": "Startup",
  "consulting": "Consulting",
  "ai-chapter": "AI Chapter",
};

const COMPANY_COLORS: Record<string, string> = {
  "wells-fargo": "#f87171",
  "first-republic": "#60a5fa",
  "avatour": "#34d399",
  "consulting": "#94a3b8",
  "magley": "#fbbf24",
};

const SOURCE_TYPES: { value: SourceType; label: string; color: string }[] = [
  { value: "certification", label: "Certifications", color: "#7CADE8" },
  { value: "prototype", label: "Prototypes", color: "#7CE8A3" },
  { value: "project", label: "Projects", color: "#E8D67C" },
  { value: "teardown", label: "Teardowns", color: "#E8927C" },
];

const EMPTY_FORM = {
  title: "",
  one_liner: "",
  company: "",
  role: "",
  era: "",
  year_start: "" as string | number,
  year_end: "" as string | number,
  domains: [] as string[],
  tags: "",
  problem: "",
  bet: "",
  shipped: "",
  outcome: "",
  headline_metric_number: "",
  headline_metric_label: "",
  outcome_metrics: [] as OutcomeMetric[],
  public: true,
  fenix_indexed: true,
  closed_gap_id: "",
};

/* ── API Helpers ─────────────────────────────────────────── */

async function fetchApi(path: string, options?: RequestInit) {
  const res = await fetch(`${API}/api/evidence${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || err.title || "Request failed");
  }
  return res.json();
}

/* ── Component ──────────────────────────────────────────── */

export default function CareerVaultPage() {
  const [tab, setTab] = useState<Tab>("initiatives");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Initiatives
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [domains, setDomains] = useState<DomainCount[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [filterDomain, setFilterDomain] = useState("");
  const [filterCompany, setFilterCompany] = useState("");
  const [filterEra, setFilterEra] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Evidence
  const [stats, setStats] = useState<Stats | null>(null);
  const [domainsTax, setDomainsTax] = useState<Domain[]>([]);
  const [skillsTax, setSkillsTax] = useState<Skill[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [links, setLinks] = useState<SkillLink[]>([]);
  const [typeFilter, setTypeFilter] = useState<SourceType | null>(null);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [editingDomain, setEditingDomain] = useState<Domain | null>(null);
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);

  // Publish
  const [publishing, setPublishing] = useState(false);
  const [manifestPreview, setManifestPreview] = useState<any>(null);

  /* ── Load all data ──────────────────────────────────────── */

  const loadInitiatives = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (filterDomain) params.set("domain", filterDomain);
      if (filterCompany) params.set("company", filterCompany);
      if (filterEra) params.set("era", filterEra);
      if (searchText.trim()) params.set("search", searchText.trim());
      const res = await fetch(`${API}/api/career-initiatives/?${params}`);
      const data = await res.json();
      setInitiatives(data.initiatives || []);
    } catch (e) {
      console.error("Failed to fetch initiatives:", e);
    }
  }, [filterDomain, filterCompany, filterEra, searchText]);

  const fetchInitiativeDomains = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/career-initiatives/domains`);
      const data = await res.json();
      setDomains(data.domains || []);
    } catch (e) {
      console.error("Failed to fetch domains:", e);
    }
  }, []);

  const loadEvidence = useCallback(async () => {
    try {
      const [statsRes, domainsRes, skillsRes, sourcesRes, linksRes] = await Promise.all([
        fetchApi("/stats"),
        fetchApi("/domains"),
        fetchApi("/skills"),
        fetchApi("/sources?limit=500"),
        fetchApi("/links"),
      ]);
      setStats(statsRes);
      setDomainsTax(domainsRes.entries);
      setSkillsTax(skillsRes.entries);
      setSources(sourcesRes.entries);
      setLinks(linksRes.entries);
    } catch (e: any) {
      console.error("Failed to load evidence data:", e);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadInitiatives(), fetchInitiativeDomains(), loadEvidence()]).finally(() => {
      setLoading(false);
    });
  }, [loadInitiatives, fetchInitiativeDomains, loadEvidence]);

  // Clear success after 3 seconds
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  const companyBreakdown = initiatives.reduce((acc, i) => {
    acc[i.company] = (acc[i.company] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const filteredSources = typeFilter ? sources.filter(s => s.type === typeFilter) : sources;

  /* ── Initiative CRUD ────────────────────────────────────── */

  const openAddForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setFormError("");
    setShowForm(true);
  };

  const openEditForm = (init: Initiative) => {
    setForm({
      title: init.title,
      one_liner: init.one_liner,
      company: init.company,
      role: init.role,
      era: init.era,
      year_start: init.year_start ?? "",
      year_end: init.year_end ?? "",
      domains: [...init.domains],
      tags: init.tags.join(", "),
      problem: init.problem,
      bet: init.bet,
      shipped: init.shipped,
      outcome: init.outcome,
      headline_metric_number: init.headline_metric_number,
      headline_metric_label: init.headline_metric_label,
      outcome_metrics: [...(init.outcome_metrics || [])],
      public: init.public,
      fenix_indexed: init.fenix_indexed,
      closed_gap_id: init.closed_gap_id || "",
    });
    setEditingId(init.id);
    setFormError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormError("");
  };

  const toggleDomain = (d: string) => {
    setForm(prev => ({
      ...prev,
      domains: prev.domains.includes(d)
        ? prev.domains.filter(x => x !== d)
        : [...prev.domains, d],
    }));
  };

  const addMetric = () => {
    setForm(prev => ({
      ...prev,
      outcome_metrics: [...prev.outcome_metrics, { number: "", label: "" }],
    }));
  };

  const updateMetric = (idx: number, field: "number" | "label", val: string) => {
    setForm(prev => {
      const metrics = [...prev.outcome_metrics];
      metrics[idx] = { ...metrics[idx], [field]: val };
      return { ...prev, outcome_metrics: metrics };
    });
  };

  const removeMetric = (idx: number) => {
    setForm(prev => ({
      ...prev,
      outcome_metrics: prev.outcome_metrics.filter((_, i) => i !== idx),
    }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setFormError("Title is required.");
      return;
    }

    setSaving(true);
    setFormError("");

    const payload: any = {
      title: form.title.trim(),
      one_liner: form.one_liner.trim(),
      company: form.company,
      role: form.role.trim(),
      era: form.era,
      year_start: form.year_start !== "" ? Number(form.year_start) : null,
      year_end: form.year_end !== "" ? Number(form.year_end) : null,
      domains: form.domains,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      problem: form.problem.trim(),
      bet: form.bet.trim(),
      shipped: form.shipped.trim(),
      outcome: form.outcome.trim(),
      headline_metric_number: form.headline_metric_number.trim(),
      headline_metric_label: form.headline_metric_label.trim(),
      outcome_metrics: form.outcome_metrics.filter(m => m.number || m.label),
      public: form.public,
      fenix_indexed: form.fenix_indexed,
    };

    if (form.closed_gap_id.trim()) {
      payload.closed_gap_id = form.closed_gap_id.trim();
    }

    try {
      const isEdit = !!editingId;
      const url = isEdit
        ? `${API}/api/career-initiatives/${editingId}`
        : `${API}/api/career-initiatives/`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      setSuccess(isEdit ? "Initiative updated" : "Initiative created");
      closeForm();
      loadInitiatives();
      fetchInitiativeDomains();
    } catch (e: any) {
      setFormError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${API}/api/career-initiatives/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSuccess("Initiative deleted");
      setDeletingId(null);
      loadInitiatives();
      fetchInitiativeDomains();
    } catch (e) {
      console.error("Delete failed:", e);
      setError("Failed to delete initiative");
    }
  };

  /* ── Evidence CRUD ──────────────────────────────────────── */

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
      await loadEvidence();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeleteSource = async (id: string) => {
    try {
      await fetchApi(`/sources/${id}/archive`, { method: "POST" });
      setSuccess("Source archived");
      await loadEvidence();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleToggleLink = async (sourceId: string, skillId: string) => {
    const existing = links.find(l => l.source_id === sourceId && l.skill_id === skillId);
    try {
      if (existing) {
        await fetchApi(`/links/${existing.id}`, { method: "DELETE" });
        setLinks(prev => prev.filter(l => l.id !== existing.id));
      } else {
        const res = await fetchApi("/links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source_id: sourceId, skill_id: skillId }),
        });
        setLinks(prev => [...prev, { id: res.id, source_id: sourceId, skill_id: skillId }]);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

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
      await loadEvidence();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeleteDomain = async (id: string) => {
    try {
      await fetchApi(`/domains/${id}`, { method: "DELETE" });
      setSuccess("Domain deleted");
      await loadEvidence();
    } catch (e: any) {
      setError(e.message);
    }
  };

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
      await loadEvidence();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeleteSkill = async (id: string) => {
    try {
      await fetchApi(`/skills/${id}`, { method: "DELETE" });
      setSuccess("Skill deleted");
      await loadEvidence();
    } catch (e: any) {
      setError(e.message);
    }
  };

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

  /* ── Render ────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* Header with tab toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Briefcase size={24} className="text-[#fb923c]" />
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">Career Vault</h1>
            <p className="text-sm text-[var(--text-muted)]">
              {tab === "initiatives" && `${initiatives.length} career initiatives`}
              {tab === "evidence" && `${sources.length} evidence sources`}
              {tab === "skills" && `${domainsTax.length} domains, ${skillsTax.length} skills`}
              {tab === "publish" && "Generate & publish evidence manifest"}
            </p>
          </div>
        </div>
      </div>

      {/* Tab Toggle */}
      <div className="flex gap-2 flex-wrap border-b border-[var(--border)]">
        {[
          { key: "initiatives" as Tab, label: "Initiatives", icon: Briefcase },
          { key: "evidence" as Tab, label: "Evidence", icon: FolderOpen },
          { key: "skills" as Tab, label: "Skills Map", icon: Grid3X3 },
          { key: "publish" as Tab, label: "Publish", icon: ExternalLink },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-[#fb923c] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError("")}><X size={14} /></button>
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-2">
          <CheckCircle2 size={14} />
          {success}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading career vault...</p>
      ) : (
        <>
          {/* ─── INITIATIVES TAB ─────────────────────────────── */}
          {tab === "initiatives" && (
            <div className="space-y-6">
              {/* Add Initiative Button */}
              <div className="flex justify-end">
                <button
                  onClick={openAddForm}
                  className="flex items-center gap-2 px-4 py-2 bg-[#fb923c] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <Plus size={16} /> Add Initiative
                </button>
              </div>

              {/* Modal */}
              {showForm && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 bg-black/50 overflow-y-auto">
                  <div className="w-full max-w-2xl mx-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] shadow-2xl">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                      <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                        {editingId ? "Edit Initiative" : "New Initiative"}
                      </h2>
                      <button onClick={closeForm} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                        <X size={20} />
                      </button>
                    </div>

                    <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
                      {formError && (
                        <div className="px-3 py-2 rounded-lg bg-[rgba(248,113,113,0.12)] border border-[rgba(248,113,113,0.3)] text-sm text-[#f87171]">
                          {formError}
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Title *</label>
                        <input
                          value={form.title}
                          onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                          placeholder="e.g., Apple Pay NFC Integration"
                          className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">One-liner</label>
                        <input
                          value={form.one_liner}
                          onChange={e => setForm(p => ({ ...p, one_liner: e.target.value }))}
                          placeholder="Brief summary of the initiative"
                          className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Company</label>
                          <select
                            value={form.company}
                            onChange={e => setForm(p => ({ ...p, company: e.target.value }))}
                            className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)]"
                          >
                            <option value="">Select...</option>
                            {VALID_COMPANIES.map(c => (
                              <option key={c} value={c}>{COMPANY_LABELS[c] || c}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Role</label>
                          <input
                            value={form.role}
                            onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                            placeholder="VP of Product"
                            className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Era</label>
                          <select
                            value={form.era}
                            onChange={e => setForm(p => ({ ...p, era: e.target.value }))}
                            className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)]"
                          >
                            <option value="">Select...</option>
                            {VALID_ERAS.map(e => (
                              <option key={e} value={e}>{ERA_LABELS[e] || e}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Year Start</label>
                          <input
                            type="number"
                            value={form.year_start}
                            onChange={e => setForm(p => ({ ...p, year_start: e.target.value }))}
                            placeholder="2020"
                            className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Year End</label>
                          <input
                            type="number"
                            value={form.year_end}
                            onChange={e => setForm(p => ({ ...p, year_end: e.target.value }))}
                            placeholder="2023 (blank = present)"
                            className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Domains</label>
                        <div className="flex flex-wrap gap-1.5">
                          {VALID_DOMAINS.map(d => {
                            const selected = form.domains.includes(d);
                            const color = DOMAIN_COLORS[d] || "#94a3b8";
                            return (
                              <button
                                key={d}
                                type="button"
                                onClick={() => toggleDomain(d)}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all border"
                                style={{
                                  color: selected ? "#0a0a0a" : color,
                                  backgroundColor: selected ? color : `${color}12`,
                                  borderColor: selected ? color : `${color}30`,
                                }}
                              >
                                {d}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Tags (comma-separated)</label>
                        <input
                          value={form.tags}
                          onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
                          placeholder="nfc, mobile-payments, ios"
                          className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                        />
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Four-Beat Narrative</h3>
                        {[
                          { key: "problem", label: "The Problem", color: "#f87171", placeholder: "What was broken or needed to change?" },
                          { key: "bet", label: "The Bet", color: "#fbbf24", placeholder: "What was the hypothesis or strategic decision?" },
                          { key: "shipped", label: "What Shipped", color: "#34d399", placeholder: "What was actually built and delivered?" },
                          { key: "outcome", label: "The Outcome", color: "#60a5fa", placeholder: "What happened? Metrics, impact, results." },
                        ].map(beat => (
                          <div key={beat.key}>
                            <label className="block text-xs font-medium mb-1" style={{ color: beat.color }}>{beat.label}</label>
                            <textarea
                              value={(form as any)[beat.key]}
                              onChange={e => setForm(p => ({ ...p, [beat.key]: e.target.value }))}
                              placeholder={beat.placeholder}
                              rows={2}
                              className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Headline Metric Number</label>
                          <input
                            value={form.headline_metric_number}
                            onChange={e => setForm(p => ({ ...p, headline_metric_number: e.target.value }))}
                            placeholder="27.5M"
                            className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Headline Metric Label</label>
                          <input
                            value={form.headline_metric_label}
                            onChange={e => setForm(p => ({ ...p, headline_metric_label: e.target.value }))}
                            placeholder="active users"
                            className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-[var(--text-muted)]">Outcome Metrics</label>
                          <button type="button" onClick={addMetric} className="text-xs text-[#fb923c] hover:underline">
                            + Add metric
                          </button>
                        </div>
                        {form.outcome_metrics.map((m, idx) => (
                          <div key={idx} className="flex items-center gap-2 mb-2">
                            <input
                              value={m.number}
                              onChange={e => updateMetric(idx, "number", e.target.value)}
                              placeholder="27.5M"
                              className="w-28 px-3 py-1.5 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                            />
                            <input
                              value={m.label}
                              onChange={e => updateMetric(idx, "label", e.target.value)}
                              placeholder="Active users"
                              className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                            />
                            <button type="button" onClick={() => removeMetric(idx)} className="text-[var(--text-muted)] hover:text-[#f87171]">
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-6">
                        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
                          <input type="checkbox" checked={form.public} onChange={e => setForm(p => ({ ...p, public: e.target.checked }))} className="rounded" />
                          Public
                        </label>
                        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
                          <input type="checkbox" checked={form.fenix_indexed} onChange={e => setForm(p => ({ ...p, fenix_indexed: e.target.checked }))} className="rounded" />
                          Fenix Indexed
                        </label>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1 flex items-center gap-1">
                          <Link2 size={12} /> Closes Gap ID (optional)
                        </label>
                        <input
                          value={form.closed_gap_id}
                          onChange={e => setForm(p => ({ ...p, closed_gap_id: e.target.value }))}
                          placeholder="Mind the Gap item ID this initiative closes"
                          className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border)]">
                      <button onClick={closeForm} className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]">
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-[#fb923c] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
                      >
                        <Save size={14} />
                        {saving ? "Saving..." : editingId ? "Update" : "Create"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Coverage Map */}
              <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3 flex items-center gap-2">
                  <BarChart3 size={14} /> Domain Coverage Map
                </h2>
                <div className="flex flex-wrap gap-2">
                  {domains.map(d => {
                    const color = DOMAIN_COLORS[d.domain] || "#94a3b8";
                    const isActive = filterDomain === d.domain;
                    return (
                      <button
                        key={d.domain}
                        onClick={() => setFilterDomain(isActive ? "" : d.domain)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
                        style={{
                          color: isActive ? "#0a0a0a" : color,
                          backgroundColor: isActive ? color : `${color}15`,
                          borderColor: isActive ? color : `${color}30`,
                        }}
                      >
                        {d.domain} ({d.count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Company Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {Object.entries(companyBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .map(([company, count]) => {
                    const color = COMPANY_COLORS[company] || "#94a3b8";
                    const isActive = filterCompany === company;
                    return (
                      <button
                        key={company}
                        onClick={() => setFilterCompany(isActive ? "" : company)}
                        className="px-4 py-3 rounded-xl border transition-all text-left"
                        style={{
                          borderColor: isActive ? color : "var(--border)",
                          backgroundColor: isActive ? `${color}15` : "var(--bg-secondary)",
                        }}
                      >
                        <div className="text-2xl font-bold" style={{ color }}>{count}</div>
                        <div className="text-xs text-[var(--text-muted)]">
                          {COMPANY_LABELS[company] || company}
                        </div>
                      </button>
                    );
                  })}
              </div>

              {/* Search + Filters */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    placeholder="Search initiatives..."
                    className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                  />
                </div>
                <Filter size={14} className="text-[var(--text-muted)]" />
                <select
                  value={filterEra}
                  onChange={e => setFilterEra(e.target.value)}
                  className="px-3 py-1.5 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)]"
                >
                  <option value="">All Eras</option>
                  {Object.entries(ERA_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
                {(filterDomain || filterCompany || filterEra) && (
                  <button
                    onClick={() => { setFilterDomain(""); setFilterCompany(""); setFilterEra(""); }}
                    className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    Clear filters
                  </button>
                )}
                <span className="text-xs text-[var(--text-muted)] ml-auto">
                  {initiatives.length} initiative{initiatives.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Initiative Cards */}
              {initiatives.length === 0 ? (
                <div className="text-center py-16 text-[var(--text-muted)]">
                  <Briefcase size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No initiatives match your filters.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {initiatives.map(init => {
                    const isExpanded = expandedId === init.id;
                    const companyColor = COMPANY_COLORS[init.company] || "#94a3b8";

                    return (
                      <div
                        key={init.id}
                        className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden transition-all hover:border-[var(--text-muted)]"
                      >
                        <div
                          className="flex items-start gap-3 px-4 py-3 cursor-pointer"
                          onClick={() => setExpandedId(isExpanded ? null : init.id)}
                        >
                          <button className="mt-1 shrink-0">
                            {isExpanded
                              ? <ChevronDown size={14} className="text-[var(--text-muted)]" />
                              : <ChevronRight size={14} className="text-[var(--text-muted)]" />
                            }
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-sm font-medium text-[var(--text-primary)] truncate">
                                {init.title}
                              </h3>
                              {init.headline_metric_number && (
                                <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-bold"
                                  style={{ color: companyColor, backgroundColor: `${companyColor}18` }}>
                                  {init.headline_metric_number} {init.headline_metric_label}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[var(--text-muted)] truncate">{init.one_liner}</p>
                          </div>

                          <span className="shrink-0 px-2 py-0.5 rounded-full text-xs"
                            style={{ color: companyColor, backgroundColor: `${companyColor}18` }}>
                            {COMPANY_LABELS[init.company] || init.company}
                          </span>

                          <span className="shrink-0 flex items-center gap-1 text-xs text-[var(--text-muted)]">
                            <Calendar size={10} />
                            {init.year_start}{init.year_end ? `–${init.year_end}` : ""}
                          </span>
                        </div>

                        <div className="px-4 pb-2 flex gap-1.5 flex-wrap">
                          {init.domains.map(d => (
                            <span key={d} className="px-2 py-0.5 rounded-full text-[10px]"
                              style={{
                                color: DOMAIN_COLORS[d] || "#94a3b8",
                                backgroundColor: `${DOMAIN_COLORS[d] || "#94a3b8"}15`,
                              }}>
                              {d}
                            </span>
                          ))}
                        </div>

                        {isExpanded && (
                          <div className="px-4 pb-4 pt-2 border-t border-[var(--border)] space-y-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); openEditForm(init); }}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] transition-colors"
                              >
                                <Pencil size={12} /> Edit
                              </button>
                              {deletingId === init.id ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-[#f87171]">Delete this initiative?</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(init.id); }}
                                    className="px-3 py-1.5 text-xs rounded-lg bg-[#f87171] text-white hover:opacity-90"
                                  >
                                    Yes, delete
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDeletingId(null); }}
                                    className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-muted)]"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDeletingId(init.id); }}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[#f87171] hover:border-[#f87171] transition-colors"
                                >
                                  <Trash2 size={12} /> Delete
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                              <MapPin size={12} className="text-[var(--text-muted)]" />
                              {init.role} at {COMPANY_LABELS[init.company] || init.company}
                              {init.era && (
                                <span className="px-2 py-0.5 rounded-full bg-[var(--bg-primary)] text-[var(--text-muted)]">
                                  {ERA_LABELS[init.era] || init.era}
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                              {[
                                { label: "The Problem", text: init.problem, color: "#f87171" },
                                { label: "The Bet", text: init.bet, color: "#fbbf24" },
                                { label: "What Shipped", text: init.shipped, color: "#34d399" },
                                { label: "The Outcome", text: init.outcome, color: "#60a5fa" },
                              ].filter(b => b.text).map(beat => (
                                <div key={beat.label}>
                                  <h4 className="text-xs font-semibold uppercase tracking-wider mb-1"
                                    style={{ color: beat.color }}>{beat.label}</h4>
                                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                                    {beat.text}
                                  </p>
                                </div>
                              ))}
                            </div>

                            {init.outcome_metrics && init.outcome_metrics.length > 0 && (
                              <div className="flex flex-wrap gap-3">
                                {init.outcome_metrics.map((m, i) => (
                                  <div key={i} className="px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)]">
                                    <div className="text-lg font-bold text-[var(--text-primary)]">{m.number}</div>
                                    <div className="text-xs text-[var(--text-muted)]">{m.label}</div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {init.tags.length > 0 && (
                              <div className="flex gap-1.5 flex-wrap">
                                <Tag size={12} className="text-[var(--text-muted)] mt-0.5" />
                                {init.tags.map(tag => (
                                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-primary)] text-[var(--text-muted)]">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}

                            {init.closed_gap_id && (
                              <div className="flex items-center gap-2 text-xs text-[#34d399]">
                                <Link2 size={12} />
                                Closes gap: {init.closed_gap_id}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─── EVIDENCE TAB ────────────────────────────────── */}
          {tab === "evidence" && (
            <div className="space-y-4">
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
                {SOURCE_TYPES.map(t => (
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
                  onClick={() => { setEditingSource(null); setShowSourceModal(true); }}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#7CADE8] text-white hover:opacity-90 transition-all"
                >
                  <Plus size={14} /> Add Evidence
                </button>
              </div>

              <div className="space-y-2">
                {filteredSources.map(s => {
                  const typeInfo = SOURCE_TYPES.find(t => t.value === s.type);
                  const sourceLinks = links.filter(l => l.source_id === s.id);
                  const skillMap = Object.fromEntries(skillsTax.map(sk => [sk.id, sk.label]));

                  return (
                    <div
                      key={s.id}
                      className="group flex items-center gap-4 rounded-xl p-4 transition-all hover:bg-[var(--bg-secondary)]"
                      style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}
                    >
                      <div
                        className="w-2 h-10 rounded-full flex-shrink-0"
                        style={{ backgroundColor: typeInfo?.color || "#888" }}
                      />
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
                            {sourceLinks.slice(0, 6).map(l => (
                              <span
                                key={l.id}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-primary)] text-[var(--text-muted)]"
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
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={() => { setEditingSource(s); setShowSourceModal(true); }}
                          className="p-2 rounded-lg hover:bg-[var(--bg-primary)] transition-all"
                          title="Edit"
                        >
                          <Pencil size={14} className="text-[var(--text-muted)]" />
                        </button>
                        <button
                          onClick={() => handleDeleteSource(s.id)}
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
            </div>
          )}

          {/* ─── SKILLS MAP TAB ──────────────────────────────── */}
          {tab === "skills" && (
            <div className="space-y-6">
              {/* Mapper Section */}
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Source-Skill Mapping</h2>

                {/* Type selector */}
                <div className="flex gap-2 mb-6 flex-wrap">
                  {SOURCE_TYPES.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setTypeFilter(t.value)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        typeFilter === t.value
                          ? "text-white"
                          : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                      }`}
                      style={typeFilter === t.value ? { backgroundColor: t.color } : {}}
                    >
                      {t.label} ({sources.filter(s => s.type === t.value).length})
                    </button>
                  ))}
                </div>

                {/* Grid */}
                {typeFilter && (
                  <div className="overflow-x-auto border border-[var(--border)] rounded-xl">
                    <table className="w-full text-xs">
                      <thead>
                        <tr>
                          <th className="text-left p-2 text-[var(--text-muted)] font-medium sticky left-0 bg-[var(--bg-primary)] min-w-[200px]">
                            Source
                          </th>
                          {domainsTax.map(d =>
                            skillsTax
                              .filter(s => s.domain_id === d.id)
                              .map(s => (
                                <th
                                  key={s.id}
                                  className="p-1 text-center font-medium min-w-[32px]"
                                  style={{ color: d.color }}
                                  title={s.label}
                                >
                                  <div style={{ writingMode: "vertical-lr", transform: "rotate(180deg)", height: "80px" }} className="text-[10px] whitespace-nowrap">
                                    {s.label}
                                  </div>
                                </th>
                              ))
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSources.map(source => (
                          <tr key={source.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-secondary)]">
                            <td className="p-2 text-[var(--text-primary)] font-medium sticky left-0 bg-[var(--bg-primary)]">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-1.5 h-4 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: SOURCE_TYPES.find(t => t.value === source.type)?.color || "#888" }}
                                />
                                {source.label}
                              </div>
                            </td>
                            {domainsTax.map(d =>
                              skillsTax
                                .filter(s => s.domain_id === d.id)
                                .map(skill => {
                                  const linked = links.some(l => l.source_id === source.id && l.skill_id === skill.id);
                                  return (
                                    <td key={skill.id} className="p-1 text-center">
                                      <button
                                        onClick={() => handleToggleLink(source.id, skill.id)}
                                        className={`w-6 h-6 rounded transition-all ${
                                          linked
                                            ? "bg-[#7CADE8] hover:opacity-80"
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
                )}
              </div>

              {/* Taxonomy Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                    Domains & Skills ({domainsTax.length} domains, {skillsTax.length} skills)
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditingDomain(null); setShowDomainModal(true); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                    >
                      <Plus size={14} /> Domain
                    </button>
                    <button
                      onClick={() => { setEditingSkill(null); setShowSkillModal(true); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#7CADE8] text-white hover:opacity-90 transition-all"
                    >
                      <Plus size={14} /> Skill
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {domainsTax.map(d => {
                    const domainSkills = skillsTax.filter(s => s.domain_id === d.id);
                    return (
                      <div
                        key={d.id}
                        className="rounded-xl overflow-hidden"
                        style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}
                      >
                        <div className="group flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                          <span className="text-sm font-semibold text-[var(--text-primary)] flex-1">
                            {d.label}
                          </span>
                          <span className="text-xs text-[var(--text-muted)]">
                            {domainSkills.length} skill{domainSkills.length !== 1 ? "s" : ""}
                          </span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => { setEditingDomain(d); setShowDomainModal(true); }} className="p-1.5 rounded hover:bg-[var(--bg-primary)]">
                              <Pencil size={12} className="text-[var(--text-muted)]" />
                            </button>
                            <button onClick={() => handleDeleteDomain(d.id)} className="p-1.5 rounded hover:bg-red-500/10">
                              <Trash2 size={12} className="text-red-400" />
                            </button>
                          </div>
                        </div>
                        <div className="divide-y divide-[var(--border)]">
                          {domainSkills.map(s => (
                            <div key={s.id} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-primary)] transition-all">
                              <span className="text-sm text-[var(--text-secondary)] flex-1">{s.label}</span>
                              <span className="text-[10px] text-[var(--text-muted)] font-mono">{s.id}</span>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                <button onClick={() => { setEditingSkill(s); setShowSkillModal(true); }} className="p-1 rounded hover:bg-[var(--bg-secondary)]">
                                  <Pencil size={12} className="text-[var(--text-muted)]" />
                                </button>
                                <button onClick={() => handleDeleteSkill(s.id)} className="p-1 rounded hover:bg-red-500/10">
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
              </div>
            </div>
          )}

          {/* ─── PUBLISH TAB ────────────────────────────────── */}
          {tab === "publish" && (
            <div className="max-w-2xl">
              <div
                className="rounded-xl p-6"
                style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}
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
                    <div className="rounded-lg p-3 bg-[var(--bg-primary)]">
                      <span className="text-xs text-[var(--text-muted)]">Sources</span>
                      <p className="text-lg font-bold text-[var(--text-primary)]">{stats.total_sources}</p>
                    </div>
                    <div className="rounded-lg p-3 bg-[var(--bg-primary)]">
                      <span className="text-xs text-[var(--text-muted)]">Skill Mappings</span>
                      <p className="text-lg font-bold text-[var(--text-primary)]">{stats.total_links}</p>
                    </div>
                    <div className="rounded-lg p-3 bg-[var(--bg-primary)]">
                      <span className="text-xs text-[var(--text-muted)]">Skills</span>
                      <p className="text-lg font-bold text-[var(--text-primary)]">{stats.total_skills}</p>
                    </div>
                    <div className="rounded-lg p-3 bg-[var(--bg-primary)]">
                      <span className="text-xs text-[var(--text-muted)]">Domains</span>
                      <p className="text-lg font-bold text-[var(--text-primary)]">{stats.total_domains}</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handlePreview}
                    disabled={publishing}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all disabled:opacity-50"
                  >
                    {publishing ? <Loader2 size={16} className="animate-spin" /> : <FileSearch size={16} />}
                    Preview
                  </button>
                  <button
                    onClick={handlePublish}
                    disabled={publishing}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-[#7CADE8] text-white hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {publishing ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
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
          domains={domainsTax}
          onSave={handleSaveSkill}
          onClose={() => { setShowSkillModal(false); setEditingSkill(null); }}
        />
      )}
    </div>
  );
}

/* ── Modals ────────────────────────────────────────────── */

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-lg mx-4 rounded-xl p-6"
        style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-primary)]">
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
        className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[#7CADE8] transition-colors"
      />
    </div>
  );
}

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
            className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[#7CADE8]"
          >
            {SOURCE_TYPES.map(t => (
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
          <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-[#7CADE8] text-white hover:opacity-90">
            <Save size={14} className="inline mr-1.5" />
            {source ? "Update" : "Create"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

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
          <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-[#7CADE8] text-white hover:opacity-90">
            <Save size={14} className="inline mr-1.5" />
            {domain ? "Update" : "Create"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

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
            className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[#7CADE8]"
          >
            {domains.map(d => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </div>

        <InputField label="Sort Order" value={sortOrder} onChange={setSortOrder} type="number" />

        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[var(--text-muted)]">
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-[#7CADE8] text-white hover:opacity-90">
            <Save size={14} className="inline mr-1.5" />
            {skill ? "Update" : "Create"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
