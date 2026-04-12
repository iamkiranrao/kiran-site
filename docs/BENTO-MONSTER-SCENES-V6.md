# Bento Monster Scenes — V6 Prompt Kit

## What Changed from V5

V3 grid reshuffled everything. Four major shifts:

1. **Full-card aspect ratios, not stage areas.** V5 measured only the area above the glass shelf and found everything ultra-wide (3:1+). V6 measures FULL CARD dimensions because the scene IS the card background. This reveals: 4 slots are roughly square (1:1), 1 is tall (3:2), 2 are wide (3:1), 1 is a wide hero (2:1), and 1 is an extreme banner (6:1→generated at 3:1, CSS-cropped).

2. **Persona rotation = multiple aspect ratios per character.** Cards move between grid slots when personas switch. Each character needs illustrations at 2–4 different aspect ratios. Total: **23 prompts** across 9 characters.

3. **Reference-anchored generation.** Prompts alone produce realistic animals, not Monsters Inc-style creatures. Every generation needs: `--sref` (Style References) with the orange blob monster for Pixar/monster DNA, and `--oref` (Omni Reference) with a single animal image at low strength (`--ow 25`) for character-specific silhouette. MJ's Omni Reference only accepts one image.

4. **Clean compositions.** 2–3 hero props per scene, not cluttered workbenches. The glassmorphic text overlay needs breathing room, and small card sizes lose detail to noise.

---

## V3 Grid Dimensions

Grid: 6 columns, max-width 1440px. Column = 230px. Gap = 12px. Row height = 220px.

| Slot | Grid Position | Cols×Rows | Pixel Size | Ratio | MJ --ar | Glass % | Clear Zone |
|------|--------------|-----------|------------|-------|---------|---------|------------|
| HERO | cols 1–4, rows 1–2 | 4×2 | 956×452 | 2.1:1 | `--ar 2:1` | ~38% | Upper 280px |
| TOP-RIGHT | cols 5–6, rows 1–2 | 2×2 | 472×452 | 1.04:1 | `--ar 1:1` | ~31% | Upper 312px |
| WIDE-L | cols 1–3, row 3 | 3×1 | 714×220 | 3.25:1 | `--ar 3:1` | ~45% | Upper 120px |
| WIDE-R | cols 4–6, row 3 | 3×1 | 714×220 | 3.25:1 | `--ar 3:1` | ~45% | Upper 120px |
| TALL | cols 1–3, rows 4–5 | 3×2 | 714×452 | 1.58:1 | `--ar 3:2` | ~33% | Upper 302px |
| CENTER | cols 4–5, rows 4–5 | 2×2 | 472×452 | 1.04:1 | `--ar 1:1` | ~31% | Upper 312px |
| TINY-1 | col 6, row 4 | 1×1 | 230×220 | 1.05:1 | `--ar 1:1` | ~64% | Upper 80px |
| TINY-2 | col 6, row 5 | 1×1 | 230×220 | 1.05:1 | `--ar 1:1` | ~64% | Upper 80px |
| BANNER | cols 1–6, row 6 | 6×1 | 1440×220 | 6.55:1 | `--ar 3:1` * | ~55% | Upper 100px |

\* BANNER: Generate at `--ar 3:1`, position via CSS `object-fit: cover; object-position: top center`.

---

## Reference Image Strategy

### The Problem

Midjourney interprets "owl-like monster" as "photorealistic owl" and "bear-like monster" as "actual bear." Text prompts alone cannot reliably produce the Monsters Inc aesthetic — soft, blobby, fuzzy creatures with exaggerated cartoon proportions. You need visual anchors.

### The Two-Channel Approach

Each character is a HYBRID — animal DNA blended with monster DNA. But Midjourney's Omni Reference only accepts **ONE image**, not multiple. So the two ingredients come through two DIFFERENT channels:

1. **Monster channel → Style References (`--sref`)** — The `sref-pixar-style.jpg` image (orange fuzzy blob monster) anchors the Pixar fur rendering, cartoon eyes, blobby proportions, and creature feel. This goes in the Style References zone for ALL 23 prompts and provides the universal monster DNA.
2. **Animal channel → Omni Reference (`--oref`)** — A single animal image that gives the character its unique silhouette, posture, and recognizable features (owl's round face, bear's stocky build, etc.). This goes in the Omni Reference zone at **very low strength (`--ow 25`)** so MJ takes the animal's form but monster-ifies it through the style reference.

**Why `--ow 25`?** Tested with the Analyst (owl). At default strength, the owl overwhelms the monster aesthetic and you get a photorealistic owl. At `--ow 25`, MJ takes just enough owl DNA — the round face, big eyes, stocky build — and renders it as a fuzzy Monsters Inc creature. The style reference does the heavy lifting for the monster feel.

### Midjourney V7 UI — Three Drop Zones

The MJ web UI has three separate image drop zones. **References are NOT inline in the prompt text.** You type the text prompt in the text box, then drag files into the correct zone:

| Drop Zone | Icon | What to Drop | Weight Param (in prompt text) |
|-----------|------|-------------|-------------------------------|
| **Image Prompts** | 🖼️ "Use the elements of an image" | NOT USED for our workflow. Leave empty. | — |
| **Style References** | 🎨 "Use the style of an image" | `sref-pixar-style.jpg` (same for all 23 prompts) — provides the monster/Pixar aesthetic | `--sw 200` in prompt text |
| **Omni Reference** | 👤 "Use a person's likeness, or an object's form" | **ONE image only** — the per-character animal ingredient file | `--ow 25` in prompt text |

> **Critical MJ limitation:** The Omni Reference zone only accepts ONE image, not multiple. This is why the monster aesthetic comes through Style References instead.

**Workflow per prompt:**
1. Type the text prompt (includes `--sw 200 --ow 25 --ar X:Y --s 250 --v 7 --no ...`)
2. Drop `sref-pixar-style.jpg` into the **Style References** zone
3. Drop the **single animal ingredient file** into the **Omni Reference** zone
4. Generate

### Reference Workflow (Do This First)

**Before generating ANY prompts, collect TWO types of reference images:**

#### 1. Style References zone — `sref-pixar-style.jpg`

**Status: COLLECTED.** The orange fuzzy blob monster from Monsters Inc (movie frame). This single image does double duty: it anchors the Pixar fur rendering, cartoon eye quality, warm cinematic lighting, AND provides the universal monster DNA (blobby proportions, creature feel). Every generation runs through this filter.

> **Drop into:** Style References zone (every prompt).
> **Why not Sulley?** Too recognizable — his blue/purple palette and spot pattern leak into every generation. The orange blob gives the same rendering quality without the identity baggage.

#### 2. Omni Reference zone — Per-Character Animal Ingredients (9 files)

The animal DNA that gives each character its unique silhouette. Drop **alone** into the Omni Reference zone at **`--ow 25`** (very low strength). The style reference monster-ifies whatever animal you put here.

