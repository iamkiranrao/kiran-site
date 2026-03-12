"use client";

import { signIn } from "next-auth/react";
import { Command, Github } from "lucide-react";
import { APP_NAME } from "@/lib/constants";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
      <div className="w-full max-w-sm mx-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <img src="/berner.jpeg" alt="Command Center" className="w-14 h-14 rounded-2xl object-cover mb-4" />
          <h1 className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
            {APP_NAME}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Content &amp; career automation hub
          </p>
        </div>

        {/* Sign in card */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
          <p className="text-sm text-[var(--text-secondary)] text-center mb-6">
            Sign in to access your dashboard
          </p>

          <button
            onClick={() => signIn("github", { callbackUrl: "/dashboard/teardowns" })}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-[#24292e] text-white text-sm font-medium hover:bg-[#2f363d] transition-colors"
          >
            <Github size={20} />
            Sign in with GitHub
          </button>

          <p className="text-xs text-[var(--text-muted)] text-center mt-4">
            Access restricted to authorized accounts only.
          </p>
        </div>

        {/* Footer */}
        <p className="text-xs text-[var(--text-muted)] text-center mt-8">
          Kiran Gorapalli &middot; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
