#!/usr/bin/env python3
"""
Generate OG cards for kiranrao.ai by compositing existing bento hero images
with a cream content card overlay containing eyebrow + title + byline typography.

Outputs 1200x630 PNGs to images/og/
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
from pathlib import Path

# ── PATHS ──────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
IMAGES_DIR = ROOT / "images"
OUTPUT_DIR = IMAGES_DIR / "og"
FONTS_DIR = ROOT / "fonts-temp"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ── DESIGN TOKENS ──────────────────────────────────────
CANVAS_W = 1200
CANVAS_H = 630

CREAM = (240, 230, 216, 255)            # #F0E6D8 — band background
CHARCOAL = (42, 37, 32, 255)            # #2A2520 — title text
CHARCOAL_2 = (74, 66, 57, 255)          # #4A4239 — byline text
MUTED = (138, 126, 112, 255)            # #8A7E70 — byline text (more subdued)
RUST = (176, 93, 60, 255)               # #B05D3C — accent line + eyebrow

# Bottom-band geometry (Vercel-style)
BAND_HEIGHT = 120
BAND_PADDING_X = 60
RUST_LINE_HEIGHT = 4   # thin rust accent at top of band

# Type sizes
EYEBROW_SIZE = 16
TITLE_SIZE = 44
BYLINE_SIZE = 18

# Type spacing
EYEBROW_LETTER_SPACING = 3   # extra px between letters
GAP_EYEBROW_TO_TITLE = 8

# Fonts
FONT_PLAYFAIR = str(FONTS_DIR / "PlayfairDisplay-Bold.ttf")
FONT_INTER_SEMIBOLD = str(FONTS_DIR / "InterSemi.ttf")
FONT_INTER_MEDIUM = str(FONTS_DIR / "InterMed.ttf")
FONT_MONO = str(FONTS_DIR / "SpaceMono-Bold.ttf")

# ── HELPERS ────────────────────────────────────────────
def load_and_crop_to_og(image_path: Path) -> Image.Image:
    """Load image, resize/crop to 1200x630 (1.91:1)."""
    img = Image.open(image_path).convert("RGBA")
    src_w, src_h = img.size
    target_ratio = CANVAS_W / CANVAS_H
    src_ratio = src_w / src_h

    if src_ratio > target_ratio:
        # Source wider than target — crop sides
        new_w = int(src_h * target_ratio)
        offset = (src_w - new_w) // 2
        img = img.crop((offset, 0, offset + new_w, src_h))
    else:
        # Source taller than target — crop top/bottom
        new_h = int(src_w / target_ratio)
        offset_top = int((src_h - new_h) * 0.3)  # bias toward upper portion (preserve character heads)
        img = img.crop((0, offset_top, src_w, offset_top + new_h))

    img = img.resize((CANVAS_W, CANVAS_H), Image.LANCZOS)
    return img


def draw_letter_spaced_text(draw: ImageDraw.ImageDraw, xy, text, font, fill, letter_spacing=0):
    """Draw text with custom letter-spacing (PIL doesn't natively support it)."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        bbox = draw.textbbox((0, 0), ch, font=font)
        char_w = bbox[2] - bbox[0]
        x += char_w + letter_spacing


def measure_letter_spaced_width(draw: ImageDraw.ImageDraw, text, font, letter_spacing=0):
    """Measure total width of letter-spaced text."""
    total = 0
    for ch in text:
        bbox = draw.textbbox((0, 0), ch, font=font)
        total += (bbox[2] - bbox[0]) + letter_spacing
    return total - letter_spacing  # remove trailing


def wrap_text(text: str, font: ImageFont.ImageFont, draw: ImageDraw.ImageDraw, max_width: int):
    """Wrap text to fit within max_width."""
    words = text.split()
    lines = []
    current = []
    for word in words:
        test = " ".join(current + [word])
        bbox = draw.textbbox((0, 0), test, font=font)
        if (bbox[2] - bbox[0]) <= max_width:
            current.append(word)
        else:
            if current:
                lines.append(" ".join(current))
            current = [word]
    if current:
        lines.append(" ".join(current))
    return lines


def draw_rounded_rect(draw, xy, radius, fill):
    """Draw a rounded rectangle."""
    draw.rounded_rectangle(xy, radius=radius, fill=fill)


def render_og_card(
    base_image_filename: str,
    eyebrow: str,
    title: str,
    byline: str,
    output_filename: str,
):
    """Generate a single OG card with bottom band layout (Vercel-style)."""
    base_path = IMAGES_DIR / base_image_filename
    if not base_path.exists():
        print(f"  ⚠ MISSING: {base_path}")
        return False

    # 1. Load + crop base image
    canvas = load_and_crop_to_og(base_path)

    # 2. Load fonts
    eyebrow_font = ImageFont.truetype(FONT_MONO, EYEBROW_SIZE)
    title_font = ImageFont.truetype(FONT_PLAYFAIR, TITLE_SIZE)
    byline_font = ImageFont.truetype(FONT_INTER_MEDIUM, BYLINE_SIZE)

    draw = ImageDraw.Draw(canvas)

    band_y = CANVAS_H - BAND_HEIGHT

    # 3. Draw the cream band at the bottom
    draw.rectangle(
        (0, band_y, CANVAS_W, CANVAS_H),
        fill=CREAM,
    )

    # 4. Draw the thin rust accent line at top of band
    draw.rectangle(
        (0, band_y, CANVAS_W, band_y + RUST_LINE_HEIGHT),
        fill=RUST,
    )

    # 5. Draw left content: eyebrow stacked over title
    eyebrow_upper = eyebrow.upper()

    # Compute total height of the eyebrow+title block, vertically center within band
    eyebrow_h = EYEBROW_SIZE
    title_bbox = draw.textbbox((0, 0), title, font=title_font)
    title_h = title_bbox[3] - title_bbox[1]
    block_h = eyebrow_h + GAP_EYEBROW_TO_TITLE + title_h

    block_top = band_y + (BAND_HEIGHT - block_h) // 2 + 4  # slight nudge for visual center

    # Eyebrow (letter-spaced, rust)
    draw_letter_spaced_text(
        draw,
        (BAND_PADDING_X, block_top),
        eyebrow_upper,
        eyebrow_font,
        RUST,
        letter_spacing=EYEBROW_LETTER_SPACING,
    )

    # Title (Playfair, charcoal)
    title_y = block_top + eyebrow_h + GAP_EYEBROW_TO_TITLE
    draw.text((BAND_PADDING_X, title_y), title, font=title_font, fill=CHARCOAL)

    # 6. Draw right content: byline (kiranrao.ai), right-aligned, vertically centered in band
    byline_bbox = draw.textbbox((0, 0), byline, font=byline_font)
    byline_w = byline_bbox[2] - byline_bbox[0]
    byline_h = byline_bbox[3] - byline_bbox[1]
    byline_x = CANVAS_W - BAND_PADDING_X - byline_w
    byline_y = band_y + (BAND_HEIGHT - byline_h) // 2 + 2

    draw.text((byline_x, byline_y), byline, font=byline_font, fill=MUTED)

    # 7. Save
    output = canvas.convert("RGB")
    output_path = OUTPUT_DIR / output_filename
    output.save(output_path, "PNG", optimize=True)
    print(f"  ✓ {output_filename}")
    return True


# ── OG CARD CONFIG ─────────────────────────────────────
# (base image, eyebrow, title, byline, output filename)
OG_CARDS = [
    {
        "base": "analyst-hero-2-1.png",
        "eyebrow": "Teardowns",
        "title": "How I'd've Built It",
        "byline": "kiranrao.ai",
        "output": "og-teardowns.png",
    },
    {
        "base": "veteran-hero-2-1.png",
        "eyebrow": "15+ Years Building",
        "title": "The Work",
        "byline": "kiranrao.ai",
        "output": "og-career.png",
    },
    {
        "base": "tinkerer-hero-2_1.png",
        "eyebrow": "Apps & Prototypes",
        "title": "MadLab",
        "byline": "kiranrao.ai",
        "output": "og-madlab.png",
    },
    {
        "base": "artist-hero-2_1.png",
        "eyebrow": "Left-Brain Sandbox",
        "title": "Studio",
        "byline": "kiranrao.ai",
        "output": "og-studio.png",
    },
    {
        "base": "blogging-monster2.png",
        "eyebrow": "Written Word",
        "title": "Blog",
        "byline": "kiranrao.ai",
        "output": "og-blog.png",
    },
    {
        "base": "engineer-blog-2_1.png",
        "eyebrow": "Behind the Scene",
        "title": "Under the Hood",
        "byline": "kiranrao.ai",
        "output": "og-underhood.png",
    },
    {
        "base": "connector-wider-3_1.png",
        "eyebrow": "What People Say",
        "title": "Testimonials",
        "byline": "kiranrao.ai",
        "output": "og-testimonials.png",
    },
    {
        "base": "octupus_skills1.png",
        "eyebrow": "Range & Evidence",
        "title": "Skills",
        "byline": "kiranrao.ai",
        "output": "og-skills.png",
    },
    # Homepage — uses the analyst hero as a placeholder; can be customized later
    {
        "base": "analyst-hero-2-1.png",
        "eyebrow": "Builder of Products People Love",
        "title": "Kiran Rao",
        "byline": "kiranrao.ai",
        "output": "og-homepage.png",
    },
]


def main():
    print(f"Generating OG cards → {OUTPUT_DIR}\n")
    success = 0
    for cfg in OG_CARDS:
        if render_og_card(
            base_image_filename=cfg["base"],
            eyebrow=cfg["eyebrow"],
            title=cfg["title"],
            byline=cfg["byline"],
            output_filename=cfg["output"],
        ):
            success += 1
    print(f"\nDone. {success}/{len(OG_CARDS)} cards generated.")


if __name__ == "__main__":
    main()
