/**
 * ============================================
 * FENIX TRADE — "Trade me a door"
 * A gamified contact-trade for the Practitioner persona. Not a chatbot dump:
 * a real trading-card experience in the branded artifact modal.
 *
 *   1. REVEAL   — Kiran's trading card renders (foil, flip-in). His network,
 *                 shown as "deck stats" (baseball-card style). The hook.
 *   2. BUILD    — the visitor builds their own card live as they type:
 *                 the door they can open + the door they want. Connecting
 *                 (name/company) is the price of a trade.
 *   3. PROPOSE  — the two cards slide together; the trade is captured + sent
 *                 to Kiran to broker (double-opt-in). Confirmation.
 *   4. SHARE    — their card becomes a shareable link (?trade=…) → flywheel.
 *
 * Reuses FenixArtifact.shell() for the branded frame (masthead/footer).
 * Depends on: fenix-core.js (FC.connectVisitor, FC.sendToAgent), fenix-artifact.js.
 * ============================================
 */
(function () {
  'use strict';

  var ACCENT = '#4DAF8B';
  var GOLD = '#e0b34a';

  // Kiran's deck — grounded in the real LinkedIn export (731 connections).
  var DECK = {
    name: 'Kiran Rao',
    role: 'Product Leader',
    team: 'ex–Wells Fargo · First Republic',
    tagline: 'I trade doors.',
    num: '001',
    stats: [
      { label: 'Banking & Fintech', val: '311' },
      { label: 'Founders & operators', val: '77' },
      { label: 'Big-tech product & eng', val: '47' },
      { label: 'Senior (VP / Dir / Head+)', val: '63%' }
    ],
    foot: '731 doors · 4 in 10 senior in finance'
  };

  function esc(s) {
    return (window.FenixArtifact && window.FenixArtifact.escHtml)
      ? window.FenixArtifact.escHtml(s)
      : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function initials(name) {
    var p = (name || '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '?';
    return ((p[0][0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  }

  // ── card markup ──────────────────────────────────
  function kiranCard(cls) {
    var stats = DECK.stats.map(function (s) {
      return '<div class="ft-stat"><span>' + esc(s.label) + '</span><b>' + esc(s.val) + '</b></div>';
    }).join('');
    return '<div class="ft-card ft-card--kiran ft-foil ' + (cls || '') + '">'
      + '<div class="ft-sheen"></div>'
      + '<div class="ft-num">#' + esc(DECK.num) + '</div>'
      + '<div class="ft-head">'
      + '<div class="ft-avatar ft-avatar--kiran">KR</div>'
      + '<div class="ft-idblock"><div class="ft-name">' + esc(DECK.name) + '</div>'
      + '<div class="ft-role">' + esc(DECK.role) + '</div>'
      + '<div class="ft-team">' + esc(DECK.team) + '</div></div>'
      + '</div>'
      + '<div class="ft-deck"><div class="ft-deck-title">The Deck</div>' + stats + '</div>'
      + '<div class="ft-foot"><span class="ft-quote">“' + esc(DECK.tagline) + '”</span><span class="ft-foot-sub">' + esc(DECK.foot) + '</span></div>'
      + '</div>';
  }

  function visitorCard(d, cls) {
    d = d || {};
    var nm = d.name && d.name.trim();
    var av = nm ? initials(nm) : '?';
    var team = [d.role, d.company].filter(Boolean).join(' · ');
    return '<div class="ft-card ft-card--you ' + (cls || '') + '">'
      + '<div class="ft-sheen"></div>'
      + '<div class="ft-num">#—</div>'
      + '<div class="ft-head">'
      + '<div class="ft-avatar ft-avatar--you' + (nm ? '' : ' ft-avatar--empty') + '" data-ft="avatar">' + esc(av) + '</div>'
      + '<div class="ft-idblock"><div class="ft-name" data-ft="name">' + esc(nm || 'Your name') + '</div>'
      + '<div class="ft-role" data-ft="role">' + esc(d.role || 'Your role') + '</div>'
      + '<div class="ft-team" data-ft="team">' + esc(team || 'Your company') + '</div></div>'
      + '</div>'
      + '<div class="ft-trade">'
      + '<div class="ft-trow ft-offer"><span class="ft-tlabel">A door I can open</span><div class="ft-tval" data-ft="offer">' + esc(d.offer || '—') + '</div></div>'
      + '<div class="ft-trow ft-seek"><span class="ft-tlabel">A door I\'m looking for</span><div class="ft-tval" data-ft="want">' + esc(d.want || '—') + '</div></div>'
      + '</div>'
      + '</div>';
  }

  function setTitle(ctx, txt) {
    var t = ctx.modal.querySelector('.fa-title');
    if (t) t.textContent = txt;
  }
  function toast(ctx, msg) {
    var t = ctx.overlay.querySelector('.fa-status');
    if (!t) return;
    t.textContent = msg; t.classList.add('fa-status--show');
    setTimeout(function () { t.classList.remove('fa-status--show'); }, 1900);
  }
  function btn(cls, label) {
    var b = document.createElement('button'); b.className = cls; b.textContent = label; return b;
  }

  // ── stages ───────────────────────────────────────
  function stageReveal(ctx) {
    setTitle(ctx, 'Here’s my card.');
    ctx.body.innerHTML =
      '<p class="ft-lede">Fifteen years in product left me with a deep bench — not names to hand out, <b>doors to open</b>. Here’s what’s in my deck. Trade me one and I’ll open one for you.</p>'
      + '<div class="ft-stage"><div class="ft-cards ft-cards--solo">' + kiranCard('ft-in') + '</div></div>';
    ctx.actions.innerHTML = '';
    var go = btn('fa-btn fa-btn--primary', 'Build my card →');
    go.style.background = ACCENT; go.style.color = '#08130f';
    go.addEventListener('click', function () { stageBuild(ctx); });
    ctx.actions.appendChild(go);
  }

  function stageBuild(ctx) {
    setTitle(ctx, 'Your move.');
    var connected = FC.fenixState.visitor.connected;
    var v = FC.fenixState.visitor;
    var st = ctx._trade;
    if (connected) { st.name = v.name || st.name; st.company = v.company || st.company; }

    var idFields = connected
      ? '<div class="ft-connected">Trading as <b>' + esc(v.name) + '</b>' + (v.company ? ' · ' + esc(v.company) : '') + '</div>'
      : '<div class="ft-frow ft-frow--split">'
        + '<label class="ft-field"><span>Your name</span><input class="ft-inp" data-k="name" placeholder="First Last" autocomplete="name"></label>'
        + '<label class="ft-field"><span>Company</span><input class="ft-inp" data-k="company" placeholder="Where you are" autocomplete="organization"></label>'
        + '</div>'
        + '<label class="ft-field"><span>Email <em>(so I can reach you)</em></span><input class="ft-inp" data-k="email" type="email" placeholder="you@company.com" autocomplete="email"></label>';

    ctx.body.innerHTML =
      '<p class="ft-lede">A fair trade needs two doors. Fill yours in — your card builds as you type.</p>'
      + '<div class="ft-stage"><div class="ft-cards" data-ft="cards">'
      + kiranCard('') + '<div class="ft-vs" data-ft="vs">⇄</div>' + visitorCard(st, 'ft-card--live')
      + '</div></div>'
      + '<div class="ft-form">'
      + idFields
      + '<label class="ft-field"><span>Your role</span><input class="ft-inp" data-k="role" placeholder="e.g. Senior PM, Design Lead" value="' + esc(st.role || '') + '"></label>'
      + '<label class="ft-field ft-field--hero"><span>🚪 A door <b>you</b> can open</span><input class="ft-inp" data-k="offer" placeholder="e.g. Intros to healthtech founders" value="' + esc(st.offer || '') + '"></label>'
      + '<label class="ft-field ft-field--hero"><span>🎯 A door <b>you\'re</b> looking for</span><input class="ft-inp" data-k="want" placeholder="e.g. A senior PM inside a big bank" value="' + esc(st.want || '') + '"></label>'
      + '<div class="ft-err" data-ft="err"></div>'
      + '</div>';

    // live binding
    var cardYou = ctx.body.querySelector('.ft-card--you');
    function paint() {
      var nm = (st.name || '').trim();
      cardYou.querySelector('[data-ft="name"]').textContent = nm || 'Your name';
      cardYou.querySelector('[data-ft="role"]').textContent = st.role || 'Your role';
      cardYou.querySelector('[data-ft="team"]').textContent = [st.role, st.company].filter(Boolean).join(' · ') || 'Your company';
      cardYou.querySelector('[data-ft="offer"]').textContent = st.offer || '—';
      cardYou.querySelector('[data-ft="want"]').textContent = st.want || '—';
      var av = cardYou.querySelector('[data-ft="avatar"]');
      av.textContent = nm ? initials(nm) : '?';
      av.classList.toggle('ft-avatar--empty', !nm);
    }
    ctx.body.querySelectorAll('.ft-inp').forEach(function (inp) {
      inp.addEventListener('input', function () { st[inp.getAttribute('data-k')] = inp.value; paint(); });
    });
    paint();

    ctx.actions.innerHTML = '';
    var back = btn('fa-btn', '‹ My card');
    back.addEventListener('click', function () { stageReveal(ctx); });
    var propose = btn('fa-btn fa-btn--primary', 'Propose the trade 🤝');
    propose.style.background = ACCENT; propose.style.color = '#08130f';
    propose.addEventListener('click', function () { doPropose(ctx); });
    ctx.actions.appendChild(back);
    ctx.actions.appendChild(propose);
  }

  function doPropose(ctx) {
    var st = ctx._trade;
    var errEl = ctx.body.querySelector('[data-ft="err"]');
    function fail(msg) { if (errEl) { errEl.textContent = msg; errEl.classList.add('ft-err--show'); } }

    if (!st.offer || !st.offer.trim()) return fail('Add the door you can open — that’s your half of the trade.');
    if (!st.want || !st.want.trim()) return fail('Add the door you’re looking for, so I know what to trade for.');

    if (!FC.fenixState.visitor.connected) {
      var res = FC.connectVisitor({ name: st.name, company: st.company, email: st.email, source: 'trade' });
      if (!res.success) return fail(res.reason + ' — trades are name-to-name.');
      st.name = res.name; st.company = res.company;
    } else {
      st.name = FC.fenixState.visitor.name; st.company = FC.fenixState.visitor.company;
    }
    if (errEl) errEl.classList.remove('ft-err--show');

    // Send the trade to Kiran — emails him the door details so he can broker it.
    try {
      fetch('https://api.kiranrao.ai/api/v1/fenix/trade', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: st.name, company: st.company || null, email: st.email || null, role: st.role || null,
          offer: st.offer.trim(), want: st.want.trim(),
          page_url: location.href,
          conversation_id: (FC.fenixState && FC.fenixState.conversationId) || null
        })
      }).catch(function () { /* best-effort — the modal confirmation already shows */ });
    } catch (e) { /* ignore */ }

    stageProposed(ctx);
  }

  function stageProposed(ctx) {
    setTitle(ctx, 'It’s a deal. 🤝');
    var st = ctx._trade;
    ctx.body.innerHTML =
      '<div class="ft-stage"><div class="ft-cards ft-merged">'
      + kiranCard('') + '<div class="ft-vs ft-vs--deal">🤝</div>' + visitorCard(st, '')
      + '</div></div>'
      + '<div class="ft-confirm">'
      + '<div class="ft-confirm-title">Trade proposed.</div>'
      + '<p>I’ll broker it personally — <b>double-opt-in</b>, no names shared until both sides say yes. If it’s a fair swap, you’ll hear from me' + (st.email ? ' at <b>' + esc(st.email) + '</b>' : '') + '.</p>'
      + '</div>';
    ctx.actions.innerHTML = '';
    var share = btn('fa-btn fa-btn--primary', '🔗 Share my card');
    share.style.background = GOLD; share.style.color = '#1a1400';
    share.addEventListener('click', function () { shareCard(ctx); });
    var done = btn('fa-btn', 'Done');
    done.addEventListener('click', function () { window.FenixArtifact.close(); });
    ctx.actions.appendChild(share);
    ctx.actions.appendChild(done);
  }

  function shareCard(ctx) {
    var st = ctx._trade;
    try {
      var payload = { n: st.name, r: st.role, c: st.company, o: st.offer, w: st.want };
      var enc = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
      var url = location.origin + '/?trade=' + enc;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { toast(ctx, 'Card link copied — share it anywhere'); });
      } else { window.prompt('Copy your card link:', url); }
    } catch (e) { toast(ctx, 'Could not copy link'); }
  }

  // ── shared-card view (?trade=…) ──────────────────
  function showShared(d) {
    injectStyles();
    var ctx = window.FenixArtifact.shell({ kicker: 'The Trade', title: 'A trade on the table.', accent: ACCENT, persona: 'practitioner' });
    ctx._trade = {};
    ctx.body.innerHTML =
      '<p class="ft-lede"><b>' + esc(d.name || 'Someone') + '</b> is trading doors with Kiran. Here’s the table — want in?</p>'
      + '<div class="ft-stage"><div class="ft-cards">'
      + visitorCard({ name: d.name, role: d.role, company: d.company, offer: d.offer, want: d.want }, '')
      + '<div class="ft-vs">⇄</div>' + kiranCard('')
      + '</div></div>';
    ctx.actions.innerHTML = '';
    var mine = btn('fa-btn fa-btn--primary', 'Trade a door with Kiran →');
    mine.style.background = ACCENT; mine.style.color = '#08130f';
    mine.addEventListener('click', function () { open(); });
    ctx.actions.appendChild(mine);
  }

  function tryLoadFromUrl() {
    try {
      var enc = new URLSearchParams(location.search).get('trade');
      if (!enc) return;
      var g = document.getElementById('site-gate');
      if (g && g.parentNode) g.parentNode.removeChild(g);
      try { sessionStorage.setItem('site_unlocked', 'true'); } catch (e) {}
      var p = JSON.parse(decodeURIComponent(escape(atob(enc))));
      showShared({ name: p.n, role: p.r, company: p.c, offer: p.o, want: p.w });
    } catch (e) { /* ignore malformed */ }
  }

  // ── public entry ─────────────────────────────────
  function open() {
    if (!window.FenixArtifact || !window.FenixArtifact.shell) return;
    injectStyles();
    var ctx = window.FenixArtifact.shell({ kicker: 'The Trade', title: 'Here’s my card.', accent: ACCENT, persona: 'practitioner' });
    ctx._trade = { name: '', company: '', email: '', role: '', offer: '', want: '' };
    stageReveal(ctx);
  }

  // ── styles ───────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('ft-styles')) return;
    var css = ''
      + '.ft-lede{font-size:.95rem;line-height:1.55;opacity:.82;margin:0 0 18px}'
      + '.ft-lede b{opacity:1;font-weight:700}'
      + '.ft-stage{display:flex;justify-content:center;margin:6px 0 4px}'
      + '.ft-cards{display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;perspective:1200px}'
      + '.ft-cards--solo{gap:0}'
      + '.ft-vs{font-size:1.4rem;opacity:.5;flex:none}'
      + '.ft-vs--deal{font-size:1.7rem;opacity:1}'
      // card
      + '.ft-card{position:relative;width:230px;min-height:322px;border-radius:16px;padding:16px 15px 14px;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;background:linear-gradient(160deg,#17181c,#101013);border:1px solid rgba(255,255,255,.12);box-shadow:0 18px 40px rgba(0,0,0,.5);transition:transform .5s cubic-bezier(.22,.61,.36,1)}'
      + '.ft-card--kiran{border-color:rgba(224,179,74,.5)}'
      + '.ft-card--you{border-color:rgba(77,175,139,.5)}'
      + '.ft-card--live{box-shadow:0 18px 40px rgba(0,0,0,.5),0 0 0 1px rgba(77,175,139,.3),0 0 26px rgba(77,175,139,.18)}'
      // foil sheen
      + '.ft-sheen{position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.14) 45%,rgba(224,179,74,.12) 50%,rgba(77,175,139,.12) 55%,transparent 70%);background-size:250% 250%;animation:ft-sheen 6s linear infinite;mix-blend-mode:screen;opacity:.7}'
      + '.ft-card--you .ft-sheen{opacity:.5}'
      + '@keyframes ft-sheen{0%{background-position:120% 0}100%{background-position:-120% 0}}'
      + '.ft-num{position:absolute;top:11px;right:13px;font-size:.7rem;font-weight:800;letter-spacing:.05em;opacity:.55}'
      + '.ft-head{display:flex;align-items:center;gap:11px;margin-bottom:13px}'
      + '.ft-avatar{width:52px;height:52px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.15rem;color:#08130f}'
      + '.ft-avatar--kiran{background:linear-gradient(140deg,' + GOLD + ',#c78f2e);box-shadow:0 0 0 2px rgba(224,179,74,.25)}'
      + '.ft-avatar--you{background:linear-gradient(140deg,' + ACCENT + ',#2f8f6c);box-shadow:0 0 0 2px rgba(77,175,139,.25)}'
      + '.ft-avatar--empty{background:rgba(255,255,255,.08);color:rgba(255,255,255,.4);box-shadow:none}'
      + '.ft-idblock{min-width:0}'
      + '.ft-name{font-weight:800;font-size:1.02rem;line-height:1.15}'
      + '.ft-role{font-size:.78rem;opacity:.8;margin-top:2px}'
      + '.ft-team{font-size:.68rem;opacity:.5;margin-top:2px}'
      // deck stats
      + '.ft-deck{margin-top:2px;border-top:1px solid rgba(255,255,255,.1);padding-top:10px;flex:1}'
      + '.ft-deck-title{font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;font-weight:800;opacity:.55;margin-bottom:8px}'
      + '.ft-stat{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:4px 0;border-bottom:1px dotted rgba(255,255,255,.09);font-size:.8rem}'
      + '.ft-stat span{opacity:.78}.ft-stat b{font-weight:800;font-size:.95rem;color:' + GOLD + '}'
      + '.ft-foot{margin-top:11px;display:flex;flex-direction:column;gap:3px}'
      + '.ft-quote{font-style:italic;font-size:.82rem;opacity:.85}'
      + '.ft-foot-sub{font-size:.64rem;opacity:.45}'
      // trade rows (visitor)
      + '.ft-trade{margin-top:2px;border-top:1px solid rgba(255,255,255,.1);padding-top:12px;flex:1;display:flex;flex-direction:column;gap:12px}'
      + '.ft-trow{}.ft-tlabel{display:block;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;font-weight:800;opacity:.55;margin-bottom:4px}'
      + '.ft-offer .ft-tlabel{color:' + ACCENT + '}.ft-seek .ft-tlabel{color:' + GOLD + '}'
      + '.ft-tval{font-size:.86rem;line-height:1.35;min-height:1.1em}'
      // flip-in reveal
      + '.ft-in{animation:ft-flip .8s cubic-bezier(.22,.61,.36,1) both}'
      + '@keyframes ft-flip{0%{opacity:0;transform:rotateY(-70deg) translateY(10px)}60%{opacity:1}100%{opacity:1;transform:rotateY(0) translateY(0)}}'
      // merged (slide together)
      + '.ft-merged .ft-card--kiran{transform:translateX(14px) rotate(-4deg)}'
      + '.ft-merged .ft-card--you{transform:translateX(-14px) rotate(4deg)}'
      // form
      + '.ft-form{margin-top:20px;display:flex;flex-direction:column;gap:13px}'
      + '.ft-frow--split{display:grid;grid-template-columns:1fr 1fr;gap:11px}'
      + '.ft-field{display:flex;flex-direction:column;gap:5px;font-size:.75rem}'
      + '.ft-field>span{opacity:.7;font-weight:600}.ft-field>span em{opacity:.6;font-weight:400;font-style:italic}.ft-field>span b{color:inherit}'
      + '.ft-field--hero>span{font-size:.82rem;opacity:.9}'
      + '.ft-inp{width:100%;box-sizing:border-box;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.15);border-radius:9px;color:inherit;padding:10px 12px;font-family:inherit;font-size:.9rem}'
      + '.ft-inp:focus{outline:none;border-color:' + ACCENT + '}'
      + '.ft-field--hero .ft-inp{border-color:rgba(77,175,139,.35)}'
      + '.ft-connected{font-size:.85rem;opacity:.8;background:rgba(77,175,139,.1);border:1px solid rgba(77,175,139,.25);border-radius:9px;padding:9px 12px}'
      + '.ft-connected b{opacity:1}'
      + '.ft-err{font-size:.8rem;color:#e59b9b;min-height:0;opacity:0;transition:opacity .2s}'
      + '.ft-err--show{opacity:1;min-height:1.1em}'
      // confirm
      + '.ft-confirm{text-align:center;margin-top:20px}'
      + '.ft-confirm-title{font-size:1.15rem;font-weight:800;margin-bottom:6px}'
      + '.ft-confirm p{font-size:.9rem;line-height:1.55;opacity:.8;max-width:420px;margin:0 auto}'
      // responsive
      + '@media(max-width:560px){.ft-cards{gap:12px}.ft-card{width:100%;max-width:300px}.ft-vs{transform:rotate(90deg)}.ft-merged .ft-card--kiran,.ft-merged .ft-card--you{transform:none}.ft-frow--split{grid-template-columns:1fr}}'
      // print
      + '@media print{.ft-sheen{display:none!important}.ft-form,.ft-lede{display:none!important}.ft-card{box-shadow:none!important;border:1px solid #ccc!important;background:#fff!important;color:#111!important}.ft-stat b,.ft-offer .ft-tlabel,.ft-seek .ft-tlabel{color:#111!important}}';
    var s = document.createElement('style'); s.id = 'ft-styles'; s.textContent = css;
    document.head.appendChild(s);
  }

  var FC = window.FenixCore;

  window.FenixTrade = { open: open, tryLoadFromUrl: tryLoadFromUrl };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryLoadFromUrl);
  else tryLoadFromUrl();

})();
