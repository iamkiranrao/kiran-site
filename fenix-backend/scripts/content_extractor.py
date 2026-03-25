"""
Content Extractor — Step 4.1
Crawls all HTML pages in the static site, extracts clean text + metadata.
Outputs structured content objects ready for chunking and embedding.

Usage:
    python scripts/content_extractor.py --site-dir /path/to/kiran-site --index /path/to/fenix-index.json

Outputs JSON to stdout (pipe to file or next pipeline stage).
"""

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, field, asdict
from html.parser import HTMLParser
from pathlib import Path
from typing import Optional


# ──────────────────────────────────────────────
# HTML → Clean Text Extractor
# ──────────────────────────────────────────────

class HTMLTextExtractor(HTMLParser):
    """
    Strips HTML tags and extracts clean, readable text.
    Preserves heading structure as section markers.
    Skips script, style, and hidden elements.
    """

    SKIP_TAGS = {"script", "style", "noscript", "svg", "path", "line", "circle", "rect"}
    HEADING_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6"}
    BLOCK_TAGS = {"p", "div", "section", "article", "li", "blockquote", "figcaption", "td", "th", "dt", "dd"}

    def __init__(self):
        super().__init__()
        self._text_parts: list[str] = []
        self._sections: list[dict] = []
        self._current_section: Optional[str] = None
        self._section_text: list[str] = []
        self._skip_depth = 0
        self._in_heading = False
        self._heading_text = ""
        self._tag_stack: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple]):
        tag = tag.lower()
        self._tag_stack.append(tag)

        if tag in self.SKIP_TAGS:
            self._skip_depth += 1
            return

        if self._skip_depth > 0:
            return

        if tag in self.HEADING_TAGS:
            self._in_heading = True
            self._heading_text = ""

        if tag in self.BLOCK_TAGS or tag == "br":
            self._text_parts.append("\n")
            self._section_text.append("\n")

    def handle_endtag(self, tag: str):
        tag = tag.lower()

        if tag in self.SKIP_TAGS and self._skip_depth > 0:
            self._skip_depth -= 1
            return

        if tag in self.HEADING_TAGS and self._in_heading:
            self._in_heading = False
            heading = self._heading_text.strip()
            if heading:
                # Save previous section
                if self._current_section is not None:
                    section_content = " ".join(self._section_text).strip()
                    section_content = re.sub(r"\s+", " ", section_content)
                    if section_content:
                        self._sections.append({
                            "heading": self._current_section,
                            "text": section_content,
                        })
                self._current_section = heading
                self._section_text = []
                marker = f"\n\n## {heading}\n\n"
                self._text_parts.append(marker)

        if tag in self.BLOCK_TAGS:
            self._text_parts.append("\n")
            self._section_text.append("\n")

        if self._tag_stack and self._tag_stack[-1] == tag:
            self._tag_stack.pop()

    def handle_data(self, data: str):
        if self._skip_depth > 0:
            return

        text = data.strip()
        if not text:
            return

        if self._in_heading:
            self._heading_text += " " + text

        self._text_parts.append(text)
        self._section_text.append(text)

    def get_text(self) -> str:
        """Return full extracted text, cleaned up."""
        raw = " ".join(self._text_parts)
        # Normalize whitespace
        raw = re.sub(r"[ \t]+", " ", raw)
        # Normalize newlines
        raw = re.sub(r"\n{3,}", "\n\n", raw)
        return raw.strip()

    def get_sections(self) -> list[dict]:
        """Return extracted sections with headings."""
        # Flush last section
        if self._current_section is not None:
            section_content = " ".join(self._section_text).strip()
            section_content = re.sub(r"\s+", " ", section_content)
            if section_content:
                self._sections.append({
                    "heading": self._current_section,
                    "text": section_content,
                })
        return self._sections


# ──────────────────────────────────────────────
# Metadata Extractor (from <head> tags)
# ──────────────────────────────────────────────

