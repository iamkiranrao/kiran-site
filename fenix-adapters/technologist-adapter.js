/**
 * ============================================
 * TECHNOLOGIST ADAPTER
 * Fenix page adapter for the Technologist persona (CTO / AI Lead / Tech Lead — "Ray Turing").
 * Hero-depth: three panels — GitHub Tour, Architecture Decision Records, Pair With Me.
 *
 * Content is sourced from the REAL stack behind this site. Panels are static (no backend
 * call, no API key in client code) — the only network path is Fenix chat via FenixCore.
 *
 * Requires: fenix-core.js loaded first.
 * Hook: persona-system.js calls TechnologistExperience.init('technologist')
 * ============================================
 */

(function () {
  'use strict';

  var FC = window.FenixCore;
  if (!FC) {
    console.error('TechnologistExperience requires FenixCore');
    return;
  }
  var el = FC.el;
  var fenixState = FC.fenixState;

  // ── Technologist-specific content ─────────────────

  var FENIX_OPENING = "Straight to it. Kiran built this whole site — the persona system, the agent you're talking to, the RAG pipeline underneath — not by writing every line, but by making every call: the stack, the tradeoffs, the abstractions. The three cards on the left are the actual internals. Pop the hood.";

  // The real repos behind the site.
  var REPOS = [
    {
      name: 'fenix-backend',
      tag: 'The brain',
      desc: "FastAPI on Vercel. The agentic Fenix endpoint: a tool-use loop over 10 tools, SSE streaming, and RAG over ~500 embeddings (Voyage → Supabase pgvector → Claude). Single-source model config with a live drift canary."
    },
    {
      name: 'kiran-site',
      tag: 'What you\'re looking at',
      desc: "Vanilla HTML/CSS/JS — no framework, no build step. A persona picker that morphs the whole homepage, a fenix-core module, and per-persona adapters (this file is one). Edit → git push → Cloudflare deploys."
    },
    {
      name: 'command-center',
      tag: 'The private ops layer',
      desc: "Next.js + Python dashboard (~22 routers) that runs the portfolio: teardown builder, content pipeline, resume tooling, and the Fenix training bank that grounds these answers."
    },
    {
      name: 'resume-customizer',
      tag: 'A tool, not a toy',
      desc: "JD in → a tailored resume, cover letter, match score, and company brief out, with quality gates that score against the real role. Kiran is its first customer."
    }
  ];

  // Real architecture decisions — judgment, not tool-use.
  var ADRS = [
    {
      title: 'Vanilla JS, no framework, no build',
      why: "A portfolio should outlive a framework's hype cycle. Zero build means edit-and-ship and nothing to rot. The constraint forced a clean module architecture — fenix-core plus swappable adapters — instead of a component sprawl.",
      trade: "More done by hand; nothing done by magic."
    },
    {
      title: 'Supabase + pgvector for RAG (not a separate vector DB)',
      why: "One managed Postgres with native vector search beats stitching a bespoke vector store to a relational one. Voyage for embeddings, pgvector for nearest-neighbor, done.",
      trade: "Free-tier projects pause when idle — learned that one in production, added a health canary so it can't fail silently again."
    },
    {
      title: 'Serverless FastAPI for the agent',
      why: "Python where the AI ecosystem lives, auto-deploy from git, scales to zero, costs almost nothing at this traffic.",
      trade: "Stateless by default — conversation state lives client-side, persistence is a deliberate later step, not an accident."
    },
    {
      title: 'An agentic tool-registry, not hardcoded flows',
      why: "Every capability is just a tool in a registry the agent can call, filtered per persona. Adding a feature means adding a tool — not forking the endpoint. It's why this persona and the Evaluator share one backend.",
      trade: "More upfront design; far less duplication downstream."
    },
    {
      title: 'Model config as a single source of truth + a canary',
      why: "A retired model once took the whole agent down silently. Now the model id lives in one env var and a live /health/llm check pings it — a retirement pages you the day it happens, not months later.",
      trade: "A little plumbing to never eat that outage twice."
    }
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
    [
      '.ev-unlock-cards-header', '.ev-unlock-card', '.ev-fenix-col-header',
      '.ev-fenix-chat', '.ev-chat-header', '.ev-chat-messages',
      '.ev-chat-pills', '.ev-chat-input-bar', '.ev-msg'
    ].forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (n) { n.classList.add('ev-revealed'); });
    });
  }

  function buildFenixColumn(container) {
    var isConnected = fenixState.visitor.connected;
    var firstName = isConnected && fenixState.visitor.name ? fenixState.visitor.name.split(' ')[0] : '';

    var colHeader = el('div', 'ev-fenix-col-header', {
      html: 'MEET FENIX — <span class="ev-fenix-tagline">ask it how any of this was built ↘</span>'
    });
    container.appendChild(colHeader);

    var wrapper = el('div', 'ev-fenix-chat');

    var chatHeader = el('div', 'ev-chat-header');
    chatHeader.appendChild(el('img', 'ev-chat-avatar', { src: 'images/fenix/1fenixavatar1.png', alt: 'Fenix' }));
    var headerInfo = el('div', 'ev-chat-header-info');
    headerInfo.appendChild(el('span', 'ev-chat-header-name', { text: 'Fenix' }));
    var dot = el('span', 'ev-status-dot ev-status-dot--ready');
    dot.setAttribute('title', 'Ready');
    headerInfo.appendChild(dot);
    chatHeader.appendChild(headerInfo);
    wrapper.appendChild(chatHeader);

    var messageArea = el('div', 'ev-chat-messages');
    var openingText = (isConnected && firstName)
      ? 'Welcome back, ' + firstName + '. The three cards on the left are the real internals — or ask me anything about the stack.'
      : FENIX_OPENING;

    var openingBubble = el('div', 'ev-msg ev-msg-fenix ev-opening-msg');
    openingBubble.appendChild(el('img', 'ev-msg-avatar', { src: 'images/fenix/1fenixavatar1.png', alt: 'Fenix' }));
    var openingContent = el('div', 'ev-msg-content');
    openingBubble.appendChild(openingContent);
    messageArea.appendChild(openingBubble);
    wrapper.appendChild(messageArea);

    typeWhenVisible(container, openingContent, openingText);

    // Pills — technologist-flavored
    var pillContainer = el('div', 'ev-chat-pills');
    [
      { text: 'Why vanilla JS in 2026?', action: 'adr' },
      { text: 'How does the RAG pipeline work?', action: 'chat', q: 'How does the RAG pipeline behind this site work?' },
      { text: 'Show me the repos', action: 'github' }
    ].forEach(function (pill) {
      var btn = el('button', 'ev-chat-pill');
      btn.textContent = pill.text;
      btn.addEventListener('click', function () {
        var msgArea = document.querySelector('.ev-chat-messages');
        if (!msgArea) return;
        FC.addVisitorMessage(msgArea, pill.text);
        fenixState.explored.pillsUsed.push(pill.action);
        btn.classList.add('ev-pill-used');
        if (pill.action === 'adr') { showPanel('adr'); return; }
        if (pill.action === 'github') { showPanel('github'); return; }
        FC.sendToAgent(pill.q || pill.text, msgArea);
      });
      pillContainer.appendChild(btn);
    });
    wrapper.appendChild(pillContainer);

    var inputBar = el('div', 'ev-chat-input-bar');
    var inputField = el('input', 'ev-chat-input', { type: 'text', placeholder: 'Ask about the stack, the tradeoffs, anything...' });
    var sendBtn = el('button', 'ev-chat-send', { text: '➤' });
    sendBtn.setAttribute('aria-label', 'Send message');
    function handleSend() {
      var text = inputField.value.trim();
      if (!text) return;
      FC.addVisitorMessage(messageArea, text);
      inputField.value = '';
      FC.sendToAgent(text, messageArea);
    }
    sendBtn.addEventListener('click', handleSend);
    inputField.addEventListener('keydown', function (e) { if (e.key === 'Enter') handleSend(); });
    inputBar.appendChild(inputField);
    inputBar.appendChild(sendBtn);
    wrapper.appendChild(inputBar);

    container.appendChild(wrapper);
  }

  function typeWhenVisible(container, contentEl, text) {
    var introZone = container.closest('.fenix-intro-zone');
    if (!introZone) { contentEl.textContent = text; return; }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          observer.unobserve(introZone);
          var i = 0;
          contentEl.textContent = '';
          contentEl.classList.add('ev-msg-typing');
          (function step() {
            if (i < text.length) { contentEl.textContent += text[i++]; setTimeout(step, 22); }
            else { contentEl.classList.remove('ev-msg-typing'); }
          })();
        }
      });
    }, { threshold: 0.1 });
    observer.observe(introZone);
  }

  function buildUnlockCards(container) {
    var cardsWrap = el('div', 'ev-unlock-cards');
    cardsWrap.appendChild(el('div', 'ev-unlock-cards-header', {
      html: 'The internals, <span class="ev-emphasis">unlocked</span> ↘'
    }));

    var cards = [
      {
        id: 'card-github', action: 'github',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>',
        title: 'The GitHub tour.', tag: 'Four real repos',
        hook: 'The actual codebase behind this site — the agent, the frontend, the ops layer.',
        cta: '→ Walk the repos'
      },
      {
        id: 'card-adr', action: 'adr',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
        title: 'Architecture decisions.', tag: 'The why behind the how',
        hook: 'Why vanilla JS, why pgvector, why serverless — the calls that held up, and their tradeoffs.',
        cta: '→ Read the ADRs'
      },
      {
        id: 'card-pair', action: 'pair',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
        title: 'Pair with me.', tag: '45 minutes, a real problem',
        hook: 'Bring an architecture or AI-integration problem. We whiteboard it together.',
        cta: '→ Set it up'
      }
    ];

    cards.forEach(function (card) {
      var cardEl = el('div', 'ev-unlock-card', { 'data-card': card.id });
      cardEl.setAttribute('role', 'button');
      cardEl.setAttribute('tabindex', '0');

      var top = el('div', 'ev-card-top');
      top.appendChild(el('div', 'ev-card-icon', { html: card.icon }));
      var meta = el('div', 'ev-card-meta');
      meta.appendChild(el('div', 'ev-card-title', { text: card.title }));
      meta.appendChild(el('div', 'ev-card-tag', { text: card.tag }));
      top.appendChild(meta);
      cardEl.appendChild(top);
      cardEl.appendChild(el('div', 'ev-card-hook', { text: card.hook }));
      cardEl.appendChild(el('div', 'ev-card-cta', { text: card.cta }));

      function open() {
        cardEl.classList.add('ev-card-visited');
        fenixState.explored.cardsClicked.push(card.id);
        showPanel(card.action);
      }
      cardEl.addEventListener('click', open);
      cardEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
      cardsWrap.appendChild(cardEl);
    });

    container.appendChild(cardsWrap);
  }

  // ── Panels ────────────────────────────────────────

  function showPanel(panelType) {
    closePanel();
    var zone = document.querySelector('.fenix-intro-zone');
    if (!zone) return;
    var panel = el('div', 'ev-expanded-panel tg-panel tg-panel-' + panelType);

    if (panelType === 'github') renderGithub(panel);
    else if (panelType === 'adr') renderAdr(panel);
    else if (panelType === 'pair') renderPair(panel);
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

  function panelHeading(panel, emphasis, rest) {
    panel.appendChild(el('div', 'ev-panel-heading', {
      html: '<em>Fenix:</em> <strong>' + emphasis + '</strong> ' + rest
    }));
  }

  function renderGithub(panel) {
    panelHeading(panel, 'The repos.', 'Four codebases, one system. (They\'re private — this is the annotated map.)');
    var grid = el('div', 'tg-repo-grid');
    REPOS.forEach(function (r) {
      var card = el('div', 'tg-repo');
      var head = el('div', 'tg-repo-head');
      head.appendChild(el('span', 'tg-repo-name', { text: r.name }));
      head.appendChild(el('span', 'tg-repo-tag', { text: r.tag }));
      card.appendChild(head);
      card.appendChild(el('div', 'tg-repo-desc', { text: r.desc }));
      grid.appendChild(card);
    });
    panel.appendChild(grid);
    panelFollowup(panel, 'Want the deep version of any of these? Ask Fenix — it can walk you through the RAG flow, the tool loop, or the persona system.');
  }

  function renderAdr(panel) {
    panelHeading(panel, 'The decisions.', 'Five calls that shaped the build — and what each one cost.');
    var list = el('div', 'tg-adr-list');
    ADRS.forEach(function (a) {
      var item = el('div', 'tg-adr');
      item.appendChild(el('div', 'tg-adr-title', { text: a.title }));
      item.appendChild(el('div', 'tg-adr-why', { text: a.why }));
      var trade = el('div', 'tg-adr-trade');
      trade.appendChild(el('span', 'tg-adr-trade-label', { text: 'Tradeoff: ' }));
      trade.appendChild(document.createTextNode(a.trade));
      item.appendChild(trade);
      list.appendChild(item);
    });
    panel.appendChild(list);
    panelFollowup(panel, 'Disagree with a call, or want the reasoning in more depth? That\'s exactly the kind of thing to ask Fenix — or to bring to a pairing session.');
  }

  function renderPair(panel) {
    panelHeading(panel, 'Pair with me.', '45 minutes on a real problem — architecture, AI integration, or a product call you\'re wrestling with.');
    var body = el('div', 'tg-pair');
    body.appendChild(el('p', 'tg-pair-copy', { text: "Not a sales call and not a demo. Bring something you\'re genuinely stuck on — a system design, an AI feature you\'re scoping, a build-vs-buy — and we work it live. You leave with a sharper plan; I get an interesting problem." }));
    var btn = el('button', 'ev-btn-primary tg-pair-cta', { type: 'button', text: 'Let\'s set it up' });
    btn.addEventListener('click', function () {
      var msgArea = document.querySelector('.ev-chat-messages');
      if (msgArea) {
        FC.addVisitorMessage(msgArea, "I'd like to set up a pairing session.");
        FC.sendToAgent("I'd like to set up a 45-minute technical pairing session with Kiran. Help me connect.", msgArea);
      }
      closePanel();
    });
    body.appendChild(btn);
    panel.appendChild(body);
  }

  function panelFollowup(panel, text) {
    panel.appendChild(el('div', 'tg-panel-followup', { text: text }));
  }

  // ── Self-contained styles (so the panels don't depend on unverified CSS) ──
  function injectStyles() {
    if (document.getElementById('tg-adapter-styles')) return;
    var css = ''
      + '.tg-repo-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}'
      + '@media(max-width:720px){.tg-repo-grid{grid-template-columns:1fr}}'
      + '.tg-repo{border:1px solid rgba(203,92,114,.28);border-radius:10px;padding:14px 16px;background:rgba(203,92,114,.05)}'
      + '.tg-repo-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:6px;flex-wrap:wrap}'
      + '.tg-repo-name{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:600;color:#cb5c72}'
      + '.tg-repo-tag{font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;opacity:.6}'
      + '.tg-repo-desc{font-size:.9rem;line-height:1.5;opacity:.85}'
      + '.tg-adr-list{display:flex;flex-direction:column;gap:16px;margin-top:14px}'
      + '.tg-adr{border-left:2px solid #cb5c72;padding-left:14px}'
      + '.tg-adr-title{font-weight:600;margin-bottom:5px}'
      + '.tg-adr-why{font-size:.9rem;line-height:1.55;opacity:.85;margin-bottom:5px}'
      + '.tg-adr-trade{font-size:.85rem;opacity:.7}'
      + '.tg-adr-trade-label{color:#cb5c72;font-weight:600}'
      + '.tg-pair{margin-top:14px}'
      + '.tg-pair-copy{font-size:.92rem;line-height:1.6;opacity:.88;margin-bottom:16px}'
      + '.tg-panel-followup{margin-top:16px;font-size:.85rem;opacity:.65;font-style:italic}';
    var style = document.createElement('style');
    style.id = 'tg-adapter-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ── Adapter definition ────────────────────────────

  var technologistAdapter = {
    persona: 'technologist',
    accentColor: '#cb5c72',
    agentUrl: 'https://api.kiranrao.ai/api/v1/fenix/agent',
    messageCap: 30,
    availableTools: ['open_panel', 'close_panel', 'scroll_to_section', 'get_visitor_context', 'connect_visitor', 'collect_feedback', 'show_related_content'],
    buildUI: buildUI,
    showPanel: showPanel,
    openingMessage: FENIX_OPENING,
    onPillAction: function (pill) {
      if (pill.action === 'adr' || pill.action === 'github' || pill.action === 'pair') {
        showPanel(pill.action);
        return true;
      }
      return false;
    }
  };

  window.TechnologistExperience = {
    init: function (persona) {
      if (persona === 'technologist') {
        FC.init(technologistAdapter);
      }
    },
    showPanel: showPanel,
    closePanel: closePanel
  };

})();
