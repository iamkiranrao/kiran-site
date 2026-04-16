/**
 * HTML Report Generator v2
 *
 * Visual-first report: each issue is a card with before/after
 * screenshots, one-line synopsis, recommendation, and
 * Accept / Discuss Later buttons.
 */

const fs = require('fs');
const path = require('path');

function generateReport(auditResults, outputPath) {
  const timestamp = new Date().toLocaleString();
  const totalIssues = auditResults.reduce((sum, r) => sum + r.issues.length, 0);
  const totalPages = new Set(auditResults.map(r => r.page)).size;

  const bySeverity = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  const byType = { accessibility: 0, typography: 0, spacing: 0 };
  for (const r of auditResults) {
    for (const issue of r.issues) {
      bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
      byType[issue.type] = (byType[issue.type] || 0) + 1;
    }
  }

  // Group by page
  const grouped = {};
  for (const r of auditResults) {
    if (!grouped[r.page]) grouped[r.page] = [];
    grouped[r.page].push(r);
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Visual Audit — ${timestamp}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0e0e0e; color: #e0d8c8; line-height: 1.5; }
  .wrap { max-width: 1100px; margin: 0 auto; padding: 2rem; }

  /* ── Header ── */
  .hdr { padding: 2.5rem 0 1.5rem; border-bottom: 1px solid #222; margin-bottom: 2rem; }
  .hdr h1 { font-size: 1.8rem; font-weight: 700; margin-bottom: 0.3rem; }
  .hdr .meta { color: #7a7468; font-size: 0.85rem; }

  /* ── Summary pills ── */
  .pills { display: flex; gap: 0.75rem; margin-bottom: 2rem; flex-wrap: wrap; }
  .pill { background: #161616; border: 1px solid #2a2a2a; border-radius: 10px; padding: 0.8rem 1.2rem; text-align: center; min-width: 100px; }
  .pill .n { font-size: 1.6rem; font-weight: 700; }
  .pill .l { font-size: 0.7rem; color: #7a7468; text-transform: uppercase; letter-spacing: 0.06em; }
  .pill.crit .n { color: #ff4444; }
  .pill.ser .n { color: #ff8c00; }
  .pill.mod .n { color: #ffd700; }
  .pill.ok .n { color: #44cc44; }

  /* ── Filters ── */
  .filters { display: flex; gap: 0.4rem; margin-bottom: 2rem; flex-wrap: wrap; }
  .fbtn { background: #161616; border: 1px solid #2a2a2a; color: #7a7468; padding: 0.35rem 0.9rem; border-radius: 20px; cursor: pointer; font-size: 0.75rem; transition: all 0.15s; }
  .fbtn:hover, .fbtn.on { background: #252525; color: #e0d8c8; border-color: #444; }

  /* ── Page group ── */
  .pg { margin-bottom: 3rem; }
  .pg-title { font-size: 1.2rem; font-weight: 600; padding-bottom: 0.6rem; border-bottom: 1px solid #1e1e1e; margin-bottom: 1.2rem; display: flex; align-items: center; gap: 0.6rem; }
  .pg-title .cnt { font-size: 0.7rem; background: #222; padding: 0.15rem 0.55rem; border-radius: 12px; color: #7a7468; }
  .ctx { font-size: 0.7rem; color: #5a5347; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 0.8rem; padding: 0.3rem 0.7rem; background: #131313; border-radius: 5px; display: inline-block; }

  /* ── Issue card ── */
  .card { background: #131313; border: 1px solid #222; border-radius: 14px; margin-bottom: 1.2rem; overflow: hidden; transition: opacity 0.3s; }
  .card.accepted { opacity: 0.35; }
  .card.deferred { border-left: 3px solid #ffd700; }
  .card-top { padding: 1rem 1.2rem 0.6rem; }

  /* Tags row */
  .tags { display: flex; gap: 0.4rem; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; }
  .sev { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.15rem 0.45rem; border-radius: 3px; }
  .sev.critical { background: rgba(255,68,68,0.15); color: #ff4444; }
  .sev.serious { background: rgba(255,140,0,0.15); color: #ff8c00; }
  .sev.moderate { background: rgba(255,215,0,0.12); color: #ffd700; }
  .sev.minor { background: rgba(136,136,136,0.12); color: #888; }
  .typ { font-size: 0.65rem; color: #5a5347; border: 1px solid #2a2a2a; padding: 0.12rem 0.45rem; border-radius: 3px; }

  /* Synopsis */
  .syn { font-size: 0.95rem; font-weight: 600; margin-bottom: 0.4rem; }
  .det { font-size: 0.8rem; color: #8a8478; margin-bottom: 0.6rem; }
  .el-info { font-size: 0.75rem; color: #5a5347; background: #1a1a1a; padding: 0.4rem 0.6rem; border-radius: 5px; font-family: 'SF Mono', Monaco, Consolas, monospace; margin-bottom: 0.6rem; word-break: break-all; }

  /* ── Screenshots side by side ── */
  .shots { display: flex; gap: 0; border-top: 1px solid #1e1e1e; }
  .shot { flex: 1; position: relative; min-height: 80px; }
  .shot img { width: 100%; display: block; }
  .shot-label { position: absolute; top: 8px; left: 8px; font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 0.15rem 0.5rem; border-radius: 3px; z-index: 1; }
  .shot-label.before { background: rgba(255,68,68,0.85); color: #fff; }
  .shot-label.after { background: rgba(68,204,68,0.85); color: #fff; }
  .shot-label.na { background: rgba(100,100,100,0.7); color: #ccc; }
  .shot-divider { width: 1px; background: #2a2a2a; }
  .no-shot { display: flex; align-items: center; justify-content: center; color: #3a3a3a; font-size: 0.75rem; min-height: 120px; background: #0c0c0c; }

  /* ── Recommendation + buttons ── */
  .rec { padding: 0.8rem 1.2rem; background: #111; border-top: 1px solid #1e1e1e; }
  .rec-text { font-size: 0.8rem; color: #9a948e; margin-bottom: 0.6rem; line-height: 1.5; }
  .rec-text strong { color: #7b9acc; }
  .actions { display: flex; gap: 0.5rem; }
  .btn { font-size: 0.75rem; font-weight: 600; padding: 0.4rem 1rem; border-radius: 8px; border: none; cursor: pointer; transition: all 0.15s; }
  .btn-accept { background: #1a3320; color: #44cc44; }
  .btn-accept:hover { background: #244428; }
  .btn-discuss { background: #2a2510; color: #ffd700; }
  .btn-discuss:hover { background: #3a3518; }
  .btn-done { background: #1a1a1a; color: #555; cursor: default; }

  /* ── Export bar ── */
  .export-bar { position: sticky; bottom: 0; background: #0e0e0e; border-top: 1px solid #222; padding: 1rem 0; text-align: center; z-index: 100; }
  .export-btn { background: #7b9acc; color: #0e0e0e; font-size: 0.85rem; font-weight: 700; padding: 0.6rem 2rem; border: none; border-radius: 10px; cursor: pointer; }
  .export-btn:hover { background: #8eaad8; }
  .export-stats { font-size: 0.75rem; color: #5a5347; margin-top: 0.4rem; }

  /* Clean pass state */
  .clean { text-align: center; padding: 2rem; color: #44cc44; font-size: 0.9rem; background: rgba(68,204,68,0.04); border-radius: 10px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <h1>Visual Audit</h1>
    <p class="meta">${timestamp} &middot; ${totalPages} pages &middot; ${totalIssues} issues</p>
  </div>

  <div class="pills">
    <div class="pill ${bySeverity.critical ? 'crit' : 'ok'}"><div class="n">${bySeverity.critical || 0}</div><div class="l">Critical</div></div>
    <div class="pill ${bySeverity.serious ? 'ser' : 'ok'}"><div class="n">${bySeverity.serious || 0}</div><div class="l">Serious</div></div>
    <div class="pill ${bySeverity.moderate ? 'mod' : 'ok'}"><div class="n">${bySeverity.moderate || 0}</div><div class="l">Moderate</div></div>
    <div class="pill"><div class="n">${byType.accessibility || 0}</div><div class="l">A11y</div></div>
    <div class="pill"><div class="n">${byType.typography || 0}</div><div class="l">Type</div></div>
    <div class="pill"><div class="n">${byType.spacing || 0}</div><div class="l">Spacing</div></div>
  </div>

  <div class="filters">
    <button class="fbtn on" onclick="flt('all',this)">All</button>
    <button class="fbtn" onclick="flt('critical',this)">Critical</button>
    <button class="fbtn" onclick="flt('serious',this)">Serious</button>
    <button class="fbtn" onclick="flt('accessibility',this)">Accessibility</button>
    <button class="fbtn" onclick="flt('typography',this)">Typography</button>
    <button class="fbtn" onclick="flt('spacing',this)">Spacing</button>
    <button class="fbtn" onclick="flt('undecided',this)">Undecided</button>
  </div>

  ${Object.entries(grouped).map(([pageName, results]) => {
    const pageIssueCount = results.reduce((s, r) => s + r.issues.length, 0);
    return `
  <div class="pg">
    <h2 class="pg-title">${esc(pageName)} <span class="cnt">${pageIssueCount}</span></h2>
    ${results.map(r => {
      if (r.issues.length === 0) return '';
      return `
    <div class="ctx">${r.viewport} &middot; ${r.theme}</div>
    ${r.issues.map(issue => `
    <div class="card" id="${issue.id}" data-sev="${issue.severity}" data-type="${issue.type}" data-status="undecided">
      <div class="card-top">
        <div class="tags">
          <span class="sev ${issue.severity}">${issue.severity}</span>
          <span class="typ">${issue.type}</span>
        </div>
        <div class="syn">${esc(issue.synopsis || issue.summary || '')}</div>
        ${issue.detail ? `<div class="det">${esc(issue.detail)}</div>` : ''}
        ${issue.elements?.[0] ? `<div class="el-info">${esc(issue.elements[0].selector || '')}</div>` : ''}
      </div>
      <div class="shots">
        ${issue.beforeScreenshot ? `
        <div class="shot">
          <span class="shot-label before">Current</span>
          <img src="${issue.beforeScreenshot}" alt="Current state" loading="lazy">
        </div>` : `<div class="shot"><div class="no-shot">No screenshot</div></div>`}
        <div class="shot-divider"></div>
        ${issue.afterScreenshot ? `
        <div class="shot">
          <span class="shot-label after">Recommended</span>
          <img src="${issue.afterScreenshot}" alt="After fix" loading="lazy">
        </div>` : `
        <div class="shot">
          <div class="no-shot">${issue.type === 'accessibility' ? 'Structural fix — no visual preview' : 'No preview available'}</div>
        </div>`}
      </div>
      <div class="rec">
        <div class="rec-text"><strong>Recommendation:</strong> ${esc(issue.recommendation || '')}</div>
        <div class="actions" id="actions-${issue.id}">
          <button class="btn btn-accept" onclick="decide('${issue.id}','accepted')">Accept</button>
          <button class="btn btn-discuss" onclick="decide('${issue.id}','deferred')">Discuss Later</button>
        </div>
      </div>
    </div>
    `).join('')}`;
    }).join('')}
  </div>`;
  }).join('')}
</div>

<div class="export-bar">
  <button class="export-btn" onclick="exportDecisions()">Export Decisions</button>
  <div class="export-stats" id="export-stats">No decisions made yet</div>
</div>

<script>
const decisions = {};
let accepted = 0, deferred = 0;

function decide(id, status) {
  const card = document.getElementById(id);
  const prev = card.dataset.status;

  // Update counts
  if (prev === 'accepted') accepted--;
  if (prev === 'deferred') deferred--;
  if (status === 'accepted') accepted++;
  if (status === 'deferred') deferred++;

  card.dataset.status = status;
  card.className = 'card ' + status;
  decisions[id] = {
    status,
    severity: card.dataset.sev,
    type: card.dataset.type,
    synopsis: card.querySelector('.syn')?.textContent || '',
  };

  // Update button state
  const actions = document.getElementById('actions-' + id);
  actions.innerHTML = status === 'accepted'
    ? '<button class="btn btn-done">Accepted</button> <button class="btn btn-discuss" onclick="decide(\\'' + id + '\\',\\'deferred\\')">Change to Discuss</button>'
    : '<button class="btn btn-accept" onclick="decide(\\'' + id + '\\',\\'accepted\\')">Accept Instead</button> <button class="btn btn-done">Discuss Later</button>';

  updateStats();
}

function updateStats() {
  const total = Object.keys(decisions).length;
  const remaining = ${totalIssues} - total;
  document.getElementById('export-stats').textContent =
    accepted + ' accepted, ' + deferred + ' to discuss, ' + remaining + ' undecided';
}

function flt(f, btn) {
  document.querySelectorAll('.fbtn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  document.querySelectorAll('.card').forEach(c => {
    if (f === 'all') { c.style.display = ''; return; }
    if (f === 'undecided') { c.style.display = c.dataset.status === 'undecided' ? '' : 'none'; return; }
    const match = c.dataset.sev === f || c.dataset.type === f;
    c.style.display = match ? '' : 'none';
  });
}

function exportDecisions() {
  const data = JSON.stringify(decisions, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'audit-decisions-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
}
</script>
</body>
</html>`;

  fs.writeFileSync(outputPath, html, 'utf8');
  return { totalIssues, bySeverity, byType };
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

module.exports = { generateReport };
