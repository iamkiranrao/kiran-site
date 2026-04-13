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
  var FENIX_OPENING = 'Quick context before we start. This isn\'t a portfolio site. It\'s a product Kiran built.\n\nThe resume comes in three versions, each tuned to a different kind of search. Got a role in mind? Paste the JD and I\'ll show you exactly how Kiran\'s experience maps to it. And I\'m not a template chatbot. I\'ve been trained on Kiran\'s actual work, his decisions, and how he thinks.\n\nThis site isn\'t designed for a 30-second skim. But every minute you spend here will surface insights you\'d otherwise spend weeks piecing together. The more you experience, the more you understand about how Kiran thinks and works.\n\nI\'m here to help you focus on what matters to you.';

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

  // ── Fenix Agent State ─────────────────────────────
  // Persistent conversation state sent to the backend with each request.
  // SessionStorage: survives page nav within the tab, gone on tab close.
  var FENIX_AGENT_URL = 'https://api.kiranrao.ai/api/v1/fenix/agent';
  var FENIX_MSG_CAP = 30;

  // Generate a UUID v4 for session tracking
  function generateSessionId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  var fenixState = {
    sessionId: null,    // Set on init or restored from sessionStorage
    messages: [],       // Full conversation history (message objects)
    visitor: {
      persona: 'evaluator',
      name: null,
      company: null,
      email: null,
      connected: false
    },
    explored: {
      cardsClicked: [],
      panelsOpened: [],
      resumeLensSelected: null,
      fitNarrativeStarted: false,
      pillsUsed: [],
      messagesExchanged: 0
    },
    ui: {
      currentPanel: null,
      pillsVisible: true,
      inputEnabled: true,
      fenixTyping: false
    }
  };

  // Restore from sessionStorage if available
  (function restoreFenixState() {
    try {
      var saved = sessionStorage.getItem('fenixState');
      if (saved) {
        var parsed = JSON.parse(saved);
        // Merge — don't overwrite functions or defaults
        fenixState.sessionId = parsed.sessionId || null;
        fenixState.messages = parsed.messages || [];
        fenixState.visitor = parsed.visitor || fenixState.visitor;
        fenixState.explored = parsed.explored || fenixState.explored;
      }
    } catch (e) { /* ignore */ }
    // Ensure we always have a session ID
    if (!fenixState.sessionId) {
      fenixState.sessionId = generateSessionId();
    }
  })();

  function saveFenixState() {
    try {
      sessionStorage.setItem('fenixState', JSON.stringify({
        sessionId: fenixState.sessionId,
        messages: fenixState.messages.slice(-40), // Cap stored messages
        visitor: fenixState.visitor,
        explored: fenixState.explored
      }));
    } catch (e) { /* ignore */ }
  }

  // Sync connect state into fenixState
  if (state.connectedName) {
    fenixState.visitor.name = state.connectedName;
    fenixState.visitor.company = state.connectedCompany;
    fenixState.visitor.email = state.connectedEmail;
    fenixState.visitor.connected = true;
  }


  // ── Dynamic Pills — State Machine ────────────────
  // Returns contextual pill set based on what the visitor has explored.
  // Backend can override with suggested_pills SSE event.

  function getDefaultPills() {
    var ex = fenixState.explored;
    var connected = fenixState.visitor.connected;
    var msgs = ex.messagesExchanged;
    var pills = [];

    // Near message cap — nudge toward connect or wrap up
    if (msgs >= 25 && !connected) {
      return [
        { text: 'Let\u2019s connect before I go', action: 'agent' },
        { text: 'How would we evaluate each other?', action: 'agent', locked: true }
      ];
    }

    // Post-connect: shift toward deeper exploration
    if (connected) {
      if (!ex.fitNarrativeStarted) {
        pills.push({ text: 'Let\u2019s evaluate fit', action: 'agent' });
      }
      if (!ex.resumeLensSelected) {
        pills.push({ text: 'Show me resume options', action: 'agent' });
      }
      if (ex.panelsOpened.indexOf('resume') !== -1 && ex.panelsOpened.indexOf('questions') === -1) {
        pills.push({ text: 'What questions do recruiters ask?', action: 'agent' });
      }
      if (pills.length < 3) {
        pills.push({ text: 'What makes Kiran different?', action: 'agent' });
      }
      return pills.slice(0, 4);
    }

    // Resume was explored — suggest next steps
    if (ex.panelsOpened.indexOf('resume') !== -1) {
      if (!ex.resumeLensSelected || ex.resumeLensSelected === 'ai') {
        pills.push({ text: 'Show me the growth lens', action: 'agent' });
      }
      if (!ex.resumeLensSelected || ex.resumeLensSelected === 'growth') {
        pills.push({ text: 'Show me the AI lens', action: 'agent' });
      }
      if (ex.panelsOpened.indexOf('questions') === -1) {
        pills.push({ text: 'What questions do recruiters ask?', action: 'agent' });
      }
      pills.push({ text: 'Tell me about his work history', action: 'agent' });
      // Add connect nudge after enough engagement
      if (msgs >= 3) {
        pills.push({ text: 'How would we evaluate each other?', action: 'agent', locked: true });
      }
      return pills.slice(0, 4);
    }

    // Questions panel was explored but not resume
    if (ex.panelsOpened.indexOf('questions') !== -1 && ex.panelsOpened.indexOf('resume') === -1) {
      pills.push({ text: 'Show me resume options', action: 'agent' });
      pills.push({ text: 'What\u2019s his management style?', action: 'agent' });
      if (msgs >= 3) {
        pills.push({ text: 'How would we evaluate each other?', action: 'agent', locked: true });
      }
      return pills.slice(0, 4);
    }

    // Mid-conversation — some messages but no panels yet
    if (msgs >= 1) {
      pills.push({ text: 'Show me resume options', action: 'agent' });
      pills.push({ text: 'Tell me about his AI work', action: 'agent' });
      if (ex.cardsClicked.length === 0) {
        pills.push({ text: 'Give me a quick tour', action: 'agent' });
      }
      if (msgs >= 3) {
        pills.push({ text: 'How would we evaluate each other?', action: 'agent', locked: true });
      }
      return pills.slice(0, 4);
    }

    // Opening state — nothing explored yet
    return [
      { text: 'Show me resume options', action: 'resume', locked: false },
      { text: 'What should I be asking?', action: 'questions', locked: false },
      { text: 'How would we evaluate each other?', action: 'connect', locked: !connected },
      { text: 'Give me a quick tour', action: 'tour', locked: false }
    ];
  }

  function updatePills(newPills) {
    var container = document.querySelector('.ev-chat-pills');
    if (!container) return;

    // Fade out current pills
    container.classList.add('ev-pills-swapping');

    setTimeout(function () {
      // Clear existing pills
      container.innerHTML = '';

      // Build new pills
      newPills.forEach(function (pill) {
        var btn = el('button', 'ev-chat-pill');
        btn.textContent = pill.text;
        btn.setAttribute('data-action', pill.action || 'agent');

        if (pill.locked) {
          btn.classList.add('ev-locked');
          var badge = el('span', 'ev-lock-badge', { text: '\uD83D\uDD12' });
          btn.appendChild(badge);
        }

        btn.addEventListener('click', function () {
          handlePillClick(pill, container);
        });

        container.appendChild(btn);
      });

      // Fade in new pills
      container.classList.remove('ev-pills-swapping');
    }, 200); // Match CSS transition duration
  }


  // ── Tool Executors ────────────────────────────────
  // Maps Claude tool_use calls to actual page actions.
  // Each returns a string result sent back to the backend.
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
      // Open resume panel first if not already open
      if (fenixState.ui.currentPanel !== 'resume') {
        showPanel('resume');
        fenixState.explored.panelsOpened.push('resume');
        fenixState.ui.currentPanel = 'resume';
      }
      // Select the lens
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

    start_fit_narrative: function () {
      if (!fenixState.visitor.connected) {
        showPanel('connect');
        fenixState.ui.currentPanel = 'connect';
        return 'Visitor not connected yet — opened the connect panel';
      }
      showPanel('connect'); // Shows JD input when connected
      fenixState.explored.fitNarrativeStarted = true;
      fenixState.ui.currentPanel = 'connect';
      return 'Opened the Fit Narrative JD input';
    }
  };


  // ── Agent Communication Layer ─────────────────────
  // Handles the full SSE stream from the agent endpoint:
  // text_start → text_delta → text_end → tool_use → done

  function sendToAgent(userText, messageArea) {
    if (!fenixState.ui.inputEnabled) return;
    if (fenixState.explored.messagesExchanged >= FENIX_MSG_CAP) {
      addSystemMessage(messageArea, 'We\'ve had a great conversation. Want to continue it in person?');
      if (!fenixState.visitor.connected) {
        showPanel('connect');
      }
      return;
    }

    // Record the visitor message in state
    fenixState.messages.push({
      role: 'visitor',
      type: 'text',
      content: userText,
      timestamp: Date.now()
    });
    fenixState.explored.messagesExchanged++;

    // Disable input while Fenix is thinking
    fenixState.ui.inputEnabled = false;
    fenixState.ui.fenixTyping = true;
    setInputEnabled(false);

    // Build the request payload
    var payload = {
      messages: fenixState.messages.filter(function (m) {
        return m.type === 'text';
      }).map(function (m) {
        return {
          role: m.role === 'visitor' ? 'user' : 'assistant',
          content: m.content
        };
      }),
      visitor: fenixState.visitor,
      explored: fenixState.explored,
      session_id: fenixState.sessionId,
      page_url: window.location.href,
      user_agent: navigator.userAgent
    };

    // Create a placeholder Fenix bubble for streaming
    var fenixBubble = null;
    var fenixContent = null;
    var fullResponse = '';

    fetch(FENIX_AGENT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (response) {
      if (!response.ok) throw new Error('Agent API returned ' + response.status);

      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';

      function readStream() {
        return reader.read().then(function (result) {
          if (result.done) {
            // Stream finished — finalize
            if (fullResponse) {
              fenixState.messages.push({
                role: 'fenix',
                type: 'text',
                content: fullResponse,
                timestamp: Date.now()
              });
            }
            fenixState.ui.inputEnabled = true;
            fenixState.ui.fenixTyping = false;
            setInputEnabled(true);
            saveFenixState();
            return;
          }

          buffer += decoder.decode(result.value, { stream: true });
          var events = buffer.split('\n\n');
          buffer = events.pop(); // Keep incomplete event in buffer

          events.forEach(function (eventStr) {
            if (!eventStr.trim()) return;
            var lines = eventStr.split('\n');
            lines.forEach(function (line) {
              if (line.indexOf('data: ') !== 0) return;
              try {
                var data = JSON.parse(line.substring(6));
                handleAgentEvent(data, messageArea);
              } catch (e) { /* ignore parse errors on partial chunks */ }
            });
          });

          return readStream();
        });
      }

      return readStream();
    }).catch(function (err) {
      console.error('Fenix agent error:', err);
      addFenixMessage(messageArea, 'I\'m having a moment — couldn\'t connect to my brain. Try again in a sec, or use the cards on the left to explore directly.');
      fenixState.ui.inputEnabled = true;
      fenixState.ui.fenixTyping = false;
      setInputEnabled(true);
    });

    // ── SSE Event Handler ──
    // Manages the streaming lifecycle and tool execution loop
    var currentBubble = null;
    var currentContent = null;
    var streamedText = '';
    var pendingSuggestedPills = null;

    function handleAgentEvent(data, msgArea) {
      switch (data.type) {
        case 'session':
          // Backend confirms session — store the IDs
          if (data.session_id) fenixState.sessionId = data.session_id;
          saveFenixState();
          break;

        case 'text_start':
          // Create a new Fenix message bubble for streaming
          currentBubble = el('div', 'ev-msg ev-msg-fenix');
          var avatar = el('img', 'ev-msg-avatar', { src: 'images/logo.png', alt: 'Fenix' });
          currentContent = el('div', 'ev-msg-content ev-streaming');
          currentBubble.appendChild(avatar);
          currentBubble.appendChild(currentContent);
          msgArea.appendChild(currentBubble);
          msgArea.scrollTop = msgArea.scrollHeight;
          streamedText = '';
          break;

        case 'text_delta':
          if (currentContent) {
            streamedText += data.content;
            currentContent.textContent = streamedText;
            msgArea.scrollTop = msgArea.scrollHeight;
          }
          break;

        case 'text_end':
          if (currentContent) {
            currentContent.classList.remove('ev-streaming');
          }
          if (streamedText) {
            fullResponse += (fullResponse ? '\n' : '') + streamedText;
          }
          currentBubble = null;
          currentContent = null;
          break;

        case 'tool_use':
          // Show thinking message
          addToolThinkingMessage(msgArea, data.name, data.args);
          // Execute the tool
          var executor = toolExecutors[data.name];
          if (executor) {
            var result = executor(data.args || {});
            addToolResultMessage(msgArea, data.name, result);
          } else {
            addToolResultMessage(msgArea, data.name, 'Unknown tool: ' + data.name);
          }
          break;

        case 'suggested_pills':
          // Backend override — Claude suggested contextual pills
          if (data.pills && data.pills.length > 0) {
            pendingSuggestedPills = data.pills.map(function (p) {
              return {
                text: typeof p === 'string' ? p : p.text,
                action: (p && p.action) || 'agent',
                locked: !!(p && p.locked)
              };
            });
          }
          break;

        case 'error':
          addFenixMessage(msgArea, data.message || 'Something went wrong on my end.');
          break;

        case 'done':
          // Final cleanup — re-enable input
          fenixState.ui.inputEnabled = true;
          fenixState.ui.fenixTyping = false;
          setInputEnabled(true);
          saveFenixState();
          // Update pills: use backend suggestions if available, else state machine
          if (pendingSuggestedPills) {
            updatePills(pendingSuggestedPills);
            pendingSuggestedPills = null;
          } else {
            updatePills(getDefaultPills());
          }
          break;
      }
    }
  }

  // ── Input state management ────────────────────────
  function setInputEnabled(enabled) {
    var input = document.querySelector('.ev-chat-input');
    var sendBtn = document.querySelector('.ev-chat-send');
    if (input) {
      input.disabled = !enabled;
      input.placeholder = enabled ? 'Ask me anything...' : 'Fenix is thinking...';
    }
    if (sendBtn) {
      sendBtn.disabled = !enabled;
    }
  }

  // ── Special Message Types ─────────────────────────
  function addToolThinkingMessage(messageArea, toolName, args) {
    var toolLabels = {
      open_panel: 'Opening ' + (args && args.panel ? args.panel : '') + ' panel...',
      close_panel: 'Closing the panel...',
      select_resume_lens: 'Selecting the ' + (args && args.lens ? args.lens.toUpperCase() : '') + ' resume...',
      scroll_to_section: 'Scrolling to ' + (args && args.section ? args.section : '') + '...',
      get_visitor_context: 'Checking what you\'ve explored...',
      start_fit_narrative: 'Setting up the fit analysis...'
    };
    var text = toolLabels[toolName] || 'Working on something...';
    var msg = el('div', 'ev-msg ev-msg-tool-thinking');
    msg.textContent = text;
    messageArea.appendChild(msg);
    messageArea.scrollTop = messageArea.scrollHeight;
  }

  function addToolResultMessage(messageArea, toolName, result) {
    var msg = el('div', 'ev-msg ev-msg-tool-result');
    msg.textContent = '\u2713 ' + result;
    messageArea.appendChild(msg);
    messageArea.scrollTop = messageArea.scrollHeight;
  }

  function addSystemMessage(messageArea, text) {
    var msg = el('div', 'ev-msg ev-msg-system');
    msg.textContent = text;
    messageArea.appendChild(msg);
    messageArea.scrollTop = messageArea.scrollHeight;
  }

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
      sendToAgent(text, messageArea);
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
    // Deliberately slow so the user's eye can track the full journey:
    // lift off → rise → hang at peak → descend → dissolve on landing
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
        transform: 'scale(0.95)',
        offset: 0.15
      },
      {
        left: midX + 'px',
        top: midY + 'px',
        opacity: 1,
        transform: 'scale(0.88)',
        offset: 0.4
      },
      {
        left: midX + (endX - midX) * 0.3 + 'px',
        top: midY + 'px',
        opacity: 1,
        transform: 'scale(0.85)',
        offset: 0.55
      },
      {
        left: (midX + endX) / 2 + 'px',
        top: (midY + endY) / 2 + 20 + 'px',
        opacity: 0.8,
        transform: 'scale(0.78)',
        offset: 0.75
      },
      {
        left: endX + 'px',
        top: endY + 'px',
        opacity: 0,
        transform: 'scale(0.65)',
        offset: 1
      }
    ];

    var animation = clone.animate(keyframes, {
      duration: 1200,
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

    // Track pill usage
    fenixState.explored.pillsUsed.push(pill.action);

    // Mark this pill as used (fade out)
    var pillBtn = pillContainer.querySelector('[data-action="' + pill.action + '"]');
    if (pillBtn) pillBtn.classList.add('ev-pill-used');

    // Route through the agent — Fenix decides what to do
    sendToAgent(pill.text, messageArea);
  }


  // ════════════════════════════════════════════════════
  // UNLOCK CARDS (Left Side)
  // ════════════════════════════════════════════════════

  function buildUnlockCards(container) {
    var cardsWrap = el('div', 'ev-unlock-cards');

    // Section header
    cardsWrap.appendChild(el('div', 'ev-unlock-cards-header', { text: 'These features were curated especially for you ↘' }));

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
        id: 'card-fit-narrative',
        icon: '⚖️',
        title: 'How Kiran\'s Experience Maps to Your Role',
        tag: 'Connect to unlock',
        hook: 'Paste a job description and I\'ll show you exactly where Kiran\'s work lines up — specific projects, results, and scale.',
        cta: '→ Connect to get started',
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

      // Click handler — fly card title to chat, then route through Fenix agent
      // Matching pill fades out; other pills stay for continued conversation
      cardEl.addEventListener('click', function () {
        // Mark card as visited (shows checkmark)
        cardEl.classList.add('ev-card-visited');

        // Track in fenixState
        fenixState.explored.cardsClicked.push(card.id);

        var messageArea = document.querySelector('.ev-chat-messages');
        if (messageArea) {
          // Fade out the matching pill (same action = same intent, no need to show it twice)
          var matchingPill = document.querySelector('.ev-chat-pill[data-action="' + card.action + '"]');
          if (matchingPill) {
            matchingPill.classList.add('ev-pill-used');
          }

          // Fly the card title into the chat, then send to agent on landing
          flyCardToChat(cardEl, card.title, messageArea, function () {
            sendToAgent(card.title, messageArea);
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
      html: '<em>Fenix:</em> Give me a job description and I\'ll show you how Kiran\'s experience maps to it — specific projects, results, scale. Since this is personalized, I\'ll need to know who I\'m putting it together for.<br><br>Two ways to do that:'
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
      text: 'Welcome, ' + state.connectedName + '. Paste the job description and I\'ll map Kiran\'s experience to it.'
    }));

    var form = el('form', 'ev-jd-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      handleJDSubmit(form);
    });

    form.appendChild(el('textarea', 'ev-jd-input', { placeholder: 'Paste the full job description here...' }));
    form.appendChild(el('button', 'ev-btn-primary', { type: 'submit', text: 'Show me' }));

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

    // Sync to fenixState so the agent knows
    fenixState.visitor.name = name;
    fenixState.visitor.company = company;
    fenixState.visitor.email = email;
    fenixState.visitor.connected = true;
    saveFenixState();

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

    // Stash JD in sessionStorage for the dedicated page to pick up
    try {
      sessionStorage.setItem('fenix_fit_jd', jdText);
    } catch (e) {
      console.error('[evaluator] Failed to stash JD:', e);
    }

    // Navigate to the dedicated fit narrative page
    FC.navigateWithFenix('/fit-narrative.html');
  }

  // ════════════════════════════════════════════════════
  // CONNECTED STATE
  // ════════════════════════════════════════════════════

  function applyConnectedState() {
    // Unlock the locked card
    var lockedCard = document.querySelector('[data-card="card-fit-narrative"]');
    if (lockedCard) {
      lockedCard.classList.remove('ev-locked');
      var lockInd = lockedCard.querySelector('.ev-lock-indicator');
      if (lockInd) lockInd.remove();
      var tag = lockedCard.querySelector('.ev-card-tag');
      if (tag) tag.textContent = 'Connected';
    }

    // Unlock the locked pill
    var pills = document.querySelectorAll('.ev-chat-pill');
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
