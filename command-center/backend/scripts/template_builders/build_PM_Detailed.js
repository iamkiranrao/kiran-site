const fs = require("docx");
const { Document, Packer, Paragraph, TextRun, ExternalHyperlink,
        AlignmentType, TabStopType, TabStopPosition,
        BorderStyle } = fs;

// ===== DESIGN SYSTEM =====
// PM Detailed: dense 2-page layout, same design system as gold standard
// Differences from 2-Pager: tighter margins, tighter spacing, more bullets,
// italic role summary lines, no Career Highlights, no Interests
// All space goes to experience depth

const FONT = "Calibri";
const BODY_SIZE = 20;      // 10pt
const HEADER_SIZE = 22;    // 11pt
const NAME_SIZE = 40;      // 20pt
const CONTACT_SIZE = 19;   // 9.5pt
const TAGLINE_SIZE = 20;   // 10pt
const NAVY = "1F3864";
const MARGIN = 1008;       // 0.7" all sides — balanced density for 2-page detailed

// ===== CONTENT =====
// 30 unique leading verbs across the entire document:
// Pivoted, Shipped, Launched, Defined, Drove, Led, Scaled, Built,
// Established, Owned, Integrated, Executed, Redesigned, Grew,
// Designed, Created, Deployed, Delivered, Consolidated, Ran, Managed,
// Translated, Negotiated, Revamped, Applied, Enabled, Introduced, Advised,
// Directed, Oversaw
// Plus 1 outcome-first bullet (no leading verb)
// Role summaries use: Owns, Led, Directed, Oversaw, Digital (noun-first)

const summary = "Product leader with 15+ years building and scaling digital platforms across mobile, AI, and fintech. Scaled a consumer app from 18M to 32M MAU, shipped AI products reaching 27.5M interactions, and led a startup pivot that expanded TAM by 3.2x. Equally at home driving 0-to-1 or managing a $20M product portfolio at enterprise scale. Deep expertise in experimentation frameworks, platform migrations, and cross-functional leadership spanning engineering, design, data science, and operations.";

const bullets = {
  avatour: {
    roleSummary: "Owns product vision and roadmap for an AR/VR startup pivoting to AI-powered inspection workflows.",
    items: [
      "Pivoted product from live inspections to AI-assisted reporting, expanding TAM by 3.2x to $45M.",
      "Shipped AI summarization engine for 360 inspection workflows, cutting documentation time by 80% for field teams.",
      "Launched conversational AI agent handling onboarding and support, improving NPS and reducing ticket volume by 37%.",
      "Defined product roadmap and GTM strategy for the AI-first pivot, aligning engineering, sales, and customer success teams.",
      "Introduced user research program with field teams to validate AI use cases, shaping product priorities for 3 quarterly releases.",
    ],
  },
  wfDigital: {
    roleSummary: "Led mobile and AI strategy for Wells Fargo's flagship consumer app serving 32M users across all digital channels.",
    items: [
      "Drove consumer mobile app from 18M to 32M MAU over 18 months, advancing JD Power from #9 to #3 among US banks.",
      "Migrated platform to API-first architecture serving 32M users, achieving 35% faster data retrieval across all channels.",
      "Scaled Fargo AI assistant from 4.1M to 27.5M interactions, expanding use cases across payments and financial guidance.",
      "23% conversion uplift after introducing in-app cross-sell marketplace for loans, deposits, and wealth products.",
      "Established experimentation framework for mobile features, running 40+ A/B tests to inform roadmap prioritization.",
      "Built push, in-app, and lifecycle messaging system that lifted feature adoption by 37% across the consumer app.",
      "Revamped mobile app profile segmentation and personalized UX, boosting visual appeal scores by 11.2%.",
    ],
  },
  firstRepublic: {
    roleSummary: "Directed full digital banking transformation across payments, lending, and wealth for a high-net-worth client base of 1M+.",
    items: [
      "Owned $20M digital portfolio across payments, lending, and wealth; led 22-person team through full platform rebuild.",
      "Integrated Zelle P2P and Apple Pay for 1M+ clients, driving 27% increase in mobile transactions within 90 days of launch.",
      "Executed core banking migration from Fiserv to FIS, enabling real-time wires and contributing to 18% YoY revenue growth.",
      "Redesigned mobile lending with e-signature closing, cutting loan cycle time by 20% and boosting completion rates.",
      "Grew high-net-worth digital engagement by launching mobile-first wealth dashboard, raising NPS by 12 points.",
      "Deployed AI compliance engine to extract structured data from loan documents, improving regulatory accuracy by 90%.",
    ],
  },
  wfVirtual: {
    roleSummary: "Oversaw mobile-first innovation for payments and authentication serving 25M digital banking users.",
    items: [
      "Designed multi-factor authentication for 25M digital banking users, reducing unauthorized access by 40%.",
      "Created DailyChange payments app, increasing ACH transfers by 27% through automated savings and bill-pay features.",
      "Enabled cardless ATM access via mobile wallet, reducing card-present fraud by 30% across 13K ATMs nationwide.",
      "Delivered biometric login (fingerprint and facial recognition), reaching 60% adoption and lifting auth success by 25%.",
      "Applied device fingerprinting and behavioral analytics for risk-based auth, reducing account takeover attempts by 35%.",
      "Expanded mobile payments by launching Wells Fargo Digital Wallets on Apple Pay and Google Pay for 25M users.",
    ],
  },
  magley: {
    roleSummary: "Digital product consulting for Starbucks, Hilton, Yahoo!, and Wachovia across retail, hospitality, and financial services.",
    items: [
      "Ran discovery workshops for Fortune 500 clients, translating stakeholder needs into web and mobile product roadmaps.",
      "Conducted competitive analysis and market sizing for enterprise clients, building $500K-$20M digital business cases.",
      "Reworked in-app alerts and messaging strategy for a consumer loyalty platform, improving notification opt-in rates by 15%.",
      "Performed user interviews and usability testing across 3 engagements, surfacing insights that shaped product roadmaps.",
      "Developed customer acquisition and retention strategy for a loyalty platform, growing active digital users by 15%.",
    ],
  },
};

