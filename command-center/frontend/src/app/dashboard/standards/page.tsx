"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ShieldCheck,
  Loader2,
  Play,
  ChevronDown,
  ChevronRight,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Map,
  Eye,
  EyeOff,
  Camera,
} from "lucide-react";
import Link from "next/link";
import ModuleHelp from "@/components/ModuleHelp";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ────────────────────────────────────────────────────────

interface ScorecardEntry {
  pillar: string;
  pillar_label: string;
  score: number;
  rating: string;
  critical_count: number;
  warning_count: number;
  info_count: number;
  new_violations: number;
  baselined_violations: number;
  compliance_tier: string | null;
  last_run: string | null;
}

interface Scorecard {
  overall_score: number;
  overall_rating: string;
  pillars: ScorecardEntry[];
  generated_at: string;
  files_scanned: number;
  total_checks_run: number;
  total_violations: number;
}

interface Violation {
  check_id: string;
  severity: "critical" | "warning" | "info";
  location: string;
  detail: string;
  evidence: string;
  suggestion: string;
  auto_fixable: boolean;
}

interface FileReport {
  file_path: string;
  relative_path: string;
  word_count: number;
  violations: Violation[];
  critical_count: number;
  warning_count: number;
  info_count: number;
}

interface PillarScore {
  pillar: string;
  score: number;
  rating: string;
  anti_ai_score?: number;
  pro_kiran_score?: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  files_scanned: number;
  checks_run: number;
  checks_passed: number;
}

interface CheckDef {
  id: string;
  pillar: string;
  name: string;
  description: string;
  severity_default: string;
  method: string;
  enabled: boolean;
}

interface PillarDetail {
  pillar: string;
  pillar_label: string;
  score: PillarScore;
  checks: CheckDef[];
  file_reports: FileReport[];
  new_violations: number;
  baselined_violations: number;
  compliance_tier: string | null;
  generated_at: string;
}

// ── Helpers ──────────────────────────────────────────────────────

const severityColor: Record<string, string> = {
  critical: "text-red-400",
  warning: "text-amber-400",
  info: "text-[var(--text-muted)]",
};

const severityBg: Record<string, string> = {
  critical: "bg-red-500/10 border-red-500/20",
  warning: "bg-amber-500/10 border-amber-500/20",
  info: "bg-[var(--bg-secondary)] border-[var(--border)]",
};

const tierColor: Record<string, string> = {
  "best-in-class": "text-green-400 bg-green-500/10 border-green-500/20",
  quality: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  ship: "text-amber-400 bg-amber-500/10 border-amber-500/20",
};

const ratingColor: Record<string, string> = {
  Authentic: "text-green-400",
  Review: "text-blue-400",
  Remediate: "text-amber-400",
  Rewrite: "text-red-400",
};

function formatTime(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ── Score Ring ───────────────────────────────────────────────────

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 90 ? "#34d399" : score >= 75 ? "#60a5fa" : score >= 60 ? "#fbbf24" : "#f87171";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth="6"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-[var(--text-primary)]">{score}</span>
        <span className="text-xs text-[var(--text-muted)]">/ 100</span>
      </div>
    </div>
  );
}

// ── Pillar Card ─────────────────────────────────────────────────

