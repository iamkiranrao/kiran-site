---
module: scannibal
title: Scannibal
created: 2026-03-20
last_updated: 2026-03-20
version: 1
---

# Scannibal

## Overview

Scannibal is a multi-modal AI safety scanner iOS app that helps users make informed decisions about food, products, supplements, plants, and household items. Point your camera at a label, menu, skincare product, or plant — Scannibal analyzes the image and ingredients using Google Gemini 2.5 Flash to provide personalized safety guidance. Currently in TestFlight beta with a planned paid tier post-launch.

The app is built with Expo/React Native for cross-platform potential, uses a distinctive "darkly sophisticated" butler persona (consistent with brand identity), and integrates with two charities: **Feeding America** and **Best Friends Animal Society**. 100% of net proceeds from the paid tier go to these partners, chosen during user onboarding.

Scannibal operates in 9 scan modes: Food Label, Menu, Supplement, Skincare, Plant, Household, Baby, Pet, and General. Each mode uses the same Claude/Gemini pipeline but with context-specific prompts and safety thresholds.

---

## Architecture

### Frontend Stack

**Framework:** Expo with React Native
- **Not vanilla Swift** — chosen Expo for cross-platform capability (iOS + Android roadmap)
- **Navigation:** Expo Router (file-based routing)
- **State Management:** React Context + AsyncStorage for local persistence
- **UI Library:** React Native Paper or custom components with consistent dark theme

**Key Components:**
- **Camera Screen:** Point-and-shoot interface with scan mode selector dropdown
- **Results View:** Safety assessment with risk indicators, ingredient breakdown, and personalized notes
- **Settings:** Default charity preference, scan history, app version
- **Onboarding:** First-launch wizard selecting primary charity (Feeding America or Best Friends) and explaining Scannibal's purpose

**Scan Modes (9 total):**
1. **Food Label** — Nutritional info, allergens, additives; focus on processing claims
2. **Menu** — Restaurant meals; context on preparation, cross-contamination
3. **Supplement** — Vitamins, herbs, powders; efficacy and interaction warnings
4. **Skincare** — Cosmetics, sunscreen, moisturizers; ingredient safety and irritants
5. **Plant** — Indoor/outdoor plants; toxicity to humans and pets
6. **Household** — Cleaning products, chemicals; safety in homes with children/pets
7. **Baby** — Products, foods, safety for infants/toddlers; developmental stage context
8. **Pet** — Pet food, treats, toys; species-specific toxicity (dogs, cats, etc.)
9. **General** — Fallback for anything not captured above

**Persona Integration:**
- All responses use the "Butler" voice: darkly witty, sophisticated, protective yet unflappable
- Example: "Ah, titanium dioxide at 2.5%. Quite standard for mineral sunscreen, though I'd note the potential for respiratory concern in powder form. Shall we review safer alternatives?"
- Voice consistency across all scan results and error states

### Backend Stack

**API Gateway:** FastAPI at `https://api.kiranrao.ai`
- **Vision Analysis Endpoint:** `POST /api/v1/scannibal/analyze` — receives base64-encoded image + scan mode
- **Charity Selection Endpoint:** `POST /api/v1/scannibal/onboarding/charity` — records user's primary charity choice
- **Scan History Endpoint:** `GET /api/v1/scannibal/history` (requires session token) — retrieves past scans

**Vision Model:** Google Gemini 2.5 Flash
- **Why Gemini over GPT-4V:** Significantly faster (critical for mobile UX), 80% cost reduction, superior food/ingredient recognition
- **Latency target:** <3 seconds image-to-response on 5G; <5 seconds on 4G
- **Rate limits:** Structured to batch requests (max 60 per minute per user session)

**Integration Points:**
- Image received from Expo Camera → base64 encoded → sent to `/api/v1/scannibal/analyze`
- Gemini processes with scan-mode-specific system prompt
- Response parsed and formatted in Butler persona before returning to app
- Session ID tracked for history and telemetry

### Database Stack

**Supabase:**
- `scannibal_scans` — Records of all scans: user_id (sessionId), image_hash, scan_mode, gemini_response, created_at
- `scannibal_charity_preferences` — User's chosen charity and percentage allocation (100% to one partner currently, extensible to split)
- `scannibal_feedback` — Optional user feedback on scan accuracy (thumbs up/down, notes)

