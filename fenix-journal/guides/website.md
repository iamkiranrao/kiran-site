---
module: website
title: Portfolio Website (kirangorapalli.com)
created: 2026-03-11
last_updated: 2026-03-12
version: 2
---

# Portfolio Website

## Overview

The portfolio website at kirangorapalli.com is Kiran's personal brand platform — part professional showcase, part creative playground. It's a static HTML/CSS/JavaScript site with no build tools, hosted on Cloudflare Pages and connected to a Fenix AI backend for an embedded conversational assistant. The site showcases product work, creative projects, professional insights, and AI experiments in an authentic, understated design.

## Architecture

**Technology Stack:**
- **Markup**: Vanilla HTML5, no frameworks
- **Styling**: Vanilla CSS3 with CSS custom properties (variables) for theme switching, Inter font from Google Fonts
- **JavaScript**: Vanilla JS (no npm dependencies) for client-side interactions
- **Hosting**: Cloudflare Pages for the static site, Vercel for the Fenix backend API
- **Domain**: kirangorapalli.com (custom domain, previously on Netlify, migrated to Cloudflare Pages)
- **Analytics**: Google Analytics 4 + Microsoft Clarity

**File Structure:**
```
├── index.html               (main landing page, ~455 lines)
├── styles.css              (all CSS, organized by section, ~1,190 lines)
├── app.js                  (~405 lines, theme toggle, share modal, mobile menu, smooth scroll, logo scroll-to-top)
├── translations.js         (8-language i18n system, currently disabled but architecture preserved)
├── evaluator-experience.js (evaluator persona page: chat module, cards, panels, agentic Fenix with tool use + dynamic pills)
├── evaluator-styles.css    (evaluator page styles: chat, cards, panels, pills, streaming, tool messages)
├── fenix-widget.js         (embedded AI chat overlay, SSE streaming — non-evaluator pages)
├── fenix-widget.css        (chat widget styles, 400px wide, bottom-right positioned)
├── blog/                   (blog post HTML files)
├── teardowns/              (product teardown pages)
├── prototypes/             (working demos: insurance-chatbot, hr-onboarding-bot, etc.)
├── images/                 (logo.png, favicon.png, fenix-avatar.png, fenix-section.png)
├── sitemap.xml             (SEO)
├── rss.xml                 (RSS feed)
└── site/                   (production-ready copy for deployment)
```

