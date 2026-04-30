#!/usr/bin/env python3
"""
Wire OG cards into meta tags across all content pages.

For each HTML file:
- Replaces existing og:image and twitter:image with the correct per-content-type card
- Ensures og:image:width and og:image:height meta tags are present
- Preserves existing og:title and og:description (page-specific content)
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE_URL = "https://kiranrao.ai"

# Mapping: filename pattern → og card filename (relative to /images/og/)
# Order matters — first match wins
FILE_MAPPING = [
    # Hub pages (specific to content type)
    ("index.html", "og-homepage.png"),
    ("how-id-built-it.html", "og-teardowns.png"),
    ("blog-podcast.html", "og-blog.png"),
    ("madlab.html", "og-madlab.png"),
    ("studio.html", "og-studio.png"),
    ("skills.html", "og-skills.png"),
    ("learning.html", "og-skills.png"),  # legacy name for skills
    ("testimonials.html", "og-testimonials.png"),
    ("under-the-hood.html", "og-underhood.png"),
    ("track-record.html", "og-career.png"),
    ("career-highlights.html", "og-career.png"),
    ("the-work.html", "og-career.png"),

    # Subdirectory rules
    ("teardowns/", "og-teardowns.png"),
    ("blog/", "og-blog.png"),

    # Other root pages → fallback to homepage
    ("now.html", "og-homepage.png"),
    ("causes.html", "og-homepage.png"),
    ("fit-narrative.html", "og-homepage.png"),
    ("store.html", "og-homepage.png"),
    ("404.html", "og-homepage.png"),
    ("500.html", "og-homepage.png"),
    ("503.html", "og-homepage.png"),
    ("maintenance.html", "og-homepage.png"),
]


def get_og_image_for(file_path: Path) -> str | None:
    """Determine which OG card to use for a given HTML file."""
    rel_path = str(file_path.relative_to(ROOT))
    for pattern, og_image in FILE_MAPPING:
        if pattern.endswith("/") and rel_path.startswith(pattern):
            return og_image
        elif rel_path == pattern:
            return og_image
    return None


def update_og_image_meta(content: str, new_image_url: str, alt_text: str) -> tuple[str, bool]:
    """
    Update or add og:image, og:image:width, og:image:height, og:image:alt,
    and twitter:image meta tags. Returns (new_content, changed).
    """
    changed = False

    # Pattern for og:image meta tag
    og_image_pattern = re.compile(
        r'<meta\s+property=["\']og:image["\']\s+content=["\']([^"\']+)["\']\s*/?>',
        re.IGNORECASE,
    )
    new_og_image = f'<meta property="og:image" content="{new_image_url}">'

    if og_image_pattern.search(content):
        new_content = og_image_pattern.sub(new_og_image, content)
        if new_content != content:
            changed = True
            content = new_content
    else:
        # No og:image yet — insert before closing </head>
        if "</head>" in content:
            content = content.replace("</head>", f"    {new_og_image}\n</head>")
            changed = True

    # Update twitter:image
    twitter_image_pattern = re.compile(
        r'<meta\s+name=["\']twitter:image["\']\s+content=["\']([^"\']+)["\']\s*/?>',
        re.IGNORECASE,
    )
    new_twitter_image = f'<meta name="twitter:image" content="{new_image_url}">'

    if twitter_image_pattern.search(content):
        new_content = twitter_image_pattern.sub(new_twitter_image, content)
        if new_content != content:
            changed = True
            content = new_content

    # Ensure og:image:width, og:image:height, og:image:alt are present
    # We'll add them right after the og:image tag if missing
    additions = []
    if 'property="og:image:width"' not in content and "property='og:image:width'" not in content:
        additions.append('<meta property="og:image:width" content="1200">')
    if 'property="og:image:height"' not in content and "property='og:image:height'" not in content:
        additions.append('<meta property="og:image:height" content="630">')
    if 'property="og:image:alt"' not in content and "property='og:image:alt'" not in content:
        additions.append(f'<meta property="og:image:alt" content="{alt_text}">')

    if additions:
        # Insert additions right after the og:image meta tag
        addition_block = "\n    ".join(additions)
        content = re.sub(
            r'(<meta\s+property=["\']og:image["\']\s+content=["\'][^"\']+["\']\s*/?>)',
            r'\1\n    ' + addition_block,
            content,
            count=1,
        )
        changed = True

    return content, changed


# Alt text per OG card
ALT_TEXTS = {
    "og-homepage.png": "Kiran Rao — Builder of Products People Love. A workshop, not a showroom.",
    "og-teardowns.png": "How I'd've Built It — UX teardowns of popular products on kiranrao.ai",
    "og-blog.png": "Blog — Written word from kiranrao.ai. Product meets prose.",
    "og-madlab.png": "MadLab — Apps and prototypes from kiranrao.ai. From concept to App Store.",
    "og-studio.png": "Studio — Left-brain sandbox on kiranrao.ai. Unrestricted play and goofery.",
    "og-skills.png": "Skills — Range and evidence on kiranrao.ai. Mastered, mapped, proven.",
    "og-testimonials.png": "Testimonials — What people say on kiranrao.ai. From colleagues, founders, leaders.",
    "og-underhood.png": "Under the Hood — How kiranrao.ai was actually built. Architecture and AI-assisted craft.",
    "og-career.png": "The Work — 15+ years of building. Enterprise to startup, the full arc.",
}


def main():
    html_files = list(ROOT.glob("*.html")) + list(ROOT.glob("teardowns/*.html")) + list(ROOT.glob("blog/*.html"))

    print(f"Found {len(html_files)} HTML files\n")

    updated = 0
    skipped = 0

    for f in html_files:
        og_image = get_og_image_for(f)
        if og_image is None:
            print(f"  ⚠ no mapping for {f.relative_to(ROOT)} — skipping")
            skipped += 1
            continue

        new_url = f"{BASE_URL}/images/og/{og_image}"
        alt_text = ALT_TEXTS.get(og_image, "kiranrao.ai")

        try:
            content = f.read_text(encoding="utf-8")
        except Exception as e:
            print(f"  ✗ {f.relative_to(ROOT)} — read error: {e}")
            continue

        new_content, changed = update_og_image_meta(content, new_url, alt_text)

        if changed:
            f.write_text(new_content, encoding="utf-8")
            print(f"  ✓ {f.relative_to(ROOT)} → {og_image}")
            updated += 1
        else:
            print(f"  · {f.relative_to(ROOT)} → {og_image} (no change needed)")

    print(f"\nDone. {updated} updated, {skipped} skipped.")


if __name__ == "__main__":
    main()
