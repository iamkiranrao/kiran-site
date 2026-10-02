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
  FileText,
  MessageSquare,
  Search,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { useApiKey } from "@/context/ApiKeyContext";
import ModuleHelp from "@/components/ModuleHelp";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Mirrors MAX_SOURCE_CHARS in the backend's wordweaver router. A sanity bound
// rather than a budget: the model's context window is far larger than this.
const MAX_SOURCE_CHARS = 200000;

/** "3 hours ago" for recent work, an absolute date once it stops being useful. */
function timeAgo(iso?: string): string {
  if (!iso) return "";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const mins = Math.floor((Date.now() - then.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Full timestamp for the hover tooltip. */
function fullTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

const BLOG_ABOUT: Record<number, string> = {
  1: "Settle what territory this post is in. Theme, angle, and whether it is a one-off or part of a series. Not the final angle - that comes after the research, because picking it now means picking blind.",
  2: "Searches the web for evidence, recent cases and counter-arguments, then puts up 3 to 5 topic options the research actually supports. Each one has a title, a claim that could be wrong, the data behind it and what it costs you. You pick one, redirect, or combine two.",
  3: "Writes the whole article. Not an outline - a complete draft you can read and react to. Where it needed something from you and did not have it, it writes the section anyway and marks it [KIRAN: ...], then lists what it is least sure about.",
  4: "The conversation about the draft. It tells you what the article argues, argues the strongest case against it, searches for who has said this already, and names where the evidence is thin. Then it asks you what is wrong, what is missing, and where your own read differs.",
  5: "Rewrites the article with everything you said worked in. Your corrections, your words kept verbatim where you gave them, the strongest objection addressed rather than avoided.",
  6: "Three passes over the rewrite. AI tells (a hard rule check plus the patterns a regex cannot see), then evidence weight, disclosure risk, hedging and voice, then fact-checks every claim against a primary source.",
  7: "Builds the publish set: the post with frontmatter, verified sources, the blog card description, and a LinkedIn version.",
};

const SOCIAL_ABOUT: Record<number, string> = {
  1: "Standalone or derived from a post? Which platform, and what format.",
  2: "Three visual concepts with the insight and caption for each.",
  3: "Builds the chosen visual at the right dimensions.",
  4: "The caption, hashtags and alt text.",
  5: "Final files.",
};

const BLOG_LABELS = [
  "Topic",
  "Research",
  "Draft",
  "React",
  "Rewrite",
  "Check",
  "Package",
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
  discussions?: Record<string, { role: string; content: string }[]>;
  title?: string;
  created_at?: string;
  updated_at?: string;
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
  const [showSource, setShowSource] = useState(true);
  const [sourceMaterial, setSourceMaterial] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  // Workflow state
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [userInput, setUserInput] = useState("");
  // Source material on an already-running session.
  const [editingSource, setEditingSource] = useState(false);
  const [sessionSource, setSessionSource] = useState("");
  const [sessionSourceLabel, setSessionSourceLabel] = useState("");
  const [savingSource, setSavingSource] = useState(false);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [stepWarnings, setStepWarnings] = useState<string[]>([]);
  const [stopPrompt, setStopPrompt] = useState<{ reason: string; verdict: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [discussion, setDiscussion] = useState<{ role: string; content: string }[]>([]);
  const [discussing, setDiscussing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [sourceSaved, setSourceSaved] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  // Steps 2, 10 and 11 run web searches server-side. Surface that, and surface
  // a step that searched zero times — its output is not verified.
  const handleStreamEvent = (event: { type: string; [k: string]: unknown }) => {
    if (event.type === "search_start") {
      setSearchNote(`Searching the web... up to ${event.max_uses} queries. This takes a few minutes.`);
      return true;
    }
    if (event.type === "search_progress") {
      setSearchNote(`Searching the web... ${event.searching} of ${event.max_uses}`);
      return true;
    }
    if (event.type === "search_complete") {
      const n = Number(event.searches ?? 0);
      const errs = (event.errors as string[] | undefined) || [];
      setSearchNote(
        n === 0
          ? "No searches ran."
          : `${n} web search${n === 1 ? "" : "es"} completed.` +
            (errs.length ? ` ${errs.length} failed (${errs.join(", ")}).` : "")
      );
      return true;
    }
    if (event.type === "warning") {
      setStepWarnings((w) => [...w, String(event.message)]);
      return true;
    }
    return false;
  };

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
    setCreateError(null);
    try {
      const payload: Record<string, string> = { mode };
      // Source material only seeds the blog pipeline.
      if (mode === "blog" && sourceMaterial.trim()) {
        payload.source_material = sourceMaterial.trim();
        if (sourceLabel.trim()) payload.source_label = sourceLabel.trim();
      }

      const res = await fetch(`${API_URL}/api/wordweaver/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data?.detail || `Could not start the session (HTTP ${res.status}).`);
        setLoading(false);
        return;
      }
      const sessRes = await fetch(`${API_URL}/api/wordweaver/sessions/${data.session_id}`);
      const session = await sessRes.json();
      setActiveSession(session);
      setView("workflow");
      setSessionSource(session.config?.source_material || "");
      setSessionSourceLabel(session.config?.source_label || "");
      setSourceMaterial("");
      setSourceLabel("");
      setShowSource(false);
      fetchSessions();
    } catch (e) {
      console.error("Failed to create session:", e);
      setCreateError("Could not reach the backend. Is it running?");
    }
    setLoading(false);
  };

  const saveSource = async () => {
    if (!activeSession) return;
    setSavingSource(true);
    setSourceSaved(false);
    try {
      const res = await fetch(`${API_URL}/api/wordweaver/sessions/${activeSession.session_id}/source`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_material: sessionSource,
          source_label: sessionSourceLabel || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data?.detail || `Could not save (HTTP ${res.status}).`);
        setSavingSource(false);
        return;
      }
      setActiveSession({
        ...activeSession,
        config: {
          ...activeSession.config,
          ...(sessionSource.trim()
            ? { source_material: sessionSource.trim(), source_label: data.source_label }
            : {}),
        },
      });
      setCreateError(null);
      setSourceSaved(true);
      setEditingSource(false);
      fetchSessions();
    } catch {
      setCreateError("Could not reach the backend.");
    }
    setSavingSource(false);
  };

  // Talk about the step without approving or regenerating it.
  const discussStep = async () => {
    if (!activeSession || !userInput.trim()) return;
    const question = userInput.trim();
    setUserInput("");
    setDiscussing(true);
    setDiscussion((d) => [...d, { role: "user", content: question }, { role: "assistant", content: "" }]);
    try {
      const res = await fetch(
        `${API_URL}/api/wordweaver/sessions/${activeSession.session_id}/discuss`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(apiKey ? { "X-Claude-Key": apiKey } : {}) },
          body: JSON.stringify({ message: question }),
        }
      );
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        setCreateError(err?.detail || `Could not start the discussion (HTTP ${res.status}).`);
        setDiscussion((d) => d.slice(0, -2));
        setDiscussing(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "", answer = "";
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
              answer += event.delta;
              setDiscussion((d) => {
                const next = [...d];
                next[next.length - 1] = { role: "assistant", content: answer };
                return next;
              });
            } else if (event.type === "error") {
              setCreateError(String(event.message));
            }
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      console.error("Discussion failed:", e);
      setCreateError("Could not reach the backend.");
    }
    setDiscussing(false);
  };

  const saveTitle = async () => {
    if (!activeSession) return;
    const title = titleDraft.trim();
    if (!title) { setEditingTitle(false); return; }
    setEditingTitle(false);
    try {
      const res = await fetch(`${API_URL}/api/wordweaver/sessions/${activeSession.session_id}/title`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (res.ok) {
        setActiveSession({ ...activeSession, title });
        fetchSessions();
      }
    } catch (e) {
      console.error("Rename failed:", e);
    }
  };

  const abandonSession = async () => {
    if (!activeSession) return;
    try {
      await fetch(`${API_URL}/api/wordweaver/sessions/${activeSession.session_id}/abandon`, {
        method: "POST",
      });
      setStopPrompt(null);
      setView("list");
      setActiveSession(null);
      setStreamText("");
      fetchSessions();
    } catch (e) {
      console.error("Abandon failed:", e);
    }
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
      setSessionSource(session.config?.source_material || "");
      setSessionSourceLabel(session.config?.source_label || "");
      setEditingSource(false);
      setSourceSaved(false);
      setDiscussion((session.discussions?.[String(session.current_step)] as never) || []);
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
            if (handleStreamEvent(event)) continue;
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
    setSearchNote(null);
    setStepWarnings([]);
    if (!activeSession) return;
    setLoading(true);
    try {
      const approveRes = await fetch(
        `${API_URL}/api/wordweaver/sessions/${activeSession.session_id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: userInput || "Approved" }),
        }
      );
      const approveData = await approveRes.json().catch(() => ({}));
      // Push Back and Who Else Said This can end a session honestly.
      if (approveData?.recommend_stop) {
        setStopPrompt({
          reason: String(approveData.stop_reason || "This claim did not survive review."),
          verdict: String(approveData.verdict || ""),
        });
      }
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
            if (handleStreamEvent(event)) continue;
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
  const aboutMap = activeSession?.mode === "social" ? SOCIAL_ABOUT : BLOG_ABOUT;
  const stepAbout = aboutMap[activeSession?.current_step || 1] || "";
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
            if (handleStreamEvent(event)) continue;
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
            if (handleStreamEvent(event)) continue;
            if (event.type === "revalidation_start") {
              setRevalidationStep(`Running Step ${event.step}: ${event.label}...`);
              fullText += `\n\n── Step ${event.step}: ${event.label} ──\n`;
              setStreamText(fullText);
            } else if (event.type === "text_delta") {
              fullText += event.delta;
              setStreamText(fullText);
            } else if (event.type === "revalidation_complete") {
              setRevalidationStep(null);
              if (event.message) setStepWarnings((w) => [...w, String(event.message)]);
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
              <a href="https://kiranrao.ai/blog/jpmorgan-llm-suite-ai-adoption.html"
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
                        {s.mode === "blog" ? <BookOpen size={14} className="shrink-0" /> : <Share2 size={14} className="shrink-0" />}
                        <span className="truncate" title={s.title || undefined}>
                          {s.title || (s.mode === "blog" ? "Blog Post" : "Social Post")}
                        </span>
                        {s.config?.theme && <span className="text-xs text-[var(--text-muted)] shrink-0">&middot; {s.config.theme}</span>}
                        {s.config?.source_material && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 font-normal"
                            style={{ backgroundColor: "rgba(122, 158, 196, 0.12)", color: "var(--accent-blue)" }}
                            title={s.config.source_label || "Seeded from source material"}>
                            <FileText size={9} /> seeded
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        Step {s.current_step}/{s.total_steps} &middot; {s.status}
                        {s.updated_at && (
                          <span title={`Last worked on ${fullTime(s.updated_at)}${s.created_at ? ` \u00b7 Started ${fullTime(s.created_at)}` : ""}`}>
                            {" "}&middot; {timeAgo(s.updated_at)}
                          </span>
                        )}
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
                <p className="text-xs text-[var(--text-secondary)]">7 steps: research, draft, react, rewrite, check, publish</p>
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

        {mode === "blog" && (
          <div className="mb-6 rounded-lg overflow-hidden"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-card)" }}>
            <div className="w-full px-4 py-3 flex items-center gap-3 text-left">
              <FileText size={18} className={sourceMaterial.trim() ? "text-[var(--accent-blue)]" : "text-[var(--text-muted)]"} />
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Start from source material <span className="text-xs font-normal text-[var(--text-muted)]">(optional)</span>
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {sourceMaterial.trim()
                    ? `${sourceMaterial.trim().length.toLocaleString()} characters pasted`
                    : "Paste a chat thread, notes or a transcript to build the post from"}
                </p>
              </div>
            </div>

            {showSource && (
              <div className="px-4 pb-4 space-y-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                <textarea
                  value={sourceMaterial}
                  onChange={(e) => setSourceMaterial(e.target.value)}
                  placeholder="Paste the whole thing — a full ChatGPT or Claude thread, meeting notes, a transcript. Labelled turns (You said / ChatGPT said, or USER: / ASSISTANT:) are split so your own words are kept intact."
                  rows={10}
                  className="w-full px-3 py-2 rounded-lg text-sm resize-y"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
                <input
                  value={sourceLabel}
                  onChange={(e) => setSourceLabel(e.target.value)}
                  placeholder="Where it came from (e.g. ChatGPT thread on responsible PM)"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[var(--text-muted)]">
                    Used as raw material, not a draft — its claims stay unverified until Step 10.
                  </p>
                  <p className="text-xs shrink-0 ml-3"
                    style={{ color: sourceMaterial.length > MAX_SOURCE_CHARS ? "var(--accent-red, #c0392b)" : "var(--text-muted)" }}>
                    {sourceMaterial.length.toLocaleString()} / {MAX_SOURCE_CHARS.toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {createError && (
          <p className="text-xs mb-3" style={{ color: "var(--accent-red, #c0392b)" }}>{createError}</p>
        )}

        <button onClick={handleCreate} disabled={loading || sourceMaterial.length > MAX_SOURCE_CHARS}
          className="w-full py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
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
            <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5 min-w-0 flex-1">
              {activeSession?.mode === "blog" ? <BookOpen size={14} className="shrink-0" /> : <Share2 size={14} className="shrink-0" />}
              {editingTitle ? (
                <input
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); saveTitle(); }
                    if (e.key === "Escape") setEditingTitle(false);
                  }}
                  className="flex-1 min-w-0 px-1.5 py-0.5 rounded text-sm font-semibold"
                  style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--accent-blue)", color: "var(--text-primary)" }}
                />
              ) : (
                <button
                  onClick={() => {
                    setTitleDraft(activeSession?.title || "");
                    setEditingTitle(true);
                  }}
                  className="truncate text-left hover:underline min-w-0"
                  title="Click to rename"
                >
                  {activeSession?.title || (activeSession?.mode === "blog" ? "Blog" : "Social")}
                </button>
              )}
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
                <p className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-1.5"
                  title={aboutMap[currentStep] || ""}>
                  Step {currentStep}: {stepLabels[currentStep - 1]}
                  {aboutMap[currentStep] && (
                    <HelpCircle size={12} className="text-[var(--text-muted)] shrink-0" />
                  )}
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
                      <button onClick={() => setShowPreview(true)}
                        className="underline text-[var(--accent-blue)]">
                        Show the rendered page here
                      </button>
                      {" "}or open <span className="font-mono text-[var(--text-primary)]">{previewFile}</span> in your browser.
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
              <div className="max-w-xl mx-auto px-6">
                <p className="mb-3 text-[var(--text-primary)] font-medium">
                  Step {activeSession?.current_step}: {stepLabels[(activeSession?.current_step || 1) - 1]}
                </p>
                <p className="text-sm text-left leading-relaxed mb-4">{stepAbout}</p>
                <p className="text-xs">Click &ldquo;Run Step&rdquo; to begin. Add context below if you want to steer it.</p>
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

        {stopPrompt && (
          <div className="shrink-0 mb-3 rounded-lg p-3"
            style={{ border: "1px solid var(--accent-red, #c0392b)", backgroundColor: "rgba(192, 57, 43, 0.06)" }}>
            <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
              This one may not be worth writing
            </p>
            <p className="text-xs text-[var(--text-secondary)] mb-3">{stopPrompt.reason}</p>
            <div className="flex gap-2">
              <button onClick={abandonSession}
                className="text-xs px-3 py-1.5 rounded font-medium"
                style={{ backgroundColor: "var(--accent-red, #c0392b)", color: "#fff" }}>
                Stop here
              </button>
              <button onClick={() => setStopPrompt(null)}
                className="text-xs px-3 py-1.5 rounded"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                Carry on anyway
              </button>
            </div>
          </div>
        )}

        {showPreview && activeSession && (
          <div className="shrink-0 mb-3 rounded-lg overflow-hidden"
            style={{ border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between px-3 py-2 border-b"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
              <p className="text-xs font-medium text-[var(--text-primary)]">Preview</p>
              <button onClick={() => setShowPreview(false)}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                Hide
              </button>
            </div>
            <iframe
              title="Post preview"
              src={`${API_URL}/api/wordweaver/sessions/${activeSession.session_id}/preview-html`}
              style={{ width: "100%", height: "520px", border: "none", backgroundColor: "#fff" }}
            />
          </div>
        )}

        {(searchNote || stepWarnings.length > 0) && (
          <div className="shrink-0 mb-3 space-y-1.5">
            {searchNote && (
              <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                <Search size={12} /> {searchNote}
              </p>
            )}
            {stepWarnings.map((wmsg, i) => (
              <p key={i} className="text-xs px-2.5 py-1.5 rounded flex items-start gap-1.5"
                style={{ backgroundColor: "rgba(192, 57, 43, 0.08)", color: "var(--accent-red, #c0392b)" }}>
                <AlertTriangle size={12} className="mt-0.5 shrink-0" /> <span>{wmsg}</span>
              </p>
            ))}
          </div>
        )}

        {/* ── Source material for this session ── */}
        {!isComplete && activeSession?.mode === "blog" && (
          <div className="shrink-0 mb-3 rounded-lg"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-card)" }}>
            <div className="px-3 py-2 flex items-center gap-2">
              <FileText size={14} className={sessionSource.trim() ? "text-[var(--accent-blue)]" : "text-[var(--text-muted)]"} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[var(--text-primary)]">
                  Source material
                  {sourceSaved && <span className="ml-2 text-[10px] text-[var(--accent-green)]">saved</span>}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] truncate">
                  {sessionSource.trim()
                    ? `${sessionSourceLabel || "pasted source"} — ${sessionSource.trim().length.toLocaleString()} chars`
                    : "None attached. Paste a thread or notes to build this post from."}
                </p>
              </div>
              <button onClick={() => setEditingSource(!editingSource)}
                className="text-xs px-2 py-1 rounded shrink-0"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                {editingSource ? "Cancel" : sessionSource.trim() ? "Edit" : "Add"}
              </button>
            </div>

            {editingSource && (
              <div className="px-3 pb-3 space-y-2 border-t pt-2" style={{ borderColor: "var(--border)" }}>
                <textarea
                  value={sessionSource}
                  onChange={(e) => { setSessionSource(e.target.value); setSourceSaved(false); }}
                  placeholder="Paste the raw material here — a ChatGPT thread, meeting notes, a transcript..."
                  rows={6}
                  className="w-full px-2 py-1.5 rounded text-xs resize-y"
                  style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
                <input
                  value={sessionSourceLabel}
                  onChange={(e) => setSessionSourceLabel(e.target.value)}
                  placeholder="Where it came from (optional)"
                  className="w-full px-2 py-1.5 rounded text-xs"
                  style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px]"
                    style={{ color: sessionSource.length > MAX_SOURCE_CHARS ? "var(--accent-red, #c0392b)" : "var(--text-muted)" }}>
                    {sessionSource.length.toLocaleString()} / {MAX_SOURCE_CHARS.toLocaleString()} &middot; applies to steps you run from here on
                  </p>
                  <button onClick={saveSource}
                    disabled={savingSource || sessionSource.length > MAX_SOURCE_CHARS}
                    className="text-xs px-3 py-1.5 rounded font-medium shrink-0 disabled:opacity-50"
                    style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}>
                    {savingSource ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Input + actions: normal step workflow ── */}
        {!isComplete && !isReviewing && !isRevalidating && (
          <div className="shrink-0">
            {createError && (
              <p className="text-xs mb-2" style={{ color: "var(--accent-red, #c0392b)" }}>{createError}</p>
            )}
            {discussion.length > 0 && (
              <div className="mb-3 max-h-64 overflow-y-auto rounded-lg p-3 space-y-3"
                style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                {discussion.map((turn, i) => (
                  <div key={i}>
                    <p className="text-[10px] uppercase tracking-wide mb-1"
                      style={{ color: turn.role === "user" ? "var(--accent-blue)" : "var(--text-muted)" }}>
                      {turn.role === "user" ? "You" : "WordWeaver"}
                    </p>
                    <p className="text-xs whitespace-pre-wrap text-[var(--text-primary)] leading-relaxed">
                      {turn.content || (discussing && i === discussion.length - 1 ? "..." : "")}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="mb-3">
              <textarea value={userInput} onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !streaming && !discussing) {
                    e.preventDefault();
                    if (hasDraft) { userInput.trim() ? discussStep() : approveStep(); }
                    else runStep();
                  }
                }}
                rows={3}
                placeholder={hasDraft ? "Ask about this step, push on something, or press Approve..." : "Add context (optional)..."}
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
                    <button onClick={discussStep} disabled={streaming || discussing || !userInput.trim()}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium"
                      style={{
                        backgroundColor: userInput.trim() ? "var(--accent-blue)" : "var(--border)",
                        color: userInput.trim() ? "#fff" : "var(--text-muted)",
                      }}
                      title="Ask about this step. Nothing is rewritten or advanced.">
                      {discussing ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
                      Discuss
                    </button>
                    <button onClick={reviseStep} disabled={streaming || discussing || !userInput.trim()}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium"
                      style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                      title="Throw this version away and regenerate it with your feedback and anything discussed.">
                      <RotateCcw size={14} /> Redo
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
                {hasDraft && (discussion.length > 0 ? `Draft ready - ${discussion.filter(t => t.role === "user").length} question(s) discussed` : "Draft ready - discuss it, approve it, or redo it")}
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
