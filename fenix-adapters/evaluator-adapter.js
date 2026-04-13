/**
 * ============================================
 * EVALUATOR ADAPTER
 * Fenix page adapter for the Evaluator persona (Merritt).
 * Provides evaluator-specific tools, panels, unlock cards,
 * pills state machine, connect flow, and Fit Narrative integration.
 *
 * Requires: fenix-core.js loaded first.
 * Hook: persona-system.js calls EvaluatorExperience.init('evaluator')
 * Architecture: docs/FENIX-MODULE-ARCHITECTURE.md
 * ============================================
 */

(function () {
  'use strict';

  // ── Shorthand refs to core utilities ──────────────
  var FC = window.FenixCore;
  var el = FC.el;
  var append = FC.append;
  var fenixState = FC.fenixState;

  // ── Configuration ─────────────────────────────────
  var API_BASE = 'https://cc.kiranrao.ai';
  var API_KEY = 'H3Ycu0N5kfv5MERh_5mYwYcMbGu6pYUv2y1KSgsMBLk';

  // ── Evaluator-Specific Content ────────────────────

  var FENIX_OPENING = 'Quick context before we start. This isn\'t a portfolio site. It\'s a product Kiran built.\n\nThe resume comes in three versions, each tuned to a different kind of search. Paste a job description and I\'ll show you exactly how Kiran\'s experience maps to it. And I\'m not a template chatbot. I\'ve been trained on Kiran\'s actual work, his decisions, and how he thinks.\n\nThis site isn\'t designed for a 30-second skim. But every minute you spend here will surface insights you\'d otherwise spend weeks piecing together. The more you experience, the more you understand about how Kiran thinks and works.\n\nI\'m here to help you focus on what matters to you.';

  var RECRUITER_QUESTIONS = [
    {
      q: '"Tell me the story of you, but you can\'t say anything on your resume."',
      a: 'Kiran\'s answer will appear here — authentic, specific, not a template.'
    },
    {
      q: '"When was the last time you changed your mind about something important?"',
      a: 'Kiran\'s answer will appear here.'
    },
    {
      q: '"Tell me about a value you defended, even when it cost you something."',
      a: 'Kiran\'s answer will appear here.'
    },
    {
      q: '"Have you ever made a decision you knew would be unpopular?"',
      a: 'Kiran\'s answer will appear here.'
    },
    {
      q: '"What haven\'t I asked you that I should have?"',
      a: 'Kiran\'s answer will appear here.'
    }
  ];

  // ── Evaluator Local State ─────────────────────────
  // Connect state is now managed by FenixCore (localStorage: fenix_*)
  // Legacy evaluator_* keys are migrated on first load.
  var state = {
    currentPanel: null
  };

  // Migrate legacy evaluator_* localStorage keys → core fenix_* keys
  (function migrateLegacyConnect() {
    try {
      var legacyName = localStorage.getItem('evaluator_name');
      if (legacyName && !localStorage.getItem('fenix_connected')) {
        FC.connectVisitor({
          name: legacyName,
          company: localStorage.getItem('evaluator_company'),
          email: localStorage.getItem('evaluator_email')
        });
        // Clean up legacy keys
        localStorage.removeItem('evaluator_name');
        localStorage.removeItem('evaluator_company');
        localStorage.removeItem('evaluator_email');
      }
    } catch (e) { /* ignore */ }
  })();


  // ── Dynamic Pills — Option C: Agent conversational + Frontend contextual ──
  //
  // getDefaultPills() returns conversational suggestions based on state.
  // getContextualPills() appends action pills driven by fenixState
  // (e.g., "Connect via LinkedIn" when only first name captured).
  // Both are merged when pills update: backend suggested > conversational > contextual.

  function getDefaultPills() {
    var ex = fenixState.explored;
    var connected = fenixState.visitor.connected;
    var msgs = ex.messagesExchanged;
    var pills = [];

    // Initial state — before any conversation
    if (msgs === 0) {
      return [
        { text: 'Let me show you the resume options', action: 'resume', locked: false },
        { text: 'Here are questions worth asking', action: 'questions', locked: false },
        { text: 'How would we evaluate each other?', action: 'connect', locked: !connected },
        { text: 'Let me give you a quick tour', action: 'tour', locked: false }
      ];
    }

    // Late-stage nudge for unconnected visitors
    if (msgs >= 25 && !connected) {
      return [
        { text: 'Let\u2019s connect before I go', action: 'agent' },
        { text: 'How would we evaluate each other?', action: 'agent', locked: true }
      ];
    }

    // Connected visitor — drive toward fit score and deeper exploration
    if (connected) {
      if (!ex.fitScoreStarted) pills.push({ text: 'Let\u2019s evaluate fit', action: 'agent' });
      if (!ex.resumeLensSelected) pills.push({ text: 'Let me show you the resume options', action: 'agent' });
      if (pills.length < 3) pills.push({ text: 'What makes Kiran different?', action: 'agent' });
      return pills.slice(0, 3);
    }

    // Mid-conversation unconnected — suggest next steps
    pills.push({ text: 'Let me show you the resume options', action: 'agent' });
    if (msgs >= 2) pills.push({ text: 'Let me tell you about his AI work', action: 'agent' });
    if (ex.cardsClicked.length === 0) pills.push({ text: 'Let me give you a quick tour', action: 'agent' });
    return pills.slice(0, 3);
  }

  // Contextual action pills — appended by frontend based on fenixState
  function getContextualPills() {
    var pills = [];
    var connected = fenixState.visitor.connected;
    var visitor = fenixState.visitor;

    // If visitor has first name but no last name or company, nudge to complete identity
    if (visitor.name && !connected) {
      pills.push({ text: '\uD83D\uDD17 Connect with LinkedIn', action: 'connect', locked: false });
    }

    // If connected but hasn't started fit score
    if (connected && !fenixState.explored.fitScoreStarted) {
      pills.push({ text: '\u2696\uFE0F Why Kiran for your role', action: 'connect', locked: false });
    }

    return pills;
  }


  // ── Tool Executors ────────────────────────────────

  var toolExecutors = {
    open_panel: function (args) {
      fenixState.ui.currentPanel = args.panel;
      showPanel(args.panel);
      fenixState.explored.panelsOpened.push(args.panel);
      return 'Opened the ' + args.panel + ' panel';
    },

    close_panel: function () {
      closePanel();
      fenixState.ui.currentPanel = null;
      return 'Panel closed';
    },

    select_resume_lens: function (args) {
      if (fenixState.ui.currentPanel !== 'resume') {
        showPanel('resume');
        fenixState.explored.panelsOpened.push('resume');
        fenixState.ui.currentPanel = 'resume';
      }
      var lensCard = document.querySelector('.ev-lens-card[data-lens="' + args.lens + '"]');
      if (lensCard) {
        lensCard.click();
        fenixState.explored.resumeLensSelected = args.lens;
        return 'Selected the ' + args.lens.toUpperCase() + ' resume lens';
      }
      return 'Resume panel open but lens card not found';
    },

    scroll_to_section: function (args) {
      var sectionMap = {
        'about': '#about',
        'work': '#work',
        'numbers': '#numbers',
        'contact': '#contact'
      };
      var selector = sectionMap[args.section];
      if (selector) {
        var target = document.querySelector(selector);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return 'Scrolled to ' + args.section;
        }
      }
      return 'Section "' + args.section + '" not found';
    },

    get_visitor_context: function () {
      return JSON.stringify(fenixState.explored);
    },

    start_fit_score: function () {
      if (!fenixState.visitor.connected) {
        showPanel('connect');
        fenixState.ui.currentPanel = 'connect';
        return 'Visitor not connected yet — opened the connect panel';
      }
      showPanel('connect');
      fenixState.explored.fitScoreStarted = true;
      fenixState.ui.currentPanel = 'connect';
      return 'Opened the Fit Narrative JD input';
    },

    connect_visitor: function (args) {
      var result = FC.connectVisitor({
        first_name: args.first_name,
        last_name: args.last_name,
        company: args.company,
        email: args.email
      });
      if (!result.success) return 'Connect failed: ' + (result.reason || 'unknown');
      // Evaluator-specific UI: unlock cards, transition name
      applyConnectedState();
      return 'Connected as ' + result.name + (result.company ? ' from ' + result.company : '') + '. Gated features unlocked.';
    },

    show_related_content: function (args) {
      var topic = args.topic || 'related content';
      if (args.url) {
        // Use navigateWithFenix — it handles single-hop isolation correctly
        // (only snapshots THIS page's messages, not carried context from prior hops)
        FC.navigateWithFenix(args.url);
        return 'Navigating to ' + topic + '...';
      }
      return 'Suggested exploring: ' + topic;
    },

    collect_feedback: function (args) {
      // POST to fenix-backend feedback endpoint
      var payload = {
        session_id: fenixState.sessionId,
        visitor_name: fenixState.visitor.name || null,
        visitor_company: fenixState.visitor.company || null,
        visitor_email: fenixState.visitor.email || null,
        feedback_text: args.feedback_text,
        rating: args.rating || null,
        public_ok: args.public_ok || false,
        source: 'fenix',
        page_url: window.location.href
      };
      fetch('https://api.kiranrao.ai/api/v1/fenix/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(function (err) {
        console.error('Feedback submission failed:', err);
      });
      return 'Feedback captured' + (args.public_ok ? ' (public OK)' : ' (private)') + '.';
    }
  };

  var toolLabels = {
    open_panel: function (args) { return 'Opening ' + (args && args.panel ? args.panel : '') + ' panel...'; },
    close_panel: 'Closing the panel...',
    select_resume_lens: function (args) { return 'Selecting the ' + (args && args.lens ? args.lens.toUpperCase() : '') + ' resume...'; },
    scroll_to_section: function (args) { return 'Scrolling to ' + (args && args.section ? args.section : '') + '...'; },
    get_visitor_context: 'Checking what you\'ve explored...',
    start_fit_score: 'Setting up the fit analysis...',
    connect_visitor: 'Connecting you...',
    collect_feedback: 'Saving your feedback...'
  };


  // ── Staggered Reveal (scroll-triggered) ────────────

  function revealZoneElements() {
    var reveals = [
      { sel: '.ev-unlock-cards-header', delay: 0 },
      { sel: '.ev-fenix-chat', delay: 0 },
      { sel: '.ev-unlock-card:nth-child(2)', delay: 150 },
      { sel: '.ev-unlock-card:nth-child(3)', delay: 300 },
      { sel: '.ev-unlock-card:nth-child(4)', delay: 450 },
    ];

    reveals.forEach(function (item) {
      var element = document.querySelector(item.sel);
      if (!element) return;
      if (item.delay === 0) {
        element.classList.add('ev-revealed');
      } else {
        setTimeout(function () {
          element.classList.add('ev-revealed');
        }, item.delay);
      }
    });

    // Typing animation for Fenix opening message (fix: 2d)
    var openingMsg = document.querySelector('.ev-opening-msg');
    if (openingMsg) {
      var fullText = openingMsg.getAttribute('data-opening-text');
      var contentEl = openingMsg.querySelector('.ev-msg-content');
      if (fullText && contentEl && !contentEl.textContent) {
        typeOpeningMessage(contentEl, fullText);
      }
    }
  }

  // Character-by-character typing effect for the opening message
  // Paced to feel like a spoken sentence — unhurried, registering with the reader.
  function typeOpeningMessage(element, text) {
    var i = 0;
    var baseSpeed = 32; // ms per character — spoken pace
    element.classList.add('ev-typing');
    function typeChar() {
      if (i < text.length) {
        element.textContent += text[i];
        // Natural rhythm: pause slightly longer after punctuation
        var ch = text[i];
        var delay = baseSpeed;
        if (ch === '.' || ch === '!' || ch === '?') delay = baseSpeed * 8;
        else if (ch === ',' || ch === '\u2014' || ch === ';') delay = baseSpeed * 4;
        else if (ch === ' ') delay = baseSpeed * 1.2;
        i++;
        setTimeout(typeChar, delay);
      } else {
        element.classList.remove('ev-typing');
      }
    }
    // Start after the chat panel reveals
    setTimeout(typeChar, 600);
  }


  // ── Build UI (Adapter interface method) ────────────

  function buildUI() {
    var rightCol = document.querySelector('.fenix-intro-right');
    var leftCol = document.querySelector('.fenix-intro-left');
    if (!rightCol || !leftCol) return;

    rightCol.innerHTML = '';
    leftCol.innerHTML = '';

    buildFenixColumn(rightCol);
    buildUnlockCards(leftCol);

    // Scroll-triggered entrance animations
    var zone = document.querySelector('.fenix-intro-zone');

    function setupScrollReveal() {
      if (!zone) return;
      if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              revealZoneElements();
              observer.disconnect();
            }
          });
        }, { threshold: 0.1 });
        observer.observe(zone);
      } else {
        revealZoneElements();
      }
    }

    if (document.body.classList.contains('morph-complete')) {
      setupScrollReveal();
    } else {
      var morphWatcher = new MutationObserver(function () {
        if (document.body.classList.contains('morph-complete')) {
          morphWatcher.disconnect();
          setupScrollReveal();
        }
      });
      morphWatcher.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    if (fenixState.visitor.connected) {
      applyConnectedState();
    }
  }


  // ════════════════════════════════════════════════════
  // FENIX COLUMN (Right Side)
  // ════════════════════════════════════════════════════

  function buildFenixColumn(container) {
    // Column header above chat widget — mirrors the unlock cards header (fix: 2b)
    var colHeaderText = (hasExplored || isConnected)
      ? 'Fenix \u2014 <span class="ev-fenix-tagline">ready when you are</span>'
      : 'MEET FENIX \u2014 <span class="ev-fenix-tagline">your guide to everything on this site ↘</span>';
    var colHeader = el('div', 'ev-fenix-col-header', { html: colHeaderText });
    container.appendChild(colHeader);

    var wrapper = el('div', 'ev-fenix-chat');

    var chatHeader = el('div', 'ev-chat-header');
    var headerAvatar = el('img', 'ev-chat-avatar', { src: 'images/logo.png', alt: 'Fenix' });
    var headerInfo = el('div', 'ev-chat-header-info');
    headerInfo.appendChild(el('span', 'ev-chat-header-name', { text: 'Fenix' }));
    var statusDot = el('span', 'ev-status-dot ev-status-dot--ready');
    statusDot.setAttribute('title', 'Ready');
    headerInfo.appendChild(statusDot);
    chatHeader.appendChild(headerAvatar);
    chatHeader.appendChild(headerInfo);
    wrapper.appendChild(chatHeader);

    var messageArea = el('div', 'ev-chat-messages');
    // Opening message — contextual based on whether visitor has been here before
    var hasExplored = fenixState.explored.pillsUsed.length > 0 ||
                      fenixState.explored.cardsClicked.length > 0 ||
                      fenixState.explored.panelsOpened.length > 0;
    var isConnected = fenixState.visitor.connected;
    var firstName = isConnected && fenixState.visitor.name ? fenixState.visitor.name.split(' ')[0] : '';

    var openingText;
    if (isConnected && firstName) {
      openingText = 'Welcome back, ' + firstName + '. Pick up where you left off, or explore something new \u2014 I\'m here whenever you need me.';
    } else if (hasExplored) {
      openingText = 'Welcome back. Pick up where you left off, or try something new \u2014 I\'m here whenever you need me.';
    } else {
      openingText = 'Hey \u2014 welcome. I\'m Fenix, Kiran\'s AI. I\'m here to help you get the most out of this site \u2014 whether that\'s exploring his work, figuring out fit, or just asking whatever\'s on your mind. The buttons below are fast paths, or just type away.';
    }
    var openingBubble = el('div', 'ev-msg ev-msg-fenix ev-opening-msg');
    var openingAvatar = el('img', 'ev-msg-avatar', { src: 'images/logo.png', alt: 'Fenix' });
    var openingContent = el('div', 'ev-msg-content');
    openingBubble.appendChild(openingAvatar);
    openingBubble.appendChild(openingContent);
    openingBubble.setAttribute('data-opening-text', openingText);
    messageArea.appendChild(openingBubble);
    wrapper.appendChild(messageArea);

    // ── Typing Animation for Opening Message ──
    (function typeOpeningMessage() {
      var introZone = container.closest('.fenix-intro-zone');
      if (!introZone) {
        // If no intro zone, just fill content immediately
        openingContent.textContent = openingText;
        return;
      }

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            observer.unobserve(introZone);
            animateTyping(openingContent, openingText);
          }
        });
      }, { threshold: 0.1 });

      observer.observe(introZone);

      function animateTyping(contentEl, text) {
        var index = 0;
        var charDelay = 30; // ms per character

        contentEl.textContent = '';
        contentEl.classList.add('ev-msg-typing');

        function typeNextChar() {
          if (index < text.length) {
            contentEl.textContent += text[index];
            index++;
            setTimeout(typeNextChar, charDelay);
          } else {
            contentEl.classList.remove('ev-msg-typing');
          }
        }

        typeNextChar();
      }
    })();

    var pillContainer = el('div', 'ev-chat-pills');
    var pills = [
      { text: 'Let me show you the resume options', action: 'resume', locked: false },
      { text: 'Here are questions worth asking', action: 'questions', locked: false },
      { text: 'How would we evaluate each other?', action: 'connect', locked: !fenixState.visitor.connected },
      { text: 'Let me give you a quick tour', action: 'tour', locked: false }
    ];

    pills.forEach(function (pill) {
      var btn = el('button', 'ev-chat-pill');
      btn.textContent = pill.text;
      btn.setAttribute('data-action', pill.action);

      if (pill.locked) {
        btn.classList.add('ev-locked');
        var badge = el('span', 'ev-lock-badge', { text: '\uD83D\uDD12' });
        btn.appendChild(badge);
      }

      btn.addEventListener('click', function () {
        var msgArea = document.querySelector('.ev-chat-messages');
        if (!msgArea) return;
        FC.addVisitorMessage(msgArea, pill.text);
        fenixState.explored.pillsUsed.push(pill.action);
        var pillBtn = pillContainer.querySelector('[data-action="' + pill.action + '"]');
        if (pillBtn) pillBtn.classList.add('ev-pill-used');
        FC.sendToAgent(pill.text, msgArea);
      });

      pillContainer.appendChild(btn);
    });

    wrapper.appendChild(pillContainer);

    var inputBar = el('div', 'ev-chat-input-bar');
    var inputField = el('input', 'ev-chat-input', { type: 'text', placeholder: 'Ask me anything...' });
    var sendBtn = el('button', 'ev-chat-send', { text: '\u27A4' });
    sendBtn.setAttribute('aria-label', 'Send message');

    function handleSend() {
      var text = inputField.value.trim();
      if (!text) return;
      FC.addVisitorMessage(messageArea, text);
      inputField.value = '';
      FC.sendToAgent(text, messageArea);
    }

    sendBtn.addEventListener('click', handleSend);
    inputField.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') handleSend();
    });

    inputBar.appendChild(inputField);
    inputBar.appendChild(sendBtn);
    wrapper.appendChild(inputBar);

    container.appendChild(wrapper);
  }


  // ── Fly-to-Chat Animation ─────────────────────────

  function flyCardToChat(cardEl, titleText, messageArea, callback) {
    var titleEl = cardEl.querySelector('.ev-card-title');
    if (!titleEl || !messageArea) {
      FC.addVisitorMessage(messageArea, titleText);
      if (callback) callback();
      return;
    }

    var startRect = titleEl.getBoundingClientRect();
    var endRect = messageArea.getBoundingClientRect();

    var clone = document.createElement('div');
    clone.className = 'ev-fly-clone';
    clone.textContent = titleText;

    // Position at start using transform-friendly fixed origin
    clone.style.position = 'fixed';
    clone.style.left = startRect.left + 'px';
    clone.style.top = startRect.top + 'px';
    clone.style.width = startRect.width + 'px';
    clone.style.zIndex = '10000';

    document.body.appendChild(clone);
    cardEl.classList.add('ev-card-departing');

    var endX = endRect.left + 16;
    var endY = endRect.bottom - 40;
    var midX = (startRect.left + endX) / 2;
    var midY = Math.min(startRect.top, endY) - 100;

    // Compute deltas relative to start position for translate-based animation
    var sx = startRect.left;
    var sy = startRect.top;

    clone.offsetHeight;

    var keyframes = [
      { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0 },
      { transform: 'translate(' + ((sx + midX) / 2 - sx) + 'px, ' + ((sy + midY) / 2 - sy) + 'px) scale(0.95)', opacity: 1, offset: 0.15 },
      { transform: 'translate(' + (midX - sx) + 'px, ' + (midY - sy) + 'px) scale(0.88)', opacity: 1, offset: 0.4 },
      { transform: 'translate(' + (midX + (endX - midX) * 0.3 - sx) + 'px, ' + (midY - sy) + 'px) scale(0.85)', opacity: 1, offset: 0.55 },
      { transform: 'translate(' + ((midX + endX) / 2 - sx) + 'px, ' + ((midY + endY) / 2 + 20 - sy) + 'px) scale(0.78)', opacity: 0.8, offset: 0.75 },
      { transform: 'translate(' + (endX - sx) + 'px, ' + (endY - sy) + 'px) scale(0.65)', opacity: 0, offset: 1 }
    ];

    var finished = false;
    function onComplete() {
      if (finished) return;
      finished = true;
      if (clone.parentNode) clone.parentNode.removeChild(clone);
      cardEl.classList.remove('ev-card-departing');
      var bubble = FC.addVisitorMessage(messageArea, titleText);
      if (bubble) {
        bubble.classList.add('ev-msg-landed');
        setTimeout(function () {
          bubble.classList.remove('ev-msg-landed');
        }, 800);
      }
      if (callback) callback();
    }

    try {
      var animation = clone.animate(keyframes, {
        duration: 1200,
        easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        fill: 'forwards'
      });
      animation.onfinish = onComplete;
    } catch (e) {
      // Animation API not supported or failed — fall through to timeout
    }

    // Safety net: if onfinish doesn't fire within 1500ms, force completion
    setTimeout(onComplete, 1500);
  }


  // ════════════════════════════════════════════════════
  // UNLOCK CARDS (Left Side)
  // ════════════════════════════════════════════════════

  function buildUnlockCards(container) {
    var cardsWrap = el('div', 'ev-unlock-cards');
    cardsWrap.appendChild(el('div', 'ev-unlock-cards-header', { html: 'These features were curated <span class="ev-emphasis">especially</span> for you \u2198' }));

    var cards = [
      {
        id: 'card-resume',
        icon: '\uD83D\uDCC4',
        title: 'Kiran\'s Resume, Focused on Your Role',
        tag: 'Explore freely',
        hook: 'Same experience, different emphasis — pick the lens that fits your search.',
        cta: '\u2192 Choose your lens',
        action: 'resume',
        locked: false
      },
      {
        id: 'card-questions',
        icon: '\uD83D\uDCA1',
        title: 'What Recruiters Never Ask',
        tag: 'Explore freely',
        hook: 'The questions that actually reveal fit — and my honest answers.',
        cta: '\u2192 See the questions',
        action: 'questions',
        locked: false
      },
      {
        id: 'card-fitscore',
        icon: '\u2696\uFE0F',
        title: 'Why Kiran for This Role',
        tag: 'Connect to unlock',
        hook: 'Paste a job description and I\'ll show you exactly where Kiran\'s work lines up — specific projects, results, and scale.',
        cta: '\u2192 Connect to get started',
        gateReason: 'This works better when I know who I\'m talking to.',
        action: 'connect',
        locked: !fenixState.visitor.connected
      }
    ];

    cards.forEach(function (card) {
      var cardEl = el('div', 'ev-unlock-card', { 'data-card': card.id });
      cardEl.setAttribute('role', 'button');
      cardEl.setAttribute('tabindex', '0');

      if (card.locked) {
        cardEl.classList.add('ev-locked');
        cardEl.appendChild(el('span', 'ev-lock-indicator', { text: '\uD83D\uDD12' }));
      }

      var top = el('div', 'ev-card-top');
      top.appendChild(el('div', 'ev-card-icon', { text: card.icon }));
      var meta = el('div', 'ev-card-meta');
      meta.appendChild(el('div', 'ev-card-title', { text: card.title }));
      meta.appendChild(el('div', 'ev-card-tag', { text: card.tag }));
      top.appendChild(meta);
      cardEl.appendChild(top);

      cardEl.appendChild(el('div', 'ev-card-hook', { text: card.hook }));
      if (card.gateReason) {
        cardEl.appendChild(el('div', 'ev-card-gate-reason', { text: card.gateReason }));
      }
      cardEl.appendChild(el('div', 'ev-card-cta', { text: card.cta }));

      cardEl.addEventListener('click', function () {
        cardEl.classList.add('ev-card-visited');
        fenixState.explored.cardsClicked.push(card.id);

        // Always swap to the relevant panel (fix: 3a — latest click wins)
        showPanel(card.action);

        var messageArea = document.querySelector('.ev-chat-messages');
        if (messageArea) {
          var matchingPill = document.querySelector('.ev-chat-pill[data-action="' + card.action + '"]');
          if (matchingPill) matchingPill.classList.add('ev-pill-used');
          flyCardToChat(cardEl, card.title, messageArea, function () {
            FC.sendToAgent(card.title, messageArea);
          });
        }
      });

      cardEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          showPanel(card.action);
        }
      });

      cardsWrap.appendChild(cardEl);
    });

    container.appendChild(cardsWrap);
  }


  // ════════════════════════════════════════════════════
  // PANEL MANAGEMENT
  // ════════════════════════════════════════════════════

  function showPanel(panelType) {
    closePanel();
    var zone = document.querySelector('.fenix-intro-zone');
    if (!zone) return;

    var panel = el('div', 'ev-expanded-panel ev-panel-' + panelType);

    switch (panelType) {
      case 'resume':
        renderResumeLensPanel(panel);
        break;
      case 'questions':
        renderRecruiterQuestionsPanel(panel);
        break;
      case 'connect':
        if (!fenixState.visitor.connected) {
          renderConnectGate(panel);
          panel.classList.add('ev-connect-panel');
        } else {
          renderJDInput(panel);
        }
        break;
    }

    state.currentPanel = panelType;
    zone.insertAdjacentElement('afterend', panel);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        panel.classList.add('ev-open');
      });
    });

    setTimeout(function () {
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  }

  function closePanel() {
    var existing = document.querySelector('.ev-expanded-panel');
    if (existing) {
      existing.classList.remove('ev-open');
      setTimeout(function () {
        if (existing.parentNode) existing.parentNode.removeChild(existing);
      }, 300);
    }
    state.currentPanel = null;
  }


  // ════════════════════════════════════════════════════
  // PANEL A: Resume Lens Selector
  // ════════════════════════════════════════════════════

  function renderResumeLensPanel(panel) {
    var heading = el('div', 'ev-panel-heading', {
      html: '<em>Fenix:</em> Kiran\'s resume comes in three flavors — same experience, different emphasis. Which one fits your search?'
    });
    panel.appendChild(heading);

    var lensContainer = el('div', 'ev-lens-cards-container');
    var lenses = [
      { id: 'ai', title: 'AI Product Leader', desc: 'Fenix, Fargo AI scaling (4.1M\u219227.5M), Avatour AI agents, AI strategy' },
      { id: 'growth', title: 'Growth & Experimentation', desc: 'Mobile 18M\u219232M, A/B testing, adoption metrics, data-driven product' },
      { id: 'mobile', title: 'Mobile & Consumer Product', desc: 'Mobile-first at scale, consumer UX, cross-industry product leadership' }
    ];

    var selectedLensName = null;

    // Map lens IDs to resume PDF files
    var RESUME_PDF_MAP = {
      'ai': 'template_previews/PM_1Pager.pdf',
      'growth': 'template_previews/PMM_1Pager.pdf',
      'mobile': 'template_previews/PjM_1Pager.pdf'
    };
    var selectedLensId = null;

    var footer = el('div', 'ev-lens-footer');
    var previewText = el('div', 'ev-preview-text');
    var downloadBtn = el('button', 'ev-btn-primary', { text: 'Download PDF' });
    downloadBtn.addEventListener('click', function () {
      if (!selectedLensId || !RESUME_PDF_MAP[selectedLensId]) return;
      var link = document.createElement('a');
      link.href = RESUME_PDF_MAP[selectedLensId];
      link.download = 'Kiran_Rao_Resume_' + selectedLensName.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      fenixState.explored.resumeLensSelected = selectedLensId;
      FC.saveFenixState();
    });
    append(footer, [previewText, downloadBtn]);

    var unconventionalWrap = el('div', 'ev-unconventional-link-wrap');
    var unconventionalLink = el('a', 'ev-unconventional-link', {
      text: 'Want the full picture? There\'s also a version that includes the work you\'re looking at right now \u2192',
      href: '#'
    });
    unconventionalLink.addEventListener('click', function (e) {
      e.preventDefault();
    });
    unconventionalWrap.appendChild(unconventionalLink);

    lenses.forEach(function (lens) {
      var card = el('div', 'ev-lens-card', { 'data-lens': lens.id });
      card.appendChild(el('div', 'ev-lens-title', { text: lens.title }));
      card.appendChild(el('div', 'ev-lens-desc', { text: lens.desc }));

      card.addEventListener('click', function () {
        lensContainer.querySelectorAll('.ev-lens-card').forEach(function (c) {
          c.classList.remove('ev-selected');
        });
        card.classList.add('ev-selected');
        selectedLensId = lens.id;
        selectedLensName = lens.title;
        previewText.innerHTML = '<strong>' + lens.title + '</strong> resume ready<br><small>PDF \u00B7 ATS-compatible \u00B7 1 page</small>';
        footer.classList.add('ev-active');
        unconventionalWrap.classList.add('ev-active');
      });

      lensContainer.appendChild(card);
    });

    append(panel, [lensContainer, footer, unconventionalWrap]);
  }


  // ════════════════════════════════════════════════════
  // PANEL B: Recruiter Questions
  // ════════════════════════════════════════════════════

  function renderRecruiterQuestionsPanel(panel) {
    var heading = el('div', 'ev-panel-heading', {
      html: '<em>Fenix:</em> These are the questions that actually tell you whether someone\'s the right fit — and Kiran\'s honest answers.'
    });
    panel.appendChild(heading);

    var container = el('div', 'ev-questions-container');
    RECRUITER_QUESTIONS.forEach(function (qa) {
      var card = el('div', 'ev-question-card');
      card.appendChild(el('div', 'ev-question-text', { text: qa.q }));
      card.appendChild(el('div', 'ev-question-answer', { text: qa.a }));
      container.appendChild(card);
    });
    panel.appendChild(container);
  }


  // ════════════════════════════════════════════════════
  // PANEL C: Connect Gate
  // ════════════════════════════════════════════════════

  function renderConnectGate(panel) {
    var heading = el('div', 'ev-panel-heading', {
      html: '<em>Fenix:</em> Give me a job description and I\'ll show you how Kiran\'s experience maps to it — specific projects, results, and scale from his actual work. Since this is personalized, I\'ll need to know who I\'m putting this together for.<br><br>Two ways to do that:'
    });
    panel.appendChild(heading);

    var paths = el('div', 'ev-connect-paths');

    var linkedinCard = el('div', 'ev-connect-path-card ev-linkedin');
    linkedinCard.appendChild(el('div', 'ev-path-icon', { text: 'in' }));
    linkedinCard.appendChild(el('div', 'ev-path-title', { text: 'Connect with LinkedIn' }));
    linkedinCard.appendChild(el('div', 'ev-path-subtitle', { text: 'Instant access, one click' }));
    linkedinCard.addEventListener('click', function () {
      startLinkedInConnect();
    });
    paths.appendChild(linkedinCard);

    var manualCard = el('div', 'ev-connect-path-card');
    manualCard.appendChild(el('div', 'ev-path-icon', { html: '<span style="color:var(--ev-accent);">\u270E</span>' }));
    manualCard.appendChild(el('div', 'ev-path-title', { text: 'Introduce yourself' }));
    manualCard.appendChild(el('div', 'ev-path-subtitle', { text: 'First name, last name, company — that\'s it' }));

    var form = el('form', 'ev-connect-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      handleConnectSubmit(form);
    });
    var nameRow = el('div', 'ev-form-row');
    nameRow.appendChild(el('input', 'ev-form-input ev-form-half', { type: 'text', name: 'first_name', placeholder: 'First name', required: 'true' }));
    nameRow.appendChild(el('input', 'ev-form-input ev-form-half', { type: 'text', name: 'last_name', placeholder: 'Last name', required: 'true' }));
    form.appendChild(nameRow);
    form.appendChild(el('input', 'ev-form-input', { type: 'text', name: 'company', placeholder: 'Company', required: 'true' }));
    form.appendChild(el('input', 'ev-form-input', { type: 'email', name: 'email', placeholder: 'Email (optional)' }));
    form.appendChild(el('button', 'ev-btn-primary', { type: 'submit', text: 'Let\'s go' }));

    manualCard.appendChild(form);
    paths.appendChild(manualCard);
    panel.appendChild(paths);

    var bail = el('div', 'ev-connect-bail');
    var bailLink = el('a', null, { text: 'The other features are yours to explore without signing in. Want to check out the resume options instead?' });
    bailLink.addEventListener('click', function (e) {
      e.preventDefault();
      showPanel('resume');
    });
    bail.appendChild(bailLink);
    panel.appendChild(bail);
  }


  // ════════════════════════════════════════════════════
  // JD INPUT (Post-Connect)
  // ════════════════════════════════════════════════════

  function renderJDInput(panel) {
    var firstName = (fenixState.visitor.name || 'there').split(' ')[0];
    panel.appendChild(el('p', 'ev-jd-greeting', {
      text: 'Welcome, ' + firstName + '. Paste the job description and I\'ll map Kiran\'s experience to it.'
    }));

    var form = el('form', 'ev-jd-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      handleJDSubmit(form);
    });
    form.appendChild(el('textarea', 'ev-jd-input', { placeholder: 'Paste the full job description here...' }));
    form.appendChild(el('button', 'ev-btn-primary', { type: 'submit', text: 'Why Kiran for this role' }));
    panel.appendChild(form);
  }


  // ════════════════════════════════════════════════════
  // CONNECT FORM HANDLER
  // ════════════════════════════════════════════════════

  function handleConnectSubmit(form) {
    var formData = new FormData(form);
    var firstName = (formData.get('first_name') || '').trim();
    var lastName = (formData.get('last_name') || '').trim();
    var company = (formData.get('company') || '').trim();
    var email = formData.get('email');
    if (!firstName || !lastName || !company) return;

    // Use core connect (handles localStorage, fenixState, adapter hook, guestbook POST)
    var result = FC.connectVisitor({
      first_name: firstName,
      last_name: lastName,
      company: company,
      email: email || null,
      source: 'form'
    });

    if (!result.success) return;
    showFenixMessage('Much better. This site was built for exactly this — real people, not personas. Nice to actually meet you, ' + firstName + '.');

    setTimeout(function () {
      showPanel('connect');
    }, 1200);
  }


  // ════════════════════════════════════════════════════
  // LINKEDIN OAUTH CONNECT
  // ════════════════════════════════════════════════════

  var SUPABASE_CONFIG_URL = 'https://api.kiranrao.ai/api/v1/auth/config';
  var _supabaseClient = null;

  function loadSupabaseSDK() {
    return new Promise(function (resolve, reject) {
      if (window.supabase && window.supabase.createClient) {
        resolve();
        return;
      }
      var script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      script.onload = resolve;
      script.onerror = function () { reject(new Error('Failed to load Supabase SDK')); };
      document.head.appendChild(script);
    });
  }

  function getSupabaseClient() {
    if (_supabaseClient) return Promise.resolve(_supabaseClient);
    return loadSupabaseSDK().then(function () {
      return fetch(SUPABASE_CONFIG_URL).then(function (r) { return r.json(); });
    }).then(function (config) {
      _supabaseClient = window.supabase.createClient(config.supabase_url, config.supabase_anon_key);
      return _supabaseClient;
    });
  }

  function startLinkedInConnect() {
    var subtitle = document.querySelector('.ev-linkedin .ev-path-subtitle');
    if (subtitle) subtitle.textContent = 'Connecting...';

    getSupabaseClient().then(function (sb) {
      return sb.auth.signInWithOAuth({
        provider: 'linkedin_oidc',
        options: {
          redirectTo: window.location.origin + window.location.pathname,
          scopes: 'openid profile email'
        }
      });
    }).then(function (result) {
      if (result.error) {
        console.error('[evaluator] LinkedIn OAuth error:', result.error);
        if (subtitle) subtitle.textContent = 'Error — try the form instead';
      }
      // Browser will redirect to LinkedIn
    }).catch(function (err) {
      console.error('[evaluator] LinkedIn connect failed:', err);
      if (subtitle) subtitle.textContent = 'Error — try the form instead';
    });
  }

  // Check for LinkedIn OAuth callback on page load
  function checkLinkedInCallback() {
    // Supabase OAuth returns with hash fragment containing access_token
    var hash = window.location.hash;
    if (!hash || !hash.includes('access_token')) return;

    getSupabaseClient().then(function (sb) {
      return sb.auth.getSession();
    }).then(function (result) {
      var session = result.data.session;
      if (!session || !session.user) return;

      var user = session.user;
      var meta = user.user_metadata || {};
      var fullName = meta.full_name || meta.name || '';
      var email = user.email || meta.email || '';
      // LinkedIn OIDC doesn't reliably provide company, but name + email is great
      var firstName = fullName.split(' ')[0] || '';
      var lastName = fullName.split(' ').slice(1).join(' ') || '';

      if (firstName) {
        FC.connectVisitor({
          first_name: firstName,
          last_name: lastName,
          email: email,
          company: null,
          source: 'linkedin'
        });

        // Clean up URL hash
        window.history.replaceState({}, '', window.location.pathname + window.location.search);

        // Show welcome message
        showFenixMessage('Much better. This site was built for exactly this — real people, not personas. Nice to actually meet you, ' + firstName + '.');
      }
    }).catch(function (err) {
      console.error('[evaluator] LinkedIn callback handling failed:', err);
    });
  }

  // Run callback check immediately
  checkLinkedInCallback();


  // ════════════════════════════════════════════════════
  // JD SUBMIT → FIT SCORE API
  // ════════════════════════════════════════════════════

  function handleJDSubmit(form) {
    var textarea = form.querySelector('.ev-jd-input');
    var jdText = textarea.value.trim();
    if (!jdText) return;
    showFitScoreProcessing();
    callFitScoreAPI(jdText);
  }

  // ── Fit Narrative State ──
  var fitNarrativeState = {
    company: '',
    roleTitle: '',
    preferredCompany: false,
    narrativeStarted: false
  };

  function callFitScoreAPI(jdText) {
    fitNarrativeState = {
      company: '', roleTitle: '',
      preferredCompany: false, narrativeStarted: false
    };

    var payload = {
      jd_text: jdText,
      visitor_name: state.connectedName,
      visitor_company: state.connectedCompany
    };

    fetch(API_BASE + '/api/fit-score/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
      body: JSON.stringify(payload)
    }).then(function (response) {
      if (!response.ok) throw new Error('API returned ' + response.status);
      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';

      function readChunk() {
        return reader.read().then(function (result) {
          if (result.done) {
            if (buffer.trim()) processSSEBuffer(buffer);
            return;
          }
          buffer += decoder.decode(result.value, { stream: true });
          var events = buffer.split('\n\n');
          buffer = events.pop();
          events.forEach(function (eventStr) {
            if (eventStr.trim()) processSSEBuffer(eventStr);
          });
          return readChunk();
        });
      }
      return readChunk();
    }).catch(function (err) {
      console.error('Fit Narrative API error:', err);
      showFitScoreError('Something went wrong generating the analysis. Please try again later.');
    });
  }

  function processSSEBuffer(text) {
    var lines = text.split('\n');
    lines.forEach(function (line) {
      if (line.indexOf('data: ') === 0) {
        try {
          var data = JSON.parse(line.substring(6));
          handleFitNarrativeSSE(data);
        } catch (e) { /* ignore */ }
      }
    });
  }

  function handleFitNarrativeSSE(event) {
    switch (event.type) {
      case 'narration':
        addNarrationLine(event.message);
        break;
      case 'section':
        if (!fitNarrativeState.narrativeStarted) {
          fitNarrativeState.narrativeStarted = true;
          transitionToNarrativeDisplay();
        }
        appendSectionHeader(event.id, event.label);
        break;
      case 'narrative_chunk':
        appendNarrativeText(event.text);
        break;
      case 'preferred_company':
        fitNarrativeState.preferredCompany = event.match;
        fitNarrativeState.company = event.company || '';
        break;
      case 'decline':
        showFitScoreDecline(event.message, event.missing || []);
        break;
      case 'complete':
        if (event.decline) break;
        if (event.company) fitNarrativeState.company = event.company;
        if (event.role_title) fitNarrativeState.roleTitle = event.role_title;
        finishNarrativeDisplay();
        break;
      case 'error':
        showFitScoreError(event.message || 'An error occurred.');
        break;
    }
  }


  // ════════════════════════════════════════════════════
  // FIT NARRATIVE PROCESSING & DISPLAY
  // ════════════════════════════════════════════════════

  function showFitScoreProcessing() {
    var panel = document.querySelector('.ev-expanded-panel.ev-panel-connect');
    if (!panel) return;
    panel.innerHTML = '';
    var container = el('div', 'ev-fit-processing');
    container.appendChild(el('img', 'ev-fenix-avatar ev-pulse', { src: 'images/logo.png', alt: 'Fenix' }));
    var narration = el('div', 'ev-fit-narration');
    narration.setAttribute('id', 'ev-fit-narration');
    container.appendChild(narration);
    panel.appendChild(container);
  }

  function addNarrationLine(text) {
    var narration = document.getElementById('ev-fit-narration');
    if (narration) {
      narration.appendChild(el('p', 'ev-narration-line', { text: text }));
      narration.scrollTop = narration.scrollHeight;
    }
  }

  function showFitScoreError(message) {
    var narration = document.getElementById('ev-fit-narration');
    if (narration) {
      narration.appendChild(el('p', 'ev-error-message', { text: message }));
    }
  }

  function transitionToNarrativeDisplay() {
    var panel = document.querySelector('.ev-expanded-panel.ev-panel-connect');
    if (!panel) return;
    panel.innerHTML = '';

    var container = el('div', 'ev-fit-narrative');
    container.appendChild(el('h2', 'ev-narrative-title', { text: 'Why Kiran for this role' }));

    if (fitNarrativeState.preferredCompany) {
      container.appendChild(el('div', 'ev-preferred-badge', {
        text: 'Kiran is actively interested in ' + fitNarrativeState.company
      }));
    }

    var body = el('div', 'ev-narrative-body');
    body.setAttribute('id', 'ev-narrative-body');
    container.appendChild(body);
    panel.appendChild(container);
  }

  function appendSectionHeader(sectionId, label) {
    var body = document.getElementById('ev-narrative-body');
    if (!body) return;

    var section = el('div', 'ev-narrative-section');
    section.setAttribute('data-section', sectionId);
    section.appendChild(el('h3', 'ev-narrative-section-header', { text: label }));

    var content = el('div', 'ev-narrative-section-content');
    var prev = body.querySelector('#ev-narrative-active');
    if (prev) prev.removeAttribute('id');
    content.setAttribute('id', 'ev-narrative-active');
    section.appendChild(content);

    body.appendChild(section);
    body.scrollTop = body.scrollHeight;
  }

  function appendNarrativeText(text) {
    var target = document.getElementById('ev-narrative-active');
    if (!target) target = document.getElementById('ev-narrative-body');
    if (!target) return;

    var existing = target.lastChild;
    if (existing && existing.nodeType === 3) {
      existing.textContent += text;
    } else {
      target.appendChild(document.createTextNode(text));
    }

    var body = document.getElementById('ev-narrative-body');
    if (body) body.scrollTop = body.scrollHeight;
  }

  function finishNarrativeDisplay() {
    var body = document.getElementById('ev-narrative-body');
    if (!body) return;
    var active = body.querySelector('#ev-narrative-active');
    if (active) active.removeAttribute('id');

    var panel = document.querySelector('.ev-fit-narrative');
    if (!panel) return;

    var actions = el('div', 'ev-narrative-actions');
    var tryAnother = el('button', 'ev-btn-secondary', { text: 'Try with a different JD' });
    tryAnother.addEventListener('click', function () { showPanel('connect'); });
    actions.appendChild(tryAnother);
    panel.appendChild(actions);
  }

  function showFitScoreDecline(reason, missing) {
    var panel = document.querySelector('.ev-expanded-panel.ev-panel-connect');
    if (!panel) return;
    panel.innerHTML = '';
    var container = el('div', 'ev-decline');
    container.appendChild(el('p', null, { text: reason }));
    if (missing && missing.length > 0) {
      var list = el('ul');
      missing.forEach(function (item) { list.appendChild(el('li', null, { text: item })); });
      container.appendChild(list);
    }
    var retryBtn = el('button', 'ev-btn-primary', { text: 'Try with a different JD' });
    retryBtn.style.marginTop = '1.5rem';
    retryBtn.addEventListener('click', function () { showPanel('connect'); });
    container.appendChild(retryBtn);
    panel.appendChild(container);
  }


  // ════════════════════════════════════════════════════
  // CONNECTED STATE
  // ════════════════════════════════════════════════════

  function applyConnectedState() {
    var lockedCard = document.querySelector('[data-card="card-fitscore"]');
    if (lockedCard) {
      lockedCard.classList.remove('ev-locked');
      var lockInd = lockedCard.querySelector('.ev-lock-indicator');
      if (lockInd) lockInd.remove();
      var tag = lockedCard.querySelector('.ev-card-tag');
      if (tag) tag.textContent = 'Connected';
    }

    var pills = document.querySelectorAll('.ev-chat-pill');
    pills.forEach(function (pill) {
      if (pill.textContent.indexOf('evaluate each other') !== -1) {
        pill.classList.remove('ev-locked');
        var badge = pill.querySelector('.ev-lock-badge');
        if (badge) badge.remove();
      }
    });

    if (fenixState.visitor.connected) {
      transitionNameLabel();
    }
  }

  function transitionNameLabel() {
    var displayName = fenixState.visitor.name || '';
    if (!displayName) return;
    // Require at least two distinct words (first + last name) before replacing the label.
    // Prevents partial identities like "Joe" or hallucinated "Joe Joe" from showing.
    var nameParts = displayName.trim().split(/\s+/);
    if (nameParts.length < 2) return;
    if (nameParts[0].toLowerCase() === nameParts[1].toLowerCase()) return;
    // Target the context header name span ("The Evaluator" / "Explorer") + any legacy selectors
    var labels = document.querySelectorAll('.fenix-context-name, .pill-persona-name, .hero-tagline');
    labels.forEach(function (label) {
      var text = label.textContent.trim();
      if (text === 'The Evaluator' || text === 'Explorer' || text.indexOf('The ') === 0) {
        label.classList.add('ev-name-transitioning');
        setTimeout(function () {
          label.textContent = displayName;
          label.classList.remove('ev-name-transitioning');
        }, 300);
      }
    });
  }

  function showFenixMessage(text) {
    var fenixCol = document.querySelector('.ev-fenix-column');
    if (!fenixCol) return;
    var msg = el('div', 'ev-transition-message', { text: text });
    var openingFrame = fenixCol.querySelector('.ev-fenix-opening-frame');
    if (openingFrame && openingFrame.nextSibling) {
      fenixCol.insertBefore(msg, openingFrame.nextSibling);
    } else {
      fenixCol.appendChild(msg);
    }
    setTimeout(function () { msg.style.opacity = '0.6'; }, 10000);
  }


  // ════════════════════════════════════════════════════
  // ADAPTER DEFINITION
  // ════════════════════════════════════════════════════

  var evaluatorAdapter = {
    // Identity
    persona: 'evaluator',
    accentColor: '#C9A87C',
    agentUrl: 'https://api.kiranrao.ai/api/v1/fenix/agent',
    messageCap: 30,

    // Available tools (sent to backend)
    availableTools: ['open_panel', 'close_panel', 'select_resume_lens', 'scroll_to_section', 'get_visitor_context', 'start_fit_score', 'connect_visitor', 'collect_feedback', 'show_related_content'],

    // UI
    buildUI: buildUI,
    showPanel: showPanel,
    openingMessage: FENIX_OPENING,

    // Pills — Option C: agent conversational + frontend contextual
    getDefaultPills: getDefaultPills,
    getContextualPills: getContextualPills,

    // Tools
    toolExecutors: toolExecutors,
    toolLabels: toolLabels,

    // Lifecycle hooks
    onMessageCapReached: function () {
      if (!fenixState.visitor.connected) {
        showPanel('connect');
      }
    },
    onConnect: function (data) {
      applyConnectedState();
    },
    onPillAction: function (pill) {
      // Handle contextual action pills (non-agent actions)
      if (pill.action === 'connect' || pill.action === 'resume' || pill.action === 'questions') {
        showPanel(pill.action);
        return true; // handled — don't send to agent
      }
      if (pill.action === 'tour') {
        return false; // let agent handle the tour
      }
      return false; // default: send to agent
    },
    onToolResult: null,
    onDone: null
  };


  // ════════════════════════════════════════════════════
  // EXPORT — backwards-compatible with persona-system.js
  // ════════════════════════════════════════════════════

  window.EvaluatorExperience = {
    init: function (persona) {
      if (persona === 'evaluator') {
        FC.init(evaluatorAdapter);
      }
    },
    showPanel: showPanel,
    closePanel: closePanel
  };

})();
