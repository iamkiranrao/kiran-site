"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Globe,
  Monitor,
  AlertTriangle,
  XCircle,
  Info,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Loader2,
  ExternalLink,
  Wrench,
  Eye,
  FileText,
  Package,
} from "lucide-react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── File Classification ────────────────────────────────────────

type FileZone = "website" | "prototype" | "internal" | "noise";

interface ZoneMeta {
  label: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  description: string;
}

const ZONE_META: Record<FileZone, ZoneMeta> = {
  website: {
    label: "Published Website",
    icon: <Globe className="w-4 h-4" />,
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/30",
    description: "Live on kiranrao.ai — these matter most",
  },
  prototype: {
    label: "Prototypes & Apps",
    icon: <Package className="w-4 h-4" />,
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/30",
    description: "Product prototypes and demos",
  },
  internal: {
    label: "Internal / Dev Tools",
    icon: <Monitor className="w-4 h-4" />,
    color: "text-zinc-400",
    bg: "bg-zinc-500/10 border-zinc-500/30",
    description: "Wireframes, mockups, dev previews — lower priority",
  },
  noise: {
    label: "Noise (node_modules)",
    icon: <Package className="w-4 h-4" />,
    color: "text-zinc-600",
    bg: "bg-zinc-800/50 border-zinc-700/30",
    description: "Third-party code — should be excluded from scans",
  },
};

// Portfolio sections within "website" zone
type PortfolioSection =
  | "homepage"
  | "teardowns"
  | "blog"
  | "studio"
  | "pages"
  | "prototypes"
  | "dev-tools"
  | "node_modules";

interface SectionMeta {
  label: string;
  zone: FileZone;
}

const SECTION_META: Record<PortfolioSection, SectionMeta> = {
  homepage: { label: "Homepage", zone: "website" },
  teardowns: { label: "Teardowns", zone: "website" },
  blog: { label: "Blog", zone: "website" },
  studio: { label: "Studio / MadLab / Store", zone: "website" },
  pages: { label: "Other Pages", zone: "website" },
  prototypes: { label: "Prototypes", zone: "prototype" },
  "dev-tools": { label: "Dev Tools & Wireframes", zone: "internal" },
  node_modules: { label: "node_modules", zone: "noise" },
};

function classifyFile(path: string): PortfolioSection {
  if (path.includes("node_modules/") || path.includes("coverage/"))
    return "node_modules";
  if (path === "index.html" || path === "index.backup.html") return "homepage";
  if (path.startsWith("teardowns/")) return "teardowns";
  if (path.startsWith("blog/") || path === "blog-podcast.html") return "blog";
  if (
    path === "studio.html" ||
    path === "madlab.html" ||
    path === "store.html"
  )
    return "studio";
  if (path.startsWith("prototypes/")) return "prototypes";
  // Dev tools: wireframes, mockups, previews, persona-picker iterations
  if (
    path.includes("wireframe") ||
    path.includes("mockup") ||
    path.includes("preview") ||
    path.includes("tuner") ||
    path.includes("margin-compare") ||
    path.startsWith("persona-picker") ||
    path.startsWith("persona-layout") ||
    path === "hero-video-prototype.html" ||
    path === "og-card-mockup.html" ||
    path === "sparkline-preview.html"
  )
    return "dev-tools";
  // Remaining website pages
  return "pages";
}

function classifyZone(path: string): FileZone {
  const section = classifyFile(path);
  return SECTION_META[section].zone;
}

// ── Types ──────────────────────────────────────────────────────

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

interface PillarDetail {
  pillar: string;
  pillar_label: string;
  file_reports: FileReport[];
}

interface AggregatedFile {
  relative_path: string;
  section: PortfolioSection;
  zone: FileZone;
  word_count: number;
  pillars: {
    [pillar: string]: {
      critical: number;
      warning: number;
      info: number;
      violations: Violation[];
    };
  };
  total_critical: number;
  total_warning: number;
  total_info: number;
  total_violations: number;
  auto_fixable_count: number;
}

// ── Severity Helpers ───────────────────────────────────────────

function severityColor(s: string) {
  switch (s) {
    case "critical":
      return "text-red-400";
    case "warning":
      return "text-amber-400";
    default:
      return "text-zinc-500";
  }
}

function severityBg(s: string) {
  switch (s) {
    case "critical":
      return "bg-red-500/20 text-red-300";
    case "warning":
      return "bg-amber-500/20 text-amber-300";
    default:
      return "bg-zinc-700/50 text-zinc-400";
  }
}