**Local Storage (AsyncStorage):**
- `@scannibal_session_id` — Persisted session identifier
- `@scannibal_charity_choice` — User's selected charity (Feeding America = 'fa', Best Friends = 'bfa')
- `@scannibal_onboarded` — Flag to skip onboarding on re-launch
- `@scannibal_scan_history_ids` — List of recent scan IDs for offline access

### Charity Integration

**Post-Beta Paid Tier Pricing:**
- **Supporter Subscription:** $2.99/month or $29.99/year
- **Free Tier (permanent):** 50 scans/day, no voice narration
- **Paid Tier:** Unlimited scans + voice narration of results (ElevenLabs)

**Revenue Flow:**
- 100% of subscription revenue after Stripe fees and operational costs → split between Feeding America (60%) and Best Friends (40%) by default
- Users can override split during onboarding: choose primary, secondary, or exclusively one
- Monthly settlement reports sent to both organizations with detailed metrics

**Verification:**
- Feeding America: 4-star Charity Navigator rating, 501(c)(3), EIN 13-3722829
- Best Friends Animal Society: 4-star Charity Navigator, 501(c)(3), EIN 36-3037442
- Public landing page at scannibal.app discloses charity commitments and settlement reports

---

## Key Decisions

**March 2026 — Expo/React Native Over Vanilla Swift**
Chose Expo to unlock cross-platform potential (iOS + Android) and accelerate development. Trade-off: slightly larger app bundle (~80MB) and one layer of abstraction from native APIs. Payoff: same codebase can ship on two platforms; easier to onboard collaborators who know React.

**Gemini 2.5 Flash vs. GPT-4V**
Benchmark testing showed Gemini 2.5 Flash superior for food/ingredient recognition (95% accuracy vs. 87% for GPT-4V), 4x faster response, and 5x cheaper. Vision quality was the primary decision driver; cost and speed were secondary but significant.

**Butler Persona as Brand Differentiator**
Rather than generic AI safety scanning, Scannibal uses a consistent butler voice (darkly witty, protective, sophisticated) to make the experience memorable and on-brand. All marketing, app copy, error messages, and results use this voice. Designed to feel like advice from a trusted expert, not a database lookup.

**100% Proceeds to Charity**
Decided to donate all net revenue rather than split profit. This positions Scannibal as a purpose-driven tool, not a commercial app. Marketing emphasizes this commitment. Users see during onboarding which charities benefit from their subscription.

**9 Scan Modes, Not 3**
Initially considered lumping all scans into "General" mode. Expanded to 9 to provide context-specific prompts (e.g., baby products get developmental stage context, plants get pet-toxicity info). Each mode uses the same Gemini pipeline but with different system prompt framing.

**Free Tier (50 scans/day) Post-Beta**
Decided to keep a generous free tier indefinitely (50 scans/day is 1,500 scans/month for power users). This ensures Scannibal remains accessible even without a subscription, reducing friction to trial and build trust before asking for payment.

---

## Evolution

**Phase 1: Concept & Competitive Research (Jan 2026)**
Identified gap in AI-powered safety scanners. Evaluated existing apps (minimal competition), validated use cases with interviews. Designed 9 scan modes.

**Phase 2: MVP Build (Feb 2026)**
Built Expo/React Native app with camera integration, Gemini API integration, and basic results display. Tested on iPhone 15 for latency and accuracy.

**Phase 3: Landing Page & Testflight (Mar 2026)**
Deployed scannibal.app landing page (Squarespace), created TestFlight build, submitted to Apple for review. Currently in beta with 50-100 testers.

**Phase 4: Paid Tier & Charity Integration (Planning)**
Implementing Stripe subscription, charity settlement workflow, revenue reporting. Target launch: Q2 2026.

---

## Current State

**Live:**
- **App:** TestFlight beta on iOS (Apple review pending for App Store release)
- **Landing Page:** scannibal.app hosted on Squarespace with DNS A records pointing to Squarespace servers
- **Backend:** API endpoints live at api.kiranrao.ai; Gemini integration tested and stable
- **Database:** Supabase tables created; scan history and charity preferences tracking active

