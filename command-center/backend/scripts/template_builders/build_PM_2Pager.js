const fs = require("docx");
const { Document, Packer, Paragraph, TextRun, ExternalHyperlink,
        AlignmentType, TabStopType, TabStopPosition,
        BorderStyle } = fs;

// ===== DESIGN SYSTEM =====
// PM 2-Pager: same design system as PM 1-Pager gold standard
// Additions: Summary paragraph, Career Highlights section, expanded bullets
// Font: Calibri 10pt body, 11pt section headers, 20pt name
// Margins: 0.6" all sides (864 DXA)
// Target: exactly 2 pages, no orphan words

const FONT = "Calibri";
const BODY_SIZE = 20;      // 10pt
const HEADER_SIZE = 22;    // 11pt
const NAME_SIZE = 40;      // 20pt
const CONTACT_SIZE = 19;   // 9.5pt
const TAGLINE_SIZE = 20;   // 10pt
const NAVY = "1F3864";
const MARGIN = 1008;       // 0.7" all sides — balanced for 2-pager

// ===== CONTENT =====
// All 25 verbs unique across the entire document: Expanded, Repositioned,
// Pivoted, Shipped, Launched, Defined, Drove, Led, Scaled, Built,
// Established, Owned, Integrated, Executed, Redesigned, Grew,
// Designed, Created, Deployed, Delivered, Consolidated, Ran, Managed,
// Translated, Negotiated
// Plus 2 outcome-first bullets (no leading verb)

const summary = "Product leader with 15+ years building and scaling digital platforms across mobile, AI, and fintech. Scaled a consumer app from 18M to 32M MAU, shipped AI products reaching 27.5M interactions, and led a startup pivot that expanded TAM by 3.2x. Equally at home driving 0-to-1 or managing a $20M product portfolio at enterprise scale.";

const careerHighlights = [
  "18M to 32M MAU growth on Wells Fargo's consumer mobile app, advancing JD Power from #9 to #3 among US banks.",
  "Expanded Fargo AI assistant from 4.1M to 27.5M interactions, cutting contact center costs by 17%.",
  "Repositioned Avatour from live inspections to AI-assisted reporting, growing total addressable market by 3.2x to $45M.",
  "$20M digital portfolio at First Republic spanning payments, lending, and wealth, delivering 18% YoY revenue growth.",
];

const bullets = {
  avatour: [
    "Pivoted product from live inspections to AI-assisted reporting, expanding TAM by 3.2x to $45M.",
    "Shipped AI summarization engine for 360 inspection workflows, cutting documentation time by 80% for field teams.",
    "Launched conversational AI agent handling onboarding and support, improving NPS and reducing ticket volume by 37%.",
    "Defined product roadmap and GTM strategy for the AI-first pivot, aligning engineering, sales, and customer success teams.",
  ],
  wfDigital: [
    "Drove consumer mobile app from 18M to 32M MAU over 18 months, advancing JD Power from #9 to #3 among US banks.",
    "Led platform migration to API-first architecture serving 32M users, achieving 35% faster data retrieval across all channels.",
    "Scaled Fargo AI assistant from 4.1M to 27.5M interactions, expanding use cases across payments and financial guidance.",
    "23% conversion uplift after introducing in-app cross-sell marketplace for loans, deposits, and wealth products.",
    "Built push, in-app, and lifecycle messaging system that lifted feature adoption by 37% across the consumer app.",
    "Established experimentation framework for mobile features, running 40+ A/B tests to inform roadmap prioritization.",
  ],
  firstRepublic: [
    "Owned $20M digital portfolio across payments, lending, and wealth; led 22-person team through full platform rebuild across web and mobile.",
    "Integrated Zelle P2P and Apple Pay for 1M+ clients, driving 27% increase in mobile transactions within 90 days of launch.",
    "Executed core banking migration from Fiserv to FIS, enabling real-time wires and contributing to 18% YoY revenue growth.",
    "Redesigned mobile lending with e-signature closing, cutting loan cycle time by 20% and boosting completion rates.",
    "Grew high-net-worth digital engagement by launching mobile-first wealth dashboard, raising NPS by 12 points.",
  ],
  wfVirtual: [
    "Designed multi-factor authentication for 25M digital banking users, reducing unauthorized access by 40%.",
    "Created DailyChange payments app, increasing ACH transfers by 27% through automated savings and bill-pay features.",
    "Deployed cardless ATM access via mobile wallet, reducing card-present fraud by 30% across 13K ATMs nationwide.",
    "Delivered biometric login (fingerprint and facial recognition), reaching 60% adoption and lifting auth success by 25%.",
    "Consolidated identity verification across online and mobile banking, reducing account takeover incidents by 35%.",
  ],
  magley: [
    "Ran discovery workshops for Starbucks, Hilton, Yahoo!, and Wachovia, translating stakeholder needs into roadmaps.",
    "Conducted competitive analysis and market sizing for enterprise clients, building $500K-$20M digital business cases.",
    "Reworked in-app alerts and messaging strategy for a consumer loyalty platform, improving notification opt-in by 15%.",
    "Developed customer acquisition and retention strategy for a loyalty platform, growing active digital users by 15%.",
  ],
};

// ===== HELPER FUNCTIONS =====

