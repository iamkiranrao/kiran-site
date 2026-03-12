"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Wrench, PenTool, FileText, Target, Shield, ExternalLink, LogOut, Command, Beaker, Bot, BookOpen, BookMarked, MessageSquare, Radar, Lightbulb } from "lucide-react";
import { MODULES, APP_NAME } from "@/lib/constants";
import { ThemeToggle } from "./ThemeToggle";

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Wrench,
  PenTool,
  FileText,
  Target,
  Shield,
  ExternalLink,
  Beaker,
  Bot,
  BookOpen,
  BookMarked,
  MessageSquare,
  Radar,
  Lightbulb,
};

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside className="fixed left-0 top-0 h-screen w-[260px] flex flex-col bg-[var(--bg-primary)] border-r border-[var(--border)]">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <img src="/berner.jpeg" alt="Command Center" className="w-11 h-11 rounded-lg object-cover" />
          <div>
            <h1 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
              {APP_NAME}
            </h1>
            <p className="text-xs text-[var(--text-muted)]">Kiran Gorapalli</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {MODULES.map((mod) => {
          const Icon = iconMap[mod.icon];
          const isActive = pathname.startsWith(mod.href);

          return (
            <Link
              key={mod.slug}
              href={mod.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm ${
                isActive
                  ? "bg-[var(--bg-secondary)] text-[var(--text-primary)] font-medium"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {isActive && (
                <div
                  className="absolute left-0 w-[3px] h-5 rounded-r"
                  style={{ backgroundColor: mod.color }}
                />
              )}
              {Icon && (
                <Icon
                  size={18}
                  className={isActive ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}
                />
              )}
              {mod.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-[var(--border)] space-y-2">
        <ThemeToggle />

        {session?.user && (
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              {(session.user as any).avatar && (
                <img
                  src={(session.user as any).avatar}
                  alt=""
                  className="w-6 h-6 rounded-full"
                />
              )}
              <span className="text-xs text-[var(--text-muted)]">
                {(session.user as any).username || session.user.name}
              </span>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-[var(--text-muted)] hover:text-[var(--accent-red)] transition-colors"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
