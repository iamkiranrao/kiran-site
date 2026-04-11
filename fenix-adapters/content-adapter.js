/**
 * ============================================
 * CONTENT ADAPTER
 * Fenix companion side panel for content pages:
 * teardowns, skills, blog posts, career highlights.
 *
 * UI: Edge tab (right) → slide-in panel → chat + pills.
 * Page-agnostic: reads section structure from the DOM,
 * generates contextual pills and inline prompts.
 *
 * Requires: fenix-core.js loaded first.
 * Architecture: docs/FENIX-MODULE-ARCHITECTURE.md
 * ============================================
 */

(function () {
  'use strict';

  var FC = window.FenixCore;
  var el = FC.el;
  var append = FC.append;
  var fenixState = FC.fenixState;

  // ── Page Context (inferred or configured) ─────────
  // Pages can override via window.FenixContentConfig before this script loads.
  var config = window.FenixContentConfig || {};

  var PAGE_TYPE = config.pageType || inferPageType();
  var PAGE_TITLE = config.pageTitle || inferPageTitle();
  var PAGE_COMPANY = config.pageCompany || inferPageCompany();
  var SECTIONS = [];  // populated in buildUI
  var BASE_PATH = config.basePath || inferBasePath();

  function inferPageType() {
    var path = window.location.pathname;
    if (path.indexOf('/teardowns/') !== -1) return 'teardown';
    if (path.indexOf('/skills') !== -1) return 'skills';
    if (path.indexOf('/blog/') !== -1) return 'blog';
    return 'content';
  }

  function inferPageTitle() {
    var h1 = document.querySelector('.subpage-hero-title, h1');
    return h1 ? h1.textContent.trim() : document.title.split(' - ')[0].trim();
  }

  function inferPageCompany() {
    // For teardowns, the company is usually in the breadcrumb or title
    var breadcrumb = document.querySelector('.breadcrumb .current');
    if (breadcrumb) return breadcrumb.textContent.trim();
    return '';
  }

  function inferBasePath() {
    // Determine relative path to site root for assets
    // /teardowns/geico-mobile-app.html → depth 1 → '../'
    // /index.html → depth 0 → './'
    var path = window.location.pathname;
    var depth = (path.match(/\//g) || []).length - 1;
    if (depth <= 0) return './';
    var prefix = '';
    for (var i = 0; i < depth; i++) prefix += '../';
    return prefix;
  }


  // ── Opening Message (contextual) ──────────────────

  function getOpeningMessage() {
    if (config.openingMessage) return config.openingMessage;

    if (PAGE_TYPE === 'teardown') {
      return 'I\'ve studied this ' + PAGE_TITLE + ' teardown closely. Ask me about any section, compare it to Kiran\'s other analyses, or I can explain the thinking behind any recommendation.';
    }
    if (PAGE_TYPE === 'skills') {
      return 'This is where Kiran\'s competencies come to life. Ask me about any skill here, how it maps to real work, or how these capabilities connect.';
    }
    if (PAGE_TYPE === 'blog') {
      return 'I\'ve read this post. Happy to discuss any part of it, add context from Kiran\'s experience, or connect it to his other work.';
    }
    return 'I\'m here if you want to dig deeper into anything on this page. Ask away.';
  }


  // ── Default Pills (contextual) ────────────────────

  function getDefaultPills() {
    var pills = [];

    if (PAGE_TYPE === 'teardown') {
      pills.push({ text: 'What would Kiran change first?', action: 'agent' });
      pills.push({ text: 'Compare to another teardown', action: 'agent' });
      if (SECTIONS.length > 0) {
        pills.push({ text: 'Walk me through the redesign', action: 'agent' });
      }
      pills.push({ text: 'What\'s the methodology?', action: 'agent' });
    } else if (PAGE_TYPE === 'skills') {
      pills.push({ text: 'Which skills are strongest?', action: 'agent' });
      pills.push({ text: 'How do these map to real projects?', action: 'agent' });
      pills.push({ text: 'Tell me about AI experience', action: 'agent' });
    } else {
      pills.push({ text: 'Tell me more about this', action: 'agent' });
      pills.push({ text: 'How does this connect to Kiran\'s work?', action: 'agent' });
    }

    // If they've been chatting a while and haven't connected, nudge
    if (fenixState.explored.messagesExchanged > 4 && !fenixState.visitor.connected) {
      pills.push({ text: 'I\'d like to connect with Kiran', action: 'agent' });
    }

    return pills;
  }


  // ── Tool Executors ────────────────────────────────

  var toolExecutors = {
    scroll_to_section: function (args) {
      var sectionId = args.section;
      var target = document.querySelector('[data-section-id="' + sectionId + '"]');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Brief highlight
        target.style.transition = 'box-shadow 0.3s ease';
        target.style.boxShadow = '0 0 0 2px rgba(123, 154, 204, 0.4)';
        setTimeout(function () { target.style.boxShadow = ''; }, 2000);
        return 'Scrolled to ' + sectionId + ' section.';
      }
      return 'Section "' + sectionId + '" not found on this page.';
    },

    highlight_section: function (args) {
      var sectionId = args.section;
      var target = document.querySelector('[data-section-id="' + sectionId + '"]');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        target.style.transition = 'box-shadow 0.4s ease, background 0.4s ease';
        target.style.boxShadow = '0 0 0 2px rgba(123, 154, 204, 0.5)';
        target.style.background = 'rgba(123, 154, 204, 0.04)';
        setTimeout(function () {
          target.style.boxShadow = '';
          target.style.background = '';
        }, 3000);
        return 'Highlighted the ' + sectionId + ' section.';
      }
      return 'Section "' + sectionId + '" not found.';
    },

    get_visitor_context: function () {
      return JSON.stringify({
        pageType: PAGE_TYPE,
        pageTitle: PAGE_TITLE,
        sections: SECTIONS.map(function (s) { return s.id; }),
        messagesExchanged: fenixState.explored.messagesExchanged,
        connected: fenixState.visitor.connected
      });
    },

    show_related_content: function (args) {
      var topic = args.topic || 'related content';
      if (args.url) {
        // Save current conversation as lastHopMessages for single-hop context
        var currentMessages = fenixState.messages.slice();
        try {
          var saved = JSON.parse(sessionStorage.getItem('fenixState') || '{}');
          saved.lastHopMessages = currentMessages;
          sessionStorage.setItem('fenixState', JSON.stringify(saved));
        } catch (e) { /* ignore */ }
        // Navigate with ?fenix=continue so the next page picks up context
        var url = args.url;
        var separator = url.indexOf('?') !== -1 ? '&' : '?';
        window.location.href = url + separator + 'fenix=continue';
        return 'Navigating to ' + topic + '...';
      }
      return 'Suggested exploring: ' + topic;
    },

    connect_visitor: function (args) {
      var result = FC.connectVisitor({
        first_name: args.first_name,
        last_name: args.last_name,
        company: args.company,
        email: args.email
      });
      if (!result.success) return 'Connect failed: ' + (result.reason || 'unknown');
      return 'Connected as ' + result.name + (result.company ? ' from ' + result.company : '') + '.';
    },

    collect_feedback: function (args) {
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
    scroll_to_section: function (args) { return 'Scrolling to ' + (args.section || 'section') + '...'; },
    highlight_section: function (args) { return 'Highlighting ' + (args.section || 'section') + '...'; },
    get_visitor_context: 'Checking what you\'ve explored...',
    show_related_content: function (args) { return 'Finding related content...'; },
    connect_visitor: 'Connecting you...',
    collect_feedback: 'Saving your feedback...'
  };


  // ── UI Construction ───────────────────────────────

  var panelOpen = false;
  var panelInitialized = false;
  var messageArea = null;

  function buildUI() {
    // Ensure clean state on load (bfcache can carry stale class)
    document.body.classList.remove('fenix-panel-open');
    panelOpen = false;

    discoverSections();
    injectEdgeTab();
    injectSidePanel();
    injectInlinePrompts();
    injectStyles();

    // Fenix-guided navigation: auto-open panel and send arrival context to agent
    if (FC.isContinuation) {
      setTimeout(function () {
        togglePanel();
        // After panel opens and history replays, send a contextual arrival prompt
        // to the agent so Fenix orients the visitor to the new page
        setTimeout(function () {
          var arrivalPrompt = buildArrivalPrompt();
          if (arrivalPrompt) {
            FC.sendToAgent(arrivalPrompt, messageArea);
          }
        }, 500);
      }, 300);
    } else if (fenixState.messages.length > 0) {
      // Not a continuation but has history — show badge on tab
      var badge = document.querySelector('.fenix-tab-badge');
      if (badge) {
        badge.textContent = fenixState.messages.length;
        badge.style.display = 'flex';
      }
    }
  }

  function buildArrivalPrompt() {
    // Build a hidden system-level prompt that tells the agent about the page
    // the visitor just landed on, so Fenix can orient them.
    var sectionList = SECTIONS.map(function (s) { return s.title; }).join(', ');
    var prompt = '[SYSTEM: The visitor just arrived on "' + PAGE_TITLE + '" (page type: ' + PAGE_TYPE + ') via Fenix-guided navigation from the previous page. ';
    prompt += 'Orient them to this page — briefly describe what they\'re looking at and suggest something specific to explore. ';
    if (sectionList) {
      prompt += 'Page sections: ' + sectionList + '. ';
    }
    prompt += 'Keep it to 2-3 sentences. Don\'t repeat the previous conversation — just welcome them to this new context.]';
    return prompt;
  }

  function discoverSections() {
    var sectionEls = document.querySelectorAll('[data-section-id]');
    SECTIONS = [];
    for (var i = 0; i < sectionEls.length; i++) {
      var sec = sectionEls[i];
      var titleEl = sec.querySelector('.section-title, h2, h3');
      SECTIONS.push({
        id: sec.getAttribute('data-section-id'),
        title: titleEl ? titleEl.textContent.trim() : sec.getAttribute('data-section-id'),
        type: sec.getAttribute('data-section-type') || '',
        element: sec
      });
    }
  }

  function injectEdgeTab() {
    var tab = el('div', 'fenix-edge-tab');
    tab.innerHTML =
      '<div class="fenix-edge-tab-inner">' +
        '<div class="fenix-edge-tab-pulse"></div>' +
        '<img class="fenix-edge-tab-icon" src="' + BASE_PATH + 'images/logo.png" alt="Fenix">' +
        '<span class="fenix-edge-tab-label">Ask Fenix</span>' +
        '<span class="fenix-tab-badge" style="display:none;"></span>' +
      '</div>';

    tab.addEventListener('click', function () {
      togglePanel();
    });

    document.body.appendChild(tab);
  }

  function injectSidePanel() {
    var panel = el('div', 'fenix-side-panel');

    // Header
    var header = el('div', 'fenix-sp-header');
    header.innerHTML =
      '<div class="fenix-sp-identity">' +
        '<img class="fenix-sp-avatar" src="' + BASE_PATH + 'images/logo.png" alt="Fenix">' +
        '<div>' +
          '<div class="fenix-sp-name">Fenix</div>' +
          '<div class="fenix-sp-context">Reading: ' + PAGE_TITLE + '</div>' +
        '</div>' +
      '</div>' +
      '<button class="fenix-sp-close" aria-label="Close Fenix">&times;</button>';

    header.querySelector('.fenix-sp-close').addEventListener('click', function () {
      togglePanel();
    });

    // Messages
    messageArea = el('div', 'fenix-sp-messages ev-chat-messages');

    // Pills
    var pillsContainer = el('div', 'fenix-sp-pills ev-chat-pills');

    // Input bar
    var inputBar = el('div', 'fenix-sp-input');
    inputBar.innerHTML =
      '<input type="text" class="ev-chat-input fenix-sp-input-field" placeholder="Ask about this page..." autocomplete="off">' +
      '<button class="ev-chat-send fenix-sp-send-btn" aria-label="Send">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
      '</button>';

    var input = inputBar.querySelector('.ev-chat-input');
    var sendBtn = inputBar.querySelector('.ev-chat-send');

    function doSend() {
      var text = input.value.trim();
      if (!text) return;
      FC.addVisitorMessage(messageArea, text);
      input.value = '';
      FC.sendToAgent(text, messageArea);
    }

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        doSend();
      }
    });

    sendBtn.addEventListener('click', doSend);

    append(panel, [header, messageArea, pillsContainer, inputBar]);
    document.body.appendChild(panel);
  }

  function initializePanelContent() {
    if (panelInitialized) return;
    panelInitialized = true;

    // Replay existing conversation history
    if (fenixState.messages.length > 0) {
      fenixState.messages.forEach(function (msg) {
        if (msg.role === 'visitor') {
          FC.addVisitorMessage(messageArea, msg.content);
        } else if (msg.role === 'fenix') {
          FC.addFenixMessage(messageArea, msg.content);
        }
      });
    } else {
      // First time — show opening message
      FC.addFenixMessage(messageArea, getOpeningMessage());
    }

    // Set initial pills
    FC.updatePills(getDefaultPills());
  }

  function togglePanel() {
    panelOpen = !panelOpen;
    document.body.classList.toggle('fenix-panel-open', panelOpen);

    if (panelOpen) {
      initializePanelContent();
      // Focus the input
      setTimeout(function () {
        var input = document.querySelector('.fenix-sp-input-field');
        if (input) input.focus();
      }, 400);
    }
  }


  // ── Inline Prompts ────────────────────────────────
  // Injected between content sections with contextual questions.

  function injectInlinePrompts() {
    if (SECTIONS.length < 2) return;

    // Check for custom prompts via data attributes
    var customPrompts = document.querySelectorAll('[data-fenix-prompt]');
    if (customPrompts.length > 0) {
      for (var i = 0; i < customPrompts.length; i++) {
        var promptEl = customPrompts[i];
        var promptText = promptEl.getAttribute('data-fenix-prompt');
        buildInlinePrompt(promptEl, promptText, 'after');
      }
      return;
    }

    // Auto-generate between sections
    for (var j = 0; j < SECTIONS.length - 1; j++) {
      var current = SECTIONS[j];
      var next = SECTIONS[j + 1];
      var promptText = generatePromptBetween(current, next);
      if (promptText) {
        // Find the section divider between them, or insert after the current section
        var divider = current.element.nextElementSibling;
        while (divider && !divider.classList.contains('section-divider') && divider !== next.element) {
          divider = divider.nextElementSibling;
        }
        var insertAfter = (divider && divider.classList.contains('section-divider')) ? divider : current.element;
        buildInlinePrompt(insertAfter, promptText, 'after');
      }
    }
  }

  function generatePromptBetween(current, next) {
    if (PAGE_TYPE === 'teardown') {
      var prompts = {
        'discovery|keep-kill-build': 'Curious how this discovery shaped the keep/kill/build decisions?',
        'keep-kill-build|redesign': 'Want to see how these decisions informed the redesign?',
        'redesign|business-case': 'Wondering about the business impact of these changes?'
      };
      var key = current.id + '|' + next.id;
      return prompts[key] || 'Have a question about ' + current.title + '?';
    }
    return 'Have a question about ' + current.title + '?';
  }

  function buildInlinePrompt(referenceEl, text, position) {
    var prompt = el('div', 'fenix-inline-prompt');
    prompt.innerHTML =
      '<img class="fenix-inline-icon" src="' + BASE_PATH + 'images/logo.png" alt="Fenix">' +
      '<span class="fenix-inline-text">' + text + '</span>' +
      '<span class="fenix-inline-arrow">&rarr;</span>';

    prompt.addEventListener('click', function () {
      if (!panelOpen) togglePanel();
      // Wait for panel to open, then send as a message
      setTimeout(function () {
        FC.addVisitorMessage(messageArea, text);
        FC.sendToAgent(text, messageArea);
      }, panelOpen ? 50 : 450);
    });

    if (position === 'after' && referenceEl.nextSibling) {
      referenceEl.parentNode.insertBefore(prompt, referenceEl.nextSibling);
    } else if (position === 'before') {
      referenceEl.parentNode.insertBefore(prompt, referenceEl);
    } else {
      referenceEl.parentNode.appendChild(prompt);
    }
  }


  // ── Styles (injected) ─────────────────────────────

  function injectStyles() {
    var css = '\n' +
      '/* ── Fenix Content Adapter — Side Panel ── */\n' +
      ':root {\n' +
      '  --fenix-panel-width: 380px;\n' +
      '  --fenix-accent: #7B9ACC;\n' +
      '  --fenix-accent-dim: rgba(123, 154, 204, 0.15);\n' +
      '  --fenix-accent-border: rgba(123, 154, 204, 0.25);\n' +
      '  --fenix-accent-glow: rgba(123, 154, 204, 0.08);\n' +
      '}\n' +

      /* Edge Tab */
      '.fenix-edge-tab {\n' +
      '  position: fixed; right: 0; top: 50%; transform: translateY(-50%);\n' +
      '  z-index: 1000; cursor: pointer;\n' +
      '  transition: right 0.35s cubic-bezier(0.4, 0, 0.2, 1);\n' +
      '}\n' +
      'body.fenix-panel-open .fenix-edge-tab { right: var(--fenix-panel-width); }\n' +
      '.fenix-edge-tab-inner {\n' +
      '  display: flex; align-items: center; gap: 8px; position: relative;\n' +
      '  background: var(--ev-bg-card, #141414);\n' +
      '  border: 1px solid var(--fenix-accent-border); border-right: none;\n' +
      '  border-radius: 10px 0 0 10px;\n' +
      '  padding: 12px 14px 12px 16px;\n' +
      '  transition: all 0.25s ease;\n' +
      '  box-shadow: -4px 0 20px rgba(0,0,0,0.3);\n' +
      '}\n' +
      '.fenix-edge-tab:hover .fenix-edge-tab-inner {\n' +
      '  background: rgba(123, 154, 204, 0.1);\n' +
      '  border-color: var(--fenix-accent); padding-right: 18px;\n' +
      '}\n' +
      '.fenix-edge-tab-icon {\n' +
      '  width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;\n' +
      '}\n' +
      '.fenix-edge-tab-label {\n' +
      '  font-size: 13px; font-weight: 500; color: var(--fenix-accent);\n' +
      '  letter-spacing: 0.02em; white-space: nowrap;\n' +
      '}\n' +
      '.fenix-edge-tab-pulse {\n' +
      '  position: absolute; top: 8px; left: 10px;\n' +
      '  width: 8px; height: 8px; border-radius: 50%;\n' +
      '  background: var(--fenix-accent);\n' +
      '  animation: fenixPulse 2.5s ease-in-out infinite;\n' +
      '}\n' +
      'body.fenix-panel-open .fenix-edge-tab-pulse { display: none; }\n' +
      '@keyframes fenixPulse {\n' +
      '  0%, 100% { opacity: 0.4; transform: scale(1); }\n' +
      '  50% { opacity: 1; transform: scale(1.3); }\n' +
      '}\n' +
      '.fenix-tab-badge {\n' +
      '  min-width: 18px; height: 18px; border-radius: 9px;\n' +
      '  background: var(--fenix-accent); color: #0a0a0a;\n' +
      '  font-size: 11px; font-weight: 700;\n' +
      '  display: flex; align-items: center; justify-content: center;\n' +
      '  padding: 0 5px;\n' +
      '}\n' +

      /* Side Panel */
      '.fenix-side-panel {\n' +
      '  position: fixed; top: 0; right: calc(-1 * var(--fenix-panel-width));\n' +
      '  width: var(--fenix-panel-width); height: 100vh; height: 100dvh;\n' +
      '  background: var(--ev-bg-card, #141414);\n' +
      '  border-left: 1px solid var(--ev-border, #222);\n' +
      '  z-index: 999; display: flex; flex-direction: column;\n' +
      '  transition: right 0.35s cubic-bezier(0.4, 0, 0.2, 1);\n' +
      '  box-shadow: -8px 0 40px rgba(0,0,0,0.4);\n' +
      '}\n' +
      'body.fenix-panel-open .fenix-side-panel { right: 0; }\n' +

      /* Panel Header */
      '.fenix-sp-header {\n' +
      '  display: flex; align-items: center; justify-content: space-between;\n' +
      '  padding: 16px 20px; border-bottom: 1px solid var(--ev-border, #222);\n' +
      '  flex-shrink: 0;\n' +
      '}\n' +
      '.fenix-sp-identity { display: flex; align-items: center; gap: 10px; }\n' +
      '.fenix-sp-avatar { width: 28px; height: 28px; border-radius: 50%; }\n' +
      '.fenix-sp-name { font-size: 14px; font-weight: 600; color: var(--ev-text-primary, #f0e6d3); }\n' +
      '.fenix-sp-context { font-size: 11px; color: var(--ev-text-muted, #8a8070); margin-top: 1px; }\n' +
      '.fenix-sp-close {\n' +
      '  width: 28px; height: 28px; border-radius: 6px; border: none;\n' +
      '  background: transparent; color: var(--ev-text-muted, #5a5347);\n' +
      '  cursor: pointer; font-size: 20px; line-height: 1;\n' +
      '  display: flex; align-items: center; justify-content: center;\n' +
      '  transition: all 0.15s;\n' +
      '}\n' +
      '.fenix-sp-close:hover {\n' +
      '  background: rgba(240, 230, 211, 0.06); color: var(--ev-text-primary, #f0e6d3);\n' +
      '}\n' +

      /* Messages */
      '.fenix-sp-messages {\n' +
      '  flex: 1; overflow-y: auto; padding: 20px;\n' +
      '  display: flex; flex-direction: column; gap: 12px;\n' +
      '}\n' +
      '.fenix-sp-messages::-webkit-scrollbar { width: 4px; }\n' +
      '.fenix-sp-messages::-webkit-scrollbar-track { background: transparent; }\n' +
      '.fenix-sp-messages::-webkit-scrollbar-thumb { background: var(--ev-border, #222); border-radius: 2px; }\n' +

      /* Pills in side panel */
      '.fenix-sp-pills {\n' +
      '  padding: 8px 20px; display: flex; flex-wrap: wrap; gap: 6px;\n' +
      '  border-top: 1px solid var(--ev-border, #222); flex-shrink: 0;\n' +
      '}\n' +

      /* Input bar */
      '.fenix-sp-input {\n' +
      '  display: flex; gap: 8px; padding: 12px 16px;\n' +
      '  border-top: 1px solid var(--ev-border, #222);\n' +
      '  background: var(--ev-bg-card, #141414); flex-shrink: 0;\n' +
      '}\n' +
      '.fenix-sp-input-field {\n' +
      '  flex: 1; background: rgba(255,255,255,0.05);\n' +
      '  border: 1px solid var(--ev-border, #222); border-radius: 8px;\n' +
      '  padding: 10px 14px; font-size: 14px;\n' +
      '  color: var(--ev-text-primary, #f0e6d3);\n' +
      '  outline: none; font-family: inherit;\n' +
      '}\n' +
      '.fenix-sp-input-field:focus { border-color: var(--fenix-accent-border); }\n' +
      '.fenix-sp-input-field::placeholder { color: var(--ev-text-muted, #5a5347); }\n' +
      '.fenix-sp-send-btn {\n' +
      '  width: 40px; height: 40px; border-radius: 8px; border: none;\n' +
      '  background: var(--fenix-accent); color: #0a0a0a;\n' +
      '  cursor: pointer; display: flex; align-items: center;\n' +
      '  justify-content: center; transition: opacity 0.15s; flex-shrink: 0;\n' +
      '}\n' +
      '.fenix-sp-send-btn:hover { opacity: 0.85; }\n' +
      '.fenix-sp-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }\n' +

      /* Hide site nav when panel is open (avoids overlap) */
      'body.fenix-panel-open .nav-right { display: none; }\n' +

      /* Content shift when panel is open (desktop only) */
      '@media (min-width: 900px) {\n' +
      '  body.fenix-panel-open { padding-right: var(--fenix-panel-width); }\n' +
      '}\n' +

      /* Mobile: full-width overlay */
      '@media (max-width: 899px) {\n' +
      '  .fenix-side-panel { width: 100%; right: -100%; }\n' +
      '  body.fenix-panel-open .fenix-side-panel { right: 0; }\n' +
      '  body.fenix-panel-open .fenix-edge-tab { display: none; }\n' +
      '  .fenix-edge-tab-label { display: none; }\n' +
      '}\n' +

      /* Inline Prompts */
      '.fenix-inline-prompt {\n' +
      '  display: flex; align-items: center; gap: 10px;\n' +
      '  padding: 14px 20px; margin: 24px 0;\n' +
      '  background: var(--fenix-accent-glow);\n' +
      '  border: 1px solid rgba(123, 154, 204, 0.12);\n' +
      '  border-radius: 10px; cursor: pointer;\n' +
      '  transition: all 0.2s ease;\n' +
      '}\n' +
      '.fenix-inline-prompt:hover {\n' +
      '  background: var(--fenix-accent-dim);\n' +
      '  border-color: var(--fenix-accent-border);\n' +
      '}\n' +
      '.fenix-inline-icon { width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0; }\n' +
      '.fenix-inline-text {\n' +
      '  flex: 1; font-size: 14px; color: var(--fenix-accent);\n' +
      '  font-weight: 500; letter-spacing: -0.01em;\n' +
      '}\n' +
      '.fenix-inline-arrow {\n' +
      '  font-size: 16px; color: var(--fenix-accent); opacity: 0.6;\n' +
      '  transition: opacity 0.2s, transform 0.2s;\n' +
      '}\n' +
      '.fenix-inline-prompt:hover .fenix-inline-arrow { opacity: 1; transform: translateX(3px); }\n' +

      /* ── Chat message styles (shared with evaluator, self-contained here) ── */
      '.ev-msg {\n' +
      '  display: flex; gap: 0.6rem; align-items: flex-start;\n' +
      '  animation: fenixMsgIn 0.35s ease-out;\n' +
      '}\n' +
      '@keyframes fenixMsgIn {\n' +
      '  from { opacity: 0; transform: translateY(8px); }\n' +
      '  to { opacity: 1; transform: translateY(0); }\n' +
      '}\n' +
      '.ev-msg-fenix { flex-direction: row; }\n' +
      '.ev-msg-visitor { flex-direction: row-reverse; }\n' +
      '.ev-msg-avatar {\n' +
      '  width: 24px; height: 24px; border-radius: 50%;\n' +
      '  border: 1px solid var(--fenix-accent-border);\n' +
      '  object-fit: contain; flex-shrink: 0; margin-top: 2px;\n' +
      '}\n' +
      '.ev-msg-content {\n' +
      '  padding: 0.7rem 1rem; border-radius: 12px;\n' +
      '  font-size: 0.82rem; line-height: 1.65;\n' +
      '  color: var(--ev-text-secondary, #c8bba8);\n' +
      '  font-weight: 300; max-width: 85%;\n' +
      '}\n' +
      '.ev-msg-fenix .ev-msg-content {\n' +
      '  background: var(--fenix-accent-glow);\n' +
      '  border: 1px solid rgba(123, 154, 204, 0.12);\n' +
      '  border-top-left-radius: 4px;\n' +
      '}\n' +
      '.ev-msg-visitor .ev-msg-content {\n' +
      '  background: rgba(240, 230, 211, 0.08);\n' +
      '  border: 1px solid var(--ev-border-light, #2a2a2a);\n' +
      '  border-top-right-radius: 4px;\n' +
      '  color: var(--ev-text-primary, #f0e6d3);\n' +
      '}\n' +
      '.ev-msg-tool-thinking {\n' +
      '  font-size: 0.75rem; font-style: italic; color: var(--fenix-accent);\n' +
      '  padding: 0.25rem 0 0.25rem 2.25rem; opacity: 0.85;\n' +
      '}\n' +
      '.ev-msg-tool-result {\n' +
      '  font-size: 0.72rem; color: var(--ev-text-muted, #5a5347);\n' +
      '  padding: 0.15rem 0 0.15rem 2.25rem;\n' +
      '}\n' +
      '.ev-msg-system {\n' +
      '  font-size: 0.72rem; color: var(--ev-text-muted, #5a5347);\n' +
      '  text-align: center; padding: 0.75rem 1rem;\n' +
      '}\n' +
      '.ev-streaming::after {\n' +
      '  content: "\\258C"; color: var(--fenix-accent);\n' +
      '  animation: fenixCursorBlink 0.8s ease infinite; margin-left: 1px;\n' +
      '}\n' +
      '@keyframes fenixCursorBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }\n' +

      /* Pill styles */
      '.ev-chat-pills {\n' +
      '  display: flex; flex-wrap: wrap; gap: 0.4rem;\n' +
      '  transition: opacity 0.3s ease;\n' +
      '}\n' +
      '.ev-chat-pills.ev-pills-swapping {\n' +
      '  opacity: 0; transform: translateY(4px);\n' +
      '  transition: opacity 0.15s ease, transform 0.15s ease;\n' +
      '  pointer-events: none;\n' +
      '}\n' +
      '.ev-chat-pill {\n' +
      '  background: transparent; border: 1px solid var(--ev-border, #222);\n' +
      '  padding: 0.45rem 0.85rem; border-radius: 999px;\n' +
      '  font-size: 0.75rem; color: var(--ev-text-secondary, #c8bba8);\n' +
      '  cursor: pointer; transition: all 0.2s ease;\n' +
      '  font-family: inherit; font-weight: 400;\n' +
      '  display: inline-flex; align-items: center; gap: 0.3rem;\n' +
      '  white-space: nowrap;\n' +
      '}\n' +
      '.ev-chat-pill:hover {\n' +
      '  background: var(--ev-text-primary, #f0e6d3);\n' +
      '  color: var(--ev-bg-primary, #0a0a0a);\n' +
      '  border-color: var(--ev-text-primary, #f0e6d3);\n' +
      '}\n' +
      '.ev-chat-pill.ev-pill-used {\n' +
      '  opacity: 0; transform: scale(0.9); pointer-events: none;\n' +
      '  max-width: 0; padding: 0; margin: 0; border-width: 0; overflow: hidden;\n' +
      '  transition: opacity 0.3s ease, transform 0.3s ease, max-width 0.4s ease 0.15s;\n' +
      '}\n' +

      /* Typing indicator */
      '.ev-typing-indicator { align-items: center; }\n' +
      '.ev-typing-dots {\n' +
      '  display: flex; align-items: center; gap: 5px;\n' +
      '  padding: 12px 16px;\n' +
      '  background: rgba(123,154,204,0.15); border: 1px solid rgba(123,154,204,0.3);\n' +
      '  border-radius: 16px 16px 16px 4px;\n' +
      '}\n' +
      '.ev-typing-dots span {\n' +
      '  display: block; width: 7px; height: 7px; border-radius: 50%;\n' +
      '  background: #7B9ACC; opacity: 0.4;\n' +
      '  animation: ev-dot-bounce 1.4s ease-in-out infinite;\n' +
      '}\n' +
      '.ev-typing-dots span:nth-child(2) { animation-delay: 0.2s; }\n' +
      '.ev-typing-dots span:nth-child(3) { animation-delay: 0.4s; }\n' +
      '@keyframes ev-dot-bounce {\n' +
      '  0%, 60%, 100% { opacity: 0.4; transform: translateY(0); }\n' +
      '  30% { opacity: 1; transform: translateY(-4px); }\n' +
      '}\n' +

      /* Light theme overrides */
      '[data-theme="light"] .fenix-edge-tab-inner { background: #fff; box-shadow: -4px 0 20px rgba(0,0,0,0.08); }\n' +
      '[data-theme="light"] .fenix-side-panel { background: #fff; box-shadow: -8px 0 40px rgba(0,0,0,0.08); }\n' +
      '[data-theme="light"] .fenix-sp-input-field { background: rgba(0,0,0,0.03); color: #1a1a1a; }\n' +
      '[data-theme="light"] .ev-msg-visitor .ev-msg-content { background: rgba(0,0,0,0.04); }\n' +
      '';

    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }


  // ── Keyboard Shortcut ─────────────────────────────

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panelOpen) {
      togglePanel();
    }
  });


  // ── Build Section List for Backend ────────────────
  // Tell the backend what sections exist on this page
  // so scroll_to_section and highlight_section work correctly.

  function getSectionEnum() {
    return SECTIONS.map(function (s) { return s.id; });
  }


  // ── Adapter Definition ────────────────────────────

  var contentAdapter = {
    persona: fenixState.visitor.persona || 'general',
    accentColor: '#7B9ACC',
    agentUrl: 'https://api.kiranrao.ai/api/v1/fenix/agent',
    logoPath: BASE_PATH + 'images/logo.png',
    messageCap: 30,

    availableTools: ['scroll_to_section', 'highlight_section', 'get_visitor_context', 'show_related_content', 'connect_visitor', 'collect_feedback'],

    buildUI: buildUI,
    openingMessage: null,  // set dynamically in initializePanelContent
    getDefaultPills: getDefaultPills,
    toolExecutors: toolExecutors,
    toolLabels: toolLabels,

    // Lifecycle hooks
    onMessageCapReached: null,
    onConnect: null,
    onPillAction: null,
    onToolResult: null,
    onDone: null
  };


  // ── Public API ────────────────────────────────────

  window.FenixContent = {
    init: function () {
      FC.init(contentAdapter);
    },
    openPanel: function () {
      if (!panelOpen) togglePanel();
    },
    closePanel: function () {
      if (panelOpen) togglePanel();
    },
    isOpen: function () {
      return panelOpen;
    }
  };

  // Auto-init: content adapter self-initializes on load
  // (unlike persona adapters which are triggered by persona-system.js)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      window.FenixContent.init();
    });
  } else {
    window.FenixContent.init();
  }

})();
