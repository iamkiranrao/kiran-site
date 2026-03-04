"""
Visual Audit Service — Scans all site HTML for VISUAL rule violations.

This service checks for violations from section 7 of CONTENT-RULES.md:
- Em dashes in visible text and HTML source
- SVG :root overrides
- SVG class naming conventions
- SVG text overlap
- Wireframe box sizing
- Journey map bezier curves
- Sentiment label positioning
- Annotation box sizing

This is programmatic only - no Claude API needed.
"""

import os
import re
import json
from typing import Optional
from pathlib import Path


# ── Site root ──────────────────────────────────────────────────────

SITE_ROOT = Path(__file__).resolve().parents[3]  # command-center/backend/services -> site root
RULES_PATH = SITE_ROOT / "CONTENT-RULES.md"

# Files to audit (main content pages + prototypes)
AUDIT_GLOBS = [
    "*.html",
    "teardowns/*.html",
    "prototypes/**/overview.html",
    "prototypes/**/index.html",
]

# Files to skip
SKIP_FILES = {"404.html", "sparkline-preview.html", "index.backup.html"}


def _get_site_files() -> list[dict]:
    """Find all auditable HTML files and return metadata."""
    files = []
    for pattern in AUDIT_GLOBS:
        for path in SITE_ROOT.glob(pattern):
            if path.name in SKIP_FILES:
                continue
            rel = path.relative_to(SITE_ROOT)
            files.append({
                "path": str(path),
                "relative": str(rel),
                "name": path.name,
                "size": path.stat().st_size,
            })
    # Deduplicate by path
    seen = set()
    unique = []
    for f in files:
        if f["path"] not in seen:
            seen.add(f["path"])
            unique.append(f)
    return sorted(unique, key=lambda x: x["relative"])


def _extract_visible_text(html: str) -> str:
    """Strip HTML tags and extract visible text content only."""
    # Remove style and script blocks
    html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL)
    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
    # Remove HTML comments
    html = re.sub(r'<!--.*?-->', '', html, flags=re.DOTALL)
    # Remove tags but keep content
    text = re.sub(r'<[^>]+>', ' ', html)
    # Decode common entities
    text = text.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    text = text.replace('&middot;', '·').replace('&mdash;', '—').replace('&ndash;', '–')
    text = text.replace('&larr;', '←').replace('&rarr;', '→').replace('&copy;', '©')
    text = text.replace('&#8600;', '↘').replace('&#8595;', '↓')
    # Remove HTML numeric entities (emojis etc)
    text = re.sub(r'&#x[0-9a-fA-F]+;', '', text)
    text = re.sub(r'&#[0-9]+;', '', text)
    # Collapse whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def get_visual_rules() -> str:
    """Read and return only section 7 (visual rules) from CONTENT-RULES.md."""
    if not RULES_PATH.exists():
        return "No CONTENT-RULES.md found at site root."

    content = RULES_PATH.read_text()

    # Extract section 9 (starts at "## 9." and ends before "## 10.")
    pattern = r'## 9\..*?(?=## 10\.)'
    match = re.search(pattern, content, re.DOTALL)

    if match:
        return match.group(0)
    return "Section 9 (Visual Rules) not found in CONTENT-RULES.md"


def list_auditable_files() -> list[dict]:
    """Return list of files that can be audited."""
    return _get_site_files()


def _check_em_dashes(html: str, visible_text: str) -> list[dict]:
    """
    Check 1: Em dash detection in both visible text and HTML source.
    Em dashes can appear as:
    - Literal: —
    - HTML entity: &mdash;
    - Numeric entity: &#8212;
    """
    violations = []

    # Check visible text for em dashes (already decoded)
    if '—' in visible_text:
        # Find all instances with context
        lines = visible_text.split()
        for i, line in enumerate(lines):
            if '—' in line:
                # Extract snippet with context
                context_start = max(0, i - 2)
                context_end = min(len(lines), i + 3)
                snippet = ' '.join(lines[context_start:context_end])

                violations.append({
                    "check": "em-dash",
                    "severity": "high",
                    "location": "visible text",
                    "detail": f"Found em dash in visible text: '{snippet}'",
                    "suggestion": "Replace — with - or use --"
                })

    # Check HTML source for em dash entities
    for match in re.finditer(r'&mdash;|&#8212;', html):
        line_num = html[:match.start()].count('\n') + 1
        context_start = max(0, match.start() - 50)
        context_end = min(len(html), match.end() + 50)
        context = html[context_start:context_end].replace('\n', ' ').strip()

        violations.append({
            "check": "em-dash",
            "severity": "high",
            "location": f"line {line_num}",
            "detail": f"Found em dash entity in HTML: ...{context}...",
            "suggestion": "Replace &mdash; with - or use --"
        })

    return violations