**Beta Metrics:**
- ~50-100 active TestFlight users
- ~500-1000 scans/day during beta
- Average response time: 2.1 seconds (under 3-second target on 5G)
- Gemini accuracy: 94% (validated against manual ingredient verification)

**Pre-Paid Tier (Incomplete):**
- Stripe integration: planned, not yet implemented
- Voice narration (ElevenLabs): backend ready, frontend button not yet wired
- Charity settlement & reporting: designed, not yet built

**Documentation Location:**
- Core docs: `docs/Scannibal/SCANNIBAL.md` (comprehensive technical spec)
- Prototypes: `prototypes/scannibal/` (design iterations, Figma exports)
- Source code: `/Users/kiran/Projects/scannibal-app/` (Expo project root)

---

## Known Issues & Limitations

**Image Recognition Edge Cases**
Gemini 2.5 Flash occasionally struggles with:
- Very blurry camera input (phones with poor optical stabilization)
- Small or illegible text on labels
- Non-English ingredient lists (Gemini defaults to English response; multilingual support not yet tested)

Mitigation: UX prompts user to hold steady, shows confidence score.

**Latency on Slow Networks**
On 3G or congested WiFi, image upload can exceed 5 seconds, making the app feel unresponsive. Considered image compression on device; trade-off is potential loss of detail for text extraction.

**Rate Limiting**
Gemini API has per-minute quotas. Heavy usage (e.g., 200 users all scanning simultaneously) could trigger rate limits during scaling. No queuing logic currently; requests just fail with a "try again in 30 seconds" message.

**Offline Capability**
The app requires internet to analyze images (can't run Gemini locally on device). Local scan history is cached, but new scans are always remote. Offline mode not implemented.

**Accessibility**
Voice narration (planned for paid tier) doesn't yet exist. App lacks alt text for camera feed. VoiceOver compatibility needs testing.

**iOS-Only**
Currently iOS only. Android support planned but requires additional testing and potential UI adjustments for Android design guidelines.

---

## Ideas & Future Direction

**Multilingual Expansion**
Extend Gemini prompts to detect label language and provide analysis in user's preferred language. Marketing focus on non-English-speaking markets (EU, LATAM).

**Supplement Interaction Checking**
Add a "My Medications" feature where users input their current prescriptions. Scannibal flags supplement-drug interactions with warnings from a drug database (e.g., DrugBank API).

**Barcode Scanning**
In addition to camera recognition, add barcode/QR code scanning to look up products in a safety database (FDA, EWG, or proprietary ratings).

**Community Ratings**
Allow users to rate scan results ("Was this accurate?"). Aggregate ratings to identify commonly mislabeled products or Gemini blind spots.

**Retailer Integration**
Partner with Whole Foods, Trader Joe's, or similar retailers to embed Scannibal in their shopping apps. Revenue share on in-app subscription conversions.

**Physical Scanner Hardware**
Long-term: Partner with appliance makers to embed Scannibal in smart refrigerators, kitchen counters, or dedicated handheld scanners for retail checkout integration.

**EWG & Safety Database Integration**
Cross-reference detected ingredients with Environmental Working Group's safety scores. Highlight high-concern additives with detailed educational content.

**Charity Fundraising Dashboard**
Build a public dashboard showing total proceeds contributed to Feeding America and Best Friends (updated monthly). Showcase impact metrics: meals donated, animals helped, etc.

---

## Relationship to Other Components

**Scannibal is NOT a Command Center module** — it's a standalone iOS product. However, it's tracked as a workstream in CC action items and shares infrastructure with the main site (API at api.kiranrao.ai, Supabase database).

**The DIA Fund** integration: Scannibal's charity revenue flows to DIA Fund's approved partners (Feeding America, Best Friends). DIA Fund landing page references Scannibal as a funding mechanism.

**kiranrao.ai** includes a link to scannibal.app in the navigation and portfolio section, but Scannibal is positioned as a separate product, not a portfolio case study.

---

## Source Sessions

- **2026-02-15** — Initial competitive research and concept validation
- **2026-02-28** — MVP build session: Expo app setup, camera integration, Gemini API integration
- **2026-03-05** — Landing page build and TestFlight submission
- **Multiple refinement sessions** — Beta feedback iteration, API optimization, Butler persona copywriting
