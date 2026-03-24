"""
OG Card Generator — Step 4.4
Auto-generates Open Graph card images (1200x630px) for every shareable page.

Uses Pillow (no browser dependency) so it works in serverless and CI/CD.
Reads from fenix-index.json to auto-discover content.

Usage:
    python scripts/generate_og_cards.py --index /path/to/fenix-index.json --output /path/to/images/og/ [--font-dir /path/to/fonts/]

Card design:
    - Dark background (#0a0a0a) consistent with site branding
    - Bold title text (readable at ~400px — typical social preview size)
    - Series badge (if applicable)
    - Subtitle/description
    - Author name + domain + read time
    - Series-specific accent colors
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Optional

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Installing Pillow...", file=sys.stderr)
    os.system(f"{sys.executable} -m pip install Pillow --quiet")
    from PIL import Image, ImageDraw, ImageFont


# ──────────────────────────────────────────────
# Card Configuration
# ──────────────────────────────────────────────

CARD_WIDTH = 1200
CARD_HEIGHT = 630

# Colors
BG_COLOR = (10, 10, 10)          # #0a0a0a
TEXT_PRIMARY = (255, 255, 255)    # White
TEXT_SECONDARY = (128, 128, 128)  # #808080
TEXT_MUTED = (96, 96, 96)         # #606060
BADGE_BG = (30, 30, 30)          # Slightly lighter than bg
BADGE_BORDER = (60, 60, 60)
DIVIDER_COLOR = (40, 40, 40)

# Series-specific accent colors
ACCENT_COLORS = {
    "teardown": (99, 102, 241),      # Indigo — analytical
    "blog": (59, 130, 246),           # Blue — informational
    "prototype": (16, 185, 129),      # Green — creative/building
    "hub-page": (168, 85, 247),       # Purple — navigational
    "homepage": (251, 146, 60),       # Orange — warm/welcoming
    "page": (156, 163, 175),          # Gray — neutral
    "case-study": (244, 114, 182),    # Pink — storytelling
}

# Layout constants
PADDING = 60
BADGE_PADDING_X = 14
BADGE_PADDING_Y = 6
TITLE_MAX_WIDTH = CARD_WIDTH - (PADDING * 2) - 40
FOOTER_Y = CARD_HEIGHT - PADDING - 20

# Badge labels by content type
BADGE_LABELS = {
    "teardown": "How I'd've Built It",
    "teardown-hub": None,
    "blog": None,  # Will use tags if available
    "prototype": "MadLab",
    "hub-page": None,
    "homepage": None,
}


# ──────────────────────────────────────────────
# Font Loading
# ──────────────────────────────────────────────

def load_fonts(font_dir: Optional[str] = None) -> dict:
    """
    Load Inter font family. Falls back to system fonts if Inter not available.
    """
    fonts = {}

    # Try to find Inter font
    font_paths = []
    if font_dir:
        font_paths.append(Path(font_dir))
    font_paths.extend([
        Path("/usr/share/fonts/truetype/inter/"),
        Path("/usr/share/fonts/Inter/"),
        Path.home() / ".fonts",
        Path("/System/Library/Fonts/"),
    ])

    inter_bold = None
    inter_regular = None
    inter_medium = None

    for fp in font_paths:
        if not fp.exists():
            continue
        for f in fp.rglob("*.ttf"):
            name = f.name.lower()
            if "inter" in name and "bold" in name and "semi" not in name:
                inter_bold = str(f)
            elif "inter" in name and "regular" in name:
                inter_regular = str(f)
            elif "inter" in name and "medium" in name:
                inter_medium = str(f)

    # Build font dict with sizes
    try:
        if inter_bold:
            fonts["title"] = ImageFont.truetype(inter_bold, 52)
            fonts["title_small"] = ImageFont.truetype(inter_bold, 42)
        else:
            fonts["title"] = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 52)
            fonts["title_small"] = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 42)

        if inter_medium:
            fonts["subtitle"] = ImageFont.truetype(inter_medium, 22)
            fonts["badge"] = ImageFont.truetype(inter_medium, 12)
        else:
            fonts["subtitle"] = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22)
            fonts["badge"] = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)

        if inter_regular:
            fonts["footer"] = ImageFont.truetype(inter_regular, 14)
        else:
            fonts["footer"] = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
    except OSError:
        # Ultimate fallback: default font
        print("  [WARN] No TTF fonts found — using Pillow default", file=sys.stderr)
        fonts["title"] = ImageFont.load_default()
        fonts["title_small"] = ImageFont.load_default()
        fonts["subtitle"] = ImageFont.load_default()
        fonts["badge"] = ImageFont.load_default()
        fonts["footer"] = ImageFont.load_default()

    return fonts


# ──────────────────────────────────────────────
# Text Wrapping
# ──────────────────────────────────────────────

def wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width: int, draw: ImageDraw.Draw) -> list[str]:
    """Word-wrap text to fit within max_width pixels."""
    words = text.split()
    lines = []
    current_line = ""

    for word in words:
        test_line = f"{current_line} {word}".strip()
        bbox = draw.textbbox((0, 0), test_line, font=font)
        text_width = bbox[2] - bbox[0]

        if text_width <= max_width:
            current_line = test_line
        else:
            if current_line:
                lines.append(current_line)
            current_line = word

    if current_line:
        lines.append(current_line)

    return lines


# ──────────────────────────────────────────────
# Card Generation
# ──────────────────────────────────────────────

def generate_card(
    title: str,
    subtitle: Optional[str] = None,
    badge: Optional[str] = None,
    read_time: Optional[str] = None,
    content_type: str = "page",
    accent_color: Optional[tuple] = None,
    fonts: dict = None,
) -> Image.Image:
    """Generate a single OG card image."""

    if fonts is None:
        fonts = load_fonts()

    accent = accent_color or ACCENT_COLORS.get(content_type, ACCENT_COLORS["page"])

    # Create image
    img = Image.new("RGB", (CARD_WIDTH, CARD_HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)

    # Subtle accent stripe at top (3px)
    draw.rectangle([(0, 0), (CARD_WIDTH, 3)], fill=accent)

    # Current Y position for vertical layout
    y = PADDING + 20

    # Badge
    if badge:
        badge_text = badge.upper()
        badge_bbox = draw.textbbox((0, 0), badge_text, font=fonts["badge"])
        badge_w = badge_bbox[2] - badge_bbox[0]
        badge_h = badge_bbox[3] - badge_bbox[1]

        badge_rect_x1 = PADDING
        badge_rect_y1 = y
        badge_rect_x2 = PADDING + badge_w + BADGE_PADDING_X * 2
        badge_rect_y2 = y + badge_h + BADGE_PADDING_Y * 2

        draw.rounded_rectangle(
            [(badge_rect_x1, badge_rect_y1), (badge_rect_x2, badge_rect_y2)],
            radius=4,
            fill=BADGE_BG,
            outline=BADGE_BORDER,
        )
        draw.text(
            (badge_rect_x1 + BADGE_PADDING_X, badge_rect_y1 + BADGE_PADDING_Y),
            badge_text,
            fill=(*accent, 255) if len(accent) == 3 else accent,
            font=fonts["badge"],
        )
        y = badge_rect_y2 + 24

    # Title — use smaller font if title is very long
    title_font = fonts["title"]
    title_lines = wrap_text(title, title_font, TITLE_MAX_WIDTH, draw)
    if len(title_lines) > 3:
        title_font = fonts["title_small"]
        title_lines = wrap_text(title, title_font, TITLE_MAX_WIDTH, draw)

    # Center title vertically in available space
    title_bbox = draw.textbbox((0, 0), "Ay", font=title_font)
    line_height = (title_bbox[3] - title_bbox[1]) + 8

    # Calculate vertical centering
    content_top = y
    footer_top = FOOTER_Y - 40  # Space above footer
    available_height = footer_top - content_top
    total_title_height = len(title_lines) * line_height
    subtitle_height = 40 if subtitle else 0
    total_content = total_title_height + subtitle_height

    # Start title from vertically centered position
    title_y = content_top + max(0, (available_height - total_content) // 2 - 20)

    for line in title_lines[:4]:  # Max 4 lines
        draw.text((PADDING, title_y), line, fill=TEXT_PRIMARY, font=title_font)
        title_y += line_height

    # Subtitle
    if subtitle:
        subtitle_y = title_y + 12
        subtitle_lines = wrap_text(subtitle, fonts["subtitle"], TITLE_MAX_WIDTH, draw)
        sub_bbox = draw.textbbox((0, 0), "Ay", font=fonts["subtitle"])
        sub_line_height = (sub_bbox[3] - sub_bbox[1]) + 4
        for line in subtitle_lines[:2]:  # Max 2 lines
            draw.text((PADDING, subtitle_y), line, fill=TEXT_SECONDARY, font=fonts["subtitle"])
            subtitle_y += sub_line_height

    # Footer divider
    divider_y = FOOTER_Y - 10
    draw.line([(PADDING, divider_y), (CARD_WIDTH - PADDING, divider_y)], fill=DIVIDER_COLOR, width=1)

    # Footer text
    footer_parts = ["Kiran Rao", "  |  ", "kirangorapalli.com"]
    if read_time:
        footer_parts.extend(["  |  ", read_time])

    footer_text = "".join(footer_parts)
    draw.text((PADDING, FOOTER_Y), footer_text, fill=TEXT_MUTED, font=fonts["footer"])

    return img


# ──────────────────────────────────────────────
# Content Discovery from fenix-index.json
# ──────────────────────────────────────────────

def discover_cards(index_path: str) -> list[dict]:
    """
    Read fenix-index.json and generate card specs for every shareable page.
    """
    with open(index_path) as f:
        index = json.load(f)

    cards = []

    # Content pages
    for item in index.get("content", []):
        content_type = item.get("type", "page")
        title = item.get("title", "")
        url = item.get("url", "")

        # Determine badge
        badge = BADGE_LABELS.get(content_type)
        if content_type == "blog":
            tags = item.get("tags", [])
            if tags:
                badge = tags[0].replace("-", " ").title()

        # Determine subtitle
        subtitle = item.get("focusArea") or item.get("summary", "")[:80]
        if subtitle and len(subtitle) > 80:
            subtitle = subtitle[:77] + "..."

        # Determine read time
        read_time = item.get("readTime")

        # Filename from URL
        filename = url.strip("/").replace("/", "-").replace(".html", "") + ".png"
        if filename.startswith("-"):
            filename = filename[1:]

        cards.append({
            "filename": filename,
            "title": title,
            "subtitle": subtitle if subtitle != title else None,
            "badge": badge,
            "content_type": content_type,
            "read_time": read_time,
            "url": url,
        })

    # Hub pages
    for hub in index.get("hubPages", []):
        title = hub.get("title", "")
        url = hub.get("url", "")
        description = hub.get("description", "")

        filename = url.strip("/").replace("/", "-").replace(".html", "") + ".png"
        if filename.startswith("-"):
            filename = filename[1:]
        if filename == ".png":
            filename = "homepage.png"

        cards.append({
            "filename": filename,
            "title": title,
            "subtitle": description if description != title else None,
            "badge": None,
            "content_type": "hub-page" if url != "/index.html" else "homepage",
            "read_time": None,
            "url": url,
        })

    return cards


# ──────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Generate OG card images from fenix-index.json")
    parser.add_argument("--index", required=True, help="Path to fenix-index.json")
    parser.add_argument("--output", required=True, help="Output directory for PNG files")
    parser.add_argument("--font-dir", help="Directory containing Inter font files")
    parser.add_argument("--only", help="Generate only this filename (for testing)")
    args = parser.parse_args()

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\nOG Card Generator", file=sys.stderr)
    print(f"Output: {output_dir}\n", file=sys.stderr)

    # Load fonts once
    fonts = load_fonts(args.font_dir)

    # Discover cards from index
    cards = discover_cards(args.index)
    print(f"Discovered {len(cards)} cards to generate\n", file=sys.stderr)

    generated = 0
    errors = 0

    for card in cards:
        if args.only and card["filename"] != args.only:
            continue

        try:
            img = generate_card(
                title=card["title"],
                subtitle=card.get("subtitle"),
                badge=card.get("badge"),
                read_time=card.get("read_time"),
                content_type=card.get("content_type", "page"),
                fonts=fonts,
            )

            output_path = output_dir / card["filename"]
            img.save(str(output_path), "PNG", optimize=True)
            generated += 1

            # File size
            size_kb = output_path.stat().st_size / 1024
            print(f"  [OK] {card['filename']} ({size_kb:.0f} KB) — {card['title']}", file=sys.stderr)

        except Exception as e:
            errors += 1
            print(f"  [ERR] {card['filename']} — {e}", file=sys.stderr)

    print(f"\n--- Generation Complete ---", file=sys.stderr)
    print(f"Generated: {generated}", file=sys.stderr)
    print(f"Errors: {errors}", file=sys.stderr)
    print(f"Output: {output_dir}", file=sys.stderr)


if __name__ == "__main__":
    main()