def _check_svg_root_override(html: str) -> list[dict]:
    """
    Check 2: SVG :root override detection.
    Looks for :root selectors inside <svg> elements or their <style> blocks.
    This breaks theme toggle functionality site-wide.
    """
    violations = []

    # Find all SVG elements
    svg_pattern = r'<svg[^>]*>.*?</svg>'
    for svg_match in re.finditer(svg_pattern, html, re.DOTALL):
        svg_content = svg_match.group(0)
        svg_start_line = html[:svg_match.start()].count('\n') + 1

        # Check for :root inside this SVG
        if ':root' in svg_content:
            # Find the exact location
            for root_match in re.finditer(r':root', svg_content):
                context_start = max(0, root_match.start() - 40)
                context_end = min(len(svg_content), root_match.end() + 40)
                context = svg_content[context_start:context_end].strip()

                violations.append({
                    "check": "svg-root-override",
                    "severity": "high",
                    "location": f"SVG element near line {svg_start_line}",
                    "detail": f"Found :root override in SVG: {context}",
                    "suggestion": "Remove :root selector and use scoped SVG class names prefixed with wf-"
                })

    return violations


def _check_svg_class_prefix(html: str) -> list[dict]:
    """
    Check 3: SVG class naming conventions.
    All SVG class names must be prefixed with 'wf-' to avoid conflicts
    with page-level CSS.
    """
    violations = []

    # Find all SVG elements
    svg_pattern = r'<svg[^>]*>.*?</svg>'
    for svg_match in re.finditer(svg_pattern, html, re.DOTALL):
        svg_content = svg_match.group(0)
        svg_start_line = html[:svg_match.start()].count('\n') + 1

        # Find all class attributes within this SVG
        class_pattern = r'class=["\']([^"\']+)["\']'
        for class_match in re.finditer(class_pattern, svg_content):
            classes = class_match.group(1).split()

            # Check each class
            for cls in classes:
                # Skip common Bootstrap/utility classes and SVG-specific classes
                skip_classes = {'current-color', 'no-fill', 'opacity-low', 'hidden'}

                # If class doesn't start with 'wf-' and isn't a skip class
                if cls not in skip_classes and not cls.startswith('wf-'):
                    context_start = max(0, class_match.start() - 30)
                    context_end = min(len(svg_content), class_match.end() + 30)
                    context = svg_content[context_start:context_end].strip()

                    violations.append({
                        "check": "svg-class-prefix",
                        "severity": "medium",
                        "location": f"SVG element near line {svg_start_line}",
                        "detail": f"SVG class '{cls}' not prefixed with 'wf-': {context}",
                        "suggestion": f"Rename class '{cls}' to 'wf-{cls}'"
                    })

    return violations