> **Critical:** The animal image CAN be realistic — at `--ow 25`, the style reference overrides the realism completely. A photo of a real owl works great. Tested and confirmed with Analyst-Hero.

| File | What to Google | What to Look For |
|------|---------------|-----------------|
| `oref-animal-owl.jpg` | `owl close up round face big eyes` | Broad round face, huge intense eyes, slightly comical |
| `oref-animal-bear.jpg` | `brown bear standing confident portrait` | Stocky, grounded, warm expression |
| `oref-animal-meerkat.jpg` | `meerkat standing alert` or `lemur long arms` | Lanky, wiry, alert posture, long limbs |
| `oref-animal-chinchilla.jpg` | `chinchilla round soft fluffy` or `pika small round` | Roundest, softest small animal you can find |
| `oref-animal-quokka.jpg` | `quokka happy face` or `golden retriever smiling` | Warmest, friendliest face — radiates approachability |
| `oref-animal-bulldog.jpg` | `bulldog determined face compact` or `wombat sturdy` | Compact, "built like a brick," no-nonsense |
| `oref-animal-fox.jpg` | `fox running lean athletic` or `red panda agile` | Lean, agile, mid-motion or alert posture |
| `oref-animal-bushbaby.jpg` | `bush baby huge eyes` or `tarsier big eyes tiny` | Enormous eyes relative to body — pure wonder |
| `oref-animal-orangutan.jpg` | `orangutan expressive face` or `capuchin animated` | Most expressive face you can find — big brows, mobile mouth |

### Tuning the Blend

**`--ow` is the main dial.** Tested range: 10–100. Sweet spot discovered at **25** for the Analyst (owl).

- If the result looks too much like a real animal → Lower `--ow` (try 10–15) or find a less photorealistic animal image
- If it looks too generic-monster and not enough animal → Raise `--ow` (try 40–60) or find a stronger animal reference
- If the monster aesthetic is weak → The issue is likely `--sw`, not `--ow`. Try raising `--sw` to 300–400

Note: The previously collected monster ingredient files (`oref-monster-soft.jpg`, `oref-monster-sturdy.jpg`, `oref-monster-sulley.jpg`) are no longer needed in the workflow. The style reference handles all monster DNA. Keep them archived in case a future MJ update allows multiple Omni References.

---

## Scene Design Principles

1. **Single integrated scene per image.** Character exists inside their environment. One Midjourney generation = one complete card visual.
2. **Depth via prompt, not post-processing.** Cinematic DOF baked into the generation. No CSS blur on separate layers.
3. **Character in the clear zone.** Face and upper body in the un-frosted upper portion. Lower portion is atmospheric (gets glassmorphed).
4. **Clean compositions. 2–3 hero props max.** Every item in the scene must earn its place. If it doesn't tell the card's story at a glance, remove it. Cluttered scenes create visual noise that fights the glassmorphic text overlay. Empty space is a feature, not a bug.
5. **Environment = atmosphere, not inventory.** A single desk lamp says "workshop." You don't need the lamp AND the tools AND the blueprints AND the beakers. Pick the one or two props that tell the story and let the lighting/mood do the rest.
6. **Warm, moody, Pixar lighting.** Directional key light, soft fill, atmospheric haze. Dark backgrounds that harmonize with card gradients.
7. **Same species family, wildly different body shapes.** Soft fuzzy fur, large expressive cartoon eyes, Monsters Inc rendering. But proportions vary dramatically.
8. **Camera at character level or slightly above.** Eye-level creates intimacy.

---

## Base Style Prompt

Append to every scene prompt (before the reference and aspect ratio parameters):

```
Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, warm moody atmospheric lighting, cinematic depth of field
```

**End every prompt with:**
```
--sw 200 --ow 25 --ar [ratio] --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
```
The reference images are NOT in the prompt text — they go in the UI drop zones. See "Three Drop Zones" above.

Note: `clutter messy busy noisy` added to --no to actively suppress visual noise.

---

## Framing Templates

### HERO Frame (--ar 2:1)
Wide establishing shot. Character 3/4 body, offset to one side. 1–2 environmental props placed with intention. Moderate DOF. Character and scene in upper 62%. Lower 38% is atmospheric dark.

**Prompt prefix:** `wide cinematic scene,`

### SQUARE Frame (--ar 1:1)
Character bust or waist-up, centered or slightly offset. Atmospheric background, 1 contextual prop at most. Shallow DOF. Character fills upper 65–70%. For TINY slots, the same image scales down — character's head peeks above the glass.

**Prompt prefix:** `medium close-up portrait,`

### TALL Frame (--ar 3:2)
Vertical-friendly. Character 3/4 body, offset to one side. One environmental prop grounds the scene. Moderate DOF. Upper 67%.

**Prompt prefix:** `vertical medium shot,`

### WIDE Frame (--ar 3:1)
Ultra-wide panoramic. Character compact — seated or leaning. Occupies one third of frame. Atmosphere and 1–2 props spread across width. Character in upper 50–55%.

**Prompt prefix:** `wide panoramic scene,`

---

## Character Prompts

Each character section includes:
1. **Reference Hunt** — what to Google and how to use the image
2. **Visual identity** — locked character description
3. **Prompts** — all aspect ratio variants, ready to paste (minus the reference URLs which you fill in)

---

### 1. ANALYST — "How I'd've Built It" (Teardowns)

#### Reference Hunt
> **Animal ingredient:** Google `owl close up round face big eyes` or `burrowing owl portrait`. Look for an owl with a broad, round face and huge, intense eyes — the features that carry over into the monster. A slightly comical-looking owl is ideal.
> **Status: COLLECTED & TESTED.** `oref-animal-owl.jpg` at `--ow 25` produces proper monster-owl hybrids with Pixar aesthetic.
#### Drop Zones (all Analyst prompts)
| Zone | File |
|------|------|
| 🎨 Style References | `sref-pixar-style.jpg` |
| 👤 Omni Reference | `oref-animal-owl.jpg` (tested ✓ — works at --ow 25) |

#### Visual Identity
Broad, round-bodied monster with owl-inspired features (big round eyes, small beak). Reading glasses pushed up on forehead. Lab coat. Focused expression — serious but enjoying the work.

#### Scene Props (pick 1–2 per variant)
- Magnifying glass (signature prop)
- A single disassembled circuit board on the desk
- Warm desk lamp

#### Prompts — 4 variants

**ANALYST-HERO (2:1)**
```
wide cinematic scene, a broad round fuzzy monster with owl-like features and reading glasses pushed up on forehead wearing a lab coat, examining a circuit board with a magnifying glass at a clean workbench, single warm desk lamp, character positioned in the right half of the scene, clean dark workshop background, character in upper two-thirds of frame with dark atmospheric desk surface below, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, warm moody atmospheric lighting, cinematic depth of field --sw 200 --ow 25 --ar 2:1 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
```

