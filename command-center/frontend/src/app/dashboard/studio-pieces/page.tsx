"use client";

import { useState, useEffect, useCallback } from "react";
import { Brush, Edit3, Check, X, Loader2 } from "lucide-react";
import ModuleHelp from "@/components/ModuleHelp";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Studio Pieces — editable text attributes for the Studio Illustration page.
 *
 * The catalog of pieces (image paths, ordering, alt text) lives in
 * studio-illustration.html and stays there — that's what gets indexed by
 * search engines and shipped statically. This module manages the seven text
 * attributes shown in the lightbox: title, date, tools, style, inspiredBy,
 * dimensions, note.
 *
 * For each field, an empty value here means "use the inline HTML value" — CC
 * only overrides when a field is non-empty. So leaving a field blank is the
 * safe default and equivalent to "fall back to whatever's on the page."
 *
 * Catalog is seeded below from studio-illustration.html. Add a new piece's
 * key + title here when you ship a new illustration.
 */

interface Piece {
  key: string;
  title: string;
}

interface PieceRecord {
  key: string;
  title: string;
  date: string;
  tools: string;
  style: string;
  inspiredBy: string;
  dimensions: string;
  note: string;
  updated_at: string | null;
}

// Mirrors the cards in studio-illustration.html. Order matches the masonry.
// When a new illustration ships, add its row here.
const CATALOG: Piece[] = [
  { key: "jellyfish", title: "Visitation" },
  { key: "madmen", title: "Mad Men" },
  { key: "tortoise-and-turtles", title: "The Visit" },
  { key: "jane-goodall", title: "Jane Goodall" },
  { key: "sloth-and-god", title: "The Creation of Sloth" },
  { key: "elephant-never-forgets", title: "An Elephant Never Forgets" },
  { key: "you-will-never-walk-alone", title: "You'll Never Walk Alone" },
  { key: "garuda", title: "Garuda" },
  { key: "arlo-and-me", title: "Arlo and Me" },
  { key: "arlos-essence", title: "Arlo's Essence" },
  { key: "life-is-good", title: "Life is Good" },
  { key: "aquarium", title: "Aquarium" },
  { key: "independence-day", title: "Vande Mataram" },
  { key: "monk-and-whale", title: "Monk and the Whale" },
  { key: "warplanes", title: "Warplanes over Dubai" },
];

const EMPTY: Omit<PieceRecord, "key" | "updated_at"> = {
  title: "",
  date: "",
  tools: "",
  style: "",
  inspiredBy: "",
  dimensions: "",
  note: "",
};

