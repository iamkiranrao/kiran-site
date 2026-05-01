# MJ Continuation — Site-Related Visual Assets + Fenix Extensions

**Self-contained continuation prompt.** Paste the body of this doc into a fresh Cowork session if needed, or run as-is.

---

## Context (locked, do not re-litigate)

You're continuing the visual-asset production workstream for `kiranrao.ai`. Two parallel tracks in this session:

**Track A — Site-related mid-century editorial (22 generations)**
- Profile banners (3): LinkedIn / X / GitHub
- "What is this site?" handout (1)
- Mood board imagery (8)
- Social media campaign concepts (8-10)

**Track B — Fenix character extensions (7 generations)**
- Sticker pack (4 character poses)
- Watermark mark (1, mid-century treatment)
- T-shirt graphic (1, simplified for print)
- Expression reference sheet (1)

**Visual aesthetics — locked:**

- Track A = **Mid-century editorial** — Saul Bass / Paul Rand / Charley Harper. Restrained sophistication, geometric flat shapes, limited palette.
  - Cream `#F0E6D8` (background dominant), Charcoal `#2A2520` (text/lines), Muted amber `#C8843D` (primary accent), Teal `#4A6E6E` (secondary), Olive `#6B7747` (tertiary), Warm rust `#B05D3C` (hero punctuation)
  - Style ref: save 1-2 Saul Bass posters to Discord, get the URL, use `--sref [URL] --sw 350` on Track A prompts.
- Track B = **Pixar character mascot** — same Fenix character we locked today. The canonical avatar lives at `images/fenix/1fenixavatar1.png`. Use that as `--sref` for Fenix extensions (with the watermark exception — see below).

**CC tracking — every asset already has an inventory row:**

- Generate → drop file into the path shown in the asset spec → click **Detect shipped** in CC at `/dashboard/visual-assets` (or run `python3 command-center/backend/scripts/detect_visual_assets.py --live` from the repo root). Status flips automatically.
- If you decide to skip an asset, flip its status to `parked` from the row in CC.
- If you want to update creative direction or notes mid-flow, just edit the row inline in CC.

**Folder structure:**

```
images/marketing-kit/
  ├── banners/                    ← 3 profile banners
  ├── handout/                    ← 1 handout
  ├── mood-board/                 ← 8 mood images
  └── social-concepts/            ← 8-10 campaign posts

images/fenix/
  ├── 1fenixavatar1.png           ← canonical avatar (sref source)
  ├── stickers/                   ← 4 sticker variants
  ├── fenix-watermark.svg         ← watermark mark
  ├── fenix-tshirt-graphic.png    ← t-shirt print-ready
  └── fenix-expression-sheet.png  ← model sheet
```

**Naming convention:**
- Track A: `[category]-[N]-[descriptor].png` (e.g. `banner-01-linkedin.png`, `mood-03-organic-curves.png`)
- Track B: as listed in each spec below

**Order to run:**
1. Banners first (fastest validation of Track A aesthetic — 3 generations).
2. Handout (single asset, quick).
3. Mood board (8 generations, single focused session).
4. Social campaign concepts (last — riffs on the aesthetic by then).
5. Fenix sticker pack (4 generations).
6. Fenix watermark.
7. Fenix t-shirt graphic.
8. Fenix expression reference sheet.

Drop screenshots to me after the first 3-4 land — we tune the aesthetic before committing the rest.

---

## Universal style suffix — Track A (banners + handout + mood + social)

Append to every Track A prompt:

```
mid-century modern editorial design, Saul Bass and Paul Rand
inspired, geometric flat shapes with restrained sophistication,
limited palette of warm cream background with muted amber teal
olive and charcoal accents, no people no monsters no characters
no logos no actual text, designed for typography to be added
later, professional editorial poster aesthetic
--s 400 --sref [SAUL BASS URL] --sw 350 --v 7
--no clutter messy busy noisy photorealistic
```

---

## TRACK A — SITE-RELATED MID-CENTURY EDITORIAL

### A1. LinkedIn banner (4:1)

```
horizontal mid-century editorial banner composition representing
themes of product craftsmanship strategic design and AI-augmented
building, abstract geometric shapes — circles squares thin
parallel lines arranged with intentional asymmetry, leave clean
negative space in the left third for name and tagline typography
to be added later, [universal style suffix]
--ar 4:1
```

**Output:** `images/marketing-kit/banners/banner-01-linkedin.png`

### A2. Twitter/X banner (3:1)