**ANALYST-SQUARE (1:1)**
```
medium close-up portrait, a broad round fuzzy monster with owl-like features and reading glasses pushed up on forehead wearing a lab coat, holding a magnifying glass up to one eye, focused expression with a hint of enjoyment, soft warm amber light from the side, dark workshop background with soft bokeh, character fills upper two-thirds of frame, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, warm moody atmospheric lighting, shallow depth of field --sw 200 --ow 25 --ar 1:1 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
```

**ANALYST-TALL (3:2)**
```
vertical medium shot, a broad round fuzzy monster with owl-like features and reading glasses pushed up on forehead wearing a lab coat, seated at a workbench examining a circuit board with a magnifying glass, single warm desk lamp illuminating the scene, character positioned in the right half of the frame, clean dark workshop background, character in upper two-thirds of frame, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, warm moody atmospheric lighting, cinematic depth of field --sw 200 --ow 25 --ar 3:2 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
```

**ANALYST-WIDE (3:1)**
```
wide panoramic scene, a broad round fuzzy monster with owl-like features and reading glasses pushed up on forehead wearing a lab coat, hunched over a clean workbench examining something with a magnifying glass, single warm desk lamp casting amber light, character in the center-right third of the scene, dark atmospheric workshop, character in upper half of frame, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, warm moody atmospheric lighting, cinematic depth of field --sw 200 --ow 25 --ar 3:1 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
```

---

### 2. VETERAN — "Career Highlights"

#### Reference Hunt
> **Animal ingredient:** Google `brown bear standing confident portrait` or `grizzly bear warm expression`. Look for a bear with a stocky, grounded presence and a warm, approachable expression. The bear gives the build and the "I've been around" energy.
> **Note:** At `--ow 25`, the bear's stocky build and warm coloring come through while the style reference monster-ifies it. This character should feel the most grounded of the bunch.
#### Drop Zones (all Veteran prompts)
| Zone | File |
|------|------|
| 🎨 Style References | `sref-pixar-style.jpg` |
| 👤 Omni Reference | `oref-animal-bear.jpg` |

#### Visual Identity
Warm orange/brown bear-like blob monster. Weathered blazer with rolled sleeves. Confident but approachable. Sturdy, grounded presence.

#### Scene Props (pick 1–2 per variant)
- Rooftop railing
- Miniature city skyline in the background (soft focus)
- Golden hour light (the "prop" is the lighting itself)

#### Prompts — 4 variants

**VETERAN-HERO (2:1)**
```
wide cinematic scene, a warm fuzzy orange-brown bear-like blob monster in a weathered blazer with rolled sleeves, standing at a rooftop railing overlooking a miniature city skyline at golden hour, character positioned in the right half, quiet confident expression looking outward, clean rooftop with just the railing and sky, character in upper two-thirds of frame, warm sunset backlighting, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, atmospheric golden hour lighting, cinematic depth of field --sw 200 --ow 25 --ar 2:1 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
```

**VETERAN-SQUARE (1:1)**
```
medium close-up portrait, a warm fuzzy orange-brown bear-like blob monster in a weathered blazer with rolled sleeves, leaning on a railing with quiet confident expression, golden hour sunlight catching the fur, blurred city skyline in soft bokeh behind, character fills upper two-thirds of frame, warm sunset side lighting, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, atmospheric golden hour lighting, shallow depth of field --sw 200 --ow 25 --ar 1:1 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
```

**VETERAN-TALL (3:2)**
```
vertical medium shot, a warm fuzzy orange-brown bear-like blob monster in a weathered blazer with rolled sleeves, standing at a rooftop railing overlooking a city at golden hour, 3/4 body visible, character positioned in the right half of frame, quiet pride in the expression, warm sunset backlighting, character in upper two-thirds of frame, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, atmospheric golden hour lighting, cinematic depth of field --sw 200 --ow 25 --ar 3:2 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
```

**VETERAN-WIDE (3:1)**
```
wide panoramic scene, a warm fuzzy orange-brown bear-like blob monster in a weathered blazer with rolled sleeves, leaning on a wide rooftop railing, miniature city skyline spreading across the background in soft bokeh, golden hour light, character in the center-right third, character in upper half of frame, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, atmospheric golden hour lighting, cinematic depth of field --sw 200 --ow 25 --ar 3:1 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
```

---

### 3. TINKERER — "MadLab"

#### Reference Hunt
> **Animal ingredient:** Google `meerkat standing alert` or `lemur long arms curious` or `spider monkey lanky`. Look for a lanky, wiry animal with long limbs and an alert, slightly manic expression. The animal gives the body proportions — tall and thin with long arms.
> **Note:** This character should feel the most kinetic. If the meerkat's lankiness isn't coming through at `--ow 25`, try bumping to `--ow 35–40`.
#### Drop Zones (all Tinkerer prompts)
| Zone | File |
|------|------|
| 🎨 Style References | `sref-pixar-style.jpg` |
| 👤 Omni Reference | `oref-animal-meerkat.jpg` |

#### Visual Identity
Wiry, lanky monster with long arms. Welding goggles pushed up on forehead. Tool belt. Singed fur patches. Tongue sticking out in concentration.

#### Scene Props (pick 1–2 per variant)
- A single glowing contraption (the hero prop — provides the blue-green accent light)
- Sparks (atmospheric, not clutter)
- One beaker or gadget as set dressing

#### Prompts — 3 variants

**TINKERER-HERO (2:1)**
```
wide cinematic scene, a wiry lanky fuzzy monster with welding goggles pushed up and a tool belt, hunched over a single glowing contraption emitting sparks and blue-green light, tongue sticking out in concentration, character positioned in the center-left, clean dark workshop with one shelf of gadgets in soft focus behind, character in upper two-thirds of frame, electric blue-green accent light from contraption with warm amber fill, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, warm moody atmospheric lighting, cinematic depth of field --sw 200 --ow 25 --ar 2:1 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
```

**TINKERER-TALL (3:2)**
```
vertical medium shot, a wiry lanky fuzzy monster with welding goggles pushed up and a tool belt, hunched over a glowing contraption emitting sparks, tongue sticking out in concentration, character positioned in the right half of frame, single blue-green light source from the contraption illuminating the scene, dark workshop background, character in upper two-thirds of frame, warm amber fill light, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, warm moody atmospheric lighting, cinematic depth of field --sw 200 --ow 25 --ar 3:2 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
```

**TINKERER-WIDE (3:1)**
```
wide panoramic scene, a wiry lanky fuzzy monster with welding goggles pushed up and a tool belt, hunched over a glowing contraption at a workbench, sparks flying, one bubbling beaker to the side, character in the right third of the scene, dark atmospheric workshop, character in upper half of frame, electric blue-green accent light with warm amber fill, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, warm moody atmospheric lighting, cinematic depth of field --sw 200 --ow 25 --ar 3:1 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
```

---

### 4. ARTIST — "Studio"

