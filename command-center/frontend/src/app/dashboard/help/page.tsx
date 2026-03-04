"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  PenTool,
  Wrench,
  FileText,
  Target,
  ChevronDown,
  ChevronRight,
  BookOpen,
} from "lucide-react";

// ── Styles ───────────────────────────────────────────────────────
const card = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" };
const subcard = { backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" };

type Module = "wordweaver" | "teardowns" | "resume" | "job-central";

const MODULE_META: Record<Module, { label: string; icon: typeof PenTool; color: string; back: string }> = {
  wordweaver:    { label: "WordWeaver", icon: PenTool,  color: "var(--accent-blue)",  back: "/dashboard/wordweaver" },
  teardowns:     { label: "Teardowns",  icon: Wrench,   color: "var(--accent-amber)", back: "/dashboard/teardowns" },
  resume:        { label: "Resume Customizer", icon: FileText, color: "var(--accent-green)", back: "/dashboard/resume" },
  "job-central": { label: "Job Central", icon: Target,  color: "var(--accent-red)",   back: "/dashboard/job-central" },
};

// ── Collapsible Section ──────────────────────────────────────────

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg overflow-hidden" style={card}>
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left">
        <span className="text-sm font-medium text-[var(--text-primary)]">{title}</span>
        {open
          ? <ChevronDown size={16} className="text-[var(--text-muted)]" />
          : <ChevronRight size={16} className="text-[var(--text-muted)]" />}
      </button>
      {open && <div className="px-5 pb-5 space-y-3">{children}</div>}
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{children}</p>;
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <div className="space-y-1">
      {steps.map((s, i) => (
        <div key={i} className="flex gap-2.5 py-1.5 px-3 rounded-lg text-sm" style={subcard}>
          <span className="text-xs font-mono shrink-0 mt-0.5" style={{ color: "var(--accent-blue)" }}>{i + 1}.</span>
          <span className="text-[var(--text-secondary)]">{s}</span>
        </div>
      ))}
    </div>
  );
}

function Tag({ children, color = "var(--accent-blue)" }: { children: React.ReactNode; color?: string }) {
  return (
    <span className="inline-block text-xs px-2 py-0.5 rounded mr-1.5 mb-1"
      style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>
      {children}
    </span>
  );
}

// ── Module Help Content ──────────────────────────────────────────

function WordWeaverHelp() {
  return (
    <div className="space-y-3">
      <Section title="What is WordWeaver?" defaultOpen>
        <P>
          WordWeaver is your content production engine. It guides you through creating polished blog posts and social media content
          in an interactive, step-by-step workflow. Claude drafts at each step, but you approve and steer every decision before moving on.
        </P>
        <P>
          Everything is built around your personal voice profile — your writing style, tone, audience, and quality standards are baked
          into every piece of content produced.
        </P>
      </Section>

      <Section title="Blog Pipeline (12 Steps)" defaultOpen>
        <P>Each blog post goes through 12 collaborative steps. You approve each step before the next begins.</P>
        <StepList steps={[
          "Format, Theme & Angle — Choose one-off or series, pick your theme and cross-cutting angle",
          "Live Web Research — Claude runs 3-5 web searches for stats, studies, examples, and counter-arguments",
          "Topic Options — 3-5 topic ideas with titles, hypotheses, and data hooks to choose from",
          "Refinement Questions — Sharpening questions: target reader, anecdotes, contrarian level, companies to reference",
          "Structure & Format — Post blueprint with 4-7 sections, word counts, narrative arc, opening hook, closing move",
          "Anecdote Workshop — 2-3 anecdote options that fit the narrative arc",
          "Write the Post — Full draft (~1,750 words) following your approved structure and voice profile",
          "Editorial Filter — Insight check, position clarity, section value assessment, reputation risk scan",
          "Visual Assets — 1-3 proposed visuals (data visualizations or conceptual diagrams)",
          "Fact-Check — Every data point verified against primary sources with a verification table",
          "Originality Check — Distinctive phrases, novel thesis, voice authenticity verification",
          "Output & Package — Final post.md with YAML frontmatter, sources section, ready for publishing",
        ]} />
      </Section>

      <Section title="Social Post Pipeline (5 Steps)">
        <P>For social media content — standalone posts or posts derived from a blog.</P>
        <StepList steps={[
          "Source & Format — Standalone or derived from blog; select platform and format (single/carousel/quote card)",
          "Concept Options — 3 visual concepts with insights and captions",
          "Create Visual — SVG visual at correct platform dimensions",
          "Caption & Copy — Full caption, hashtags, and alt text",
          "Output — SVG files and caption markdown ready to post",
        ]} />
      </Section>

      <Section title="Themes & Angles">
        <P>
          Themes are the broad subject areas your content covers. Angles are the cross-cutting lenses
          you apply to a theme. When starting a blog, you pick one of each.
        </P>
        <P>
          Your themes and angles are loaded from a configuration file and can be customized.
          You can add new themes or remove old ones from the WordWeaver settings.
        </P>
      </Section>

      <Section title="Series">
        <P>When you choose &quot;series&quot; format, your post becomes part of a recurring content series. Available series templates include:</P>
        <div className="flex flex-wrap mt-1">
          <Tag>Demystifying [X]</Tag>
          <Tag>Product Teardown</Tag>
          <Tag>Product Award of the Month</Tag>
          <Tag>The Value Gap</Tag>
          <Tag>Signal vs. Noise</Tag>
          <Tag>Product Decision Autopsy</Tag>
          <Tag>The Contrarian Take</Tag>
          <Tag>5 Questions With</Tag>
        </div>
        <P>Series posts share consistent branding and build a recognizable library on your site.</P>
      </Section>

      <Section title="Voice Profile & Quality Standards">
        <P>Every piece of content is shaped by your personal voice profile, which includes:</P>
        <div className="flex flex-wrap mt-1">
          <Tag color="var(--accent-amber)">~1,750 words target</Tag>
          <Tag color="var(--accent-amber)">7-minute read</Tag>
          <Tag color="var(--accent-amber)">Oxford/Cambridge English</Tag>
          <Tag color="var(--accent-amber)">Sinek-Grant-Noah blend</Tag>
        </div>
        <P>
          Quality principles: lead with insight not summary, use data as seasoning not the meal, write for the busy reader,
          make section transitions feel inevitable, and maintain your credibility bar throughout.
        </P>
      </Section>

      <Section title="How Sessions Work">
        <P>
          Each blog or social post is a session. Sessions save your progress — you can leave and come back.
          Each step shows Claude&apos;s draft, and you either approve it, request revisions, or provide
          additional direction before advancing.
        </P>
      </Section>
    </div>
  );
}

