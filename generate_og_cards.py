#!/usr/bin/env python3
"""Generate OG card images for kirangorapalli.com"""

import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OG Card</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: 'Inter', sans-serif; background: #0a0a0a; width: 1200px; height: 630px; display: flex; flex-direction: column; justify-content: space-between; padding: 60px; }}
        .container {{ display: flex; flex-direction: column; justify-content: space-between; height: 100%; }}
        .content {{ flex: 1; display: flex; flex-direction: column; justify-content: center; }}
        .badge {{ display: inline-block; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); color: #a0a0a0; padding: 6px 14px; border-radius: 4px; font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 24px; width: fit-content; }}
        .title {{ font-size: 56px; font-weight: 700; line-height: 1.2; color: #ffffff; margin-bottom: 16px; }}
        .subtitle {{ font-size: 24px; font-weight: 400; line-height: 1.4; color: #808080; margin-bottom: 0; }}
        .footer {{ display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 24px; }}
        .meta {{ display: flex; gap: 24px; align-items: center; }}
        .author {{ color: #a0a0a0; font-size: 14px; font-weight: 500; }}
        .domain {{ color: #606060; font-size: 14px; font-weight: 400; }}
        .read-time {{ color: #606060; font-size: 14px; font-weight: 400; }}
        .separator {{ color: #404040; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="content">
            {badge}
            <h1 class="title">{title}</h1>
            {subtitle}
        </div>

        <div class="footer">
            <div class="meta">
                <span class="author">{author}</span>
                <span class="separator">•</span>
                <span class="domain">kirangorapalli.com</span>
                {read_time}
            </div>
        </div>
    </div>
</body>
</html>"""

CARDS = [
    {
        "filename": "blog-demystifying-apple-pay.png",
        "title": "Demystifying Apple Pay",
        "subtitle": "A Payment PM's Guide to What It Actually Takes to Deploy 'Just Tap and Go'",
        "badge": "Demystified Series",
        "author": "Kiran Rao",
        "read_time": "~12 min",
    },
    {
        "filename": "blog-jpmorgan-llm-suite-ai-adoption.png",
        "title": "The Bank That Got 213,000 Employees to Actually Use AI",
        "subtitle": "By Not Calling It AI",
        "badge": "Case Study",
        "author": "Kiran Rao",
        "read_time": "~7 min",
    },
    {
        "filename": "teardown-airbnb.png",
        "title": "Airbnb Teardowns",
        "subtitle": "How I'd've Built It",
        "badge": None,
        "author": "Kiran Rao",
        "read_time": None,
    },
    {
        "filename": "teardown-airbnb-mobile.png",
        "title": "Airbnb Mobile App Teardown",
        "subtitle": "When Trust Breaks Down",
        "badge": "How I'd've Built It",
        "author": "Kiran Rao",
        "read_time": None,
    },
    {
        "filename": "teardown-geico.png",
        "title": "GEICO Teardowns",
        "subtitle": "How I'd've Built It",
        "badge": None,
        "author": "Kiran Rao",
        "read_time": None,
    },
    {
        "filename": "teardown-geico-mobile-app.png",
        "title": "GEICO Mobile App Teardown",
        "subtitle": None,
        "badge": "How I'd've Built It",
        "author": "Kiran Rao",
        "read_time": None,
    },
    {
        "filename": "teardown-meta.png",
        "title": "Meta Teardowns",
        "subtitle": "How I'd've Built It",
        "badge": None,
        "author": "Kiran Rao",
        "read_time": None,
    },
    {
        "filename": "teardown-meta-instagram.png",
        "title": "Instagram Teardown",
        "subtitle": None,
        "badge": "How I'd've Built It",
        "author": "Kiran Rao",
        "read_time": None,
    },
    {
        "filename": "blog-listing.png",
        "title": "Blog & Podcast",
        "subtitle": "Product thinking, demystified",
        "badge": None,
        "author": "Kiran Rao",
        "read_time": None,
    },
    {
        "filename": "teardown-listing.png",
        "title": "How I'd've Built It",
        "subtitle": "Product teardowns that go beyond the surface",
        "badge": None,
        "author": "Kiran Rao",
        "read_time": None,
    },
    {
        "filename": "madlab.png",
        "title": "MadLab",
        "subtitle": "Working prototypes. Real product thinking.",
        "badge": None,
        "author": "Kiran Rao",
        "read_time": None,
    },
    {
        "filename": "studio.png",
        "title": "Studio",
        "subtitle": "Creative experiments and passion projects",
        "badge": None,
        "author": "Kiran Rao",
        "read_time": None,
    },
]


def generate_html(card_data):
    """Generate HTML for a card"""
    badge_html = f'<div class="badge">{card_data["badge"]}</div>' if card_data["badge"] else ""
    subtitle_html = f'<p class="subtitle">{card_data["subtitle"]}</p>' if card_data["subtitle"] else ""

    read_time_html = ""
    if card_data["read_time"]:
        read_time_html = f'<span class="separator">•</span><span class="read-time">{card_data["read_time"]}</span>'

    html = HTML_TEMPLATE.format(
        badge=badge_html,
        title=card_data["title"],
        subtitle=subtitle_html,
        author=card_data["author"],
        read_time=read_time_html,
    )
    return html


async def generate_card(playwright, card_data, output_dir):
    """Generate a single OG card"""
    html = generate_html(card_data)

    async with await playwright.chromium.launch() as browser:
        context = await browser.new_context(viewport={"width": 1200, "height": 630})
        page = await context.new_page()

        # Load the HTML
        await page.set_content(html)

        # Wait for fonts to load
        await page.wait_for_load_state("networkidle")

        # Screenshot
        output_path = output_dir / card_data["filename"]
        await page.screenshot(path=str(output_path), type="png")

        await context.close()

    return str(output_path)


async def main():
    """Generate all OG cards"""
    output_dir = Path("/sessions/tender-youthful-bardeen/mnt/Kiran's Website/images/og")
    output_dir.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as playwright:
        for i, card_data in enumerate(CARDS, 1):
            print(f"[{i}/{len(CARDS)}] Generating {card_data['filename']}...", end=" ", flush=True)
            try:
                result = await generate_card(playwright, card_data, output_dir)
                print(f"✓")
            except Exception as e:
                print(f"✗ Error: {e}")

    print(f"\nAll {len(CARDS)} OG cards generated successfully!")
    print(f"Output directory: {output_dir}")


if __name__ == "__main__":
    asyncio.run(main())
