-- Migration 005: Evidence Gap Items ("Mind the Gap")
-- Tracks skills/certifications/tools to learn, with learning plans and project ideas

CREATE TABLE IF NOT EXISTS evidence_gap_items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'critical-gap',           -- From gap analysis — must close
        'recognized-cert',        -- Well-known certs that land well on resumes
        'persona-cred',           -- Builds cred with specific site personas
        'domain-specialty',       -- PM domain specializations (Growth PM, Payments PM, etc.)
        'adjacent-skill',         -- Adjacent: pricing, onboarding, customer success, etc.
        'horizon-expander',       -- Creative/intellectual edge: design, psychology, neuroscience
        'tool-proficiency',       -- Specific tool mastery (Amplitude, Figma, etc.)
        'framework-method'        -- Methodologies & frameworks (JTBD, Design Sprint, etc.)
    )),
    subcategory TEXT,             -- e.g. "Growth PM", "Technical PM", "AI PM" for domain-specialty
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low', 'nice-to-have')),
    persona_relevance TEXT[],     -- Which site personas care: ['technical-evaluator', 'startup-leader', 'hiring-manager', 'ai-curious', 'peer-pm', 'creative-rebel']

    -- What to learn
    description TEXT,             -- What this skill/cert is and why it matters
    why_it_matters TEXT,          -- Specific impact on PM career / hiring
    current_status TEXT NOT NULL DEFAULT 'not-started' CHECK (current_status IN ('not-started', 'researching', 'in-progress', 'completed', 'deprioritized')),

    -- Where to learn
    provider TEXT,                -- Primary provider (Coursera, Reforge, etc.)
    provider_url TEXT,            -- Link to course/cert
    cost TEXT,                    -- e.g. "$49/mo", "Free", "$1,995/yr"
    time_estimate TEXT,           -- e.g. "6 weeks", "10 hours", "3 months"
    alternative_sources TEXT,     -- Other places to learn the same thing

    -- How to demonstrate
    demonstration_idea TEXT,      -- Project/prototype idea to prove the skill
    demonstration_type TEXT CHECK (demonstration_type IN ('prototype', 'teardown', 'case-study', 'dashboard', 'content', 'certification', 'tool-artifact', NULL)),
    portfolio_value TEXT,         -- How this shows up on the site / in interviews

    -- Metadata
    tags TEXT[],                  -- Freeform tags for filtering
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gap_items_category ON evidence_gap_items(category);
CREATE INDEX IF NOT EXISTS idx_gap_items_priority ON evidence_gap_items(priority);
CREATE INDEX IF NOT EXISTS idx_gap_items_status ON evidence_gap_items(current_status);

-- RLS
ALTER TABLE evidence_gap_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Service role full access gap items"
    ON evidence_gap_items FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ══════════════════════════════════════════════════════════════
-- SEED DATA
-- ══════════════════════════════════════════════════════════════

INSERT INTO evidence_gap_items (id, title, category, subcategory, priority, persona_relevance, description, why_it_matters, provider, provider_url, cost, time_estimate, alternative_sources, demonstration_idea, demonstration_type, portfolio_value, tags, sort_order) VALUES

-- ═══════════════════════════════════════════════════════════
-- CRITICAL GAPS (from analysis — close these first)
-- ═══════════════════════════════════════════════════════════

('gap-product-analytics',
 'Product Analytics & Metrics Ownership',
 'critical-gap', NULL, 'critical',
 ARRAY['technical-evaluator', 'hiring-manager', 'peer-pm'],
 'Ability to define, instrument, and own product metrics end-to-end. Includes funnel analysis, cohort analysis, retention curves, and feature adoption tracking. The core analytical muscle that every PM job description requires.',
 'Appears in ~85% of PM job descriptions. Interview loops almost always include a metrics question. Without this, you can''t credibly claim to be data-driven — the teardowns show analysis but not ownership of live metrics.',
 'Amplitude Academy', 'https://academy.amplitude.com/',
 'Free', '10-15 hours',
 'Mixpanel free cert, Google Data Analytics (Coursera $49/mo), Pendo Academy (free)',
 'Instrument your own site with Amplitude: track persona selection → teardown engagement → Fenix conversations → Connect clicks. Build a live metrics dashboard showing your actual conversion funnel. Write up the findings as a case study.',
 'dashboard', 'A live, public-facing analytics story on your own site. Shows you don''t just analyze — you instrument, measure, and act on data. Interviewers can see real numbers.',
 ARRAY['analytics', 'metrics', 'data-driven', 'amplitude', 'funnels'], 1),

('gap-experimentation',
 'Experimentation & A/B Testing',
 'critical-gap', NULL, 'critical',
 ARRAY['technical-evaluator', 'hiring-manager', 'peer-pm'],
 'Design, run, and analyze controlled experiments. Statistical significance, sample size planning, hypothesis formation, experiment velocity. Goes beyond "we tested two buttons" into rigorous experimentation methodology.',
 '56% of PMs cite experimentation as their top focus area. Growth PM roles require it. Even generalist PM interviews test for experiment design thinking. Zero evidence here is a red flag.',
 'PostHog (free/OSS)', 'https://posthog.com/',
 'Free', '2-4 weeks to run first experiments',
 'GrowthBook (free/OSS), Reforge Mastering Experimentation ($1,995/yr), CXL Conversion Optimization ($699)',
 'Run 3 real A/B tests on your site: (1) Persona Picker layout variants, (2) CTA copy on teardown pages, (3) Fenix prompt suggestions vs. open input. Document hypotheses, sample sizes, statistical results, and decisions made. Publish as a blog post or teardown-style analysis.',
 'case-study', 'Demonstrates the full experimentation loop on a live product you built. Shows rigor (hypothesis → design → measure → decide) not just "we tried stuff." Reusable interview story.',
 ARRAY['experimentation', 'a/b-testing', 'statistical-significance', 'growth'], 2),