#### Reference Hunt
> **Animal ingredient:** Google `chinchilla round soft fluffy` or `pika small round cute animal` or `baby seal round face`. Look for the roundest, softest small animal you can find. The animal gives the "small, soft, gentle" energy and round body shape.
> **Note:** This character should feel the MOST like a creature and least like an animal. Keep `--ow 25` or even drop to `--ow 15` — you want just a hint of the chinchilla's roundness.
#### Drop Zones (all Artist prompts)
| Zone | File |
|------|------|
| 🎨 Style References | `sref-pixar-style.jpg` |
| 👤 Omni Reference | `oref-animal-chinchilla.jpg` |

#### Visual Identity
Round, soft, smaller monster. Tiny beret. Dreamy expression, mid-brushstroke. Paint-splattered.

#### Scene Props (pick 1–2 per variant)
- A large canvas (the hero prop)
- Paint splatters on the monster itself (character detail, not scene clutter)
- One background instrument (guitar OR camera, not both)

#### Prompts — 3 variants

**ARTIST-HERO (2:1)**
```
wide cinematic scene, a round soft small fuzzy monster wearing a tiny beret, mid-brushstroke painting on a large canvas, paint splattered on the monster's fur, character positioned in the left half, guitar propped against the wall in soft focus behind, clean cozy studio with warm natural window light from the left, character in upper two-thirds of frame, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, warm atmospheric lighting, cinematic depth of field --sw 200 --ow 25 --ar 2:1 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
```

**ARTIST-SQUARE (1:1)**
```
medium close-up portrait, a round soft small fuzzy monster wearing a tiny beret, holding a paint-loaded brush mid-stroke, dreamy expression, paint splattered across fur and beret, edge of a canvas in soft bokeh to one side, character fills upper two-thirds of frame, warm soft natural light from the left, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, warm atmospheric lighting, shallow depth of field --sw 200 --ow 25 --ar 1:1 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
```

**ARTIST-WIDE (3:1)**
```
wide panoramic scene, a round soft small fuzzy monster wearing a tiny beret, mid-brushstroke on a large canvas, paint on the monster's fur, character in the left third of the scene, cozy studio with warm natural light, clean open space, character in upper half of frame, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, warm atmospheric lighting, cinematic depth of field --sw 200 --ow 25 --ar 3:1 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
```

---

### 5. CONNECTOR — "Testimonials"

#### Reference Hunt
> **Animal ingredient:** Google `golden retriever smiling face` or `quokka happy face` or `manatee gentle expression`. Look for the warmest, friendliest animal face you can find — something that radiates approachability and trust. The animal gives the emotional warmth.
> **Note:** This character's design should make people feel safe. The style reference handles the huggable blob shape. Keep `--ow 25` or lower — you want the warmth of the quokka's expression, not its anatomy.
#### Drop Zones (all Connector prompts)
| Zone | File |
|------|------|
| 🎨 Style References | `sref-pixar-style.jpg` |
| 👤 Omni Reference | `oref-animal-quokka.jpg` |

#### Visual Identity
Warm, round, huggable monster. Cozy cardigan. Big genuine smile, bright kind eyes. Soft, inviting features.

#### Scene Props (pick 1 per variant)
- Two coffee cups on a table (signature prop — implies conversation)
- Warm blurred cafe bokeh (atmosphere, not a prop)

#### Prompts — 2 variants

**CONNECTOR-SQUARE (1:1)**
```
medium close-up portrait, a warm round huggable fuzzy monster in a cozy cardigan with a big genuine warm smile, arms slightly open in welcoming gesture, two coffee cups on the table in front, character centered in upper two-thirds of frame, blurred warm cafe background with golden bokeh, intimate conversational mood, warm inviting lighting, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, warm moody atmospheric lighting, shallow depth of field --sw 200 --ow 25 --ar 1:1 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
```

**CONNECTOR-WIDE (3:1)**
```
wide panoramic scene, a warm round huggable fuzzy monster in a cozy cardigan with a big genuine smile, sitting at a cafe table with two coffee cups, arms open in welcoming gesture, empty chair across the table, character in the center-right third, warm cafe with soft golden bokeh background, character in upper half of frame, warm inviting lighting, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, warm atmospheric lighting, cinematic depth of field --sw 200 --ow 25 --ar 3:1 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
```

---

### 6. ENGINEER — "Under the Hood"

#### Reference Hunt
> **Animal ingredient:** Google `bulldog determined face compact` or `wombat sturdy stocky` or `badger compact powerful`. Look for a compact, stocky animal with a "built like a brick" silhouette and a determined expression. The animal gives the sturdy build and no-nonsense energy.
> **Note:** This character should feel dependable and solid. The bulldog's compact build translates well at `--ow 25` — you get the stocky silhouette without the wrinkles.
#### Drop Zones (all Engineer prompts)
| Zone | File |
|------|------|
| 🎨 Style References | `sref-pixar-style.jpg` |
| 👤 Omni Reference | `oref-animal-bulldog.jpg` |

#### Visual Identity
Sturdy, compact monster. Hard hat with headlamp. Utility vest. Determined, focused expression.

#### Scene Props (pick 1–2 per variant)
- A wrench (signature hand prop)
- Glowing circuit board or pipe (one piece of machinery, not a whole engine)
- Headlamp glow (lighting-as-prop)

#### Prompts — 2 variants

**ENGINEER-SQUARE (1:1)**
```
medium close-up portrait, a sturdy compact fuzzy monster wearing a hard hat with glowing headlamp and utility vest, holding a wrench, one glowing circuit board visible nearby, determined focused expression, headlamp casting warm light on the scene, character centered in upper two-thirds of frame, dark mechanical background with cool blue accent glow, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, atmospheric industrial lighting, shallow depth of field --sw 200 --ow 25 --ar 1:1 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
```

**ENGINEER-WIDE (3:1)**
```
wide panoramic scene, a sturdy compact fuzzy monster wearing a hard hat with glowing headlamp and utility vest, reaching into a single large mechanical assembly with a wrench, one glowing circuit board illuminating the scene, character in the center of the scene, dark atmospheric mechanical space, character in upper half of frame, industrial amber light mixed with cool blue accent glow, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, atmospheric industrial lighting, cinematic depth of field --sw 200 --ow 25 --ar 3:1 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
```

---

### 7. EXPLORER — "/Now"

#### Reference Hunt
> **Animal ingredient:** Google `fox running lean athletic` or `meerkat standing lookout alert` or `red panda curious agile`. Look for a lean, agile animal mid-motion or in an alert posture. The animal gives the athletic build and forward-looking energy.
> **Note:** This character should feel like they're always about to go somewhere. The fox's lean build and alert posture come through well at `--ow 25`.
#### Drop Zones (all Explorer prompts)
| Zone | File |
|------|------|
| 🎨 Style References | `sref-pixar-style.jpg` |
| 👤 Omni Reference | `oref-animal-fox.jpg` |

#### Visual Identity
Athletic, lean monster. Small backpack, adventure bandana. Bright-eyed, forward-looking. In-motion energy.

