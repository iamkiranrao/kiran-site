/**
 * ============================================
 * FENIX ARTIFACT
 * Turns a tool's output into a branded, shareable, printable one-pager (a modal
 * "sheet") instead of a wall of text in the chat.
 *
 * Growth flywheel: "Copy link" encodes the exact artifact into the URL
 * (?fa=<base64>). Opening that link on kiranrao.ai re-renders the exact artifact
 * over the site — every share is a doorway back here. No backend required.
 *
 * API:
 *   FenixArtifact.run({ kicker, title, input, persona, accent, tool, prompt })
 *       -> opens the modal, streams the agent response into the sheet, shows share/print.
 *   FenixArtifact.show({ kicker, title, input, content, persona, accent, tool })
 *       -> renders a finished artifact (used by the ?fa= share-link loader).
 *
 * Standalone: own markdown renderer, own agent call, own styles. Load anywhere.
 * ============================================
 */
(function () {
  'use strict';

  var AGENT_URL = 'https://api.kiranrao.ai/api/v1/fenix/agent';
  var DEFAULT_ACCENT = '#4DAF8B';
  var FENIX_LOGO = 'images/fenix/1fenixavatar1.png';

  // ── tiny, HTML-safe markdown renderer (self-contained) ──
  function mdInline(s) {
    return s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }
  function renderMarkdown(raw) {
    var esc = String(raw).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    var lines = esc.split(/\r?\n/), html = '', i = 0;
    var isOL = function (l) { return /^\s*\d+[.)]\s+/.test(l); };
    var isUL = function (l) { return /^\s*[-*•]\s+/.test(l); };
    while (i < lines.length) {
      var line = lines[i];
      if (isOL(line)) { html += '<ol>'; while (i < lines.length && isOL(lines[i])) { html += '<li>' + mdInline(lines[i].replace(/^\s*\d+[.)]\s+/, '')) + '</li>'; i++; } html += '</ol>'; continue; }
      if (isUL(line)) { html += '<ul>'; while (i < lines.length && isUL(lines[i])) { html += '<li>' + mdInline(lines[i].replace(/^\s*[-*•]\s+/, '')) + '</li>'; i++; } html += '</ul>'; continue; }
      var h = line.match(/^(#{1,3})\s+(.*)$/);
      if (h) { var lvl = Math.min(h[1].length + 2, 4); html += '<h' + lvl + '>' + mdInline(h[2]) + '</h' + lvl + '>'; i++; continue; }
      if (/^\s*$/.test(line)) { i++; continue; }
      var para = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !isOL(lines[i]) && !isUL(lines[i]) && !/^#{1,3}\s+/.test(lines[i])) { para.push(mdInline(lines[i])); i++; }
      html += '<p>' + para.join('<br>') + '</p>';
    }
    return html;
  }

  function el(tag, cls, opts) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (opts) { if (opts.text != null) n.textContent = opts.text; if (opts.html != null) n.innerHTML = opts.html; }
    return n;
  }

  function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // ── JTBD "Four Forces" diagram: parse the forces out of the content, draw the tug-of-war ──
  function extractForces(content) {
    var lines = String(content).split(/\r?\n/), f = {}, kept = [];
    lines.forEach(function (line) {
      var m = line.match(/^\s*[-*•]?\s*\*\*\s*(push|pull|anxiety|habit)\s*:?\s*\*\*\s*(.+)$/i);
      if (m) { f[m[1].toLowerCase()] = m[2].trim().replace(/[*_.\s]+$/, ''); return; }
      if (/four\s+forces/i.test(line)) return; // drop the now-redundant heading
      kept.push(line);
    });
    if (f.push && f.pull && f.anxiety && f.habit) return { forces: f, cleaned: kept.join('\n') };
    return null;
  }

  function forcesDiagram(f) {
    function row(name, text) { return '<div class="fa-frow"><b>' + name + '</b><span>' + escHtml(text) + '</span></div>'; }
    return '<div class="fa-forces">'
      + '<div class="fa-forces-head">The Four Forces</div>'
      + '<div class="fa-forces-cols">'
      + '<div class="fa-fc fa-fc--for"><div class="fa-fc-cap">Driving the switch →</div>' + row('Push', f.push) + row('Pull', f.pull) + '</div>'
      + '<div class="fa-fc fa-fc--against"><div class="fa-fc-cap">← Holding them back</div>' + row('Anxiety', f.anxiety) + row('Habit', f.habit) + '</div>'
      + '</div>'
      + '<div class="fa-forces-legend">Push + Pull drive the switch · Anxiety + Habit resist it</div>'
      + '</div>';
  }

  // ── Journey "emotion curve": parse the steps out of the content, draw the line chart + cards ──
  function extractJourney(content) {
    var lines = String(content).split(/\r?\n/), steps = [], intro = [], started = false, seenStep = false;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (/^\s*STEPS:\s*$/i.test(line)) { started = true; continue; }
      var m = line.match(/^\s*[-*•]\s*(.+?)\s*::\s*(positive|neutral|negative)\s*::\s*(pain|gain|job)\s*::\s*(.+)$/i);
      if (m) {
        seenStep = true;
        var tag = m[3].toLowerCase();
        tag = tag.charAt(0).toUpperCase() + tag.slice(1);
        steps.push({ name: m[1].trim(), sentiment: m[2].toLowerCase(), tag: tag, insight: m[4].trim() });
        continue;
      }
      if (!seenStep && !started && !/^\s*$/.test(line)) intro.push(line.trim());
    }
    if (steps.length < 2) return null;
    return { steps: steps, intro: intro.join(' ').trim() };
  }

  function journeyPath(p) {
    var n = p.length;
    if (n === 0) return '';
    var d = 'M' + p[0].x + ' ' + p[0].y;
    for (var i = 0; i <= n - 2; i++) {
      var p0 = p[i - 1] || p[i];
      var p1 = p[i];
      var p2 = p[i + 1];
      var p3 = p[i + 2] || p2;
      var c1x = p1.x + (p2.x - p0.x) / 6;
      var c1y = p1.y + (p2.y - p0.y) / 6;
      var c2x = p2.x - (p3.x - p1.x) / 6;
      var c2y = p2.y - (p3.y - p1.y) / 6;
      d += ' C' + c1x + ' ' + c1y + ' ' + c2x + ' ' + c2y + ' ' + p2.x + ' ' + p2.y;
    }
    return d;
  }

  function journeyDiagram(steps) {
    var n = steps.length;
    var yMap = { positive: 26, neutral: 74, negative: 122 };
    var colorMap = { positive: '#4DAF8B', neutral: '#e0b34a', negative: '#d46b6b' };
    var pts = [];
    for (var i = 0; i < n; i++) {
      var x = 44 + i * ((640 - 88) / Math.max(1, n - 1));
      var y = yMap[steps[i].sentiment] != null ? yMap[steps[i].sentiment] : 74;
      pts.push({ x: x, y: y, color: colorMap[steps[i].sentiment] || '#e0b34a' });
    }
    var svg = '<svg viewBox="0 0 640 150" class="fa-jsvg" preserveAspectRatio="xMidYMid meet">';
    svg += '<line x1="44" y1="74" x2="596" y2="74" stroke="rgba(255,255,255,.06)" stroke-width="1" stroke-dasharray="4 4"/>';
    svg += '<path d="' + journeyPath(pts) + '" stroke="rgba(255,255,255,.35)" stroke-width="2.5" fill="none" stroke-linecap="round"/>';
    for (var j = 0; j < n; j++) {
      svg += '<circle cx="' + pts[j].x + '" cy="' + pts[j].y + '" r="6.5" fill="' + pts[j].color + '" stroke="#0e0e10" stroke-width="2.5"/>';
      var label = steps[j].name;
      if (label.length > 16) label = label.slice(0, 16).replace(/\s+$/, '') + '…';
      svg += '<text x="' + pts[j].x + '" y="142" text-anchor="middle" class="fa-jlabel">' + escHtml(label) + '</text>';
    }
    svg += '</svg>';

    var cards = '<div class="fa-jcards">';
    for (var k = 0; k < n; k++) {
      var s = steps[k];
      cards += '<div class="fa-jcard">'
        + '<div class="fa-jcard-top">'
        + '<span class="fa-jdot" style="background:' + (colorMap[s.sentiment] || '#e0b34a') + '"></span>'
        + '<b>' + escHtml(s.name) + '</b>'
        + '<span class="fa-jtag fa-jtag--' + escHtml(s.tag.toLowerCase()) + '">' + escHtml(s.tag) + '</span>'
        + '</div>'
        + '<div class="fa-jcard-txt">' + escHtml(s.insight) + '</div>'
        + '</div>';
    }
    cards += '</div>';

    return '<div class="fa-journey">'
      + '<div class="fa-journey-head">The emotional journey</div>'
      + svg + cards
      + '</div>';
  }

  // Render an artifact body — JTBD gets the Four Forces diagram; everything else is plain markdown.
  function renderBody(bodyEl, content, cfg) {
    if (cfg && cfg.tool === 'journey') {
      var ej = extractJourney(content);
      if (ej) { bodyEl.innerHTML = (ej.intro ? '<p>' + escHtml(ej.intro) + '</p>' : '') + journeyDiagram(ej.steps); return; }
    }
    var diagram = '';
    if (cfg && cfg.tool === 'jtbd') {
      var ex = extractForces(content);
      if (ex) { diagram = forcesDiagram(ex.forces); content = ex.cleaned; }
    }
    bodyEl.innerHTML = diagram + renderMarkdown(content);
  }

  // ── styles ──
  function injectStyles() {
    if (document.getElementById('fa-styles')) return;
    var css = ''
      + '.fa-overlay{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.72);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:24px;overflow-y:auto}'
      + '.fa-modal{width:100%;max-width:640px;max-height:92vh;display:flex;flex-direction:column;background:#0e0e10;border:1px solid rgba(255,255,255,.1);border-radius:16px;box-shadow:0 30px 80px rgba(0,0,0,.6);overflow:hidden;color:#ece4d6}'
      + '.fa-close{position:absolute;top:16px;right:18px;z-index:2;background:rgba(255,255,255,.08);border:none;color:#ece4d6;width:34px;height:34px;border-radius:50%;font-size:20px;line-height:1;cursor:pointer}'
      + '.fa-close:hover{background:rgba(255,255,255,.16)}'
      + '.fa-sheet{overflow-y:auto;padding:34px 34px 20px;flex:1}'
      + '.fa-mast{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px}'
      + '.fa-mast-brand{display:flex;align-items:center;gap:8px}'
      + '.fa-mast-logo{width:26px;height:26px;border-radius:50%;flex:none}'
      + '.fa-mast-name{font-weight:700;font-size:.95rem;letter-spacing:.01em}'
      + '.fa-mast-chip{font-size:.66rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;border:1px solid;border-radius:100px;padding:4px 11px;white-space:nowrap}'
      + '.fa-title{font-size:1.5rem;font-weight:700;line-height:1.2;margin-bottom:8px}'
      + '.fa-sub{font-size:.9rem;opacity:.6;font-style:italic;margin-bottom:20px;padding-bottom:18px;border-bottom:1px solid rgba(255,255,255,.09)}'
      + '.fa-body{font-size:.95rem;line-height:1.6}'
      + '.fa-body h3,.fa-body h4{margin:14px 0 6px;font-size:1rem;font-weight:700}'
      + '.fa-body p{margin:9px 0}.fa-body p:first-child{margin-top:0}'
      + '.fa-body ul,.fa-body ol{margin:9px 0;padding-left:22px}.fa-body li{margin:5px 0}'
      + '.fa-body strong{font-weight:700}'
      + '.fa-body code{font-family:ui-monospace,Menlo,monospace;font-size:.88em;background:rgba(255,255,255,.1);padding:1px 6px;border-radius:5px}'
      + '.fa-gen{opacity:.6;font-style:italic}'
      + '.fa-foot{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:26px;padding-top:16px;border-top:1px solid rgba(255,255,255,.09)}'
      + '.fa-foot-left{display:flex;align-items:center;gap:9px}'
      + '.fa-foot-logo{width:24px;height:24px;border-radius:50%;flex:none;opacity:.9}'
      + '.fa-foot-txt{display:flex;flex-direction:column;line-height:1.3}'
      + '.fa-foot-made{font-size:.78rem;font-weight:700}'
      + '.fa-foot-brand{font-size:.72rem;opacity:.55}'
      + '.fa-foot-cta{background:none;border:1px solid;border-radius:100px;padding:7px 14px;font-family:inherit;font-size:.8rem;font-weight:700;cursor:pointer;white-space:nowrap;transition:all .15s}'
      + '.fa-foot-cta:hover{filter:brightness(1.25)}'
      + '.fa-actions{display:flex;gap:10px;padding:14px 18px;border-top:1px solid rgba(255,255,255,.09);background:#0b0b0d}'
      + '.fa-btn{flex:1;padding:11px 14px;border-radius:9px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.04);color:#ece4d6;font-family:inherit;font-size:.88rem;font-weight:600;cursor:pointer;transition:all .15s}'
      + '.fa-btn:hover{background:rgba(255,255,255,.1)}'
      + '.fa-btn--primary{border:none}'
      + '.fa-status{position:absolute;bottom:70px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.85);color:#fff;font-size:.8rem;padding:7px 14px;border-radius:100px;opacity:0;transition:opacity .2s;pointer-events:none}'
      + '.fa-status.fa-status--show{opacity:1}'
      + '.fa-forces{margin:4px 0 18px;border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:14px 14px 12px;background:rgba(255,255,255,.02)}'
      + '.fa-forces-head{font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;font-weight:700;opacity:.65;text-align:center;margin-bottom:12px}'
      + '.fa-forces-cols{display:grid;grid-template-columns:1fr 1fr;gap:10px}'
      + '.fa-fc{border-radius:10px;padding:11px 12px}'
      + '.fa-fc--for{background:rgba(77,175,139,.1);border:1px solid rgba(77,175,139,.3)}'
      + '.fa-fc--against{background:rgba(200,110,110,.09);border:1px solid rgba(200,110,110,.28)}'
      + '.fa-fc-cap{font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px}'
      + '.fa-fc--for .fa-fc-cap{color:#7fcbaf}.fa-fc--against .fa-fc-cap{color:#dd9a9a}'
      + '.fa-frow{margin:8px 0;font-size:.85rem;line-height:1.4}'
      + '.fa-frow b{display:block;font-size:.8rem;font-weight:700;margin-bottom:1px}'
      + '.fa-frow span{opacity:.72}'
      + '.fa-forces-legend{text-align:center;font-size:.7rem;opacity:.5;margin-top:11px}'
      + '.fa-journey{margin:4px 0 18px;border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:14px 14px 12px;background:rgba(255,255,255,.02)}'
      + '.fa-journey-head{font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;font-weight:700;opacity:.65;text-align:center;margin-bottom:12px}'
      + '.fa-jsvg{width:100%;height:auto;display:block;margin:6px 0 4px}'
      + '.fa-jlabel{fill:rgba(255,255,255,.55);font-size:10px;font-family:inherit}'
      + '.fa-jcards{display:flex;flex-direction:column;gap:8px;margin-top:12px}'
      + '.fa-jcard{border:1px solid rgba(255,255,255,.09);border-radius:9px;padding:9px 11px}'
      + '.fa-jcard-top{display:flex;align-items:center;gap:8px;margin-bottom:3px}'
      + '.fa-jcard-top b{font-size:.86rem}'
      + '.fa-jdot{width:9px;height:9px;border-radius:50%;flex:none}'
      + '.fa-jtag{margin-left:auto;font-size:.64rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:2px 8px;border-radius:100px}'
      + '.fa-jtag--pain{background:rgba(212,107,107,.16);color:#e59b9b}'
      + '.fa-jtag--gain{background:rgba(77,175,139,.16);color:#7fcbaf}'
      + '.fa-jtag--job{background:rgba(120,150,210,.16);color:#9fb4e0}'
      + '.fa-jcard-txt{font-size:.84rem;opacity:.78;line-height:1.4}'
      + '@media(max-width:600px){.fa-overlay{padding:0}.fa-modal{max-width:100%;width:100%;height:100%;max-height:100%;border-radius:0;border:none}.fa-sheet{padding:56px 20px 16px}.fa-title{font-size:1.3rem}.fa-actions{position:sticky;bottom:0}.fa-btn{font-size:.82rem;padding:12px 8px}.fa-forces-cols{grid-template-columns:1fr}}'
      + '@media print{body>*{display:none!important}.fa-overlay{display:block!important;position:static!important;background:none!important;backdrop-filter:none!important;padding:0!important;overflow:visible!important}.fa-modal{max-width:100%!important;max-height:none!important;box-shadow:none!important;border:none!important;background:#fff!important;color:#111!important}.fa-close,.fa-actions,.fa-status{display:none!important}.fa-sheet{color:#111!important}.fa-body code{background:#eee!important}.fa-mast-name,.fa-mast-chip,.fa-title,.fa-sub,.fa-foot-made,.fa-foot-brand{color:#111!important}.fa-sub{opacity:.7}.fa-foot-cta{display:none!important}.fa-forces{background:#f6f6f6!important;border-color:#ddd!important}.fa-fc--for{background:#eaf6f0!important;border-color:#bcdccd!important}.fa-fc--against{background:#f8ecec!important;border-color:#e0c5c5!important}.fa-fc-cap,.fa-frow b,.fa-frow span,.fa-forces-head,.fa-forces-legend{color:#222!important}.fa-jlabel{fill:#555!important}.fa-journey{background:#f6f6f6!important;border-color:#ddd!important}.fa-jcard{border-color:#ddd!important}.fa-jcard-top b,.fa-jcard-txt,.fa-journey-head{color:#222!important}}';
    var s = el('style'); s.id = 'fa-styles'; s.textContent = css;
    document.head.appendChild(s);
  }

  var _open = null;
  var _onClose = null;

  // Remove the modal DOM without firing the onClose callback (used when one
  // artifact replaces another — not a user-initiated close).
  function _remove() {
    if (_open && _open.parentNode) _open.parentNode.removeChild(_open);
    _open = null;
    document.body.style.overflow = '';
  }

  // User-initiated close (× button, overlay click, footer CTA) → fire onClose
  // so the host (e.g. the chat) can offer a next action.
  function close() {
    _remove();
    if (_onClose) { var cb = _onClose; _onClose = null; try { cb(); } catch (e) {} }
  }

  function toast(overlay, msg) {
    var t = overlay.querySelector('.fa-status');
    if (!t) return;
    t.textContent = msg; t.classList.add('fa-status--show');
    setTimeout(function () { t.classList.remove('fa-status--show'); }, 1900);
  }

  // Build the modal shell; returns { overlay, body, actionsWrap }
  function build(cfg) {
    injectStyles();
    _remove();
    var accent = cfg.accent || DEFAULT_ACCENT;
    var overlay = el('div', 'fa-overlay');
    var modal = el('div', 'fa-modal');
    overlay.appendChild(modal);

    var closeBtn = el('button', 'fa-close', { text: '×' });
    closeBtn.addEventListener('click', close);
    modal.appendChild(closeBtn);

    var sheet = el('div', 'fa-sheet');

    // Masthead — consistent Fenix brand (left) + the tool (accent chip, right)
    var mast = el('div', 'fa-mast');
    var brandWrap = el('div', 'fa-mast-brand');
    var logo = el('img', 'fa-mast-logo'); logo.src = FENIX_LOGO; logo.alt = 'Fenix';
    brandWrap.appendChild(logo);
    brandWrap.appendChild(el('span', 'fa-mast-name', { text: 'Fenix' }));
    mast.appendChild(brandWrap);
    if (cfg.kicker) { var chip = el('span', 'fa-mast-chip', { text: cfg.kicker }); chip.style.color = accent; chip.style.borderColor = accent; mast.appendChild(chip); }
    sheet.appendChild(mast);

    // Title block
    sheet.appendChild(el('div', 'fa-title', { text: cfg.title || '' }));
    if (cfg.input) sheet.appendChild(el('div', 'fa-sub', { text: '“' + cfg.input + '”' }));

    var body = el('div', 'fa-body');
    sheet.appendChild(body);

    // Footer — consistent brand + flywheel CTA
    var foot = el('div', 'fa-foot');
    var fleft = el('div', 'fa-foot-left');
    var flogo = el('img', 'fa-foot-logo'); flogo.src = FENIX_LOGO; flogo.alt = '';
    fleft.appendChild(flogo);
    var ftxt = el('div', 'fa-foot-txt');
    ftxt.appendChild(el('span', 'fa-foot-made', { text: 'Made with Fenix' }));
    ftxt.appendChild(el('span', 'fa-foot-brand', { text: 'Kiran Rao · kiranrao.ai' }));
    fleft.appendChild(ftxt);
    foot.appendChild(fleft);
    var cta = el('button', 'fa-foot-cta', { text: 'Build your own →' });
    cta.style.color = accent; cta.style.borderColor = accent;
    cta.addEventListener('click', close);
    foot.appendChild(cta);
    sheet.appendChild(foot);

    modal.appendChild(sheet);

    var actions = el('div', 'fa-actions');
    modal.appendChild(actions);
    overlay.appendChild(el('div', 'fa-status'));

    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    _open = overlay;
    return { overlay: overlay, modal: modal, body: body, actions: actions, accent: accent };
  }

  // Wire the Print + Copy-link actions once content is final.
  function addActions(ctx, cfg, content) {
    ctx.actions.innerHTML = '';
    var shareBtn = el('button', 'fa-btn fa-btn--primary', { text: '🔗 Copy link' });
    shareBtn.style.background = ctx.accent; shareBtn.style.color = '#0a0a0a';
    shareBtn.addEventListener('click', function () {
      try {
        var payload = { k: cfg.kicker, ti: cfg.title, i: cfg.input, c: content, p: cfg.persona, a: ctx.accent, t: cfg.tool };
        var enc = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
        var url = location.origin + '/?fa=' + enc;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () { toast(ctx.overlay, 'Link copied — share it anywhere'); });
        } else { window.prompt('Copy this link:', url); }
      } catch (e) { toast(ctx.overlay, 'Could not copy link'); }
    });
    var printBtn = el('button', 'fa-btn', { text: '⎙ Save / Print' });
    printBtn.addEventListener('click', function () { window.print(); });
    ctx.actions.appendChild(shareBtn);
    ctx.actions.appendChild(printBtn);
  }

  // ── SSE stream from the agent ──
  function streamAgent(prompt, persona, onDelta, onDone, onError) {
    fetch(AGENT_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], visitor: { persona: persona || 'practitioner' }, explored: {}, available_tools: [] })
    }).then(function (r) {
      if (!r.ok || !r.body) throw new Error('agent error ' + r.status);
      var reader = r.body.getReader(), dec = new TextDecoder(), buf = '', full = '';
      function read() {
        return reader.read().then(function (res) {
          if (res.done) { onDone(full); return; }
          buf += dec.decode(res.value, { stream: true });
          var lines = buf.split('\n'); buf = lines.pop();
          lines.forEach(function (line) {
            if (line.indexOf('data: ') === 0) {
              try { var d = JSON.parse(line.slice(6)); if (d.type === 'text_delta') { full += d.content; onDelta(full); } else if (d.type === 'error') { onError(d.message || 'error'); } } catch (e) {}
            }
          });
          return read();
        });
      }
      return read();
    }).catch(function (e) { onError(String(e)); });
  }

  // ── public: generate content WITHOUT opening the modal ──
  // Lets the host render its own "thinking" state (e.g. in the chat) and only
  // pop the artifact when the full result is ready.
  function generate(cfg, hooks) {
    hooks = hooks || {};
    streamAgent(cfg.prompt, cfg.persona,
      function (full) { if (hooks.onProgress) hooks.onProgress(full); },
      function (full) { if (hooks.onDone) hooks.onDone(full || ''); },
      function (err) { if (hooks.onError) hooks.onError(err); }
    );
  }

  // ── public: run a tool → stream into the artifact ──
  function run(cfg) {
    _onClose = null;
    var ctx = build(cfg);
    ctx.body.classList.add('fa-gen');
    ctx.body.textContent = 'Thinking…';
    ctx.actions.appendChild(el('span', 'fa-btn', { text: 'Generating…' }));
    streamAgent(cfg.prompt, cfg.persona,
      function (full) { ctx.body.textContent = full; },
      function (full) {
        if (!ctx.overlay.parentNode) return; // closed mid-stream
        ctx.body.classList.remove('fa-gen');
        renderBody(ctx.body, full || 'Something went wrong — try again.', cfg);
        addActions(ctx, cfg, full || '');
      },
      function (err) {
        if (!ctx.overlay.parentNode) return;
        ctx.body.classList.remove('fa-gen');
        ctx.body.innerHTML = renderMarkdown("I couldn’t generate that just now. Give it another go in a moment.");
        ctx.actions.innerHTML = '';
        var retry = el('button', 'fa-btn', { text: 'Close' }); retry.addEventListener('click', close); ctx.actions.appendChild(retry);
      }
    );
  }

  // ── public: render a finished artifact (share-link loader) ──
  function show(cfg) {
    _onClose = null;                 // don't let build()'s cleanup fire a stale callback
    var ctx = build(cfg);
    renderBody(ctx.body, cfg.content || '', cfg);
    addActions(ctx, cfg, cfg.content || '');
    _onClose = cfg.onClose || null;  // fire when the user closes this artifact
  }

  // ── share-link loader: ?fa=<base64> ──
  function tryLoadFromUrl() {
    try {
      var enc = new URLSearchParams(location.search).get('fa');
      if (!enc) return;
      // A shared artifact is a public invitation — clear the pre-launch gate so it shows,
      // and let the visitor explore the site behind it (that's the whole flywheel).
      var g = document.getElementById('site-gate');
      if (g && g.parentNode) g.parentNode.removeChild(g);
      try { sessionStorage.setItem('site_unlocked', 'true'); } catch (e) {}
      var payload = JSON.parse(decodeURIComponent(escape(atob(enc))));
      show({ kicker: payload.k, title: payload.ti, input: payload.i, content: payload.c, persona: payload.p, accent: payload.a, tool: payload.t });
    } catch (e) { /* ignore malformed links */ }
  }

  window.FenixArtifact = { run: run, show: show, generate: generate, close: close };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryLoadFromUrl);
  else tryLoadFromUrl();

})();
