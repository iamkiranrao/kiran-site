#!/usr/bin/env python3
"""
Explainer Deprecation & Per-Page Glossary Audit Script
Per CONTENT-RULES.md Section 15:
  - No per-section explainer icons anywhere
  - Teardown and prototype pages should have a per-page glossary at the top

Usage:
    python3 scripts/audit-explainers.py
    python3 scripts/audit-explainers.py teardowns/geico-mobile-app.html  # single file
"""

import re
import sys
import os


# Pages that should have a per-page glossary
GLOSSARY_REQUIRED_PATTERNS = [
    'teardowns/',
    'prototypes/',
]

# Pages to skip glossary check (hub pages, index pages, etc.)
GLOSSARY_SKIP = [
    'geico.html',   # hub page, not a teardown
    'meta.html',     # hub page, not a teardown
    'index.html',    # prototype launcher, not overview
]


def check_for_explainer_remnants(filepath):
    """Check a single HTML file for any leftover explainer markup."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    issues = []

    # Check for explainer-icon class
    icons = re.findall(r'class="[^"]*explainer-icon[^"]*"', content)
    if icons:
        issues.append(f"  DEPRECATED: Found {len(icons)} explainer-icon element(s) - remove them")

    # Check for data-explainer-* attributes
    attrs = re.findall(r'data-explainer-\w+', content)
    if attrs:
        unique_attrs = set(attrs)
        issues.append(f"  DEPRECATED: Found data-explainer attributes: {', '.join(sorted(unique_attrs))}")

    # Check for explainer.js script reference
    if 'explainer.js' in content:
        issues.append("  DEPRECATED: Found explainer.js script reference - remove it")

    # Check for explainer.css stylesheet reference
    if 'explainer.css' in content:
        issues.append("  DEPRECATED: Found explainer.css stylesheet reference - remove it")

    # Check for explainer panel/backdrop markup
    if 'explainer-panel' in content or 'explainer-backdrop' in content:
        issues.append("  DEPRECATED: Found explainer panel/backdrop markup - remove it")

    return issues, content


def check_glossary_presence(filepath, content):
    """Check if a teardown/prototype page has a per-page glossary."""
    basename = os.path.basename(filepath)

    # Skip non-content pages
    if basename in GLOSSARY_SKIP:
        return []

    # Only check pages that should have glossaries
    should_check = any(pattern in filepath for pattern in GLOSSARY_REQUIRED_PATTERNS)
    if not should_check:
        return []

    issues = []
    if 'page-glossary' not in content:
        issues.append("  MISSING: No per-page glossary found (expected .page-glossary section)")
    elif 'glossary-term' not in content:
        issues.append("  INCOMPLETE: Glossary section exists but has no terms (.glossary-term)")

    return issues


def main():
    # Determine which files to audit
    if len(sys.argv) > 1:
        files = sys.argv[1:]
    else:
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        files = []
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames
                           if d not in {'.git', 'node_modules', 'command-center', 'site'}]
            for fn in filenames:
                if fn.endswith('.html'):
                    files.append(os.path.join(dirpath, fn))

    if not files:
        print("No HTML files found to audit.")
        return

    print("=" * 60)
    print("EXPLAINER & GLOSSARY AUDIT")
    print("Per CONTENT-RULES.md Section 15")
    print("  - No per-section [?] icons")
    print("  - Per-page glossary at top of teardown/prototype pages")
    print("=" * 60)

    total_issues = 0
    files_with_issues = 0

    for filepath in sorted(files):
        issues, content = check_for_explainer_remnants(filepath)
        glossary_issues = check_glossary_presence(filepath, content)
        issues.extend(glossary_issues)

        total_issues += len(issues)
        display = os.path.relpath(filepath) if not filepath.startswith('/') else filepath

        if issues:
            files_with_issues += 1
            print(f"\nFAIL: {display}")
            for issue in issues:
                print(issue)
        else:
            print(f"PASS: {display}")

    # Summary
    print(f"\n{'=' * 60}")
    print(f"Files audited: {len(files)}")
    print(f"Files with issues: {files_with_issues}")
    print(f"Total issues: {total_issues}")

    if total_issues == 0:
        print("STATUS: CLEAN")
    else:
        print("STATUS: ISSUES FOUND - Fix before publishing")
        sys.exit(1)

    print("=" * 60)


if __name__ == '__main__':
    main()