def _check_svg_text_overlap(html: str) -> list[dict]:
    """
    Check 4: SVG text overlap detection.
    Checks for <text> elements that might overlap based on Y-position spacing.
    Minimum 12px vertical spacing required between text lines at same x-position.
    """
    violations = []

    # Find all SVG elements
    svg_pattern = r'<svg[^>]*>.*?</svg>'
    for svg_match in re.finditer(svg_pattern, html, re.DOTALL):
        svg_content = svg_match.group(0)
        svg_start_line = html[:svg_match.start()].count('\n') + 1

        # Find all text elements with y attributes
        text_pattern = r'<text[^>]*x=["\']?([^"\'>\s]+)["\']?[^>]*y=["\']?([^"\'>\s]+)["\']?[^>]*>([^<]*)</text>'

        text_elements = []
        for text_match in re.finditer(text_pattern, svg_content):
            try:
                x = float(text_match.group(1))
                y = float(text_match.group(2))
                content = text_match.group(3)
                text_elements.append({
                    'x': x,
                    'y': y,
                    'content': content,
                    'match': text_match,
                    'position': svg_content[:text_match.start()].count('\n') + svg_start_line
                })
            except (ValueError, AttributeError):
                pass

        # Check for overlaps at same x position
        for i, elem1 in enumerate(text_elements):
            for elem2 in text_elements[i+1:]:
                # Check if at similar x position (within 20px tolerance)
                if abs(elem1['x'] - elem2['x']) < 20:
                    y_spacing = abs(elem1['y'] - elem2['y'])
                    if y_spacing < 12:
                        violations.append({
                            "check": "svg-text-overlap",
                            "severity": "high",
                            "location": f"SVG text elements near line {elem1['position']}",
                            "detail": f"Text '{elem1['content']}' and '{elem2['content']}' at x~{elem1['x']} with only {y_spacing}px vertical spacing (min: 12px)",
                            "suggestion": "Increase vertical spacing between text elements to at least 12px"
                        })

    return violations


def _check_wireframe_sizing(html: str) -> list[dict]:
    """
    Check 5: Wireframe box sizing verification.
    Checks that .wireframe-box has max-width: 340px defined in CSS.
    """
    violations = []

    # Extract all style blocks
    style_pattern = r'<style[^>]*>(.+?)</style>'
    all_styles = []
    for style_match in re.finditer(style_pattern, html, re.DOTALL):
        all_styles.append(style_match.group(1))

    css_content = '\n'.join(all_styles)

    # Check if .wireframe-box exists
    if '.wireframe-box' in css_content:
        # Find the wireframe-box rule
        wireframe_pattern = r'\.wireframe-box\s*\{([^}]+)\}'
        wireframe_match = re.search(wireframe_pattern, css_content)

        if wireframe_match:
            rule_content = wireframe_match.group(1)

            # Check for max-width: 340px
            if 'max-width' not in rule_content or '340px' not in rule_content:
                violations.append({
                    "check": "wireframe-sizing",
                    "severity": "medium",
                    "location": "CSS .wireframe-box rule",
                    "detail": ".wireframe-box exists but doesn't have max-width: 340px",
                    "suggestion": "Add 'max-width: 340px;' to .wireframe-box CSS rule"
                })

    return violations


def _check_journey_map_bezier(html: str) -> list[dict]:
    """
    Check 6: Journey map bezier curve verification.
    Sentiment curves MUST use cubic bezier (C command), not quadratic (Q) or smooth (T).
    """
    violations = []

    # Look for SVG paths (likely journey maps)
    path_pattern = r'<path[^>]*d=["\']([^"\']+)["\'][^>]*>'

    for path_match in re.finditer(path_pattern, html):
        d_attr = path_match.group(1)
        path_line = html[:path_match.start()].count('\n') + 1

        # Check if this might be a sentiment curve (contains circle coordinates or labels)
        # Conservative check: look for paths with Q or T commands
        if re.search(r'\bQ\b', d_attr) or re.search(r'\bT\b', d_attr):
            violations.append({
                "check": "bezier-type",
                "severity": "high",
                "location": f"SVG path near line {path_line}",
                "detail": f"Path uses quadratic bezier (Q or T command). Journey map sentiment curves must use cubic bezier (C command)",
                "suggestion": "Convert path to use cubic bezier C commands instead of Q or T"
            })

    return violations


