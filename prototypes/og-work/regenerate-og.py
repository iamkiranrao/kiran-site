#!/usr/bin/env python3
"""
Regenerate the two OG cards that need updated titles after the rename:
  og-career.png  : "The Work"  → "Receipts"
  og-skills.png  : "Skills"    → "The Stack"

Strategy: open the existing OG card, sample a patch from a clean region
near the title to get the local background color, paint over the old
title text, then draw the new title in approximately the same font /
size / color / position. The subtitle ("15+ YEARS BUILDING" /
"RANGE & EVIDENCE") and URL stay unchanged.
"""

from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

SRC_DIR = Path(__file__).parent.parent.parent / "images" / "og"
OUT_DIR = Path(__file__).parent  # prototypes/og-work/

# Fonts available in the sandbox
SERIF_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
SERIF_REG  = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
LORA_BOLD  = "/usr/share/fonts/truetype/google-fonts/Lora-Variable.ttf"
PLAYFAIR   = str(Path(__file__).parent / "fonts" / "PlayfairDisplay-Variable.ttf")


def sample_bg_color(img, region):
    """Average pixel color from a region for use as a paint-over color."""
    x0, y0, x1, y1 = region
    crop = img.crop(region).convert("RGB")
    pixels = list(crop.getdata())
    avg = tuple(sum(c) // len(c) for c in zip(*pixels))
    return avg


def regenerate(input_path, output_path, old_title, new_title,
               title_xy, title_size, title_color,
               sample_region, paint_region, font_path):
    """
    Open input PNG, paint over the old title, draw the new title.

    title_xy       : (x, y) baseline-ish position to draw the new title
    title_size     : font size in pt (approximate)
    title_color    : RGB tuple for the new title text
    sample_region  : (x0,y0,x1,y1) area near (but not including) the
                     title to sample a clean background color from
    paint_region   : (x0,y0,x1,y1) bounding box of the old title to
                     paint over before drawing the new title
    font_path      : path to TTF used for the new title
    """
    img = Image.open(input_path).convert("RGB")
    draw = ImageDraw.Draw(img)

    # Sample a background color from a clean nearby region
    bg = sample_bg_color(img, sample_region)
    print(f"  sampled bg color: {bg}")

    # Paint over the old title rectangle
    draw.rectangle(paint_region, fill=bg)

    # Draw the new title — use 'ls' anchor (left-baseline) so the y
    # coordinate is the baseline. Cap height extends ~70% above baseline,
    # descenders ~20% below. Pin baseline so descenders fit within the
    # image edge with breathing room.
    font = ImageFont.truetype(font_path, title_size)
    draw.text(title_xy, new_title, fill=title_color, font=font, anchor="ls")

    img.save(output_path, "PNG", optimize=True)
    print(f"  wrote {output_path}")


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # ------ og-career.png : "The Work" → "Receipts" ------
    # Both OG cards have a CREAM panel at the bottom carrying:
    #   subtitle (orange-red small caps) at y~535-555
    #   title    (dark elegant serif)   at y~565-615
    # Paint region must START BELOW the subtitle so we don't erase it.
    print("Regenerating og-career.png as Receipts...")
    regenerate(
        input_path  = SRC_DIR / "og-career.png",
        output_path = OUT_DIR / "og-career.png",
        old_title   = "The Work",
        new_title   = "Receipts",
        title_xy    = (44, 605),
        title_size  = 56,
        title_color = (30, 25, 20),
        # Sample clean cream from the right side, between subtitle and title
        sample_region = (700, 555, 900, 615),
        # Cover only the OLD title row (do NOT touch subtitle above at y~535-555)
        paint_region  = (38, 562, 360, 625),
        font_path   = LORA_BOLD,
    )

    # ------ og-skills.png : "Skills" → "The Stack" ------
    # Same cream-panel layout. Title is dark, not light.
    print("Regenerating og-skills.png as The Stack...")
    regenerate(
        input_path  = SRC_DIR / "og-skills.png",
        output_path = OUT_DIR / "og-skills.png",
        old_title   = "Skills",
        new_title   = "The Stack",
        title_xy    = (44, 605),
        title_size  = 56,
        title_color = (30, 25, 20),
        sample_region = (700, 555, 900, 615),
        # "The Stack" is wider than "Skills"; paint a wider region
        paint_region  = (38, 562, 380, 625),
        font_path   = LORA_BOLD,
    )

    print("\nDone. Open the prototypes/og-work/ folder to compare.")


if __name__ == "__main__":
    main()
