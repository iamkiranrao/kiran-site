"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Lightbulb,
  Plus,
  Globe,
  ArrowLeft,
  Loader2,
  Key,
  ExternalLink,
  HelpCircle,
  Rocket,
  Trash2,
  ChevronRight,
  Sparkles,
  Save,
} from "lucide-react";
import Link from "next/link";
import { useApiKey } from "@/context/ApiKeyContext";
import ModuleHelp from "@/components/ModuleHelp";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const CATEGORIES = [
  "Chatbots & AI Assistants",
  "Agentic AI",
  "Voice & Audio AI",
  "Computer Vision",
  "Browser Extensions",
  "Data & Visualisations",
  "Automations & Workflows",
];

type Session = {
  session_id: string;
  project_name: string;
  project_slug: string;
  category: string;
  status: string;
  content: {
    tagline: string;
    meta_description: string;
    tags: string[];
    launch_url: string;
    project_status: string;
    glossary: { term: string; definition: string }[];
    details_html: string;
    architecture_html: string;
    try_it_html: string;
    related_html: string;
  };
  created_at: string;
  updated_at: string;
};

export default function MadLabPage() {
  const { apiKey, isKeySet } = useApiKey();
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Create form
  const [projectName, setProjectName] = useState("");
  const [projectSlug, setProjectSlug] = useState("");
  const [category, setCategory] = useState("");

  // Edit form fields
  const [tagline, setTagline] = useState("");
  const [metaDesc, setMetaDesc] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [launchUrl, setLaunchUrl] = useState("index.html");
  const [detailsHtml, setDetailsHtml] = useState("");
  const [architectureHtml, setArchitectureHtml] = useState("");
  const [tryItHtml, setTryItHtml] = useState("");
  const [relatedHtml, setRelatedHtml] = useState("");
  const [draftContext, setDraftContext] = useState("");

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/madlab/sessions`);
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (e) {
      console.error("Failed to fetch sessions:", e);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleProjectNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setProjectName(name);
    setProjectSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
  };

  const handleCreate = async () => {
    if (!projectName.trim() || !projectSlug.trim() || !category) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/madlab/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_name: projectName, project_slug: projectSlug, category }),
      });
      const session = await res.json();
      loadSession(session.session_id);
      setProjectName("");
      setProjectSlug("");
      setCategory("");
      fetchSessions();
    } catch (e) {
      setError("Failed to create session");
    }
    setLoading(false);
  };

  const loadSession = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/madlab/sessions/${id}`);
      const session: Session = await res.json();
      setActiveSession(session);
      // Populate form fields
      const c = session.content;
      setTagline(c.tagline || "");
      setMetaDesc(c.meta_description || "");
      setTagsStr((c.tags || []).join(", "));
      setLaunchUrl(c.launch_url || "index.html");
      setDetailsHtml(c.details_html || "");
      setArchitectureHtml(c.architecture_html || "");
      setTryItHtml(c.try_it_html || "");
      setRelatedHtml(c.related_html || "");
      setView("edit");
    } catch (e) {
      setError("Failed to load session");
    }
    setLoading(false);
  };

  const saveContent = async () => {
    if (!activeSession) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(
        `${API_URL}/api/madlab/sessions/${activeSession.session_id}/content`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tagline,
            meta_description: metaDesc,
            tags: tagsStr.split(",").map((t) => t.trim()).filter(Boolean),
            launch_url: launchUrl,
            details_html: detailsHtml,
            architecture_html: architectureHtml,
            try_it_html: tryItHtml,
            related_html: relatedHtml,
          }),
        }
      );
      const updated = await res.json();
      setActiveSession(updated);
      setMessage("Saved");
      setTimeout(() => setMessage(null), 2000);
    } catch (e) {
      setError("Failed to save");
    }
    setLoading(false);
  };

  const draftWithClaude = async () => {
    if (!activeSession || !apiKey) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_URL}/api/madlab/sessions/${activeSession.session_id}/draft`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey && apiKey !== "__backend__" ? { "X-Claude-Key": apiKey } : {}),
          },
          body: JSON.stringify({ extra_context: draftContext }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(err.detail || "Draft failed");
      }
      const updated: Session = await res.json();
      setActiveSession(updated);
      // Refresh form fields from Claude's draft
      const c = updated.content;
      setTagline(c.tagline || "");
      setMetaDesc(c.meta_description || "");
      setTagsStr((c.tags || []).join(", "));
      setDetailsHtml(c.details_html || "");
      setArchitectureHtml(c.architecture_html || "");
      setTryItHtml(c.try_it_html || "");
      setRelatedHtml(c.related_html || "");
      setMessage("Draft generated — review and edit below");
      setTimeout(() => setMessage(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Draft failed");
    }
    setLoading(false);
  };

  const publishPreview = async () => {
    if (!activeSession) return;
    setLoading(true);
    setMessage(null);
    try {
      // Save first
      await saveContent();
      const res = await fetch(
        `${API_URL}/api/madlab/sessions/${activeSession.session_id}/publish`,
        { method: "POST" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Publish failed" }));
        throw new Error(err.detail);
      }
      const data = await res.json();
      setMessage(`Preview saved to ${data.local_file}`);
      // Reload session to get updated status
      const sessRes = await fetch(`${API_URL}/api/madlab/sessions/${activeSession.session_id}`);
      setActiveSession(await sessRes.json());
      fetchSessions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    }
    setLoading(false);
  };

  const deployToProduction = async () => {
    if (!activeSession) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(
        `${API_URL}/api/madlab/sessions/${activeSession.session_id}/deploy`,
        { method: "POST" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Deploy failed" }));
        throw new Error(err.detail);
      }
      const data = await res.json();
      setMessage(data.url ? `Live at: ${data.url}` : "Deployed to production!");
      const sessRes = await fetch(`${API_URL}/api/madlab/sessions/${activeSession.session_id}`);
      setActiveSession(await sessRes.json());
      fetchSessions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deploy failed");
    }
    setLoading(false);
  };

  const deleteSessionById = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this session?")) return;
    await fetch(`${API_URL}/api/madlab/sessions/${id}`, { method: "DELETE" });
    fetchSessions();
  };

  // ── Shared styles ──────────────────────────────────────────────
  const inputStyle = {
    backgroundColor: "var(--bg-card)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
  };

  const labelClass = "block text-sm font-medium text-[var(--text-primary)] mb-1.5";

  const textareaClass =
    "w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] font-mono";

  // ── List View ──────────────────────────────────────────────────

  if (view === "list") {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Lightbulb size={24} className="text-[#67e8f9]" />
              <h1 className="text-2xl font-semibold text-[var(--text-primary)]">MadLab</h1>
              <ModuleHelp moduleSlug="madlab" />
              <Link
                href="/dashboard/help?module=madlab"
                className="text-[var(--text-muted)] hover:text-[#67e8f9] transition-colors"
                title="Help & Documentation"
              >
                <HelpCircle size={18} />
              </Link>
            </div>
            <p className="text-[var(--text-secondary)] text-sm">
              Build overview pages for your prototypes.
            </p>
          </div>
          <button
            onClick={() => setView("create")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{ backgroundColor: "#67e8f9", color: "#000" }}
          >
            <Plus size={16} />
            New Prototype
          </button>
        </div>

        {!isKeySet && (
          <div
            className="mb-6 p-4 rounded-lg border flex items-start gap-3"
            style={{ backgroundColor: "rgba(103, 232, 249, 0.08)", borderColor: "#67e8f9" }}
          >
            <Key size={18} className="text-[#67e8f9] mt-0.5 shrink-0" />
            <p className="text-sm text-[var(--text-secondary)]">
              Claude API key needed for &ldquo;Draft with Claude&rdquo; (optional — you can write content manually).
            </p>
          </div>
        )}

        {/* Published */}
        {sessions.filter((s) => s.status === "published").length > 0 && (
          <div
            className="rounded-lg p-5 mb-5"
            style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <Globe size={14} className="text-[var(--accent-green)]" />
              Published
            </h3>
            <div className="space-y-2.5">
              {sessions
                .filter((s) => s.status === "published")
                .map((s) => (
                  <div key={s.session_id} className="flex items-center justify-between py-1.5">
                    <button
                      onClick={() => loadSession(s.session_id)}
                      className="text-sm text-[var(--text-primary)] hover:underline text-left"
                    >
                      {s.project_name}
                    </button>
                    <a
                      href={`https://kiranrao.ai/prototypes/${s.project_slug}/overview.html`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--accent-blue)] flex items-center gap-1 hover:underline"
                    >
                      View <ExternalLink size={10} />
                    </a>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* In progress */}
        {sessions.filter((s) => s.status !== "published").length > 0 && (
          <div
            className="rounded-lg p-5"
            style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">In Progress</h3>
            <div className="space-y-2">
              {sessions
                .filter((s) => s.status !== "published")
                .map((s) => (
                  <div key={s.session_id} className="flex items-center gap-2">
                    <button
                      onClick={() => loadSession(s.session_id)}
                      className="flex-1 flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors hover:opacity-80"
                      style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}
                    >
                      <div>
                        <p className="text-sm text-[var(--text-primary)] font-medium">{s.project_name}</p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          {s.category} &middot; {s.status}
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

        {sessions.length === 0 && (
          <div className="text-center py-12 text-[var(--text-muted)] text-sm">
            No prototypes yet. Click &ldquo;New Prototype&rdquo; to get started.
          </div>
        )}
      </div>
    );
  }

  // ── Create View ────────────────────────────────────────────────

  if (view === "create") {
    return (
      <div className="max-w-lg mx-auto px-6 py-8">
        <button
          onClick={() => setView("list")}
          className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-6 transition-colors"
        >
          <ArrowLeft size={14} /> Back
        </button>

        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-1">New Prototype</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Create an overview page for a prototype.
        </p>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>Project Name</label>
            <input
              value={projectName}
              onChange={handleProjectNameChange}
              placeholder="e.g., Insurance AI Assistant"
              className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
              style={inputStyle}
            />
          </div>
          <div>
            <label className={labelClass}>Slug</label>
            <input
              value={projectSlug}
              onChange={(e) => setProjectSlug(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
              style={inputStyle}
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">URL path: /prototypes/{projectSlug}/overview.html</p>
          </div>
          <div>
            <label className={labelClass}>Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
              style={inputStyle}
            >
              <option value="">Select...</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleCreate}
            disabled={!projectName.trim() || !projectSlug.trim() || !category || loading}
            className="w-full py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all"
            style={{
              backgroundColor: projectName.trim() && projectSlug.trim() && category ? "#67e8f9" : "var(--border)",
              color: projectName.trim() && projectSlug.trim() && category ? "#000" : "var(--text-muted)",
            }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Create & Edit
          </button>
        </div>
      </div>
    );
  }

  // ── Edit View ──────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setView("list"); setActiveSession(null); setError(null); setMessage(null); }}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {activeSession?.project_name}
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              {activeSession?.category} &middot; {activeSession?.status}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeSession?.status === "published" && (
            <span className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{ backgroundColor: "rgba(16,185,129,0.15)", color: "#10b981" }}>
              Published
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-between">
          <span className="text-red-400 text-sm">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 text-xs font-medium">Dismiss</button>
        </div>
      )}
      {message && (
        <div className="mb-4 px-4 py-3 rounded-lg border text-sm"
          style={{ backgroundColor: "rgba(103, 232, 249, 0.08)", borderColor: "#67e8f9", color: "#67e8f9" }}>
          {message}
        </div>
      )}

      {/* Claude Draft */}
      <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={14} className="text-[#67e8f9]" />
          <span className="text-sm font-medium text-[var(--text-primary)]">Draft with Claude</span>
          <span className="text-xs text-[var(--text-muted)]">(optional)</span>
        </div>
        <div className="flex gap-2">
          <input
            value={draftContext}
            onChange={(e) => setDraftContext(e.target.value)}
            placeholder="Extra context about this prototype..."
            className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
            style={inputStyle}
          />
          <button
            onClick={draftWithClaude}
            disabled={loading || !isKeySet}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: isKeySet ? "#67e8f9" : "var(--border)",
              color: isKeySet ? "#000" : "var(--text-muted)",
            }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Draft
          </button>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-2">
          Generates content for all sections below. You can edit everything after.
        </p>
      </div>

      {/* Content Form */}
      <div className="space-y-5">
        <div>
          <label className={labelClass}>Tagline</label>
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="One sentence describing what this prototype does"
            className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
            style={inputStyle}
          />
        </div>

        <div>
          <label className={labelClass}>Meta Description (SEO)</label>
          <input
            value={metaDesc}
            onChange={(e) => setMetaDesc(e.target.value)}
            placeholder="1-2 sentence description for search engines"
            className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
            style={inputStyle}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Tags (comma-separated)</label>
            <input
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder="LangGraph, Python, Flask"
              className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
              style={inputStyle}
            />
          </div>
          <div>
            <label className={labelClass}>Launch URL</label>
            <input
              value={launchUrl}
              onChange={(e) => setLaunchUrl(e.target.value)}
              placeholder="index.html"
              className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
              style={inputStyle}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Details</label>
          <textarea
            value={detailsHtml}
            onChange={(e) => setDetailsHtml(e.target.value)}
            rows={5}
            placeholder="<p>What does this prototype do and why does it matter?</p>"
            className={textareaClass}
            style={inputStyle}
          />
        </div>

        <div>
          <label className={labelClass}>System Architecture</label>
          <textarea
            value={architectureHtml}
            onChange={(e) => setArchitectureHtml(e.target.value)}
            rows={6}
            placeholder="<p>How is it built? Include a <p class='key-decision'>Why X over Y?</p> aside.</p>"
            className={textareaClass}
            style={inputStyle}
          />
        </div>

        <div>
          <label className={labelClass}>Try It Yourself</label>
          <textarea
            value={tryItHtml}
            onChange={(e) => setTryItHtml(e.target.value)}
            rows={4}
            placeholder="<p>Instructions for trying the prototype...</p>"
            className={textareaClass}
            style={inputStyle}
          />
        </div>

        <div>
          <label className={labelClass}>Related</label>
          <textarea
            value={relatedHtml}
            onChange={(e) => setRelatedHtml(e.target.value)}
            rows={3}
            placeholder="<a href='...' class='related-link'>Related content link</a>"
            className={textareaClass}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Action Bar */}
      <div className="mt-8 flex items-center gap-3 pb-8">
        <button
          onClick={saveContent}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        >
          <Save size={14} />
          Save
        </button>

        <button
          onClick={publishPreview}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          style={{ backgroundColor: "#67e8f9", color: "#000" }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
          {activeSession?.status === "previewing" || activeSession?.status === "published"
            ? "Re-generate Preview"
            : "Generate Preview"}
        </button>

        {(activeSession?.status === "previewing" || activeSession?.status === "published") && (
          <button
            onClick={deployToProduction}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
            style={{ backgroundColor: "var(--accent-green)", color: "#fff" }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
            {activeSession?.status === "published" ? "Re-deploy" : "Deploy"}
          </button>
        )}
      </div>
    </div>
  );
}
