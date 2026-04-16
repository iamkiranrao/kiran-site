/**
 * Audit check functions.
 * Each returns an array of issues found.
 */

const AxeBuilder = require('@axe-core/playwright').default;

// ── Accessibility (axe-core) ─────────────────────────
async function checkAccessibility(page, config) {
  // Exclude rules already fixed locally (pending deployment)
  const fixedRules = config.fixedAxeRules || [];
  let builder = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']);
  if (fixedRules.length) builder = builder.disableRules(fixedRules);

  // Exclude elements fixed locally (pending deployment)
  const fixedSelectors = config.fixedAxeSelectors || [];
  for (const sel of fixedSelectors) {
    builder = builder.exclude(sel);
  }

  const results = await builder.analyze();

  return results.violations.map(v => ({
    type: 'accessibility',
    severity: v.impact, // critical, serious, moderate, minor
    rule: v.id,
    summary: v.help,
    detail: v.description,
    url: v.helpUrl,
    elements: v.nodes.map(n => ({
      selector: n.target.join(' > '),
      html: n.html.substring(0, 200),
      failureSummary: n.failureSummary,
    })),
  }));
}

// ── Typography ───────────────────────────────────────
async function checkTypography(page, config) {
  const skipList = config.skipSelectors.join(',');

  const fontData = await page.evaluate((skipSel) => {
    const els = document.querySelectorAll('*');
    const results = [];
    const skip = new Set();
    document.querySelectorAll(skipSel).forEach(el => skip.add(el));

    for (const el of els) {
      if (skip.has(el)) continue;
      if (el.children.length > 0 && el.textContent === [...el.children].map(c => c.textContent).join('')) continue;
      const text = el.textContent?.trim();
      if (!text || text.length === 0) continue;

      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') continue;

      const fontSize = parseFloat(s.fontSize);
      const lineHeight = s.lineHeight === 'normal' ? null : parseFloat(s.lineHeight);
      const fontFamily = s.fontFamily;
      const fontWeight = s.fontWeight;
      const rect = el.getBoundingClientRect();

      if (rect.width === 0 || rect.height === 0) continue;

      // Check if font-size is fluid (clamp/calc/vw) — computed value will
      // vary by viewport, so it's intentionally between scale steps.
      let isFluid = false;
      try {
        const rules = [...document.styleSheets]
          .flatMap(ss => { try { return [...ss.cssRules]; } catch { return []; } })
          .filter(r => r.style && el.matches(r.selectorText));
        for (const r of rules) {
          const fs = r.style.fontSize;
          if (fs && (/clamp|calc|vw|vh|vmin|vmax|%/.test(fs))) {
            isFluid = true;
            break;
          }
        }
      } catch {}

      results.push({
        selector: getSelector(el),
        text: text.substring(0, 60),
        fontSize,
        lineHeight,
        fontFamily: fontFamily.substring(0, 60),
        fontWeight,
        isFluid,
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    }
    return results;

    function getSelector(el) {
      if (el.id) return '#' + el.id;
      const cls = el.className?.toString?.()?.split(' ').filter(c => c && !c.startsWith('_')).slice(0, 2).join('.');
      const tag = el.tagName.toLowerCase();
      return cls ? `${tag}.${cls}` : tag;
    }
  }, skipList);

  const issues = [];
  const rootFontSize = 16; // assume standard

  for (const item of fontData) {
    // Skip fluid font sizes — clamp/vw values intentionally produce
    // intermediate computed sizes that won't match a discrete scale.
    if (item.isFluid) continue;

    const remValue = item.fontSize / rootFontSize;

    // Skip font sizes already fixed locally but not yet deployed.
    const fixedSizes = config.fixedFontSizes || [];
    if (fixedSizes.some(fs => Math.abs(remValue - fs) < config.typeScaleTolerance)) continue;
    const nearest = findNearest(remValue, config.typeScale);
    const distance = Math.abs(remValue - nearest);

    if (distance > config.typeScaleTolerance) {
      issues.push({
        type: 'typography',
        severity: distance > 0.2 ? 'serious' : 'moderate',
        summary: `Font size ${item.fontSize}px (${remValue.toFixed(2)}rem) is off-scale`,
        detail: `Nearest scale value: ${nearest}rem (${nearest * rootFontSize}px). Element: "${item.text}"`,
        recommendation: `Snap to ${nearest}rem (${nearest * rootFontSize}px) or add ${remValue.toFixed(2)}rem to your type scale if intentional.`,
        _fixFontSize: nearest * rootFontSize, // px value for "after" screenshot
        elements: [{
          selector: item.selector,
          html: `<${item.selector}> "${item.text}"`,
          rect: { top: item.top, left: item.left, width: item.width, height: item.height },
        }],
      });
    }
  }

  return issues;
}

// ── Spacing ──────────────────────────────────────────
async function checkSpacing(page, config) {
  const spacingData = await page.evaluate(() => {
    const sections = document.querySelectorAll('section, [class*="section"], header, footer, nav, main, .card, .triptych-col, .work-card, .competency-card');
    const results = [];

    for (const el of sections) {
      const s = getComputedStyle(el);
      if (s.display === 'none') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const cls = el.className?.toString?.()?.split(' ').filter(c => c).slice(0, 2).join('.') || el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : '';
      const selector = id || cls;

      // Detect auto margins — if marginLeft == marginRight and the element
      // has margin: auto or margin: 0 auto, these are browser-computed
      // centering values, not authored spacing.
      let hasAutoMargin = false;
      try {
        const rules = [...document.styleSheets]
          .flatMap(ss => { try { return [...ss.cssRules]; } catch { return []; } })
          .filter(r => r.style && el.matches(r.selectorText));
        for (const r of rules) {
          const m = r.style.margin || '';
          const ml = r.style.marginLeft || '';
          const mr = r.style.marginRight || '';
          const mi = r.style.marginInline || '';
          if (m.includes('auto') || ml === 'auto' || mr === 'auto' || mi.includes('auto')) {
            hasAutoMargin = true;
            break;
          }
        }
      } catch {}

      // Also detect calc/% authored margin/padding values
      let fluidProps = new Set();
      try {
        const rules = [...document.styleSheets]
          .flatMap(ss => { try { return [...ss.cssRules]; } catch { return []; } })
          .filter(r => r.style && el.matches(r.selectorText));
        const checkProps = ['marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'gap'];
        for (const r of rules) {
          for (const p of checkProps) {
            const v = r.style[p] || '';
            if (/calc|vw|vh|%/.test(v)) fluidProps.add(p);
          }
        }
      } catch {}

      results.push({
        selector,
        marginTop: parseFloat(s.marginTop) || 0,
        marginBottom: parseFloat(s.marginBottom) || 0,
        marginLeft: parseFloat(s.marginLeft) || 0,
        marginRight: parseFloat(s.marginRight) || 0,
        paddingTop: parseFloat(s.paddingTop) || 0,
        paddingBottom: parseFloat(s.paddingBottom) || 0,
        paddingLeft: parseFloat(s.paddingLeft) || 0,
        paddingRight: parseFloat(s.paddingRight) || 0,
        gap: parseFloat(s.gap) || 0,
        hasAutoMargin,
        fluidProps: [...fluidProps],
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    }
    return results;
  });

  const issues = [];
  const props = ['marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'gap'];

  for (const item of spacingData) {
    for (const prop of props) {
      const val = item[prop];
      if (val === 0) continue;

      // Skip auto-computed margins (centering via margin: auto)
      if (item.hasAutoMargin && (prop === 'marginLeft' || prop === 'marginRight')) continue;

      // Skip fluid/calc/vw/% authored values
      if (item.fluidProps && item.fluidProps.includes(prop)) continue;

      const nearest = findNearest(val, config.spacingScale);
      const distance = Math.abs(val - nearest);

      if (distance > config.spacingTolerance) {
        issues.push({
          type: 'spacing',
          severity: distance > 8 ? 'serious' : 'moderate',
          summary: `${prop}: ${val}px is off the 4px grid`,
          detail: `Element: ${item.selector}. Nearest grid value: ${nearest}px.`,
          recommendation: `Adjust to ${nearest}px or add ${val}px to your spacing scale if intentional.`,
          _fixProp: prop,       // CSS property name for "after" screenshot
          _fixValue: nearest,   // px value to apply
          elements: [{
            selector: item.selector,
            html: `${item.selector} { ${prop}: ${val}px }`,
            rect: { top: item.top, left: item.left, width: item.width, height: item.height },
          }],
        });
      }
    }
  }

  return issues;
}

// ── Helpers ──────────────────────────────────────────
function findNearest(value, scale) {
  let nearest = scale[0];
  let minDist = Math.abs(value - scale[0]);
  for (const step of scale) {
    const dist = Math.abs(value - step);
    if (dist < minDist) {
      minDist = dist;
      nearest = step;
    }
  }
  return nearest;
}

module.exports = { checkAccessibility, checkTypography, checkSpacing };
