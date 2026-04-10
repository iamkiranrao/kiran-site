"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  RefreshCw,
  Server,
  Cpu,
  Database,
  Globe,
  BarChart3,
  Zap,
  ChevronDown,
  ChevronRight,
  Plus,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";
import ModuleHelp from "@/components/ModuleHelp";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ────────────────────────────────────────────────────────

interface ServiceSummary {
  service_id: string;
  service_name: string;
  category: string;
  period: string;
  total_cost: number;
  budget: number | null;
  budget_pct: number | null;
  requests_count: number;
  tokens_total: number;
  trend: "rising" | "stable" | "falling" | "new";
  is_free_tier: boolean;
}

interface MonthlySummary {
  period: string;
  total_cost: number;
  total_budget: number | null;
  budget_pct: number | null;
  by_category: Record<string, number>;
  by_service: ServiceSummary[];
  services_count: number;
  free_tier_count: number;
}

interface DashboardWidget {
  current_month: string;
  mtd_cost: number;
  projected_month_end: number;
  budget: number | null;
  budget_pct: number | null;
  top_service: string;
  top_service_cost: number;
  trend: "rising" | "stable" | "falling" | "new";
  month_over_month_pct: number | null;
  services_active: number;
  free_tier_count: number;
}

interface CostProjection {
  period: string;
  projected_cost: number;
  confidence: "high" | "medium" | "low";
  basis: string;
}

interface Service {
  id: string;
  name: string;
  provider: string;
  category: string;
  billing_cycle: string;
  monthly_budget: number | null;
  base_cost_monthly: number;
  is_free_tier: boolean;
  notes: string;
  url: string;
  active: boolean;
}

interface CostEntry {
  id: string;
  service_id: string;
  service_name: string;
  amount_usd: number;
  description: string;
  period: string;
  tokens_input: number | null;
  tokens_output: number | null;
  requests_count: number | null;
  source: string;
  created_at: string;
}

// ── Helpers ──────────────────────────────────────────────────────

const categoryIcon: Record<string, React.ReactNode> = {
  "ai-api": <Cpu size={14} />,
  hosting: <Server size={14} />,
  database: <Database size={14} />,
  domain: <Globe size={14} />,
  saas: <Zap size={14} />,
  "ci-cd": <BarChart3 size={14} />,
  analytics: <BarChart3 size={14} />,
  other: <DollarSign size={14} />,
};

const categoryLabel: Record<string, string> = {
  "ai-api": "AI & APIs",
  hosting: "Hosting",
  database: "Database",
  domain: "Domain",
  saas: "SaaS",
  "ci-cd": "CI/CD",
  analytics: "Analytics",
  other: "Other",
};

const trendIcon = (trend: string) => {
  switch (trend) {
    case "rising":
      return <TrendingUp size={14} className="text-red-400" />;
    case "falling":
      return <TrendingDown size={14} className="text-green-400" />;
    case "stable":
      return <Minus size={14} className="text-[var(--text-muted)]" />;
    default:
      return <Zap size={14} className="text-blue-400" />;
  }
};

const trendColor: Record<string, string> = {
  rising: "text-red-400",
  falling: "text-green-400",
  stable: "text-[var(--text-muted)]",
  new: "text-blue-400",
};

const formatUSD = (n: number) => {
  if (n === 0) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(2)}`;
};

const formatTokens = (n: number) => {
  if (n === 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
};

const monthLabel = (period: string) => {
  const [y, m] = period.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[parseInt(m) - 1]} ${y}`;
};

// ── Cost Ring (reusable gauge) ───────────────────────────────────

function CostRing({ spent, budget, size = 120 }: { spent: number; budget: number | null; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = budget && budget > 0 ? Math.min(spent / budget, 1.5) : 0;
  const offset = circumference - pct * circumference;
  const color =
    pct > 1 ? "stroke-red-500" : pct > 0.75 ? "stroke-amber-400" : "stroke-emerald-400";

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--border)"
        strokeWidth={6}
      />
      {budget && budget > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={color}
          strokeWidth={6}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      )}
    </svg>
  );
}

// ── Spend Bar Chart (last 6 months) ──────────────────────────────

