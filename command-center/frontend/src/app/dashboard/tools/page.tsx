"use client";

import { useState, useEffect } from "react";
import { ExternalLink, HelpCircle, X, BookOpen, ClipboardCheck } from "lucide-react";
import ModuleHelp from "@/components/ModuleHelp";

const API = process.env.NEXT_PUBLIC_CC_API || "http://localhost:8000";

interface ToolLink {
  name: string;
  url: string;
  description: string;
  guideSlug?: string; // links to a tool guide in docs/Foundation/ToolGuides/
}

interface ToolCategory {
  title: string;
  color: string;
  links: ToolLink[];
}

const TOOL_CATEGORIES: ToolCategory[] = [
  {
    title: "Analytics & Tracking",
    color: "var(--accent-amber)",
    links: [
      {
        name: "Google Analytics (GA4)",
        url: "https://analytics.google.com/analytics/web/#/p/G-8Q795C1RJ5",
        description: "Traffic, audience, behavior — measurement ID: G-8Q795C1RJ5. Sign in: Google account (kiranrao@gmail.com)",
        guideSlug: "google-analytics",
      },
      {
        name: "Microsoft Clarity",
        url: "https://clarity.microsoft.com/projects/view/vpgxcc8q5n/dashboard",
        description: "Heatmaps, session recordings, dead clicks — project: vpgxcc8q5n. Sign in: Microsoft account",
        guideSlug: "microsoft-clarity",
      },
      {
        name: "Google Search Console",
        url: "https://search.google.com/search-console?resource_id=sc-domain:kirangorapalli.com",
        description: "Search performance, indexing, Core Web Vitals — domain: kirangorapalli.com. Sign in: Google account",
        guideSlug: "google-search-console",
      },
    ],
  },
  {
    title: "Hosting & Deployment",
    color: "var(--accent-green)",
    links: [
      {
        name: "Cloudflare Pages",
        url: "https://dash.cloudflare.com/",
        description: "Static site hosting, CDN, DNS, SSL — kirangorapalli.com. Auto-deploys from kiran-site/main",
        guideSlug: "cloudflare",
      },
      {
        name: "Vercel Dashboard",
        url: "https://vercel.com/dashboard",
        description: "Fenix backend deploys — fenix-backend-omega.vercel.app. Auto-deploys from fenix-backend/main",
        guideSlug: "vercel",
      },
      {
        name: "Squarespace",
        url: "https://www.squarespace.com/",
        description: "Hosts scannibal.app and thediafund.org landing pages. DNS management for both domains",
      },
    ],
  },
  {
    title: "Fenix Infrastructure",
    color: "var(--accent-blue)",
    links: [
      {
        name: "Supabase Dashboard",
        url: "https://supabase.com/dashboard/project/gndzmmywtxvlukoavadj",
        description: "Database, pgvector, content_registry, conversations — project: gndzmmywtxvlukoavadj. SQL Editor for migrations",
        guideSlug: "supabase",
      },
      {
        name: "Fenix Backend (GitHub)",
        url: "https://github.com/iamkiranrao/fenix-backend",
        description: "FastAPI backend — system prompt, RAG service, chat API. Username: iamkiranrao",
        guideSlug: "github",
      },
      {
        name: "Fenix API (Live)",
        url: "https://fenix-backend-omega.vercel.app/docs",
        description: "Live Swagger UI — test /api/v1/fenix/chat endpoint directly",
      },
    ],
  },
  {
    title: "AI & API Services",
    color: "var(--accent-violet, #8b5cf6)",
    links: [
      {
        name: "Anthropic Console",
        url: "https://console.anthropic.com/",
        description: "Claude API usage, billing, API keys. Used by CC backend (teardowns, wordweaver, resume, madlab) and Fenix backend",
      },
      {
        name: "Google AI Studio",
        url: "https://aistudio.google.com/",
        description: "Gemini API keys and usage. Powers Scannibal's vision analysis (Gemini 2.5 Flash)",
      },
      {
        name: "Voyage AI",
        url: "https://dash.voyageai.com/",
        description: "Embedding API for Fenix RAG — voyage-3-lite model, 512 dimensions. Usage tracking and API keys",
      },
    ],
  },
  {
    title: "Code Repositories",
    color: "var(--accent-red)",
    links: [
      {
        name: "kiran-site (GitHub)",
        url: "https://github.com/iamkiranrao/kiran-site",
        description: "Portfolio repo — HTML, CSS, blog posts, teardowns, Fenix widget. Push to main → Cloudflare deploys",
        guideSlug: "github",
      },
      {
        name: "fenix-backend (GitHub)",
        url: "https://github.com/iamkiranrao/fenix-backend",
        description: "Fenix API — RAG pipeline, Claude integration. Push to main → Vercel deploys",
        guideSlug: "github",
      },
      {
        name: "GitHub Actions (Reindex)",
        url: "https://github.com/iamkiranrao/kiran-site/actions",
        description: "Fenix reindex workflow — triggers on HTML push to main. Check for green/red status after publishes",
        guideSlug: "github",
      },
    ],
  },
  {
    title: "SEO & Performance",
    color: "var(--accent-purple, #a78bfa)",
    links: [
      {
        name: "Google PageSpeed Insights",
        url: "https://pagespeed.web.dev/analysis?url=https://kirangorapalli.com",
        description: "Core Web Vitals, performance, accessibility — pre-loaded for kirangorapalli.com",
      },
      {
        name: "Rich Results Test",
        url: "https://search.google.com/test/rich-results?url=https://kirangorapalli.com",
        description: "JSON-LD, Open Graph validation — check after changing structured data",
      },
      {
        name: "Sitemap",
        url: "https://kirangorapalli.com/sitemap.xml",
        description: "Live sitemap — verify every published page is listed. Update after adding pages",
      },
    ],
  },
  {
    title: "Command Center",
    color: "var(--accent-orange, #fb923c)",
    links: [
      {
        name: "CC Frontend (Local)",
        url: "http://localhost:3000/dashboard",
        description: "Next.js 16 dashboard — start with: cd command-center/frontend && npm run dev",
      },
      {
        name: "CC Backend API (Local)",
        url: "http://localhost:8000/docs",
        description: "FastAPI Swagger UI — start with: cd command-center/backend && uvicorn main:app --reload",
      },
    ],
  },
  {
    title: "Products",
    color: "var(--accent-cyan, #67e8f9)",
    links: [
      {
        name: "scannibal.app",
        url: "https://scannibal.app",
        description: "Live landing page — Squarespace hosted. 9 scan modes, charity integration, beta signup",
      },
      {
        name: "Scannibal (TestFlight)",
        url: "https://testflight.apple.com/",
        description: "iOS beta testing — invite testers, check crash reports, view build status",
      },
      {
        name: "Scannibal (App Store Connect)",
        url: "https://appstoreconnect.apple.com/",
        description: "App Store submissions, builds, TestFlight management, analytics. Apple Developer account",
      },
      {
        name: "thediafund.org",
        url: "https://thediafund.org",
        description: "The DIA Fund landing page — Dream. Inspire. Advance. Squarespace hosted",
      },
      {
        name: "DIA Fund (Portfolio)",
        url: "https://kirangorapalli.com/the-dia-fund.html",
        description: "DIA Fund page on portfolio site — charity partners, Dia's roadmap",
      },
    ],
  },
  {
    title: "Social & Profiles",
    color: "var(--accent-pink, #f472b6)",
    links: [
      {
        name: "LinkedIn",
        url: "https://linkedin.com/in/kirangorapalli",
        description: "Professional profile — kirangorapalli. Primary distribution channel for content",
      },
      {
        name: "GitHub Profile",
        url: "https://github.com/iamkiranrao",
        description: "Public profile — iamkiranrao. Repos: kiran-site, fenix-backend",
      },
      {
        name: "Flickr",
        url: "https://flickr.com/photos/kirangorapalli",
        description: "Photography portfolio — kirangorapalli",
      },
      {
        name: "Spotify",
        url: "https://open.spotify.com/user/kirangorapalli",
        description: "Music profile — kirangorapalli",
      },
    ],
  },
  {
    title: "Live Site",
    color: "var(--text-secondary)",
    links: [
      {
        name: "kirangorapalli.com",
        url: "https://kirangorapalli.com",
        description: "Production homepage — Cloudflare Pages, auto-deployed from GitHub",
      },
      {
        name: "Teardowns Hub",
        url: "https://kirangorapalli.com/how-id-built-it.html",
        description: "All published product teardowns — GEICO, Airbnb, Amazon, Spotify, Meta, TurboTax",
      },
      {
        name: "Blog",
        url: "https://kirangorapalli.com/blog.html",
        description: "All published blog posts",
      },
      {
        name: "MadLab",
        url: "https://kirangorapalli.com/madlab.html",
        description: "Prototypes and experiments — Scannibal, chatbots, AI tools",
      },
      {
        name: "Career Highlights",
        url: "https://kirangorapalli.com/career-highlights.html",
        description: "Professional background, experience timeline, certifications",
      },
    ],
  },
];