('gap-user-research',
 'User Research Methods',
 'critical-gap', NULL, 'critical',
 ARRAY['hiring-manager', 'peer-pm', 'creative-rebel'],
 'Primary qualitative research: user interviews, usability testing, Jobs-to-Be-Done framework, survey design, affinity mapping, research synthesis. The complement to quantitative analytics.',
 'Your teardowns demonstrate product sense from the outside. Hiring managers want to see you talk to real users — not just analyze products. JTBD and usability testing come up in behavioral interviews constantly.',
 'Google UX Design Certificate (Coursera)', 'https://grow.google/certificates/ux-design/',
 '$49/mo', '3-6 months',
 'Interaction Design Foundation ($15/mo), Nielsen Norman Group ($1,200/course), Maze Academy (free)',
 'Conduct 5-8 user interviews for Scannibal (TestFlight users) using JTBD framework. Run a moderated usability test on the Persona Picker. Synthesize findings into a research report with affinity map, key insights, and recommended changes. Publish the methodology and redacted findings.',
 'case-study', 'Proves you don''t just build — you listen. A published research study on your own product is rare in PM portfolios and demonstrates the full discovery cycle.',
 ARRAY['user-research', 'jtbd', 'usability', 'interviews', 'qualitative'], 3),

('gap-pricing-monetization',
 'Pricing & Monetization Strategy',
 'critical-gap', NULL, 'high',
 ARRAY['startup-leader', 'hiring-manager'],
 'Pricing model design, willingness-to-pay research, value metric identification, freemium/premium packaging, competitive pricing analysis. Includes behavioral pricing psychology (anchoring, decoy effects, loss aversion).',
 'B2B SaaS PM roles almost always involve pricing decisions. Senior PM roles require business model fluency. Kellogg covered it theoretically but there''s no applied evidence.',
 'Pricing Strategy Optimization (Coursera/UVA)', 'https://www.coursera.org/learn/uva-darden-bcg-pricing-strategy',
 '$49/mo', '4 weeks',
 'Reforge Monetization & Pricing, CXL Pricing & Packaging, Simon-Kucher free resources',
 'Design Scannibal''s pricing model from scratch: define the value metric, design 3 tiers (free/pro/family), run a Van Westendorp price sensitivity survey with beta users, document competitive pricing analysis, and publish the full pricing strategy case study.',
 'case-study', 'Shows business acumen beyond feature shipping. A published pricing strategy with research backing is extremely rare in PM portfolios. Strong signal for senior/lead roles.',
 ARRAY['pricing', 'monetization', 'business-model', 'freemium', 'packaging'], 4),

('gap-roadmapping',
 'Roadmapping & Prioritization Frameworks',
 'critical-gap', NULL, 'high',
 ARRAY['hiring-manager', 'peer-pm', 'startup-leader'],
 'Building and communicating product roadmaps. RICE, ICE, MoSCoW, opportunity scoring, Now/Next/Later frameworks. Includes stakeholder alignment, tradeoff communication, and saying no with data.',
 'Daily PM work. Every PM interview asks "how do you prioritize?" No evidence of using prioritization frameworks or building roadmaps. Command Center has an implicit roadmap but it''s not documented or structured.',
 'UVA Digital Product Management (Coursera)', 'https://www.coursera.org/specializations/uva-darden-digital-product-management',
 '$49/mo', '4 months',
 'Productboard Academy (free), Linear method docs (free), Reforge Product Strategy',
 'Build and publish a public roadmap for your site using Now/Next/Later format. Score features using RICE. Document 3 prioritization decisions showing what you chose NOT to build and why. Create a Productboard or Linear board.',
 'tool-artifact', 'A public, maintained roadmap shows you think in systems and tradeoffs. The "what we didn''t build" narratives are interview gold.',
 ARRAY['roadmap', 'prioritization', 'rice', 'stakeholders', 'tradeoffs'], 5),

-- ═══════════════════════════════════════════════════════════
-- WELL-RECOGNIZED CERTIFICATIONS (land well on resumes)
-- ═══════════════════════════════════════════════════════════

('cert-product-school-pmc',
 'Product School PMC (Product Manager Certificate)',
 'recognized-cert', NULL, 'high',
 ARRAY['hiring-manager', 'peer-pm'],
 'Product School''s flagship certification. Taught live by PMs from Google, Meta, Amazon. Covers full product lifecycle with AI-first approach. One of the most recognized PM-specific credentials in tech hiring.',
 'Widely recognized in tech hiring. The brand carries weight — Product School alumni network is strong. Good signal to recruiters scanning resumes.',
 'Product School', 'https://productschool.com/certifications/product-manager-certification',
 '$3,999', '8 weeks (live)',
 'Product School PGC (growth-focused, $3,999), FPMC (AI-focused, $4,999)',
 'The cert itself is the demonstration. Combine with a capstone project using your existing prototypes as the case study.',
 'certification', 'Brand recognition on resume. Particularly strong for breaking into FAANG-tier companies where Product School has direct hiring partnerships.',
 ARRAY['certification', 'product-school', 'pm-fundamentals', 'recognized'], 10),

('cert-pragmatic-institute',
 'Pragmatic Institute PM Certification',
 'recognized-cert', NULL, 'medium',
 ARRAY['hiring-manager', 'peer-pm'],
 'The gold standard for B2B product management. Three-course series covering market-driven product management, strategic planning, and product building. Especially valued in enterprise SaaS companies.',
 'Most respected in B2B/enterprise PM circles. If targeting companies like Salesforce, ServiceNow, or similar — this cert opens doors. Less relevant for consumer/startup roles.',
 'Pragmatic Institute', 'https://www.pragmaticinstitute.com/product/',
 '$3,000-5,000', '3 courses, self-paced',
 'AIPMM CPM ($995), BCS Digital Product Management',
 'Apply frameworks to Command Center as a B2B product case study: market problems, positioning, pricing, buyer personas.',
 'case-study', 'Strong resume signal for enterprise PM roles. The Pragmatic Framework is widely used — speaking its language in interviews shows you know B2B.',
 ARRAY['certification', 'pragmatic', 'b2b', 'enterprise', 'recognized'], 11),

