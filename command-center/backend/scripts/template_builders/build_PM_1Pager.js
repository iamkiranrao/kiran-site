const fs = require("docx");
const { Document, Packer, Paragraph, TextRun, ExternalHyperlink,
        AlignmentType, TabStopType, TabStopPosition,
        BorderStyle, HeadingLevel } = fs;

// ===== DESIGN SYSTEM =====
// Gold standard FAANG PM resume: clean, minimal, breathable
// Font: Calibri 10pt body, 11pt section headers, 20pt name
// Margins: 0.6" all sides (864 DXA) -comfortable, not cramped
// No colored headers, no divider lines -just clean typography
// Orphan-free bullets: every bullet fits cleanly on 1 or 2 FULL lines

const FONT = "Calibri";
const BODY_SIZE = 20;      // 10pt
const HEADER_SIZE = 22;    // 11pt
const NAME_SIZE = 40;      // 20pt
const CONTACT_SIZE = 19;   // 9.5pt
const TAGLINE_SIZE = 20;   // 10pt
const NAVY = "1F3864";
const MARGIN = 864;        // 0.6" all sides

// ===== CONTENT -all bullets optimized to eliminate orphan words =====

const bullets = {
  avatour: [
    "Pivoted product from live inspections to AI-assisted reporting, expanding TAM by 3.2x to $45M.",
    "Shipped AI summarization engine for 360 inspection workflows, cutting documentation time by 80%.",
    "Launched conversational AI agent handling onboarding and support, improving NPS and reducing ticket volume.",
  ],
  wfDigital: [
    "18M to 32M MAU growth on consumer mobile app, advancing JD Power ranking from #9 to #3 among US banks.",
    "Led platform migration to API-first architecture, achieving 35% faster data retrieval across all channels.",
    "Scaled Fargo AI assistant from 4.1M to 27.5M interactions, cutting contact center costs by 17%.",
    "23% conversion uplift after introducing in-app cross-sell marketplace for loans, deposits, and wealth products.",
    "Built push, in-app, and lifecycle messaging system that lifted feature adoption by 37%.",
  ],
  firstRepublic: [
    "Owned $20M digital portfolio across payments, lending, and wealth; led 22-person team through platform rebuild.",
    "Integrated Zelle P2P and Apple Pay for 1M+ clients, driving 27% increase in mobile transactions.",
    "Executed core banking migration from Fiserv to FIS, enabling real-time wires and 18% YoY revenue growth.",
  ],
  wfVirtual: [
    "Designed multi-factor authentication for 25M digital banking users, reducing unauthorized access by 40%.",
    "Created DailyChange payments app, increasing ACH transfers by 27%.",
    "Deployed cardless ATM access via mobile wallet, reducing card-present fraud by 30% across 13K ATMs.",
  ],
  magley: [
    "Conducted competitive analysis and built business cases for $500K-$20M digital initiatives for Starbucks, Hilton, and Yahoo!.",
    "Developed customer growth and engagement strategies for enterprise clients, growing active digital users by 15%.",
  ],
};

// ===== HELPER FUNCTIONS =====

function sectionHeader(text) {
  return new Paragraph({
    spacing: { before: 180, after: 60 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999", space: 2 } },
    children: [
      new TextRun({ text: text, bold: true, font: FONT, size: HEADER_SIZE, allCaps: true }),
    ],
  });
}

function roleHeader(title, company, dates) {
  return new Paragraph({
    spacing: { before: 100, after: 20 },
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
    spacing: { before: 20, after: 20 },
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
            link: "https://kiranrao.ai",
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

      // Avatour
      roleHeader("VP of Product", "Avatour AI, AR/VR Startup", "Oct 2025 – Present"),
      ...bullets.avatour.map(b => bullet(b)),

      // WF Digital
      roleHeader("VP of Product, Mobile & AI Growth", "Wells Fargo Digital Strategy & AI", "Nov 2023 – Oct 2025"),
      ...bullets.wfDigital.map(b => bullet(b)),

      // First Republic
      roleHeader("Director, Product Management", "First Republic, Digital Channels", "Apr 2016 – Oct 2023"),
      ...bullets.firstRepublic.map(b => bullet(b)),

      // WF Virtual
      roleHeader("AVP, Digital Product Manager", "Wells Fargo Virtual Channels", "Aug 2012 – Apr 2016"),
      ...bullets.wfVirtual.map(b => bullet(b)),

      // Magley
      roleHeader("Senior Consultant", "Magley & Associates", "Dec 2008 – Aug 2012"),
      ...bullets.magley.map(b => bullet(b)),

      // === EDUCATION ===
      sectionHeader("Education & Certifications"),
      new Paragraph({
        spacing: { before: 40, after: 0 },
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          new TextRun({ text: "B.S. Business Administration", bold: true, font: FONT, size: BODY_SIZE }),
          new TextRun({ text: ", San Diego State University", font: FONT, size: BODY_SIZE }),
          new TextRun({ text: "  |  ", font: FONT, size: BODY_SIZE }),
          new TextRun({ text: "Product Strategy", bold: true, font: FONT, size: BODY_SIZE }),
          new TextRun({ text: ", Kellogg School of Management", font: FONT, size: BODY_SIZE }),
        ],
      }),

      // === TECHNICAL COMPETENCIES ===
      sectionHeader("Technical Competencies"),
      new Paragraph({
        spacing: { before: 40, after: 0 },
        children: [
          new TextRun({
            text: "Jira | Confluence | Aha! | Figma | Pendo | Mixpanel | Amplitude | Google Analytics | Looker | SQL | Snowflake | Tableau | Python | Agile | Scrum | OKRs | AI/ML (OpenAI, Claude) | Prompt Engineering | Asana | Notion | Linear",
            font: FONT, size: BODY_SIZE,
          }),
        ],
      }),
    ],
  }],
});

// Write to file
const fsp = require("fs");
Packer.toBuffer(doc).then(buffer => {
  const outPath = process.argv[2] || "/sessions/intelligent-tender-volta/PM_1Pager_clean.docx";
  fsp.writeFileSync(outPath, buffer);
  console.log("Written to", outPath);
});
