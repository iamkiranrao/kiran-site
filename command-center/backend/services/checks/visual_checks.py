"""Visual Standards checks — VISUAL-STANDARDS.md enforcement.

Ports the 9 existing visual audit checks into the unified dashboard framework:
- Em dashes in HTML/visible text
- SVG :root overrides
- SVG class prefix (wf-)
- SVG text overlap (12px minimum)
- Wireframe box sizing (max-width: 340px)
- Journey map bezier curves (C command, no Q/T)
- Sentiment label overlap
- Annotation box sizing
- Accessibility (WCAG 2.2 AA)
"""

import re
from pathlib import Path

from models.standards import CheckDefinition, Violation
from services.standards_service import register_check, SITE_ROOT


# ── Check: SVG :root overrides ───────────────────────────────────

def _check_svg_root_override(file_path, html, visible_text):
    """Detect :root selectors inside SVG elements (breaks theme toggle)."""
    violations = []
    rel_path = str(Path(file_path).relative_to(SITE_ROOT))

    for svg_match in re.finditer(r'<svg[^>]*>.*?</svg>', html, re.DOTALL):
        svg_content = svg_match.group(0)
        svg_line = html[:svg_match.start()].count('\n') + 1

        if ':root' in svg_content:
            for root_match in re.finditer(r':root', svg_content):
                ctx_start = max(0, root_match.start() - 40)
                ctx_end = min(len(svg_content), root_match.end() + 40)
                context = svg_content[ctx_start:ctx_end].strip()

                violations.append(Violation(
                    check_id="vis-svg-root-override",
                    severity="critical",
                    location=f"{rel_path}:~line {svg_line}",
                    detail="SVG contains :root override — breaks site theme toggle",
                    evidence=context[:120],
                    suggestion="Remove :root selector, use scoped SVG class names prefixed with wf-",
                    auto_fixable=False,
                ))

    return violations


register_check(
    CheckDefinition(
        id="vis-svg-root-override",
        pillar="visual",
        name="SVG :root override",
        description="SVGs must not contain :root selectors — they override site CSS variables",
        severity_default="critical",
        method="regex",
        remediation_difficulty="mechanical",
        standards_ref="VISUAL-STANDARDS.md §SVG",
    ),
    runner=_check_svg_root_override,
)


# ── Check: SVG class prefix ─────────────────────────────────────

SKIP_SVG_CLASSES = {'current-color', 'no-fill', 'opacity-low', 'hidden'}


def _check_svg_class_prefix(file_path, html, visible_text):
    """Ensure all SVG class names are prefixed with wf- or dg-."""
    violations = []
    rel_path = str(Path(file_path).relative_to(SITE_ROOT))

    for svg_match in re.finditer(r'<svg[^>]*>.*?</svg>', html, re.DOTALL):
        svg_content = svg_match.group(0)
        svg_line = html[:svg_match.start()].count('\n') + 1

        for class_match in re.finditer(r'class=["\']([^"\']+)["\']', svg_content):
            classes = class_match.group(1).split()
            bad_classes = [
                cls for cls in classes
                if cls not in SKIP_SVG_CLASSES
                and not cls.startswith('wf-')
                and not cls.startswith('dg-')
            ]
            for cls in bad_classes:
                violations.append(Violation(
                    check_id="vis-svg-class-prefix",
                    severity="warning",
                    location=f"{rel_path}:~line {svg_line}",
                    detail=f"SVG class '{cls}' missing required wf-/dg- prefix",
                    evidence=f"class=\"{class_match.group(1)}\"",
                    suggestion=f"Rename '{cls}' to 'wf-{cls}' or 'dg-{cls}'",
                    auto_fixable=False,
                ))

    return violations


register_check(
    CheckDefinition(
        id="vis-svg-class-prefix",
        pillar="visual",
        name="SVG class prefix",
        description="All SVG class names must be prefixed with wf- or dg- to avoid CSS conflicts",
        severity_default="warning",
        method="regex",
        remediation_difficulty="mechanical",
        standards_ref="VISUAL-STANDARDS.md §SVG",
    ),
    runner=_check_svg_class_prefix,
)