class MetadataExtractor(HTMLParser):
    """Extracts metadata from <meta> tags, <title>, and JSON-LD."""

    def __init__(self):
        super().__init__()
        self.title = ""
        self.description = ""
        self.og_title = ""
        self.og_description = ""
        self.og_url = ""
        self.og_image = ""
        self.og_type = ""
        self.canonical = ""
        self.json_ld: list[dict] = []
        self._in_title = False
        self._title_text = ""
        self._in_json_ld = False
        self._json_ld_text = ""
        self._in_head = False

    def handle_starttag(self, tag: str, attrs: list[tuple]):
        tag = tag.lower()
        attr_dict = dict(attrs)

        if tag == "head":
            self._in_head = True

        if tag == "title" and self._in_head:
            self._in_title = True
            self._title_text = ""

        if tag == "meta":
            name = attr_dict.get("name", "").lower()
            prop = attr_dict.get("property", "").lower()
            content = attr_dict.get("content", "")

            if name == "description":
                self.description = content
            elif prop == "og:title":
                self.og_title = content
            elif prop == "og:description":
                self.og_description = content
            elif prop == "og:url":
                self.og_url = content
            elif prop == "og:image":
                self.og_image = content
            elif prop == "og:type":
                self.og_type = content
            elif prop == "article:published_time":
                self.published_time = content

        if tag == "link":
            rel = attr_dict.get("rel", "")
            if rel == "canonical":
                self.canonical = attr_dict.get("href", "")

        if tag == "script":
            script_type = attr_dict.get("type", "")
            if script_type == "application/ld+json":
                self._in_json_ld = True
                self._json_ld_text = ""

    def handle_endtag(self, tag: str):
        tag = tag.lower()
        if tag == "head":
            self._in_head = False
        if tag == "title":
            self._in_title = False
            self.title = self._title_text.strip()
        if tag == "script" and self._in_json_ld:
            self._in_json_ld = False
            try:
                self.json_ld.append(json.loads(self._json_ld_text))
            except json.JSONDecodeError:
                pass

    def handle_data(self, data: str):
        if self._in_title:
            self._title_text += data
        if self._in_json_ld:
            self._json_ld_text += data


# ──────────────────────────────────────────────
# Content Object
# ──────────────────────────────────────────────

@dataclass
class ExtractedContent:
    """Structured content object for a single page."""
    id: str                              # Unique ID (from fenix-index or generated)
    url: str                             # Relative URL path
    canonical_url: str                   # Full canonical URL
    title: str                           # Page title
    description: str                     # Meta description
    content_type: str                    # teardown | blog | prototype | hub-page | page
    raw_text: str                        # Full extracted text
    sections: list[dict] = field(default_factory=list)  # Heading + text pairs
    skills: list[str] = field(default_factory=list)
    themes: list[str] = field(default_factory=list)
    industry: str = ""
    company: str = ""
    summary: str = ""                    # From fenix-index.json
    connections: list[dict] = field(default_factory=list)
    og_image: str = ""
    og_type: str = ""
    published_date: str = ""
    word_count: int = 0
    read_time_minutes: int = 0


# ──────────────────────────────────────────────
# Main Extraction Logic
# ──────────────────────────────────────────────

def extract_page(html_path: Path, site_root: Path) -> tuple[dict, str, list[dict]]:
    """Extract metadata and text from a single HTML file."""
    html = html_path.read_text(encoding="utf-8", errors="replace")

    # Extract metadata
    meta = MetadataExtractor()
    meta.feed(html)

    # Extract text
    text_extractor = HTMLTextExtractor()
    text_extractor.feed(html)
    raw_text = text_extractor.get_text()
    sections = text_extractor.get_sections()

    # Build relative URL
    rel_path = html_path.relative_to(site_root)
    url = "/" + str(rel_path)

    metadata = {
        "title": meta.og_title or meta.title,
        "description": meta.og_description or meta.description,
        "url": url,
        "canonical_url": meta.canonical or f"https://kiranrao.ai{url}",
        "og_image": meta.og_image,
        "og_type": meta.og_type,
        "json_ld": meta.json_ld,
        "published_time": getattr(meta, "published_time", ""),
    }

    return metadata, raw_text, sections


def classify_content_type(url: str) -> str:
    """Infer content type from URL path."""
    if "/teardowns/" in url:
        # Hub pages don't have a dash (e.g., geico.html vs geico-mobile-app.html)
        filename = url.split("/")[-1].replace(".html", "")
        if "-" not in filename:
            return "teardown-hub"
        return "teardown"
    elif "/blog/" in url:
        return "blog"
    elif "/prototypes/" in url:
        return "prototype"
    elif url in ("/index.html", "/"):
        return "homepage"
    elif url in ("/madlab.html", "/how-id-built-it.html", "/blog-podcast.html",
                 "/studio.html", "/store.html"):
        return "hub-page"
    else:
        return "page"


