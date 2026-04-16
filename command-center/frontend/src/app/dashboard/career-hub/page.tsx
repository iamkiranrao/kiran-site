"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Compass,
  Briefcase,
  Crosshair,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Target,
  FileText,
  Radar,
  ArrowRight,
  ArrowDown,
  TrendingUp,
  TrendingDown,
  Layers,
  ChevronRight,
  Loader2,
  BarChart3,
  Clock,
  Zap,
  Shield,
} from "lucide-react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ── Types ──────────────────────────────────────────────── */

interface VaultStats {
  total: number;
  public_count: number;
  domains: { domain: string; count: number }[];
  eras: { era: string; count: number }[];
}

interface SkillsStats {
  total_sources: number;
  total_links: number;
  total_skills: number;
  total_domains: number;
}

interface GapItem {
  id: string;
  title: string;
  category: string;
  priority: string;
  current_status: string;
}

interface CompanyItem {
  name: string;
  tier: string;
  domain: string;
}

interface ReportItem {
  report_id: string;
  company?: string;
  role_title?: string;
  coverage_summary: {
    total_requirements: number;
    strong: number;
    partial: number;
    articulable: number;
    gaps: number;
    coverage_pct: number;
  };
  created_at: string;
  gaps_pushed: number;
}

interface AggregateSummary {
  total_jds_analyzed: number;
  strong_domains: string[];
  weak_domains: string[];
  structural_gaps: {
    requirement_pattern: string;
    frequency: number;
    frequency_pct: number;
    current_coverage: string;
  }[];
}

interface SprintData {
  targets: {
    applications: { target: number; current: number; pct: number };
    interviews: { target: number; current: number; pct: number };
  };
  by_status: Record<string, number>;
  active_count: number;
}

interface ApplicationItem {
  id: string;
  company: string;
  role: string;
  tier: string;
  status: string;
  applied_date: string;
}

/* ── Stage Config ──────────────────────────────────────── */

const STAGES = [
  {
    id: "foundation",
    number: 1,
    title: "What I Bring",
    subtitle: "Your arsenal — initiatives, evidence, skills",
    color: "#fb923c",
    gradient: "from-[#fb923c]/10 to-transparent",
  },
  {
    id: "intelligence",
    number: 2,
    title: "What They Want",
    subtitle: "Target companies, JD analysis, market patterns",
    color: "#60a5fa",
    gradient: "from-[#60a5fa]/10 to-transparent",
  },
  {
    id: "delta",
    number: 3,
    title: "The Delta",
    subtitle: "Gaps, fill strategies, gap-closing initiatives",
    color: "#f87171",
    gradient: "from-[#f87171]/10 to-transparent",
  },
  {
    id: "execution",
    number: 4,
    title: "Go Get It",
    subtitle: "Tailored resumes, applications, interview prep",
    color: "#34d399",
    gradient: "from-[#34d399]/10 to-transparent",
  },
];

/* ── Helper ────────────────────────────────────────────── */

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/* ── Component ─────────────────────────────────────────── */

