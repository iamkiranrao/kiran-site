# Studio Store — Gameplan (Parked)

**Status:** PARKED — May 2026. Not blocked, just lower priority than other workstreams. Pick up when there's a reason to ship downloadable/purchasable prints.

**What it does for you:** Captures the future state where every Studio Illustration piece is offered as a high-resolution download or print, plus the deferred upscaling work needed to get there. Avoids losing the plan or having to rediscover decisions later.

---

## The vision

Today the Studio Illustration gallery (`/studio-illustration.html`) is a viewing portfolio — 21 pieces with personal notes, beautiful but not transactable. The future state is a *gallery + shop*: visitors can browse the same pieces, then download a wallpaper-sized version for free or buy a print. Same gallery, additional commerce surface.

This is a real fork in the studio's identity that Kiran called out earlier in this build: *"do I want my Studio to be a gallery, or a shop?"* The answer is *eventually both* — but not yet.

---

## What's blocking shipment

**Image masters are not print-grade across the board.** 19 of 21 pieces are at MJ V7 native (~2688×1792) which is fine for prints up to 16×24" but soft past that. The 2 ChatGPT-sourced pieces (Robin Williams, Jimmy Carter) are at ~1500px on the long edge — even worse.

To support print sales at any reasonable wall size (up to 24×36" or canvas wraps), every piece needs a 4× upscale to ~10752×7168.

**The two ChatGPT pieces are getting handled now (May 2026).** That's not parked.

**The other 19 are parked** until there's an actual store wired up to consume them.

**Beyond upscaling, the store also needs:**
- Decision on hosting model (Stripe checkout vs Shopify embed vs digital-download platform like Gumroad)
- Per-piece pricing strategy
- Print-on-demand fulfillment partnership (or self-fulfill)
- Wallpaper variants (16:9, 9:16) for the free download path
- Legal: licensing terms for downloads, who owns what
- A store frontend page (`/studio/prints` or `/studio/shop`)

---

## When to un-park

Pick this up when one of the following is true:

1. **A specific person asks to buy a print.** That's the strongest signal — there's actual demand. Don't pre-build for hypothetical demand.
2. **Studio gallery has been live + shared for ≥ 1 month** and you're ready for the next iteration.
3. **You finish a piece you specifically want printed for your own home** — the workflow becomes useful for personal use first, commerce second.
4. **You're between bigger projects and want a smaller-scope creative-build** — this is a good ~2-day project that ships something tangible.

---

## The deferred work, captured

When you come back to this, here's what to do — in order.

### Phase 1: Upscale the 19 remaining pieces (~30 min)

Run each piece through Topaz Gigapixel AI in **Art & CG mode** at **4× scale**, sharpening at 10–20%. Output PNG. *NOT* the default Standard mode — Standard is built for photographs and will erase painterly texture (watercolor washes, ink lines, halftone dots).

Also acceptable: Magnific AI (creativity slider 1–2, HDR 0) or Upscayl (Real-ESRGAN model).

Pieces to upscale (current dimensions → target):

```
arlo-and-me           2688×1792 → 10752×7168
arlos-essence         1792×2688 → 7168×10752
aquarium              2464×1856 → 9856×7424
budgies               1792×2688 → 7168×10752
david-attenborough    1792×2688 → 7168×10752
elephant-never-forgets 1792×2688 → 7168×10752
garuda                1792×2688 → 7168×10752
independence-day      2464×1856 → 9856×7424
jane-goodall          1792×2688 → 7168×10752
jellyfish             2688×1792 → 10752×7168
life-is-good          2688×1792 → 10752×7168
madmen                2688×1792 → 10752×7168
monk-and-whale        2688×1792 → 10752×7168
mustang               1856×2464 → 7424×9856
porsche-1979          1792×2688 → 7168×10752
sloth-and-god         2688×1792 → 10752×7168
steve-irwin           1792×2688 → 7168×10752
warplanes             2688×1792 → 10752×7168
you-will-never-walk-alone 2688×1792 → 10752×7168
```

**Critical sanity check before bulk processing:** upscale ONE piece first (suggest Garuda — most painterly, hardest to upscale without losing texture). Compare original vs upscaled at 100% zoom. If watercolor wash gets smoothed, ink lines look digital, or canvas texture is gone — change settings, retry. Don't batch until one test passes.

### Phase 2: Storage layout

Keep originals at current paths. Upscaled masters in a sibling folder:

```
images/studio/                   ← gallery files (current sizes, untouched)
images/studio/_print/            ← 4× upscaled masters
  garuda-print.png               ← ~30MB each
  arlo-and-me-print.png
  ...
```

This keeps the page-weight of `/studio-illustration.html` low (don't load 30MB+ files for the masonry) while the print folder is available for downloads.

### Phase 3: Store decision

Pick one path:

- **Gumroad / Lemon Squeezy** — lowest friction. Each piece gets a product page on their platform. Embed buy buttons or just link out. ~1 hour to set up.
- **Stripe Checkout** — direct integration, more control, more setup. ~half a day.
- **Shopify embed** — if you want the full e-commerce experience (variants, orders, fulfillment integration). ~1 day setup.
- **Print-on-demand passthrough** (Inktale, Society6, Redbubble) — they handle everything, you take a smaller cut. Lowest control, lowest effort.

**Recommended starting point:** Gumroad for digital downloads (free wallpapers + paid hi-res files), and a separate POD service like InPrnt or Society6 for physical prints. Two systems but each does one thing well, and you can wire both into the lightbox via simple links.

### Phase 4: Lightbox download wiring (~30 min)

Add a Download menu to the lightbox showing whatever's available for that piece:

- "Download wallpaper (free)" → links to `images/studio/_wallpaper/<key>-16x9.png` if exists
- "Download print master ($X)" → links to Gumroad / Stripe checkout
- "Buy a physical print" → links to the POD partner

Implementation: a new lightbox section that renders conditionally based on piece-level metadata (`hasPrint: true`, `hasWallpaper: true`, etc.) added to the CC studio-pieces schema.

### Phase 5: Wallpaper variants (per-piece, ~5 min each)

Some pieces translate to 16:9 desktop wallpaper natively, others don't. For each, run a second MJ generation at `--ar 16:9 --quality 2` using the same prompt — the composition adapts. Same for `--ar 9:16` for phone wallpaper.

Only do this for pieces you actually want to offer as wallpapers. Not every piece needs to be a wallpaper.

---

## Things to figure out when un-parking

- **Pricing.** Free wallpapers + $5–15 hi-res download? $30–60 print? $100+ canvas? Look at what comparable artist gallery sites charge.
- **Licensing.** Personal use only? Allow social posting with credit? Strict no-AI-training license? Worth a paragraph on the store page.
- **Tax / business setup.** Are you operating these sales through an LLC, sole prop, or just personal income? Talk to your accountant before launching.
- **Will you offer commissions?** "Get a custom illustration in this style" — separate offering from the print store, but the store visitor is the right audience for that ask.

---

## Related docs

- `docs/Foundation/ToolGuides/studio-image-pipeline.md` — has the complete MJ-prompt + upscaling workflow that this gameplan builds on. Read it first when un-parking.
- `studio-illustration.html` — the current gallery, where the future store layer would attach.
- `command-center/backend/routers/studio_pieces.py` — CMS where per-piece store metadata would live (`hasPrint`, `pricing`, etc.).

---

## Why this is parked

Kiran's gallery just hit a coherent state — 21 pieces, all with personal notes, lightbox UX is solid, CMS is shipped. The right move is to *let it sit* and see what people respond to before adding commerce. Premature monetization risks turning a personal expression into a product before the personal expression has had time to land. Plus building a store before there's demand wastes effort. Wait for signal.

Pick this up later. The work here is captured, the decisions are pre-thought, the workflow is documented. When the moment comes, it should be a half-day of execution, not a re-discovery of strategy.
