"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  PenTool,
  Play,
  CheckCircle2,
  Loader2,
  ChevronRight,
  ChevronLeft,
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
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useApiKey } from "@/context/ApiKeyContext";
import ModuleHelp from "@/components/ModuleHelp";

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

  const deleteSession = async (id: string) => {
    if (!confirm("Delete this session? This cannot be undone.")) return;
    try {
      await fetch(`${API_URL}/api/wordweaver/sessions/${id}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.session_id !== id));
    } catch (e) {
      console.error("Failed to delete session:", e);
    }
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

  const goToStep = async (target: number) => {
    if (!activeSession || streaming) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/wordweaver/sessions/${activeSession.session_id}/goto-step`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step: target }),
        }
      );
      if (res.ok) {
        const sessRes = await fetch(`${API_URL}/api/wordweaver/sessions/${activeSession.session_id}`);
        const updated = await sessRes.json();
        setActiveSession(updated);
        const stepData = updated.steps?.[String(target)];
        setStreamText(stepData?.content || "");
        setUserInput("");
      }
    } catch (e) {
      console.error("Go to step failed:", e);
    }
    setLoading(false);
  };

  const stepLabels = activeSession?.mode === "social" ? SOCIAL_LABELS : BLOG_LABELS;
  const totalSteps = activeSession?.total_steps || stepLabels.length;
  const currentStepData = activeSession?.steps?.[String(activeSession.current_step)];
  const hasDraft = currentStepData?.status === "draft";
  const isReviewing = activeSession?.status === "reviewing";
  const isRevalidating = activeSession?.status === "revalidating";
  const isComplete = activeSession?.status === "ready_to_publish" || activeSession?.status === "published" || activeSession?.status === "previewing";

  // Navigation: find highest approved step so we know which steps are reachable
  const maxApproved = (() => {
    if (!activeSession) return 0;
    let max = 0;
    for (let s = 1; s <= totalSteps; s++) {
      if (activeSession.steps?.[String(s)]?.status === "approved") max = s;
    }
    return max;
  })();
  const currentStep = activeSession?.current_step || 1;
  const canGoBack = currentStep > 1;
  const canGoForward = currentStep < maxApproved + 1 && currentStep < totalSteps;

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
          `Cross-post ready!\n📄 File: ${data.markdown_path || data.markdown_file}\n${data.diagram_images?.length ? `🖼️ Diagrams: ${data.diagram_images.join(", ")}` : ""}\n📋 Medium: ${data.instructions?.medium || ""}\n📋 Substack: ${data.instructions?.substack || ""}`
        );
      } else {
        setCrossPostResult(`Error: ${data.detail || "Failed to generate cross-post"}`);
      }
    } catch (e) {
      setCrossPostResult(`Error: ${e}`);
    }
    setCrossPosting(false);
  };

  // ── Review phase: edit, preview, revalidate ──────────
  const [reviewEdit, setReviewEdit] = useState("");
  const [revalidating, setRevalidating] = useState(false);
  const [revalidationStep, setRevalidationStep] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [generatingPreview, setGeneratingPreview] = useState(false);

  const generatePreview = async () => {
    if (!activeSession) return;
    setGeneratingPreview(true);
    setPreviewFile(null);
    try {
      const res = await fetch(
        `${API_URL}/api/wordweaver/sessions/${activeSession.session_id}/preview-content`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(apiKey && apiKey !== "__backend__" ? { "X-Claude-Key": apiKey } : {}) },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setPreviewFile(data.local_file);
      }
    } catch (e) {
      console.error("Preview generation failed:", e);
    }
    setGeneratingPreview(false);
  };

  const editFinal = async () => {
    if (!activeSession || !apiKey || !reviewEdit.trim() || streaming) return;
    setStreaming(true);
    setStreamText("");

    try {
      const res = await fetch(
        `${API_URL}/api/wordweaver/sessions/${activeSession.session_id}/edit-final`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(apiKey && apiKey !== "__backend__" ? { "X-Claude-Key": apiKey } : {}) },
          body: JSON.stringify({ feedback: reviewEdit }),
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
      // Refresh session
      const sessRes = await fetch(`${API_URL}/api/wordweaver/sessions/${activeSession.session_id}`);
      setActiveSession(await sessRes.json());
      setPreviewFile(null); // preview is stale after edits
    } catch (e) {
      console.error("Edit failed:", e);
    }
    setStreaming(false);
    setReviewEdit("");
  };

  const approveFinal = async () => {
    if (!activeSession || !apiKey || streaming) return;
    setRevalidating(true);
    setStreamText("");
    setRevalidationStep("Starting revalidation...");

    try {
      const res = await fetch(
        `${API_URL}/api/wordweaver/sessions/${activeSession.session_id}/approve-final`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(apiKey && apiKey !== "__backend__" ? { "X-Claude-Key": apiKey } : {}) },
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
            if (event.type === "revalidation_start") {
              setRevalidationStep(`Running Step ${event.step}: ${event.label}...`);
              fullText += `\n\n── Step ${event.step}: ${event.label} ──\n`;
              setStreamText(fullText);
            } else if (event.type === "text_delta") {
              fullText += event.delta;
              setStreamText(fullText);
            } else if (event.type === "revalidation_complete") {
              setRevalidationStep(null);
            }
          } catch { /* skip */ }
        }
      }
      // Refresh session — should now be ready_to_publish
      const sessRes = await fetch(`${API_URL}/api/wordweaver/sessions/${activeSession.session_id}`);
      setActiveSession(await sessRes.json());
    } catch (e) {
      console.error("Approve final failed:", e);
    }
    setRevalidating(false);
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
              <ModuleHelp moduleSlug="wordweaver" />
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
                <div key={s.session_id} className="flex items-center gap-2">
                  <button onClick={() => openSession(s.session_id)}
                    className="flex-1 flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors hover:opacity-80"
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
                  <button onClick={() => deleteSession(s.session_id)}
                    className="p-2 rounded-lg transition-colors hover:opacity-80"
                    style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
                    title="Delete session">
                    <Trash2 size={14} />
                  </button>
                </div>
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
    <div className="h-full flex" style={{ maxHeight: "calc(100vh - 2rem)" }}>
      {/* Left sidebar: vertical step list */}
      <div className="shrink-0 overflow-y-auto border-r flex flex-col"
        style={{ width: "220px", borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
        {/* Header */}
        <div className="shrink-0 px-4 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => { setView("list"); setStreamText(""); setActiveSession(null); }}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <ArrowLeft size={16} />
            </button>
            <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
              {activeSession?.mode === "blog" ? <BookOpen size={14} /> : <Share2 size={14} />}
              {activeSession?.mode === "blog" ? "Blog" : "Social"}
            </h2>
          </div>
          {activeSession?.config?.theme && (
            <p className="text-[10px] text-[var(--text-muted)] flex items-center gap-1 ml-6">
              <Hash size={9} /> {activeSession.config.theme}
            </p>
          )}
          {(isReviewing || isRevalidating) && (
            <span className="inline-block text-[10px] px-2 py-0.5 rounded-full font-medium mt-2 ml-6"
              style={{ backgroundColor: "rgba(122, 158, 196, 0.15)", color: "var(--accent-blue)" }}>
              {isRevalidating ? "Revalidating" : "Reviewing"}
            </span>
          )}
          {isComplete && (
            <span className="inline-block text-[10px] px-2 py-0.5 rounded-full font-medium mt-2 ml-6"
              style={{ backgroundColor: "rgba(107, 158, 107, 0.15)", color: "var(--accent-green)" }}>
              {isPublished ? "Published" : isPreviewed ? "Previewing" : "Ready to Publish"}
            </span>
          )}
        </div>

        {/* Step list */}
        <div className="flex-1 overflow-y-auto py-2">
          {stepLabels.map((label, idx) => {
            const stepNum = idx + 1;
            const stepData = activeSession?.steps?.[String(stepNum)];
            const isCurrent = stepNum === currentStep;
            const isApproved = stepData?.status === "approved";
            const hasDraftContent = stepData?.status === "draft";
            const isReachable = stepNum <= maxApproved + 1;

            return (
              <button
                key={stepNum}
                onClick={() => isReachable && !streaming && goToStep(stepNum)}
                disabled={!isReachable || streaming}
                className="w-full flex items-start gap-2.5 px-4 py-2 text-left transition-colors"
                style={{
                  backgroundColor: isCurrent ? "var(--bg-card)" : "transparent",
                  borderLeft: isCurrent ? "2px solid var(--accent-blue)" : "2px solid transparent",
                  opacity: !isReachable ? 0.4 : 1,
                  cursor: isReachable && !streaming ? "pointer" : "default",
                }}
              >
                {/* Step number circle */}
                <span className="shrink-0 flex items-center justify-center rounded-full text-[10px] font-bold"
                  style={{
                    width: "20px",
                    height: "20px",
                    marginTop: "1px",
                    backgroundColor: isApproved
                      ? "var(--accent-green)"
                      : isCurrent
                      ? "var(--accent-blue)"
                      : hasDraftContent
                      ? "var(--accent-amber)"
                      : "transparent",
                    color: isApproved || isCurrent || hasDraftContent ? "#fff" : "var(--text-muted)",
                    border: isApproved || isCurrent || hasDraftContent ? "none" : "1.5px solid var(--border)",
                  }}
                >
                  {isApproved ? <CheckCircle2 size={12} /> : stepNum}
                </span>
                {/* Label */}
                <span className="text-xs leading-tight"
                  style={{
                    color: isCurrent ? "var(--text-primary)" : isApproved ? "var(--accent-green)" : "var(--text-secondary)",
                    fontWeight: isCurrent ? 600 : 400,
                  }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Progress footer */}
        <div className="shrink-0 px-4 py-3 border-t text-center" style={{ borderColor: "var(--border)" }}>
          <p className="text-[10px] text-[var(--text-muted)]">
            {maxApproved}/{totalSteps} steps complete
          </p>
          <div className="w-full h-1 rounded-full mt-1.5" style={{ backgroundColor: "var(--border)" }}>
            <div className="h-1 rounded-full transition-all" style={{
              width: `${(maxApproved / totalSteps) * 100}%`,
              backgroundColor: "var(--accent-green)",
            }} />
          </div>
        </div>
      </div>

      {/* Right side: output + input */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Compact top bar for current step context */}
        <div className="shrink-0 px-6 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
          {(isReviewing || isRevalidating) ? (
            <>
              <p className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                <PenTool size={14} className="text-[var(--accent-blue)]" />
                {isRevalidating ? "Revalidating..." : "Review & Edit"}
              </p>
              <span className="text-xs text-[var(--text-muted)]">
                {isRevalidating ? revalidationStep : "All steps complete — review before publishing"}
              </span>
            </>
          ) : isComplete ? (
            <>
              <p className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                <CheckCircle2 size={14} className="text-[var(--accent-green)]" />
                {isPublished ? "Published" : "Ready to Publish"}
              </p>
              <span className="text-xs text-[var(--text-muted)]">Checks passed</span>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => canGoBack && goToStep(currentStep - 1)}
                  disabled={!canGoBack || streaming}
                  className="p-1 rounded transition-colors"
                  style={{
                    color: canGoBack && !streaming ? "var(--text-primary)" : "var(--border)",
                    cursor: canGoBack && !streaming ? "pointer" : "default",
                  }}
                  title={canGoBack ? `Back to ${currentStep - 1}. ${stepLabels[currentStep - 2]}` : ""}
                >
                  <ChevronLeft size={16} />
                </button>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Step {currentStep}: {stepLabels[currentStep - 1]}
                </p>
                <button
                  onClick={() => canGoForward && goToStep(currentStep + 1)}
                  disabled={!canGoForward || streaming}
                  className="p-1 rounded transition-colors"
                  style={{
                    color: canGoForward && !streaming ? "var(--text-primary)" : "var(--border)",
                    cursor: canGoForward && !streaming ? "pointer" : "default",
                  }}
                  title={canGoForward ? `Next: ${currentStep + 1}. ${stepLabels[currentStep]}` : ""}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <span className="text-xs text-[var(--text-muted)]">{currentStep} of {totalSteps}</span>
            </>
          )}
        </div>

        {/* Output area */}
        <div className="flex-1 overflow-hidden flex flex-col px-6 py-4 min-h-0">
        <div ref={outputRef}
          className="flex-1 overflow-y-auto rounded-lg p-5 mb-4 text-sm leading-relaxed whitespace-pre-wrap"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-secondary)", minHeight: 0 }}>

          {/* ── Review phase: iterate on final content ── */}
          {(isReviewing || isRevalidating) ? (
            streamText ? streamText : revalidating ? (
              <div className="flex items-center gap-2 text-[var(--text-muted)]">
                <Loader2 size={14} className="animate-spin" /> {revalidationStep || "Revalidating..."}
              </div>
            ) : (
              <div>
                {/* Show preview link if available */}
                {previewFile && (
                  <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: "rgba(122, 158, 196, 0.08)", border: "1px solid var(--accent-blue)" }}>
                    <p className="text-xs text-[var(--accent-blue)] font-medium mb-1">Preview ready</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Open <span className="font-mono text-[var(--text-primary)]">{previewFile}</span> in your browser to see the styled page.
                    </p>
                  </div>
                )}
                {/* Show current step 7 (Write the Post) content for review */}
                {activeSession?.steps?.["7"]?.content ? (
                  <div>
                    <p className="text-xs text-[var(--text-muted)] mb-3 font-medium uppercase tracking-wide">Review your post</p>
                    {activeSession.steps["7"].content}
                  </div>
                ) : (
                  <p className="text-[var(--text-muted)] text-center py-8">No post content found. Something went wrong.</p>
                )}
              </div>
            )
          ) : isComplete ? (
            <div className="text-[var(--text-muted)] text-center py-8">
              <div className="max-w-md mx-auto">
                <CheckCircle2 size={28} className="mx-auto mb-3 text-[var(--accent-green)]" />
                <p className="mb-5">
                  {isPublished ? "Post deployed to production!" : isPreviewed ? "Preview saved locally. Review it, then deploy when ready." : "Checks passed. Ready to publish."}
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

                    {/* Save Preview */}
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

                    {/* Deploy to Production */}
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

                {/* Generate Cross-Post (Medium / Substack) */}
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

        {/* ── Input + actions: review phase ── */}
        {(isReviewing || isRevalidating) && !revalidating && (
          <div className="shrink-0">
            {/* Generate preview button */}
            {!previewFile && !streaming && (
              <button
                onClick={generatePreview}
                disabled={generatingPreview}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-medium mb-3 transition-colors"
                style={{ backgroundColor: "rgba(122, 158, 196, 0.1)", color: "var(--accent-blue)", border: "1px solid var(--accent-blue)" }}
              >
                {generatingPreview ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
                {generatingPreview ? "Generating preview..." : "Generate HTML Preview"}
              </button>
            )}

            <div className="mb-3">
              <textarea value={reviewEdit} onChange={(e) => setReviewEdit(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !streaming && reviewEdit.trim()) {
                    e.preventDefault();
                    editFinal();
                  }
                }}
                rows={3}
                placeholder="Describe what to change..."
                disabled={streaming}
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] resize-y mb-2"
                style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)", minHeight: "60px" }}
              />
              <div className="flex gap-2">
                <button onClick={editFinal} disabled={streaming || !reviewEdit.trim()}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium"
                  style={{
                    backgroundColor: reviewEdit.trim() ? "var(--accent-blue)" : "var(--border)",
                    color: reviewEdit.trim() ? "#fff" : "var(--text-muted)",
                  }}>
                  <RotateCcw size={14} /> Edit
                </button>
                <button onClick={approveFinal} disabled={streaming || revalidating}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium"
                  style={{ backgroundColor: "var(--accent-green)", color: "#fff" }}>
                  <ThumbsUp size={14} /> Approve &amp; Revalidate
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>
                {streaming ? "Editing..." : "Review the post. Request edits or approve to run Fact-Check & Originality Check."}
              </span>
              {activeSession && <span>Session: {activeSession.session_id}</span>}
            </div>
          </div>
        )}

        {/* ── Input + actions: normal step workflow ── */}
        {!isComplete && !isReviewing && !isRevalidating && (
          <div className="shrink-0">
            <div className="mb-3">
              <textarea value={userInput} onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !streaming) {
                    e.preventDefault();
                    if (hasDraft) { userInput.trim() ? reviseStep() : approveStep(); }
                    else runStep();
                  }
                }}
                rows={3}
                placeholder={hasDraft ? "Feedback to revise, or press approve..." : "Add context (optional)..."}
                disabled={streaming}
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] resize-y mb-2"
                style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)", minHeight: "60px" }}
              />
              <div className="flex gap-2">
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
      </div>{/* end right-side column */}
    </div>
  );
}
