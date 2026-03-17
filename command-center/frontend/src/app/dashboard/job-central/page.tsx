"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Target,
  Plus,
  ChevronDown,
  CheckCircle2,
  Circle,
  Briefcase,
  BarChart3,
  Calendar,
  Trash2,
  ExternalLink,
  Loader2,
  X,
  BookOpen,
  Users,
  ClipboardList,
  Search,
  Edit3,
  MessageSquare,
  Download,
  Upload,
  Save,
  HelpCircle,
  Radar,
  RefreshCw,
  Clock,
  Building2,
  MapPin,
  ArrowRight,
  Filter,
  ChevronUp,
  Zap,
  Star,
  Eye,
  EyeOff,
  Send,
  AlertCircle,
  Check,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ModuleHelp from "@/components/ModuleHelp";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Interfaces ───────────────────────────────────────────────────

interface Application {
  id: string;
  company: string;
  role: string;
  tier: string;
  status: string;
  url?: string;
  notes?: string;
  applied_date: string;
  updated_date: string;
}

interface SprintData {
  targets: {
    applications: { target: number; current: number; pct: number };
    interviews: { target: number; current: number; pct: number };
    weekly_apps: { target: number; current_week: number };
  };
  by_status: Record<string, number>;
  by_tier: Record<string, number>;
  active_count: number;
}

interface ChecklistItem {
  id: string;
  task: string;
  category: string;
  done: boolean;
}

interface Story {
  id: string;
  title: string;
  company: string;
  content: string;
  frameworks: string[];
  created_date: string;
}

interface Contact {
  id: string;
  name: string;
  company: string;
  role?: string;
  status: string;
  notes?: string;
  created_date: string;
}

interface WeekTask {
  id: string;
  description: string;
  completed: boolean;
}

interface WeekPlan {
  id: string;
  week_number: number;
  title: string;
  tasks: WeekTask[];
  created_date: string;
}

interface RadarJob {
  id: string;
  company: string;
  title: string;
  location: string;
  location_group: string;
  posted_at: string;
  url: string;
  source: string;
  ats: string;
  department: string;
  freshness: string;
  freshness_label: string;
  discovered_at: string;
  status: string;
  notes?: string;
  salary?: { min: number; max: number; raw: string };
  fit_score?: number;
  fit_label?: string;
  rank_score?: number;
  fit_breakdown?: {
    seniority: number;
    domain: number;
    domain_matches: string[];
    company_tier: string;
    company_tier_score: number;
    location: number;
    compensation: number;
    is_bank?: boolean;
    bank_penalty?: number;
  };
}

interface RadarStats {
  total_jobs: number;
  by_freshness: Record<string, number>;
  by_company: Record<string, number>;
  by_status: Record<string, number>;
  last_scan: { timestamp: string; companies_scanned: number; new_jobs_found: number } | null;
  companies_monitored: number;
}

type Tab = "radar" | "dashboard" | "applications" | "stories" | "prep" | "network" | "weekly";

// ── Constants ────────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  dream: "var(--accent-amber)",
  "high-prob": "var(--accent-blue)",
  practice: "var(--text-muted)",
};

const STATUS_COLORS: Record<string, string> = {
  applied: "var(--text-secondary)",
  screening: "var(--accent-blue)",
  interview: "var(--accent-amber)",
  offer: "var(--accent-green)",
  rejected: "var(--accent-red)",
  withdrawn: "var(--text-muted)",
  ghosted: "var(--text-muted)",
};

const CONTACT_STATUS_LABELS: Record<string, string> = {
  not_contacted: "Not Contacted",
  reached_out: "Reached Out",
  meeting_scheduled: "Meeting Scheduled",
  referral_requested: "Referral Requested",
  completed: "Completed",
};

const CONTACT_STATUS_COLORS: Record<string, string> = {
  not_contacted: "var(--text-muted)",
  reached_out: "var(--accent-blue)",
  meeting_scheduled: "var(--accent-amber)",
  referral_requested: "var(--accent-green)",
  completed: "var(--accent-green)",
};

const FRESHNESS_COLORS: Record<string, string> = {
  gold: "#f59e0b", strong: "#22c55e", decent: "#3b82f6", stale: "#6b7280",
};
const FRESHNESS_BG: Record<string, string> = {
  gold: "rgba(245,158,11,0.12)", strong: "rgba(34,197,94,0.12)",
  decent: "rgba(59,130,246,0.12)", stale: "rgba(107,114,128,0.10)",
};
const FRESHNESS_ICONS: Record<string, typeof Zap> = {
  gold: Zap, strong: Star, decent: Clock, stale: Clock,
};

const FIT_COLORS: Record<string, string> = {
  "Excellent Fit": "#22c55e",
  "Strong Fit": "#3b82f6",
  "Good Fit": "#8b5cf6",
  "Moderate Fit": "#f59e0b",
  "Low Fit": "#6b7280",
};
const FIT_BG: Record<string, string> = {
  "Excellent Fit": "rgba(34,197,94,0.10)",
  "Strong Fit": "rgba(59,130,246,0.10)",
  "Good Fit": "rgba(139,92,246,0.10)",
  "Moderate Fit": "rgba(245,158,11,0.10)",
  "Low Fit": "rgba(107,114,128,0.08)",
};