function sectionHeader(text) {
  return new Paragraph({
    spacing: { before: 240, after: 80 },
    keepNext: true,  // prevent orphaned section headers at page breaks
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999", space: 2 } },
    children: [
      new TextRun({ text: text, bold: true, font: FONT, size: HEADER_SIZE, allCaps: true }),
    ],
  });
}

function roleHeader(title, company, dates) {
  return new Paragraph({
    spacing: { before: 160, after: 30 },
    keepNext: true,  // prevent orphaned role headers at page breaks
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: [
      new TextRun({ text: title, bold: true, font: FONT, size: BODY_SIZE }),
      new TextRun({ text: ` | ${company}`, font: FONT, size: BODY_SIZE }),
      new TextRun({ text: `\t${dates}`, font: FONT, size: BODY_SIZE }),
    ],
  });
}

function bullet(text) {
  return new Paragraph({
    spacing: { before: 36, after: 36 },
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
            link: "https://kirangorapalli.com",
          }),
        ],
      }),

      // === TAGLINE ===
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: "Product leader who has scaled apps to 32M users and shipped AI products from 0-to-1 across mobile, AI, and fintech.",
            font: FONT, size: TAGLINE_SIZE, italics: true,
          }),
        ],
      }),

      // === SUMMARY ===
      sectionHeader("Summary"),
      plainText(summary, { before: 40, after: 40 }),

      // === CAREER HIGHLIGHTS ===
      sectionHeader("Career Highlights"),
      ...careerHighlights.map(b => bullet(b)),

      // === CORE COMPETENCIES ===
      sectionHeader("Core Competencies"),
      new Paragraph({
        spacing: { before: 40, after: 0 },
        children: [
          new TextRun({ text: "• Product Strategy & Roadmap  • Go-to-Market (GTM)  • Product-Led Growth (PLG)  • AI/ML Product Strategy", font: FONT, size: BODY_SIZE }),
        ],
      }),
      new Paragraph({
        spacing: { before: 20, after: 0 },
        children: [
          new TextRun({ text: "• P&L Ownership  • Revenue Growth  • Stakeholder Management  • Platform & API Strategy", font: FONT, size: BODY_SIZE }),
        ],
      }),
      new Paragraph({
        spacing: { before: 20, after: 0 },
        children: [
          new TextRun({ text: "• A/B Testing & Experimentation  • Conversion Optimization  • User Research  • Product Analytics", font: FONT, size: BODY_SIZE }),
        ],
      }),
      new Paragraph({
        spacing: { before: 20, after: 0 },
        children: [
          new TextRun({ text: "• Data-Driven Decision Making  • Cross-Functional Leadership  • Roadmap Prioritization  • Product Lifecycle Management", font: FONT, size: BODY_SIZE }),
        ],
      }),

      // === EXPERIENCE ===
      sectionHeader("Experience"),

      // Avatour (4 bullets)
      roleHeader("VP of Product", "Avatour AI, AR/VR Startup", "Oct 2025 - Present"),
      ...bullets.avatour.map(b => bullet(b)),

      // WF Digital (6 bullets)
      roleHeader("VP of Product, Mobile & AI Growth", "Wells Fargo Digital Strategy & AI", "Nov 2023 - Oct 2025"),
      ...bullets.wfDigital.map(b => bullet(b)),

      // First Republic (5 bullets)
      roleHeader("Director, Product Management", "First Republic, Digital Channels", "Apr 2016 - Oct 2023"),
      ...bullets.firstRepublic.map(b => bullet(b)),

      // WF Virtual (4 bullets)
      roleHeader("AVP, Digital Product Manager", "Wells Fargo Virtual Channels", "Aug 2012 - Apr 2016"),
      ...bullets.wfVirtual.map(b => bullet(b)),

      // Magley (3 bullets)
      roleHeader("Senior Consultant", "Magley & Associates", "Dec 2008 - Aug 2012"),
      ...bullets.magley.map(b => bullet(b)),

      // === EDUCATION ===
      sectionHeader("Education & Certifications"),
      new Paragraph({
        spacing: { before: 40, after: 20 },
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
        spacing: { before: 40, after: 20 },
        children: [
          new TextRun({ text: "PM Tools: ", bold: true, font: FONT, size: BODY_SIZE }),
          new TextRun({ text: "Jira | Confluence | Aha! | Figma | Pendo | Asana | Notion | Linear", font: FONT, size: BODY_SIZE }),
        ],
      }),
      new Paragraph({
        spacing: { before: 0, after: 20 },
        children: [
          new TextRun({ text: "Analytics: ", bold: true, font: FONT, size: BODY_SIZE }),
          new TextRun({ text: "Mixpanel | Amplitude | Google Analytics | Looker | SQL | Snowflake | Tableau", font: FONT, size: BODY_SIZE }),
        ],
      }),
      new Paragraph({
        spacing: { before: 0, after: 20 },
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

      // === INTERESTS ===
      sectionHeader("Interests"),
      new Paragraph({
        spacing: { before: 40, after: 0 },
        children: [
          new TextRun({
            text: "Liverpool FC | Horology | Flying | Aquascaping | Hiking | Toastmasters",
            font: FONT, size: BODY_SIZE,
          }),
        ],
      }),
    ],
  }],
});

// Write to file
const fsp = require("fs");
const outPath = process.argv[2] || "/sessions/intelligent-tender-volta/PM_2Pager_clean.docx";
Packer.toBuffer(doc).then(buffer => {
  fsp.writeFileSync(outPath, buffer);
  console.log("Written to", outPath);
});
