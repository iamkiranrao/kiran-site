export const MODULES = [
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
    slug: "resume",
    label: "Resume Customizer",
    icon: "FileText",
    description: "Tailor resumes and application packages to job descriptions.",
    href: "/dashboard/resume",
    color: "var(--accent-blue)",
  },
  {
    slug: "job-central",
    label: "Job Central",
    icon: "Target",
    description: "Track applications, prep for interviews, manage your job search.",
    href: "/dashboard/job-central",
    color: "var(--accent-red)",
  },
  {
    slug: "content-audit",
    label: "Content Audit",
    icon: "Shield",
    description: "Scan site content against voice and accuracy rules.",
    href: "/dashboard/content-audit",
    color: "var(--accent-purple, #a78bfa)",
  },
] as const;

export const APP_NAME = "Command Center";