function TeardownsHelp() {
  return (
    <div className="space-y-3">
      <Section title="What are Teardowns?" defaultOpen>
        <P>
          Teardowns are portfolio-quality product analyses where you and Claude co-create a deep, research-backed breakdown
          of a real product. Each teardown follows an 8-step process where Claude researches and drafts,
          and you approve and steer each step.
        </P>
        <P>
          The finished teardown gets published to your website as a case study, demonstrating your PM thinking.
          A core goal is that every teardown must read as genuinely human-written, not AI-generated.
        </P>
      </Section>

      <Section title="The 8-Step Pipeline" defaultOpen>
        <StepList steps={[
          "Real User Pain Points — Claude researches app store reviews, Reddit, Trustpilot, G2, and news to find 4-6 pain point clusters with real quotes and data",
          "Persona & Journey Map — A specific named persona is created with a journey map. You choose which pain clusters to build around",
          "JTBD Framework — Core Job, Supporting Jobs, and The Gap — where the product fails the user",
          "Keep / Kill / Build — What works, what to cut (traced to real user feedback), and what to add (with competitor precedent)",
          "Redesign & Wireframes — Specific proposed changes with SVG wireframe mockups showing before/after",
          "Business Case & KPIs — Realistic impact sizing with defensible numbers, counter-arguments, and what can't be measured",
          "PM Score & Stress Test — Rating out of 10, weakest spots identified, patches proposed, all claims re-verified",
          "AI-Detection Sweep & HTML — Final anti-AI pass and complete HTML generation ready for your site",
        ]} />
      </Section>

      <Section title="Anti-AI Writing Rules">
        <P>
          Every teardown follows strict rules to ensure it sounds like you wrote it, not a language model.
          These are enforced throughout and checked in the final sweep:
        </P>
        <div className="space-y-2 mt-2">
          <div className="rounded-lg p-3" style={subcard}>
            <p className="text-xs font-medium text-[var(--text-primary)] mb-1">Asymmetric Structure</p>
            <p className="text-xs text-[var(--text-muted)]">
              Section counts, KKB splits, journey stages, and KPI counts must differ from existing teardowns.
              No two teardowns should have the same structural shape.
            </p>
          </div>
          <div className="rounded-lg p-3" style={subcard}>
            <p className="text-xs font-medium text-[var(--text-primary)] mb-1">First-Person Asides</p>
            <p className="text-xs text-[var(--text-muted)]">
              Minimum 3-4 per teardown. Things like &quot;I spent two hours trying this...&quot;
              or &quot;I almost didn&apos;t include this one but...&quot;
            </p>
          </div>
          <div className="rounded-lg p-3" style={subcard}>
            <p className="text-xs font-medium text-[var(--text-primary)] mb-1">Dead Ends</p>
            <p className="text-xs text-[var(--text-muted)]">
              At least one angle explored and explicitly discarded. Shows real thinking, not a clean AI output.
            </p>
          </div>
          <div className="rounded-lg p-3" style={subcard}>
            <p className="text-xs font-medium text-[var(--text-primary)] mb-1">Honest Unknowns</p>
            <p className="text-xs text-[var(--text-muted)]">
              Name specific data that&apos;s missing and where you looked for it. Real analysts have gaps.
            </p>
          </div>
          <div className="rounded-lg p-3" style={subcard}>
            <p className="text-xs font-medium text-[var(--text-primary)] mb-1">Banned Phrases</p>
            <div className="flex flex-wrap mt-1">
              <Tag color="var(--accent-red)">Let&apos;s dive in</Tag>
              <Tag color="var(--accent-red)">Here&apos;s the thing</Tag>
              <Tag color="var(--accent-red)">It&apos;s worth noting</Tag>
              <Tag color="var(--accent-red)">compelling</Tag>
              <Tag color="var(--accent-red)">robust</Tag>
              <Tag color="var(--accent-red)">leverage</Tag>
            </div>
          </div>
        </div>
      </Section>

      <Section title="How Sessions Work">
        <P>
          Each teardown is a session tied to a company and product. Claude generates each step as a draft,
          which you review, revise, or approve. You can provide feedback and request changes before advancing.
          Sessions save automatically so you can return to them.
        </P>
      </Section>

      <Section title="What Gets Published">
        <P>
          The final step produces a complete HTML page that gets committed to your website repository via the
          git publishing system. Each teardown appears as a card on your &quot;How I&apos;d Build It&quot; page.
        </P>
      </Section>
    </div>
  );
}