// ===== HELPER FUNCTIONS =====

function sectionHeader(text) {
  return new Paragraph({
    spacing: { before: 220, after: 70 },
    keepNext: true,
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999", space: 2 } },
    children: [
      new TextRun({ text: text, bold: true, font: FONT, size: HEADER_SIZE, allCaps: true }),
    ],
  });
}

function roleHeader(title, company, dates) {
  return new Paragraph({
    spacing: { before: 160, after: 0 },
    keepNext: true,
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: [
      new TextRun({ text: title, bold: true, font: FONT, size: BODY_SIZE }),
      new TextRun({ text: ` | ${company}`, font: FONT, size: BODY_SIZE }),
      new TextRun({ text: `\t${dates}`, font: FONT, size: BODY_SIZE }),
    ],
  });
}

function roleSummaryLine(text) {
  return new Paragraph({
    spacing: { before: 20, after: 20 },
    keepNext: true,
    children: [
      new TextRun({ text: text, font: FONT, size: BODY_SIZE, italics: true }),
    ],
  });
}

function bullet(text) {
  return new Paragraph({
    spacing: { before: 28, after: 28 },
    indent: { left: 216, hanging: 216 },  // 0.15" indent
    children: [
      new TextRun({ text: "• ", font: FONT, size: BODY_SIZE }),
      new TextRun({ text: text, font: FONT, size: BODY_SIZE }),
    ],
  });
}

function plainText(text, opts = {}) {
  return new Paragraph({
    spacing: { before: opts.before || 0, after: opts.after || 20 },
    alignment: opts.alignment || undefined,
    children: [
      new TextRun({
        text: text,
        font: FONT,
        size: opts.size || BODY_SIZE,
        bold: opts.bold || false,
        italics: opts.italics || false,
      }),
    ],
  });
}

// Helper to build a role section with summary line
function roleSection(title, company, dates, roleData) {
  return [
    roleHeader(title, company, dates),
    roleSummaryLine(roleData.roleSummary),
    ...roleData.items.map(b => bullet(b)),
  ];
}

