"use client";

import { useState } from "react";
import { HelpCircle, X, ExternalLink } from "lucide-react";

// ── Module help content ─────────────────────────────────────────

export interface ModuleHelpContent {
  summary: string;
  features: string[];
  guideSlug?: string; // links to /dashboard/guides if a product guide exists
}

export const MODULE_HELP: Record<string, ModuleHelpContent> = {
  notifications: {
    summary:
      "Unified inbox for everything that needs your attention across Command Center. 14 notification types fire automatically when feedback arrives, standards violations appear, jobs match, health checks fail, or costs exceed budget. Deduplication prevents repeats, and dismissed items auto-cleanup after 90 days.",
    features: [
      "14 notification types covering feedback, standards, jobs, health, costs, Fenix, content, and system events",
      "Priority levels (urgent, high, normal, low) with visual badges",
      "Type and priority filters with unread-only toggle",
      "Mark read, dismiss, or bulk-clear actions",
      "Deep-link navigation to the relevant module for each notification",
      "Sidebar badge with live unread count (polls every 60s)",
    ],
    guideSlug: "notifications",
  },
  teardowns: {
    summary:
      "Research and publish detailed product analysis pages directly to your portfolio through a seven-step co-creation workflow with Claude. Each teardown session walks through Problem Space, Solution Architecture, User Journey, Build Narrative, Demo & Screenshots, Tech Stack, and Editorial + HTML Generation.",
    features: [
      "7-step structured workflow with AI collaboration and SSE streaming",
      "Session-based state with step approval and revision loops",
      "Automatic sitemap and fenix-index updates on publish",
      "One-click deployment to GitHub with anti-AI guardrails",
      "Full HTML generation with responsive design",
    ],
    guideSlug: "teardown-builder",
  },
  wordweaver: {
    summary:
      "Create blog posts and podcast content with your voice profile. WordWeaver combines interactive workflow planning with web-based research to produce thematically consistent content while keeping you in creative control.",
    features: [
      "Profile + themes separation for voice consistency and topic flexibility",
      "Live web research per theme to ground posts in current data",
      "Multiple topic angle options (3–5 per theme) for strategic narrative thinking",
      "Custom structure determination based on topic and angle",
      "Dual output format (Markdown + Word doc) targeting ~1,750 words",
    ],
    guideSlug: "wordweaver",
  },
  resume: {
    summary:
      "Tailor resumes and application packages to specific job descriptions without altering core structure or length. The pipeline analyzes gaps, strategically rewrites content to maximize alignment, and applies tracked changes for easy review.",
    features: [
      "Claude-powered match scoring (0–100) with before/after alignment",
      "Tracked changes in Word for reviewable edits",
      "Multiple template variants (1-Pager, 2-Pager, Detailed) across personas",
      "Keyword gap identification and strategic rewriting",
      "Full application package: resume, cover letter, company brief, interview bank",
    ],
    guideSlug: "resume-customizer",
  },
  "job-central": {
    summary:
      "Comprehensive job search system combining interview preparation, company research, recruiter call coaching, and career strategy. Helps you systematically prepare for interviews at target companies using frameworks grounded in your actual experience.",
    features: [
      "Interview scenario library with product sense, execution, and leadership frameworks",
      "Story bank extracting behavioral stories from real experience",
      "Company research profiles with role-specific intel",
      "Screening call prep templates with talking points and counter-questions",
      "Authenticity-grounded strategy — never scripted, always real",
    ],
    guideSlug: "job-central",
  },
  madlab: {
    summary:
      "Experimental projects section showcasing AI prototypes, chatbots, apps, and creative tools. Build and publish prototype overview pages organized in a Netflix-style browsable grid with 12 categories.",
    features: [
      "Horizontal scroll rows grouped by category (12 categories)",
      "Visual emphasis on latest card in each category",
      "Vanilla HTML/CSS/JS with no external dependencies",
      "Dark/light theme inheritance from shared site styles",
      "Integration with Fenix content graph metadata",
    ],
    guideSlug: "madlab",
  },
  fenix: {
    summary:
      "Admin dashboard providing visibility into how visitors interact with the Fenix AI assistant. Surfaces conversation metrics, RAG retrieval quality, and content coverage to iteratively improve Fenix's responses.",
    features: [
      "Tabbed interface: Overview, Top Queries, Failures, Coverage, Conversations, Search Quality",
      "Actionable metrics for RAG tuning and knowledge gap identification",
      "Training queue in Failures tab for Q&A data additions",
      "Real-time conversation browsing with RAG metadata per turn",
      "Similarity score distributions for search quality analysis",
    ],
    guideSlug: "fenix-dashboard",
  },
  "fenix-journal": {
    summary:
      "Living documentation system that archives work sessions and synthesizes them into two parallel diary streams from Fenix's perspective. Captures session transcripts, processes them nightly, and outputs reflective entries about your thinking patterns and technical decisions.",
    features: [
      "Dual-stream diary: About Kiran + Build Journey",
      "Session-capture skill reading JSONL transcripts directly",
      "Automatic nightly synthesis generating dated diary entries",
      "Fenix diarist voice — reflective, analytical, evidence-based",
      "Searchable session archive with YAML frontmatter and timestamps",
    ],
    guideSlug: "fenix-journal",
  },
  "content-audit": {
    summary:
      "Automated QA system that scans all site content against editorial rules, invoking Claude to audit violations and report findings with severity levels and suggested corrections to enforce voice and accuracy standards.",
    features: [
      "Claude-powered semantic auditing (not regex-based)",
      "Severity levels (high/medium/low) for triage",
      "Comprehensive file discovery across site (teardowns, prototypes, pages)",
      "HTML text extraction with entity decoding",
      "Per-file and full-site audit modes with violation JSON output",
    ],
    guideSlug: "content-audit",
  },
  feedback: {
    summary:
      "Public-facing collection system for site visitors to submit feedback and testimonials, with Supabase storage and a Command Center dashboard for reviewing, approving, and managing submissions.",
    features: [
      "Dual-form architecture: feedback vs. testimonials with different workflows",
      "Public API endpoints for landing page submissions",
      "Testimonial approval workflow (pending → approved/rejected)",
      "IP address and user agent tracking for analytics",
      "Stat cards, filterable lists, and curation controls",
    ],
    guideSlug: "feedback-testimonials",
  },
  ideas: {
    summary:
      "Feature backlog and improvement ideas for Command Center. A lightweight scratchpad for capturing, organizing, and prioritizing future enhancements across all modules.",
    features: [
      "Quick-capture for new ideas with title and description",
      "Category tagging to link ideas to specific modules",
      "Priority and status tracking (new, planned, in progress, done)",
      "Sortable and filterable list view",
    ],
  },
  standards: {
    summary:
      "Multi-pillar audit framework scanning all site content against 5 compliance pillars: backend, architecture, authenticity, content, and visual. Real-time scoring with compliance tiers, baseline system for known violations, and auto-remediation for fixable issues.",
    features: [
      "5 compliance pillars with individual scoring and overall scorecard",
      "3-level drill-down: Scorecard → Pillar Details → Remediation",
      "Baseline system to acknowledge known violations and track only new regressions",
      "Pre-publish file check endpoint for quality gates",
      "Auto-remediation with dry-run preview",
      "Startup automation pre-warms scorecard and notifications on launch",
    ],
    guideSlug: "standards",
  },
  "tech-costs": {
    summary:
      "Track operational costs across the full tech stack — APIs, hosting, databases, and subscriptions. Monthly summaries, 3-month projections, and budget alerts when spend exceeds 80% of budget.",
    features: [
      "Per-service cost tracking with auto-aggregation from API usage logs",
      "Monthly summary with category breakdown and month-over-month trends",
      "3-month projection engine using weighted historical averages",
      "Budget alerts via notification system at 80% threshold",
      "Rate card for per-model API pricing (Claude, Gemini, Voyage)",
      "Dashboard widget for homepage compact view",
    ],
    guideSlug: "tech-costs",
  },
  "action-items": {
    summary:
      "Unified task tracker across all 18 workstreams. Created live during Cowork sessions when you say 'action item' or 'track this', or manually via the dashboard. Tracks priority, status, and source.",
    features: [
      "18 workstreams: fenix, scannibal, dia-fund, resume-pipeline, site-teardowns, and more",
      "Four priority levels (critical, high, medium, low) and four statuses (todo, in-progress, done, blocked)",
      "Live capture from Cowork sessions via CLAUDE.md integration",
      "Summary endpoint for dashboard widgets and workstream-level views",
      "Filterable by workstream, priority, status, and source",
    ],
    guideSlug: "action-items",
  },
  "kirans-journal": {
    summary:
      "Strategic decision journal capturing live reasoning, decisions, principles, and ideas in your voice. Nine categories from architecture to apprehension. Distinct from Fenix Journal — this is YOUR thinking, not Fenix's observations.",
    features: [
      "Nine categories: principle, architecture, product-philosophy, brand-identity, career-strategy, content-strategy, apprehension, idea, general",
      "Live capture during Cowork sessions — 'journal this' triggers immediate logging",
      "Principles view for reusable beliefs crystallized from experience",
      "Open Questions view for unresolved tensions and follow-ups",
      "Decision + alternatives_considered fields for structured decision records",
    ],
    guideSlug: "kirans-journal",
  },
  "add-skills": {
    summary:
      "Evidence management system for the Skills page. Manage certifications, prototypes, projects, and teardowns as evidence sources, map them to skills across six domains, and publish a JSON manifest to the site repo.",
    features: [
      "Evidence inventory with type-based filtering (certification, prototype, project, teardown)",
      "Interactive skill mapper grid for linking evidence sources to 36 skills across 6 domains",
      "Full taxonomy management — add, edit, and reorder skills and domains",
      "One-click manifest generation and git publish to the site repo",
      "Automatic evidence capture from MadLab and teardown publish pipelines",
    ],
  },
  tools: {
    summary:
      "Quick-access hub for analytics dashboards, infrastructure services, and external tools you use regularly. Each tool with a guide has a contextual help button that opens a practical reference tailored to your setup.",
    features: [
      "10 categories: Analytics, Hosting, AI Services, Code, SEO, Products, Social, Live Site, and more",
      "One-click access to Supabase, Vercel, GitHub, Cloudflare, GA4, Clarity, Anthropic Console, etc.",
      "Contextual help guides (hover any card with a ? icon) with what to check, common tasks, and red flags",
      "Maintenance checklist with after-publish, weekly, monthly, and quarterly cadences",
    ],
    guideSlug: "tools",
  },
  library: {
    summary:
      "Searchable index of all project Markdown documentation — architecture specs, strategy docs, guides, prototype plans, and more. Each file is auto-scanned with a quick summary so you can find what you need without digging through folders.",
    features: [
      "Auto-scans all non-journal .md files across the entire project",
      "Category-based filtering (Architecture, Career, Content, Fenix, Strategy, etc.)",
      "Full-text search across titles, summaries, and file paths",
      "Click to read full document content with markdown rendering",
      "Word count and last-modified metadata for each document",
    ],
    guideSlug: "library",
  },
  guides: {
    summary:
      "Living knowledge base for each Command Center module. Product guides document how each tool works, its architecture, API routes, and usage patterns — the single source of truth for how everything fits together.",
    features: [
      "Markdown-based guides served from fenix-journal/guides/",
      "Covers all major modules with architecture and usage details",
      "Searchable and browsable from the dashboard",
      "Updated as modules evolve",
    ],
  },
};

