# The DIA Fund — Annual Archiving Process

**Purpose:** Establish a repeatable, systematic operational runbook for archiving DIA Fund records each December. This ensures every year of giving is permanently preserved, documented, and accessible.

**Frequency:** Once annually, every December (by December 31)
**Owner:** Kiran Rao (with Dia's participation for her materials)
**Time estimate:** 2-4 hours per year (growing with age as Dia contributes more materials)

---

## Overview: Why Annual Archiving Matters

The DIA Fund's value lies in its permanence and documentation. By archiving comprehensively each year, we:
- Create a permanent written record of Dia's philanthropic journey
- Preserve evidence of impact for each charity partner
- Build a multi-decade legacy document that Dia will inherit and understand
- Ensure grant confirmations and receipts are audit-ready
- Capture Dia's growth and voice at each stage of development

This runbook transforms December into a deliberate reflection moment — wrapping up the year's giving, honoring the impact made, and preparing for the next year.

---

## Annual Archiving Timeline

| Phase | When | What Happens |
|-------|------|--------------|
| **Prep** | Dec 1-7 | Gather all quarterly reports, grant documents, photos, Dia's materials |
| **Compile** | Dec 8-15 | Build annual PDF, organize directories, verify all grants confirmed |
| **Quality Check** | Dec 16-23 | Review completeness, ensure all files present, proofread |
| **Publish** | Dec 24-31 | Upload to thediafund.org/archives, update annual summary page, notify stakeholders |

---

## Directory Structure

Create this structure in `/docs/DIA-FUND/archives/` for each year:

```
/docs/DIA-FUND/archives/
├── 2026/
│   ├── DIA-Fund-2026-Annual-Report.pdf
│   ├── DIA-Fund-2026-Annual-Summary.md
│   ├── grants/
│   │   ├── 2026-Q1-Feeding-America-recommendation.pdf
│   │   ├── 2026-Q1-Feeding-America-confirmation.pdf
│   │   ├── 2026-Q1-Best-Friends-recommendation.pdf
│   │   ├── 2026-Q1-Best-Friends-confirmation.pdf
│   │   ├── 2026-Q2-Feeding-America-recommendation.pdf
│   │   ├── 2026-Q2-Feeding-America-confirmation.pdf
│   │   ├── 2026-Q2-Best-Friends-recommendation.pdf
│   │   ├── 2026-Q2-Best-Friends-confirmation.pdf
│   │   ├── 2026-Q3-[Charity]-recommendation.pdf
│   │   ├── 2026-Q3-[Charity]-confirmation.pdf
│   │   ├── 2026-Q4-[Charity]-recommendation.pdf
│   │   └── 2026-Q4-[Charity]-confirmation.pdf
│   ├── photos/
│   │   ├── 2026-Q1-volunteer-day-family-photo-1.jpg
│   │   ├── 2026-Q2-dia-with-puppies.jpg
│   │   ├── 2026-Q3-food-bank-visit.jpg
│   │   └── [any other event photos from the year]
│   ├── dia-journal/
│   │   ├── dia-drawings-2026.pdf
│   │   ├── dia-letter-Q1-2026.txt
│   │   ├── dia-letter-Q2-2026.txt
│   │   ├── dia-voice-recording-transcripts.txt
│   │   └── [scans of Dia's handwritten contributions from the year]
│   └── metadata.json
├── 2027/
│   └── [Same structure for next year]
```

---

## Annual Archiving Checklist

### Phase 1: Gather & Verify (Dec 1-7)

#### Quarterly Transparency Reports
- [ ] Q1 report (published April 15) — confirm published on thediafund.org
- [ ] Q2 report (published July 15) — confirm published on thediafund.org
- [ ] Q3 report (published October 15) — confirm published on thediafund.org
- [ ] Q4 report (due Jan 31 next year) — save draft even if not yet published
- [ ] Save all four as `.md` + `.pdf` versions to `/archives/[YEAR]/`

#### Grant Recommendations & Confirmations
- [ ] Locate all grant recommendation letters (Dia's + Kiran's) — each quarter should have 2+ recommendations
- [ ] Locate all charity confirmation receipts and letters — each grant must have written confirmation
- [ ] Verify file naming: `YYYY-QX-[CHARITY-NAME]-[recommendation|confirmation].pdf`
- [ ] If any confirmations missing, send follow-up email to charity contact immediately
- [ ] Save all to `/archives/[YEAR]/grants/`

#### Dia's Materials
- [ ] Collect all of Dia's drawings, letters, journal entries from the year
- [ ] Convert handwritten materials to PDFs or high-res scans (at least 300 dpi)
- [ ] Collect any voice recordings or video clips — transcribe voice, export video as .mp4
- [ ] Organize by quarter (Q1, Q2, Q3, Q4) or chronologically
- [ ] Save to `/archives/[YEAR]/dia-journal/`
- [ ] Create a master index document listing all Dia materials (with dates + brief description)

#### Photography Archive
- [ ] Gather all photos from volunteer days, family activities, charity visits
- [ ] Include photos of Dia engaging with giving decisions, grant discussions, impact
- [ ] Organize by month or event (e.g., "Feeding America food bank visit, June 2026")
- [ ] Verify file names are descriptive: `YYYY-[MONTH]-[EVENT-DESCRIPTION].jpg`
- [ ] Save to `/archives/[YEAR]/photos/`
- [ ] Create a photo manifest (spreadsheet or index) with dates, people, context

### Phase 2: Compile Annual Report (Dec 8-15)

#### Build Annual Summary Document (Markdown)

Create `/archives/[YEAR]/DIA-Fund-[YEAR]-Annual-Summary.md` with these sections:

**Structure:**

```markdown
# The DIA Fund — [YEAR] Annual Report

## Year at a Glance
- **Total funds received:** $[AMOUNT]
- **Total grants recommended:** $[AMOUNT]
- **Year-end fund balance:** $[AMOUNT]
- **Number of quarters:** 4
- **Charities funded:** [List names]
- **Dia's age at year-end:** [AGE]

## Quarterly Overview
### Q1
- Funds received: $[AMOUNT]
- Grants made: [Charity 1: $X, Charity 2: $X]

### Q2
- Funds received: $[AMOUNT]
- Grants made: [...]

### Q3
- Funds received: $[AMOUNT]
- Grants made: [...]

### Q4
- Funds received: $[AMOUNT]
- Grants made: [...]

## Year-to-Date Totals
| Metric | Amount |
|--------|--------|
| Total Funds Received | $[AMOUNT] |
| Total Grants Made | $[AMOUNT] |
| Fund Balance (Year-End) | $[AMOUNT] |

## Impact Summary
[1-2 paragraph narrative of the year's giving in total. Reference specific outcomes from partner impact reports. Tie to DIA mission: Dream, Inspire, Advance. Reflect on year's major themes.]

## Dia's Journey This Year
[1-2 paragraph reflection on Dia's development, involvement level, and growth. What did she understand about giving? What moments stand out? How is she maturing into the philanthropic role?]

## Acknowledgments
- [Charity 1 contact name] at [Charity 1]
- [Charity 2 contact name] at [Charity 2]
- [Any other key supporters or volunteers]

## What's Next
[1-2 paragraph outlook for next year. Anticipated milestones, potential new charities, Dia's evolving role.]

## Archive Contents
- [Year] Quarterly Reports (Q1-Q4): 4 files
- Grant Recommendations: [X] files
- Grant Confirmations: [X] files
- Dia's Materials: [X] files
- Photography: [X] files
- Metadata: 1 file

---
*Report compiled: [DATE]*
*Archive location: thediafund.org/archives/[YEAR]*
```

#### Compile Annual PDF

Using the four quarterly transparency reports + annual summary, create a single PDF:

**Steps:**
1. Use a tool like [Sejda](https://sejda.com/merge-pdf), [ilovepdf.com](https://www.ilovepdf.com), or macOS Preview to merge PDFs
2. **Page order:**
   - Cover page (DIA Fund logo + "[YEAR] Annual Report" + date)
   - Annual Summary (from DIA-Fund-[YEAR]-Annual-Summary.md)
   - Q1 Transparency Report (full)
   - Q2 Transparency Report (full)
   - Q3 Transparency Report (full)
   - Q4 Transparency Report (full)
   - Appendix: Grant confirmations (one per page)
   - Appendix: Photos (2-4 per page, with captions)
3. Add bookmarks for each section (optional but recommended)
4. Save as `/archives/[YEAR]/DIA-Fund-[YEAR]-Annual-Report.pdf`

#### Create Metadata File

Save `/archives/[YEAR]/metadata.json`:

```json
{
  "year": [YEAR],
  "reportName": "The DIA Fund - [YEAR] Annual Report",
  "archiveDate": "[YYYY-MM-DD]",
  "publishDate": "[YYYY-MM-DD]",
  "diaAge": [AGE],
  "totalFundsReceived": "[AMOUNT]",
  "totalGrantsMade": "[AMOUNT]",
  "yearEndBalance": "[AMOUNT]",
  "charitiesSupported": [
    {
      "name": "[Charity Name]",
      "totalGrants": "[AMOUNT]",
      "grantsCount": [NUMBER]
    }
  ],
  "quartersIncluded": ["Q1", "Q2", "Q3", "Q4"],
  "filesArchived": {
    "reports": 4,
    "grantRecommendations": [COUNT],
    "grantConfirmations": [COUNT],
    "diasMaterials": [COUNT],
    "photos": [COUNT]
  },
  "keyMilestones": [
    "Brief description of any major events or milestones from the year"
  ]
}
```

### Phase 3: Quality Check & Verification (Dec 16-23)

Run through this checklist to ensure completeness and accuracy:

#### Grant Verification
- [ ] Count: Q1 recommendations (should be 2+) — confirmed in folder
- [ ] Count: Q1 confirmations (should match recommendations) — all charities have written confirmation
- [ ] Count: Q2, Q3, Q4 recommendations and confirmations — all accounted for
- [ ] Verification: No grant has a recommendation without a confirmation — send follow-ups immediately if missing
- [ ] Names: All file names follow naming convention: `YYYY-QX-[CHARITY]-[type].pdf`

#### Quarterly Reports
- [ ] All 4 quarterly reports present: Q1, Q2, Q3, Q4
- [ ] Each report has complete sections: Funds Received, Grants Made, YTD Summary, Dia's Voice, Stories & Impact
- [ ] No placeholder text left in any report (search for "[PLACEHOLDER]")
- [ ] Dia's Voice section is populated (not empty) in each report
- [ ] All grant amounts match the corresponding recommendation/confirmation documents

#### Dia's Materials
- [ ] At least one contribution from Dia per quarter (letter, drawing, quote, recording) — ages 4-6 may have less, that's fine
- [ ] All handwritten materials scanned or photographed clearly (legible)
- [ ] Voice recordings transcribed and saved as .txt
- [ ] Files organized by quarter or chronologically
- [ ] Index document lists all materials with dates and brief descriptions

#### Photography Archive
- [ ] At least 2-4 photos from the year (if family participated in volunteer work)
- [ ] Photos are high resolution (at least 72 dpi for web, 300 dpi for print)
- [ ] File names are descriptive and include dates
- [ ] Photo manifest created (spreadsheet or text file with captions/context)

#### Annual Summary Document
- [ ] All numbers match quarterly reports (totals, fund balance)
- [ ] Narrative sections are written in Kiran's voice, not templated/generic
- [ ] Reflection on Dia's growth is specific and personal (not abstract)
- [ ] Acknowledgments mention specific people by name at each charity
- [ ] No placeholder text remaining

#### Annual PDF
- [ ] Merges cleanly with no corruption
- [ ] All pages render legibly
- [ ] Page count: ~30-50 pages (typical for annual report + 4 quarters + appendix)
- [ ] Cover and bookmarks present (optional)
- [ ] File size reasonable (~5-10 MB)

### Phase 4: Publish & Communicate (Dec 24-31)

#### Upload to Website
- [ ] Create folder on thediafund.org/archives/[YEAR]/ (if not already created by hosting provider)
- [ ] Upload `/archives/[YEAR]/DIA-Fund-[YEAR]-Annual-Report.pdf` to web
- [ ] Upload `/archives/[YEAR]/DIA-Fund-[YEAR]-Annual-Summary.md` as web page (or embed in site)
- [ ] Ensure folder is publicly readable and linked from main archives page

#### Update Archives Index Page
- [ ] Add new [YEAR] entry to thediafund.org/archives with:
  - Link to PDF download
  - Brief description ("2026 Annual Report: $XX,XXX in grants across [N] charities, published Jan 2027")
  - Publication date
  - Dia's age at year-end

#### Notify Key Stakeholders
- [ ] Email Feeding America + Best Friends noting the annual archive is now published (optional but appreciated)
- [ ] Email any other charity partners with archives information
- [ ] Consider a brief post on Kiran's Substack noting the DIA Fund year in review (optional)

#### Final Documentation
- [ ] Log entry in DIA Journal (fenix-journal/DIA-FUND-JOURNAL.md) noting archiving completion
- [ ] Update ACTION-TRACKER.md with completion status
- [ ] Update DIA-FUND.md Section 9 (Website Status) to reflect latest archive
- [ ] Add calendar reminder for next year (Dec 1 + Dec 15)

---

## Annual Archiving Template Files

To streamline the process each year, maintain these templates in `/docs/TheDiaFund/templates/`:

| File | Purpose |
|------|---------|
| `QUARTERLY-TRANSPARENCY-REPORT-TEMPLATE.md` | Template for filling in each quarter's report |
| `ANNUAL-ARCHIVING-PROCESS.md` | This file — use as checklist each December |

Keep these templates updated as the process evolves.

---

## Key Reminders

### Completeness
Every quarter must have at least two confirmed grants (one to Feeding America, one to Best Friends or new partner). If a grant lacks confirmation by December, send a follow-up email to the charity immediately and document the follow-up attempt.

### Dia's Voice is Non-Negotiable
Every quarterly report must include Dia's contribution — even if it's just a single sentence or simple drawing. This is the heart of the legacy. If Dia doesn't provide something unprompted, Kiran should ask her to share a thought, draw a picture, or record a voice memo.

### Naming Conventions
Use consistent file naming:
- `YYYY-QX-[CHARITY-SHORTNAME]-recommendation.pdf`
- `YYYY-QX-[CHARITY-SHORTNAME]-confirmation.pdf`
- `YYYY-MM-[EVENT-DESCRIPTION].jpg`
- Examples: `2026-Q1-Feeding-America-recommendation.pdf`, `2026-06-food-bank-visit.jpg`

### Archive Long-Term
Store a backup copy of `/archives/[YEAR]/` outside of GitHub (cloud storage, external drive, or email to yourself as backup). The annual report is a permanent document worth preserving beyond the website.

### Evolving with Dia
As Dia ages, her contributions will grow:
- **Age 4-6:** Drawings, one-sentence thoughts, voice recordings
- **Age 7-9:** Short handwritten letters, photos of her engagement, recorded messages
- **Age 10-14:** Journal entries, co-authored grant recommendations, active decision-making
- **Age 14+:** Full grant recommendation writing, governance participation, public speaking

Adjust the depth of documentation to match her developmental stage.

---

## Questions to Ask Each December

Use these reflection prompts to guide the annual summary:

1. **Impact:** Which charity partner created the most visible impact this year? Why?
2. **Dia's Growth:** How has Dia's understanding of giving changed since last year?
3. **Challenges:** Were there any grants that took longer to confirm? Any unexpected delays?
4. **Community:** Did our family volunteer or engage directly with any partners? What did we learn?
5. **Strategy:** Are there new causes or charities we want to explore next year?
6. **Sustainability:** Is the current funding model (Scannibal proceeds) meeting our goals? Should we adjust?

Document these reflections in the annual summary narrative.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Charity hasn't confirmed grant by Dec 15 | Send immediate follow-up email to contact person. Include original recommendation letter + amount. Set deadline: "Confirmation needed by Dec 20 for annual archive." |
| Dia's materials missing for a quarter | Reach out to Dia (or co-parent if applicable) immediately. Ask for a drawing, recorded voice memo, or written note. Can be added retroactively to report. |
| Files disorganized or scattered across devices | Use a dedicated folder on your computer: `~/Documents/DIA-Fund-Archive/[YEAR]/`. Move all files here by Dec 10. |
| Annual PDF too large or won't merge | Reduce image resolution (72 dpi is sufficient for web), remove color profiles, or split into two PDFs (Q1-Q2 / Q3-Q4 + appendix). |
| Forgot to publish by Dec 31 | No penalty. Publish in January. Update the archive date on the PDF/summary and note any delays in metadata. |

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| April 2026 | 1.0 | Initial process document created |
| [TBD] | 1.1 | Updates based on first annual archive (post-Dec 2026) |

---

## Document Ownership

**Created by:** Claude (April 2026)
**Maintained by:** Kiran Rao
**Last updated:** [DATE]
**Next review:** December 2026

This runbook is a living document. Update it after each annual archiving cycle with lessons learned, process improvements, and any new requirements.