// ===== BUILD DOCUMENT =====

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: FONT, size: BODY_SIZE },
      },
    },
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
      },
    },
    children: [
      // === NAME ===
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({ text: "KIRAN GORAPALLI", bold: true, font: FONT, size: NAME_SIZE, color: NAVY }),
        ],
      }),

      // === CONTACT LINE ===
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({ text: "(707) 301-1479  |  ", font: FONT, size: CONTACT_SIZE }),
          new ExternalHyperlink({
            children: [new TextRun({ text: "kiranrg2026@gmail.com", font: FONT, size: CONTACT_SIZE, style: "Hyperlink" })],
            link: "mailto:kiranrg2026@gmail.com",
          }),
          new TextRun({ text: "  |  ", font: FONT, size: CONTACT_SIZE }),
          new ExternalHyperlink({
            children: [new TextRun({ text: "LinkedIn", font: FONT, size: CONTACT_SIZE, style: "Hyperlink" })],
            link: "https://linkedin.com/in/kirangorapalli",
          }),
          new TextRun({ text: "  |  ", font: FONT, size: CONTACT_SIZE }),
          new ExternalHyperlink({
            children: [new TextRun({ text: "Portfolio", font: FONT, size: CONTACT_SIZE, style: "Hyperlink" })],
            link: "https://kiranrao.ai",
          }),
        ],
      }),

      // === TAGLINE ===
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: "Product leader who has scaled apps to 32M users and shipped AI products from 0-to-1 across mobile, AI, and fintech.",
            font: FONT, size: TAGLINE_SIZE, italics: true,
          }),
        ],
      }),

      // === SUMMARY ===
      sectionHeader("Summary"),
      plainText(summary, { before: 30, after: 30 }),

      // === CORE COMPETENCIES ===
      sectionHeader("Core Competencies"),
      new Paragraph({
        spacing: { before: 30, after: 0 },
        children: [
          new TextRun({ text: "• Product Strategy & Roadmap  • Go-to-Market (GTM)  • Product-Led Growth (PLG)  • AI/ML Product Strategy", font: FONT, size: BODY_SIZE }),
        ],
      }),
      new Paragraph({
        spacing: { before: 10, after: 0 },
        children: [
          new TextRun({ text: "• P&L Ownership  • Revenue Growth  • Stakeholder Management  • Platform & API Strategy", font: FONT, size: BODY_SIZE }),
        ],
      }),
      new Paragraph({
        spacing: { before: 10, after: 0 },
        children: [
          new TextRun({ text: "• A/B Testing & Experimentation  • Conversion Optimization  • User Research  • Product Analytics", font: FONT, size: BODY_SIZE }),
        ],
      }),
      new Paragraph({
        spacing: { before: 10, after: 0 },
        children: [
          new TextRun({ text: "• Data-Driven Decision Making  • Cross-Functional Leadership  • Roadmap Prioritization  • Product Lifecycle Management", font: FONT, size: BODY_SIZE }),
        ],
      }),

      // === EXPERIENCE ===
      sectionHeader("Experience"),

      // Avatour (5 bullets + role summary)
      ...roleSection("VP of Product", "Avatour AI, AR/VR Startup", "Oct 2025 - Present", bullets.avatour),

      // WF Digital (7 bullets + role summary)
      ...roleSection("VP of Product, Mobile & AI Growth", "Wells Fargo Digital Strategy & AI", "Nov 2023 - Oct 2025", bullets.wfDigital),

      // First Republic (6 bullets + role summary)
      ...roleSection("Director, Product Management", "First Republic, Digital Channels", "Apr 2016 - Oct 2023", bullets.firstRepublic),

      // WF Virtual (6 bullets + role summary) — forced to page 2 for balanced layout
      new Paragraph({
        spacing: { before: 160, after: 0 },
        keepNext: true,
        pageBreakBefore: true,
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          new TextRun({ text: "AVP, Digital Product Manager", bold: true, font: FONT, size: BODY_SIZE }),
          new TextRun({ text: " | Wells Fargo Virtual Channels", font: FONT, size: BODY_SIZE }),
          new TextRun({ text: "\tAug 2012 - Apr 2016", font: FONT, size: BODY_SIZE }),
        ],
      }),
      roleSummaryLine(bullets.wfVirtual.roleSummary),
      ...bullets.wfVirtual.items.map(b => bullet(b)),

      // Magley (5 bullets + role summary)
      ...roleSection("Senior Consultant", "Magley & Associates", "Dec 2008 - Aug 2012", bullets.magley),

      // === EDUCATION ===
      sectionHeader("Education & Certifications"),
      new Paragraph({
        spacing: { before: 30, after: 10 },
        children: [
          new TextRun({ text: "B.S. Business Administration", bold: true, font: FONT, size: BODY_SIZE }),
          new TextRun({ text: ", San Diego State University", font: FONT, size: BODY_SIZE }),
        ],
      }),
      new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({ text: "Product Strategy", bold: true, font: FONT, size: BODY_SIZE }),
          new TextRun({ text: ", Kellogg School of Management", font: FONT, size: BODY_SIZE }),
        ],
      }),

      // === TECHNICAL COMPETENCIES ===
      sectionHeader("Technical Competencies"),
      new Paragraph({
        spacing: { before: 30, after: 10 },
        children: [
          new TextRun({ text: "PM Tools: ", bold: true, font: FONT, size: BODY_SIZE }),
          new TextRun({ text: "Jira | Confluence | Aha! | Figma | Pendo | Asana | Notion | Linear", font: FONT, size: BODY_SIZE }),
        ],
      }),
      new Paragraph({
        spacing: { before: 0, after: 10 },
        children: [
          new TextRun({ text: "Analytics: ", bold: true, font: FONT, size: BODY_SIZE }),
          new TextRun({ text: "Mixpanel | Amplitude | Google Analytics | Looker | SQL | Snowflake | Tableau", font: FONT, size: BODY_SIZE }),
        ],
      }),
      new Paragraph({
        spacing: { before: 0, after: 10 },
        children: [
          new TextRun({ text: "AI & ML: ", bold: true, font: FONT, size: BODY_SIZE }),
          new TextRun({ text: "OpenAI | Claude | Prompt Engineering | Python", font: FONT, size: BODY_SIZE }),
        ],
      }),
      new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({ text: "Frameworks: ", bold: true, font: FONT, size: BODY_SIZE }),
          new TextRun({ text: "Agile | Scrum | OKRs | RICE | JTBD | Dual-Track Discovery", font: FONT, size: BODY_SIZE }),
        ],
      }),
    ],
  }],
});

// Write to file
const fsp = require("fs");
const outPath = process.argv[2] || "/sessions/intelligent-tender-volta/PM_Detailed_clean.docx";
Packer.toBuffer(doc).then(buffer => {
  fsp.writeFileSync(outPath, buffer);
  console.log("Written to", outPath);
});
