"use client";

import { useState, useEffect, useCallback } from "react";
import { Brush, Edit3, Check, X, Loader2 } from "lucide-react";
import ModuleHelp from "@/components/ModuleHelp";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Studio Pieces — editable notes for the Studio Illustration page.
 *
 * The catalog of pieces (titles, image paths, dimensions, style, etc.) lives
 * in studio-illustration.html and stays there — that's what gets indexed by
 * search engines and shipped statically. This module manages only the
 * personal "note" field on each piece, which is what gets fetched and shown
 * in the lightbox at runtime.
 *
 * Catalog is seeded below from studio-illustration.html. Add a new piece's
 * key + title here when you ship a new illustration.
 */

interface Piece {
  key: string;
  title: string;
}

interface PieceNote {
  key: string;
  note: string;
  updated_at: string | null;
}

// Mirrors the cards in studio-illustration.html. Order matches the masonry.
// When a new illustration ships, add its row here.
const CATALOG: Piece[] = [
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

export default function StudioPiecesPage() {
  const [notes, setNotes] = useState<Record<string, PieceNote>>({});
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/studio-pieces/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const map: Record<string, PieceNote> = {};
      for (const p of data.pieces || []) map[p.key] = p;
      setNotes(map);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Couldn't load notes: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function startEdit(key: string) {
    setDraft(notes[key]?.note || "");
    setEditingKey(key);
  }

  function cancelEdit() {
    setEditingKey(null);
    setDraft("");
  }

  async function saveEdit() {
    if (!editingKey) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/studio-pieces/${editingKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: draft }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated: PieceNote = await res.json();
      setNotes((prev) => ({ ...prev, [editingKey]: updated }));
      setEditingKey(null);
      setDraft("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Save failed: ${msg}`);
    } finally {
      setSaving(false);
    }
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
            Edit the personal note shown in the lightbox for each illustration.
            Everything else (title, dimensions, style, inspiration) lives in the
            page source. Notes save instantly — the public site fetches them on
            demand when someone opens a piece.
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
          <Loader2 size={16} className="animate-spin" /> Loading notes…
        </div>
      ) : (
        <div className="space-y-3">
          {CATALOG.map((piece) => {
            const current = notes[piece.key];
            const note = current?.note || "";
            const isEditing = editingKey === piece.key;
            const updatedAt = current?.updated_at;

            return (
              <div
                key={piece.key}
                className="border border-[var(--border)] rounded-md p-4 bg-[var(--bg-card)]"
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <div className="font-medium text-[var(--text-primary)]">
                      {piece.title}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                      {piece.key}
                      {updatedAt && (
                        <span className="ml-2 opacity-70">
                          · last edited {new Date(updatedAt).toLocaleString()}
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
                      {note ? "Edit" : "Add note"}
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={5}
                      placeholder="Write the note in your voice. What this piece means, what inspired it, the personal story behind it…"
                      className="w-full px-3 py-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border)] text-sm focus:border-[var(--accent-amber)] focus:outline-none resize-y"
                      autoFocus
                    />
                    <div className="flex items-center gap-2 justify-end">
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
                ) : note ? (
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                    {note}
                  </p>
                ) : (
                  <p className="text-sm text-[var(--text-muted)] italic">
                    No note yet — the lightbox shows &ldquo;More on this piece soon.&rdquo;
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
