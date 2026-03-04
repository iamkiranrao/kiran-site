"use client";

import { useState, useMemo } from "react";
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
} from "lucide-react";
import Link from "next/link";
import { useApiKey } from "@/context/ApiKeyContext";
import { useSSE, type PipelineEvent } from "@/lib/use-sse";

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

const PIPELINE_LABELS = [
  "Parsing inputs",
  "Analyzing job description",
  "Selecting template",
  "Reading template structure",
  "Generating customized content",
  "Applying edits to resume",
  "Running quality checks",
  "Generating match score",
  "Writing cover letter",
  "Compiling company brief",
  "Building interview questions",
  "Packaging deliverables",
];

function StepIcon({ status }: { status?: string }) {
  if (status === "completed") return <CheckCircle2 size={16} className="text-[var(--accent-green)]" />;
  if (status === "in_progress") return <Loader2 size={16} className="text-[var(--accent-blue)] animate-spin" />;
  if (status === "warning") return <AlertCircle size={16} className="text-[var(--accent-amber)]" />;
  if (status === "error") return <AlertCircle size={16} className="text-[var(--accent-red)]" />;
  return <div className="w-4 h-4 rounded-full border border-[var(--border-light)]" />;
}

export default function ResumePage() {
  const { apiKey, isKeySet } = useApiKey();
  const [jd, setJd] = useState("");
  const [persona, setPersona] = useState("auto");
  const [version, setVersion] = useState("2-Page");

  const sse = useSSE();

  const eventMap = useMemo(() => {
    const map: Record<number, PipelineEvent> = {};
    for (const e of sse.events) {
      map[e.step] = e;
    }
    return map;
  }, [sse.events]);

  const handleGenerate = () => {
    if (!apiKey || !jd.trim()) return;
    sse.start(API_URL, { job_description: jd, persona, version }, apiKey);
  };

  const handleDownload = (filename: string) => {
    if (!sse.result?.job_id) return;
    window.open(
      `${API_URL}/api/resume/download/${sse.result.job_id}/${filename}`,
      "_blank"
    );
  };

  const canGenerate = isKeySet && jd.trim().length > 50 && !sse.isRunning;
  const showProgress = sse.isRunning || sse.events.length > 0;
  const showResults = sse.result !== null;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <FileText size={24} className="text-[var(--accent-green)]" />
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Resume Customizer
          </h1>
          <Link href="/dashboard/help?module=resume"
            className="text-[var(--text-muted)] hover:text-[var(--accent-green)] transition-colors"
            title="Help & Documentation">
            <HelpCircle size={18} />
          </Link>
        </div>
        <p className="text-[var(--text-secondary)] text-sm">
          Paste a job description to generate a customized resume, match score,
          cover letter, company brief, and interview questions.
        </p>
      </div>

      {/* API Key Warning */}
      {!isKeySet && (
        <div
          className="mb-6 p-4 rounded-lg border flex items-start gap-3"
          style={{
            backgroundColor: "rgba(212, 167, 74, 0.08)",
            borderColor: "var(--accent-amber)",
          }}
        >
          <Key size={18} className="text-[var(--accent-amber)] mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">
              Claude API key required
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Click the key icon in the sidebar or refresh the page to enter your
              API key. It&apos;s stored in memory only.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Input Panel */}
        <div className="lg:col-span-3 space-y-5">
          {/* JD Input */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              Job Description
            </label>
            <textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste the full job description here..."
              rows={16}
              disabled={sse.isRunning}
              className="w-full rounded-lg p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
            <div className="flex justify-between mt-1.5">
              <span className="text-xs text-[var(--text-muted)]">
                {jd.length > 0
                  ? `${jd.split(/\s+/).filter(Boolean).length} words`
                  : "Min 50 characters"}
              </span>
              {jd.length > 0 && !sse.isRunning && (
                <button
                  onClick={() => setJd("")}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] flex items-center gap-1"
                >
                  <X size={12} /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Options Row */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Persona
              </label>
              <div className="relative">
                <select
                  value={persona}
                  onChange={(e) => setPersona(e.target.value)}
                  disabled={sse.isRunning}
                  className="w-full appearance-none rounded-lg px-3 py-2.5 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                >
                  {PERSONAS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
                />
              </div>
            </div>

            <div className="flex-1">
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Version
              </label>
              <div className="relative">
                <select
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  disabled={sse.isRunning}
                  className="w-full appearance-none rounded-lg px-3 py-2.5 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                >
                  {VERSIONS.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
                />
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all"
            style={{
              backgroundColor: canGenerate
                ? "var(--accent-green)"
                : "var(--border)",
              color: canGenerate ? "#fff" : "var(--text-muted)",
              cursor: canGenerate ? "pointer" : "not-allowed",
              opacity: canGenerate ? 1 : 0.6,
            }}
          >
            {sse.isRunning ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Pipeline Running...
              </>
            ) : (
              <>
                <Play size={16} />
                Generate Application Package
              </>
            )}
          </button>

          {/* Error */}
          {sse.error && (
            <div
              className="p-4 rounded-lg border flex items-start gap-3"
              style={{
                backgroundColor: "rgba(196, 116, 116, 0.08)",
                borderColor: "var(--accent-red)",
              }}
            >
              <AlertCircle size={16} className="text-[var(--accent-red)] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Pipeline Error
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  {sse.error}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Progress + Results Panel */}
        <div className="lg:col-span-2 space-y-5">
          {/* Progress */}
          {showProgress && (
            <div
              className="rounded-lg p-5"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-[var(--text-primary)]">
                  Pipeline Progress
                </h3>
                <span className="text-xs text-[var(--text-muted)]">
                  {sse.currentStep}/12
                </span>
              </div>

              {/* Progress bar */}
              <div
                className="h-1.5 rounded-full mb-5 overflow-hidden"
                style={{ backgroundColor: "var(--border)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(sse.currentStep / 12) * 100}%`,
                    backgroundColor: showResults
                      ? "var(--accent-green)"
                      : "var(--accent-blue)",
                  }}
                />
              </div>

              {/* Step list */}
              <div className="space-y-2.5">
                {PIPELINE_LABELS.map((label, idx) => {
                  const stepNum = idx + 1;
                  const event = eventMap[stepNum];
                  const isActive = sse.isRunning && sse.currentStep === stepNum;

                  return (
                    <div
                      key={stepNum}
                      className="flex items-center gap-2.5"
                      style={{
                        opacity: event || isActive ? 1 : 0.35,
                      }}
                    >
                      <StepIcon status={event?.status} />
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-xs truncate"
                          style={{
                            color: isActive
                              ? "var(--text-primary)"
                              : "var(--text-secondary)",
                            fontWeight: isActive ? 500 : 400,
                          }}
                        >
                          {label}
                        </p>
                        {event?.detail && (
                          <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
                            {event.detail}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Results */}
          {showResults && sse.result && (
            <div
              className="rounded-lg p-5"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--accent-green)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 size={18} className="text-[var(--accent-green)]" />
                <h3 className="text-sm font-medium text-[var(--text-primary)]">
                  Package Ready
                </h3>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mb-4">
                {sse.result.role} at {sse.result.company} &middot;{" "}
                {sse.result.persona} {sse.result.version}
              </p>

              <div className="space-y-2">
                {(sse.result.files || [])
                  .filter((f) => f.endsWith(".docx"))
                  .map((file) => (
                    <button
                      key={file}
                      onClick={() => handleDownload(file)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover:opacity-80"
                      style={{
                        backgroundColor: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <FileText size={14} className="text-[var(--accent-blue)] shrink-0" />
                      <span className="text-xs text-[var(--text-primary)] flex-1 truncate">
                        {file.replace(/_/g, " ").replace(".docx", "")}
                      </span>
                      <Download size={12} className="text-[var(--text-muted)]" />
                    </button>
                  ))}

                {/* ZIP download */}
                <button
                  onClick={() => handleDownload("Application_Package.zip")}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover:opacity-80 mt-3"
                  style={{
                    backgroundColor: "rgba(107, 158, 107, 0.1)",
                    border: "1px solid var(--accent-green)",
                  }}
                >
                  <Package size={14} className="text-[var(--accent-green)] shrink-0" />
                  <span className="text-xs text-[var(--text-primary)] flex-1 font-medium">
                    Download All (ZIP)
                  </span>
                  <Download size={12} className="text-[var(--accent-green)]" />
                </button>
              </div>

              {/* New generation */}
              <button
                onClick={() => {
                  sse.reset();
                  setJd("");
                }}
                className="w-full mt-4 py-2 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                style={{ border: "1px solid var(--border)" }}
              >
                Start New Generation
              </button>
            </div>
          )}

          {/* Empty state */}
          {!showProgress && (
            <div
              className="rounded-lg p-8 text-center"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border)",
              }}
            >
              <FileText
                size={32}
                className="mx-auto mb-3 text-[var(--text-muted)]"
              />
              <p className="text-sm text-[var(--text-secondary)]">
                Paste a job description and click Generate to start the 12-step
                pipeline.
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