('cert-cspo',
 'Certified Scrum Product Owner (CSPO)',
 'recognized-cert', NULL, 'medium',
 ARRAY['hiring-manager', 'peer-pm'],
 'Scrum Alliance''s Product Owner certification. Complements your CSM — together they show both the team leadership and product ownership sides of agile. Focuses on backlog management, stakeholder engagement, and maximizing value.',
 'You already have CSM. Adding CSPO shows the product side of agile, not just the process side. Together they form a complete agile leadership picture. Many enterprise job postings specifically list CSPO.',
 'Scrum Alliance', 'https://www.scrumalliance.org/get-certified/product-owner-track/certified-scrum-product-owner',
 '$1,000-1,500', '2-day intensive',
 'SAFe POPM ($995) for scaled agile environments, ICAgile ICP-APO for advanced PO',
 'Already have CSM — pair it. Apply to Command Center''s sprint planning as a case study.',
 'certification', 'CSM + CSPO together show full agile fluency. Quick win since you already have the foundation.',
 ARRAY['certification', 'agile', 'scrum', 'product-owner', 'backlog'], 12),

('cert-deeplearning-ai',
 'DeepLearning.AI Machine Learning Specialization',
 'recognized-cert', NULL, 'medium',
 ARRAY['technical-evaluator', 'ai-curious'],
 'Andrew Ng''s foundational ML course via Stanford/DeepLearning.AI. Covers supervised learning, neural networks, decision trees, recommender systems, and reinforcement learning. The most recognized AI/ML credential globally.',
 'Your AI work is hands-on but lacks formal ML theory credentials. Andrew Ng''s name carries enormous weight in AI circles. Combined with your applied AI prototypes, this creates a theory + practice story.',
 'Coursera (Stanford / DeepLearning.AI)', 'https://www.coursera.org/specializations/machine-learning-introduction',
 '$49/mo', '3 months',
 'Fast.ai Practical Deep Learning (free), Stanford CS229 (free lectures)',
 'Apply ML concepts to improve Fenix: build a content recommender for teardowns, implement a classification model for user intent, or add semantic similarity search. Document the ML decision-making process.',
 'prototype', 'Pairs Andrew Ng credential with your existing AI builds. The combination of Stanford ML theory + six shipped AI prototypes is extremely compelling for AI PM roles.',
 ARRAY['certification', 'machine-learning', 'andrew-ng', 'stanford', 'ai'], 13),

-- ═══════════════════════════════════════════════════════════
-- PERSONA CREDIBILITY (builds trust with specific audiences)
-- ═══════════════════════════════════════════════════════════

('persona-system-design',
 'System Design for PMs',
 'persona-cred', 'Technical Evaluator', 'high',
 ARRAY['technical-evaluator'],
 'Understanding distributed systems, database choices, API design patterns, caching, load balancing, and architectural tradeoffs. Not coding — but being able to evaluate technical proposals and ask the right questions.',
 'Technical evaluators (your primary persona) respect PMs who can discuss system architecture fluently. Your site''s architecture already demonstrates this — but having formal language for it strengthens the signal.',
 'Skiplevel', 'https://www.skiplevel.co/',
 '$299', '6-8 weeks',
 'Grokking System Design (Educative, $79/yr), ByteByteGo (Alex Xu, $15/mo)',
 'Write a detailed architecture decision record (ADR) for your site: why Cloudflare + Vercel + Supabase, what you''d change at 10x scale, database tradeoffs. Publish as a blog post or teardown of your own architecture.',
 'content', 'Shows technical evaluators you think about systems, not just features. An architecture teardown of your own product is highly differentiated.',
 ARRAY['system-design', 'architecture', 'technical', 'distributed-systems'], 20),

('persona-figma-fluency',
 'Figma Design Fluency',
 'persona-cred', 'Creative Rebel / Design', 'high',
 ARRAY['creative-rebel', 'peer-pm', 'hiring-manager'],
 'Not becoming a designer — but being able to sketch ideas in Figma, annotate designs, create simple wireframes, and collaborate in design files. The baseline expectation for any PM working with a design team.',
 'Zero design tool evidence is a visible gap. PMs who can''t sketch in Figma frustrate design teams. At minimum, you should be able to wireframe a feature idea and mark up designs with feedback. Many PM interviews include a whiteboarding/sketching exercise.',
 'Figma (free tier)', 'https://www.figma.com/',
 'Free', '2-4 weeks to get comfortable',
 'Google UX Design cert (covers Figma), Figma YouTube tutorials, ShiftNudge for design systems',
 'Recreate one teardown''s wireframes in Figma with annotations. Create a Figma component library for your site''s design system. Build a feature spec in Figma with user flows and annotated wireframes for a new Command Center module.',
 'tool-artifact', 'A Figma portfolio piece eliminates the "can this PM work with designers?" question. Even rough wireframes show you think visually.',
 ARRAY['figma', 'design', 'wireframes', 'design-tools', 'ux'], 21),

('persona-fullstack-demo',
 'Full-Stack Product Thinking (Technical PM Cred)',
 'persona-cred', 'Technical Evaluator', 'medium',
 ARRAY['technical-evaluator', 'ai-curious'],
 'Go beyond cloud certs into demonstrable system thinking: CI/CD pipelines, observability, infrastructure-as-code, performance optimization, security posture. You already do much of this — the gap is in making it visible.',
 'Technical evaluators look for PMs who understand the full stack — not just the product surface. Your site architecture is the proof but it''s not narrated anywhere. Making the technical depth visible is as important as having it.',
 'Self-directed (document what you already do)', NULL,
 'Free', '2-3 weeks of writing',
 'AWS Solutions Architect Associate ($150 exam), Vercel certifications',
 'Create a "How This Site Works" technical teardown: architecture diagram, deployment pipeline, cost breakdown, performance metrics, security decisions. Make it a page on the site itself.',
 'content', 'The technical evaluator persona sees your site and wonders how it works. Give them the answer. This turns existing capability into visible credibility.',
 ARRAY['technical', 'full-stack', 'architecture', 'devops', 'infrastructure'], 22),

