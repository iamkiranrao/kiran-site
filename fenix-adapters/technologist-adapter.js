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
 * All four cards open FenixCards modals (type: 'render').
 * Deep technical Q&A is delegated to Fenix (grounded) — the system Kiran built is the authority.
 * Requires fenix-core.js and fenix-cards.js first.
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
    { decide: "Fenix once told a visitor Kiran 'worked at Zeta' and 'built features at GEICO' — both false (an ACH essay, a teardown). The call: the rules against making things up have to be LOUDER than the urge to be helpful.", ai: "Rebuilt the safety layer — six hard rules (a teardown is not a job) and a locked-down retrieval prompt. Fenix now says 'wrote,' never 'built' — and 'I don't know' when it should." },
    { decide: "One 400KB do-everything HTML file was strangling every change. Instead of pushing through it, Kiran asked for the structure that makes the next twenty changes easy.", ai: "Split it into a core plus swappable per-persona adapters — this experience is one of them. 400KB → 85KB, a 93.6% cut." },
    { decide: "Kiran asked whether the job descriptions feeding his analysis were real. They weren't — the tool had been quietly fabricating them. The call: wipe it, and ban synthetic data from any foundation layer.", ai: "Nuked every fabricated record and rebuilt the flow to take only real, pasted JDs. New rule: nothing synthetic feeds the foundation." },
    { decide: "Production Fenix went dark — every call pinned a model that got retired. The call: don't just swap the string; make this whole class of failure impossible to miss again.", ai: "Moved the model to one env-driven source of truth and added a live canary that pings each model and pages the day one dies — instead of rotting silently for weeks." },
    { decide: "The real limit wasn't knowledge — it was memory: every AI session started from zero. Kiran decided to build Fenix a memory that compounds.", ai: "A private ops platform — Command Center, ~20 modules — captures every session and synthesizes it nightly into the memory that trains this agent. The site is the tip; that's the iceberg." }
  ];

  // ── 2. Judgment calls — product-technical, each Challengeable ──
  var JUDGMENT = [
    { title: "Bet on day-one platform support — at 32M users", why: "At Wells Fargo, Kiran embedded a squad inside Apple's and Google's early-access programs to ship new OS features on launch day — widgets, Dynamic Island, Watch complications — instead of trailing 6–12 months. Customers expect their bank to keep pace with their phone.", challenge: "Why bet a standing squad on unproven platform features instead of waiting for demand?" },
    { title: "Make the site the product, not a case study", why: "A product leader doesn't need a case study about building great products while standing inside one. The site is the proof — the medium is the message. The tradeoff: it raises the bar to unforgiving, where every rough edge undercuts the whole thesis.", challenge: "Why make the site itself the product instead of showing case studies?" },
    { title: "Measure by connection, not engagement", why: "The only metric that matters here is whether you reach out and say hi — a relationship metric, not pageviews or time-on-site. It's built to turn personas into persons, which means trading virality and reach for a small, high-intent audience.", challenge: "Why ignore engagement metrics and optimize only for 'connect'?" },
    { title: "No face in the hero", why: "For the hero, Kiran chose an AI-generated avatar over his own face — part privacy line, part removing the unconscious bias a face triggers (age, ethnicity, gender, looks). Let the thinking be the first impression. The cost: you give up some of the warmth a real face builds.", challenge: "Doesn't leaving your face out cost you the trust a real face builds?" },
    { title: "Kill the contact form", why: "Nobody fills out a contact form. Kiran didn't optimize it — he deleted it and its whole tail (the pipeline, the table, the admin UI) and made the conversation the site instead. Eliminate problems, don't solve them.", challenge: "Why delete the contact form instead of just improving it?" }
  ];

  // ── 4. Roast angles — Fenix roasts Kiran's own build ──
  var ROAST_ANGLES = [
    { label: 'Roast the whole thing', display: 'Roast the whole build', prompt: "Roast Kiran's entire site and build. Be witty and genuinely funny — land a few real jabs grounded in his actual choices, stay honest and self-aware, and end on a warm note. He explicitly asked for this, so don't go soft or generic." },
    { label: 'Roast the tech choices', display: 'Roast the tech choices', prompt: "Roast Kiran's technical choices — vanilla JS with no framework, the whole stack — playfully but grounded in the real tradeoffs. A couple of sharp, specific jabs, then a wink." },
    { label: 'Roast his over-engineering', display: 'Roast the over-engineering', prompt: "Roast Kiran's over-engineering — building the meta-layers, hundreds of docs, and elaborate infrastructure before shipping. He's very self-aware about this, so actually go there. Affectionate, honest, and funny." }
  ];

  var state = { cards: null, cardContainer: null, msgArea: null };

  // ── Card definitions (modal-based) ──────────────────

  function getCardDefs() {
    var connected = fenixState.visitor.connected;
    return [
      // ── Card 1: Build Story ──
      { id: 'buildstory', title: 'How I built this without code.', tag: 'the honest version', tagType: 'tool', icon: 'sun',
        hook: 'What I decided vs. what the AI wrote.', cta: '→ See the split',
        modal: {
          type: 'render', kicker: 'BUILD STORY', title: 'How it got built',
          render: function (body, card, utils) {
            body.appendChild(utils.h('div', 'fz-modal-output fz-fade-in', {
              html: '<em>Fenix:</em> <strong>How it got built.</strong> Every step: what Kiran decided — and what the AI actually typed.'
            }));
            BUILD_STEPS.forEach(function (s) {
              var row = utils.h('div', '', {
                style: 'display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid rgba(203,92,114,.22);border-radius:10px;overflow:hidden;margin-bottom:14px'
              });
              var left = utils.h('div', '', { style: 'padding:13px 15px;background:rgba(203,92,114,.07)' });
              left.appendChild(utils.h('span', '', {
                text: 'Kiran decided',
                style: 'display:block;font-size:.66rem;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px;font-weight:600;color:#cb5c72'
              }));
              left.appendChild(utils.h('div', '', { text: s.decide, style: 'font-size:.88rem;line-height:1.45;opacity:.9' }));
              var right = utils.h('div', '', {
                style: 'padding:13px 15px;background:rgba(255,255,255,.02);border-left:1px solid rgba(203,92,114,.18)'
              });
              right.appendChild(utils.h('span', '', {
                text: 'AI executed',
                style: 'display:block;font-size:.66rem;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px;font-weight:600;opacity:.5'
              }));
              right.appendChild(utils.h('div', '', { text: s.ai, style: 'font-size:.88rem;line-height:1.45;opacity:.9' }));
              row.appendChild(left);
              row.appendChild(right);
              body.appendChild(row);
            });
            body.appendChild(utils.h('div', '', {
              text: "That split — judgment on the left, typing on the right — is the skill that matters now. If your team is figuring out how to build with AI, that’s the conversation I want.",
              style: 'margin-top:16px;font-size:.88rem;line-height:1.5;opacity:.72;font-style:italic'
            }));
            var cta = utils.h('button', 'ev-btn-primary', {
              type: 'button', text: "Let’s talk about building with AI", style: 'margin-top:6px'
            });
            cta.addEventListener('click', function () {
              utils.showVisitorEcho(cta, "Let’s talk about building with AI");
              utils.callFenix(
                "I lead an AI/product team and want to talk with Kiran about building with AI. Help me connect.",
                'thinking', body, card
              );
            });
            body.appendChild(cta);
          }
        }
      },

      // ── Card 2: Judgment Calls ──
      { id: 'judgment', title: 'The judgment calls.', tag: 'framework', tagType: 'framework', icon: 'layers',
        hook: 'What to build, what to buy, what to kill. Challenge any of them.', cta: '→ Read the calls',
        modal: {
          type: 'render', kicker: 'JUDGMENT CALLS', title: 'The calls',
          render: function (body, card, utils) {
            body.appendChild(utils.h('div', 'fz-modal-output fz-fade-in', {
              html: '<em>Fenix:</em> <strong>The calls.</strong> Five decisions that shaped the build. Disagree with one? Hit Challenge — I’ll defend it in Kiran’s voice.'
            }));
            var list = utils.h('div', 'tg-adr-list');
            JUDGMENT.forEach(function (a) {
              var item = utils.h('div', 'tg-adr');
              item.appendChild(utils.h('div', 'tg-adr-title', { text: a.title }));
              item.appendChild(utils.h('div', 'tg-adr-why', { text: a.why }));
              var btn = utils.h('button', 'tg-challenge', { type: 'button', text: 'Challenge this →' });
              btn.addEventListener('click', function () {
                utils.showVisitorEcho(btn, 'Challenge: ' + a.title);
                utils.callFenix(a.challenge, 'thinking', body, card);
              });
              item.appendChild(btn);
              list.appendChild(item);
            });
            body.appendChild(list);
          }
        }
      },

      // ── Card 3: Problem (gated) ──
      { id: 'problem', title: 'Bring me a problem.', tag: connected ? 'unlocked' : 'connect to unlock', tagType: 'gated', icon: 'question',
        hook: "Scoping an AI feature? Stuck on build-vs-buy?", cta: connected ? '→ Scope it' : '→ Connect to unlock',
        locked: !connected,
        modal: {
          type: 'render', kicker: 'BRING A PROBLEM', title: 'Scope it with Fenix',
          render: function (body, card, utils) {
            if (!fenixState.visitor.connected) {
              body.appendChild(utils.h('div', 'fz-modal-output fz-fade-in', {
                html: '<em>Fenix:</em> A real ask deserves a real name — I like to know who I’m scoping for. Connect first, then bring the problem.'
              }));
              var connectBtn = utils.h('button', 'ev-btn-primary', { type: 'button', text: 'Connect to unlock', style: 'margin-top:12px' });
              connectBtn.addEventListener('click', function () {
                utils.closeModal();
                askFenix("I'd like to bring Kiran a real product or AI problem. First — who should I tell him is asking?", "Bring me a problem — let's connect");
              });
              body.appendChild(connectBtn);
              return;
            }
            body.appendChild(utils.h('div', 'fz-modal-output fz-fade-in', {
              html: '<em>Fenix:</em> <strong>Bring me a problem.</strong> Scoping an AI feature, a build-vs-buy, an adoption problem — something you’re genuinely wrestling with.'
            }));
            body.appendChild(utils.h('p', 'tg-problem-copy', {
              text: "Not a demo, not free consulting. Give me a sentence and I’ll hand you a first-pass scope in Kiran’s style right now — then, if it’s useful, set up the full 45 minutes with him."
            }));
            var inputWrap = utils.h('div', '');
            var ta = utils.h('textarea', 'tg-problem-input', { placeholder: 'One sentence — what are you wrestling with?', rows: '3' });
            inputWrap.appendChild(ta);
            var scopeBtn = utils.h('button', 'ev-btn-primary tg-problem-scope', { type: 'button', text: 'Give me a first-pass' });
            scopeBtn.addEventListener('click', function () {
              var v = ta.value.trim();
              if (!v) { ta.focus(); return; }
              utils.showVisitorEcho(inputWrap, 'Scope this: ' + v);
              utils.callFenix(
                "A visitor wants Kiran's quick take on scoping this problem: \"" + v + "\". Give a short, sharp first-pass in Kiran's style — how he'd frame it, the first two or three questions he'd ask, and where AI likely fits or doesn't. Keep it tight. Then invite them to book the full 45-minute session with Kiran.",
                'thinking', body, card
              );
            });
            inputWrap.appendChild(scopeBtn);
            body.appendChild(inputWrap);
          }
        }
      },

      // ── Card 4: Roast ──
      { id: 'roast', title: 'Roast the build.', tag: 'just for fun', tagType: 'fun', icon: 'flame',
        hook: "My own AI on my own architecture.", cta: '→ Let Fenix cook',
        modal: {
          type: 'render', kicker: 'THE ROAST', title: 'Roast the build',
          render: function (body, card, utils) {
            body.appendChild(utils.h('div', 'fz-modal-output fz-fade-in', {
              html: '<em>Fenix:</em> You asked for it — Kiran built this whole thing, then told me to be honest about it. Pick your angle:'
            }));
            var btnWrap = utils.h('div', '', { style: 'display:flex;flex-direction:column;gap:10px;margin-top:16px' });
            ROAST_ANGLES.forEach(function (a) {
              var btn = utils.h('button', 'tg-challenge', { type: 'button', text: a.label, style: 'text-align:left' });
              btn.addEventListener('click', function () {
                utils.showVisitorEcho(btnWrap, a.display);
                utils.callFenix(a.prompt, 'Cooking…', body, card);
              });
              btnWrap.appendChild(btn);
            });
            body.appendChild(btnWrap);
          }
        }
      }
    ];
  }

  // ── Open a card modal by id (for drawer pills / onPillAction) ──
  function openCardById(id) {
    if (!state.cards) return;
    var FZ = window.FenixCards;
    for (var i = 0; i < state.cards.length; i++) {
      if (state.cards[i].id === id) {
        FZ.openModal(state.cards[i]);
        return;
      }
    }
  }

  // ── UI ────────────────────────────────────────────

  function buildUI() {
    var leftCol = document.querySelector('.fenix-intro-zone .fenix-intro-left');
    if (!leftCol) return;
    injectStyles();
    leftCol.innerHTML = '';

    // Chat column -> drawer
    var drawer = document.getElementById('fenix-chat-drawer');
    if (drawer) {
      var drawerRight = drawer.querySelector('.fenix-intro-right');
      if (drawerRight) { drawerRight.innerHTML = ''; buildFenixColumn(drawerRight); }
      var closeBtn = drawer.querySelector('.fenix-chat-drawer-close');
      if (closeBtn) closeBtn.addEventListener('click', function () { drawer.classList.remove('open'); });
    }

    var FZ = window.FenixCards;
    leftCol.appendChild(FZ.h('div', 'fz-tagline', { html: '<span class="fz-tagline-meet">MEET FENIX</span> <span class="fz-tagline-sub">— YOUR GUIDE TO EVERYTHING ON THIS SITE ↘</span>' }));

    var identity = FZ.h('div', 'fz-id');
    var avatar = FZ.h('div', 'fz-avatar');
    avatar.appendChild(FZ.h('img', '', { src: 'images/fenix/1fenixavatar1.png', alt: 'Fenix' }));
    identity.appendChild(avatar);
    var nameWrap = FZ.h('span', 'fz-name', { html: 'Fenix' });
    nameWrap.appendChild(FZ.h('span', 'fz-dot'));
    identity.appendChild(nameWrap);
    leftCol.appendChild(identity);

    var opening = FZ.h('div', 'fz-opening');
    leftCol.appendChild(opening);
    FZ.typeText(opening, FENIX_OPENING);
    leftCol.appendChild(FZ.h('div', 'fz-label', { text: 'the internals, unlocked' }));

    var cardContainer = FZ.h('div');
    leftCol.appendChild(cardContainer);
    state.cardContainer = cardContainer;

    state.cards = getCardDefs();
    FZ.renderCards(state.cards, cardContainer, 'technologist');

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

  // Re-render cards when state changes (e.g. on connect, to unlock gated card).
  function rebuildCards() {
    if (!state.cardContainer) return;
    state.cards = getCardDefs();
    window.FenixCards.renderCards(state.cards, state.cardContainer, 'technologist');
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
    state.msgArea = messageArea;
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
        if (pill.panel) { openCardById(pill.panel); return; }
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

  // ── Styles ────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('tg-adapter-styles')) return;
    var css = ''
      + '.tg-adr-list{display:flex;flex-direction:column;gap:16px;margin-top:14px}'
      + '.tg-adr{border-left:2px solid #cb5c72;padding-left:14px}'
      + '.tg-adr-title{font-weight:600;margin-bottom:5px}'
      + '.tg-adr-why{font-size:.9rem;line-height:1.55;opacity:.85;margin-bottom:8px}'
      + '.tg-challenge{background:none;border:1px solid rgba(203,92,114,.4);color:#cb5c72;font-size:.78rem;padding:5px 12px;border-radius:100px;cursor:pointer;transition:all .15s}'
      + '.tg-challenge:hover{background:rgba(203,92,114,.12)}'
      + '.tg-problem-copy{font-size:.9rem;line-height:1.55;opacity:.85;margin-bottom:14px}'
      + '.tg-problem-input{width:100%;box-sizing:border-box;background:rgba(255,255,255,.03);border:1px solid rgba(203,92,114,.3);border-radius:8px;color:inherit;padding:11px 13px;font-family:inherit;font-size:.9rem;resize:vertical;margin-bottom:12px}'
      + '.tg-problem-input:focus{outline:none;border-color:#cb5c72}'
      + '.tg-problem-scope{margin-top:6px}';
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
    openingMessage: FENIX_OPENING,
    onConnect: function () { rebuildCards(); },
    onPillAction: function (pill) {
      if (['buildstory', 'judgment', 'problem', 'roast'].indexOf(pill.action) !== -1) {
        if (pill.action === 'problem' && !fenixState.visitor.connected) {
          askFenix("I'd like to bring Kiran a real product or AI problem to work through. First — who should I tell him is asking? Let's connect.", "Bring me a problem — let's connect");
          return true;
        }
        openCardById(pill.action);
        return true;
      }
      return false;
    }
  };

  window.TechnologistExperience = {
    init: function (persona) { if (persona === 'technologist') FC.init(technologistAdapter); },
    openCardById: openCardById
  };

})();
