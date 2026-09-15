# kiran-site — Kiran Gorapalli's portfolio (kiranrao.ai)

> **Working style: keep responses SHORT and to the point. Kiran wants important details fast, not long-winded walls of text.**

Static site (vanilla HTML/JS/CSS, **no build step**), auto-deployed via **Cloudflare Pages** on push to `main`. **PUBLIC repo — never commit secrets.**

## Architecture
- **Persona-adapter frontend:** `fenix-core.js` + `fenix-adapters/*-adapter.js` + `persona-system.js`. Personas built: evaluator, practitioner, technologist, learner. Planned: **seeker** (Fenix Consulting front door), inner-circle.
- Talks to the **Fenix backend** at `api.kiranrao.ai` (FastAPI on Vercel) for chat / RAG / feedback / testimonials.
- Frontend uses only the Supabase **publishable** (anon) key — it's in `app.js` for the auth-gate + adapters. The **service key never appears client-side.**
- `prototypes/scannibal/` holds the Scannibal app/api + a DIA-fund landing prototype (gitignored embedded repos).
- `docs/` is **gitignored / local-only** — internal notes, not published.

## Conventions
- Match surrounding vanilla-JS style; no framework. Verify by loading pages / the browser preview.
- This repo is **Track 1 (Site)** work.

## Full context (private)
The complete plan, all four build tracks, and strategy live in Kiran's **private `kiran-vault`** repo. If you can access it, add it to the session and read `TRACKS.md` + `context/memory-snapshot/MEMORY.md` before starting.
