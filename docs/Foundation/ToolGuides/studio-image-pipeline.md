# Studio Image Pipeline

**What it does for you:** Captures the prompt-and-upscale workflow that produces the right-sized files for the Studio Illustration gallery — files that work in the masonry, scale up cleanly to the lightbox, and (when you decide to) print or wallpaper at proper quality. Use this every time you ship a new piece. Read once, paste-suffix forever.

**How to access it:** This guide. CC dashboard → Tool Guides → Studio Image Pipeline.

---

## The two suffixes you actually paste

For 95% of pieces, you only need these two endings on your prompt:

**Landscape:**
```
--ar 3:2 --quality 2
```

**Portrait:**
```
--ar 2:3 --quality 2
```

Aspect ratio flips, quality stays at 2. Generate, pick the winner, then click **Upscale Creative** (not Subtle — Creative re-interprets at full res; Subtle just enlarges). Output lands at ~2688×1792 (landscape) or ~1792×2688 (portrait), which is what every existing piece in the gallery uses.

---

## When to add a wallpaper variant

If a piece is good enough that someone would want to use it as a desktop or phone wallpaper, generate two extra rolls of the *same* prompt with different aspect ratios:

```
--ar 16:9 --quality 2    ← desktop wallpaper (1080p, 1440p, 4K all crop natively)
--ar 9:16 --quality 2    ← phone wallpaper (modern phone aspect)
```

The composition will shift to fit the new shape — sometimes that's a feature (the piece adapts itself), sometimes it breaks the comp. Skip if it doesn't translate.

---

## Upscaling for print and download

MJ outputs cap at ~2688px on the long edge. Good for screens up to ~1440p and prints up to 16×24". For anything bigger — 4K wallpapers, 24×36" prints, archival masters — you have to upscale outside MJ.

**Three upscalers, ranked:**

- **Magnific AI** — best results, ~$40/mo (cancellable). Best for hero pieces you really care about. Reinterprets detail beautifully.
- **Topaz Gigapixel AI** — $80 one-time license. Runs on your Mac. Very good. The right answer for batch upscaling many pieces.
- **Upscayl** — free and open source. Decent. Fine for bulk work or testing.

**The math.** Take a 2688×1792 source through 4× upscaling and you get **10752×7168**. That covers:

- 6K Pro Display XDR wallpaper
- 36×24" prints at 300 DPI
- 24×36" canvas wraps with room to spare
- Any future use case you might think of

10752×7168 is "ship it as the master file" resolution. You won't outgrow it.

---

## File format and naming

Save the upscaled master as PNG (lossless, future-proof). Name it with `-print` suffix if it lives alongside a smaller gallery version:

```
images/studio/garuda.png             ← gallery-size, ~1792×2688
images/studio/garuda-print.png       ← upscaled master, ~7168×10752 (optional)
images/studio/garuda-wp-16x9.png     ← desktop wallpaper variant (optional)
images/studio/garuda-wp-9x16.png     ← phone wallpaper variant (optional)
```

Only the first one is required for the gallery to work. The others exist when you've decided a specific piece deserves that treatment.

---

## When the source comes from ChatGPT (DALL-E)

ChatGPT's image gen caps lower than MJ — usually 1024×1536 or 1536×1024. Two pieces in the gallery (Robin Williams, Jimmy Carter) came from there and ship at ~1500px on the long edge, smaller than the MJ norm. They display fine in the masonry but are slightly soft in the lightbox.

**The fix:** run the ChatGPT source through Magnific or Topaz at 2× or 4× before saving as the gallery master. That brings them up to the MJ-equivalent ~2688×3072 or ~3072×4608. Same key, just bigger file. No HTML changes needed.

For a *better* ChatGPT prompt that produces a more usable starting image:

- **Specify medium and texture explicitly.** "A sepia pen-and-ink editorial portrait illustration of [subject], with detailed cross-hatching, warm tonal washes, the texture of an etched plate" — much closer to what you actually want than "a portrait of [subject]."
- **Force aspect ratio.** "in 3:2 landscape composition" works in DALL-E.
- **Use the iteration loop.** ChatGPT can edit in-conversation: "denser cross-hatching," "warmer sepia," "shift the camera slightly." MJ can't.
- **Hybrid path:** use ChatGPT to *author* the MJ prompt (it follows complex instructions better), then run that prompt in MJ for the actual generation. ChatGPT becomes the prompt-writer, MJ becomes the painter.

---

## Common tasks

**Adding a new piece.** Generate in MJ with the appropriate `--ar X:Y --quality 2` suffix. Click Upscale Creative on the winner. Save the result to `images/studio/<key>.png` with a kebab-case key. Drop into Cowork and it'll get wired in.

**Animating an existing piece.** Take the static through MJ's Animate feature (or a separate tool like Runway / Pika / Kling). Save as a `.gif`. The animated piece gets a paired WebP for the masonry — same pattern as monk-and-whale, jellyfish, and Mad Men. Just drop the gif in `images/studio/` and ask for it to be wired.

**Retroactively upscaling an existing piece.** Take the original `images/studio/<key>.png`, run through Magnific or Topaz at 2× or 4×, save the result back to the same path. Same key, same wiring. Just a bigger source file behind the scenes.

**Batch upscaling everything in the gallery.** Topaz Gigapixel can process a folder. Point it at `images/studio/`, set 4× scale, output to a different folder, then move the upscaled versions back. ~10 minutes for the current 21-piece gallery.

---

## Red flags

- **Generating without `--quality 2`** — output drops to ~1024px base, looks soft in the lightbox even at 2× upscale. Always include the quality flag.
- **Forgetting Upscale Creative** — leaves you at ~1456px instead of ~2688px. Easy to miss. The Upscale Creative button appears after generation is complete; click it on the winning gen.
- **Saving JPG instead of PNG for the gallery master** — JPG compression is fine for thumbnails but the gallery uses PNG so the master stays lossless for future upscales and edits.
- **Using `--quality 4`** — costs more credits, doesn't make the output bigger (it makes the same-sized output more detailed). Skip unless a specific piece really needs it.

---

## How it connects to Command Center

The `studio-pieces` admin module ([dashboard link](http://localhost:3000/dashboard/studio-pieces)) lets you edit the title, date, tools, style, inspired-by, dimensions, and personal note for each piece — but the source images live on the file system at `images/studio/<key>.png`. CC owns the *text*, the file system owns the *files*. To swap an image, replace the file under the same key; everything else carries over.

The site fetches CC overrides on lightbox open via `https://cc.kiranrao.ai/api/studio-pieces/{key}` (public read, auth-gated write). Inline pieceData in `studio-illustration.html` is the offline fallback.