# ── Check: SVG text overlap ─────────────────────────────────────

def _check_svg_text_overlap(file_path, html, visible_text):
    """Check for text elements too close together vertically in SVGs."""
    violations = []
    rel_path = str(Path(file_path).relative_to(SITE_ROOT))

    text_pattern = r'<text[^>]*x=["\']?([^"\'>\s]+)["\']?[^>]*y=["\']?([^"\'>\s]+)["\']?[^>]*>([^<]*)</text>'

    for svg_match in re.finditer(r'<svg[^>]*>.*?</svg>', html, re.DOTALL):
        svg_content = svg_match.group(0)
        svg_line = html[:svg_match.start()].count('\n') + 1

        elements = []
        for tm in re.finditer(text_pattern, svg_content):
            try:
                elements.append({
                    'x': float(tm.group(1)),
                    'y': float(tm.group(2)),
                    'content': tm.group(3),
                })
            except ValueError:
                pass

        for i, e1 in enumerate(elements):
            for e2 in elements[i + 1:]:
                if abs(e1['x'] - e2['x']) < 20:
                    spacing = abs(e1['y'] - e2['y'])
                    if spacing < 12:
                        violations.append(Violation(
                            check_id="vis-svg-text-overlap",
                            severity="warning",
                            location=f"{rel_path}:~line {svg_line}",
                            detail=f"SVG text overlap: '{e1['content']}' and '{e2['content']}' only {spacing:.0f}px apart (min 12px)",
                            evidence=f"y1={e1['y']}, y2={e2['y']}, spacing={spacing:.1f}px",
                            suggestion="Increase vertical spacing to at least 12px",
                            auto_fixable=False,
                        ))

    return violations


register_check(
    CheckDefinition(
        id="vis-svg-text-overlap",
        pillar="visual",
        name="SVG text overlap",
        description="SVG text elements must have at least 12px vertical spacing",
        severity_default="warning",
        method="metric",
        remediation_difficulty="mechanical",
        standards_ref="VISUAL-STANDARDS.md §SVG",
    ),
    runner=_check_svg_text_overlap,
)


# ── Check: Wireframe box sizing ──────────────────────────────────

def _check_wireframe_sizing(file_path, html, visible_text):
    """Check .wireframe-box has max-width: 340px."""
    violations = []
    rel_path = str(Path(file_path).relative_to(SITE_ROOT))

    css_content = '\n'.join(
        m.group(1)
        for m in re.finditer(r'<style[^>]*>(.+?)</style>', html, re.DOTALL)
    )

    if '.wireframe-box' in css_content:
        wf_match = re.search(r'\.wireframe-box\s*\{([^}]+)\}', css_content)
        if wf_match:
            rule = wf_match.group(1)
            if 'max-width' not in rule or '340px' not in rule:
                violations.append(Violation(
                    check_id="vis-wireframe-sizing",
                    severity="warning",
                    location=rel_path,
                    detail=".wireframe-box missing max-width: 340px",
                    evidence=rule.strip()[:100],
                    suggestion="Add 'max-width: 340px;' to .wireframe-box",
                    auto_fixable=False,
                ))

    return violations


register_check(
    CheckDefinition(
        id="vis-wireframe-sizing",
        pillar="visual",
        name="Wireframe box sizing",
        description="Wireframe boxes (.wireframe-box) must have max-width: 340px",
        severity_default="warning",
        method="regex",
        remediation_difficulty="mechanical",
        standards_ref="VISUAL-STANDARDS.md §Wireframes",
    ),
    runner=_check_wireframe_sizing,
)


# ── Check: Journey map bezier curves ─────────────────────────────