```
horizontal mid-century editorial banner with bold abstract
geometric composition representing a workshop or studio
environment, simplified shapes — a single large circle balanced
by small rectangles and one strong diagonal line, leave clean
negative space in the center for typography to be added later,
[universal style suffix]
--ar 3:1
```

**Output:** `images/marketing-kit/banners/banner-02-twitter.png`

### A3. GitHub profile banner (2:1)

```
horizontal mid-century editorial banner representing builder
craftsmanship, abstract composition of overlapping geometric
shapes suggesting code blocks tools and grids, restrained design
with strong primary shape and supporting smaller elements, leave
clean negative space for handle typography to be added later,
[universal style suffix]
--ar 2:1
```

**Output:** `images/marketing-kit/banners/banner-03-github.png`

### A4. Handout — "What is this site?" (1:1)

```
mid-century editorial illustration representing a creative
workshop or thoughtful studio space, abstract geometric
composition of a desk window and tools rendered as flat shapes —
no realistic detail, the feeling of a place where deliberate
work happens, single bold focal point with supporting elements,
leave bottom third clean for explanatory typography to be added
later, [universal style suffix]
--ar 1:1
```

**Output:** `images/marketing-kit/handout/handout-01-what-is-this.png`

### A5. Mood board (8 × 1:1) — variation prompt

```
mid-century editorial mood reference image, abstract geometric
composition exploring [VARIATION], single bold idea per image,
restrained Saul Bass / Paul Rand / Charley Harper sensibility,
[universal style suffix]
--ar 1:1
```

Run 8 variations of `[VARIATION]`:

| # | Variation | Output |
|---|---|---|
| 01 | concentric circles with intersecting rectangles | `mood-01-concentric.png` |
| 02 | layered horizon with single floating geometric form | `mood-02-horizon.png` |
| 03 | organic curved shapes balanced against sharp lines | `mood-03-organic.png` |
| 04 | typographic-feeling forms suggesting a single bold letter | `mood-04-typographic.png` |
| 05 | nature abstracted into mid-century shapes (Charley Harper style) | `mood-05-nature.png` |
| 06 | bold diagonal energy with restrained background | `mood-06-diagonal.png` |
| 07 | concentric forms suggesting motion and orbit | `mood-07-orbit.png` |
| 08 | architectural feeling — windows, doorways, frames as pure geometry | `mood-08-architecture.png` |

All output to `images/marketing-kit/mood-board/`.

### A6. Social campaign concepts (8-10 × 1:1) — series prompt

```
mid-century editorial Instagram post composition representing
[CONCEPT] for the launch of kiranrao.ai, square format with
strong typographic space, abstract geometric anchor with
confident negative space, leave designated area clean for
headline typography to be added in Canva, sophisticated
editorial design, [universal style suffix]
--ar 1:1
```

Run 8 variations of `[CONCEPT]`:

| # | Concept | Output |
|---|---|---|
| 01 | "A workshop, not a showroom" — workshop tools rendered abstractly | `social-01-workshop.png` |
| 02 | "The site that hires its own way" — abstract doorway/threshold form | `social-02-doorway.png` |
| 03 | "How I'd've Built It" series teaser — deconstructive geometric | `social-03-teardown.png` |
| 04 | "Built with AI, not just about AI" — circuit/network suggested geometrically | `social-04-ai.png` |
| 05 | "Six lenses, one site" — six variations of one shape in persona accent colors | `social-05-personas.png` |
| 06 | "Permanent home, not a campaign" — house/hearth abstraction | `social-06-home.png` |
| 07 | "The medium is the message" — abstract Marshall McLuhan reference | `social-07-medium.png` |
| 08 | "Reach out — let's talk" — two forms drawn together by single line | `social-08-reach.png` |

All output to `images/marketing-kit/social-concepts/`.

---

## TRACK B — FENIX CHARACTER EXTENSIONS

**For all Track B prompts (except watermark)**: append `--sref [URL of images/fenix/1fenixavatar1.png] --sw 200-250`. This anchors to the canonical Fenix character we locked today.

### B1. Fenix sticker pack — 4 character poses

Single base prompt, run 4 times with different `[POSE]` values:

```
Pixar character animation cartoon mascot phoenix, same Fenix
character as the canonical avatar — oversized expressive head,
big warm friendly eyes, hooked eagle beak, flame plumes on
crest, yellow chest amber shoulders crimson wingtips, the bird
IS the fire. Character cropped tight to a sticker shape with
generous die-cut margin. POSE: [POSE]. Cream background,
clean readable silhouette, designed for vinyl die-cut print.
NO text, NO border, NO logo.
--ar 1:1 --s 500 --v 7
--no realistic eagle, photoreal, dark teal blue green grey body
```