function timeAgo(iso: string): string {
  if (!iso) return "Unknown";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

const FRAMEWORKS = [
  { name: "CIRCLES", description: "Product Design Framework", steps: ["Comprehend", "Identify", "Report", "Cut", "List", "Evaluate", "Summarize"] },
  { name: "RICE", description: "Prioritization Framework", steps: ["Reach", "Impact", "Confidence", "Effort"] },
  { name: "STAR", description: "Behavioral Interview Framework", steps: ["Situation", "Task", "Action", "Result"] },
  { name: "North Star", description: "Metrics & Strategy Framework", steps: ["Define key metric", "Align team", "Track progress", "Iterate"] },
];

const COMMON_QUESTIONS = [
  { category: "Product Design", question: "Design a product for X", framework: "CIRCLES" },
  { category: "Prioritization", question: "How would you prioritize features?", framework: "RICE" },
  { category: "Leadership", question: "Tell me about a time you led a difficult project", framework: "STAR" },
  { category: "Strategy", question: "How do you measure product success?", framework: "North Star" },
  { category: "Estimation", question: "How many X are there in Y?", framework: "Fermi" },
  { category: "Technical", question: "Walk me through a system design for...", framework: "Architecture" },
];

const PRE_INTERVIEW_CHECKLIST = [
  "Research company and product",
  "Review your story bank for relevant examples",
  "Prepare questions for the interviewer",
  "Practice framework answers out loud",
  "Set up quiet space for interview",
];

const DAILY_MOTIVATIONS = [
  "You're not behind. You're exactly where you need to be.",
  "Every application is a step closer. Keep building momentum.",
  "The right company is looking for exactly someone like you.",
  "Rejection is redirection. Your dream role is still out there.",
  "You've navigated harder challenges than this. Trust the process.",
  "Today's effort is tomorrow's opportunity. Show up and ship.",
  "Your experience at Wells Fargo and beyond is your superpower.",
  "Consistency beats intensity. Three apps a day adds up fast.",
  "The best PMs are relentless learners. That's you.",
  "One great conversation can change everything. Reach out today.",
  "You're not just job hunting — you're choosing your next chapter.",
  "Preparation compounds. Every story you refine pays dividends in interviews.",
  "The interview pipeline is a numbers game. Keep filling the top of the funnel.",
  "Senior PM roles go to people who show up prepared. You've got this.",
  "Your unique blend of fintech, XR, and AI makes you stand out.",
  "Don't compare your Week 2 to someone else's Week 10.",
  "Every 'no' gets you closer to the right 'yes.'",
  "Focus on what you can control: applications, prep, and follow-ups.",
  "You've led teams, shipped products, and scaled platforms. Own that.",
  "The compound effect is real — small daily actions create big results.",
  "Breathe. You have a plan. Work the plan.",
  "Your Command Center exists because you're the kind of person who builds systems. That's a PM superpower.",
  "Today is a great day to land an interview.",
  "Think of networking as helping others help you. People want to connect.",
  "Your story bank is your secret weapon. Keep sharpening it.",
  "Momentum is everything. Don't break the chain.",
  "The role that's meant for you won't care that the others said no.",
  "You're playing a 12-week game. Stay focused on this week's goals.",
  "Imposter syndrome means you're growing. Push through it.",
  "Ship today's tasks. Tomorrow-you will be grateful.",
  "Remember why you started. That energy will carry you through.",
];

// ── Helpers ──────────────────────────────────────────────────────

const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" };
const inputStyle = { backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" };

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function dayName() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function dailyMotivation() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
  return DAILY_MOTIVATIONS[dayOfYear % DAILY_MOTIVATIONS.length];
}

// ── Main Component ───────────────────────────────────────────────

export default function JobCentralPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("radar");
  const [sprint, setSprint] = useState<SprintData | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [checklist, setChecklist] = useState<{ date: string; items: ChecklistItem[] } | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [weekPlans, setWeekPlans] = useState<WeekPlan[]>([]);
  const [dailyLog, setDailyLog] = useState("");
  const [logSaved, setLogSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  // App form
  const [showAddForm, setShowAddForm] = useState(false);
  const [filterTier, setFilterTier] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [newCompany, setNewCompany] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newTier, setNewTier] = useState("practice");
  const [newUrl, setNewUrl] = useState("");

  // Custom checklist task
  const [newTask, setNewTask] = useState("");

  // Story form
  const [showStoryForm, setShowStoryForm] = useState(false);
  const [editStory, setEditStory] = useState<Story | null>(null);
  const [storySearch, setStorySearch] = useState("");

  // Contact form
  const [showContactForm, setShowContactForm] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);

  // Week plan form
  const [showWeekForm, setShowWeekForm] = useState(false);

  // Import ref
  const importRef = useRef<HTMLInputElement>(null);

  // Radar state
  const [radarJobs, setRadarJobs] = useState<RadarJob[]>([]);
  const [radarStats, setRadarStats] = useState<RadarStats | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanBanner, setScanBanner] = useState<string | null>(null);
  const [radarSearch, setRadarSearch] = useState("");
  const [radarFreshness, setRadarFreshness] = useState("");
  const [radarCompany, setRadarCompany] = useState("");
  const [radarLocationGroups, setRadarLocationGroups] = useState<string[]>(["bay_area", "remote", "uk", "australia", "uae"]);
  const [showRadarFilters, setShowRadarFilters] = useState(false);
  const [radarFitLabel, setRadarFitLabel] = useState("");
  const [radarMinFit, setRadarMinFit] = useState("");
  const [radarCompanyTier, setRadarCompanyTier] = useState("");
  const [radarSource, setRadarSource] = useState("");
  const [radarHasSalary, setRadarHasSalary] = useState("");
  const [radarSeniority, setRadarSeniority] = useState("");
  const [radarExcludeBanks, setRadarExcludeBanks] = useState(false);
  const [radarMinSalary, setRadarMinSalary] = useState("");
  const [radarMaxSalary, setRadarMaxSalary] = useState("");
  const [radarPage, setRadarPage] = useState(1);
  const [radarTotalPages, setRadarTotalPages] = useState(1);
  const [radarTotal, setRadarTotal] = useState(0);
  const RADAR_PAGE_SIZE = 25;
  const [savedJobs, setSavedJobs] = useState<RadarJob[]>([]);
  const [showSavedJobs, setShowSavedJobs] = useState(true);
  const [pipelineJob, setPipelineJob] = useState<RadarJob | null>(null);
  const [pipelinePersona, setPipelinePersona] = useState("pm");
  const [pipelineLength, setPipelineLength] = useState("2pager");
  const [pipelineTier, setPipelineTier] = useState("high-prob");

  // ── Fetch helpers ──────────────────────────────────────────────

  const fetchSprint = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/jobs/`);
      if (res.ok) setSprint(await res.json());
    } catch { /* server offline */ }
  }, []);

  const fetchApps = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterTier) params.set("tier", filterTier);
      if (filterStatus) params.set("status", filterStatus);
      const res = await fetch(`${API_URL}/api/jobs/applications?${params}`);
      if (res.ok) {
        const data = await res.json();
        setApps(data.applications || []);
      }
    } catch { /* server offline */ }
  }, [filterTier, filterStatus]);

  const fetchChecklist = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/jobs/checklist/daily`);
      if (res.ok) setChecklist(await res.json());
    } catch { /* server offline */ }
  }, []);

  const fetchStories = useCallback(async () => {
    try {
      const params = storySearch ? `?search=${encodeURIComponent(storySearch)}` : "";
      const res = await fetch(`${API_URL}/api/jobs/stories${params}`);
      if (res.ok) {
        const data = await res.json();
        setStories(data.stories || []);
      }
    } catch { /* server offline */ }
  }, [storySearch]);

  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/jobs/contacts`);
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || []);
      }
    } catch { /* server offline */ }
  }, []);

  const fetchWeekPlans = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/jobs/plans`);
      if (res.ok) {
        const data = await res.json();
        setWeekPlans(data.plans || []);
      }
    } catch { /* server offline */ }
  }, []);

  const fetchDailyLog = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/jobs/logs/${todayStr()}`);
      if (res.ok) {
        const data = await res.json();
        setDailyLog(data.content || "");
      }
    } catch { /* server offline */ }
  }, []);

  // Radar fetches
  const fetchRadarJobs = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        status: "new",
        page: String(radarPage), page_size: String(RADAR_PAGE_SIZE),
      });
      if (radarFreshness) params.set("freshness", radarFreshness);
      if (radarCompany) params.set("company", radarCompany);
      if (radarFitLabel) params.set("fit_label", radarFitLabel);
      if (radarMinFit) params.set("min_fit_score", radarMinFit);
      if (radarCompanyTier) params.set("company_tier", radarCompanyTier);
      if (radarSource) params.set("source", radarSource);
      if (radarHasSalary === "yes") params.set("has_salary", "true");
      if (radarHasSalary === "no") params.set("has_salary", "false");
      if (radarSeniority) params.set("seniority", radarSeniority);
      if (radarExcludeBanks) params.set("exclude_banks", "true");
      if (radarMinSalary) params.set("min_salary", radarMinSalary);
      if (radarMaxSalary) params.set("max_salary", radarMaxSalary);
      for (const lg of radarLocationGroups) {
        params.append("location", lg);
      }
      const res = await fetch(`${API_URL}/api/radar/jobs?${params}`);
      if (res.ok) {
        const d = await res.json();
        setRadarJobs(d.jobs || []);
        setRadarTotal(d.total || 0);
        setRadarTotalPages(d.total_pages || 1);
      }
    } catch { /* offline */ }
  }, [radarFreshness, radarCompany, radarLocationGroups, radarPage, radarFitLabel, radarMinFit, radarCompanyTier, radarSource, radarHasSalary, radarSeniority, radarExcludeBanks, radarMinSalary, radarMaxSalary]);

  const fetchSavedJobs = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/radar/jobs?status=saved&page_size=0`);
      if (res.ok) { const d = await res.json(); setSavedJobs(d.jobs || []); }
    } catch { /* offline */ }
  }, []);

  const fetchRadarStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/radar/stats`);
      if (res.ok) setRadarStats(await res.json());
    } catch { /* offline */ }
  }, []);

  useEffect(() => {
    fetchSprint();
    fetchApps();
    fetchChecklist();
    fetchStories();
    fetchContacts();
    fetchWeekPlans();
    fetchDailyLog();
    fetchRadarJobs();
    fetchSavedJobs();
    fetchRadarStats();
  }, [fetchSprint, fetchApps, fetchChecklist, fetchStories, fetchContacts, fetchWeekPlans, fetchDailyLog, fetchRadarJobs, fetchSavedJobs, fetchRadarStats]);

  useEffect(() => { fetchApps(); }, [fetchApps]);
  useEffect(() => { fetchStories(); }, [fetchStories]);
  useEffect(() => { fetchRadarJobs(); }, [fetchRadarJobs]);

  // ── Radar handlers ──────────────────────────────────────────────

  const runScan = async () => {
    setScanning(true); setScanBanner(null);
    try {
      const res = await fetch(`${API_URL}/api/radar/scan`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setScanBanner(`Scanned ${data.companies_scanned} companies — ${data.new_jobs?.length || 0} new jobs found`);
        fetchRadarJobs(); fetchRadarStats(); fetchSprint();
      }
    } catch { /* offline */ }
    setScanning(false);
  };

  const updateRadarStatus = async (jobId: string, status: string) => {
    try {
      await fetch(`${API_URL}/api/radar/jobs/${jobId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      fetchRadarJobs();
      fetchSavedJobs();
    } catch { /* ignore */ }
  };

  const pushToPipeline = async () => {
    if (!pipelineJob) return;
    try {
      const res = await fetch(`${API_URL}/api/radar/jobs/${pipelineJob.id}/pipeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona: pipelinePersona, length: pipelineLength, tier: pipelineTier }),
      });
      if (res.ok) {
        const data = await res.json();
        setPipelineJob(null);
        fetchRadarJobs(); fetchApps(); fetchSprint();
        // Navigate to Resume Customizer with pre-filled params
        const jobUrl = pipelineJob.url;
        if (jobUrl) {
          const params = new URLSearchParams({
            jdUrl: jobUrl,
            persona: pipelinePersona,
            version: pipelineLength,
          });
          router.push(`/dashboard/resume?${params}`);
        } else {
          // No URL — just switch to applications tab
          setTab("applications");
        }
      }
    } catch { /* ignore */ }
  };

  const filteredRadarJobs = radarSearch
    ? radarJobs.filter(j =>
        j.title.toLowerCase().includes(radarSearch.toLowerCase()) ||
        j.company.toLowerCase().includes(radarSearch.toLowerCase()) ||
        j.location.toLowerCase().includes(radarSearch.toLowerCase()))
    : radarJobs;

  // ── Application handlers ───────────────────────────────────────

  const handleAddApp = async () => {
    if (!newCompany.trim() || !newRole.trim()) return;
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/jobs/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: newCompany, role: newRole, tier: newTier, url: newUrl || null }),
      });
      setNewCompany(""); setNewRole(""); setNewTier("practice"); setNewUrl("");
      setShowAddForm(false);
      fetchApps(); fetchSprint();
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleStatusChange = async (appId: string, status: string) => {
    try {
      await fetch(`${API_URL}/api/jobs/applications/${appId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      fetchApps(); fetchSprint();
    } catch (e) { console.error(e); }
  };

  const handleDeleteApp = async (appId: string) => {
    try {
      await fetch(`${API_URL}/api/jobs/applications/${appId}`, { method: "DELETE" });
      fetchApps(); fetchSprint();
    } catch (e) { console.error(e); }
  };

  // ── Checklist handlers ─────────────────────────────────────────

  const handleToggleChecklist = async (itemId: string, done: boolean) => {
    if (!checklist) return;
    try {
      await fetch(`${API_URL}/api/jobs/checklist/${checklist.date}/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done }),
      });
      fetchChecklist();
    } catch (e) { console.error(e); }
  };

  const handleAddCustomTask = async () => {
    if (!newTask.trim() || !checklist) return;
    try {
      await fetch(`${API_URL}/api/jobs/checklist/${checklist.date}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: newTask }),
      });
      setNewTask("");
      fetchChecklist();
    } catch (e) { console.error(e); }
  };

  // ── Daily log handler ──────────────────────────────────────────

  const handleSaveLog = async () => {
    try {
      await fetch(`${API_URL}/api/jobs/logs/${todayStr()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: dailyLog }),
      });
      setLogSaved(true);
      setTimeout(() => setLogSaved(false), 2000);
    } catch (e) { console.error(e); }
  };

  // ── Story handlers ─────────────────────────────────────────────

  const handleSaveStory = async (data: { title: string; company: string; content: string; frameworks: string[] }) => {
    try {
      if (editStory) {
        await fetch(`${API_URL}/api/jobs/stories/${editStory.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      } else {
        await fetch(`${API_URL}/api/jobs/stories`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      }
      setShowStoryForm(false);
      setEditStory(null);
      fetchStories();
    } catch (e) { console.error(e); }
  };

  const handleDeleteStory = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/jobs/stories/${id}`, { method: "DELETE" });
      fetchStories();
    } catch (e) { console.error(e); }
  };

  // ── Contact handlers ───────────────────────────────────────────

  const handleSaveContact = async (data: { name: string; company: string; role?: string; status: string; notes?: string }) => {
    try {
      if (editContact) {
        await fetch(`${API_URL}/api/jobs/contacts/${editContact.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      } else {
        await fetch(`${API_URL}/api/jobs/contacts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      }
      setShowContactForm(false);
      setEditContact(null);
      fetchContacts();
    } catch (e) { console.error(e); }
  };

  const handleDeleteContact = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/jobs/contacts/${id}`, { method: "DELETE" });
      fetchContacts();
    } catch (e) { console.error(e); }
  };

  // ── Week plan handlers ─────────────────────────────────────────

  const handleSaveWeekPlan = async (data: { week_number: number; title: string; tasks: string[] }) => {
    try {
      await fetch(`${API_URL}/api/jobs/plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setShowWeekForm(false);
      fetchWeekPlans();
    } catch (e) { console.error(e); }
  };

  const handleToggleTask = async (planId: string, taskId: string, completed: boolean) => {
    try {
      await fetch(`${API_URL}/api/jobs/plans/${planId}/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      fetchWeekPlans();
    } catch (e) { console.error(e); }
  };

  const handleDeletePlan = async (planId: string) => {
    try {
      await fetch(`${API_URL}/api/jobs/plans/${planId}`, { method: "DELETE" });
      fetchWeekPlans();
    } catch (e) { console.error(e); }
  };

  // ── Export / Import ────────────────────────────────────────────

  const handleExport = async () => {
    try {
      const res = await fetch(`${API_URL}/api/jobs/export`);
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `job-central-backup-${todayStr()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) { console.error(e); }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await fetch(`${API_URL}/api/jobs/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      // Refresh everything
      fetchSprint(); fetchApps(); fetchChecklist(); fetchStories(); fetchContacts(); fetchWeekPlans();
    } catch (e) { console.error(e); }
    if (importRef.current) importRef.current.value = "";
  };

  // ── Current week calc ──────────────────────────────────────────
  const currentWeekPlan = weekPlans.length > 0 ? weekPlans[0] : null;
  const currentWeekProgress = currentWeekPlan
    ? Math.round((currentWeekPlan.tasks.filter((t) => t.completed).length / currentWeekPlan.tasks.length) * 100)
    : 0;

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Target size={24} className="text-[var(--accent-red)]" />
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Job Search Command Center</h1>
            <ModuleHelp moduleSlug="job-central" />
            <Link href="/dashboard/help?module=job-central"
              className="text-[var(--text-muted)] hover:text-[var(--accent-red)] transition-colors"
              title="Help & Documentation">
              <HelpCircle size={18} />
            </Link>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">12-Week Sprint to Landing Your Dream PM Role</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
            style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            <Download size={14} /> Export
          </button>
          <button onClick={() => importRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
            style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            <Upload size={14} /> Import
          </button>
          <input ref={importRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          <button onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: "var(--accent-red)", color: "#fff" }}>
            <Plus size={16} /> Add Application
          </button>
        </div>
      </div>

      {/* Motivational — rotates daily */}
      <p className="text-xs text-[var(--text-muted)] mb-6 italic">
        {dailyMotivation()}
      </p>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg flex-wrap" style={{ backgroundColor: "var(--bg-secondary)" }}>
        {([
          { key: "radar" as Tab, label: "Radar", icon: Radar },
          { key: "dashboard" as Tab, label: "Dashboard", icon: BarChart3 },
          { key: "applications" as Tab, label: "Applications", icon: Briefcase },
          { key: "stories" as Tab, label: "Story Bank", icon: BookOpen },
          { key: "prep" as Tab, label: "Interview Prep", icon: MessageSquare },
          { key: "network" as Tab, label: "Network", icon: Users },
          { key: "weekly" as Tab, label: "Weekly Plan", icon: ClipboardList },
        ]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all min-w-[110px]"
            style={{
              backgroundColor: tab === t.key ? "var(--bg-card)" : "transparent",
              color: tab === t.key ? "var(--text-primary)" : "var(--text-muted)",
              border: tab === t.key ? "1px solid var(--border)" : "1px solid transparent",
            }}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Modals ──────────────────────────────────────────────── */}

      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="w-full max-w-md rounded-xl p-6" style={cardStyle}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Add Application</h3>
              <button onClick={() => setShowAddForm(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <input value={newCompany} onChange={(e) => setNewCompany(e.target.value)} placeholder="Company"
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]" style={inputStyle} />
              <input value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="Role"
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]" style={inputStyle} />
              <div className="relative">
                <select value={newTier} onChange={(e) => setNewTier(e.target.value)}
                  className="w-full appearance-none rounded-lg px-3 py-2.5 text-sm pr-8 focus:outline-none" style={inputStyle}>
                  <option value="dream">Dream</option>
                  <option value="high-prob">High-Prob</option>
                  <option value="practice">Practice</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
              </div>
              <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="Job URL (optional)"
                className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]" style={inputStyle} />
              <button onClick={handleAddApp} disabled={!newCompany.trim() || !newRole.trim() || loading}
                className="w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                style={{ backgroundColor: "var(--accent-red)", color: "#fff", opacity: newCompany.trim() && newRole.trim() ? 1 : 0.5 }}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add Application
              </button>
            </div>
          </div>
        </div>
      )}

      {showStoryForm && (
        <StoryModal story={editStory}
          onSave={handleSaveStory}
          onClose={() => { setShowStoryForm(false); setEditStory(null); }} />
      )}

      {showContactForm && (
        <ContactModal contact={editContact}
          onSave={handleSaveContact}
          onClose={() => { setShowContactForm(false); setEditContact(null); }} />
      )}

      {showWeekForm && (
        <WeekPlanModal weekNumber={weekPlans.length + 1}
          onSave={handleSaveWeekPlan}
          onClose={() => setShowWeekForm(false)} />
      )}

      {/* ═══════════════ RADAR TAB ════════════════════════════════ */}
      {tab === "radar" && (
        <div>
          {/* Scan button + stats row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              {radarStats && (
                <>
                  <span className="flex items-center gap-1 text-xs" style={{ color: FRESHNESS_COLORS.gold }}>
                    <Zap size={12} /> {radarStats.by_freshness?.gold || 0} gold
                  </span>
                  <span className="flex items-center gap-1 text-xs" style={{ color: FRESHNESS_COLORS.strong }}>
                    <Star size={12} /> {radarStats.by_freshness?.strong || 0} strong
                  </span>
                  <span className="flex items-center gap-1 text-xs" style={{ color: FRESHNESS_COLORS.decent }}>
                    <Clock size={12} /> {radarStats.by_freshness?.decent || 0} decent
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {radarStats.total_jobs} total · Last scan: {radarStats.last_scan ? timeAgo(radarStats.last_scan.timestamp) : "never"}
                  </span>
                </>
              )}
            </div>
            <button onClick={runScan} disabled={scanning}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ backgroundColor: scanning ? "var(--bg-secondary)" : "var(--accent-green, #22c55e)", color: scanning ? "var(--text-muted)" : "#fff" }}>
              {scanning ? <><Loader2 size={14} className="animate-spin" /> Scanning…</> : <><RefreshCw size={14} /> Scan Now</>}
            </button>
          </div>

          {/* Scan result banner */}
          {scanBanner && (
            <div className="rounded-lg p-3 mb-4 flex items-center justify-between"
              style={{ backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)" }}>
              <span className="flex items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
                <Check size={16} style={{ color: "var(--accent-green)" }} /> {scanBanner}
              </span>
              <button onClick={() => setScanBanner(null)} style={{ color: "var(--text-muted)" }}><X size={14} /></button>
            </div>
          )}

          {/* Search + filters */}
          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <Search size={16} style={{ color: "var(--text-muted)", position: "absolute", left: 12, top: 11 }} />
              <input value={radarSearch} onChange={e => setRadarSearch(e.target.value)}
                placeholder="Search by title, company, or location…"
                className="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-green)]"
                style={inputStyle} />
            </div>
            <button onClick={() => setShowRadarFilters(!showRadarFilters)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors"
              style={{ ...cardStyle, color: showRadarFilters ? "var(--accent-green)" : "var(--text-secondary)" }}>
              <Filter size={14} /> {showRadarFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {showRadarFilters && (
            <div className="flex flex-col gap-3 mb-4 p-4 rounded-xl" style={{ ...cardStyle }}>
              {/* Row 1: Location group toggles */}
              <div>
                <span className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-muted)" }}>Location</span>
                <div className="flex gap-2 flex-wrap">
                  {([
                    { key: "bay_area", label: "Bay Area" },
                    { key: "remote", label: "Remote" },
                    { key: "other_us", label: "Other US" },
                    { key: "uk", label: "🇬🇧 UK" },
                    { key: "australia", label: "🇦🇺 Australia" },
                    { key: "uae", label: "🇦🇪 UAE" },
                  ] as const).map(lg => {
                    const active = radarLocationGroups.includes(lg.key);
                    return (
                      <button key={lg.key}
                        onClick={() => { setRadarLocationGroups(prev =>
                          active ? prev.filter(g => g !== lg.key) : [...prev, lg.key]
                        ); setRadarPage(1); }}
                        className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                        style={{
                          backgroundColor: active ? "var(--accent-blue, #3b82f6)" : "var(--bg-secondary)",
                          color: active ? "#fff" : "var(--text-muted)",
                          border: active ? "1px solid var(--accent-blue, #3b82f6)" : "1px solid var(--border)",
                        }}>
                        {lg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 2: Freshness + Fit + Seniority + Company */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-xs font-medium mb-1 block" style={{ color: "var(--text-muted)" }}>Freshness</span>
                  <select value={radarFreshness} onChange={e => { setRadarFreshness(e.target.value); setRadarPage(1); }}
                    className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={inputStyle}>
                    <option value="">All</option>
                    <option value="gold">Gold (&lt;6h)</option>
                    <option value="strong">Strong (6-24h)</option>
                    <option value="decent">Decent (24-48h)</option>
                    <option value="stale">Stale (&gt;48h)</option>
                  </select>
                </div>
                <div>
                  <span className="text-xs font-medium mb-1 block" style={{ color: "var(--text-muted)" }}>Fit Level</span>
                  <select value={radarFitLabel} onChange={e => { setRadarFitLabel(e.target.value); setRadarPage(1); }}
                    className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={inputStyle}>
                    <option value="">All Fit</option>
                    <option value="Excellent">Excellent (80+)</option>
                    <option value="Strong">Strong (60-79)</option>
                    <option value="Good">Good (40-59)</option>
                    <option value="Moderate">Moderate (20-39)</option>
                    <option value="Low">Low (&lt;20)</option>
                  </select>
                </div>
                <div>
                  <span className="text-xs font-medium mb-1 block" style={{ color: "var(--text-muted)" }}>Seniority</span>
                  <select value={radarSeniority} onChange={e => { setRadarSeniority(e.target.value); setRadarPage(1); }}
                    className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={inputStyle}>
                    <option value="">All Levels</option>
                    <option value="principal">Principal</option>
                    <option value="staff">Staff</option>
                    <option value="group">Group</option>
                    <option value="senior">Senior</option>
                    <option value="director">Director</option>
                    <option value="vp">VP</option>
                    <option value="head">Head of</option>
                  </select>
                </div>
                <div>
                  <span className="text-xs font-medium mb-1 block" style={{ color: "var(--text-muted)" }}>Company</span>
                  <input value={radarCompany} onChange={e => { setRadarCompany(e.target.value); setRadarPage(1); }}
                    placeholder="Type to filter…"
                    className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={inputStyle} />
                </div>
              </div>

              {/* Row 3: Company Tier + Source + Salary + Toggles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-xs font-medium mb-1 block" style={{ color: "var(--text-muted)" }}>Company Tier</span>
                  <select value={radarCompanyTier} onChange={e => { setRadarCompanyTier(e.target.value); setRadarPage(1); }}
                    className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={inputStyle}>
                    <option value="">All Tiers</option>
                    <option value="dream">Dream</option>
                    <option value="high-prob">High Probability</option>
                    <option value="practice">Practice</option>
                  </select>
                </div>
                <div>
                  <span className="text-xs font-medium mb-1 block" style={{ color: "var(--text-muted)" }}>Source</span>
                  <select value={radarSource} onChange={e => { setRadarSource(e.target.value); setRadarPage(1); }}
                    className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={inputStyle}>
                    <option value="">All Sources</option>
                    <optgroup label="Direct ATS">
                      <option value="greenhouse">Greenhouse</option>
                      <option value="lever">Lever</option>
                      <option value="ashby">Ashby</option>
                    </optgroup>
                    <optgroup label="Aggregators">
                      <option value="remotive">Remotive</option>
                      <option value="themuse">The Muse</option>
                      <option value="adzuna">Adzuna</option>
                    </optgroup>
                  </select>
                </div>
                <div>
                  <span className="text-xs font-medium mb-1 block" style={{ color: "var(--text-muted)" }}>Min Salary ($k)</span>
                  <input type="number" value={radarMinSalary} onChange={e => { setRadarMinSalary(e.target.value); setRadarPage(1); }}
                    placeholder="e.g. 150000"
                    className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={inputStyle} />
                </div>
                <div>
                  <span className="text-xs font-medium mb-1 block" style={{ color: "var(--text-muted)" }}>Max Salary ($k)</span>
                  <input type="number" value={radarMaxSalary} onChange={e => { setRadarMaxSalary(e.target.value); setRadarPage(1); }}
                    placeholder="e.g. 400000"
                    className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={inputStyle} />
                </div>
              </div>

              {/* Row 4: Toggle filters + Min fit score + Reset */}
              <div className="flex items-end gap-4 flex-wrap">
                <div>
                  <span className="text-xs font-medium mb-1 block" style={{ color: "var(--text-muted)" }}>Compensation</span>
                  <select value={radarHasSalary} onChange={e => { setRadarHasSalary(e.target.value); setRadarPage(1); }}
                    className="rounded-lg px-3 py-2 text-sm focus:outline-none" style={inputStyle}>
                    <option value="">All</option>
                    <option value="yes">Has Salary</option>
                    <option value="no">Unknown Salary</option>
                  </select>
                </div>
                <div>
                  <span className="text-xs font-medium mb-1 block" style={{ color: "var(--text-muted)" }}>Min Fit Score</span>
                  <input type="number" value={radarMinFit} onChange={e => { setRadarMinFit(e.target.value); setRadarPage(1); }}
                    placeholder="0-100" min={0} max={100}
                    className="rounded-lg px-3 py-2 text-sm focus:outline-none w-[100px]" style={inputStyle} />
                </div>
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm"
                  style={{ backgroundColor: radarExcludeBanks ? "rgba(248,113,113,0.12)" : "transparent", color: radarExcludeBanks ? "#f87171" : "var(--text-muted)" }}>
                  <input type="checkbox" checked={radarExcludeBanks}
                    onChange={e => { setRadarExcludeBanks(e.target.checked); setRadarPage(1); }}
                    className="accent-[#f87171]" />
                  Exclude Banks
                </label>
                <div className="flex-1" />
                <button onClick={() => {
                  setRadarFreshness(""); setRadarCompany(""); setRadarSearch("");
                  setRadarLocationGroups(["bay_area", "remote", "uk", "australia", "uae"]);
                  setRadarFitLabel(""); setRadarMinFit(""); setRadarCompanyTier("");
                  setRadarSource(""); setRadarHasSalary(""); setRadarSeniority("");
                  setRadarExcludeBanks(false); setRadarMinSalary(""); setRadarMaxSalary("");
                  setRadarPage(1);
                }}
                  className="text-xs px-4 py-2 rounded-lg border transition-colors"
                  style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                  Reset All Filters
                </button>
              </div>
            </div>
          )}

          {/* Saved Jobs */}
          {savedJobs.length > 0 && (
            <div className="mb-4">
              <button onClick={() => setShowSavedJobs(!showSavedJobs)}
                className="flex items-center gap-2 mb-2 text-sm font-medium w-full"
                style={{ color: "var(--accent-amber)" }}>
                <Star size={14} />
                Saved Jobs ({savedJobs.length})
                <ChevronDown size={14} style={{ transform: showSavedJobs ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
              </button>
              {showSavedJobs && (
                <div className="flex flex-col gap-2">
                  {savedJobs.map(job => {
                    const FIcon = FRESHNESS_ICONS[job.freshness] || Clock;
                    return (
                      <div key={job.id} className="rounded-lg p-3 transition-all hover:shadow-sm"
                        style={{ ...cardStyle, borderLeft: "3px solid var(--accent-amber)" }}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{job.title}</h3>
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap flex items-center gap-1"
                                style={{ backgroundColor: FRESHNESS_BG[job.freshness], color: FRESHNESS_COLORS[job.freshness] }}>
                                <FIcon size={10} /> {job.freshness_label || job.freshness}
                              </span>
                              {job.fit_score != null && (
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
                                  style={{ backgroundColor: FIT_BG[job.fit_label || "Low Fit"], color: FIT_COLORS[job.fit_label || "Low Fit"] }}>
                                  {job.fit_label}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
                              <span className="flex items-center gap-1"><Building2 size={12} /> {job.company}</span>
                              {job.location && <span className="flex items-center gap-1"><MapPin size={12} /> {job.location}</span>}
                              <span className="flex items-center gap-1"><Clock size={12} /> {timeAgo(job.posted_at)}</span>
                              {job.salary?.min ? (
                                <span className="font-medium" style={{ color: job.salary.max >= 250000 ? "var(--accent-green, #22c55e)" : "var(--text-muted)" }}>
                                  ${(job.salary.min / 1000).toFixed(0)}k–${(job.salary.max / 1000).toFixed(0)}k
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={() => setPipelineJob(job)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all"
                              style={{ backgroundColor: "rgba(34,197,94,0.08)", color: "var(--accent-green, #22c55e)", border: "1px solid rgba(34,197,94,0.2)" }}
                              title="Apply — create application & customize resume">
                              <Send size={12} /> Apply
                            </button>
                            <button onClick={() => updateRadarStatus(job.id, "new")}
                              className="p-1.5 rounded-md transition-colors" style={{ color: "var(--accent-amber)" }} title="Unsave — move back to feed">
                              <Star size={14} fill="currentColor" /></button>
                            <button onClick={() => updateRadarStatus(job.id, "dismissed")}
                              className="p-1.5 rounded-md transition-colors" style={{ color: "var(--text-muted)" }} title="Dismiss"><EyeOff size={14} /></button>
                            <a href={job.url} target="_blank" rel="noopener noreferrer"
                              className="p-1.5 rounded-md transition-colors" style={{ color: "var(--text-muted)" }} title="View on career page">
                              <ExternalLink size={14} /></a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Job list */}
          {filteredRadarJobs.length === 0 ? (
            <div className="text-center py-16" style={{ color: "var(--text-muted)" }}>
              <Radar size={40} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
              <p className="text-sm">No jobs found. Hit Scan Now to discover fresh postings.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredRadarJobs.map(job => {
                const FIcon = FRESHNESS_ICONS[job.freshness] || Clock;
                return (
                  <div key={job.id} className="rounded-lg p-4 transition-all hover:shadow-sm"
                    style={{ ...cardStyle, borderLeft: `3px solid ${FRESHNESS_COLORS[job.freshness] || "#6b7280"}` }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{job.title}</h3>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap flex items-center gap-1"
                            style={{ backgroundColor: FRESHNESS_BG[job.freshness], color: FRESHNESS_COLORS[job.freshness] }}>
                            <FIcon size={10} /> {job.freshness_label || job.freshness}
                          </span>
                          {job.fit_score != null && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
                              style={{ backgroundColor: FIT_BG[job.fit_label || "Low Fit"], color: FIT_COLORS[job.fit_label || "Low Fit"] }}
                              title={job.fit_breakdown ? `Rank ${job.rank_score ?? "?"}/200 · Fit ${job.fit_score}/100 · Seniority ${job.fit_breakdown.seniority}/30 · Domain ${job.fit_breakdown.domain}/25 · Company ${job.fit_breakdown.company_tier_score}/15 · Location ${job.fit_breakdown.location}/10 · Comp ${job.fit_breakdown.compensation}/20${job.fit_breakdown.bank_penalty ? ` · Bank -${job.fit_breakdown.bank_penalty}` : ""}` : ""}>
                              {job.fit_label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
                          <span className="flex items-center gap-1"><Building2 size={12} /> {job.company}</span>
                          {job.location && <span className="flex items-center gap-1"><MapPin size={12} /> {job.location}</span>}
                          <span className="flex items-center gap-1"><Clock size={12} /> {timeAgo(job.posted_at)}</span>
                          {job.salary?.min ? (
                            <span className="font-medium" style={{ color: job.salary.max >= 250000 ? "var(--accent-green, #22c55e)" : "var(--text-muted)" }}>
                              ${(job.salary.min / 1000).toFixed(0)}k–${(job.salary.max / 1000).toFixed(0)}k
                            </span>
                          ) : (
                            !["uk", "australia", "uae"].includes(job.location_group) && (
                              <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Comp unknown</span>
                            )
                          )}
                        </div>
                        {job.fit_breakdown?.domain_matches && job.fit_breakdown.domain_matches.length > 0 && (
                          <div className="flex items-center gap-1 mt-1.5">
                            {job.fit_breakdown.domain_matches.map((d: string) => (
                              <span key={d} className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-muted)" }}>{d}</span>
                            ))}
                            {job.fit_breakdown.company_tier === "bank" ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{
                                backgroundColor: "rgba(239,68,68,0.10)", color: "#ef4444",
                              }}>Bank</span>
                            ) : job.fit_breakdown.company_tier && job.fit_breakdown.company_tier !== "practice" && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{
                                backgroundColor: job.fit_breakdown.company_tier === "dream" ? "rgba(245,158,11,0.12)" : "rgba(59,130,246,0.12)",
                                color: job.fit_breakdown.company_tier === "dream" ? "#f59e0b" : "#3b82f6",
                              }}>{job.fit_breakdown.company_tier === "dream" ? "Dream" : "High Prob"}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => setPipelineJob(job)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all"
                          style={{ backgroundColor: "rgba(34,197,94,0.08)", color: "var(--accent-green, #22c55e)", border: "1px solid rgba(34,197,94,0.2)" }}
                          title="Apply — create application & customize resume">
                          <Send size={12} /> Apply
                        </button>
                        <button onClick={() => updateRadarStatus(job.id, "saved")}
                          className="p-1.5 rounded-md transition-colors" style={{ color: "var(--text-muted)" }} title="Save"><Star size={14} /></button>
                        <button onClick={() => updateRadarStatus(job.id, "dismissed")}
                          className="p-1.5 rounded-md transition-colors" style={{ color: "var(--text-muted)" }} title="Dismiss"><EyeOff size={14} /></button>
                        <a href={job.url} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-md transition-colors" style={{ color: "var(--text-muted)" }} title="View on career page">
                          <ExternalLink size={14} /></a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {radarTotal > 0
                ? `Showing ${((radarPage - 1) * RADAR_PAGE_SIZE) + 1}–${Math.min(radarPage * RADAR_PAGE_SIZE, radarTotal)} of ${radarTotal} jobs`
                : "No jobs"} · {radarStats?.companies_monitored || 50}+ companies
            </span>
            {radarTotalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRadarPage(p => Math.max(1, p - 1))}
                  disabled={radarPage <= 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    backgroundColor: radarPage <= 1 ? "var(--bg-secondary)" : "var(--bg-card)",
                    color: radarPage <= 1 ? "var(--text-muted)" : "var(--text-primary)",
                    border: "1px solid var(--border)",
                    opacity: radarPage <= 1 ? 0.5 : 1,
                    cursor: radarPage <= 1 ? "not-allowed" : "pointer",
                  }}>
                  ← Prev
                </button>
                <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  {radarPage} / {radarTotalPages}
                </span>
                <button
                  onClick={() => setRadarPage(p => Math.min(radarTotalPages, p + 1))}
                  disabled={radarPage >= radarTotalPages}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    backgroundColor: radarPage >= radarTotalPages ? "var(--bg-secondary)" : "var(--bg-card)",
                    color: radarPage >= radarTotalPages ? "var(--text-muted)" : "var(--text-primary)",
                    border: "1px solid var(--border)",
                    opacity: radarPage >= radarTotalPages ? 0.5 : 1,
                    cursor: radarPage >= radarTotalPages ? "not-allowed" : "pointer",
                  }}>
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pipeline Modal — Radar → Job Central + Resume Customizer */}
      {pipelineJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={e => e.target === e.currentTarget && setPipelineJob(null)}>
          <div className="w-full max-w-md rounded-xl p-6" style={cardStyle}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Apply to This Role</h3>
              <button onClick={() => setPipelineJob(null)} style={{ color: "var(--text-muted)" }}><X size={18} /></button>
            </div>
            <div className="rounded-lg p-3 mb-4" style={{ backgroundColor: "var(--bg-secondary)" }}>
              <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{pipelineJob.title}</div>
              <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                {pipelineJob.company} · {pipelineJob.location}
              </div>
            </div>
            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
              This will create an application in your tracker and prepare resume customization.
            </p>
            <div className="flex flex-col gap-3 mb-5">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-muted)" }}>Application Tier</label>
                <div className="flex gap-2">
                  {[{ v: "dream", l: "Dream" }, { v: "high-prob", l: "High Prob" }, { v: "practice", l: "Practice" }].map(t => (
                    <button key={t.v} onClick={() => setPipelineTier(t.v)}
                      className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                      style={{
                        backgroundColor: pipelineTier === t.v ? (TIER_COLORS[t.v] || "var(--accent-blue)") : "var(--bg-secondary)",
                        color: pipelineTier === t.v ? "#fff" : "var(--text-secondary)",
                        border: pipelineTier === t.v ? `1px solid ${TIER_COLORS[t.v]}` : "1px solid var(--border)",
                      }}>{t.l}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-muted)" }}>Resume Persona</label>
                <div className="flex gap-2">
                  {[{ v: "pm", l: "Product Manager" }, { v: "pjm", l: "Program Manager" }, { v: "pmm", l: "Product Marketing" }].map(p => (
                    <button key={p.v} onClick={() => setPipelinePersona(p.v)}
                      className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                      style={{
                        backgroundColor: pipelinePersona === p.v ? "var(--accent-green, #22c55e)" : "var(--bg-secondary)",
                        color: pipelinePersona === p.v ? "#fff" : "var(--text-secondary)",
                        border: pipelinePersona === p.v ? "1px solid var(--accent-green)" : "1px solid var(--border)",
                      }}>{p.l}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-muted)" }}>Resume Length</label>
                <div className="flex gap-2">
                  {[{ v: "1pager", l: "1-Pager" }, { v: "2pager", l: "2-Pager" }, { v: "detailed", l: "Detailed" }].map(l => (
                    <button key={l.v} onClick={() => setPipelineLength(l.v)}
                      className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                      style={{
                        backgroundColor: pipelineLength === l.v ? "var(--accent-green, #22c55e)" : "var(--bg-secondary)",
                        color: pipelineLength === l.v ? "#fff" : "var(--text-secondary)",
                        border: pipelineLength === l.v ? "1px solid var(--accent-green)" : "1px solid var(--border)",
                      }}>{l.l}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPipelineJob(null)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium"
                style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                Cancel
              </button>
              <button onClick={pushToPipeline}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium"
                style={{ backgroundColor: "var(--accent-green, #22c55e)", color: "#fff" }}>
                <ArrowRight size={14} /> Create App & Customize
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ DASHBOARD TAB ═══════════════════════════ */}
      {tab === "dashboard" && (
        <div className="space-y-5">
          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Applications", value: sprint?.targets.applications.current || 0, color: "var(--accent-red)" },
              { label: "Interviews", value: sprint?.targets.interviews.current || 0, color: "var(--accent-amber)" },
              { label: "Stories Ready", value: stories.length, color: "var(--accent-blue)" },
              { label: "Current Week", value: currentWeekPlan?.week_number || 1, color: "var(--accent-green)" },
            ].map((s, i) => (
              <div key={i} className="rounded-lg p-4" style={cardStyle}>
                <span className="text-xs text-[var(--text-muted)]">{s.label}</span>
                <div className="text-2xl font-semibold mt-1" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Today's Checklist */}
          {checklist && (
            <div className="rounded-lg p-5" style={cardStyle}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-[var(--accent-blue)]" />
                  <h3 className="text-sm font-medium text-[var(--text-primary)]">Today&apos;s Checklist - {dayName()}</h3>
                </div>
                <span className="text-xs text-[var(--text-muted)]">
                  {checklist.items.filter((i) => i.done).length}/{checklist.items.length} complete
                </span>
              </div>

              <div className="h-1.5 rounded-full mb-4 overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                <div className="h-full rounded-full transition-all" style={{
                  width: `${checklist.items.length > 0 ? (checklist.items.filter((i) => i.done).length / checklist.items.length) * 100 : 0}%`,
                  backgroundColor: "var(--accent-green)",
                }} />
              </div>

              <div className="space-y-1.5">
                {checklist.items.map((item) => (
                  <button key={item.id} onClick={() => handleToggleChecklist(item.id, !item.done)}
                    className="w-full flex items-center gap-2.5 py-2 px-3 rounded-lg text-left transition-colors"
                    style={{ backgroundColor: "var(--bg-secondary)", opacity: item.done ? 0.6 : 1 }}>
                    {item.done ? (
                      <CheckCircle2 size={16} className="text-[var(--accent-green)] shrink-0" />
                    ) : (
                      <Circle size={16} className="text-[var(--text-muted)] shrink-0" />
                    )}
                    <span className="text-sm" style={{
                      color: "var(--text-secondary)",
                      textDecoration: item.done ? "line-through" : "none",
                    }}>{item.task}</span>
                  </button>
                ))}
              </div>

              {/* Add Custom Task */}
              <div className="flex gap-2 mt-3">
                <input value={newTask} onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddCustomTask(); }}
                  placeholder="+ Add Custom Task"
                  className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
                  style={inputStyle} />
                {newTask.trim() && (
                  <button onClick={handleAddCustomTask}
                    className="px-3 py-2 rounded-lg text-sm font-medium"
                    style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}>
                    Add
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Daily Progress Log */}
          <div className="rounded-lg p-5" style={cardStyle}>
            <div className="flex items-center gap-2 mb-3">
              <Edit3 size={16} className="text-[var(--accent-amber)]" />
              <h3 className="text-sm font-medium text-[var(--text-primary)]">Log Today&apos;s Progress</h3>
            </div>
            <textarea
              value={dailyLog}
              onChange={(e) => { setDailyLog(e.target.value); setLogSaved(false); }}
              placeholder="What did you accomplish today? Any wins, learnings, or reflections..."
              rows={4}
              className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-amber)] resize-y mb-3"
              style={inputStyle}
            />
            <button onClick={handleSaveLog}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: logSaved ? "var(--accent-green)" : "var(--accent-amber)", color: "#000" }}>
              <Save size={14} /> {logSaved ? "Saved!" : "Save Today's Log"}
            </button>
          </div>

          {/* 12-Week Plan Preview */}
          <div className="rounded-lg p-5" style={cardStyle}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ClipboardList size={16} className="text-[var(--accent-green)]" />
                  <h3 className="text-sm font-medium text-[var(--text-primary)]">12-Week Plan</h3>
                </div>
                <p className="text-xs text-[var(--text-muted)]">Your roadmap to landing a Senior PM role at a world-class company</p>
              </div>
              <button onClick={() => setTab("weekly")}
                className="text-xs text-[var(--accent-blue)] hover:underline">View All</button>
            </div>

            {weekPlans.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] py-3">Loading your 12-week plan...</p>
            ) : (
              <div className="space-y-2">
                {weekPlans.slice(0, 3).map((plan) => {
                  const done = plan.tasks.filter((t) => t.completed).length;
                  const total = plan.tasks.length;
                  return (
                    <div key={plan.id} className="rounded-lg p-3"
                      style={{ backgroundColor: "var(--bg-secondary)", borderLeft: "3px solid var(--accent-green)" }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                          Week {plan.week_number}: {plan.title}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">{done}/{total}</span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                        <div className="h-full rounded-full" style={{
                          width: `${total > 0 ? (done / total) * 100 : 0}%`,
                          backgroundColor: "var(--accent-green)",
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sprint Targets */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total Applications", current: sprint?.targets.applications.current || 0, target: 165, pct: sprint?.targets.applications.pct || 0, color: "var(--accent-red)" },
              { label: "Total Interviews", current: sprint?.targets.interviews.current || 0, target: 20, pct: sprint?.targets.interviews.pct || 0, color: "var(--accent-amber)" },
              { label: "This Week", current: sprint?.targets.weekly_apps.current_week || 0, target: 15, pct: Math.round(((sprint?.targets.weekly_apps.current_week || 0) / 15) * 100), color: "var(--accent-blue)" },
            ].map((m, i) => (
              <div key={i} className="rounded-lg p-4" style={cardStyle}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[var(--text-muted)]">{m.label}</span>
                  <span className="text-xs text-[var(--text-muted)]">{m.pct}%</span>
                </div>
                <div className="text-2xl font-semibold text-[var(--text-primary)] mb-2">
                  {m.current} <span className="text-sm font-normal text-[var(--text-muted)]">/ {m.target}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(m.pct, 100)}%`, backgroundColor: m.color }} />
                </div>
              </div>
            ))}
          </div>

          {/* Pipeline + Tiers */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg p-5" style={cardStyle}>
              <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">Pipeline</h3>
              <div className="space-y-2">
                {["applied", "screening", "interview", "offer"].map((s) => (
                  <div key={s} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
                      <span className="text-sm text-[var(--text-secondary)] capitalize">{s}</span>
                    </div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">{sprint?.by_status?.[s] || 0}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg p-5" style={cardStyle}>
              <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">By Tier</h3>
              <div className="space-y-2">
                {["dream", "high-prob", "practice"].map((t) => (
                  <div key={t} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: TIER_COLORS[t] }} />
                      <span className="text-sm text-[var(--text-secondary)] capitalize">{t}</span>
                    </div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">{sprint?.by_tier?.[t] || 0}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ APPLICATIONS TAB ═════════════════════════ */}
      {tab === "applications" && (
        <div>
          <div className="flex gap-3 mb-4">
            <div className="relative">
              <select value={filterTier} onChange={(e) => setFilterTier(e.target.value)}
                className="appearance-none rounded-lg px-3 py-2 text-sm pr-8 focus:outline-none"
                style={{ ...cardStyle, color: "var(--text-primary)" }}>
                <option value="">All Tiers</option>
                <option value="dream">Dream</option>
                <option value="high-prob">High-Prob</option>
                <option value="practice">Practice</option>
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            </div>
            <div className="relative">
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                className="appearance-none rounded-lg px-3 py-2 text-sm pr-8 focus:outline-none"
                style={{ ...cardStyle, color: "var(--text-primary)" }}>
                <option value="">All Status</option>
                <option value="applied">Applied</option>
                <option value="screening">Screening</option>
                <option value="interview">Interview</option>
                <option value="offer">Offer</option>
                <option value="rejected">Rejected</option>
                <option value="ghosted">Ghosted</option>
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            </div>
            <span className="text-xs text-[var(--text-muted)] self-center ml-auto">{apps.length} applications</span>
          </div>

          {apps.length === 0 ? (
            <div className="rounded-lg p-8 text-center" style={cardStyle}>
              <Briefcase size={28} className="mx-auto mb-2 text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-secondary)]">No applications yet. Click &ldquo;Add Application&rdquo; to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {apps.map((app) => (
                <div key={app.id} className="flex items-center gap-3 px-4 py-3 rounded-lg" style={cardStyle}>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: TIER_COLORS[app.tier] }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">{app.company} — {app.role}</p>
                    <p className="text-xs text-[var(--text-muted)]">{app.applied_date} &middot; {app.tier}</p>
                  </div>
                  <div className="relative">
                    <select value={app.status} onChange={(e) => handleStatusChange(app.id, e.target.value)}
                      className="appearance-none rounded-md px-2.5 py-1 text-xs pr-6 focus:outline-none capitalize"
                      style={{ backgroundColor: "transparent", border: "1px solid var(--border)", color: STATUS_COLORS[app.status] || "var(--text-secondary)" }}>
                      {["applied", "screening", "interview", "offer", "rejected", "withdrawn", "ghosted"].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                  </div>
                  {app.url && (
                    <a href={app.url} target="_blank" rel="noopener noreferrer" className="text-[var(--text-muted)] hover:text-[var(--accent-blue)]">
                      <ExternalLink size={14} />
                    </a>
                  )}
                  <button onClick={() => handleDeleteApp(app.id)} className="text-[var(--text-muted)] hover:text-[var(--accent-red)]">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ STORY BANK TAB ══════════════════════════ */}
      {tab === "stories" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">Story Bank ({stories.length} stories)</h3>
            <button onClick={() => { setEditStory(null); setShowStoryForm(true); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}>
              <Plus size={14} /> Add Story
            </button>
          </div>

          <div className="relative mb-4">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input value={storySearch} onChange={(e) => setStorySearch(e.target.value)}
              placeholder="Search stories by title, content, or framework..."
              className="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
              style={inputStyle} />
          </div>

          {stories.length === 0 ? (
            <div className="rounded-lg p-8 text-center" style={cardStyle}>
              <BookOpen size={28} className="mx-auto mb-2 text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-secondary)]">No stories yet. Start adding your experiences!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stories.map((story) => (
                <div key={story.id} className="rounded-lg p-4" style={cardStyle}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{story.title}</p>
                      <p className="text-xs text-[var(--text-muted)]">{story.company}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => { setEditStory(story); setShowStoryForm(true); }}
                        className="text-[var(--text-muted)] hover:text-[var(--accent-blue)] p-1"><Edit3 size={14} /></button>
                      <button onClick={() => handleDeleteStory(story.id)}
                        className="text-[var(--text-muted)] hover:text-[var(--accent-red)] p-1"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] mb-2 line-clamp-3">{story.content}</p>
                  {story.frameworks && story.frameworks.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {story.frameworks.map((fw, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded"
                          style={{ backgroundColor: "rgba(59,130,246,0.15)", color: "var(--accent-blue)" }}>{fw}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ INTERVIEW PREP TAB ══════════════════════ */}
      {tab === "prep" && (
        <div className="space-y-5">
          <div className="rounded-lg p-5" style={cardStyle}>
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">Framework Quick Reference</h3>
            <div className="space-y-3">
              {FRAMEWORKS.map((fw, idx) => (
                <div key={idx} className="rounded-lg p-3" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{fw.name}</p>
                  <p className="text-xs text-[var(--text-muted)] mb-2">{fw.description}</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {fw.steps.map((step, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded"
                        style={{ backgroundColor: "rgba(59,130,246,0.15)", color: "var(--accent-blue)" }}>{step}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg p-5" style={cardStyle}>
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">Common PM Interview Questions</h3>
            <div className="space-y-2">
              {COMMON_QUESTIONS.map((q, idx) => (
                <div key={idx} className="flex items-center gap-3 rounded-lg p-3"
                  style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                  <span className="text-xs px-2 py-0.5 rounded shrink-0"
                    style={{ backgroundColor: "rgba(234,179,8,0.15)", color: "var(--accent-amber)" }}>{q.category}</span>
                  <p className="text-sm text-[var(--text-secondary)] flex-1">{q.question}</p>
                  <span className="text-xs px-2 py-0.5 rounded shrink-0"
                    style={{ backgroundColor: "rgba(59,130,246,0.15)", color: "var(--accent-blue)" }}>{q.framework}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg p-5" style={cardStyle}>
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">Pre-Interview Checklist</h3>
            <div className="space-y-2">
              {PRE_INTERVIEW_CHECKLIST.map((item, idx) => (
                <PreInterviewItem key={idx} label={item} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ NETWORK TAB ═════════════════════════════ */}
      {tab === "network" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">Network Tracker ({contacts.length} contacts)</h3>
            <button onClick={() => { setEditContact(null); setShowContactForm(true); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: "var(--accent-amber)", color: "#000" }}>
              <Plus size={14} /> Add Contact
            </button>
          </div>

          {contacts.length === 0 ? (
            <div className="rounded-lg p-8 text-center" style={cardStyle}>
              <Users size={28} className="mx-auto mb-2 text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-secondary)]">No contacts yet. Start building your network!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {contacts.map((contact) => (
                <div key={contact.id} className="flex items-center gap-3 px-4 py-3 rounded-lg" style={cardStyle}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
                    style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)" }}>
                    {contact.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">{contact.name}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">
                      {contact.role ? `${contact.role} at ` : ""}{contact.company}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded shrink-0"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${CONTACT_STATUS_COLORS[contact.status] || "var(--text-muted)"} 15%, transparent)`,
                      color: CONTACT_STATUS_COLORS[contact.status] || "var(--text-muted)",
                    }}>
                    {CONTACT_STATUS_LABELS[contact.status] || contact.status}
                  </span>
                  <button onClick={() => { setEditContact(contact); setShowContactForm(true); }}
                    className="text-[var(--text-muted)] hover:text-[var(--accent-blue)]"><Edit3 size={14} /></button>
                  <button onClick={() => handleDeleteContact(contact.id)}
                    className="text-[var(--text-muted)] hover:text-[var(--accent-red)]"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ WEEKLY PLAN TAB ═════════════════════════ */}
      {tab === "weekly" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-[var(--text-primary)]">12-Week Plan ({weekPlans.length} weeks)</h3>
              <p className="text-xs text-[var(--text-muted)]">Your roadmap to landing a Senior PM role at a world-class company</p>
            </div>
            <button onClick={() => setShowWeekForm(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: "var(--accent-green)", color: "#000" }}>
              <Plus size={14} /> Add Week
            </button>
          </div>

          {weekPlans.length === 0 ? (
            <div className="rounded-lg p-8 text-center" style={cardStyle}>
              <ClipboardList size={28} className="mx-auto mb-2 text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-secondary)]">No weekly plans yet. Start planning your 12-week sprint!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {weekPlans.map((plan) => {
                const completed = plan.tasks.filter((t) => t.completed).length;
                const total = plan.tasks.length;
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                return (
                  <div key={plan.id} className="rounded-lg p-4" style={{ ...cardStyle, borderLeft: "3px solid var(--accent-green)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        Week {plan.week_number}: {plan.title}
                      </p>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[var(--text-muted)]">{completed}/{total} completed</span>
                        <button onClick={() => handleDeletePlan(plan.id)}
                          className="text-[var(--text-muted)] hover:text-[var(--accent-red)]"><Trash2 size={14} /></button>
                      </div>
                    </div>

                    <div className="h-1 rounded-full mb-3 overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: "var(--accent-green)" }} />
                    </div>

                    <div className="space-y-1">
                      {plan.tasks.map((task) => (
                        <button key={task.id} onClick={() => handleToggleTask(plan.id, task.id, !task.completed)}
                          className="w-full flex items-center gap-2.5 py-1.5 text-left">
                          {task.completed ? (
                            <CheckCircle2 size={16} className="text-[var(--accent-green)] shrink-0" />
                          ) : (
                            <Circle size={16} className="text-[var(--text-muted)] shrink-0" />
                          )}
                          <span className="text-sm" style={{
                            color: task.completed ? "var(--text-muted)" : "var(--text-secondary)",
                            textDecoration: task.completed ? "line-through" : "none",
                          }}>{task.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════════════════════════

function PreInterviewItem({ label }: { label: string }) {
  const [checked, setChecked] = useState(false);
  return (
    <button onClick={() => setChecked(!checked)}
      className="w-full flex items-center gap-2.5 py-2 px-3 rounded-lg text-left"
      style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", opacity: checked ? 0.6 : 1 }}>
      {checked ? (
        <CheckCircle2 size={16} className="text-[var(--accent-green)] shrink-0" />
      ) : (
        <Circle size={16} className="text-[var(--text-muted)] shrink-0" />
      )}
      <span className="text-sm" style={{ color: "var(--text-secondary)", textDecoration: checked ? "line-through" : "none" }}>{label}</span>
    </button>
  );
}

// ── Story Modal ──────────────────────────────────────────────────

function StoryModal({
  story, onSave, onClose,
}: {
  story: Story | null;
  onSave: (data: { title: string; company: string; content: string; frameworks: string[] }) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(story?.title || "");
  const [company, setCompany] = useState(story?.company || "");
  const [content, setContent] = useState(story?.content || "");
  const [frameworks, setFrameworks] = useState<string[]>(story?.frameworks || []);
  const [fwInput, setFwInput] = useState("");

  const addFw = () => {
    const val = fwInput.trim().toUpperCase();
    if (val && !frameworks.includes(val)) { setFrameworks([...frameworks, val]); setFwInput(""); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="w-full max-w-lg rounded-xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">{story ? "Edit Story" : "Add Story"}</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Story title"
            className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
            style={inputStyle} />
          <div className="relative">
            <select value={company} onChange={(e) => setCompany(e.target.value)}
              className="w-full appearance-none rounded-lg px-3 py-2.5 text-sm pr-8 focus:outline-none"
              style={inputStyle}>
              <option value="">Select Company</option>
              <option value="Wells Fargo (2023-2025) - VP Product">Wells Fargo (2023-2025) - VP Product</option>
              <option value="Avatour (2025-Present) - Consulting">Avatour (2025-Present) - Consulting</option>
              <option value="First Republic (2016-2023) - Director">First Republic (2016-2023) - Director</option>
              <option value="Wells Fargo (2012-2016) - AVP">Wells Fargo (2012-2016) - AVP</option>
              <option value="Magley & Associates (2008-2012) - Consultant">Magley &amp; Associates (2008-2012) - Consultant</option>
              <option value="Other">Other</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          </div>
          <textarea value={content} onChange={(e) => setContent(e.target.value)}
            placeholder="Describe the situation, your decision, and the outcome..."
            rows={5} className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] resize-y"
            style={inputStyle} />
          <div>
            <div className="flex gap-2 mb-2">
              <input value={fwInput} onChange={(e) => setFwInput(e.target.value)} placeholder="Framework (e.g., STAR, CIRCLES)"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFw(); } }}
                className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]"
                style={inputStyle} />
              <button type="button" onClick={addFw} className="px-3 py-2 rounded-lg text-sm"
                style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>Add</button>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {frameworks.map((fw, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded cursor-pointer"
                  onClick={() => setFrameworks(frameworks.filter((_, j) => j !== i))}
                  style={{ backgroundColor: "rgba(59,130,246,0.15)", color: "var(--accent-blue)" }}>{fw} &times;</span>
              ))}
            </div>
          </div>
          <button onClick={() => { if (title.trim() && content.trim()) onSave({ title, company, content, frameworks }); }}
            disabled={!title.trim() || !content.trim()}
            className="w-full py-2.5 rounded-lg text-sm font-medium"
            style={{ backgroundColor: "var(--accent-blue)", color: "#fff", opacity: title.trim() && content.trim() ? 1 : 0.5 }}>
            {story ? "Update Story" : "Add Story"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Contact Modal ────────────────────────────────────────────────

function ContactModal({
  contact, onSave, onClose,
}: {
  contact: Contact | null;
  onSave: (data: { name: string; company: string; role?: string; status: string; notes?: string }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(contact?.name || "");
  const [company, setCompany] = useState(contact?.company || "");
  const [role, setRole] = useState(contact?.role || "");
  const [status, setStatus] = useState(contact?.status || "not_contacted");
  const [notes, setNotes] = useState(contact?.notes || "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="w-full max-w-md rounded-xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">{contact ? "Edit Contact" : "Add Contact"}</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name"
            className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]" style={inputStyle} />
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company"
            className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]" style={inputStyle} />
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role (optional)"
            className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]" style={inputStyle} />
          <div className="relative">
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="w-full appearance-none rounded-lg px-3 py-2.5 text-sm pr-8 focus:outline-none" style={inputStyle}>
              <option value="not_contacted">Not Contacted</option>
              <option value="reached_out">Reached Out</option>
              <option value="meeting_scheduled">Meeting Scheduled</option>
              <option value="referral_requested">Referral Requested</option>
              <option value="completed">Completed</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)"
            rows={3} className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] resize-y"
            style={inputStyle} />
          <button onClick={() => { if (name.trim() && company.trim()) onSave({ name, company, role: role || undefined, status, notes: notes || undefined }); }}
            disabled={!name.trim() || !company.trim()}
            className="w-full py-2.5 rounded-lg text-sm font-medium"
            style={{ backgroundColor: "var(--accent-amber)", color: "#000", opacity: name.trim() && company.trim() ? 1 : 0.5 }}>
            {contact ? "Update Contact" : "Add Contact"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Week Plan Modal ──────────────────────────────────────────────

function WeekPlanModal({
  weekNumber, onSave, onClose,
}: {
  weekNumber: number;
  onSave: (data: { week_number: number; title: string; tasks: string[] }) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [tasks, setTasks] = useState<string[]>([""]);

  const addTask = () => setTasks([...tasks, ""]);
  const updateTask = (idx: number, val: string) => { const next = [...tasks]; next[idx] = val; setTasks(next); };
  const removeTask = (idx: number) => { if (tasks.length > 1) setTasks(tasks.filter((_, i) => i !== idx)); };
  const canSave = title.trim() && tasks.some((t) => t.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="w-full max-w-lg rounded-xl p-6 max-h-[80vh] overflow-y-auto"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Add Week {weekNumber}</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Week title"
            className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]" style={inputStyle} />
          <div>
            <p className="text-xs text-[var(--text-muted)] mb-2">Tasks</p>
            <div className="space-y-2">
              {tasks.map((task, idx) => (
                <div key={idx} className="flex gap-2">
                  <input value={task} onChange={(e) => updateTask(idx, e.target.value)} placeholder="Task description"
                    className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]" style={inputStyle} />
                  {tasks.length > 1 && (
                    <button onClick={() => removeTask(idx)}
                      className="px-2 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--accent-red)]"
                      style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}><X size={14} /></button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addTask} className="mt-2 px-3 py-1.5 rounded-lg text-xs text-[var(--text-secondary)]"
              style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>+ Add Task</button>
          </div>
          <button onClick={() => { if (canSave) onSave({ week_number: weekNumber, title, tasks: tasks.filter((t) => t.trim()) }); }}
            disabled={!canSave}
            className="w-full py-2.5 rounded-lg text-sm font-medium"
            style={{ backgroundColor: "var(--accent-green)", color: "#000", opacity: canSave ? 1 : 0.5 }}>
            Add Week Plan
          </button>
        </div>
      </div>
    </div>
  );
}