function PillarCard({
  entry,
  onClick,
  isActive,
}: {
  entry: ScorecardEntry;
  onClick: () => void;
  isActive: boolean;
}) {
  const color =
    entry.score >= 90
      ? "#34d399"
      : entry.score >= 75
        ? "#60a5fa"
        : entry.score >= 60
          ? "#fbbf24"
          : "#f87171";

  return (
    <button
      onClick={onClick}
      className={`text-left border rounded-lg p-4 transition-all hover:bg-[var(--bg-secondary)] ${
        isActive
          ? "border-[var(--text-muted)] bg-[var(--bg-secondary)]"
          : "border-[var(--border)]"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-[var(--text-primary)]">
          {entry.pillar_label}
        </span>
        {entry.compliance_tier && (
          <span
            className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${
              tierColor[entry.compliance_tier] || "text-[var(--text-muted)]"
            }`}
          >
            {entry.compliance_tier}
          </span>
        )}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <span className="text-2xl font-bold" style={{ color }}>
            {entry.score}
          </span>
          <span className="text-sm text-[var(--text-muted)] ml-1">/ 100</span>
        </div>
        <span className={`text-xs font-medium ${ratingColor[entry.rating] || ""}`}>
          {entry.rating}
        </span>
      </div>

      <div className="flex items-center gap-3 mt-3 text-[10px]">
        {entry.new_violations > 0 ? (
          <span className="text-red-400 flex items-center gap-1 font-semibold">
            <Eye size={10} />
            {entry.new_violations} new
          </span>
        ) : (
          <span className="text-green-400 flex items-center gap-1">
            <CheckCircle2 size={10} />
            0 new
          </span>
        )}
        {entry.baselined_violations > 0 && (
          <span className="text-[var(--text-muted)] flex items-center gap-1">
            <EyeOff size={10} />
            {entry.baselined_violations} baselined
          </span>
        )}
        {entry.critical_count === 0 &&
          entry.warning_count === 0 &&
          entry.info_count === 0 && (
            <span className="text-green-400 flex items-center gap-1">
              <CheckCircle2 size={10} />
              Clean
            </span>
          )}
      </div>
    </button>
  );
}

// ── Effort estimates per check category ──────────────────────────

const EFFORT_MAP: Record<string, { label: string; mins: number; type: string }> = {
  // Backend
  "be-response-model": { label: "Add response_model", mins: 3, type: "mechanical" },
  "be-service-fastapi-import": { label: "Move FastAPI import", mins: 10, type: "refactor" },
  "be-atomic-write": { label: "Atomic write pattern", mins: 5, type: "mechanical" },
  "be-endpoint-docstring": { label: "Add docstring", mins: 2, type: "mechanical" },
  "be-inline-model": { label: "Extract Pydantic model", mins: 8, type: "refactor" },
  // Architecture
  "arch-import-direction": { label: "Fix import direction", mins: 15, type: "refactor" },
  "arch-hardcoded-model": { label: "Use config constant", mins: 3, type: "mechanical" },
  "arch-hardcoded-key": { label: "Remove hardcoded key", mins: 5, type: "critical" },
  // Authenticity
  "auth-ai-lexical-tell": { label: "Rewrite AI language", mins: 15, type: "editorial" },
  "auth-ai-sentence-variance": { label: "Vary sentence length", mins: 20, type: "editorial" },
  "auth-ai-hedge-density": { label: "Cut hedge words", mins: 10, type: "editorial" },
  "auth-ai-passive-voice": { label: "Convert to active", mins: 8, type: "editorial" },
  "auth-ai-contraction": { label: "Add contractions", mins: 5, type: "mechanical" },
  "auth-ai-em-dash": { label: "Replace em dashes", mins: 2, type: "mechanical" },
  "auth-ai-bullet-placement": { label: "Restructure lists", mins: 10, type: "editorial" },
  "auth-kiran-first-person": { label: "Add first-person voice", mins: 15, type: "editorial" },
  "auth-kiran-opening-hook": { label: "Rewrite opening", mins: 20, type: "editorial" },
  "auth-kiran-directness": { label: "Cut qualifiers", mins: 8, type: "editorial" },
  "auth-kiran-honesty-markers": { label: "Add honesty markers", mins: 15, type: "editorial" },
  "auth-kiran-vocabulary": { label: "Replace inflating words", mins: 5, type: "editorial" },
  // Content
  "content-readability": { label: "Simplify language", mins: 20, type: "editorial" },
  "content-banned-jargon": { label: "Replace jargon", mins: 8, type: "editorial" },
  "content-us-english": { label: "Fix British spelling", mins: 2, type: "mechanical" },
  "content-filler-qualifiers": { label: "Cut filler words", mins: 5, type: "editorial" },
  "content-em-dash": { label: "Replace em dashes", mins: 2, type: "mechanical" },
  "content-meta-description": { label: "Write meta description", mins: 5, type: "seo" },
  "content-canonical-url": { label: "Fix canonical URL", mins: 2, type: "mechanical" },
  // Visual
  "vis-svg-root-override": { label: "Remove :root override", mins: 10, type: "refactor" },
  "vis-svg-class-prefix": { label: "Add wf- prefix", mins: 2, type: "mechanical" },
  "vis-svg-text-overlap": { label: "Fix text spacing", mins: 5, type: "mechanical" },
  "vis-wireframe-sizing": { label: "Fix max-width", mins: 2, type: "mechanical" },
  "vis-journey-bezier": { label: "Convert to cubic bezier", mins: 10, type: "refactor" },
  "vis-label-overlap": { label: "Reposition label", mins: 3, type: "mechanical" },
  "vis-annotation-sizing": { label: "Fix padding", mins: 3, type: "mechanical" },
  "vis-a11y": { label: "Fix accessibility", mins: 5, type: "mechanical" },
};

