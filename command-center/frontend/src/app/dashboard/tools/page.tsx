"use client";

import { ExternalLink } from "lucide-react";
import ModuleHelp from "@/components/ModuleHelp";

interface ToolLink {
  name: string;
  url: string;
  description: string;
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
        description: "Traffic, audience, behavior — measurement ID: G-8Q795C1RJ5",
      },
      {
        name: "Microsoft Clarity",
        url: "https://clarity.microsoft.com/projects/view/vpgxcc8q5n/dashboard",
        description: "Heatmaps, session recordings, user behavior — project: vpgxcc8q5n",
      },
      {
        name: "Google Search Console",
        url: "https://search.google.com/search-console?resource_id=sc-domain:kirangorapalli.com",
        description: "Search performance, indexing, sitemaps",
      },
    ],
  },
  {
    title: "Hosting & Deployment",
    color: "var(--accent-green)",
    links: [
      {
        name: "Netlify Dashboard",
        url: "https://app.netlify.com/",
        description: "Site deploys, build logs, domain settings — kirangorapalli.com",
      },
      {
        name: "Vercel Dashboard",
        url: "https://vercel.com/dashboard",
        description: "Fenix backend deploys — fenix-backend-omega.vercel.app",
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
        description: "Database, pgvector embeddings, content_registry, conversations — project: gndzmmywtxvlukoavadj",
      },
      {
        name: "Fenix Backend (GitHub)",
        url: "https://github.com/iamkiranrao/fenix-backend",
        description: "FastAPI backend — system prompt, RAG service, chat API",
      },
      {
        name: "Fenix API (Live)",
        url: "https://fenix-backend-omega.vercel.app/docs",
        description: "Live API docs — /api/v1/fenix/chat endpoint",
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
        description: "Main site repo — HTML, CSS, blog posts, teardowns, Fenix widget",
      },
      {
        name: "fenix-backend (GitHub)",
        url: "https://github.com/iamkiranrao/fenix-backend",
        description: "Fenix API — RAG pipeline, Claude integration, persona inference",
      },
      {
        name: "GitHub Actions (Reindex)",
        url: "https://github.com/iamkiranrao/kiran-site/actions",
        description: "Fenix reindex workflow — triggers on HTML push to main",
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
        description: "Core Web Vitals, performance, accessibility scores",
      },
      {
        name: "Rich Results Test",
        url: "https://search.google.com/test/rich-results?url=https://kirangorapalli.com",
        description: "Structured data validation (JSON-LD, Open Graph)",
      },
      {
        name: "Sitemap",
        url: "https://kirangorapalli.com/sitemap.xml",
        description: "Live sitemap — verify all pages are indexed",
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
        description: "Production site — homepage",
      },
      {
        name: "Teardowns Hub",
        url: "https://kirangorapalli.com/how-id-built-it.html",
        description: "All published product teardowns",
      },
      {
        name: "Blog",
        url: "https://kirangorapalli.com/blog.html",
        description: "All published blog posts",
      },
      {
        name: "MadLab",
        url: "https://kirangorapalli.com/madlab.html",
        description: "Prototypes and experiments",
      },
      {
        name: "Career Highlights",
        url: "https://kirangorapalli.com/career-highlights.html",
        description: "Professional background and experience",
      },
    ],
  },
];

export default function ToolsPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Tools & Links
          </h1>
          <ModuleHelp moduleSlug="tools" />
        </div>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          All your dashboards, analytics, and infrastructure in one place.
        </p>
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
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block p-4 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] hover:border-[var(--text-muted)] transition-all"
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
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
