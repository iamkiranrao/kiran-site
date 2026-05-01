"use client";

/**
 * Visual Asset Inventory — CC dashboard view.
 *
 * Mirrors the shape of `prototypes/visual-asset-inventory.html` exactly:
 *   - Cream/charcoal mid-century palette (overrides CC dark theme on this page only)
 *   - Side-rail jump nav grouping sections (brand fundamentals → site identity →
 *     content surfaces → marketing → video → brand kit → future state)
 *   - Doc hero (label + h1 + deck + meta line)
 *   - Per-section custom layouts:
 *       · brand-fundamentals → palette swatches, font samples, character grid
 *       · site-identity      → hero preview tile, favicon icon row, logo tile
 *       · content-surfaces   → bento / persona / OG thumbnail grids
 *       · everything else    → spec-table cards
 *   - Status pills click to flip lifecycle (uncommitted → in_progress → shipped)
 *   - Spec table cells are inline-editable (click to edit, Enter or blur to save)
 *
 * Data is loaded from `/api/visual-assets/`. All edits hit `/api/visual-assets/{id}`.
 */

import { useEffect, useMemo, useState, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ── Types ─────────────────────────────────────────────────── */

interface VisualAsset {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  status: string;
  purpose: string;
  where_deployed: string | null;
  dimensions: string | null;
  aspect_ratio: string | null;
  file_format: string | null;
  file_size_target: string | null;
  quantity: number | null;
  output_path: string | null;
  naming_pattern: string | null;
  style_direction: string | null;
  palette_constraints: string | null;
  typography_rules: string | null;
  composition_rules: string | null;
  source_method: string | null;
  generation_tool: string | null;
  style_ref: string | null;
  preview_image_url: string | null;
  inspiration_links: string[];
  owner: string;
  estimated_effort: string | null;
  linked_action_items: string[];
  related_assets: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
  shipped_at: string | null;
}

/* ── Section grouping (mirrors HTML side-nav) ─────────────── */

type SectionDef = {
  id: string;
  groupLabel: string;
  numberLabel?: string;     // "01 · Brand fundamentals" — only on first in group
  title: string;
  deck?: string;
  category?: string;        // category filter
  subcategory?: string;     // optional subcategory filter
  custom?: "palette" | "typography" | "characters" | "aesthetic"
         | "hero" | "favicon" | "logo"
         | "bento" | "personas" | "og" | "error";
};

const SECTIONS: SectionDef[] = [
  // 01 — Brand fundamentals
  { id: "palette", groupLabel: "Brand fundamentals", numberLabel: "01 · Brand fundamentals",
    title: "Color palette",
    deck: "All assets pull from this palette. UI base + 6 persona accents.",
    custom: "palette" },
  { id: "typography", groupLabel: "Brand fundamentals",
    title: "Typography",
    deck: "Two-family system. Playfair Display for hero/accent moments. Inter for body and UI. Per-card stat fonts for bento differentiation.",
    custom: "typography" },
  { id: "characters", groupLabel: "Brand fundamentals",
    title: "Character cast — the monster system",
    deck: "9 anthropomorphic monster characters, one per content type. Pixar / Monsters Inc DNA. Used in bento cards, persona picker, and OG cards.",
    custom: "characters" },
  { id: "aesthetic", groupLabel: "Brand fundamentals",
    title: "Aesthetic systems (parallel, scoped per surface)",
    deck: "The site uses two distinct visual languages, each scoped to specific surfaces. Mixing them creates fragmentation; keeping them scoped creates intentional depth.",
    custom: "aesthetic" },

  // 02 — Site identity
  { id: "hero", groupLabel: "Site identity", numberLabel: "02 · Site identity",
    title: "Hero image",
    deck: "Full-bleed homepage hero. Painterly Pixar-style studio scene.",
    category: "site-identity", subcategory: "hero", custom: "hero" },
  { id: "favicon", groupLabel: "Site identity",
    title: "Favicon set",
    deck: "Multi-size icon set + PWA manifest.",
    category: "site-identity", subcategory: "favicon", custom: "favicon" },
  { id: "logo", groupLabel: "Site identity",
    title: "Logo / wordmark",
    category: "site-identity", subcategory: "logo", custom: "logo" },

  // 03 — Content surfaces
  { id: "bento", groupLabel: "Content surfaces", numberLabel: "03 · Content surfaces",
    title: "Bento card art",
    deck: "Per-persona-per-slot character illustrations across 9 cards × 7 personas. 23 unique images covering all 63 combos.",
    category: "content-surfaces", subcategory: "bento", custom: "bento" },
  { id: "personas", groupLabel: "Content surfaces",
    title: "Persona picker portraits",
    deck: "Full-body character portraits for the persona selection screen. 3:4 aspect.",
    category: "content-surfaces", subcategory: "personas", custom: "personas" },
  { id: "og", groupLabel: "Content surfaces",
    title: "OG share cards (per content type)",
    deck: "Per-content-type social link previews. 1200×630. Generated programmatically by compositing existing bento heroes with a thin cream bottom band.",
    category: "content-surfaces", subcategory: "og-cards", custom: "og" },
  { id: "error", groupLabel: "Content surfaces",
    title: "Error page imagery",
    deck: "Single shared monster illustration used across all error pages (404, 500, 503, maintenance).",
    category: "content-surfaces", subcategory: "error-imagery", custom: "error" },

  // 04 — Brand & marketing
  { id: "banners", groupLabel: "Brand & marketing", numberLabel: "04 · Brand & marketing",
    title: "Profile banners",
    deck: "Header banners for external social profiles. Mid-century editorial aesthetic.",
    category: "marketing", subcategory: "banners" },
  { id: "handout", groupLabel: "Brand & marketing",
    title: '"What is this site?" handout',
    category: "marketing", subcategory: "handout" },
  { id: "moodboard", groupLabel: "Brand & marketing",
    title: "Mood board imagery",
    deck: "Visual reference set for the brand identity section. Each image is a single bold idea.",
    category: "marketing", subcategory: "mood-board" },
  { id: "social", groupLabel: "Brand & marketing",
    title: "Social media campaign concepts",
    deck: "Hypothetical IG / Twitter / LinkedIn posts as a coordinated launch campaign concept.",
    category: "marketing", subcategory: "social-concepts" },

  // 05 — Video
  { id: "video", groupLabel: "Video", numberLabel: "05 · Video",
    title: "Video assets",
    deck: "Cinemagraphs and manifesto videos. Both currently parked.",
    category: "video" },

  // 06 — Brand kit / collateral
  { id: "stationery", groupLabel: "Brand kit / collateral", numberLabel: "06 · Brand kit / collateral",
    title: "Stationery",
    deck: "Personal-brand stationery for in-person and formal correspondence.",
    category: "stationery" },
  { id: "documents", groupLabel: "Brand kit / collateral",
    title: "Document templates",
    deck: "Reusable templates for any document Kiran produces — pitch decks, resume, one-pagers, proposals.",
    category: "documents" },
  { id: "email", groupLabel: "Brand kit / collateral",
    title: "Email assets",
    category: "email" },
  { id: "speaking", groupLabel: "Brand kit / collateral",
    title: "Speaking / events",
    category: "speaking" },
  { id: "platform", groupLabel: "Brand kit / collateral",
    title: "Platform & community",
    category: "platform" },
  { id: "print-materials", groupLabel: "Brand kit / collateral",
    title: "Print materials",
    category: "print" },
  { id: "brand-docs", groupLabel: "Brand kit / collateral",
    title: "Brand documentation",
    category: "brand-docs" },

  // 07 — Future state
  { id: "future-state", groupLabel: "Future state", numberLabel: "07 · Future state",
    title: "Future-state assets",
    deck: "Aspirational items — engaged when the rest is locked.",
    category: "future-state" },
];

/* ── Status display ─────────────────────────────────────────── */

const STATUS_NEXT: Record<string, string> = {
  uncommitted: "in_progress",
  in_progress: "shipped",
  shipped: "uncommitted",
  parked: "uncommitted",
};
const PILL: Record<string, { label: string; className: string }> = {
  shipped:     { label: "shipped",      className: "pill shipped" },
  in_progress: { label: "in progress",  className: "pill progress" },
  uncommitted: { label: "todo",         className: "pill todo" },
  parked:      { label: "parked",       className: "pill parked" },
};

/* ── Page ───────────────────────────────────────────────────── */

export default function VisualAssetsPage() {
  const [assets, setAssets] = useState<VisualAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [detectMsg, setDetectMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/visual-assets/?limit=1000`);
      const data = await r.json();
      setAssets(data.assets || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Filtering helpers ─────────────────────────────────── */

  const visible = useMemo(() => {
    return assets.filter(a => {
      if (statusFilter && a.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [a.name, a.purpose, a.notes, a.where_deployed, a.subcategory]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [assets, statusFilter, search]);

  const inSection = useCallback((s: SectionDef): VisualAsset[] => {
    return visible.filter(a =>
      (!s.category || a.category === s.category) &&
      (!s.subcategory || a.subcategory === s.subcategory)
    );
  }, [visible]);

  /* ── Mutations ─────────────────────────────────────────── */

  const flipStatus = async (asset: VisualAsset) => {
    const next = STATUS_NEXT[asset.status] || "uncommitted";
    const r = await fetch(`${API}/api/visual-assets/${asset.id}/status?status=${next}`, { method: "POST" });
    if (r.ok) load();
  };

  const updateField = async (id: string, field: string, value: string | number | null) => {
    const body: Record<string, unknown> = {};
    if (field === "quantity") body[field] = value === "" || value == null ? null : Number(value);
    else body[field] = value === "" ? null : value;
    const r = await fetch(`${API}/api/visual-assets/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      const updated: VisualAsset = await r.json();
      setAssets(prev => prev.map(a => a.id === id ? updated : a));
    }
    setEditingField(null);
  };

  const detectShipped = async () => {
    setDetectMsg("Scanning…");
    const r = await fetch(`${API}/api/visual-assets/detect-shipped`, { method: "POST" });
    const data = await r.json();
    setDetectMsg(`Flipped ${data.flipped?.length ?? 0} of ${data.checked} to shipped.`);
    setTimeout(() => setDetectMsg(""), 4000);
    load();
  };

  /* ── Sidebar groups ────────────────────────────────────── */

  const navGroups = useMemo(() => {
    const groups: Record<string, SectionDef[]> = {};
    SECTIONS.forEach(s => {
      groups[s.groupLabel] = groups[s.groupLabel] || [];
      groups[s.groupLabel].push(s);
    });
    return groups;
  }, []);

  /* ── Render ────────────────────────────────────────────── */

  const totalShipped = visible.filter(a => a.status === "shipped").length;
  const totalProgress = visible.filter(a => a.status === "in_progress").length;
  const totalTodo = visible.filter(a => a.status === "uncommitted").length;
  const totalParked = visible.filter(a => a.status === "parked").length;

  return (
    <>
      {/* Page-scoped cream/charcoal theme — mirrors visual-asset-inventory.html */}
      <style jsx global>{`
        .vai-page {
          --cream: #F0E6D8; --cream-2: #E8DCC8; --cream-3: #DFD2BB;
          --charcoal: #2A2520; --charcoal-2: #4A4239;
          --muted: #8A7E70;
          --amber: #C8843D; --teal: #4A6E6E; --olive: #6B7747; --rust: #B05D3C;
          --status-shipped: #6b9e6b; --status-progress: #d4a74a;
          --status-todo: #7a9ec4; --status-parked: #8A7E70;

          /* Escape the dashboard's max-w-5xl + p-8 to take full right-of-sidebar area */
          position: fixed;
          top: 0;
          left: 260px;
          right: 0;
          bottom: 0;
          overflow-y: auto;
          z-index: 1;

          background: var(--cream);
          color: var(--charcoal);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          line-height: 1.5;
          font-size: 15px;
        }
        .vai-page .layout { display: grid; grid-template-columns: 240px 1fr; max-width: 1440px; min-height: 100vh; }
        .vai-page .side-nav {
          position: sticky; top: 0; height: 100vh;
          padding: 32px 20px;
          border-right: 1px solid rgba(42,37,32,0.1);
          background: var(--cream);
          overflow-y: auto;
        }
        .vai-page .side-nav .brand { font-family: 'Playfair Display', Georgia, serif; font-weight: 700; font-size: 1rem; margin-bottom: 4px; color: var(--charcoal); }
        .vai-page .side-nav .brand-sub {
          font-family: 'Space Mono', ui-monospace, monospace; font-size: 0.62rem;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--muted); margin-bottom: 24px;
        }
        .vai-page .side-nav .group {
          font-family: 'Space Mono', ui-monospace, monospace; font-size: 0.58rem;
          letter-spacing: 0.14em; text-transform: uppercase;
          color: var(--amber); margin: 18px 0 6px; font-weight: 700;
        }
        .vai-page .side-nav ol { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }
        .vai-page .side-nav a {
          display: block; padding: 4px 8px; text-decoration: none;
          color: var(--charcoal-2);
          font-family: 'Inter', sans-serif; font-size: 0.78rem;
          border-radius: 3px; transition: all 0.15s; cursor: pointer;
        }
        .vai-page .side-nav a:hover { background: var(--cream-3); color: var(--charcoal); }

        .vai-page .main { padding: 36px 48px 96px; max-width: 1100px; }

        .vai-page .doc-hero { padding-bottom: 28px; border-bottom: 1px solid rgba(42,37,32,0.1); margin-bottom: 40px; }
        .vai-page .doc-hero .label {
          font-family: 'Space Mono', ui-monospace, monospace; font-size: 0.65rem;
          letter-spacing: 0.16em; text-transform: uppercase; color: var(--amber);
          margin-bottom: 12px;
        }
        .vai-page .doc-hero h1 {
          font-family: 'Playfair Display', Georgia, serif; font-weight: 700;
          font-size: 2.1rem; line-height: 1.05; letter-spacing: -0.02em; margin: 0 0 12px; color: var(--charcoal);
        }
        .vai-page .doc-hero .deck { color: var(--charcoal-2); line-height: 1.55; max-width: 64ch; margin: 0 0 18px; }
        .vai-page .meta-line {
          display: flex; flex-wrap: wrap; gap: 22px;
          font-family: 'Space Mono', ui-monospace, monospace; font-size: 0.65rem;
          letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted);
        }
        .vai-page .meta-line strong { color: var(--charcoal); font-weight: 700; }

        .vai-page .toolbar {
          display: flex; gap: 10px; flex-wrap: wrap; align-items: center;
          margin-bottom: 28px; padding: 12px 14px; background: var(--cream-2);
          border-radius: 8px;
        }
        .vai-page .toolbar input, .vai-page .toolbar select {
          background: var(--cream); border: 1px solid rgba(42,37,32,0.12);
          color: var(--charcoal); padding: 6px 10px; border-radius: 4px;
          font-family: inherit; font-size: 0.82rem; outline: none;
        }
        .vai-page .toolbar button {
          background: var(--charcoal); color: var(--cream); border: none;
          padding: 6px 12px; border-radius: 4px; font-family: 'Space Mono', ui-monospace, monospace;
          font-size: 0.65rem; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer;
        }
        .vai-page .toolbar button.secondary {
          background: transparent; color: var(--charcoal-2); border: 1px solid rgba(42,37,32,0.2);
        }
        .vai-page .toolbar .detect-msg {
          font-family: 'Space Mono', ui-monospace, monospace; font-size: 0.65rem;
          color: var(--olive); letter-spacing: 0.06em;
        }

        .vai-page section { margin-bottom: 56px; scroll-margin-top: 24px; }
        .vai-page section h2 {
          font-family: 'Playfair Display', Georgia, serif; font-weight: 700;
          font-size: 1.45rem; margin: 0 0 6px; letter-spacing: -0.01em; color: var(--charcoal);
        }
        .vai-page section .section-tag {
          font-family: 'Space Mono', ui-monospace, monospace; font-size: 0.6rem;
          letter-spacing: 0.14em; text-transform: uppercase;
          color: var(--amber); margin-bottom: 6px; font-weight: 700;
        }
        .vai-page section .section-deck { color: var(--charcoal-2); margin: 0 0 20px; max-width: 64ch; line-height: 1.55; }

        /* Brand fundamentals palette block */
        .vai-page .fundamentals { background: var(--cream-2); padding: 24px 28px; border-radius: 10px; margin-bottom: 24px; }
        .vai-page .fundamentals h3 {
          font-family: 'Space Mono', ui-monospace, monospace; font-size: 0.65rem;
          letter-spacing: 0.14em; text-transform: uppercase; color: var(--rust);
          margin-bottom: 10px; font-weight: 700;
        }
        .vai-page .palette-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 18px; }
        .vai-page .swatch { aspect-ratio: 1; border-radius: 6px; padding: 10px; display: flex; flex-direction: column; justify-content: flex-end; font-family: 'Space Mono', ui-monospace, monospace; font-size: 0.6rem; }
        .vai-page .swatch.dark { color: rgba(255,255,255,0.85); }
        .vai-page .swatch .name { font-weight: 700; margin-bottom: 2px; }

        .vai-page .typography-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom: 8px; }
        .vai-page .type-spec { background: var(--cream); padding: 14px; border-radius: 8px; }
        .vai-page .type-spec .role {
          font-family: 'Space Mono', ui-monospace, monospace; font-size: 0.55rem;
          letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px;
        }
        .vai-page .type-spec .sample { font-size: 1.25rem; line-height: 1.1; color: var(--charcoal); }
        .vai-page .type-spec .name { font-size: 0.7rem; color: var(--charcoal-2); margin-top: 6px; }

        .vai-page .character-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 14px 0; }
        .vai-page .character {
          background: var(--cream-2); padding: 12px 14px; border-radius: 8px;
          border-left: 3px solid var(--persona, var(--charcoal-2));
        }
        .vai-page .character .role {
          font-family: 'Space Mono', ui-monospace, monospace; font-size: 0.55rem;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--persona, var(--charcoal-2)); font-weight: 700; margin-bottom: 4px;
        }
        .vai-page .character .name { font-weight: 600; font-size: 0.9rem; margin-bottom: 2px; color: var(--charcoal); }
        .vai-page .character .animal { font-size: 0.75rem; color: var(--charcoal-2); }

        /* Spec table */
        .vai-page .spec-table {
          width: 100%; border-collapse: collapse;
          background: var(--cream-2); border-radius: 8px; overflow: hidden;
          margin-bottom: 14px;
        }
        .vai-page .spec-table th {
          text-align: left;
          font-family: 'Space Mono', ui-monospace, monospace; font-size: 0.55rem;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--muted); font-weight: 700;
          padding: 10px 14px;
          background: var(--cream-3);
          border-bottom: 1px solid rgba(42,37,32,0.1);
          vertical-align: top;
        }
        .vai-page .spec-table td {
          padding: 10px 14px;
          border-bottom: 1px solid rgba(42,37,32,0.08);
          font-size: 0.8rem; line-height: 1.5; vertical-align: top;
          color: var(--charcoal);
        }
        .vai-page .spec-table tr:last-child td { border-bottom: none; }
        .vai-page .spec-table tr:hover td { background: rgba(255,255,255,0.3); }
        .vai-page .spec-table .name { font-weight: 600; color: var(--charcoal); }
        .vai-page .spec-table .file { font-family: 'Space Mono', ui-monospace, monospace; font-size: 0.72rem; color: var(--rust); }
        .vai-page .spec-table code { font-family: 'Space Mono', ui-monospace, monospace; font-size: 0.72rem; background: rgba(176,93,60,0.08); padding: 1px 5px; border-radius: 3px; color: var(--rust); }

        .vai-page .pill {
          display: inline-block; padding: 2px 8px; border-radius: 100px;
          font-family: 'Space Mono', ui-monospace, monospace;
          font-size: 0.55rem; letter-spacing: 0.08em;
          text-transform: uppercase; font-weight: 700; cursor: pointer;
          border: none; transition: filter 0.15s;
        }
        .vai-page .pill:hover { filter: brightness(0.92); }
        .vai-page .pill.shipped { background: rgba(107,158,107,0.18); color: var(--status-shipped); }
        .vai-page .pill.progress { background: rgba(212,167,74,0.18); color: var(--status-progress); }
        .vai-page .pill.todo { background: rgba(122,158,196,0.18); color: var(--status-todo); }
        .vai-page .pill.parked { background: rgba(138,126,112,0.18); color: var(--status-parked); }

        .vai-page .callout {
          background: rgba(176,93,60,0.06); border-left: 3px solid var(--rust);
          padding: 14px 18px; border-radius: 4px; margin: 14px 0;
          font-size: 0.85rem; color: var(--charcoal-2); line-height: 1.55;
        }
        .vai-page .callout strong { color: var(--charcoal); }

        .vai-page .kv { background: var(--cream-2); border-radius: 8px; padding: 18px 22px; margin: 14px 0; }
        .vai-page .kv dl { display: grid; grid-template-columns: 180px 1fr; gap: 8px 22px; margin: 0; }
        .vai-page .kv dt {
          font-family: 'Space Mono', ui-monospace, monospace; font-size: 0.6rem;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--muted); font-weight: 700; padding-top: 4px;
        }
        .vai-page .kv dd { font-size: 0.85rem; color: var(--charcoal); line-height: 1.5; margin: 0; }

        .vai-page .previews { display: grid; gap: 10px; margin: 18px 0 12px; }
        .vai-page .previews.bento { grid-template-columns: repeat(4, 1fr); }
        .vai-page .previews.og { grid-template-columns: repeat(3, 1fr); }
        .vai-page .previews.personas { grid-template-columns: repeat(6, 1fr); gap: 8px; }

        .vai-page .preview {
          background: var(--cream-2); border-radius: 6px; overflow: hidden;
          border: 1px solid rgba(42,37,32,0.06); display: flex; flex-direction: column;
        }
        .vai-page .preview img { display: block; width: 100%; height: auto; background: rgba(255,255,255,0.3); }
        .vai-page .preview .preview-label {
          padding: 5px 8px; font-family: 'Space Mono', ui-monospace, monospace;
          font-size: 0.55rem; letter-spacing: 0.06em; color: var(--muted);
          border-top: 1px solid rgba(42,37,32,0.06);
        }

        .vai-page .hero-preview {
          width: 100%; border-radius: 8px; overflow: hidden;
          border: 1px solid rgba(42,37,32,0.08);
          box-shadow: 0 4px 16px rgba(0,0,0,0.06); margin: 14px 0;
        }
        .vai-page .hero-preview img { display: block; width: 100%; height: auto; }

        .vai-page .icon-row { display: flex; gap: 18px; align-items: center; flex-wrap: wrap; margin: 14px 0; }
        .vai-page .icon-tile { display: inline-flex; flex-direction: column; align-items: center; gap: 6px; }
        .vai-page .icon-tile img {
          width: 56px; height: 56px; border-radius: 8px;
          background: white; padding: 6px; border: 1px solid rgba(42,37,32,0.08);
          object-fit: contain;
        }
        .vai-page .icon-tile.large img { width: 92px; height: 92px; }
        .vai-page .icon-tile .icon-label {
          font-family: 'Space Mono', ui-monospace, monospace; font-size: 0.55rem;
          color: var(--muted); letter-spacing: 0.06em;
        }

        .vai-page .editable {
          cursor: text; padding: 0 2px; border-radius: 2px; transition: background 0.15s;
        }
        .vai-page .editable:hover { background: rgba(176,93,60,0.06); }
        .vai-page input.inline-edit, .vai-page textarea.inline-edit {
          width: 100%; background: var(--cream); border: 1px solid var(--amber);
          color: var(--charcoal); padding: 4px 6px; border-radius: 3px;
          font-family: inherit; font-size: 0.8rem; outline: none;
          line-height: 1.5;
        }
        .vai-page textarea.inline-edit { resize: vertical; min-height: 60px; }

        .vai-page .empty-state {
          font-family: 'Space Mono', ui-monospace, monospace; font-size: 0.72rem;
          color: var(--muted); padding: 12px 0; letter-spacing: 0.06em;
        }
      `}</style>

      <div className="vai-page">
        <div className="layout">
          {/* SIDE NAV */}
          <nav className="side-nav">
            <div className="brand">Visual Asset Inventory</div>
            <div className="brand-sub">kiranrao.ai · designer brief</div>
            {Object.entries(navGroups).map(([group, items]) => (
              <div key={group}>
                <div className="group">{group}</div>
                <ol>
                  {items.map(s => {
                    const count = inSection(s).length;
                    return (
                      <li key={s.id}>
                        <a href={`#${s.id}`}>
                          {s.title.replace(/\(.*?\)/g, "").trim()}
                          {count > 0 && !s.custom && (
                            <span style={{ color: "var(--muted)", marginLeft: 6 }}>({count})</span>
                          )}
                        </a>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </nav>

          {/* MAIN */}
          <main className="main">
            {/* HERO */}
            <div className="doc-hero">
              <div className="label">Designer brief · v1 · live</div>
              <h1>Visual Asset Inventory — kiranrao.ai</h1>
              <p className="deck">
                A single document covering every visual asset on the site — shipped, in-progress, and planned. Click any status pill to flip lifecycle. Click any spec field to edit inline. Click <strong>Detect shipped</strong> after dropping new files into <code style={{ fontFamily: 'Space Mono, ui-monospace, monospace', fontSize: '0.75em', background: 'rgba(176,93,60,0.08)', padding: '1px 5px', borderRadius: 3, color: 'var(--rust)' }}>images/</code> to auto-flip.
              </p>
              <div className="meta-line">
                <span><strong>{visible.length}</strong> assets</span>
                <span><strong>{totalShipped}</strong> shipped</span>
                <span><strong>{totalProgress}</strong> in progress</span>
                <span><strong>{totalTodo}</strong> todo</span>
                <span><strong>{totalParked}</strong> parked</span>
              </div>
            </div>

            {/* TOOLBAR */}
            <div className="toolbar">
              <input
                type="text"
                placeholder="Search name, purpose, notes…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ flex: 1, minWidth: 200 }}
              />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All statuses</option>
                <option value="uncommitted">Todo</option>
                <option value="in_progress">In progress</option>
                <option value="shipped">Shipped</option>
                <option value="parked">Parked</option>
              </select>
              {(search || statusFilter) && (
                <button className="secondary" onClick={() => { setSearch(""); setStatusFilter(""); }}>
                  Clear
                </button>
              )}
              <button onClick={detectShipped}>Detect shipped</button>
              {detectMsg && <span className="detect-msg">{detectMsg}</span>}
            </div>

            {loading ? (
              <div className="empty-state">Loading inventory…</div>
            ) : (
              SECTIONS.map(section => (
                <SectionRenderer
                  key={section.id}
                  section={section}
                  assets={inSection(section)}
                  flipStatus={flipStatus}
                  updateField={updateField}
                  editingField={editingField}
                  setEditingField={setEditingField}
                />
              ))
            )}
          </main>
        </div>
      </div>
    </>
  );
}

/* ── Section renderer ────────────────────────────────────── */

interface SectionProps {
  section: SectionDef;
  assets: VisualAsset[];
  flipStatus: (a: VisualAsset) => void;
  updateField: (id: string, field: string, value: string | number | null) => void;
  editingField: string | null;
  setEditingField: (s: string | null) => void;
}

function SectionRenderer({ section, assets, flipStatus, updateField, editingField, setEditingField }: SectionProps) {
  return (
    <section id={section.id}>
      {section.numberLabel && <div className="section-tag">{section.numberLabel}</div>}
      <h2>{section.title}</h2>
      {section.deck && <p className="section-deck">{section.deck}</p>}

      {section.custom === "palette" && <PaletteBlock />}
      {section.custom === "typography" && <TypographyBlock />}
      {section.custom === "characters" && <CharactersBlock />}
      {section.custom === "aesthetic" && <AestheticBlock />}

      {section.custom === "hero" && <HeroPreviewBlock assets={assets} />}
      {section.custom === "favicon" && <FaviconBlock assets={assets} />}
      {section.custom === "logo" && <LogoBlock assets={assets} />}

      {section.custom === "bento" && <ThumbnailGrid kind="bento" />}
      {section.custom === "personas" && <ThumbnailGrid kind="personas" />}
      {section.custom === "og" && <ThumbnailGrid kind="og" />}
      {section.custom === "error" && <HeroPreviewBlock assets={assets} src="/images/404image.png" />}

      {/* Spec table — runs for every section, including the custom ones (so the rows underneath the visual block stay editable). */}
      {assets.length > 0 ? (
        <SpecTable
          assets={assets}
          flipStatus={flipStatus}
          updateField={updateField}
          editingField={editingField}
          setEditingField={setEditingField}
          variant={section.custom}
        />
      ) : (
        !section.custom && <div className="empty-state">No assets in this section yet.</div>
      )}
    </section>
  );
}

/* ── Custom blocks ───────────────────────────────────────── */

function PaletteBlock() {
  const core = [
    { name: "Cream", hex: "#F0E6D8", textColor: "var(--charcoal)" },
    { name: "Charcoal", hex: "#2A2520" },
    { name: "Amber", hex: "#C8843D" },
    { name: "Teal", hex: "#4A6E6E" },
    { name: "Olive", hex: "#6B7747" },
    { name: "Rust", hex: "#B05D3C" },
  ];
  const personas = [
    { name: "Evaluator", hex: "#7B9ACC" },
    { name: "Seeker", hex: "#8A8580" },
    { name: "Practitioner", hex: "#4DAF8B" },
    { name: "Learner", hex: "#A07ED4" },
    { name: "Technologist", hex: "#cb5c72" },
    { name: "Inner Circle", hex: "#cb6923" },
  ];
  return (
    <div className="fundamentals">
      <h3>Core palette</h3>
      <div className="palette-row">
        {core.map(c => (
          <div key={c.name} className="swatch dark" style={{ background: c.hex, color: c.textColor }}>
            <div className="name" style={c.textColor ? { color: c.textColor } : undefined}>{c.name}</div>
            <div style={c.textColor ? { color: c.textColor } : undefined}>{c.hex}</div>
          </div>
        ))}
      </div>
      <h3>Persona accents</h3>
      <div className="palette-row">
        {personas.map(c => (
          <div key={c.name} className="swatch dark" style={{ background: c.hex }}>
            <div className="name">{c.name}</div>
            <div>{c.hex}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TypographyBlock() {
  return (
    <>
      <div className="typography-row">
        <div className="type-spec">
          <div className="role">Hero / Headings</div>
          <div className="sample" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>Playfair Display</div>
          <div className="name">700 weight, -0.02em letter-spacing</div>
        </div>
        <div className="type-spec">
          <div className="role">Body / UI</div>
          <div className="sample" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>Inter</div>
          <div className="name">400-700 weights</div>
        </div>
        <div className="type-spec">
          <div className="role">Mono / Eyebrow</div>
          <div className="sample" style={{ fontFamily: "'Space Mono', ui-monospace, monospace", fontWeight: 700 }}>Space Mono</div>
          <div className="name">700 weight, 0.14em tracking, uppercase</div>
        </div>
      </div>
      <div className="callout">
        <strong>Per-card stat fonts (bento system):</strong> teardowns = Inter, career = Archivo Black, madlab = Orbitron, studio = Caveat, blog = Lora italic, skills = Josefin Sans, now = Syne, underhood = Space Grotesk, testimonials = Corben.
      </div>
    </>
  );
}

function CharactersBlock() {
  const cast = [
    { role: "Teardowns", name: "Analyst", animal: "Owl · lab coat, magnifying glass", hex: "var(--rust)" },
    { role: "Career / The Work", name: "Veteran", animal: "Bear · weathered blazer, cityscape", hex: "#C8843D" },
    { role: "MadLab", name: "Tinkerer", animal: "Meerkat · welding goggles, contraption", hex: "var(--olive)" },
    { role: "Studio", name: "Artist", animal: "Chinchilla · beret, paint splatters", hex: "var(--teal)" },
    { role: "Testimonials", name: "Connector", animal: "Quokka · cardigan, big smile", hex: "#cb6923" },
    { role: "Under the Hood", name: "Engineer", animal: "Bulldog · hard hat, headlamp, tool belt", hex: "#4A6E6E" },
    { role: "Skills", name: "Cartographer", animal: "Octopus · multi-armed, mapping", hex: "var(--charcoal-2)" },
    { role: "Blog", name: "Storyteller", animal: "Orangutan · creative writing space", hex: "#A07ED4" },
    { role: "Now", name: "Explorer", animal: "Fox · trail gear, journey", hex: "#4DAF8B" },
  ];
  return (
    <div className="character-grid">
      {cast.map(c => (
        <div key={c.name} className="character" style={{ ["--persona" as string]: c.hex } as React.CSSProperties}>
          <div className="role">{c.role}</div>
          <div className="name">{c.name}</div>
          <div className="animal">{c.animal}</div>
        </div>
      ))}
    </div>
  );
}

function AestheticBlock() {
  return (
    <>
      <div className="kv">
        <dl>
          <dt>Pixar / Monster system</dt>
          <dd>Used on bento cards, persona picker, OG cards, error page imagery, hero scene. Warm fuzzy character illustrations, golden-hour lighting, Pixar-quality painterly aesthetic. <strong>The site&apos;s primary identity layer.</strong></dd>
          <dt>Mid-century editorial</dt>
          <dd>Used on profile banners, social media campaign concepts, mood board, handout. Saul Bass / Paul Rand / Charley Harper inspired flat geometric shapes, restrained palette, designer-credible. <strong>The brand-system layer.</strong></dd>
        </dl>
      </div>
      <div className="callout">
        <strong>Decision rule:</strong> Content surfaces visitors directly engage with use the monster system. Brand-marketing surfaces (banners on external profiles, mood board, brand book) use mid-century editorial. The two languages should never appear in the same composition.
      </div>
    </>
  );
}

function HeroPreviewBlock({ assets, src }: { assets: VisualAsset[]; src?: string }) {
  const fallback = src ?? assets[0]?.output_path;
  if (!fallback) return null;
  const url = fallback.startsWith("http") || fallback.startsWith("/")
    ? fallback
    : `https://kiranrao.ai/${fallback.replace(/^\//, "")}`;
  return (
    <div className="hero-preview">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
    </div>
  );
}

function FaviconBlock({ assets }: { assets: VisualAsset[] }) {
  const tiles = [
    { label: "favicon.svg", path: "images/favicon/favicon.svg" },
    { label: "favicon-96", path: "images/favicon/favicon-96x96.png" },
    { label: "apple-touch", path: "images/favicon/apple-touch-icon.png" },
    { label: "manifest 192", path: "images/favicon/web-app-manifest-192x192.png", large: true },
    { label: "manifest 512", path: "images/favicon/web-app-manifest-512x512.png", large: true },
  ];
  void assets;
  return (
    <div className="icon-row">
      {tiles.map(t => (
        <div key={t.label} className={`icon-tile ${t.large ? "large" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://kiranrao.ai/${t.path}`} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          <div className="icon-label">{t.label}</div>
        </div>
      ))}
    </div>
  );
}

function LogoBlock({ assets }: { assets: VisualAsset[] }) {
  const path = assets[0]?.output_path || "images/logo.png";
  return (
    <div className="icon-row">
      <div className="icon-tile large">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`https://kiranrao.ai/${path.replace(/^\//, "")}`} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        <div className="icon-label">{path.split("/").pop()}</div>
      </div>
    </div>
  );
}

function ThumbnailGrid({ kind }: { kind: "bento" | "personas" | "og" }) {
  const sets: Record<string, { src: string; label: string }[]> = {
    bento: [
      { src: "images/analyst-hero-2-1.png", label: "analyst (teardowns)" },
      { src: "images/veteran-hero-2-1.png", label: "veteran (career)" },
      { src: "images/tinkerer-hero-2_1.png", label: "tinkerer (madlab)" },
      { src: "images/artist-hero-2_1.png", label: "artist (studio)" },
      { src: "images/blogging-monster2.png", label: "storyteller (blog)" },
      { src: "images/engineer-blog-2_1.png", label: "engineer (under the hood)" },
      { src: "images/connector-wider-3_1.png", label: "connector (testimonials)" },
      { src: "images/octupus_skills1.png", label: "cartographer (skills)" },
    ],
    personas: [
      { src: "images/evaluator-merritt.png", label: "Evaluator" },
      { src: "images/seeker-phil.png", label: "Seeker" },
      { src: "images/practitioner-drew.png", label: "Practitioner" },
      { src: "images/learner-paige.png", label: "Learner" },
      { src: "images/technologist-ray.webp", label: "Technologist" },
      { src: "images/innercircle-keshav.png", label: "Inner Circle" },
    ],
    og: [
      { src: "images/og/og-teardowns.png", label: "og-teardowns" },
      { src: "images/og/og-career.png", label: "og-career" },
      { src: "images/og/og-madlab.png", label: "og-madlab" },
      { src: "images/og/og-studio.png", label: "og-studio" },
      { src: "images/og/og-blog.png", label: "og-blog" },
      { src: "images/og/og-underhood.png", label: "og-underhood" },
      { src: "images/og/og-testimonials.png", label: "og-testimonials" },
      { src: "images/og/og-skills.png", label: "og-skills" },
      { src: "images/og/og-homepage.png", label: "og-homepage" },
    ],
  };
  const items = sets[kind];
  return (
    <div className={`previews ${kind}`}>
      {items.map(t => (
        <div key={t.src} className="preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://kiranrao.ai/${t.src}`} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          <div className="preview-label">{t.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Spec table ────────────────────────────────────────────── */

interface SpecTableProps {
  assets: VisualAsset[];
  flipStatus: (a: VisualAsset) => void;
  updateField: (id: string, field: string, value: string | number | null) => void;
  editingField: string | null;
  setEditingField: (s: string | null) => void;
  variant?: string;
}

function SpecTable({ assets, flipStatus, updateField, editingField, setEditingField, variant }: SpecTableProps) {
  // Different headers per variant — mirrors the HTML's per-section table shapes.
  const showWhereDeployed = variant !== "favicon" && variant !== "logo" && variant !== "bento" && variant !== "personas" && variant !== "og";
  return (
    <table className="spec-table">
      <thead>
        <tr>
          <th>Asset</th>
          <th>Status</th>
          <th>Purpose</th>
          {showWhereDeployed && <th>Where deployed</th>}
          <th>Specs</th>
          <th>Output</th>
        </tr>
      </thead>
      <tbody>
        {assets.map(a => (
          <SpecRow
            key={a.id}
            asset={a}
            showWhereDeployed={showWhereDeployed}
            flipStatus={flipStatus}
            updateField={updateField}
            editingField={editingField}
            setEditingField={setEditingField}
          />
        ))}
      </tbody>
    </table>
  );
}

function SpecRow({ asset, showWhereDeployed, flipStatus, updateField, editingField, setEditingField }: {
  asset: VisualAsset;
  showWhereDeployed: boolean;
  flipStatus: (a: VisualAsset) => void;
  updateField: (id: string, field: string, value: string | number | null) => void;
  editingField: string | null;
  setEditingField: (s: string | null) => void;
}) {
  const pill = PILL[asset.status] || PILL.uncommitted;
  const fk = (f: string) => `${asset.id}:${f}`;

  const specsLine = [
    asset.dimensions && `${asset.dimensions}`,
    asset.aspect_ratio && `${asset.aspect_ratio}`,
    asset.file_format,
    asset.file_size_target && `≤${asset.file_size_target}`,
    asset.quantity && asset.quantity > 1 && `qty ${asset.quantity}`,
  ].filter(Boolean).join(" · ");

  return (
    <tr>
      <td className="name">
        <Editable
          value={asset.name}
          isEditing={editingField === fk("name")}
          onStart={() => setEditingField(fk("name"))}
          onSave={v => updateField(asset.id, "name", v)}
          onCancel={() => setEditingField(null)}
        />
      </td>
      <td>
        <button className={pill.className} onClick={() => flipStatus(asset)} title="Click to flip status">
          {pill.label}
        </button>
      </td>
      <td>
        <Editable
          value={asset.purpose || ""}
          multiline
          isEditing={editingField === fk("purpose")}
          onStart={() => setEditingField(fk("purpose"))}
          onSave={v => updateField(asset.id, "purpose", v)}
          onCancel={() => setEditingField(null)}
          placeholder="—"
        />
      </td>
      {showWhereDeployed && (
        <td>
          <Editable
            value={asset.where_deployed || ""}
            multiline
            isEditing={editingField === fk("where_deployed")}
            onStart={() => setEditingField(fk("where_deployed"))}
            onSave={v => updateField(asset.id, "where_deployed", v)}
            onCancel={() => setEditingField(null)}
            placeholder="—"
          />
        </td>
      )}
      <td>
        {specsLine || <span style={{ color: "var(--muted)" }}>—</span>}
        {asset.style_direction && (
          <div style={{ marginTop: 6, color: "var(--charcoal-2)", fontSize: "0.74rem" }}>
            <Editable
              value={asset.style_direction}
              multiline
              isEditing={editingField === fk("style_direction")}
              onStart={() => setEditingField(fk("style_direction"))}
              onSave={v => updateField(asset.id, "style_direction", v)}
              onCancel={() => setEditingField(null)}
            />
          </div>
        )}
        {asset.notes && (
          <div style={{ marginTop: 6, color: "var(--muted)", fontSize: "0.7rem", fontStyle: "italic" }}>
            <Editable
              value={asset.notes}
              multiline
              isEditing={editingField === fk("notes")}
              onStart={() => setEditingField(fk("notes"))}
              onSave={v => updateField(asset.id, "notes", v)}
              onCancel={() => setEditingField(null)}
            />
          </div>
        )}
      </td>
      <td>
        <span className="file">
          <Editable
            value={asset.output_path || ""}
            isEditing={editingField === fk("output_path")}
            onStart={() => setEditingField(fk("output_path"))}
            onSave={v => updateField(asset.id, "output_path", v)}
            onCancel={() => setEditingField(null)}
            placeholder="—"
          />
        </span>
        {asset.source_method && (
          <div style={{ marginTop: 4, fontSize: "0.7rem", color: "var(--muted)", fontFamily: "'Space Mono', ui-monospace, monospace", letterSpacing: "0.06em" }}>
            via {asset.source_method}
          </div>
        )}
      </td>
    </tr>
  );
}

/* ── Inline editable cell ──────────────────────────────────── */

function Editable({ value, isEditing, onStart, onSave, onCancel, multiline, placeholder }: {
  value: string;
  isEditing: boolean;
  onStart: () => void;
  onSave: (v: string) => void;
  onCancel: () => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value, isEditing]);

  if (isEditing) {
    if (multiline) {
      return (
        <textarea
          autoFocus
          className="inline-edit"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => onSave(draft)}
          onKeyDown={e => {
            if (e.key === "Escape") onCancel();
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSave(draft);
          }}
          rows={3}
        />
      );
    }
    return (
      <input
        autoFocus
        className="inline-edit"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => onSave(draft)}
        onKeyDown={e => {
          if (e.key === "Escape") onCancel();
          if (e.key === "Enter") onSave(draft);
        }}
      />
    );
  }
  return (
    <span className="editable" onClick={onStart}>
      {value || <span style={{ color: "var(--muted)" }}>{placeholder ?? "—"}</span>}
    </span>
  );
}