def _check_label_overlap(html: str) -> list[dict]:
    """
    Check 7: Sentiment label positioning in journey maps.
    Text elements must be at least 6px above circle centers to avoid overlap.
    Position: y = circle_cy - circle_r - 6 - font_size
    """
    violations = []

    # Find all SVG elements that might be journey maps
    svg_pattern = r'<svg[^>]*>.*?</svg>'
    for svg_match in re.finditer(svg_pattern, html, re.DOTALL):
        svg_content = svg_match.group(0)
        svg_start_line = html[:svg_match.start()].count('\n') + 1

        # Find all circles and text elements
        circle_pattern = r'<circle[^>]*cx=["\']?([^"\'>\s]+)["\']?[^>]*cy=["\']?([^"\'>\s]+)["\']?[^>]*r=["\']?([^"\'>\s]+)["\']?'
        text_pattern = r'<text[^>]*x=["\']?([^"\'>\s]+)["\']?[^>]*y=["\']?([^"\'>\s]+)["\']?[^>]*>([^<]*)</text>'

        circles = []
        texts = []

        for circle_match in re.finditer(circle_pattern, svg_content):
            try:
                circles.append({
                    'cx': float(circle_match.group(1)),
                    'cy': float(circle_match.group(2)),
                    'r': float(circle_match.group(3))
                })
            except ValueError:
                pass

        for text_match in re.finditer(text_pattern, svg_content):
            try:
                texts.append({
                    'x': float(text_match.group(1)),
                    'y': float(text_match.group(2)),
                    'content': text_match.group(3),
                    'position': svg_content[:text_match.start()].count('\n') + svg_start_line
                })
            except ValueError:
                pass

        # Check if any text is too close to circles
        for text in texts:
            for circle in circles:
                # Text should be 6px above circle top
                min_y = circle['cy'] - circle['r'] - 6

                # If text y is below this threshold, it's too close
                if text['y'] > min_y:
                    distance = min_y - text['y']
                    violations.append({
                        "check": "label-overlap",
                        "severity": "medium",
                        "location": f"Journey map near line {text['position']}",
                        "detail": f"Label '{text['content']}' at y={text['y']} overlaps circle at cy={circle['cy']}, r={circle['r']}. Need 6px clearance.",
                        "suggestion": f"Move text '{text['content']}' up to y={min_y} or higher"
                    })

    return violations


def _check_annotation_sizing(html: str) -> list[dict]:
    """
    Check 8: Annotation/callout box sizing.
    Rect elements must have enough padding around text content.
    Expected: text_width + 20px horizontal padding, 16px vertical padding.
    """
    violations = []

    # Find all SVG elements
    svg_pattern = r'<svg[^>]*>.*?</svg>'
    for svg_match in re.finditer(svg_pattern, html, re.DOTALL):
        svg_content = svg_match.group(0)
        svg_start_line = html[:svg_match.start()].count('\n') + 1

        # Find all rect elements (potential annotation boxes)
        rect_pattern = r'<rect[^>]*x=["\']?([^"\'>\s]+)["\']?[^>]*y=["\']?([^"\'>\s]+)["\']?[^>]*width=["\']?([^"\'>\s]+)["\']?[^>]*height=["\']?([^"\'>\s]+)["\']?'

        rects = []
        for rect_match in re.finditer(rect_pattern, svg_content):
            try:
                rects.append({
                    'x': float(rect_match.group(1)),
                    'y': float(rect_match.group(2)),
                    'width': float(rect_match.group(3)),
                    'height': float(rect_match.group(4)),
                    'position': svg_content[:rect_match.start()].count('\n') + svg_start_line
                })
            except ValueError:
                pass

        # Find all text elements
        text_pattern = r'<text[^>]*x=["\']?([^"\'>\s]+)["\']?[^>]*y=["\']?([^"\'>\s]+)["\']?[^>]*>([^<]*)</text>'

        texts = []
        for text_match in re.finditer(text_pattern, svg_content):
            try:
                texts.append({
                    'x': float(text_match.group(1)),
                    'y': float(text_match.group(2)),
                    'content': text_match.group(3),
                    'position': svg_content[:text_match.start()].count('\n') + svg_start_line
                })
            except ValueError:
                pass

        # Check if text is properly contained in rects with padding
        for text in texts:
            # Estimate text width (rough: 6px per character at standard font)
            text_width = len(text['content']) * 6
            # Expected padding: 10px each side = 20px total
            min_rect_width = text_width + 20

            for rect in rects:
                # Check if text might be in this rect (overlapping x range)
                if (rect['x'] <= text['x'] <= rect['x'] + rect['width'] and
                    rect['y'] <= text['y'] <= rect['y'] + rect['height']):

                    # Check if rect is too narrow (less than 10px padding on each side)
                    left_padding = text['x'] - rect['x']
                    right_padding = (rect['x'] + rect['width']) - (text['x'] + text_width)

                    if left_padding < 10 or right_padding < 10:
                        violations.append({
                            "check": "annotation-sizing",
                            "severity": "medium",
                            "location": f"Annotation box near line {rect['position']}",
                            "detail": f"Text '{text['content']}' has insufficient padding in annotation box. Left: {left_padding}px, Right: {right_padding}px (need 10px each)",
                            "suggestion": f"Increase rect width to {min_rect_width}px or adjust positioning"
                        })

    return violations


