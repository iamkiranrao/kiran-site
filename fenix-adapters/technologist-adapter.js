/**
 * ============================================
 * TECHNOLOGIST ADAPTER
 * Fenix page adapter for the Technologist persona (CTO / AI Lead / Tech Lead — "Ray Turing").
 *
 * Positioning: AI-fluent PRODUCT LEADER who ships — judgment + AI, not code.
 * Four unlocks:
 *   1. buildstory — "How I built this without writing a line of code" (I decided / AI executed)
 *   2. judgment   — "The judgment calls" (product-technical decisions; each Challengeable via Fenix)
 *   3. problem    — "Bring me a product or AI problem" (input -> Fenix first-pass scope -> connect)
 *   4. roast      — fun: Fenix roasts Kiran's OWN build, grounded, affectionate, self-aware
 *
 * Deep technical Q&A is delegated to Fenix (grounded) — the system Kiran built is the authority.
 * Panels 1-2 are static (no CC API key in client code). Requires fenix-core.js first.
 * Hook: persona-system.js calls TechnologistExperience.init('technologist')
 * ============================================
 */

(function () {
  'use strict';

  var FC = window.FenixCore;
  if (!FC) { console.error('TechnologistExperience requires FenixCore'); return; }
  var el = FC.el;
  var fenixState = FC.fenixState;

  var ACCENT = '#cb5c72';

  var FENIX_OPENING = "Straight up: Kiran built this whole thing — the persona system, me, the RAG underneath — by making every decision, not writing the code. That's the honest pitch. The cards on the left are the real internals: how it got built, the calls behind it, a problem you can bring, and — since he insisted — you can have me roast the whole thing. Pop the hood.";

  // ── 1. Build story: what Kiran decided vs. what the AI executed ──
  var BUILD_STEPS = [
    { decide: "The site should reshape for whoever's visiting — a distinct, coherent experience per persona.", ai: "Wrote the persona engine and the homepage morphing." },
    { decide: "Fenix has to be grounded in my real work and never invent things. Accuracy over fluency, always.", ai: "Built the RAG pipeline — embed, vector-search, retrieve." },
    { decide: "Every capability should be a tool the agent can call — so adding a feature never means forking the backend.", ai: "Implemented the tool-registry and the agent loop." },
    { decide: "When a retired model silently took prod down, the fix was one source of truth for the model plus an early-warning canary.", ai: "Wrote the config change and the health check." },
    { decide: "This card you're reading should show exactly this — the split between the judgment and the typing.", ai: "Rendered it." }
  ];

  // ── 2. Judgment calls — product-technical, each Challengeable ──
  var JUDGMENT = [
    { title: "Make the site itself the product", why: "A portfolio describes your work. I decided the site should be the work — a live AI product you're using right now. The medium is the message.", challenge: "Why is making the site itself the product better than a normal portfolio?" },
    { title: "The guardrail matters more than the RAG", why: "The real decision wasn't 'use RAG.' It was making Fenix say 'I don't know' instead of guessing. One confident wrong answer about my background costs more than a hundred right ones.", challenge: "Why prioritize the no-hallucination guardrail over raw capability?" },
    { title: "Kill the contact form", why: "Nobody fills out a contact form. I removed it entirely and made the whole site the conversation instead. Elimination over optimization.", challenge: "Why kill the contact form instead of just improving it?" },
    { title: "Own the judgment, rent the typing", why: "I decided what to build — the persona system, the guardrails, the experience bar — and let the tools handle the how. Knowing where that line sits is the actual skill.", challenge: "How does Kiran decide what to build himself vs. let AI handle?" },
    { title: "The one that bit me", why: "A paused free-tier database and a retired model both took prod down while I was away. The lesson wasn't 'be more careful' — it was to build the early-warning system so it can't fail silently again.", challenge: "What did the outage teach Kiran, and how did he respond?" }
  ];

  // ── 4. Roast angles — Fenix roasts Kiran's own build ──
  var ROAST_ANGLES = [
    { label: 'Roast the whole thing', display: 'Roast the whole build', prompt: "Roast Kiran's entire site and build. Be witty and genuinely funny — land a few real jabs grounded in his actual choices, stay honest and self-aware, and end on a warm note. He explicitly asked for this, so don't go soft or generic." },
    { label: 'Roast the tech choices', display: 'Roast the tech choices', prompt: "Roast Kiran's technical choices — vanilla JS with no framework, the whole stack — playfully but grounded in the real tradeoffs. A couple of sharp, specific jabs, then a wink." },
    { label: 'Roast his over-engineering', display: 'Roast the over-engineering', prompt: "Roast Kiran's over-engineering — building the meta-layers, hundreds of docs, and elaborate infrastructure before shipping. He's very self-aware about this, so actually go there. Affectionate, honest, and funny." }
  ];

  var state = { currentPanel: null };

  // ── UI ────────────────────────────────────────────

  function buildUI() {
    var rightCol = document.querySelector('.fenix-intro-right');
    var leftCol = document.querySelector('.fenix-intro-left');
    if (!rightCol || !leftCol) return;
    injectStyles();
    rightCol.innerHTML = '';
    leftCol.innerHTML = '';
    buildFenixColumn(rightCol);
    buildUnlockCards(leftCol);
    var zone = document.querySelector('.fenix-intro-zone');
    if (zone) zone.classList.add('tg-zone');
    revealAll();
  }

  function revealAll() {
    ['.ev-unlock-cards-header', '.ev-unlock-card', '.ev-fenix-col-header', '.ev-fenix-chat',
     '.ev-chat-header', '.ev-chat-messages', '.ev-chat-pills', '.ev-chat-input-bar', '.ev-msg']
      .forEach(function (sel) {
        document.querySelectorAll(sel).forEach(function (n) { n.classList.add('ev-revealed'); });
      });
  }

  function askFenix(text, displayText) {
    var msgArea = document.querySelector('.ev-chat-messages');
    if (!msgArea) return;
    FC.addVisitorMessage(msgArea, displayText || text);
    FC.sendToAgent(text, msgArea);
    var chat = document.querySelector('.ev-fenix-chat');
    if (chat) chat.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function buildFenixColumn(container) {
    var isConnected = fenixState.visitor.connected;
    var firstName = isConnected && fenixState.visitor.name ? fenixState.visitor.name.split(' ')[0] : '';

    container.appendChild(el('div', 'ev-fenix-col-header', {
      html: 'MEET FENIX — <span class="ev-fenix-tagline">ask it how any of this was built ↘</span>'
    }));

    var wrapper = el('div', 'ev-fenix-chat');
    var chatHeader = el('div', 'ev-chat-header');
    chatHeader.appendChild(el('img', 'ev-chat-avatar', { src: 'images/fenix/1fenixavatar1.png', alt: 'Fenix' }));
    var headerInfo = el('div', 'ev-chat-header-info');
    headerInfo.appendChild(el('span', 'ev-chat-header-name', { text: 'Fenix' }));
    var dot = el('span', 'ev-status-dot ev-status-dot--ready'); dot.setAttribute('title', 'Ready');
    headerInfo.appendChild(dot);
    chatHeader.appendChild(headerInfo);
    wrapper.appendChild(chatHeader);

    var messageArea = el('div', 'ev-chat-messages');
    var openingText = (isConnected && firstName)
      ? 'Welcome back, ' + firstName + '. The cards on the left are the real internals — or ask me anything about the stack.'
      : FENIX_OPENING;
    var openingBubble = el('div', 'ev-msg ev-msg-fenix ev-opening-msg');
    openingBubble.appendChild(el('img', 'ev-msg-avatar', { src: 'images/fenix/1fenixavatar1.png', alt: 'Fenix' }));
    var openingContent = el('div', 'ev-msg-content');
    openingBubble.appendChild(openingContent);
    messageArea.appendChild(openingBubble);
    wrapper.appendChild(messageArea);
    typeWhenVisible(container, openingContent, openingText);

    var pillContainer = el('div', 'ev-chat-pills');
    [
      { text: 'How\'d you build this without coding?', panel: 'buildstory' },
      { text: 'Why vanilla JS?', q: 'Why did Kiran choose vanilla JS, and where would he switch to a framework?' },
      { text: 'Roast the build', panel: 'roast' }
    ].forEach(function (pill) {
      var btn = el('button', 'ev-chat-pill');
      btn.textContent = pill.text;
      btn.addEventListener('click', function () {
        fenixState.explored.pillsUsed.push(pill.panel || 'chat');
        btn.classList.add('ev-pill-used');
        if (pill.panel) { showPanel(pill.panel); return; }
        askFenix(pill.q || pill.text, pill.text);
      });
      pillContainer.appendChild(btn);
    });
    wrapper.appendChild(pillContainer);

    var inputBar = el('div', 'ev-chat-input-bar');
    var inputField = el('input', 'ev-chat-input', { type: 'text', placeholder: 'Ask about the stack, the tradeoffs, anything...' });
    var sendBtn = el('button', 'ev-chat-send', { text: '➤' });
    sendBtn.setAttribute('aria-label', 'Send message');
    function handleSend() {
      var t = inputField.value.trim(); if (!t) return;
      FC.addVisitorMessage(messageArea, t); inputField.value = '';
      FC.sendToAgent(t, messageArea);
    }
    sendBtn.addEventListener('click', handleSend);
    inputField.addEventListener('keydown', function (e) { if (e.key === 'Enter') handleSend(); });
    inputBar.appendChild(inputField); inputBar.appendChild(sendBtn);
    wrapper.appendChild(inputBar);

    container.appendChild(wrapper);
  }

  function typeWhenVisible(container, contentEl, text) {
    var zone = container.closest('.fenix-intro-zone');
    if (!zone) { contentEl.textContent = text; return; }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          obs.unobserve(zone);
          var i = 0; contentEl.textContent = ''; contentEl.classList.add('ev-msg-typing');
          (function step() {
            if (i < text.length) { contentEl.textContent += text[i++]; setTimeout(step, 20); }
            else contentEl.classList.remove('ev-msg-typing');
          })();
        }
      });
    }, { threshold: 0.1 });
    obs.observe(zone);
  }

  function buildUnlockCards(container) {
    var cardsWrap = el('div', 'ev-unlock-cards');
    cardsWrap.appendChild(el('div', 'ev-unlock-cards-header', { html: 'The internals, <span class="ev-emphasis">unlocked</span> ↘' }));

    var connected = fenixState.visitor.connected;
    var G = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
    var cards = [
      { id: 'card-buildstory', action: 'buildstory',
        icon: G + '<path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>',
        title: 'How I built this without code.', tag: 'The honest version',
        hook: 'A production AI system, shipped by a leader who directs — not types. What I decided vs. what the AI wrote.', cta: '→ See the split' },
      { id: 'card-judgment', action: 'judgment',
        icon: G + '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
        title: 'The judgment calls.', tag: 'What I decided, and why',
        hook: 'What to build, what to buy, what to kill. Challenge any of them — Fenix will defend the call.', cta: '→ Read the calls' },
      { id: 'card-problem', action: 'problem',
        icon: G + '<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg>',
        title: 'Bring me a product or AI problem.',
        tag: connected ? '45 minutes, a real problem' : 'Connect to unlock',
        hook: 'Scoping an AI feature? Stuck on build-vs-buy or adoption? Give me a sentence — get a first-pass now.',
        gateReason: connected ? null : "A real ask deserves a real name — I like to know who I\'m scoping for.",
        cta: connected ? '→ Scope it' : '→ Connect to unlock',
        locked: !connected },
      { id: 'card-roast', action: 'roast',
        icon: G + '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
        title: 'Roast the build.', tag: 'I can take it',
        hook: "Turn my own AI loose on my own architecture — the vanilla JS, the over-engineering, all of it. Honest and affectionate.", cta: '→ Let Fenix cook' }
    ];

    cards.forEach(function (card) {
      var cardEl = el('div', 'ev-unlock-card', { 'data-card': card.id });
      cardEl.setAttribute('role', 'button'); cardEl.setAttribute('tabindex', '0');
      if (card.locked) { cardEl.classList.add('ev-locked'); cardEl.appendChild(el('span', 'ev-lock-indicator', { text: '🔒' })); }
      var top = el('div', 'ev-card-top');
      top.appendChild(el('div', 'ev-card-icon', { html: card.icon }));
      var meta = el('div', 'ev-card-meta');
      meta.appendChild(el('div', 'ev-card-title', { text: card.title }));
      meta.appendChild(el('div', 'ev-card-tag', { text: card.tag }));
      top.appendChild(meta); cardEl.appendChild(top);
      cardEl.appendChild(el('div', 'ev-card-hook', { text: card.hook }));
      if (card.gateReason) cardEl.appendChild(el('div', 'ev-card-gate-reason', { text: card.gateReason }));
      cardEl.appendChild(el('div', 'ev-card-cta', { text: card.cta }));
      function open() {
        cardEl.classList.add('ev-card-visited');
        fenixState.explored.cardsClicked.push(card.id);
        if (card.locked) {
          askFenix("I'd like to bring Kiran a real product or AI problem to work through. First — who should I tell him is asking? Let's connect.", "Bring me a problem — let's connect");
          return;
        }
        showPanel(card.action);
      }
      cardEl.addEventListener('click', open);
      cardEl.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      cardsWrap.appendChild(cardEl);
    });
    container.appendChild(cardsWrap);
  }

  // Re-render the cards (called on connect so the gated card unlocks).
  function rebuildCards() {
    var leftCol = document.querySelector('.fenix-intro-left');
    if (!leftCol) return;
    leftCol.innerHTML = '';
    buildUnlockCards(leftCol);
    leftCol.querySelectorAll('.ev-unlock-card, .ev-unlock-cards-header').forEach(function (n) { n.classList.add('ev-revealed'); });
  }

  // ── Panels ────────────────────────────────────────

  function showPanel(panelType) {
    closePanel();
    var zone = document.querySelector('.fenix-intro-zone');
    if (!zone) return;
    var panel = el('div', 'ev-expanded-panel tg-panel tg-panel-' + panelType);
    if (panelType === 'buildstory') renderBuildStory(panel);
    else if (panelType === 'judgment') renderJudgment(panel);
    else if (panelType === 'problem') renderProblem(panel);
    else if (panelType === 'roast') renderRoast(panel);
    else return;
    state.currentPanel = panelType;
    zone.insertAdjacentElement('afterend', panel);
    requestAnimationFrame(function () { panel.classList.add('ev-open'); });
  }

  function closePanel() {
    var existing = document.querySelector('.ev-expanded-panel');
    if (existing) existing.parentNode.removeChild(existing);
    state.currentPanel = null;
  }

  function heading(panel, strong, rest) {
    panel.appendChild(el('div', 'ev-panel-heading', { html: '<em>Fenix:</em> <strong>' + strong + '</strong> ' + rest }));
  }

  function renderBuildStory(panel) {
    heading(panel, 'How it got built.', "Every step: what Kiran decided — and what the AI actually typed.");
    var list = el('div', 'tg-split-list');
    BUILD_STEPS.forEach(function (s) {
      var row = el('div', 'tg-split');
      var left = el('div', 'tg-split-decide');
      left.appendChild(el('span', 'tg-split-label tg-label-decide', { text: 'Kiran decided' }));
      left.appendChild(el('div', 'tg-split-text', { text: s.decide }));
      var right = el('div', 'tg-split-ai');
      right.appendChild(el('span', 'tg-split-label tg-label-ai', { text: 'AI executed' }));
      right.appendChild(el('div', 'tg-split-text', { text: s.ai }));
      row.appendChild(left); row.appendChild(right);
      list.appendChild(row);
    });
    panel.appendChild(list);
    panel.appendChild(el('div', 'tg-panel-followup', { text: "That split — judgment on the left, typing on the right — is the skill that matters now. If your team is figuring out how to build with AI, that's the conversation I want." }));
    ctaButton(panel, "Let\'s talk about building with AI", "I lead an AI/product team and want to talk with Kiran about building with AI. Help me connect.");
  }

  function renderJudgment(panel) {
    heading(panel, 'The calls.', "Five decisions that shaped the build. Disagree with one? Hit Challenge — Fenix defends it in Kiran\'s voice.");
    var list = el('div', 'tg-adr-list');
    JUDGMENT.forEach(function (a) {
      var item = el('div', 'tg-adr');
      item.appendChild(el('div', 'tg-adr-title', { text: a.title }));
      item.appendChild(el('div', 'tg-adr-why', { text: a.why }));
      var btn = el('button', 'tg-challenge', { type: 'button', text: 'Challenge this →' });
      btn.addEventListener('click', function () {
        askFenix(a.challenge, 'Challenge: ' + a.title);
        closePanel();
      });
      item.appendChild(btn);
      list.appendChild(item);
    });
    panel.appendChild(list);
  }

  function renderProblem(panel) {
    heading(panel, 'Bring me a problem.', "Scoping an AI feature, a build-vs-buy, an adoption problem — something you\'re genuinely wrestling with.");
    var body = el('div', 'tg-problem');
    body.appendChild(el('p', 'tg-problem-copy', { text: "Not a demo, not free consulting. Give me a sentence and I\'ll hand you a first-pass scope in Kiran\'s style right now — then, if it\'s useful, set up the full 45 minutes with him." }));
    var ta = el('textarea', 'tg-problem-input', { placeholder: "One sentence — what are you wrestling with?", rows: '3' });
    body.appendChild(ta);
    var scopeBtn = el('button', 'ev-btn-primary tg-problem-scope', { type: 'button', text: 'Give me a first-pass' });
    scopeBtn.addEventListener('click', function () {
      var v = ta.value.trim(); if (!v) { ta.focus(); return; }
      askFenix(
        "A visitor wants Kiran's quick take on scoping this problem: \"" + v + "\". Give a short, sharp first-pass in Kiran's style — how he'd frame it, the first two or three questions he'd ask, and where AI likely fits or doesn't. Keep it tight. Then invite them to book the full 45-minute session with Kiran.",
        "Scope this: " + v
      );
      closePanel();
    });
    body.appendChild(scopeBtn);
    panel.appendChild(body);
  }

  // ── Fun: "Roast the build" — Fenix roasts Kiran's own architecture ──
  function renderRoast(panel) {
    heading(panel, 'You asked for it.', "Kiran built this whole thing, then told me to be honest about it. Pick your angle — I\'ll keep it affectionate.");
    var row = el('div', 'tg-roast-row');
    ROAST_ANGLES.forEach(function (a) {
      var btn = el('button', 'ev-btn-secondary tg-roast-btn', { type: 'button', text: a.label });
      btn.addEventListener('click', function () {
        askFenix(a.prompt, a.display);
        closePanel();
      });
      row.appendChild(btn);
    });
    panel.appendChild(row);
    panel.appendChild(el('div', 'tg-panel-followup', { text: "Fair warning: it\'s grounded in the real build, so the jabs land." }));
  }

  function ctaButton(panel, label, agentMsg) {
    var btn = el('button', 'ev-btn-primary tg-cta', { type: 'button', text: label });
    btn.addEventListener('click', function () { askFenix(agentMsg, label); closePanel(); });
    panel.appendChild(btn);
  }

  // ── Styles ────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('tg-adapter-styles')) return;
    var css = ''
      + '.tg-split-list{display:flex;flex-direction:column;gap:14px;margin-top:14px}'
      + '.tg-split{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid rgba(203,92,114,.22);border-radius:10px;overflow:hidden}'
      + '@media(max-width:720px){.tg-split{grid-template-columns:1fr}}'
      + '.tg-split-decide{padding:13px 15px;background:rgba(203,92,114,.07)}'
      + '.tg-split-ai{padding:13px 15px;background:rgba(255,255,255,.02);border-left:1px solid rgba(203,92,114,.18)}'
      + '@media(max-width:720px){.tg-split-ai{border-left:none;border-top:1px solid rgba(203,92,114,.18)}}'
      + '.tg-split-label{display:block;font-size:.66rem;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px;font-weight:600}'
      + '.tg-label-decide{color:#cb5c72}.tg-label-ai{opacity:.5}'
      + '.tg-split-text{font-size:.88rem;line-height:1.45;opacity:.9}'
      + '.tg-adr-list{display:flex;flex-direction:column;gap:16px;margin-top:14px}'
      + '.tg-adr{border-left:2px solid #cb5c72;padding-left:14px}'
      + '.tg-adr-title{font-weight:600;margin-bottom:5px}'
      + '.tg-adr-why{font-size:.9rem;line-height:1.55;opacity:.85;margin-bottom:8px}'
      + '.tg-challenge{background:none;border:1px solid rgba(203,92,114,.4);color:#cb5c72;font-size:.78rem;padding:5px 12px;border-radius:100px;cursor:pointer;transition:all .15s}'
      + '.tg-challenge:hover{background:rgba(203,92,114,.12)}'
      + '.tg-problem{margin-top:14px}'
      + '.tg-problem-copy{font-size:.9rem;line-height:1.55;opacity:.85;margin-bottom:14px}'
      + '.tg-problem-input{width:100%;box-sizing:border-box;background:rgba(255,255,255,.03);border:1px solid rgba(203,92,114,.3);border-radius:8px;color:inherit;padding:11px 13px;font-family:inherit;font-size:.9rem;resize:vertical;margin-bottom:12px}'
      + '.tg-problem-input:focus{outline:none;border-color:#cb5c72}'
      + '.tg-roast-row{display:flex;flex-direction:column;gap:10px;margin-top:16px}'
      + '.tg-roast-btn{text-align:left;justify-content:flex-start}'
      + '.tg-cta,.tg-problem-scope{margin-top:6px}'
      + '.tg-panel-followup{margin-top:16px;font-size:.88rem;line-height:1.5;opacity:.72;font-style:italic}';
    var s = document.createElement('style'); s.id = 'tg-adapter-styles'; s.textContent = css;
    document.head.appendChild(s);
  }

  // ── Adapter ───────────────────────────────────────
  var technologistAdapter = {
    persona: 'technologist',
    accentColor: ACCENT,
    agentUrl: 'https://api.kiranrao.ai/api/v1/fenix/agent',
    messageCap: 30,
    availableTools: ['open_panel', 'close_panel', 'scroll_to_section', 'get_visitor_context', 'connect_visitor', 'collect_feedback', 'show_related_content'],
    buildUI: buildUI,
    showPanel: showPanel,
    openingMessage: FENIX_OPENING,
    onConnect: function () { rebuildCards(); },
    onPillAction: function (pill) {
      if (['buildstory', 'judgment', 'problem', 'roast'].indexOf(pill.action) !== -1) {
        // The problem card is identity-gated until connected.
        if (pill.action === 'problem' && !fenixState.visitor.connected) {
          askFenix("I'd like to bring Kiran a real product or AI problem to work through. First — who should I tell him is asking? Let's connect.", "Bring me a problem — let's connect");
          return true;
        }
        showPanel(pill.action);
        return true;
      }
      return false;
    }
  };

  window.TechnologistExperience = {
    init: function (persona) { if (persona === 'technologist') FC.init(technologistAdapter); },
    showPanel: showPanel,
    closePanel: closePanel
  };

})();
