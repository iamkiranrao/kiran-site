#!/usr/bin/env python3
"""
Generate Receipts samples at multiple Playfair Display weights so we can
visually compare against the original 'The Work' rendering and pick the
match.
"""

from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

OG_CAREER = Path("/sessions/beautiful-peaceful-cray/mnt/Kiran's Website/images/og/og-career.png")
PLAYFAIR  = Path(__file__).parent / "fonts" / "PlayfairDisplay-Variable.ttf"
OUT_DIR   = Path(__file__).parent

# Pillow variable font weight setting via set_variation_by_axes
WEIGHTS = [400, 500, 600, 700, 800, 900]

def render_at_weight(weight):
    img = Image.open(OG_CAREER).convert("RGB")
    draw = ImageDraw.Draw(img)
    # Sample bg color from cream area
    crop = img.crop((700, 555, 900, 615)).convert("RGB")
    pixels = list(crop.getdata())
    bg = tuple(sum(c) // len(c) for c in zip(*pixels))
    # Paint over old title
    draw.rectangle((38, 562, 360, 625), fill=bg)
    # Load font and try setting variation weight
    font = ImageFont.truetype(str(PLAYFAIR), 60)
    try:
        font.set_variation_by_axes([weight])
    except Exception as e:
        print(f"  could not set weight {weight}: {e}")
    draw.text((44, 565), "Receipts", fill=(30, 25, 20), font=font)
    return img

# Render each weight variant — full image
for w in WEIGHTS:
    img = render_at_weight(w)
    out = OUT_DIR / f"weight-test-{w}.png"
    # Crop to just the bottom strip for compact comparison
    crop = img.crop((20, 490, 620, 625))
    crop.save(out, "PNG")
    print(f"  saved {out.name}")

# Also try DejaVu Serif Bold and Liberation Serif Bold for reference
print("\nReference fonts:")
for path, name in [
    ("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf", "dejavu-bold"),
    ("/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf", "liberation-bold"),
    ("/usr/share/fonts/truetype/google-fonts/Lora-Variable.ttf", "lora-default"),
]:
    img = Image.open(OG_CAREER).convert("RGB")
    draw = ImageDraw.Draw(img)
    crop_sample = img.crop((700, 555, 900, 615)).convert("RGB")
    pixels = list(crop_sample.getdata())
    bg = tuple(sum(c) // len(c) for c in zip(*pixels))
    draw.rectangle((38, 562, 360, 625), fill=bg)
    f = ImageFont.truetype(path, 60)
    draw.text((44, 565), "Receipts", fill=(30, 25, 20), font=f)
    out = OUT_DIR / f"weight-test-{name}.png"
    crop = img.crop((20, 490, 620, 625))
    crop.save(out, "PNG")
    print(f"  saved {out.name}")

# Original for reference
img = Image.open(OG_CAREER).convert("RGB")
crop = img.crop((20, 490, 620, 625))
crop.save(OUT_DIR / "weight-test-ORIGINAL.png", "PNG")
print(f"  saved weight-test-ORIGINAL.png (the work)")
