"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Crosshair,
  Play,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Target,
  TrendingUp,
  TrendingDown,
  FileText,
  ChevronDown,
  ChevronRight,
  BarChart3,
  ArrowRight,
  Send,
  Layers,
  Building2,
  Plus,
  Link2,
  Briefcase,
  X,
  Save,
  Pencil,
  Trash2,
  Filter,
  Star,
  ExternalLink,
  GraduationCap,
  Compass,
  Zap,
  Lightbulb,
  BookOpen,
  Wrench,
  XCircle,
  Route,
  ChevronUp,
  Circle,
  CheckCircle,
  Map,
  Sparkles,
  MessageSquare,
  Package,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ── Types ──────────────────────────────────────────────── */

interface EvidenceRef {
  initiative_id: string;
  title: string;
  company: string;
  metric: string;
  relevance_explanation: string;
}

interface RequirementCoverage {
  requirement: string;
  category: string;
  signal_strength: string;
  coverage: string;
  evidence: EvidenceRef[];
  gap_note?: string;
  fill_tier?: string;
  fill_action?: string;
  fill_time_estimate?: string;
  fill_output?: string;
}

interface CoverageSummary {
  total_requirements: number;
  strong: number;
  partial: number;
  articulable: number;
  gaps: number;
  coverage_pct: number;
}

interface Report {
  report_id: string;
  company?: string;
  role_title?: string;
  requirements: RequirementCoverage[];
  coverage_summary: CoverageSummary;
  created_at: string;
  gaps_pushed: number;
}

interface ReportListItem {
  report_id: string;
  company?: string;
  role_title?: string;
  coverage_summary: CoverageSummary;
  created_at: string;
  gaps_pushed: number;
}

interface AggregateSummary {
  total_jds_analyzed: number;
  total_reports?: number;
  strong_domains: string[];
  weak_domains: string[];
  structural_gaps: {
    requirement: string;
    canonical_key: string;
    count: number;
    total_reports: number;
    frequency_pct: number;
    current_coverage: string;
  }[];
  top_strengths?: {
    skill: string;
    canonical_key: string;
    count: number;
    frequency_pct: number;
    coverage: string;
  }[];
  filters?: {
    seniority_level: string | null;
    role_focus: string | null;
  };
}

interface Company {
  name: string;
  tier: string;
  domain: string;
  notes: string;
}

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
  resolution_type: string | null;
  resolution_note: string | null;
  // Source tracking
  source_jd_company?: string | null;
  source_jd_role?: string | null;
  // Fill strategy
  fill_tier?: string | null;
  fill_action?: string | null;
  fill_time_estimate?: string | null;
  fill_output?: string | null;
  // Downstream
  closed_by_initiative_id?: string | null;
  // Interview prep
  interview_questions?: { question: string; why_they_ask: string; signal: string; }[];
  prepared_answers?: { question: string; situation: string; task: string; action: string; result: string; }[];
}

interface GapStats {
  by_category: Record<string, number>;
  by_priority: Record<string, number>;
  by_status: Record<string, number>;
  total: number;
}

/* ── Constants ──────────────────────────────────────────── */

const COVERAGE_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: typeof CheckCircle2 }> = {
  strong:      { label: "Strong",      color: "#34d399", bg: "rgba(52,211,153,0.12)",   Icon: CheckCircle2 },
  partial:     { label: "Partial",     color: "#fbbf24", bg: "rgba(251,191,36,0.12)",   Icon: TrendingUp },
  articulable: { label: "Articulable", color: "#60a5fa", bg: "rgba(96,165,250,0.12)",   Icon: FileText },
  gap:         { label: "Gap",         color: "#f87171", bg: "rgba(248,113,113,0.12)",  Icon: AlertTriangle },
};

const TIER_CONFIG: Record<string, { label: string; color: string; time: string }> = {
  "articulate":  { label: "Articulate",  color: "#34d399", time: "~hours" },
  "build-proof": { label: "Build Proof", color: "#fbbf24", time: "~days" },
  "certify":     { label: "Certify",     color: "#fb923c", time: "~weeks" },
  "true-gap":    { label: "True Gap",    color: "#f87171", time: "strategic" },
};

const CATEGORY_LABELS: Record<string, string> = {
  experience: "Experience",
  domain: "Domain",
  skill: "Skill",
  tool: "Tool",
};

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

const SENIORITY_OPTIONS = [
  { value: "ic", label: "IC (Senior/Staff)" },
  { value: "manager", label: "Manager" },
  { value: "director", label: "Director" },
  { value: "vp-plus", label: "VP / Head of" },
];

const ROLE_FOCUS_OPTIONS = [
  { value: "ai-ml", label: "AI / ML" },
  { value: "growth", label: "Growth" },
  { value: "consumer", label: "Consumer" },
  { value: "platform", label: "Platform" },
  { value: "enterprise", label: "Enterprise" },
  { value: "infrastructure", label: "Infrastructure" },
];

const COMPANY_TIER_CONFIG: Record<string, { label: string; color: string; icon: typeof Star }> = {
  dream:      { label: "Dream",      color: "#a78bfa", icon: Star },
  target:     { label: "Target",     color: "#60a5fa", icon: Target },
  consulting: { label: "Consulting", color: "#fbbf24", icon: Briefcase },
  stretch:    { label: "Stretch",    color: "#94a3b8", icon: Target },
};

const DOMAIN_CONFIG: Record<string, { label: string; color: string }> = {
  ai:         { label: "AI",          color: "#a78bfa" },
  "big-tech": { label: "Big Tech",    color: "#60a5fa" },
  consumer:   { label: "Consumer",    color: "#34d399" },
  fintech:    { label: "Fintech",     color: "#fb923c" },
  saas:       { label: "SaaS",        color: "#818cf8" },
  commerce:   { label: "Commerce",    color: "#67e8f9" },
  consulting: { label: "Consulting",  color: "#fbbf24" },
};

const FALLBACK_COMPANIES = [
  "Anthropic", "OpenAI", "Google", "Apple", "NVIDIA",
  "Airbnb", "Uber", "Netflix", "Disney", "Meta",
  "Snap", "Canva", "Adobe", "Intuit", "ServiceNow",
  "Asana", "Figma", "Shopify", "Stripe", "Block",
  "Ramp", "Robinhood", "Spotify", "DoorDash", "Duolingo",
  "McKinsey", "BCG", "Deloitte", "Bain", "Microsoft",
];

/* ── Component ──────────────────────────────────────────── */

