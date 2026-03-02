"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  PenTool,
  Play,
  CheckCircle2,
  Loader2,
  ChevronRight,
  Plus,
  ArrowLeft,
  Send,
  ThumbsUp,
  RotateCcw,
  Key,
  ExternalLink,
  BookOpen,
  Share2,
  Hash,
  HelpCircle,
} from "lucide-react";
import Link from "next/link";
import { useApiKey } from "@/context/ApiKeyContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const BLOG_LABELS = [
  "Format, Theme & Angle",
  "Live Web Research",
  "Topic Options",
  "Refinement Questions",
  "Structure & Format",
  "Anecdote Workshop",
  "Write the Post",
  "Editorial Filter",
  "Visual Assets",
  "Fact-Check",
  "Originality Check",
  "Output & Package",
];

const SOCIAL_LABELS = [
  "Source & Format",
  "Concept Options",
  "Create Visual",
  "Caption & Copy",
  "Output",
];

interface Session {
  session_id: string;
  mode: string;
  current_step: number;
  total_steps: number;
  status: string;
  config: Record<string, string>;
  steps: Record<string, { content: string; status: string }>;
}

type View = "list" | "create" | "workflow";

export default function WordWeaverPage() {
  const { apiKey, isKeySet } = useApiKey();
  const [view, setView] = useState<View>("list");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [themes, setThemes] = useState<string[]>([]);
  const [angles, setAngles] = useState<string[]>([]);

  // Create form
  const [mode, setMode] = useState<"blog" | "social">("blog");

  // Workflow state
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [userInput, setUserInput] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/wordweaver/sessions`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch { /* server may not be running */ }
  }, []);

  const fetchThemes = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/wordweaver/themes`);
      if (res.ok) {
        const data = await res.json();
        setThemes(data.themes || []);
        setAngles(data.angles || []);
      }
    } catch { /* server may not be running */ }
  }, []);

  useEffect(() => {
    fetchSessions();
    fetchThemes();
  }, [fetchSessions, fetchThemes]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [streamText]);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/wordweaver/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      const sessRes = await fetch(`${API_URL}/api/wordweaver/sessions/${data.session_id}`);
      const session = await sessRes.json();
      setActiveSession(session);
      setView("workflow");
      fetchSessions();
    } catch (e) {
      console.error("Failed to create session:", e);
    }
    setLoading(false);
  };

  const openSession = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/wordweaver/sessions/${id}`);
      const session = await res.json();
      setActiveSession(session);
      setView("workflow");
      const stepData = session.steps?.[String(session.current_step)];
      setStreamText(stepData?.content || "");
    } catch (e) {
      console.error("Failed to load session:", e);
    }
    setLoading(false);
  };

  const runStep = async () => {
    if (!activeSession || !apiKey || streaming) return;
    setStreaming(true);
    setStreamText("");

    try {
      const res = await fetch(
        `${API_URL}/api/wordweaver/sessions/${activeSession.session_id}/step`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(apiKey && apiKey !== "__backend__" ? { "X-Claude-Key": apiKey } : {}) },
          body: JSON.stringify({ user_input: userInput || null }),
        }
      );

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No body");
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(trimmed.slice(6));
            if (event.type === "text_delta") {
              fullText += event.delta;
              setStreamText(fullText);
            }
          } catch { /* skip */ }
        }
      }

      const sessRes = await fetch(`${API_URL}/api/wordweaver/sessions/${activeSession.session_id}`);
      setActiveSession(await sessRes.json());
    } catch (e) {
      console.error("Step failed:", e);
    }
    setStreaming(false);
    setUserInput("");
  };

  const approveStep = async () => {
    if (!activeSession) return;
    setLoading(true);
    try {
      await fetch(
        `${API_URL}/api/wordweaver/sessions/${activeSession.session_id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: userInput || "Approved" }),
        }
      );
      const res = await fetch(`${API_URL}/api/wordweaver/sessions/${activeSession.session_id}`);
      setActiveSession(await res.json());
      setStreamText("");
      setUserInput("");
      fetchSessions();
    } catch (e) {
      console.error("Approve failed:", e);
    }
    setLoading(false);
  };

  const reviseStep = async () => {
    if (!activeSession || !apiKey || !userInput.trim()) return;
    setStreaming(true);
    setStreamText("");

    try {
      const res = await fetch(
        `${API_URL}/api/wordweaver/sessions/${activeSession.session_id}/revise`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(apiKey && apiKey !== "__backend__" ? { "X-Claude-Key": apiKey } : {}) },
          body: JSON.stringify({ feedback: userInput }),
        }
      );
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No body");
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(trimmed.slice(6));
            if (event.type === "text_delta") {
              fullText += event.delta;
              setStreamText(fullText);
            }
          } catch { /* skip */ }
        }
      }
      const sessRes = await fetch(`${API_URL}/api/wordweaver/sessions/${activeSession.session_id}`);
      setActiveSession(await sessRes.json());
    } catch (e) {
      console.error("Revise failed:", e);
    }
    setStreaming(false);
    setUserInput("");
  };

  const stepLabels = activeSession?.mode === "social" ? SOCIAL_LABELS : BLOG_LABELS;
  const totalSteps = activeSession?.total_steps || stepLabels.length;
  const currentStepData = activeSession?.steps?.[String(activeSession.current_step)];
  const hasDraft = currentStepData?.status === "draft";
  const isComplete = activeSession?.status === "ready_to_publish" || activeSession?.status === "published" || activeSession?.status === "previewing";

  // ── Publish state (two-step: preview → deploy) ──────────
  const [previewing, setPreviewing] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [publishResult, setPublishResult] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const isPreviewed = activeSession?.status === "previewing";
  const isPublished = activeSession?.status === "published";

  // ── Cross-post state (Medium / Substack) ──────────
  const [crossPosting, setCrossPosting] = useState(false);
  const [crossPostResult, setCrossPostResult] = useState<string | null>(null);

  const generateCrossPost = async () => {
    if (!activeSession) return;
    setCrossPosting(true);
    setCrossPostResult(null);
    try {
      const res = await fetch(
        `${API_URL}/api/wordweaver/sessions/${activeSession.session_id}/crosspost`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { "X-Claude-Key": apiKey } : {}),
          },
        }
      );
      const data = await res.json();
      if (res.ok) {
        setCrossPostResult(
          `Cross-post ready: ${data.markdown_file}. ${data.diagram_images?.length ? `Diagram PNGs: ${data.diagram_images.join(", ")}` : ""}`
        );
      } else {
        setCrossPostResult(`Error: ${data.detail || "Failed to generate cross-post"}`);
      }
    } catch (e) {
      setCrossPostResult(`Error: ${e}`);
    }
    setCrossPosting(false);
  };

  const savePreview = async () => {
    if (!activeSession) return;
    setPreviewing(true);
    setPublishResult(null);

    const finalStep = activeSession.steps?.[String(totalSteps)];
    if (!finalStep?.content) {
      setPublishResult("Error: Final step content not found.");
      setPreviewing(false);
      return;
    }

    const postSlug = slug.trim() || (activeSession.session_id)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);

    try {
      const res = await fetch(`${API_URL}/api/wordweaver/sessions/${activeSession.session_id}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(apiKey && apiKey !== "__backend__" ? { "X-Claude-Key": apiKey } : {}) },
        body: JSON.stringify({
          html_content: finalStep.content,
          slug: postSlug,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setPublishResult(`Error: ${err.detail || "Preview save failed"}`);
      } else {
        const data = await res.json();
        setPublishResult(`Saved to ${data.local_file}. Preview the file locally, then deploy when ready.`);
        const sessRes = await fetch(`${API_URL}/api/wordweaver/sessions/${activeSession.session_id}`);
        if (sessRes.ok) setActiveSession(await sessRes.json());
        fetchSessions();
      }
    } catch (e) {
      console.error("Preview save failed:", e);
      setPublishResult(`Error: ${e instanceof Error ? e.message : "Network error"}`);
    }
    setPreviewing(false);
  };

  const deployPost = async () => {
    if (!activeSession) return;
    setDeploying(true);
    setPublishResult(null);

    try {
      const res = await fetch(`${API_URL}/api/wordweaver/sessions/${activeSession.session_id}/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const err = await res.json();
        setPublishResult(`Error: ${err.detail || "Deploy failed"}`);
      } else {
        const data = await res.json();
        setPublishResult(data.url ? `Deployed! Live at: ${data.url}` : "Deployed to production!");
        const sessRes = await fetch(`${API_URL}/api/wordweaver/sessions/${activeSession.session_id}`);
        if (sessRes.ok) setActiveSession(await sessRes.json());
        fetchSessions();
      }
    } catch (e) {
      console.error("Deploy failed:", e);
      setPublishResult(`Error: ${e instanceof Error ? e.message : "Network error"}`);
    }
    setDeploying(false);
  };

  // ── List View ─────────────────────────────────────────────

  if (view === "list") {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <PenTool size={24} className="text-[var(--accent-blue)]" />
              <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
                WordWeaver
              </h1>
              <Link href="/dashboard/help?module=wordweaver"
                className="text-[var(--text-muted)] hover:text-[var(--accent-blue)] transition-colors"
                title="Help & Documentation">
                <HelpCircle size={18} />
              </Link>
            </div>
            <p className="text-[var(--text-secondary)] text-sm">
              Blog &amp; social content production engine.
            </p>
          </div>
          <button
            onClick={() => setView("create")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium"
            style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}
          >
            <Plus size={16} /> New Content
          </button>
        </div>

        {!isKeySet && (
          <div className="mb-6 p-4 rounded-lg border flex items-start gap-3"
            style={{ backgroundColor: "rgba(122, 158, 196, 0.08)", borderColor: "var(--accent-blue)" }}>
            <Key size={18} className="text-[var(--accent-blue)] mt-0.5 shrink-0" />
            <p className="text-sm text-[var(--text-secondary)]">
              Claude API key required for the content workflow.
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="rounded-lg p-4 text-center" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="text-xl font-semibold text-[var(--text-primary)]">{themes.length || 32}</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">Themes</div>
          </div>
          <div className="rounded-lg p-4 text-center" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="text-xl font-semibold text-[var(--text-primary)]">{angles.length || 15}</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">Angles</div>
          </div>
          <div className="rounded-lg p-4 text-center" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="text-xl font-semibold text-[var(--text-primary)]">8</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">Series</div>
          </div>
        </div>

        {/* Published */}
        <div className="rounded-lg p-5 mb-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <ExternalLink size={14} className="text-[var(--accent-green)]" /> Published
          </h3>
          <div className="py-1.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text-primary)]">The Bank That Got 213,000 Employees to Actually Use AI</p>
                <p className="text-xs text-[var(--text-muted)]">AI Change Management &middot; Case Study</p>
              </div>
              <a href="https://kirangorapalli.com/blog/jpmorgan-llm-suite-ai-adoption.html"
                target="_blank" rel="noopener noreferrer"
                className="text-xs text-[var(--accent-blue)] hover:underline flex items-center gap-1">
                View <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>

        {/* In-progress sessions */}
        {sessions.length > 0 && (
          <div className="rounded-lg p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">In Progress</h3>
            <div className="space-y-2">
              {sessions.map((s) => (
                <button key={s.session_id} onClick={() => openSession(s.session_id)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors hover:opacity-80"
                  style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                  <div>
                    <p className="text-sm text-[var(--text-primary)] font-medium flex items-center gap-2">
                      {s.mode === "blog" ? <BookOpen size={14} /> : <Share2 size={14} />}
                      {s.mode === "blog" ? "Blog Post" : "Social Post"}
                      {s.config?.theme && <span className="text-xs text-[var(--text-muted)]">&middot; {s.config.theme}</span>}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Step {s.current_step}/{s.total_steps} &middot; {s.status}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-[var(--text-muted)]" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Create View ───────────────────────────────────────────

  if (view === "create") {
    return (
      <div className="max-w-lg mx-auto px-6 py-8">
        <button onClick={() => setView("list")}
          className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-6 transition-colors">
          <ArrowLeft size={14} /> Back
        </button>

        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-1">New Content</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6">Choose a content mode to get started.</p>

        <div className="space-y-3 mb-6">
          <button
            onClick={() => setMode("blog")}
            className="w-full p-4 rounded-lg text-left transition-all"
            style={{
              backgroundColor: mode === "blog" ? "rgba(122, 158, 196, 0.1)" : "var(--bg-card)",
              border: mode === "blog" ? "2px solid var(--accent-blue)" : "1px solid var(--border)",
            }}
          >
            <div className="flex items-center gap-3">
              <BookOpen size={20} className={mode === "blog" ? "text-[var(--accent-blue)]" : "text-[var(--text-muted)]"} />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Blog Post</p>
                <p className="text-xs text-[var(--text-secondary)]">12-step pipeline: research, write, edit, publish</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setMode("social")}
            className="w-full p-4 rounded-lg text-left transition-all"
            style={{
              backgroundColor: mode === "social" ? "rgba(122, 158, 196, 0.1)" : "var(--bg-card)",
              border: mode === "social" ? "2px solid var(--accent-blue)" : "1px solid var(--border)",
            }}
          >
            <div className="flex items-center gap-3">
              <Share2 size={20} className={mode === "social" ? "text-[var(--accent-blue)]" : "text-[var(--text-muted)]"} />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Social Post</p>
                <p className="text-xs text-[var(--text-secondary)]">5-step visual-first social content for Instagram, LinkedIn, X</p>
              </div>
            </div>
          </button>
        </div>

        <button onClick={handleCreate} disabled={loading}
          className="w-full py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
          style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          Start {mode === "blog" ? "Blog" : "Social"} Workflow
        </button>
      </div>
    );
  }

  // ── Workflow View ──────────────────────────────────────────

  return (
    <div className="h-full flex flex-col" style={{ maxHeight: "calc(100vh - 2rem)" }}>
      {/* Top bar */}
      <div className="shrink-0 px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => { setView("list"); setStreamText(""); setActiveSession(null); }}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
                {activeSession?.mode === "blog" ? <BookOpen size={16} /> : <Share2 size={16} />}
                {activeSession?.mode === "blog" ? "Blog Post" : "Social Post"}
                {activeSession?.config?.theme && (
                  <span className="text-xs font-normal text-[var(--text-muted)] flex items-center gap-1">
                    <Hash size={10} /> {activeSession.config.theme}
                  </span>
                )}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {isComplete ? "All steps complete" : `Step ${activeSession?.current_step}/${totalSteps} — ${stepLabels[(activeSession?.current_step || 1) - 1]}`}
              </p>
            </div>
          </div>
          {isComplete && (
            <span className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{ backgroundColor: "rgba(107, 158, 107, 0.15)", color: "var(--accent-green)" }}>
              {isPublished ? "Published" : isPreviewed ? "Previewing" : "Ready to Publish"}
            </span>
          )}
        </div>

        {/* Step indicators */}
        <div className="flex gap-1 mt-3">
          {stepLabels.map((label, idx) => {
            const stepNum = idx + 1;
            const stepData = activeSession?.steps?.[String(stepNum)];
            const isCurrent = stepNum === activeSession?.current_step;
            const isApproved = stepData?.status === "approved";
            return (
              <div key={stepNum} className="flex-1 group relative" title={`${stepNum}. ${label}`}>
                <div className="h-1.5 rounded-full transition-all"
                  style={{
                    backgroundColor: isApproved ? "var(--accent-green)" : isCurrent ? "var(--accent-blue)" : "var(--border)",
                  }}
                />
                <span className="absolute -bottom-5 left-0 text-[9px] text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {stepNum}. {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Output area */}
      <div className="flex-1 overflow-hidden flex flex-col px-6 py-4 min-h-0">
        <div ref={outputRef}
          className="flex-1 overflow-y-auto rounded-lg p-5 mb-4 text-sm leading-relaxed whitespace-pre-wrap"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)", minHeight: 0 }}>
          {isComplete ? (
            <div className="text-[var(--text-muted)] text-center py-8">
              <div className="max-w-md mx-auto">
                <CheckCircle2 size={28} className="mx-auto mb-3 text-[var(--accent-green)]" />
                <p className="mb-5">
                  {isPublished ? "Post deployed to production!" : isPreviewed ? "Preview saved locally. Review it, then deploy when ready." : "All steps complete. Save a preview first."}
                </p>

                {!isPublished && (
                  <div className="text-left space-y-3">
                    {/* Slug input — only editable before preview */}
                    {!isPreviewed && (
                      <div>
                        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">URL slug (optional)</label>
                        <input
                          value={slug}
                          onChange={(e) => setSlug(e.target.value)}
                          placeholder="e.g. my-blog-post-title"
                          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
                          style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                        />
                        <p className="text-[10px] text-[var(--text-muted)] mt-1">Leave blank to auto-generate from session ID</p>
                      </div>
                    )}

                    {/* Step 1: Save Preview */}
                    <button
                      onClick={savePreview}
                      disabled={previewing || isPreviewed}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: isPreviewed ? "var(--border)" : "var(--accent-blue)",
                        color: isPreviewed ? "var(--text-muted)" : "#fff",
                        opacity: previewing ? 0.6 : 1,
                      }}
                    >
                      {previewing ? <Loader2 size={14} className="animate-spin" /> : isPreviewed ? <CheckCircle2 size={14} /> : <BookOpen size={14} />}
                      {previewing ? "Saving preview..." : isPreviewed ? "Preview saved" : "Save Preview"}
                    </button>

                    {/* Step 2: Deploy to Production */}
                    <button
                      onClick={deployPost}
                      disabled={deploying || !isPreviewed}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: isPreviewed ? "var(--accent-green)" : "var(--border)",
                        color: isPreviewed ? "#fff" : "var(--text-muted)",
                        opacity: deploying ? 0.6 : 1,
                      }}
                    >
                      {deploying ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                      {deploying ? "Deploying..." : "Deploy to Production"}
                    </button>

                    {!isPreviewed && (
                      <p className="text-[10px] text-[var(--text-muted)] text-center">Save a preview first, review the file locally, then deploy.</p>
                    )}
                  </div>
                )}

                {/* Step 3: Generate Cross-Post (Medium / Substack) */}
                {isPublished && (
                  <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                    <p className="text-[10px] text-[var(--text-muted)] mb-2 text-center">Cross-post to other platforms</p>
                    <button
                      onClick={generateCrossPost}
                      disabled={crossPosting}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: "var(--accent-blue)",
                        color: "#fff",
                        opacity: crossPosting ? 0.6 : 1,
                      }}
                    >
                      {crossPosting ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                      {crossPosting ? "Generating..." : "Generate for Medium & Substack"}
                    </button>
                    {crossPostResult && (
                      <div className={`mt-2 text-xs p-2.5 rounded-lg ${crossPostResult.startsWith("Error") ? "bg-red-500/10 text-red-400" : "bg-blue-500/10 text-blue-400"}`}>
                        {crossPostResult}
                      </div>
                    )}
                  </div>
                )}

                {publishResult && (
                  <div className={`mt-3 text-xs p-2.5 rounded-lg ${publishResult.startsWith("Error") ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"}`}>
                    {publishResult}
                  </div>
                )}
              </div>
            </div>
          ) : streamText ? streamText : streaming ? (
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <Loader2 size={14} className="animate-spin" /> Working on it...
            </div>
          ) : (
            <div className="text-[var(--text-muted)] text-center py-8">
              <div>
                <p className="mb-2">Step {activeSession?.current_step}: {stepLabels[(activeSession?.current_step || 1) - 1]}</p>
                <p className="text-xs">Click &ldquo;Run Step&rdquo; to begin. Add context below if needed.</p>
              </div>
            </div>
          )}
        </div>

        {/* Input + actions */}
        {!isComplete && (
          <div className="shrink-0">
            <div className="flex gap-2 mb-3">
              <input value={userInput} onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !streaming) {
                    e.preventDefault();
                    if (hasDraft) { userInput.trim() ? reviseStep() : approveStep(); }
                    else runStep();
                  }
                }}
                placeholder={hasDraft ? "Feedback to revise, or press approve..." : "Add context (optional)..."}
                disabled={streaming}
                className="flex-1 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
                style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
              {hasDraft ? (
                <>
                  <button onClick={approveStep} disabled={streaming || loading}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium"
                    style={{ backgroundColor: "var(--accent-green)", color: "#fff" }}>
                    <ThumbsUp size={14} /> Approve
                  </button>
                  <button onClick={reviseStep} disabled={streaming || !userInput.trim()}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium"
                    style={{
                      backgroundColor: userInput.trim() ? "var(--accent-blue)" : "var(--border)",
                      color: userInput.trim() ? "#fff" : "var(--text-muted)",
                    }}>
                    <RotateCcw size={14} /> Revise
                  </button>
                </>
              ) : (
                <button onClick={runStep} disabled={streaming || !isKeySet}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium"
                  style={{
                    backgroundColor: isKeySet ? "var(--accent-blue)" : "var(--border)",
                    color: isKeySet ? "#fff" : "var(--text-muted)",
                  }}>
                  {streaming ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Run Step
                </button>
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>
                {hasDraft && "Draft ready — approve or revise"}
                {!hasDraft && !streaming && "Run the step to begin"}
                {streaming && "Streaming..."}
              </span>
              {activeSession && <span>Session: {activeSession.session_id}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
