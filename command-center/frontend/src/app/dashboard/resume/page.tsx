"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  FileText,
  Play,
  Download,
  Package,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  X,
  Key,
  HelpCircle,
  BarChart3,
  ChevronRight,
  Link2,
  Eye,
  ThumbsUp,
  MessageSquare,
  Send,
  ArrowRight,
  Lock,
  ArrowLeft,
  Pencil,
  Shield,
  Target,
  TrendingUp,
  BookOpen,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useApiKey } from "@/context/ApiKeyContext";
import ModuleHelp from "@/components/ModuleHelp";
import {
  useSSE,
  type PipelineEvent,
  type ProposedChanges,
  type OriginalSection,
  type OriginalContent,
  type AuditResult,
  type ATSKeywords,
} from "@/lib/use-sse";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const PERSONAS = [
  { value: "auto", label: "Auto-detect" },
  { value: "PM", label: "Product Manager" },
  { value: "PjM", label: "Project Manager" },
  { value: "PMM", label: "Product Marketing" },
];

const VERSIONS = [
  { value: "1-Page", label: "1-Page" },
  { value: "2-Page", label: "2-Page" },
  { value: "Detailed", label: "Detailed" },
];

type WorkflowMode = "quick" | "review";

// ─── Helper: render bold markdown in text ───────────────────────────────────

function RichText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.*?)\*\*/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} style={{ color: "var(--text-primary)" }}>
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

// ─── Match Score Card (unchanged) ───────────────────────────────────────────

