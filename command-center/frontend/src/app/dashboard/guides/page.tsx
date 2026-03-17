"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BookMarked,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  CheckCircle2,
  Circle,
  Clock,
  Layers,
} from "lucide-react";
import ModuleHelp from "@/components/ModuleHelp";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ────────────────────────────────────────────────────
interface GuideListItem {
  slug: string;
  title: string;
  created: string;
  last_updated: string;
  version: number;
  word_count: number;
  sections_populated: number;
  sections_total: number;
  filename: string;
}

interface GuideSection {
  content: string;
  has_data: boolean;
}

interface GuideDetail {
  slug: string;
  title: string;
  created: string;
  last_updated: string;
  version: number;
  word_count: number;
  sections_populated: number;
  sections_total: number;
  content: string;
  sections: Record<string, GuideSection>;
}

interface GuidesStats {
  total_guides: number;
  total_words: number;
  sections_populated: number;
  sections_total: number;
  completeness: number;
}

type View = "list" | "detail";

// ── API helper ───────────────────────────────────────────────
async function fetchApi(path: string) {
  const res = await fetch(`${API_URL}/api/guides${path}`);
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
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-6 mb-3 text-[var(--text-primary)]">$1</h2>')
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

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

// ── Module color map ─────────────────────────────────────────
const moduleColors: Record<string, string> = {
  "teardown-builder": "#f59e0b",
  "wordweaver": "#22c55e",
  "resume-customizer": "#3b82f6",
  "job-central": "#ef4444",
  "madlab": "#67e8f9",
  "fenix-dashboard": "#fb923c",
  "fenix-journal": "#2dd4bf",
  "content-audit": "#a78bfa",
  "feedback-testimonials": "#f472b6",
  "website": "#94a3b8",
};

function getModuleColor(slug: string): string {
  return moduleColors[slug] || "#8b5cf6";
}

// ── Main Page Component ──────────────────────────────────────
export default function ProductGuidesPage() {
  const [view, setView] = useState<View>("list");
  const [guides, setGuides] = useState<GuideListItem[]>([]);
  const [stats, setStats] = useState<GuidesStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Detail state
  const [selectedGuide, setSelectedGuide] = useState<GuideDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Load guides list ───────────────────────────────────
  const loadGuides = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [guidesRes, statsRes] = await Promise.all([
        fetchApi(""),
        fetchApi("/stats"),
      ]);
      setGuides(guidesRes.guides);
      setStats(statsRes);
    } catch (e: any) {
      setError(e.message || "Failed to load guides");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadGuides();
  }, [loadGuides]);

  // ── Open guide detail ──────────────────────────────────
  const openGuide = async (slug: string) => {
    setView("detail");
    setDetailLoading(true);
    setError("");
    try {
      const data = await fetchApi(`/${slug}`);
      setSelectedGuide(data);
    } catch (e: any) {
      setError(e.message);
    }
    setDetailLoading(false);
  };

  // ── Navigate between guides ────────────────────────────
  const currentIdx = selectedGuide ? guides.findIndex((g) => g.slug === selectedGuide.slug) : -1;
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < guides.length - 1;

  const navigateGuide = (direction: "prev" | "next") => {
    if (direction === "prev" && hasPrev) openGuide(guides[currentIdx - 1].slug);
    if (direction === "next" && hasNext) openGuide(guides[currentIdx + 1].slug);
  };

  // ════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          {view !== "list" && (
            <button
              onClick={() => { setView("list"); setSelectedGuide(null); }}
              className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
            >
              <ChevronLeft size={20} className="text-[var(--text-muted)]" />
            </button>
          )}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "rgba(139, 92, 246, 0.15)" }}
          >
            <BookMarked size={20} style={{ color: "#8b5cf6" }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[var(--text-primary)]">Product Guides</h1>
              <ModuleHelp moduleSlug="guides" />
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              {view === "list" && "Living knowledge base for each module"}
              {view === "detail" && selectedGuide?.title}
            </p>
          </div>
        </div>

        {view === "detail" && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateGuide("prev")}
              disabled={!hasPrev}
              className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-30"
            >
              <ChevronLeft size={18} className="text-[var(--text-muted)]" />
            </button>
            <span className="text-xs text-[var(--text-muted)] min-w-[60px] text-center">
              {currentIdx >= 0 ? `${currentIdx + 1} of ${guides.length}` : ""}
            </span>
            <button
              onClick={() => navigateGuide("next")}
              disabled={!hasNext}
              className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-30"
            >
              <ChevronRight size={18} className="text-[var(--text-muted)]" />
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* ─── LIST VIEW ─────────────────────────────────────── */}
      {view === "list" && (
        <>
          {/* Stats row */}
          {stats && (
            <div className="grid grid-cols-4 gap-4 mb-8">
              <StatCard label="Guides" value={stats.total_guides} icon={BookMarked} color="#8b5cf6" />
              <StatCard label="Total Words" value={stats.total_words.toLocaleString()} icon={FileText} color="#a78bfa" />
              <StatCard
                label="Completeness"
                value={`${stats.completeness}%`}
                icon={CheckCircle2}
                color="#2dd4bf"
              />
              <StatCard
                label="Sections Filled"
                value={`${stats.sections_populated}/${stats.sections_total}`}
                icon={Layers}
                color="#fb923c"
              />
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
            </div>
          ) : guides.length === 0 ? (
            <div className="text-center py-20 text-[var(--text-muted)]">
              <BookMarked size={40} className="mx-auto mb-3 opacity-40" />
              <p>No product guides yet.</p>
              <p className="text-xs mt-2">
                Run the guide generation script after capturing session history.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {guides.map((guide) => {
                const color = getModuleColor(guide.slug);
                const completeness = guide.sections_total > 0
                  ? Math.round((guide.sections_populated / guide.sections_total) * 100)
                  : 0;

                return (
                  <button
                    key={guide.slug}
                    onClick={() => openGuide(guide.slug)}
                    className="text-left rounded-xl p-5 transition-all hover:scale-[1.005]"
                    style={{
                      backgroundColor: "var(--bg-card)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${color}20` }}
                        >
                          <BookMarked size={18} style={{ color }} />
                        </div>
                        <div>
                          <p className="font-semibold text-[var(--text-primary)] text-sm">
                            {guide.title}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mt-0.5">
                            <span>v{guide.version}</span>
                            <span className="flex items-center gap-1">
                              <Clock size={10} />
                              {formatDate(guide.last_updated)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-[var(--text-muted)] mt-2" />
                    </div>

                    {/* Completeness bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1.5">
                        <span>{guide.sections_populated}/{guide.sections_total} sections</span>
                        <span>{completeness}%</span>
                      </div>
                      <div
                        className="h-1.5 rounded-full overflow-hidden"
                        style={{ backgroundColor: "var(--bg-secondary)" }}
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${completeness}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ─── DETAIL VIEW ───────────────────────────────────── */}
      {view === "detail" && (
        <>
          {detailLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
            </div>
          ) : selectedGuide ? (
            <div>
              {/* Guide metadata */}
              <div
                className="rounded-xl p-5 mb-6"
                style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <div className="grid grid-cols-5 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Version</span>
                    <p className="text-[var(--text-primary)] mt-1">v{selectedGuide.version}</p>
                  </div>
                  <div>
                    <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Created</span>
                    <p className="text-[var(--text-primary)] mt-1">{formatDate(selectedGuide.created)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Updated</span>
                    <p className="text-[var(--text-primary)] mt-1">{formatDate(selectedGuide.last_updated)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Words</span>
                    <p className="text-[var(--text-primary)] mt-1">{selectedGuide.word_count.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Sections</span>
                    <p className="text-[var(--text-primary)] mt-1">
                      {selectedGuide.sections_populated}/{selectedGuide.sections_total} populated
                    </p>
                  </div>
                </div>
              </div>

              {/* Section navigation */}
              <div className="flex flex-wrap gap-2 mb-6">
                {Object.entries(selectedGuide.sections).map(([name, section]) => (
                  <a
                    key={name}
                    href={`#section-${name.toLowerCase().replace(/\s+/g, "-")}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
                    style={{
                      backgroundColor: section.has_data
                        ? `${getModuleColor(selectedGuide.slug)}15`
                        : "var(--bg-secondary)",
                      color: section.has_data
                        ? getModuleColor(selectedGuide.slug)
                        : "var(--text-muted)",
                    }}
                  >
                    {section.has_data ? (
                      <CheckCircle2 size={12} />
                    ) : (
                      <Circle size={12} />
                    )}
                    {name}
                  </a>
                ))}
              </div>

              {/* Guide content */}
              <div
                className="rounded-xl overflow-hidden"
                style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <div
                  className="px-5 py-3 flex items-center gap-2"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <BookMarked size={16} style={{ color: getModuleColor(selectedGuide.slug) }} />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {selectedGuide.title}
                  </span>
                </div>
                <div
                  className="px-6 py-5 text-sm leading-relaxed text-[var(--text-secondary)]"
                  style={{ maxHeight: "70vh", overflowY: "auto" }}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedGuide.content) }}
                />
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-[var(--text-muted)]">
              <p>Guide not found.</p>
            </div>
          )}
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