export default function CareerHubPage() {
  // Stage 1: Foundation
  const [vaultStats, setVaultStats] = useState<VaultStats | null>(null);
  const [skillsStats, setSkillsStats] = useState<SkillsStats | null>(null);

  // Stage 2: Intelligence
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [aggregate, setAggregate] = useState<AggregateSummary | null>(null);

  // Stage 3: Delta
  const [gapItems, setGapItems] = useState<GapItem[]>([]);

  // Stage 4: Execution
  const [sprint, setSprint] = useState<SprintData | null>(null);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);

  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const safe = async (url: string) => {
      try {
        const r = await fetch(url);
        if (!r.ok) return null;
        return r.json();
      } catch {
        return null;
      }
    };

    const [
      initData,
      skillData,
      compData,
      reportData,
      aggData,
      gapData,
      sprintData,
      appData,
    ] = await Promise.all([
      safe(`${API}/api/career-initiatives/`),
      safe(`${API}/api/add-skills/stats`),
      safe(`${API}/api/target-companies/`),
      safe(`${API}/api/gap-discovery/reports`),
      safe(`${API}/api/gap-discovery/aggregate`),
      safe(`${API}/api/add-skills/gap-items`),
      safe(`${API}/api/job-central/sprint`),
      safe(`${API}/api/job-central/applications`),
    ]);

    // Process vault stats
    if (Array.isArray(initData)) {
      const domains: Record<string, number> = {};
      const eras: Record<string, number> = {};
      let pubCount = 0;
      initData.forEach((i: any) => {
        if (i.public) pubCount++;
        (i.domains || []).forEach((d: string) => { domains[d] = (domains[d] || 0) + 1; });
        if (i.era) eras[i.era] = (eras[i.era] || 0) + 1;
      });
      setVaultStats({
        total: initData.length,
        public_count: pubCount,
        domains: Object.entries(domains).map(([domain, count]) => ({ domain, count })).sort((a, b) => b.count - a.count),
        eras: Object.entries(eras).map(([era, count]) => ({ era, count })).sort((a, b) => b.count - a.count),
      });
    }

    if (skillData) setSkillsStats(skillData);
    if (Array.isArray(compData)) setCompanies(compData);
    if (Array.isArray(reportData)) setReports(reportData);
    if (aggData && aggData.total_jds_analyzed > 0) setAggregate(aggData);
    if (Array.isArray(gapData)) setGapItems(gapData);
    if (sprintData?.targets) setSprint(sprintData);
    if (Array.isArray(appData)) setApplications(appData);

    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Derived stats ────────────────────────────────────── */

  const tierCounts = companies.reduce<Record<string, number>>((acc, c) => {
    acc[c.tier] = (acc[c.tier] || 0) + 1;
    return acc;
  }, {});

  const avgCoverage = reports.length > 0
    ? Math.round(reports.reduce((s, r) => s + r.coverage_summary.coverage_pct, 0) / reports.length)
    : null;

  const activeGaps = gapItems.filter(g => g.current_status !== "completed");
  const criticalGaps = activeGaps.filter(g => g.priority === "critical" || g.priority === "high");

  const activeApps = applications.filter(a => !["rejected", "withdrawn", "closed"].includes(a.status));
  const interviewStage = applications.filter(a => ["phone-screen", "interview", "final-round", "offer"].includes(a.status));

  /* ── Render ───────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Compass size={24} className="text-[#fb923c]" />
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Career Hub</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Your full career pipeline — from evidence to application
          </p>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════ */}
      {/* STAGE 1 — WHAT I BRING                              */}
      {/* ════════════════════════════════════════════════════ */}
      <StageSection stage={STAGES[0]}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Career Vault card */}
          <Link href="/dashboard/career-vault" className="group block">
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[#fb923c80] transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Briefcase size={16} className="text-[#fb923c]" />
                  <span className="text-sm font-medium text-[var(--text-primary)]">Career Vault</span>
                </div>
                <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:text-[#fb923c] transition-colors" />
              </div>
              {vaultStats ? (
                <div className="space-y-3">
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-bold text-[var(--text-primary)]">{vaultStats.total}</span>
                    <span className="text-sm text-[var(--text-muted)]">initiatives</span>
                    <span className="text-xs text-[#34d399]">{vaultStats.public_count} public</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {vaultStats.domains.slice(0, 6).map(d => (
                      <span key={d.domain} className="px-2 py-0.5 rounded-full text-[10px] bg-[var(--bg-primary)] text-[var(--text-muted)] border border-[var(--border)]">
                        {d.domain} ({d.count})
                      </span>
                    ))}
                    {vaultStats.domains.length > 6 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] text-[var(--text-muted)]">
                        +{vaultStats.domains.length - 6} more
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {vaultStats.eras.map(e => (
                      <span key={e.era} className="text-[10px] text-[var(--text-muted)]">
                        {e.era}: {e.count}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">No initiatives yet</p>
              )}
            </div>
          </Link>

          {/* Skills Evidence card */}
          <Link href="/dashboard/career-vault" className="group block">
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[#fb923c80] transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-[#7CADE8]" />
                  <span className="text-sm font-medium text-[var(--text-primary)]">Skills Evidence</span>
                </div>
                <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:text-[#7CADE8] transition-colors" />
              </div>
              {skillsStats ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-2xl font-bold text-[var(--text-primary)]">{skillsStats.total_skills}</span>
                      <p className="text-[10px] text-[var(--text-muted)]">Skills mapped</p>
                    </div>
                    <div>
                      <span className="text-2xl font-bold text-[var(--text-primary)]">{skillsStats.total_sources}</span>
                      <p className="text-[10px] text-[var(--text-muted)]">Evidence sources</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <span>{skillsStats.total_domains} domains</span>
                    <span className="text-[var(--border)]">|</span>
                    <span>{skillsStats.total_links} skill-source links</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">No skills data</p>
              )}
            </div>
          </Link>
        </div>
      </StageSection>

      <StageConnector />

      {/* ════════════════════════════════════════════════════ */}
      {/* STAGE 2 — WHAT THEY WANT                            */}
      {/* ════════════════════════════════════════════════════ */}
      <StageSection stage={STAGES[1]}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Target Companies card */}
          <Link href="/dashboard/gap-discovery" className="group block">
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[#60a5fa80] transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Building2 size={16} className="text-[#60a5fa]" />
                  <span className="text-sm font-medium text-[var(--text-primary)]">Target Companies</span>
                </div>
                <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:text-[#60a5fa] transition-colors" />
              </div>
              <div className="space-y-2">
                <span className="text-3xl font-bold text-[var(--text-primary)]">{companies.length}</span>
                <div className="flex flex-wrap gap-2 text-xs">
                  {["dream", "target", "consulting", "stretch"].map(tier => {
                    const count = tierCounts[tier] || 0;
                    if (count === 0) return null;
                    const colors: Record<string, string> = { dream: "#a78bfa", target: "#60a5fa", consulting: "#34d399", stretch: "#fbbf24" };
                    return (
                      <span key={tier} className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[tier] }} />
                        <span className="text-[var(--text-muted)] capitalize">{tier}: {count}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </Link>

          {/* Mind the Gap / JD Analysis card */}
          <Link href="/dashboard/gap-discovery" className="group block">
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[#60a5fa80] transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Crosshair size={16} className="text-[#f87171]" />
                  <span className="text-sm font-medium text-[var(--text-primary)]">JD Analyses</span>
                </div>
                <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:text-[#f87171] transition-colors" />
              </div>
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-[var(--text-primary)]">{reports.length}</span>
                  <span className="text-sm text-[var(--text-muted)]">reports</span>
                </div>
                {avgCoverage !== null && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${avgCoverage}%`,
                          backgroundColor: avgCoverage >= 70 ? "#34d399" : avgCoverage >= 50 ? "#fbbf24" : "#f87171",
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium text-[var(--text-primary)]">{avgCoverage}% avg</span>
                  </div>
                )}
                {reports.length > 0 && (
                  <p className="text-[10px] text-[var(--text-muted)]">
                    Latest: {reports[0].company} — {reports[0].coverage_summary.coverage_pct}% ({formatDate(reports[0].created_at)})
                  </p>
                )}
              </div>
            </div>
          </Link>

          {/* Aggregate Intelligence card */}
          <Link href="/dashboard/gap-discovery" className="group block">
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[#60a5fa80] transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 size={16} className="text-[#818cf8]" />
                  <span className="text-sm font-medium text-[var(--text-primary)]">Market Patterns</span>
                </div>
                <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:text-[#818cf8] transition-colors" />
              </div>
              {aggregate ? (
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-[var(--text-primary)]">{aggregate.total_jds_analyzed}</span>
                    <span className="text-sm text-[var(--text-muted)]">JDs analyzed</span>
                  </div>
                  {aggregate.strong_domains.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <TrendingUp size={12} className="text-[#34d399]" />
                      <span className="text-xs text-[var(--text-muted)]">
                        Strong: {aggregate.strong_domains.slice(0, 3).join(", ")}
                      </span>
                    </div>
                  )}
                  {aggregate.weak_domains.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <TrendingDown size={12} className="text-[#f87171]" />
                      <span className="text-xs text-[var(--text-muted)]">
                        Weak: {aggregate.weak_domains.slice(0, 3).join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm text-[var(--text-muted)]">Need 2+ analyses</p>
                  <p className="text-[10px] text-[var(--text-muted)]">Run more JD analyses to see cross-cutting patterns</p>
                </div>
              )}
            </div>
          </Link>
        </div>
      </StageSection>

      <StageConnector />

      {/* ════════════════════════════════════════════════════ */}
      {/* STAGE 3 — THE DELTA                                 */}
      {/* ════════════════════════════════════════════════════ */}
      <StageSection stage={STAGES[2]}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Mind the Gap summary */}
          <Link href="/dashboard/career-vault" className="group block">
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[#f8717180] transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-[#f87171]" />
                  <span className="text-sm font-medium text-[var(--text-primary)]">Mind the Gap</span>
                </div>
                <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:text-[#f87171] transition-colors" />
              </div>
              <div className="space-y-3">
                <div className="flex items-baseline gap-4">
                  <div>
                    <span className="text-3xl font-bold text-[var(--text-primary)]">{activeGaps.length}</span>
                    <p className="text-[10px] text-[var(--text-muted)]">Active gaps</p>
                  </div>
                  {criticalGaps.length > 0 && (
                    <div>
                      <span className="text-2xl font-bold text-[#f87171]">{criticalGaps.length}</span>
                      <p className="text-[10px] text-[#f87171]">High priority</p>
                    </div>
                  )}
                  <div>
                    <span className="text-2xl font-bold text-[#34d399]">
                      {gapItems.filter(g => g.current_status === "completed").length}
                    </span>
                    <p className="text-[10px] text-[#34d399]">Closed</p>
                  </div>
                </div>
                {/* Top gaps by priority */}
                {activeGaps.slice(0, 3).map(g => {
                  const priColors: Record<string, string> = { critical: "#f87171", high: "#fb923c", medium: "#fbbf24", low: "#94a3b8" };
                  return (
                    <div key={g.id} className="flex items-center gap-2 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: priColors[g.priority] || "#94a3b8" }} />
                      <span className="text-[var(--text-secondary)] truncate flex-1">{g.title}</span>
                      <span className="text-[var(--text-muted)] capitalize shrink-0">{g.priority}</span>
                    </div>
                  );
                })}
                {activeGaps.length > 3 && (
                  <p className="text-[10px] text-[var(--text-muted)]">+{activeGaps.length - 3} more gaps</p>
                )}
              </div>
            </div>
          </Link>

          {/* Gap-to-Initiative pipeline card */}
          <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={16} className="text-[#fb923c]" />
              <span className="text-sm font-medium text-[var(--text-primary)]">Fill Strategy Pipeline</span>
            </div>
            <div className="space-y-3">
              {/* Tier breakdown from recent reports */}
              {reports.length > 0 ? (() => {
                const latestReport = reports[0];
                const tierSummary: Record<string, number> = {};
                // We don't have full requirement data in list view, show summary
                return (
                  <div className="space-y-2">
                    <p className="text-xs text-[var(--text-muted)]">Based on latest analysis ({latestReport.company}):</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Strong", count: latestReport.coverage_summary.strong, color: "#34d399" },
                        { label: "Partial", count: latestReport.coverage_summary.partial, color: "#fbbf24" },
                        { label: "Articulable", count: latestReport.coverage_summary.articulable, color: "#60a5fa" },
                        { label: "Gaps", count: latestReport.coverage_summary.gaps, color: "#f87171" },
                      ].map(t => (
                        <div key={t.label} className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                          <span className="text-xs text-[var(--text-muted)]">{t.label}: <strong className="text-[var(--text-primary)]">{t.count}</strong></span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 p-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)]">
                      <p className="text-[10px] text-[var(--text-muted)]">Workflow</p>
                      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-[var(--text-secondary)]">
                        <span className="px-1.5 py-0.5 rounded bg-[rgba(248,113,113,0.12)] text-[#f87171]">Gap found</span>
                        <ArrowRight size={10} className="text-[var(--text-muted)]" />
                        <span className="px-1.5 py-0.5 rounded bg-[rgba(251,147,60,0.12)] text-[#fb923c]">Fill strategy</span>
                        <ArrowRight size={10} className="text-[var(--text-muted)]" />
                        <span className="px-1.5 py-0.5 rounded bg-[rgba(52,211,153,0.12)] text-[#34d399]">Initiative</span>
                      </div>
                    </div>
                  </div>
                );
              })() : (
                <p className="text-sm text-[var(--text-muted)]">Run a JD analysis in Mind the Gap to see fill strategies</p>
              )}
            </div>
          </div>
        </div>
      </StageSection>

      <StageConnector />

      {/* ════════════════════════════════════════════════════ */}
      {/* STAGE 4 — GO GET IT                                 */}
      {/* ════════════════════════════════════════════════════ */}
      <StageSection stage={STAGES[3]}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Resume Customizer card */}
          <Link href="/dashboard/interview-prep" className="group block">
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[#34d39980] transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-[#3b82f6]" />
                  <span className="text-sm font-medium text-[var(--text-primary)]">Resume Customizer</span>
                </div>
                <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:text-[#3b82f6] transition-colors" />
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Tailor resumes and application packages for specific roles
              </p>
            </div>
          </Link>

          {/* Job Central card */}
          <Link href="/dashboard/job-central" className="group block md:col-span-2">
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[#34d39980] transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Radar size={16} className="text-[#ef4444]" />
                  <span className="text-sm font-medium text-[var(--text-primary)]">Job Central</span>
                </div>
                <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:text-[#ef4444] transition-colors" />
              </div>
              {sprint ? (
                <div className="space-y-2">
                  <div className="flex items-baseline gap-6">
                    <div>
                      <span className="text-2xl font-bold text-[var(--text-primary)]">{activeApps.length}</span>
                      <p className="text-[10px] text-[var(--text-muted)]">Active applications</p>
                    </div>
                    <div>
                      <span className="text-2xl font-bold text-[#a78bfa]">{interviewStage.length}</span>
                      <p className="text-[10px] text-[#a78bfa]">In interviews</p>
                    </div>
                    <div>
                      <span className="text-2xl font-bold text-[var(--text-primary)]">{sprint.targets.applications.pct}%</span>
                      <p className="text-[10px] text-[var(--text-muted)]">Sprint target</p>
                    </div>
                  </div>
                  {/* Recent applications */}
                  {activeApps.slice(0, 3).map(a => (
                    <div key={a.id} className="flex items-center gap-2 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
                      <span className="text-[var(--text-secondary)] truncate flex-1">{a.company} — {a.role}</span>
                      <span className="text-[var(--text-muted)] capitalize">{a.status.replace("-", " ")}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--text-muted)]">
                  Track applications, prep for interviews, manage your pipeline
                </p>
              )}
            </div>
          </Link>
        </div>
      </StageSection>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────── */

function StageSection({ stage, children }: { stage: typeof STAGES[number]; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
          style={{ backgroundColor: stage.color }}
        >
          {stage.number}
        </div>
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">{stage.title}</h2>
          <p className="text-xs text-[var(--text-muted)]">{stage.subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function StageConnector() {
  return (
    <div className="flex justify-center">
      <div className="flex flex-col items-center gap-0.5 text-[var(--border)]">
        <div className="w-px h-4 bg-[var(--border)]" />
        <ArrowDown size={16} />
        <div className="w-px h-4 bg-[var(--border)]" />
      </div>
    </div>
  );
}
