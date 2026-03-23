"""
Git Handler Service — Manages git operations for publishing to kirangorapalli.com.

Publishing checklist (for teardowns):
1. Save teardown to teardowns/[product].html
2. Copy to site/teardowns/[product].html
3. Update how-id-built-it.html (add/update company card)
4. Copy updated how-id-built-it.html to site/
5. If new company: create teardowns/[company].html (Tier 2 page)
6. Copy Tier 2 page to site/teardowns/[company].html
7. Update sitemap.xml and site/sitemap.xml (teardown + hub page)
8. Update fenix-index.json (teardown entry + hub entry)
9. git add, commit, push

Publishing checklist (for blog posts):
1. Save post to blog/[slug].html
2. Copy to site/blog/[slug].html
3. Update blog-podcast.html (add post card)
4. Copy updated blog-podcast.html to site/
5. Update sitemap.xml, rss.xml, and site/ copies
6. git add, commit, push
"""

import json
import os
import re
import shutil
import subprocess
import tempfile
from datetime import datetime
from typing import Optional, List


class GitHandler:
    """Handles git operations for the kiran-site repository."""

    def __init__(self):
        self.repo_url = os.getenv("KIRAN_SITE_REPO", "")
        self.github_pat = os.getenv("GITHUB_PAT", "")
        self.local_path = os.getenv("KIRAN_SITE_LOCAL", "/tmp/kiran-site")
        self._ready = False

    def _auth_url(self) -> str:
        """Build authenticated git URL."""
        if self.github_pat and "github.com" in self.repo_url:
            return self.repo_url.replace(
                "https://github.com",
                f"https://{self.github_pat}@github.com",
            )
        return self.repo_url

    def _sanitize_cmd(self, cmd: List[str]) -> str:
        """Join command parts for display, masking any PAT tokens."""
        joined = " ".join(cmd)
        if self.github_pat:
            joined = joined.replace(self.github_pat, "***")
        return joined

    def _run(self, cmd: List[str], cwd: Optional[str] = None) -> str:
        """Run a git command and return output."""
        result = subprocess.run(
            cmd,
            cwd=cwd or self.local_path,
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode != 0:
            safe_cmd = self._sanitize_cmd(cmd)
            stderr = result.stderr.strip()
            raise RuntimeError(
                f"Git command failed: {safe_cmd}"
                + (f" — {stderr}" if stderr else "")
            )
        return result.stdout.strip()

    def _ensure_config(self):
        """Ensure git user config is set (needed for commits)."""
        try:
            name = self._run(["git", "config", "user.name"])
        except RuntimeError:
            name = ""
        if not name:
            self._run(["git", "config", "user.email", "kiranrao@gmail.com"])
            self._run(["git", "config", "user.name", "Kiran Gorapalli"])

    async def clone_or_pull(self) -> str:
        """Clone the repo if not present, or pull latest changes."""
        if not self.repo_url:
            raise RuntimeError(
                "KIRAN_SITE_REPO not set. Add it to backend/.env"
            )
        if not self.github_pat:
            raise RuntimeError(
                "GITHUB_PAT not set. Add a GitHub personal access token to backend/.env"
            )

        if os.path.exists(os.path.join(self.local_path, ".git")):
            self._ensure_config()
            output = self._run(["git", "pull", "--rebase"])
            self._ready = True
            return f"Pulled latest: {output}"
        else:
            os.makedirs(os.path.dirname(self.local_path), exist_ok=True)
            self._run(
                ["git", "clone", self._auth_url(), self.local_path],
                cwd="/tmp",
            )
            self._ensure_config()
            self._ready = True
            return "Cloned repository"

    async def get_status(self) -> dict:
        """Get the current git status of the local repo."""
        if not os.path.exists(os.path.join(self.local_path, ".git")):
            return {"ready": False, "message": "Repository not cloned"}

        status = self._run(["git", "status", "--short"])
        branch = self._run(["git", "branch", "--show-current"])
        return {
            "ready": True,
            "branch": branch,
            "changes": status.split("\n") if status else [],
        }

    def _generate_company_card(self, company: str, company_slug: str, product: str) -> str:
        """Auto-generate a company card for how-id-built-it.html grid."""
        return f"""            <a href="teardowns/{company_slug}.html" class="company-card">
                <div class="company-logo">
                    <svg width="160" height="32" viewBox="0 0 160 32" fill="none">
                        <text x="0" y="24" font-family="Inter, -apple-system, sans-serif" font-size="24" font-weight="700" fill="var(--text-primary)" letter-spacing="-0.04em">{company}</text>
                    </svg>
                </div>
                <div class="company-body">
                    <div class="company-name">{company}</div>
                    <div class="company-product-count">1 teardown</div>
                    <div class="company-products">
                        <span class="company-product-tag">{product}</span>
                    </div>
                </div>
            </a>"""

    def _generate_tier2_page(self, company: str, company_slug: str, product: str, product_slug: str) -> str:
        """Auto-generate a tier 2 company page listing its teardowns."""
        filename = f"{company_slug}-{product_slug}.html"
        return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Kiran Gorapalli - {company} product teardowns. Product analysis and redesign proposals for {company} products.">
    <title>{company} Teardowns - Kiran Gorapalli</title>
    <link rel="icon" href="../images/favicon.png" type="image/png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../styles.css">
    <link rel="canonical" href="https://kirangorapalli.com/teardowns/{company_slug}.html">
    <meta name="theme-color" content="#0a0a0a">

    <!-- Open Graph -->
    <meta property="og:type" content="website">
    <meta property="og:title" content="{company} Teardowns - Kiran Gorapalli">
    <meta property="og:description" content="Product analysis and redesign proposals for {company} products.">
    <meta property="og:url" content="https://kirangorapalli.com/teardowns/{company_slug}.html">
    <meta property="og:image" content="https://kirangorapalli.com/images/og-image.png">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{company} Teardowns - Kiran Gorapalli">
    <meta name="twitter:description" content="Product analysis and redesign proposals for {company} products.">
    <meta name="twitter:image" content="https://kirangorapalli.com/images/og-image.png">

    <style>
        /* ============================================
           {company.upper()} TEARDOWNS - PAGE STYLES
           ============================================ */

        /* Hero Banner */
        .subpage-hero {{
            width: 100%;
            position: relative;
            overflow: hidden;
            background: var(--bg-primary);
            border-bottom: 1px solid var(--border);
        }}
        .hero-title-area {{
            text-align: center;
            padding: 6rem 4rem 1.5rem;
        }}
        .subpage-hero-title {{
            font-size: clamp(2.5rem, 6vw, 4.5rem);
            font-weight: 700;
            color: var(--text-primary);
            letter-spacing: -0.04em;
            line-height: 1.1;
            margin-bottom: 0.5rem;
        }}
        .subpage-hero-tagline {{
            font-size: clamp(1rem, 2vw, 1.2rem);
            font-weight: 400;
            color: var(--text-secondary);
            letter-spacing: -0.01em;
            margin-bottom: 0;
        }}

        /* Breadcrumb */
        .breadcrumb {{
            max-width: 1400px;
            margin: 0 auto;
            padding: 1.5rem 4rem 0;
        }}
        .breadcrumb a {{
            font-size: 0.8rem;
            font-weight: 500;
            color: var(--text-muted);
            text-decoration: none;
            letter-spacing: 0.01em;
            transition: color 0.2s ease;
        }}
        .breadcrumb a:hover {{ color: var(--text-primary); }}
        .breadcrumb span {{
            font-size: 0.8rem;
            color: var(--text-muted);
            margin: 0 0.4rem;
            opacity: 0.5;
        }}
        .breadcrumb .current {{
            font-size: 0.8rem;
            font-weight: 500;
            color: var(--text-secondary);
        }}

        /* ============================================
           PRODUCT GRID
           ============================================ */
        .products-section {{
            padding: 2rem 4rem 4rem;
            max-width: 1400px;
            margin: 0 auto;
        }}

        .products-grid {{
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 1.25rem;
        }}

        /* ============================================
           PRODUCT CARD
           ============================================ */
        .product-card {{
            border: 1px solid var(--border);
            border-radius: 12px;
            background: var(--bg-primary);
            overflow: hidden;
            transition: border-color 0.2s ease, transform 0.15s ease;
            cursor: pointer;
            text-decoration: none;
            display: flex;
            flex-direction: column;
        }}
        .product-card:hover {{
            border-color: var(--text-muted);
            transform: translateY(-2px);
        }}

        .product-icon {{
            width: 100%;
            height: 100px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            border-bottom: 1px solid var(--border);
        }}
        .product-icon svg {{
            width: 48px;
            height: 48px;
        }}

        .product-body {{
            padding: 1.25rem 1.5rem 1.5rem;
            display: flex;
            flex-direction: column;
            flex: 1;
        }}
        .product-name {{
            font-size: 1.1rem;
            font-weight: 600;
            letter-spacing: -0.01em;
            line-height: 1.3;
            color: var(--text-primary);
            margin-bottom: 0.4rem;
        }}
        .product-tagline {{
            font-size: 0.85rem;
            line-height: 1.5;
            color: var(--text-secondary);
            margin-bottom: 1rem;
        }}
        .product-sections {{
            display: flex;
            flex-wrap: wrap;
            gap: 0.4rem;
            margin-bottom: 1rem;
        }}
        .product-section-tag {{
            font-size: 0.65rem;
            font-weight: 500;
            letter-spacing: 0.02em;
            text-transform: uppercase;
            color: var(--text-muted);
            background: var(--bg-dark);
            border: 1px solid var(--border);
            padding: 0.2rem 0.5rem;
            border-radius: 500px;
        }}
        .product-cta {{
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            font-size: 0.75rem;
            font-weight: 600;
            letter-spacing: 0.03em;
            text-transform: uppercase;
            color: var(--text-muted);
            transition: color 0.2s ease;
            margin-top: auto;
        }}
        .product-card:hover .product-cta {{ color: var(--text-primary); }}
        .product-cta svg {{
            width: 12px;
            height: 12px;
            stroke: currentColor;
            fill: none;
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
        }}

        .product-card.coming-soon {{
            opacity: 0.4;
            cursor: default;
            pointer-events: none;
        }}

        /* ============================================
           FOOTER
           ============================================ */
        footer {{
            border-top: 1px solid var(--border);
            padding: 3rem 4rem 2rem;
            text-align: center;
        }}
        .footer-social {{ margin-bottom: 2rem; }}
        .social-links {{
            display: flex;
            justify-content: center;
            gap: 1rem;
            flex-wrap: wrap;
        }}
        .social-icon {{
            width: 42px;
            height: 42px;
            border-radius: 50%;
            border: 2.5px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-secondary);
            text-decoration: none;
            transition: border-color 0.2s ease, opacity 0.2s ease;
        }}
        .social-icon svg {{ width: 18px; height: 18px; }}
        .social-icon:hover {{ opacity: 0.8; }}
        .social-icon.linkedin:hover {{ border-color: #0A66C2; }}
        .social-icon.github:hover {{ border-color: #f0e6d3; }}
        .social-icon.youtube:hover {{ border-color: #FF0000; }}
        .social-icon.flickr:hover {{ border-color: #FF0084; }}
        .social-icon.spotify:hover {{ border-color: #1DB954; }}
        .social-icon.substack:hover {{ border-color: #FF6719; }}
        [data-theme="light"] .social-icon.github:hover {{ border-color: #333; }}

        .footer-site-info {{
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 1.5rem;
        }}
        .footer-logo {{
            width: 36px;
            height: auto;
            opacity: 0.6;
            cursor: pointer;
            transition: opacity 0.2s ease, transform 0.2s ease;
        }}
        .footer-logo:hover {{ opacity: 1; transform: scale(1.05); }}
        .footer-meta {{
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.75rem;
            color: var(--text-muted);
        }}
        .footer-meta-sep {{ opacity: 0.4; }}
        .version-number {{ letter-spacing: 0.02em; }}
        .last-updated {{ letter-spacing: -0.01em; }}
        .rss-badge {{
            display: inline-flex;
            align-items: center;
            gap: 0.3rem;
            color: var(--text-muted);
            text-decoration: none;
            font-weight: 500;
            letter-spacing: 0.02em;
            transition: color 0.2s ease;
        }}
        .rss-badge:hover {{ color: var(--text-primary); }}
        .rss-badge svg {{ opacity: 0.6; }}
        .footer-copyright {{
            font-size: 0.7rem;
            color: var(--text-muted);
            opacity: 0.5;
            letter-spacing: 0.02em;
        }}

        /* Toast */
        .toast {{
            position: fixed;
            bottom: 2rem;
            left: 50%;
            transform: translateX(-50%) translateY(20px);
            background: var(--text-primary);
            color: var(--bg-primary);
            padding: 0.75rem 1.5rem;
            border-radius: 500px;
            font-size: 0.85rem;
            font-weight: 500;
            letter-spacing: -0.01em;
            opacity: 0;
            pointer-events: none;
            transition: all 0.3s ease;
            z-index: 9999;
        }}
        .toast.visible {{
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }}

        /* ============================================
           RESPONSIVE
           ============================================ */
        @media (max-width: 1024px) {{
            .hero-title-area {{ padding: 5rem 3rem 1.5rem; }}
            .breadcrumb {{ padding: 1.25rem 3rem 0; }}
            .products-section {{ padding: 1.5rem 3rem 3rem; }}
            .products-grid {{ grid-template-columns: repeat(2, 1fr); }}
            footer {{ padding: 3rem 3rem 2rem; }}
        }}

        @media (max-width: 768px) {{
            .hero-title-area {{ padding: 4.5rem 1.5rem 1.5rem; }}
            .breadcrumb {{ padding: 1rem 1.5rem 0; }}
            .products-section {{ padding: 1.25rem 1.5rem 3rem; }}
            .products-grid {{ grid-template-columns: 1fr; }}
            footer {{ padding: 2.5rem 1.5rem 1.5rem; }}
        }}

        @media (max-width: 480px) {{
            .hero-title-area {{ padding: 4rem 1rem 1rem; }}
            .breadcrumb {{ padding: 0.75rem 1rem 0; }}
            .products-section {{ padding: 1rem 1rem 2rem; }}
            footer {{ padding: 2rem 1rem 1.5rem; }}
        }}
    </style>
</head>
<body class="preload">
    <a href="#products" class="skip-link">Skip to main content</a>

    <!-- Navigation -->
    <nav>
        <div class="nav-container">
            <div class="nav-right">
                <button id="themeToggle" class="theme-toggle" title="Toggle theme" aria-label="Toggle dark/light theme">
                    <svg class="moon-icon" viewBox="0 0 24 24">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                    </svg>
                    <svg class="sun-icon" viewBox="0 0 24 24" style="display: none;">
                        <circle cx="12" cy="12" r="5"></circle>
                        <line x1="12" y1="1" x2="12" y2="3"></line>
                        <line x1="12" y1="21" x2="12" y2="23"></line>
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                        <line x1="1" y1="12" x2="3" y2="12"></line>
                        <line x1="21" y1="12" x2="23" y2="12"></line>
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                    </svg>
                </button>
                <button id="shareButton" class="share-button" title="Share website" aria-label="Share this page">
                    <svg class="share-icon" viewBox="0 0 24 24">
                        <circle cx="18" cy="5" r="3"></circle>
                        <circle cx="6" cy="12" r="3"></circle>
                        <circle cx="18" cy="19" r="3"></circle>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                    </svg>
                </button>
                <button id="menuButton" class="menu-button" aria-label="Open menu">Menu</button>
            </div>
        </div>
    </nav>

    <!-- Mobile Menu -->
    <div id="mobileMenu" class="mobile-menu">
        <div class="mobile-menu-header">
            <div></div>
            <button id="closeMenu" class="close-menu" aria-label="Close menu">&times;</button>
        </div>
        <ul class="mobile-nav-links">
            <li><a href="../index.html">&#8600; Home</a></li>
            <li><a href="../index.html#work">&#8600; Fenix - My AI</a></li>
            <li><a href="../career-highlights.html">&#8600; Career Highlights</a></li>
            <li><a href="../how-id-built-it.html">&#8600; How I'd've Built It</a></li>
            <li><a href="../index.html#my-sandbox">&#8600; MadLab</a></li>
            <li><a href="../index.html#creative-lab">&#8600; Studio</a></li>
            <li><a href="../blog-podcast.html">&#8600; Blog & Podcast</a></li>
            <li><a href="../learning.html">&#8600; Learning & Certifications</a></li>
            <li><a href="../causes.html">&#8600; Causes</a></li>
            <li><a href="../store.html">&#8600; Store</a></li>
            <li><a href="../index.html#contact">&#8600; Connect</a></li>
        </ul>
    </div>

    <!-- Hero -->
    <div class="subpage-hero">
        <div class="hero-title-area">
            <h1 class="subpage-hero-title">{company}</h1>
            <p class="subpage-hero-tagline">Product teardowns and redesign proposals</p>
        </div>
    </div>

    <!-- Breadcrumb -->
    <div class="breadcrumb">
        <a href="../how-id-built-it.html">How I'd've Built It</a>
        <span>/</span>
        <span class="current">{company}</span>
    </div>

    <!-- Products Grid -->
    <div class="products-section" id="products">
        <div class="products-grid">

            <!-- {product} -->
            <a href="{filename}" class="product-card">
                <div class="product-icon">
                    <svg viewBox="0 0 48 48" fill="none">
                        <path d="M8 4h32c2.21 0 4 1.79 4 4v32c0 2.21-1.79 4-4 4H8c-2.21 0-4-1.79-4-4V8c0-2.21 1.79-4 4-4z" stroke="var(--text-primary)" stroke-width="2.5" fill="none"/>
                        <line x1="12" y1="12" x2="36" y2="12" stroke="var(--text-primary)" stroke-width="1.5"/>
                        <line x1="12" y1="20" x2="36" y2="20" stroke="var(--text-primary)" stroke-width="1.5"/>
                        <line x1="12" y1="28" x2="28" y2="28" stroke="var(--text-primary)" stroke-width="1.5"/>
                    </svg>
                </div>
                <div class="product-body">
                    <div class="product-name">{product}</div>
                    <div class="product-tagline">A full teardown of {company}'s {product} - what works, what doesn't, and how I'd rebuild it.</div>
                    <div class="product-sections">
                        <span class="product-section-tag">Discovery</span>
                        <span class="product-section-tag">Keep / Kill / Build</span>
                        <span class="product-section-tag">Redesign</span>
                        <span class="product-section-tag">Business Case</span>
                    </div>
                    <div class="product-cta">
                        Read teardown
                        <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                    </div>
                </div>
            </a>

            <!-- NEW-PRODUCT-CARD -->

        </div>
    </div>

    <!-- Footer -->
    <footer>
        <div class="footer-social">
            <div class="social-links">
                <a href="https://linkedin.com/in/kirangorapalli" class="social-icon linkedin" title="LinkedIn" target="_blank" rel="noopener noreferrer">
                    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"></path></svg>
                </a>
                <a href="https://github.com/iamkiranrao" class="social-icon github" title="GitHub" target="_blank" rel="noopener noreferrer">
                    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"></path></svg>
                </a>
                <a href="https://youtube.com/@kirangorapalli" class="social-icon youtube" title="YouTube" target="_blank" rel="noopener noreferrer">
                    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"></path></svg>
                </a>
                <a href="https://flickr.com/photos/kirangorapalli" class="social-icon flickr" title="Flickr" target="_blank" rel="noopener noreferrer">
                    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="7" cy="12" r="5"></circle><circle cx="17" cy="12" r="5" opacity="0.45"></circle></svg>
                </a>
                <a href="https://open.spotify.com/user/kirangorapalli" class="social-icon spotify" title="Spotify" target="_blank" rel="noopener noreferrer">
                    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"></path></svg>
                </a>
                <a href="https://substack.com/@kirangorapalli" class="social-icon substack" title="Substack" target="_blank" rel="noopener noreferrer">
                    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z"></path></svg>
                </a>
            </div>
        </div>
        <div class="footer-site-info">
            <img src="../images/logo.png" alt="KG Logo" class="footer-logo" role="button" tabindex="0" aria-label="Scroll to top">
            <div class="footer-meta">
                <span class="version-number">v1.0.23</span>
                <span class="footer-meta-sep">&middot;</span>
                <span class="last-updated">Updated Feb 2026</span>
                <span class="footer-meta-sep">&middot;</span>
                <a href="../rss.xml" class="rss-badge" title="Subscribe to RSS feed" target="_blank" rel="noopener noreferrer">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="6.18" cy="17.82" r="2.18"/><path d="M4 4.44v2.83c7.03 0 12.73 5.7 12.73 12.73h2.83c0-8.59-6.97-15.56-15.56-15.56zm0 5.66v2.83c3.9 0 7.07 3.17 7.07 7.07h2.83c0-5.47-4.43-9.9-9.9-9.9z"/></svg>
                    RSS
                </a>
            </div>
        </div>
        <p class="footer-copyright">&copy; 2026 Kiran Gorapalli. All rights reserved.</p>
    </footer>

    <div class="toast" id="toast"></div>

    <script>
        const menuButton = document.getElementById('menuButton');
        const closeMenu = document.getElementById('closeMenu');
        const mobileMenu = document.getElementById('mobileMenu');
        const mobileLinks = document.querySelectorAll('.mobile-nav-links a');

        menuButton.addEventListener('click', () => {{
            mobileMenu.classList.add('active');
            document.body.style.overflow = 'hidden';
        }});
        closeMenu.addEventListener('click', () => {{
            mobileMenu.classList.remove('active');
            document.body.style.overflow = '';
        }});
        mobileLinks.forEach(link => {{
            link.addEventListener('click', () => {{
                mobileMenu.classList.remove('active');
                document.body.style.overflow = '';
            }});
        }});
        document.addEventListener('keydown', (e) => {{
            if (e.key === 'Escape' && mobileMenu.classList.contains('active')) {{
                mobileMenu.classList.remove('active');
                document.body.style.overflow = '';
            }}
        }});

        const themeToggle = document.getElementById('themeToggle');
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {{
            document.documentElement.setAttribute('data-theme', 'light');
            document.querySelector('.moon-icon').style.display = 'none';
            document.querySelector('.sun-icon').style.display = 'block';
        }}
        themeToggle.addEventListener('click', () => {{
            const isLight = document.documentElement.getAttribute('data-theme') === 'light';
            document.documentElement.setAttribute('data-theme', isLight ? '' : 'light');
            localStorage.setItem('theme', isLight ? 'dark' : 'light');
            document.querySelector('.moon-icon').style.display = isLight ? 'block' : 'none';
            document.querySelector('.sun-icon').style.display = isLight ? 'none' : 'block';
        }});

        window.addEventListener('load', () => {{
            document.body.classList.remove('preload');
        }});
        document.querySelector('.footer-logo')?.addEventListener('click', () => {{
            window.scrollTo({{ top: 0, behavior: 'smooth' }});
        }});
    </script>
</body>
</html>"""

    def _update_existing_company_card(self, grid_html: str, company: str, product: str) -> str:
        """Add a new product tag to an existing company card and bump the count."""
        # Find the company card section
        company_lower = company.lower()
        # Look for the card that links to this company's tier 2 page
        card_pattern = rf'(<!-- {re.escape(company)}[^>]*-->.*?</a>)'
        match = re.search(card_pattern, grid_html, re.DOTALL | re.IGNORECASE)
        if not match:
            return grid_html  # Card not found, no change

        card_html = match.group(0)

        # Add product tag if not already present
        if product not in card_html:
            new_tag = f'<span class="company-product-tag">{product}</span>'
            card_html = card_html.replace(
                '</div>\n                </div>\n            </a>',
                f'{new_tag}\n                    </div>\n                </div>\n            </a>',
            )

            # Update teardown count
            count_match = re.search(r'(\d+) teardown', card_html)
            if count_match:
                old_count = int(count_match.group(1))
                new_count = old_count + 1
                card_html = card_html.replace(
                    f'{old_count} teardown',
                    f'{new_count} teardown{"s" if new_count > 1 else ""}',
                )

            grid_html = grid_html[:match.start()] + card_html + grid_html[match.end():]

        return grid_html

    async def publish_teardown(
        self,
        filename: str,
        html_content: str,
        company: str,
        product: str,
        company_card_html: Optional[str] = None,
        tier2_html: Optional[str] = None,
    ) -> dict:
        """Publish a teardown page and update all related files."""
        await self.clone_or_pull()
        changed_files = []

        company_slug = company.lower().replace(" ", "-")
        product_slug = product.lower().replace(" ", "-")

        # 1. Save teardown HTML
        teardown_path = os.path.join(self.local_path, "teardowns", filename)
        os.makedirs(os.path.dirname(teardown_path), exist_ok=True)
        with open(teardown_path, "w", encoding="utf-8") as f:
            f.write(html_content)
        changed_files.append(f"teardowns/{filename}")

        # 2. Mirror to site/
        site_teardown = os.path.join(self.local_path, "site", "teardowns", filename)
        os.makedirs(os.path.dirname(site_teardown), exist_ok=True)
        shutil.copy2(teardown_path, site_teardown)
        changed_files.append(f"site/teardowns/{filename}")

        # 3. Update how-id-built-it.html — auto-generate card if not provided
        grid_path = os.path.join(self.local_path, "how-id-built-it.html")
        if os.path.exists(grid_path):
            with open(grid_path, "r", encoding="utf-8") as f:
                grid_html = f.read()

            # Check if this company already has a card on the grid
            company_has_card = f'teardowns/{company_slug}.html' in grid_html

            if company_has_card:
                # Company exists — add new product tag to existing card
                grid_html = self._update_existing_company_card(grid_html, company, product)
            else:
                # New company — generate and insert card
                if not company_card_html:
                    company_card_html = self._generate_company_card(company, company_slug, product)

                insert_marker = '<!-- NEW-COMPANY-CARD -->'
                if insert_marker in grid_html:
                    grid_html = grid_html.replace(
                        insert_marker,
                        company_card_html + "\n\n            " + insert_marker,
                    )
                elif 'class="company-card coming-soon"' in grid_html:
                    grid_html = grid_html.replace(
                        '<div class="company-card coming-soon"',
                        company_card_html + '\n\n            <div class="company-card coming-soon"',
                        1,
                    )

            with open(grid_path, "w", encoding="utf-8") as f:
                f.write(grid_html)
            changed_files.append("how-id-built-it.html")

            # Mirror to site/
            site_grid = os.path.join(self.local_path, "site", "how-id-built-it.html")
            if os.path.exists(os.path.dirname(site_grid)):
                shutil.copy2(grid_path, site_grid)
                changed_files.append("site/how-id-built-it.html")

        # 4. Create or update Tier 2 company page
        tier2_path = os.path.join(self.local_path, "teardowns", f"{company_slug}.html")
        if os.path.exists(tier2_path):
            # Tier 2 page exists — add new product card to it
            with open(tier2_path, "r", encoding="utf-8") as f:
                tier2_content = f.read()

            if filename not in tier2_content:
                new_product_card = f"""        <a href="{filename}" class="product-card">
            <div class="product-name">{product}</div>
            <div class="product-desc">A full teardown of {company}'s {product} — what works, what doesn't, and how I'd rebuild it.</div>
            <div class="product-cta">Read teardown <svg viewBox="0 0 12 12" fill="none" width="12" height="12"><path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        </a>"""
                product_marker = '<!-- NEW-PRODUCT-CARD -->'
                if product_marker in tier2_content:
                    tier2_content = tier2_content.replace(
                        product_marker,
                        new_product_card + "\n        " + product_marker,
                    )
                with open(tier2_path, "w", encoding="utf-8") as f:
                    f.write(tier2_content)
                changed_files.append(f"teardowns/{company_slug}.html")
        else:
            # New company — generate tier 2 page
            if not tier2_html:
                tier2_html = self._generate_tier2_page(company, company_slug, product, product_slug)
            with open(tier2_path, "w", encoding="utf-8") as f:
                f.write(tier2_html)
            changed_files.append(f"teardowns/{company_slug}.html")

        # Mirror tier 2 to site/
        site_tier2 = os.path.join(self.local_path, "site", "teardowns", f"{company_slug}.html")
        if os.path.exists(os.path.dirname(site_tier2)):
            shutil.copy2(tier2_path, site_tier2)
            tier2_site_path = f"site/teardowns/{company_slug}.html"
            if tier2_site_path not in changed_files:
                changed_files.append(tier2_site_path)

        # 5. Update sitemap (teardown + hub page)
        sitemap_entry = self._make_sitemap_entry(f"teardowns/{filename}")
        hub_sitemap_entry = self._make_sitemap_entry(f"teardowns/{company_slug}.html")
        for sitemap_path in [
            os.path.join(self.local_path, "sitemap.xml"),
            os.path.join(self.local_path, "site", "sitemap.xml"),
        ]:
            if os.path.exists(sitemap_path):
                self._add_to_sitemap(sitemap_path, sitemap_entry)
                self._add_to_sitemap(sitemap_path, hub_sitemap_entry)
                rel = os.path.relpath(sitemap_path, self.local_path)
                if rel not in changed_files:
                    changed_files.append(rel)

        # 6. Update fenix-index.json (teardown + hub entries)
        fenix_changed = self._update_fenix_index(
            company=company,
            company_slug=company_slug,
            product=product,
            product_slug=product_slug,
            filename=filename,
        )
        changed_files.extend(fenix_changed)

        # 7. Commit and push
        commit_msg = f"Add {product} teardown for {company}"
        result = await self.commit_and_push(commit_msg, changed_files)

        return {
            "status": "published",
            "files": changed_files,
            "commit": result,
            "url": f"https://kirangorapalli.com/teardowns/{filename}",
        }

    async def publish_blog_post(
        self,
        slug: str,
        html_content: str,
        card_html: Optional[str] = None,
    ) -> dict:
        """Publish a blog post and update all related files."""
        await self.clone_or_pull()
        changed_files = []

        filename = f"{slug}.html"

        # 1. Save blog post
        blog_path = os.path.join(self.local_path, "blog", filename)
        os.makedirs(os.path.dirname(blog_path), exist_ok=True)
        with open(blog_path, "w", encoding="utf-8") as f:
            f.write(html_content)
        changed_files.append(f"blog/{filename}")

        # 2. Mirror to site/
        site_blog = os.path.join(self.local_path, "site", "blog", filename)
        os.makedirs(os.path.dirname(site_blog), exist_ok=True)
        shutil.copy2(blog_path, site_blog)
        changed_files.append(f"site/blog/{filename}")

        # 3. Update blog-podcast.html if card HTML provided
        if card_html:
            listing_path = os.path.join(self.local_path, "blog-podcast.html")
            if os.path.exists(listing_path):
                with open(listing_path, "r", encoding="utf-8") as f:
                    listing = f.read()
                # Insert after posts grid opening
                if '<!-- NEW-POST-CARD -->' in listing:
                    listing = listing.replace(
                        '<!-- NEW-POST-CARD -->',
                        card_html + '\n<!-- NEW-POST-CARD -->',
                    )
                with open(listing_path, "w", encoding="utf-8") as f:
                    f.write(listing)
                changed_files.append("blog-podcast.html")

                site_listing = os.path.join(self.local_path, "site", "blog-podcast.html")
                shutil.copy2(listing_path, site_listing)
                changed_files.append("site/blog-podcast.html")

        # 4. Update sitemap
        sitemap_entry = self._make_sitemap_entry(f"blog/{filename}")
        for sitemap_path in [
            os.path.join(self.local_path, "sitemap.xml"),
            os.path.join(self.local_path, "site", "sitemap.xml"),
        ]:
            if os.path.exists(sitemap_path):
                self._add_to_sitemap(sitemap_path, sitemap_entry)
                rel = os.path.relpath(sitemap_path, self.local_path)
                if rel not in changed_files:
                    changed_files.append(rel)

        # 5. Commit and push
        commit_msg = f"Publish blog post: {slug.replace('-', ' ').title()}"
        result = await self.commit_and_push(commit_msg, changed_files)

        return {
            "status": "published",
            "files": changed_files,
            "commit": result,
            "url": f"https://kirangorapalli.com/blog/{filename}",
        }

    async def commit_and_push(self, message: str, files: List[str]) -> dict:
        """Stage files, commit, and push to origin."""
        # Stage specific files
        for f in files:
            self._run(["git", "add", f])

        # Check if there's anything staged to commit
        status = self._run(["git", "status", "--porcelain"])
        if not status.strip():
            # Nothing changed — files are identical to what's in the repo
            commit_hash = self._run(["git", "rev-parse", "HEAD"])
            return {
                "hash": commit_hash[:8],
                "message": "(no changes — already up to date)",
                "files_changed": 0,
            }

        # Commit
        self._run(["git", "commit", "-m", message])

        # Push
        self._run(["git", "push", "origin", "main"])

        commit_hash = self._run(["git", "rev-parse", "HEAD"])
        return {
            "hash": commit_hash[:8],
            "message": message,
            "files_changed": len(files),
        }

    def _make_sitemap_entry(self, path: str) -> str:
        """Create a sitemap XML entry."""
        today = datetime.now().strftime("%Y-%m-%d")
        return f"""  <url>
    <loc>https://kirangorapalli.com/{path}</loc>
    <lastmod>{today}</lastmod>
    <priority>0.8</priority>
  </url>"""

    def _add_to_sitemap(self, sitemap_path: str, entry: str):
        """Add an entry to a sitemap file."""
        with open(sitemap_path, "r", encoding="utf-8") as f:
            content = f.read()

        if entry.split("\n")[1].strip() in content:
            return  # Already exists

        content = content.replace("</urlset>", f"{entry}\n</urlset>")

        with open(sitemap_path, "w", encoding="utf-8") as f:
            f.write(content)

    def _update_fenix_index(
        self,
        company: str,
        company_slug: str,
        product: str,
        product_slug: str,
        filename: str,
    ) -> list:
        """Add teardown and hub entries to fenix-index.json. Returns list of changed files."""
        changed = []
        index_path = os.path.join(self.local_path, "fenix-index.json")
        if not os.path.exists(index_path):
            return changed

        with open(index_path, "r", encoding="utf-8") as f:
            index_data = json.load(f)

        content_list = index_data.get("content", [])
        teardown_id = f"{company_slug}-{product_slug}-teardown"
        hub_id = f"{company_slug}-hub"

        # Check if teardown entry already exists
        teardown_exists = any(c["id"] == teardown_id for c in content_list)
        hub_exists = any(c["id"] == hub_id for c in content_list)

        if not teardown_exists:
            teardown_entry = {
                "id": teardown_id,
                "type": "teardown",
                "title": f"{company} {product} Teardown",
                "url": f"/teardowns/{filename}",
                "company": company,
                "industry": "",
                "focusArea": f"{product} experience analysis",
                "persona": {"name": "", "context": ""},
                "sections": [
                    {"id": "discovery", "title": "Discovery", "number": "01", "components": ["persona", "journey-sentiment-map", "jtbd-callout"]},
                    {"id": "keep-kill-build", "title": "Keep / Kill / Build", "number": "02", "components": ["kkb-grid"]},
                    {"id": "redesign", "title": "The Redesign", "number": "03", "components": ["wireframes"]},
                    {"id": "business-case", "title": "The Business Case", "number": "04", "components": ["kpi-grid"]},
                ],
                "skills": ["customer-research", "journey-mapping", "persona-development", "keep-kill-build-analysis", "wireframing", "business-case-development", "competitive-analysis"],
                "themes": [],
                "status": "published",
                "connections": [
                    {"id": hub_id, "relationship": "parent-hub", "description": f"Listed on the {company} company hub page"}
                ],
                "summary": f"Product teardown of {company}'s {product}. Covers persona research, customer journey mapping, keep/kill/build analysis, wireframe redesign proposals, and business case with projected KPIs.",
            }
            content_list.append(teardown_entry)

        if not hub_exists:
            hub_entry = {
                "id": hub_id,
                "type": "teardown-hub",
                "title": f"{company} Teardowns",
                "url": f"/teardowns/{company_slug}.html",
                "company": company,
                "industry": "",
                "status": "published",
                "connections": [
                    {"id": teardown_id, "relationship": "child-teardown", "description": f"{company} {product} teardown"}
                ],
                "summary": f"Company hub page for {company} product teardowns. Currently features the {product} teardown.",
            }
            content_list.append(hub_entry)
        elif not teardown_exists:
            # Hub exists but this is a new teardown — add connection
            for entry in content_list:
                if entry["id"] == hub_id:
                    connections = entry.get("connections", [])
                    if not any(c["id"] == teardown_id for c in connections):
                        connections.append({"id": teardown_id, "relationship": "child-teardown", "description": f"{company} {product} teardown"})
                        entry["connections"] = connections
                    break

        if not teardown_exists or not hub_exists:
            index_data["content"] = content_list
            index_data["lastUpdated"] = datetime.now().strftime("%Y-%m-%d")
            tmp_path = index_path + ".tmp"
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(index_data, f, indent=2, ensure_ascii=False)
                f.write("\n")
            os.replace(tmp_path, index_path)
            changed.append("fenix-index.json")

        return changed
