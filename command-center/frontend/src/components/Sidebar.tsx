"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Wrench, PenTool, FileText, Target, Shield, ShieldCheck, ExternalLink,
  LogOut, Command, Beaker, Bot, BookOpen, BookMarked, MessageSquare,
  Radar, Lightbulb, Inbox, Library, CheckSquare, BookHeart, DollarSign,
  Layers, Briefcase, Crosshair, Building2, Compass, GraduationCap,
} from "lucide-react";
import { SIDEBAR_SECTIONS, APP_NAME } from "@/lib/constants";
import { ThemeToggle } from "./ThemeToggle";

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Wrench,
  PenTool,
  FileText,
  Target,
  Shield,
  ShieldCheck,
  ExternalLink,
  Beaker,
  Bot,
  BookOpen,
  BookMarked,
  MessageSquare,
  Radar,
  Lightbulb,
  Inbox,
  Library,
  CheckSquare,
  BookHeart,
  DollarSign,
  Layers,
  Briefcase,
  Crosshair,
  Building2,
  Compass,
  GraduationCap,
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);

  // Poll notification count every 15 seconds
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await fetch(`${API_URL}/api/notifications/counts`);
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unread || 0);
        }
      } catch {
        // Silently fail — badge is non-critical
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 15000);
    return () => clearInterval(interval);
  }, []);

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
            <p className="text-xs text-[var(--text-muted)]">Kiran Rao</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {SIDEBAR_SECTIONS.map((section, si) => (
          <div key={si}>
            {/* Section heading */}
            {section.heading && (
              <div className="px-3 pt-4 pb-1.5 first:pt-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {section.heading}
                </span>
              </div>
            )}

            {/* Section modules */}
            {section.modules.map((mod) => {
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
                  <span className="flex-1">{mod.label}</span>
                  {mod.slug === "notifications" && unreadCount > 0 && (
                    <span
                      className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none text-white"
                      style={{ backgroundColor: "#fb923c", minWidth: "18px", textAlign: "center" }}
                    >
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
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
