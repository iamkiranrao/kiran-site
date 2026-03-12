"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Bot,
  Brain,
  MessageSquare,
  CheckCircle2,
  SkipForward,
  Edit3,
  Trash2,
  Search,
  ArrowLeft,
  Loader2,
  Plus,
  ChevronRight,
  Sparkles,
  BookOpen,
  Filter,
  Save,
  X,
  HelpCircle,
  Library,
  Users,
  Layers,
  Eye,
  ChevronDown,
  Star,
  User,
  PenLine,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { useApiKey } from "@/context/ApiKeyContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type View = "home" | "interview" | "data" | "question-bank" | "manual-input";

// ── API helpers ──────────────────────────────────────────────────────

async function fetchApi(path: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}/api/fenix${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

// ── Sub-components ───────────────────────────────────────────────────

function CategoryTag({ category }: { category: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    professional: { bg: "rgba(59,130,246,0.15)", color: "#3b82f6" },
    technical: { bg: "rgba(16,185,129,0.15)", color: "#10b981" },
    personal: { bg: "rgba(251,146,60,0.15)", color: "#fb923c" },
    working_style: { bg: "rgba(167,139,250,0.15)", color: "#a78bfa" },
    industry_views: { bg: "rgba(244,63,94,0.15)", color: "#f43f5e" },
    site_specific: { bg: "rgba(14,165,233,0.15)", color: "#0ea5e9" },
    career_story: { bg: "rgba(245,158,11,0.15)", color: "#f59e0b" },
    product_craft: { bg: "rgba(34,197,94,0.15)", color: "#22c55e" },
    opinions: { bg: "rgba(239,68,68,0.15)", color: "#ef4444" },
    fun: { bg: "rgba(236,72,153,0.15)", color: "#ec4899" },
  };
  const s = colors[category] || { bg: "rgba(148,163,184,0.15)", color: "#94a3b8" };
  const label = category.replace(/_/g, " ");
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {label}
    </span>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-[var(--border)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: "#fb923c" }}
        />
      </div>
      <span className="text-xs font-mono text-[var(--text-muted)] whitespace-nowrap">
        {current}/{total}
      </span>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────

export default function FenixTrainingPage() {
  const { apiKey } = useApiKey();
  const [view, setView] = useState<View>("home");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Session state
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [currentQ, setCurrentQ] = useState<any>(null);

  // Answer flow
  const [answerText, setAnswerText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editorialResult, setEditorialResult] = useState<any>(null);
  const [editingPairs, setEditingPairs] = useState<any[] | null>(null);

  // Draft generation flow (new)
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftData, setDraftData] = useState<any>(null);
  const [draftEditText, setDraftEditText] = useState("");
  const [draftQuestionText, setDraftQuestionText] = useState("");

  // Data browser
  const [trainingEntries, setTrainingEntries] = useState<any[]>([]);
  const [dataTotal, setDataTotal] = useState(0);
  const [dataSearch, setDataSearch] = useState("");
  const [dataCategory, setDataCategory] = useState("");
  const [dataOffset, setDataOffset] = useState(0);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);

  // Question bank state
  const [qbMeta, setQbMeta] = useState<any>(null);
  const [qbQuestions, setQbQuestions] = useState<any[]>([]);
  const [qbTotal, setQbTotal] = useState(0);
  const [qbPersona, setQbPersona] = useState("");
  const [qbDimension, setQbDimension] = useState("");
  const [qbOffset, setQbOffset] = useState(0);
  const [qbActiveQuestion, setQbActiveQuestion] = useState<any>(null);
  const [qbGenerating, setQbGenerating] = useState(false);
  const [qbGenerated, setQbGenerated] = useState<any>(null);
  const [qbDraftText, setQbDraftText] = useState("");
  const [qbQuestionText, setQbQuestionText] = useState("");
  const [qbSaving, setQbSaving] = useState(false);
  const [qbSaved, setQbSaved] = useState<Set<string>>(new Set());

  // Manual input state
  const [manualQuestion, setManualQuestion] = useState("");
  const [manualAnswer, setManualAnswer] = useState("");
  const [manualCategory, setManualCategory] = useState("manual");
  const [manualSaving, setManualSaving] = useState(false);
  const [manualSaved, setManualSaved] = useState(false);

  // Production Ready / Polish state
  const [prLoading, setPrLoading] = useState(false);
  const [prChanges, setPrChanges] = useState<any[]>([]);
  const [polished, setPolished] = useState(false); // tracks if polish step has been done

  const answerRef = useRef<HTMLTextAreaElement>(null);
  const cardStyle = {
    backgroundColor: "var(--bg-card)",
    border: "1px solid var(--border)",
  };

  // ── Load sessions ─────────────────────────────────────────────────

  const loadSessions = useCallback(async () => {
    try {
      const data = await fetchApi("/training/sessions");
      setSessions(data.sessions || []);
    } catch {
      // Backend might not be running
    }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const data = await fetchApi("/training/categories");
      setCategories(data.categories || []);
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    loadSessions();
    loadCategories();
  }, [loadSessions, loadCategories]);

  // ── Start a new session ───────────────────────────────────────────

  const startNewSession = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey && apiKey !== "__backend__") headers["X-Claude-Key"] = apiKey;

      const session = await fetchApi("/training/start", {
        method: "POST",
        headers,
      });
      setActiveSessionId(session.session_id);
      await loadCurrentQuestion(session.session_id);
      setView("interview");
      loadSessions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start training session");
    }
    setLoading(false);
  };

  // ── Resume a session ──────────────────────────────────────────────

  const resumeSession = async (sessionId: string) => {
    setLoading(true);
    setError(null);
    setActiveSessionId(sessionId);
    await loadCurrentQuestion(sessionId);
    setView("interview");
    setLoading(false);
  };

  // ── Load current question ─────────────────────────────────────────

  const loadCurrentQuestion = async (sessionId: string) => {
    try {
      const q = await fetchApi(`/training/sessions/${sessionId}/current`);
      setCurrentQ(q);
      setAnswerText("");
      setEditorialResult(null);
      setEditingPairs(null);
      setDraftData(null);
      setDraftEditText("");
      setDraftQuestionText("");
      // Auto-generate draft for the current question
      if (q && !q.done) {
        generateDraft(sessionId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load question");
    }
  };

  // ── Generate draft answer ───────────────────────────────────────

  const generateDraft = async (sessionId: string, regenerate: boolean = false) => {
    setDraftLoading(true);
    setDraftData(null);
    setPrChanges([]);
    setPolished(false);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (apiKey && apiKey !== "__backend__") headers["X-Claude-Key"] = apiKey;
      const regen = regenerate ? "?regenerate=true" : "";
      const data = await fetchApi(`/training/sessions/${sessionId}/generate-draft${regen}`, { headers });
      setDraftData(data);
      setDraftEditText(data.draft_answer || "");
      setDraftQuestionText(data.question || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate draft");
    }
    setDraftLoading(false);
  };

  // ── Submit answer (legacy — kept for backward compat) ─────────

  const submitAnswer = async () => {
    if (!activeSessionId || !answerText.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey && apiKey !== "__backend__") headers["X-Claude-Key"] = apiKey;

      const result = await fetchApi(`/training/sessions/${activeSessionId}/answer`, {
        method: "POST",
        headers,
        body: JSON.stringify({ answer: answerText }),
      });
      setEditorialResult(result);
      setEditingPairs(result.polished_pairs?.map((p: any) => ({ ...p })) || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit answer");
    }
    setSubmitting(false);
  };

  // ── Approve ───────────────────────────────────────────────────────

  const approveAnswer = async () => {
    if (!activeSessionId) return;
    setSubmitting(true);
    setError(null);
    try {
      // Use draft edit text if we're in draft mode, otherwise use editorial pairs
      const pairs = draftData
        ? [{ question: draftQuestionText, answer: draftEditText, needs_review: false }]
        : editingPairs;
      await fetchApi(`/training/sessions/${activeSessionId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edited_pairs: pairs }),
      });
      // Load next question
      await loadCurrentQuestion(activeSessionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve");
    }
    setSubmitting(false);
  };

  // ── Skip ──────────────────────────────────────────────────────────

  const skipCurrentQuestion = async () => {
    if (!activeSessionId) return;
    setSubmitting(true);
    try {
      await fetchApi(`/training/sessions/${activeSessionId}/skip`, {
        method: "POST",
      });
      await loadCurrentQuestion(activeSessionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to skip");
    }
    setSubmitting(false);
  };

  // ── Data browser ──────────────────────────────────────────────────

  const loadTrainingData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dataSearch) params.set("search", dataSearch);
      if (dataCategory) params.set("category", dataCategory);
      params.set("limit", "50");
      params.set("offset", String(dataOffset));
      const data = await fetchApi(`/training/data?${params}`);
      setTrainingEntries(data.entries || []);
      setDataTotal(data.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load training data");
    }
    setLoading(false);
  }, [dataSearch, dataCategory, dataOffset]);

  useEffect(() => {
    if (view === "data") loadTrainingData();
  }, [view, loadTrainingData]);

  const saveEditedEntry = async () => {
    if (!editingEntry) return;
    try {
      await fetchApi(`/training/data/${editingEntry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: editingEntry.question,
          answer: editingEntry.answer,
          category: editingEntry.category,
        }),
      });
      setEditingEntry(null);
      loadTrainingData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    }
  };

  const deleteEntry = async (id: string) => {
    if (!confirm("Delete this training entry permanently? Fenix will no longer have access to this knowledge.")) return;
    try {
      await fetchApi(`/training/data/${id}`, { method: "DELETE" });
      loadTrainingData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  // ── Question bank helpers ──────────────────────────────────────────

  const loadQbMeta = useCallback(async () => {
    try {
      const data = await fetchApi("/training/question-bank/meta");
      setQbMeta(data);
    } catch {
      // Backend might not be running
    }
  }, []);

  const loadQbQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (qbPersona) params.set("persona", qbPersona);
      if (qbDimension) params.set("dimension", qbDimension);
      params.set("limit", "50");
      params.set("offset", String(qbOffset));
      const data = await fetchApi(`/training/question-bank?${params}`);
      setQbQuestions(data.questions || []);
      setQbTotal(data.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load questions");
    }
    setLoading(false);
  }, [qbPersona, qbDimension, qbOffset]);

  useEffect(() => {
    if (view === "question-bank") {
      if (!qbMeta) loadQbMeta();
      loadQbQuestions();
    }
  }, [view, loadQbQuestions, loadQbMeta, qbMeta]);

  const generateQbAnswer = async (question: any) => {
    setQbActiveQuestion(question);
    setQbGenerated(null);
    setQbGenerating(true);
    setPrChanges([]);
    setPolished(false);
    setQbDraftText("");
    setQbQuestionText(question.question);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (apiKey && apiKey !== "__backend__") headers["X-Claude-Key"] = apiKey;
      const data = await fetchApi(`/training/question-bank/${question.id}/generate`, { headers });
      setQbGenerated(data);
      setQbDraftText(data.customized_draft?.text || "");
      setQbQuestionText(data.question?.question || question.question);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate answer");
    }
    setQbGenerating(false);
  };

  const approveQbAnswer = async () => {
    if (!qbActiveQuestion || !qbDraftText.trim()) return;
    setQbSaving(true);
    setError(null);
    try {
      await fetchApi(`/training/question-bank/${qbActiveQuestion.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_text: qbQuestionText,
          answer_text: qbDraftText,
        }),
      });
      setQbSaved((prev) => { const next = new Set(prev); next.add(qbActiveQuestion.id); return next; });
      // Reset to question list and reload to remove answered question
      setQbActiveQuestion(null);
      setQbGenerated(null);
      setQbDraftText("");
      loadQbQuestions();
      loadQbMeta();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save answer");
    }
    setQbSaving(false);
  };

  // ── Manual input helpers ──────────────────────────────────────────

  const submitManualEntry = async () => {
    if (!manualQuestion.trim() || !manualAnswer.trim()) return;
    setManualSaving(true);
    setManualSaved(false);
    setError(null);
    try {
      await fetchApi("/training/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: manualQuestion,
          answer: manualAnswer,
          category: manualCategory,
        }),
      });
      setManualSaved(true);
      setManualQuestion("");
      setManualAnswer("");
      setManualCategory("manual");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save entry");
    }
    setManualSaving(false);
  };

  // ── Production Ready helper ──────────────────────────────────────

  const makeProductionReady = async (
    question: string,
    answer: string,
    setQuestion: (q: string) => void,
    setAnswer: (a: string) => void,
  ) => {
    if (!question.trim() || !answer.trim()) return;
    setPrLoading(true);
    setPrChanges([]);
    setError(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey && apiKey !== "__backend__") headers["X-Claude-Key"] = apiKey;
      const result = await fetchApi("/training/production-ready", {
        method: "POST",
        headers,
        body: JSON.stringify({ question, answer }),
      });
      if (result.question) setQuestion(result.question);
      if (result.answer) setAnswer(result.answer);
      setPrChanges(result.changes || []);
      setPolished(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to polish answer");
    }
    setPrLoading(false);
  };

  // Persona/dimension color helpers
  const personaColors: Record<string, string> = {
    evaluator: "#4285F4",
    peer: "#FB8C00",
    learner: "#34A853",
    collaborator: "#AB47BC",
    explorer: "#F9A825",
    inner_circle: "#E53935",
  };

  const dimensionColors: Record<string, string> = {
    origin_context: "#64B5F6",
    capability_craft: "#81C784",
    process_mind: "#FFB74D",
    values_principles: "#E57373",
    opinions_worldview: "#BA68C8",
    relational_style: "#4DD0E1",
    taste_sensibility: "#F06292",
    aspiration_drive: "#AED581",
    failure_growth: "#FF8A65",
    texture_humanity: "#9575CD",
  };

  // ── Render: Home view ─────────────────────────────────────────────

  if (view === "home") {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <Link
            href="/dashboard/fenix"
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <Brain size={24} style={{ color: "#fb923c" }} />
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Train Fenix
          </h1>
        </div>
        <p className="text-[var(--text-secondary)] text-sm mb-8 ml-12">
          Teach Fenix things that aren&apos;t on your website — opinions, personality, working style.
        </p>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-between">
            <span className="text-red-400 text-sm">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 text-xs font-medium">
              Dismiss
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => setView("question-bank")}
            className="rounded-lg p-6 text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{
              ...cardStyle,
              borderColor: "rgba(168,85,247,0.3)",
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "rgba(168,85,247,0.15)" }}
              >
                <Library size={20} style={{ color: "#a855f7" }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Question Bank
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  319 research-backed questions
                </p>
              </div>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Browse by persona or dimension. See example answers, customize, and approve — all powered by AI.
            </p>
          </button>

          <button
            onClick={startNewSession}
            disabled={loading}
            className="rounded-lg p-6 text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={cardStyle}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "rgba(251,146,60,0.15)" }}
              >
                {loading ? (
                  <Loader2 size={20} className="animate-spin" style={{ color: "#fb923c" }} />
                ) : (
                  <Plus size={20} style={{ color: "#fb923c" }} />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Free-form Session
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  100 AI-generated questions
                </p>
              </div>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Claude generates interview questions. Answer at your own pace — pick up where you left off.
            </p>
          </button>

          <button
            onClick={() => setView("data")}
            className="rounded-lg p-6 text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={cardStyle}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "rgba(16,185,129,0.15)" }}
              >
                <BookOpen size={20} style={{ color: "#10b981" }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Browse Training Data
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  View, edit, and manage all entries
                </p>
              </div>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Search and filter everything Fenix has learned from training. Edit or remove entries.
            </p>
          </button>

          <button
            onClick={() => { setView("manual-input"); setManualSaved(false); setPrChanges([]); }}
            className="rounded-lg p-6 text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{
              ...cardStyle,
              borderColor: "rgba(45,212,191,0.3)",
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "rgba(45,212,191,0.15)" }}
              >
                <PenLine size={20} style={{ color: "#2dd4bf" }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Manual Input
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Add a Q&A directly
                </p>
              </div>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Enter a question and answer pair yourself and submit it straight to Fenix&apos;s training data.
            </p>
          </button>
        </div>

        {/* Existing sessions */}
        {sessions.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-[var(--text-primary)] mb-3">
              Training Sessions
            </h2>
            <div className="space-y-2">
              {sessions.map((s) => {
                const answered = s.stats.approved + s.stats.skipped;
                const total = s.stats.total;
                return (
                  <button
                    key={s.session_id}
                    onClick={() => resumeSession(s.session_id)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors hover:opacity-90"
                    style={cardStyle}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                          Session {s.session_id}
                        </span>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{
                            backgroundColor:
                              answered >= total
                                ? "rgba(16,185,129,0.15)"
                                : "rgba(251,146,60,0.15)",
                            color: answered >= total ? "#10b981" : "#fb923c",
                          }}
                        >
                          {answered >= total ? "Complete" : "In Progress"}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                        <span>{new Date(s.created_at).toLocaleDateString()}</span>
                        <span>{s.stats.approved} approved</span>
                        <span>{s.stats.skipped} skipped</span>
                        <span>{s.stats.saved} saved to Fenix</span>
                      </div>
                      <div className="mt-2 max-w-xs">
                        <ProgressBar current={answered} total={total} />
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-[var(--text-muted)] shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Render: Interview view ────────────────────────────────────────

  if (view === "interview") {
    const isDone = currentQ?.done;
    const stats = currentQ?.stats;

    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setView("home");
                setActiveSessionId(null);
                setCurrentQ(null);
                setEditorialResult(null);
                loadSessions();
              }}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <Brain size={22} style={{ color: "#fb923c" }} />
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">
              Training Interview
            </h1>
          </div>
          {stats && (
            <div className="text-xs text-[var(--text-muted)]">
              {stats.approved} approved · {stats.skipped} skipped · {stats.saved} saved
            </div>
          )}
        </div>

        {/* Progress */}
        {currentQ && !isDone && (
          <div className="mb-6">
            <ProgressBar
              current={currentQ.index}
              total={currentQ.total}
            />
            <div className="flex items-center justify-between mt-2">
              <CategoryTag category={currentQ.category_id} />
              <span className="text-xs text-[var(--text-muted)]">
                Question {currentQ.index + 1} of {currentQ.total}
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-between">
            <span className="text-red-400 text-sm">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 text-xs font-medium">
              Dismiss
            </button>
          </div>
        )}

        {/* Done state */}
        {isDone && (
          <div className="text-center py-16">
            <CheckCircle2 size={48} className="mx-auto mb-4" style={{ color: "#10b981" }} />
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
              All done!
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              You&apos;ve completed all questions in this session.
              {stats && ` ${stats.saved} entries saved to Fenix's knowledge base.`}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  setView("home");
                  loadSessions();
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ backgroundColor: "rgba(251,146,60,0.15)", color: "#fb923c" }}
              >
                Back to Training Home
              </button>
              <button
                onClick={() => setView("data")}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ backgroundColor: "rgba(16,185,129,0.15)", color: "#10b981" }}
              >
                Browse Training Data
              </button>
            </div>
          </div>
        )}

        {/* Question + Draft Answer flow */}
        {currentQ && !isDone && (
          <div className="space-y-4">
            {/* The question */}
            <div
              className="rounded-lg p-5"
              style={{
                ...cardStyle,
                borderLeftWidth: "3px",
                borderLeftColor: "#fb923c",
              }}
            >
              <div className="flex items-start gap-3">
                <Sparkles size={18} className="shrink-0 mt-0.5" style={{ color: "#fb923c" }} />
                <p className="text-[var(--text-primary)] text-sm leading-relaxed">
                  {currentQ.question}
                </p>
              </div>
            </div>

            {/* Loading draft */}
            {draftLoading && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 size={24} className="animate-spin" style={{ color: "#fb923c" }} />
                <p className="text-sm text-[var(--text-muted)]">
                  Drafting an answer for you to customize...
                </p>
              </div>
            )}

            {/* Draft answer (editable) */}
            {draftData && !draftLoading && (
              <div className="space-y-4">
                <div
                  className="rounded-lg p-5"
                  style={{
                    ...cardStyle,
                    borderLeftWidth: "3px",
                    borderLeftColor: "#10b981",
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Bot size={15} style={{ color: "#10b981" }} />
                    <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                      Draft — 2-3 sentences + follow-up prompt
                    </p>
                  </div>
                  <div className="mb-3">
                    <label className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                      Question (editable)
                    </label>
                    <input
                      type="text"
                      value={draftQuestionText}
                      onChange={(e) => setDraftQuestionText(e.target.value)}
                      className="w-full mt-1 bg-[var(--bg-secondary)] text-sm text-[var(--text-primary)] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#10b981]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                      Answer (edit to customize)
                    </label>
                    <textarea
                      ref={answerRef}
                      value={draftEditText}
                      onChange={(e) => setDraftEditText(e.target.value)}
                      className="w-full mt-1 bg-[var(--bg-secondary)] text-sm text-[var(--text-primary)] rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#10b981] resize-none min-h-[120px] leading-relaxed"
                    />
                  </div>
                  {draftData.placeholders && draftData.placeholders.length > 0 && (
                    <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                      <HelpCircle size={13} className="mt-0.5 shrink-0" style={{ color: "#f59e0b" }} />
                      <p className="text-xs text-amber-400">
                        Fill in: {draftData.placeholders.join(", ")}
                      </p>
                    </div>
                  )}
                </div>

                {/* Production Ready changes */}
                {prChanges.length > 0 && (
                  <div className="rounded-lg p-4 mt-2" style={{ backgroundColor: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)" }}>
                    <p className="text-[10px] font-medium text-[#a855f7] uppercase tracking-wider mb-2">
                      Changes applied ({prChanges.length})
                    </p>
                    <div className="space-y-1">
                      {prChanges.map((c: any, i: number) => (
                        <div key={i} className="text-xs text-[var(--text-secondary)]">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium mr-1.5"
                            style={{ backgroundColor: "rgba(168,85,247,0.12)", color: "#a855f7" }}>
                            {c.type}
                          </span>
                          {c.original && <span className="line-through text-[var(--text-muted)] mr-1">{c.original}</span>}
                          {c.replacement && <span>→ {c.replacement}</span>}
                          {c.description && <span>{c.description}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action buttons — two-step flow: Polish → Approve */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setPolished(false); setPrChanges([]); activeSessionId && generateDraft(activeSessionId, true); }}
                      disabled={draftLoading}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                    >
                      <Sparkles size={13} /> Regenerate
                    </button>
                    <button
                      onClick={skipCurrentQuestion}
                      disabled={submitting}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                    >
                      <SkipForward size={13} /> Skip
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    {!polished ? (
                      <button
                        onClick={() => makeProductionReady(draftQuestionText, draftEditText, setDraftQuestionText, setDraftEditText)}
                        disabled={prLoading || !draftEditText.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
                        style={{ backgroundColor: "rgba(168,85,247,0.15)", color: "#a855f7" }}
                      >
                        {prLoading ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                        Polish My Answer
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => makeProductionReady(draftQuestionText, draftEditText, setDraftQuestionText, setDraftEditText)}
                          disabled={prLoading}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                        >
                          {prLoading ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                          Re-polish
                        </button>
                        <button
                          onClick={approveAnswer}
                          disabled={submitting || !draftEditText.trim()}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
                          style={{ backgroundColor: "#10b981", color: "white" }}
                        >
                          {submitting ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={13} />
                          )}
                          Approve &amp; Save to Fenix
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Render: Question Bank view ───────────────────────────────────

  if (view === "question-bank") {
    // If we have an active question being generated/reviewed
    if (qbActiveQuestion) {
      return (
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => {
                setQbActiveQuestion(null);
                setQbGenerated(null);
                setQbDraftText("");
              }}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <Library size={22} style={{ color: "#a855f7" }} />
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">
              Question Bank
            </h1>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-between">
              <span className="text-red-400 text-sm">{error}</span>
              <button onClick={() => setError(null)} className="text-red-400 text-xs font-medium">Dismiss</button>
            </div>
          )}

          {/* Question card */}
          <div
            className="rounded-lg p-5 mb-4"
            style={{
              ...cardStyle,
              borderLeftWidth: "3px",
              borderLeftColor: personaColors[qbActiveQuestion.persona] || "#a855f7",
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: `${personaColors[qbActiveQuestion.persona] || "#94a3b8"}20`,
                  color: personaColors[qbActiveQuestion.persona] || "#94a3b8",
                }}
              >
                {qbMeta?.personas?.[qbActiveQuestion.persona]?.label || qbActiveQuestion.persona}
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: `${dimensionColors[qbActiveQuestion.dimension] || "#94a3b8"}20`,
                  color: dimensionColors[qbActiveQuestion.dimension] || "#94a3b8",
                }}
              >
                {qbMeta?.dimensions?.[qbActiveQuestion.dimension]?.label || qbActiveQuestion.dimension}
              </span>
              <span className="text-[10px] text-[var(--text-muted)] ml-auto">{qbActiveQuestion.id}</span>
            </div>
            <p className="text-[var(--text-primary)] text-base leading-relaxed font-medium">
              {qbActiveQuestion.question}
            </p>
          </div>

          {/* Loading state */}
          {qbGenerating && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={28} className="animate-spin" style={{ color: "#a855f7" }} />
              <p className="text-sm text-[var(--text-muted)]">
                Researching best answer &amp; crafting your draft...
              </p>
            </div>
          )}

          {/* Generated content — three panels */}
          {qbGenerated && !qbGenerating && (
            <div className="space-y-4">
              {/* Panel 1: Best Answer Example */}
              <div className="rounded-lg p-5" style={{ ...cardStyle, borderLeftWidth: "3px", borderLeftColor: "#3b82f6" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Star size={15} style={{ color: "#3b82f6" }} />
                  <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                    Best Answer Example
                  </p>
                </div>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {qbGenerated.best_answer?.text}
                </p>
                {qbGenerated.best_answer?.attribution && (
                  <p className="text-[10px] text-[var(--text-muted)] mt-2 italic">
                    {qbGenerated.best_answer.attribution}
                  </p>
                )}
              </div>

              {/* Panel 2: Customized Draft (editable) */}
              <div className="rounded-lg p-5" style={{ ...cardStyle, borderLeftWidth: "3px", borderLeftColor: "#10b981" }}>
                <div className="flex items-center gap-2 mb-3">
                  <User size={15} style={{ color: "#10b981" }} />
                  <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                    Your Draft — keep it to 2-3 sentences + a follow-up prompt
                  </p>
                </div>
                <div className="mb-3">
                  <label className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                    Question (editable)
                  </label>
                  <input
                    type="text"
                    value={qbQuestionText}
                    onChange={(e) => setQbQuestionText(e.target.value)}
                    className="w-full mt-1 bg-[var(--bg-secondary)] text-sm text-[var(--text-primary)] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#10b981]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                    Answer (edit to make it yours)
                  </label>
                  <textarea
                    value={qbDraftText}
                    onChange={(e) => setQbDraftText(e.target.value)}
                    className="w-full mt-1 bg-[var(--bg-secondary)] text-sm text-[var(--text-primary)] rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#10b981] resize-none min-h-[120px] leading-relaxed"
                  />
                </div>
                {qbGenerated.customized_draft?.placeholders?.length > 0 && (
                  <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <HelpCircle size={13} className="mt-0.5 shrink-0" style={{ color: "#f59e0b" }} />
                    <p className="text-xs text-amber-400">
                      Fill in: {qbGenerated.customized_draft.placeholders.join(", ")}
                    </p>
                  </div>
                )}
              </div>

              {/* Production Ready changes */}
              {prChanges.length > 0 && (
                <div className="rounded-lg p-4" style={{ backgroundColor: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)" }}>
                  <p className="text-[10px] font-medium text-[#a855f7] uppercase tracking-wider mb-2">
                    Changes applied ({prChanges.length})
                  </p>
                  <div className="space-y-1">
                    {prChanges.map((c: any, i: number) => (
                      <div key={i} className="text-xs text-[var(--text-secondary)]">
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium mr-1.5"
                          style={{ backgroundColor: "rgba(168,85,247,0.12)", color: "#a855f7" }}>
                          {c.type}
                        </span>
                        {c.original && <span className="line-through text-[var(--text-muted)] mr-1">{c.original}</span>}
                        {c.replacement && <span>→ {c.replacement}</span>}
                        {c.description && <span>{c.description}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons — two-step flow: Polish → Approve */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setPolished(false); setPrChanges([]); generateQbAnswer(qbActiveQuestion); }}
                    disabled={qbGenerating}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    <Sparkles size={13} /> Regenerate
                  </button>
                  <button
                    onClick={() => {
                      setQbActiveQuestion(null);
                      setQbGenerated(null);
                      setPolished(false);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    <SkipForward size={13} /> Skip
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {!polished ? (
                    /* Step 1: Polish button (mandatory before approve) */
                    <button
                      onClick={() => makeProductionReady(qbQuestionText, qbDraftText, setQbQuestionText, setQbDraftText)}
                      disabled={prLoading || !qbDraftText.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
                      style={{ backgroundColor: "rgba(168,85,247,0.15)", color: "#a855f7" }}
                    >
                      {prLoading ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                      Polish My Answer
                    </button>
                  ) : (
                    /* Step 2: After polish, show Re-polish + Approve */
                    <>
                      <button
                        onClick={() => makeProductionReady(qbQuestionText, qbDraftText, setQbQuestionText, setQbDraftText)}
                        disabled={prLoading}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                      >
                        {prLoading ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                        Re-polish
                      </button>
                      <button
                        onClick={approveQbAnswer}
                        disabled={qbSaving || !qbDraftText.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
                        style={{ backgroundColor: "#10b981", color: "white" }}
                      >
                        {qbSaving ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={13} />
                        )}
                        Approve &amp; Save to Fenix
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Question bank browse view (list of questions with filters)
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => {
              setView("home");
              setQbPersona("");
              setQbDimension("");
              setQbOffset(0);
            }}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <Library size={24} style={{ color: "#a855f7" }} />
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Question Bank
          </h1>
          <span className="text-sm text-[var(--text-muted)]">({qbTotal} questions)</span>
        </div>
        <p className="text-[var(--text-secondary)] text-sm mb-6 ml-12">
          319 research-backed questions across 6 personas and 10 dimensions. Select a question to generate an example answer and customize it for Fenix.
        </p>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-between">
            <span className="text-red-400 text-sm">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 text-xs font-medium">Dismiss</button>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-[var(--text-muted)]" />
            <select
              value={qbPersona}
              onChange={(e) => { setQbPersona(e.target.value); setQbOffset(0); }}
              className="text-xs rounded-lg px-3 py-2.5 bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none"
              style={{ border: "1px solid var(--border)" }}
            >
              <option value="">All Personas</option>
              {qbMeta && Object.entries(qbMeta.personas).map(([key, val]: [string, any]) => (
                <option key={key} value={key}>
                  {val.label} ({val.count})
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-[var(--text-muted)]" />
            <select
              value={qbDimension}
              onChange={(e) => { setQbDimension(e.target.value); setQbOffset(0); }}
              className="text-xs rounded-lg px-3 py-2.5 bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none"
              style={{ border: "1px solid var(--border)" }}
            >
              <option value="">All Dimensions</option>
              {qbMeta && Object.entries(qbMeta.dimensions).map(([key, val]: [string, any]) => (
                <option key={key} value={key}>
                  {val.label} ({val.count})
                </option>
              ))}
            </select>
          </div>
          {(qbPersona || qbDimension) && (
            <button
              onClick={() => { setQbPersona(""); setQbDimension(""); setQbOffset(0); }}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] underline"
            >
              Clear filters
            </button>
          )}
          <div className="ml-auto text-xs text-[var(--text-muted)] flex items-center gap-3">
            {qbMeta?.total_answered > 0 && (
              <span>{qbMeta.total_answered} already answered</span>
            )}
            <span>{qbTotal} remaining</span>
            {qbSaved.size > 0 && (
              <span className="text-[#10b981] font-medium">{qbSaved.size} saved this session</span>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
          </div>
        )}

        {/* Question list */}
        {!loading && (
          <div className="space-y-2">
            {qbQuestions.length === 0 && (
              <div className="text-center py-12 text-sm text-[var(--text-muted)]">
                {qbMeta?.total_answered > 0
                  ? `All questions in this view have been answered! (${qbMeta.total_answered} total answered)`
                  : "No questions match the selected filters."}
              </div>
            )}
            {qbQuestions.map((q) => (
              <button
                key={q.id}
                onClick={() => generateQbAnswer(q)}
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-lg text-left transition-all hover:scale-[1.002] active:scale-[0.998]"
                style={{
                  ...cardStyle,
                  opacity: qbSaved.has(q.id) ? 0.5 : 1,
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{
                        backgroundColor: `${personaColors[q.persona] || "#94a3b8"}15`,
                        color: personaColors[q.persona] || "#94a3b8",
                      }}
                    >
                      {qbMeta?.personas?.[q.persona]?.label || q.persona}
                    </span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{
                        backgroundColor: `${dimensionColors[q.dimension] || "#94a3b8"}15`,
                        color: dimensionColors[q.dimension] || "#94a3b8",
                      }}
                    >
                      {qbMeta?.dimensions?.[q.dimension]?.label || q.dimension}
                    </span>
                    {qbSaved.has(q.id) && (
                      <CheckCircle2 size={12} style={{ color: "#10b981" }} />
                    )}
                  </div>
                  <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                    {q.question}
                  </p>
                </div>
                <ChevronRight size={16} className="text-[var(--text-muted)] shrink-0" />
              </button>
            ))}

            {/* Pagination */}
            {qbTotal > 50 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <button
                  disabled={qbOffset === 0}
                  onClick={() => setQbOffset(Math.max(0, qbOffset - 50))}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-xs text-[var(--text-muted)]">
                  {qbOffset + 1}–{Math.min(qbOffset + 50, qbTotal)} of {qbTotal}
                </span>
                <button
                  disabled={qbOffset + 50 >= qbTotal}
                  onClick={() => setQbOffset(qbOffset + 50)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Render: Manual Input view ────────────────────────────────────

  if (view === "manual-input") {
    const allCategories = [
      "manual",
      "professional",
      "technical",
      "personal",
      "working_style",
      "industry_views",
      "product_craft",
      "opinions",
      "fun",
    ];

    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => setView("home")}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <PenLine size={24} style={{ color: "#2dd4bf" }} />
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Manual Input
          </h1>
        </div>
        <p className="text-[var(--text-secondary)] text-sm mb-8 ml-12">
          Enter a question and answer to add directly to Fenix&apos;s training data.
        </p>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-between">
            <span className="text-red-400 text-sm">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 text-xs font-medium">
              Dismiss
            </button>
          </div>
        )}

        {/* Success message */}
        {manualSaved && (
          <div className="mb-6 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} style={{ color: "#10b981" }} />
              <span className="text-emerald-400 text-sm">
                Entry saved to Fenix&apos;s training data with embedding.
              </span>
            </div>
            <button
              onClick={() => setManualSaved(false)}
              className="text-emerald-400 text-xs font-medium"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Form */}
        <div className="space-y-5">
          {/* Category selector */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Category
            </label>
            <select
              value={manualCategory}
              onChange={(e) => setManualCategory(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg text-sm bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border)] focus:outline-none focus:border-[#2dd4bf]"
            >
              {allCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>

          {/* Question input */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Question
            </label>
            <textarea
              value={manualQuestion}
              onChange={(e) => setManualQuestion(e.target.value)}
              placeholder="What question should Fenix be able to answer? e.g. &quot;What's Kiran's management philosophy?&quot;"
              rows={3}
              className="w-full px-4 py-3 rounded-lg text-sm bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border)] focus:outline-none focus:border-[#2dd4bf] resize-none placeholder:text-[var(--text-muted)]"
            />
          </div>

          {/* Answer input */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Answer
            </label>
            <textarea
              value={manualAnswer}
              onChange={(e) => setManualAnswer(e.target.value)}
              placeholder="Write the answer as you'd want Fenix to say it. Be specific and authentic."
              rows={8}
              className="w-full px-4 py-3 rounded-lg text-sm bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border)] focus:outline-none focus:border-[#2dd4bf] resize-none placeholder:text-[var(--text-muted)]"
            />
          </div>

          {/* Production Ready changes */}
          {prChanges.length > 0 && (
            <div className="rounded-lg p-4" style={{ backgroundColor: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)" }}>
              <p className="text-[10px] font-medium text-[#a855f7] uppercase tracking-wider mb-2">
                Changes applied ({prChanges.length})
              </p>
              <div className="space-y-1">
                {prChanges.map((c: any, i: number) => (
                  <div key={i} className="text-xs text-[var(--text-secondary)]">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium mr-1.5"
                      style={{ backgroundColor: "rgba(168,85,247,0.12)", color: "#a855f7" }}>
                      {c.type}
                    </span>
                    {c.original && <span className="line-through text-[var(--text-muted)] mr-1">{c.original}</span>}
                    {c.replacement && <span>→ {c.replacement}</span>}
                    {c.description && <span>{c.description}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-3">
              <p className="text-xs text-[var(--text-muted)]">
                {manualQuestion.trim() && manualAnswer.trim()
                  ? `${manualQuestion.trim().split(/\s+/).length + manualAnswer.trim().split(/\s+/).length} words total`
                  : "Both fields required"}
              </p>
              <button
                onClick={() => makeProductionReady(manualQuestion, manualAnswer, setManualQuestion, setManualAnswer)}
                disabled={prLoading || !manualQuestion.trim() || !manualAnswer.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
                style={{ backgroundColor: "rgba(168,85,247,0.12)", color: "#a855f7" }}
              >
                {prLoading ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                Production Ready
              </button>
            </div>
            <button
              onClick={submitManualEntry}
              disabled={manualSaving || !manualQuestion.trim() || !manualAnswer.trim()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
              style={{
                backgroundColor: "rgba(45,212,191,0.15)",
                color: "#2dd4bf",
              }}
            >
              {manualSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save to Fenix
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Data browser view ─────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setView("home");
              setEditingEntry(null);
            }}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <BookOpen size={22} style={{ color: "#10b981" }} />
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">
            Training Data
          </h1>
          <span className="text-sm text-[var(--text-muted)]">({dataTotal} entries)</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            type="text"
            value={dataSearch}
            onChange={(e) => {
              setDataSearch(e.target.value);
              setDataOffset(0);
            }}
            placeholder="Search questions and answers..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-[var(--bg-card)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#fb923c]"
            style={{ border: "1px solid var(--border)" }}
          />
        </div>
        <select
          value={dataCategory}
          onChange={(e) => {
            setDataCategory(e.target.value);
            setDataOffset(0);
          }}
          className="text-xs rounded-lg px-3 py-2.5 bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none"
          style={{ border: "1px solid var(--border)" }}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-between">
          <span className="text-red-400 text-sm">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 text-xs font-medium">
            Dismiss
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
        </div>
      )}

      {/* Edit modal */}
      {editingEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className="w-full max-w-lg rounded-xl p-6"
            style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Edit Entry</h3>
              <button
                onClick={() => setEditingEntry(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                  Question
                </label>
                <input
                  type="text"
                  value={editingEntry.question}
                  onChange={(e) =>
                    setEditingEntry({ ...editingEntry, question: e.target.value })
                  }
                  className="w-full mt-1 bg-[var(--bg-secondary)] text-sm text-[var(--text-primary)] rounded-lg px-3 py-2 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                  Answer
                </label>
                <textarea
                  value={editingEntry.answer}
                  onChange={(e) =>
                    setEditingEntry({ ...editingEntry, answer: e.target.value })
                  }
                  className="w-full mt-1 bg-[var(--bg-secondary)] text-sm text-[var(--text-primary)] rounded-lg px-3 py-2 focus:outline-none resize-none min-h-[100px]"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                  Category
                </label>
                <select
                  value={editingEntry.category || ""}
                  onChange={(e) =>
                    setEditingEntry({ ...editingEntry, category: e.target.value })
                  }
                  className="w-full mt-1 bg-[var(--bg-secondary)] text-sm text-[var(--text-primary)] rounded-lg px-3 py-2 focus:outline-none"
                >
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setEditingEntry(null)}
                className="px-3 py-2 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]"
              >
                Cancel
              </button>
              <button
                onClick={saveEditedEntry}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium"
                style={{ backgroundColor: "#10b981", color: "white" }}
              >
                <Save size={13} /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entries list */}
      {!loading && (
        <div className="space-y-2">
          {trainingEntries.length === 0 && (
            <div className="text-center py-12 text-sm text-[var(--text-muted)]">
              No training data yet. Start a training session to teach Fenix!
            </div>
          )}
          {trainingEntries.map((entry) => (
            <div key={entry.id} className="rounded-lg p-4" style={cardStyle}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <CategoryTag category={entry.category || "uncategorized"} />
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{
                        backgroundColor: entry.source === "question_bank" ? "#3b82f615" : entry.source === "manual" ? "#14b8a615" : "#fb923c15",
                        color: entry.source === "question_bank" ? "#3b82f6" : entry.source === "manual" ? "#14b8a6" : "#fb923c",
                      }}
                    >
                      {entry.source === "question_bank" ? "Question Bank" : entry.source === "manual" ? "Manual" : entry.source === "training_interview" ? "Free-form" : entry.source || "Unknown"}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                    {entry.question}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">{entry.answer}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setEditingEntry({ ...entry })}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                    title="Edit"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => deleteEntry(entry.id)}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {dataTotal > 50 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                disabled={dataOffset === 0}
                onClick={() => setDataOffset(Math.max(0, dataOffset - 50))}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-[var(--text-muted)]">
                {dataOffset + 1}–{Math.min(dataOffset + 50, dataTotal)} of {dataTotal}
              </span>
              <button
                disabled={dataOffset + 50 >= dataTotal}
                onClick={() => setDataOffset(dataOffset + 50)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