**Design Language:**
- **Dark theme by default** (#0a0a0a background, #f0e6d3 warm off-white text)
- **Light mode toggle** in nav bar (theme state persists in localStorage)
- **Typography**: Inter font family with fallback stack (system fonts)
- **Spacing**: Responsive breakpoints at 1400px, 1200px, 1024px, 768px, 480px
- **Accent colors**: Warm retro off-white (#f0e6d3) for text, borders, icons
- **Design inspiration**: Framer "Bent" template — minimal, editorial, two-column layouts with vertical dividers

**Key Features:**
- Fixed navigation bar (top-right) with theme toggle, share button, language selector (disabled), menu button
- Static top bar (non-fixed) with logo, version number (v1.0.0), last updated date
- Hero section with placeholder video (5:2 aspect, 1920×768)
- About section with social icons (GitHub, LinkedIn, Flickr, Spotify, Medium)
- Fenix AI assistant section (chat widget overlay)
- Work/Teardown section (8 cards: Career Highlights, MadLab, Studio, Learning & Certifications, Causes, Blog & Podcast, Store, How I'd've Built It)
- Contact section with email CTA
- Feedback form (AJAX submission to backend API)
- Testimonials submission form (AJAX submission to backend API)
- Footer with social icons, site info (logo + version + date), copyright

## Key Decisions

**Feb 6, 2026 — Started from scratch with site structure**
- Decided on vanilla HTML/CSS/JS (no framework) for simplicity and control
- Chose dark theme as default, added light mode toggle
- Planned 8 main sections: About, Fenix, Work, Consulting, Blog, Causes, Release Notes, Contact

**Feb 11, 2026 — Publishing strategy and GitHub setup**
- Decided to use GitHub for version control and code management
- Chose Netlify (later Cloudflare Pages) for hosting with auto-deploy from GitHub
- Structured workflow: local editing with Claude → push to GitHub → auto-deploy to live site

**Feb 12, 2026 — File restructuring for maintainability**
- Monolithic 401KB HTML file split into modular structure: separate HTML, CSS, JS, translations
- HTML reduced from ~2,700 lines to ~455 lines
- Created `site/` folder with production-ready files for deployment
- Extracted 4 base64-encoded images (56KB each) to separate image files in `images/` folder
- Result: 93.6% file size reduction while maintaining full functionality

**Feb 14, 2026 — Visual design alignment with Bent template**
- Analyzed Framer's Bent template and decided to adopt its aesthetic
- Kept all unique features (Fenix assistant, translations, extra sections) while styling like Bent
- Disabled language selector temporarily (preserved for future re-activation) to match Bent's English-only approach
- Fine-tuned nav buttons, typography, spacing to match Bent's minimal style

**Feb 14-15, 2026 — Visual refinements**
- Changed nav buttons from transparent outlines to filled backgrounds (white/off-white depending on theme)
- Updated dark mode icon visibility (moon/sun SVG strokes now use `var(--text-primary)`)
- Changed scroll-down arrow from `↓↓` to `↘` (south-east diagonal arrow)
- Increased section label font size from `1.375rem` to `1.75rem` for better hierarchy
- Increased button font size by 7% across all buttons for legibility
- Added `target="_blank"` and `rel="noopener noreferrer"` to all social links for security

**Feb 18, 2026 — Content strategy and audit**
- Renamed AI assistant from "Arlo" to "Fenix" everywhere (30 occurrences)
- Menu label updates: "About Me" → "About", "Meet Fenix" → "Fenix — My AI", "My MadLab" → "MadLab", "Creative Studio" → "Studio"
- Removed "Release Notes" from navigation (low priority)
- Removed Fenix video placeholder section (feature moved to text description)

**Feb 25-26, 2026 — Content population**
- Populated 6 work card descriptions through collaborative copywriting:
  - Career Highlights: "Take a look at what I've accomplished during my product journey so far..."
  - MadLab: "Apps, tools, and prototypes built from scratch — my sandbox for tinkering and experimentation."
  - Studio: "My creative playground — art, video, and experiments born from curiosity and wherever the rabbit holes lead."
  - Learning & Certifications: "Lifelong learner. The real value isn't the credential — it's the new lens it gives you on problems you thought you already understood."
  - Causes: "Where I put my time and energy when it's not about product."
  - Store: "Coming soon."
- Added visual separator (horizontal border lines) around Fenix intro section
- Tightened copy throughout for clarity and directness

**Mar 6, 2026 — Feedback and testimonials system**
- Wired feedback form to backend API (`https://api.kirangorapalli.com/api/feedback/submit`)
- Wired testimonial form to backend API (`https://api.kirangorapalli.com/api/feedback/testimonial/submit`)
- Changed submission from Netlify Forms to custom FastAPI backend for more control
- Created Supabase tables (`site_feedback`, `testimonials`) to persist submissions
- Built admin dashboard in Command Center for managing feedback and testimonials

## Evolution

**Feb 6 — Initial build** — Created basic structure with 8 planned sections, started with vanilla HTML/CSS, established dark mode default.

**Feb 11 — GitHub + Netlify** — Set up version control and auto-deploy workflow. Established repeatable process: edit locally, push to GitHub, Netlify deploys automatically.

**Feb 12 — Refactored from monolith to modular** — Split 401KB single HTML file into separate HTML, CSS, JS, and translations files. Reduced site footprint from 401KB to ~26KB HTML + supporting files.

**Feb 14-15 — Framer Bent aesthetic** — Analyzed Bent template and began styling refinements. Multiple rounds of feedback on nav buttons, icons, typography, spacing. Went from transparent buttons to filled backgrounds with high-contrast icons.

**Feb 18 — Content and UX audit** — Renamed Fenix, reorganized menu, removed dead features (video placeholder, release notes), added visual separators.

**Feb 25-26 — Content population sprint** — Wrote descriptions for all work cards through collaborative iteration. Tightened copy. Added spacing adjustments to feedback forms.

**Mar 6 — Backend integration** — Migrated from Netlify Forms to custom FastAPI backend. Wired feedback and testimonial forms to hit the backend API instead. Created Supabase tables and built admin dashboard.

## Current State

**What works:**
- Full dark/light theme switching with localStorage persistence
- Fixed nav bar with all controls functional (theme toggle, share modal, mobile menu button)
- Smooth scroll anchors to all sections
- Hero section with responsive video placeholder
- All 8 work cards with accessible links and descriptions
- Social icon links (GitHub, LinkedIn, Flickr, Spotify, Medium)
- Feedback form submission to backend API with error handling and user feedback
- Testimonial form submission with rating selector (5 smileys) and optional comment
- Footer with social icons, site metadata, copyright
- Mobile-responsive layout at all breakpoints
- SEO foundations (sitemap, robots.txt, OG meta tags, structured data)
- RSS feed for blog posts
- Fenix floating chat widget (embedded AI assistant)

**In progress / recently completed:**
- Command Center admin dashboard for feedback/testimonials (deployed Mar 6)
- Backend feedback API endpoints (deployed Mar 6)
- Supabase tables for persistent feedback storage (created Mar 6)

**Known limitations:**
- Feedback/testimonial forms rely on backend being live at `api.kirangorapalli.com` — if API is down, forms will show "something went wrong"
- Language selector is disabled but code preserved — re-enabling requires uncommenting translations.js script and removing the `if (translationsEnabled)` gates in app.js
- Hero video is placeholder (5:2 aspect ratio, 1920×768 dimensions) — actual video needs to be sourced and embedded

## Known Issues & Limitations

1. **Backend dependency** — Forms fail gracefully if the Fenix backend API is unavailable. Users see error messages. No offline fallback.

2. **Translations disabled** — 8-language support (EN, ES, FR, DE, ZH, JA, PT, HI) is architecturally preserved but disabled. To re-enable: uncomment `<script src="translations.js"></script>` in HTML and remove `if (translationsEnabled)` checks in app.js.

3. **Hero video placeholder** — The 5:2 aspect ratio (1920×768) video section currently shows a fallback message. A real video needs to be sourced, encoded, and embedded.

4. **Release notes removed** — The release notes section was removed from nav and main page (decided Feb 18, 2026), but CSS classes and remnants may exist in styles.css.

5. **Work cards "coming soon"** — Several work card sections (like "How I'd've Built It", "Blog & Podcast") have mock data and "coming soon" alerts. These need full landing pages built (handled in Command Center's teardown/madlab builders).

## Ideas & Future Direction

**Short-term (next sprint):**
- Build individual landing pages for all 8 work cards using Command Center teardown builder
- Populate MadLab prototypes gallery with 7 categories (Chatbots, Agentic AI, Voice AI, Computer Vision, Browser Extensions, Data Viz, Automations)
- Populate Studio gallery with creative work (Music, Videos, Fonts, Posters, Postcards, AI Art)
- Set up live video for hero section (4-second loop, 1920×768)

**Medium-term:**
- Re-enable translations (currently disabled but architecture ready)
- Build analytics dashboard in Command Center to review feedback/testimonial trends
- Implement SEO enhancements (meta tags, structured data, Open Graph images)
- Add shopping cart to Store section with Stripe integration

**Long-term:**
- Content recommendation engine (see `fenix.md` guide for AI assistant evolution plans)
- Custom domain for Fenix API (currently api.kirangorapalli.com)

**Deferred/deprioritized:**
- Email capture for newsletter (Causes section mentions audience but no subscription form)
- Consulting booking system (ProductIncite.com link exists but no embedded booking)
- Blog comment system (blog posts exist but no commenting)

---

## Source Sessions

Key sessions informing this guide:
- 2026-02-06-091554-building-kirans-personal-website-from-scratch.md — Initial structure, design decisions, content planning
- 2026-02-11-043308-publishing-and-hosting-a-website-with-github.md — GitHub + Netlify strategy, deployment workflow
- 2026-02-12-015100-uploadedfiles.md — File restructuring, monolith-to-modular refactor, 93.6% size reduction
- 2026-02-14-084436-im-iterating-on-my-personal-portfolio-website-heres.md — Framer Bent aesthetic alignment, visual refinements, typography
- 2026-02-18-081049-im-continuing-work-on-my-personal-portfolio-site.md — Content audit, menu restructuring, Fenix renaming, strategy document
- 2026-02-25-030851-i-want-to-try-and-finish-populating-content.md — Content population, card descriptions, MadLab/Studio category design
- 2026-03-06-230119-in-my-website-landling-page-indexhtml---the.md — Feedback/testimonials system, backend API integration, Supabase setup