('persona-xd-certification',
 'Nielsen Norman Group UX Certification',
 'persona-cred', 'Creative Rebel / UX', 'low',
 ARRAY['creative-rebel', 'peer-pm'],
 'The most prestigious UX certification. 5 courses covering interaction design, research, and management. Signals deep UX commitment that goes beyond PM basics.',
 'Not critical for PM roles, but for your Creative Rebel persona and if you want to credibly discuss UX leadership. The NN/g brand is universally respected in design circles.',
 'Nielsen Norman Group', 'https://www.nngroup.com/ux-certification/',
 '$6,000 (5 courses)', '3-year window to complete',
 'IxDF membership ($15/mo for all courses), Google UX cert ($49/mo for basics)',
 'Choose the Research specialty. Apply research methods to Persona Picker usability testing and publish findings.',
 'certification', 'Extreme signal for UX-adjacent PM roles. The cost is high — consider IxDF as a more practical alternative first.',
 ARRAY['ux', 'nielsen-norman', 'research', 'design', 'premium'], 23),

-- ═══════════════════════════════════════════════════════════
-- PM DOMAIN SPECIALTIES
-- ═══════════════════════════════════════════════════════════

('domain-growth-pm',
 'Growth PM Specialty',
 'domain-specialty', 'Growth PM', 'high',
 ARRAY['startup-leader', 'hiring-manager'],
 'Growth PMs own acquisition, activation, retention, and monetization loops. Requires fluency in experimentation, funnel analysis, growth modeling, lifecycle marketing, and cohort analysis. The fastest-growing PM specialty.',
 'Growth PM roles are growing ~87% YoY. They command premium compensation. Your site IS a growth product — you just haven''t framed it that way or instrumented the growth loops.',
 'Reforge Growth Foundations', 'https://www.reforge.com/courses/growth-series/details',
 '$1,995/yr (all courses)', '6 weeks',
 'Product School PGC ($3,999), CXL Growth Marketing Minidegree ($699), Lenny Rachitsky newsletter (free)',
 'Map your site''s growth loops: Teardown SEO → Site visit → Persona pick → Fenix engagement → Connect click. Instrument each stage. Run experiments on the weakest link. Publish the growth model with real numbers.',
 'case-study', 'A documented growth loop on a real product with actual metrics is exactly what Growth PM interviews test for. Most candidates can only discuss growth theoretically.',
 ARRAY['growth', 'acquisition', 'retention', 'loops', 'experimentation'], 30),

('domain-ai-pm',
 'AI PM Specialty (Advanced)',
 'domain-specialty', 'AI PM', 'medium',
 ARRAY['technical-evaluator', 'ai-curious', 'startup-leader'],
 'You''re already strong here. This is about going deeper: ML ops, model evaluation, responsible AI, AI product metrics (hallucination rates, latency, cost-per-query), managing AI uncertainty in product decisions.',
 'AI PM is the highest-compensation PM specialty. You have the applied work — formal credentials from DeepLearning.AI or Duke would close the loop between practice and theory.',
 'Duke AI Product Management (Coursera)', 'https://www.coursera.org/specializations/ai-product-management-duke',
 '$49/mo', '3 months',
 'DeepLearning.AI specializations, Stanford HAI resources (free), Anthropic courses',
 'Publish Fenix''s AI product metrics: response quality, citation accuracy, hallucination rate, cost-per-conversation, latency by query type. Create an AI product evaluation framework and open-source it.',
 'dashboard', 'Turns your strongest area into a published thought leadership piece. An open-source AI product evaluation framework would get shared widely.',
 ARRAY['ai', 'machine-learning', 'mlops', 'responsible-ai', 'evaluation'], 31),

('domain-technical-pm',
 'Technical PM Specialty',
 'domain-specialty', 'Technical PM', 'medium',
 ARRAY['technical-evaluator'],
 'Technical PMs own developer-facing products: APIs, SDKs, infrastructure, developer tools. Requires understanding of technical architecture, API design, developer experience, and technical debt management. You already have API Academy cert.',
 'Your API Academy cert + the site''s architecture + Command Center positions you well. The gap is in narrating this as a Technical PM story. Consider CTPM for formal recognition.',
 'ProductHQ CTPM', 'https://producthq.org/product-management-certifications/technical-product-manager-certification/',
 '$499', 'Self-paced',
 'Skiplevel ($299), Educative system design courses, API Academy (already have)',
 'Write a technical product spec for a new CC API endpoint. Include API design decisions, error handling, versioning strategy, and developer documentation. Publish as a blog post about API product management.',
 'content', 'Stacks on top of your API Academy cert. The combination of cert + real API products (CC has 25+ endpoints) + published spec is very strong for Technical PM roles.',
 ARRAY['technical', 'api', 'sdk', 'developer-tools', 'infrastructure'], 32),

('domain-platform-pm',
 'Platform PM Specialty',
 'domain-specialty', 'Platform PM', 'medium',
 ARRAY['technical-evaluator', 'startup-leader'],
 'Platform PMs build products that other products are built on. Involves two-sided value creation, API strategy, developer ecosystems, extensibility, and platform governance. Think Stripe, Twilio, Shopify.',
 'Command Center IS a platform — it powers your entire site. This is about formalizing that framing and speaking platform strategy language (network effects, multi-tenancy, API-first, developer experience).',
 'Self-directed + platform strategy reading', NULL,
 'Free', '2-3 weeks',
 'Pragmatic Institute (covers platform strategy), Platform Revolution (book), Stratechery (newsletter)',
 'Write a "Command Center as a Platform" case study: how it serves multiple products (site, teardowns, resume pipeline, Fenix), API architecture, extensibility decisions, what a third-party integration would look like.',
 'case-study', 'Reframes CC from "internal tool" to "platform" — a much more interesting PM story. Platform thinking is highly valued at companies like Stripe, Twilio, and Shopify.',
 ARRAY['platform', 'api-strategy', 'ecosystem', 'extensibility', 'two-sided'], 33),

