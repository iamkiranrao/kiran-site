"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Wrench,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Plus,
  Globe,
  ArrowLeft,
  Send,
  ThumbsUp,
  RotateCcw,
  Key,
  ExternalLink,
  HelpCircle,
  Rocket,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useApiKey } from "@/context/ApiKeyContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const STEP_LABELS = [
  "Real User Pain Points",
  "Persona & Journey Map",
  "JTBD Framework",
  "Keep / Kill / Build",
  "Redesign & Wireframes",
  "Business Case & KPIs",
  "PM Score & Stress Test",
  "AI-Detection Sweep & Content",
];

interface Session {
  session_id: string;
  company: string;
  product: string;
  current_step: number;
  status: string;
  steps: Record<string, { content: string; status: string }>;
}

type View = "list" | "create" | "workflow";

export default function TeardownsPage() {
  const { apiKey, isKeySet } = useApiKey();
  const [view, setView] = useState<View>("list");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);

  // Create form
  const [company, setCompany] = useState("");
  const [product, setProduct] = useState("");

  // Workflow state
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [userInput, setUserInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/teardown/sessions`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch {
      // Server might not be running
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [streamText]);

  const handleCreate = async () => {
    if (!company.trim() || !product.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/teardown/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, product }),
      });
      const data = await res.json();
      // Load the full session
      const sessRes = await fetch(`${API_URL}/api/teardown/sessions/${data.session_id}`);
      const session = await sessRes.json();
      setActiveSession(session);
      setView("workflow");
      setCompany("");
      setProduct("");
      fetchSessions();
    } catch (e) {
      console.error("Failed to create session:", e);
      setError("Failed to create session. Is the backend running on port 8000?");
    }
    setLoading(false);
  };

  const deleteSessionById = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this session? This can't be undone.")) return;
    try {
      await fetch(`${API_URL}/api/teardown/sessions/${id}`, { method: "DELETE" });
      fetchSessions();
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  const openSession = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/teardown/sessions/${id}`);
      const session = await res.json();
      setActiveSession(session);
      setView("workflow");
      // Show existing draft if present
      const stepData = session.steps?.[String(session.current_step)];
      if (stepData?.content) {
        setStreamText(stepData.content);
      } else {
        setStreamText("");
      }
    } catch (e) {
      console.error("Failed to load session:", e);
    }
    setLoading(false);
  };

  const runStep = async (input?: string) => {
    if (!activeSession || !apiKey || streaming) return;
    setStreaming(true);
    setStreamText("");
    setError(null);

    try {
      const res = await fetch(
        `${API_URL}/api/teardown/sessions/${activeSession.session_id}/step`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey && apiKey !== "__backend__" ? { "X-Claude-Key": apiKey } : {}),
          },
          body: JSON.stringify({ user_input: input || userInput || null }),
        }
      );

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

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
          } catch {
            // skip
          }
        }
      }

      // Reload session state
      const sessRes = await fetch(
        `${API_URL}/api/teardown/sessions/${activeSession.session_id}`
      );
      const updated = await sessRes.json();
      setActiveSession(updated);
    } catch (e) {
      console.error("Step failed:", e);
      setError(e instanceof Error ? e.message : "Step generation failed. Check your API key and try again.");
    }

    setStreaming(false);
    setUserInput("");
  };

  const approveStep = async () => {
    if (!activeSession) return;
    setLoading(true);
    try {
      await fetch(
        `${API_URL}/api/teardown/sessions/${activeSession.session_id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: userInput || "Approved" }),
        }
      );
      // Reload session
      const res = await fetch(
        `${API_URL}/api/teardown/sessions/${activeSession.session_id}`
      );
      const updated = await res.json();
      setActiveSession(updated);
      setStreamText("");
      setUserInput("");
      fetchSessions();
    } catch (e) {
      console.error("Approve failed:", e);
      setError("Failed to approve step. Please try again.");
    }
    setLoading(false);
  };

  const reviseStep = async () => {
    if (!activeSession || !apiKey || !userInput.trim()) return;
    setStreaming(true);
    setStreamText("");

    try {
      const res = await fetch(
        `${API_URL}/api/teardown/sessions/${activeSession.session_id}/revise`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey && apiKey !== "__backend__" ? { "X-Claude-Key": apiKey } : {}),
          },
          body: JSON.stringify({ feedback: userInput }),
        }
      );

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

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
          } catch {
            // skip
          }
        }
      }

      const sessRes = await fetch(
        `${API_URL}/api/teardown/sessions/${activeSession.session_id}`
      );
      setActiveSession(await sessRes.json());
    } catch (e) {
      console.error("Revise failed:", e);
      setError("Revision failed. Please try again.");
    }
    setStreaming(false);
    setUserInput("");
  };

  const goToStep = async (step: number) => {
    if (!activeSession || streaming || loading) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/teardown/sessions/${activeSession.session_id}/goto-step`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to navigate");
      }
      // Reload session
      const sessRes = await fetch(
        `${API_URL}/api/teardown/sessions/${activeSession.session_id}`
      );
      const updated = await sessRes.json();
      setActiveSession(updated);
      // Show the content of that step if it exists
      const stepData = updated.steps?.[String(step)];
      setStreamText(stepData?.content || "");
      setUserInput("");
    } catch (e) {
      console.error("Go to step failed:", e);
      setError("Failed to navigate to step");
    }
    setLoading(false);
  };

  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<string | null>(null);

  // Save locally for preview
  const publishTeardown = async () => {
    if (!activeSession) return;
    setPublishing(true);
    setPublishResult(null);
    try {
      const step8 = activeSession.steps?.["8"];
      if (!step8?.content) {
        setPublishResult("Error: Step 8 content not found");
        setPublishing(false);
        return;
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey && apiKey !== "__backend__") {
        headers["X-Claude-Key"] = apiKey;
      }

      const res = await fetch(
        `${API_URL}/api/teardown/sessions/${activeSession.session_id}/publish`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ html_content: step8.content }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        setPublishResult(`Error: ${err.detail || "Preview failed"}`);
      } else {
        const data = await res.json();
        setPublishResult(data.message || "Saved locally! Open the file to preview.");
        const sessRes = await fetch(
          `${API_URL}/api/teardown/sessions/${activeSession.session_id}`
        );
        setActiveSession(await sessRes.json());
        fetchSessions();
      }
    } catch (e) {
      console.error("Preview failed:", e);
      setPublishResult(`Error: ${e instanceof Error ? e.message : "Network error"}`);
    }
    setPublishing(false);
  };

  // Deploy to production (git push → Netlify)
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<string | null>(null);

  const deployTeardown = async () => {
    if (!activeSession) return;
    setDeploying(true);
    setDeployResult(null);
    try {
      const res = await fetch(
        `${API_URL}/api/teardown/sessions/${activeSession.session_id}/deploy`,
        { method: "POST" }
      );

      if (!res.ok) {
        const err = await res.json();
        setDeployResult(`Error: ${err.detail || "Deploy failed"}`);
      } else {
        const data = await res.json();
        setDeployResult(data.url ? `Live at: ${data.url}` : "Deployed to production!");
        await fetchSessions();
        // Return to list view so the user sees the teardown under Published
        setActiveSession(null);
        setView("list");
      }
    } catch (e) {
      console.error("Deploy failed:", e);
      setDeployResult(`Error: ${e instanceof Error ? e.message : "Network error"}`);
    }
    setDeploying(false);
  };

  const currentStepData = activeSession?.steps?.[String(activeSession.current_step)];
  const hasDraft = currentStepData?.status === "draft";
  const isApproved = currentStepData?.status === "approved";
  const isComplete = activeSession?.status === "ready_to_publish" || activeSession?.status === "published" || activeSession?.status === "previewing";

  // ── List View ─────────────────────────────────────────────

  if (view === "list") {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Wrench size={24} className="text-[var(--accent-amber)]" />
              <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
                Teardown Builder
              </h1>
              <Link href="/dashboard/help?module=teardowns"
                className="text-[var(--text-muted)] hover:text-[var(--accent-amber)] transition-colors"
                title="Help & Documentation">
                <HelpCircle size={18} />
              </Link>
            </div>
            <p className="text-[var(--text-secondary)] text-sm">
              8-step co-creation workflow for product teardowns.
            </p>
          </div>
          <button
            onClick={() => setView("create")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: "var(--accent-amber)",
              color: "#fff",
            }}
          >
            <Plus size={16} />
            New Teardown
          </button>
        </div>

        {!isKeySet && (
          <div
            className="mb-6 p-4 rounded-lg border flex items-start gap-3"
            style={{
              backgroundColor: "rgba(212, 167, 74, 0.08)",
              borderColor: "var(--accent-amber)",
            }}
          >
            <Key size={18} className="text-[var(--accent-amber)] mt-0.5 shrink-0" />
            <p className="text-sm text-[var(--text-secondary)]">
              Claude API key required for the co-creation workflow.
            </p>
          </div>
        )}

        {/* Published teardowns */}
        <div
          className="rounded-lg p-5 mb-5"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <Globe size={14} className="text-[var(--accent-green)]" />
            Published
          </h3>
          <div className="space-y-2.5">
            {/* Hardcoded legacy teardowns */}
            {[
              { name: "Meta / Instagram", url: "https://kirangorapalli.com/teardowns/meta-instagram.html" },
              { name: "GEICO / Mobile App", url: "https://kirangorapalli.com/teardowns/geico-mobile-app.html" },
              { name: "Intuit / TurboTax", url: "https://kirangorapalli.com/teardowns/intuit-turbo-tax.html" },
              { name: "Airbnb / Mobile App", url: "https://kirangorapalli.com/teardowns/airbnb-mobile.html" },
              { name: "Spotify / Playlist Discovery", url: "https://kirangorapalli.com/teardowns/spotify-playlist-discovery.html" },
            ].map((td, i) => (
              <div key={`legacy-${i}`} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-[var(--text-primary)]">{td.name}</span>
                <a
                  href={td.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--accent-blue)] flex items-center gap-1 hover:underline"
                >
                  View <ExternalLink size={10} />
                </a>
              </div>
            ))}
            {/* Dynamically deployed teardowns from Command Center */}
            {sessions
              .filter((s) => s.status === "published")
              .map((s) => {
                const slug = `${s.company.toLowerCase().replace(/\s+/g, "-")}-${s.product.toLowerCase().replace(/\s+/g, "-")}`;
                const url = `https://kirangorapalli.com/teardowns/${slug}.html`;
                return (
                  <div key={s.session_id} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-[var(--text-primary)]">
                      {s.company} / {s.product}
                    </span>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--accent-blue)] flex items-center gap-1 hover:underline"
                    >
                      View <ExternalLink size={10} />
                    </a>
                  </div>
                );
              })}
          </div>
        </div>

        {/* In-progress sessions (exclude published) */}
        {sessions.filter((s) => s.status !== "published").length > 0 && (
          <div
            className="rounded-lg p-5"
            style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">
              In Progress
            </h3>
            <div className="space-y-2">
              {sessions
                .filter((s) => s.status !== "published")
                .map((s) => (
                <div
                  key={s.session_id}
                  className="flex items-center gap-2"
                >
                  <button
                    onClick={() => openSession(s.session_id)}
                    className="flex-1 flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors hover:opacity-80"
                    style={{
                      backgroundColor: "var(--bg-secondary)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div>
                      <p className="text-sm text-[var(--text-primary)] font-medium">
                        {s.company} / {s.product}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        Step {s.current_step}/8 &middot; {s.status}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-[var(--text-muted)]" />
                  </button>
                  <button
                    onClick={(e) => deleteSessionById(s.session_id, e)}
                    className="p-2 rounded-lg transition-colors hover:opacity-80"
                    style={{ color: "var(--text-muted)" }}
                    title="Delete session"
                  >
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
        <button
          onClick={() => setView("list")}
          className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-6 transition-colors"
        >
          <ArrowLeft size={14} /> Back
        </button>

        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-1">
          New Teardown
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Choose a company and product to tear down.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
              Company
            </label>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g., Spotify, Uber, Airbnb"
              className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
              Product
            </label>
            <input
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="e.g., Mobile App, Search, Marketplace"
              className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={!company.trim() || !product.trim() || loading}
            className="w-full py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all"
            style={{
              backgroundColor:
                company.trim() && product.trim()
                  ? "var(--accent-amber)"
                  : "var(--border)",
              color:
                company.trim() && product.trim() ? "#fff" : "var(--text-muted)",
              cursor:
                company.trim() && product.trim() ? "pointer" : "not-allowed",
            }}
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Play size={16} />
            )}
            Start Co-Creation
          </button>
        </div>
      </div>
    );
  }

  // ── Workflow View ──────────────────────────────────────────

  return (
    <div className="h-full flex flex-col" style={{ maxHeight: "calc(100vh - 2rem)" }}>
      {/* Error Banner */}
      {error && (
        <div className="shrink-0 px-6 py-3 bg-red-500/10 border-b border-red-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 text-xs font-medium">
            Dismiss
          </button>
        </div>
      )}
      {/* Top Bar */}
      <div className="shrink-0 px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setView("list"); setStreamText(""); setActiveSession(null); }}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                {activeSession?.company} / {activeSession?.product}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {isComplete
                  ? "All steps complete"
                  : `Step ${activeSession?.current_step}/8 — ${STEP_LABELS[(activeSession?.current_step || 1) - 1]}`}
              </p>
            </div>
          </div>

          {isComplete && (
            <span className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{
                backgroundColor: "rgba(107, 158, 107, 0.15)",
                color: "var(--accent-green)",
              }}
            >
              {activeSession?.status === "published" ? "Published" : "Ready to Publish"}
            </span>
          )}
        </div>

        {/* Step indicators with navigation */}
        <div className="flex items-center gap-2 mt-3 mb-2">
          <button
            onClick={() => goToStep((activeSession?.current_step || 1) - 1)}
            disabled={streaming || loading || (activeSession?.current_step || 1) <= 1}
            className="shrink-0 p-1 rounded transition-colors"
            style={{
              color: (activeSession?.current_step || 1) > 1 ? "var(--text-secondary)" : "var(--border)",
            }}
            title="Previous step"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="flex gap-1.5 flex-1">
            {STEP_LABELS.map((label, idx) => {
              const stepNum = idx + 1;
              const stepData = activeSession?.steps?.[String(stepNum)];
              const isCurrent = stepNum === activeSession?.current_step;
              const isApproved = stepData?.status === "approved";
              // Can click if step is approved, has a draft, or is the next step after last approved
              const maxApproved = Object.entries(activeSession?.steps || {}).reduce((max, [k, v]: [string, any]) => v?.status === "approved" ? Math.max(max, Number(k)) : max, 0);
              const canClick = stepNum <= maxApproved + 1 && !streaming && !loading;

              return (
                <div
                  key={stepNum}
                  className={`flex-1 flex flex-col items-center gap-1 ${canClick ? "cursor-pointer" : ""}`}
                  title={`Step ${stepNum}: ${label}`}
                  onClick={() => canClick && stepNum !== activeSession?.current_step && goToStep(stepNum)}
                >
                  <div
                    className="w-full h-1.5 rounded-full transition-all"
                    style={{
                      backgroundColor: isApproved
                        ? "var(--accent-green)"
                        : isCurrent
                        ? "var(--accent-amber)"
                        : "var(--border)",
                    }}
                  />
                  <span
                    className="text-[8px] leading-tight text-center"
                    style={{
                      color: isCurrent
                        ? "var(--text-primary)"
                        : isApproved
                        ? "var(--accent-green)"
                        : "var(--text-muted)",
                      fontWeight: isCurrent ? 600 : 400,
                    }}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => {
              const maxApproved = Object.entries(activeSession?.steps || {}).reduce((max, [k, v]: [string, any]) => v?.status === "approved" ? Math.max(max, Number(k)) : max, 0);
              const next = (activeSession?.current_step || 1) + 1;
              if (next <= maxApproved + 1 && next <= 8) goToStep(next);
            }}
            disabled={streaming || loading || (() => {
              const maxApproved = Object.entries(activeSession?.steps || {}).reduce((max, [k, v]: [string, any]) => v?.status === "approved" ? Math.max(max, Number(k)) : max, 0);
              return (activeSession?.current_step || 1) >= maxApproved + 1 || (activeSession?.current_step || 1) >= 8;
            })()}
            className="shrink-0 p-1 rounded transition-colors"
            style={{
              color: "var(--text-secondary)",
            }}
            title="Next step"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col px-6 py-4 min-h-0">
        {/* Output Area */}
        <div
          ref={outputRef}
          className="flex-1 overflow-y-auto rounded-lg p-5 mb-4 text-sm leading-relaxed whitespace-pre-wrap"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
            minHeight: 0,
          }}
        >
          {streamText ? (
            streamText
          ) : streaming ? (
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <Loader2 size={14} className="animate-spin" />
              Claude is researching...
            </div>
          ) : (
            <div className="text-[var(--text-muted)] text-center py-8">
              {isComplete ? (
                <div>
                  <CheckCircle2 size={28} className="mx-auto mb-2 text-[var(--accent-green)]" />
                  <p>All 8 steps complete. {activeSession?.status === "published" ? "Published." : "Ready to publish."}</p>
                </div>
              ) : (
                <div>
                  <p className="mb-2">
                    Step {activeSession?.current_step}: {STEP_LABELS[(activeSession?.current_step || 1) - 1]}
                  </p>
                  <p className="text-xs">
                    Click &ldquo;Run Step&rdquo; to have Claude research and draft this step.
                    You can add context in the input below.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input + Actions Bar */}
        <div className="shrink-0">
          {!isComplete && (
            <div className="flex gap-2 mb-3">
              <input
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !streaming) {
                    e.preventDefault();
                    if (hasDraft) {
                      // Enter with text = revise, Enter with no text = approve
                      if (userInput.trim()) reviseStep();
                      else approveStep();
                    } else if (!isApproved) {
                      runStep();
                    }
                  }
                }}
                placeholder={
                  hasDraft
                    ? "Type feedback to revise, or approve to continue..."
                    : isApproved
                    ? "Add context for Claude (optional) to re-run this step..."
                    : "Add context for Claude (optional)..."
                }
                disabled={streaming}
                className="flex-1 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />

              {hasDraft ? (
                <>
                  <button
                    onClick={approveStep}
                    disabled={streaming || loading}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: "var(--accent-green)",
                      color: "#fff",
                    }}
                    title="Approve this step and move to the next"
                  >
                    <ThumbsUp size={14} />
                    Approve
                  </button>
                  <button
                    onClick={reviseStep}
                    disabled={streaming || loading || !userInput.trim()}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: userInput.trim()
                        ? "var(--accent-blue)"
                        : "var(--border)",
                      color: userInput.trim() ? "#fff" : "var(--text-muted)",
                    }}
                    title="Request revision with your feedback"
                  >
                    <RotateCcw size={14} />
                    Revise
                  </button>
                </>
              ) : isApproved ? (
                <button
                  onClick={() => runStep()}
                  disabled={streaming || !isKeySet}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: isKeySet
                      ? "var(--accent-amber)"
                      : "var(--border)",
                    color: isKeySet ? "#fff" : "var(--text-muted)",
                  }}
                  title="Re-run this step with new context"
                >
                  {streaming ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <RotateCcw size={14} />
                  )}
                  Re-run
                </button>
              ) : (
                <button
                  onClick={() => runStep()}
                  disabled={streaming || !isKeySet}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: isKeySet
                      ? "var(--accent-amber)"
                      : "var(--border)",
                    color: isKeySet ? "#fff" : "var(--text-muted)",
                  }}
                >
                  {streaming ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                  Run Step
                </button>
              )}
            </div>
          )}

          {/* Action buttons — shown when all 8 steps are complete */}
          {isComplete && (
            <div className="flex flex-col items-center gap-2 mb-3">
              {/* Step 1: Preview (save locally) */}
              <div className="flex gap-2">
                <button
                  onClick={publishTeardown}
                  disabled={publishing || deploying}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                  style={{
                    backgroundColor: publishing ? "var(--border)" : "var(--accent-amber)",
                    color: "#fff",
                  }}
                >
                  {publishing ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Rocket size={15} />
                  )}
                  {publishing
                    ? "Generating page..."
                    : activeSession?.status === "previewing" || activeSession?.status === "published"
                      ? "Re-generate Preview"
                      : "Generate Preview"}
                </button>

                {/* Step 2: Deploy (push to production) — only after preview */}
                {(activeSession?.status === "previewing" || activeSession?.status === "published") && (
                  <button
                    onClick={deployTeardown}
                    disabled={deploying || publishing}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                    style={{
                      backgroundColor: deploying ? "var(--border)" : "var(--accent-green)",
                      color: "#fff",
                    }}
                  >
                    {deploying ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Globe size={15} />
                    )}
                    {deploying ? "Deploying..." : activeSession?.status === "published" ? "Re-deploy" : "Deploy to Production"}
                  </button>
                )}
              </div>

              {/* Feedback messages */}
              {publishResult && (
                <p className="text-xs text-center" style={{ color: publishResult.startsWith("Error") ? "var(--accent-red, #ef4444)" : "var(--accent-amber)" }}>
                  {publishResult}
                </p>
              )}
              {deployResult && (
                <p className="text-xs text-center" style={{ color: deployResult.startsWith("Error") ? "var(--accent-red, #ef4444)" : "var(--accent-green)" }}>
                  {deployResult}
                </p>
              )}
              {activeSession?.status === "published" && !deployResult && !publishResult && (
                <p className="text-xs text-center" style={{ color: "var(--accent-green)" }}>
                  ✓ Live on production
                </p>
              )}
            </div>
          )}

          {/* Step summary */}
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>
              {hasDraft && "Draft ready — approve to advance, or type feedback to revise"}
              {!hasDraft && !streaming && !isComplete && "Run the step to see Claude's research and draft"}
              {streaming && "Streaming response from Claude..."}
              {isComplete && "All steps approved"}
            </span>
            {activeSession && (
              <span>Session: {activeSession.session_id}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