def estimate_read_time(word_count: int) -> int:
    """Estimate read time in minutes (average 250 wpm)."""
    return max(1, round(word_count / 250))


def build_content_id(url: str) -> str:
    """Generate a content ID from URL."""
    # /teardowns/geico-mobile-app.html -> geico-mobile-app-teardown
    path = url.strip("/").replace(".html", "")
    parts = path.split("/")
    if len(parts) > 1:
        return "-".join(reversed(parts))
    return parts[0] if parts else "unknown"


def extract_all(site_dir: str, index_path: str) -> list[dict]:
    """
    Main extraction pipeline.
    Crawls all HTML pages, enriches with fenix-index.json metadata.
    """
    site_root = Path(site_dir)
    index_data = {}

    # Load fenix-index.json for enrichment
    if index_path and os.path.exists(index_path):
        with open(index_path) as f:
            index_data = json.load(f)

    # Build lookup from fenix-index content
    index_lookup: dict[str, dict] = {}
    for item in index_data.get("content", []):
        url = item.get("url", "")
        index_lookup[url] = item

    # Also add hub pages
    for hub in index_data.get("hubPages", []):
        url = hub.get("url", "")
        index_lookup[url] = hub

    # Find all HTML files (skip site/ duplicate, preview files, backup files)
    skip_patterns = {"site/", "command-center/", "node_modules/", "venv/",
                     "diagram-preview", "og-card-mockup", "sparkline-preview"}
    html_files = []
    for html_path in site_root.rglob("*.html"):
        rel = str(html_path.relative_to(site_root))
        if any(skip in rel for skip in skip_patterns):
            continue
        if "backup" in rel.lower():
            continue
        html_files.append(html_path)

    results = []

    for html_path in sorted(html_files):
        try:
            metadata, raw_text, sections = extract_page(html_path, site_root)
        except Exception as e:
            print(f"  [WARN] Failed to extract {html_path}: {e}", file=sys.stderr)
            continue

        url = metadata["url"]
        content_type = classify_content_type(url)

        # Skip 404 pages
        if "404" in url:
            continue

        # Enrich from fenix-index.json
        index_entry = index_lookup.get(url, {})

        word_count = len(raw_text.split())

        content = ExtractedContent(
            id=index_entry.get("id", build_content_id(url)),
            url=url,
            canonical_url=metadata["canonical_url"],
            title=metadata["title"],
            description=metadata["description"],
            content_type=index_entry.get("type", content_type),
            raw_text=raw_text,
            sections=sections,
            skills=index_entry.get("skills", []),
            themes=index_entry.get("themes", []),
            industry=index_entry.get("industry", ""),
            company=index_entry.get("company", ""),
            summary=index_entry.get("summary", index_entry.get("description", "")),
            connections=index_entry.get("connections", []),
            og_image=metadata["og_image"],
            og_type=metadata["og_type"],
            published_date=metadata.get("published_time", ""),
            word_count=word_count,
            read_time_minutes=estimate_read_time(word_count),
        )

        results.append(asdict(content))
        print(f"  [OK] {url} — {content_type} — {word_count} words — {len(sections)} sections",
              file=sys.stderr)

    return results


# ──────────────────────────────────────────────
# CLI Entry Point
# ──────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Extract content from static HTML site")
    parser.add_argument("--site-dir", required=True, help="Root directory of the static site")
    parser.add_argument("--index", required=True, help="Path to fenix-index.json")
    parser.add_argument("--output", help="Output JSON file (default: stdout)")
    args = parser.parse_args()

    print(f"\nContent Extractor — Scanning {args.site_dir}\n", file=sys.stderr)

    results = extract_all(args.site_dir, args.index)

    print(f"\n--- Extraction Complete ---", file=sys.stderr)
    print(f"Pages extracted: {len(results)}", file=sys.stderr)
    print(f"Total words: {sum(r['word_count'] for r in results):,}", file=sys.stderr)

    output = {
        "version": "1.0",
        "extracted_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "site": "https://kiranrao.ai",
        "page_count": len(results),
        "pages": results,
    }

    if args.output:
        with open(args.output, "w") as f:
            json.dump(output, f, indent=2)
        print(f"Output written to: {args.output}", file=sys.stderr)
    else:
        json.dump(output, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