function ResumeHelp() {
  return (
    <div className="space-y-3">
      <Section title="What is the Resume Customizer?" defaultOpen>
        <P>
          The Resume Customizer is a fully automated 12-step pipeline. You paste a job description,
          and it produces a complete application package — customized resume, match score, cover letter,
          company brief, and interview questions — all tailored to that specific role.
        </P>
        <P>
          Unlike WordWeaver and Teardowns, this pipeline runs without approval steps. You kick it off
          and watch the progress in real-time via streaming updates.
        </P>
      </Section>

      <Section title="The 12-Step Pipeline" defaultOpen>
        <StepList steps={[
          "Parsing Inputs — Detects or confirms your persona (PM, PjM, or PMM) and validates the JD",
          "Analyzing Job Description — Extracts company, title, key requirements, and responsibilities via Claude",
          "Selecting Template — Picks the right resume template based on persona and page length",
          "Reading Template Structure — Parses the template to understand sections and paragraph layout",
          "Generating Customized Content — Claude produces new summary, highlights, bullets, and skills priority",
          "Applying Edits to Resume — Rewrites summary, highlights, experience bullets per company, reorders skills, cleans formatting",
          "Running Quality Checks — Up to 3 auto-fix attempts for formatting issues (bold sweep, structure verification)",
          "Generating Match Score — Produces a match score document with gap analysis",
          "Writing Cover Letter — Generates a tailored cover letter for the specific company and role",
          "Compiling Company Brief — Research summary about the company",
          "Building Interview Questions — Role-specific questions and suggested answers",
          "Packaging Deliverables — Bundles everything into a downloadable ZIP",
        ]} />
      </Section>

      <Section title="Personas">
        <P>The system supports three persona templates, each with different resume framing:</P>
        <div className="flex flex-wrap mt-1">
          <Tag color="var(--accent-green)">PM — Product Manager</Tag>
          <Tag color="var(--accent-blue)">PjM — Project Manager</Tag>
          <Tag color="var(--accent-amber)">PMM — Product Marketing</Tag>
        </div>
        <P>
          You can let the system auto-detect the best persona from the job description, or explicitly choose one.
        </P>
      </Section>

      <Section title="Resume Versions">
        <P>Each persona has multiple length options:</P>
        <div className="flex flex-wrap mt-1">
          <Tag>1-Page</Tag>
          <Tag>2-Page</Tag>
          <Tag>3-Page</Tag>
        </div>
        <P>
          The 1-page version is more concise and omits the interests section. Longer versions include the full profile.
          The system selects from 9 pre-built templates (3 personas x 3 lengths).
        </P>
      </Section>

      <Section title="What You Get (5 Documents)">
        <div className="space-y-2 mt-1">
          <div className="rounded-lg p-3" style={subcard}>
            <p className="text-xs font-medium text-[var(--text-primary)]">Resume.docx</p>
            <p className="text-xs text-[var(--text-muted)]">Your resume rewritten with bullets aligned to the JD, skills reordered by relevance</p>
          </div>
          <div className="rounded-lg p-3" style={subcard}>
            <p className="text-xs font-medium text-[var(--text-primary)]">Match_Score.docx</p>
            <p className="text-xs text-[var(--text-muted)]">Detailed gap analysis showing how your experience maps to the role&apos;s requirements</p>
          </div>
          <div className="rounded-lg p-3" style={subcard}>
            <p className="text-xs font-medium text-[var(--text-primary)]">Cover_Letter.docx</p>
            <p className="text-xs text-[var(--text-muted)]">Tailored cover letter referencing the company and role specifically</p>
          </div>
          <div className="rounded-lg p-3" style={subcard}>
            <p className="text-xs font-medium text-[var(--text-primary)]">Company_Brief.docx</p>
            <p className="text-xs text-[var(--text-muted)]">Research summary about the company — useful for interview prep</p>
          </div>
          <div className="rounded-lg p-3" style={subcard}>
            <p className="text-xs font-medium text-[var(--text-primary)]">Interview_Questions.docx</p>
            <p className="text-xs text-[var(--text-muted)]">Role-specific questions with suggested answers based on your experience</p>
          </div>
        </div>
      </Section>

      <Section title="Quality Checks">
        <P>
          After applying edits, the system runs up to 3 rounds of automated quality verification.
          This includes a bold-sweep (removes accidental bold formatting), structure checks,
          and content completeness verification. If issues remain after 3 attempts,
          you&apos;ll see a warning with details so you can manually review.
        </P>
      </Section>
    </div>
  );
}