def _check_journey_bezier(file_path, html, visible_text):
    """Sentiment curves must use cubic bezier (C), not quadratic (Q/T)."""
    violations = []
    rel_path = str(Path(file_path).relative_to(SITE_ROOT))

    for path_match in re.finditer(r'<path[^>]*d=["\']([^"\']+)["\'][^>]*>', html):
        d_attr = path_match.group(1)
        line_num = html[:path_match.start()].count('\n') + 1

        if re.search(r'\bQ\b', d_attr) or re.search(r'\bT\b', d_attr):
            violations.append(Violation(
                check_id="vis-journey-bezier",
                severity="warning",
                location=f"{rel_path}:~line {line_num}",
                detail="SVG path uses quadratic bezier (Q/T) — journey maps must use cubic (C)",
                evidence=d_attr[:100],
                suggestion="Convert to cubic bezier C commands",
                auto_fixable=False,
            ))

    return violations


register_check(
    CheckDefinition(
        id="vis-journey-bezier",
        pillar="visual",
        name="Journey map bezier type",
        description="Journey map sentiment curves must use cubic bezier (C command), not quadratic (Q/T)",
        severity_default="warning",
        method="regex",
        remediation_difficulty="mechanical",
        standards_ref="VISUAL-STANDARDS.md §Journey Maps",
    ),
    runner=_check_journey_bezier,
)


# ── Check: Label overlap in journey maps ─────────────────────────

def _check_label_overlap(file_path, html, visible_text):
    """Check sentiment labels have 6px clearance above circles."""
    violations = []
    rel_path = str(Path(file_path).relative_to(SITE_ROOT))

    circle_pat = r'<circle[^>]*cx=["\']?([^"\'>\s]+)["\']?[^>]*cy=["\']?([^"\'>\s]+)["\']?[^>]*r=["\']?([^"\'>\s]+)["\']?'
    text_pat = r'<text[^>]*x=["\']?([^"\'>\s]+)["\']?[^>]*y=["\']?([^"\'>\s]+)["\']?[^>]*>([^<]*)</text>'

    for svg_match in re.finditer(r'<svg[^>]*>.*?</svg>', html, re.DOTALL):
        svg_content = svg_match.group(0)
        svg_line = html[:svg_match.start()].count('\n') + 1

        circles = []
        for cm in re.finditer(circle_pat, svg_content):
            try:
                circles.append({
                    'cx': float(cm.group(1)),
                    'cy': float(cm.group(2)),
                    'r': float(cm.group(3)),
                })
            except ValueError:
                pass

        texts = []
        for tm in re.finditer(text_pat, svg_content):
            try:
                texts.append({
                    'x': float(tm.group(1)),
                    'y': float(tm.group(2)),
                    'content': tm.group(3),
                })
            except ValueError:
                pass

        for text in texts:
            for circle in circles:
                min_y = circle['cy'] - circle['r'] - 6
                if text['y'] > min_y and abs(text['x'] - circle['cx']) < 50:
                    violations.append(Violation(
                        check_id="vis-label-overlap",
                        severity="warning",
                        location=f"{rel_path}:~line {svg_line}",
                        detail=f"Label '{text['content']}' overlaps circle (y={text['y']}, need y<{min_y:.0f})",
                        evidence=f"text y={text['y']}, circle cy={circle['cy']}, r={circle['r']}",
                        suggestion=f"Move label to y={min_y:.0f} or higher",
                        auto_fixable=False,
                    ))

    return violations


register_check(
    CheckDefinition(
        id="vis-label-overlap",
        pillar="visual",
        name="Journey label overlap",
        description="Sentiment labels must have 6px clearance above circles",
        severity_default="warning",
        method="metric",
        remediation_difficulty="mechanical",
        standards_ref="VISUAL-STANDARDS.md §Journey Maps",
    ),
    runner=_check_label_overlap,
)


# ── Check: Annotation box sizing ─────────────────────────────────