function MatchScoreCard({ markdown }: { markdown: string }) {
  const scoreMatch = markdown.match(/(\d{1,3})\s*\/\s*100/);
  const score = scoreMatch ? parseInt(scoreMatch[1]) : null;
  const sections = markdown.split(/^##\s+/m).filter(Boolean);
  const introSection = sections[0] || "";
  const contentSections = sections.slice(1);
  const introLines = introSection.split("\n").filter((l) => l.trim());
  const title = introLines[0]?.replace(/^#\s*/, "").trim() || "Match Score";
  const introBody = introLines.slice(1).join("\n").trim();
  const scoreColor =
    score !== null
      ? score >= 80
        ? "var(--accent-green)"
        : score >= 60
        ? "var(--accent-amber)"
        : "var(--accent-red)"
      : "var(--text-muted)";

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2.5">
          <BarChart3 size={18} className="text-[var(--accent-blue)]" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
        </div>
        {score !== null && (
          <div
            className="px-3 py-1 rounded-full text-sm font-bold"
            style={{ backgroundColor: `color-mix(in srgb, ${scoreColor} 15%, transparent)`, color: scoreColor }}
          >
            {score}/100
          </div>
        )}
      </div>
      <div className="px-5 py-4 space-y-4">
        {introBody && <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{introBody.replace(/\*\*/g, "")}</p>}
        {contentSections.map((section, i) => {
          const lines = section.split("\n").filter((l) => l.trim());
          const sTitle = lines[0]?.trim() || "";
          const sBody = lines.slice(1);
          return (
            <div key={i}>
              <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                <ChevronRight size={12} className="text-[var(--accent-blue)]" />
                {sTitle.replace(/\*\*/g, "")}
              </h4>
              <div className="space-y-1.5 pl-4">
                {sBody.map((line, j) => {
                  const t = line.trim();
                  if (!t) return null;
                  if (t.startsWith("- ") || t.startsWith("* ") || t.startsWith("• ")) {
                    return (
                      <div key={j} className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "var(--accent-blue)" }} />
                        <span><RichText text={t.replace(/^[-*•]\s*/, "")} /></span>
                      </div>
                    );
                  }
                  return <p key={j} className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}><RichText text={t} /></p>;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Score Comparison Card ──────────────────────────────────────────────────

function ScoreComparisonCard({ pre, post }: { pre: number; post: number }) {
  const improvement = post - pre;
  const preColor = pre >= 80 ? "var(--accent-green)" : pre >= 60 ? "var(--accent-amber)" : "var(--accent-red)";
  const postColor = post >= 80 ? "var(--accent-green)" : post >= 60 ? "var(--accent-amber)" : "var(--accent-red)";

  return (
    <div className="rounded-lg overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="px-5 py-3 flex items-center gap-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
        <TrendingUp size={16} className="text-[var(--accent-blue)]" />
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Score Improvement</h3>
        {improvement > 0 && (
          <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(107, 158, 107, 0.15)", color: "var(--accent-green)" }}>
            +{improvement} pts
          </span>
        )}
      </div>
      <div className="px-5 py-4 flex items-center justify-around">
        <div className="text-center">
          <p className="text-[10px] text-[var(--text-muted)] mb-1">Before</p>
          <p className="text-2xl font-bold" style={{ color: preColor }}>{pre}</p>
          <p className="text-[10px] text-[var(--text-muted)]">Template</p>
        </div>
        <div className="text-center px-4">
          <ArrowRight size={20} className="text-[var(--text-muted)]" />
        </div>
        <div className="text-center">
          <p className="text-[10px] text-[var(--text-muted)] mb-1">After</p>
          <p className="text-2xl font-bold" style={{ color: postColor }}>{post}</p>
          <p className="text-[10px] text-[var(--text-muted)]">Customized</p>
        </div>
      </div>
    </div>
  );
}

// ─── Audit Results Card ─────────────────────────────────────────────────────

function AuditCard({ audit }: { audit: AuditResult }) {
  const [expanded, setExpanded] = useState(false);
  const statusColor = audit.passed ? "var(--accent-green)" : "var(--accent-amber)";

  return (
    <div className="rounded-lg overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: `1px solid ${statusColor}` }}>
      <div
        className="px-5 py-3 flex items-center gap-2.5 cursor-pointer"
        style={{ borderBottom: expanded ? "1px solid var(--border)" : "none" }}
        onClick={() => setExpanded(!expanded)}
      >
        <Shield size={16} style={{ color: statusColor }} />
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex-1">Content Audit</h3>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `color-mix(in srgb, ${statusColor} 15%, transparent)`, color: statusColor }}>
          {audit.score}/100
        </span>
        <ChevronDown size={14} className="text-[var(--text-muted)]" style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </div>
      {expanded && (
        <div className="px-5 py-3 space-y-3">
          <p className="text-xs text-[var(--text-secondary)]">{audit.summary}</p>
          {audit.violations.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-[var(--accent-red)] mb-1.5">Violations ({audit.violations.length})</p>
              {audit.violations.map((v, i) => (
                <div key={i} className="mb-2 pl-3" style={{ borderLeft: "2px solid var(--accent-red)" }}>
                  <p className="text-[11px] text-[var(--text-primary)]"><strong>Rule {v.rule}:</strong> {v.text}</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Fix: {v.suggestion}</p>
                </div>
              ))}
            </div>
          )}
          {audit.warnings.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-[var(--accent-amber)] mb-1.5">Warnings ({audit.warnings.length})</p>
              {audit.warnings.map((w, i) => (
                <div key={i} className="mb-2 pl-3" style={{ borderLeft: "2px solid var(--accent-amber)" }}>
                  <p className="text-[11px] text-[var(--text-primary)]">{w.issue}</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{w.suggestion}</p>
                </div>
              ))}
            </div>
          )}
          {audit.passed && audit.violations.length === 0 && (
            <p className="text-xs text-[var(--accent-green)] flex items-center gap-1.5">
              <CheckCircle2 size={12} /> All 18 rules passed. Resume is clean.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ATS Keywords Card ──────────────────────────────────────────────────────

function ATSKeywordsCard({ ats }: { ats: ATSKeywords }) {
  const [expanded, setExpanded] = useState(false);
  const coverageColor = ats.coverage_pct >= 80 ? "var(--accent-green)" : ats.coverage_pct >= 60 ? "var(--accent-amber)" : "var(--accent-red)";

  return (
    <div className="rounded-lg overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div
        className="px-5 py-3 flex items-center gap-2.5 cursor-pointer"
        style={{ borderBottom: expanded ? "1px solid var(--border)" : "none" }}
        onClick={() => setExpanded(!expanded)}
      >
        <Target size={16} className="text-[var(--accent-blue)]" />
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex-1">ATS Keywords</h3>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `color-mix(in srgb, ${coverageColor} 15%, transparent)`, color: coverageColor }}>
          {ats.matched_count}/{ats.total_keywords} ({ats.coverage_pct}%)
        </span>
        <ChevronDown size={14} className="text-[var(--text-muted)]" style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </div>
      {expanded && (
        <div className="px-5 py-3 space-y-3">
          {/* Progress bar */}
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${ats.coverage_pct}%`, backgroundColor: coverageColor }} />
          </div>

          {ats.critical_missing.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-[var(--accent-red)] mb-1.5">Critical Missing Keywords</p>
              <div className="flex flex-wrap gap-1.5">
                {ats.critical_missing.map((kw, i) => (
                  <span key={i} className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: "rgba(196, 116, 116, 0.12)", color: "var(--accent-red)" }}>
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
          {ats.missing.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-[var(--accent-amber)] mb-1.5">Missing ({ats.missing.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {ats.missing.map((kw, i) => (
                  <span key={i} className="px-2 py-0.5 rounded text-[10px]" style={{ backgroundColor: "rgba(212, 167, 74, 0.1)", color: "var(--accent-amber)" }}>
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-[10px] font-semibold text-[var(--accent-green)] mb-1.5">Matched ({ats.matched.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {ats.matched.map((kw, i) => (
                <span key={i} className="px-2 py-0.5 rounded text-[10px]" style={{ backgroundColor: "rgba(107, 158, 107, 0.1)", color: "var(--accent-green)" }}>
                  {kw}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Text Display: renders a string or array of bullets ─────────────────────

function TextBlock({ text, color }: { text: string | string[]; color: string }) {
  if (typeof text === "string") {
    return (
      <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color }}>
        {text}
      </p>
    );
  }
  return (
    <div className="space-y-1">
      {text.map((line, i) => (
        <div key={i} className="flex items-start gap-2 text-xs leading-relaxed" style={{ color }}>
          <span className="text-[var(--text-muted)] shrink-0 w-4 text-right text-[10px] mt-0.5">{i + 1}.</span>
          <span>{line.replace(/^[•]\s*/, "")}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Chat Message Type ───────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  revisedText?: string | string[] | null;
  hasChanges?: boolean;
}

// ─── Section Review Card ────────────────────────────────────────────────────

function SectionReviewCard({
  section,
  proposedText,
  rationale,
  isLocked,
  onLock,
  onDiscuss,
  onRevert,
  isProcessing,
  chatMessages,
  hasOverride,
}: {
  section: OriginalSection;
  proposedText: string | string[] | null;
  rationale?: string;
  isLocked: boolean;
  onLock: () => void;
  onDiscuss: (message: string) => void;
  onRevert: () => void;
  isProcessing: boolean;
  chatMessages: ChatMessage[];
  hasOverride: boolean;
}) {
  const [expanded, setExpanded] = useState(!isLocked);
  const [showChat, setShowChat] = useState(false);
  const [inputText, setInputText] = useState("");
  const chatEndRef = useState<HTMLDivElement | null>(null);

  // Auto-scroll to bottom of chat when new messages arrive
  const scrollToBottom = useCallback(() => {
    chatEndRef[0]?.scrollIntoView({ behavior: "smooth" });
  }, [chatEndRef]);

  const prevMsgCount = useState(0);
  if (chatMessages.length !== prevMsgCount[0]) {
    prevMsgCount[1](chatMessages.length);
    setTimeout(scrollToBottom, 50);
  }

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || isProcessing) return;
    onDiscuss(text);
    setInputText("");
  };

  // Locked — compact row
  if (isLocked && !expanded) {
    return (
      <div
        className="rounded-lg px-4 py-3 flex items-center gap-3 cursor-pointer hover:opacity-90 transition-all"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--accent-green)" }}
        onClick={() => setExpanded(true)}
      >
        <Lock size={14} className="text-[var(--accent-green)] shrink-0" />
        <span className="text-xs font-medium text-[var(--text-primary)] flex-1">{section.label}</span>
        <CheckCircle2 size={14} className="text-[var(--accent-green)]" />
        <ChevronRight size={12} className="text-[var(--text-muted)]" />
      </div>
    );
  }

  // Expanded card (active or locked-but-viewing)
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ backgroundColor: "var(--bg-card)", border: `1px solid ${isLocked ? "var(--accent-green)" : "var(--border)"}` }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-2.5 cursor-pointer"
        style={{ borderBottom: "1px solid var(--border)" }}
        onClick={() => { if (isLocked) setExpanded(false); }}
      >
        {isLocked ? (
          <Lock size={14} className="text-[var(--accent-green)]" />
        ) : (
          <Pencil size={14} className="text-[var(--accent-blue)]" />
        )}
        <h4 className="text-xs font-semibold text-[var(--text-primary)] flex-1">{section.label}</h4>
        {section.header_text && (
          <span className="text-[10px] text-[var(--text-muted)] max-w-48 truncate">{section.header_text}</span>
        )}
      </div>

      {/* Rationale — shown upfront */}
      {rationale && (
        <div className="px-4 py-2.5" style={{ backgroundColor: "rgba(107, 142, 187, 0.06)", borderBottom: "1px solid var(--border)" }}>
          <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
            <span className="font-semibold text-[var(--accent-blue)]">Why: </span>
            {rationale}
          </p>
        </div>
      )}

      {/* Before / After */}
      <div className="grid grid-cols-2 gap-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="p-4" style={{ borderRight: "1px solid var(--border)" }}>
          <div className="flex items-center gap-1.5 mb-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Before</span>
          </div>
          <TextBlock text={section.current_text} color="var(--text-muted)" />
        </div>
        <div className="p-4">
          <div className="flex items-center gap-1.5 mb-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-blue)]">After</span>
          </div>
          {proposedText ? (
            <TextBlock text={proposedText} color="var(--text-secondary)" />
          ) : (
            <p className="text-xs text-[var(--text-muted)] italic">No changes proposed</p>
          )}
        </div>
      </div>

      {/* Actions + Chat */}
      {!isLocked && (
        <div className="p-4 space-y-2.5">
          <div className="flex gap-2.5">
            <button
              onClick={onLock}
              disabled={isProcessing}
              className="flex-1 py-2.5 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-all"
              style={{
                backgroundColor: "var(--accent-green)",
                color: "#fff",
                cursor: isProcessing ? "not-allowed" : "pointer",
                opacity: isProcessing ? 0.6 : 1,
              }}
            >
              <ThumbsUp size={13} />
              Lock In
            </button>
            {!showChat && (
              <button
                onClick={() => setShowChat(true)}
                disabled={isProcessing}
                className="px-4 py-2.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all hover:opacity-80"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                <MessageSquare size={13} />
                Discuss
              </button>
            )}
            {hasOverride && (
              <button
                onClick={onRevert}
                disabled={isProcessing}
                className="px-4 py-2.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all hover:opacity-80"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--accent-amber)",
                  color: "var(--accent-amber)",
                }}
              >
                <ArrowLeft size={13} />
                Revert
              </button>
            )}
          </div>

          {/* Chat panel */}
          {showChat && (
            <div
              className="rounded-lg overflow-hidden"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-secondary)" }}
            >
              <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Ask questions, request changes, or get rationale
                </span>
                <button
                  onClick={() => setShowChat(false)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] p-0.5"
                >
                  <X size={12} />
                </button>
              </div>

              {chatMessages.length > 0 && (
                <div className="max-h-64 overflow-y-auto px-3 py-2.5 space-y-2.5">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className="max-w-[85%] rounded-lg px-3 py-2"
                        style={{
                          backgroundColor: msg.role === "user" ? "var(--accent-blue)" : "var(--bg-card)",
                          color: msg.role === "user" ? "#fff" : "var(--text-secondary)",
                          border: msg.role === "assistant" ? "1px solid var(--border)" : "none",
                        }}
                      >
                        <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        {msg.hasChanges && (
                          <div className="mt-1.5 pt-1.5 flex items-center gap-1" style={{ borderTop: msg.role === "assistant" ? "1px solid var(--border)" : "1px solid rgba(255,255,255,0.2)" }}>
                            <CheckCircle2 size={10} className={msg.role === "assistant" ? "text-[var(--accent-green)]" : "text-green-300"} />
                            <span className="text-[10px]" style={{ color: msg.role === "assistant" ? "var(--accent-green)" : "rgba(255,255,255,0.8)" }}>
                              Updated the proposed text
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {isProcessing && (
                    <div className="flex justify-start">
                      <div
                        className="rounded-lg px-3 py-2 flex items-center gap-2"
                        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
                      >
                        <Loader2 size={12} className="animate-spin text-[var(--accent-blue)]" />
                        <span className="text-xs text-[var(--text-muted)]">Thinking...</span>
                      </div>
                    </div>
                  )}
                  <div ref={(el) => { chatEndRef[1](el); }} />
                </div>
              )}

              <div className="px-3 py-2.5 flex gap-2" style={{ borderTop: chatMessages.length > 0 ? "1px solid var(--border)" : "none" }}>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Ask a question or request a change..."
                  disabled={isProcessing}
                  className="flex-1 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputText.trim() || isProcessing}
                  className="px-3 py-2 rounded-lg transition-all flex items-center"
                  style={{
                    backgroundColor: inputText.trim() && !isProcessing ? "var(--accent-blue)" : "var(--border)",
                    color: inputText.trim() && !isProcessing ? "#fff" : "var(--text-muted)",
                    cursor: inputText.trim() && !isProcessing ? "pointer" : "not-allowed",
                  }}
                >
                  <Send size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Step Icon ──────────────────────────────────────────────────────────────

function StepIcon({ status }: { status?: string }) {
  if (status === "completed") return <CheckCircle2 size={16} className="text-[var(--accent-green)]" />;
  if (status === "in_progress") return <Loader2 size={16} className="text-[var(--accent-blue)] animate-spin" />;
  if (status === "warning") return <AlertCircle size={16} className="text-[var(--accent-amber)]" />;
  if (status === "error") return <AlertCircle size={16} className="text-[var(--accent-red)]" />;
  return <div className="w-4 h-4 rounded-full border border-[var(--border-light)]" />;
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ResumePage() {
  const { apiKey, isKeySet } = useApiKey();
  const searchParams = useSearchParams();
  const [jd, setJd] = useState("");
  const [jdUrl, setJdUrl] = useState("");
  const [isExtractingUrl, setIsExtractingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlPlatform, setUrlPlatform] = useState<string | null>(null);
  const [persona, setPersona] = useState("auto");
  const [version, setVersion] = useState("2-Page");
  const [mode, setMode] = useState<WorkflowMode>("review");

  // Section review state
  const [lockedSections, setLockedSections] = useState<Set<string>>(new Set());
  const [sectionOverrides, setSectionOverrides] = useState<Record<string, string | string[]>>({});
  const [chatHistories, setChatHistories] = useState<Record<string, ChatMessage[]>>({});
  const [parallelGenStarted, setParallelGenStarted] = useState(false);
  const [parallelGenStatus, setParallelGenStatus] = useState<"idle" | "running" | "done" | "failed">("idle");
  const [discussingSection, setDiscussingSection] = useState<string | null>(null);

  const sse = useSSE();

  // ── Pre-fill from URL params (Job Central → Resume Customizer bridge) ─────
  useEffect(() => {
    const urlParam = searchParams.get("jdUrl");
    const personaParam = searchParams.get("persona");
    const versionParam = searchParams.get("version");

    if (personaParam) {
      // Map shorthand from Job Central to Resume Customizer values
      const personaMap: Record<string, string> = { pm: "PM", pjm: "PjM", pmm: "PMM" };
      setPersona(personaMap[personaParam.toLowerCase()] || personaParam);
    }
    if (versionParam) {
      const versionMap: Record<string, string> = { "1pager": "1-Page", "2pager": "2-Page", detailed: "Detailed" };
      setVersion(versionMap[versionParam.toLowerCase()] || versionParam);
    }
    if (urlParam) {
      setJdUrl(urlParam);
      // Auto-trigger extraction
      (async () => {
        setIsExtractingUrl(true);
        setUrlError(null);
        try {
          const response = await fetch(`${API_URL}/api/resume/extract-url`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: urlParam }),
          });
          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || `HTTP ${response.status}`);
          }
          const data = await response.json();
          setJd(data.text);
          setUrlPlatform(data.platform);
        } catch (err: unknown) {
          setUrlError(err instanceof Error ? err.message : "Extraction failed — paste the JD text manually");
        } finally {
          setIsExtractingUrl(false);
        }
      })();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const eventMap = useMemo(() => {
    const map: Record<number, PipelineEvent> = {};
    for (const e of sse.events) map[e.step] = e;
    return map;
  }, [sse.events]);

  // Sections from proposal
  const originalSections: OriginalSection[] = useMemo(
    () => sse.proposal?.original_content?.sections || [],
    [sse.proposal]
  );

  // ── URL Extraction ──────────────────────────────────────────────────────
  const handleExtractUrl = async () => {
    if (!jdUrl.trim()) return;
    setIsExtractingUrl(true);
    setUrlError(null);
    setUrlPlatform(null);
    try {
      const response = await fetch(`${API_URL}/api/resume/extract-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: jdUrl.trim() }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || `HTTP ${response.status}`);
      }
      const data = await response.json();
      setJd(data.text);
      setUrlPlatform(data.platform);
    } catch (err: unknown) {
      setUrlError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setIsExtractingUrl(false);
    }
  };

  // ── Get proposed text for a section ─────────────────────────────────────
  const getProposedText = useCallback(
    (sectionId: string): string | string[] | null => {
      // Check overrides first (from section-level refinements)
      if (sectionOverrides[sectionId] !== undefined) return sectionOverrides[sectionId];

      const proposed = sse.proposal?.proposed_changes;
      if (!proposed) return null;

      if (sectionId === "tagline") return proposed.tagline || null;
      if (sectionId === "summary") return proposed.summary || null;
      if (sectionId === "career_highlights") return proposed.career_highlights || null;
      if (sectionId === "core_competencies") return proposed.core_competencies_priority || proposed.skills_priority || null;
      if (sectionId === "technical_competencies") {
        const tech = proposed.technical_skills_priority;
        if (!tech) return proposed.skills_priority || null;
        // If categorized dict (2-Pager/Detailed), format as "Category: tool | tool | ..."
        if (tech && !Array.isArray(tech) && typeof tech === "object") {
          return Object.entries(tech as Record<string, string[]>).map(
            ([cat, items]) => `${cat}: ${items.join(" | ")}`
          );
        }
        return tech;
      }
      // Legacy fallback for old "skills" section id
      if (sectionId === "skills") return proposed.skills_priority || null;
      if (sectionId.startsWith("exp__")) {
        const companyKey = sectionId.replace("exp__", "");
        const bullets = proposed.experience_bullets || {};
        for (const [key, val] of Object.entries(bullets)) {
          if (key.toLowerCase().includes(companyKey.toLowerCase()) || companyKey.toLowerCase().includes(key.toLowerCase())) {
            return val;
          }
        }
      }
      return null;
    },
    [sse.proposal, sectionOverrides]
  );

  // ── Get rationale for a section ─────────────────────────────────────────
  const getRationale = useCallback(
    (sectionId: string): string | undefined => {
      const proposed = sse.proposal?.proposed_changes;
      if (!proposed) return undefined;

      if (sectionId === "tagline") return proposed.tagline_rationale;
      if (sectionId === "summary") return proposed.summary_rationale;
      if (sectionId === "career_highlights") return proposed.career_highlights_rationale;
      if (sectionId === "core_competencies") return proposed.core_competencies_rationale || proposed.skills_rationale;
      if (sectionId === "technical_competencies") return proposed.technical_skills_rationale || proposed.skills_rationale;
      // Legacy fallback for old "skills" section id
      if (sectionId === "skills") return proposed.skills_rationale;
      if (sectionId.startsWith("exp__")) {
        const companyKey = sectionId.replace("exp__", "");
        const rationales = proposed.experience_rationale || {};
        for (const [key, val] of Object.entries(rationales)) {
          if (key.toLowerCase().includes(companyKey.toLowerCase()) || companyKey.toLowerCase().includes(key.toLowerCase())) {
            return val;
          }
        }
      }
      return undefined;
    },
    [sse.proposal]
  );

  // ── Section actions ─────────────────────────────────────────────────────
  const handleLockSection = async (sectionId: string) => {
    if (!sse.proposal?.job_id) return;
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey && apiKey !== "__backend__") headers["X-Claude-Key"] = apiKey;
      await fetch(`${API_URL}/api/resume/lock-section`, {
        method: "POST",
        headers,
        body: JSON.stringify({ job_id: sse.proposal.job_id, section_id: sectionId }),
      });
      setLockedSections((prev) => new Set([...prev, sectionId]));
    } catch {
      setLockedSections((prev) => new Set([...prev, sectionId]));
    }
  };

  const handleLockAll = () => {
    if (!sse.proposal?.job_id) return;
    for (const section of originalSections) {
      if (!lockedSections.has(section.id)) {
        handleLockSection(section.id);
      }
    }
  };

  const handleDiscussSection = async (sectionId: string, message: string) => {
    if (!sse.proposal?.job_id || !apiKey) return;
    setDiscussingSection(sectionId);

    // Add user message to chat history immediately
    const userMsg: ChatMessage = { role: "user", content: message };
    setChatHistories((prev) => ({
      ...prev,
      [sectionId]: [...(prev[sectionId] || []), userMsg],
    }));

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey && apiKey !== "__backend__") headers["X-Claude-Key"] = apiKey;

      const history = chatHistories[sectionId] || [];
      const response = await fetch(`${API_URL}/api/resume/discuss-section`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          job_id: sse.proposal.job_id,
          section_id: sectionId,
          message,
          conversation_history: [...history, userMsg].map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: data.message,
          hasChanges: data.has_changes,
          revisedText: data.revised_text,
        };
        setChatHistories((prev) => ({
          ...prev,
          [sectionId]: [...(prev[sectionId] || []), assistantMsg],
        }));
        // If text was revised, update the override
        if (data.has_changes && data.revised_text) {
          setSectionOverrides((prev) => ({ ...prev, [sectionId]: data.revised_text }));
        }
      }
    } catch {
      // Add error message to chat
      setChatHistories((prev) => ({
        ...prev,
        [sectionId]: [...(prev[sectionId] || []), { role: "assistant", content: "Sorry, something went wrong. Please try again." }],
      }));
    } finally {
      setDiscussingSection(null);
    }
  };

  // ── Pipeline actions ────────────────────────────────────────────────────
  const handleQuickGenerate = () => {
    if (!apiKey || !jd.trim()) return;
    sse.start(API_URL, { job_description: jd, persona, version }, apiKey);
  };

  const handleAnalyze = () => {
    if (!apiKey || !jd.trim()) return;
    setLockedSections(new Set());
    setSectionOverrides({});
    setChatHistories({});
    setParallelGenStarted(false);
    sse.startAnalysis(API_URL, { job_description: jd, persona, version }, apiKey);
  };

  // Trigger parallel doc generation when proposal arrives
  // This generates cover letter, brief, and interview questions in the background
  const triggerParallelGen = useCallback(() => {
    if (!sse.proposal?.job_id || parallelGenStarted || !apiKey) return;
    setParallelGenStarted(true);
    setParallelGenStatus("running");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey && apiKey !== "__backend__") headers["X-Claude-Key"] = apiKey;
    fetch(`${API_URL}/api/resume/parallel-generate`, {
      method: "POST",
      headers,
      body: JSON.stringify({ job_id: sse.proposal.job_id }),
    })
      .then((res) => {
        if (res.ok) {
          setParallelGenStatus("done");
        } else {
          setParallelGenStatus("failed");
        }
      })
      .catch(() => {
        setParallelGenStatus("failed");
      });
  }, [sse.proposal?.job_id, parallelGenStarted, apiKey]);

  // Auto-trigger when proposal becomes available
  if (sse.proposal?.job_id && !parallelGenStarted && apiKey) {
    triggerParallelGen();
  }

  const handleApproveAll = () => {
    if (!apiKey || !sse.proposal?.job_id) return;
    sse.startGeneration(API_URL, sse.proposal.job_id, apiKey);
  };

  const handleDownload = (filename: string) => {
    const jobId = sse.result?.job_id;
    if (!jobId) return;
    window.open(`${API_URL}/api/resume/download/${jobId}/${filename}`, "_blank");
  };

  // ── Derived state ───────────────────────────────────────────────────────
  const canGenerate = isKeySet && jd.trim().length > 50 && !sse.isRunning;
  const showProgress = sse.isRunning || sse.events.length > 0;
  const showResults = sse.result !== null;
  const showProposal = sse.proposal !== null && !showResults && !sse.isRunning;
  const allLocked = showProposal && originalSections.length > 0 && originalSections.every((s) => lockedSections.has(s.id));

  // Step labels based on current phase
  const getStepLabels = () => {
    if (showProposal || (sse.isRunning && sse.totalSteps === 6)) {
      return ["Parsing inputs", "Analyzing job description", "Selecting template", "Reading template structure", "Researching & building strategy", "Generating proposal"];
    }
    if (sse.isRunning && sse.totalSteps === 10) {
      return ["Loading approved proposal", "Applying edits to resume", "Running quality checks", "Auditing content rules", "Analyzing ATS keywords", "Generating match score", "Writing cover letter", "Compiling company brief", "Building interview questions", "Packaging deliverables"];
    }
    return ["Parsing inputs", "Analyzing job description", "Selecting template", "Reading template structure", "Generating customized content", "Applying edits to resume", "Running quality checks", "Generating match score", "Writing cover letter", "Compiling company brief", "Building interview questions", "Packaging deliverables"];
  };

  const stepLabels = getStepLabels();

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <FileText size={24} className="text-[var(--accent-green)]" />
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Resume Customizer</h1>
          <ModuleHelp moduleSlug="resume" />
          <Link href="/dashboard/help?module=resume" className="text-[var(--text-muted)] hover:text-[var(--accent-green)] transition-colors" title="Help & Documentation">
            <HelpCircle size={18} />
          </Link>
        </div>
        <p className="text-[var(--text-secondary)] text-sm">
          Paste a job description or enter a URL to generate a customized resume, match score, cover letter, company brief, and interview questions.
        </p>
      </div>

      {/* API Key Warning */}
      {!isKeySet && (
        <div className="mb-6 p-4 rounded-lg border flex items-start gap-3" style={{ backgroundColor: "rgba(212, 167, 74, 0.08)", borderColor: "var(--accent-amber)" }}>
          <Key size={18} className="text-[var(--accent-amber)] mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Claude API key required</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">Click the key icon in the sidebar or refresh the page to enter your API key.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Input + Review */}
        <div className="lg:col-span-3 space-y-5">
          {/* URL Input */}
          {!showProposal && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Job Posting URL
                <span className="text-xs text-[var(--text-muted)] font-normal ml-2">Optional — LinkedIn, Greenhouse, Lever, etc.</span>
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="url"
                    value={jdUrl}
                    onChange={(e) => { setJdUrl(e.target.value); setUrlError(null); }}
                    placeholder="https://jobs.lever.co/company/role..."
                    disabled={sse.isRunning || isExtractingUrl}
                    className="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
                    style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                    onKeyDown={(e) => { if (e.key === "Enter" && jdUrl.trim()) handleExtractUrl(); }}
                  />
                </div>
                <button
                  onClick={handleExtractUrl}
                  disabled={!jdUrl.trim() || isExtractingUrl || sse.isRunning}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all hover:opacity-80"
                  style={{
                    backgroundColor: jdUrl.trim() && !isExtractingUrl ? "var(--accent-blue)" : "var(--border)",
                    color: jdUrl.trim() && !isExtractingUrl ? "#fff" : "var(--text-muted)",
                  }}
                >
                  {isExtractingUrl ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                  {isExtractingUrl ? "Extracting..." : "Extract"}
                </button>
              </div>
              {urlError && <p className="text-xs text-[var(--accent-red)] mt-1.5 flex items-center gap-1"><AlertCircle size={12} />{urlError}</p>}
              {urlPlatform && !urlError && <p className="text-xs text-[var(--accent-green)] mt-1.5 flex items-center gap-1"><CheckCircle2 size={12} />Extracted from {urlPlatform}</p>}
            </div>
          )}

          {/* JD Input */}
          {!showProposal && (
            <>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Job Description</label>
                <textarea
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  placeholder="Paste the full job description here, or extract from a URL above..."
                  rows={14}
                  disabled={sse.isRunning}
                  className="w-full rounded-lg p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
                  style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs text-[var(--text-muted)]">
                    {jd.length > 0 ? `${jd.split(/\s+/).filter(Boolean).length} words` : "Min 50 characters"}
                  </span>
                  {jd.length > 0 && !sse.isRunning && (
                    <button onClick={() => { setJd(""); setUrlPlatform(null); }} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] flex items-center gap-1">
                      <X size={12} /> Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Options Row */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Persona</label>
                  <div className="relative">
                    <select value={persona} onChange={(e) => setPersona(e.target.value)} disabled={sse.isRunning}
                      className="w-full appearance-none rounded-lg px-3 py-2.5 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
                      style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                      {PERSONAS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Version</label>
                  <div className="relative">
                    <select value={version} onChange={(e) => setVersion(e.target.value)} disabled={sse.isRunning}
                      className="w-full appearance-none rounded-lg px-3 py-2.5 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
                      style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                      {VERSIONS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Mode</label>
                  <div className="relative">
                    <select value={mode} onChange={(e) => setMode(e.target.value as WorkflowMode)} disabled={sse.isRunning}
                      className="w-full appearance-none rounded-lg px-3 py-2.5 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
                      style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                      <option value="review">Review First</option>
                      <option value="quick">Quick Generate</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Generate / Analyze Button */}
              <button
                onClick={mode === "review" ? handleAnalyze : handleQuickGenerate}
                disabled={!canGenerate}
                className="w-full py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all"
                style={{
                  backgroundColor: canGenerate ? (mode === "review" ? "var(--accent-blue)" : "var(--accent-green)") : "var(--border)",
                  color: canGenerate ? "#fff" : "var(--text-muted)",
                  cursor: canGenerate ? "pointer" : "not-allowed",
                  opacity: canGenerate ? 1 : 0.6,
                }}
              >
                {sse.isRunning && sse.totalSteps === 6 ? (
                  <><Loader2 size={16} className="animate-spin" />Analyzing &amp; Building Strategy...</>
                ) : sse.isRunning ? (
                  <><Loader2 size={16} className="animate-spin" />Generating Documents...</>
                ) : mode === "review" ? (
                  <><Eye size={16} />Analyze &amp; Propose Changes</>
                ) : (
                  <><Play size={16} />Generate Application Package</>
                )}
              </button>
            </>
          )}

          {/* ── Section-by-Section Review ────────────────────────────────── */}
          {showProposal && originalSections.length > 0 && (
            <div className="space-y-3">
              {/* Strategy header */}
              {sse.proposal?.strategy && (
                <div className="rounded-lg p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <Eye size={14} className="text-[var(--accent-blue)]" />
                    <h4 className="text-xs font-semibold text-[var(--text-primary)]">Customization Strategy</h4>
                  </div>
                  {/* IC role indicator */}
                  {sse.proposal.is_ic_role && (
                    <div className="flex items-center gap-2 mb-2.5 px-2.5 py-1.5 rounded-md" style={{ backgroundColor: "rgba(212, 167, 74, 0.1)", border: "1px solid var(--accent-amber)" }}>
                      <AlertCircle size={12} className="text-[var(--accent-amber)] shrink-0" />
                      <span className="text-[11px] text-[var(--text-secondary)]">
                        <strong className="text-[var(--accent-amber)]">IC Role Detected</strong>
                        {sse.proposal.ic_signals && sse.proposal.ic_signals.length > 0 && (
                          <> — Signals: {sse.proposal.ic_signals.join(", ")}</>
                        )}
                        {" "}— Leadership experience reframed for hands-on execution
                      </span>
                    </div>
                  )}
                  {sse.proposal.strategy.split("\n").filter((l) => l.trim()).slice(0, 4).map((p, i) => (
                    <p key={i} className="text-xs leading-relaxed text-[var(--text-secondary)] mb-1.5">
                      {p.replace(/^#+\s*/, "").replace(/\*\*/g, "")}
                    </p>
                  ))}
                </div>
              )}

              {/* Parallel generation status */}
              {parallelGenStatus !== "idle" && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px]" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  {parallelGenStatus === "running" && (
                    <><Loader2 size={12} className="animate-spin text-[var(--accent-blue)]" /><span className="text-[var(--text-secondary)]">Generating cover letter, brief &amp; interview questions in background...</span></>
                  )}
                  {parallelGenStatus === "done" && (
                    <><CheckCircle2 size={12} className="text-[var(--accent-green)]" /><span className="text-[var(--text-secondary)]">Cover letter, brief &amp; interview questions pre-generated</span></>
                  )}
                  {parallelGenStatus === "failed" && (
                    <><AlertCircle size={12} className="text-[var(--accent-amber)]" /><span className="text-[var(--text-secondary)]">Background doc generation failed — will retry during final generation</span></>
                  )}
                </div>
              )}

              {/* Section counter + Lock All */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-[var(--text-primary)]">
                  Review Sections ({lockedSections.size}/{originalSections.length} locked)
                </h3>
                {!allLocked && lockedSections.size < originalSections.length && (
                  <button
                    onClick={handleLockAll}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all hover:opacity-80 flex items-center gap-1.5"
                    style={{ backgroundColor: "rgba(107, 158, 107, 0.15)", color: "var(--accent-green)", border: "1px solid var(--accent-green)" }}
                  >
                    <Lock size={11} />
                    Lock All
                  </button>
                )}
              </div>

              {/* Section cards — all visible */}
              {originalSections.map((section) => (
                <SectionReviewCard
                  key={section.id}
                  section={section}
                  proposedText={getProposedText(section.id)}
                  rationale={getRationale(section.id)}
                  isLocked={lockedSections.has(section.id)}
                  onLock={() => handleLockSection(section.id)}
                  onDiscuss={(msg) => handleDiscussSection(section.id, msg)}
                  onRevert={() => {
                    setSectionOverrides((prev) => {
                      const next = { ...prev };
                      delete next[section.id];
                      return next;
                    });
                  }}
                  isProcessing={discussingSection === section.id}
                  chatMessages={chatHistories[section.id] || []}
                  hasOverride={sectionOverrides[section.id] !== undefined}
                />
              ))}

              {/* Generate button — only when all locked */}
              {allLocked && (
                <button
                  onClick={handleApproveAll}
                  disabled={sse.isRunning}
                  className="w-full py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all"
                  style={{
                    backgroundColor: sse.isRunning ? "var(--border)" : "var(--accent-green)",
                    color: sse.isRunning ? "var(--text-muted)" : "#fff",
                  }}
                >
                  {sse.isRunning ? (
                    <><Loader2 size={16} className="animate-spin" />Generating Documents...</>
                  ) : (
                    <><ThumbsUp size={16} />All Sections Approved — Generate Package</>
                  )}
                </button>
              )}

              {/* Start over */}
              <button
                onClick={() => {
                  sse.reset();
                  setLockedSections(new Set());
                  setSectionOverrides({});
                  setChatHistories({});
                  setParallelGenStarted(false);
                }}
                className="w-full py-2 rounded-lg text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                style={{ border: "1px solid var(--border)" }}
              >
                <ArrowLeft size={12} className="inline mr-1" />
                Start Over
              </button>
            </div>
          )}

          {/* Results Dashboard — shown after generation completes */}
          {showResults && (
            <div className="space-y-4">
              {/* Score Comparison */}
              {sse.result?.pre_match_score !== undefined && sse.result?.post_match_score !== undefined && (
                <ScoreComparisonCard pre={sse.result.pre_match_score} post={sse.result.post_match_score} />
              )}

              {/* Content Audit */}
              {sse.result?.audit_result && <AuditCard audit={sse.result.audit_result} />}

              {/* ATS Keywords */}
              {sse.result?.ats_keywords && <ATSKeywordsCard ats={sse.result.ats_keywords} />}

              {/* Match Score & Gap Analysis (includes learning resources) */}
              {sse.result?.match_score_md && <MatchScoreCard markdown={sse.result.match_score_md} />}
            </div>
          )}

          {/* Error */}
          {sse.error && (
            <div className="p-4 rounded-lg border flex items-start gap-3" style={{ backgroundColor: "rgba(196, 116, 116, 0.08)", borderColor: "var(--accent-red)" }}>
              <AlertCircle size={16} className="text-[var(--accent-red)] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Pipeline Error</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">{sse.error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Progress + Results Panel */}
        <div className="lg:col-span-2 space-y-5">
          {/* Progress */}
          {showProgress && (
            <div className="rounded-lg p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-[var(--text-primary)]">
                  {sse.totalSteps === 6 ? "Analysis Progress" : "Pipeline Progress"}
                </h3>
                <span className="text-xs text-[var(--text-muted)]">{sse.currentStep}/{sse.totalSteps}</span>
              </div>
              <div className="h-1.5 rounded-full mb-5 overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(sse.currentStep / sse.totalSteps) * 100}%`,
                    backgroundColor: showResults ? "var(--accent-green)" : "var(--accent-blue)",
                  }}
                />
              </div>
              <div className="space-y-2.5">
                {stepLabels.map((label, idx) => {
                  const stepNum = idx + 1;
                  const event = eventMap[stepNum];
                  const isActive = sse.isRunning && sse.currentStep === stepNum;
                  return (
                    <div key={stepNum} className="flex items-center gap-2.5" style={{ opacity: event || isActive ? 1 : 0.35 }}>
                      <StepIcon status={event?.status} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs truncate" style={{ color: isActive ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: isActive ? 500 : 400 }}>
                          {label}
                        </p>
                        {event?.detail && <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">{event.detail}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Proposal review status */}
          {showProposal && (
            <div className="rounded-lg p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--accent-blue)" }}>
              <div className="flex items-center gap-2 mb-1">
                <Eye size={18} className="text-[var(--accent-blue)]" />
                <h3 className="text-sm font-medium text-[var(--text-primary)]">
                  {allLocked ? "Ready to Generate" : "Reviewing Proposal"}
                </h3>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                {sse.proposal?.role} at {sse.proposal?.company} &middot; {sse.proposal?.persona} {sse.proposal?.version}
              </p>
              {sse.proposal?.pre_match_score !== undefined && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] text-[var(--text-muted)]">Template match:</span>
                  <span className="text-xs font-bold" style={{ color: sse.proposal.pre_match_score >= 70 ? "var(--accent-green)" : sse.proposal.pre_match_score >= 50 ? "var(--accent-amber)" : "var(--accent-red)" }}>
                    {sse.proposal.pre_match_score}/100
                  </span>
                </div>
              )}
              {sse.proposal?.is_ic_role && (
                <div className="mt-2 px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center gap-1.5">
                    <Target size={10} className="text-blue-400" />
                    <span className="text-[10px] font-medium text-blue-400">IC Role Detected</span>
                  </div>
                  {sse.proposal.ic_signals && sse.proposal.ic_signals.length > 0 && (
                    <p className="text-[9px] text-[var(--text-muted)] mt-1 leading-tight">
                      {sse.proposal.ic_signals.slice(0, 2).join("; ")}
                    </p>
                  )}
                </div>
              )}
              <div className="mt-3 space-y-1.5">
                {originalSections.map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    {lockedSections.has(s.id) ? (
                      <CheckCircle2 size={12} className="text-[var(--accent-green)]" />
                    ) : (
                      <div className="w-3 h-3 rounded-full border border-[var(--border-light)]" />
                    )}
                    <span className="text-[11px] text-[var(--text-secondary)]">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {showResults && sse.result && (
            <div className="rounded-lg p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--accent-green)" }}>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 size={18} className="text-[var(--accent-green)]" />
                <h3 className="text-sm font-medium text-[var(--text-primary)]">Package Ready</h3>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mb-4">
                {sse.result.role} at {sse.result.company} &middot; {sse.result.persona} {sse.result.version}
              </p>
              <div className="space-y-2">
                {(sse.result.files || []).filter((f) => f.endsWith(".docx")).map((file) => (
                  <button key={file} onClick={() => handleDownload(file)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover:opacity-80"
                    style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                    <FileText size={14} className="text-[var(--accent-blue)] shrink-0" />
                    <span className="text-xs text-[var(--text-primary)] flex-1 truncate">{file.replace(/_/g, " ").replace(".docx", "")}</span>
                    <Download size={12} className="text-[var(--text-muted)]" />
                  </button>
                ))}
                <button onClick={() => handleDownload("Application_Package.zip")}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover:opacity-80 mt-3"
                  style={{ backgroundColor: "rgba(107, 158, 107, 0.1)", border: "1px solid var(--accent-green)" }}>
                  <Package size={14} className="text-[var(--accent-green)] shrink-0" />
                  <span className="text-xs text-[var(--text-primary)] flex-1 font-medium">Download All (ZIP)</span>
                  <Download size={12} className="text-[var(--accent-green)]" />
                </button>
              </div>
              <button
                onClick={() => { sse.reset(); setJd(""); setJdUrl(""); setUrlPlatform(null); setLockedSections(new Set()); setSectionOverrides({}); setChatHistories({}); setParallelGenStarted(false); }}
                className="w-full mt-4 py-2 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                style={{ border: "1px solid var(--border)" }}
              >
                Start New Generation
              </button>
            </div>
          )}

          {/* Empty state */}
          {!showProgress && !showProposal && (
            <div className="rounded-lg p-8 text-center" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <FileText size={32} className="mx-auto mb-3 text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-secondary)]">
                {mode === "review"
                  ? "Review mode: see before/after for each section. Lock each one in, or revise until you're happy."
                  : "Quick mode: paste a JD and generate everything in one shot."}
              </p>
              <div className="mt-4 text-xs text-[var(--text-muted)] space-y-1">
                <p>Produces 5 documents:</p>
                <p>Resume, Match Score, Cover Letter, Company Brief, Interview Questions</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
