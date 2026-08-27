/**
 * ============================================
 * LEARNER ADAPTER
 * Fenix page adapter for the Learner persona (aspiring PMs / career-switchers / early-career — "Paige Turner").
 *
 * Frame: mentorship/teaching IS the value here (the OPPOSITE of the Practitioner, which banned mentorship).
 * Warm, teacherly, generous, encouraging — but concrete, never fluffy.
 * Three cards — two run real AI tools in the chat; the third links out to ADPList:
 *   1. metrics     — "What should you measure?" — describe a product/feature/goal -> how to pick the metrics that matter
 *   2. buildwayin  — "Build your way in" — name a target role -> a real portfolio project you can build (no code)
 *   3. booking     — "Book a mentoring session" — link-out to Kiran's ADPList profile (NOT an AI tool)
 *
 * Tool cards route a STRUCTURED prompt through Fenix (grounded) — the framework does the work.
 * Requires fenix-core.js first.
 * Hook: persona-system.js calls LearnerExperience.init('learner')
 * ============================================
 */

(function () {
  'use strict';

  var FC = window.FenixCore;
  if (!FC) { console.error('LearnerExperience requires FenixCore'); return; }
  var el = FC.el;
  var fenixState = FC.fenixState;

  var ACCENT = '#A07ED4';
  var BOOKING_URL = 'https://adplist.org'; // TODO: replace with Kiran's ADPList profile URL

  var FENIX_OPENING = "Quick context — Kiran went from 'what even is a PM?' to leading product teams by building things before anyone asked him to. This whole site is that philosophy made real. The cards on the left are real tools to help you break in and level up: pressure-test your metrics thinking, get a portfolio project you can actually build, or book time with Kiran directly. Let's get you closer.";

  // ── Structured prompts (the teaching frame + Kiran's POV baked in) ──
  function metricsPrompt(v) {
    return "An aspiring PM is using Kiran's \"What should you measure?\" tool to learn how to define the right metrics. Their product, feature, or goal: \"" + v + "\".\n" +
      "Answer AS Fenix in Kiran's voice — a senior PM teaching an aspiring one. Be specific to THEIR input, never generic, and TEACH the reasoning (briefly say why) so they learn, not just what. Use EXACTLY this structure with markdown bold labels:\n" +
      "1. **Start with the goal** — you can't pick metrics without one. State the real outcome this should drive, in one line. Note that skipping this is the #1 mistake.\n" +
      "2. **North Star** — the single metric that best captures real value delivered here (not a vanity number), plus one line on why.\n" +
      "3. **Input metrics** — the 2–4 levers a PM can actually move to shift the North Star. Short bullets.\n" +
      "4. **Guardrails / counter-metrics** — what you must NOT break while chasing the North Star (the trap most people miss). 1–3 bullets.\n" +
      "5. **Leading vs lagging** — which of these tell you early vs. too late, one line.\n" +
      "6. **The vanity trap** — the tempting-but-wrong metric for THIS case, and why it misleads.\n" +
      "7. **Coaching note** — one honest line on how an interviewer grades a metrics answer, so they know what 'great' looks like.\n" +
      "Keep it tight and concrete. Output ONLY the structured artifact — no preamble, no sign-off, and no follow-up questions.";
  }
  function buildwayinPrompt(v) {
    return "An aspiring PM is using Kiran's \"Build Your Way In\" tool. Kiran's whole thesis is that you break into product by BUILDING real things, not just studying. Their target role (or background + target): \"" + v + "\".\n" +
      "Answer AS Fenix in Kiran's voice — encouraging but concrete. Hand them ONE specific, scoped portfolio project they could actually build (AI-assisted, no engineering team needed) that demonstrates the exact skill this role screens for. Use EXACTLY this structure with markdown bold labels:\n" +
      "1. **The skill this role really screens for** — name the core capability an interviewer for this role looks for.\n" +
      "2. **Build this** — one concrete, scoped project, specific enough to start this weekend. Say exactly what the artifact is.\n" +
      "3. **How to build it (no code)** — 3–5 short steps, leaning on AI tools where they help, that a non-engineer can follow.\n" +
      "4. **What it proves** — the exact line an interviewer would draw from this project to the job.\n" +
      "5. **How to show it** — how to present/talk about it (portfolio, LinkedIn, in the interview) so it lands.\n" +
      "6. **Level-up** — one stretch that makes it stand out from other candidates.\n" +
      "Be specific to THEIR target, never generic. Encouraging, credible, concrete. Output ONLY the structured artifact — no preamble, no sign-off, and no follow-up questions.";
  }

  var state = { currentPanel: null, msgArea: null, input: null };

  // ── In-chat tool flow ─────────────────────────────
  // Each tool: Fenix asks its question in the chat, the visitor answers inline,
  // Fenix thinks in the chat, and the one-pager pops only when it's ready.
  var TOOLS = {
    metrics: {
      ask: "Describe a product, feature, or goal — even a rough one. I'll walk you through picking the metrics that actually matter.",
      placeholder: "e.g. a food-delivery app's new loyalty program",
      thinkingLabel: 'Finding the metrics…',
      kicker: 'Metrics', artifactTitle: 'What to Measure', tool: 'metrics',
      promptFn: metricsPrompt
    },
    buildwayin: {
      ask: "What role are you aiming for? (Or tell me your background and where you want to go.) I'll give you a real project to build.",
      placeholder: "e.g. Growth PM at a consumer app — I'm a data analyst now",
      thinkingLabel: 'Designing your project…',
      kicker: 'Build Your Way In', artifactTitle: 'Your Portfolio Project', tool: 'buildwayin',
      promptFn: buildwayinPrompt
    }
  };

  // Left-card titles — flown across to the chat as the throughline.
  var TOOL_TITLES = {
    metrics: 'What should you measure?', buildwayin: 'Build your way in'
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
    if (state.input) state.input.placeholder = 'Ask me anything about breaking into PM...';
    if (!pt) return;
    var t = pt.cfg, msgArea = getMsgArea();
    var display = (t.displayFn ? t.displayFn(value) : value) || '';
    FC.runTool({
      messageArea: msgArea, persona: 'learner', accent: ACCENT, tool: t.tool,
      kicker: t.kicker, artifactTitle: t.artifactTitle, input: display,
      prompt: t.promptFn(value), thinkingLabel: t.thinkingLabel,
      nextPrompt: 'Want to keep going?', nextActions: nextActionsFor(pt.action)
    });
  }

  // metrics and buildwayin are complementary lenses (measure the right thing /
  // build the right thing), so each one's top next-action leads to the other.
  var PAIR = {
    metrics: { action: 'buildwayin', label: 'Now build your way in →' },
    buildwayin: { action: 'metrics', label: 'Help me pick metrics →' }
  };

  function nextActionsFor(justRan) {
    var picks = [];
    if (PAIR[justRan]) picks.push(PAIR[justRan]);   // lead with the paired tool
    return picks.map(function (a) {
      return { label: a.label, run: function () { startTool(a.action); } };
    }).concat([
      { label: 'Book a session', run: function () { startBooking(); } }
    ]);
  }

  // ── Booking (link-out, not an AI tool) ────────────
  // Posts a Fenix message and drops a real, clickable ADPList link into the chat.
  function startBooking(cardEl) {
    var msgArea = getMsgArea();
    if (!msgArea) return;
    var proceed = function () {
      if (cardEl) FC.addLandedMessage(msgArea, 'Book a mentoring session');
      FC.addFenixMessage(msgArea, "I mentor aspiring PMs for free on ADPList — grab a 30-minute slot and let's talk about your path.");
      var link = el('a', 'ev-chat-pill lr-book-btn', { text: 'Book a session on ADPList →' });
      link.setAttribute('href', BOOKING_URL);
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener');
      // Attach the CTA inside the message just posted so it reads as one beat.
      var contents = msgArea.querySelectorAll('.ev-msg-fenix .ev-msg-content');
      var host = contents.length ? contents[contents.length - 1] : msgArea;
      host.appendChild(link);
      msgArea.scrollTop = msgArea.scrollHeight;
      var chat = document.querySelector('.ev-fenix-chat');
      if (chat) chat.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    if (cardEl) FC.flyCardToChat({ cardEl: cardEl, title: 'Book a mentoring session', messageArea: msgArea, accent: ACCENT, onLand: proceed });
    else proceed();
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
    if (zone) zone.classList.add('lr-zone');
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
      html: 'MEET FENIX — <span class="ev-fenix-tagline">real tools to help you break in ↘</span>'
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
      ? 'Welcome back, ' + firstName + '. The tools on the left are yours — or ask me anything about breaking into PM.'
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
      { text: 'How do I break into PM?', q: 'I want to break into product management. Where do I start, realistically?' },
      { text: 'What should I build?', action: 'buildwayin' },
      { text: 'Help me pick metrics', action: 'metrics' }
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
    var inputField = el('input', 'ev-chat-input', { type: 'text', placeholder: 'Ask me anything about breaking into PM...' });
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

  // ── "What I'm reading & listening to" — a curated reading room ──────
  // Static, Kiran-owned. Opens in the branded artifact modal (shareable + printable).
  // Seeded with titles + authors; add `url` and `why` per item as you go.
  // Each item: { t: title, a: author/host, url: '', why: '' }
  var PICKS_INTRO = "A few things shaping how I think — the books, essays, and voices I keep coming back to. Craft, conscience, and the human skills that don't get automated. Some current, some timeless.";
  var PICKS = [
    { section: '📚 Reading', items: [
      { t: 'Inspired (+ Empowered)', a: 'Marty Cagan', url: '', why: '' },
      { t: 'Escaping the Build Trap', a: 'Melissa Perri', url: '', why: '' },
      { t: 'Competing Against Luck', a: 'Clayton Christensen', url: '', why: '' },
      { t: 'The Lean Startup', a: 'Eric Ries', url: '', why: '' },
      { t: 'Continuous Discovery Habits', a: 'Teresa Torres', url: '', why: '' },
      { t: 'Obviously Awesome', a: 'April Dunford', url: '', why: '' },
      { t: 'AI Engineering', a: 'Chip Huyen', url: '', why: '' },
      { t: 'Co-Intelligence', a: 'Ethan Mollick', url: '', why: '' },
      { t: 'Thinking in Systems', a: 'Donella Meadows', url: '', why: '' }
    ]},
    { section: '🎧 Listening', items: [
      { t: "Lenny's Podcast", a: 'Lenny Rachitsky', url: '', why: '' },
      { t: 'Acquired', a: 'Gilbert & Rosenthal', url: '', why: '' },
      { t: 'Latent Space', a: 'AI engineering & product', url: '', why: '' },
      { t: 'How I Built This', a: 'Guy Raz', url: '', why: '' }
    ]},
    { section: '📰 Following', items: [
      { t: "Lenny's Newsletter", a: 'Lenny Rachitsky', url: '', why: '' },
      { t: 'Product Growth', a: 'Aakash Gupta', url: '', why: '' },
      { t: 'Shreyas Doshi', a: 'product judgment', url: '', why: '' },
      { t: 'The Beautiful Mess', a: 'John Cutler', url: '', why: '' },
      { t: 'One Useful Thing', a: 'Ethan Mollick', url: '', why: '' },
      { t: 'Stratechery', a: 'Ben Thompson', url: '', why: '' }
    ]},
    { section: '⚖️ The responsibility of what we build', items: [
      { t: 'Your Undivided Attention / The Social Dilemma', a: 'Center for Humane Technology', url: '', why: '' },
      { t: 'The Age of Surveillance Capitalism', a: 'Shoshana Zuboff', url: '', why: '' },
      { t: 'Weapons of Math Destruction', a: "Cathy O'Neil", url: '', why: '' },
      { t: 'The Attention Merchants', a: 'Tim Wu', url: '', why: '' },
      { t: 'How to Do Nothing', a: 'Jenny Odell', url: '', why: '' },
      { t: 'Nexus', a: 'Yuval Noah Harari', url: '', why: '' }
    ]},
    { section: '🧩 The human skills', items: [
      { t: 'Taste for Makers', a: 'Paul Graham', url: '', why: '' },
      { t: 'The Creative Act', a: 'Rick Rubin', url: '', why: '' },
      { t: 'On Writing Well', a: 'William Zinsser', url: '', why: '' },
      { t: 'The Pyramid Principle', a: 'Barbara Minto', url: '', why: '' },
      { t: 'Made to Stick', a: 'Chip & Dan Heath', url: '', why: '' },
      { t: 'The Greatest Sales Deck', a: 'Andy Raskin', url: '', why: '' },
      { t: 'Clear Thinking', a: 'Shane Parrish', url: '', why: '' },
      { t: 'Thinking in Bets', a: 'Annie Duke', url: '', why: '' },
      { t: 'Never Split the Difference', a: 'Chris Voss', url: '', why: '' },
      { t: 'Radical Candor', a: 'Kim Scott', url: '', why: '' },
      { t: 'Range', a: 'David Epstein', url: '', why: '' }
    ]}
  ];

  function picksMarkdown() {
    var out = PICKS_INTRO + '\n';
    PICKS.forEach(function (sec) {
      out += '\n## ' + sec.section + '\n';
      sec.items.forEach(function (it) {
        var title = it.url ? '[**' + it.t + '**](' + it.url + ')' : '**' + it.t + '**';
        var line = '- ' + title;
        if (it.a) line += ' — ' + it.a;
        if (it.why) line += ' · *' + it.why + '*';
        out += line + '\n';
      });
    });
    return out;
  }

  function showPicks() {
    if (!window.FenixArtifact || !window.FenixArtifact.show) return;
    window.FenixArtifact.show({
      kicker: "Kiran's Picks", title: "What I'm reading & listening to",
      content: picksMarkdown(), persona: 'learner', accent: ACCENT, tool: 'picks'
    });
  }

  function buildUnlockCards(container) {
    var cardsWrap = el('div', 'ev-unlock-cards');
    cardsWrap.appendChild(el('div', 'ev-unlock-cards-header', { html: 'Real tools, <span class="ev-emphasis">to help you break in</span> ↘' }));

    var G = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
    var cards = [
      { id: 'card-metrics', action: 'metrics',
        icon: G + '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>',
        title: 'What should you measure?', tag: 'A real PM skill',
        hook: "Describe a product, feature, or goal — I'll show you how to pick the metrics that actually matter, and the vanity trap to avoid.", cta: '→ Find the metrics' },
      { id: 'card-buildwayin', action: 'buildwayin',
        icon: G + '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
        title: 'Build your way in', tag: 'Learn by doing',
        hook: "Tell me the role you're aiming for — I'll hand you a real project you can build (no code) that proves you can do the job.", cta: '→ Get my project' },
      { id: 'card-picks', action: 'picks',
        icon: G + '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
        title: "What I'm reading & listening to", tag: 'Books, voices & the odd wildcard',
        hook: "The books, essays, and voices shaping how I think — craft, conscience, and the human skills. Some current, some timeless.", cta: '→ Open the list' },
      { id: 'card-booking', action: 'booking',
        icon: G + '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/></svg>',
        title: 'Book a mentoring session', tag: 'Free · 1:1 with Kiran',
        hook: "Aiming for a PM role and want a real conversation? Book a free 30-min mentoring session with Kiran on ADPList.", cta: '→ Book on ADPList' }
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
        if (card.action === 'booking') { startBooking(cardEl); return; }
        if (card.action === 'picks') { showPicks(); return; }
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
  // The tools run in the chat; showPanel/closePanel are kept as thin shims for
  // back-compat (the agent's open_panel path and _autoOpenPanel call showPanel).
  function showPanel(panelType) {
    if (panelType === 'booking') { startBooking(); return; }
    if (panelType === 'picks') { showPicks(); return; }
    startTool(panelType);
  }
  function closePanel() { pendingTool = null; }

  // ── Styles ────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('lr-adapter-styles')) return;
    var css = ''
      + '.lr-book-btn{display:inline-block;margin-top:12px;text-decoration:none;border-color:rgba(160,126,212,.5);color:' + ACCENT + '}'
      + '.lr-book-btn:hover{background:rgba(160,126,212,.16);border-color:' + ACCENT + '}';
    var s = document.createElement('style'); s.id = 'lr-adapter-styles'; s.textContent = css;
    document.head.appendChild(s);
  }

  // ── Adapter ───────────────────────────────────────
  var learnerAdapter = {
    persona: 'learner',
    accentColor: ACCENT,
    agentUrl: 'https://api.kiranrao.ai/api/v1/fenix/agent',
    messageCap: 30,
    availableTools: ['open_panel', 'close_panel', 'scroll_to_section', 'get_visitor_context', 'connect_visitor', 'collect_feedback', 'show_related_content'],
    buildUI: buildUI,
    showPanel: showPanel,
    openingMessage: FENIX_OPENING,
    onConnect: function () { rebuildCards(); },
    onPillAction: function (pill) {
      if (pill.action === 'booking') { startBooking(); return true; }
      if (pill.action === 'picks') { showPicks(); return true; }
      if (['metrics', 'buildwayin'].indexOf(pill.action) !== -1) {
        startTool(pill.action);
        return true;
      }
      return false;
    }
  };

  window.LearnerExperience = {
    init: function (persona) { if (persona === 'learner') FC.init(learnerAdapter); },
    showPanel: showPanel,
    closePanel: closePanel
  };

})();
