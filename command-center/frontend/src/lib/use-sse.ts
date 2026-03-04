"use client";

import { useState, useCallback, useRef } from "react";

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
}

interface UseSSEOptions {
  onEvent?: (event: PipelineEvent) => void;
  onComplete?: (event: PipelineEvent) => void;
  onError?: (error: string) => void;
}

export function useSSE(options: UseSSEOptions = {}) {
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PipelineEvent | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(
    async (
      apiUrl: string,
      body: { job_description: string; persona: string; version: string },
      claudeKey: string
    ) => {
      // Reset state
      setEvents([]);
      setCurrentStep(0);
      setIsRunning(true);
      setError(null);
      setResult(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (claudeKey && claudeKey !== "__backend__") {
          headers["X-Claude-Key"] = claudeKey;
        }

        const response = await fetch(`${apiUrl}/api/resume/generate`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
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

            const json = trimmed.slice(6);
            try {
              const event: PipelineEvent = JSON.parse(json);

              setEvents((prev) => {
                // Replace if same step, otherwise append
                const idx = prev.findIndex((e) => e.step === event.step);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = event;
                  return next;
                }
                return [...prev, event];
              });

              setCurrentStep(event.step);
              options.onEvent?.(event);

              // Check if this is the final event
              if (event.job_id && event.files) {
                setResult(event);
                setIsRunning(false);
                options.onComplete?.(event);
              }

              // Check for pipeline error
              if (event.status === "error") {
                setError(event.detail || "Pipeline error");
                setIsRunning(false);
                options.onError?.(event.detail || "Pipeline error");
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }

        setIsRunning(false);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          setIsRunning(false);
          return;
        }
        const message =
          err instanceof Error ? err.message : "Unknown error";
        setError(message);
        setIsRunning(false);
        options.onError?.(message);
      }
    },
    [options]
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    setEvents([]);
    setCurrentStep(0);
    setIsRunning(false);
    setError(null);
    setResult(null);
  }, []);

  return {
    events,
    currentStep,
    isRunning,
    error,
    result,
    start,
    abort,
    reset,
  };
}
