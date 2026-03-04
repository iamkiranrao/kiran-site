"use client";

import { useState } from "react";
import { Eye, EyeOff, Key, X } from "lucide-react";
import { useApiKey } from "@/context/ApiKeyContext";

export function ApiKeyModal() {
  const { isKeySet, setApiKey } = useApiKey();
  const [value, setValue] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);

  if (isKeySet || dismissed) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.startsWith("sk-ant-")) {
      setError("Key should start with sk-ant-");
      return;
    }
    if (value.length < 20) {
      setError("Key seems too short");
      return;
    }
    setApiKey(value);
    setError("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--accent-blue)]/10 flex items-center justify-center">
              <Key size={20} className="text-[var(--accent-blue)]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Claude API Key
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Required for AI-powered features
              </p>
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Dismiss"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 pt-4 space-y-4">
          <div>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError("");
                }}
                placeholder="sk-ant-..."
                className="w-full px-4 py-3 pr-12 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] transition-colors"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {error && (
              <p className="mt-2 text-xs text-[var(--accent-red)]">{error}</p>
            )}
          </div>

          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Your key is stored in memory only and never saved to disk or sent to
            any server other than Anthropic&apos;s API. It will be cleared when you
            close the browser tab.
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--bg-secondary)] transition-colors"
            >
              Skip for now
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-[var(--accent-blue)] text-white hover:opacity-90 transition-opacity"
            >
              Save &amp; Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
