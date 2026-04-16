"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
  Plus,
  Edit3,
  Trash2,
  Circle,
  ExternalLink,
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

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Tab = "resume" | "stories" | "frameworks";
type WorkflowMode = "quick" | "review";

// ── Interfaces ──────────────────────────────────────────────────────

interface Story {
  id: string;
  title: string;
  company: string;
  content: string;
  frameworks: string[];
  created_date: string;
}

interface ChecklistItem {
  id: string;
  task: string;
  category: string;
  done: boolean;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  revisedText?: string | string[] | null;
  hasChanges?: boolean;
}

// ── Constants ────────────────────────────────────────────────────────

const FRAMEWORKS = [
  { name: "CIRCLES", description: "Product Design Framework", steps: ["Comprehend", "Identify", "Report", "Cut", "List", "Evaluate", "Summarize"] },
  { name: "RICE", description: "Prioritization Framework", steps: ["Reach", "Impact", "Confidence", "Effort"] },
  { name: "STAR", description: "Behavioral Interview Framework", steps: ["Situation", "Task", "Action", "Result"] },
  { name: "North Star", description: "Metrics & Strategy Framework", steps: ["Define key metric", "Align team", "Track progress", "Iterate"] },
];

const COMMON_QUESTIONS = [
  { category: "Product Design", question: "Design a product for X", framework: "CIRCLES" },
  { category: "Prioritization", question: "How would you prioritize features?", framework: "RICE" },
  { category: "Leadership", question: "Tell me about a time you led a difficult project", framework: "STAR" },
  { category: "Strategy", question: "How do you measure product success?", framework: "North Star" },
  { category: "Estimation", question: "How many X are there in Y?", framework: "Fermi" },
  { category: "Technical", question: "Walk me through a system design for...", framework: "Architecture" },
];

const PRE_INTERVIEW_CHECKLIST = [
  "Research company and product",
  "Review your story bank for relevant examples",
  "Prepare questions for the interviewer",
  "Practice framework answers out loud",
  "Set up quiet space for interview",
];

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

// ── Helper Functions ────────────────────────────────────────────────

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
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (chatMessages.length > 0) {
      setTimeout(scrollToBottom, 50);
    }
  }, [chatMessages.length, scrollToBottom]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || isProcessing) return;
    onDiscuss(text);
    setInputText("");
  };

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

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ backgroundColor: "var(--bg-card)", border: `1px solid ${isLocked ? "var(--accent-green)" : "var(--border)"}` }}
    >
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

      {rationale && (
        <div className="px-4 py-2.5" style={{ backgroundColor: "rgba(107, 142, 187, 0.06)", borderBottom: "1px solid var(--border)" }}>
          <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
            <span className="font-semibold text-[var(--accent-blue)]">Why: </span>
            {rationale}
          </p>
        </div>
      )}

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
                  <div ref={chatEndRef} />
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

function PreInterviewItem({ label }: { label: string }) {
  const [checked, setChecked] = useState(false);
  return (
    <button onClick={() => setChecked(!checked)}
      className="w-full flex items-center gap-2.5 py-2 px-3 rounded-lg text-left"
      style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", opacity: checked ? 0.6 : 1 }}>
      {checked ? (
        <CheckCircle2 size={16} className="text-[var(--accent-green)] shrink-0" />
      ) : (
        <Circle size={16} className="text-[var(--text-muted)] shrink-0" />
      )}
      <span className="text-sm" style={{ color: "var(--text-secondary)", textDecoration: checked ? "line-through" : "none" }}>{label}</span>
    </button>
  );
}

