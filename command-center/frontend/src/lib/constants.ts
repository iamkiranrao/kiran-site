export interface ModuleEntry {
  slug: string;
  label: string;
  icon: string;
  description: string;
  href: string;
  color: string;
}

export interface SidebarSection {
  heading: string;
  modules: ModuleEntry[];
}

export const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    heading: "",
    modules: [
      {
        slug: "notifications",
        label: "Notification Center",
        icon: "Inbox",
        description: "Actionable items from across Command Center — feedback, task failures, and more.",
        href: "/dashboard/notifications",
        color: "var(--accent-orange, #fb923c)",
      },
    ],
  },
  {
    heading: "Career Intelligence",
    modules: [
      {
        slug: "career-hub",
        label: "Career Hub",
        icon: "Compass",
        description: "Your full career pipeline — from evidence to application.",
        href: "/dashboard/career-hub",
        color: "var(--accent-orange, #fb923c)",
      },
      {
        slug: "career-vault",
        label: "Career Vault",
        icon: "Briefcase",
        description: "Initiatives, evidence, skills mapping, and publishing.",
        href: "/dashboard/career-vault",
        color: "var(--accent-orange, #fb923c)",
      },
      {
        slug: "gap-discovery",
        label: "Mind the Gap",
        icon: "Crosshair",
        description: "Target companies, JD analysis, gap tracking, closure plans, and market patterns.",
        href: "/dashboard/gap-discovery",
        color: "var(--accent-red, #f87171)",
      },
      {
        slug: "interview-prep",
        label: "Interview Prep",
        icon: "GraduationCap",
        description: "Resume customization, story bank, and interview frameworks.",
        href: "/dashboard/interview-prep",
        color: "var(--accent-violet, #a78bfa)",
      },
      {
        slug: "job-central",
        label: "Job Central",
        icon: "Radar",
        description: "Job radar, applications, network, and sprint planning.",
        href: "/dashboard/job-central",
        color: "var(--accent-red, #ef4444)",
      },
    ],
  },
  {
    heading: "Content & Portfolio",
    modules: [
      {
        slug: "teardowns",
        label: "Teardown Builder",
        icon: "Wrench",
        description: "Research and publish product teardowns to your portfolio.",
        href: "/dashboard/teardowns",
        color: "var(--accent-amber)",
      },
      {
        slug: "wordweaver",
        label: "WordWeaver",
        icon: "PenTool",
        description: "Create blog posts and podcast content with your voice profile.",
        href: "/dashboard/wordweaver",
        color: "var(--accent-green)",
      },
      {
        slug: "madlab",
        label: "MadLab",
        icon: "Beaker",
        description: "Build and publish prototype overview pages for MadLab.",
        href: "/dashboard/madlab",
        color: "var(--accent-cyan, #67e8f9)",
      },
      {
        slug: "visual-assets",
        label: "Visual Asset Inventory",
        icon: "Layers",
        description: "Living spec sheet for every brand and site asset — shipped, in-progress, planned.",
        href: "/dashboard/visual-assets",
        color: "var(--accent-amber)",
      },
    ],
  },
  {
    heading: "Platform Ops",
    modules: [
      {
        slug: "fenix",
        label: "Fenix Dashboard",
        icon: "Bot",
        description: "Analytics, failure detection, and training for the Fenix AI assistant.",
        href: "/dashboard/fenix",
        color: "var(--accent-orange, #fb923c)",
      },
      {
        slug: "fenix-journal",
        label: "Fenix Journal",
        icon: "BookOpen",
        description: "Review Fenix's daily diary entries and observations.",
        href: "/dashboard/fenix-journal",
        color: "var(--accent-teal, #2dd4bf)",
      },
      {
        slug: "standards",
        label: "Standards & Compliance",
        icon: "ShieldCheck",
        description: "Audit every page across 5 compliance pillars with real-time scoring.",
        href: "/dashboard/standards",
        color: "var(--accent-emerald, #34d399)",
      },
      {
        slug: "tech-costs",
        label: "Tech Costs",
        icon: "DollarSign",
        description: "Full stack cost tracking — APIs, hosting, databases, and projections.",
        href: "/dashboard/tech-costs",
        color: "var(--accent-lime, #a3e635)",
      },
      {
        slug: "feedback",
        label: "Feedback & Testimonials",
        icon: "MessageSquare",
        description: "View site feedback and manage testimonial submissions.",
        href: "/dashboard/feedback",
        color: "var(--accent-pink, #f472b6)",
      },
    ],
  },
  {
    heading: "Thinking & Tracking",
    modules: [
      {
        slug: "action-items",
        label: "Action Items",
        icon: "CheckSquare",
        description: "Unified task tracker across all workstreams.",
        href: "/dashboard/action-items",
        color: "var(--accent-green, #34d399)",
      },
      {
        slug: "kirans-journal",
        label: "Kiran's Journal",
        icon: "BookHeart",
        description: "Strategic thinking, decisions, principles, and ideas.",
        href: "/dashboard/kirans-journal",
        color: "var(--accent-amber, #d4a74a)",
      },
      {
        slug: "library",
        label: "Knowledge Library",
        icon: "Library",
        description: "Searchable index of all project documentation with quick summaries.",
        href: "/dashboard/library",
        color: "var(--accent-indigo, #818cf8)",
      },
      {
        slug: "guides",
        label: "Product Guides",
        icon: "BookMarked",
        description: "Living knowledge base for each Command Center module.",
        href: "/dashboard/guides",
        color: "var(--accent-violet, #8b5cf6)",
      },
      {
        slug: "tools",
        label: "Tools & Links",
        icon: "ExternalLink",
        description: "Analytics dashboards, infrastructure, and external tools.",
        href: "/dashboard/tools",
        color: "var(--text-muted)",
      },
    ],
  },
];

// Flat MODULES array for backward compatibility
export const MODULES = SIDEBAR_SECTIONS.flatMap(s => s.modules);

export const APP_NAME = "Command Center";