// ── Component ───────────────────────────────────────────────────

export default function ModuleHelp({ moduleSlug }: { moduleSlug: string }) {
  const [open, setOpen] = useState(false);
  const content = MODULE_HELP[moduleSlug];

  if (!content) return null;

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className={`p-2 rounded-lg transition-all ${
          open
            ? "bg-[#60a5fa20] text-[#60a5fa]"
            : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
        }`}
        title="About this module"
      >
        <HelpCircle size={18} />
      </button>

      {open && (
        <div
          className="mt-4 rounded-xl p-5 space-y-3"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              About this module
            </h3>
            <div className="flex items-center gap-2">
              {content.guideSlug && (
                <a
                  href={`/dashboard/guides?doc=${content.guideSlug}`}
                  className="flex items-center gap-1 text-[11px] text-[#60a5fa] hover:underline"
                >
                  <ExternalLink size={11} />
                  Full guide
                </a>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-[var(--bg-secondary)] transition-all"
              >
                <X size={14} className="text-[var(--text-muted)]" />
              </button>
            </div>
          </div>

          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {content.summary}
          </p>

          <div className="pt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Key capabilities
            </p>
            <ul className="space-y-1.5">
              {content.features.map((feat, i) => (
                <li
                  key={i}
                  className="text-[11px] text-[var(--text-muted)] leading-snug flex items-start gap-2"
                >
                  <span className="text-[#60a5fa] mt-0.5 flex-shrink-0">•</span>
                  {feat}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