export default function StudioPiecesPage() {
  const [records, setRecords] = useState<Record<string, PieceRecord>>({});
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<typeof EMPTY>({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/studio-pieces/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const map: Record<string, PieceRecord> = {};
      for (const p of data.pieces || []) map[p.key] = p;
      setRecords(map);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Couldn't load records: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function startEdit(key: string) {
    const cur = records[key];
    setDraft({
      title: cur?.title || "",
      date: cur?.date || "",
      tools: cur?.tools || "",
      style: cur?.style || "",
      inspiredBy: cur?.inspiredBy || "",
      dimensions: cur?.dimensions || "",
      note: cur?.note || "",
    });
    setEditingKey(key);
  }

  function cancelEdit() {
    setEditingKey(null);
    setDraft({ ...EMPTY });
  }

  function updateDraft<K extends keyof typeof EMPTY>(field: K, value: string) {
    setDraft((d) => ({ ...d, [field]: value }));
  }

  async function saveEdit() {
    if (!editingKey) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/studio-pieces/${editingKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated: PieceRecord = await res.json();
      setRecords((prev) => ({ ...prev, [editingKey]: updated }));
      setEditingKey(null);
      setDraft({ ...EMPTY });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Save failed: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  function summary(rec?: PieceRecord) {
    if (!rec) return null;
    const fields = [rec.title, rec.date, rec.tools, rec.style, rec.inspiredBy, rec.dimensions]
      .filter((v) => v && v.trim());
    return fields.length ? fields.length : 0;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Brush size={22} className="text-[var(--accent-amber)]" />
            Studio Pieces
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1 max-w-2xl">
            Edit the text attributes shown in the lightbox for each illustration —
            title, date, tools, style, inspired by, dimensions, and the personal
            note. Empty fields fall back to the inline HTML values, so blank is
            safe. The public site fetches these on demand when someone opens a
            piece.
          </p>
        </div>
        <ModuleHelp moduleSlug="studio-pieces" />
      </div>

      {error && (
        <div className="px-4 py-3 rounded-md border border-red-500/30 bg-red-500/10 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
          <Loader2 size={16} className="animate-spin" /> Loading records…
        </div>
      ) : (
        <div className="space-y-3">
          {CATALOG.map((piece) => {
            const current = records[piece.key];
            const isEditing = editingKey === piece.key;
            const updatedAt = current?.updated_at;
            const overrideCount = summary(current) || 0;
            const hasNote = !!current?.note?.trim();

            return (
              <div
                key={piece.key}
                className="border border-[var(--border)] rounded-md p-4 bg-[var(--bg-card)]"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0">
                    <div className="font-medium text-[var(--text-primary)]">
                      {current?.title?.trim() || piece.title}
                      {current?.title?.trim() && current.title !== piece.title && (
                        <span className="ml-2 text-xs text-[var(--text-muted)] font-normal">
                          (HTML: &ldquo;{piece.title}&rdquo;)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                      {piece.key}
                      {updatedAt && (
                        <span className="ml-2 opacity-70">
                          · last edited {new Date(updatedAt).toLocaleString()}
                        </span>
                      )}
                      {overrideCount > 0 && (
                        <span className="ml-2 text-[var(--accent-amber)]">
                          · {overrideCount} field{overrideCount === 1 ? "" : "s"} overriding HTML
                        </span>
                      )}
                    </div>
                  </div>
                  {!isEditing && (
                    <button
                      onClick={() => startEdit(piece.key)}
                      className="px-3 py-1.5 text-xs rounded-md border border-[var(--border)] hover:border-[var(--accent-amber)] hover:text-[var(--accent-amber)] flex items-center gap-1.5 shrink-0"
                    >
                      <Edit3 size={13} />
                      Edit
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <FieldInput
                      label="Title"
                      hint="Shown as the lightbox heading and (after first open) the masonry card pill."
                      value={draft.title}
                      onChange={(v) => updateDraft("title", v)}
                    />
                    <FieldInput
                      label="Date"
                      hint="e.g. May 2026, August 15 2025"
                      value={draft.date}
                      onChange={(v) => updateDraft("date", v)}
                    />
                    <FieldInput
                      label="Tools"
                      hint="e.g. Midjourney v7"
                      value={draft.tools}
                      onChange={(v) => updateDraft("tools", v)}
                    />
                    <FieldTextarea
                      label="Style"
                      hint="One short paragraph describing the visual style."
                      value={draft.style}
                      onChange={(v) => updateDraft("style", v)}
                      rows={2}
                    />
                    <FieldTextarea
                      label="Inspired by"
                      hint="Artists, traditions, or references — comma-separated."
                      value={draft.inspiredBy}
                      onChange={(v) => updateDraft("inspiredBy", v)}
                      rows={2}
                    />
                    <FieldInput
                      label="Dimensions"
                      hint="e.g. 2688 × 1792"
                      value={draft.dimensions}
                      onChange={(v) => updateDraft("dimensions", v)}
                    />
                    <FieldTextarea
                      label="Note"
                      hint="The personal voice — what this piece means, the story behind it. Empty = no note shown."
                      value={draft.note}
                      onChange={(v) => updateDraft("note", v)}
                      rows={5}
                    />
                    <div className="flex items-center gap-2 justify-end pt-1">
                      <button
                        onClick={cancelEdit}
                        disabled={saving}
                        className="px-3 py-1.5 text-xs rounded-md border border-[var(--border)] hover:bg-[var(--bg-primary)] flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <X size={13} />
                        Cancel
                      </button>
                      <button
                        onClick={saveEdit}
                        disabled={saving}
                        className="px-3 py-1.5 text-xs rounded-md bg-[var(--accent-amber)] text-black hover:opacity-90 flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        Save
                      </button>
                    </div>
                  </div>
                ) : hasNote ? (
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                    {current!.note}
                  </p>
                ) : (
                  <p className="text-sm text-[var(--text-muted)] italic">
                    No overrides yet — lightbox uses the inline HTML values.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────── */

function FieldInput({
  label, hint, value, onChange,
}: { label: string; hint?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-1">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-1.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border)] text-sm focus:border-[var(--accent-amber)] focus:outline-none"
      />
      {hint && <p className="text-[11px] text-[var(--text-muted)] mt-1 italic">{hint}</p>}
    </div>
  );
}

function FieldTextarea({
  label, hint, value, onChange, rows = 3,
}: { label: string; hint?: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-1">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full px-3 py-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border)] text-sm focus:border-[var(--accent-amber)] focus:outline-none resize-y"
      />
      {hint && <p className="text-[11px] text-[var(--text-muted)] mt-1 italic">{hint}</p>}
    </div>
  );
}