Run 4 variations of `[POSE]`:

| # | Pose | Output |
|---|---|---|
| 01 | confident standing greeting, one wing raised in a friendly wave | `images/fenix/stickers/fenix-sticker-01-greeting.png` |
| 02 | thinking pose with one wing-tip touching chin, head tilted | `images/fenix/stickers/fenix-sticker-02-thinking.png` |
| 03 | celebrating, both wings up, big grin, victorious | `images/fenix/stickers/fenix-sticker-03-celebrating.png` |
| 04 | sleeping curled up peacefully, eyes closed, gentle ember glow | `images/fenix/stickers/fenix-sticker-04-sleeping.png` |

`--sref [canonical avatar] --sw 250` on all 4.

After all 4 land: assemble into a sticker-sheet PDF in Canva for print.

### B2. Fenix watermark mark (1:1) — mid-century treatment

**No canonical Fenix sref here.** This is the brand-mark treatment, not the Pixar character.

```
Mid-century editorial brand mark, Saul Bass and Paul Rand
inspired, single bold geometric phoenix silhouette, flat color
shapes only — 2-3 colors maximum on cream background. The
phoenix is heraldic and iconic, designed to function as a
watermark and logo lockup. Lufthansa crane meets Charley
Harper bird illustrations. Strong negative space, scales from
16px favicon to billboard. NO text, NO painterly shading, NO
character, NO Pixar quality, NO realistic detail. Pure flat
geometric silhouette only.
--ar 1:1 --s 400 --sref [SAUL BASS URL] --sw 350 --v 7
--no painterly photoreal Pixar character cartoon mascot, complex
busy detail, monsters, eagles realistic
```

**Output:** `images/fenix/fenix-watermark.png` (manually convert winning generation to SVG in Figma after).

### B3. Fenix t-shirt graphic (square)

```
Pixar character cartoon mascot phoenix optimized for screen-print
on apparel — same Fenix character as the canonical avatar but
SIMPLIFIED for printing: limited 3-color palette only (warm
yellow, amber orange, deep crimson red), strong bold black or
charcoal outline around all shapes, flat color fields with NO
painterly shading and NO gradients, high-contrast graphic
illustration. Character standing in a confident hero pose with
wings half-raised. Cream background. Designed for DTG or
screen-print on a t-shirt. NO text, NO logo.
--ar 1:1 --s 500 --v 7
--no painterly shading, gradients, photoreal, complex texture,
dark teal blue green grey
```

`--sref [canonical avatar] --sw 200`

**Output:** `images/fenix/fenix-tshirt-graphic.png`. Manually clean up in Illustrator for print.

### B4. Fenix expression reference sheet (16:9)

```
Character model sheet — same Pixar cartoon mascot phoenix
character (the canonical Fenix) shown 5 times in a horizontal row
across a clean cream canvas, each in a different EXPRESSION but
identical character pose (head and upper body framed). Five
expressions left to right: (1) alert curious, (2) thinking with
slight smile, (3) sleeping peacefully eyes closed, (4) surprised
with eyes wide, (5) celebrating with big grin. Same lighting
across all 5. Cream background. NO text labels, NO numbering,
just the 5 expressions in a clean row.
--ar 16:9 --s 500 --v 7
--no text labels, numbering, photoreal, dark scary, dark teal
blue green grey body
```

`--sref [canonical avatar] --sw 250`

**Output:** `images/fenix/fenix-expression-sheet.png`. After it lands, crop into 5 individual expression tiles in Canva — gives you a reaction-image library.

---

## When you finish a batch

1. Drop the file(s) into the path shown in the spec.
2. Open `/dashboard/visual-assets` in CC.
3. Click **Detect shipped** at the top — auto-flips status to shipped for any row whose `output_path` now exists on disk.
4. If a generation drifted off-spec or got parked, click the row's status pill to flip it manually.

**Quick CLI alternative** (if CC frontend isn't running):

```bash
cd ~/Kiran's\ Website/command-center/backend
python3 scripts/detect_visual_assets.py --live
```

`--live` updates the runtime data dir. Without it, only the seed file gets touched.

---

## When all 29 generations land

Reach back out — I'll:
1. Confirm CC inventory shows all rows shipped.
2. Wire any new assets into live site code (sticker pack and watermark probably wire to the brand-kit page if/when that gets built; t-shirt and expression sheet are reference assets).
3. Identify next workstream (likely: marketing-kit case study, manifesto video, hero cinemagraph, or pivot to non-visual work).