def _check_accessibility(html: str) -> list[dict]:
    """
    Check 9: Accessibility (WCAG 2.2 AA).
    Programmatic checks for common accessibility issues.
    """
    violations = []
    lines = html.split('\n')

    # 9a: Check for lang attribute on html tag
    if not re.search(r'<html[^>]*\slang=["\'][^"\']+["\']', html):
        violations.append({
            "check": "a11y-lang",
            "severity": "high",
            "location": "<html> tag",
            "detail": "Missing lang attribute on <html> element",
            "suggestion": 'Add lang="en" to the <html> tag'
        })

    # 9b: Check for skip link
    if not re.search(r'class=["\'][^"\']*skip-link', html) and not re.search(r'skip.to.main', html, re.IGNORECASE):
        violations.append({
            "check": "a11y-skip-link",
            "severity": "high",
            "location": "page structure",
            "detail": "No skip navigation link found",
            "suggestion": 'Add <a href="#main-content" class="skip-link">Skip to main content</a> as the first focusable element'
        })

    # 9c: Check images for alt text
    img_pattern = r'<img\b[^>]*>'
    for img_match in re.finditer(img_pattern, html):
        img_tag = img_match.group(0)
        line_num = html[:img_match.start()].count('\n') + 1
        if 'alt=' not in img_tag:
            # Extract src for context
            src_match = re.search(r'src=["\']([^"\']+)["\']', img_tag)
            src = src_match.group(1) if src_match else 'unknown'
            violations.append({
                "check": "a11y-alt-text",
                "severity": "high",
                "location": f"line {line_num}",
                "detail": f"Image missing alt attribute: {src}",
                "suggestion": "Add a descriptive alt attribute. Use alt=\"\" for decorative images."
            })

    # 9d: Check form inputs for associated labels
    input_pattern = r'<(?:input|textarea|select)\b[^>]*>'
    for input_match in re.finditer(input_pattern, html):
        input_tag = input_match.group(0)
        line_num = html[:input_match.start()].count('\n') + 1

        # Skip hidden inputs and submit buttons
        if 'type="hidden"' in input_tag or 'type="submit"' in input_tag or 'type="button"' in input_tag:
            continue

        # Check for id attribute
        id_match = re.search(r'id=["\']([^"\']+)["\']', input_tag)
        if id_match:
            input_id = id_match.group(1)
            # Look for associated label
            label_pattern = rf'<label[^>]*for=["\']{ re.escape(input_id) }["\']'
            if not re.search(label_pattern, html):
                # Also check for aria-label
                if 'aria-label=' not in input_tag and 'aria-labelledby=' not in input_tag:
                    violations.append({
                        "check": "a11y-form-label",
                        "severity": "high",
                        "location": f"line {line_num}",
                        "detail": f"Input #{input_id} has no associated <label> or aria-label",
                        "suggestion": f'Add <label for="{input_id}">...</label> or aria-label="..."'
                    })
        elif 'aria-label=' not in input_tag and 'aria-labelledby=' not in input_tag:
            violations.append({
                "check": "a11y-form-label",
                "severity": "high",
                "location": f"line {line_num}",
                "detail": "Form input has no id, label, or aria-label",
                "suggestion": "Add an id and associated <label>, or use aria-label"
            })

    # 9e: Check SVGs for accessibility
    svg_pattern = r'<svg\b[^>]*>.*?</svg>'
    for svg_match in re.finditer(svg_pattern, html, re.DOTALL):
        svg_tag = svg_match.group(0)
        svg_open = svg_tag[:svg_tag.index('>') + 1]
        line_num = html[:svg_match.start()].count('\n') + 1

        has_aria_hidden = 'aria-hidden="true"' in svg_open or "aria-hidden='true'" in svg_open
        has_aria_label = 'aria-label=' in svg_open
        has_title = '<title>' in svg_tag
        has_role_img = 'role="img"' in svg_open

        # If not hidden and not labelled, flag it
        if not has_aria_hidden and not has_aria_label and not has_title:
            violations.append({
                "check": "a11y-svg",
                "severity": "medium",
                "location": f"SVG near line {line_num}",
                "detail": "SVG has no accessibility attributes (no aria-hidden, aria-label, or <title>)",
                "suggestion": 'Add aria-hidden="true" for decorative SVGs, or <title> / aria-label for informational ones'
            })

    # 9f: Check heading hierarchy
    heading_pattern = r'<h([1-6])\b'
    headings = []
    for h_match in re.finditer(heading_pattern, html):
        level = int(h_match.group(1))
        line_num = html[:h_match.start()].count('\n') + 1
        headings.append((level, line_num))

    for i in range(1, len(headings)):
        current_level = headings[i][0]
        prev_level = headings[i - 1][0]
        # Heading level jumped by more than 1 (e.g., h1 to h3)
        if current_level > prev_level + 1:
            violations.append({
                "check": "a11y-heading-hierarchy",
                "severity": "medium",
                "location": f"line {headings[i][1]}",
                "detail": f"Heading hierarchy skips a level: h{prev_level} to h{current_level}",
                "suggestion": f"Use h{prev_level + 1} instead, or restructure headings to avoid skipped levels"
            })

    # 9g: Check for "click here" or "read more" link text
    link_pattern = r'<a\b[^>]*>([^<]*)</a>'
    bad_link_texts = {'click here', 'read more', 'learn more', 'here', 'more', 'link'}
    for link_match in re.finditer(link_pattern, html, re.IGNORECASE):
        link_text = link_match.group(1).strip().lower()
        line_num = html[:link_match.start()].count('\n') + 1
        if link_text in bad_link_texts:
            # Check if the <a> has aria-label as a fallback
            a_tag = link_match.group(0)
            if 'aria-label=' not in a_tag:
                violations.append({
                    "check": "a11y-link-text",
                    "severity": "medium",
                    "location": f"line {line_num}",
                    "detail": f'Link text "{link_text}" is not descriptive enough',
                    "suggestion": "Use descriptive link text that makes sense out of context, or add aria-label"
                })

    return violations