('domain-payments-pm',
 'Payments / Fintech PM',
 'domain-specialty', 'Payments PM', 'low',
 ARRAY['technical-evaluator', 'startup-leader'],
 'Payments infrastructure, PCI compliance, payment flows, fraud prevention, regulatory requirements, Stripe/Adyen integration. A growing PM niche with high compensation.',
 'Only relevant if targeting fintech companies. The domain knowledge (PCI, payment flows, settlement) is specific enough that a cert or project helps significantly.',
 'Stripe Certified Professional', 'https://www.stripe.training/',
 '$250 exam fee', '2-4 weeks self-study',
 'GAQM Certified Card Payments Professional (CCPP), Stripe documentation deep-dive (free)',
 'Add a payment flow to Scannibal (it has a paid tier with charity integration). Implement Stripe Checkout, handle webhooks, manage subscriptions. Document the payment architecture and compliance decisions.',
 'prototype', 'Scannibal already has a paid tier concept — implementing it with Stripe creates a real payments product story. The charity angle adds an ethical dimension.',
 ARRAY['payments', 'fintech', 'stripe', 'pci', 'subscriptions'], 34),

('domain-digital-pm',
 'Digital / Ecommerce PM',
 'domain-specialty', 'Digital PM', 'low',
 ARRAY['hiring-manager'],
 'Ecommerce product management: catalog management, search & discovery, checkout optimization, personalization, recommendation engines, A/B testing at scale. Think Amazon, Shopify, Walmart.',
 'Your teardowns of Amazon and Airbnb already demonstrate strong digital product thinking. A BCS or AIPMM digital PM cert would formalize this. Lower priority since your teardowns cover the analytical side well.',
 'AIPMM Certified Digital Product Manager', 'https://aipmm.com/cdpm',
 '$995', 'Self-paced + exam',
 'BCS Digital Product Management, MIT Sloan Digital Product Management ($2,450)',
 'Your Amazon and Airbnb teardowns are the demonstration. Extend one into a full product proposal with metrics framework, experimentation plan, and A/B test designs.',
 'case-study', 'Formalizes what your teardowns already show. The cert adds a credential; the extended teardown adds depth.',
 ARRAY['digital', 'ecommerce', 'marketplace', 'search', 'personalization'], 35),

-- ═══════════════════════════════════════════════════════════
-- ADJACENT SKILLS
-- ═══════════════════════════════════════════════════════════

('adjacent-customer-success',
 'Customer Success & Onboarding',
 'adjacent-skill', NULL, 'medium',
 ARRAY['startup-leader', 'hiring-manager'],
 'Customer onboarding flow design, activation metrics, health scoring, churn prediction, customer lifecycle management. The bridge between product and retention.',
 'PM roles increasingly own onboarding and activation metrics. Understanding customer success thinking helps you design products that retain, not just acquire. Particularly relevant for B2B SaaS roles.',
 'Userpilot Academy / Gainsight Pulse (free)', 'https://userpilot.com/blog/customer-success-courses/',
 'Free', '2-3 weeks',
 'Coursera Customer Success Management, CCSM certification ($995)',
 'Design and document the onboarding flow for Scannibal or Persona Picker. Map the activation funnel, define the "aha moment," instrument drop-off points, and propose experiments to improve activation rates.',
 'case-study', 'An onboarding teardown of your own product shows you think about the full user lifecycle, not just first impressions.',
 ARRAY['onboarding', 'activation', 'retention', 'customer-success', 'churn'], 40),

('adjacent-product-marketing',
 'Product Marketing & Positioning',
 'adjacent-skill', NULL, 'medium',
 ARRAY['startup-leader', 'hiring-manager'],
 'Product positioning, messaging frameworks, launch strategy, competitive messaging, analyst relations. The skill of making products land in market, not just ship.',
 'Your Go-to-Market evidence is thin (2 sources). Product marketing fluency helps you partner with PMM teams and is essential for senior/lead PM roles where you own the full lifecycle.',
 'CXL Product Marketing Minidegree', 'https://cxl.com/institute/programs/product-marketing/',
 '$699', '12 weeks',
 'Reforge Marketing Strategy, April Dunford "Obviously Awesome" (book, $15), Product Marketing Alliance (free resources)',
 'Write a positioning document for your site using April Dunford''s framework: competitive alternatives, unique attributes, value, target customer, market category. Publish as a blog post about positioning for PM portfolios.',
 'content', 'A published positioning exercise using a recognized framework shows strategic marketing thinking. Very few PMs can articulate their positioning this clearly.',
 ARRAY['product-marketing', 'positioning', 'messaging', 'go-to-market', 'launch'], 41),

('adjacent-behavioral-economics',
 'Behavioral Economics for Products',
 'adjacent-skill', NULL, 'medium',
 ARRAY['creative-rebel', 'ai-curious', 'peer-pm'],
 'Cognitive biases in product design: anchoring, loss aversion, default effects, social proof, scarcity, choice architecture. Understanding why users make irrational decisions and how to design for it ethically.',
 'Behavioral economics is the hidden superpower behind great product decisions. Understanding nudges, defaults, and choice architecture makes you a better product thinker. Comes up in senior PM interviews around "product sense."',
 'CXL Digital Psychology & Behavioral Design', 'https://cxl.com/institute/online-course/psychology-neuroscience-cro/',
 '$699 (lifetime)', '6-8 weeks',
 'Dan Ariely "Predictably Irrational" (book, $12), Coursera Behavioral Economics (Duke), Nir Eyal "Hooked" (book, $15)',
 'Audit your site through a behavioral economics lens: where are you using defaults? Where could anchoring improve the persona picker? What loss aversion patterns could increase Fenix engagement? Write up the analysis and implement 3 changes.',
 'case-study', 'Shows sophisticated product thinking beyond features and metrics. A behavioral economics audit of your own product demonstrates "product sense" in a way interviewers love.',
 ARRAY['behavioral-economics', 'psychology', 'nudges', 'choice-architecture', 'cognitive-bias'], 42),

