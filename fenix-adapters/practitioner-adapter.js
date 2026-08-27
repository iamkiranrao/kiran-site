/**
 * ============================================
 * PRACTITIONER ADAPTER
 * Fenix page adapter for the Practitioner persona (product / design / data folks — "Drew Skematics").
 *
 * Audience is a PEER, not an evaluator. So: generosity + craft + real utility.
 * Five unlocks — the tool cards run in the chat; The Trade opens its own experience:
 *   1. overkill      — "Is AI overkill?" — describe an AI idea -> honest verdict + the cheaper path
 *   2. jtbd          — Jobs-to-Be-Done builder — describe a product -> the real job + Four Forces
 *   3. journey       — Map the journey — a flow -> the customer's emotion curve + per-step insight
 *   4. featurecreep  — fun: name a product -> 3 gloriously stupid AI bolt-ons (mocks the AI-cram trend)
 *   5. trade         — "Trade me a door" — the card-trading experience (fenix-trade.js): peer-to-peer
 *                      contact swap, double-opt-in. Connecting is the price of a trade.
 *
 * Tool cards route a STRUCTURED prompt through Fenix (grounded) — the framework does the work.
 * The Trade is handled by window.FenixTrade.open(). Requires fenix-core.js first.
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

  var FENIX_OPENING = "Quick context — Kiran built this site as a working product, not a portfolio. The cards on the left aren't demos; they're real tools for your own work. Run an AI idea past the overkill check, build a Jobs-to-Be-Done map, map a customer journey — or trade a door from Kiran's network. Kick the tires.";

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
      "4. **The Four Forces** — each on its OWN bullet, labeled exactly as below, 4–9 words each:\n" +
      "- **Push:** the pain in their current situation\n" +
      "- **Pull:** what draws them to this product\n" +
      "- **Anxiety:** their fear or doubt about switching\n" +
      "- **Habit:** what keeps them stuck with the old way\n" +
      "5. **What they're really firing** — the current workaround that is your true competition (often not who they'd guess).\n" +
      "6. **The trap** — the most common way teams get this job wrong.\nBe specific to their product.";
  }
  function journeyPrompt(v) {
    return "A visitor is using Kiran's \"Map the journey\" tool. Their product or flow: \"" + v + "\". Answer AS Fenix in Kiran's voice. Map the customer's EMOTIONAL journey through this flow as 4–6 key steps in order. First, ONE short sentence framing the journey. Then output the steps in EXACTLY this machine-readable format — one per line, nothing else on the line, no extra prose after:\n" +
      "STEPS:\n" +
      "- <2-4 word step name> :: <positive|neutral|negative> :: <Pain|Gain|Job> :: <one short first-person insight, max 10 words>\n" +
      "Repeat for each step, in order. Make the arc realistic — most journeys dip at a friction or anxiety point and recover. Use 'positive' for delight, 'neutral' for indifference, 'negative' for friction/anxiety. Keep step names short.";
  }
  function featurecreepPrompt(v) {
    var thing = v ? "\"" + v + "\"" : "a well-known product of your choice (pick something recognizable)";
    return "A visitor is playing Kiran's \"Feature Creep\" — a joke tool. Take " + thing + " and bolt on THREE gloriously stupid, over-engineered AI features nobody asked for, each with a straight-faced fake-PM justification. Answer AS Fenix, genuinely funny, mocking the 2026 'cram AI into everything' trend. Number them 1–3, each: a ridiculous **Feature name** + a one-line deadpan rationale. End with a wink that the best AI feature is usually the one you didn't build.";
  }
  var state = { currentPanel: null, msgArea: null, input: null };

  // ── In-chat tool flow ─────────────────────────────
  // Each tool: Fenix asks its question in the chat, the visitor answers inline,
  // Fenix thinks in the chat, and the one-pager pops only when it's ready.
  var TOOLS = {
    overkill: {
      ask: "Describe the AI feature you're weighing — a sentence or two. I'll tell you if AI earns its keep, or if a simpler answer wins.",
      placeholder: "e.g. an AI chatbot to help users pick a pricing plan",
      thinkingLabel: 'Running the gut-check…',
      kicker: 'AI Gut-Check', artifactTitle: 'Is AI overkill?', tool: 'overkill',
      promptFn: overkillPrompt
    },
    jtbd: {
      ask: "Tell me your product and who it's for. I'll build the real job it's hired to do — forces, struggling moment, and the competition you didn't see.",
      placeholder: "e.g. a meal-kit subscription for busy parents",
      thinkingLabel: 'Building the job…',
      kicker: 'Jobs-to-Be-Done', artifactTitle: 'Your Jobs-to-Be-Done', tool: 'jtbd',
      promptFn: jtbdPrompt
    },
    journey: {
      ask: "Name a product and a flow — where does the customer start, where do they end? I'll map the emotional arc, high to low.",
      placeholder: "e.g. onboarding for a mobile banking app",
      thinkingLabel: 'Mapping the journey…',
      kicker: 'Customer Journey', artifactTitle: 'The Emotional Journey', tool: 'journey',
      promptFn: journeyPrompt
    },
    featurecreep: {
      ask: "Name a product — anything. Or type “surprise me” and I'll pick one. Then watch me ruin it with AI nobody asked for.",
      placeholder: "e.g. a toaster — or “surprise me”",
      allowEmpty: true, thinkingLabel: 'Cramming in AI nobody asked for…',
      kicker: 'Feature Creep', artifactTitle: 'Feature Creep', tool: 'featurecreep',
      promptFn: featurecreepPrompt,
      displayFn: function (v) { return v || 'Surprise me'; }
    }
  };

  // Left-card titles — flown across to the chat as the throughline.
  var TOOL_TITLES = {
    overkill: 'Is AI overkill?', jtbd: 'Jobs-to-Be-Done builder',
    journey: 'Map the journey', featurecreep: 'Feature Creep'
  };

  var pendingTool = null;

  function getMsgArea() { return state.msgArea || document.querySelector('.ev-chat-messages'); }

  // Step 1: (optionally) fly the clicked card across, then Fenix asks the
  // tool's question in the chat and arms the input. cardEl is present only on a
  // left-column card click — pills already live on the right, so they skip the fly.
  function startTool(action, cardEl) {
    var t = TOOLS[action];
    if (!t) return;
    var msgArea = getMsgArea();
    if (!msgArea) return;

    var proceed = function () {
      if (cardEl) FC.addLandedMessage(msgArea, TOOL_TITLES[action] || t.ask);
      FC.addFenixMessage(msgArea, t.ask);
      pendingTool = { action: action, cfg: t };
      if (state.input) { state.input.placeholder = t.placeholder || 'Type your answer…'; state.input.focus(); }
      var chat = document.querySelector('.ev-fenix-chat');
      if (chat) chat.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    if (cardEl) FC.flyCardToChat({ cardEl: cardEl, title: TOOL_TITLES[action] || t.ask, messageArea: msgArea, accent: ACCENT, onLand: proceed });
    else proceed();
  }

  // Step 2: the visitor's inline answer runs the tool.
  function submitTool(value) {
    var pt = pendingTool; pendingTool = null;
    if (state.input) state.input.placeholder = 'Ask me anything about product...';
    if (!pt) return;
    var t = pt.cfg, msgArea = getMsgArea();
    var display = (t.displayFn ? t.displayFn(value) : value) || '';
    FC.runTool({
      messageArea: msgArea, persona: 'practitioner', accent: ACCENT, tool: t.tool,
      kicker: t.kicker, artifactTitle: t.artifactTitle, input: display,
      prompt: t.promptFn(value), thinkingLabel: t.thinkingLabel,
      nextPrompt: 'Want to keep going?', nextActions: nextActionsFor(pt.action)
    });
  }

  // JTBD and journey are complementary lenses (the why vs. the experience),
  // so each one's top next-action leads to the other.
  var PAIR = {
    jtbd: { action: 'journey', label: 'Now map the journey →' },
    journey: { action: 'jtbd', label: 'Build the Job-to-be-Done →' }
  };

  function nextActionsFor(justRan) {
    var all = [
      { action: 'overkill', label: 'Gut-check an AI idea' },
      { action: 'jtbd', label: 'Build a Job-to-be-Done' },
      { action: 'journey', label: 'Map a journey' },
      { action: 'featurecreep', label: 'Feature Creep (for fun)' }
    ];
    var picks = [];
    if (PAIR[justRan]) picks.push(PAIR[justRan]);   // lead with the paired tool
    all.forEach(function (a) {
      if (picks.length >= 2 || a.action === justRan) return;
      if (picks.some(function (p) { return p.action === a.action; })) return;
      picks.push(a);
    });
    picks.push({ action: 'trade', label: 'Trade a door with Kiran' });
    return picks.map(function (a) {
      return { label: a.label, run: function () {
        if (a.action === 'trade') { if (window.FenixTrade) window.FenixTrade.open(); return; }
        startTool(a.action);
      } };
    });
  }

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
      html: 'MEET FENIX — <span class="ev-fenix-tagline">real tools, and a door worth trading ↘</span>'
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
      { text: 'Is my AI idea overkill?', action: 'overkill' },
      { text: 'Build a Job-to-be-Done', action: 'jtbd' },
      { text: 'How does Kiran think about product?', q: 'How does Kiran think about product? Give me his sharpest, most contrarian principles.' }
    ].forEach(function (pill) {
      var btn = el('button', 'ev-chat-pill');
      btn.textContent = pill.text;
      btn.addEventListener('click', function () {
        fenixState.explored.pillsUsed.push(pill.action || 'chat');
        btn.classList.add('ev-pill-used');
        if (pill.action) { startTool(pill.action); return; }
        askFenix(pill.q || pill.text, pill.text);
      });
      pillContainer.appendChild(btn);
    });
    wrapper.appendChild(pillContainer);

    var inputBar = el('div', 'ev-chat-input-bar');
    var inputField = el('input', 'ev-chat-input', { type: 'text', placeholder: 'Ask me anything about product...' });
    var sendBtn = el('button', 'ev-chat-send', { text: '➤' });
    sendBtn.setAttribute('aria-label', 'Send message');
    state.msgArea = messageArea;
    state.input = inputField;
    function handleSend() {
      var t = inputField.value.trim();
      if (pendingTool) {
        if (!t && !pendingTool.cfg.allowEmpty) { inputField.focus(); return; }
        inputField.value = '';
        submitTool(t);
        return;
      }
      if (!t) return;
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
      { id: 'card-journey', action: 'journey',
        icon: G + '<path d="M3 3v18h18"/><path d="m7 14 3-4 4 3 5-7"/></svg>',
        title: 'Map the journey', tag: 'An emotion curve',
        hook: "Describe a product and a flow. I'll map the customer's emotional journey — where it delights, where it hurts.", cta: '→ Map it' },
      { id: 'card-featurecreep', action: 'featurecreep',
        icon: G + '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0Z"/></svg>',
        title: 'Feature Creep', tag: "For the record, it's a joke",
        hook: "Name a product. I'll bolt on three gloriously stupid AI features nobody asked for — because 2026.", cta: '→ Creep it' },
      { id: 'card-trade', action: 'trade',
        icon: G + '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg>',
        title: 'Trade me a door.',
        tag: 'A door for a door',
        hook: "700+ people in my network, 4 in 10 senior in banking & fintech — not names to hand out, doors to open. Tell me who you're trying to reach; if I can open that door and you've got one for me, we trade.",
        cta: '→ See my deck' }
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
        if (card.action === 'trade') { if (window.FenixTrade) window.FenixTrade.open(); return; }
        startTool(card.action, cardEl);
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

  // ── Panels → now in-chat ──────────────────────────
  // The tools no longer open a separate panel below; they run in the chat.
  // showPanel/closePanel are kept as thin shims for back-compat (the agent's
  // open_panel path and _autoOpenPanel both call adapter.showPanel).
  function showPanel(panelType) { startTool(panelType); }
  function closePanel() { pendingTool = null; }

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
      if (pill.action === 'trade') { if (window.FenixTrade) window.FenixTrade.open(); return true; }
      if (['overkill', 'jtbd', 'featurecreep', 'journey'].indexOf(pill.action) !== -1) {
        startTool(pill.action);
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
