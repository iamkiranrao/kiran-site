#!/usr/bin/env node
/**
 * Visual Audit Runner v2
 *
 * Opens every production page at multiple viewports and themes,
 * runs accessibility, typography, and spacing checks.
 * For each issue: captures a "before" screenshot with the problem
 * highlighted, then (for visual issues) applies the fix and captures
 * an "after" screenshot. Generates a visual HTML report.
 *
 * Usage: npm test
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { checkAccessibility, checkTypography, checkSpacing } = require('./lib/checks');
const { generateReport } = require('./lib/report');

const REPORTS_DIR = path.join(__dirname, 'reports');
const SCREENSHOTS_DIR = path.join(REPORTS_DIR, 'screenshots');

async function main() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  console.log('Visual Audit v2');
  console.log(`  ${config.pages.length} pages x ${config.viewports.length} viewports x ${config.themes.length} themes = ${config.pages.length * config.viewports.length * config.themes.length} combinations\n`);

  const browser = await chromium.launch({ headless: true });

  // ── Authenticate ──────────────────────────────────
  console.log('Authenticating...');
  const authCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const authPage = await authCtx.newPage();
  await authPage.goto(config.siteUrl, { waitUntil: 'networkidle', timeout: 30000 });

  const pwInput = await authPage.$('input[type="password"]');
  let cookies = [];
  if (pwInput && config.password) {
    await pwInput.fill(config.password);
    const btn = await authPage.$('button[type="submit"], button:has-text("Enter")');
    if (btn) await btn.click();
    await authPage.waitForTimeout(3000);
    cookies = await authCtx.cookies();
    console.log('  OK\n');
  }
  await authCtx.close();

  // ── Run audit ─────────────────────────────────────
  const allResults = [];
  let issueCounter = 0;

  for (const vp of config.viewports) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    if (cookies.length) await ctx.addCookies(cookies);
    const page = await ctx.newPage();

    for (const pg of config.pages) {
      for (const theme of config.themes) {
        const label = `${pg.name} / ${vp.name} / ${theme}`;
        process.stdout.write(`  ${label}...`);

        try {
          await page.goto(config.siteUrl + pg.path, { waitUntil: 'networkidle', timeout: 30000 });
          await page.waitForTimeout(1500);

          // Set theme
          await page.evaluate((t) => {
            document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : '');
          }, theme);
          await page.waitForTimeout(500);

          // Full page screenshot
          const fullName = `${sanitize(pg.name)}-${vp.name}-${theme}.png`;
          await page.screenshot({ path: path.join(SCREENSHOTS_DIR, fullName), fullPage: true });

          // Run checks
          const a11yIssues = await checkAccessibility(page, config);
          const typoIssues = await checkTypography(page, config);
          const spacingIssues = await checkSpacing(page, config);
          const allIssues = [...a11yIssues, ...typoIssues, ...spacingIssues];

          // For each issue: capture before screenshot, apply fix, capture after
          for (const issue of allIssues) {
            issueCounter++;
            const id = `issue-${issueCounter}`;
            issue.id = id;

            const el = issue.elements?.[0];
            if (!el?.selector) continue;

            // ── Before screenshot (element highlighted in red) ──
            try {
              const beforeName = `${id}-before.png`;
              await highlightElement(page, el.selector, '#ff4444', issue.summary);
              const clip = await getElementClip(page, el.selector, vp);
              if (clip) {
                await page.screenshot({ path: path.join(SCREENSHOTS_DIR, beforeName), clip });
                issue.beforeScreenshot = `screenshots/${beforeName}`;
              }
              await removeHighlight(page, el.selector);
            } catch (e) { /* skip screenshot on failure */ }

            // ── After screenshot (fix applied, highlighted in green) ──
            if (issue.type === 'typography' || issue.type === 'spacing') {
              try {
                const afterName = `${id}-after.png`;
                const fixApplied = await applyFix(page, el.selector, issue);

                if (fixApplied) {
                  await highlightElement(page, el.selector, '#44cc44', 'Fixed');
                  const clip = await getElementClip(page, el.selector, vp);
                  if (clip) {
                    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, afterName), clip });
                    issue.afterScreenshot = `screenshots/${afterName}`;
                  }
                  await removeHighlight(page, el.selector);
                  await revertFix(page, el.selector, issue);
                }
              } catch (e) { /* skip after screenshot on failure */ }
            }

            // ── Add synopsis, recommendation, decision ──
            enrichIssue(issue);
          }

          allResults.push({
            page: pg.name,
            path: pg.path,
            viewport: vp.name,
            theme,
            fullScreenshot: `screenshots/${fullName}`,
            issues: allIssues,
          });

          console.log(allIssues.length > 0 ? ` ${allIssues.length} issues` : ' clean');

        } catch (err) {
          console.log(` ERROR`);
          allResults.push({
            page: pg.name, path: pg.path, viewport: vp.name, theme,
            fullScreenshot: null,
            issues: [{
              id: `issue-${++issueCounter}`, type: 'error', severity: 'critical',
              synopsis: `Page failed to load`,
              summary: `Timeout or network error loading ${pg.path}`,
              recommendation: 'Check if the page URL is correct and the site is running.',
              decision: 'accept',
            }],
          });
        }
      }
    }
    await ctx.close();
  }

  await browser.close();

  // ── Generate report ───────────────────────────────
  console.log('\nGenerating report...');
  const reportPath = path.join(REPORTS_DIR, 'audit-report.html');
  const summary = generateReport(allResults, reportPath);

  console.log(`\nDone. ${summary.totalIssues} issues across ${config.pages.length} pages.`);
  console.log(`  Critical: ${summary.bySeverity.critical || 0}  Serious: ${summary.bySeverity.serious || 0}  Moderate: ${summary.bySeverity.moderate || 0}`);
  console.log(`\nReport: ${reportPath}`);

  const { exec } = require('child_process');
  const open = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${open} "${reportPath}"`);
}

// ── Helpers ─────────────────────────────────────────

function sanitize(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function highlightElement(page, selector, color, label) {
  await page.evaluate(({ sel, col, lbl }) => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.setAttribute('data-audit-original-outline', el.style.outline || '');
    el.setAttribute('data-audit-original-outline-offset', el.style.outlineOffset || '');
    el.setAttribute('data-audit-original-position', el.style.position || '');
    el.style.outline = `3px solid ${col}`;
    el.style.outlineOffset = '3px';

    // Add label
    const tag = document.createElement('div');
    tag.className = '__audit-label';
    tag.style.cssText = `position:absolute;top:-22px;left:0;background:${col};color:#fff;font-size:11px;font-family:sans-serif;padding:2px 8px;border-radius:3px;z-index:99999;white-space:nowrap;pointer-events:none;`;
    tag.textContent = lbl.substring(0, 50);
    if (!el.style.position || el.style.position === 'static') {
      el.style.position = 'relative';
    }
    el.appendChild(tag);
  }, { sel: selector, col: color, lbl: label });
}

