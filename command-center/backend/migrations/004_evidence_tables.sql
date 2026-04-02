-- ============================================================
-- Evidence Management tables for Skills page
-- Run this in the Supabase SQL Editor for project gndzmmywtxvlukoavadj
-- ============================================================

-- ── Domains ─────────────────────────────────────────────────
-- Six skill domains with display colors

CREATE TABLE IF NOT EXISTS evidence_domains (
    id TEXT PRIMARY KEY,              -- e.g. "product", "ai", "data"
    label TEXT NOT NULL,              -- e.g. "Product", "AI & ML"
    color TEXT NOT NULL DEFAULT '#7CADE8',  -- hex color for UI
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Skills ──────────────────────────────────────────────────
-- 36 skills across 6 domains

CREATE TABLE IF NOT EXISTS evidence_skills (
    id TEXT PRIMARY KEY,              -- e.g. "product-strategy", "rag-pipelines"
    label TEXT NOT NULL,              -- e.g. "Product Strategy", "RAG Pipelines"
    domain_id TEXT NOT NULL REFERENCES evidence_domains(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_skills_domain
    ON evidence_skills (domain_id, sort_order);

-- ── Sources ─────────────────────────────────────────────────
-- 26 evidence items (certifications, prototypes, projects, teardowns)

CREATE TABLE IF NOT EXISTS evidence_sources (
    id TEXT PRIMARY KEY,              -- e.g. "kellogg", "fenix", "td-airbnb"
    label TEXT NOT NULL,              -- e.g. "AI-Driven Product Strategy"
    type TEXT NOT NULL CHECK (type IN ('certification', 'prototype', 'project', 'teardown')),
    issuer TEXT,                       -- e.g. "Kellogg / Northwestern"
    year INTEGER,                      -- e.g. 2022
    url TEXT,                          -- link to evidence (optional)
    archived BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_sources_type
    ON evidence_sources (type, created_at DESC);

-- ── Skill Links ─────────────────────────────────────────────
-- Junction table: skill-to-source mappings (89 rows)

CREATE TABLE IF NOT EXISTS evidence_skill_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES evidence_sources(id) ON DELETE CASCADE,
    skill_id TEXT NOT NULL REFERENCES evidence_skills(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (source_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_evidence_skill_links_source
    ON evidence_skill_links (source_id);

CREATE INDEX IF NOT EXISTS idx_evidence_skill_links_skill
    ON evidence_skill_links (skill_id);

-- ── Cert Details ────────────────────────────────────────────
-- Extended detail for certification modal popups (12 rows)

CREATE TABLE IF NOT EXISTS evidence_cert_details (
    source_id TEXT PRIMARY KEY REFERENCES evidence_sources(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    issuer_full TEXT NOT NULL,
    credential TEXT,                   -- credential string (may contain HTML links)
    logo TEXT,                         -- image path
    learned TEXT,                      -- main description
    display_skills TEXT[] DEFAULT '{}', -- skill names as displayed in modal
    capstone_label TEXT DEFAULT 'Certification',  -- "Capstone", "Certification", "Program", "Applied Project"
    capstone TEXT,                      -- detailed capstone/program description
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Evidence Item Details ───────────────────────────────────
-- Extended detail for prototype/project/teardown modal popups (14 rows)

CREATE TABLE IF NOT EXISTS evidence_item_details (
    source_id TEXT PRIMARY KEY REFERENCES evidence_sources(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('prototype', 'project', 'teardown')),
    tagline TEXT,
    logo TEXT,                         -- image path
    description TEXT,
    tech_stack TEXT[] DEFAULT '{}',     -- technologies/methods
    display_skills TEXT[] DEFAULT '{}', -- skill names as displayed in modal
    highlight TEXT,                     -- key insight
    status TEXT,                        -- "Live MVP", "TestFlight Beta", "Published", etc.
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── RLS ─────────────────────────────────────────────────────

ALTER TABLE evidence_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_skill_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_cert_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_item_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to evidence_domains"
    ON evidence_domains FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to evidence_skills"
    ON evidence_skills FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to evidence_sources"
    ON evidence_sources FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to evidence_skill_links"
    ON evidence_skill_links FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to evidence_cert_details"
    ON evidence_cert_details FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to evidence_item_details"
    ON evidence_item_details FOR ALL USING (true) WITH CHECK (true);


-- ════════════════════════════════════════════════════════════
-- SEED DATA
-- ════════════════════════════════════════════════════════════

-- ── Domains ─────────────────────────────────────────────────

INSERT INTO evidence_domains (id, label, color, sort_order) VALUES
    ('product',    'Product',     '#E8927C', 1),
    ('ai',         'AI & ML',     '#7CADE8', 2),
    ('data',       'Data',        '#7CE8A3', 3),
    ('cloud',      'Cloud',       '#C89CEB', 4),
    ('strategy',   'Strategy',    '#E8D67C', 5),
    ('leadership', 'Leadership',  '#EB9CC8', 6)
ON CONFLICT (id) DO NOTHING;

-- ── Skills ──────────────────────────────────────────────────

INSERT INTO evidence_skills (id, label, domain_id, sort_order) VALUES
    -- Product (8)
    ('product-strategy',    'Product Strategy',        'product', 1),
    ('product-vision',      'Product Vision',          'product', 2),
    ('go-to-market',        'Go-to-Market',            'product', 3),
    ('platform-building',   'Platform Building',       'product', 4),
    ('customer-advocacy',   'Customer Advocacy',       'product', 5),
    ('api-product-mgmt',    'API Product Management',  'product', 6),
    ('developer-experience','Developer Experience',     'product', 7),
    ('product-led-growth',  'Product-Led Growth',      'product', 8),
    -- AI & ML (5)
    ('ai-strategy',         'AI Strategy',             'ai', 1),
    ('ai-powered-discovery','AI-Powered Discovery',    'ai', 2),
    ('rag-pipelines',       'RAG Pipelines',           'ai', 3),
    ('prompt-engineering',  'Prompt Engineering',       'ai', 4),
    ('ai-product-integration','AI Product Integration', 'ai', 5),
    -- Data (5)
    ('sql',                 'SQL',                     'data', 1),
    ('python',              'Python',                  'data', 2),
    ('data-visualization',  'Data Visualization',      'data', 3),
    ('tableau',             'Tableau',                 'data', 4),
    ('bigquery',            'BigQuery',                'data', 5),
    -- Cloud (5)
    ('aws',                 'AWS',                     'cloud', 1),
    ('azure',               'Azure',                   'cloud', 2),
    ('google-cloud',        'Google Cloud',            'cloud', 3),
    ('serverless',          'Serverless',              'cloud', 4),
    ('cloud-architecture',  'Cloud Architecture',      'cloud', 5),
    -- Strategy (5)
    ('problem-solving',     'Problem Solving',         'strategy', 1),
    ('hypothesis-driven',   'Hypothesis-Driven Analysis','strategy', 2),
    ('competitive-analysis','Competitive Analysis',    'strategy', 3),
    ('business-case',       'Business Case Development','strategy', 4),
    ('executive-comms',     'Executive Communication', 'strategy', 5),
    -- Leadership (5)
    ('change-management',   'Change Management',       'leadership', 1),
    ('scrum',               'Scrum',                   'leadership', 2),
    ('stakeholder-mgmt',    'Stakeholder Management',  'leadership', 3),
    ('team-facilitation',   'Team Facilitation',       'leadership', 4),
    ('adoption-strategy',   'Adoption Strategy',       'leadership', 5)
ON CONFLICT (id) DO NOTHING;

-- ── Sources ─────────────────────────────────────────────────

INSERT INTO evidence_sources (id, label, type, issuer, year, url) VALUES
    -- Certifications (12)
    ('kellogg',            'AI-Driven Product Strategy',   'certification', 'Kellogg / Northwestern',  2022, NULL),
    ('general-assembly',   'Data Analytics',               'certification', 'General Assembly',        NULL, NULL),
    ('csm',                'Certified ScrumMaster',        'certification', 'Scrum Alliance',          NULL, NULL),
    ('mckinsey-strategy',  'Business Strategy',            'certification', 'McKinsey',                2023, NULL),
    ('mckinsey-leadership','Management Accelerator',       'certification', 'McKinsey',                2023, NULL),
    ('mckinsey-problem',   'Problem Solving',              'certification', 'McKinsey',                2023, NULL),
    ('mckinsey-product',   'Product Academy',              'certification', 'McKinsey',                2022, NULL),
    ('prosci',             'CCMP',                         'certification', 'Prosci',                  2021, NULL),
    ('api-academy',        'Certified API Product Manager','certification', 'API Academy',             2023, NULL),
    ('az-900',             'AZ-900 Azure Fundamentals',    'certification', 'Microsoft',               2023, NULL),
    ('gcp-cdl',            'Cloud Digital Leader',         'certification', 'Google Cloud',            2023, NULL),
    ('aws-ccp',            'Cloud Practitioner',           'certification', 'AWS',                     2023, NULL),
    -- Prototypes (6)
    ('fenix',              'Fenix AI Assistant',           'prototype',     NULL, NULL, '#'),
    ('scannibal',          'Scannibal',                    'prototype',     NULL, NULL, '#'),
    ('persona-picker',     'Persona Picker',               'prototype',     NULL, NULL, '#'),
    ('insurance-chatbot',  'Insurance AI Assistant',        'prototype',     NULL, NULL, '#'),
    ('onboardly',          'Onboardly (HR Bot)',            'prototype',     NULL, NULL, '#'),
    ('jurassic-bites',     'Jurassic Bites',               'prototype',     NULL, NULL, '#'),
    -- Projects (2)
    ('site-itself',        'This Site',                    'project',       NULL, NULL, '#'),
    ('command-center',     'Command Center',               'project',       NULL, NULL, '#'),
    -- Teardowns (6)
    ('td-airbnb',          'Airbnb Mobile Teardown',       'teardown',      'How I''d''ve Built It', NULL, NULL),
    ('td-amazon',          'Amazon Mobile Teardown',        'teardown',      'How I''d''ve Built It', NULL, NULL),
    ('td-spotify',         'Spotify Discovery Teardown',    'teardown',      'How I''d''ve Built It', NULL, NULL),
    ('td-instagram',       'Instagram Feed Teardown',       'teardown',      'How I''d''ve Built It', NULL, NULL),
    ('td-geico',           'GEICO Mobile Teardown',         'teardown',      'How I''d''ve Built It', NULL, NULL),
    ('td-turbotax',        'TurboTax Teardown',             'teardown',      'How I''d''ve Built It', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ── Skill Links (89 mappings) ───────────────────────────────

INSERT INTO evidence_skill_links (source_id, skill_id) VALUES
    -- Kellogg (5)
    ('kellogg', 'ai-strategy'),
    ('kellogg', 'product-vision'),
    ('kellogg', 'go-to-market'),
    ('kellogg', 'ai-powered-discovery'),
    ('kellogg', 'product-led-growth'),
    -- General Assembly (4)
    ('general-assembly', 'sql'),
    ('general-assembly', 'python'),
    ('general-assembly', 'data-visualization'),
    ('general-assembly', 'tableau'),
    -- CSM (2)
    ('csm', 'scrum'),
    ('csm', 'team-facilitation'),
    -- McKinsey Strategy (3)
    ('mckinsey-strategy', 'competitive-analysis'),
    ('mckinsey-strategy', 'business-case'),
    ('mckinsey-strategy', 'executive-comms'),
    -- McKinsey Leadership (2)
    ('mckinsey-leadership', 'stakeholder-mgmt'),
    ('mckinsey-leadership', 'executive-comms'),
    -- McKinsey Problem (2)
    ('mckinsey-problem', 'problem-solving'),
    ('mckinsey-problem', 'hypothesis-driven'),
    -- McKinsey Product (3)
    ('mckinsey-product', 'product-strategy'),
    ('mckinsey-product', 'platform-building'),
    ('mckinsey-product', 'customer-advocacy'),
    -- Prosci (3)
    ('prosci', 'change-management'),
    ('prosci', 'stakeholder-mgmt'),
    ('prosci', 'adoption-strategy'),
    -- API Academy (2)
    ('api-academy', 'api-product-mgmt'),
    ('api-academy', 'developer-experience'),
    -- Azure (2)
    ('az-900', 'azure'),
    ('az-900', 'cloud-architecture'),
    -- GCP (2)
    ('gcp-cdl', 'google-cloud'),
    ('gcp-cdl', 'bigquery'),
    -- AWS (3)
    ('aws-ccp', 'aws'),
    ('aws-ccp', 'serverless'),
    ('aws-ccp', 'cloud-architecture'),
    -- Fenix (5)
    ('fenix', 'rag-pipelines'),
    ('fenix', 'prompt-engineering'),
    ('fenix', 'ai-product-integration'),
    ('fenix', 'ai-strategy'),
    ('fenix', 'python'),
    -- Scannibal (2)
    ('scannibal', 'ai-product-integration'),
    ('scannibal', 'product-strategy'),
    -- Persona Picker (3)
    ('persona-picker', 'product-strategy'),
    ('persona-picker', 'go-to-market'),
    ('persona-picker', 'customer-advocacy'),
    -- Insurance Chatbot (4)
    ('insurance-chatbot', 'ai-product-integration'),
    ('insurance-chatbot', 'rag-pipelines'),
    ('insurance-chatbot', 'prompt-engineering'),
    ('insurance-chatbot', 'python'),
    -- Onboardly (3)
    ('onboardly', 'rag-pipelines'),
    ('onboardly', 'ai-product-integration'),
    ('onboardly', 'prompt-engineering'),
    -- Jurassic Bites (3)
    ('jurassic-bites', 'ai-product-integration'),
    ('jurassic-bites', 'ai-powered-discovery'),
    ('jurassic-bites', 'google-cloud'),
    -- This Site (4)
    ('site-itself', 'cloud-architecture'),
    ('site-itself', 'serverless'),
    ('site-itself', 'ai-product-integration'),
    ('site-itself', 'platform-building'),
    -- Command Center (5)
    ('command-center', 'platform-building'),
    ('command-center', 'python'),
    ('command-center', 'ai-product-integration'),
    ('command-center', 'cloud-architecture'),
    ('command-center', 'product-strategy'),
    -- Airbnb Teardown (5)
    ('td-airbnb', 'competitive-analysis'),
    ('td-airbnb', 'customer-advocacy'),
    ('td-airbnb', 'business-case'),
    ('td-airbnb', 'hypothesis-driven'),
    ('td-airbnb', 'product-strategy'),
    -- Amazon Teardown (5)
    ('td-amazon', 'hypothesis-driven'),
    ('td-amazon', 'problem-solving'),
    ('td-amazon', 'customer-advocacy'),
    ('td-amazon', 'business-case'),
    ('td-amazon', 'data-visualization'),
    -- Spotify Teardown (5)
    ('td-spotify', 'ai-powered-discovery'),
    ('td-spotify', 'competitive-analysis'),
    ('td-spotify', 'customer-advocacy'),
    ('td-spotify', 'hypothesis-driven'),
    ('td-spotify', 'product-strategy'),
    -- Instagram Teardown (4)
    ('td-instagram', 'ai-strategy'),
    ('td-instagram', 'product-strategy'),
    ('td-instagram', 'competitive-analysis'),
    ('td-instagram', 'customer-advocacy'),
    -- GEICO Teardown (4)
    ('td-geico', 'ai-product-integration'),
    ('td-geico', 'customer-advocacy'),
    ('td-geico', 'business-case'),
    ('td-geico', 'problem-solving'),
    -- TurboTax Teardown (4)
    ('td-turbotax', 'customer-advocacy'),
    ('td-turbotax', 'problem-solving'),
    ('td-turbotax', 'business-case'),
    ('td-turbotax', 'hypothesis-driven')
ON CONFLICT (source_id, skill_id) DO NOTHING;

-- ── Cert Details (12 certifications) ────────────────────────

INSERT INTO evidence_cert_details (source_id, name, issuer_full, credential, logo, learned, display_skills, capstone_label, capstone) VALUES
    ('kellogg',
     'AI-Driven Product Strategy',
     'Kellogg School of Management, Northwestern University',
     'Issued Jun 2022 · Credential ID 53061978',
     'images/kellogg.jpeg',
     'Eight-week program on AI strategy in product. Covered using AI for analysis, testing ideas, understanding customers, and messaging. Key insight: AI is a strategic approach, not just a feature.',
     ARRAY['Product Vision & Strategy', 'AI-Powered Discovery', 'Opportunity Analysis', 'Go-to-Market Strategy', 'Monetization & Pricing', 'Product-Led Growth', 'UX & Agile Development', 'Stakeholder Alignment'],
     'Capstone',
     'Built AI-driven strategy documents from vision through launch. Used AI to model customers, test ideas, and create a solid roadmap.'),

    ('general-assembly',
     'Data Analytics',
     'General Assembly',
     NULL,
     'images/generalassembly_logo.jpeg',
     'Hands-on bootcamp on getting data to drive decisions. Learned SQL, Excel, Tableau, and Python. Focused on turning raw data into clear stories for products and business.',
     ARRAY['SQL', 'Excel', 'Tableau', 'Power BI', 'Python', 'Data Cleaning', 'Data Visualization', 'AI Fundamentals'],
     'Capstone',
     'Picked a real dataset, set a problem, and solved it with data. Cleaned, analyzed, and visualized the data. Presented findings to stakeholders.'),

    ('csm',
     'Certified ScrumMaster (CSM)',
     'Scrum Alliance',
     NULL,
     'images/scrum_alliance_logo.jpeg',
     'Scrum vs being truly agile. Learned sprint mechanics and how to unblock teams. Key shift: the PM''s role is creating space for engineers to excel, not managing ceremony details.',
     ARRAY['Scrum Framework', 'Sprint Planning', 'Retrospectives', 'Backlog Management', 'Team Facilitation', 'Servant Leadership'],
     'Certification',
     'Passed the CSM exam after a two-day intensive covering Scrum theory, roles, events, and artifacts. Applied the framework immediately to restructure sprint cadence on a cross-functional product team.'),

    ('mckinsey-strategy',
     'Business Strategy',
     'McKinsey & Company',
     'Issued Mar 2023 - <a href="https://www.credly.com/badges/4d7f3fcb-9200-48d1-8686-49a72bd46c94/linked_in_profile" target="_blank" rel="noopener">View Credential</a>',
     'images/mckinsey.jpeg',
     'McKinsey''s Strategy Method: evaluating competitive position, deciding where to play and how to win. Learned to connect product decisions to business strategy in language leadership understands.',
     ARRAY['McKinsey Strategy Method', 'Competitive Positioning', 'Strategic Assessment', 'Market Analysis', 'Business Case Development', 'Executive Communication'],
     'Certification',
     'Completed McKinsey Academy''s Business Strategy digital learning program, demonstrating the ability to assess strategy strength and apply McKinsey''s Strategy Method to real business challenges.'),

    ('mckinsey-leadership',
     'Management Accelerator - Asian Leadership Academy',
     'McKinsey & Company',
     'Issued Mar 2023 - <a href="https://www.credly.com/badges/83ef3aad-30ae-4cb4-a680-6a923a0be8b6/linked_in_profile" target="_blank" rel="noopener">View Credential</a>',
     'images/mckinsey.jpeg',
     'Tools for leading through uncertainty: adaptability, resilience, problem-solving, and strategy execution. Self-leadership module reframed how I navigate my career while staying authentic. Part of McKinsey''s Connected Leaders Academy for Asian professionals in management.',
     ARRAY['Adaptability & Resilience', 'Problem Solving for Impact', 'Business Strategy Execution', 'Self-Leadership', 'Critical Thinking', 'Executive Communication'],
     'Program',
     'Completed the 4-month McKinsey Management Accelerator as part of the Asian Leadership Academy, a cohort-based program with structured modules, assessments, and peer learning designed to strengthen core management capabilities.'),

    ('mckinsey-problem',
     'Problem Solving',
     'McKinsey & Company',
     'Issued Jan 2023 - <a href="https://www.credly.com/badges/fbec38ff-7042-4c45-be38-e16028e1df9d/linked_in_profile" target="_blank" rel="noopener">View Credential</a>',
     'images/mckinsey.jpeg',
     'McKinsey''s problem-solving approach: define issues clearly, prioritize, build hypothesis-driven analysis, synthesize findings. Directly shaped how I break down ambiguous product challenges and present solutions with clarity.',
     ARRAY['Structured Problem Solving', 'Problem Definition', 'Issue Prioritization', 'Hypothesis-Driven Analysis', 'Synthesis', 'Actionable Recommendations'],
     'Certification',
     'Completed McKinsey Academy''s Problem Solving program, demonstrating proficiency in defining problems, prioritizing issues, synthesizing findings, and developing structured recommendations using McKinsey frameworks.'),

    ('mckinsey-product',
     'Product Academy Fundamentals',
     'McKinsey & Company',
     'Issued Sep 2022 - <a href="https://www.credly.com/badges/a38009db-0acc-4901-b1a1-bdd9d4c3539a/linked_in_profile" target="_blank" rel="noopener">View Credential</a>',
     'images/mckinsey.jpeg',
     'Product development fundamentals: strategy, customer advocacy, building platforms. Eight-part series with leaders from DoorDash, The New York Times, Twilio, Microsoft. Core insight: product management is about solving problems and outcomes, not just shipping. Also covered how AI is reshaping product work.',
     ARRAY['Product Strategy', 'Platform Building', 'Customer Advocacy', 'Product Thinking', 'Responsible Product Management', 'AI for Product'],
     'Program',
     'Completed McKinsey''s Product Academy Fundamentals - a cohort-based speaker series featuring product leaders from Silicon Valley Product Group, DoorDash, Intuit, Microsoft, Mozilla, The New York Times, Twilio, and Bloomreach covering every aspect of the product development lifecycle.'),

    ('prosci',
     'Certified Change Management Professional (CCMP)',
     'Prosci',
     'Issued Apr 2021',
     'images/prosci_logo.jpeg',
     'Shipping is half the job. Getting people to use it is the other half. Learned Prosci''s 3-Phase Process and ADKAR model for adoption. Build sponsor coalitions, run readiness assessments, create change plans. Reshaped how I approach rollouts, especially internal tools where buy-in isn''t automatic.',
     ARRAY['ADKAR Model', 'Prosci 3-Phase Process', 'PCT Model', 'Sponsor Coalitions', 'Stakeholder Engagement', 'Resistance Management', 'Readiness Assessments', 'Adoption Strategy'],
     'Applied Project',
     'Applied the Prosci Methodology to a real change initiative during the 3-day intensive, building a Master Change Management Plan with sponsor mapping, ADKAR Blueprints, communication strategy, and a resistance mitigation plan - ready for immediate stakeholder conversations.'),

    ('api-academy',
     'Certified API Product Manager',
     'API Academy',
     'Issued May 2023 - Credential ID 165287856',
     'images/api_academy_logo.jpeg',
     'APIs are products. Learned design, deployment, documentation, and monetization. How to version, document for different audiences, and talk API strategy with engineers. Developer experience is a core product concern.',
     ARRAY['API Product Management', 'API Lifecycle', 'API Documentation', 'Developer Experience', 'DevOps for APIs', 'API Deployment & Publishing', 'Scalability & Evolvability', 'API Monetization'],
     'Certification',
     'Passed the API Product Manager certification exam covering API product management fundamentals, deployment and publishing, documentation and learning aids, DevOps scalability, and API lifecycle management. Required a minimum 80% score.'),

    ('az-900',
     'AZ-900 Microsoft Azure Fundamentals',
     'Microsoft AI Cloud Partner | Azure & DevOps Consulting',
     'Issued May 2023 - Credential ID 5043FDCC70E3',
     'images/cloudguru.jpeg',
     'Azure cloud fundamentals: VMs, networks, storage, governance tools. Gained fluency to evaluate Azure proposals and understand IaaS/PaaS/SaaS trade-offs when building products.',
     ARRAY['Azure Architecture', 'Cloud Concepts', 'IaaS / PaaS / SaaS', 'Azure Governance', 'Identity & Security', 'Cost Management', 'Virtual Networking'],
     'Certification',
     'Passed the AZ-900 exam covering cloud concepts, Azure architecture and services, and Azure management and governance. Microsoft fundamentals certifications do not expire.'),

    ('gcp-cdl',
     'Google Cloud Certified Cloud Digital Leader',
     'Google Cloud',
     'Issued Apr 2023',
     'images/cloudguru.jpeg',
     'Google Cloud for transformation: BigQuery and Cloud Storage for data, Vertex AI for ML, GKE and Cloud Run for infrastructure. Key skill: translate cloud capabilities into business value and organizational goals.',
     ARRAY['Google Cloud Platform', 'Digital Transformation', 'BigQuery', 'Cloud Storage', 'AI / ML on GCP', 'Infrastructure Modernization', 'Cloud Security'],
     'Certification',
     'Passed the Cloud Digital Leader exam covering digital transformation strategy, Google Cloud data and AI solutions, infrastructure modernization, and scaling cloud operations. Certification valid for 3 years.'),

    ('aws-ccp',
     'AWS Certified Cloud Practitioner',
     'Amazon Web Services',
     'Issued Apr 2023',
     'images/cloudguru.jpeg',
     'AWS fundamentals: EC2, S3, Lambda, RDS. Learned shared responsibility model and cost optimization. Now I can discuss architecture, understand billing impacts, and partner effectively with engineering teams.',
     ARRAY['AWS Core Services', 'Cloud Security', 'Shared Responsibility Model', 'Well-Architected Framework', 'Billing & Pricing', 'IAM', 'Serverless'],
     'Certification',
     'Passed the CLF-C02 exam covering cloud concepts, security and compliance, core AWS technology and services, and billing and pricing. Demonstrated ability to explain the value of the AWS Cloud and position core services for common use cases.')
ON CONFLICT (source_id) DO NOTHING;

-- ── Evidence Item Details (14 prototypes/projects/teardowns) ─

INSERT INTO evidence_item_details (source_id, name, type, tagline, logo, description, tech_stack, display_skills, highlight, status) VALUES
    ('fenix',
     'Fenix AI Assistant', 'prototype',
     'A conversational AI that knows everything on this site and talks about it like I would.',
     'images/favicon.png',
     'RAG-powered chat assistant embedded across the site. Visitors ask questions about my work, teardowns, career, or prototypes. Fenix pulls from a vector database of all site content, generates answers with inline citations, and adapts its tone based on who''s asking. Built on Claude, Voyage AI embeddings, and Supabase pgvector.',
     ARRAY['Claude API (Anthropic)', 'FastAPI on Vercel', 'Supabase pgvector', 'Voyage AI Embeddings', 'Server-Sent Events'],
     ARRAY['RAG Pipelines', 'Prompt Engineering', 'AI Product Integration', 'AI Strategy', 'Python'],
     'Every answer cites its source. Fenix links directly to the page it pulled from, so visitors can verify and go deeper. No black-box hand-waving.',
     'Live MVP'),

    ('scannibal',
     'Scannibal', 'prototype',
     'Point your camera at anything. Find out if it''s safe.',
     'images/favicon.png',
     'iOS app that uses computer vision to scan food labels, supplements, skincare, plants, and household items for safety. Nine scanning modes, six user profiles for personalized risk context, and a butler-voiced AI that delivers findings with clinical precision. 100% of paid-tier proceeds go to charity.',
     ARRAY['Expo / React Native', 'Google Gemini 2.5 Flash', 'ElevenLabs TTS', 'Vercel Serverless', 'EAS Build Pipeline'],
     ARRAY['AI Product Integration', 'Product Strategy'],
     'Built a full product from zero to TestFlight: onboarding, profile system, nine scan modes, bilingual support, charity integration, and a kid-friendly mode. Shipped it as a solo PM-engineer.',
     'TestFlight Beta'),

    ('persona-picker',
     'Persona Picker', 'prototype',
     'Six visitors walk into a site. They each see a different one.',
     'images/favicon.png',
     'First-touch conversion tool on the landing page. Visitors choose from six illustrated personas, and the entire site adapts: content reorders, accent colors shift, Fenix adjusts its tone, and CTAs reframe. Built with zero dependencies, Midjourney character art, and glassmorphism UI with choreographed animations.',
     ARRAY['Vanilla JS (zero deps)', 'Midjourney Character Art', 'CSS Glassmorphism', 'localStorage Persistence', 'Clip-Path Animations'],
     ARRAY['Product Strategy', 'Go-to-Market', 'Customer Advocacy'],
     'Doesn''t ask ''what are you interested in.'' Asks ''who are you'' and reframes everything around that identity. Six fully realized characters with names, visual language, and distinct site experiences.',
     'Production'),

    ('insurance-chatbot',
     'Insurance AI Assistant', 'prototype',
     'Multi-turn conversational agent that actually remembers what you said three messages ago.',
     'images/favicon.png',
     'LangGraph-powered insurance assistant that handles claims inquiries, coverage questions, and filing workflows. Uses state machines for conversation flow, maintaining context across multi-turn exchanges. Built to demonstrate agent architecture patterns: tool use, state transitions, and graceful fallback when the model doesn''t know something.',
     ARRAY['LangGraph', 'LangChain', 'Claude API', 'Python', 'State Machines'],
     ARRAY['AI Product Integration', 'Product Strategy'],
     'Demonstrates the difference between a chatbot and an agent. The insurance domain forced real decisions about state management, context windows, and knowing when to hand off to a human.',
     'Live on MadLab'),

    ('onboardly',
     'Onboardly', 'prototype',
     'An HR assistant that only tells you things it can actually find in the handbook.',
     'images/favicon.png',
     'RAG-based HR policy assistant that answers employee questions by searching over uploaded policy documents. Uses TF-IDF similarity plus Claude for generation. Designed around honesty: when Onboardly can''t find an answer in the docs, it says so instead of hallucinating a policy that doesn''t exist.',
     ARRAY['Claude API', 'TF-IDF + Cosine Similarity', 'Flask + Python', 'Document Chunking', 'RAG Pipeline'],
     ARRAY['AI Product Integration', 'Product Strategy'],
     'The design principle was ''never make up a policy.'' Built the retrieval layer to surface confidence scores and let the model say ''I don''t have that information'' rather than confabulate. Honest AI isn''t a feature, it''s an architecture decision.',
     'Live on MadLab'),

    ('jurassic-bites',
     'Jurassic Bites', 'prototype',
     'A Dialogflow reservation bot that taught me where NLP breaks and where it shines.',
     'images/favicon.png',
     'Restaurant reservation assistant built on Google Dialogflow. Handles intent matching, entity extraction (dates, times, party sizes, dietary restrictions), and multi-turn booking flows. Built to compare structured NLP (Dialogflow''s intent/entity model) with freeform LLM approaches and understand where each works best.',
     ARRAY['Dialogflow', 'Google Cloud NLP', 'Entity Extraction', 'Intent Matching', 'Webhook Fulfillment'],
     ARRAY['AI Product Integration', 'Product Strategy'],
     'The real takeaway wasn''t the bot. It was learning that structured NLP is still better than LLMs for narrow, high-stakes tasks (booking a table for 7pm has zero ambiguity tolerance). Different tools for different problems.',
     'Live on MadLab'),

    ('site-itself',
     'This Site', 'project',
     'The portfolio is the proof. Not a pitch about capability, a working demonstration of it.',
     'images/favicon.png',
     'A portfolio-turned-platform built as a permanent home. Teardowns of real products, interactive prototypes, a personalization engine, an AI assistant, and a deliberate architecture that demonstrates the exact skills it claims. Static frontend on Cloudflare Pages, serverless backend on Vercel, AI-powered search via pgvector.',
     ARRAY['Cloudflare Pages', 'Vercel Serverless', 'Supabase PostgreSQL', 'Claude API', 'Vanilla HTML/CSS/JS'],
     ARRAY['Cloud Architecture', 'Serverless', 'AI Product Integration', 'Platform Building'],
     'Zero-framework frontend at ~200KB total. The site doesn''t argue that I can build AI-native products. You''re standing inside one.',
     'Live & Evolving'),

    ('command-center',
     'Command Center', 'project',
     'The ops backend for everything on this site. 18 modules, one brain.',
     NULL,
     'Full-stack content creation platform powering the site behind the scenes. Teardown co-creation workflows with approve/revise loops, resume pipeline (5-stage customization), content audit, Fenix training data preparation, journaling, and standards enforcement. 18+ FastAPI routers with Claude API integration and SSE streaming for long-running operations.',
     ARRAY['Next.js 16 + React 19', 'FastAPI + Python', 'Claude API (SSE streaming)', 'SQLite + Supabase', 'GitHub OAuth'],
     ARRAY['Cloud Architecture', 'Serverless', 'AI Product Integration', 'Platform Building'],
     'Not a dashboard. A co-creation platform. Every teardown, resume, and content piece on this site was built through Command Center''s step-based workflows with human-in-the-loop review at every stage.',
     'Live (Internal)'),

    ('td-airbnb',
     'Airbnb Mobile Teardown', 'teardown',
     'Why experienced travelers with 15+ bookings are quietly switching back to hotels.',
     'images/favicon.png',
     'Analyzed the gap between Airbnb''s booking experience for new vs. experienced travelers. Identified trust erosion through cancellation friction, listing accuracy gaps, and search filter limitations. Built a customer segmentation model (new vs. experienced power users), mapped the full booking journey with sentiment analysis, and proposed redesigns with wireframes targeting the retention problem specifically.',
     ARRAY['Customer Segmentation', 'Journey Mapping', 'Competitive Analysis', 'Wireframing', 'Business Case Modeling'],
     ARRAY['Product Strategy', 'Go-to-Market', 'Customer Advocacy'],
     'This isn''t a UX review. It''s a retention strategy. The teardown connects user behavior data to a specific business case: what Airbnb loses when experienced travelers defect, and exactly what product changes would stop the bleeding.',
     'Published'),

    ('td-amazon',
     'Amazon Mobile Teardown', 'teardown',
     'Search is failing the people who buy the most. Voice and visual search aren''t fixing it.',
     'images/favicon.png',
     'Root cause analysis of Amazon''s mobile search experience for experienced buyers. Evaluated why voice search and visual search haven''t solved the core problems: filter friction, irrelevant results, and task abandonment. Built hypothesis trees for each failure mode, tested them against actual mobile flows, and proposed redesigns backed by conversion impact estimates.',
     ARRAY['Hypothesis-Driven Analysis', 'Root Cause Analysis', 'Search UX Evaluation', 'Task Analysis', 'Conversion Modeling'],
     ARRAY['Product Strategy', 'Go-to-Market', 'Customer Advocacy'],
     'The counterintuitive finding: Amazon''s biggest search problem isn''t relevance. It''s that experienced users know exactly what they want, and the app makes it harder to narrow down than to browse. The fix isn''t better algorithms, it''s better filters.',
     'Published'),

    ('td-spotify',
     'Spotify Discovery Teardown', 'teardown',
     'Why Discover Weekly gets stuck in a loop the longer you use it.',
     'images/favicon.png',
     'Analyzed the algorithmic plateau in Spotify''s recommendation engine for long-term subscribers. When you''ve used Spotify for years, Discover Weekly converges on your established taste and stops pushing boundaries. Mapped the feedback loop (listen > reinforce > recommend similar > repeat) and proposed system-level changes to introduce controlled novelty without destroying the trust signal that makes Discover Weekly work.',
     ARRAY['Algorithm Analysis', 'Feedback Loop Modeling', 'Personalization Systems', 'User Behavior Research', 'Recommendation Design'],
     ARRAY['Product Strategy', 'Go-to-Market', 'Customer Advocacy'],
     'Most teardowns critique the UI. This one critiques the algorithm''s assumptions. The insight: Spotify optimizes for engagement (did you finish the song?) when it should optimize for expansion (did you discover something new you''ll keep?).',
     'Published'),

    ('td-instagram',
     'Instagram Feed Teardown', 'teardown',
     'What the shift from chronological to algorithmic actually cost users.',
     'images/favicon.png',
     'Examined the trade-offs of Instagram''s algorithmic feed vs. chronological ordering. Analyzed what users lost (serendipity, completeness, creator fairness) and what they gained (relevance, engagement). Proposed a user-choice model that gives people control over their feed algorithm, with business impact analysis showing how choice can actually improve engagement metrics, not hurt them.',
     ARRAY['Platform Strategy', 'Algorithm Impact Assessment', 'User Choice Modeling', 'Business Impact Analysis', 'Creator Economy Analysis'],
     ARRAY['Product Strategy', 'Go-to-Market', 'Customer Advocacy'],
     'The conventional wisdom says algorithmic feeds are always better for engagement. The analysis shows that''s only true in aggregate. For power users and creators, the loss of control actively drives disengagement. Choice isn''t anti-business, it''s a retention play.',
     'Published'),

    ('td-geico',
     'GEICO Mobile Teardown', 'teardown',
     'An insurance app designed for browsing when users just want to get things done.',
     'images/favicon.png',
     'Analyzed GEICO''s mobile app against how insurance customers actually use it: filing claims, checking coverage, making payments. The app''s architecture assumes browsing behavior, but insurance is a task-driven domain. Evaluated their AI assistant''s effectiveness, proposed a task-based navigation redesign with wireframes, and built a business case around reduced support call volume.',
     ARRAY['Task-Based Design', 'AI/Conversational Analysis', 'Journey Mapping', 'Support Cost Modeling', 'Navigation Architecture'],
     ARRAY['Product Strategy', 'Go-to-Market', 'Customer Advocacy'],
     'Insurance is one of the clearest ''task not browse'' domains. People open GEICO''s app because something happened. The teardown shows how reorienting from feature-based to task-based navigation could cut support calls by redirecting users who currently give up and call instead.',
     'Published'),

    ('td-turbotax',
     'TurboTax Teardown', 'teardown',
     'The support gap between ''we''ll guide you'' and what actually happens when you''re stuck.',
     'images/favicon.png',
     'Analyzed the disconnect between TurboTax''s promise of guided tax filing and the reality when users hit edge cases. Mapped the support funnel from in-app help through community forums to live support, identifying where users fall through the gaps. Proposed in-context help solutions that surface community answers at the point of confusion instead of sending users on a multi-step support journey.',
     ARRAY['Discovery Research', 'Support Funnel Analysis', 'In-Context Help Design', 'Community Knowledge Integration', 'Wireframing'],
     ARRAY['Product Strategy', 'Go-to-Market', 'Customer Advocacy'],
     'TurboTax''s biggest competitor isn''t H&R Block. It''s the anxiety of ''am I doing this right?'' The teardown shows that the support gap isn''t about missing features, it''s about surfacing existing answers at the moment of doubt.',
     'Published')
ON CONFLICT (source_id) DO NOTHING;