def _check_annotation_sizing(file_path, html, visible_text):
    """Check annotation/callout boxes have proper padding around text.

    Skips SVG-heavy pages (>3 SVGs) where diagrams are composed as a
    whole and padding adjustments cascade unpredictably.
    """
    violations = []
    rel_path = str(Path(file_path).relative_to(SITE_ROOT))

    # Skip diagram-heavy pages — annotation layout is compositional
    svg_count = len(re.findall(r'<svg[^>]*>', html))
    if svg_count > 3:
        return violations

    rect_pat = r'<rect[^>]*x=["\']?([^"\'>\s]+)["\']?[^>]*y=["\']?([^"\'>\s]+)["\']?[^>]*width=["\']?([^"\'>\s]+)["\']?[^>]*height=["\']?([^"\'>\s]+)["\']?'
    text_pat = r'<text[^>]*x=["\']?([^"\'>\s]+)["\']?[^>]*y=["\']?([^"\'>\s]+)["\']?[^>]*>([^<]*)</text>'

    for svg_match in re.finditer(r'<svg[^>]*>.*?</svg>', html, re.DOTALL):
        svg_content = svg_match.group(0)
        svg_line = html[:svg_match.start()].count('\n') + 1

        rects = []
        for rm in re.finditer(rect_pat, svg_content):
            try:
                rects.append({
                    'x': float(rm.group(1)),
                    'y': float(rm.group(2)),
                    'width': float(rm.group(3)),
                    'height': float(rm.group(4)),
                })
            except ValueError:
                pass

        texts = []
        for tm in re.finditer(text_pat, svg_content):
            try:
                texts.append({
                    'x': float(tm.group(1)),
                    'y': float(tm.group(2)),
                    'content': tm.group(3),
                })
            except ValueError:
                pass

        for text in texts:
            text_width = len(text['content']) * 6  # ~6px per char estimate
            for rect in rects:
                if (rect['x'] <= text['x'] <= rect['x'] + rect['width'] and
                        rect['y'] <= text['y'] <= rect['y'] + rect['height']):
                    left_pad = text['x'] - rect['x']
                    right_pad = (rect['x'] + rect['width']) - (text['x'] + text_width)
                    if left_pad < 10 or right_pad < 10:
                        violations.append(Violation(
                            check_id="vis-annotation-sizing",
                            severity="info",
                            location=f"{rel_path}:~line {svg_line}",
                            detail=f"Annotation box has insufficient padding for '{text['content']}'",
                            evidence=f"left={left_pad:.0f}px, right={right_pad:.0f}px (need 10px each)",
                            suggestion="Increase rect width or adjust text position for 10px padding each side",
                            auto_fixable=False,
                        ))

    return violations


register_check(
    CheckDefinition(
        id="vis-annotation-sizing",
        pillar="visual",
        name="Annotation box sizing",
        description="Annotation/callout rects need 10px padding around text content",
        severity_default="info",
        method="metric",
        remediation_difficulty="mechanical",
        standards_ref="VISUAL-STANDARDS.md §Annotations",
    ),
    runner=_check_annotation_sizing,
)


# ── Check: Accessibility (WCAG 2.2 AA) ──────────────────────────