function healthScore(f: AggregatedFile): number {
  // Per-file health: 100 - (C*15 + W*5 + I*1), floored at 0
  return Math.max(0, 100 - f.total_critical * 15 - f.total_warning * 5 - f.total_info * 1);
}

function healthColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-lime-400";
  if (score >= 40) return "text-amber-400";
  if (score >= 20) return "text-orange-400";
  return "text-red-400";
}

function healthBg(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-lime-500";
  if (score >= 40) return "bg-amber-500";
  if (score >= 20) return "bg-orange-500";
  return "bg-red-500";
}

// ── Heatmap Cell ───────────────────────────────────────────────

function HeatCell({
  file,
  onClick,
  selected,
}: {
  file: AggregatedFile;
  onClick: () => void;
  selected: boolean;
}) {
  const score = healthScore(file);
  const name = file.relative_path.split("/").pop() || file.relative_path;

  return (
    <button
      onClick={onClick}
      className={`relative group rounded-lg p-2 text-left transition-all border ${
        selected
          ? "ring-2 ring-blue-400 border-blue-500/50"
          : "border-zinc-700/50 hover:border-zinc-600"
      }`}
      style={{
        backgroundColor: `${
          score >= 80
            ? "rgba(16,185,129,0.1)"
            : score >= 60
              ? "rgba(132,204,22,0.1)"
              : score >= 40
                ? "rgba(245,158,11,0.1)"
                : score >= 20
                  ? "rgba(249,115,22,0.15)"
                  : "rgba(239,68,68,0.15)"
        }`,
      }}
    >
      {/* Health bar */}
      <div className="w-full h-1.5 rounded-full bg-zinc-800 mb-2 overflow-hidden">
        <div
          className={`h-full rounded-full ${healthBg(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="text-xs font-medium text-zinc-200 truncate" title={file.relative_path}>
        {name}
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className={`text-xs font-mono font-bold ${healthColor(score)}`}>
          {score}
        </span>
        {file.total_critical > 0 && (
          <span className="text-[10px] text-red-400 font-medium">
            {file.total_critical}C
          </span>
        )}
        {file.total_warning > 0 && (
          <span className="text-[10px] text-amber-400 font-medium">
            {file.total_warning}W
          </span>
        )}
      </div>
      {file.auto_fixable_count > 0 && (
        <div className="absolute top-1.5 right-1.5">
          <Wrench className="w-3 h-3 text-emerald-500" />
        </div>
      )}
    </button>
  );
}

// ── File Detail Panel ──────────────────────────────────────────

function FileDetailPanel({ file }: { file: AggregatedFile }) {
  const score = healthScore(file);
  const [expandedPillar, setExpandedPillar] = useState<string | null>(null);

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-zinc-100">
            {file.relative_path}
          </h3>
          <div className="flex items-center gap-3 mt-1 text-sm text-zinc-400">
            <span
              className={`${ZONE_META[file.zone].color} flex items-center gap-1`}
            >
              {ZONE_META[file.zone].icon}
              {ZONE_META[file.zone].label}
            </span>
            <span>{file.word_count.toLocaleString()} words</span>
          </div>
        </div>
        <div className="text-right">
          <div
            className={`text-3xl font-bold font-mono ${healthColor(score)}`}
          >
            {score}
          </div>
          <div className="text-xs text-zinc-500">health score</div>
        </div>
      </div>

      {/* Violation summary by severity */}
      <div className="flex gap-3">
        {file.total_critical > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
            <XCircle className="w-3.5 h-3.5 text-red-400" />
            <span className="text-sm font-medium text-red-300">
              {file.total_critical} critical
            </span>
          </div>
        )}
        {file.total_warning > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-sm font-medium text-amber-300">
              {file.total_warning} warnings
            </span>
          </div>
        )}
        {file.total_info > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-700/50 border border-zinc-600/30">
            <Info className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-sm font-medium text-zinc-300">
              {file.total_info} info
            </span>
          </div>
        )}
        {file.auto_fixable_count > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <Wrench className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-sm font-medium text-emerald-300">
              {file.auto_fixable_count} auto-fixable
            </span>
          </div>
        )}
      </div>

      {/* Violations grouped by pillar */}
      <div className="space-y-2">
        {Object.entries(file.pillars).map(([pillar, data]) => {
          if (data.critical + data.warning + data.info === 0) return null;
          const isExpanded = expandedPillar === pillar;
          return (
            <div
              key={pillar}
              className="border border-zinc-700/50 rounded-lg overflow-hidden"
            >
              <button
                onClick={() =>
                  setExpandedPillar(isExpanded ? null : pillar)
                }
                className="w-full flex items-center justify-between px-4 py-2.5 bg-zinc-800/50 hover:bg-zinc-800 text-left"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-zinc-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-zinc-500" />
                  )}
                  <span className="text-sm font-medium text-zinc-200 capitalize">
                    {pillar}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {data.critical > 0 && (
                    <span className="text-xs text-red-400 font-medium">
                      {data.critical}C
                    </span>
                  )}
                  {data.warning > 0 && (
                    <span className="text-xs text-amber-400 font-medium">
                      {data.warning}W
                    </span>
                  )}
                  {data.info > 0 && (
                    <span className="text-xs text-zinc-500 font-medium">
                      {data.info}I
                    </span>
                  )}
                </div>
              </button>
              {isExpanded && (
                <div className="divide-y divide-zinc-800">
                  {data.violations.map((v, idx) => (
                    <div key={idx} className="px-4 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${severityBg(v.severity)}`}
                        >
                          {v.severity}
                        </span>
                        <span className="text-zinc-400 text-xs font-mono">
                          {v.check_id}
                        </span>
                        {v.auto_fixable && (
                          <Wrench className="w-3 h-3 text-emerald-500" />
                        )}
                      </div>
                      <p className="text-zinc-300 mt-1">{v.detail}</p>
                      {v.suggestion && (
                        <p className="text-zinc-500 mt-0.5 text-xs">
                          💡 {v.suggestion}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Section Summary Bar ────────────────────────────────────────

function SectionBar({
  section,
  files,
  avgScore,
  totalViolations,
  criticals,
}: {
  section: PortfolioSection;
  files: number;
  avgScore: number;
  totalViolations: number;
  criticals: number;
}) {
  const meta = SECTION_META[section];
  const zoneMeta = ZONE_META[meta.zone];

  return (
    <div className="flex items-center gap-3 text-sm">
      <div className={`w-3 h-3 rounded-sm ${healthBg(avgScore)}`} />
      <span className="text-zinc-200 font-medium w-48">{meta.label}</span>
      <span className={`font-mono font-bold w-10 ${healthColor(avgScore)}`}>
        {avgScore}
      </span>
      <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${healthBg(avgScore)}`}
          style={{ width: `${avgScore}%` }}
        />
      </div>
      <span className="text-zinc-500 w-16 text-right">{files} files</span>
      <span className="text-zinc-500 w-24 text-right">
        {totalViolations} issues
      </span>
      {criticals > 0 && (
        <span className="text-red-400 text-xs font-medium w-12 text-right">
          {criticals}C
        </span>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────

export default function PortfolioHealthPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pillarData, setPillarData] = useState<PillarDetail[]>([]);
  const [selectedFile, setSelectedFile] = useState<AggregatedFile | null>(null);
  const [zoneFilter, setZoneFilter] = useState<FileZone | "all">("all");
  const [hideNoise, setHideNoise] = useState(true);

  // Fetch all three pillar details
  useEffect(() => {
    async function fetchData() {
      try {
        const pillars = ["authenticity", "content", "visual"];
        const results = await Promise.all(
          pillars.map((p) =>
            fetch(`${API_URL}/api/standards/${p}/details`).then((r) => r.json())
          )
        );
        setPillarData(results);
      } catch (err) {
        setError("Failed to load standards data. Is the backend running?");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Aggregate violations by file across all pillars
  const aggregatedFiles = useMemo(() => {
    const fileMap = new Map<string, AggregatedFile>();

    for (const pillar of pillarData) {
      for (const fr of pillar.file_reports) {
        const key = fr.relative_path;
        if (!fileMap.has(key)) {
          fileMap.set(key, {
            relative_path: key,
            section: classifyFile(key),
            zone: classifyZone(key),
            word_count: fr.word_count,
            pillars: {},
            total_critical: 0,
            total_warning: 0,
            total_info: 0,
            total_violations: 0,
            auto_fixable_count: 0,
          });
        }
        const agg = fileMap.get(key)!;
        agg.pillars[pillar.pillar] = {
          critical: fr.critical_count,
          warning: fr.warning_count,
          info: fr.info_count,
          violations: fr.violations,
        };
        agg.total_critical += fr.critical_count;
        agg.total_warning += fr.warning_count;
        agg.total_info += fr.info_count;
        agg.total_violations +=
          fr.critical_count + fr.warning_count + fr.info_count;
        agg.auto_fixable_count += fr.violations.filter(
          (v) => v.auto_fixable
        ).length;
      }
    }

    return Array.from(fileMap.values()).filter(
      (f) => f.total_violations > 0
    );
  }, [pillarData]);

  // Filter & group
  const filteredFiles = useMemo(() => {
    let files = aggregatedFiles;
    if (hideNoise) files = files.filter((f) => f.zone !== "noise");
    if (zoneFilter !== "all")
      files = files.filter((f) => f.zone === zoneFilter);
    return files;
  }, [aggregatedFiles, zoneFilter, hideNoise]);

  const filesBySection = useMemo(() => {
    const groups = new Map<PortfolioSection, AggregatedFile[]>();
    for (const f of filteredFiles) {
      const section = f.section;
      if (!groups.has(section)) groups.set(section, []);
      groups.get(section)!.push(f);
    }
    // Sort files within each section by health score ascending (worst first)
    for (const files of groups.values()) {
      files.sort((a, b) => healthScore(a) - healthScore(b));
    }
    return groups;
  }, [filteredFiles]);

  // Section-level stats
  const sectionStats = useMemo(() => {
    const stats: {
      section: PortfolioSection;
      files: number;
      avgScore: number;
      totalViolations: number;
      criticals: number;
    }[] = [];

    // Order: website sections first, then prototypes, internal, noise
    const sectionOrder: PortfolioSection[] = [
      "homepage",
      "teardowns",
      "blog",
      "studio",
      "pages",
      "prototypes",
      "dev-tools",
      "node_modules",
    ];

    for (const section of sectionOrder) {
      const files = filesBySection.get(section);
      if (!files || files.length === 0) continue;
      const scores = files.map(healthScore);
      const avg = Math.round(
        scores.reduce((a, b) => a + b, 0) / scores.length
      );
      stats.push({
        section,
        files: files.length,
        avgScore: avg,
        totalViolations: files.reduce((a, f) => a + f.total_violations, 0),
        criticals: files.reduce((a, f) => a + f.total_critical, 0),
      });
    }
    return stats;
  }, [filesBySection]);

  // Overall stats
  const overallStats = useMemo(() => {
    const websiteFiles = aggregatedFiles.filter(
      (f) => f.zone === "website"
    );
    const protoFiles = aggregatedFiles.filter(
      (f) => f.zone === "prototype"
    );
    const internalFiles = aggregatedFiles.filter(
      (f) => f.zone === "internal"
    );
    const noiseFiles = aggregatedFiles.filter((f) => f.zone === "noise");

    const avgScore = (files: AggregatedFile[]) =>
      files.length === 0
        ? 100
        : Math.round(
            files.map(healthScore).reduce((a, b) => a + b, 0) / files.length
          );

    return {
      website: {
        files: websiteFiles.length,
        avgScore: avgScore(websiteFiles),
        criticals: websiteFiles.reduce((a, f) => a + f.total_critical, 0),
        violations: websiteFiles.reduce(
          (a, f) => a + f.total_violations,
          0
        ),
      },
      prototype: {
        files: protoFiles.length,
        avgScore: avgScore(protoFiles),
        criticals: protoFiles.reduce((a, f) => a + f.total_critical, 0),
        violations: protoFiles.reduce((a, f) => a + f.total_violations, 0),
      },
      internal: {
        files: internalFiles.length,
        avgScore: avgScore(internalFiles),
        criticals: internalFiles.reduce((a, f) => a + f.total_critical, 0),
        violations: internalFiles.reduce(
          (a, f) => a + f.total_violations,
          0
        ),
      },
      noise: {
        files: noiseFiles.length,
        avgScore: avgScore(noiseFiles),
        criticals: noiseFiles.reduce((a, f) => a + f.total_critical, 0),
        violations: noiseFiles.reduce((a, f) => a + f.total_violations, 0),
      },
    };
  }, [aggregatedFiles]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
        <span className="ml-3 text-zinc-400">
          Scanning portfolio health…
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
        <p className="text-zinc-300">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link
              href="/dashboard/standards"
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-zinc-100">
              Portfolio Health Map
            </h1>
          </div>
          <p className="text-sm text-zinc-400 ml-8">
            Authenticity, Content & Visual violations across your website and
            projects
          </p>
        </div>
      </div>

      {/* Zone Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(["website", "prototype", "internal", "noise"] as FileZone[]).map(
          (zone) => {
            const stats = overallStats[zone];
            const meta = ZONE_META[zone];
            const isActive = zoneFilter === zone;
            return (
              <button
                key={zone}
                onClick={() =>
                  setZoneFilter(isActive ? "all" : zone)
                }
                className={`text-left rounded-xl border p-4 transition-all ${
                  isActive
                    ? "ring-2 ring-blue-400 " + meta.bg
                    : meta.bg + " hover:border-zinc-500"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className={`flex items-center gap-2 ${meta.color}`}
                  >
                    {meta.icon}
                    <span className="text-sm font-medium">{meta.label}</span>
                  </div>
                  <span
                    className={`text-2xl font-bold font-mono ${healthColor(stats.avgScore)}`}
                  >
                    {stats.avgScore}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full ${healthBg(stats.avgScore)}`}
                    style={{ width: `${stats.avgScore}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>{stats.files} files</span>
                  <span>{stats.violations} issues</span>
                  {stats.criticals > 0 && (
                    <span className="text-red-400">
                      {stats.criticals} critical
                    </span>
                  )}
                </div>
              </button>
            );
          }
        )}
      </div>

      {/* Noise toggle */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={hideNoise}
            onChange={(e) => setHideNoise(e.target.checked)}
            className="rounded border-zinc-600 bg-zinc-800 text-blue-500"
          />
          Hide node_modules noise ({overallStats.noise.files} files,{" "}
          {overallStats.noise.violations} violations)
        </label>
        {zoneFilter !== "all" && (
          <button
            onClick={() => setZoneFilter("all")}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Section-by-section health bars */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-3">
          Section Health Overview
        </h2>
        {sectionStats.map((s) => (
          <SectionBar key={s.section} {...s} />
        ))}
      </div>

      {/* Main content: heatmap + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Heatmap grid */}
        <div className="lg:col-span-2 space-y-6">
          {sectionStats.map(({ section }) => {
            const files = filesBySection.get(section);
            if (!files) return null;
            const meta = SECTION_META[section];
            const zoneMeta = ZONE_META[meta.zone];
            return (
              <div key={section}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={zoneMeta.color}>{zoneMeta.icon}</span>
                  <h3 className="text-sm font-semibold text-zinc-300">
                    {meta.label}
                  </h3>
                  <span className="text-xs text-zinc-600">
                    {files.length} files
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {files.map((f) => (
                    <HeatCell
                      key={f.relative_path}
                      file={f}
                      selected={
                        selectedFile?.relative_path === f.relative_path
                      }
                      onClick={() => setSelectedFile(f)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-1">
          {selectedFile ? (
            <div className="sticky top-4">
              <FileDetailPanel file={selectedFile} />
            </div>
          ) : (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center">
              <Eye className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">
                Click any file in the heatmap to see its violation details
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Critical files table — website only */}
      {(() => {
        const websiteCriticals = aggregatedFiles
          .filter((f) => f.zone === "website" && f.total_critical > 0)
          .sort((a, b) => b.total_critical - a.total_critical);

        if (websiteCriticals.length === 0) return null;

        return (
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-red-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Critical Issues on Published Website
            </h2>
            <div className="space-y-2">
              {websiteCriticals.map((f) => (
                <button
                  key={f.relative_path}
                  onClick={() => setSelectedFile(f)}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-zinc-900/50 border border-zinc-800 hover:border-red-500/30 text-left transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-zinc-500" />
                    <span className="text-sm text-zinc-200">
                      {f.relative_path}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-red-400 font-medium">
                      {f.total_critical} critical
                    </span>
                    <span className="text-xs text-amber-400">
                      {f.total_warning}W
                    </span>
                    <span
                      className={`text-sm font-mono font-bold ${healthColor(healthScore(f))}`}
                    >
                      {healthScore(f)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Worst files leaderboard — website */}
      {(() => {
        const worstWebsite = aggregatedFiles
          .filter((f) => f.zone === "website")
          .sort((a, b) => healthScore(a) - healthScore(b))
          .slice(0, 10);

        return (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">
              🔧 Top 10 Website Files to Fix (Worst Health)
            </h2>
            <div className="space-y-1">
              {worstWebsite.map((f, i) => {
                const score = healthScore(f);
                return (
                  <button
                    key={f.relative_path}
                    onClick={() => setSelectedFile(f)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800/50 text-left transition-colors"
                  >
                    <span className="text-xs text-zinc-600 w-5 text-right font-mono">
                      {i + 1}.
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${healthBg(score)}`}
                          style={{ width: `${Math.max(score, 2)}%` }}
                        />
                      </div>
                    </div>
                    <span
                      className={`font-mono font-bold text-sm w-8 ${healthColor(score)}`}
                    >
                      {score}
                    </span>
                    <span className="text-sm text-zinc-300 truncate max-w-[200px]">
                      {f.relative_path}
                    </span>
                    <div className="flex items-center gap-1.5 ml-auto">
                      {f.total_critical > 0 && (
                        <span className="text-[10px] text-red-400">
                          {f.total_critical}C
                        </span>
                      )}
                      <span className="text-[10px] text-amber-400">
                        {f.total_warning}W
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