#### Scene Props
- Compass held near chest (signature prop)
- Misty mountain path (atmosphere, not prop)

#### Prompts — 1 variant

**EXPLORER-SQUARE (1:1)**
```
medium close-up portrait, a lean athletic fuzzy monster with bright curious eyes and an adventure bandana, small backpack straps on shoulders, compass held near chest, looking upward and ahead with excitement, misty mountain path in soft bokeh behind, early morning golden light on face, character centered in upper two-thirds of frame, atmospheric misty tones, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, warm atmospheric morning lighting, shallow depth of field --sw 200 --ow 25 --ar 1:1 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
```

---

### 8. STUDENT — "Learning"

#### Reference Hunt
> **Animal ingredient:** Google `bush baby huge eyes` or `tarsier big eyes tiny` or `pygmy slow loris curious`. Look for an animal with ENORMOUS eyes relative to body — the visual shorthand for wonder and curiosity. The animal gives the wide-eyed innocence.
> **Note:** This should feel like the youngest character in the family. The bush baby's enormous eye-to-body ratio is the key feature. Keep `--ow 25` — the style reference adds the horns and fuzzy body automatically.
#### Drop Zones (all Student prompts)
| Zone | File |
|------|------|
| 🎨 Style References | `sref-pixar-style.jpg` |
| 👤 Omni Reference | `oref-animal-bushbaby.jpg` |

#### Visual Identity
Small, curious monster. Huge eyes, tiny horns. Young energy. Deeply absorbed in reading.

#### Scene Props
- A massive open book (signature prop — big relative to the small monster)
- Highlighter tucked behind a horn (character detail)
- Warm reading lamp glow (lighting-as-atmosphere)

#### Prompts — 2 variants

**STUDENT-SQUARE (1:1)**
```
medium close-up portrait, a small curious fuzzy monster with huge round eyes and tiny horns, propped up on elbows looking down at a massive open book with wonder, highlighter tucked behind one horn, warm reading lamp glow from above, character fills upper two-thirds of frame, dark cozy atmosphere with soft warm tones, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, warm cozy lighting, shallow depth of field --sw 200 --ow 25 --ar 1:1 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
```

**STUDENT-TALL (3:2)**
```
vertical medium shot, a small curious fuzzy monster with huge round eyes and tiny horns, lying on belly on a cozy rug propped on elbows reading a massive open book, highlighter in hand, one small stack of books beside, character in the right half of the frame, warm reading lamp glow from above, character in upper two-thirds of frame, cozy studious atmosphere, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, warm cozy lighting, cinematic depth of field --sw 200 --ow 25 --ar 3:2 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
```

---

### 9. STORYTELLER — "Blog & Podcast"

#### Reference Hunt
> **Animal ingredient:** Google `orangutan expressive face` or `capuchin monkey animated expression` or `sea otter playful`. Look for an animal with the most EXPRESSIVE face you can find — big eyebrow ridges, mobile mouth, animated features. The animal gives the "born performer" face.
> **Note:** This character's face should be the most animated and talkative of the group. The orangutan's expressive features (big brows, mobile mouth) are exactly what carries through at `--ow 25`. If the expressiveness isn't strong enough, try `--ow 35`.
#### Drop Zones (all Storyteller prompts)
| Zone | File |
|------|------|
| 🎨 Style References | `sref-pixar-style.jpg` |
| 👤 Omni Reference | `oref-animal-orangutan.jpg` |

#### Visual Identity
Expressive, theatrical monster. Big animated eyebrows. Knit scarf. Big mouth, caught mid-sentence. Animated expression.

#### Scene Props
- A big vintage podcast microphone (the hero prop)
- A coffee mug (one secondary prop, not more)
- Warm ambient soundproofing panels (atmosphere, soft focus)

#### Prompts — 2 variants

**STORYTELLER-HERO (2:1)**
```
wide cinematic scene, an expressive theatrical fuzzy monster with big animated eyebrows and a knit scarf, leaning into a big vintage podcast microphone and gesturing with one hand mid-sentence, coffee mug on the desk, character positioned in the center-left, warm soundproofing panels in soft focus behind, caught mid-thought with animated expression, character in upper two-thirds of frame, warm amber podcast studio lighting, dark intimate background, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, warm intimate lighting, cinematic depth of field --sw 200 --ow 25 --ar 2:1 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
```

**STORYTELLER-WIDE (3:1)**
```
wide panoramic scene, an expressive theatrical fuzzy monster with big animated eyebrows and a knit scarf, leaning into a big vintage podcast microphone and gesturing mid-sentence, coffee mug nearby, character in the left third of the scene, warm ambient podcast studio lighting, dark intimate background, character in upper half of frame, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, warm intimate lighting, cinematic depth of field --sw 200 --ow 25 --ar 3:1 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
```

---

## Persona → Slot Matrix

| Slot | Default | Evaluator | Seeker | Practitioner | Learner | Technologist | Inner Circle |
|------|---------|-----------|--------|-------------|---------|-------------|-------------|
| HERO (2:1) | Teardowns | Career | Career | Teardowns | Blog | MadLab | Studio |
| TALL (3:2) | Career | Teardowns | MadLab | MadLab | Teardowns | Teardowns | MadLab |
| TOP-RIGHT (1:1) | Testimonials | Testimonials | Teardowns | Career | Learning | Studio | Career |
| CENTER (1:1) | Under the Hood | Under the Hood | Testimonials | Under the Hood | Career | Testimonials | Under the Hood |
| WIDE-L (3:1) | Studio | Studio | Studio | Studio | Studio | Under the Hood | Teardowns |
| WIDE-R (3:1) | MadLab | MadLab | Under the Hood | Testimonials | MadLab | Career | Testimonials |
| TINY-1 (1:1) | /Now | /Now | /Now | /Now | /Now | /Now | /Now |
| TINY-2 (1:1) | Learning | Learning | Learning | Learning | Testimonials | Learning | Learning |
| BANNER (3:1) | Blog | Blog | Blog | Blog | Under the Hood | Blog | Blog |

## Default Persona Quick-Reference

| Card | Slot | Prompt |
|------|------|--------|
| Teardowns | HERO (4×2) | ANALYST-HERO |
| Testimonials | TOP-RIGHT (2×2) | CONNECTOR-SQUARE |
| Studio | WIDE-L (3×1) | ARTIST-WIDE |
| MadLab | WIDE-R (3×1) | TINKERER-WIDE |
| Career | TALL (3×2) | VETERAN-TALL |
| Under the Hood | CENTER (2×2) | ENGINEER-SQUARE |
| /Now | TINY-1 (1×1) | EXPLORER-SQUARE |
| Learning | TINY-2 (1×1) | STUDENT-SQUARE |
| Blog & Podcast | BANNER (6×1) | STORYTELLER-WIDE |

---

## Batching Strategy