export default function GapDiscoveryPage() {
  const [tab, setTab] = useState<"companies" | "analyze" | "gaps" | "reports" | "intelligence" | "closure" | "credentialing">("companies");

  // ─── Companies Tab State ───────────────────────────────

  const [companies, setCompanies] = useState<Company[]>([]);
  const [byTier, setByTier] = useState<Record<string, number>>({});
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [filterTier, setFilterTier] = useState("");
  const [filterDomain, setFilterDomain] = useState("");

  // Add company form
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyTier, setNewCompanyTier] = useState("target");
  const [newCompanyDomain, setNewCompanyDomain] = useState("");
  const [newCompanyNotes, setNewCompanyNotes] = useState("");
  const [savingCompany, setSavingCompany] = useState(false);

  // Edit company
  const [editingCompanyName, setEditingCompanyName] = useState<string | null>(null);
  const [editCompanyTier, setEditCompanyTier] = useState("");
  const [editCompanyDomain, setEditCompanyDomain] = useState("");
  const [editCompanyNotes, setEditCompanyNotes] = useState("");

  // Delete confirm
  const [deletingCompanyName, setDeletingCompanyName] = useState<string | null>(null);

  // ─── Pipeline Reset + Manual JD Feed State ────────────
  const [resettingPipeline, setResettingPipeline] = useState(false);
  const [pipelineResetResult, setPipelineResetResult] = useState<any>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [jdPasteForCompany, setJdPasteForCompany] = useState<string | null>(null);
  const [pastedJdText, setPastedJdText] = useState("");
  const [pastedRoleTitle, setPastedRoleTitle] = useState("");
  const [feedingJd, setFeedingJd] = useState(false);

  // ─── Analyze Tab State ─────────────────────────────────

  const [jdText, setJdText] = useState("");
  const [company, setCompany] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [seniorityLevel, setSeniorityLevel] = useState("ic");
  const [roleFocus, setRoleFocus] = useState("");
  const [pushToGaps, setPushToGaps] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [currentReport, setCurrentReport] = useState<Report | null>(null);
  const [expandedReq, setExpandedReq] = useState<number | null>(null);
  const [filterCoverage, setFilterCoverage] = useState<string | null>(null);

  // Create initiative from gap
  const [creatingFromGap, setCreatingFromGap] = useState<RequirementCoverage | null>(null);
  const [gapInitTitle, setGapInitTitle] = useState("");
  const [gapInitOneLiner, setGapInitOneLiner] = useState("");
  const [gapInitSaving, setGapInitSaving] = useState(false);
  const [gapInitSuccess, setGapInitSuccess] = useState<string | null>(null);

  // ─── Gaps Tab State ────────────────────────────────────

  const [gapItems, setGapItems] = useState<GapItem[]>([]);
  const [gapStats, setGapStats] = useState<GapStats | null>(null);
  const [gapCategoryFilter, setGapCategoryFilter] = useState<string | null>(null);
  const [gapStatusFilter, setGapStatusFilter] = useState<string | null>(null);
  const [showClosedGaps, setShowClosedGaps] = useState(false);

  // ─── Reports Tab State ─────────────────────────────────

  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  // ─── Intelligence Tab State ────────────────────────────

  const [aggregate, setAggregate] = useState<AggregateSummary | null>(null);
  const [aggregateLoading, setAggregateLoading] = useState(false);

  // ─── Close the Gap Tab State ──────────────────────────

  const [closurePlans, setClosurePlans] = useState<any[]>([]);
  const [closurePlansLoading, setClosurePlansLoading] = useState(false);
  const [prioritizedGaps, setPrioritizedGaps] = useState<any[]>([]);
  const [prioritizedLoading, setPrioritizedLoading] = useState(false);
  const [selectedGapForClosure, setSelectedGapForClosure] = useState<string>("");
  const [selectedCompanyForClosure, setSelectedCompanyForClosure] = useState<string>("");
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [activePlan, setActivePlan] = useState<any | null>(null);
  const [activePlanLoading, setActivePlanLoading] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>("company_assessment");
  const [generatingPrep, setGeneratingPrep] = useState<string | null>(null); // gap_id being generated

  // ─── Moves State ──────────────────────────────────────
  interface MoveStepResource { title: string; url?: string; type: string; what_to_extract?: string; }
  interface MoveStep { title: string; description: string; time: string; produces: string; status: string; notes?: string; completed_at?: string | null; index: number; what_good_looks_like?: string; prototype_idea?: string | null; vault_fields_fed?: string[]; resources?: MoveStepResource[]; }
  interface InterviewStory { question: string; story_title: string; situation: string; task: string; action: string; result: string; follow_ups: { question: string; answer_guidance: string }[]; source_initiatives: string[]; confidence: string; }
  interface VaultRecordDraft { type: string; name: string; tagline: string; description: string; tech_stack: string[]; display_skills: string[]; highlight: string; status: string; learned: string; capstone: string; }
  interface Move { id: string; title: string; move_type: string; estimated_time: string; gap_ids: string[]; resolution_type: string; status: string; steps: MoveStep[]; sort_order: number; notes: string; created_at: string; updated_at: string; completed_at: string | null; vault_record_draft?: VaultRecordDraft; interview_stories?: InterviewStory[]; enriched_at?: string | null; }
  interface MovesProgress { total_moves: number; completed_moves: number; in_progress_moves: number; total_gaps_covered: number; gaps_closed: number; gap_closure_pct: number; readiness: { baseline_pct: number; current_pct: number; total_gaps: number; resolved_gaps: number; tier_breakdown: Record<string, { count: number; credit: number }>; }; moves: { id: string; title: string; status: string; steps_done: number; steps_total: number; progress_pct: number; gaps_covered: number; }[]; }

  const [moves, setMoves] = useState<Move[]>([]);
  const [movesProgress, setMovesProgress] = useState<MovesProgress | null>(null);
  const [movesLoading, setMovesLoading] = useState(false);
  const [expandedMove, setExpandedMove] = useState<string | null>(null);
  const [togglingStep, setTogglingStep] = useState<string | null>(null);
  const [enrichingMove, setEnrichingMove] = useState<string | null>(null);
  const [closureSubTab, setClosureSubTab] = useState<"moves" | "plans" | "companies">("moves");

  // ─── Company Readiness State ──────────────────────────
  interface CompanyReadiness {
    company: string;
    roles: string[];
    total_gaps: number;
    resolved_gaps: number;
    readiness_pct: number;
    gaps_by_priority: Record<string, number>;
    gaps_by_resolution: Record<string, number>;
    open_gaps: { id: string; title: string; priority: string; category: string; fill_tier: string | null; fill_action: string | null; }[];
  }
  const [companyReadiness, setCompanyReadiness] = useState<CompanyReadiness[]>([]);
  const [companyReadinessLoading, setCompanyReadinessLoading] = useState(false);
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);

  // ─── Lens Filters (shared across Reports + Intelligence) ──

  const [lensSeniority, setLensSeniority] = useState<string | null>(null);
  const [lensFocus, setLensFocus] = useState<string | null>(null);

  // ─── Load Companies ────────────────────────────────────

  const fetchCompanies = useCallback(async () => {
    setCompaniesLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterTier) params.set("tier", filterTier);
      if (filterDomain) params.set("domain", filterDomain);
      const res = await fetch(`${API}/api/target-companies/?${params}`);
      const data = await res.json();
      setCompanies(data.companies || []);
      setByTier(data.by_tier || {});
    } catch (e) {
      console.error("Failed to fetch companies:", e);
    } finally {
      setCompaniesLoading(false);
    }
  }, [filterTier, filterDomain]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  // ─── Company CRUD ──────────────────────────────────────

  const handleAddCompany = async () => {
    if (!newCompanyName.trim()) return;
    setSavingCompany(true);
    try {
      const res = await fetch(`${API}/api/target-companies/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCompanyName.trim(),
          tier: newCompanyTier,
          domain: newCompanyDomain,
          notes: newCompanyNotes.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.detail || "Failed to add");
        return;
      }
      setShowAddCompany(false);
      setNewCompanyName("");
      setNewCompanyTier("target");
      setNewCompanyDomain("");
      setNewCompanyNotes("");
      fetchCompanies();
    } catch (e) {
      console.error("Add failed:", e);
    } finally {
      setSavingCompany(false);
    }
  };

  const startEditCompany = (c: Company) => {
    setEditingCompanyName(c.name);
    setEditCompanyTier(c.tier);
    setEditCompanyDomain(c.domain);
    setEditCompanyNotes(c.notes);
  };

  const handleUpdateCompany = async () => {
    if (!editingCompanyName) return;
    try {
      const res = await fetch(`${API}/api/target-companies/${encodeURIComponent(editingCompanyName)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: editCompanyTier, domain: editCompanyDomain, notes: editCompanyNotes }),
      });
      if (!res.ok) throw new Error("Update failed");
      setEditingCompanyName(null);
      fetchCompanies();
    } catch (e) {
      console.error("Update failed:", e);
    }
  };

  const handleDeleteCompany = async (name: string) => {
    try {
      const res = await fetch(`${API}/api/target-companies/${encodeURIComponent(name)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setDeletingCompanyName(null);
      fetchCompanies();
    } catch (e) {
      console.error("Delete failed:", e);
    }
  };

  // ─── Manual JD Feed + Pipeline Reset ───────────────────

  const handleSubmitManualJd = async () => {
    if (!jdPasteForCompany || pastedJdText.trim().length < 50) return;
    setFeedingJd(true);
    try {
      const res = await fetch(`${API}/api/gap-discovery/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jd_text: pastedJdText.trim(),
          company: jdPasteForCompany,
          role_title: pastedRoleTitle.trim() || undefined,
          seniority_level: "ic",
          push_to_gaps: true,
        }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      alert(`Analysis complete! ${data.gaps_pushed || 0} gaps pushed. Coverage: ${data.coverage_summary?.coverage_pct || 0}%`);
      setJdPasteForCompany(null);
      setPastedJdText("");
      setPastedRoleTitle("");
    } catch (e) {
      console.error("JD analysis failed:", e);
      alert("Analysis failed. Check the console for details.");
    } finally {
      setFeedingJd(false);
    }
  };

  const handlePipelineReset = async () => {
    setResettingPipeline(true);
    setPipelineResetResult(null);
    try {
      const res = await fetch(`${API}/api/target-companies/pipeline/reset`, { method: "POST" });
      if (!res.ok) throw new Error("Reset failed");
      const data = await res.json();
      setPipelineResetResult(data);
      setShowResetConfirm(false);
    } catch (e) {
      console.error("Pipeline reset failed:", e);
      alert("Pipeline reset failed. Check the console.");
    } finally {
      setResettingPipeline(false);
    }
  };

  // ─── Analysis & Reports ────────────────────────────────

  const openGapToInitiative = (req: RequirementCoverage) => {
    setCreatingFromGap(req);
    setGapInitTitle(req.fill_output || req.requirement);
    setGapInitOneLiner(req.fill_action || "");
    setGapInitSuccess(null);
  };

  const closeGapToInitiative = () => {
    setCreatingFromGap(null);
    setGapInitTitle("");
    setGapInitOneLiner("");
    setGapInitSuccess(null);
  };

  const handleCreateInitiativeFromGap = async () => {
    if (!gapInitTitle.trim()) return;
    setGapInitSaving(true);
    try {
      const res = await fetch(`${API}/api/career-initiatives/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: gapInitTitle.trim(),
          one_liner: gapInitOneLiner.trim(),
          problem: creatingFromGap?.gap_note || "",
          bet: creatingFromGap?.fill_action || "",
          shipped: "",
          outcome: "",
          domains: [],
          tags: ["gap-closure"],
          public: false,
          fenix_indexed: false,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setGapInitSuccess(data.id);
    } catch (e) {
      console.error("Failed to create initiative:", e);
    } finally {
      setGapInitSaving(false);
    }
  };

  const handleAnalyze = async () => {
    if (!jdText.trim() || jdText.trim().length < 50) return;
    setAnalyzing(true);
    setCurrentReport(null);
    try {
      const res = await fetch(`${API}/api/gap-discovery/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jd_text: jdText.trim(),
          company: company.trim() || null,
          role_title: roleTitle.trim() || null,
          seniority_level: seniorityLevel || null,
          role_focus: roleFocus || null,
          push_to_gap_table: pushToGaps,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCurrentReport(data);
    } catch (e) {
      console.error("Analysis failed:", e);
      alert("Analysis failed. Make sure the CC backend is running and ANTHROPIC_API_KEY is set.");
    } finally {
      setAnalyzing(false);
    }
  };

  const fetchReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (lensSeniority) params.set("seniority_level", lensSeniority);
      if (lensFocus) params.set("role_focus", lensFocus);
      const res = await fetch(`${API}/api/gap-discovery/reports?${params}`);
      const data = await res.json();
      setReports(data.reports || []);
    } catch (e) {
      console.error("Failed to fetch reports:", e);
    } finally {
      setReportsLoading(false);
    }
  }, [lensSeniority, lensFocus]);

  const fetchAggregate = useCallback(async () => {
    setAggregateLoading(true);
    try {
      const params = new URLSearchParams();
      if (lensSeniority) params.set("seniority_level", lensSeniority);
      if (lensFocus) params.set("role_focus", lensFocus);
      const qs = params.toString();
      const res = await fetch(`${API}/api/gap-discovery/coverage-summary${qs ? `?${qs}` : ""}`);
      const data = await res.json();
      setAggregate(data);
    } catch (e) {
      console.error("Failed to fetch aggregate:", e);
    } finally {
      setAggregateLoading(false);
    }
  }, [lensSeniority, lensFocus]);

  const loadReport = async (reportId: string) => {
    try {
      const res = await fetch(`${API}/api/gap-discovery/reports/${reportId}`);
      const data = await res.json();
      setCurrentReport(data);
      setTab("analyze");
    } catch (e) {
      console.error("Failed to load report:", e);
    }
  };

  // ─── Load Gap Items ────────────────────────────────────

  const loadGapItems = useCallback(async () => {
    try {
      const [itemsRes, statsRes] = await Promise.all([
        fetch(`${API}/api/evidence/gap-items`),
        fetch(`${API}/api/evidence/gap-items/stats`),
      ]);
      const items = await itemsRes.json();
      const stats = await statsRes.json();
      setGapItems(items.entries ?? []);
      setGapStats(stats ?? { total: 0, by_category: {}, by_priority: {}, by_status: {} });
    } catch (e) {
      console.error("Failed to load gap items:", e);
    }
  }, []);

  const handleUpdateGapStatus = async (id: string, status: string) => {
    try {
      await fetch(`${API}/api/evidence/gap-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_status: status }),
      });
      setGapItems((prev) =>
        prev.map((g) => (g.id === id ? { ...g, current_status: status } : g))
      );
    } catch (e) {
      console.error("Failed to update status:", e);
    }
  };

  const handleCloseGap = async (id: string, resolutionType: string, note: string) => {
    try {
      const newStatus = resolutionType === "not-pursuing" ? "deprioritized" : "completed";
      await fetch(`${API}/api/evidence/gap-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_status: newStatus,
          resolution_type: resolutionType,
          resolution_note: note,
        }),
      });
      setGapItems((prev) =>
        prev.map((g) =>
          g.id === id
            ? { ...g, current_status: newStatus, resolution_type: resolutionType, resolution_note: note }
            : g
        )
      );
      // Auto-create vault entry for evidence-producing resolutions
      if (["built-proof", "certified", "reframed"].includes(resolutionType)) {
        try {
          await fetch(`${API}/api/evidence/gap-items/${id}/create-vault-entry`, { method: "POST" });
        } catch (vaultErr) {
          console.warn("Vault entry auto-creation failed (non-blocking):", vaultErr);
        }
      }
    } catch (e) {
      console.error("Failed to close gap:", e);
    }
  };

  // ─── Moves Fetchers ──────────────────────────────────

  const fetchMoves = useCallback(async () => {
    setMovesLoading(true);
    try {
      const [movesRes, progressRes] = await Promise.all([
        fetch(`${API}/api/gap-discovery/moves/`),
        fetch(`${API}/api/gap-discovery/moves/progress`),
      ]);
      const movesData = await movesRes.json();
      const progressData = await progressRes.json();
      setMoves(movesData || []);
      setMovesProgress(progressData);
    } catch (e) {
      console.error("Failed to fetch moves:", e);
    } finally {
      setMovesLoading(false);
    }
  }, []);

  const fetchCompanyReadiness = useCallback(async () => {
    setCompanyReadinessLoading(true);
    try {
      const res = await fetch(`${API}/api/gap-discovery/moves/company-readiness`);
      const data = await res.json();
      setCompanyReadiness(data || []);
    } catch (e) {
      console.error("Failed to fetch company readiness:", e);
    } finally {
      setCompanyReadinessLoading(false);
    }
  }, []);

  const seedMoves = async () => {
    try {
      await fetch(`${API}/api/gap-discovery/moves/seed`, { method: "POST" });
      fetchMoves();
    } catch (e) {
      console.error("Failed to seed moves:", e);
    }
  };

  const toggleStep = async (moveId: string, stepIndex: number, currentStatus: string) => {
    const newStatus = currentStatus === "completed" ? "pending" : "completed";
    setTogglingStep(`${moveId}-${stepIndex}`);
    try {
      await fetch(`${API}/api/gap-discovery/moves/${moveId}/steps/${stepIndex}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchMoves();
    } catch (e) {
      console.error("Failed to toggle step:", e);
    } finally {
      setTogglingStep(null);
    }
  };

  const completeMove = async (moveId: string) => {
    if (!confirm("Complete this move and resolve all linked gaps?")) return;
    try {
      const res = await fetch(`${API}/api/gap-discovery/moves/${moveId}/complete`, { method: "POST" });
      const data = await res.json();
      alert(`Move completed! ${data.gaps_resolved}/${data.total_gaps} gaps resolved.`);
      fetchMoves();
      loadGapItems();
    } catch (e) {
      console.error("Failed to complete move:", e);
    }
  };

  const handleEnrichMove = async (moveId: string) => {
    setEnrichingMove(moveId);
    try {
      const res = await fetch(`${API}/api/gap-discovery/moves/enrich/${moveId}`, { method: "POST" });
      if (!res.ok) throw new Error(`Enrichment failed: ${res.statusText}`);
      const enrichedMove = await res.json();
      setMoves(prev => prev.map(m => m.id === moveId ? enrichedMove : m));
    } catch (e) {
      console.error("Failed to enrich move:", e);
      alert("Move enrichment failed. Check console for details.");
    } finally {
      setEnrichingMove(null);
    }
  };

  // ─── Closure Tab Fetchers ─────────────────────────────

  const fetchClosurePlans = useCallback(async () => {
    setClosurePlansLoading(true);
    try {
      const res = await fetch(`${API}/api/gap-discovery/closure-plans/`);
      const data = await res.json();
      setClosurePlans(data.plans || []);
    } catch (e) {
      console.error("Failed to fetch closure plans:", e);
    } finally {
      setClosurePlansLoading(false);
    }
  }, []);

  const fetchPrioritizedGaps = useCallback(async () => {
    setPrioritizedLoading(true);
    try {
      const res = await fetch(`${API}/api/gap-discovery/closure-plans/prioritized`);
      const data = await res.json();
      setPrioritizedGaps(data || []);
    } catch (e) {
      console.error("Failed to fetch prioritized gaps:", e);
    } finally {
      setPrioritizedLoading(false);
    }
  }, []);

  const handleGenerateClosurePlan = async (gapIdOverride?: string) => {
    const gapId = gapIdOverride || selectedGapForClosure;
    if (!gapId) return;
    if (gapIdOverride) setSelectedGapForClosure(gapIdOverride);
    setGeneratingPlan(true);
    try {
      const res = await fetch(`${API}/api/gap-discovery/closure-plans/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gap_id: gapId }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      const plan = await res.json();
      setActivePlan(plan);
      setExpandedSection("company_assessment");
      fetchClosurePlans();
    } catch (e) {
      console.error("Failed to generate closure plan:", e);
      alert(`Failed to generate plan: ${e}`);
    } finally {
      setGeneratingPlan(false);
    }
  };

  const handleGenerateInterviewPrep = async (gapId: string) => {
    setGeneratingPrep(gapId);
    try {
      const res = await fetch(`${API}/api/gap-discovery/closure-plans/interview-prep/${gapId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      const result = await res.json();
      // Update the gap item in local state
      setGapItems(prev => prev.map(g =>
        g.id === gapId
          ? { ...g, interview_questions: result.interview_questions, prepared_answers: result.prepared_answers }
          : g
      ));
    } catch (e) {
      console.error("Failed to generate interview prep:", e);
      alert(`Failed to generate interview prep: ${e}`);
    } finally {
      setGeneratingPrep(null);
    }
  };

  const handleLoadPlan = async (planId: string) => {
    setActivePlanLoading(true);
    try {
      const res = await fetch(`${API}/api/gap-discovery/closure-plans/${planId}`);
      const plan = await res.json();
      setActivePlan(plan);
      setExpandedSection("company_assessment");
    } catch (e) {
      console.error("Failed to load plan:", e);
    } finally {
      setActivePlanLoading(false);
    }
  };

  const handleUpdateStepStatus = async (planId: string, stepIndex: number, status: string, note?: string) => {
    try {
      const res = await fetch(`${API}/api/gap-discovery/closure-plans/${planId}/step`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step_index: stepIndex, status, journal_note: note || null }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const updated = await res.json();
      setActivePlan(updated);
    } catch (e) {
      console.error("Failed to update step:", e);
    }
  };

  useEffect(() => {
    if (tab === "reports") fetchReports();
    if (tab === "intelligence") fetchAggregate();
    if (tab === "gaps") loadGapItems();
    if (tab === "closure") { fetchMoves(); fetchClosurePlans(); fetchPrioritizedGaps(); loadGapItems(); }
  }, [tab, fetchReports, fetchAggregate, loadGapItems, fetchMoves, fetchClosurePlans, fetchPrioritizedGaps, lensSeniority, lensFocus]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  // ─── Group companies by tier ───────────────────────────

  const groupedCompanies = companies.reduce((acc, c) => {
    const t = c.tier || "target";
    if (!acc[t]) acc[t] = [];
    acc[t].push(c);
    return acc;
  }, {} as Record<string, Company[]>);

  const tierOrder = ["dream", "target", "consulting", "stretch"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Crosshair size={24} className="text-[#f87171]" />
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">Mind the Gap</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Target companies, analyze JDs, manage gaps, and track coverage
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--border)] overflow-x-auto">
        {[
          { key: "companies", label: "Target Companies", icon: Building2 },
          { key: "analyze", label: "Analyze JD", icon: Play },
          { key: "gaps", label: "Current Gaps", icon: AlertTriangle },
          { key: "reports", label: "Past Reports", icon: FileText },
          { key: "intelligence", label: "Aggregate Intelligence", icon: BarChart3 },
          { key: "closure", label: "Close the Gap", icon: Route },
          { key: "credentialing", label: "Learning & Credentials", icon: GraduationCap },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors shrink-0 ${
              tab === t.key
                ? "border-[#f87171] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Target Companies Tab ───────────────────────── */}
      {tab === "companies" && (
        <div className="space-y-6">
          {/* Tier summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {tierOrder.map(t => {
              const cfg = COMPANY_TIER_CONFIG[t];
              if (!cfg) return null;
              const count = byTier[t] || 0;
              const isActive = filterTier === t;
              return (
                <button
                  key={t}
                  onClick={() => setFilterTier(isActive ? "" : t)}
                  className="px-4 py-3 rounded-xl border transition-all text-left"
                  style={{
                    borderColor: isActive ? cfg.color : "var(--border)",
                    backgroundColor: isActive ? `${cfg.color}15` : "var(--bg-secondary)",
                  }}
                >
                  <div className="text-2xl font-bold" style={{ color: cfg.color }}>{count}</div>
                  <div className="text-xs text-[var(--text-muted)]">{cfg.label}</div>
                </button>
              );
            })}
          </div>

          {/* Domain filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={14} className="text-[var(--text-muted)]" />
            <span className="text-xs text-[var(--text-muted)]">Domain:</span>
            {Object.entries(DOMAIN_CONFIG).map(([key, cfg]) => {
              const isActive = filterDomain === key;
              return (
                <button
                  key={key}
                  onClick={() => setFilterDomain(isActive ? "" : key)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all border"
                  style={{
                    color: isActive ? "#0a0a0a" : cfg.color,
                    backgroundColor: isActive ? cfg.color : `${cfg.color}12`,
                    borderColor: isActive ? cfg.color : `${cfg.color}30`,
                  }}
                >
                  {cfg.label}
                </button>
              );
            })}
            {(filterTier || filterDomain) && (
              <button
                onClick={() => { setFilterTier(""); setFilterDomain(""); }}
                className="px-2.5 py-1 text-xs rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                Clear
              </button>
            )}
          </div>

          {/* Add Company Button */}
          {!showAddCompany && (
            <button
              onClick={() => setShowAddCompany(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#60a5fa] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus size={16} /> Add Company
            </button>
          )}

          {/* Add form */}
          {showAddCompany && (
            <div className="p-5 rounded-xl border border-[#60a5fa40] bg-[var(--bg-secondary)] space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Add Target Company</h3>
                <button onClick={() => setShowAddCompany(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={newCompanyName}
                  onChange={e => setNewCompanyName(e.target.value)}
                  placeholder="Company name"
                  className="px-3 py-2 text-sm rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                />
                <select
                  value={newCompanyTier}
                  onChange={e => setNewCompanyTier(e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)]"
                >
                  {tierOrder.map(t => (
                    <option key={t} value={t}>{COMPANY_TIER_CONFIG[t]?.label || t}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={newCompanyDomain}
                  onChange={e => setNewCompanyDomain(e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)]"
                >
                  <option value="">Select domain...</option>
                  {Object.entries(DOMAIN_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
                <input
                  value={newCompanyNotes}
                  onChange={e => setNewCompanyNotes(e.target.value)}
                  placeholder="Brief notes"
                  className="px-3 py-2 text-sm rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleAddCompany}
                  disabled={savingCompany || !newCompanyName.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-[#60a5fa] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40"
                >
                  <Save size={14} /> {savingCompany ? "Adding..." : "Add"}
                </button>
              </div>
            </div>
          )}

          {/* Pipeline Nuclear Reset */}
          <div className="space-y-2">
            {!showResetConfirm ? (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#f8717140] text-[#f87171] hover:bg-[rgba(248,113,113,0.08)] transition-colors"
              >
                <Trash2 size={12} /> Clean Slate — Reset Entire Pipeline
              </button>
            ) : (
              <div className="p-4 rounded-xl border border-[#f87171] bg-[rgba(248,113,113,0.06)] space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-[#f87171] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">Nuclear Reset — Clean Slate</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                      This wipes <strong>everything</strong> in the gap pipeline: all gap items, JD analysis reports, closure plans,
                      strategic moves, role search cache, and gap-sourced embeddings.
                      Target companies are preserved — you&apos;ll rebuild from hand-picked roles.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-6">
                  <button
                    onClick={handlePipelineReset}
                    disabled={resettingPipeline}
                    className="px-4 py-1.5 text-xs font-medium rounded-lg bg-[#f87171] text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {resettingPipeline ? "Resetting everything..." : "Yes, wipe it all"}
                  </button>
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {pipelineResetResult && (
              <div className="p-3 rounded-xl bg-[rgba(52,211,153,0.06)] border border-[#34d39940] space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-[#34d399]">
                  <CheckCircle size={14} /> Pipeline reset complete
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                  {[
                    { label: "Gaps", count: pipelineResetResult.gaps_removed },
                    { label: "Reports", count: pipelineResetResult.reports_cleared },
                    { label: "Plans", count: pipelineResetResult.closure_plans_cleared },
                    { label: "Moves", count: pipelineResetResult.moves_cleared },
                    { label: "Role Cache", count: pipelineResetResult.role_cache_cleared },
                    { label: "Embeddings", count: pipelineResetResult.embeddings_cleared },
                  ].map(item => (
                    <div key={item.label} className="px-2 py-1.5 rounded-lg bg-[var(--bg-secondary)]">
                      <div className="text-sm font-bold text-[var(--text-primary)]">{item.count ?? 0}</div>
                      <div className="text-[10px] text-[var(--text-muted)]">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Manual JD Paste Modal */}
          {jdPasteForCompany && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)] w-full max-w-2xl max-h-[80vh] overflow-auto">
                <div className="p-5 border-b border-[var(--border)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Paste a Real JD</h3>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        For {jdPasteForCompany} — find the listing on their careers page, copy the full description, paste it here.
                      </p>
                    </div>
                    <button onClick={() => { setJdPasteForCompany(null); setPastedJdText(""); setPastedRoleTitle(""); }} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                      <X size={16} />
                    </button>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  <input
                    value={pastedRoleTitle}
                    onChange={e => setPastedRoleTitle(e.target.value)}
                    placeholder="Role title (e.g., Senior PM, Recommendations)"
                    className="w-full px-4 py-2.5 text-sm rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                  />
                  <textarea
                    value={pastedJdText}
                    onChange={e => setPastedJdText(e.target.value)}
                    placeholder="Paste the full job description here... (minimum 50 characters)"
                    rows={14}
                    className="w-full px-4 py-3 text-sm rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none leading-relaxed"
                    autoFocus
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {pastedJdText.length} chars {pastedJdText.length < 50 ? "(need 50+)" : ""}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setJdPasteForCompany(null); setPastedJdText(""); setPastedRoleTitle(""); }}
                        className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSubmitManualJd}
                        disabled={pastedJdText.trim().length < 50 || feedingJd}
                        className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg bg-[#f87171] text-white hover:opacity-90 disabled:opacity-40"
                      >
                        {feedingJd ? (
                          <><Loader2 size={12} className="animate-spin" /> Analyzing...</>
                        ) : (
                          <><Play size={12} /> Analyze &amp; Push Gaps</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Company list grouped by tier */}
          {companiesLoading ? (
            <p className="text-sm text-[var(--text-muted)]">Loading companies...</p>
          ) : companies.length === 0 ? (
            <div className="text-center py-16 text-[var(--text-muted)]">
              <Building2 size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No companies match your filters.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {tierOrder.map(tier => {
                const items = groupedCompanies[tier];
                if (!items || items.length === 0) return null;
                const cfg = COMPANY_TIER_CONFIG[tier] || COMPANY_TIER_CONFIG.target;
                return (
                  <div key={tier}>
                    <h2 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2"
                      style={{ color: cfg.color }}>
                      <cfg.icon size={14} /> {cfg.label} ({items.length})
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {items.map(c => {
                        const domainCfg = DOMAIN_CONFIG[c.domain];
                        const isEditing = editingCompanyName === c.name;

                        return (
                          <div key={c.name} className="px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--text-muted)] transition-all">
                            {isEditing ? (
                              <div className="space-y-2">
                                <p className="text-sm font-medium text-[var(--text-primary)]">{c.name}</p>
                                <div className="grid grid-cols-2 gap-2">
                                  <select value={editCompanyTier} onChange={e => setEditCompanyTier(e.target.value)}
                                    className="px-2 py-1 text-xs rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)]">
                                    {tierOrder.map(t => (
                                      <option key={t} value={t}>{COMPANY_TIER_CONFIG[t]?.label || t}</option>
                                    ))}
                                  </select>
                                  <select value={editCompanyDomain} onChange={e => setEditCompanyDomain(e.target.value)}
                                    className="px-2 py-1 text-xs rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)]">
                                    <option value="">Domain...</option>
                                    {Object.entries(DOMAIN_CONFIG).map(([k, v]) => (
                                      <option key={k} value={k}>{v.label}</option>
                                    ))}
                                  </select>
                                </div>
                                <input value={editCompanyNotes} onChange={e => setEditCompanyNotes(e.target.value)}
                                  className="w-full px-2 py-1 text-xs rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)]" />
                                <div className="flex gap-2">
                                  <button onClick={handleUpdateCompany} className="px-3 py-1 text-xs rounded-lg bg-[#60a5fa] text-white">Save</button>
                                  <button onClick={() => setEditingCompanyName(null)} className="px-3 py-1 text-xs rounded-lg border border-[var(--border)] text-[var(--text-muted)]">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium text-[var(--text-primary)]">{c.name}</span>
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => startEditCompany(c)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                                      <Pencil size={12} />
                                    </button>
                                    {deletingCompanyName === c.name ? (
                                      <div className="flex items-center gap-1">
                                        <button onClick={() => handleDeleteCompany(c.name)} className="px-2 py-0.5 text-[10px] rounded bg-[#f87171] text-white">Yes</button>
                                        <button onClick={() => setDeletingCompanyName(null)} className="px-2 py-0.5 text-[10px] rounded border border-[var(--border)] text-[var(--text-muted)]">No</button>
                                      </div>
                                    ) : (
                                      <button onClick={() => setDeletingCompanyName(c.name)} className="p-1 text-[var(--text-muted)] hover:text-[#f87171]">
                                        <Trash2 size={12} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                {domainCfg && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                                    style={{ color: domainCfg.color, backgroundColor: `${domainCfg.color}15` }}>
                                    {domainCfg.label}
                                  </span>
                                )}
                                {c.notes && (
                                  <p className="text-xs text-[var(--text-muted)] mt-1">{c.notes}</p>
                                )}

                                {/* Paste JD for this company */}
                                <div className="mt-2 pt-2 border-t border-[var(--border)]">
                                  <button
                                    onClick={() => setJdPasteForCompany(c.name)}
                                    className="flex items-center gap-1.5 text-xs font-medium text-[#f87171] hover:text-[#fb923c]"
                                  >
                                    <FileText size={12} /> Paste a JD
                                  </button>
                                </div>
                              </>
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
        </div>
      )}

      {/* ── Analyze JD Tab ─────────────────────────────── */}
      {tab === "analyze" && (
        <div className="space-y-6">
          {/* Input form */}
          {!currentReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  placeholder="Company name (auto-detected if blank)"
                  className="px-3 py-2 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                />
                <input
                  value={roleTitle}
                  onChange={e => setRoleTitle(e.target.value)}
                  placeholder="Role title (auto-detected if blank)"
                  className="px-3 py-2 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                />
              </div>
              {/* Lens: Seniority + Role Focus */}
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={seniorityLevel}
                  onChange={e => setSeniorityLevel(e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)]"
                >
                  {SENIORITY_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <select
                  value={roleFocus}
                  onChange={e => setRoleFocus(e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)]"
                >
                  <option value="">Role Focus (optional)</option>
                  {ROLE_FOCUS_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <textarea
                value={jdText}
                onChange={e => setJdText(e.target.value)}
                placeholder="Paste the full job description here..."
                rows={12}
                className="w-full px-4 py-3 text-sm rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none leading-relaxed"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pushToGaps}
                    onChange={e => setPushToGaps(e.target.checked)}
                    className="rounded"
                  />
                  Auto-create Mind the Gap entries for discovered gaps
                </label>
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing || jdText.trim().length < 50}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#f87171] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {analyzing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Analyzing...
                    </>
                  ) : (
                    <>
                      <Crosshair size={16} /> Analyze Coverage
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Report display */}
          {currentReport && (
            <div className="space-y-6">
              {/* Report header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    {currentReport.company} — {currentReport.role_title}
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Report {currentReport.report_id} • {formatDate(currentReport.created_at)}
                    {currentReport.gaps_pushed > 0 && (
                      <span className="ml-2 text-[#34d399]">
                        {currentReport.gaps_pushed} gaps pushed to Mind the Gap
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => { setCurrentReport(null); setJdText(""); setCompany(""); setRoleTitle(""); setFilterCoverage(null); }}
                  className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
                >
                  New Analysis
                </button>
              </div>

              {/* Coverage Summary Cards — clickable filters */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <button
                  onClick={() => setFilterCoverage(null)}
                  className="px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border text-left transition-all"
                  style={{
                    borderColor: filterCoverage === null ? "var(--text-primary)" : "var(--border)",
                    boxShadow: filterCoverage === null ? "0 0 0 1px var(--text-primary)" : "none",
                  }}
                >
                  <div className="text-2xl font-bold text-[var(--text-primary)]">
                    {currentReport.coverage_summary.coverage_pct}%
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">Coverage</div>
                </button>
                {Object.entries(COVERAGE_CONFIG).map(([key, config]) => {
                  const count = (currentReport.coverage_summary as any)[key === "gap" ? "gaps" : key] || 0;
                  const isActive = filterCoverage === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setFilterCoverage(isActive ? null : key)}
                      className="px-4 py-3 rounded-xl border text-left transition-all cursor-pointer"
                      style={{
                        borderColor: isActive ? config.color : `${config.color}40`,
                        backgroundColor: config.bg,
                        boxShadow: isActive ? `0 0 0 1px ${config.color}` : "none",
                      }}
                    >
                      <div className="text-2xl font-bold" style={{ color: config.color }}>{count}</div>
                      <div className="text-xs" style={{ color: config.color }}>{config.label}</div>
                    </button>
                  );
                })}
              </div>

              {/* Filter indicator */}
              {filterCoverage && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)]">
                    Showing: <span className="font-medium" style={{ color: COVERAGE_CONFIG[filterCoverage]?.color }}>
                      {COVERAGE_CONFIG[filterCoverage]?.label}
                    </span> requirements
                  </span>
                  <button
                    onClick={() => setFilterCoverage(null)}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] underline"
                  >
                    Show all
                  </button>
                </div>
              )}

              {/* Requirements list */}
              <div className="space-y-2">
                {currentReport.requirements
                  .map((req, idx) => ({ req, idx }))
                  .filter(({ req }) => !filterCoverage || req.coverage === filterCoverage)
                  .map(({ req, idx }) => {
                  const cc = COVERAGE_CONFIG[req.coverage] || COVERAGE_CONFIG.gap;
                  const CIcon = cc.Icon;
                  const isExpanded = expandedReq === idx;
                  const tier = req.fill_tier ? TIER_CONFIG[req.fill_tier] : null;

                  return (
                    <div
                      key={idx}
                      className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden hover:border-[var(--text-muted)] transition-all"
                    >
                      <div
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                        onClick={() => setExpandedReq(isExpanded ? null : idx)}
                      >
                        <CIcon size={16} style={{ color: cc.color }} className="shrink-0" />

                        <span className="text-sm text-[var(--text-primary)] flex-1">
                          {req.requirement}
                        </span>

                        {/* Category badge */}
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] bg-[var(--bg-primary)] text-[var(--text-muted)]">
                          {CATEGORY_LABELS[req.category] || req.category}
                        </span>

                        {/* Signal strength */}
                        <span className={`shrink-0 text-[10px] uppercase font-bold ${
                          req.signal_strength === "hard" ? "text-[#f87171]" : "text-[var(--text-muted)]"
                        }`}>
                          {req.signal_strength}
                        </span>

                        {/* Coverage badge */}
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ color: cc.color, backgroundColor: cc.bg }}>
                          {cc.label}
                        </span>

                        {/* Fill tier (if gap/articulable) */}
                        {tier && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full text-xs"
                            style={{ color: tier.color, backgroundColor: `${tier.color}18` }}>
                            {tier.label}
                          </span>
                        )}

                        {isExpanded
                          ? <ChevronDown size={14} className="shrink-0 text-[var(--text-muted)]" />
                          : <ChevronRight size={14} className="shrink-0 text-[var(--text-muted)]" />
                        }
                      </div>

                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 border-t border-[var(--border)] space-y-3">
                          {/* Evidence */}
                          {req.evidence.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-[#34d399] uppercase tracking-wider mb-1.5">
                                Evidence from Vault
                              </h4>
                              <div className="space-y-2">
                                {req.evidence.map((ev, ei) => (
                                  <div key={ei} className="flex items-start gap-2 text-sm">
                                    <ArrowRight size={12} className="mt-1 text-[#34d399] shrink-0" />
                                    <div>
                                      <span className="font-medium text-[var(--text-primary)]">{ev.title}</span>
                                      <span className="text-[var(--text-muted)]"> ({ev.company})</span>
                                      {ev.metric && (
                                        <span className="ml-2 text-xs text-[#fbbf24]">{ev.metric}</span>
                                      )}
                                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                        {ev.relevance_explanation}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Gap note */}
                          {req.gap_note && (
                            <p className="text-sm text-[var(--text-secondary)] italic">
                              {req.gap_note}
                            </p>
                          )}

                          {/* Fill strategy */}
                          {req.fill_tier && (
                            <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)]">
                              <div className="flex items-start justify-between">
                                <h4 className="text-xs font-semibold uppercase tracking-wider mb-2"
                                  style={{ color: TIER_CONFIG[req.fill_tier]?.color || "#94a3b8" }}>
                                  Fill Strategy — {TIER_CONFIG[req.fill_tier]?.label} ({req.fill_time_estimate})
                                </h4>
                                {(req.fill_tier === "articulate" || req.fill_tier === "build-proof") && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); openGapToInitiative(req); }}
                                    className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-[#fb923c] text-white hover:opacity-90 transition-opacity shrink-0"
                                  >
                                    <Plus size={12} /> Create Initiative
                                  </button>
                                )}
                              </div>
                              {req.fill_action && (
                                <p className="text-sm text-[var(--text-primary)] mb-1">
                                  <strong>Action:</strong> {req.fill_action}
                                </p>
                              )}
                              {req.fill_output && (
                                <p className="text-sm text-[var(--text-secondary)]">
                                  <strong>Output:</strong> {req.fill_output}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Current Gaps Tab ─────────────────────────── */}
      {tab === "gaps" && (() => {
        const closedStatuses = new Set(["completed", "deprioritized"]);
        const activeGaps = gapItems.filter(g => !closedStatuses.has(g.current_status));
        const closedGaps = gapItems.filter(g => closedStatuses.has(g.current_status));
        const RESOLUTION_LABELS: Record<string, { label: string; color: string }> = {
          "have-it": { label: "Have It", color: "#22C55E" },
          "reframed": { label: "Reframed", color: "#60a5fa" },
          "built-proof": { label: "Built Proof", color: "#fbbf24" },
          "certified": { label: "Certified", color: "#a78bfa" },
          "not-pursuing": { label: "Not Pursuing", color: "#6B7280" },
          "not-a-gap": { label: "Not a Gap", color: "#8B5CF6" },
        };

        return (
        <div className="space-y-6">
          {/* Stats summary */}
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Gap Overview</h3>
            <button
              onClick={() => { loadGapItems(); fetchMoves(); }}
              disabled={movesLoading}
              className="text-[10px] px-2 py-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors disabled:opacity-40"
              title="Refresh gap counts and scores"
            >
              {movesLoading ? <Loader2 size={12} className="animate-spin" /> : "↻ Refresh"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* Active — primary bucket */}
            <div className="rounded-lg px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)]">
              <p className="text-lg font-bold text-[var(--text-primary)]">{activeGaps.length} <span className="text-xs font-normal text-[var(--text-muted)]">of {activeGaps.length + closedGaps.length}</span></p>
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2">Active Gaps</p>
              <div className="flex gap-4">
                <span className="text-[10px] text-[var(--text-muted)]"><span className="text-xs font-semibold text-[#EF4444]">{activeGaps.filter(g => g.priority === "critical" || g.priority === "high").length}</span> high priority</span>
                <span className="text-[10px] text-[var(--text-muted)]"><span className="text-xs font-semibold text-[#7CADE8]">{activeGaps.filter(g => g.current_status === "in-progress").length}</span> in progress</span>
              </div>
            </div>
            {/* Closed — clickable to expand history */}
            <div className="rounded-lg px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] cursor-pointer hover:border-[#22C55E] transition-colors" onClick={() => setShowClosedGaps(!showClosedGaps)}>
              <p className="text-lg font-bold text-[#22C55E]">{closedGaps.length} <span className="text-xs font-normal text-[var(--text-muted)]">of {activeGaps.length + closedGaps.length}</span></p>
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2">Closed {showClosedGaps ? "▾" : "▸"}</p>
              <div className="flex gap-4">
                <span className="text-[10px] text-[var(--text-muted)]"><span className="text-xs font-semibold text-[#22C55E]">{closedGaps.filter(g => g.resolution_type === "have-it").length}</span> have it</span>
                <span className="text-[10px] text-[var(--text-muted)]"><span className="text-xs font-semibold text-[#8B5CF6]">{closedGaps.filter(g => g.resolution_type === "not-a-gap").length}</span> not a gap</span>
                <span className="text-[10px] text-[var(--text-muted)]"><span className="text-xs font-semibold text-[#6B7280]">{closedGaps.filter(g => g.resolution_type === "not-pursuing").length}</span> not pursuing</span>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <Filter size={14} className="text-[var(--text-muted)]" />
            <button
              onClick={() => setGapCategoryFilter(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                !gapCategoryFilter
                  ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
                  : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              All ({activeGaps.length})
            </button>
            {GAP_CATEGORIES.map((cat) => {
              const count = activeGaps.filter((i) => i.category === cat.value).length;
              if (count === 0) return null;
              return (
                <button
                  key={cat.value}
                  onClick={() => setGapCategoryFilter(gapCategoryFilter === cat.value ? null : cat.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    gapCategoryFilter === cat.value
                      ? "text-white"
                      : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  }`}
                  style={gapCategoryFilter === cat.value ? { backgroundColor: cat.color } : {}}
                >
                  {cat.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Status filter row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Status:</span>
            <button
              onClick={() => setGapStatusFilter(null)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
                !gapStatusFilter
                  ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
                  : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              All
            </button>
            {Object.entries(STATUS_LABELS).filter(([key]) => !closedStatuses.has(key)).map(([key, { label, color }]) => (
              <button
                key={key}
                onClick={() => setGapStatusFilter(gapStatusFilter === key ? null : key)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
                  gapStatusFilter === key
                    ? "text-white"
                    : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
                style={gapStatusFilter === key ? { backgroundColor: color } : {}}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Active gap items */}
          <GapTabContent
            items={activeGaps}
            categoryFilter={gapCategoryFilter}
            statusFilter={gapStatusFilter}
            onUpdateStatus={handleUpdateGapStatus}
            onCloseGap={handleCloseGap}
            onNavigateToClosure={(gapId) => {
              setTab("closure");
              setClosureSubTab("plans");
              handleGenerateClosurePlan(gapId);
            }}
            onGenerateInterviewPrep={handleGenerateInterviewPrep}
            generatingPrepId={generatingPrep}
          />

          {/* Closed Gaps History */}
          {showClosedGaps && closedGaps.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-[#22C55E]" /> Gaps Closed ({closedGaps.length})
                </h3>
              </div>
              <div className="space-y-1">
                {closedGaps.map((gap) => {
                  const res = RESOLUTION_LABELS[gap.resolution_type || ""] || { label: gap.current_status, color: "#6B7280" };
                  return (
                    <div key={gap.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] opacity-70">
                      <CheckCircle2 size={14} className="text-[#22C55E] shrink-0" />
                      <span className="text-sm text-[var(--text-secondary)] flex-1 truncate">{gap.title}</span>
                      {gap.source_jd_company && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(96,165,250,0.12)] text-[#60a5fa] shrink-0">{gap.source_jd_company}</span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: `${res.color}20`, color: res.color }}>{res.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        );
      })()}

      {/* ── Lens Filter Bar (shared by Reports + Intelligence) ── */}
      {(tab === "reports" || tab === "intelligence") && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-[var(--text-muted)]" />
          <span className="text-xs text-[var(--text-muted)]">Lens:</span>
          {SENIORITY_OPTIONS.map(o => {
            const isActive = lensSeniority === o.value;
            return (
              <button
                key={o.value}
                onClick={() => setLensSeniority(isActive ? null : o.value)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                  isActive
                    ? "bg-[#f87171] text-white border-[#f87171]"
                    : "bg-[var(--bg-secondary)] text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {o.label}
              </button>
            );
          })}
          <span className="text-[var(--border)]">|</span>
          {ROLE_FOCUS_OPTIONS.map(o => {
            const isActive = lensFocus === o.value;
            return (
              <button
                key={o.value}
                onClick={() => setLensFocus(isActive ? null : o.value)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                  isActive
                    ? "bg-[#60a5fa] text-white border-[#60a5fa]"
                    : "bg-[var(--bg-secondary)] text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {o.label}
              </button>
            );
          })}
          {(lensSeniority || lensFocus) && (
            <button
              onClick={() => { setLensSeniority(null); setLensFocus(null); }}
              className="px-2.5 py-1 text-xs rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* ── Past Reports Tab ───────────────────────────── */}
      {tab === "reports" && (
        <div className="space-y-3">
          {reportsLoading ? (
            <p className="text-sm text-[var(--text-muted)]">Loading reports...</p>
          ) : reports.length === 0 ? (
            <div className="text-center py-16 text-[var(--text-muted)]">
              <FileText size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No reports yet. Analyze a JD to get started.</p>
            </div>
          ) : (
            reports.map(r => {
              const s = r.coverage_summary;
              return (
                <button
                  key={r.report_id}
                  onClick={() => loadReport(r.report_id)}
                  className="w-full text-left px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--text-muted)] transition-all"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {r.company || "Unknown"} — {r.role_title || "Unknown Role"}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">{formatDate(r.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-[var(--text-primary)] font-bold">{s.coverage_pct}% covered</span>
                    <span className="text-[#34d399]">{s.strong} strong</span>
                    <span className="text-[#fbbf24]">{s.partial} partial</span>
                    <span className="text-[#60a5fa]">{s.articulable} articulable</span>
                    <span className="text-[#f87171]">{s.gaps} gaps</span>
                    {r.gaps_pushed > 0 && (
                      <span className="text-[var(--text-muted)]">{r.gaps_pushed} pushed</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* ── Aggregate Intelligence Tab ───────────────────── */}
      {tab === "intelligence" && (
        <div className="space-y-6">
          {aggregateLoading ? (
            <p className="text-sm text-[var(--text-muted)]">Loading aggregate intelligence...</p>
          ) : !aggregate || aggregate.total_jds_analyzed === 0 ? (
            <div className="text-center py-16 text-[var(--text-muted)]">
              <BarChart3 size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Analyze 2+ JDs to see structural patterns.</p>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
                <div className="text-2xl font-bold text-[var(--text-primary)]">
                  {aggregate.total_jds_analyzed}
                  {aggregate.total_reports && aggregate.total_reports !== aggregate.total_jds_analyzed && (
                    <span className="text-sm font-normal text-[var(--text-muted)]"> / {aggregate.total_reports}</span>
                  )}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {(lensSeniority || lensFocus) ? "JDs matching filters" : "JDs Analyzed"}
                </div>
              </div>

              {/* Strong domains */}
              {aggregate.strong_domains.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#34d399] mb-2 flex items-center gap-2">
                    <TrendingUp size={14} /> Strong Domains
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {aggregate.strong_domains.map(d => (
                      <span key={d} className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#34d399] bg-[rgba(52,211,153,0.12)] border border-[rgba(52,211,153,0.3)]">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Weak domains */}
              {aggregate.weak_domains.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#f87171] mb-2 flex items-center gap-2">
                    <TrendingDown size={14} /> Weak Domains
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {aggregate.weak_domains.map(d => (
                      <span key={d} className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#f87171] bg-[rgba(248,113,113,0.12)] border border-[rgba(248,113,113,0.3)]">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Strengths */}
              {aggregate.top_strengths && aggregate.top_strengths.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#34d399] mb-2 flex items-center gap-2">
                    <TrendingUp size={14} /> Top Strengths (appear across {aggregate.top_strengths[0]?.count || 0}+ JDs)
                  </h3>
                  <div className="space-y-2">
                    {aggregate.top_strengths.map((s, i) => (
                      <div key={s.canonical_key} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[rgba(52,211,153,0.3)] bg-[rgba(52,211,153,0.06)]">
                        <span className="text-sm text-[var(--text-primary)] flex-1 capitalize">{s.skill}</span>
                        <span className="text-xs text-[var(--text-muted)]">{s.count}/{aggregate.total_jds_analyzed} JDs</span>
                        <span className="text-xs text-[#34d399] font-bold">{s.frequency_pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Structural gaps */}
              {aggregate.structural_gaps.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#fb923c] mb-2 flex items-center gap-2">
                    <AlertTriangle size={14} /> Structural Gaps (appear in {aggregate.total_jds_analyzed >= 5 ? "30" : "2"}%+ of target JDs)
                  </h3>
                  <div className="space-y-2">
                    {aggregate.structural_gaps.map((sg, i) => (
                      <div key={sg.canonical_key || i} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#fb923c40] bg-[rgba(251,147,60,0.06)]">
                        <span className="text-sm text-[var(--text-primary)] flex-1 capitalize">{sg.requirement}</span>
                        <span className="text-xs text-[var(--text-muted)]">{sg.count}/{sg.total_reports} JDs</span>
                        <span className="text-xs text-[#fb923c] font-bold">{sg.frequency_pct}%</span>
                        <span className="px-2 py-0.5 rounded-full text-xs"
                          style={{
                            color: COVERAGE_CONFIG[sg.current_coverage]?.color || "#94a3b8",
                            backgroundColor: COVERAGE_CONFIG[sg.current_coverage]?.bg || "transparent",
                          }}>
                          {COVERAGE_CONFIG[sg.current_coverage]?.label || sg.current_coverage}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Close the Gap Tab ─────────────────────────────── */}
      {tab === "closure" && (
        <div className="space-y-6">
          {/* Sub-tab toggle */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] w-fit">
            <button
              onClick={() => setClosureSubTab("moves")}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${closureSubTab === "moves" ? "bg-[#fb923c] text-white shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
            >
              10 Moves
            </button>
            <button
              onClick={() => setClosureSubTab("plans")}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${closureSubTab === "plans" ? "bg-[#fb923c] text-white shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
            >
              Individual Plans
            </button>
            <button
              onClick={() => { setClosureSubTab("companies"); if (companyReadiness.length === 0) fetchCompanyReadiness(); }}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${closureSubTab === "companies" ? "bg-[#fb923c] text-white shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
            >
              Company Readiness
            </button>
          </div>

          {/* ── Moves View ──────────────────────────────────── */}
          {closureSubTab === "moves" && (
            <div className="space-y-6">
              {/* Readiness Score */}
              {movesProgress && movesProgress.readiness && (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5">
                  <div className="flex items-start gap-6">
                    {/* Big Score */}
                    <div className="shrink-0 text-center">
                      <div className="relative w-24 h-24">
                        <svg viewBox="0 0 100 100" className="w-24 h-24 -rotate-90">
                          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--bg-primary)" strokeWidth="8" />
                          <circle cx="50" cy="50" r="42" fill="none" stroke={movesProgress.readiness.current_pct >= 90 ? "#22c55e" : "#fb923c"} strokeWidth="8" strokeLinecap="round"
                            strokeDasharray={`${movesProgress.readiness.current_pct * 2.64} 264`} className="transition-all duration-700" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-2xl font-bold text-[var(--text-primary)]">{movesProgress.readiness.current_pct}%</span>
                        </div>
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] mt-1">Readiness Score</div>
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                          <Map size={16} className="text-[#fb923c]" /> Gap Closure Progress
                        </h3>
                        <button
                          onClick={() => { fetchMoves(); loadGapItems(); }}
                          disabled={movesLoading}
                          className="text-[10px] px-2 py-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors disabled:opacity-40"
                          title="Refresh scores"
                        >
                          {movesLoading ? <Loader2 size={12} className="animate-spin" /> : "↻ Refresh"}
                        </button>
                      </div>

                      {/* Baseline vs Current */}
                      <div className="flex items-center gap-2 mb-3 text-xs">
                        <span className="text-[var(--text-muted)]">Baseline:</span>
                        <span className="font-medium text-[var(--text-secondary)]">{movesProgress.readiness.baseline_pct}%</span>
                        {movesProgress.readiness.current_pct > movesProgress.readiness.baseline_pct && (
                          <>
                            <ArrowRight size={10} className="text-[#22c55e]" />
                            <span className="font-medium text-[#22c55e]">{movesProgress.readiness.current_pct}%</span>
                            <span className="px-1.5 py-0.5 rounded bg-[rgba(34,197,94,0.15)] text-[#22c55e] text-[10px] font-medium">
                              +{movesProgress.readiness.current_pct - movesProgress.readiness.baseline_pct}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Stats row */}
                      <div className="grid grid-cols-4 gap-3">
                        <div className="rounded-lg bg-[var(--bg-primary)] px-3 py-2 text-center">
                          <div className="text-sm font-bold text-[var(--text-primary)]">{movesProgress.total_moves}</div>
                          <div className="text-[10px] text-[var(--text-muted)]">Moves</div>
                        </div>
                        <div className="rounded-lg bg-[var(--bg-primary)] px-3 py-2 text-center">
                          <div className="text-sm font-bold text-[#fb923c]">{movesProgress.in_progress_moves}</div>
                          <div className="text-[10px] text-[var(--text-muted)]">Active</div>
                        </div>
                        <div className="rounded-lg bg-[var(--bg-primary)] px-3 py-2 text-center">
                          <div className="text-sm font-bold text-[#22c55e]">{movesProgress.completed_moves}</div>
                          <div className="text-[10px] text-[var(--text-muted)]">Done</div>
                        </div>
                        <div className="rounded-lg bg-[var(--bg-primary)] px-3 py-2 text-center">
                          <div className="text-sm font-bold text-[var(--text-primary)]">{movesProgress.readiness.resolved_gaps}/{movesProgress.readiness.total_gaps}</div>
                          <div className="text-[10px] text-[var(--text-muted)]">JD Gaps Closed</div>
                          {(movesProgress.readiness as any).excluded_aspirational > 0 && (
                            <div className="text-[9px] text-[var(--text-muted)] mt-0.5 opacity-60">+{(movesProgress.readiness as any).excluded_aspirational} aspirational</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Seed button if no moves */}
              {!movesLoading && moves.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-[var(--text-muted)] mb-4">No moves configured yet. Seed the 10 strategic moves to get started.</p>
                  <button onClick={seedMoves} className="px-4 py-2 text-sm rounded-lg bg-[#fb923c] text-white hover:opacity-90 transition-opacity">
                    Seed 10 Moves
                  </button>
                </div>
              )}

              {movesLoading && <p className="text-sm text-[var(--text-muted)]">Loading moves...</p>}

              {/* Move Cards */}
              <div className="space-y-3">
                {moves.map((move) => {
                  const isExpanded = expandedMove === move.id;
                  const doneSteps = move.steps.filter(s => s.status === "completed" || s.status === "skipped").length;
                  const totalSteps = move.steps.length;
                  const pct = totalSteps ? Math.round(doneSteps / totalSteps * 100) : 0;
                  const typeColors: Record<string, string> = {
                    reframe: "#60a5fa", certification: "#a78bfa", build: "#34d399", content: "#fbbf24", disposition: "#6b7280",
                  };
                  const typeColor = typeColors[move.move_type] || "#fb923c";

                  return (
                    <div key={move.id} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden">
                      {/* Move Header */}
                      <div
                        className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-[rgba(251,146,60,0.04)] transition-colors"
                        onClick={() => setExpandedMove(isExpanded ? null : move.id)}
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0" style={{ backgroundColor: `${typeColor}20` }}>
                          {move.status === "completed" ? (
                            <CheckCircle size={16} style={{ color: "#22c55e" }} />
                          ) : (
                            <span className="text-xs font-bold" style={{ color: typeColor }}>{move.sort_order}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[var(--text-primary)] truncate">{move.title}</div>
                          <div className="text-xs text-[var(--text-muted)] flex items-center gap-2 mt-0.5">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: `${typeColor}20`, color: typeColor }}>{move.move_type}</span>
                            <span>{move.estimated_time}</span>
                            <span>·</span>
                            <span>{move.gap_ids.length} gaps</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {/* Mini progress bar */}
                          <div className="w-20 flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#22c55e" : "#fb923c" }} />
                            </div>
                            <span className="text-xs text-[var(--text-muted)] w-8 text-right">{pct}%</span>
                          </div>
                          {isExpanded ? <ChevronUp size={14} className="text-[var(--text-muted)]" /> : <ChevronDown size={14} className="text-[var(--text-muted)]" />}
                        </div>
                      </div>

                      {/* Expanded Steps */}
                      {isExpanded && (
                        <div className="border-t border-[var(--border)] px-5 py-4 space-y-3">
                          {/* Enrich Move button */}
                          {!move.enriched_at && move.move_type !== "disposition" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEnrichMove(move.id); }}
                              disabled={enrichingMove === move.id}
                              className="w-full mb-2 px-4 py-2.5 text-sm rounded-lg border border-dashed border-[#a78bfa] text-[#a78bfa] hover:bg-[rgba(167,139,250,0.08)] transition-colors flex items-center justify-center gap-2"
                            >
                              {enrichingMove === move.id ? (
                                <><Loader2 size={14} className="animate-spin" /> Generating granular guidance...</>
                              ) : (
                                <><Sparkles size={14} /> Enrich with Guidance — What Good Looks Like, Vault Fields, Interview Stories</>
                              )}
                            </button>
                          )}
                          {move.enriched_at && (
                            <div className="flex items-center gap-2 mb-2 text-[10px] text-[#a78bfa]">
                              <Sparkles size={10} /> Enriched {new Date(move.enriched_at).toLocaleDateString()}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEnrichMove(move.id); }}
                                disabled={enrichingMove === move.id}
                                className="ml-auto text-[10px] text-[var(--text-muted)] hover:text-[#a78bfa] transition-colors"
                              >
                                {enrichingMove === move.id ? "Regenerating..." : "Regenerate"}
                              </button>
                            </div>
                          )}

                          {move.steps.map((step, idx) => (
                            <div key={idx} className="flex items-start gap-3 group">
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleStep(move.id, idx, step.status); }}
                                disabled={togglingStep === `${move.id}-${idx}`}
                                className="mt-0.5 shrink-0 transition-colors"
                              >
                                {togglingStep === `${move.id}-${idx}` ? (
                                  <Loader2 size={16} className="animate-spin text-[var(--text-muted)]" />
                                ) : step.status === "completed" ? (
                                  <CheckCircle size={16} className="text-[#22c55e]" />
                                ) : (
                                  <Circle size={16} className="text-[var(--text-muted)] group-hover:text-[#fb923c] transition-colors" />
                                )}
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className={`text-sm ${step.status === "completed" ? "text-[var(--text-muted)] line-through" : "text-[var(--text-primary)]"}`}>
                                  {step.title}
                                </div>
                                <div className="text-xs text-[var(--text-muted)] mt-0.5">{step.description}</div>
                                <div className="flex items-center gap-3 mt-1 text-[10px] text-[var(--text-muted)]">
                                  <span className="flex items-center gap-1"><Clock size={10} /> {step.time}</span>
                                  <span className="flex items-center gap-1"><FileText size={10} /> {step.produces}</span>
                                </div>

                                {/* Enriched step fields */}
                                {step.what_good_looks_like && (
                                  <div className="mt-2 p-2.5 rounded-lg bg-[rgba(167,139,250,0.06)] border border-[rgba(167,139,250,0.15)]">
                                    <div className="text-[10px] font-medium text-[#a78bfa] mb-1 flex items-center gap-1"><Target size={10} /> What Good Looks Like</div>
                                    <div className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">{step.what_good_looks_like}</div>
                                  </div>
                                )}
                                {step.prototype_idea && (
                                  <div className="mt-1.5 p-2.5 rounded-lg bg-[rgba(251,146,60,0.06)] border border-[rgba(251,146,60,0.15)]">
                                    <div className="text-[10px] font-medium text-[#fb923c] mb-1 flex items-center gap-1"><Lightbulb size={10} /> Prototype Idea</div>
                                    <div className="text-xs text-[var(--text-secondary)]">{step.prototype_idea}</div>
                                  </div>
                                )}
                                {step.vault_fields_fed && step.vault_fields_fed.length > 0 && (
                                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                    <Package size={10} className="text-[var(--text-muted)]" />
                                    {step.vault_fields_fed.map((f: string) => (
                                      <span key={f} className="px-1.5 py-0.5 rounded text-[9px] bg-[rgba(96,165,250,0.1)] text-[#60a5fa]">{f}</span>
                                    ))}
                                  </div>
                                )}
                                {step.resources && step.resources.length > 0 && (
                                  <div className="mt-1.5 space-y-1">
                                    {step.resources.map((r: MoveStepResource, ri: number) => (
                                      <div key={ri} className="flex items-start gap-1.5 text-[10px]">
                                        <ExternalLink size={10} className="mt-0.5 text-[var(--text-muted)] shrink-0" />
                                        <div>
                                          {r.url ? (
                                            <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-[#60a5fa] hover:underline">{r.title}</a>
                                          ) : (
                                            <span className="text-[var(--text-secondary)]">{r.title}</span>
                                          )}
                                          {r.what_to_extract && <span className="text-[var(--text-muted)]"> — {r.what_to_extract}</span>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}

                          {/* Vault Record Draft */}
                          {move.vault_record_draft && move.vault_record_draft.name && (
                            <div className="mt-4 p-4 rounded-xl bg-[rgba(52,211,153,0.06)] border border-[rgba(52,211,153,0.2)]">
                              <div className="text-xs font-semibold text-[#34d399] mb-2 flex items-center gap-1.5"><Package size={12} /> Vault Record Draft</div>
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-[var(--text-primary)]">{move.vault_record_draft.name}</div>
                                {move.vault_record_draft.tagline && <div className="text-xs text-[var(--text-muted)] italic">{move.vault_record_draft.tagline}</div>}
                                {move.vault_record_draft.description && <div className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap mt-1">{move.vault_record_draft.description}</div>}
                                {move.vault_record_draft.tech_stack && move.vault_record_draft.tech_stack.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {move.vault_record_draft.tech_stack.map((t: string, ti: number) => (
                                      <span key={ti} className="px-1.5 py-0.5 rounded text-[9px] bg-[rgba(96,165,250,0.1)] text-[#60a5fa]">{t}</span>
                                    ))}
                                  </div>
                                )}
                                {move.vault_record_draft.highlight && (
                                  <div className="text-xs mt-1"><span className="text-[#fbbf24]">★</span> <span className="text-[var(--text-secondary)]">{move.vault_record_draft.highlight}</span></div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Interview Stories */}
                          {move.interview_stories && move.interview_stories.length > 0 && (
                            <div className="mt-3 p-4 rounded-xl bg-[rgba(167,139,250,0.06)] border border-[rgba(167,139,250,0.2)]">
                              <div className="text-xs font-semibold text-[#a78bfa] mb-3 flex items-center gap-1.5"><MessageSquare size={12} /> Interview Stories ({move.interview_stories.length})</div>
                              <div className="space-y-3">
                                {move.interview_stories.map((story: InterviewStory, si: number) => (
                                  <div key={si} className="p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)]">
                                    <div className="text-xs font-medium text-[var(--text-primary)] mb-1">{story.story_title}</div>
                                    <div className="text-[10px] text-[var(--text-muted)] mb-2 italic">Q: {story.question}</div>
                                    <div className="space-y-1.5 text-xs text-[var(--text-secondary)]">
                                      <div><span className="font-medium text-[#34d399]">S:</span> {story.situation}</div>
                                      <div><span className="font-medium text-[#60a5fa]">T:</span> {story.task}</div>
                                      <div><span className="font-medium text-[#fb923c]">A:</span> {story.action}</div>
                                      <div><span className="font-medium text-[#a78bfa]">R:</span> {story.result}</div>
                                    </div>
                                    {story.follow_ups && story.follow_ups.length > 0 && (
                                      <div className="mt-2 pt-2 border-t border-[var(--border)]">
                                        <div className="text-[10px] text-[var(--text-muted)] mb-1">Follow-up Drill-downs:</div>
                                        {story.follow_ups.map((fu, fi: number) => (
                                          <div key={fi} className="text-[10px] text-[var(--text-muted)] mt-1">
                                            <div className="font-medium">↳ {fu.question}</div>
                                            <div className="ml-3 text-[var(--text-secondary)]">{fu.answer_guidance}</div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    <div className="flex items-center gap-2 mt-2 text-[9px] text-[var(--text-muted)]">
                                      <span className={`px-1.5 py-0.5 rounded ${story.confidence === "high" ? "bg-[rgba(34,197,94,0.1)] text-[#22c55e]" : story.confidence === "medium" ? "bg-[rgba(251,146,60,0.1)] text-[#fb923c]" : "bg-[rgba(239,68,68,0.1)] text-[#ef4444]"}`}>
                                        {story.confidence} confidence
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Complete Move button */}
                          {move.status !== "completed" && doneSteps === totalSteps && totalSteps > 0 && (
                            <button
                              onClick={() => completeMove(move.id)}
                              className="w-full mt-2 px-4 py-2 text-sm rounded-lg bg-[#22c55e] text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                            >
                              <CheckCircle2 size={14} /> Complete Move &amp; Resolve {move.gap_ids.length} Gaps
                            </button>
                          )}

                          {move.status === "completed" && (
                            <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-[rgba(34,197,94,0.1)] text-[#22c55e] text-xs">
                              <CheckCircle2 size={14} /> Completed — {move.gap_ids.length} gaps resolved
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Individual Plans View ──────────────────────────── */}
          {closureSubTab === "plans" && (
            <div className="space-y-6">
          {/* Generate Plan Form */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5 space-y-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Route size={16} className="text-[#fb923c]" /> Generate Closure Plan
            </h3>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Gap to Close</label>
              <select
                value={selectedGapForClosure}
                onChange={(e) => setSelectedGapForClosure(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-sm text-[var(--text-primary)]"
              >
                <option value="">Select a gap...</option>
                {gapItems
                  .filter(g => !["completed", "deprioritized"].includes(g.current_status))
                  .sort((a, b) => {
                    const pOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
                    return (pOrder[a.priority] ?? 4) - (pOrder[b.priority] ?? 4);
                  })
                  .map(g => (
                    <option key={g.id} value={g.id}>
                      {g.title} ({g.priority}, {g.category})
                    </option>
                  ))
                }
              </select>
              {selectedGapForClosure && (() => {
                const match = prioritizedGaps.find((pg: any) => pg.gap_id === selectedGapForClosure);
                const gapItem = gapItems.find(g => g.id === selectedGapForClosure);
                const sourceCompany = match?.source_company || gapItem?.source_jd_company;
                if (sourceCompany) {
                  return (
                    <p className="text-xs text-[var(--text-muted)] mt-2 flex items-center gap-1">
                      <Target size={10} />
                      From <span className="text-[var(--text-primary)] font-medium">{sourceCompany}</span>
                      <span className="opacity-60">— closure plan calibrates to this company&apos;s bar</span>
                    </p>
                  );
                }
                return null;
              })()}
            </div>
            <button
              onClick={() => handleGenerateClosurePlan()}
              disabled={generatingPlan || !selectedGapForClosure}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[#fb923c] text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {generatingPlan ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {generatingPlan ? "Generating Plan (this takes ~30s)..." : "Generate Closure Plan"}
            </button>
          </div>

          {/* Prioritized Work Queue */}
          {!activePlan && (
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
                <Target size={14} /> Prioritized Gap Queue
                <span className="text-[var(--text-muted)] font-normal normal-case">— work on these in order</span>
              </h3>
              {prioritizedLoading ? (
                <p className="text-sm text-[var(--text-muted)]">Loading priorities...</p>
              ) : prioritizedGaps.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No unresolved gaps found. Analyze some JDs first.</p>
              ) : (
                <div className="space-y-2">
                  {prioritizedGaps.map((pg, i) => (
                    <div
                      key={pg.gap_id}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[rgba(251,146,60,0.4)] transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedGapForClosure(pg.gap_id);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      <span className="text-xs font-bold text-[var(--text-muted)] w-6">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-[var(--text-primary)] block truncate">{pg.title}</span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {pg.source_company && <>{pg.source_company} · </>}{pg.fill_tier || "unclassified"} · {pg.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {pg.existing_plans.length > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(52,211,153,0.15)] text-[#34d399]">
                            {pg.existing_plans.length} plan{pg.existing_plans.length > 1 ? "s" : ""}
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          pg.priority === "critical" ? "bg-[rgba(239,68,68,0.15)] text-[#ef4444]" :
                          pg.priority === "high" ? "bg-[rgba(245,158,11,0.15)] text-[#f59e0b]" :
                          "bg-[rgba(124,173,232,0.15)] text-[#7cade8]"
                        }`}>
                          {pg.priority}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Existing Plans */}
              {closurePlans.length > 0 && (
                <div className="space-y-2 mt-6">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
                    <FileText size={14} /> Existing Closure Plans
                  </h3>
                  {closurePlansLoading ? (
                    <p className="text-sm text-[var(--text-muted)]">Loading plans...</p>
                  ) : (
                    <div className="space-y-2">
                      {closurePlans.map(p => (
                        <button
                          key={p.id}
                          onClick={() => handleLoadPlan(p.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[rgba(251,146,60,0.4)] text-left transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-[var(--text-primary)] block">{p.gap_title}</span>
                            <span className="text-xs text-[var(--text-muted)]">
                              calibrated to {p.calibrated_to || p.target_company} · {p.done_steps}/{p.total_steps} steps done
                              {p.companies_affected?.length > 1 && ` · ${p.companies_affected.length} companies`}
                            </span>
                          </div>
                          <div className="w-16 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#34d399] transition-all"
                              style={{ width: `${p.total_steps > 0 ? (p.done_steps / p.total_steps) * 100 : 0}%` }}
                            />
                          </div>
                          <ArrowRight size={14} className="text-[var(--text-muted)]" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Active Plan Display */}
          {activePlanLoading && (
            <div className="text-center py-8">
              <Loader2 size={24} className="mx-auto animate-spin text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-muted)] mt-2">Loading plan...</p>
            </div>
          )}

          {activePlan && !activePlanLoading && (
            <div className="space-y-4">
              {/* Plan Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">{activePlan.gap_title}</h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Calibrated to <span className="text-[var(--text-primary)] font-medium">{activePlan.calibrated_to || activePlan.target_company}</span>
                    {activePlan.calibration_tier && <span className="opacity-60"> ({activePlan.calibration_tier})</span>}
                    {activePlan.companies_affected?.length > 1 && (
                      <> · closes gap at {activePlan.companies_affected.length} companies</>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setActivePlan(null)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  Back to queue
                </button>
              </div>

              {/* Section 1: Company Assessment */}
              <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                <button
                  onClick={() => setExpandedSection(expandedSection === "company_assessment" ? null : "company_assessment")}
                  className="w-full flex items-center gap-2 px-4 py-3 bg-[var(--bg-secondary)] text-left"
                >
                  <Building2 size={14} className="text-[#60a5fa]" />
                  <span className="text-sm font-medium text-[var(--text-primary)] flex-1">Company Assessment Intelligence</span>
                  {expandedSection === "company_assessment" ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {expandedSection === "company_assessment" && activePlan.company_assessment && (
                  <div className="px-4 py-4 space-y-4 text-sm">
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-[#60a5fa] mb-1">Interview Process</h4>
                      <p className="text-[var(--text-secondary)] whitespace-pre-wrap">{activePlan.company_assessment.interview_process}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-[#60a5fa] mb-1">Signals They Look For</h4>
                      <p className="text-[var(--text-secondary)] whitespace-pre-wrap">{activePlan.company_assessment.signals_they_look_for}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-[#60a5fa] mb-1">Operating Level Bar</h4>
                      <p className="text-[var(--text-secondary)] whitespace-pre-wrap">{activePlan.company_assessment.operating_level_bar}</p>
                    </div>
                    {activePlan.company_assessment.internal_examples?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#60a5fa] mb-1">Internal Examples</h4>
                        <ul className="space-y-1">
                          {activePlan.company_assessment.internal_examples.map((ex: string, i: number) => (
                            <li key={i} className="text-[var(--text-secondary)] pl-3 border-l-2 border-[rgba(96,165,250,0.3)]">{ex}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Section 2: Existing Evidence */}
              <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                <button
                  onClick={() => setExpandedSection(expandedSection === "existing_evidence" ? null : "existing_evidence")}
                  className="w-full flex items-center gap-2 px-4 py-3 bg-[var(--bg-secondary)] text-left"
                >
                  <Briefcase size={14} className="text-[#34d399]" />
                  <span className="text-sm font-medium text-[var(--text-primary)] flex-1">Existing Evidence Mining</span>
                  {expandedSection === "existing_evidence" ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {expandedSection === "existing_evidence" && activePlan.existing_evidence && (
                  <div className="px-4 py-4 space-y-4 text-sm">
                    {activePlan.existing_evidence.vault_matches?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#34d399] mb-2">Vault Matches</h4>
                        <div className="space-y-2">
                          {activePlan.existing_evidence.vault_matches.map((vm: any, i: number) => (
                            <div key={i} className="p-3 rounded-lg border border-[rgba(52,211,153,0.3)] bg-[rgba(52,211,153,0.04)]">
                              <p className="text-[var(--text-primary)] font-medium text-xs">{vm.title} ({vm.company})</p>
                              <p className="text-[var(--text-secondary)] mt-1">{vm.reframe_suggestion}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {activePlan.existing_evidence.industry_research && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#34d399] mb-1">Industry Research</h4>
                        <p className="text-[var(--text-secondary)] whitespace-pre-wrap">{activePlan.existing_evidence.industry_research}</p>
                      </div>
                    )}
                    {activePlan.existing_evidence.era_narratives?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#34d399] mb-1">Era-Specific Narratives</h4>
                        <ul className="space-y-1">
                          {activePlan.existing_evidence.era_narratives.map((n: string, i: number) => (
                            <li key={i} className="text-[var(--text-secondary)] pl-3 border-l-2 border-[rgba(52,211,153,0.3)]">{n}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {activePlan.existing_evidence.storytelling_frameworks && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#34d399] mb-1">Storytelling Framework</h4>
                        <p className="text-[var(--text-secondary)] whitespace-pre-wrap">{activePlan.existing_evidence.storytelling_frameworks}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Section 3: Closure Path */}
              <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                <button
                  onClick={() => setExpandedSection(expandedSection === "closure_path" ? null : "closure_path")}
                  className="w-full flex items-center gap-2 px-4 py-3 bg-[var(--bg-secondary)] text-left"
                >
                  <Map size={14} className="text-[#fb923c]" />
                  <span className="text-sm font-medium text-[var(--text-primary)] flex-1">
                    Closure Path
                    <span className="text-xs text-[var(--text-muted)] ml-2">
                      {activePlan.closure_path?.filter((s: any) => s.status === "done").length}/{activePlan.closure_path?.length} steps
                    </span>
                  </span>
                  {expandedSection === "closure_path" ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {expandedSection === "closure_path" && activePlan.closure_path && (
                  <div className="px-4 py-4 space-y-3">
                    {activePlan.closure_path.map((step: any, i: number) => {
                      const STEP_COLORS: Record<string, string> = {
                        reframe: "#34d399", orient: "#60a5fa", train: "#a78bfa",
                        prototype: "#fb923c", publish: "#f472b6", consult: "#fbbf24",
                      };
                      const stepColor = STEP_COLORS[step.step_type] || "#6b7280";
                      const isDone = step.status === "done";
                      const isInProgress = step.status === "in-progress";

                      return (
                        <div key={i} className={`rounded-lg border p-3 transition-colors ${
                          isDone ? "border-[rgba(52,211,153,0.4)] bg-[rgba(52,211,153,0.04)]" :
                          isInProgress ? "border-[rgba(251,146,60,0.4)] bg-[rgba(251,146,60,0.04)]" :
                          "border-[var(--border)]"
                        }`}>
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => {
                                const nextStatus = isDone ? "pending" : isInProgress ? "done" : "in-progress";
                                handleUpdateStepStatus(activePlan.id, i, nextStatus);
                              }}
                              className="mt-0.5 shrink-0"
                              title={isDone ? "Mark as pending" : isInProgress ? "Mark as done" : "Start this step"}
                            >
                              {isDone ? (
                                <CheckCircle2 size={18} className="text-[#34d399]" />
                              ) : isInProgress ? (
                                <Loader2 size={18} className="text-[#fb923c] animate-spin" />
                              ) : (
                                <Circle size={18} className="text-[var(--text-muted)] opacity-40" />
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
                                  backgroundColor: `${stepColor}20`,
                                  color: stepColor,
                                }}>
                                  {step.step_type}
                                </span>
                                <span className={`text-sm font-medium ${isDone ? "text-[var(--text-muted)] line-through" : "text-[var(--text-primary)]"}`}>
                                  {step.title}
                                </span>
                                <span className="text-xs text-[var(--text-muted)] ml-auto shrink-0">{step.time_estimate}</span>
                              </div>
                              <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">{step.description}</p>
                              {step.resources?.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {step.resources.map((r: any, ri: number) => (
                                    <span key={ri} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border)]">
                                      {r.url ? (
                                        <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--text-primary)] flex items-center gap-1">
                                          {r.title} <ExternalLink size={10} />
                                        </a>
                                      ) : (
                                        r.title
                                      )}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {step.artifacts?.length > 0 && (
                                <div className="mt-1 text-xs text-[var(--text-muted)]">
                                  Produces: {step.artifacts.join(", ")}
                                </div>
                              )}
                              {/* Enriched closure plan step fields */}
                              {step.what_good_looks_like && (
                                <div className="mt-2 p-2.5 rounded-lg bg-[rgba(167,139,250,0.06)] border border-[rgba(167,139,250,0.15)]">
                                  <div className="text-[10px] font-medium text-[#a78bfa] mb-1 flex items-center gap-1"><Target size={10} /> What Good Looks Like</div>
                                  <div className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">{step.what_good_looks_like}</div>
                                </div>
                              )}
                              {step.prototype_idea && (
                                <div className="mt-1.5 p-2.5 rounded-lg bg-[rgba(251,146,60,0.06)] border border-[rgba(251,146,60,0.15)]">
                                  <div className="text-[10px] font-medium text-[#fb923c] mb-1 flex items-center gap-1"><Lightbulb size={10} /> Prototype Idea</div>
                                  <div className="text-xs text-[var(--text-secondary)]">{step.prototype_idea}</div>
                                </div>
                              )}
                              {step.vault_fields_fed?.length > 0 && (
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                  <Package size={10} className="text-[var(--text-muted)]" />
                                  {step.vault_fields_fed.map((f: string, fi: number) => (
                                    <span key={fi} className="px-1.5 py-0.5 rounded text-[9px] bg-[rgba(96,165,250,0.1)] text-[#60a5fa]">{f}</span>
                                  ))}
                                </div>
                              )}
                              {step.journal_note && (
                                <p className="mt-1 text-xs text-[#34d399] italic">Note: {step.journal_note}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Section 4: Vault Record Draft */}
              {activePlan.vault_record_draft && activePlan.vault_record_draft.name && (
                <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                  <button
                    onClick={() => setExpandedSection(expandedSection === "vault_draft" ? null : "vault_draft")}
                    className="w-full flex items-center gap-2 px-4 py-3 bg-[var(--bg-secondary)] text-left"
                  >
                    <Package size={14} className="text-[#34d399]" />
                    <span className="text-sm font-medium text-[var(--text-primary)] flex-1">Vault Record Draft</span>
                    <span className="text-xs text-[var(--text-muted)]">{activePlan.vault_record_draft.type}</span>
                    {expandedSection === "vault_draft" ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  {expandedSection === "vault_draft" && (
                    <div className="px-4 py-4 space-y-3">
                      <div className="text-sm font-medium text-[var(--text-primary)]">{activePlan.vault_record_draft.name}</div>
                      {activePlan.vault_record_draft.tagline && <div className="text-xs text-[var(--text-muted)] italic">{activePlan.vault_record_draft.tagline}</div>}
                      {activePlan.vault_record_draft.description && <div className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">{activePlan.vault_record_draft.description}</div>}
                      {activePlan.vault_record_draft.tech_stack?.length > 0 && (
                        <div>
                          <div className="text-[10px] font-medium text-[var(--text-muted)] mb-1">Tech Stack / Methodologies</div>
                          <div className="flex flex-wrap gap-1">{activePlan.vault_record_draft.tech_stack.map((t: string, i: number) => (
                            <span key={i} className="px-1.5 py-0.5 rounded text-[9px] bg-[rgba(96,165,250,0.1)] text-[#60a5fa]">{t}</span>
                          ))}</div>
                        </div>
                      )}
                      {activePlan.vault_record_draft.display_skills?.length > 0 && (
                        <div>
                          <div className="text-[10px] font-medium text-[var(--text-muted)] mb-1">Display Skills</div>
                          <div className="flex flex-wrap gap-1">{activePlan.vault_record_draft.display_skills.map((s: string, i: number) => (
                            <span key={i} className="px-1.5 py-0.5 rounded text-[9px] bg-[rgba(167,139,250,0.1)] text-[#a78bfa]">{s}</span>
                          ))}</div>
                        </div>
                      )}
                      {activePlan.vault_record_draft.highlight && (
                        <div className="p-2 rounded-lg bg-[rgba(251,191,36,0.06)] border border-[rgba(251,191,36,0.15)] text-xs">
                          <span className="text-[#fbbf24]">★</span> {activePlan.vault_record_draft.highlight}
                        </div>
                      )}
                      {activePlan.vault_record_draft.learned && (
                        <div className="text-xs text-[var(--text-secondary)]"><span className="font-medium text-[var(--text-muted)]">Key Learning:</span> {activePlan.vault_record_draft.learned}</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Section 5: Interview Stories */}
              {activePlan.interview_stories && activePlan.interview_stories.length > 0 && (
                <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                  <button
                    onClick={() => setExpandedSection(expandedSection === "interview_stories" ? null : "interview_stories")}
                    className="w-full flex items-center gap-2 px-4 py-3 bg-[var(--bg-secondary)] text-left"
                  >
                    <MessageSquare size={14} className="text-[#a78bfa]" />
                    <span className="text-sm font-medium text-[var(--text-primary)] flex-1">Interview Stories</span>
                    <span className="text-xs text-[var(--text-muted)]">{activePlan.interview_stories.length} stories</span>
                    {expandedSection === "interview_stories" ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  {expandedSection === "interview_stories" && (
                    <div className="px-4 py-4 space-y-3">
                      {activePlan.interview_stories.map((story: any, si: number) => (
                        <div key={si} className="p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)]">
                          <div className="text-xs font-medium text-[var(--text-primary)] mb-1">{story.story_title}</div>
                          <div className="text-[10px] text-[var(--text-muted)] mb-2 italic">Q: {story.question}</div>
                          <div className="space-y-1.5 text-xs text-[var(--text-secondary)]">
                            <div><span className="font-medium text-[#34d399]">S:</span> {story.situation}</div>
                            <div><span className="font-medium text-[#60a5fa]">T:</span> {story.task}</div>
                            <div><span className="font-medium text-[#fb923c]">A:</span> {story.action}</div>
                            <div><span className="font-medium text-[#a78bfa]">R:</span> {story.result}</div>
                          </div>
                          {story.follow_ups?.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-[var(--border)]">
                              <div className="text-[10px] text-[var(--text-muted)] mb-1">Follow-up Drill-downs:</div>
                              {story.follow_ups.map((fu: any, fi: number) => (
                                <div key={fi} className="text-[10px] text-[var(--text-muted)] mt-1">
                                  <div className="font-medium">↳ {fu.question}</div>
                                  <div className="ml-3 text-[var(--text-secondary)]">{fu.answer_guidance}</div>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-2 text-[9px] text-[var(--text-muted)]">
                            <span className={`px-1.5 py-0.5 rounded ${story.confidence === "high" ? "bg-[rgba(34,197,94,0.1)] text-[#22c55e]" : story.confidence === "medium" ? "bg-[rgba(251,146,60,0.1)] text-[#fb923c]" : "bg-[rgba(239,68,68,0.1)] text-[#ef4444]"}`}>
                              {story.confidence} confidence
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Section 6: Definition of Done */}
              <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                <button
                  onClick={() => setExpandedSection(expandedSection === "definition_of_done" ? null : "definition_of_done")}
                  className="w-full flex items-center gap-2 px-4 py-3 bg-[var(--bg-secondary)] text-left"
                >
                  <CheckCircle size={14} className="text-[#a78bfa]" />
                  <span className="text-sm font-medium text-[var(--text-primary)] flex-1">Definition of Done</span>
                  {expandedSection === "definition_of_done" ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {expandedSection === "definition_of_done" && activePlan.definition_of_done && (
                  <div className="px-4 py-4 space-y-4 text-sm">
                    {activePlan.definition_of_done.artifacts_checklist?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#a78bfa] mb-2">Artifacts Checklist</h4>
                        <ul className="space-y-1">
                          {activePlan.definition_of_done.artifacts_checklist.map((a: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-[var(--text-secondary)]">
                              <Circle size={8} className="text-[var(--text-muted)] mt-1.5 shrink-0" />
                              {a}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {activePlan.definition_of_done.interview_answer_draft && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#a78bfa] mb-1">Interview Answer Draft</h4>
                        <blockquote className="pl-3 border-l-2 border-[rgba(167,139,250,0.4)] text-[var(--text-secondary)] italic whitespace-pre-wrap">
                          {activePlan.definition_of_done.interview_answer_draft}
                        </blockquote>
                      </div>
                    )}
                    {activePlan.definition_of_done.vault_update_needed && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#a78bfa] mb-1">Vault Update</h4>
                        <p className="text-[var(--text-secondary)]">{activePlan.definition_of_done.vault_update_needed}</p>
                      </div>
                    )}
                    {activePlan.definition_of_done.self_assessment_prompt && (
                      <div className="p-3 rounded-lg border border-[rgba(167,139,250,0.3)] bg-[rgba(167,139,250,0.04)]">
                        <h4 className="text-xs font-semibold text-[#a78bfa] mb-1">Self-Assessment</h4>
                        <p className="text-[var(--text-secondary)] italic">{activePlan.definition_of_done.self_assessment_prompt}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Closure Journal */}
              {activePlan.closure_journal?.length > 0 && (
                <div className="rounded-xl border border-[var(--border)] p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2 flex items-center gap-2">
                    <BookOpen size={12} /> Closure Journal
                  </h4>
                  <div className="space-y-1">
                    {activePlan.closure_journal.map((entry: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-[var(--text-muted)]">
                        <span className="shrink-0 opacity-60">{new Date(entry.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                        <span className="text-[var(--text-secondary)]">{entry.action}{entry.note ? ` — ${entry.note}` : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
          )}

          {/* ── Company Readiness View ──────────────────────── */}
          {closureSubTab === "companies" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <Building2 size={16} className="text-[#7cade8]" /> Per-Company Gap Coverage
                </h3>
                <button
                  onClick={fetchCompanyReadiness}
                  disabled={companyReadinessLoading}
                  className="text-[10px] px-2 py-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors disabled:opacity-40"
                >
                  {companyReadinessLoading ? <Loader2 size={12} className="animate-spin" /> : "↻ Refresh"}
                </button>
              </div>

              {companyReadinessLoading && companyReadiness.length === 0 ? (
                <div className="text-center py-8">
                  <Loader2 size={24} className="mx-auto animate-spin text-[var(--text-muted)]" />
                  <p className="text-sm text-[var(--text-muted)] mt-2">Calculating company readiness...</p>
                </div>
              ) : companyReadiness.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] py-4">No company-linked gaps found. Run JD scans first.</p>
              ) : (
                <div className="space-y-2">
                  {companyReadiness.map((cr) => {
                    const isExpanded = expandedCompany === cr.company;
                    const barColor = cr.readiness_pct >= 90 ? "#22c55e" : cr.readiness_pct >= 70 ? "#fb923c" : cr.readiness_pct >= 50 ? "#eab308" : "#ef4444";
                    return (
                      <div key={cr.company} className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden">
                        <button
                          onClick={() => setExpandedCompany(isExpanded ? null : cr.company)}
                          className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[rgba(124,173,232,0.04)] transition-colors"
                        >
                          <div className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold" style={{ backgroundColor: `${barColor}20`, color: barColor }}>
                            {cr.readiness_pct}%
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-[var(--text-primary)] truncate">{cr.company}</span>
                              <span className="text-[10px] text-[var(--text-muted)]">{cr.resolved_gaps}/{cr.total_gaps} gaps covered</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${cr.readiness_pct}%`, backgroundColor: barColor }} />
                              </div>
                              <span className="text-[10px] text-[var(--text-muted)] shrink-0">{cr.roles.length > 0 ? cr.roles[0] : ""}{cr.roles.length > 1 ? ` +${cr.roles.length - 1}` : ""}</span>
                            </div>
                          </div>
                          {isExpanded ? <ChevronUp size={14} className="text-[var(--text-muted)]" /> : <ChevronDown size={14} className="text-[var(--text-muted)]" />}
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-4 space-y-3 border-t border-[var(--border)]">
                            {/* Roles */}
                            {cr.roles.length > 0 && (
                              <div className="pt-3">
                                <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">Roles analyzed</span>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {cr.roles.map((role) => (
                                    <span key={role} className="px-2 py-0.5 rounded-md text-[10px] bg-[rgba(124,173,232,0.1)] text-[#7cade8] border border-[rgba(124,173,232,0.2)]">{role}</span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Resolution breakdown */}
                            {Object.keys(cr.gaps_by_resolution).length > 0 && (
                              <div>
                                <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">How gaps were closed</span>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {Object.entries(cr.gaps_by_resolution).map(([type, count]) => (
                                    <span key={type} className="px-2 py-0.5 rounded-md text-[10px] bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border)]">
                                      {type}: {count as number}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Open gaps */}
                            {cr.open_gaps.length > 0 && (
                              <div>
                                <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                                  {cr.open_gaps.length} open gap{cr.open_gaps.length !== 1 ? "s" : ""} remaining
                                </span>
                                <div className="mt-1.5 space-y-1">
                                  {cr.open_gaps.map((g) => {
                                    const pColor = g.priority === "critical" ? "#ef4444" : g.priority === "high" ? "#fb923c" : g.priority === "medium" ? "#eab308" : "#94a3b8";
                                    return (
                                      <div key={g.id} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)]">
                                        <span className="shrink-0 w-1.5 h-1.5 rounded-full mt-1.5" style={{ backgroundColor: pColor }} />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs text-[var(--text-primary)] truncate">{g.title}</p>
                                          <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] font-medium" style={{ color: pColor }}>{g.priority}</span>
                                            {g.fill_tier && <span className="text-[10px] text-[var(--text-muted)]">{g.fill_tier}</span>}
                                            {g.fill_action && <span className="text-[10px] text-[var(--text-muted)] truncate">— {g.fill_action}</span>}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {cr.open_gaps.length === 0 && (
                              <div className="flex items-center gap-2 pt-2 text-xs text-[#22c55e]">
                                <CheckCircle2 size={14} /> All gaps covered for this company
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
        </div>
      )}

      {/* ── Learning & Credentialing Plan Tab ────────────── */}
      {tab === "credentialing" && (
        <div className="space-y-6">

          {/* Strategy Header */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#a78bfa] to-[#7c3aed] flex items-center justify-center shrink-0">
                <GraduationCap size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">18-Month Learning &amp; Credentialing Plan</h2>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  Strategic investments to break out of banking into consumer tech / AI PM roles.
                  Optimized for signal-to-time ratio — credentials that hiring panels at target companies actually weight.
                </p>
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Clock size={12} className="text-[var(--text-muted)]" />
                    <span className="text-[var(--text-muted)]">Timeline: 18 months (while employed at WF)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <TrendingUp size={12} className="text-[var(--text-muted)]" />
                    <span className="text-[var(--text-muted)]">Total investment: ~$6-8K</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Core Thesis */}
          <div className="rounded-xl border border-[#a78bfa]/30 bg-[#a78bfa]/5 p-4">
            <div className="flex items-start gap-3">
              <Lightbulb size={16} className="text-[#a78bfa] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Core thesis</p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  In the age of AI, understanding <span className="font-semibold text-[var(--text-primary)]">why</span> something
                  needs to be built matters more than technical implementation skills. Customer discovery, problem framing,
                  and strategic product thinking are the enduring PM skills. Technical literacy (not expertise) is the bar.
                  These investments close the credential gap without chasing stale engineering degrees.
                </p>
              </div>
            </div>
          </div>

          {/* Tier 1 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#f87171] flex items-center justify-center">
                <span className="text-xs font-bold text-white">1</span>
              </div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Tier 1 — Non-Negotiable</h3>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#f87171]/10 text-[#f87171]">DO THESE</span>
            </div>

            <div className="grid gap-3">
              {/* Reforge */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#fb923c]/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Compass size={16} className="text-[#fb923c]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--text-primary)]">Reforge Membership</h4>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">Product Strategy &amp; Growth cohort programs</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-2">
                      Highest-signal PM credential in the industry. Designed for senior PM → director transition.
                      Teaches frameworks that consumer tech companies speak fluently and banking doesn&apos;t.
                      Network full of people at target companies. Closes the &quot;does this person think like us&quot; gap.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-primary)] text-[var(--text-muted)] border border-[var(--border)]">Months 1-6</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-primary)] text-[var(--text-muted)] border border-[var(--border)]">$2K/year</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-primary)] text-[var(--text-muted)] border border-[var(--border)]">Cohort-based</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-primary)] text-[var(--text-muted)] border border-[var(--border)]">6+ years exp required</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-[var(--border)]">
                  <p className="text-[11px] text-[var(--text-muted)]">
                    <span className="font-medium text-[#fb923c]">Why this over alternatives:</span>{" "}
                    Compared to Wharton/Stanford exec ed ($5-15K), Reforge is $2K with better PM-specific content.
                    40+ courses, weekly events, Slack community, 1,000+ real examples.
                  </p>
                </div>
              </div>

              {/* AI Cert */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#22c55e]/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Zap size={16} className="text-[#22c55e]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--text-primary)]">AI/ML Fluency Certificate</h4>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">Google Cloud Generative AI Leader (free) or AWS AI Developer (~$300)</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-2">
                      Resume line item that signals &quot;I&apos;m current on AI&quot; and gets past ATS keyword filters.
                      Not deep learning — it&apos;s literacy. Quick win that&apos;s done in a month.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-primary)] text-[var(--text-muted)] border border-[var(--border)]">Months 1-2</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20">Free – $300</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-primary)] text-[var(--text-muted)] border border-[var(--border)]">4-6 weeks</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-primary)] text-[var(--text-muted)] border border-[var(--border)]">Self-paced</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tier 2 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#fb923c] flex items-center justify-center">
                <span className="text-xs font-bold text-white">2</span>
              </div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Tier 2 — High Value</h3>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#fb923c]/10 text-[#fb923c]">DO IF YOU CAN FIT</span>
            </div>

            <div className="grid gap-3">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#a78bfa]/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles size={16} className="text-[#a78bfa]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--text-primary)]">Stanford AI for Product Management</h4>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">Prestige play for AI PM specialization</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-2">
                      More rigorous than Product School or Maven. Covers how models are trained/deployed,
                      evaluation frameworks, AI product strategy. The Stanford name changes how engineering
                      managers read your candidacy.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-primary)] text-[var(--text-muted)] border border-[var(--border)]">Months 3-6</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-primary)] text-[var(--text-muted)] border border-[var(--border)]">~$2-3K</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-primary)] text-[var(--text-muted)] border border-[var(--border)]">2-3 months</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#38bdf8]/10 flex items-center justify-center shrink-0 mt-0.5">
                    <BarChart3 size={16} className="text-[#38bdf8]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--text-primary)]">Data Fluency (SQL + Analytics)</h4>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">DataCamp, Mode Analytics, or Kaggle projects</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-2">
                      Consumer tech PMs are expected to be self-serve on data. Banking PMs often have analysts
                      doing this for them. Table stakes at Spotify, Airbnb, or any Series B+ company.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-primary)] text-[var(--text-muted)] border border-[var(--border)]">Months 3-6</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20">Free – $300</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-primary)] text-[var(--text-muted)] border border-[var(--border)]">4-6 weeks</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tier 3 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#38bdf8] flex items-center justify-center">
                <span className="text-xs font-bold text-white">3</span>
              </div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Tier 3 — Worth Considering</h3>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#38bdf8]/10 text-[#38bdf8]">LOWER URGENCY</span>
            </div>

            <div className="grid gap-3">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--bg-primary)] flex items-center justify-center shrink-0 mt-0.5">
                    <BookOpen size={16} className="text-[var(--text-muted)]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--text-primary)]">Product School AI for PMs</h4>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">Structured cert, faster than Stanford, LinkedIn-recognizable</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-primary)] text-[var(--text-muted)] border border-[var(--border)]">~$2K</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-primary)] text-[var(--text-muted)] border border-[var(--border)]">6 weeks</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--bg-primary)] flex items-center justify-center shrink-0 mt-0.5">
                    <Target size={16} className="text-[var(--text-muted)]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--text-primary)]">Design Thinking / UX Research</h4>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">Teresa Torres Continuous Discovery Habits or IDEO Design Thinking cert</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-2">
                      Reinforces the &quot;why to build&quot; over &quot;how to build&quot; thesis with formal methodology.
                      Customer discovery, Jobs-to-be-Done, continuous discovery.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-primary)] text-[var(--text-muted)] border border-[var(--border)]">$500-2K</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-primary)] text-[var(--text-muted)] border border-[var(--border)]">4-8 weeks</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Explicitly Skipped */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <XCircle size={16} className="text-[var(--text-muted)]" />
              <h3 className="text-sm font-semibold text-[var(--text-muted)]">Explicitly Skipped</h3>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
              <div className="grid gap-3">
                <div className="flex items-start gap-3">
                  <X size={14} className="text-[var(--text-muted)] mt-0.5 shrink-0" />
                  <div>
                    <span className="text-sm font-medium text-[var(--text-secondary)]">Georgia Tech OMSCS</span>
                    <span className="text-xs text-[var(--text-muted)] ml-2">~$7K, 1.5-6 years</span>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">Too deep, too long, wrong signal. Not trying to become an engineer — proving you can work with them.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <X size={14} className="text-[var(--text-muted)] mt-0.5 shrink-0" />
                  <div>
                    <span className="text-sm font-medium text-[var(--text-secondary)]">Generic PM Certs (PSPO, CSPO, SAFe)</span>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">For people breaking into PM. With 15+ years, these are noise, not signal.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <X size={14} className="text-[var(--text-muted)] mt-0.5 shrink-0" />
                  <div>
                    <span className="text-sm font-medium text-[var(--text-secondary)]">PM Bootcamps</span>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">You already are a PM. These are entry-level.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-[var(--text-primary)]" />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">18-Month Sequence</h3>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
              <div className="space-y-4">
                {[
                  { phase: "Months 1-2", color: "#f87171", items: ["Google Cloud AI cert (free, get it done fast)", "Start Reforge membership ($2K)"] },
                  { phase: "Months 3-6", color: "#fb923c", items: ["Reforge cohort: Product Strategy or Growth", "Stanford AI for PM (if targeting AI roles)", "Data fluency crash course (SQL, self-serve analytics)"] },
                  { phase: "Months 6-9", color: "#fbbf24", items: ["Apply Reforge frameworks to portfolio content", "Second Reforge cohort available"] },
                  { phase: "Months 9-12", color: "#34d399", items: ["Design thinking / UX research course", "Portfolio + credential narrative fully polished"] },
                  { phase: "Months 12-18", color: "#38bdf8", items: ["Network activation leveraging Reforge connections", "All credentials complete — shift to active search"] },
                ].map(p => (
                  <div key={p.phase} className="flex gap-4">
                    <div className="shrink-0 w-24">
                      <span className="text-xs font-semibold" style={{ color: p.color }}>{p.phase}</span>
                    </div>
                    <div className="flex-1 border-l-2 pl-4 pb-2" style={{ borderColor: p.color + "40" }}>
                      {p.items.map((item, i) => (
                        <div key={i} className="flex items-start gap-2 mb-1.5">
                          <Circle size={6} className="mt-1.5 shrink-0" style={{ color: p.color }} fill={p.color} />
                          <span className="text-xs text-[var(--text-secondary)]">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* MBA Decision Box */}
          <div className="rounded-xl border border-[#fbbf24]/30 bg-[#fbbf24]/5 p-4">
            <div className="flex items-start gap-3">
              <MessageSquare size={16} className="text-[#fbbf24] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">MBA Decision: Deferred</p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  BU Questrom edX MBA ($25K, 2 years online) is the best cost-to-prestige option if a credential is needed.
                  Decision deferred to month 6-8 — run the job search with portfolio + Reforge first.
                  If credential filtering is real and measurable after active applications, enroll for the next cohort.
                  Check Wells Fargo education reimbursement ($5-10K/year typical for big banks).
                </p>
              </div>
            </div>
          </div>

          {/* Non-Traditional Proof Points */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Wrench size={16} className="text-[var(--text-primary)]" />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Non-Traditional Engineering Competency Signals</h3>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
              <p className="text-xs text-[var(--text-muted)] mb-3">
                What hiring panels actually screen for when they write &quot;STEM degree&quot; or &quot;engineering background&quot; — and how to signal it without the credential:
              </p>
              <div className="space-y-3">
                {[
                  { stated: "\"STEM degree\"", actual: "Comfortable with technical depth", signal: "Show the portfolio site code. Talk API integration, system architecture, debugging real problems." },
                  { stated: "\"Engineering background\"", actual: "Can translate between PM and eng", signal: "Talk about collaboration with engineers, technical debt decisions, shipping complex features. Your site IS the proof." },
                  { stated: "\"Master's degree\"", actual: "Senior judgment, strategic thinking", signal: "Track record of shipped products, business impact metrics, org influence. Reforge adds the strategic frameworks." },
                ].map((row, i) => (
                  <div key={i} className="grid grid-cols-3 gap-3 text-xs">
                    <div><span className="font-medium text-[var(--text-secondary)]">{row.stated}</span></div>
                    <div><span className="text-[var(--text-muted)]">{row.actual}</span></div>
                    <div><span className="text-[var(--text-secondary)]">{row.signal}</span></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── Create Initiative from Gap Modal ─────────────── */}
      {creatingFromGap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md mx-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Briefcase size={16} className="text-[#fb923c]" />
                Create Vault Initiative from Gap
              </h3>
              <button onClick={closeGapToInitiative} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {/* Source requirement */}
              <div className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]">
                <p className="text-xs text-[var(--text-muted)] mb-1">Closing gap for:</p>
                <p className="text-sm text-[var(--text-primary)]">{creatingFromGap.requirement}</p>
              </div>

              {gapInitSuccess ? (
                <div className="px-3 py-3 rounded-lg bg-[rgba(52,211,153,0.12)] border border-[rgba(52,211,153,0.3)] text-center">
                  <CheckCircle2 size={24} className="mx-auto mb-2 text-[#34d399]" />
                  <p className="text-sm text-[#34d399] font-medium">Initiative created!</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">ID: {gapInitSuccess}</p>
                  <p className="text-xs text-[var(--text-muted)]">Visible in Career Vault. Mark as draft — flesh out the 4-beat narrative there.</p>
                  <button onClick={closeGapToInitiative} className="mt-3 px-4 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--text-secondary)]">
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Initiative Title</label>
                    <input
                      value={gapInitTitle}
                      onChange={e => setGapInitTitle(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">One-liner / Action</label>
                    <input
                      value={gapInitOneLiner}
                      onChange={e => setGapInitOneLiner(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)]"
                    />
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    This creates a draft initiative (not public, not Fenix-indexed). Flesh out the full narrative in Career Vault.
                  </p>
                  <div className="flex justify-end gap-2">
                    <button onClick={closeGapToInitiative} className="px-4 py-2 text-xs rounded-lg border border-[var(--border)] text-[var(--text-secondary)]">
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateInitiativeFromGap}
                      disabled={gapInitSaving || !gapInitTitle.trim()}
                      className="flex items-center gap-1 px-4 py-2 text-xs rounded-lg bg-[#fb923c] text-white hover:opacity-90 disabled:opacity-40"
                    >
                      <Save size={12} /> {gapInitSaving ? "Creating..." : "Create Initiative"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// GAP TAB CONTENT COMPONENT
// ────────────────────────────────────────────────────────────

const RESOLUTION_TYPES = [
  { key: "have-it", label: "I have this", icon: CheckCircle2, color: "#34d399", description: "False positive — I already have this qualification or skill" },
  { key: "reframed", label: "Reframed", icon: FileText, color: "#60a5fa", description: "Updated my narrative to better articulate existing experience" },
  { key: "built-proof", label: "Built proof", icon: Zap, color: "#fb923c", description: "Created a new initiative, prototype, or artifact as evidence" },
  { key: "certified", label: "Got certified", icon: GraduationCap, color: "#a78bfa", description: "Added a certification or course as evidence" },
  { key: "not-pursuing", label: "Not pursuing", icon: XCircle, color: "#6b7280", description: "Not relevant to my target roles — deprioritizing" },
  { key: "not-a-gap", label: "Not a gap", icon: CheckCircle2, color: "#8B5CF6", description: "Table stakes — I can talk to this in conversation, no evidence needed" },
];

function GapTabContent({
  items,
  categoryFilter,
  statusFilter,
  onUpdateStatus,
  onCloseGap,
  onNavigateToClosure,
  onGenerateInterviewPrep,
  generatingPrepId,
}: {
  items: GapItem[];
  categoryFilter: string | null;
  statusFilter: string | null;
  onUpdateStatus: (id: string, status: string) => void;
  onCloseGap: (id: string, resolutionType: string, note: string) => void;
  onNavigateToClosure?: (gapId: string) => void;
  onGenerateInterviewPrep?: (gapId: string) => void;
  generatingPrepId?: string | null;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeType, setCloseType] = useState<string | null>(null);
  const [closeNote, setCloseNote] = useState("");

  // Normalize items: guard against null arrays
  const safeItems = (items ?? []).map(item => ({
    ...item,
    persona_relevance: item.persona_relevance ?? [],
  }));

  const filtered = safeItems.filter((item) => {
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
                        className="rounded-xl overflow-hidden transition-all bg-[var(--bg-secondary)] border border-[var(--border)]"
                      >
                        {/* Collapsed row */}
                        <button
                          onClick={() => setExpandedId(expanded ? null : item.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg-primary)] transition-all"
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
                            {item.source_jd_company ? (
                              <p className="text-xs text-[var(--text-muted)] truncate">
                                <span className="text-[#7cade8] font-medium">{item.source_jd_company}</span>
                                {item.source_jd_role && <span className="text-[var(--text-muted)]"> · {item.source_jd_role}</span>}
                                {item.fill_tier && <span className="text-[var(--text-muted)]"> · {item.fill_tier}</span>}
                              </p>
                            ) : item.description ? (
                              <p className="text-xs text-[var(--text-muted)] truncate">
                                {item.description}
                                {item.fill_tier && <span> · {item.fill_tier}</span>}
                              </p>
                            ) : null}
                          </div>
                          {item.persona_relevance.length > 0 && (
                            <div className="hidden sm:flex gap-1 flex-shrink-0">
                              {item.persona_relevance.slice(0, 3).map((p) => (
                                <span
                                  key={p}
                                  className="px-1.5 py-0.5 rounded text-[9px] bg-[var(--bg-primary)] text-[var(--text-muted)]"
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
                            {/* JD Source — always show if from a JD scan */}
                            {item.source_jd_company && (
                              <div className="mt-3 mb-3 px-3 py-2.5 rounded-lg bg-[rgba(124,173,232,0.06)] border border-[rgba(124,173,232,0.15)]">
                                <div className="flex items-start gap-2">
                                  <Briefcase size={13} className="text-[#7cade8] mt-0.5 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-[#7cade8]">
                                      {item.source_jd_company}{item.source_jd_role ? ` — ${item.source_jd_role}` : ""}
                                    </p>
                                    <p className="text-[11px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                                      JD requirement: <span className="italic">&ldquo;{item.title}&rdquo;</span>
                                    </p>
                                    {item.description && (
                                      <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-relaxed">
                                        {item.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                            {/* Fill Strategy — the "what to do" section */}
                            {(item.fill_tier || item.fill_action || item.fill_output) && (
                              <div className="mt-3 mb-3 px-3 py-2.5 rounded-lg bg-[rgba(251,146,60,0.05)] border border-[rgba(251,146,60,0.15)]">
                                <div className="flex items-start gap-2">
                                  <Target size={13} className="text-[#fb923c] mt-0.5 shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium text-[#fb923c]">
                                        {item.fill_tier === "articulate" ? "Articulate" : item.fill_tier === "build-proof" ? "Build Proof" : item.fill_tier === "certify" ? "Get Certified" : item.fill_tier === "true-gap" ? "True Gap" : "Fill Strategy"}
                                      </span>
                                      {item.fill_time_estimate && (
                                        <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                                          <Clock size={9} /> {item.fill_time_estimate}
                                        </span>
                                      )}
                                    </div>
                                    {item.fill_action && (
                                      <p className="text-[11px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                                        <strong className="text-[var(--text-primary)]">Action:</strong> {item.fill_action}
                                      </p>
                                    )}
                                    {item.fill_output && (
                                      <p className="text-[11px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                                        <strong className="text-[var(--text-primary)]">Output:</strong> {item.fill_output}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-4 mt-4">
                              {/* Left: Info */}
                              <div className="space-y-3">
                                {item.why_it_matters && !item.source_jd_company && (
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
                                          className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--bg-primary)] text-[var(--text-secondary)]"
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
                                            : "bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
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
                                              className="text-[#60a5fa] hover:underline"
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
                                        className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--bg-primary)] text-[var(--text-muted)] mb-1"
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
                                          className="px-1.5 py-0.5 rounded text-[9px] bg-[var(--bg-primary)] text-[var(--text-muted)]"
                                        >
                                          {t}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* ── Interview Prep ──────────────── */}
                            {(!item.interview_questions || item.interview_questions.length === 0) && (
                              <div className="mt-3 flex items-center gap-2">
                                <button
                                  onClick={() => onGenerateInterviewPrep?.(item.id)}
                                  disabled={generatingPrepId === item.id}
                                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-[rgba(167,139,250,0.3)] text-[#a78bfa] hover:bg-[rgba(167,139,250,0.06)] transition-all disabled:opacity-40"
                                >
                                  {generatingPrepId === item.id ? <Loader2 size={12} className="animate-spin" /> : <BookOpen size={12} />}
                                  {generatingPrepId === item.id ? "Generating (~20s)..." : "Generate Interview Prep"}
                                </button>
                              </div>
                            )}
                            {(item.interview_questions && item.interview_questions.length > 0) && (
                              <div className="mt-3 px-3 py-2.5 rounded-lg bg-[rgba(167,139,250,0.05)] border border-[rgba(167,139,250,0.15)]">
                                <div className="flex items-center gap-2 mb-2">
                                  <BookOpen size={13} className="text-[#a78bfa]" />
                                  <span className="text-xs font-medium text-[#a78bfa]">Interview Prep</span>
                                  <span className="text-[10px] text-[var(--text-muted)]">{item.interview_questions.length} question{item.interview_questions.length !== 1 ? "s" : ""}</span>
                                  <button
                                    onClick={() => onGenerateInterviewPrep?.(item.id)}
                                    disabled={generatingPrepId === item.id}
                                    className="ml-auto text-[10px] text-[var(--text-muted)] hover:text-[#a78bfa] transition-colors disabled:opacity-40"
                                  >
                                    {generatingPrepId === item.id ? "Regenerating..." : "↻ Regenerate"}
                                  </button>
                                </div>
                                <div className="space-y-2">
                                  {item.interview_questions.map((q, qi) => (
                                    <div key={qi} className="px-2.5 py-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border)]">
                                      <p className="text-xs text-[var(--text-primary)] font-medium">&ldquo;{q.question}&rdquo;</p>
                                      {q.why_they_ask && <p className="text-[10px] text-[var(--text-muted)] mt-1"><span className="font-medium">Why they ask:</span> {q.why_they_ask}</p>}
                                      {q.signal && <p className="text-[10px] text-[var(--text-muted)]"><span className="font-medium">Signal:</span> {q.signal}</p>}
                                      {/* Show prepared answer if exists */}
                                      {item.prepared_answers && item.prepared_answers[qi] && (
                                        <div className="mt-2 pt-2 border-t border-[var(--border)] space-y-1">
                                          <p className="text-[10px] font-semibold text-[#22c55e]">Prepared Answer (STAR)</p>
                                          {item.prepared_answers[qi].situation && <p className="text-[10px] text-[var(--text-secondary)]"><span className="font-medium text-[var(--text-primary)]">S:</span> {item.prepared_answers[qi].situation}</p>}
                                          {item.prepared_answers[qi].task && <p className="text-[10px] text-[var(--text-secondary)]"><span className="font-medium text-[var(--text-primary)]">T:</span> {item.prepared_answers[qi].task}</p>}
                                          {item.prepared_answers[qi].action && <p className="text-[10px] text-[var(--text-secondary)]"><span className="font-medium text-[var(--text-primary)]">A:</span> {item.prepared_answers[qi].action}</p>}
                                          {item.prepared_answers[qi].result && <p className="text-[10px] text-[var(--text-secondary)]"><span className="font-medium text-[var(--text-primary)]">R:</span> {item.prepared_answers[qi].result}</p>}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* ── Close This Gap ──────────────── */}
                            {item.current_status !== "completed" && item.current_status !== "deprioritized" ? (
                              <div className="mt-4 pt-4 border-t border-[var(--border)]">
                                {closingId !== item.id ? (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => { setClosingId(item.id); setCloseType(null); setCloseNote(""); }}
                                      className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] transition-all"
                                    >
                                      <CheckCircle2 size={14} className="text-[#34d399]" />
                                      Close This Gap
                                    </button>
                                    {onNavigateToClosure && (
                                      <button
                                        onClick={() => onNavigateToClosure(item.id)}
                                        className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-[rgba(251,146,60,0.4)] text-[#fb923c] hover:bg-[rgba(251,146,60,0.06)] transition-all"
                                      >
                                        <Route size={14} />
                                        Build Closure Plan
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <p className="text-xs font-semibold text-[var(--text-primary)]">How was this resolved?</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                                      {RESOLUTION_TYPES.map(rt => {
                                        const RIcon = rt.icon;
                                        const isSelected = closeType === rt.key;
                                        return (
                                          <button
                                            key={rt.key}
                                            onClick={() => setCloseType(rt.key)}
                                            className="flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all"
                                            style={{
                                              borderColor: isSelected ? rt.color : "var(--border)",
                                              backgroundColor: isSelected ? `${rt.color}12` : "var(--bg-primary)",
                                              boxShadow: isSelected ? `0 0 0 1px ${rt.color}` : "none",
                                            }}
                                          >
                                            <RIcon size={18} style={{ color: rt.color }} />
                                            <span className="text-[11px] font-medium" style={{ color: isSelected ? rt.color : "var(--text-secondary)" }}>
                                              {rt.label}
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                    {closeType && (
                                      <>
                                        <p className="text-xs text-[var(--text-muted)]">
                                          {RESOLUTION_TYPES.find(r => r.key === closeType)?.description}
                                        </p>
                                        <textarea
                                          value={closeNote}
                                          onChange={e => setCloseNote(e.target.value)}
                                          placeholder={
                                            closeType === "have-it"
                                              ? "e.g., BS in Computer Science from UC Davis, 2004"
                                              : closeType === "reframed"
                                              ? "What did you update? Which initiative?"
                                              : closeType === "built-proof"
                                              ? "What did you build? Link to initiative if created."
                                              : closeType === "certified"
                                              ? "Which certification or course?"
                                              : "Why is this not relevant?"
                                          }
                                          rows={2}
                                          className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none"
                                        />
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => {
                                              onCloseGap(item.id, closeType, closeNote);
                                              setClosingId(null);
                                              setCloseType(null);
                                              setCloseNote("");
                                            }}
                                            disabled={!closeNote.trim()}
                                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg text-white transition-opacity disabled:opacity-40"
                                            style={{ backgroundColor: RESOLUTION_TYPES.find(r => r.key === closeType)?.color || "#34d399" }}
                                          >
                                            <CheckCircle2 size={14} />
                                            {closeType === "not-pursuing" ? "Deprioritize" : "Close Gap"}
                                          </button>
                                          <button
                                            onClick={() => { setClosingId(null); setCloseType(null); setCloseNote(""); }}
                                            className="px-3 py-2 text-xs rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : item.resolution_type && (
                              <div className="mt-4 pt-4 border-t border-[var(--border)]">
                                <div className="flex items-center gap-2 text-xs">
                                  <CheckCircle2 size={14} className="text-[#34d399]" />
                                  <span className="font-medium text-[#34d399]">
                                    Resolved: {RESOLUTION_TYPES.find(r => r.key === item.resolution_type)?.label || item.resolution_type}
                                  </span>
                                </div>
                                {item.resolution_note && (
                                  <p className="text-xs text-[var(--text-muted)] mt-1 ml-6">{item.resolution_note}</p>
                                )}
                              </div>
                            )}
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
