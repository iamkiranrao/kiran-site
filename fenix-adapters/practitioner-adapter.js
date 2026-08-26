/**
 * ============================================
 * PRACTITIONER ADAPTER
 * Fenix page adapter for the Practitioner persona (product / design / data folks — "Drew Skematics").
 *
 * Audience is a PEER, not an evaluator. So: generosity + craft + real utility.
 * Four unlocks — the free ones are TOOLS they can actually use on their own work:
 *   1. overkill      — "Is AI overkill?" — describe an AI idea -> honest verdict + the cheaper path
 *   2. jtbd          — Jobs-to-Be-Done builder — describe a product -> the real job + Four Forces
 *   3. featurecreep  — fun: name a product -> 3 gloriously stupid AI bolt-ons (mocks the AI-cram trend)
 *   4. talkshop      — gated (connect to unlock): peer conversation about a real problem
 *
 * Every tool routes a STRUCTURED prompt through Fenix (grounded) — the framework does the work,
 * not a free-form opinion. No CC key, no CC dependency. Requires fenix-core.js first.
 * Hook: persona-system.js calls PractitionerExperience.init('practitioner')
 * ============================================
 */

(function () {
  'use strict';

  var FC = window.FenixCore;
  if (!FC) { console.error('PractitionerExperience requires FenixCore'); return; }
  var el = FC.el;
  var fenixState = FC.fenixState;

  var ACCENT = '#4DAF8B';

  var FENIX_OPENING = "Quick context — Kiran built this site as a working product, not a portfolio. The cards on the left aren't demos; they're real tools for your own work. Run an AI idea past the overkill check, build a Jobs-to-Be-Done map for your product, or just talk shop. Kick the tires.";

  // ── Structured prompts (the framework + Kiran's POV baked in) ──
  function overkillPrompt(v) {
    return "A visitor is sanity-checking an AI feature idea with Kiran's \"Is AI overkill?\" tool. Their idea: \"" + v + "\".\n" +
      "Answer AS Fenix in Kiran's voice — sharp, honest, and contrarian about AI hype (Kiran built a real AI product, so he's credible telling people when NOT to use AI). Be specific to THEIR idea, never generic. Use EXACTLY this structure, with markdown bold labels:\n" +
      "1. **Verdict** — pick one: ✅ AI earns its keep · ⚠️ Could work — test the cheap version first · 🛑 AI is overkill here.\n" +
      "2. **The four questions** (answer each for their idea, one crisp line): (a) Probabilistic or deterministic? — AI wins on judgment/fuzzy, rules & search win on deterministic. (b) Is there an 80% solution without AI? (c) What's the cost of being wrong? — AI + wrong = eroded trust. (d) Is the value in the outcome, or the 'AI' label?\n" +
      "3. **The cheaper path** — if it's overkill or testable, the simpler thing to try first.\n" +
      "4. **Kiran's take** — one honest line.\nKeep it tight.";
  }
  function jtbdPrompt(v) {
    return "A visitor is using Kiran's Jobs-to-Be-Done builder. Their product: \"" + v + "\".\n" +
      "Answer AS Fenix in Kiran's voice. Build a real, non-obvious JTBD artifact for THEIR product — rigorous, not generic. Use EXACTLY this structure with markdown bold labels:\n" +
      "1. **The core job** — write it as: \"When [situation], they want to [motivation], so they can [outcome].\"\n" +
      "2. **Emotional + social jobs** — how they want to feel, and how they want to be seen.\n" +
      "3. **The struggling moment** — the specific moment that makes them look for something new.\n" +
      "4. **The Four Forces** — Push (the pain now) · Pull (your product's draw) · Anxiety (fear of switching) · Habit (what keeps them stuck). One line each.\n" +
      "5. **What they're really firing** — the current workaround that is your true competition (often not who they'd guess).\n" +
      "6. **The trap** — the most common way teams get this job wrong.\nBe specific to their product.";
  }
  function featurecreepPrompt(v) {
    var thing = v ? "\"" + v + "\"" : "a well-known product of your choice (pick something recognizable)";
    return "A visitor is playing Kiran's \"Feature Creep\" — a joke tool. Take " + thing + " and bolt on THREE gloriously stupid, over-engineered AI features nobody asked for, each with a straight-faced fake-PM justification. Answer AS Fenix, genuinely funny, mocking the 2026 'cram AI into everything' trend. Number them 1–3, each: a ridiculous **Feature name** + a one-line deadpan rationale. End with a wink that the best AI feature is usually the one you didn't build.";
  }
  function talkshopPrompt(v) {
    return "A visitor (a fellow product/design/data person, already connected) wants to talk shop with Kiran about: \"" + v + "\". Answer AS Fenix in Kiran's voice — peer to peer, not a pitch. Give a sharp first-pass: how Kiran would frame it, the first question or two he'd ask, and one non-obvious angle. Then offer to set up a real conversation with him.";
  }

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
    if (zone) zone.classList.add('pr-zone');
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
      html: 'MEET FENIX — <span class="ev-fenix-tagline">real tools, or just talk shop ↘</span>'
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
      ? 'Welcome back, ' + firstName + '. The tools on the left are yours to use — or ask me anything about product.'
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
      { text: 'Is my AI idea overkill?', panel: 'overkill' },
      { text: 'Build a Job-to-be-Done', panel: 'jtbd' },
      { text: 'How does Kiran think about product?', q: 'How does Kiran think about product? Give me his sharpest, most contrarian principles.' }
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
    var inputField = el('input', 'ev-chat-input', { type: 'text', placeholder: 'Ask me anything about product...' });
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
            if (i < text.length) { contentEl.textContent += text[i++]; setTimeout(step, 18); }
            else contentEl.classList.remove('ev-msg-typing');
          })();
        }
      });
    }, { threshold: 0.1 });
    obs.observe(zone);
  }

  function buildUnlockCards(container) {
    var cardsWrap = el('div', 'ev-unlock-cards');
    cardsWrap.appendChild(el('div', 'ev-unlock-cards-header', { html: 'Real tools, <span class="ev-emphasis">for your work</span> ↘' }));

    var connected = fenixState.visitor.connected;
    var G = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
    var cards = [
      { id: 'card-overkill', action: 'overkill',
        icon: G + '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>',
        title: 'Is AI overkill?', tag: 'A gut-check tool',
        hook: "Describe an AI feature you're weighing. I'll tell you if AI earns its keep — or if you're cramming it where a simpler answer wins.", cta: '→ Check my idea' },
      { id: 'card-jtbd', action: 'jtbd',
        icon: G + '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
        title: 'Jobs-to-Be-Done builder', tag: 'A real framework, applied',
        hook: "Tell me your product. I'll build the actual job it's hired to do — the forces, the struggling moment, the competition you didn't see.", cta: '→ Build the job' },
      { id: 'card-featurecreep', action: 'featurecreep',
        icon: G + '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0Z"/></svg>',
        title: 'Feature Creep', tag: "For the record, it's a joke",
        hook: "Name a product. I'll bolt on three gloriously stupid AI features nobody asked for — because 2026.", cta: '→ Creep it' },
      { id: 'card-talkshop', action: 'talkshop',
        icon: G + '<path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2Z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/></svg>',
        title: 'Talk shop.',
        tag: connected ? 'Peer to peer' : 'Connect to unlock',
        hook: "Bring a real problem you're chewing on — a roadmap, positioning, a call you're stuck on — and we think it through as peers.",
        gateReason: connected ? null : "Peers trade names before they trade problems — who am I talking to?",
        cta: connected ? "→ Let's get into it" : '→ Connect to unlock',
        locked: !connected }
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
          askFenix("I'd like to talk shop with Kiran about a real product problem — peer to peer. First, who should I tell him is asking? Let's connect.", "Talk shop — let's connect");
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
    var panel = el('div', 'ev-expanded-panel pr-panel pr-panel-' + panelType);

    if (panelType === 'overkill') {
      toolPanel(panel, {
        strong: 'Is AI overkill?', rest: "Describe the AI feature you're weighing. I'll give you a verdict, not a vibe.",
        placeholder: "e.g. 'An AI chatbot to help users find the right pricing plan.'",
        examples: ["An AI that writes users' meeting notes", "AI to auto-tag support tickets", "An AI onboarding assistant"],
        button: 'Check my idea', promptFn: overkillPrompt, displayFn: function (v) { return 'Is AI overkill? ' + v; },
        artifact: true, tool: 'overkill', kicker: 'AI Gut-Check', artifactTitle: 'Is AI overkill?'
      });
    } else if (panelType === 'jtbd') {
      toolPanel(panel, {
        strong: 'Jobs-to-Be-Done builder.', rest: "Tell me your product and who uses it — I'll build the real job it's hired to do.",
        placeholder: "e.g. 'A meal-kit subscription for busy parents.'",
        examples: ["A time-tracking app for freelancers", "A budgeting app for couples", "A note-taking app for researchers"],
        button: 'Build the job', promptFn: jtbdPrompt, displayFn: function (v) { return 'JTBD for: ' + v; },
        artifact: true, tool: 'jtbd', kicker: 'Jobs-to-Be-Done', artifactTitle: 'Your Jobs-to-Be-Done'
      });
    } else if (panelType === 'featurecreep') {
      toolPanel(panel, {
        strong: 'Feature Creep.', rest: "Name a product — or leave it blank and I'll pick one. Then watch me ruin it with AI.",
        placeholder: "e.g. 'a toaster' — or leave blank for a surprise",
        allowEmpty: true, examples: ["a toaster", "Google Calendar", "a parking meter"],
        button: 'Creep it', promptFn: featurecreepPrompt, displayFn: function (v) { return v ? 'Feature-creep: ' + v : 'Feature-creep something random'; },
        artifact: true, tool: 'featurecreep', kicker: 'Feature Creep', artifactTitle: 'Feature Creep'
      });
    } else if (panelType === 'talkshop') {
      toolPanel(panel, {
        strong: 'Talk shop.', rest: "What are you chewing on? A roadmap call, positioning, a decision you're stuck on.",
        placeholder: "The problem you're wrestling with, in a sentence or two.",
        button: "Think it through", promptFn: talkshopPrompt, displayFn: function (v) { return 'Talk shop: ' + v; }
      });
    } else { return; }

    state.currentPanel = panelType;
    zone.insertAdjacentElement('afterend', panel);
    requestAnimationFrame(function () { panel.classList.add('ev-open'); });
  }

  function closePanel() {
    var existing = document.querySelector('.ev-expanded-panel');
    if (existing) existing.parentNode.removeChild(existing);
    state.currentPanel = null;
  }

  function toolPanel(panel, cfg) {
    panel.appendChild(el('div', 'ev-panel-heading', { html: '<em>Fenix:</em> <strong>' + cfg.strong + '</strong> ' + cfg.rest }));
    var body = el('div', 'pr-tool');
    var ta = el('textarea', 'pr-tool-input', { placeholder: cfg.placeholder, rows: '3' });
    body.appendChild(ta);
    if (cfg.examples) {
      var row = el('div', 'pr-tool-examples');
      row.appendChild(el('span', 'pr-tool-examples-label', { text: 'Try:' }));
      cfg.examples.forEach(function (ex) {
        var chip = el('button', 'pr-tool-chip', { type: 'button', text: ex });
        chip.addEventListener('click', function () { ta.value = ex; ta.focus(); });
        row.appendChild(chip);
      });
      body.appendChild(row);
    }
    var btn = el('button', 'ev-btn-primary pr-tool-btn', { type: 'button', text: cfg.button });
    btn.addEventListener('click', function () {
      var v = ta.value.trim();
      if (!v && !cfg.allowEmpty) { ta.focus(); return; }
      closePanel();
      if (cfg.artifact && window.FenixArtifact) {
        window.FenixArtifact.run({ kicker: cfg.kicker, title: cfg.artifactTitle, input: v, persona: 'practitioner', accent: ACCENT, tool: cfg.tool, prompt: cfg.promptFn(v) });
      } else {
        askFenix(cfg.promptFn(v), cfg.displayFn(v));
      }
    });
    body.appendChild(btn);
    panel.appendChild(body);
  }

  // ── Styles ────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('pr-adapter-styles')) return;
    var css = ''
      + '.pr-tool{margin-top:14px}'
      + '.pr-tool-input{width:100%;box-sizing:border-box;background:rgba(255,255,255,.03);border:1px solid rgba(77,175,139,.32);border-radius:8px;color:inherit;padding:11px 13px;font-family:inherit;font-size:.92rem;line-height:1.5;resize:vertical;margin-bottom:10px}'
      + '.pr-tool-input:focus{outline:none;border-color:#4DAF8B}'
      + '.pr-tool-examples{display:flex;align-items:center;flex-wrap:wrap;gap:7px;margin-bottom:14px}'
      + '.pr-tool-examples-label{font-size:.75rem;opacity:.55;margin-right:2px}'
      + '.pr-tool-chip{background:rgba(77,175,139,.08);border:1px solid rgba(77,175,139,.25);color:inherit;opacity:.85;font-size:.76rem;padding:4px 10px;border-radius:100px;cursor:pointer;transition:all .15s}'
      + '.pr-tool-chip:hover{opacity:1;background:rgba(77,175,139,.16)}'
      + '.pr-tool-btn{margin-top:2px}';
    var s = document.createElement('style'); s.id = 'pr-adapter-styles'; s.textContent = css;
    document.head.appendChild(s);
  }

  // ── Adapter ───────────────────────────────────────
  var practitionerAdapter = {
    persona: 'practitioner',
    accentColor: ACCENT,
    agentUrl: 'https://api.kiranrao.ai/api/v1/fenix/agent',
    messageCap: 30,
    availableTools: ['open_panel', 'close_panel', 'scroll_to_section', 'get_visitor_context', 'connect_visitor', 'collect_feedback', 'show_related_content'],
    buildUI: buildUI,
    showPanel: showPanel,
    openingMessage: FENIX_OPENING,
    onConnect: function () { rebuildCards(); },
    onPillAction: function (pill) {
      if (['overkill', 'jtbd', 'featurecreep', 'talkshop'].indexOf(pill.action) !== -1) {
        if (pill.action === 'talkshop' && !fenixState.visitor.connected) {
          askFenix("I'd like to talk shop with Kiran about a real product problem — peer to peer. First, who should I tell him is asking? Let's connect.", "Talk shop — let's connect");
          return true;
        }
        showPanel(pill.action);
        return true;
      }
      return false;
    }
  };

  window.PractitionerExperience = {
    init: function (persona) { if (persona === 'practitioner') FC.init(practitionerAdapter); },
    showPanel: showPanel,
    closePanel: closePanel
  };

})();