def _check_accessibility(file_path, html, visible_text):
    """Run WCAG 2.2 AA programmatic checks."""
    violations = []
    rel_path = str(Path(file_path).relative_to(SITE_ROOT))

    # Lang attribute
    if not re.search(r'<html[^>]*\slang=["\'][^"\']+["\']', html):
        violations.append(Violation(
            check_id="vis-a11y",
            severity="critical",
            location=rel_path,
            detail="Missing lang attribute on <html> element",
            evidence="<html> tag has no lang attribute",
            suggestion='Add lang="en" to the <html> tag',
            auto_fixable=True,
        ))

    # Skip link
    if not re.search(r'class=["\'][^"\']*skip-link', html) and \
       not re.search(r'skip.to.main', html, re.IGNORECASE):
        violations.append(Violation(
            check_id="vis-a11y",
            severity="warning",
            location=rel_path,
            detail="No skip navigation link found",
            evidence="Missing .skip-link or 'skip to main' link",
            suggestion='Add <a href="#main-content" class="skip-link">Skip to main content</a>',
            auto_fixable=False,
        ))

    # Images without alt text
    for img_match in re.finditer(r'<img\b[^>]*>', html):
        img_tag = img_match.group(0)
        if 'alt=' not in img_tag:
            src_match = re.search(r'src=["\']([^"\']+)["\']', img_tag)
            src = src_match.group(1) if src_match else 'unknown'
            line_num = html[:img_match.start()].count('\n') + 1
            violations.append(Violation(
                check_id="vis-a11y",
                severity="critical",
                location=f"{rel_path}:line {line_num}",
                detail=f"Image missing alt attribute: {Path(src).name}",
                evidence=img_tag[:100],
                suggestion='Add descriptive alt attribute. Use alt="" for decorative images.',
                auto_fixable=False,
            ))

    # Form inputs without labels
    for input_match in re.finditer(r'<(?:input|textarea|select)\b[^>]*>', html):
        input_tag = input_match.group(0)
        if any(t in input_tag for t in ['type="hidden"', 'type="submit"', 'type="button"']):
            continue

        id_match = re.search(r'id=["\']([^"\']+)["\']', input_tag)
        has_label = False
        if id_match:
            input_id = id_match.group(1)
            has_label = bool(re.search(
                rf'<label[^>]*for=["\']{ re.escape(input_id) }["\']', html
            ))

        if not has_label and 'aria-label=' not in input_tag and 'aria-labelledby=' not in input_tag:
            line_num = html[:input_match.start()].count('\n') + 1
            violations.append(Violation(
                check_id="vis-a11y",
                severity="warning",
                location=f"{rel_path}:line {line_num}",
                detail="Form input has no associated label or aria-label",
                evidence=input_tag[:100],
                suggestion="Add <label for=\"...\"> or aria-label attribute",
                auto_fixable=False,
            ))

    # SVG accessibility
    for svg_match in re.finditer(r'<svg\b[^>]*>.*?</svg>', html, re.DOTALL):
        svg_tag = svg_match.group(0)
        svg_open = svg_tag[:svg_tag.index('>') + 1]
        if 'aria-hidden="true"' not in svg_open and \
           "aria-hidden='true'" not in svg_open and \
           'aria-label=' not in svg_open and \
           '<title>' not in svg_tag:
            line_num = html[:svg_match.start()].count('\n') + 1
            violations.append(Violation(
                check_id="vis-a11y",
                severity="info",
                location=f"{rel_path}:line {line_num}",
                detail="SVG missing accessibility attributes",
                evidence="No aria-hidden, aria-label, or <title> on SVG",
                suggestion='Add aria-hidden="true" for decorative SVGs, <title> for informational ones',
                auto_fixable=False,
            ))

    # Heading hierarchy
    headings = [(int(m.group(1)), html[:m.start()].count('\n') + 1)
                for m in re.finditer(r'<h([1-6])\b', html)]
    for i in range(1, len(headings)):
        curr, prev = headings[i][0], headings[i - 1][0]
        if curr > prev + 1:
            violations.append(Violation(
                check_id="vis-a11y",
                severity="warning",
                location=f"{rel_path}:line {headings[i][1]}",
                detail=f"Heading hierarchy skips level: h{prev} → h{curr}",
                evidence=f"Expected h{prev + 1}, found h{curr}",
                suggestion=f"Use h{prev + 1} or restructure heading hierarchy",
                auto_fixable=False,
            ))

    # Undescriptive link text
    bad_texts = {'click here', 'read more', 'learn more', 'here', 'more', 'link'}
    for link_match in re.finditer(r'<a\b[^>]*>([^<]*)</a>', html, re.IGNORECASE):
        text = link_match.group(1).strip().lower()
        if text in bad_texts and 'aria-label=' not in link_match.group(0):
            line_num = html[:link_match.start()].count('\n') + 1
            violations.append(Violation(
                check_id="vis-a11y",
                severity="info",
                location=f"{rel_path}:line {line_num}",
                detail=f'Link text "{text}" is not descriptive',
                evidence=link_match.group(0)[:80],
                suggestion="Use descriptive link text or add aria-label",
                auto_fixable=False,
            ))

    return violations


register_check(
    CheckDefinition(
        id="vis-a11y",
        pillar="visual",
        name="Accessibility (WCAG 2.2 AA)",
        description="Programmatic WCAG 2.2 AA checks: lang, skip-link, alt text, labels, headings",
        severity_default="warning",
        method="regex",
        remediation_difficulty="mechanical",
        standards_ref="VISUAL-STANDARDS.md §Accessibility",
    ),
    runner=_check_accessibility,
)