function JobCentralHelp() {
  return (
    <div className="space-y-3">
      <Section title="What is Job Central?" defaultOpen>
        <P>
          Job Central is your 12-week sprint command center for landing a Senior PM role. It combines
          application tracking, a story bank for interviews, networking management, and weekly planning
          into a single dashboard. The goal: 150-180 applications and 15-25 interviews over 12 weeks.
        </P>
      </Section>

      <Section title="Dashboard" defaultOpen>
        <P>The Dashboard gives you a daily overview with:</P>
        <div className="space-y-2 mt-1">
          <div className="rounded-lg p-3" style={subcard}>
            <p className="text-xs font-medium text-[var(--text-primary)]">Quick Stats</p>
            <p className="text-xs text-[var(--text-muted)]">Total applications, interviews, stories ready, and current week at a glance</p>
          </div>
          <div className="rounded-lg p-3" style={subcard}>
            <p className="text-xs font-medium text-[var(--text-primary)]">Today&apos;s Checklist</p>
            <p className="text-xs text-[var(--text-muted)]">5 daily tasks (apply to 3 companies, review 1 story, practice 1 question, reach out to 1 connection, follow up). You can also add custom tasks.</p>
          </div>
          <div className="rounded-lg p-3" style={subcard}>
            <p className="text-xs font-medium text-[var(--text-primary)]">Daily Progress Log</p>
            <p className="text-xs text-[var(--text-muted)]">Free-form text to reflect on what you accomplished, wins, and learnings</p>
          </div>
          <div className="rounded-lg p-3" style={subcard}>
            <p className="text-xs font-medium text-[var(--text-primary)]">Sprint Targets</p>
            <p className="text-xs text-[var(--text-muted)]">Progress bars for total applications (target: 165), interviews (target: 20), and this week&apos;s apps (target: 15)</p>
          </div>
        </div>
      </Section>

      <Section title="Applications">
        <P>Track every job application with company, role, tier, and status. Tiers help you prioritize:</P>
        <div className="flex flex-wrap mt-1">
          <Tag color="var(--accent-amber)">Dream — Stretch roles at top companies</Tag>
          <Tag color="var(--accent-blue)">High-Prob — Strong fit, good odds</Tag>
          <Tag>Practice — Lower-stakes applications for reps</Tag>
        </div>
        <P>Statuses flow through: Applied, Screening, Interview, Offer, Rejected, Withdrawn, Ghosted.</P>
      </Section>

      <Section title="Story Bank">
        <P>
          Your interview story library. Each story has a title, company, full narrative, and framework tags
          (STAR, CIRCLES, RICE, etc.). Stories are searchable by title, content, or framework.
        </P>
        <P>
          Company options are pre-loaded with your career history: Wells Fargo (VP Product), Avatour (Consulting),
          First Republic (Director), Wells Fargo (AVP), and Magley &amp; Associates (Consultant).
        </P>
      </Section>

      <Section title="Interview Prep">
        <P>Static reference material you can review before any interview:</P>
        <div className="space-y-2 mt-1">
          <div className="rounded-lg p-3" style={subcard}>
            <p className="text-xs font-medium text-[var(--text-primary)]">Framework Cards</p>
            <p className="text-xs text-[var(--text-muted)]">Quick reference for CIRCLES, RICE, STAR, and North Star frameworks with their step breakdowns</p>
          </div>
          <div className="rounded-lg p-3" style={subcard}>
            <p className="text-xs font-medium text-[var(--text-primary)]">Common PM Questions</p>
            <p className="text-xs text-[var(--text-muted)]">Product Design, Prioritization, Leadership, Strategy, Estimation, and Technical questions mapped to the right framework</p>
          </div>
          <div className="rounded-lg p-3" style={subcard}>
            <p className="text-xs font-medium text-[var(--text-primary)]">Pre-Interview Checklist</p>
            <p className="text-xs text-[var(--text-muted)]">5-item checklist: research company, review stories, prepare questions, practice out loud, set up space</p>
          </div>
        </div>
      </Section>

      <Section title="Network Tracker">
        <P>
          Track networking contacts through a progression of statuses:
        </P>
        <div className="flex flex-wrap mt-1">
          <Tag>Not Contacted</Tag>
          <Tag color="var(--accent-blue)">Reached Out</Tag>
          <Tag color="var(--accent-amber)">Meeting Scheduled</Tag>
          <Tag color="var(--accent-green)">Referral Requested</Tag>
          <Tag color="var(--accent-green)">Completed</Tag>
        </div>
        <P>Each contact stores name, company, role, status, and notes.</P>
      </Section>

      <Section title="12-Week Plan">
        <P>
          A pre-loaded 12-week roadmap from &quot;Foundation&quot; (Week 1) to &quot;Transition&quot; (Week 12).
          Each week has specific tasks you can check off. The plan auto-seeds when you first open the Weekly Plan tab.
        </P>
        <P>
          You can also add custom weeks. Progress bars show completion for each week.
        </P>
      </Section>

      <Section title="Export & Import">
        <P>
          Use the Export button to download a full JSON backup of all your data (applications, stories, contacts,
          plans, daily logs). Use Import to restore from a backup. This lets you move data between machines
          or keep regular backups.
        </P>
      </Section>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────

export default function HelpPage() {
  const params = useSearchParams();
  const moduleParam = (params.get("module") || "wordweaver") as Module;
  const [activeModule, setActiveModule] = useState<Module>(
    moduleParam in MODULE_META ? moduleParam : "wordweaver"
  );

  const meta = MODULE_META[activeModule];
  const Icon = meta.icon;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={meta.back}
          className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
          <ArrowLeft size={16} /> Back
        </Link>
        <div className="w-px h-5" style={{ backgroundColor: "var(--border)" }} />
        <BookOpen size={18} style={{ color: meta.color }} />
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">Help &amp; Documentation</h1>
      </div>

      {/* Module Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg flex-wrap" style={{ backgroundColor: "var(--bg-secondary)" }}>
        {(Object.entries(MODULE_META) as [Module, typeof meta][]).map(([key, m]) => {
          const TabIcon = m.icon;
          return (
            <button key={key} onClick={() => setActiveModule(key)}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all min-w-[120px]"
              style={{
                backgroundColor: activeModule === key ? "var(--bg-card)" : "transparent",
                color: activeModule === key ? "var(--text-primary)" : "var(--text-muted)",
                border: activeModule === key ? "1px solid var(--border)" : "1px solid transparent",
              }}>
              <TabIcon size={14} /> {m.label}
            </button>
          );
        })}
      </div>

      {/* Module Title */}
      <div className="flex items-center gap-3 mb-5">
        <Icon size={22} style={{ color: meta.color }} />
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">{meta.label}</h2>
      </div>

      {/* Content */}
      {activeModule === "wordweaver" && <WordWeaverHelp />}
      {activeModule === "teardowns" && <TeardownsHelp />}
      {activeModule === "resume" && <ResumeHelp />}
      {activeModule === "job-central" && <JobCentralHelp />}
    </div>
  );
}
