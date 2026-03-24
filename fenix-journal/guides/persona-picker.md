---
module: persona-picker
title: Persona Picker
created: 2026-03-20
last_updated: 2026-03-23
version: 1.1
---

# Persona Picker

## Overview

Persona Picker is a one-time conversion tool on the kirangorapalli.com landing page that asks visitors to select one of 6 illustrated personas. Each persona represents a different archetype (role, industry, career stage) within Kiran's target audience. Selection personalizes the Fenix chat agent experience — greeting, suggested prompts, tone, depth, and accent color in the widget. The main site (index.html) is universal; persona-driven customization lives in Fenix.

The tool serves anyone who visits the site — it's the front door to a personalized guide experience, not a recruitment-specific funnel. The 6 personas are: Evaluator (Merritt), Seeker (Phil), Practitioner (Drew), Learner (Paige), Technologist (Ray Turing — replaced Explorer in Mar 2026), and Inner Circle (Keshav). Practitioner was reframed from PM-specific to cross-disciplinary ("Product · Design · Data").

Persona Picker is built with vanilla HTML/CSS/JS (zero dependencies) for maximum performance and hosting flexibility. Character portraits are Midjourney-generated, optimized as WebP with PNG fallbacks. Visual design uses glassmorphism (backdrop-filter blur) with persona-specific accent lighting.

---

## Architecture

### Frontend Stack

**Technology:** Vanilla HTML/CSS/JS (no frameworks)
- **No build process needed** — Single HTML file deployable anywhere
- **Performance:** First contentful paint <1s even on slow connections
- **Progressive enhancement:** Works without JavaScript (displays all personas as fallback)

**Production File:** `persona-picker-v4-production.html` (source of truth)
- Live file on site: `persona-picker.html` (symlink or copy from production)
- Versioning: Multiple iterations exist (`v1`, `v2`, `v3`); v4 is current

**Key Components:**

1. **Persona Selection Grid:**
   - 6 cards, each with Midjourney-generated portrait (3:4 aspect ratio)
   - Persona name, title, and brief 1-2 sentence description
   - Click to select (hover effect: scale, shadow, glow)
   - Radio button state management in JavaScript

2. **Character Portraits:**
   - Image pipeline: Midjourney PNG (44MB total for all 6) → optimized WebP (600KB total) + PNG fallbacks
   - Persona-colored accent lighting (e.g., blue glow for "Engineer" persona, warm gold for "Creative Director")
   - 3:4 aspect ratio, high-res (2400x3200px at 1x scale)
   - Lazy-loaded to defer image fetch until user interacts

3. **Glassmorphism UI:**
   - `backdrop-filter: blur(10px)` on card backgrounds
   - Semi-transparent white/dark overlay (rgba)
   - Frosted glass effect against hero background image
   - CSS custom properties for theming by persona

4. **Selection Animation:**
   - Choreographed reveal on submit:
     - Fade out persona picker (150ms)
     - Hero section slides in from bottom (300ms)
     - Content reorders based on persona (fade in, staggered, 100-200ms per section)
     - Fenix chat window personalizes (if open)
   - CSS transitions + JavaScript setTimeout for orchestration

5. **Persona Personalization Logic:**
   - Stored in localStorage: `@persona_selected` (persona ID)
   - On page load, check localStorage and apply styles/reorder without re-showing picker
   - All subsequent pages inherit persona until browser session clears

### Persona Definitions

6 personas with unique visual identities (full diversity matrix, no overlapping demographics):

