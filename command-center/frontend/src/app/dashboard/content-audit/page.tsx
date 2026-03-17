"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Play,
  ChevronDown,
  ChevronRight,
  Eye,
  PenLine,
  Layout,
} from "lucide-react";
import { useApiKey } from "@/context/ApiKeyContext";
import ModuleHelp from "@/components/ModuleHelp";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ────────────────────────────────────────────────────────

interface SiteFile {
  path: string;
  relative: string;
  name: string;
  size: number;
}

interface ContentViolation {
  text: string;
  rule: string;
  severity: "high" | "medium" | "low";
  suggestion: string;
}

interface ContentAuditResult {
  file: string;
  word_count: number;
  violation_count: number;
  violations: ContentViolation[];
}

interface VisualViolation {
  check: string;
  severity: "high" | "medium" | "low";
  location: string;
  detail: string;
  suggestion: string;
}

interface VisualAuditResult {
  file: string;
  violation_count: number;
  violations: VisualViolation[];
}

const severityColor: Record<string, string> = {
  high: "text-red-400",
  medium: "text-amber-400",
  low: "text-[var(--text-muted)]",
};

const severityBg: Record<string, string> = {
  high: "bg-red-500/10 border-red-500/20",
  medium: "bg-amber-500/10 border-amber-500/20",
  low: "bg-[var(--bg-secondary)] border-[var(--border)]",
};

const checkLabels: Record<string, string> = {
  "em-dash": "Em Dash",
  "svg-root-override": "SVG :root Override",
  "svg-class-prefix": "SVG Class Prefix",
  "svg-text-overlap": "SVG Text Overlap",
  "wireframe-sizing": "Wireframe Sizing",
  "bezier-type": "Bezier Type",
  "label-overlap": "Label Overlap",
  "annotation-sizing": "Annotation Sizing",
  "a11y-lang": "Accessibility: Lang",
  "a11y-skip-link": "Accessibility: Skip Link",
  "a11y-alt-text": "Accessibility: Alt Text",
  "a11y-form-label": "Accessibility: Form Label",
  "a11y-svg": "Accessibility: SVG",
  "a11y-heading-hierarchy": "Accessibility: Headings",
  "a11y-link-text": "Accessibility: Link Text",
};

// ── Content Audit Tab ────────────────────────────────────────────

