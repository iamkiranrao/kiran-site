/**
 * ============================================
 * FENIX CORE
 * Shared Fenix agent infrastructure — communication, streaming,
 * state management, pills, messages, input handling.
 *
 * Page-specific behavior is provided by an adapter passed to
 * FenixCore.init(adapter). See fenix-adapters/ for implementations.
 *
 * Architecture: docs/FENIX-MODULE-ARCHITECTURE.md
 * ============================================
 */

(function () {
  'use strict';

  // ── Configuration Defaults ────────────────────────
  var DEFAULT_AGENT_URL = 'https://api.kirangorapalli.com/api/v1/fenix/agent';
  var DEFAULT_MSG_CAP = 30;
  var _logoPath = 'images/logo.png'; // overridden by adapter.logoPath if set

  // ── UUID Generator ────────────────────────────────
  function generateSessionId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  // ── Fenix State ───────────────────────────────────
  // Global conversation state. SessionStorage carries this across page
  // navigations within the same tab — one conversation, one Fenix, whole site.
  var fenixState = {
    sessionId: null,
    messages: [],
    visitor: {
      persona: 'general',
      name: null,
      company: null,
      email: null,
      connected: false
    },
    explored: {
      cardsClicked: [],
      panelsOpened: [],
      resumeLensSelected: null,
      fitScoreStarted: false,
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

  // Restore from sessionStorage (survives page nav, not tab close)
  (function restoreFenixState() {
    try {
      var saved = sessionStorage.getItem('fenixState');
      if (saved) {
        var parsed = JSON.parse(saved);
        fenixState.sessionId = parsed.sessionId || null;
        fenixState.messages = parsed.messages || [];
        fenixState.visitor = parsed.visitor || fenixState.visitor;
        fenixState.explored = parsed.explored || fenixState.explored;
      }
    } catch (e) { /* ignore */ }
    if (!fenixState.sessionId) {
      fenixState.sessionId = generateSessionId();
    }
  })();

  function saveFenixState() {
    try {
      sessionStorage.setItem('fenixState', JSON.stringify({
        sessionId: fenixState.sessionId,
        messages: fenixState.messages.slice(-40),
        visitor: fenixState.visitor,
        explored: fenixState.explored
      }));
    } catch (e) { /* ignore */ }
  }


  // ── DOM Utilities ─────────────────────────────────

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


  // ── Message Helpers ───────────────────────────────

  function addFenixMessage(messageArea, text) {
    var bubble = el('div', 'ev-msg ev-msg-fenix');
    var avatar = el('img', 'ev-msg-avatar', { src: _logoPath, alt: 'Fenix' });
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

  function addToolThinkingMessage(messageArea, toolName, args, adapter) {
    // Try adapter's custom labels first, fall back to generic
    var text = 'Working on something...';
    if (adapter && adapter.toolLabels && adapter.toolLabels[toolName]) {
      text = typeof adapter.toolLabels[toolName] === 'function'
        ? adapter.toolLabels[toolName](args)
        : adapter.toolLabels[toolName];
    }
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


  // ── Input State Management ────────────────────────

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


  // ── Pill System ───────────────────────────────────

  function updatePills(newPills, adapter) {
    var container = document.querySelector('.ev-chat-pills');
    if (!container) return;

    container.classList.add('ev-pills-swapping');

    setTimeout(function () {
      container.innerHTML = '';

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
          handlePillClick(pill, container, adapter);
        });

        container.appendChild(btn);
      });

      container.classList.remove('ev-pills-swapping');
    }, 200);
  }

  function handlePillClick(pill, pillContainer, adapter) {
    var messageArea = document.querySelector('.ev-chat-messages');
    if (!messageArea) return;

    addVisitorMessage(messageArea, pill.text);
    fenixState.explored.pillsUsed.push(pill.action);

    var pillBtn = pillContainer.querySelector('[data-action="' + pill.action + '"]');
    if (pillBtn) pillBtn.classList.add('ev-pill-used');

    // Let the adapter handle non-agent actions first
    if (adapter && adapter.onPillAction && adapter.onPillAction(pill)) {
      return; // Adapter handled it
    }

    // Default: route through the agent
    sendToAgent(pill.text, messageArea, adapter);
  }


  // ── Agent Communication Layer ─────────────────────
  // Handles the full SSE stream from the agent endpoint:
  // text_start → text_delta → text_end → tool_use → done

  function sendToAgent(userText, messageArea, adapter) {
    if (!fenixState.ui.inputEnabled) return;

    var msgCap = (adapter && adapter.messageCap) || DEFAULT_MSG_CAP;
    if (fenixState.explored.messagesExchanged >= msgCap) {
      addSystemMessage(messageArea, 'We\'ve had a great conversation. Want to continue it in person?');
      if (!fenixState.visitor.connected && adapter && adapter.onMessageCapReached) {
        adapter.onMessageCapReached();
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
    var agentUrl = (adapter && adapter.agentUrl) || DEFAULT_AGENT_URL;
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

    // Add available_tools if the adapter declares them
    if (adapter && adapter.availableTools) {
      payload.available_tools = adapter.availableTools;
    }

    var fullResponse = '';

    fetch(agentUrl, {
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
          buffer = events.pop();

          events.forEach(function (eventStr) {
            if (!eventStr.trim()) return;
            var lines = eventStr.split('\n');
            lines.forEach(function (line) {
              if (line.indexOf('data: ') !== 0) return;
              try {
                var data = JSON.parse(line.substring(6));
                handleAgentEvent(data, messageArea, adapter, fullResponseRef);
              } catch (e) { /* ignore parse errors on partial chunks */ }
            });
          });

          return readStream();
        });
      }

      return readStream();
    }).catch(function (err) {
      console.error('Fenix agent error:', err);
      addFenixMessage(messageArea, 'I\'m having a moment — couldn\'t connect to my brain. Try again in a sec.');
      fenixState.ui.inputEnabled = true;
      fenixState.ui.fenixTyping = false;
      setInputEnabled(true);
    });

    // SSE event handler state (scoped to this sendToAgent call)
    var currentBubble = null;
    var currentContent = null;
    var streamedText = '';
    var pendingSuggestedPills = null;

    // Use a mutable ref so the event handler can accumulate fullResponse
    var fullResponseRef = { value: '' };

    function handleAgentEvent(data, msgArea, adp, responseRef) {
      switch (data.type) {
        case 'session':
          if (data.session_id) fenixState.sessionId = data.session_id;
          saveFenixState();
          break;

        case 'text_start':
          currentBubble = el('div', 'ev-msg ev-msg-fenix');
          var avatar = el('img', 'ev-msg-avatar', { src: _logoPath, alt: 'Fenix' });
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
          addToolThinkingMessage(msgArea, data.name, data.args, adp);
          // Execute via adapter's tool executors
          var result = 'Unknown tool: ' + data.name;
          if (adp && adp.toolExecutors && adp.toolExecutors[data.name]) {
            result = adp.toolExecutors[data.name](data.args || {});
          }
          addToolResultMessage(msgArea, data.name, result);
          // Post-execution hook
          if (adp && adp.onToolResult) {
            adp.onToolResult(data.name, data.args, result);
          }
          break;

        case 'suggested_pills':
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
          fenixState.ui.inputEnabled = true;
          fenixState.ui.fenixTyping = false;
          setInputEnabled(true);
          saveFenixState();
          // Update pills: backend suggestions > adapter state machine > nothing
          if (pendingSuggestedPills) {
            updatePills(pendingSuggestedPills, adp);
            pendingSuggestedPills = null;
          } else if (adp && adp.getDefaultPills) {
            updatePills(adp.getDefaultPills(), adp);
          }
          // Adapter lifecycle hook
          if (adp && adp.onDone) {
            adp.onDone();
          }
          break;
      }
    }
  }


  // ── Core Init ─────────────────────────────────────
  // Called by each page adapter with its config.
  // Sets up the adapter reference and lets the adapter build its UI.

  var _activeAdapter = null;

  function initCore(adapter) {
    if (!adapter) {
      console.error('FenixCore.init() requires an adapter');
      return;
    }

    _activeAdapter = adapter;

    // Set logo path from adapter (for subpages that use relative paths)
    if (adapter.logoPath) {
      _logoPath = adapter.logoPath;
    }

    // Apply adapter's persona to fenixState (if not already set by sessionStorage)
    if (adapter.persona && !fenixState.visitor.persona) {
      fenixState.visitor.persona = adapter.persona;
    }
    // If adapter has a specific persona and visitor hasn't been assigned one yet
    // (or is still 'general'), use the adapter's persona
    if (adapter.persona && fenixState.visitor.persona === 'general') {
      fenixState.visitor.persona = adapter.persona;
    }

    // Let the adapter build its UI
    if (adapter.buildUI) {
      adapter.buildUI();
    }

    // Save state after init
    saveFenixState();
  }


  // ── Public API ────────────────────────────────────

  window.FenixCore = {
    init: initCore,
    fenixState: fenixState,
    sendToAgent: function (text, messageArea) {
      sendToAgent(text, messageArea, _activeAdapter);
    },
    addFenixMessage: addFenixMessage,
    addVisitorMessage: addVisitorMessage,
    addSystemMessage: addSystemMessage,
    addToolThinkingMessage: addToolThinkingMessage,
    addToolResultMessage: addToolResultMessage,
    updatePills: function (pills) {
      updatePills(pills, _activeAdapter);
    },
    saveFenixState: saveFenixState,
    setInputEnabled: setInputEnabled,
    el: el,
    append: append,
    generateSessionId: generateSessionId,
    getAdapter: function () { return _activeAdapter; }
  };

})();