// ── Guide Panel ──────────────────────────────────────────────────

function GuidePanel({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [content, setContent] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/tool-guides/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setContent(data.content);
          setTitle(data.title);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug]);

  // Simple markdown to HTML (good enough for these guides)
  function renderMarkdown(md: string) {
    const lines = md.split("\n");
    const html: string[] = [];
    let inList = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("# ")) continue; // skip h1 (already in title)
      if (trimmed === "---") {
        if (inList) { html.push("</ul>"); inList = false; }
        html.push('<hr class="border-[var(--border)] my-4" />');
      } else if (trimmed.startsWith("## ")) {
        if (inList) { html.push("</ul>"); inList = false; }
        html.push(`<h2 class="text-sm font-semibold text-[var(--text-primary)] mt-5 mb-2">${trimmed.slice(3)}</h2>`);
      } else if (trimmed.startsWith("- ")) {
        if (!inList) { html.push('<ul class="space-y-1.5 ml-1">'); inList = true; }
        html.push(`<li class="text-xs text-[var(--text-secondary)] leading-relaxed flex items-start gap-2"><span class="text-[var(--accent-blue)] mt-0.5 flex-shrink-0">•</span><span>${formatInline(trimmed.slice(2))}</span></li>`);
      } else if (trimmed.startsWith("**") && trimmed.includes(":**")) {
        if (inList) { html.push("</ul>"); inList = false; }
        const match = trimmed.match(/^\*\*(.+?):\*\*\s*(.*)/);
        if (match) {
          html.push(`<p class="text-xs text-[var(--text-secondary)] leading-relaxed mt-2"><strong class="text-[var(--text-primary)]">${match[1]}:</strong> ${formatInline(match[2])}</p>`);
        } else {
          html.push(`<p class="text-xs text-[var(--text-secondary)] leading-relaxed mt-2">${formatInline(trimmed)}</p>`);
        }
      } else if (trimmed.length > 0) {
        if (inList) { html.push("</ul>"); inList = false; }
        html.push(`<p class="text-xs text-[var(--text-secondary)] leading-relaxed mt-2">${formatInline(trimmed)}</p>`);
      }
    }
    if (inList) html.push("</ul>");
    return html.join("\n");
  }

  function formatInline(text: string) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-[var(--text-primary)]">$1</strong>')
      .replace(/`(.+?)`/g, '<code class="text-[10px] px-1 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--accent-amber)]">$1</code>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[#60a5fa] hover:underline">$1</a>');
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-full max-w-lg h-full overflow-y-auto"
        style={{ backgroundColor: "var(--bg-primary)", borderLeft: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4" style={{ backgroundColor: "var(--bg-primary)", borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-[#60a5fa]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title || "Loading..."}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)] transition-all">
            <X size={16} className="text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="px-5 py-4">
          {loading ? (
            <p className="text-xs text-[var(--text-muted)]">Loading guide...</p>
          ) : content ? (
            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
          ) : (
            <p className="text-xs text-[var(--text-muted)]">Guide not available. Check that the backend is running.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────

export default function ToolsPage() {
  const [activeGuide, setActiveGuide] = useState<string | null>(null);
  const [showChecklist, setShowChecklist] = useState(false);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Tools & Links
          </h1>
          <ModuleHelp moduleSlug="tools" />
        </div>
        <div className="flex items-center gap-3 mt-1">
          <p className="text-sm text-[var(--text-secondary)]">
            All your dashboards, analytics, and infrastructure in one place.
          </p>
          <button
            onClick={() => setShowChecklist(true)}
            className="flex items-center gap-1.5 text-xs text-[#60a5fa] hover:text-[#93bbfd] transition-colors shrink-0"
          >
            <ClipboardCheck size={13} />
            Maintenance checklist
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {TOOL_CATEGORIES.map((category) => (
          <div key={category.title}>
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              <h2 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                {category.title}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {category.links.map((link) => (
                <div
                  key={link.url + link.name}
                  className="group relative p-4 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] hover:border-[var(--text-muted)] transition-all"
                >
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-amber)] transition-colors">
                        {link.name}
                      </h3>
                      <ExternalLink
                        size={14}
                        className="text-[var(--text-muted)] group-hover:text-[var(--accent-amber)] transition-colors flex-shrink-0 mt-0.5"
                      />
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">
                      {link.description}
                    </p>
                  </a>
                  {link.guideSlug && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveGuide(link.guideSlug!);
                      }}
                      className="absolute top-2.5 right-10 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-secondary)] transition-all"
                      title="View guide"
                    >
                      <HelpCircle size={13} className="text-[#60a5fa]" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {activeGuide && (
        <GuidePanel slug={activeGuide} onClose={() => setActiveGuide(null)} />
      )}
      {showChecklist && (
        <GuidePanel slug="MAINTENANCE-CHECKLIST" onClose={() => setShowChecklist(false)} />
      )}
    </div>
  );
}
