"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Library,
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  FolderOpen,
  Hash,
  Clock,
  X,
} from "lucide-react";
import ModuleHelp from "@/components/ModuleHelp";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ────────────────────────────────────────────────────

interface LibraryItem {
  id: string;
  title: string;
  filename: string;
  path: string;
  category: string;
  color: string;
  summary: string;
  word_count: number;
  modified: string;
  size_bytes: number;
}

interface LibraryItemDetail extends LibraryItem {
  content: string;
}

interface LibraryStats {
  total_files: number;
  total_words: number;
  categories: Record<string, number>;
}

interface CategoryInfo {
  count: number;
  color: string;
}

type View = "list" | "detail";

// ── API helper ───────────────────────────────────────────────

async function fetchApi(path: string) {
  const res = await fetch(`${API_URL}/api/library${path}`);
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
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded text-xs bg-[var(--bg-secondary)] text-[var(--text-primary)]">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 mb-1.5">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, (match) => `<ul class="list-disc pl-2 my-3">${match}</ul>`)
    .replace(/\n\n/g, '</p><p class="mb-3 leading-relaxed text-[var(--text-secondary)]">');
}

function formatDate(isoStr: string): string {
  if (!isoStr) return "—";
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return isoStr;
  }
}

function formatWords(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

// ── Main Page Component ──────────────────────────────────────

export default function KnowledgeLibraryPage() {
  const [view, setView] = useState<View>("list");
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [categories, setCategories] = useState<Record<string, CategoryInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Detail state
  const [selectedItem, setSelectedItem] = useState<LibraryItemDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Load library ───────────────────────────────────────
  const loadLibrary = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [itemsRes, statsRes, catsRes] = await Promise.all([
        fetchApi(""),
        fetchApi("/stats"),
        fetchApi("/categories"),
      ]);
      setItems(itemsRes.items);
      setStats(statsRes);
      setCategories(catsRes.categories);
    } catch (e: any) {
      setError(e.message || "Failed to load library");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  // ── Filter items client-side ────────────────────────────
  const filteredItems = items.filter((item) => {
    if (activeCategory && item.category !== activeCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.filename.toLowerCase().includes(q) ||
        item.path.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ── Open detail ────────────────────────────────────────
  const openItem = async (id: string) => {
    setView("detail");
    setDetailLoading(true);
    setError("");
    try {
      const data = await fetchApi(`/${id}`);
      setSelectedItem(data);
    } catch (e: any) {
      setError(e.message);
    }
    setDetailLoading(false);
  };

  // ── Navigate between items ─────────────────────────────
  const currentIdx = selectedItem
    ? filteredItems.findIndex((i) => i.id === selectedItem.id)
    : -1;
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < filteredItems.length - 1;

  const navigateItem = (direction: "prev" | "next") => {
    if (direction === "prev" && hasPrev) openItem(filteredItems[currentIdx - 1].id);
    if (direction === "next" && hasNext) openItem(filteredItems[currentIdx + 1].id);
  };

  // ── Group items by category for list view ──────────────
  const groupedItems: Record<string, LibraryItem[]> = {};
  for (const item of filteredItems) {
    if (!groupedItems[item.category]) groupedItems[item.category] = [];
    groupedItems[item.category].push(item);
  }
  const sortedCategories = Object.keys(groupedItems).sort();

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
              onClick={() => {
                setView("list");
                setSelectedItem(null);
              }}
              className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
            >
              <ChevronLeft size={20} className="text-[var(--text-muted)]" />
            </button>
          )}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "rgba(129, 140, 248, 0.15)" }}
          >
            <Library size={20} style={{ color: "#818cf8" }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[var(--text-primary)]">
                Knowledge Library
              </h1>
              <ModuleHelp moduleSlug="library" />
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              {view === "list" && "Quick reference for all project documentation"}
              {view === "detail" && selectedItem?.title}
            </p>
          </div>
        </div>

        {view === "detail" && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateItem("prev")}
              disabled={!hasPrev}
              className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-30"
            >
              <ChevronLeft size={18} className="text-[var(--text-muted)]" />
            </button>
            <span className="text-xs text-[var(--text-muted)] min-w-[60px] text-center">
              {currentIdx >= 0 ? `${currentIdx + 1} of ${filteredItems.length}` : ""}
            </span>
            <button
              onClick={() => navigateItem("next")}
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
            <div className="grid grid-cols-3 gap-4 mb-6">
              <StatCard
                label="Documents"
                value={stats.total_files}
                icon={FileText}
                color="#818cf8"
              />
              <StatCard
                label="Total Words"
                value={stats.total_words.toLocaleString()}
                icon={Hash}
                color="#a78bfa"
              />
              <StatCard
                label="Categories"
                value={Object.keys(stats.categories).length}
                icon={FolderOpen}
                color="#2dd4bf"
              />
            </div>
          )}

          {/* Search + Category filters */}
          <div className="mb-6 space-y-3">
            {/* Search bar */}
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                type="text"
                placeholder="Search documents by title, content, or filename..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 rounded-lg text-sm transition-colors"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
                onFocus={(e) =>
                  (e.target.style.borderColor = "#818cf8")
                }
                onBlur={(e) =>
                  (e.target.style.borderColor = "var(--border)")
                }
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Category pills */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveCategory(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  !activeCategory
                    ? "text-[var(--text-primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
                style={{
                  backgroundColor: !activeCategory
                    ? "rgba(129, 140, 248, 0.15)"
                    : "var(--bg-secondary)",
                }}
              >
                All ({items.length})
              </button>
              {Object.entries(categories)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([cat, info]) => (
                  <button
                    key={cat}
                    onClick={() =>
                      setActiveCategory(activeCategory === cat ? null : cat)
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      activeCategory === cat
                        ? "text-[var(--text-primary)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    }`}
                    style={{
                      backgroundColor:
                        activeCategory === cat
                          ? `${info.color}20`
                          : "var(--bg-secondary)",
                    }}
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1.5"
                      style={{ backgroundColor: info.color }}
                    />
                    {cat} ({info.count})
                  </button>
                ))}
            </div>
          </div>

          {/* Results */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2
                size={24}
                className="animate-spin text-[var(--text-muted)]"
              />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-20 text-[var(--text-muted)]">
              <Library size={40} className="mx-auto mb-3 opacity-40" />
              <p>No documents match your search.</p>
              {(searchQuery || activeCategory) && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setActiveCategory(null);
                  }}
                  className="text-xs mt-2 text-[#818cf8] hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {sortedCategories.map((cat) => {
                const catItems = groupedItems[cat];
                const catColor =
                  categories[cat]?.color || "#94a3b8";
                return (
                  <div key={cat}>
                    {/* Category header */}
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: catColor }}
                      />
                      <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                        {cat}
                      </h2>
                      <span className="text-xs text-[var(--text-muted)]">
                        ({catItems.length})
                      </span>
                    </div>

                    {/* Document cards */}
                    <div className="grid grid-cols-1 gap-2">
                      {catItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => openItem(item.id)}
                          className="text-left rounded-xl p-4 transition-all hover:scale-[1.002] group"
                          style={{
                            backgroundColor: "var(--bg-card)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          <div className="flex items-start gap-3">
                            {/* Icon */}
                            <div
                              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                              style={{
                                backgroundColor: `${catColor}15`,
                              }}
                            >
                              <FileText
                                size={16}
                                style={{ color: catColor }}
                              />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-semibold text-sm text-[var(--text-primary)] truncate">
                                  {item.title}
                                </p>
                                <ChevronRight
                                  size={16}
                                  className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                />
                              </div>
                              <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2 leading-relaxed">
                                {item.summary}
                              </p>
                              <div className="flex items-center gap-3 mt-2 text-[10px] text-[var(--text-muted)]">
                                <span className="flex items-center gap-1">
                                  <Hash size={10} />
                                  {formatWords(item.word_count)} words
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock size={10} />
                                  {formatDate(item.modified)}
                                </span>
                                <span className="opacity-60 truncate max-w-[200px]">
                                  {item.path}
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
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
              <Loader2
                size={24}
                className="animate-spin text-[var(--text-muted)]"
              />
            </div>
          ) : selectedItem ? (
            <div>
              {/* Metadata bar */}
              <div
                className="rounded-xl p-5 mb-6"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                      Category
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="w-2.5 h-2.5 rounded"
                        style={{
                          backgroundColor: selectedItem.color,
                        }}
                      />
                      <p className="text-[var(--text-primary)]">
                        {selectedItem.category}
                      </p>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                      Words
                    </span>
                    <p className="text-[var(--text-primary)] mt-1">
                      {selectedItem.word_count.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                      Modified
                    </span>
                    <p className="text-[var(--text-primary)] mt-1">
                      {formatDate(selectedItem.modified)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                      File
                    </span>
                    <p className="text-[var(--text-primary)] mt-1 truncate text-xs">
                      {selectedItem.path}
                    </p>
                  </div>
                </div>
              </div>

              {/* Summary callout */}
              <div
                className="rounded-xl p-4 mb-6"
                style={{
                  backgroundColor: `${selectedItem.color}08`,
                  border: `1px solid ${selectedItem.color}20`,
                }}
              >
                <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                  Quick Summary
                </p>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {selectedItem.summary}
                </p>
              </div>

              {/* Full content */}
              <div
                className="rounded-xl overflow-hidden"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  className="px-5 py-3 flex items-center gap-2"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <FileText
                    size={16}
                    style={{ color: selectedItem.color }}
                  />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {selectedItem.title}
                  </span>
                </div>
                <div
                  className="px-6 py-5 text-sm leading-relaxed text-[var(--text-secondary)]"
                  style={{ maxHeight: "70vh", overflowY: "auto" }}
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(selectedItem.content),
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-[var(--text-muted)]">
              <p>Document not found.</p>
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
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border)",
      }}
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