('adjacent-design-thinking',
 'Design Thinking & Design Sprints',
 'adjacent-skill', NULL, 'medium',
 ARRAY['peer-pm', 'creative-rebel'],
 'Structured innovation methodology: empathize, define, ideate, prototype, test. Plus Jake Knapp''s Design Sprint framework for rapidly solving big problems in 5 days.',
 'Design thinking is the lingua franca between PM and design. Design Sprints are used at Google, Slack, and hundreds of companies. Knowing how to facilitate a sprint is a force multiplier for any PM.',
 'IDEO U Design Thinking Certificate', 'https://www.ideou.com/',
 '$1,600', '6 weeks',
 'Jake Knapp "Sprint" book ($20), Google Design Sprint toolkit (free), AJ&Smart YouTube (free)',
 'Run a mini design sprint (3 days) on a real problem: redesigning the teardown navigation or creating a new Fenix onboarding experience. Document each phase with photos, sketches, and the prototype. Publish the process.',
 'case-study', 'Documenting a design sprint you facilitated shows leadership, structured thinking, and cross-functional collaboration skills — even if the team is just you.',
 ARRAY['design-thinking', 'design-sprint', 'innovation', 'ideation', 'prototyping'], 43),

('adjacent-sql-advanced',
 'Advanced SQL & Data Fluency',
 'adjacent-skill', NULL, 'high',
 ARRAY['technical-evaluator', 'hiring-manager'],
 'Go beyond basic queries: window functions, CTEs, performance optimization, data modeling, writing queries against production analytics databases. The PM who can self-serve data earns engineering trust.',
 'You have SQL from General Assembly but only 1 evidence source. Many PM interviews include a SQL assessment. Self-serve data access is the #1 way PMs earn engineering team credibility.',
 'Mode Analytics SQL Tutorial (free)', 'https://mode.com/sql-tutorial/',
 'Free', '2-3 weeks',
 'DataCamp SQL courses ($29/mo), Coursera Google Data Analytics, LeetCode SQL problems (free)',
 'Write complex SQL queries against your Supabase database: analyze Fenix conversation patterns, build a training data quality report, create a content engagement dashboard. Publish 5-10 interesting queries with explanations.',
 'tool-artifact', 'Published SQL analysis of your own product data shows self-serve data fluency. Include window functions and CTEs to demonstrate intermediate-to-advanced level.',
 ARRAY['sql', 'data', 'analytics', 'queries', 'self-serve'], 44),

-- ═══════════════════════════════════════════════════════════
-- TOOL PROFICIENCY
-- ═══════════════════════════════════════════════════════════

('tool-amplitude',
 'Amplitude',
 'tool-proficiency', NULL, 'critical',
 ARRAY['technical-evaluator', 'hiring-manager', 'peer-pm'],
 'The most commonly listed product analytics tool in PM job descriptions. Funnel analysis, cohort analysis, retention analysis, user segmentation, behavioral analytics. Free tier is generous enough for real projects.',
 'Listed in ~40% of PM job postings that mention specific tools. The free tier supports up to 10M events/month. Getting certified through Amplitude Academy takes ~10 hours and costs nothing.',
 'Amplitude Academy', 'https://academy.amplitude.com/',
 'Free', '10 hours (certification)',
 'Mixpanel (similar), PostHog (open source alternative), Heap (auto-capture)',
 'Instrument your site: track page views, persona selections, teardown reads, Fenix conversations, Connect clicks. Build funnels, cohort charts, and a retention analysis. Screenshot the dashboards for your portfolio.',
 'dashboard', 'Live Amplitude dashboards on your own product are the strongest possible signal for product analytics fluency.',
 ARRAY['amplitude', 'analytics', 'tool', 'funnels', 'cohorts'], 50),

('tool-mixpanel',
 'Mixpanel',
 'tool-proficiency', NULL, 'high',
 ARRAY['technical-evaluator', 'hiring-manager'],
 'Second most common product analytics platform. Event-based analytics with strong AI-assisted analysis. Free tier available. Having both Amplitude and Mixpanel shows breadth.',
 'Some companies are Amplitude shops, others are Mixpanel shops. Having experience with both means you''re never caught flat-footed. Mixpanel''s AI features are a good talking point for AI PM interviews.',
 'Mixpanel (free tier)', 'https://mixpanel.com/',
 'Free', '1-2 weeks',
 'Amplitude (primary recommendation), PostHog, Heap',
 'Set up Mixpanel as a secondary analytics tool. Compare the same funnels across Amplitude and Mixpanel. Write a comparison analysis of which tool is better for what use case.',
 'content', 'A published comparison of two analytics tools shows you think about tooling decisions strategically, not just use whatever is available.',
 ARRAY['mixpanel', 'analytics', 'tool', 'events', 'ai-analytics'], 51),

('tool-jira',
 'Jira / Linear (Project Management)',
 'tool-proficiency', NULL, 'high',
 ARRAY['hiring-manager', 'peer-pm'],
 'Issue tracking, sprint management, epic/story structure, backlog grooming. Jira is the industry default; Linear is the modern alternative. Your CSM cert implies Jira knowledge but it''s not demonstrated.',
 'Virtually every PM job uses Jira or a similar tool. Not having it on your resume isn''t a dealbreaker but demonstrating fluency removes a question mark.',
 'Jira (free tier for ≤10 users)', 'https://www.atlassian.com/software/jira/free',
 'Free', '1 week to set up',
 'Linear (free for personal), Shortcut, Asana',
 'Set up a Jira or Linear project for your site''s backlog. Create epics for each major workstream (teardowns, MadLab, Fenix, CC). Groom the backlog with story points and sprint assignments.',
 'tool-artifact', 'A well-organized Jira/Linear board shows you can run a development process, not just build features.',
 ARRAY['jira', 'linear', 'project-management', 'agile', 'sprints'], 52),

