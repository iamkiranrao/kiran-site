/**
 * FENIX CARDS
 * Shared card rendering, modal management, and lightweight API
 * integration for the single-column Fenix zone layout.
 *
 * Each adapter defines card objects and passes them to FenixCards.renderCards().
 * Cards open a slide-up modal with one of three interaction types:
 *   static  — immediate content (no API call)
 *   choice  — button options → API or static response
 *   input   — text input → API response
 *
 * Requires: fenix-core.js loaded first.
 * Styles:   fenix-zone-styles.css
 */

(function () {
  'use strict';

  var FC = window.FenixCore;
  if (!FC) { console.error('FenixCards requires FenixCore'); return; }

  var DEFAULT_AGENT_URL = 'https://api.kiranrao.ai/api/v1/fenix/agent';
  var _logoPath = 'images/fenix/1fenixavatar1.png';

  var _visited = {};
  var _activePersona = null;
  var _activeCards = null;
  var _activeContainer = null;
  var _modalOpen = false;
  var _chatMessages = null;
  var _lastModalCard = null;

  var WELCOME_BACK = {
    'fit': "Hope that gave you a clear picture. Want to try another role, or explore something else?",
    'questions': "Those are the real answers — no rehearsal. Anything else you want to explore?",
    'poster': "Hope that brightened the office. What's next?",
    'buildstory': "That's how it got built — judgment on one side, AI on the other. What's next?",
    'judgment': "Every call has a tradeoff. Want to challenge another, or explore something else?",
    'problem': "Good problems deserve good thinking. What else?",
    'roast': "Had to be honest — Kiran asked for it. What's next?"
  };

  // ── SVG Icon Set ─────────────────────────────────
  var ICONS = {
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    question: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>',
    gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7v14"/><path d="M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"/><path d="M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5"/><rect x="3" y="7" width="18" height="4" rx="1"/></svg>',
    crosshair: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/></svg>',
    scale: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>',
    trade: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="m21 3-8.5 8.5"/><path d="M3 3l8.5 8.5"/><path d="M3 21l8.5-8.5"/><path d="m21 21-8.5-8.5"/><path d="M16 21h5v-5"/><path d="M8 21H3v-5"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 12-8.42 3.83a2 2 0 0 1-1.66 0L2 12"/><path d="m22 17-8.42 3.83a2 2 0 0 1-1.66 0L2 17"/></svg>',
    flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
    tool: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>'
  };

  // ── Utility ──────────────────────────────────────
  function h(tag, cls, attrs) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'html') el.innerHTML = attrs[k];
        else if (k === 'text') el.textContent = attrs[k];
        else el.setAttribute(k, attrs[k]);
      });
    }
    return el;
  }

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ── Typewriter Effect ───────────────────────────
  function typeText(el, text, opts) {
    opts = opts || {};
    var speed = opts.speed || 18;
    var startDelay = opts.delay || 300;
    var words = text.split(/(\s+)/);
    var i = 0;
    el.textContent = '';
    el.classList.add('fz-typing');
    setTimeout(function tick() {
      if (i < words.length) {
        el.textContent += words[i];
        i++;
        var pause = /[.!?—]$/.test(words[i - 1]) ? speed * 6 : speed;
        setTimeout(tick, pause);
      } else {
        el.classList.remove('fz-typing');
        el.classList.add('fz-typed');
      }
    }, startDelay);
  }

  // ── Render Cards ─────────────────────────────────
  function renderCards(cards, container, persona) {
    _activeCards = cards;
    _activeContainer = container;
    _activePersona = persona;
    container.innerHTML = '';

    var list = h('div', 'fz-cards');
    cards.forEach(function (card) {
      var row = h('div', 'fz-card');
      if (card.locked) row.classList.add('fz-locked');

      var visitKey = persona + ':' + card.id;
      if (_visited[visitKey]) row.classList.add('fz-visited');

      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');

      var icon = h('div', 'fz-card-icon', { html: ICONS[card.icon] || ICONS.target });
      row.appendChild(icon);

      var body = h('div', 'fz-card-body');
      var titleRow = h('div', 'fz-card-title-row');
      titleRow.appendChild(h('span', 'fz-card-title', { text: card.title }));
      titleRow.appendChild(h('span', 'fz-tag fz-tag--' + (card.tagType || 'tool'), { text: card.tag }));
      body.appendChild(titleRow);
      body.appendChild(h('div', 'fz-card-hook', { text: card.hook }));
      if (card.locked) {
        body.appendChild(h('div', 'fz-card-lock', { text: '🔒 Connect to unlock.' }));
      } else {
        body.appendChild(h('div', 'fz-card-cta', { text: card.cta }));
      }
      row.appendChild(body);

      if (_visited[visitKey]) {
        row.appendChild(h('div', 'fz-card-visited-mark', { text: '✓' }));
      }

      row.addEventListener('click', function () {
        if (card.locked) return;
        if (card.onClick) { card.onClick(card); return; }
        openModal(card);
      });
      row.addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && !card.locked) {
          e.preventDefault();
          if (card.onClick) { card.onClick(card); return; }
          openModal(card);
        }
      });

      list.appendChild(row);
    });
    container.appendChild(list);

    // Inline chat area below cards (standard chat widget pattern)
    var chatArea = h('div', 'fz-chat-area');

    // Chat header — agent name + avatar + status dot
    var chatHeader = h('div', 'fz-chat-header');
    var chatHeaderAv = h('div', 'fz-chat-header-av');
    chatHeaderAv.appendChild(h('img', '', { src: _logoPath, alt: 'Fenix' }));
    chatHeader.appendChild(chatHeaderAv);
    var chatHeaderName = h('span', 'fz-chat-header-name', { html: 'Fenix' });
    chatHeaderName.appendChild(h('span', 'fz-chat-header-dot'));
    chatHeader.appendChild(chatHeaderName);
    chatArea.appendChild(chatHeader);

    // Scrollable message area
    var chatMessages = h('div', 'fz-chat-messages');
    chatArea.appendChild(chatMessages);

    // Input row — textarea + send button
    var chatInputRow = h('div', 'fz-chat-input-row');
    var chatInput = h('textarea', 'fz-chat-input', {
      placeholder: 'Ask Fenix anything…',
      rows: '1'
    });
    var chatSend = h('button', 'fz-chat-send', {
      html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>'
    });
    chatSend.setAttribute('aria-label', 'Send');

    // Auto-grow textarea
    chatInput.addEventListener('input', function () {
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    });

    function submitFreeChat() {
      var text = chatInput.value.trim();
      if (!text) return;
      chatInput.value = '';
      chatInput.style.height = 'auto';
      chatMessages.classList.add('fz-chat-active');
      addChatBubble(chatMessages, text, 'visitor');
      streamChatReply(chatMessages, text);
    }
    chatSend.addEventListener('click', submitFreeChat);
    chatInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitFreeChat(); }
    });
    chatInputRow.appendChild(chatInput);
    chatInputRow.appendChild(chatSend);
    chatArea.appendChild(chatInputRow);
    container.appendChild(chatArea);
    _chatMessages = chatMessages;
  }

  // ── Modal Management ─────────────────────────────
  var _overlay = null;
  var _modalBody = null;

  function ensureOverlay() {
    if (_overlay) return;
    _overlay = h('div', 'fz-modal-overlay');
    var sheet = h('div', 'fz-modal-sheet');

    var header = h('div', 'fz-modal-header');
    var titleWrap = h('div', 'fz-modal-title-wrap');
    titleWrap.appendChild(h('div', 'fz-modal-kicker'));
    titleWrap.appendChild(h('div', 'fz-modal-title'));
    header.appendChild(titleWrap);
    var closeBtn = h('button', 'fz-modal-close', { text: '×' });
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.addEventListener('click', closeModal);
    header.appendChild(closeBtn);
    sheet.appendChild(header);

    _modalBody = h('div', 'fz-modal-body');
    sheet.appendChild(_modalBody);
    _overlay.appendChild(sheet);
    document.body.appendChild(_overlay);

    _overlay.addEventListener('click', function (e) {
      if (e.target === _overlay) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && _modalOpen) closeModal();
    });
  }

  function openModal(card) {
    ensureOverlay();
    var m = card.modal;
    if (!m) return;

    _overlay.querySelector('.fz-modal-kicker').textContent = m.kicker || '';
    _overlay.querySelector('.fz-modal-title').textContent = m.title || card.title;
    _modalBody.innerHTML = '';

    if (m.type !== 'render') {
      // Fenix identity
      var fenix = h('div', 'fz-modal-fenix');
      var modalAv = h('div', 'fz-modal-fenix-av');
      modalAv.appendChild(h('img', '', { src: _logoPath, alt: 'Fenix' }));
      fenix.appendChild(modalAv);
      fenix.appendChild(h('div', 'fz-modal-fenix-nm', { text: 'Fenix' }));
      _modalBody.appendChild(fenix);

      // Question
      if (m.question) {
        var q = h('div', 'fz-modal-question fz-fade-in', { text: m.question });
        _modalBody.appendChild(q);
      }
    }

    // Mark visited
    var visitKey = _activePersona + ':' + card.id;
    _visited[visitKey] = true;
    var fenixState = FC.fenixState;
    if (fenixState.explored.cardsClicked.indexOf(card.id) === -1) {
      fenixState.explored.cardsClicked.push(card.id);
    }

    // Branch by interaction type
    if (m.type === 'render' && typeof m.render === 'function') {
      m.render(_modalBody, card, { h: h, callFenix: callFenix, showThinking: showThinking, showVisitorEcho: showVisitorEcho, addFollowUp: addFollowUp, closeModal: closeModal, renderSimpleMarkdown: renderSimpleMarkdown });
    } else if (m.type === 'static') {
      showStaticOutput(m, card);
    } else if (m.type === 'choice') {
      showChoices(m, card);
    } else if (m.type === 'input') {
      showInput(m, card);
    }

    _lastModalCard = card;
    _overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    _modalOpen = true;
  }

  function closeModal() {
    if (!_overlay) return;
    var closedCard = _lastModalCard;
    _overlay.classList.remove('open');
    document.body.style.overflow = '';
    _modalOpen = false;
    _lastModalCard = null;
    if (_activeCards && _activeContainer) {
      renderCards(_activeCards, _activeContainer, _activePersona);
    }
    if (closedCard && _chatMessages) {
      var msg = WELCOME_BACK[closedCard.id] || "Welcome back. What would you like to explore next?";
      _chatMessages.classList.add('fz-chat-active');
      addChatBubble(_chatMessages, msg, 'fenix');
    }
  }

  // ── Interaction Types ────────────────────────────

  function showStaticOutput(m, card) {
    if (typeof m.staticContent === 'function') {
      var content = m.staticContent();
      var out = h('div', 'fz-modal-output fz-fade-in');
      if (typeof content === 'string') out.innerHTML = content;
      else out.appendChild(content);
      _modalBody.appendChild(out);
    } else if (m.output) {
      var out2 = h('div', 'fz-modal-output fz-fade-in', { html: m.output });
      _modalBody.appendChild(out2);
    }
    addFollowUp(card);
  }

  function showChoices(m, card) {
    var wrap = h('div', 'fz-modal-choices fz-fade-in');
    var choices = m.choices || [];
    choices.forEach(function (c) {
      var label = typeof c === 'string' ? c : c.label;
      var btn = h('button', 'fz-modal-choice', { text: label });
      btn.addEventListener('click', function () {
        showVisitorEcho(wrap, label);
        if (typeof c === 'object' && c.onSelect) {
          c.onSelect(label, _modalBody, card);
        } else if (m.onChoice) {
          m.onChoice(label, _modalBody, card);
        } else {
          showThinking(m.thinkingLabel || 'Working on it…', function () {
            if (m.output) {
              var out = h('div', 'fz-modal-output fz-fade-in', { html: typeof m.output === 'object' ? m.output.content : m.output });
              _modalBody.appendChild(out);
            }
            addFollowUp(card);
          });
        }
      });
      wrap.appendChild(btn);
    });
    _modalBody.appendChild(wrap);
  }

  function showInput(m, card) {
    var row = h('div', 'fz-modal-input-row fz-fade-in');
    var input = h('input', 'fz-modal-input');
    input.placeholder = m.placeholder || 'Type here…';
    var btn = h('button', 'fz-modal-submit', { text: 'Go' });
    row.appendChild(input);
    row.appendChild(btn);
    _modalBody.appendChild(row);
    setTimeout(function () { input.focus(); }, 350);

    function submit() {
      var val = input.value.trim();
      if (!val) return;
      showVisitorEcho(row, val);
      if (m.onSubmit) {
        m.onSubmit(val, _modalBody, card);
      } else if (m.promptFn) {
        callFenix(m.promptFn(val), m.thinkingLabel, _modalBody, card);
      } else {
        showThinking(m.thinkingLabel || 'Working on it…', function () {
          if (m.output) {
            var out = h('div', 'fz-modal-output fz-fade-in', { html: m.output });
            _modalBody.appendChild(out);
          }
          addFollowUp(card);
        });
      }
    }
    btn.addEventListener('click', submit);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
  }

  // ── Modal Helpers ────────────────────────────────

  function showVisitorEcho(replaceEl, text) {
    var echo = h('div', 'fz-modal-visitor-echo fz-fade-in');
    echo.appendChild(h('div', 'fz-modal-visitor-bubble', { text: text }));
    replaceEl.replaceWith(echo);
  }

  function showThinking(label, onDone) {
    var t = h('div', 'fz-modal-thinking fz-fade-in');
    t.innerHTML = '<div class="fz-modal-thinking-dots"><span></span><span></span><span></span></div>';
    t.appendChild(h('div', 'fz-modal-thinking-label', { text: label }));
    _modalBody.appendChild(t);
    _modalBody.scrollTop = _modalBody.scrollHeight;
    if (onDone) {
      setTimeout(function () {
        if (t.parentNode) t.remove();
        onDone();
        _modalBody.scrollTop = _modalBody.scrollHeight;
      }, 1200);
    }
    return t;
  }

  function addFollowUp(card) {
    var wrap = h('div', 'fz-modal-actions fz-fade-in');

    if (card && card.modal && card.modal.followUpActions) {
      card.modal.followUpActions.forEach(function (a) {
        var btn = h('button', 'fz-modal-action', { text: a.label });
        btn.addEventListener('click', function () {
          if (a.run) a.run(_modalBody, card);
        });
        wrap.appendChild(btn);
      });
    }

    var doneBtn = h('button', 'fz-modal-action', { text: 'Done — back to cards' });
    doneBtn.addEventListener('click', closeModal);
    wrap.appendChild(doneBtn);
    _modalBody.appendChild(wrap);
    _modalBody.scrollTop = _modalBody.scrollHeight;
  }

  // ── Simple markdown rendering (bold, line breaks) ──
  function renderSimpleMarkdown(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  // ── Fenix API Call (lightweight, for modal use) ──
  function callFenix(prompt, thinkingLabel, bodyEl, card) {
    var thinkingEl = showThinking(thinkingLabel || 'Working on it…');
    var fenixState = FC.fenixState;
    var payload = {
      messages: [{ role: 'user', content: prompt }],
      visitor: fenixState.visitor,
      explored: fenixState.explored,
      session_id: fenixState.sessionId,
      page_url: window.location.href,
      user_agent: navigator.userAgent
    };

    var accumulated = '';

    fetch(DEFAULT_AGENT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (response) {
      if (!response.ok) throw new Error('Agent API ' + response.status);
      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';
      var streamEl = null;

      function readStream() {
        return reader.read().then(function (result) {
          if (result.done) {
            if (thinkingEl && thinkingEl.parentNode) thinkingEl.remove();
            if (streamEl) {
              streamEl.classList.remove('fz-modal-streaming');
              streamEl.innerHTML = renderSimpleMarkdown(accumulated);
            }
            addFollowUp(card);
            bodyEl.scrollTop = bodyEl.scrollHeight;
            return;
          }

          buffer += decoder.decode(result.value, { stream: true });
          var events = buffer.split('\n\n');
          buffer = events.pop();

          events.forEach(function (eventStr) {
            if (!eventStr.trim()) return;
            var lines = eventStr.split('\n');
            lines.forEach(function (line) {
              if (line.indexOf('data: ') !== 0) return;
              try {
                var data = JSON.parse(line.substring(6));
                switch (data.type) {
                  case 'text_start':
                    if (thinkingEl && thinkingEl.parentNode) thinkingEl.remove();
                    streamEl = h('div', 'fz-modal-output fz-modal-streaming fz-fade-in');
                    bodyEl.appendChild(streamEl);
                    accumulated = '';
                    break;
                  case 'text_delta':
                    if (data.content) {
                      accumulated += data.content;
                      if (streamEl) streamEl.textContent = accumulated;
                      bodyEl.scrollTop = bodyEl.scrollHeight;
                    }
                    break;
                  case 'text_end':
                    if (streamEl) {
                      streamEl.classList.remove('fz-modal-streaming');
                      streamEl.innerHTML = renderSimpleMarkdown(accumulated);
                    }
                    break;
                  case 'session':
                    if (data.session_id) fenixState.sessionId = data.session_id;
                    break;
                }
              } catch (e) { /* ignore parse errors */ }
            });
          });

          return readStream();
        });
      }

      return readStream();
    }).catch(function () {
      if (thinkingEl && thinkingEl.parentNode) thinkingEl.remove();
      var err = h('div', 'fz-modal-output fz-fade-in', { html: '<p>Couldn’t connect right now — try again in a moment.</p>' });
      bodyEl.appendChild(err);
      addFollowUp(card);
    });
  }

  // ── Inline Chat Helpers ──────────────────────────
  function addChatBubble(container, text, role) {
    var msg = h('div', 'fz-chat-msg' + (role === 'visitor' ? ' fz-chat-msg--visitor' : ''));
    if (role !== 'visitor') {
      var av = h('div', 'fz-chat-msg-av');
      av.appendChild(h('img', '', { src: _logoPath, alt: 'Fenix' }));
      msg.appendChild(av);
    }
    var bubble = h('div', 'fz-chat-msg-bubble');
    bubble.textContent = text;
    msg.appendChild(bubble);
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    return bubble;
  }

  function addChatThinking(container) {
    var msg = h('div', 'fz-chat-msg');
    var av = h('div', 'fz-chat-msg-av');
    av.appendChild(h('img', '', { src: _logoPath, alt: 'Fenix' }));
    msg.appendChild(av);
    var thinking = h('div', 'fz-chat-thinking');
    thinking.innerHTML = '<div class="fz-chat-thinking-dots"><span></span><span></span><span></span></div><div class="fz-chat-thinking-label">thinking</div>';
    msg.appendChild(thinking);
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    return msg;
  }

  function streamChatReply(container, text) {
    var thinkingMsg = addChatThinking(container);
    var fenixState = FC.fenixState;
    var payload = {
      messages: [{ role: 'user', content: text }],
      visitor: fenixState.visitor,
      explored: fenixState.explored,
      session_id: fenixState.sessionId,
      page_url: window.location.href,
      user_agent: navigator.userAgent
    };
    var accumulated = '';

    fetch(DEFAULT_AGENT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (response) {
      if (!response.ok) throw new Error('Agent API ' + response.status);
      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';
      var bubble = null;

      function readStream() {
        return reader.read().then(function (result) {
          if (result.done) {
            if (thinkingMsg && thinkingMsg.parentNode) thinkingMsg.remove();
            if (bubble) {
              bubble.classList.remove('fz-chat-streaming');
              bubble.innerHTML = renderSimpleMarkdown(accumulated);
            }
            container.scrollTop = container.scrollHeight;
            return;
          }
          buffer += decoder.decode(result.value, { stream: true });
          var events = buffer.split('\n\n');
          buffer = events.pop();
          events.forEach(function (eventStr) {
            if (!eventStr.trim()) return;
            eventStr.split('\n').forEach(function (line) {
              if (line.indexOf('data: ') !== 0) return;
              try {
                var data = JSON.parse(line.substring(6));
                switch (data.type) {
                  case 'text_start':
                    if (thinkingMsg && thinkingMsg.parentNode) thinkingMsg.remove();
                    var msg = h('div', 'fz-chat-msg');
                    var av = h('div', 'fz-chat-msg-av');
                    av.appendChild(h('img', '', { src: _logoPath, alt: 'Fenix' }));
                    msg.appendChild(av);
                    bubble = h('div', 'fz-chat-msg-bubble fz-chat-streaming');
                    msg.appendChild(bubble);
                    container.appendChild(msg);
                    accumulated = '';
                    break;
                  case 'text_delta':
                    if (data.content) {
                      accumulated += data.content;
                      if (bubble) bubble.textContent = accumulated;
                      container.scrollTop = container.scrollHeight;
                    }
                    break;
                  case 'text_end':
                    if (bubble) {
                      bubble.classList.remove('fz-chat-streaming');
                      bubble.innerHTML = renderSimpleMarkdown(accumulated);
                    }
                    break;
                  case 'session':
                    if (data.session_id) fenixState.sessionId = data.session_id;
                    break;
                }
              } catch (e) { /* ignore parse errors */ }
            });
          });
          return readStream();
        });
      }
      return readStream();
    }).catch(function () {
      if (thinkingMsg && thinkingMsg.parentNode) thinkingMsg.remove();
      addChatBubble(container, "Couldn't connect right now — try again in a moment.", 'fenix');
    });
  }

  // ── Public API ───────────────────────────────────
  window.FenixCards = {
    renderCards: renderCards,
    openModal: openModal,
    closeModal: closeModal,
    callFenix: callFenix,
    showThinking: showThinking,
    showVisitorEcho: showVisitorEcho,
    addFollowUp: addFollowUp,
    ICONS: ICONS,
    h: h,
    isModalOpen: function () { return _modalOpen; },
    getVisited: function () { return _visited; },
    renderSimpleMarkdown: renderSimpleMarkdown,
    typeText: typeText
  };

})();