const effortTypeColor: Record<string, string> = {
  mechanical: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  editorial: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  refactor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  seo: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
};

function formatMins(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── Pillar Detail View ──────────────────────────────────────────

function PillarDetailView({ pillar }: { pillar: string }) {
  const [detail, setDetail] = useState<PillarDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [remediating, setRemediating] = useState(false);
  const [remediationStatus, setRemediationStatus] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"effort" | "files">("effort");

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/standards/${pillar}/details`);
      if (res.ok) {
        const data: PillarDetail = await res.json();
        setDetail(data);
        setError(null);
        const critFiles = new Set(
          data.file_reports
            .filter((r) => r.critical_count > 0)
            .map((r) => r.relative_path)
        );
        setExpandedFiles(critFiles);
      } else {
        setError("Failed to load pillar details");
      }
    } catch (err) {
      console.error("Failed to fetch pillar detail:", err);
      setError("Error loading pillar details. Try again.");
    }
    setLoading(false);
  }, [pillar]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const runRemediation = async (dryRun: boolean) => {
    setRemediating(true);
    setRemediationStatus(null);
    try {
      const res = await fetch(`${API_URL}/api/standards/${pillar}/remediate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dry_run: dryRun }),
      });
      if (res.ok) {
        const result = await res.json();
        if (!dryRun && result.fixes_applied > 0) {
          // Refresh data after applying fixes
          fetchDetail();
        }
        setRemediationStatus(
          dryRun
            ? `Dry run: ${result.fixes_available} auto-fixable violations found`
            : `Applied ${result.fixes_applied} of ${result.fixes_available} fixes`
        );
        // Clear status after 5 seconds
        setTimeout(() => setRemediationStatus(null), 5000);
      }
    } catch (e) {
      console.error("Remediation failed:", e);
      setRemediationStatus("Remediation failed. Try again.");
    }
    setRemediating(false);
  };

  const toggleExpanded = (path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  // Build effort summary grouped by check (memoized) — must be before early returns
  const effortByCheck = useMemo(() => {
    if (!detail) {
      return {};
    }
    const result: Record<string, { count: number; totalMins: number; severity: string; type: string; label: string }> = {};
    for (const report of detail.file_reports) {
      for (const v of report.violations) {
        const effort = EFFORT_MAP[v.check_id];
        if (!result[v.check_id]) {
          result[v.check_id] = {
            count: 0,
            totalMins: 0,
            severity: v.severity,
            type: effort?.type || "mechanical",
            label: effort?.label || v.check_id,
          };
        }
        result[v.check_id].count += 1;
        result[v.check_id].totalMins += effort?.mins || 5;
      }
    }
    return result;
  }, [detail]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
        <span className="ml-3 text-sm text-[var(--text-secondary)]">
          Running {pillar} audit...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-500/20 bg-red-500/5 rounded-lg p-4">
        <p className="text-sm text-red-400 mb-3">{error}</p>
        <button
          onClick={fetchDetail}
          className="px-3 py-1.5 text-xs rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!detail) return null;
  const effortEntries = Object.entries(effortByCheck).sort(
    (a, b) => b[1].totalMins - a[1].totalMins
  );
  const totalEffortMins = effortEntries.reduce((sum, [, e]) => sum + e.totalMins, 0);
  const autoFixableCount = detail.file_reports.reduce(
    (sum, r) => sum + r.violations.filter((v) => v.auto_fixable).length, 0
  );

  const filteredReports = detail.file_reports.filter((r) => {
    if (filterSeverity === "all") return r.critical_count + r.warning_count + r.info_count > 0;
    if (filterSeverity === "critical") return r.critical_count > 0;
    if (filterSeverity === "warning") return r.warning_count > 0;
    return true;
  });

  const sortedReports = [...filteredReports].sort(
    (a, b) =>
      b.critical_count * 100 + b.warning_count * 10 + b.info_count -
      (a.critical_count * 100 + a.warning_count * 10 + a.info_count)
  );

  return (
    <div className="space-y-5">
      {/* Pillar header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {detail.pillar_label}
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {detail.score.checks_run} checks &middot; {detail.score.files_scanned} files
            &middot; Generated {formatTime(detail.generated_at)}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {pillar === "authenticity" &&
            detail.score.anti_ai_score !== undefined &&
            detail.score.pro_kiran_score !== undefined && (
              <div className="flex gap-3 text-xs">
                <div className="border border-[var(--border)] rounded px-3 py-1.5">
                  <span className="text-[var(--text-muted)]">Anti-AI: </span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {detail.score.anti_ai_score}
                  </span>
                </div>
                <div className="border border-[var(--border)] rounded px-3 py-1.5">
                  <span className="text-[var(--text-muted)]">Pro-Kiran: </span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {detail.score.pro_kiran_score}
                  </span>
                </div>
              </div>
            )}
          <ScoreRing score={detail.score.score} size={72} />
        </div>
      </div>

      {/* Remediation status message */}
      {remediationStatus && (
        <div className="border border-green-500/20 bg-green-500/5 rounded-lg p-3">
          <p className="text-sm text-green-400">{remediationStatus}</p>
        </div>
      )}

      {/* Tech Cost Calculator — Effort Summary */}
      <div className="border border-[var(--border)] rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
            <Clock size={12} />
            Tech Cost Calculator
          </h3>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-[var(--text-primary)] font-semibold">
              Total: {formatMins(totalEffortMins)}
            </span>
            {autoFixableCount > 0 && (
              <button
                onClick={() => runRemediation(true)}
                disabled={remediating}
                className="px-2 py-1 rounded border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-all disabled:opacity-40 flex items-center gap-1"
              >
                {remediating ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
                {autoFixableCount} auto-fixable
              </button>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          {effortEntries.map(([checkId, effort]) => {
            const barWidth = totalEffortMins > 0 ? (effort.totalMins / totalEffortMins) * 100 : 0;
            return (
              <div key={checkId} className="flex items-center gap-3 text-xs">
                <span className={`w-3 h-3 rounded-sm border ${effortTypeColor[effort.type] || ""}`} />
                <span className="text-[var(--text-primary)] w-48 truncate">{effort.label}</span>
                <span className={`${severityColor[effort.severity]} w-12`}>
                  {effort.count}×
                </span>
                <div className="flex-1 h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden border border-[var(--border)]">
                  <div
                    className={`h-full rounded-full transition-all ${
                      effort.severity === "critical" ? "bg-red-500/60" :
                      effort.severity === "warning" ? "bg-amber-500/40" : "bg-[var(--text-muted)]/30"
                    }`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span className="text-[var(--text-muted)] w-12 text-right font-mono">
                  {formatMins(effort.totalMins)}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${effortTypeColor[effort.type] || ""}`}>
                  {effort.type}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* View mode toggle + severity filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">View:</span>
          <button
            onClick={() => setViewMode("effort")}
            className={`text-xs px-3 py-1 rounded border transition-all ${
              viewMode === "effort"
                ? "border-[var(--text-muted)] text-[var(--text-primary)] bg-[var(--bg-secondary)]"
                : "border-[var(--border)] text-[var(--text-muted)]"
            }`}
          >
            By Check
          </button>
          <button
            onClick={() => setViewMode("files")}
            className={`text-xs px-3 py-1 rounded border transition-all ${
              viewMode === "files"
                ? "border-[var(--text-muted)] text-[var(--text-primary)] bg-[var(--bg-secondary)]"
                : "border-[var(--border)] text-[var(--text-muted)]"
            }`}
          >
            By File
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">Filter:</span>
          {["all", "critical", "warning"].map((sev) => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={`text-xs px-3 py-1 rounded border transition-all ${
                filterSeverity === sev
                  ? "border-[var(--text-muted)] text-[var(--text-primary)] bg-[var(--bg-secondary)]"
                  : "border-[var(--border)] text-[var(--text-muted)]"
              }`}
            >
              {sev === "all" ? "All" : sev.charAt(0).toUpperCase() + sev.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Checks view — grouped by check type */}
      {viewMode === "effort" && (
        <div className="space-y-3">
          {detail.checks
            .filter((check) => effortByCheck[check.id])
            .sort((a, b) => (effortByCheck[b.id]?.totalMins || 0) - (effortByCheck[a.id]?.totalMins || 0))
            .map((check) => {
              const info = effortByCheck[check.id];
              if (!info) return null;
              const effort = EFFORT_MAP[check.id];
              const isExpanded = expandedFiles.has(check.id);
              const violations = detail.file_reports.flatMap((r) =>
                r.violations
                  .filter((v) => v.check_id === check.id)
                  .filter((v) => filterSeverity === "all" || v.severity === filterSeverity)
                  .map((v) => ({ ...v, file: r.relative_path }))
              );

              if (violations.length === 0) return null;

              return (
                <div key={check.id} className="border border-[var(--border)] rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleExpanded(check.id)}
                    className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors text-left"
                    aria-expanded={isExpanded}
                    aria-label={`Toggle ${check.name} violations`}
                    title={check.description}
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle size={14} className={severityColor[info.severity]} />
                      <span className="text-sm font-medium text-[var(--text-primary)]">{check.name}</span>
                      <span className="text-xs text-[var(--text-muted)]">{check.description}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className={severityColor[info.severity]}>{info.count} issues</span>
                      <span className="text-[var(--text-muted)] font-mono">{formatMins(info.totalMins)}</span>
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-[var(--border)] px-4 py-3 space-y-2 bg-[var(--bg-secondary)]">
                      {violations.map((v: Violation & { file: string }, i: number) => (
                        <div key={i} className={`border rounded-lg p-3 ${severityBg[v.severity]}`}>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[10px] font-semibold uppercase tracking-wider ${severityColor[v.severity]}`}>
                                {v.severity}
                              </span>
                              <span className="text-[10px] font-mono text-[var(--text-muted)]" title={v.file}>{v.file}</span>
                              {v.auto_fixable && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400">
                                  auto-fixable
                                </span>
                              )}
                              {effort && (
                                <span className="text-[10px] text-[var(--text-muted)]">~{effort.mins}m</span>
                              )}
                            </div>
                            <p className="text-sm text-[var(--text-primary)] leading-relaxed">{v.detail}</p>
                            {v.evidence && (
                              <p className="text-xs text-[var(--text-muted)] font-mono truncate" title={v.evidence}>{v.evidence}</p>
                            )}
                            <p className="text-sm text-green-400 leading-relaxed">&rarr; {v.suggestion}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          {detail.checks.filter((check) => effortByCheck[check.id]).filter(check => {
            const violations = detail.file_reports.flatMap((r) =>
              r.violations
                .filter((v) => v.check_id === check.id)
                .filter((v) => filterSeverity === "all" || v.severity === filterSeverity)
            );
            return violations.length === 0;
          }).length === detail.checks.filter((check) => effortByCheck[check.id]).length && detail.checks.filter((check) => effortByCheck[check.id]).length > 0 && (
            <div className="text-center py-8 border border-green-500/20 bg-green-500/5 rounded-lg">
              <CheckCircle2 size={28} className="text-green-400 mx-auto mb-2" />
              <p className="text-sm text-[var(--text-secondary)]">All checks passed for this filter!</p>
            </div>
          )}
        </div>
      )}

      {/* File-based view */}
      {viewMode === "files" && (
        <div className="space-y-2">
          {sortedReports.map((report) => {
            const isExpanded = expandedFiles.has(report.relative_path);
            const violations =
              filterSeverity === "all"
                ? report.violations
                : report.violations.filter((v) => v.severity === filterSeverity);
            const hasViolations = report.critical_count + report.warning_count + report.info_count > 0;

            return (
              <div key={report.relative_path} className="border border-[var(--border)] rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleExpanded(report.relative_path)}
                  className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors text-left"
                  aria-expanded={isExpanded}
                  aria-label={`Toggle violations for ${report.relative_path}`}
                  title={report.relative_path}
                >
                  <div className="flex items-center gap-3">
                    <FileText size={14} className="text-[var(--text-muted)]" />
                    <span className="text-sm font-mono text-[var(--text-primary)]">{report.relative_path}</span>
                    {report.word_count > 0 && (
                      <span className="text-xs text-[var(--text-muted)]">{report.word_count.toLocaleString()} words</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    {report.critical_count > 0 && <span className="text-red-400">{report.critical_count}C</span>}
                    {report.warning_count > 0 && <span className="text-amber-400">{report.warning_count}W</span>}
                    {report.info_count > 0 && <span className="text-[var(--text-muted)]">{report.info_count}I</span>}
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>
                </button>
                {isExpanded && hasViolations && (
                  <div className="border-t border-[var(--border)] px-4 py-3 space-y-2 bg-[var(--bg-secondary)]">
                    {violations.map((v, i) => (
                      <div key={i} className={`border rounded-lg p-3 ${severityBg[v.severity]}`}>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-semibold uppercase tracking-wider ${severityColor[v.severity]}`}>{v.severity}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-muted)] font-mono">{v.check_id}</span>
                            {v.auto_fixable && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400">auto-fixable</span>
                            )}
                          </div>
                          <p className="text-sm text-[var(--text-primary)] leading-relaxed">{v.detail}</p>
                          {v.evidence && <p className="text-xs text-[var(--text-muted)] font-mono truncate" title={v.evidence}>{v.evidence}</p>}
                          <p className="text-sm text-green-400 leading-relaxed">&rarr; {v.suggestion}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {sortedReports.length === 0 && (
            <div className="text-center py-8 border border-green-500/20 bg-green-500/5 rounded-lg">
              <CheckCircle2 size={28} className="text-green-400 mx-auto mb-2" />
              <p className="text-sm text-[var(--text-secondary)]">No issues found for this filter.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────

export default function StandardsPage() {
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [loading, setLoading] = useState(false);
  const [activePillar, setActivePillar] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [snapshotting, setSnapshotting] = useState(false);
  const [snapshotStatus, setSnapshotStatus] = useState<string | null>(null);

  const totalNewViolations = scorecard?.pillars.reduce((s, p) => s + (p.new_violations || 0), 0) ?? 0;
  const totalBaselinedViolations = scorecard?.pillars.reduce((s, p) => s + (p.baselined_violations || 0), 0) ?? 0;

  const fetchScorecard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/standards/scorecard`);
      if (res.ok) {
        const data: Scorecard = await res.json();
        setScorecard(data);
      } else {
        setError("Failed to fetch scorecard");
      }
    } catch {
      setError("Backend not reachable. Is the server running?");
    }
    setLoading(false);
  }, []);

  const snapshotBaseline = useCallback(async () => {
    setSnapshotting(true);
    setSnapshotStatus(null);
    try {
      const res = await fetch(`${API_URL}/api/standards/baseline/snapshot`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const count = Object.keys(data.entries || {}).length;
        setSnapshotStatus(`Baselined ${count} violations. Re-running audit...`);
        await fetchScorecard();
        setSnapshotStatus(`Done — ${count} violations baselined. Dashboard shows only new issues.`);
        setTimeout(() => setSnapshotStatus(null), 8000);
      } else {
        setSnapshotStatus("Failed to snapshot baseline.");
      }
    } catch {
      setSnapshotStatus("Error creating baseline. Is the backend running?");
    }
    setSnapshotting(false);
  }, [fetchScorecard]);

  // Auto-load scorecard on mount
  useEffect(() => {
    fetchScorecard();
  }, [fetchScorecard]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight flex items-center gap-3">
            <ShieldCheck size={24} />
            Standards & Compliance
            <ModuleHelp moduleSlug="standards" />
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Audit every page against backend, architecture, authenticity, content, and visual
            standards.
          </p>
        </div>
        <div className="flex items-center gap-3">
        <Link
          href="/dashboard/standards/portfolio"
          className="px-4 py-2 text-sm font-medium rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all flex items-center gap-2"
        >
          <Map size={14} />
          Portfolio Health Map
        </Link>
        {scorecard && scorecard.total_violations > 0 && (
          <button
            onClick={snapshotBaseline}
            disabled={snapshotting}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all disabled:opacity-40 flex items-center gap-2"
          >
            {snapshotting ? (
              <><Loader2 size={14} className="animate-spin" />Baselining...</>
            ) : (
              <><Camera size={14} />Snapshot Baseline</>
            )}
          </button>
        )}
        <button
          onClick={fetchScorecard}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90 transition-all disabled:opacity-40 flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Running Audit...
            </>
          ) : (
            <>
              <Play size={14} />
              {scorecard ? "Re-run Audit" : "Run Audit"}
            </>
          )}
        </button>
        </div>
      </div>

      {/* Snapshot status */}
      {snapshotStatus && (
        <div className="border border-green-500/20 bg-green-500/5 rounded-lg px-4 py-3 text-sm text-green-400">
          {snapshotStatus}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="border border-red-500/20 bg-red-500/5 rounded-lg px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!scorecard && !loading && !error && (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <ShieldCheck size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-sm mb-1">No audit data yet.</p>
          <p className="text-xs">
            Click <strong>Run Audit</strong> to scan all pages across 5 compliance pillars.
          </p>
        </div>
      )}

      {/* Scorecard */}
      {scorecard && (
        <>
          {/* Overall score + stats */}
          <div className="flex items-start gap-8">
            <ScoreRing score={scorecard.overall_score} size={140} />

            <div className="flex-1 space-y-4">
              <div>
                <span className={`text-sm font-medium ${ratingColor[scorecard.overall_rating]}`}>
                  {scorecard.overall_rating}
                </span>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Average across {scorecard.pillars.length} pillars
                </p>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="border border-[var(--border)] rounded-lg p-3">
                  <div className="text-xl font-semibold text-[var(--text-primary)]">
                    {scorecard.files_scanned}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                    Files Scanned
                  </div>
                </div>
                <div className="border border-[var(--border)] rounded-lg p-3">
                  <div className="text-xl font-semibold text-[var(--text-primary)]">
                    {scorecard.total_checks_run}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-0.5">Checks Run</div>
                </div>
                <div className={`border rounded-lg p-3 ${
                  totalNewViolations > 0
                    ? "border-red-500/30 bg-red-500/5"
                    : "border-green-500/30 bg-green-500/5"
                }`}>
                  <div
                    className={`text-xl font-semibold ${
                      totalNewViolations > 0 ? "text-red-400" : "text-green-400"
                    }`}
                  >
                    {totalNewViolations}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                    New Violations
                  </div>
                </div>
                <div className="border border-[var(--border)] rounded-lg p-3">
                  <div className="text-xl font-semibold text-[var(--text-muted)]">
                    {totalBaselinedViolations}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                    Baselined
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-[var(--text-muted)]">
                Last run: {formatTime(scorecard.generated_at)}
              </p>
            </div>
          </div>

          {/* Pillar cards */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              Pillar Scores
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {scorecard.pillars.map((entry) => (
                <PillarCard
                  key={entry.pillar}
                  entry={entry}
                  onClick={() =>
                    setActivePillar(activePillar === entry.pillar ? null : entry.pillar)
                  }
                  isActive={activePillar === entry.pillar}
                />
              ))}
            </div>
          </div>

          {/* Pillar detail drill-down */}
          {activePillar && (
            <div className="border-t border-[var(--border)] pt-6">
              <PillarDetailView key={activePillar} pillar={activePillar} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