**Batch 1 — Square portraits (--ar 1:1):** 7 images
ANALYST-SQUARE, VETERAN-SQUARE, ARTIST-SQUARE, CONNECTOR-SQUARE, ENGINEER-SQUARE, EXPLORER-SQUARE, STUDENT-SQUARE

**Batch 2 — Tall shots (--ar 3:2):** 4 images
ANALYST-TALL, VETERAN-TALL, TINKERER-TALL, STUDENT-TALL

**Batch 3 — Wide panoramics (--ar 3:1):** 7 images
ANALYST-WIDE, VETERAN-WIDE, TINKERER-WIDE, ARTIST-WIDE, CONNECTOR-WIDE, ENGINEER-WIDE, STORYTELLER-WIDE

**Batch 4 — Hero shots (--ar 2:1):** 5 images
ANALYST-HERO, VETERAN-HERO, TINKERER-HERO, ARTIST-HERO, STORYTELLER-HERO

**Total: 23 images across 4 batches.**

### Character Consistency Across Ratios

After generating Batch 1 (squares), pick the best result for each character. For subsequent batches, **swap the animal image for the Batch 1 winner** in the Omni Reference zone. This locks the specific face/body that worked.

**Omni Reference zone for Batch 2+ of a character:**
- `analyst-square-winner.jpg` (the best Batch 1 result — save and name it)

**Style References stays the same:** `sref-pixar-style.jpg`

**Bump `--ow` slightly for Batch 2+:** Try `--ow 40–50` (up from 25) since you're now referencing an already-monster-ified image, not a raw animal photo. The style reference still does the heavy lifting.

One Omni Reference image is all MJ allows — make it the best one you've got.

---

## CSS Integration

Each image becomes the card background, replacing the CSS gradient:

```css
.card-teardowns .card-bg {
    background: url('../images/monsters/analyst-hero.webp') center top / cover no-repeat;
    background-color: #2C2825; /* fallback while loading */
}
```

For persona switching, JS swaps the background image based on slot:

```js
const slotImageMap = {
    'teardowns': {
        'hero': 'analyst-hero.webp',
        'square': 'analyst-square.webp',
        'tall': 'analyst-tall.webp',
        'wide': 'analyst-wide.webp'
    }
    // ...per character
};
```

Convert to WebP. Target: under 100KB per image at display size.

---

## Incremental Generation Workflow

**Goal:** Generate 14 remaining desktop images incrementally (one character at a time, grouped by aspect ratio) to replace gradient fallbacks and complete desktop coverage.

### Priority Strategy

**Priority 1: High-Impact Gaps (appear in 2+ personas)** — These 4 images cover 8 persona slots and should be generated first:

| # | Card | Slot | Aspect | Characters | Personas Affected |
|---|------|------|--------|-----------|------------------|
| 1 | **madlab** | tall | 3:2 | Tinkerer (meerkat) | seeker, practitioner, innercircle |
| 2 | **career** | topright | 1:1 | Veteran (bear) | practitioner, innercircle |
| 3 | **teardowns** | tall | 3:2 | Analyst (owl) | evaluator, learner, technologist |
| 4 | **testimonials** | wider | 3:1 | Connector (quokka) | practitioner, innercircle |

**Priority 2: Single-Persona Gaps** — 10 additional images to complete the remaining slots:

| # | Card | Slot | Aspect | Character | Persona |
|---|------|------|--------|-----------|---------|
| 5 | **studio** | hero | 2:1 | Artist (chinchilla) | innercircle |
| 6 | **studio** | topright | 1:1 | Artist (chinchilla) | technologist |
| 7 | **madlab** | hero | 2:1 | Tinkerer (meerkat) | technologist |
| 8 | **career** | center | 1:1 | Veteran (bear) | learner |
| 9 | **career** | wider | 3:1 | Veteran (bear) | technologist |
| 10 | **underhood** | wider | 3:1 | Engineer (bulldog) | seeker |
| 11 | **underhood** | widel | 3:1 | Engineer (bulldog) | technologist |
| 12 | **underhood** | blog | 2:1 | Engineer (bulldog) | learner |
| 13 | **learning** | topright | 1:1 | Student (bush baby) | learner |
| 14 | **teardowns** | widel | 3:1 | Analyst (owl) | innercircle |

**Note:** Items #10 and #11 (underhood wider/widel) are both 3:1 — one image (or a flipped variant) can fill both. Brings actual unique generations to ~13.

### Generation Checklist by Character

#### ANALYST (Owl) — 3 images

**ANALYST-TALL (3:2) — Priority 1, #3**
- **Slot:** tall (in teardowns card)
- **Aspect ratio:** 3:2
- **Prompt:**
  ```
  vertical medium shot, a broad round fuzzy monster with owl-like features and reading glasses pushed up on forehead wearing a lab coat, seated at a workbench examining a circuit board with a magnifying glass, single warm desk lamp illuminating the scene, character positioned in the right half of the frame, clean dark workshop background, character in upper two-thirds of frame, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, warm moody atmospheric lighting, cinematic depth of field --sw 200 --ow 25 --ar 3:2 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
  ```
- **Drop into Style Ref:** `sref-pixar-style.jpg` | **Drop into Omni Ref:** `oref-animal-owl.jpg` (or ANALYST-SQUARE winner if exists)
- **Save as:** `images/analyst-tall-3_2.png`
- **After generating:** Update `imageMap.teardowns.tall` in bento-cards.js

**ANALYST-WIDEL (3:1) — Priority 2, #14**
- **Slot:** widel (in teardowns card)
- **Aspect ratio:** 3:1
- **Prompt:**
  ```
  wide panoramic scene, a broad round fuzzy monster with owl-like features and reading glasses pushed up on forehead wearing a lab coat, hunched over a clean workbench examining something with a magnifying glass, single warm desk lamp casting amber light, character in the center-right third of the scene, dark atmospheric workshop, character in upper half of frame, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, warm moody atmospheric lighting, cinematic depth of field --sw 200 --ow 25 --ar 3:1 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
  ```
- **Drop into Style Ref:** `sref-pixar-style.jpg` | **Drop into Omni Ref:** `oref-animal-owl.jpg` (or ANALYST-SQUARE winner if exists)
- **Save as:** `images/analyst-widel-3_1.png`
- **After generating:** Update `imageMap.teardowns.widel` in bento-cards.js

---

#### VETERAN (Bear) — 3 images

**VETERAN-TOPRIGHT (1:1) — Priority 1, #2**
- **Slot:** topright (in career card)
- **Aspect ratio:** 1:1
- **Prompt:**
  ```
  medium close-up portrait, a warm fuzzy orange-brown bear-like blob monster in a weathered blazer with rolled sleeves, leaning on a railing with quiet confident expression, golden hour sunlight catching the fur, blurred city skyline in soft bokeh behind, character fills upper two-thirds of frame, warm sunset side lighting, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, atmospheric golden hour lighting, shallow depth of field --sw 200 --ow 25 --ar 1:1 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
  ```