('tool-miro',
 'Miro / FigJam (Collaborative Whiteboarding)',
 'tool-proficiency', NULL, 'medium',
 ARRAY['peer-pm', 'creative-rebel'],
 'Visual collaboration for product thinking: user journey maps, affinity diagrams, story mapping, design sprint artifacts, retrospective boards. The PM''s Swiss army knife for workshops.',
 'Used in almost every PM workshop, design sprint, and team offsite. Being fluent in Miro/FigJam signals you can facilitate collaborative sessions, not just present slides.',
 'Miro (free tier)', 'https://miro.com/',
 'Free', '1-2 weeks',
 'FigJam (part of Figma), Whimsical, Lucidchart',
 'Create a comprehensive user journey map for your site in Miro. Map every touchpoint from Google search → landing → persona pick → explore → Fenix → Connect. Include emotions, pain points, and opportunities.',
 'tool-artifact', 'A published journey map in Miro demonstrates facilitation skills and systematic user thinking.',
 ARRAY['miro', 'whiteboard', 'collaboration', 'journey-map', 'workshops'], 53),

('tool-posthog',
 'PostHog (Experimentation + Analytics)',
 'tool-proficiency', NULL, 'high',
 ARRAY['technical-evaluator', 'startup-leader'],
 'Open-source product analytics + experimentation platform. Feature flags, A/B testing, session recordings, heatmaps, and product analytics in one tool. Strong with technical founders and startups.',
 'The startup-friendly alternative to paid tools. Self-hostable, open-source, generous free tier. Knowing PostHog signals you can move fast with modern tooling — strong with the startup leader persona.',
 'PostHog (free/OSS)', 'https://posthog.com/',
 'Free (1M events/mo)', '1-2 weeks',
 'GrowthBook (OSS experimentation), LaunchDarkly (feature flags), Statsig',
 'Deploy PostHog on your site. Set up feature flags, run your first A/B test, create session recordings. The all-in-one setup is a story about choosing tools strategically.',
 'tool-artifact', 'PostHog is increasingly popular at startups. Demonstrating you can set up a full experimentation stack from scratch is very strong for startup PM roles.',
 ARRAY['posthog', 'experimentation', 'feature-flags', 'open-source', 'startup'], 54),

('tool-looker',
 'Looker / BI Tools',
 'tool-proficiency', NULL, 'medium',
 ARRAY['hiring-manager', 'peer-pm'],
 'Business intelligence dashboards: Looker, Mode, Metabase. Building dashboards that stakeholders actually use. Combines SQL fluency with data storytelling and stakeholder communication.',
 'PM roles at larger companies expect you to build and maintain dashboards for your product area. Looker is the most common in tech companies. Even basic proficiency is helpful.',
 'Looker Studio (free)', 'https://lookerstudio.google.com/',
 'Free', '1-2 weeks',
 'Metabase (free/OSS), Mode Analytics (free tier), Tableau (already have cert)',
 'Build a Looker Studio dashboard for your site metrics. Connect to Supabase or Amplitude data. Create views for: traffic trends, Fenix usage, teardown engagement, persona distribution.',
 'dashboard', 'A live BI dashboard demonstrates data storytelling for stakeholders, not just personal analysis.',
 ARRAY['looker', 'bi', 'dashboards', 'data-storytelling', 'stakeholder-reporting'], 55),

-- ═══════════════════════════════════════════════════════════
-- FRAMEWORKS & METHODOLOGIES
-- ═══════════════════════════════════════════════════════════

('framework-jtbd',
 'Jobs to Be Done (JTBD)',
 'framework-method', NULL, 'high',
 ARRAY['peer-pm', 'hiring-manager', 'startup-leader'],
 'Clayton Christensen''s framework for understanding customer motivations. Goes beyond "what users want" to "what job are they hiring this product to do." Includes switch interviews, progress forces, and demand-side selling.',
 'JTBD comes up in senior PM interviews constantly. It reframes product decisions around customer progress rather than features. Your teardowns would be even stronger narrated through a JTBD lens.',
 'Bob Moesta JTBD Courses', 'https://www.thrv.com/',
 '$500-1,500', '2-4 weeks',
 '"Competing Against Luck" by Christensen (book, $15), "Demand-Side Sales" by Moesta (book, $15), JTBD Toolkit (free)',
 'Conduct JTBD switch interviews with 5 people who recently changed how they job search or evaluate PM portfolios. Map the forces of progress. Rewrite your site''s value propositions through the JTBD lens.',
 'case-study', 'JTBD interviews about your own product create an incredibly meta and compelling case study. Shows both the methodology and genuine customer curiosity.',
 ARRAY['jtbd', 'jobs-to-be-done', 'customer-motivation', 'switch-interviews', 'framework'], 60),

('framework-okrs',
 'OKRs & Goal-Setting',
 'framework-method', NULL, 'medium',
 ARRAY['hiring-manager', 'peer-pm'],
 'Objectives and Key Results. Setting, tracking, and reviewing product goals. Includes goal decomposition, leading vs. lagging indicators, alignment across teams, and quarterly review processes.',
 'Most PM roles use OKRs. Being fluent in setting good key results (measurable, ambitious, achievable) is expected. Your site could benefit from documented OKRs.',
 '"Measure What Matters" by John Doerr (book)', NULL,
 '$15', '1 week reading + 1 week implementing',
 'Google re:Work OKR guide (free), Atlassian OKR guide (free), Weekdone templates (free)',
 'Write and publish OKRs for your site: Q2 2026 objectives with measurable key results. Track progress publicly. Include an end-of-quarter retrospective.',
 'content', 'Published OKRs with a retrospective show you think in outcomes, not outputs. Very few portfolio sites have this.',
 ARRAY['okrs', 'goals', 'objectives', 'key-results', 'measurement'], 61),

-- ═══════════════════════════════════════════════════════════
-- HORIZON EXPANDERS (creative/intellectual edge)
-- ═══════════════════════════════════════════════════════════