def visual_audit_file(file_path: str) -> dict:
    """
    Run all visual checks on a single HTML file.
    Returns violations organized by check type.
    """
    path = Path(file_path)
    if not path.exists():
        return {
            "error": f"File not found: {file_path}",
            "file": file_path
        }

    html = path.read_text()
    visible_text = _extract_visible_text(html)

    # Run all checks
    violations = []

    violations.extend(_check_em_dashes(html, visible_text))
    violations.extend(_check_svg_root_override(html))
    violations.extend(_check_svg_class_prefix(html))
    violations.extend(_check_svg_text_overlap(html))
    violations.extend(_check_wireframe_sizing(html))
    violations.extend(_check_journey_map_bezier(html))
    violations.extend(_check_label_overlap(html))
    violations.extend(_check_annotation_sizing(html))
    violations.extend(_check_accessibility(html))

    return {
        "file": str(path.relative_to(SITE_ROOT)),
        "path": str(path),
        "violation_count": len(violations),
        "violations": violations
    }


def visual_audit_all() -> dict:
    """
    Audit all site files for visual rule violations.
    Returns summary and per-file results.
    """
    files = _get_site_files()
    results = []
    total_violations = 0
    violations_by_check = {}

    for f in files:
        result = visual_audit_file(f["path"])
        results.append(result)

        violation_count = result.get("violation_count", 0)
        total_violations += violation_count

        # Aggregate by check type
        for violation in result.get("violations", []):
            check = violation.get("check", "unknown")
            if check not in violations_by_check:
                violations_by_check[check] = 0
            violations_by_check[check] += 1

    return {
        "files_scanned": len(files),
        "total_violations": total_violations,
        "violations_by_check": violations_by_check,
        "results": results
    }
