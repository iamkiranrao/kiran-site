"use client";

import { useState, useCallback, useRef } from "react";

export interface AuditViolation {
  rule: string;
  text: string;
  suggestion: string;
}

export interface AuditResult {
  passed: boolean;
  score: number;
  violations: AuditViolation[];
  warnings: { issue: string; text: string; suggestion: string }[];
  summary: string;
}

export interface ATSKeywords {
  total_keywords: number;
  matched_count: number;
  coverage_pct: number;
  matched: string[];
  missing: string[];
  critical_missing: string[];
}

export interface PipelineEvent {
  step: number;
  total_steps: number;
  label: string;
  status: "in_progress" | "completed" | "warning" | "error";
  detail?: string;
  // Final event fields
  job_id?: string;
  company?: string;
  role?: string;
  persona?: string;
  version?: string;
  files?: string[];
  match_score_md?: string;
  // Phased workflow fields
  phase?: "analysis" | "generation";
  strategy?: string;
  proposed_changes?: ProposedChanges;
  original_content?: OriginalContent;
  // IC role detection
  is_ic_role?: boolean;
  ic_signals?: string[];
  // New feature fields
  pre_match_score?: number;
  post_match_score?: number;
  audit_result?: AuditResult;
  ats_keywords?: ATSKeywords;
}

export interface OriginalSection {
  id: string;
  label: string;
  header_text?: string;
  current_text: string | string[];
}

export interface OriginalContent {
  sections: OriginalSection[];
}

export interface ProposedChanges {
  tagline?: string;
  tagline_rationale?: string;
  summary?: string;
  summary_rationale?: string;
  career_highlights?: string[];
  career_highlights_rationale?: string;
  experience_bullets?: Record<string, string[]>;
  experience_rationale?: Record<string, string>;
  skills_priority?: string[];           // legacy combined field (fallback)
  skills_rationale?: string;            // legacy combined field (fallback)
  core_competencies_priority?: string[];
  core_competencies_rationale?: string;
  technical_skills_priority?: string[] | Record<string, string[]>;
  technical_skills_rationale?: string;
  notes?: string;
}

interface UseSSEOptions {
  onEvent?: (event: PipelineEvent) => void;
  onComplete?: (event: PipelineEvent) => void;
  onError?: (error: string) => void;
  onProposal?: (event: PipelineEvent) => void;
}

// Generic SSE stream reader
async function readSSEStream(
  url: string,
  body: Record<string, unknown>,
  claudeKey: string,
  signal: AbortSignal,
  callbacks: {
    onEvent: (event: PipelineEvent) => void;
    onFinal: (event: PipelineEvent) => void;
    onError: (error: string) => void;
  }
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (claudeKey && claudeKey !== "__backend__") {
    headers["X-Claude-Key"] = claudeKey;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Server error ${response.status}: ${text}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;

      const jsonStr = trimmed.slice(6);
      try {
        const event: PipelineEvent = JSON.parse(jsonStr);
        callbacks.onEvent(event);

        // Check if this is a final event (has job_id)
        const isAnalysisDone = event.phase === "analysis" && event.job_id;
        const isGenerationDone = event.job_id && event.files;

        if (isAnalysisDone || isGenerationDone) {
          callbacks.onFinal(event);
        }

        if (event.status === "error") {
          callbacks.onError(event.detail || "Pipeline error");
        }
      } catch {
        // Skip malformed JSON
      }
    }
  }
}

export function useSSE(options: UseSSEOptions = {}) {
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(12);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PipelineEvent | null>(null);
  const [proposal, setProposal] = useState<PipelineEvent | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const _handleEvent = useCallback((event: PipelineEvent) => {
    setEvents((prev) => {
      const idx = prev.findIndex((e) => e.step === event.step);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = event;
        return next;
      }
      return [...prev, event];
    });
    setCurrentStep(event.step);
    if (event.total_steps) setTotalSteps(event.total_steps);
    options.onEvent?.(event);
  }, [options]);

  // Original full pipeline
  const start = useCallback(
    async (
      apiUrl: string,
      body: { job_description: string; persona: string; version: string },
      claudeKey: string
    ) => {
      setEvents([]);
      setCurrentStep(0);
      setTotalSteps(12);
      setIsRunning(true);
      setError(null);
      setResult(null);
      setProposal(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await readSSEStream(
          `${apiUrl}/api/resume/generate`,
          body,
          claudeKey,
          controller.signal,
          {
            onEvent: _handleEvent,
            onFinal: (event) => {
              setResult(event);
              setIsRunning(false);
              options.onComplete?.(event);
            },
            onError: (msg) => {
              setError(msg);
              setIsRunning(false);
              options.onError?.(msg);
            },
          }
        );
        setIsRunning(false);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          setIsRunning(false);
          return;
        }
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        setIsRunning(false);
        options.onError?.(message);
      }
    },
    [options, _handleEvent]
  );

  // Phase 1: Analyze + Propose
  const startAnalysis = useCallback(
    async (
      apiUrl: string,
      body: { job_description: string; persona: string; version: string },
      claudeKey: string
    ) => {
      setEvents([]);
      setCurrentStep(0);
      setTotalSteps(6);
      setIsRunning(true);
      setError(null);
      setResult(null);
      setProposal(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await readSSEStream(
          `${apiUrl}/api/resume/analyze`,
          body,
          claudeKey,
          controller.signal,
          {
            onEvent: _handleEvent,
            onFinal: (event) => {
              setProposal(event);
              setIsRunning(false);
              options.onProposal?.(event);
            },
            onError: (msg) => {
              setError(msg);
              setIsRunning(false);
              options.onError?.(msg);
            },
          }
        );
        setIsRunning(false);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          setIsRunning(false);
          return;
        }
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        setIsRunning(false);
        options.onError?.(message);
      }
    },
    [options, _handleEvent]
  );

  // Phase 2: Approve + Generate
  const startGeneration = useCallback(
    async (
      apiUrl: string,
      jobId: string,
      claudeKey: string,
      feedback?: string
    ) => {
      setEvents([]);
      setCurrentStep(0);
      setTotalSteps(10);
      setIsRunning(true);
      setError(null);
      setResult(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await readSSEStream(
          `${apiUrl}/api/resume/approve`,
          { job_id: jobId, feedback: feedback || null },
          claudeKey,
          controller.signal,
          {
            onEvent: _handleEvent,
            onFinal: (event) => {
              setResult(event);
              setIsRunning(false);
              options.onComplete?.(event);
            },
            onError: (msg) => {
              setError(msg);
              setIsRunning(false);
              options.onError?.(msg);
            },
          }
        );
        setIsRunning(false);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          setIsRunning(false);
          return;
        }
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        setIsRunning(false);
        options.onError?.(message);
      }
    },
    [options, _handleEvent]
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    setEvents([]);
    setCurrentStep(0);
    setTotalSteps(12);
    setIsRunning(false);
    setError(null);
    setResult(null);
    setProposal(null);
  }, []);

  return {
    events,
    currentStep,
    totalSteps,
    isRunning,
    error,
    result,
    proposal,
    start,
    startAnalysis,
    startGeneration,
    abort,
    reset,
  };
}