function SpendChart({ entries, currentPeriod }: { entries: CostEntry[]; currentPeriod: string }) {
  // Build last 6 months
  const [y, m] = currentPeriod.split("-").map(Number);
  const periods: string[] = [];
  for (let i = 5; i >= 0; i--) {
    let pm = m - i;
    let py = y;
    while (pm <= 0) { pm += 12; py--; }
    periods.push(`${py}-${pm.toString().padStart(2, "0")}`);
  }

  const byPeriod: Record<string, number> = {};
  for (const e of entries) {
    byPeriod[e.period] = (byPeriod[e.period] || 0) + e.amount_usd;
  }

  const max = Math.max(...periods.map((p) => byPeriod[p] || 0), 1);

  return (
    <div className="flex items-end gap-2 h-32">
      {periods.map((p) => {
        const cost = byPeriod[p] || 0;
        const height = max > 0 ? (cost / max) * 100 : 0;
        const isCurrent = p === currentPeriod;
        return (
          <div key={p} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[10px] text-[var(--text-muted)] font-mono">
              {cost > 0 ? formatUSD(cost) : "—"}
            </span>
            <div className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-t relative" style={{ height: "100px" }}>
              <div
                className={`absolute bottom-0 w-full rounded-t transition-all duration-500 ${
                  isCurrent ? "bg-emerald-400/60" : "bg-[var(--text-muted)]/20"
                }`}
                style={{ height: `${height}%` }}
              />
            </div>
            <span
              className={`text-[10px] ${
                isCurrent ? "text-emerald-400 font-semibold" : "text-[var(--text-muted)]"
              }`}
            >
              {monthLabel(p).split(" ")[0]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Projection Chart ─────────────────────────────────────────────

function ProjectionChart({ projections, currentCost }: { projections: CostProjection[]; currentCost: number }) {
  const all = [currentCost, ...projections.map((p) => p.projected_cost)];
  const max = Math.max(...all, 1);

  return (
    <div className="flex items-end gap-3 h-28">
      {/* Current month */}
      <div className="flex-1 flex flex-col items-center gap-1">
        <span className="text-[10px] text-emerald-400 font-mono font-semibold">
          {formatUSD(currentCost)}
        </span>
        <div className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-t relative" style={{ height: "80px" }}>
          <div
            className="absolute bottom-0 w-full rounded-t bg-emerald-400/60 transition-all"
            style={{ height: `${(currentCost / max) * 100}%` }}
          />
        </div>
        <span className="text-[10px] text-emerald-400 font-semibold">Now</span>
      </div>
      {/* Projected months */}
      {projections.map((proj) => {
        const height = max > 0 ? (proj.projected_cost / max) * 100 : 0;
        const confidenceOpacity = proj.confidence === "high" ? "40" : proj.confidence === "medium" ? "25" : "15";
        return (
          <div key={proj.period} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[10px] text-[var(--text-muted)] font-mono">
              {formatUSD(proj.projected_cost)}
            </span>
            <div className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-t relative border-dashed" style={{ height: "80px" }}>
              <div
                className={`absolute bottom-0 w-full rounded-t transition-all bg-amber-400/${confidenceOpacity}`}
                style={{ height: `${height}%` }}
              />
            </div>
            <span className="text-[10px] text-[var(--text-muted)]">
              {monthLabel(proj.period).split(" ")[0]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Add Cost Entry Modal (inline) ────────────────────────────────

function AddCostForm({
  services,
  onSave,
  onCancel,
}: {
  services: Service[];
  onSave: (entry: any) => void;
  onCancel: () => void;
}) {
  const [serviceId, setServiceId] = useState(services[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));

  const handleSubmit = () => {
    if (!serviceId || !amount) return;
    onSave({
      service_id: serviceId,
      amount_usd: parseFloat(amount),
      description,
      period,
      source: "manual",
    });
  };

  return (
    <div className="border border-[var(--border)] rounded-lg p-4 bg-[var(--bg-secondary)] space-y-3">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Log a Cost</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
            Service
          </label>
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className="w-full mt-1 px-2 py-1.5 text-sm rounded border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
            Amount (USD)
          </label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full mt-1 px-2 py-1.5 text-sm rounded border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
            Period
          </label>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full mt-1 px-2 py-1.5 text-sm rounded border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Monthly invoice, API usage, etc."
            className="w-full mt-1 px-2 py-1.5 text-sm rounded border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs rounded border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-primary)] transition-all"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!serviceId || !amount}
          className="px-3 py-1.5 text-xs rounded bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90 transition-all disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────

export default function TechCostsPage() {
  const [widget, setWidget] = useState<DashboardWidget | null>(null);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [projections, setProjections] = useState<CostProjection[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [entries, setEntries] = useState<CostEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeView, setActiveView] = useState<"overview" | "services" | "history">("overview");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [widgetRes, summaryRes, projRes, servicesRes, entriesRes] = await Promise.all([
        fetch(`${API_URL}/api/tech-costs/widget`),
        fetch(`${API_URL}/api/tech-costs/summary`),
        fetch(`${API_URL}/api/tech-costs/projection`),
        fetch(`${API_URL}/api/tech-costs/services?active_only=false`),
        fetch(`${API_URL}/api/tech-costs/entries?limit=500`),
      ]);

      if (widgetRes.ok) setWidget(await widgetRes.json());
      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (projRes.ok) setProjections(await projRes.json());
      if (servicesRes.ok) setServices(await servicesRes.json());
      if (entriesRes.ok) setEntries(await entriesRes.json());
    } catch (err) {
      setError("Backend not reachable. Is the server running?");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSaveCost = async (entry: any) => {
    try {
      const res = await fetch(`${API_URL}/api/tech-costs/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      if (res.ok) {
        setShowAddForm(false);
        fetchAll();
      }
    } catch (err) {
      console.error("Failed to save cost entry:", err);
    }
  };

  const handleAggregateUsage = async () => {
    try {
      const res = await fetch(`${API_URL}/api/tech-costs/aggregate-usage`, {
        method: "POST",
      });
      if (res.ok) {
        fetchAll();
      }
    } catch (err) {
      console.error("Failed to aggregate:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
        <span className="ml-3 text-sm text-[var(--text-secondary)]">Loading cost data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)] flex items-center gap-3">
          <DollarSign size={24} />
          Tech Cost Calculator
        </h1>
        <div className="border border-red-500/20 bg-red-500/5 rounded-lg px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      </div>
    );
  }

  const currentPeriod = widget?.current_month || new Date().toISOString().slice(0, 7);

  // Group services by category for the overview
  const categoryGroups: Record<string, ServiceSummary[]> = {};
  for (const s of summary?.by_service || []) {
    if (!categoryGroups[s.category]) categoryGroups[s.category] = [];
    categoryGroups[s.category].push(s);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight flex items-center gap-3">
              <DollarSign size={24} />
              Tech Cost Calculator
            </h1>
            <ModuleHelp moduleSlug="tech-costs" />
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Full stack cost tracking — APIs, hosting, databases, and projections.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAggregateUsage}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-all flex items-center gap-1.5"
            title="Roll up tracked API usage into cost entries"
          >
            <RefreshCw size={12} />
            Sync API Usage
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-2 text-xs font-medium rounded-lg bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90 transition-all flex items-center gap-1.5"
          >
            <Plus size={12} />
            Log Cost
          </button>
        </div>
      </div>

      {/* Add cost form */}
      {showAddForm && (
        <AddCostForm
          services={services}
          onSave={handleSaveCost}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* ── Top Stats Row ──────────────────────────────────────── */}
      {widget && (
        <div className="grid grid-cols-4 gap-4">
          {/* MTD Spend */}
          <div className="border border-[var(--border)] rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                MTD Spend
              </span>
              {trendIcon(widget.trend)}
            </div>
            <div className="text-2xl font-semibold text-[var(--text-primary)]">
              {formatUSD(widget.mtd_cost)}
            </div>
            {widget.month_over_month_pct !== null && (
              <p className={`text-xs mt-1 ${trendColor[widget.trend]}`}>
                {widget.month_over_month_pct > 0 ? "+" : ""}
                {widget.month_over_month_pct}% vs last month
              </p>
            )}
          </div>

          {/* Projected */}
          <div className="border border-[var(--border)] rounded-lg p-4">
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Projected {monthLabel(currentPeriod)}
            </div>
            <div className="text-2xl font-semibold text-[var(--text-primary)]">
              {formatUSD(widget.projected_month_end)}
            </div>
            {widget.budget && (
              <p className={`text-xs mt-1 ${
                widget.budget_pct && widget.budget_pct > 100 ? "text-red-400" : "text-[var(--text-muted)]"
              }`}>
                {widget.budget_pct?.toFixed(0)}% of ${widget.budget.toFixed(0)} budget
              </p>
            )}
          </div>

          {/* Top Service */}
          <div className="border border-[var(--border)] rounded-lg p-4">
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Biggest Cost
            </div>
            <div className="text-lg font-semibold text-[var(--text-primary)] truncate">
              {widget.top_service}
            </div>
            <p className="text-xs text-amber-400 mt-1">
              {formatUSD(widget.top_service_cost)}
            </p>
          </div>

          {/* Stack Health */}
          <div className="border border-[var(--border)] rounded-lg p-4">
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2">
              Stack
            </div>
            <div className="text-2xl font-semibold text-[var(--text-primary)]">
              {widget.services_active}
              <span className="text-sm font-normal text-[var(--text-muted)] ml-1">services</span>
            </div>
            <p className="text-xs text-green-400 mt-1">
              {widget.free_tier_count} on free tier
            </p>
          </div>
        </div>
      )}

      {/* ── View Toggle ────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] pb-1">
        {(["overview", "services", "history"] as const).map((view) => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={`px-4 py-2 text-xs font-medium rounded-t transition-all ${
              activeView === view
                ? "border border-b-0 border-[var(--border)] text-[var(--text-primary)] bg-[var(--bg-secondary)] -mb-px"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {view === "overview" ? "Cost Overview" : view === "services" ? "Tech Stack" : "Cost History"}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ───────────────────────────────────────── */}
      {activeView === "overview" && (
        <div className="grid grid-cols-2 gap-6">
          {/* Left: Spend by Category */}
          <div className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Spend by Category — {monthLabel(currentPeriod)}
            </h2>

            {Object.entries(summary?.by_category || {})
              .sort(([, a], [, b]) => b - a)
              .map(([cat, cost]) => {
                const isExpanded = expandedCategory === cat;
                const services = categoryGroups[cat] || [];
                const total = summary?.total_cost || 1;
                const pct = total > 0 ? (cost / total) * 100 : 0;

                return (
                  <div key={cat} className="border border-[var(--border)] rounded-lg overflow-hidden">
                    <div
                      className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors"
                      onClick={() => setExpandedCategory(isExpanded ? null : cat)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[var(--text-muted)]">
                          {categoryIcon[cat] || <DollarSign size={14} />}
                        </span>
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                          {categoryLabel[cat] || cat}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-[var(--text-primary)]">
                          {formatUSD(cost)}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {pct.toFixed(0)}%
                        </span>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </div>
                    </div>

                    {/* Percentage bar */}
                    <div className="px-4 pb-2">
                      <div className="h-1.5 bg-[var(--bg-primary)] rounded-full overflow-hidden border border-[var(--border)]">
                        <div
                          className="h-full rounded-full bg-emerald-400/60 transition-all"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>

                    {isExpanded && services.length > 0 && (
                      <div className="border-t border-[var(--border)] px-4 py-3 bg-[var(--bg-secondary)] space-y-2">
                        {services.map((s) => (
                          <div
                            key={s.service_id}
                            className="flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              {trendIcon(s.trend)}
                              <span className="text-[var(--text-primary)]">{s.service_name}</span>
                              {s.is_free_tier && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400">
                                  free
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              {s.tokens_total > 0 && (
                                <span className="text-[var(--text-muted)]">
                                  {formatTokens(s.tokens_total)} tokens
                                </span>
                              )}
                              {s.requests_count > 0 && (
                                <span className="text-[var(--text-muted)]">
                                  {s.requests_count} calls
                                </span>
                              )}
                              <span className="font-semibold text-[var(--text-primary)]">
                                {formatUSD(s.total_cost)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

            {/* Free tier services (if any active that aren't in by_category) */}
            {services.filter((s) => s.is_free_tier && s.active).length > 0 && (
              <div className="border border-green-500/20 bg-green-500/5 rounded-lg p-3">
                <div className="text-[10px] text-green-400 font-semibold uppercase tracking-wider mb-2">
                  Free Tier Services
                </div>
                <div className="flex flex-wrap gap-2">
                  {services
                    .filter((s) => s.is_free_tier && s.active)
                    .map((s) => (
                      <span
                        key={s.id}
                        className="text-xs px-2 py-1 rounded border border-green-500/20 text-[var(--text-secondary)] bg-[var(--bg-primary)]"
                      >
                        {s.name}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Charts */}
          <div className="space-y-6">
            {/* Historical spend */}
            <div className="border border-[var(--border)] rounded-lg p-4">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-4">
                Monthly Spend (6 months)
              </h3>
              <SpendChart entries={entries} currentPeriod={currentPeriod} />
            </div>

            {/* Projections */}
            <div className="border border-[var(--border)] rounded-lg p-4">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                3-Month Projection
              </h3>
              {projections.length > 0 && (
                <p className="text-[10px] text-[var(--text-muted)] mb-4">
                  Based on: {projections[0].basis} &middot; Confidence:{" "}
                  <span
                    className={
                      projections[0].confidence === "high"
                        ? "text-green-400"
                        : projections[0].confidence === "medium"
                        ? "text-amber-400"
                        : "text-red-400"
                    }
                  >
                    {projections[0].confidence}
                  </span>
                </p>
              )}
              <ProjectionChart
                projections={projections}
                currentCost={widget?.mtd_cost || 0}
              />
            </div>

            {/* Budget warnings */}
            {widget?.budget_pct && widget.budget_pct > 80 && (
              <div className="border border-amber-500/20 bg-amber-500/5 rounded-lg px-4 py-3 flex items-start gap-3">
                <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-400">
                    Budget Alert: {widget.budget_pct.toFixed(0)}% used
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Projected to hit {formatUSD(widget.projected_month_end)} by month end
                    against {formatUSD(widget.budget || 0)} budget.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tech Stack Tab ─────────────────────────────────────── */}
      {activeView === "services" && (
        <div className="space-y-3">
          {services.map((s) => (
            <div
              key={s.id}
              className={`border rounded-lg p-4 transition-all ${
                s.active
                  ? "border-[var(--border)]"
                  : "border-[var(--border)] opacity-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-[var(--text-muted)]">
                    {categoryIcon[s.category] || <DollarSign size={14} />}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {s.name}
                      </span>
                      {s.is_free_tier && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400">
                          free tier
                        </span>
                      )}
                      {!s.active && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-muted)]">
                          inactive
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {s.provider} &middot; {categoryLabel[s.category] || s.category} &middot;{" "}
                      {s.billing_cycle}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-[var(--text-primary)]">
                    {s.base_cost_monthly > 0
                      ? `${formatUSD(s.base_cost_monthly)}/mo`
                      : "Usage-based"}
                  </div>
                  {s.monthly_budget && (
                    <p className="text-[10px] text-[var(--text-muted)]">
                      Budget: {formatUSD(s.monthly_budget)}/mo
                    </p>
                  )}
                  {s.url && (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-emerald-400 hover:underline flex items-center gap-0.5 justify-end mt-1"
                    >
                      Dashboard <ArrowUpRight size={10} />
                    </a>
                  )}
                </div>
              </div>
              {s.notes && (
                <p className="text-xs text-[var(--text-muted)] mt-2 border-t border-[var(--border)] pt-2">
                  {s.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Cost History Tab ───────────────────────────────────── */}
      {activeView === "history" && (
        <div className="space-y-2">
          {entries.length === 0 && (
            <div className="text-center py-12 text-[var(--text-muted)]">
              <DollarSign size={36} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">No cost entries yet.</p>
              <p className="text-xs mt-1">
                Click <strong>Log Cost</strong> to add manual entries, or{" "}
                <strong>Sync API Usage</strong> to auto-aggregate tracked calls.
              </p>
            </div>
          )}
          {entries.map((e) => (
            <div
              key={e.id}
              className="border border-[var(--border)] rounded-lg px-4 py-3 flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {e.service_name || e.service_id}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-muted)]">
                    {e.source}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {monthLabel(e.period)}
                  </span>
                </div>
                {e.description && (
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{e.description}</p>
                )}
                {(e.tokens_input || e.tokens_output) && (
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5 font-mono">
                    {formatTokens(e.tokens_input || 0)} in / {formatTokens(e.tokens_output || 0)} out
                    {e.requests_count ? ` · ${e.requests_count} requests` : ""}
                  </p>
                )}
              </div>
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {formatUSD(e.amount_usd)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