async function removeHighlight(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.style.outline = el.getAttribute('data-audit-original-outline') || '';
    el.style.outlineOffset = el.getAttribute('data-audit-original-outline-offset') || '';
    el.style.position = el.getAttribute('data-audit-original-position') || '';
    el.querySelectorAll('.__audit-label').forEach(l => l.remove());
  }, selector);
}

async function getElementClip(page, selector, vp) {
  const rect = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top + window.scrollY, left: r.left, width: r.width, height: r.height };
  }, selector);

  if (!rect || rect.width === 0 || rect.height === 0) return null;

  const pad = 40;
  return {
    x: Math.max(0, rect.left - pad),
    y: Math.max(0, rect.top - pad),
    width: Math.min(rect.width + pad * 2, vp.width),
    height: Math.min(rect.height + pad * 2, 500),
  };
}

async function applyFix(page, selector, issue) {
  if (issue.type === 'typography' && issue._fixFontSize) {
    await page.evaluate(({ sel, size }) => {
      const el = document.querySelector(sel);
      if (!el) return;
      el.setAttribute('data-audit-original-fontsize', el.style.fontSize || '');
      el.style.fontSize = size + 'px';
    }, { sel: selector, size: issue._fixFontSize });
    return true;
  }

  if (issue.type === 'spacing' && issue._fixProp && issue._fixValue !== undefined) {
    await page.evaluate(({ sel, prop, val }) => {
      const el = document.querySelector(sel);
      if (!el) return;
      el.setAttribute('data-audit-original-' + prop, el.style[prop] || '');
      el.style[prop] = val + 'px';
    }, { sel: selector, prop: issue._fixProp, val: issue._fixValue });
    return true;
  }

  return false;
}

async function revertFix(page, selector, issue) {
  if (issue.type === 'typography') {
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return;
      el.style.fontSize = el.getAttribute('data-audit-original-fontsize') || '';
    }, selector);
  }
  if (issue.type === 'spacing' && issue._fixProp) {
    await page.evaluate(({ sel, prop }) => {
      const el = document.querySelector(sel);
      if (!el) return;
      el.style[prop] = el.getAttribute('data-audit-original-' + prop) || '';
    }, { sel: selector, prop: issue._fixProp });
  }
}

function enrichIssue(issue) {
  // Synopsis: one plain-English line
  if (issue.type === 'accessibility') {
    issue.synopsis = issue.summary || 'Accessibility issue';
    issue.recommendation = getA11yRecommendation(issue);
    issue.decisionType = (issue.severity === 'critical' || issue.severity === 'serious') ? 'accept' : 'discuss';
  } else if (issue.type === 'typography') {
    const match = issue.summary?.match(/([\d.]+)px/);
    const px = match ? match[1] : '?';
    issue.synopsis = `Font size ${px}px doesn't match the type scale`;
    issue.decisionType = 'discuss';
  } else if (issue.type === 'spacing') {
    issue.synopsis = issue.summary || 'Spacing off the grid';
    issue.decisionType = 'discuss';
  }
}

function getA11yRecommendation(issue) {
  const recs = {
    'color-contrast': 'Adjust text or background color to meet the 4.5:1 contrast ratio.',
    'image-alt': 'Add a descriptive alt attribute, or alt="" if the image is decorative.',
    'button-name': 'Add aria-label or visible text content to the button.',
    'link-name': 'Add text content or aria-label to the link.',
    'heading-order': 'Fix heading levels so they don\'t skip (h1 then h2, not h1 then h3).',
    'landmark-one-main': 'Add exactly one <main> element to the page.',
    'region': 'Wrap content in landmark regions (main, nav, header, footer).',
    'label': 'Add a visible label or aria-label to the form input.',
  };
  return recs[issue.rule] || issue.elements?.[0]?.failureSummary || 'Review and fix per WCAG guidelines.';
}

main().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