('horizon-neurodesign',
 'Neurodesign & Cognitive Psychology',
 'horizon-expander', NULL, 'medium',
 ARRAY['creative-rebel', 'ai-curious'],
 'How the brain processes visual information, makes decisions under uncertainty, and forms preferences. Applies to UI design, content strategy, and AI product design. Not a PM requirement — a PM superpower.',
 'Understanding cognitive load theory, dual-process thinking (System 1 vs. System 2), and attention economics gives you a language for "product sense" that most PMs lack. Makes your design decisions evidence-based rather than intuitive.',
 'CXL Digital Psychology & Behavioral Design', 'https://cxl.com/institute/online-course/psychology-neuroscience-cro/',
 '$699 (lifetime)', '6-8 weeks',
 '"Thinking, Fast and Slow" by Kahneman (book, $15), "Design for How People Think" by Whalen (book, $35), Coursera Neuroscience of Decision Making',
 'Create a "Cognitive Teardown" of your own site: map each page''s cognitive load, identify System 1 vs. System 2 demands, propose changes based on cognitive principles. A completely new teardown format nobody else is doing.',
 'content', 'A "Cognitive Teardown" is a format nobody else has. It positions you as someone who designs from principles, not patterns. The Creative Rebel persona would love this.',
 ARRAY['neuroscience', 'cognitive-psychology', 'system1-system2', 'attention', 'cognitive-load'], 70),

('horizon-graphic-design',
 'Graphic Design Fundamentals',
 'horizon-expander', NULL, 'low',
 ARRAY['creative-rebel'],
 'Typography, color theory, composition, visual hierarchy, layout principles. Not becoming a designer — developing an informed eye for why good design works and bad design doesn''t.',
 'PMs with design literacy collaborate better with design teams and make better product decisions about visual communication. Also directly useful for your site, presentations, and content.',
 'Coursera CalArts Graphic Design Specialization', 'https://www.coursera.org/specializations/graphic-design',
 '$49/mo', '6 months',
 'Refactoring UI (book/course, $99), "The Non-Designer''s Design Book" by Robin Williams ($20), Canva Design School (free)',
 'Redesign one element of your site applying formal design principles. Document the before/after with specific references to typography, color theory, and visual hierarchy principles. Make it a blog post.',
 'content', 'A before/after design case study shows you don''t just use design tools — you understand design principles.',
 ARRAY['graphic-design', 'typography', 'color-theory', 'visual-hierarchy', 'layout'], 71),

('horizon-storytelling',
 'Data Storytelling & Narrative',
 'horizon-expander', NULL, 'high',
 ARRAY['hiring-manager', 'startup-leader', 'peer-pm'],
 'Turning data into compelling narratives. Presentation structure, data visualization best practices, executive communication, and the ability to make numbers tell a story that drives action.',
 'The #1 skill that separates good PMs from great ones isn''t analytical — it''s narrative. Can you take a dashboard and turn it into a decision? Your McKinsey executive comms cert covers theory — this is about applied practice.',
 'Cole Nussbaumer Knaflic "Storytelling with Data"', NULL,
 '$25 (book)', '2-3 weeks',
 'Coursera "Storytelling with Data" (free), Google Data Storytelling (free), Harvard Business Review presentation guides',
 'Take your site''s analytics (once instrumented) and create a "State of the Portfolio" quarterly presentation. Use Storytelling with Data principles: context, minimize clutter, focus attention, tell a story. Publish the deck.',
 'content', 'A polished, data-rich presentation about your own product performance demonstrates executive communication skills in the most concrete way possible.',
 ARRAY['storytelling', 'data-visualization', 'narrative', 'presentations', 'executive-comms'], 72),

('horizon-writing',
 'Product Writing & Technical Communication',
 'horizon-expander', NULL, 'medium',
 ARRAY['peer-pm', 'creative-rebel'],
 'Clear, concise product communication: PRDs, one-pagers, launch emails, release notes, help documentation. Also includes UX writing / microcopy — the words inside the product.',
 'PMs write more than they code. Every document you produce — PRDs, specs, emails, Slack messages — is an artifact of your product thinking. Great writing is a force multiplier.',
 'Google Technical Writing Courses (free)', 'https://developers.google.com/tech-writing',
 'Free', '1-2 weeks',
 'Shani Raja "Writing for the Web" (Udemy, $15), "On Writing Well" by Zinsser (book, $12)',
 'Publish 3 well-crafted product artifacts: a PRD template (with a filled example for a CC feature), a product one-pager, and a launch brief. Make them downloadable templates on your site.',
 'content', 'Published product writing templates are genuinely useful to other PMs and demonstrate your communication standards. Great for the peer PM persona.',
 ARRAY['writing', 'prd', 'documentation', 'microcopy', 'communication'], 73),

('horizon-economics',
 'Platform Economics & Network Effects',
 'horizon-expander', NULL, 'low',
 ARRAY['startup-leader', 'technical-evaluator'],
 'Understanding multi-sided markets, network effects, winner-take-all dynamics, aggregation theory, and platform strategy. The intellectual framework behind every major tech platform.',
 'Not a job requirement but a massive differentiator for senior PM roles at platform companies. Understanding why platforms work (and fail) makes your strategic thinking much sharper.',
 'Coursera Platform Strategy (Boston University)', 'https://www.coursera.org/learn/platform-strategy',
 '$49/mo', '4 weeks',
 '"Platform Revolution" by Parker/Van Alstyne (book, $15), Stratechery by Ben Thompson ($12/mo), "Aggregation Theory" essays (free)',
 'Analyze your site as a platform: what are the network effects? Where could cross-side value creation happen? Write a platform economics teardown of your own site versus a traditional portfolio.',
 'content', 'A platform economics analysis of your own portfolio site is intellectually interesting and demonstrates strategic depth that most PMs can''t match.',
 ARRAY['economics', 'network-effects', 'platforms', 'aggregation', 'strategy'], 74)

ON CONFLICT (id) DO NOTHING;