function StoryModal({
  story, onSave, onClose,
}: {
  story: Story | null;
  onSave: (data: { title: string; company: string; content: string; frameworks: string[] }) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(story?.title || "");
  const [company, setCompany] = useState(story?.company || "");
  const [content, setContent] = useState(story?.content || "");
  const [frameworks, setFrameworks] = useState<string[]>(story?.frameworks || []);
  const [fwInput, setFwInput] = useState("");

  const addFw = () => {
    const val = fwInput.trim().toUpperCase();
    if (val && !frameworks.includes(val)) { setFrameworks([...frameworks, val]); setFwInput(""); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="w-full max-w-lg rounded-xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">{story ? "Edit Story" : "Add Story"}</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Story title"
            className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
            style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <div className="relative">
            <select value={company} onChange={(e) => setCompany(e.target.value)}
              className="w-full appearance-none rounded-lg px-3 py-2.5 text-sm pr-8 focus:outline-none"
              style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
              <option value="">Select Company</option>
              <option value="Wells Fargo (2023-2025) - VP Product">Wells Fargo (2023-2025) - VP Product</option>
              <option value="Avatour (2025-Present) - Consulting">Avatour (2025-Present) - Consulting</option>
              <option value="First Republic (2016-2023) - Director">First Republic (2016-2023) - Director</option>
              <option value="Wells Fargo (2012-2016) - AVP">Wells Fargo (2012-2016) - AVP</option>
              <option value="Magley &amp; Associates (2008-2012) - Consultant">Magley &amp; Associates (2008-2012) - Consultant</option>
              <option value="Other">Other</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          </div>
          <textarea value={content} onChange={(e) => setContent(e.target.value)}
            placeholder="Describe the situation, your decision, and the outcome..."
            rows={5} className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] resize-y"
            style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <div>
            <div className="flex gap-2 mb-2">
              <input value={fwInput} onChange={(e) => setFwInput(e.target.value)} placeholder="Framework (e.g., STAR, CIRCLES)"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFw(); } }}
                className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
                style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              <button type="button" onClick={addFw} className="px-3 py-2 rounded-lg text-sm"
                style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>Add</button>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {frameworks.map((fw, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded cursor-pointer"
                  onClick={() => setFrameworks(frameworks.filter((_, j) => j !== i))}
                  style={{ backgroundColor: "rgba(59,130,246,0.15)", color: "var(--accent-blue)" }}>{fw} ×</span>
              ))}
            </div>
          </div>
          <button onClick={() => { if (title.trim() && content.trim()) onSave({ title, company, content, frameworks }); }}
            disabled={!title.trim() || !content.trim()}
            className="w-full py-2.5 rounded-lg text-sm font-medium"
            style={{ backgroundColor: "var(--accent-blue)", color: "#fff", opacity: title.trim() && content.trim() ? 1 : 0.5 }}>
            {story ? "Update Story" : "Add Story"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────

export default function InterviewPrepPage() {
  const { apiKey, isKeySet } = useApiKey();
  const searchParams = useSearchParams();
  const [currentTab, setCurrentTab] = useState<Tab>("resume");

  // Resume state
  const [jd, setJd] = useState("");
  const [jdUrl, setJdUrl] = useState("");
  const [isExtractingUrl, setIsExtractingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlPlatform, setUrlPlatform] = useState<string | null>(null);
  const [persona, setPersona] = useState("auto");
  const [version, setVersion] = useState("2-Page");
  const [mode, setMode] = useState<WorkflowMode>("review");

  const [lockedSections, setLockedSections] = useState<Set<string>>(new Set());
  const [sectionOverrides, setSectionOverrides] = useState<Record<string, string | string[]>>({});
  const [chatHistories, setChatHistories] = useState<Record<string, ChatMessage[]>>({});
  const [parallelGenStarted, setParallelGenStarted] = useState(false);
  const [parallelGenStatus, setParallelGenStatus] = useState<"idle" | "running" | "done" | "failed">("idle");
  const [discussingSection, setDiscussingSection] = useState<string | null>(null);

  const sse = useSSE();

  // Stories state
  const [stories, setStories] = useState<Story[]>([]);
  const [showStoryForm, setShowStoryForm] = useState(false);
  const [editStory, setEditStory] = useState<Story | null>(null);
  const [storySearch, setStorySearch] = useState("");

  // ── Pre-fill from URL params ─────────────────────────────────────────────
  useEffect(() => {
    const urlParam = searchParams.get("jdUrl");
    const personaParam = searchParams.get("persona");
    const versionParam = searchParams.get("version");

    if (personaParam) {
      const personaMap: Record<string, string> = { pm: "PM", pjm: "PjM", pmm: "PMM" };
      setPersona(personaMap[personaParam.toLowerCase()] || personaParam);
    }
    if (versionParam) {
      const versionMap: Record<string, string> = { "1pager": "1-Page", "2pager": "2-Page", detailed: "Detailed" };
      setVersion(versionMap[versionParam.toLowerCase()] || versionParam);
    }
    if (urlParam) {
      setJdUrl(urlParam);
      (async () => {
        setIsExtractingUrl(true);
        setUrlError(null);
        try {
          const response = await fetch(`${API}/api/resume/extract-url`, {
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
  }, []);

  // Fetch stories when Stories tab becomes active
  useEffect(() => {
    if (currentTab === "stories") {
      const fetchStories = async () => {
        try {
          const params = storySearch ? `?search=${encodeURIComponent(storySearch)}` : "";
          const res = await fetch(`${API}/api/jobs/stories${params}`);
          if (res.ok) {
            const data = await res.json();
            setStories(data.stories || []);
          }
        } catch { /* offline */ }
      };
      fetchStories();
    }
  }, [currentTab, storySearch]);

  const eventMap = useMemo(() => {
    const map: Record<number, PipelineEvent> = {};
    for (const e of sse.events) map[e.step] = e;
    return map;
  }, [sse.events]);

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
      const response = await fetch(`${API}/api/resume/extract-url`, {
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
        if (tech && !Array.isArray(tech) && typeof tech === "object") {
          return Object.entries(tech as Record<string, string[]>).map(
            ([cat, items]) => `${cat}: ${items.join(" | ")}`
          );
        }
        return tech;
      }
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
      await fetch(`${API}/api/resume/lock-section`, {
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

    const userMsg: ChatMessage = { role: "user", content: message };
    setChatHistories((prev) => ({
      ...prev,
      [sectionId]: [...(prev[sectionId] || []), userMsg],
    }));

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey && apiKey !== "__backend__") headers["X-Claude-Key"] = apiKey;

      const history = chatHistories[sectionId] || [];
      const response = await fetch(`${API}/api/resume/discuss-section`, {
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
        if (data.has_changes && data.revised_text) {
          setSectionOverrides((prev) => ({ ...prev, [sectionId]: data.revised_text }));
        }
      }
    } catch {
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
    sse.start(API, { job_description: jd, persona, version }, apiKey);
  };

  const handleAnalyze = () => {
    if (!apiKey || !jd.trim()) return;
    setLockedSections(new Set());
    setSectionOverrides({});
    setChatHistories({});
    setParallelGenStarted(false);
    sse.startAnalysis(API, { job_description: jd, persona, version }, apiKey);
  };

  const triggerParallelGen = useCallback(() => {
    if (!sse.proposal?.job_id || parallelGenStarted || !apiKey) return;
    setParallelGenStarted(true);
    setParallelGenStatus("running");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey && apiKey !== "__backend__") headers["X-Claude-Key"] = apiKey;
    fetch(`${API}/api/resume/parallel-generate`, {
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

  if (sse.proposal?.job_id && !parallelGenStarted && apiKey) {
    triggerParallelGen();
  }

  const handleApproveAll = () => {
    if (!apiKey || !sse.proposal?.job_id) return;
    sse.startGeneration(API, sse.proposal.job_id, apiKey);
  };

  const handleDownload = (filename: string) => {
    const jobId = sse.result?.job_id;
    if (!jobId) return;
    window.open(`${API}/api/resume/download/${jobId}/${filename}`, "_blank");
  };

  // ── Stories handlers ────────────────────────────────────────────────────
  const handleSaveStory = async (data: { title: string; company: string; content: string; frameworks: string[] }) => {
    try {
      if (editStory) {
        await fetch(`${API}/api/jobs/stories/${editStory.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      } else {
        await fetch(`${API}/api/jobs/stories`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      }
      setShowStoryForm(false);
      setEditStory(null);
      // Refetch stories
      const res = await fetch(`${API}/api/jobs/stories`);
      if (res.ok) {
        const d = await res.json();
        setStories(d.stories || []);
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteStory = async (id: string) => {
    try {
      await fetch(`${API}/api/jobs/stories/${id}`, { method: "DELETE" });
      const res = await fetch(`${API}/api/jobs/stories`);
      if (res.ok) {
        const d = await res.json();
        setStories(d.stories || []);
      }
    } catch (e) { console.error(e); }
  };

  // ── Derived state ───────────────────────────────────────────────────────
  const canGenerate = isKeySet && jd.trim().length > 50 && !sse.isRunning;
  const showProgress = sse.isRunning || sse.events.length > 0;
  const showResults = sse.result !== null;
  const showProposal = sse.proposal !== null && !showResults && !sse.isRunning;
  const allLocked = showProposal && originalSections.length > 0 && originalSections.every((s) => lockedSections.has(s.id));

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
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Target size={24} className="text-[#a78bfa]" />
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Interview Prep</h1>
          <ModuleHelp moduleSlug="interview-prep" />
          <Link href="/dashboard/help?module=interview-prep" className="text-[var(--text-muted)] hover:text-[#a78bfa] transition-colors" title="Help & Documentation">
            <HelpCircle size={18} />
          </Link>
        </div>
        <p className="text-[var(--text-secondary)] text-sm">
          Customize your resume, build your story bank, and master interview frameworks in one unified space.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg flex-wrap" style={{ backgroundColor: "var(--bg-secondary)" }}>
        {([
          { key: "resume" as Tab, label: "Resume", icon: FileText },
          { key: "stories" as Tab, label: "Stories", icon: BookOpen },
          { key: "frameworks" as Tab, label: "Frameworks", icon: Target },
        ]).map((t) => (
          <button key={t.key} onClick={() => setCurrentTab(t.key)}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all min-w-[100px]"
            style={{
              backgroundColor: currentTab === t.key ? "var(--bg-card)" : "transparent",
              color: currentTab === t.key ? "var(--text-primary)" : "var(--text-muted)",
              borderBottom: currentTab === t.key ? "2px solid #a78bfa" : "none",
              border: currentTab === t.key ? "1px solid var(--border)" : "1px solid transparent",
            }}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════ RESUME TAB ═════════════════════════════════ */}
      {currentTab === "resume" && (
        <div>
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
            <div className="lg:col-span-3 space-y-5">
              {!showProposal && (
                <>
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

              {showProposal && originalSections.length > 0 && (
                <div className="space-y-3">
                  {sse.proposal?.strategy && (
                    <div className="rounded-lg p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                      <div className="flex items-center gap-2 mb-2.5">
                        <Eye size={14} className="text-[var(--accent-blue)]" />
                        <h4 className="text-xs font-semibold text-[var(--text-primary)]">Customization Strategy</h4>
                      </div>
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

                  {allLocked && (
                    <button
                      onClick={handleApproveAll}
                      disabled={sse.isRunning}
                      className="w-full py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all"
                      style={{
                        backgroundColor: sse.isRunning ? "var(--border)" : "var(--accent-green)",
                        color: sse.isRunning ? "var(--text-muted)" : "#fff",
                        opacity: sse.isRunning ? 0.6 : 1,
                        cursor: sse.isRunning ? "not-allowed" : "pointer",
                      }}
                    >
                      {sse.isRunning ? (
                        <><Loader2 size={16} className="animate-spin" />Generating Documents...</>
                      ) : (
                        <><Package size={16} />Generate Full Application Package</>
                      )}
                    </button>
                  )}
                </div>
              )}

              {showProgress && (
                <div className="space-y-3">
                  <div className="rounded-lg p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                    <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">Generation Progress</h4>
                    <div className="space-y-2">
                      {stepLabels.map((label, idx) => {
                        const event = eventMap[idx];
                        const isCompleted = event?.status === "completed";
                        const isError = event?.status === "error";
                        const isActive = !isCompleted && !isError && event?.status === "in_progress";
                        return (
                          <div key={idx} className="flex items-center gap-3">
                            {isCompleted ? (
                              <CheckCircle2 size={16} className="text-[var(--accent-green)]" />
                            ) : isError ? (
                              <AlertCircle size={16} className="text-[var(--accent-red)]" />
                            ) : isActive ? (
                              <Loader2 size={16} className="animate-spin text-[var(--accent-blue)]" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-[var(--border)]" />
                            )}
                            <span className="text-xs" style={{ color: isCompleted ? "var(--accent-green)" : isError ? "var(--accent-red)" : isActive ? "var(--accent-blue)" : "var(--text-muted)" }}>
                              {label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {showResults && sse.result && (
                <div className="space-y-5">
                  <div className="rounded-lg p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", borderLeft: "4px solid var(--accent-green)" }}>
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 size={18} className="text-[var(--accent-green)]" />
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">All Documents Ready!</h3>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mb-4">Your customized application package is complete.</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleDownload("resume.pdf")}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
                        style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                      >
                        <Download size={12} /> Resume PDF
                      </button>
                      <button
                        onClick={() => handleDownload("cover_letter.docx")}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
                        style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                      >
                        <Download size={12} /> Cover Letter
                      </button>
                      <button
                        onClick={() => handleDownload("company_brief.docx")}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
                        style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                      >
                        <Download size={12} /> Company Brief
                      </button>
                      <button
                        onClick={() => handleDownload("interview_questions.docx")}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
                        style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                      >
                        <Download size={12} /> Interview Q&A
                      </button>
                    </div>
                  </div>

                  {sse.result.audit && <AuditCard audit={sse.result.audit} />}
                  {sse.result.ats_keywords && <ATSKeywordsCard ats={sse.result.ats_keywords} />}
                  {sse.result.match_score && <MatchScoreCard markdown={sse.result.match_score} />}
                  {sse.result.score_before !== undefined && sse.result.score_after !== undefined && (
                    <ScoreComparisonCard pre={sse.result.score_before} post={sse.result.score_after} />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ STORIES TAB ═════════════════════════════════ */}
      {currentTab === "stories" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">Story Bank ({stories.length} stories)</h3>
            <button onClick={() => { setEditStory(null); setShowStoryForm(true); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}>
              <Plus size={14} /> Add Story
            </button>
          </div>

          <div className="relative mb-4">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input value={storySearch} onChange={(e) => setStorySearch(e.target.value)}
              placeholder="Search stories by title, content, or framework..."
              className="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
              style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          </div>

          {stories.length === 0 ? (
            <div className="rounded-lg p-8 text-center" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <BookOpen size={28} className="mx-auto mb-2 text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-secondary)]">No stories yet. Start adding your experiences!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stories.map((story) => (
                <div key={story.id} className="rounded-lg p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{story.title}</p>
                      <p className="text-xs text-[var(--text-muted)]">{story.company}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => { setEditStory(story); setShowStoryForm(true); }}
                        className="text-[var(--text-muted)] hover:text-[var(--accent-blue)] p-1"><Edit3 size={14} /></button>
                      <button onClick={() => handleDeleteStory(story.id)}
                        className="text-[var(--text-muted)] hover:text-[var(--accent-red)] p-1"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] mb-2 line-clamp-3">{story.content}</p>
                  {story.frameworks && story.frameworks.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {story.frameworks.map((fw, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded"
                          style={{ backgroundColor: "rgba(59,130,246,0.15)", color: "var(--accent-blue)" }}>{fw}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {showStoryForm && (
            <StoryModal story={editStory}
              onSave={handleSaveStory}
              onClose={() => { setShowStoryForm(false); setEditStory(null); }} />
          )}
        </div>
      )}

      {/* ═══════════════ FRAMEWORKS TAB ═════════════════════════════ */}
      {currentTab === "frameworks" && (
        <div className="space-y-5">
          <div className="rounded-lg p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">Framework Quick Reference</h3>
            <div className="space-y-3">
              {FRAMEWORKS.map((fw, idx) => (
                <div key={idx} className="rounded-lg p-3" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{fw.name}</p>
                  <p className="text-xs text-[var(--text-muted)] mb-2">{fw.description}</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {fw.steps.map((step, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded"
                        style={{ backgroundColor: "rgba(59,130,246,0.15)", color: "var(--accent-blue)" }}>{step}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">Common PM Interview Questions</h3>
            <div className="space-y-2">
              {COMMON_QUESTIONS.map((q, idx) => (
                <div key={idx} className="flex items-center gap-3 rounded-lg p-3"
                  style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                  <span className="text-xs px-2 py-0.5 rounded shrink-0"
                    style={{ backgroundColor: "rgba(234,179,8,0.15)", color: "var(--accent-amber)" }}>{q.category}</span>
                  <p className="text-sm text-[var(--text-secondary)] flex-1">{q.question}</p>
                  <span className="text-xs px-2 py-0.5 rounded shrink-0"
                    style={{ backgroundColor: "rgba(59,130,246,0.15)", color: "var(--accent-blue)" }}>{q.framework}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">Pre-Interview Checklist</h3>
            <div className="space-y-2">
              {PRE_INTERVIEW_CHECKLIST.map((item, idx) => (
                <PreInterviewItem key={idx} label={item} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
