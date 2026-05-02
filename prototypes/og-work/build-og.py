#!/usr/bin/env python3
"""
Build the two updated OG cards FROM SCRATCH using the bento source
images plus a clean cream text panel. Avoids the surgical-edit
positioning issues we hit before.

Layout:
  +------------------------------------------+ y=0
  |                                          |
  |          BENTO MONSTER IMAGE             |
  |          (cropped from source)           |
  |                                          |
  +------------------------------------------+ y=510  (image bottom)
  |                                          |
  |  SUBTITLE (orange small-caps tracked)    | y=535-555
  |                            kiranrao.ai   |
  |  Title (Lora large dark serif)           | y=565-625 baseline ~615
  |                                          |
  +------------------------------------------+ y=630  (image bottom)

  Panel = 120px tall, leaves comfortable breathing room around title
"""

from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

# Output dimensions
OG_W, OG_H   = 1200, 630
PANEL_H      = 120                    # taller than original, fits Lora 56 with descender room
IMAGE_H      = OG_H - PANEL_H         # 510

# Colors
CREAM        = (240, 230, 216)
SUBTITLE_COL = (181, 96, 64)          # rust/orange-red — matches original
TITLE_COL    = (30, 24, 20)           # near-black charcoal
URL_COL      = (140, 132, 122)        # mid-gray italic

# Fonts
LORA_VAR     = "/usr/share/fonts/truetype/google-fonts/Lora-Variable.ttf"
LORA_ITALIC  = "/usr/share/fonts/truetype/google-fonts/Lora-Italic-Variable.ttf"

# Paths
ROOT_DIR     = Path("/sessions/beautiful-peaceful-cray/mnt/Kiran's Website")
OUT_DIR      = ROOT_DIR / "prototypes" / "og-work"


def fit_image_into_top(src_path, crop_focus="center"):
    """
    Load a source image, scale to OG width, then crop a 1200×510 strip.
    crop_focus controls vertical positioning of the crop:
      'top'    — keep the top of the image
      'center' — keep the vertical center
      'upper'  — slightly above center (good for portraits where head is high)
    """
    src = Image.open(src_path).convert("RGB")
    scale = OG_W / src.width
    new_h = int(round(src.height * scale))
    scaled = src.resize((OG_W, new_h), Image.LANCZOS)

    if crop_focus == "top":
        y0 = 0
    elif crop_focus == "upper":
        y0 = max(0, (new_h - IMAGE_H) // 3)
    else:  # center
        y0 = max(0, (new_h - IMAGE_H) // 2)
    return scaled.crop((0, y0, OG_W, y0 + IMAGE_H))


def draw_tracked(draw, xy, text, font, fill, tracking_px=2):
    """Draw text with manual letter-spacing (tracking) in pixels."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, fill=fill, font=font)
        bbox = draw.textbbox((x, y), ch, font=font)
        x = bbox[2] + tracking_px
    return x


def build(source_path, subtitle, title, output_path, crop_focus="center"):
    # Build the canvas
    canvas = Image.new("RGB", (OG_W, OG_H), CREAM)

    # Top: source image
    img = fit_image_into_top(source_path, crop_focus=crop_focus)
    canvas.paste(img, (0, 0))

    # Bottom: cream panel is already there from canvas init.
    # Just draw the text on top.
    draw = ImageDraw.Draw(canvas)

    # Subtitle — small uppercase, tracked, orange-red. Lora Bold @ 18.
    sub_font = ImageFont.truetype(LORA_VAR, 18)
    draw_tracked(draw, (44, 543), subtitle.upper(), sub_font, SUBTITLE_COL, tracking_px=3)

    # Title — Lora 56pt, baseline at y=615 (descenders fit, ~15px margin to image bottom)
    title_font = ImageFont.truetype(LORA_VAR, 56)
    draw.text((44, 615), title, fill=TITLE_COL, font=title_font, anchor="ls")

    # URL — italic gray, right-aligned at y=545 baseline
    url_font = ImageFont.truetype(LORA_ITALIC, 16)
    draw.text((OG_W - 32, 555), "kiranrao.ai", fill=URL_COL, font=url_font, anchor="rs")

    canvas.save(output_path, "PNG", optimize=True)
    print(f"  built {output_path}")


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # --- Receipts (was The Work) ---
    print("Building Receipts...")
    build(
        source_path = ROOT_DIR / "images" / "veteran-hero-2-1.png",
        subtitle    = "15+ Years Building",
        title       = "Receipts",
        output_path = OUT_DIR / "og-career.png",
        crop_focus  = "top",
    )

    # --- The Stack (was Skills) ---
    print("Building The Stack...")
    build(
        source_path = ROOT_DIR / "images" / "octupus_skills1.png",
        subtitle    = "Range & Evidence",
        title       = "The Stack",
        output_path = OUT_DIR / "og-skills.png",
        crop_focus  = "upper",
    )


if __name__ == "__main__":
    main()