1. **Engineer (Tech Lead)**
   - Accent color: Electric blue (#0061FF)
   - Industries: Apple, Google, Anthropic (IC5+, staff engineer level)
   - Content priority: Technical depth, architecture decisions, code samples
   - Fenix behavior: More technical, deeper explanations, assume familiarity with systems design

2. **Product Manager**
   - Accent color: Vibrant teal (#00D4FF)
   - Industries: Apple, Google, Disney
   - Content priority: Impact metrics, user insights, product strategy
   - Fenix behavior: Business outcomes focus, metrics-first, roadmap thinking

3. **Designer / Creative Director**
   - Accent color: Warm gold (#FFB84D)
   - Industries: Adobe, Pixar, Disney
   - Content priority: Visual work, design systems, creative process
   - Fenix behavior: Design philosophy, aesthetic decisions, collaboration style

4. **Startup Founder**
   - Accent color: Coral pink (#FF6B6B)
   - Industries: Early-stage, self-started ventures
   - Content priority: Scrappy execution, metrics on a budget, growth hacks
   - Fenix behavior: Pragmatic, cost-conscious, rapid iteration mindset

5. **Academic / Researcher**
   - Accent color: Deep purple (#7C3AED)
   - Industries: University, research labs, Anthropic (research track)
   - Content priority: Papers, peer review, evidence-based thinking
   - Fenix behavior: Rigorous, source-focused, systematic

6. **Executive / VP**
   - Accent color: Slate gray (#64748B)
   - Industries: C-suite, VP+ roles at FAANG
   - Content priority: Leadership philosophy, team scaling, org design
   - Fenix behavior: High-level strategic, assumes delegation, emphasizes ROI

**Diversity Matrix (ensured no overlap):**
- Age: 20s, 30s, 40s, 50s, gender, ethnicity, body type all represented
- None of the 6 personas are duplicates or similar archetypes
- All illustrated by Midjourney with specific diversity directives in prompts

### Image Optimization Pipeline

**Original:** Midjourney PNG exports (full-res, 8-12MB per image)
1. **Bulk resize:** Reduce to 2400x3200px (3:4 aspect, web-appropriate size)
2. **Convert to WebP:** 80% quality setting → ~100KB per image (600KB total for 6)
3. **PNG fallback:** Keep original PNG for older browsers
4. **Lazy loading:** `loading="lazy"` on all `<img>` tags
5. **srcset variants:** Offer 1x and 2x resolution for retina displays (optional, may exceed payload)

**Current Status:**
- WebP + PNG fallbacks live on site
- Total payload for 6 portraits: ~700KB (WebP 600KB + PNG fallbacks 100KB)
- Load time: <500ms on 4G

### Page Integration

**Landing Page Flow:**
1. User visits kirangorapalli.com
2. Above the fold: Persona Picker modal appears
3. User selects one persona and clicks "Continue"
4. JavaScript stores choice in localStorage
5. Persona Picker fades out, rest of site fades in with personalized content order
6. All subsequent pages on site inherit the persona (same session)

**State Management:**
- `@persona_selected` in localStorage: string ID ("engineer", "pm", "designer", etc.)
- `@persona_onboarded` flag: shows picker only once per session
- On each page load: read localStorage, apply CSS custom properties, reorder content divs

---

## Key Decisions

**March 2026 — Vanilla JS Over Framework**
Chose vanilla HTML/CSS/JS instead of React/Vue to eliminate build process and framework overhead. The interaction is simple (select one of six, store choice, apply CSS class). Framework would be overkill and slow down Time to Interactive (TTI). Payoff: instant deployment, no build secrets, portable across any hosting.

**Midjourney Portraits Over Photography**
Selected Midjourney AI generation over hiring a photographer. Rationale: consistency in style across all 6 personas, faster iteration on visual tweaks, no licensing concerns. Trade-off: slight risk of "AI-generated look," but intentional artistic direction mitigates this.

**Glassmorphism for Futuristic Feel**
Chose backdrop-filter blur and semi-transparent overlays to create a premium, tech-forward aesthetic. This signals to dream company recruits (tech-savvy, design-conscious) that Kiran understands design trends. Trade-off: CSS backdrop-filter not supported on old browsers; graceful fallback to solid background color.

**6 Personas, Not 3 or 10**
Validated that 6 is the optimal number: enough diversity to cover target audience (engineer, PM, designer, founder, researcher, executive) without overwhelming decision paralysis. 3 would miss key segments; 10 would feel excessive.

**One-Time Selection, Not Persistent Toggle**
Persona selection happens once (on landing page) and persists in localStorage for the entire session. No "Change Persona" button on every page (this creates decision fatigue and undermines the personalization intent). If user wants to reset, they can clear localStorage manually or start a new browser session.

**Personalization Scoped to Fenix + Visual Touches (March 23, 2026)**
index.html is a universal page — same for everyone. Personalization is scoped to:
- Fenix chat agent (greeting, prompts, tone, depth, accent color in widget)
- Track 1 visual touches (tagline swap, card reorder, accent color thread, etc.)
- Track 2 functional unlocks (per-persona exclusive features in a two-column component)
Content reordering across the full site was considered and rejected — the content speaks for itself, and Fenix is where personalization has the highest leverage.

**Target: 30-50 Hand-Picked, Not Viral**
Persona Picker is NOT designed for viral scale or mass traffic. It's a bespoke recruitment tool for hand-picked contacts at dream companies. This shapes every decision: high visual quality (not optimized for mobile), narrow targeting (specific personas), manual outreach (emails with personalized links pre-selecting a persona).

---

## Evolution

**Phase 1: Concept & Persona Design (Jan 2026)**
Defined 6 target personas based on dream company recruiting goals. Created detailed persona briefs (goals, pain points, content preferences). Validated with sample audience.

**Phase 2: Midjourney Art Direction (Feb 2026)**
Wrote detailed Midjourney prompts for character generation. Generated 50+ variations per persona. Selected 6 final portraits with accent lighting. Began image optimization (WebP conversion, lazy loading).

**Phase 3: v1 Prototype (Feb 2026)**
Built vanilla HTML/CSS/JS prototype with hardcoded personas. Implemented selection, localStorage, and basic personalization (accent color change). Tested on mobile/desktop.

**Phase 4: Runway Video (In Progress)**
Produced Runway Gen-4 hero video for video background (replaces static image behind persona picker). ~10-15 seconds looping, cinematic, tech-forward aesthetic. Status: nearly complete, pending final render.

**Phase 5: HeyGen Pixar Avatar Video (Planned, Not Started)**
Plan to generate personalized welcome video for each persona using HeyGen's Pixar-style avatar generator. Video greeting: "Hi [Name], thanks for selecting the [Persona] path. Here's what you'll discover..." Will be background video on post-selection hero section.

---

## Current State

**Phases 1-4: COMPLETE**
- ✅ Persona definitions finalized
- ✅ Midjourney character portraits generated and optimized (600KB WebP total)
- ✅ Vanilla HTML/CSS/JS picker implemented and deployed
- ✅ localStorage state management working
- ✅ Full site personalization (content reorder, Fenix behavior, accent colors) live
- ✅ Runway Gen-4 video nearly complete

**Phase 5: NOT STARTED**
- ⏳ HeyGen Pixar avatar videos: Planned for future iteration

**Files:**
- Production source: `/Users/kiran/Kiran's Website/persona-picker-v4-production.html`
- Live file: `persona-picker.html` (on kirangorapalli.com)
- Images: `assets/personas/` directory (WebP + PNG fallbacks)
- Midjourney exports: `prototypes/persona-picker/midjourney-exports/` (archival)

**Metrics:**
- Load time: <1s (FCP), <2s (LCP)
- WebP total: 600KB, PNG fallbacks: 100KB
- TTI (Time to Interactive): <800ms on 4G

---

## Known Issues & Limitations

**CSS Backdrop-Filter Support**
Not supported in Firefox (as of March 2026) or older versions of Safari. Graceful fallback is solid background color, which loses the glassmorphism effect. Trade-off accepted because target audience (FAANG engineers) uses modern browsers.

**Persona Selection Not Reversible (Without Developer Tools)**
Once selected, user can't change persona without clearing localStorage (not user-friendly). Could add a "Change Persona" button, but would complicate the design and might increase decision fatigue.

**Midjourney Image Specificity Risk**
If Midjourney adds watermarks or changes image generation style, existing portraits could look dated. Also, no control over likeness or uniqueness — another user could generate very similar personas.

**HeyGen Avatar Quality**
Planned Phase 5 (Pixar avatars) assumes HeyGen quality is sufficient for the premium aesthetic. If avatars look uncanny or robotic, the effect could be detrimental.

**Mobile UX Ambiguity**
On mobile, the 6-persona grid takes vertical space. Some users might scroll past without seeing the picker. Could be solved with full-screen modal, but would change the desktop experience.

**Targeting Leakage**
Persona Picker is intended for hand-picked contacts, but if the link goes public (shared on social media), unintended traffic could arrive. No way to restrict personas to specific companies/emails.

---

## Ideas & Future Direction

**Personalized Landing Links**
Generate unique URLs with pre-selected personas (e.g., `kirangorapalli.com/?persona=engineer`) for personalized outreach. Send these links in recruitment emails so the recipient's journey is immediately personalized.

**A/B Testing Personas**
Collect analytics on which personas are selected most by traffic source, geography, referrer. Use data to refine messaging or add/remove personas.

**Dynamic Persona Matching**
Use Fenix AI to infer persona from initial chat message, auto-select for user without explicit click. "I see you're asking about system design — I've tailored the site for engineers."

**Persona-Specific CTA**
After selection, show personalized call-to-action (e.g., "Engineer → View the technical deep-dive" vs. "PM → See the business metrics").

**Animated Transitions Between Personas**
If user does get a "Change Persona" option, animate the transition (content cards slide out, new accent color fades in, etc.).

**Video Version of Personas**
Short 10-second bio videos for each persona (using HeyGen avatars or real actors) that play on selection. Creates deeper emotional connection.

**Persona-Specific Resume**
Generate different resume versions for different personas (emphasize technical skills for engineers, product strategy for PMs, etc.). Link in persona-specific footer or sidebar.

**Social Proof by Persona**
Show testimonials from people with the same persona ("Appreciate the technical depth here. — Senior Engineer, Google").

---

## Relationship to Other Components

**Persona Picker is independent** — it lives on the static site (kirangorapalli.com) and doesn't depend on Command Center or Fenix backend. However, it does integrate with Fenix chat to personalize responses.

**Fenix Assistant** reads the `@persona_selected` localStorage value and adjusts its system prompt accordingly. Same conversation engine, different context per persona.

**Content across the site** (portfolio pages, case studies, about section) is reordered based on persona, but the actual content is unchanged — just displayed in different priority order.

---

## Source Sessions

- **2026-01-20** — Initial concept: targeting dream companies with personalized site experience
- **2026-02-05** — Midjourney art direction and persona character development
- **2026-02-18** — v4 vanilla JS implementation and full site integration
- **2026-03-10** — Runway video generation and optimization
- **2026-03-20** — Documentation and Phase 5 planning (HeyGen avatars)
