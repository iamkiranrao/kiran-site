/**
 * ============================================
 * EVALUATOR EXPERIENCE
 * Full interactive experience for the Evaluator persona
 * Replaces default Fenix intro rendering when persona === 'evaluator'
 *
 * Visual reference: prototypes/evaluator-unlock-v1.html
 * Backend: command-center/backend/routers/fit_score.py
 * Hook: persona-system.js lines 802-806
 * ============================================
 */

(function () {
  'use strict';

  // ── Configuration ──────────────────────────────────
  var API_BASE = 'https://cc.kiranrao.ai';
  var API_KEY = 'H3Ycu0N5kfv5MERh_5mYwYcMbGu6pYUv2y1KSgsMBLk';

  // ── Fenix Opening Frame Text (Locked — April 4, 2026) ──
  var FENIX_OPENING = 'Quick context before we start. This isn\'t a portfolio site. It\'s a product Kiran built.\n\nThe resume comes in three versions, each tuned to a different kind of search. There\'s a Fit Score that evaluates both directions — whether Kiran fits the role and whether the role fits Kiran. And I\'m not a template chatbot. I\'ve been trained on Kiran\'s actual work, his decisions, and how he thinks.\n\nThis site isn\'t designed for a 30-second skim. But every minute you spend here will surface insights you\'d otherwise spend weeks piecing together. The more you experience, the more you understand about how Kiran thinks and works.\n\nI\'m here to help you focus on what matters to you.';

  // ── Recruiter Questions (Kiran to author answers) ──
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

  // ── State ──────────────────────────────────────────
  var state = {
    currentPanel: null,
    connectedName: localStorage.getItem('evaluator_name'),
    connectedCompany: localStorage.getItem('evaluator_company'),
    connectedEmail: localStorage.getItem('evaluator_email')
  };

  // ── Utility ────────────────────────────────────────
  function el(tag, cls, attrs) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    return node;
  }

  function append(parent, children) {
    children.forEach(function (c) { parent.appendChild(c); });
    return parent;
  }

  // ── Staggered Reveal (scroll-triggered) ────────────
  function revealZoneElements() {
    // Stagger-reveal all evaluator zone elements
    // Stagger timing (ms): element → delay
    var reveals = [
      { sel: '.ev-unlock-cards-header', delay: 0 },
      { sel: '.ev-fenix-chat', delay: 0 },
      { sel: '.ev-unlock-card:nth-child(2)', delay: 150 },  // 1st card (header is nth-child 1)
      { sel: '.ev-unlock-card:nth-child(3)', delay: 300 },  // 2nd card
      { sel: '.ev-unlock-card:nth-child(4)', delay: 450 },  // 3rd card
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
  }

  // ── Main Initialization ────────────────────────────
  function init() {
    var rightCol = document.querySelector('.fenix-intro-right');
    var leftCol = document.querySelector('.fenix-intro-left');
    if (!rightCol || !leftCol) return;

    // Clear default persona-system content
    rightCol.innerHTML = '';
    leftCol.innerHTML = '';

    // Build the experience
    buildFenixColumn(rightCol);
    buildUnlockCards(leftCol);

    // Scroll-triggered entrance animations via IntersectionObserver
    // Elements start at opacity:0 in CSS; we add .ev-revealed with staggered timing
    //
    // CRITICAL: init() may be called BEFORE the morph choreography finishes.
    // During morph, #work transitions through hidden/fixed states that cause
    // the IntersectionObserver to fire incorrectly (or not at all).
    // Solution: wait for morph-complete before setting up the observer.
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

    // Wait for morph choreography to finish before setting up scroll reveal.
    // init() is called before the morph starts — #work transitions through
    // hidden/fixed states that cause IntersectionObserver to misfire.
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

    // Restore state if already connected
    if (state.connectedName) {
      applyConnectedState();
    }
  }


  // ════════════════════════════════════════════════════
  // FENIX COLUMN (Right Side)
  // ════════════════════════════════════════════════════

  function buildFenixColumn(container) {
    var wrapper = el('div', 'ev-fenix-chat');

    // ── Chat Header (compact identity anchor) ──
    var chatHeader = el('div', 'ev-chat-header');
    var headerAvatar = el('img', 'ev-chat-avatar', { src: 'images/logo.png', alt: 'Fenix' });
    var headerInfo = el('div', 'ev-chat-header-info');
    headerInfo.appendChild(el('span', 'ev-chat-header-name', { text: 'Fenix' }));
    headerInfo.appendChild(el('span', 'ev-chat-header-sub', { text: 'I know Kiran\'s work better than his resume does.' }));
    chatHeader.appendChild(headerAvatar);
    chatHeader.appendChild(headerInfo);
    wrapper.appendChild(chatHeader);

    // ── Message Area (scrollable conversation) ──
    var messageArea = el('div', 'ev-chat-messages');

    // First Fenix message — the short pitch (not the full opening frame)
    addFenixMessage(messageArea, 'I can walk you through Kiran\'s experience, pull up the resume that fits your search, or — if you\'re up for it — help you both figure out whether this is actually a match. The buttons below are the fast paths. Or just ask me whatever\'s on your mind.');

    wrapper.appendChild(messageArea);

    // ── Pills (one-shot starters) ──
    var pillContainer = el('div', 'ev-chat-pills');

    var pills = [
      { text: 'Show me resume options', action: 'resume', locked: false },
      { text: 'What should I be asking?', action: 'questions', locked: false },
      { text: 'How would we evaluate each other?', action: 'connect', locked: !state.connectedName },
      { text: 'Give me a quick tour', action: 'tour', locked: false }
    ];

    pills.forEach(function (pill) {
      var btn = el('button', 'ev-chat-pill');
      btn.textContent = pill.text;
      btn.setAttribute('data-action', pill.action);

      if (pill.locked) {
        btn.classList.add('ev-locked');
        var badge = el('span', 'ev-lock-badge', { text: '🔒' });
        btn.appendChild(badge);
      }

      btn.addEventListener('click', function () {
        handlePillClick(pill, pillContainer);
      });

      pillContainer.appendChild(btn);
    });

    wrapper.appendChild(pillContainer);

    // ── Text Input Bar ──
    var inputBar = el('div', 'ev-chat-input-bar');
    var inputField = el('input', 'ev-chat-input', { type: 'text', placeholder: 'Ask me anything...' });
    var sendBtn = el('button', 'ev-chat-send', { text: '➤' });
    sendBtn.setAttribute('aria-label', 'Send message');

    function handleSend() {
      var text = inputField.value.trim();
      if (!text) return;
      addVisitorMessage(messageArea, text);
      inputField.value = '';
      // Stubbed Fenix response — backend integration is a separate workstream
      setTimeout(function () {
        addFenixMessage(messageArea, 'I\'m still learning to think on my feet — for now, try one of the quick options above, or click an unlock card on the left. Full conversation mode is coming soon.');
      }, 600);
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

  // ── Chat Message Helpers ──────────────────────────

  function addFenixMessage(messageArea, text) {
    var bubble = el('div', 'ev-msg ev-msg-fenix');
    var avatar = el('img', 'ev-msg-avatar', { src: 'images/logo.png', alt: 'Fenix' });
    var content = el('div', 'ev-msg-content');
    content.textContent = text;
    bubble.appendChild(avatar);
    bubble.appendChild(content);
    messageArea.appendChild(bubble);
    messageArea.scrollTop = messageArea.scrollHeight;
  }

  function addVisitorMessage(messageArea, text) {
    var bubble = el('div', 'ev-msg ev-msg-visitor');
    var content = el('div', 'ev-msg-content');
    content.textContent = text;
    bubble.appendChild(content);
    messageArea.appendChild(bubble);
    messageArea.scrollTop = messageArea.scrollHeight;
    return bubble;
  }

  // ── Fly-to-Chat Animation ─────────────────────────
  // Clones a card's title text, animates it in an arc from the card
  // to the chat message area, then dissolves into a visitor message bubble.

  function flyCardToChat(cardEl, titleText, messageArea, callback) {
    var titleEl = cardEl.querySelector('.ev-card-title');
    if (!titleEl || !messageArea) {
      // Fallback: skip animation, just add message
      addVisitorMessage(messageArea, titleText);
      if (callback) callback();
      return;
    }

    var startRect = titleEl.getBoundingClientRect();
    var endRect = messageArea.getBoundingClientRect();

    // Create the flying clone
    var clone = document.createElement('div');
    clone.className = 'ev-fly-clone';
    clone.textContent = titleText;

    // Position at the source card title
    clone.style.position = 'fixed';
    clone.style.left = startRect.left + 'px';
    clone.style.top = startRect.top + 'px';
    clone.style.width = startRect.width + 'px';
    clone.style.zIndex = '10000';

    document.body.appendChild(clone);

    // Card press feedback
    cardEl.classList.add('ev-card-departing');

    // Calculate end position (land near top-right of message area)
    var endX = endRect.left + 16;
    var endY = endRect.bottom - 40;

    // Arc midpoint — rise above both start and end, exaggerated for visibility
    var midX = (startRect.left + endX) / 2;
    var midY = Math.min(startRect.top, endY) - 100;

    // Force a reflow so the starting position is painted
    clone.offsetHeight;

    // Animate using Web Animations API for smooth arc
    // Three-phase: lift off (slow), cruise (steady), land & dissolve (ease out)
    var keyframes = [
      {
        left: startRect.left + 'px',
        top: startRect.top + 'px',
        opacity: 1,
        transform: 'scale(1)',
        offset: 0
      },
      {
        left: (startRect.left + midX) / 2 + 'px',
        top: (startRect.top + midY) / 2 + 'px',
        opacity: 1,
        transform: 'scale(0.92)',
        offset: 0.2
      },
      {
        left: midX + 'px',
        top: midY + 'px',
        opacity: 0.9,
        transform: 'scale(0.82)',
        offset: 0.5
      },
      {
        left: (midX + endX) / 2 + 'px',
        top: (midY + endY) / 2 + 20 + 'px',
        opacity: 0.7,
        transform: 'scale(0.75)',
        offset: 0.75
      },
      {
        left: endX + 'px',
        top: endY + 'px',
        opacity: 0,
        transform: 'scale(0.6)',
        offset: 1
      }
    ];

    var animation = clone.animate(keyframes, {
      duration: 750,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      fill: 'forwards'
    });

    animation.onfinish = function () {
      // Remove clone
      if (clone.parentNode) clone.parentNode.removeChild(clone);

      // Remove card feedback
      cardEl.classList.remove('ev-card-departing');

      // Now add the real visitor message with landing effect
      var bubble = addVisitorMessage(messageArea, titleText);
      if (bubble) {
        // Accent stroke + jiggle to complete the "it landed" effect
        bubble.classList.add('ev-msg-landed');
        // Remove the landed class after animation completes
        setTimeout(function () {
          bubble.classList.remove('ev-msg-landed');
        }, 800);
      }

      if (callback) callback();
    };
  }

  function handlePillClick(pill, pillContainer) {
    var messageArea = document.querySelector('.ev-chat-messages');
    if (!messageArea) return;

    // Pill text becomes visitor message
    addVisitorMessage(messageArea, pill.text);

    // Remove all pills (one-shot starters)
    pillContainer.classList.add('ev-pills-hidden');

    // Trigger the panel action after a beat
    setTimeout(function () {
      if (pill.action === 'tour') {
        addFenixMessage(messageArea, 'Let me show you around. This site has three resume lenses, a set of honest Q&As that go beyond the standard interview, and — if you connect — a mutual Fit Score. What catches your eye?');
      } else {
        showPanel(pill.action);
      }
    }, 400);
  }


  // ════════════════════════════════════════════════════
  // UNLOCK CARDS (Left Side)
  // ════════════════════════════════════════════════════

  function buildUnlockCards(container) {
    var cardsWrap = el('div', 'ev-unlock-cards');

    // Section header
    cardsWrap.appendChild(el('div', 'ev-unlock-cards-header', { text: 'Your Unlocks' }));

    var cards = [
      {
        id: 'card-resume',
        icon: '📄',
        title: 'My Resume, Focused for Your Role',
        tag: 'Explore freely',
        hook: 'Same experience, different emphasis — pick the lens that fits your search.',
        cta: '→ Choose your lens',
        action: 'resume',
        locked: false
      },
      {
        id: 'card-questions',
        icon: '💡',
        title: 'What Recruiters Never Ask',
        tag: 'Explore freely',
        hook: 'The questions that actually reveal fit — and my honest answers.',
        cta: '→ See the questions',
        action: 'questions',
        locked: false
      },
      {
        id: 'card-fitscore',
        icon: '⚖️',
        title: 'Does This Role Fit Both of Us?',
        tag: 'Connect to unlock',
        hook: 'Mutual evaluation — how your role matches my experience, and how it matches what I\'m looking for.',
        cta: '→ Connect to build your Fit Score',
        gateReason: 'This works better when I know who I\'m talking to.',
        action: 'connect',
        locked: !state.connectedName
      }
    ];

    cards.forEach(function (card) {
      var cardEl = el('div', 'ev-unlock-card', { 'data-card': card.id });
      cardEl.setAttribute('role', 'button');
      cardEl.setAttribute('tabindex', '0');

      if (card.locked) {
        cardEl.classList.add('ev-locked');
        // Lock indicator
        cardEl.appendChild(el('span', 'ev-lock-indicator', { text: '🔒' }));
      }

      // Card top: icon + meta
      var top = el('div', 'ev-card-top');
      top.appendChild(el('div', 'ev-card-icon', { text: card.icon }));

      var meta = el('div', 'ev-card-meta');
      meta.appendChild(el('div', 'ev-card-title', { text: card.title }));
      meta.appendChild(el('div', 'ev-card-tag', { text: card.tag }));
      top.appendChild(meta);

      cardEl.appendChild(top);

      // Hook text
      cardEl.appendChild(el('div', 'ev-card-hook', { text: card.hook }));

      // Gate reason (connected cards only, shown on hover via CSS)
      if (card.gateReason) {
        cardEl.appendChild(el('div', 'ev-card-gate-reason', { text: card.gateReason }));
      }

      // CTA (shown on hover via CSS)
      cardEl.appendChild(el('div', 'ev-card-cta', { text: card.cta }));

      // Click handler — fly card title to chat, then open panel
      // Matching pill fades out; other pills stay for continued conversation
      cardEl.addEventListener('click', function () {
        var messageArea = document.querySelector('.ev-chat-messages');
        if (messageArea) {
          // Fade out the matching pill (same action = same intent, no need to show it twice)
          var matchingPill = document.querySelector('.ev-chat-pill[data-action="' + card.action + '"]');
          if (matchingPill) {
            matchingPill.classList.add('ev-pill-used');
          }

          // Fly the card title into the chat, then open the panel on landing
          flyCardToChat(cardEl, card.title, messageArea, function () {
            showPanel(card.action);
          });
        } else {
          showPanel(card.action);
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
        if (!state.connectedName) {
          renderConnectGate(panel);
          panel.classList.add('ev-connect-panel');
        } else {
          renderJDInput(panel);
        }
        break;
    }

    state.currentPanel = panelType;
    zone.insertAdjacentElement('afterend', panel);

    // Trigger animation
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        panel.classList.add('ev-open');
      });
    });

    // Scroll into view
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
      { id: 'ai', title: 'AI Product Leader', desc: 'Fenix, Fargo AI scaling (4.1M→27.5M), Avatour AI agents, AI strategy' },
      { id: 'growth', title: 'Growth & Experimentation', desc: 'Mobile 18M→32M, A/B testing, adoption metrics, data-driven product' },
      { id: 'mobile', title: 'Mobile & Consumer Product', desc: 'Mobile-first at scale, consumer UX, cross-industry product leadership' }
    ];

    var selectedLensName = null;

    var footer = el('div', 'ev-lens-footer');
    var previewText = el('div', 'ev-preview-text');
    var downloadBtn = el('button', 'ev-btn-primary', { text: 'Download PDF' });
    downloadBtn.addEventListener('click', function () {
      // TODO: actual resume download
    });
    append(footer, [previewText, downloadBtn]);

    var unconventionalWrap = el('div', 'ev-unconventional-link-wrap');
    var unconventionalLink = el('a', 'ev-unconventional-link', {
      text: 'Want the full picture? There\'s also a version that includes the work you\'re looking at right now →',
      href: '#'
    });
    unconventionalLink.addEventListener('click', function (e) {
      e.preventDefault();
      // TODO: show unconventional resume view
    });
    unconventionalWrap.appendChild(unconventionalLink);

    lenses.forEach(function (lens) {
      var card = el('div', 'ev-lens-card', { 'data-lens': lens.id });
      card.appendChild(el('div', 'ev-lens-title', { text: lens.title }));
      card.appendChild(el('div', 'ev-lens-desc', { text: lens.desc }));

      card.addEventListener('click', function () {
        // Deselect all
        lensContainer.querySelectorAll('.ev-lens-card').forEach(function (c) {
          c.classList.remove('ev-selected');
        });
        card.classList.add('ev-selected');
        selectedLensName = lens.title;

        // Show footer
        previewText.innerHTML = '<strong>' + lens.title + '</strong> resume ready<br><small>PDF · ATS-compatible · 1 page</small>';
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
      html: '<em>Fenix:</em> The Fit Score goes both ways — it evaluates how your role aligns with Kiran\'s experience, and how Kiran\'s priorities align with what you\'re offering. To make that work, I need a job description to analyze. And since this generates a personalized report, I\'ll need to know who I\'m building it for.<br><br>Two ways to do that:'
    });
    panel.appendChild(heading);

    var paths = el('div', 'ev-connect-paths');

    // LinkedIn path
    var linkedinCard = el('div', 'ev-connect-path-card ev-linkedin');
    linkedinCard.appendChild(el('div', 'ev-path-icon', { text: 'in' }));
    linkedinCard.appendChild(el('div', 'ev-path-title', { text: 'Connect with LinkedIn' }));
    linkedinCard.appendChild(el('div', 'ev-path-subtitle', { text: 'Instant access, one click' }));
    linkedinCard.addEventListener('click', function () {
      // TODO: LinkedIn OAuth (blocked on Kiran registering dev app)
    });
    paths.appendChild(linkedinCard);

    // Manual path
    var manualCard = el('div', 'ev-connect-path-card');
    manualCard.appendChild(el('div', 'ev-path-icon', { html: '<span style="color:var(--ev-accent);">✎</span>' }));
    manualCard.appendChild(el('div', 'ev-path-title', { text: 'Introduce yourself' }));
    manualCard.appendChild(el('div', 'ev-path-subtitle', { text: 'Name + company — that\'s it' }));

    var form = el('form', 'ev-connect-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      handleConnectSubmit(form);
    });

    form.appendChild(el('input', 'ev-form-input', { type: 'text', name: 'name', placeholder: 'Your name', required: 'true' }));
    form.appendChild(el('input', 'ev-form-input', { type: 'text', name: 'company', placeholder: 'Company', required: 'true' }));
    form.appendChild(el('input', 'ev-form-input', { type: 'email', name: 'email', placeholder: 'Email (optional)' }));
    form.appendChild(el('button', 'ev-btn-primary', { type: 'submit', text: 'Let\'s go' }));

    manualCard.appendChild(form);
    paths.appendChild(manualCard);
    panel.appendChild(paths);

    // Bail-out
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
    panel.appendChild(el('p', 'ev-jd-greeting', {
      text: 'Welcome, ' + state.connectedName + '. Got it. Now paste the job description you\'re evaluating Kiran for, and I\'ll build the Fit Score.'
    }));

    var form = el('form', 'ev-jd-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      handleJDSubmit(form);
    });

    form.appendChild(el('textarea', 'ev-jd-input', { placeholder: 'Paste the full job description here...' }));
    form.appendChild(el('button', 'ev-btn-primary', { type: 'submit', text: 'Build my Fit Score' }));

    panel.appendChild(form);
  }


  // ════════════════════════════════════════════════════
  // CONNECT FORM HANDLER
  // ════════════════════════════════════════════════════

  function handleConnectSubmit(form) {
    var formData = new FormData(form);
    var name = formData.get('name');
    var company = formData.get('company');
    var email = formData.get('email');

    if (!name || !company) return;

    state.connectedName = name;
    state.connectedCompany = company;
    state.connectedEmail = email;

    localStorage.setItem('evaluator_name', name);
    localStorage.setItem('evaluator_company', company);
    if (email) localStorage.setItem('evaluator_email', email);

    applyConnectedState();

    // Show Fenix's transition message
    showFenixMessage('Much better. This site was built for exactly this — real people, not personas. Nice to actually meet you, ' + name + '.');

    // Transition to JD input
    setTimeout(function () {
      showPanel('connect');
    }, 1200);
  }


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

  // ── Fit Score Results Accumulator ──
  var fitScoreResults = {
    roleToKiran: [],
    kiranToRole: [],
    roleToKiranComposite: 0,
    kiranToRoleComposite: 0,
    preferredCompany: false,
    gapNotes: [],
    company: '',
    roleTitle: ''
  };

  function callFitScoreAPI(jdText) {
    // Reset results
    fitScoreResults = {
      roleToKiran: [],
      kiranToRole: [],
      roleToKiranComposite: 0,
      kiranToRoleComposite: 0,
      preferredCompany: false,
      gapNotes: [],
      company: '',
      roleTitle: ''
    };

    var payload = {
      jd_text: jdText,
      visitor_name: state.connectedName,
      visitor_company: state.connectedCompany
    };

    fetch(API_BASE + '/api/fit-score/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
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
      console.error('Fit Score API error:', err);
      showFitScoreError('Could not generate Fit Score. The backend may not be running. Please try again later.');
    });
  }

  function processSSEBuffer(text) {
    var lines = text.split('\n');
    lines.forEach(function (line) {
      if (line.indexOf('data: ') === 0) {
        try {
          var data = JSON.parse(line.substring(6));
          handleSSEEvent(data);
        } catch (e) {
          // Ignore parse errors for incomplete chunks
        }
      }
    });
  }

  function handleSSEEvent(event) {
    switch (event.type) {
      case 'narration':
        addNarrationLine(event.message);
        break;

      case 'role_to_kiran':
        fitScoreResults.roleToKiran.push({
          name: event.name,
          score: event.score,
          band: event.band,
          reasoning: event.reasoning,
          gap_note: event.gap_note || null
        });
        break;

      case 'kiran_to_role':
        fitScoreResults.kiranToRole.push({
          name: event.name,
          score: event.score,
          band: event.band,
          reasoning: event.reasoning,
          gap_note: event.gap_note || null
        });
        break;

      case 'composite':
        fitScoreResults.roleToKiranComposite = event.role_to_kiran;
        fitScoreResults.kiranToRoleComposite = event.kiran_to_role;
        break;

      case 'preferred_company':
        fitScoreResults.preferredCompany = event.match;
        if (event.match) {
          addNarrationLine('Cross-referencing against Kiran\'s target companies... match found.');
        }
        break;

      case 'gap_notes':
        fitScoreResults.gapNotes = event.summary || [];
        break;

      case 'decline':
        showFitScoreDecline(event.message, event.missing || []);
        break;

      case 'complete':
        if (event.decline) break;
        if (event.company) fitScoreResults.company = event.company;
        if (event.role_title) fitScoreResults.roleTitle = event.role_title;
        renderFitScoreResults();
        break;

      case 'error':
        showFitScoreError(event.message || 'An error occurred.');
        break;
    }
  }


  // ════════════════════════════════════════════════════
  // FIT SCORE PROCESSING STATE
  // ════════════════════════════════════════════════════

  function showFitScoreProcessing() {
    var panel = document.querySelector('.ev-expanded-panel.ev-panel-connect');
    if (!panel) return;
    panel.innerHTML = '';

    var container = el('div', 'ev-fit-processing');

    var avatar = el('img', 'ev-fenix-avatar ev-pulse', { src: 'images/logo.png', alt: 'Fenix' });
    container.appendChild(avatar);

    var narration = el('div', 'ev-fit-narration');
    narration.setAttribute('id', 'ev-fit-narration');
    container.appendChild(narration);

    panel.appendChild(container);
  }

  function addNarrationLine(text) {
    var narration = document.getElementById('ev-fit-narration');
    if (narration) {
      var line = el('p', 'ev-narration-line', { text: text });
      narration.appendChild(line);
      narration.scrollTop = narration.scrollHeight;
    }
  }

  function showFitScoreError(message) {
    var narration = document.getElementById('ev-fit-narration');
    if (narration) {
      var errEl = el('p', 'ev-error-message', { text: message });
      narration.appendChild(errEl);
    }
  }


  // ════════════════════════════════════════════════════
  // FIT SCORE RESULTS RENDERING
  // ════════════════════════════════════════════════════

  function renderFitScoreResults() {
    var panel = document.querySelector('.ev-expanded-panel.ev-panel-connect');
    if (!panel) return;
    panel.innerHTML = '';

    var results = el('div', 'ev-results');

    // ── Composites ──
    var composites = el('div', 'ev-composites');
    composites.appendChild(renderComposite('Role → Kiran', fitScoreResults.roleToKiranComposite, 'Can Kiran do this job?'));
    composites.appendChild(renderComposite('Kiran → Role', fitScoreResults.kiranToRoleComposite, 'Does Kiran want this job?'));
    results.appendChild(composites);

    // ── Preferred company badge ──
    if (fitScoreResults.preferredCompany) {
      results.appendChild(el('div', 'ev-preferred-badge', {
        text: '★ This is a company Kiran is actively interested in'
      }));
    }

    // ── Dimensions ──
    var dims = el('div', 'ev-dimensions');

    dims.appendChild(el('h3', 'ev-dim-section-title', { text: 'Role → Kiran' }));
    fitScoreResults.roleToKiran.forEach(function (d) {
      dims.appendChild(renderDimension(d));
    });

    dims.appendChild(el('h3', 'ev-dim-section-title', { text: 'Kiran → Role' }));
    fitScoreResults.kiranToRole.forEach(function (d) {
      dims.appendChild(renderDimension(d));
    });

    results.appendChild(dims);

    // ── Gap summary ──
    if (fitScoreResults.gapNotes.length > 0) {
      var gapSection = el('div', 'ev-gap-summary');
      gapSection.appendChild(el('h3', null, { text: 'What would increase these scores' }));

      var gapList = el('ul');
      fitScoreResults.gapNotes.forEach(function (note) {
        gapList.appendChild(el('li', null, { text: note }));
      });
      gapSection.appendChild(gapList);
      results.appendChild(gapSection);
    }

    // ── Action buttons ──
    var actions = el('div', 'ev-results-actions');

    var dlBtn = el('button', 'ev-btn-primary', { text: 'Download as PDF' });
    dlBtn.addEventListener('click', function () {
      // TODO: PDF export
    });

    var emailBtn = el('button', 'ev-btn-secondary', { text: 'Email me this' });
    emailBtn.addEventListener('click', function () {
      // TODO: Email report
    });

    append(actions, [dlBtn, emailBtn]);
    results.appendChild(actions);

    // ── Bridge line ──
    results.appendChild(el('p', 'ev-bridge-line', {
      text: 'That\'s the picture from what I can see in the JD. If you want to explore any dimension deeper, just ask.'
    }));

    panel.appendChild(results);
  }

  function renderComposite(label, score, subtitle) {
    var card = el('div', 'ev-composite');
    card.appendChild(el('div', 'ev-composite-direction', { text: label }));

    var scoreEl = el('div', 'ev-composite-score', { text: score + '%' });
    scoreEl.classList.add('ev-composite-score--' + getBand(score).toLowerCase());
    card.appendChild(scoreEl);

    card.appendChild(el('div', 'ev-composite-band', { text: getBand(score) }));
    card.appendChild(el('div', 'ev-composite-subtitle', { text: subtitle }));

    return card;
  }

  function renderDimension(d) {
    var row = el('div', 'ev-dimension');

    var header = el('div', 'ev-dimension-header');
    header.appendChild(el('span', 'ev-dimension-name', { text: d.name }));

    var scoreWrap = el('span');
    scoreWrap.appendChild(el('span', 'ev-dimension-score', { text: d.score + '%' }));
    scoreWrap.appendChild(el('span', 'ev-dimension-band', { text: d.band }));
    header.appendChild(scoreWrap);

    row.appendChild(header);
    row.appendChild(el('p', 'ev-dimension-reasoning', { text: d.reasoning }));

    if (d.gap_note) {
      row.appendChild(el('p', 'ev-dimension-gap', { text: '→ ' + d.gap_note }));
    }

    return row;
  }

  function getBand(score) {
    if (score >= 85) return 'Strong';
    if (score >= 65) return 'Solid';
    if (score >= 45) return 'Partial';
    return 'Stretch';
  }

  function showFitScoreDecline(reason, missing) {
    var panel = document.querySelector('.ev-expanded-panel.ev-panel-connect');
    if (!panel) return;
    panel.innerHTML = '';

    var container = el('div', 'ev-decline');
    container.appendChild(el('p', null, { text: reason }));

    if (missing && missing.length > 0) {
      var list = el('ul');
      missing.forEach(function (item) {
        list.appendChild(el('li', null, { text: item }));
      });
      container.appendChild(list);
    }

    var retryBtn = el('button', 'ev-btn-primary', { text: 'Try with a different JD' });
    retryBtn.style.marginTop = '1.5rem';
    retryBtn.addEventListener('click', function () {
      showPanel('connect');
    });
    container.appendChild(retryBtn);

    panel.appendChild(container);
  }


  // ════════════════════════════════════════════════════
  // CONNECTED STATE
  // ════════════════════════════════════════════════════

  function applyConnectedState() {
    // Unlock the locked card
    var lockedCard = document.querySelector('[data-card="card-fitscore"]');
    if (lockedCard) {
      lockedCard.classList.remove('ev-locked');
      var lockInd = lockedCard.querySelector('.ev-lock-indicator');
      if (lockInd) lockInd.remove();
      var tag = lockedCard.querySelector('.ev-card-tag');
      if (tag) tag.textContent = 'Connected';
    }

    // Unlock the locked pill
    var pills = document.querySelectorAll('.ev-fenix-pill');
    pills.forEach(function (pill) {
      if (pill.textContent.indexOf('evaluate each other') !== -1) {
        pill.classList.remove('ev-locked');
        var badge = pill.querySelector('.ev-lock-badge');
        if (badge) badge.remove();
      }
    });

    // Persona-to-person name transition
    if (state.connectedName) {
      transitionNameLabel();
    }
  }

  function transitionNameLabel() {
    var labels = document.querySelectorAll('.pill-persona-name, .hero-tagline');
    labels.forEach(function (label) {
      if (label.textContent === 'The Evaluator') {
        label.classList.add('ev-name-transitioning');
        setTimeout(function () {
          label.textContent = state.connectedName;
          label.classList.remove('ev-name-transitioning');
        }, 300);
      }
    });
  }

  function showFenixMessage(text) {
    var fenixCol = document.querySelector('.ev-fenix-column');
    if (!fenixCol) return;

    var msg = el('div', 'ev-transition-message', { text: text });

    // Insert after the opening frame
    var openingFrame = fenixCol.querySelector('.ev-fenix-opening-frame');
    if (openingFrame && openingFrame.nextSibling) {
      fenixCol.insertBefore(msg, openingFrame.nextSibling);
    } else {
      fenixCol.appendChild(msg);
    }

    // Gentle fade after 10 seconds
    setTimeout(function () {
      msg.style.opacity = '0.6';
    }, 10000);
  }


  // ════════════════════════════════════════════════════
  // EXPORT PUBLIC INTERFACE
  // ════════════════════════════════════════════════════

  window.EvaluatorExperience = {
    init: function (persona) {
      if (persona === 'evaluator') {
        init();
      }
    },
    showPanel: showPanel,
    closePanel: closePanel
  };

})();