function ContentAuditTab() {
  const { apiKey } = useApiKey();
  const [files, setFiles] = useState<SiteFile[]>([]);
  const [results, setResults] = useState<ContentAuditResult[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanningFile, setScanningFile] = useState<string | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [rules, setRules] = useState<string>("");
  const [showRules, setShowRules] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["X-Claude-Key"] = apiKey;

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/audit/files`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch {}
  }, []);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/audit/rules`);
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || "");
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchFiles();
    fetchRules();
  }, [fetchFiles, fetchRules]);

  const scanFile = async (filePath: string) => {
    setScanningFile(filePath);
    try {
      const res = await fetch(`${API_URL}/api/audit/audit`, {
        method: "POST",
        headers,
        body: JSON.stringify({ file_path: filePath }),
      });
      if (res.ok) {
        const result: ContentAuditResult = await res.json();
        setResults((prev) => {
          const filtered = prev.filter((r) => r.file !== result.file);
          return [...filtered, result];
        });
        if (result.violation_count > 0) {
          setExpandedFiles((prev) => new Set([...prev, result.file]));
        }
      }
    } catch (err) {
      console.error("Scan failed:", err);
    }
    setScanningFile(null);
  };

  const scanAll = async () => {
    setScanning(true);
    setResults([]);
    setScanComplete(false);
    for (const file of files) {
      setScanningFile(file.relative);
      try {
        const res = await fetch(`${API_URL}/api/audit/audit`, {
          method: "POST",
          headers,
          body: JSON.stringify({ file_path: file.path }),
        });
        if (res.ok) {
          const result: ContentAuditResult = await res.json();
          setResults((prev) => [...prev, result]);
          if (result.violation_count > 0) {
            setExpandedFiles((prev) => new Set([...prev, result.file]));
          }
        }
      } catch {}
    }
    setScanningFile(null);
    setScanning(false);
    setScanComplete(true);
  };

  const toggleExpanded = (file: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });
  };

  const totalViolations = results.reduce((sum, r) => sum + r.violation_count, 0);
  const highCount = results.reduce(
    (sum, r) => sum + r.violations.filter((v) => v.severity === "high").length,
    0
  );
  const cleanFiles = results.filter((r) => r.violation_count === 0).length;

  return (
    <div className="space-y-5">
      {/* Actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">
          Scans visible text for voice, jargon, accuracy, and spelling violations.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowRules(!showRules)}
            className="px-3 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-all flex items-center gap-2"
          >
            <Eye size={14} />
            {showRules ? "Hide Rules" : "View Rules"}
          </button>
          <button
            onClick={scanAll}
            disabled={scanning || files.length === 0}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90 transition-all disabled:opacity-40 flex items-center gap-2"
          >
            {scanning ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Play size={14} />
                Scan All Pages
              </>
            )}
          </button>
        </div>
      </div>

      {/* Rules panel */}
      {showRules && (
        <div className="border border-[var(--border)] rounded-lg p-5 bg-[var(--bg-secondary)]">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Content Rules (CONTENT-RULES.md)
          </h3>
          <pre className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto">
            {rules}
          </pre>
        </div>
      )}

      {/* Stats bar */}
      {results.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <div className="border border-[var(--border)] rounded-lg p-4">
            <div className="text-2xl font-semibold text-[var(--text-primary)]">{results.length}</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Pages Scanned</div>
          </div>
          <div className="border border-[var(--border)] rounded-lg p-4">
            <div className={`text-2xl font-semibold ${totalViolations > 0 ? "text-amber-400" : "text-green-400"}`}>
              {totalViolations}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Total Violations</div>
          </div>
          <div className="border border-[var(--border)] rounded-lg p-4">
            <div className={`text-2xl font-semibold ${highCount > 0 ? "text-red-400" : "text-green-400"}`}>
              {highCount}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-1">High Severity</div>
          </div>
          <div className="border border-[var(--border)] rounded-lg p-4">
            <div className="text-2xl font-semibold text-green-400">{cleanFiles}</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Clean Pages</div>
          </div>
        </div>
      )}

      {/* Scanning progress */}
      {scanning && scanningFile && (
        <div className="flex items-center gap-3 px-4 py-3 border border-[var(--border)] rounded-lg bg-[var(--bg-secondary)]">
          <Loader2 size={16} className="animate-spin text-[var(--text-muted)]" />
          <span className="text-sm text-[var(--text-secondary)]">
            Scanning <span className="font-mono text-[var(--text-primary)]">{scanningFile}</span>
            <span className="text-[var(--text-muted)] ml-2">
              ({results.length + 1} of {files.length})
            </span>
          </span>
        </div>
      )}

      {/* File list / Results */}
      <div className="space-y-2">
        {(results.length > 0
          ? results
          : files.map((f) => ({
              file: f.relative,
              word_count: 0,
              violation_count: -1,
              violations: [],
              _fileData: f,
            }))
        ).map((item: any) => {
          const isResult = item.violation_count >= 0;
          const isExpanded = expandedFiles.has(item.file);
          const fileData = files.find((f) => f.relative === item.file) || (item as any)._fileData;

          return (
            <div key={item.file} className="border border-[var(--border)] rounded-lg overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors"
                onClick={() => isResult && item.violation_count > 0 && toggleExpanded(item.file)}
              >
                <div className="flex items-center gap-3">
                  <FileText size={16} className="text-[var(--text-muted)]" />
                  <span className="text-sm font-mono text-[var(--text-primary)]">{item.file}</span>
                  {isResult && item.word_count > 0 && (
                    <span className="text-xs text-[var(--text-muted)]">{item.word_count} words</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {isResult ? (
                    item.violation_count === 0 ? (
                      <span className="flex items-center gap-1.5 text-xs text-green-400">
                        <CheckCircle2 size={14} /> Clean
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-amber-400">
                        <AlertTriangle size={14} /> {item.violation_count} violation
                        {item.violation_count !== 1 ? "s" : ""}
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                    )
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (fileData) scanFile(fileData.path);
                      }}
                      disabled={!!scanningFile}
                      className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-40"
                    >
                      Scan
                    </button>
                  )}
                </div>
              </div>

              {isResult && isExpanded && item.violations.length > 0 && (
                <div className="border-t border-[var(--border)] px-4 py-3 space-y-3 bg-[var(--bg-secondary)]">
                  {item.violations.map((v: ContentViolation, i: number) => (
                    <div key={i} className={`border rounded-lg p-3 ${severityBg[v.severity]}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs font-semibold uppercase tracking-wider ${severityColor[v.severity]}`}
                            >
                              {v.severity}
                            </span>
                            <span className="text-xs text-[var(--text-muted)]">{v.rule}</span>
                          </div>
                          <p className="text-sm text-[var(--text-primary)] font-mono leading-relaxed">
                            &ldquo;{v.text}&rdquo;
                          </p>
                          <p className="text-sm text-green-400 leading-relaxed">&rarr; {v.suggestion}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Scan complete */}
      {scanComplete && totalViolations === 0 && (
        <div className="text-center py-8 border border-green-500/20 bg-green-500/5 rounded-lg">
          <CheckCircle2 size={32} className="text-green-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">All clean</h3>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Every page passes the content rules. No violations found.
          </p>
        </div>
      )}

      {/* Empty state */}
      {!scanning && results.length === 0 && files.length > 0 && (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <PenLine size={40} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm">
            {files.length} pages ready to scan. Click &ldquo;Scan All Pages&rdquo; to check content against your
            rules.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Visual Audit Tab ─────────────────────────────────────────────

function VisualAuditTab() {
  const [files, setFiles] = useState<SiteFile[]>([]);
  const [results, setResults] = useState<VisualAuditResult[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanningFile, setScanningFile] = useState<string | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [rules, setRules] = useState<string>("");
  const [showRules, setShowRules] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/visual-audit/files`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch {}
  }, []);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/visual-audit/rules`);
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || "");
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchFiles();
    fetchRules();
  }, [fetchFiles, fetchRules]);

  const scanFile = async (filePath: string) => {
    setScanningFile(filePath);
    try {
      const res = await fetch(`${API_URL}/api/visual-audit/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_path: filePath }),
      });
      if (res.ok) {
        const result: VisualAuditResult = await res.json();
        setResults((prev) => {
          const filtered = prev.filter((r) => r.file !== result.file);
          return [...filtered, result];
        });
        if (result.violation_count > 0) {
          setExpandedFiles((prev) => new Set([...prev, result.file]));
        }
      }
    } catch (err) {
      console.error("Visual scan failed:", err);
    }
    setScanningFile(null);
  };

  const scanAll = async () => {
    setScanning(true);
    setResults([]);
    setScanComplete(false);
    for (const file of files) {
      setScanningFile(file.relative);
      try {
        const res = await fetch(`${API_URL}/api/visual-audit/audit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_path: file.path }),
        });
        if (res.ok) {
          const result: VisualAuditResult = await res.json();
          setResults((prev) => [...prev, result]);
          if (result.violation_count > 0) {
            setExpandedFiles((prev) => new Set([...prev, result.file]));
          }
        }
      } catch {}
    }
    setScanningFile(null);
    setScanning(false);
    setScanComplete(true);
  };

  const toggleExpanded = (file: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });
  };

  const totalViolations = results.reduce((sum, r) => sum + r.violation_count, 0);
  const highCount = results.reduce(
    (sum, r) => sum + r.violations.filter((v) => v.severity === "high").length,
    0
  );
  const cleanFiles = results.filter((r) => r.violation_count === 0).length;

  return (
    <div className="space-y-5">
      {/* Actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">
          Scans HTML source for SVG issues, wireframe overlaps, journey map threading, and em dashes.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowRules(!showRules)}
            className="px-3 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-all flex items-center gap-2"
          >
            <Eye size={14} />
            {showRules ? "Hide Rules" : "Visual Rules"}
          </button>
          <button
            onClick={scanAll}
            disabled={scanning || files.length === 0}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90 transition-all disabled:opacity-40 flex items-center gap-2"
          >
            {scanning ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Play size={14} />
                Scan All Pages
              </>
            )}
          </button>
        </div>
      </div>

      {/* Rules panel */}
      {showRules && (
        <div className="border border-[var(--border)] rounded-lg p-5 bg-[var(--bg-secondary)]">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            Visual Rules (Section 9 of CONTENT-RULES.md)
          </h3>
          <pre className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto">
            {rules}
          </pre>
        </div>
      )}

      {/* Stats bar */}
      {results.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <div className="border border-[var(--border)] rounded-lg p-4">
            <div className="text-2xl font-semibold text-[var(--text-primary)]">{results.length}</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Pages Scanned</div>
          </div>
          <div className="border border-[var(--border)] rounded-lg p-4">
            <div className={`text-2xl font-semibold ${totalViolations > 0 ? "text-amber-400" : "text-green-400"}`}>
              {totalViolations}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Total Violations</div>
          </div>
          <div className="border border-[var(--border)] rounded-lg p-4">
            <div className={`text-2xl font-semibold ${highCount > 0 ? "text-red-400" : "text-green-400"}`}>
              {highCount}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-1">High Severity</div>
          </div>
          <div className="border border-[var(--border)] rounded-lg p-4">
            <div className="text-2xl font-semibold text-green-400">{cleanFiles}</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Clean Pages</div>
          </div>
        </div>
      )}

      {/* Scanning progress */}
      {scanning && scanningFile && (
        <div className="flex items-center gap-3 px-4 py-3 border border-[var(--border)] rounded-lg bg-[var(--bg-secondary)]">
          <Loader2 size={16} className="animate-spin text-[var(--text-muted)]" />
          <span className="text-sm text-[var(--text-secondary)]">
            Scanning <span className="font-mono text-[var(--text-primary)]">{scanningFile}</span>
            <span className="text-[var(--text-muted)] ml-2">
              ({results.length + 1} of {files.length})
            </span>
          </span>
        </div>
      )}

      {/* File list / Results */}
      <div className="space-y-2">
        {(results.length > 0
          ? results
          : files.map((f) => ({
              file: f.relative,
              violation_count: -1,
              violations: [],
              _fileData: f,
            }))
        ).map((item: any) => {
          const isResult = item.violation_count >= 0;
          const isExpanded = expandedFiles.has(item.file);
          const fileData = files.find((f) => f.relative === item.file) || (item as any)._fileData;

          return (
            <div key={item.file} className="border border-[var(--border)] rounded-lg overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors"
                onClick={() => isResult && item.violation_count > 0 && toggleExpanded(item.file)}
              >
                <div className="flex items-center gap-3">
                  <FileText size={16} className="text-[var(--text-muted)]" />
                  <span className="text-sm font-mono text-[var(--text-primary)]">{item.file}</span>
                </div>
                <div className="flex items-center gap-3">
                  {isResult ? (
                    item.violation_count === 0 ? (
                      <span className="flex items-center gap-1.5 text-xs text-green-400">
                        <CheckCircle2 size={14} /> Clean
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-amber-400">
                        <AlertTriangle size={14} /> {item.violation_count} issue
                        {item.violation_count !== 1 ? "s" : ""}
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                    )
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (fileData) scanFile(fileData.path);
                      }}
                      disabled={!!scanningFile}
                      className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-40"
                    >
                      Scan
                    </button>
                  )}
                </div>
              </div>

              {isResult && isExpanded && item.violations.length > 0 && (
                <div className="border-t border-[var(--border)] px-4 py-3 space-y-3 bg-[var(--bg-secondary)]">
                  {item.violations.map((v: VisualViolation, i: number) => (
                    <div key={i} className={`border rounded-lg p-3 ${severityBg[v.severity]}`}>
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-semibold uppercase tracking-wider ${severityColor[v.severity]}`}
                          >
                            {v.severity}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-muted)]">
                            {checkLabels[v.check] || v.check}
                          </span>
                          <span className="text-xs text-[var(--text-muted)]">{v.location}</span>
                        </div>
                        <p className="text-sm text-[var(--text-primary)] leading-relaxed">{v.detail}</p>
                        <p className="text-sm text-green-400 leading-relaxed">&rarr; {v.suggestion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Scan complete */}
      {scanComplete && totalViolations === 0 && (
        <div className="text-center py-8 border border-green-500/20 bg-green-500/5 rounded-lg">
          <CheckCircle2 size={32} className="text-green-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">All clean</h3>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            No visual issues found. SVGs, wireframes, and journey maps look good.
          </p>
        </div>
      )}

      {/* Empty state */}
      {!scanning && results.length === 0 && files.length > 0 && (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <Layout size={40} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm">
            {files.length} pages ready to scan. Checks SVGs, wireframes, journey maps, and em dashes.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main Page with Tabs ──────────────────────────────────────────

export default function ContentAuditPage() {
  const [activeTab, setActiveTab] = useState<"content" | "visual">("content");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight flex items-center gap-3">
          <Shield size={24} />
          Content Audit
          <ModuleHelp moduleSlug="content-audit" />
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Scan every page against your content and visual rules.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-[var(--border)]">
        <button
          onClick={() => setActiveTab("content")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
            activeTab === "content"
              ? "border-[var(--text-primary)] text-[var(--text-primary)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          <PenLine size={15} />
          Content
        </button>
        <button
          onClick={() => setActiveTab("visual")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
            activeTab === "visual"
              ? "border-[var(--text-primary)] text-[var(--text-primary)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          <Layout size={15} />
          Visual
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "content" ? <ContentAuditTab /> : <VisualAuditTab />}
    </div>
  );
}