- **Drop into Style Ref:** `sref-pixar-style.jpg` | **Drop into Omni Ref:** `oref-animal-bear.jpg`
- **Save as:** `images/veteran-topright-1_1.png`
- **After generating:** Update `imageMap.career.topright` in bento-cards.js

**VETERAN-CENTER (1:1) — Priority 2, #8**
- **Slot:** center (in career card)
- **Aspect ratio:** 1:1
- **Prompt:**
  ```
  medium close-up portrait, a warm fuzzy orange-brown bear-like blob monster in a weathered blazer with rolled sleeves, contemplative expression gazing slightly down, golden hour light catching one side of the face, blurred city skyline in soft bokeh behind, character fills upper two-thirds of frame, warm sunset ambient lighting, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, atmospheric golden hour lighting, shallow depth of field --sw 200 --ow 25 --ar 1:1 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
  ```
- **Drop into Style Ref:** `sref-pixar-style.jpg` | **Drop into Omni Ref:** `oref-animal-bear.jpg` (or VETERAN-TOPRIGHT winner if exists)
- **Save as:** `images/veteran-center-1_1.png`
- **After generating:** Update `imageMap.career.center` in bento-cards.js

**VETERAN-WIDER (3:1) — Priority 2, #9**
- **Slot:** wider (in career card)
- **Aspect ratio:** 3:1
- **Prompt:**
  ```
  wide panoramic scene, a warm fuzzy orange-brown bear-like blob monster in a weathered blazer with rolled sleeves, leaning on a wide rooftop railing, miniature city skyline spreading across the background in soft bokeh, golden hour light, character in the center-right third, character in upper half of frame, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, atmospheric golden hour lighting, cinematic depth of field --sw 200 --ow 25 --ar 3:1 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
  ```
- **Drop into Style Ref:** `sref-pixar-style.jpg` | **Drop into Omni Ref:** `oref-animal-bear.jpg` (or VETERAN-TOPRIGHT winner if exists)
- **Save as:** `images/veteran-wider-3_1.png`
- **After generating:** Update `imageMap.career.wider` in bento-cards.js

---

#### TINKERER (Meerkat) — 2 images

**TINKERER-TALL (3:2) — Priority 1, #1**
- **Slot:** tall (in madlab card)
- **Aspect ratio:** 3:2
- **Prompt:**
  ```
  vertical medium shot, a wiry lanky fuzzy monster with welding goggles pushed up and a tool belt, hunched over a glowing contraption emitting sparks, tongue sticking out in concentration, character positioned in the right half of frame, single blue-green light source from the contraption illuminating the scene, dark workshop background, character in upper two-thirds of frame, warm amber fill light, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, warm moody atmospheric lighting, cinematic depth of field --sw 200 --ow 25 --ar 3:2 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
  ```
- **Drop into Style Ref:** `sref-pixar-style.jpg` | **Drop into Omni Ref:** `oref-animal-meerkat.jpg`
- **Save as:** `images/tinkerer-tall-3_2.png`
- **After generating:** Update `imageMap.madlab.tall` in bento-cards.js

**TINKERER-HERO (2:1) — Priority 2, #7**
- **Slot:** hero (in madlab card)
- **Aspect ratio:** 2:1
- **Prompt:**
  ```
  wide cinematic scene, a wiry lanky fuzzy monster with welding goggles pushed up and a tool belt, hunched over a single glowing contraption emitting sparks and blue-green light, tongue sticking out in concentration, character positioned in the center-left, clean dark workshop with one shelf of gadgets in soft focus behind, character in upper two-thirds of frame, electric blue-green accent light from contraption with warm amber fill, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, warm moody atmospheric lighting, cinematic depth of field --sw 200 --ow 25 --ar 2:1 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
  ```
- **Drop into Style Ref:** `sref-pixar-style.jpg` | **Drop into Omni Ref:** `oref-animal-meerkat.jpg` (or TINKERER-TALL winner if exists, bump --ow to 40-50)
- **Save as:** `images/tinkerer-hero-2_1.png`
- **After generating:** Update `imageMap.madlab.hero` in bento-cards.js

---

#### ARTIST (Chinchilla) — 2 images

**ARTIST-HERO (2:1) — Priority 2, #5**
- **Slot:** hero (in studio card)
- **Aspect ratio:** 2:1
- **Prompt:**
  ```
  wide cinematic scene, a round soft small fuzzy monster wearing a tiny beret, mid-brushstroke painting on a large canvas, paint splattered on the monster's fur, character positioned in the left half, guitar propped against the wall in soft focus behind, clean cozy studio with warm natural window light from the left, character in upper two-thirds of frame, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, warm atmospheric lighting, cinematic depth of field --sw 200 --ow 25 --ar 2:1 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
  ```
- **Drop into Style Ref:** `sref-pixar-style.jpg` | **Drop into Omni Ref:** `oref-animal-chinchilla.jpg`
- **Save as:** `images/artist-hero-2_1.png`
- **After generating:** Update `imageMap.studio.hero` in bento-cards.js

**ARTIST-TOPRIGHT (1:1) — Priority 2, #6**
- **Slot:** topright (in studio card)
- **Aspect ratio:** 1:1
- **Prompt:**
  ```
  medium close-up portrait, a round soft small fuzzy monster wearing a tiny beret, holding a paint-loaded brush mid-stroke, dreamy expression, paint splattered across fur and beret, edge of a canvas in soft bokeh to one side, character fills upper two-thirds of frame, warm soft natural light from the left, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, warm atmospheric lighting, shallow depth of field --sw 200 --ow 25 --ar 1:1 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
  ```
- **Drop into Style Ref:** `sref-pixar-style.jpg` | **Drop into Omni Ref:** `oref-animal-chinchilla.jpg` (or ARTIST-HERO winner if exists, bump --ow to 40-50)
- **Save as:** `images/artist-topright-1_1.png`
- **After generating:** Update `imageMap.studio.topright` in bento-cards.js

---

#### CONNECTOR (Quokka) — 1 image

**CONNECTOR-WIDER (3:1) — Priority 1, #4**
- **Slot:** wider (in testimonials card)
- **Aspect ratio:** 3:1
- **Prompt:**
  ```
  wide panoramic scene, a warm round huggable fuzzy monster in a cozy cardigan with a big genuine smile, sitting at a cafe table with two coffee cups, arms open in welcoming gesture, empty chair across the table, character in the center-right third, warm cafe with soft golden bokeh background, character in upper half of frame, warm inviting lighting, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, warm atmospheric lighting, cinematic depth of field --sw 200 --ow 25 --ar 3:1 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
  ```
- **Drop into Style Ref:** `sref-pixar-style.jpg` | **Drop into Omni Ref:** `oref-animal-quokka.jpg`
- **Save as:** `images/connector-wider-3_1.png`
- **After generating:** Update `imageMap.testimonials.wider` in bento-cards.js

---

#### ENGINEER (Bulldog) — 3 images

**ENGINEER-WIDER (3:1) — Priority 2, #10**
- **Slot:** wider (in underhood card)
- **Aspect ratio:** 3:1
- **Prompt:**
  ```
  wide panoramic scene, a sturdy compact fuzzy monster wearing a hard hat with glowing headlamp and utility vest, reaching into a single large mechanical assembly with a wrench, one glowing circuit board illuminating the scene, character in the center of the scene, dark atmospheric mechanical space, character in upper half of frame, industrial amber light mixed with cool blue accent glow, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, atmospheric industrial lighting, cinematic depth of field --sw 200 --ow 25 --ar 3:1 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
  ```
- **Drop into Style Ref:** `sref-pixar-style.jpg` | **Drop into Omni Ref:** `oref-animal-bulldog.jpg`
- **Save as:** `images/engineer-wider-3_1.png`
- **After generating:** Update `imageMap.underhood.wider` in bento-cards.js

**ENGINEER-WIDEL (3:1) — Priority 2, #11 (CAN REUSE #10)**
- **Slot:** widel (in underhood card)
- **Aspect ratio:** 3:1
- **Option A (recommended):** Use the same image as #10 (engineer-wider-3_1.png)
  - Update `imageMap.underhood.widel` to point to `'images/engineer-wider-3_1.png'`
  - **Saves 1 generation**
- **Option B:** Generate a flipped/mirrored variant of ENGINEER-WIDER
  - Save as: `images/engineer-widel-3_1.png`
  - Update `imageMap.underhood.widel` in bento-cards.js

**ENGINEER-BLOG (2:1) — Priority 2, #12**
- **Slot:** blog (in underhood card)
- **Aspect ratio:** 2:1
- **Prompt:**
  ```
  wide cinematic scene, a sturdy compact fuzzy monster wearing a hard hat with glowing headlamp and utility vest, seated at a desk with documentation and code on multiple monitors, headlamp casting warm light, one glowing circuit board visible on the desk, character in the center-left, technical papers scattered, character in upper two-thirds of frame, dark technical workspace, industrial amber light mixed with cool blue monitor glow, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, atmospheric industrial lighting, cinematic depth of field --sw 200 --ow 25 --ar 2:1 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
  ```
- **Drop into Style Ref:** `sref-pixar-style.jpg` | **Drop into Omni Ref:** `oref-animal-bulldog.jpg` (or ENGINEER-WIDER winner if exists, bump --ow to 40-50)
- **Save as:** `images/engineer-blog-2_1.png`
- **After generating:** Update `imageMap.underhood.blog` in bento-cards.js

---

#### STUDENT (Bush Baby) — 1 image

**STUDENT-TOPRIGHT (1:1) — Priority 2, #13**
- **Slot:** topright (in learning card)
- **Aspect ratio:** 1:1
- **Prompt:**
  ```
  medium close-up portrait, a small curious fuzzy monster with huge round eyes and tiny horns, propped up on elbows looking down at a massive open book with wonder, highlighter tucked behind one horn, warm reading lamp glow from above, character fills upper two-thirds of frame, dark cozy atmosphere with soft warm tones, Pixar 3D animated movie quality, soft fuzzy fur texture, large round expressive cartoon eyes, Monsters Inc quality character rendering, warm cozy lighting, shallow depth of field --sw 200 --ow 25 --ar 1:1 --s 250 --v 7 --no text words letters logo watermark bright white background clutter messy busy noisy
  ```
- **Drop into Style Ref:** `sref-pixar-style.jpg` | **Drop into Omni Ref:** `oref-animal-bushbaby.jpg`
- **Save as:** `images/student-topright-1_1.png`
- **After generating:** Update `imageMap.learning.topright` in bento-cards.js

---

### Batch Efficiency Tips

1. **Group by character:** Do all Analyst images first, then all Veteran, etc. This avoids swapping Omni Reference files back and forth.
2. **Lock the best face early:** After generating the 1:1 (square) for a character, save that result and use it as the Omni Reference for the 2:1 and 3:1 variants of the same character. Bump `--ow` to 40-50 when referencing the previous monster result.
3. **Batch 1 (1:1 portraits):** Generate all 4 Priority 1 characters at 1:1 first (Analyst, Veteran, Connector, Tinkerer). Takes ~4 generations. Saves the cleanest results to use as reference for larger frame variants.
4. **Batch 2 (3:2 tall shots):** Generate Priority 1 tall images (Analyst, Tinkerer), then Priority 2 tall images (Career, Studio). Reuse locked 1:1 results as Omni Refs.
5. **Batch 3 (3:1 wide):** Most variations needed here. Reuse locked 1:1 results. Watch for compositions that feel cramped — use the framing notes in the prompts to position character in the right third/center-right.

### Testing Workflow (After Each Generation)

1. **Download image from MJ** (right-click or download button)
2. **Crop/scale if needed** to fit card pixel dimensions exactly (e.g., TALL is 714×452)
3. **Save to `/images/`** with naming: `[character]-[slot]-[ratio].png`
   - Examples: `analyst-tall-3_2.png`, `veteran-topright-1_1.png`, `connector-wider-3_1.png`
4. **Update `imageMap`** in `bento-cards.js`:
   ```javascript
   imageMap.teardowns.tall = 'images/analyst-tall-3_2.png';
   ```
5. **Verify in browser:**
   - Go to index.html, pick the relevant persona
   - Confirm gradient is replaced by the generated image
   - Check overlay text readability (should be bright against the image)
   - Verify image doesn't bleed into the glassmorphic text overlay at the bottom

### Summary: Total Generations Needed

| Aspect Ratio | Characters | Count | Prompts |
|-------------|-----------|-------|---------|
| 1:1 (square) | Analyst, Veteran, Connector | 3 | ANALYST-TALL, VETERAN-TOPRIGHT, CONNECTOR-WIDER (Priority 1) |
| 3:2 (tall) | Tinkerer (Priority 1) | 1 | TINKERER-TALL |
| 3:1 (wide) | Connector (Priority 1), Engineer (Priority 2) | 2 | CONNECTOR-WIDER (Priority 1), ENGINEER-WIDER (Priority 2) |
| 2:1 (hero) | Tinkerer, Artist, Engineer (Priority 2) | 3 | TINKERER-HERO, ARTIST-HERO, ENGINEER-BLOG |
| 1:1 additional | Analyst, Veteran ×2, Artist, Student | 5 | ANALYST-WIDEL (widens to 3:1), VETERAN-CENTER, VETERAN-WIDER, ARTIST-TOPRIGHT, STUDENT-TOPRIGHT |
| 3:1 additional | Analyst (widel), Engineer widel (optional) | 1–2 | ANALYST-WIDEL, ENGINEER-WIDEL (or reuse ENGINEER-WIDER) |

**Actual unique images if reusing Engineer widel:** ~13 generations vs 14 listed items.

---

*Document updated: April 12, 2026*
*Supersedes: BENTO-MONSTER-SCENES-V5.md*
